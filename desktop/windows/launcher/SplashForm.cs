using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AuteurFrame.Desktop
{
    internal sealed class SplashForm : Form
    {
        private const float DesignW = 1520f, LogicalW = 760f, LogicalH = 460f, ArtX = 600f;
        private static readonly Color Ink = Color.FromArgb(11, 13, 20), Light = Color.FromArgb(244, 242, 251), Mute = Color.FromArgb(155, 157, 178);
        private static readonly Color StatusInk = Color.FromArgb(217, 217, 234), Track = Color.FromArgb(38, 41, 56), Blue = Color.FromArgb(47, 91, 255), Coral = Color.FromArgb(255, 106, 69);
        private static readonly PointF[][] Links =
        {
            new[] { new PointF(985, 258), new PointF(1018, 335) }, new[] { new PointF(1196, 262), new PointF(1121, 343) },
            new[] { new PointF(1318, 344), new PointF(1178, 418) }, new[] { new PointF(1212, 664), new PointF(1138, 552) },
            new[] { new PointF(1000, 704), new PointF(1028, 568) }, new[] { new PointF(818, 538), new PointF(944, 492) },
            new[] { new PointF(842, 372), new PointF(948, 397) },
        };
        private static readonly PointF[] Centers = { new PointF(951, 149), new PointF(1220, 173), new PointF(1400, 296), new PointF(1244, 712), new PointF(977, 759), new PointF(759, 559), new PointF(770, 315) };
        private const double FirstLight = 0.35, LightStep = 0.85, DrawTime = 0.5, Fps = 12;

        private readonly Timer _timer = new Timer { Interval = (int)(1000 / Fps) };
        private readonly DateTime _start = DateTime.UtcNow;
        private readonly bool _motion;
        private readonly string _version;
        private Bitmap _bg, _lens, _labels, _frame;
        private readonly Bitmap[] _strip = new Bitmap[4], _lit = new Bitmap[7], _dim = new Bitmap[7];
        private Font _word, _sub, _credit, _small, _status;
        private float _s;
        private string _statusText = "Starting the studio engine…";
        private double? _readyAt;
        private TaskCompletionSource<bool> _finished;

        public SplashForm() : this(true) { }

        private SplashForm(bool live)
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ShowInTaskbar = true;
            Text = "AuteurFrame";
            Icon = Resources.AppIcon();
            BackColor = Ink;
            AutoScaleMode = AutoScaleMode.None;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.Opaque, true);
            var v = Assembly.GetExecutingAssembly().GetName().Version;
            _version = $"{v.Major}.{v.Minor}.{v.Build}";
            _motion = !live || AnimationsEnabled();
            ClientSize = new Size((int)LogicalW, (int)LogicalH);
            if (live)
            {
                _timer.Tick += (s, e) => Invalidate();
                if (_motion) _timer.Start();
            }
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try { int round = 2; DwmSetWindowAttribute(Handle, 33, ref round, sizeof(int)); } catch { }
            Rebuild(DeviceDpi / 96f);
            CenterToScreen();
        }

        private void FitTo(Size size)
        {
            MinimumSize = Size.Empty;
            MaximumSize = Size.Empty;
            Size = size;
            if (ClientSize != size) Size = new Size(size.Width + (Size.Width - ClientSize.Width), size.Height + (Size.Height - ClientSize.Height));
            MinimumSize = Size;
            MaximumSize = Size;
        }

        protected override void OnShown(EventArgs e)
        {
            if (_frame != null && ClientSize != _frame.Size)
            {
                FitTo(_frame.Size);
                CenterToScreen();
            }
            base.OnShown(e);
            Log.Write($"splash: window {Size.Width}x{Size.Height}, client {ClientSize.Width}x{ClientSize.Height}, art {_frame?.Width}x{_frame?.Height}, dpi {DeviceDpi}");
        }

        protected override void OnDpiChanged(DpiChangedEventArgs e)
        {
            base.OnDpiChanged(e);
            Rebuild(e.DeviceDpiNew / 96f);
        }

        public void SetStatus(string text)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action<string>(SetStatus), text); return; }
            var t = (text ?? "").Trim().TrimEnd('.', '…');
            if (t.Length > 0) _statusText = t + "…";
            if (!_motion) Invalidate();
        }

        public Task FinishAsync()
        {
            if (_finished != null) return _finished.Task;
            _finished = new TaskCompletionSource<bool>();
            _statusText = "Opening the studio";
            _readyAt = Elapsed();
            if (!_motion) { Invalidate(); _finished.TrySetResult(true); return _finished.Task; }
            var done = _readyAt.Value + LightsDoneAfter(_readyAt.Value) + 0.45;
            var wait = new Timer { Interval = 40 };
            wait.Tick += (s, e) =>
            {
                if (Elapsed() < done) return;
                wait.Stop();
                wait.Dispose();
                _finished.TrySetResult(true);
            };
            wait.Start();
            return _finished.Task;
        }

        private double Elapsed() => (DateTime.UtcNow - _start).TotalSeconds;

        private static double LitAt(int i, double? readyAt)
        {
            double planned = i < 6 ? FirstLight + i * LightStep : double.PositiveInfinity;
            if (readyAt == null || planned <= readyAt.Value) return planned;
            int pending = 0;
            for (int j = 0; j < i; j++) if (j >= 6 || FirstLight + j * LightStep > readyAt.Value) pending++;
            return readyAt.Value + pending * (2 / Fps);
        }

        private static double LightsDoneAfter(double readyAt)
        {
            double last = Enumerable.Range(0, 7).Select(i => LitAt(i, readyAt)).Max();
            return Math.Max(0, last - readyAt) + DrawTime;
        }

        private void Rebuild(float dpi)
        {
            var size = new Size((int)Math.Round(LogicalW * dpi), (int)Math.Round(LogicalH * dpi));
            FitTo(size);
            _s = size.Width / DesignW;
            DisposeLayers();
            _bg = Layer("bg", size, 1f);
            _lens = Layer("lens", size, 1f);
            _labels = Layer("labels", size, 1f);
            for (int k = 0; k < 4; k++) _strip[k] = Layer("strip" + k, size, 1f);
            for (int i = 0; i < 7; i++) { _lit[i] = Layer("v" + (i + 1), size, 1f); _dim[i] = Layer("v" + (i + 1), size, 0.28f); }
            _frame = new Bitmap(size.Width, size.Height, PixelFormat.Format32bppPArgb);
            var display = InstalledFamily("Segoe UI Variable Display", "Segoe UI");
            var text = InstalledFamily("Segoe UI Variable Text", "Segoe UI");
            _word = new Font(display, 56 * _s, FontStyle.Bold, GraphicsUnit.Pixel);
            _sub = new Font(text, 25 * _s, FontStyle.Regular, GraphicsUnit.Pixel);
            _credit = new Font(text, 25 * _s, FontStyle.Bold, GraphicsUnit.Pixel);
            _small = new Font(text, 21.5f * _s, FontStyle.Regular, GraphicsUnit.Pixel);
            _status = new Font(text, 24 * _s, FontStyle.Regular, GraphicsUnit.Pixel);
        }

        private static string InstalledFamily(params string[] names)
        {
            using (var fonts = new InstalledFontCollection())
                foreach (var n in names)
                    if (fonts.Families.Any(f => string.Equals(f.Name, n, StringComparison.OrdinalIgnoreCase))) return n;
            return SystemFonts.MessageBoxFont.FontFamily.Name;
        }

        private static Bitmap Layer(string name, Size size, float alpha)
        {
            var bmp = new Bitmap(size.Width, size.Height, PixelFormat.Format32bppPArgb);
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("splash." + name + ".png"))
            {
                if (stream == null) return bmp;
                using (var src = System.Drawing.Image.FromStream(stream))
                using (var g = Graphics.FromImage(bmp))
                using (var attrs = new ImageAttributes())
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.CompositingQuality = CompositingQuality.HighQuality;
                    if (alpha < 1f) attrs.SetColorMatrix(new ColorMatrix { Matrix33 = alpha });
                    attrs.SetWrapMode(WrapMode.TileFlipXY);
                    g.DrawImage(src, new Rectangle(0, 0, size.Width, size.Height), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, attrs);
                }
            }
            return bmp;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            if (_frame == null) return;
            using (var g = Graphics.FromImage(_frame)) Compose(g, _motion ? Elapsed() : 30.0, _motion ? _readyAt : 0.0, _statusText);
            e.Graphics.DrawImageUnscaled(_frame, 0, 0);
        }

        private PointF P(float x, float y) => new PointF(x * _s, y * _s);

        private void Compose(Graphics g, double t, double? readyAt, string status)
        {
            int w = _frame.Width, h = _frame.Height;
            float artX = ArtX * _s;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Ink);

            g.DrawImageUnscaled(_bg, 0, 0);
            g.SetClip(new RectangleF(artX, 0, w - artX, h));

            using (var orbit = new Pen(Ink, 2 * _s) { DashCap = DashCap.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
            {
                orbit.DashPattern = new[] { 0.01f, 5f };
                orbit.DashOffset = (float)(-(Math.Floor(t * Fps) * 0.06) % 5.01);
                var c = P(1060, 450);
                float r = 320 * _s;
                g.DrawEllipse(orbit, c.X - r, c.Y - r, 2 * r, 2 * r);
            }

            using (var pen = new Pen(Ink, 2.5f * _s) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            using (var dot = new SolidBrush(Ink))
            {
                for (int i = 0; i < 7; i++)
                {
                    double since = t - LitAt(i, readyAt);
                    if (since < 0) continue;
                    double k = Math.Min(1, Math.Floor(since / DrawTime * 6) / 6);
                    var a = P(Links[i][0].X, Links[i][0].Y);
                    var b = P(Links[i][1].X, Links[i][1].Y);
                    var m = new PointF(a.X + (b.X - a.X) * (float)k, a.Y + (b.Y - a.Y) * (float)k);
                    if (k > 0) g.DrawLine(pen, a, m);
                    if (k >= 1) g.FillEllipse(dot, b.X - 5 * _s, b.Y - 5 * _s, 10 * _s, 10 * _s);
                }
            }

            int pull = readyAt != null && t >= readyAt.Value ? (int)(Math.Floor(readyAt.Value * 4) % 4) : (int)(Math.Floor(t * 4) % 4);
            g.DrawImageUnscaled(_strip[_motion ? pull : 0], 0, 0);
            g.DrawImageUnscaled(_lens, 0, 0);

            using (var lensClip = new GraphicsPath())
            {
                var lc = P(1060, 450);
                lensClip.AddEllipse(lc.X - 122 * _s, lc.Y - 122 * _s, 244 * _s, 244 * _s);
                var saved = g.Clip;
                g.SetClip(lensClip, CombineMode.Intersect);
                double phase = (Math.Floor(t * Fps) % 24) / 24.0;
                double breathe = phase < 0.5 ? phase * 2 : 2 - phase * 2;
                float rr = (float)(58 * (1 + 0.18 * breathe)) * _s;
                int alpha = (int)(255 * (0.5 - 0.35 * breathe));
                var sc = P(1104, 404);
                using (var ring = new Pen(Color.FromArgb(alpha, Coral), 2 * _s)) g.DrawEllipse(ring, sc.X - rr, sc.Y - rr, 2 * rr, 2 * rr);
                g.Clip = saved;
            }

            for (int i = 0; i < 7; i++)
            {
                double since = t - LitAt(i, readyAt);
                if (since < 0) { g.DrawImageUnscaled(_dim[i], 0, 0); continue; }
                if (since < 2 / Fps && _motion)
                {
                    var c = P(Centers[i].X, Centers[i].Y);
                    var state = g.Save();
                    g.TranslateTransform(c.X, c.Y);
                    g.ScaleTransform(1.06f, 1.06f);
                    g.TranslateTransform(-c.X, -c.Y);
                    g.DrawImage(_lit[i], 0, 0);
                    g.Restore(state);
                }
                else g.DrawImageUnscaled(_lit[i], 0, 0);
            }
            g.DrawImageUnscaled(_labels, 0, 0);
            g.ResetClip();

            DrawLeft(g, t, readyAt, status);
        }

        private void DrawLeft(Graphics g, double t, double? readyAt, string status)
        {
            using (var mark = new GraphicsPath())
            {
                PointF M(float x, float y) => P(64 + x * 1.9f, 64 + y * 1.9f);
                mark.AddPolygon(new[] { M(16, 3.2f), M(26.6f, 28.8f), M(21.9f, 28.8f), M(16, 14.4f), M(10.1f, 28.8f), M(5.4f, 28.8f) });
                using (var light = new SolidBrush(Light)) g.FillPath(light, mark);
                var corner = M(4.6f, 18.1f);
                using (var blue = new SolidBrush(Blue)) g.FillRectangle(blue, corner.X, corner.Y, 22.8f * 1.9f * _s, 3.6f * 1.9f * _s);
            }
            using (var light = new SolidBrush(Light))
            using (var mute = new SolidBrush(Mute))
            using (var statusInk = new SolidBrush(StatusInk))
            {
                Write(g, "AuteurFrame", _word, light, 60, 196);
                Write(g, "Agentic Motion Animation Studio · " + _version, _sub, mute, 64, 242);
                Write(g, "Artwork: Every Story, One Frame", _credit, light, 62, 618);
                Write(g, "Drawn in AuteurFrame.", _small, mute, 63, 652);
                Write(g, "© 2026 Abdur Rahman Maheer. Free and open", _small, mute, 63, 714);
                Write(g, "source under AGPL-3.0. For details and legal", _small, mute, 63, 746);
                Write(g, "notices, see About AuteurFrame.", _small, mute, 63, 778);
                Write(g, status, _status, statusInk, 63, 846);
            }
            double progress;
            if (readyAt != null && t >= readyAt.Value)
            {
                double baseline = Math.Min(0.92, 0.04 + readyAt.Value / 14.0);
                progress = Math.Min(1, baseline + (t - readyAt.Value) / 0.6 * (1 - baseline));
            }
            else progress = Math.Min(0.92, 0.04 + t / 14.0);
            progress = Math.Floor(progress * 48) / 48;
            float barH = Math.Max(1, 3 * _s);
            using (var track = new SolidBrush(Track)) g.FillRectangle(track, 64 * _s, 868 * _s, 472 * _s, barH);
            using (var fill = new SolidBrush(Blue)) g.FillRectangle(fill, 64 * _s, 868 * _s, (float)(472 * progress) * _s, barH);
        }

        private void Write(Graphics g, string s, Font f, Brush b, float x, float baseline)
        {
            var fam = f.FontFamily;
            float ascent = f.Size * fam.GetCellAscent(f.Style) / fam.GetEmHeight(f.Style);
            g.DrawString(s, f, b, x * _s, baseline * _s - ascent, StringFormat.GenericTypographic);
        }

        public static void RenderFrames(string dir, float scale, double readyAt, params double[] times)
        {
            Directory.CreateDirectory(dir);
            using (var form = new SplashForm(false))
            {
                form.Rebuild(scale);
                foreach (var t in times)
                {
                    bool ready = t >= readyAt;
                    string status = ready ? "Opening the studio…" : t < 8 ? "Starting the studio engine…" : "Loading the agents and render farm…";
                    using (var g = Graphics.FromImage(form._frame)) form.Compose(g, t, ready ? readyAt : (double?)null, status);
                    form._frame.Save(Path.Combine(dir, string.Format(System.Globalization.CultureInfo.InvariantCulture, "splash-{0:00.00}s-{1:0.##}x.png", t, scale)), ImageFormat.Png);
                }
            }
        }

        private static bool AnimationsEnabled()
        {
            try { bool on = true; return !SystemParametersInfo(0x1042, 0, ref on, 0) || on; }
            catch { return true; }
        }

        private void DisposeLayers()
        {
            foreach (var b in new[] { _bg, _lens, _labels, _frame }.Concat(_strip).Concat(_lit).Concat(_dim)) b?.Dispose();
            foreach (var f in new[] { _word, _sub, _credit, _small, _status }) f?.Dispose();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) { _timer.Dispose(); DisposeLayers(); }
            base.Dispose(disposing);
        }

        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool SystemParametersInfo(int action, int param, ref bool value, int winIni);
    }

    internal static class Resources
    {
        public static Icon AppIcon()
        {
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("AuteurFrame.ico"))
                return s == null ? SystemIcons.Application : new Icon(s);
        }

        public static Image Image(string name)
        {
            var s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
            return s == null ? null : System.Drawing.Image.FromStream(s);
        }
    }
}
