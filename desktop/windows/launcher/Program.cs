using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AuteurFrame.Desktop
{
    internal static class Program
    {
        private const string MutexName = "Local\\AuteurFrameDesktop";
        private const string ShowEventName = "Local\\AuteurFrameDesktop.Show";
        private const int PreferredPort = 48800;

        [STAThread]
        private static int Main(string[] args)
        {
            bool devTools = args.Contains("--devtools");
            bool smoke = args.Contains("--smoke-test");
            string dataArg = ArgValue(args, "--data-dir");
            if (!string.IsNullOrEmpty(dataArg)) AppPaths.UserRoot = Path.GetFullPath(dataArg);
            if (args.Contains("--splash-preview"))
            {
                Application.EnableVisualStyles();
                AppPaths.Ensure();
                Log.Init();
                var preview = new SplashForm();
                preview.Shown += async (s, e) =>
                {
                    await Task.Delay(4000);
                    await preview.FinishAsync();
                    preview.Close();
                };
                Application.Run(preview);
                return 0;
            }
            string framesDir = ArgValue(args, "--splash-frames");
            if (!string.IsNullOrEmpty(framesDir))
            {
                foreach (var scale in new[] { 1f, 1.5f, 2f })
                    SplashForm.RenderFrames(framesDir, scale, 9.0, 0.0, 0.9, 2.2, 4.4, 6.5, 9.2, 9.6, 10.4);
                return 0;
            }

            using (var mutex = new Mutex(true, MutexName, out bool first))
            {
                if (!first && !smoke)
                {
                    try { using (var ev = EventWaitHandle.OpenExisting(ShowEventName)) ev.Set(); } catch { }
                    return 0;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                AppPaths.Ensure();
                Log.Init();
                Log.Write($"AuteurFrame desktop starting from {AppPaths.InstallDir}");
                Application.ThreadException += (s, e) => Fatal(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => Fatal(e.ExceptionObject as Exception);

                var missing = AppPaths.MissingRuntime();
                if (missing.Length > 0)
                {
                    Log.Write("missing runtime files: " + string.Join(", ", missing));
                    MessageBox.Show("AuteurFrame is missing some of its files:\n\n" + string.Join("\n", missing.Take(6)) + "\n\nPlease reinstall AuteurFrame.",
                        "AuteurFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 2;
                }

                using (var backend = new Backend())
                {
                    try { backend.Start(PreferredPort); }
                    catch (Exception ex)
                    {
                        Log.Write("backend start failed: " + ex);
                        MessageBox.Show("AuteurFrame could not start its engine.\n\n" + ex.Message, "AuteurFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return 3;
                    }

                    if (smoke) return SmokeTest(backend);

                    var splash = new SplashForm();
                    var context = new ApplicationContext(splash);
                    bool healthy = false, shown = false;
                    MainForm main = null;
                    System.Windows.Forms.Timer monitor = null;
                    using (var showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName))
                    {
                        splash.Shown += async (s, e) =>
                        {
                            var progress = new Progress<string>(splash.SetStatus);
                            var clock = Stopwatch.StartNew();
                            healthy = await backend.WaitHealthyAsync(TimeSpan.FromSeconds(180), progress, CancellationToken.None);
                            Log.Write($"splash: engine {(healthy ? "ready" : "failed")} after {clock.Elapsed.TotalSeconds:0.0}s");
                            if (healthy && MainForm.WebViewVersion() != null)
                            {
                                splash.SetStatus("Opening the studio");
                                main = new MainForm(backend, devTools);
                                var studio = new TaskCompletionSource<bool>();
                                main.StudioReady += () => studio.TrySetResult(true);
                                main.Prepare();
                                bool loaded = await Task.WhenAny(studio.Task, Task.Delay(TimeSpan.FromSeconds(25))) == studio.Task;
                                Log.Write($"splash: studio page {(loaded ? "loaded" : "still loading, showing anyway")} after {clock.Elapsed.TotalSeconds:0.0}s");
                                await splash.FinishAsync();
                                if (!main.IsDisposed)
                                {
                                    context.MainForm = main;
                                    main.Show();
                                    main.Activate();
                                    monitor = WatchStudio(main, backend, showEvent);
                                    shown = true;
                                    Log.Write($"splash: studio shown after {clock.Elapsed.TotalSeconds:0.0}s");
                                }
                            }
                            else if (healthy) await splash.FinishAsync();
                            splash.Close();
                        };
                        Application.Run(context);
                        monitor?.Dispose();
                    }

                    if (!healthy)
                    {
                        Log.Write("backend did not become healthy. Tail:\n" + backend.Tail());
                        var answer = MessageBox.Show("AuteurFrame's engine did not start.\n\n" + LastLines(backend.Tail(), 8) + "\n\nOpen the log folder?",
                            "AuteurFrame", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                        if (answer == DialogResult.Yes) Process.Start(new ProcessStartInfo(AppPaths.LogDir) { UseShellExecute = true });
                        return 4;
                    }
                    if (main == null)
                    {
                        Log.Write("WebView2 runtime not found; using the bundled browser window");
                        return RunInChromeApp(backend);
                    }
                    if (!shown)
                    {
                        Log.Write("the studio window could not be opened");
                        return 6;
                    }
                }
                Log.Write("AuteurFrame desktop closed");
                return 0;
            }
        }

        private static System.Windows.Forms.Timer WatchStudio(MainForm main, Backend backend, EventWaitHandle showEvent)
        {
            var watcher = new Thread(() =>
            {
                while (true)
                {
                    try { showEvent.WaitOne(); } catch { return; }
                    if (main.IsDisposed) return;
                    try
                    {
                        main.BeginInvoke(new Action(() =>
                        {
                            if (main.WindowState == FormWindowState.Minimized) main.WindowState = FormWindowState.Normal;
                            main.Activate();
                            main.BringToFront();
                        }));
                    }
                    catch (InvalidOperationException) { return; }
                }
            }) { IsBackground = true };
            watcher.Start();
            var monitor = new System.Windows.Forms.Timer { Interval = 3000 };
            monitor.Tick += (s, e) =>
            {
                if (!backend.Exited) return;
                monitor.Stop();
                Log.Write("backend exited unexpectedly. Tail:\n" + backend.Tail());
                MessageBox.Show(main, "AuteurFrame's engine stopped unexpectedly. Your projects are saved.\n\nPlease restart AuteurFrame. Details are in the log folder.",
                    "AuteurFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
                main.Close();
            };
            monitor.Start();
            return monitor;
        }

        private static int RunInChromeApp(Backend backend)
        {
            Directory.CreateDirectory(AppPaths.ChromeAppProfile);
            var psi = new ProcessStartInfo
            {
                FileName = AppPaths.Chrome,
                Arguments = $"--app={backend.BaseUrl}/ --user-data-dir=\"{AppPaths.ChromeAppProfile}\" --no-first-run --no-default-browser-check --disable-features=Translate --start-maximized",
                UseShellExecute = false,
            };
            var chrome = Process.Start(psi);
            try { backend.Job.Add(chrome); } catch { }
            chrome.WaitForExit();
            return 0;
        }

        private static int SmokeTest(Backend backend)
        {
            Console.WriteLine("smoke: waiting for backend on " + backend.BaseUrl);
            bool ok = backend.WaitHealthyAsync(TimeSpan.FromSeconds(180), null, CancellationToken.None).GetAwaiter().GetResult();
            Console.WriteLine(ok ? "smoke: healthy" : "smoke: FAILED\n" + backend.Tail());
            File.WriteAllText(Path.Combine(AppPaths.LogDir, "smoke.txt"), (ok ? "ok " : "fail ") + backend.BaseUrl);
            return ok ? 0 : 5;
        }

        private static string ArgValue(string[] args, string name)
        {
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            var eq = args.FirstOrDefault(a => a.StartsWith(name + "="));
            return eq?.Substring(name.Length + 1);
        }

        private static string LastLines(string text, int n)
        {
            var lines = (text ?? "").Split('\n').Where(l => l.Trim().Length > 0).ToArray();
            return string.Join("\n", lines.Skip(Math.Max(0, lines.Length - n)));
        }

        private static void Fatal(Exception ex)
        {
            Log.Write("fatal: " + ex);
            try { MessageBox.Show("AuteurFrame hit an unexpected error and needs to close.\n\n" + ex?.Message, "AuteurFrame", MessageBoxButtons.OK, MessageBoxIcon.Error); } catch { }
        }
    }
}
