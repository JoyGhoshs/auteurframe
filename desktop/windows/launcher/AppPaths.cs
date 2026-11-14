using System;
using System.IO;
using System.Text;

namespace AuteurFrame.Desktop
{
    internal static class AppPaths
    {
        public static readonly string InstallDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        public static readonly string AppDir = Path.Combine(InstallDir, "app");
        public static readonly string RuntimeDir = Path.Combine(InstallDir, "runtime");
        public static readonly string Python = Path.Combine(RuntimeDir, "python", "python.exe");
        public static readonly string Node = Path.Combine(RuntimeDir, "node", "node.exe");
        public static readonly string FfmpegDir = Path.Combine(RuntimeDir, "ffmpeg");
        public static readonly string Ffmpeg = Path.Combine(FfmpegDir, "ffmpeg.exe");
        public static readonly string Ffprobe = Path.Combine(FfmpegDir, "ffprobe.exe");
        public static readonly string Chrome = Path.Combine(RuntimeDir, "chrome", "chrome.exe");

        public static string UserRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AuteurFrame");
        public static string DataDir => Path.Combine(UserRoot, "data");
        public static string LogDir => Path.Combine(UserRoot, "logs");
        public static string WebViewDir => Path.Combine(UserRoot, "webview");
        public static string ChromeAppProfile => Path.Combine(UserRoot, "chrome-app");
        public static string WindowState => Path.Combine(UserRoot, "window.json");
        public static string TempDir => Path.Combine(UserRoot, "tmp");

        public static void Ensure()
        {
            foreach (var d in new[] { UserRoot, DataDir, LogDir, WebViewDir, TempDir })
                Directory.CreateDirectory(d);
            try
            {
                File.WriteAllText(Path.Combine(TempDir, "package.json"), "{\"name\": \"auteurframe-temp\", \"private\": true}");
                var cutoff = DateTime.Now.AddDays(-1);
                foreach (var f in new DirectoryInfo(TempDir).GetFiles())
                    if (f.Name != "package.json" && f.LastWriteTime < cutoff) { try { f.Delete(); } catch { } }
                foreach (var d in new DirectoryInfo(TempDir).GetDirectories())
                    if (d.LastWriteTime < cutoff) { try { d.Delete(true); } catch { } }
            }
            catch { }
        }

        public static string[] MissingRuntime()
        {
            var missing = new System.Collections.Generic.List<string>();
            foreach (var f in new[] { Python, Node, Ffmpeg, Ffprobe, Chrome, Path.Combine(AppDir, "run.py") })
                if (!File.Exists(f)) missing.Add(f);
            return missing.ToArray();
        }
    }

    internal static class Log
    {
        private static readonly object Gate = new object();
        private static string _file;

        public static void Init()
        {
            _file = Path.Combine(AppPaths.LogDir, "launcher.log");
            try
            {
                if (File.Exists(_file) && new FileInfo(_file).Length > 2_000_000)
                    File.Copy(_file, _file + ".1", true);
                if (File.Exists(_file) && new FileInfo(_file).Length > 2_000_000)
                    File.WriteAllText(_file, "");
            }
            catch { }
        }

        public static void Write(string message)
        {
            if (_file == null) return;
            lock (Gate)
            {
                try { File.AppendAllText(_file, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + message + Environment.NewLine, Encoding.UTF8); }
                catch { }
            }
        }
    }
}
