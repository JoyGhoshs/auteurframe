using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AuteurFrame.Desktop
{
    internal sealed class MainForm : Form
    {
        private readonly Backend _backend;
        private readonly bool _devTools;
        private readonly WebView2 _view = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(5, 6, 10) };
        private bool _closingConfirmed;
        private bool _initStarted;
        private bool _readyRaised;

        public event Action StudioReady;

        public MainForm(Backend backend, bool devTools)
        {
            _backend = backend;
            _devTools = devTools;
            Text = "AuteurFrame";
            Icon = Resources.AppIcon();
            BackColor = Color.FromArgb(5, 6, 10);
            MinimumSize = new Size(1100, 700);
            StartPosition = FormStartPosition.Manual;
            LoadBounds();
            Controls.Add(_view);
            Load += (s, e) => Prepare();
        }

        public void Prepare()
        {
            if (_initStarted) return;
            _initStarted = true;
            _ = _view.Handle;
            _ = InitAsync();
        }

        private void RaiseReady()
        {
            if (_readyRaised) return;
            _readyRaised = true;
            StudioReady?.Invoke();
        }

        public static string WebViewVersion()
        {
            try { return CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch { return null; }
        }

        private async Task InitAsync()
        {
            try
            {
                var options = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
                var env = await CoreWebView2Environment.CreateAsync(null, AppPaths.WebViewDir, options);
                await _view.EnsureCoreWebView2Async(env);
                var core = _view.CoreWebView2;
                core.Settings.AreDevToolsEnabled = _devTools;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = true;
                core.Settings.AreBrowserAcceleratorKeysEnabled = true;
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.IsWebMessageEnabled = false;
                core.DocumentTitleChanged += (s, e) => Text = string.IsNullOrWhiteSpace(core.DocumentTitle) || core.DocumentTitle == "AuteurFrame" ? "AuteurFrame" : core.DocumentTitle + " - AuteurFrame";
                core.NavigationStarting += (s, e) =>
                {
                    if (IsLocal(e.Uri)) return;
                    e.Cancel = true;
                    if (e.IsUserInitiated) OpenExternal(e.Uri);
                    else Log.Write("blocked a script navigation to " + Safe(e.Uri));
                };
                core.NewWindowRequested += (s, e) =>
                {
                    if (IsLocal(e.Uri))
                    {
                        e.Handled = true;
                        var popup = new PopupForm(env, e.Uri, _devTools);
                        popup.Show(this);
                    }
                    else
                    {
                        e.Handled = true;
                        if (e.IsUserInitiated) OpenExternal(e.Uri);
                        else Log.Write("blocked a script popup to " + Safe(e.Uri));
                    }
                };
                core.PermissionRequested += (s, e) =>
                {
                    if (!IsLocal(e.Uri)) { e.State = CoreWebView2PermissionState.Deny; return; }
                    e.State = e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
                };
                core.ProcessFailed += (s, e) =>
                {
                    Log.Write("webview process failed: " + e.ProcessFailedKind);
                    if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited || e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                        BeginInvoke(new Action(() => { try { core.Reload(); } catch { } }));
                };
                core.NavigationCompleted += (s, e) => RaiseReady();
                core.Navigate(_backend.BaseUrl + "/");
            }
            catch (Exception ex)
            {
                RaiseReady();
                Log.Write("webview init failed: " + ex);
                MessageBox.Show(this, "AuteurFrame could not open its window.\n\n" + ex.Message, "AuteurFrame", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private bool IsLocal(string uri)
        {
            if (string.IsNullOrEmpty(uri)) return true;
            if (uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("data:", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
                return true;
            return Uri.TryCreate(uri, UriKind.Absolute, out var u) && (u.Host == "127.0.0.1" || u.Host == "localhost") && u.Port == _backend.Port;
        }

        internal static string Safe(string uri)
        {
            return Uri.TryCreate(uri, UriKind.Absolute, out var u) ? u.Scheme + "://" + u.Host : "(invalid)";
        }

        internal static void OpenExternal(string uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var u)) return;
            if (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps) return;
            try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); }
            catch (Exception ex) { Log.Write("open external failed: " + ex.Message); }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!_closingConfirmed && e.CloseReason == CloseReason.UserClosing && !_backend.Exited)
            {
                var running = _backend.ActiveRuns();
                if (running.Count > 0)
                {
                    var answer = MessageBox.Show(this,
                        "A film is still being made:\n\n  " + string.Join("\n  ", running.Take(5)) + "\n\nClosing AuteurFrame stops it. Everything finished so far is saved. Close anyway?",
                        "AuteurFrame", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
                    if (answer != DialogResult.Yes) { e.Cancel = true; return; }
                }
                _closingConfirmed = true;
            }
            SaveBounds();
            base.OnFormClosing(e);
        }

        private void LoadBounds()
        {
            var area = Screen.PrimaryScreen.WorkingArea;
            var bounds = new Rectangle(area.X + area.Width / 20, area.Y + area.Height / 20, area.Width * 9 / 10, area.Height * 9 / 10);
            bool maximized = true;
            try
            {
                if (File.Exists(AppPaths.WindowState))
                {
                    var d = new JavaScriptSerializer().Deserialize<WindowStateData>(File.ReadAllText(AppPaths.WindowState));
                    var r = new Rectangle(d.X, d.Y, Math.Max(1100, d.W), Math.Max(700, d.H));
                    if (Screen.AllScreens.Any(sc => sc.WorkingArea.IntersectsWith(r))) bounds = r;
                    maximized = d.Maximized;
                }
            }
            catch { }
            Bounds = bounds;
            if (maximized) WindowState = FormWindowState.Maximized;
        }

        private void SaveBounds()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                var d = new WindowStateData { X = r.X, Y = r.Y, W = r.Width, H = r.Height, Maximized = WindowState == FormWindowState.Maximized };
                File.WriteAllText(AppPaths.WindowState, new JavaScriptSerializer().Serialize(d));
            }
            catch { }
        }

        public sealed class WindowStateData
        {
            public int X { get; set; }
            public int Y { get; set; }
            public int W { get; set; }
            public int H { get; set; }
            public bool Maximized { get; set; }
        }
    }

    internal sealed class PopupForm : Form
    {
        public PopupForm(CoreWebView2Environment env, string url, bool devTools)
        {
            Text = "AuteurFrame";
            Icon = Resources.AppIcon();
            Size = new Size(1200, 800);
            StartPosition = FormStartPosition.CenterParent;
            var view = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(view);
            Load += async (s, e) =>
            {
                await view.EnsureCoreWebView2Async(env);
                view.CoreWebView2.Settings.AreDevToolsEnabled = devTools;
                view.CoreWebView2.DocumentTitleChanged += (o, a) => Text = view.CoreWebView2.DocumentTitle + " - AuteurFrame";
                view.CoreWebView2.Settings.AreHostObjectsAllowed = false;
                view.CoreWebView2.Settings.IsWebMessageEnabled = false;
                view.CoreWebView2.NewWindowRequested += (o, a) => { a.Handled = true; if (a.IsUserInitiated) MainForm.OpenExternal(a.Uri); };
                view.CoreWebView2.NavigationStarting += (o, a) =>
                {
                    if (Uri.TryCreate(a.Uri, UriKind.Absolute, out var u) && (u.Host == "127.0.0.1" || u.Host == "localhost")) return;
                    if (a.Uri.StartsWith("about:") || a.Uri.StartsWith("data:") || a.Uri.StartsWith("blob:")) return;
                    a.Cancel = true;
                    if (a.IsUserInitiated) MainForm.OpenExternal(a.Uri);
                };
                view.CoreWebView2.Navigate(url);
            };
        }
    }
}
