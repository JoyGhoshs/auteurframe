using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace AuteurFrame.Desktop
{
    internal sealed class Backend : IDisposable
    {
        private readonly JobObject _job = new JobObject();
        private readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
        private Process _server;
        private StreamWriter _serverLog;
        private readonly Queue<string> _tail = new Queue<string>();

        public int Port { get; private set; }
        public int RendererPort { get; private set; }
        public string BaseUrl => "http://127.0.0.1:" + Port;
        public bool Exited => _server == null || _server.HasExited;
        public JobObject Job => _job;

        public static int FreePort(int preferred)
        {
            if (preferred > 0)
            {
                try
                {
                    var probe = new TcpListener(IPAddress.Loopback, preferred);
                    probe.Start();
                    probe.Stop();
                    return preferred;
                }
                catch (SocketException) { }
            }
            var l = new TcpListener(IPAddress.Loopback, 0);
            l.Start();
            int port = ((IPEndPoint)l.LocalEndpoint).Port;
            l.Stop();
            return port;
        }

        public void Start(int preferredPort)
        {
            Port = FreePort(preferredPort);
            RendererPort = FreePort(0);
            if (RendererPort == Port) RendererPort = FreePort(0);
            string logPath = Path.Combine(AppPaths.LogDir, "server.log");
            try { if (File.Exists(logPath)) File.Copy(logPath, Path.Combine(AppPaths.LogDir, "server.previous.log"), true); } catch { }
            _serverLog = new StreamWriter(new FileStream(logPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite), new UTF8Encoding(false)) { AutoFlush = true };

            var psi = new ProcessStartInfo
            {
                FileName = AppPaths.Python,
                Arguments = "-X utf8 \"" + Path.Combine(AppPaths.AppDir, "run.py") + "\" --host 127.0.0.1 --port " + Port,
                WorkingDirectory = AppPaths.AppDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            var env = psi.EnvironmentVariables;
            foreach (var k in new[] { "PYTHONPATH", "PYTHONHOME", "PYTHONSTARTUP", "NODE_OPTIONS", "NODE_PATH", "VIRTUAL_ENV" })
                if (env.ContainsKey(k)) env.Remove(k);
            env["AUTEUR_DATA"] = AppPaths.DataDir;
            env["AUTEUR_HOST"] = "127.0.0.1";
            env["AUTEUR_PORT"] = Port.ToString();
            env["AUTEUR_INTERNAL_URL"] = BaseUrl;
            env["RENDERER_HOST"] = "127.0.0.1";
            env["RENDERER_PORT"] = RendererPort.ToString();
            env["RENDERER_URL"] = "http://127.0.0.1:" + RendererPort;
            env["NODE_PATH_BIN"] = AppPaths.Node;
            env["FFMPEG_PATH"] = AppPaths.Ffmpeg;
            env["FFPROBE_PATH"] = AppPaths.Ffprobe;
            env["CHROME_PATH"] = AppPaths.Chrome;
            env["PYTHONUTF8"] = "1";
            env["PYTHONIOENCODING"] = "utf-8";
            env["PYTHONDONTWRITEBYTECODE"] = "1";
            env["PYTHONNOUSERSITE"] = "1";
            env["AUTEURFRAME_DESKTOP"] = "1";
            int nodes = RenderNodes();
            if (!env.ContainsKey("RENDER_CONCURRENCY")) env["RENDER_CONCURRENCY"] = nodes.ToString();
            if (!env.ContainsKey("AUTEUR_RENDER_CONCURRENCY")) env["AUTEUR_RENDER_CONCURRENCY"] = Math.Min(3, nodes).ToString();
            Log.Write($"render nodes {nodes} for {Environment.ProcessorCount} cores and {TotalMemoryGb():0.0} GB RAM");
            env["TEMP"] = AppPaths.TempDir;
            env["TMP"] = AppPaths.TempDir;
            string path = env.ContainsKey("PATH") ? env["PATH"] : "";
            env["PATH"] = string.Join(";", new[] { AppPaths.FfmpegDir, Path.GetDirectoryName(AppPaths.Node), Path.GetDirectoryName(AppPaths.Python), path });

            Log.Write($"starting backend on port {Port}, renderer {RendererPort}");
            _server = new Process { StartInfo = psi, EnableRaisingEvents = true };
            _server.OutputDataReceived += (s, e) => Capture(e.Data);
            _server.ErrorDataReceived += (s, e) => Capture(e.Data);
            _server.Start();
            try { _job.Add(_server); }
            catch (Exception ex) { Log.Write("job assign failed: " + ex.Message); }
            _server.BeginOutputReadLine();
            _server.BeginErrorReadLine();
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct MEMORYSTATUSEX
        {
            public uint dwLength; public uint dwMemoryLoad; public ulong ullTotalPhys; public ulong ullAvailPhys; public ulong ullTotalPageFile;
            public ulong ullAvailPageFile; public ulong ullTotalVirtual; public ulong ullAvailVirtual; public ulong ullAvailExtendedVirtual;
        }

        [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX buffer);

        public static double TotalMemoryGb()
        {
            var m = new MEMORYSTATUSEX { dwLength = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(MEMORYSTATUSEX)) };
            return GlobalMemoryStatusEx(ref m) ? m.ullTotalPhys / 1073741824.0 : 8.0;
        }

        public static int RenderNodes()
        {
            int byCpu = Math.Max(2, Environment.ProcessorCount / 2);
            int byRam = (int)Math.Floor(TotalMemoryGb() / 3.5);
            return Math.Max(2, Math.Min(6, Math.Min(byCpu, byRam)));
        }

        private void Capture(string line)
        {
            if (line == null) return;
            try { _serverLog?.WriteLine(line); } catch { }
            lock (_tail)
            {
                _tail.Enqueue(line);
                while (_tail.Count > 40) _tail.Dequeue();
            }
        }

        public string Tail()
        {
            lock (_tail) return string.Join(Environment.NewLine, _tail);
        }

        public async Task<bool> WaitHealthyAsync(TimeSpan timeout, IProgress<string> progress, CancellationToken ct)
        {
            var watch = Stopwatch.StartNew();
            while (watch.Elapsed < timeout && !ct.IsCancellationRequested)
            {
                if (Exited) return false;
                try
                {
                    var r = await _http.GetAsync(BaseUrl + "/api/health", ct).ConfigureAwait(false);
                    if (r.IsSuccessStatusCode) { Log.Write($"backend healthy after {watch.Elapsed.TotalSeconds:0.0}s"); return true; }
                }
                catch { }
                progress?.Report(watch.Elapsed.TotalSeconds < 8 ? "Starting the studio engine" : watch.Elapsed.TotalSeconds < 25 ? "Loading the agents and render farm" : "Almost ready (the first start takes a little longer)");
                await Task.Delay(400, ct).ConfigureAwait(false);
            }
            return false;
        }

        public List<string> ActiveRuns()
        {
            var result = new List<string>();
            try
            {
                var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var call = _http.GetStringAsync(BaseUrl + "/api/runs/active");
                if (!call.Wait(TimeSpan.FromMilliseconds(1500)))
                {
                    Log.Write("active run check timed out; closing without asking");
                    return result;
                }
                if (js.DeserializeObject(call.Result) is Dictionary<string, object> d && d.TryGetValue("runs", out var runs) && runs is object[] items)
                    foreach (var item in items.OfType<Dictionary<string, object>>())
                    {
                        item.TryGetValue("title", out var title);
                        item.TryGetValue("id", out var id);
                        result.Add(string.IsNullOrWhiteSpace(title as string) ? id as string : title as string);
                    }
            }
            catch (Exception ex) { Log.Write("active run check failed: " + ex.Message); }
            return result;
        }

        public void Stop()
        {
            Log.Write("stopping backend");
            try { _job.Terminate(); } catch { }
            try { if (_server != null && !_server.HasExited) _server.Kill(); } catch { }
            try { _serverLog?.Dispose(); } catch { }
        }

        public void Dispose()
        {
            Stop();
            _job.Dispose();
            _http.Dispose();
        }
    }
}
