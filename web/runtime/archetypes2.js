(function () {
  const X = window.AU_ARCH;
  if (!X) return;
  const { el, svgEl, esc, rich, heading, settle } = X;
  const isVideo = (src) => /\.(mp4|webm|mov)(\?|$)/i.test(src || '');
  const media = (ctx, id, fit) => {
    const src = ctx.asset(id);
    return isVideo(src) ? `<video src="${src}" muted playsinline preload="auto" data-loop style="width:100%;height:100%;object-fit:${fit || 'cover'}"></video>` : `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:${fit || 'cover'}">`;
  };
  const varColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const mul = (seed) => { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  X.add('phone-showcase', function (ctx, k) {
    const d = ctx.data;
    const wrap = el('div', 'a2-phone-wrap', k.root);
    const text = el('div', 'a2-phone-text', wrap);
    const h = heading(ctx, k, text, { kicker: d.kicker, title: d.title, subtitle: d.subtitle }, { size: 'lg' });
    const stage = el('div', 'a2-phone-stage', wrap);
    const phone = el('div', 'a2-phone', stage);
    phone.setAttribute('data-layer', 'phone');
    const screen = el('div', 'a2-phone-screen', phone);
    el('div', 'a2-phone-notch', phone);
    const screens = (d.screens || []).filter(Boolean);
    const slides = [];
    if (screens.length) {
      screens.slice(0, 4).forEach((s) => { const sl = el('div', 'a2-slide', screen, media(ctx, s, 'cover')); slides.push(sl); });
    } else {
      for (let i = 0; i < 3; i++) {
        const sl = el('div', 'a2-slide a2-mock', screen, `<div class="a2-mock-bar"></div><div class="a2-mock-hero">${ctx.icon(['sparkles', 'chart-line', 'shield-check'][i], { size: 72, stroke: 1.6 })}</div><div class="a2-mock-card"></div><div class="a2-mock-card short"></div><div class="a2-mock-row"><i></i><i></i><i></i></div>`);
        slides.push(sl);
      }
    }
    slides.forEach((s, i) => ctx.tl.set(s, { xPercent: i * 100 }, 0));
    const feats = (d.features || []).slice(0, 4);
    const chips = feats.map((f, i) => {
      const c = el('div', 'a2-chip c' + i, stage, `${ctx.icon(['check', 'zap', 'lock', 'heart'][i % 4], { size: 30, stroke: 2.4 })}<span>${esc(f)}</span>`);
      c.setAttribute('data-layer', 'feature-' + i);
      c.setAttribute('data-depth', String(0.6 + i * 0.2));
      return c;
    });
    const end = h.play(0.15);
    ctx.tl.fromTo(phone, { rotationY: ctx.portrait ? 0 : -32, rotationX: 14, y: 220, opacity: 0, transformPerspective: 1800 }, { rotationY: ctx.portrait ? -6 : -14, rotationX: 4, y: 0, opacity: 1, duration: k.T(1.1), ease: 'au.softLand' }, 0.1);
    ctx.tl.to(phone, { rotationY: ctx.portrait ? 6 : -6, duration: ctx.D, ease: 'none' }, 1.2);
    const times = k.spread(Math.max(1, slides.length), 1.0, k.budget - 0.4);
    slides.forEach((s, i) => {
      if (i === 0) return;
      ctx.tl.to(slides, { xPercent: (j) => (j - i) * 100, duration: 0.6, ease: 'au.glide' }, times[i]);
    });
    chips.forEach((c, i) => ctx.tl.from(c, { scale: 0.4, opacity: 0, y: 30, duration: k.T(0.55), ease: 'au.pop' }, Math.min(end + i * 0.22, k.budget - 0.3)));
    ctx.ambient(chips, 'float', { amount: 1.2, period: 3.6 });
    ctx.camera({ at: 0, scale: 1.04, duration: ctx.D, ease: 'none' });
  });

  X.add('ui-cascade', function (ctx, k) {
    const d = ctx.data;
    const head = el('div', 'a2-ui-head', k.root);
    const h = heading(ctx, k, head, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const win = el('div', 'a2-browser', k.root);
    win.setAttribute('data-layer', 'browser');
    win.innerHTML = `<div class="a2-browser-bar"><i></i><i></i><i></i><span class="a2-url">${esc(d.url || 'app.yourproduct.com')}</span></div><div class="a2-browser-body"></div>`;
    const body = win.querySelector('.a2-browser-body');
    if (d.image) body.innerHTML = media(ctx, d.image, 'cover');
    else {
      body.innerHTML = `<div class="a2-dash"><aside>${['layout-dashboard', 'chart-column', 'users', 'settings'].map((n) => ctx.icon(n, { size: 28 })).join('')}</aside><main><div class="a2-dash-kpis">${[0, 1, 2].map((i) => `<div><small>${['Revenue', 'Users', 'Churn'][i]}</small><b>${['$84k', '12.4k', '1.8%'][i]}</b></div>`).join('')}</div><div class="a2-dash-chart">${Array.from({ length: 14 }, (_, i) => `<i style="height:${30 + ((i * 37) % 60)}%"></i>`).join('')}</div></main></div>`;
    }
    const focus = d.focus || [0.62, 0.45];
    const callouts = (d.callouts || ['Real-time insights']).slice(0, 2);
    const cursor = el('div', 'a2-cursor', win, ctx.icon('mouse-pointer-2', { size: 44, stroke: 1.5, fill: 'var(--ink)', color: 'var(--bg)' }));
    const ring = el('div', 'a2-click', win);
    const tags = callouts.map((c, i) => { const t = el('div', 'a2-callout', win, `<i></i>${esc(c)}`); t.setAttribute('data-layer', 'callout-' + i); t.style.left = (focus[0] * 100 + 4) + '%'; t.style.top = (focus[1] * 100 - 6 + i * 12) + '%'; return t; });
    h.play(0.1);
    ctx.tl.fromTo(win, { y: 260, rotationX: 22, opacity: 0, transformPerspective: 2000 }, { y: 0, rotationX: 0, opacity: 1, duration: k.T(1.0), ease: 'au.softLand' }, 0.2);
    const zoomAt = Math.min(1.4, k.budget - 1.6);
    const zs = ctx.portrait ? 1.18 : 1.32;
    ctx.tl.to(win, { scale: zs, xPercent: (0.5 - focus[0]) * 40, yPercent: (0.5 - focus[1]) * 30, duration: k.T(1.2), ease: 'au.glide' }, zoomAt);
    ctx.tl.to(head, { opacity: 0, y: -40, duration: 0.5, ease: 'au.exit' }, zoomAt);
    ctx.tl.fromTo(cursor, { left: '88%', top: '92%', opacity: 0 }, { left: focus[0] * 100 + '%', top: focus[1] * 100 + '%', opacity: 1, duration: k.T(1.0), ease: 'au.glide' }, zoomAt + 0.2);
    ctx.tl.fromTo(ring, { left: focus[0] * 100 + '%', top: focus[1] * 100 + '%', scale: 0, opacity: 0.8 }, { scale: 3, opacity: 0, duration: 0.6, ease: 'au.softLand' }, zoomAt + 1.25);
    tags.forEach((t, i) => ctx.tl.from(t, { opacity: 0, x: -20, scale: 0.9, duration: 0.5, ease: 'au.pop' }, Math.min(zoomAt + 1.35 + i * 0.25, k.budget - 0.2)));
  });

  const KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|await|async|def|print|in|of|true|false|null|None|True|False|self|this)\b/g;
  function highlight(line) {
    const out = esc(line);
    return out.replace(/(&quot;|"|'|`)(.*?)\1/g, '<s1>$1$2$1</s1>').replace(/(\/\/.*|#.*)$/g, '<s4>$1</s4>').replace(KW, '<s2>$1</s2>').replace(/\b(\d+(?:\.\d+)?)\b/g, '<s3>$1</s3>');
  }
  X.add('code-typing', function (ctx, k) {
    const d = ctx.data;
    const wrap = el('div', 'a2-code-wrap', k.root);
    const head = el('div', 'a2-code-head', wrap);
    const h = heading(ctx, k, head, { kicker: d.kicker || d.language, title: d.title }, { size: 'md' });
    const ed = el('div', 'a2-editor', wrap);
    ed.setAttribute('data-layer', 'editor');
    ed.innerHTML = `<div class="a2-ed-bar"><i></i><i></i><i></i><span>${esc(d.file || 'main.' + ({ python: 'py', javascript: 'js', typescript: 'ts', rust: 'rs', go: 'go' }[(d.language || '').toLowerCase()] || 'js'))}</span></div><pre class="a2-code"></pre>`;
    const pre = ed.querySelector('pre');
    const lines = String(d.code || 'const film = await auteur.render(brief);\nconsole.log(film.url);').split('\n').slice(0, 14);
    const charSpans = [];
    lines.forEach((line, li) => {
      const row = el('div', 'a2-line', pre);
      el('span', 'a2-ln', row, String(li + 1));
      const code = el('span', 'a2-lc', row, highlight(line) || ' ');
      const walk = (node) => {
        Array.from(node.childNodes).forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            Array.from(n.textContent).forEach((ch) => { const s = document.createElement('span'); s.className = 'a2-ch'; s.textContent = ch; frag.appendChild(s); charSpans.push(s); });
            n.replaceWith(frag);
          } else walk(n);
        });
      };
      walk(code);
      charSpans.push(null);
    });
    const caret = el('span', 'a2-caret', pre);
    const end = h.play(0.1);
    ctx.tl.from(ed, { y: 80, opacity: 0, duration: k.T(0.8), ease: 'au.softLand' }, 0.2);
    const t0 = Math.min(0.8, end), t1 = Math.max(t0 + 0.8, k.budget - (d.output ? 1.2 : 0.4));
    const real = charSpans.filter(Boolean);
    const per = (t1 - t0) / Math.max(1, real.length);
    real.forEach((s, i) => { ctx.tl.set(s, { opacity: 0 }, 0); ctx.tl.set(s, { opacity: 1 }, t0 + i * per); });
    ctx.onFrame((t) => {
      const n = Math.max(0, Math.min(real.length, Math.floor((t - t0) / per)));
      const target = real[Math.max(0, n - 1)];
      if (target && target.parentNode) target.after(caret);
      caret.style.opacity = (Math.floor(t * 2.4) % 2 === 0 || (t > t0 && t < t1)) ? 1 : 0;
    });
    if (d.output) {
      const out = el('div', 'a2-term', wrap, `<span class="a2-ok">${ctx.icon('circle-check', { size: 26, stroke: 2.4 })}</span>${esc(d.output)}`);
      out.setAttribute('data-layer', 'output');
      ctx.tl.from(out, { y: 30, opacity: 0, duration: 0.5, ease: 'au.pop' }, t1 + 0.1);
    }
  });

  const SHAPES = [
    'M200,40 C288,40 360,112 360,200 C360,288 288,360 200,360 C112,360 40,288 40,200 C40,112 112,40 200,40 Z',
    'M90,50 L310,50 C332,50 350,68 350,90 L350,310 C350,332 332,350 310,350 L90,350 C68,350 50,332 50,310 L50,90 C50,68 68,50 90,50 Z',
    'M200,36 L364,330 C368,338 362,348 352,348 L48,348 C38,348 32,338 36,330 Z',
    'M200,30 L244,150 L370,152 L270,228 L308,350 L200,278 L92,350 L130,228 L30,152 L156,150 Z',
    'M206,48 C292,40 372,110 352,204 C334,290 270,360 186,350 C100,340 34,276 48,190 C60,108 126,54 206,48 Z'
  ];
  X.add('shape-morph', function (ctx, k) {
    const d = ctx.data;
    const words = (d.words && d.words.length ? d.words : ['Idea', 'Shape', 'Motion', 'Story']).slice(0, 5);
    const stage = el('div', 'a2-morph', k.root);
    const svg = svgEl('svg', { viewBox: '0 0 400 400', class: 'a2-morph-svg' }, stage);
    svg.setAttribute('data-layer', 'shape');
    const path = svgEl('path', { d: SHAPES[0] }, svg);
    const label = el('div', 'a2-morph-word', stage);
    label.setAttribute('data-layer', 'word');
    const colors = ['var(--accent)', 'var(--ink)', 'var(--accent-2)', 'var(--accent)', 'var(--ink)'];
    const beat = Math.max(0.45, (k.budget - 0.2) / words.length);
    path.style.fill = varColor('--accent');
    ctx.tl.from(svg, { scale: 0, rotation: -90, duration: k.T(0.6), ease: 'au.pop' }, 0.05);
    words.forEach((w, i) => {
      const at = 0.15 + i * beat;
      const span = el('span', 'a2-mw', label, esc(w));
      ctx.tl.set(span, { autoAlpha: 0 }, 0);
      ctx.tl.fromTo(span, { autoAlpha: 0, yPercent: 60, scale: 0.8 }, { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.32, ease: 'au.snapSettle' }, at + 0.08);
      if (i < words.length - 1) ctx.tl.to(span, { autoAlpha: 0, yPercent: -60, duration: 0.2, ease: 'au.exit' }, at + beat - 0.12);
      if (i > 0 && window.MorphSVGPlugin) ctx.tl.to(path, { morphSVG: SHAPES[i % SHAPES.length], fill: varColor(colors[i % colors.length].slice(4, -1)) || null, duration: Math.min(0.5, beat * 0.7), ease: 'au.punch' }, at);
      if (i > 0) ctx.tl.fromTo(svg, { rotation: (i - 1) * 45 }, { rotation: i * 45, duration: Math.min(0.5, beat * 0.7), ease: 'au.punch' }, at);
    });
    ctx.tl.to(svg, { scale: 1.06, duration: 0.4, yoyo: true, repeat: Math.max(1, Math.floor(ctx.D / 0.8)), ease: 'sine.inOut' }, 0.6);
  });

  X.add('particles-type', function (ctx, k) {
    const d = ctx.data;
    const box = el('div', 'a2-ptype', k.root);
    const canvas = el('canvas', 'a2-ptype-canvas', box);
    canvas.setAttribute('data-layer', 'particles');
    canvas.setAttribute('data-allow-offstage', '');
    canvas.width = ctx.W; canvas.height = ctx.H;
    const sub = el('div', 'a2-ptype-sub', box, rich(d.subtitle || ''));
    sub.setAttribute('data-layer', 'subtitle');
    const title = String(d.title || 'MOTION').replace(/\*/g, '');
    const off = document.createElement('canvas');
    off.width = ctx.W; off.height = ctx.H;
    const o = off.getContext('2d');
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-display').split(',')[0].replace(/['"]/g, '').trim();
    let size = Math.min(ctx.W, ctx.H) * (ctx.portrait ? 0.2 : 0.26);
    o.font = `800 ${size}px "${fam}"`;
    const lines = title.length > 10 && ctx.portrait ? title.split(' ') : [title];
    const widest = Math.max(...lines.map((l) => o.measureText(l).width));
    if (widest > ctx.W * 0.86) { size *= (ctx.W * 0.86) / widest; o.font = `800 ${size}px "${fam}"`; }
    o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
    lines.forEach((l, i) => o.fillText(l, ctx.W / 2, ctx.H * 0.45 + (i - (lines.length - 1) / 2) * size * 1.02));
    const img = o.getImageData(0, 0, ctx.W, ctx.H).data;
    const step = Math.max(5, Math.round(size / 26));
    const pts = [];
    for (let y = 0; y < ctx.H; y += step) for (let x = 0; x < ctx.W; x += step) if (img[(y * ctx.W + x) * 4 + 3] > 128) pts.push([x, y]);
    const r = mul(ctx.seed + 31);
    const parts = pts.slice(0, 3200).map(([x, y]) => ({ x, y, sx: r() * ctx.W, sy: r() * ctx.H, delay: r() * 0.6 + (x / ctx.W) * 0.4, rad: step * (0.32 + r() * 0.2), ph: r() * 6.28, hot: r() < 0.12 }));
    const g = canvas.getContext('2d');
    const ink = varColor('--ink'), acc = varColor('--accent');
    const easeOut = (x) => 1 - Math.pow(1 - x, 4);
    ctx.onFrame((t) => {
      g.clearRect(0, 0, ctx.W, ctx.H);
      for (const p of parts) {
        const q = Math.max(0, Math.min(1, (t - 0.2 - p.delay) / 1.4));
        const e = easeOut(q);
        const jx = Math.sin(t * 1.6 + p.ph) * 1.4, jy = Math.cos(t * 1.3 + p.ph) * 1.4;
        const x = p.sx + (p.x - p.sx) * e + jx * e, y = p.sy + (p.y - p.sy) * e + jy * e;
        g.globalAlpha = 0.25 + 0.75 * e;
        g.fillStyle = p.hot ? acc : ink;
        g.beginPath(); g.arc(x, y, p.rad, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
    });
    ctx.tl.from(sub, { opacity: 0, y: 20, duration: 0.6, ease: 'au.softLand' }, Math.min(2.1, k.budget - 0.4));
  });

  X.add('photo-stack', function (ctx, k) {
    const d = ctx.data;
    const photos = (d.photos || []).filter(Boolean).slice(0, 6);
    const n = Math.max(3, photos.length || 3);
    const wrap = el('div', 'a2-stack-wrap', k.root);
    const deck = el('div', 'a2-deck', wrap);
    const text = el('div', 'a2-stack-text', wrap);
    const h = heading(ctx, k, text, { kicker: d.kicker, title: d.title, subtitle: d.caption }, { size: 'lg' });
    const r = mul(ctx.seed + 7);
    const times = k.spread(n, 0.1, Math.min(k.budget - 0.8, n * 0.55));
    const cards = [];
    for (let i = 0; i < n; i++) {
      const c = el('div', 'a2-polaroid', deck);
      c.setAttribute('data-layer', 'photo-' + i);
      c.innerHTML = `<div class="a2-pol-img">${photos[i] ? media(ctx, photos[i], 'cover') : `<div class="a2-pol-ph" style="background:${['var(--accent)', 'var(--accent-2)', 'var(--bg-2)'][i % 3]}">${ctx.icon(['image', 'camera', 'mountain', 'sun', 'heart', 'star'][i % 6], { size: 96, stroke: 1.3, color: 'var(--bg)' })}</div>`}</div><div class="a2-pol-cap">${esc((d.captions || [])[i] || '')}</div>`;
      const rot = (r() - 0.5) * 16;
      c.style.zIndex = String(i + 1);
      ctx.tl.fromTo(c, { x: (r() > 0.5 ? 1 : -1) * ctx.W * 0.7, y: -ctx.H * 0.3 + r() * ctx.H * 0.6, rotation: rot * 4, opacity: 1 }, { x: (r() - 0.5) * 40, y: (r() - 0.5) * 30, rotation: rot, duration: k.T(0.75), ease: 'au.softLand' }, times[i]);
      cards.push(c);
    }
    const topImg = cards[cards.length - 1].querySelector('img,video');
    if (topImg) ctx.tl.fromTo(topImg, { scale: 1.15 }, { scale: 1.0, duration: ctx.D, ease: 'none' }, 0);
    h.play(Math.min(times[times.length - 1] + 0.3, k.budget - 1.2));
    settle(ctx, k, null);
  });

  X.add('music-visualizer', function (ctx, k) {
    const d = ctx.data;
    const wrap = el('div', 'a2-music', k.root);
    const cover = el('div', 'a2-cover', wrap);
    cover.setAttribute('data-layer', 'cover');
    cover.innerHTML = d.cover ? media(ctx, d.cover, 'cover') : `<div class="a2-cover-ph">${ctx.icon('disc-3', { size: 180, stroke: 1.1, color: 'var(--bg)' })}</div>`;
    const info = el('div', 'a2-music-info', wrap);
    const t = el('div', 'a2-track', info, rich(d.title || 'Untitled'));
    t.setAttribute('data-layer', 'title');
    const a = el('div', 'a2-artist', info, esc(d.artist || ''));
    const barsEl = el('div', 'a2-bars', info);
    barsEl.setAttribute('data-layer', 'spectrum');
    const N = 40;
    const bars = Array.from({ length: N }, () => el('i', '', barsEl));
    const prog = el('div', 'a2-prog', info, '<b></b><span class="a2-tc">0:00</span>');
    const levels = d.levels || null;
    const fps = ctx.fps || 30;
    const bpm = d.bpm || 112;
    const offset = d.offset || 0;
    const r = mul(ctx.seed + 3);
    const prof = Array.from({ length: N }, (_, i) => 0.35 + 0.65 * Math.exp(-Math.pow((i - N * 0.28) / (N * 0.32), 2)) + r() * 0.15);
    const fill = prog.querySelector('b'), tc = prog.querySelector('.a2-tc');
    const total = d.total || ctx.D;
    ctx.onFrame((tt) => {
      const gt = tt + offset;
      let lv;
      if (levels && levels.length) lv = levels[Math.min(levels.length - 1, Math.floor(gt * fps))] || 0;
      else { const ph = (gt * bpm / 60) % 1; lv = 0.35 + 0.65 * Math.exp(-ph * 6); }
      bars.forEach((b, i) => {
        const wob = 0.6 + 0.4 * Math.sin(gt * (5 + i * 0.37) + i);
        b.style.transform = `scaleY(${Math.max(0.05, Math.min(1, lv * prof[i] * wob * 1.25))})`;
      });
      cover.style.transform = `scale(${1 + lv * 0.035}) rotate(${Math.sin(gt * 0.4) * 1.5}deg)`;
      fill.style.width = Math.min(100, (gt / total) * 100) + '%';
      const s = Math.floor(gt);
      tc.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    });
    ctx.tl.from(cover, { opacity: 0, scale: 0.8, rotation: -8, duration: k.T(0.9), ease: 'au.softLand' }, 0.05);
    ctx.tl.from([t, a], { opacity: 0, y: 30, duration: 0.7, stagger: 0.12, ease: 'au.softLand' }, 0.3);
    ctx.tl.from([barsEl, prog], { opacity: 0, duration: 0.6 }, 0.5);
  });

  function hill(w, h, base, amp, seed, rough) {
    const r = mul(seed);
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      const y = base + Math.sin(i / n * Math.PI * (1.2 + r() * 0.8) + seed) * amp + (r() - 0.5) * rough;
      pts.push([x, y]);
    }
    let dd = `M0,${h} L0,${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      dd += ` Q${x0.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`;
      if (i % 3 === 0) dd += ` L${(mx + (r() - 0.5) * 6).toFixed(1)},${((y0 + y1) / 2 + (r() - 0.5) * rough * 0.6).toFixed(1)}`;
    }
    return dd + ` L${w},${pts[pts.length - 1][1].toFixed(1)} L${w},${h} Z`;
  }
  X.add('paper-cut', function (ctx, k) {
    const d = ctx.data;
    const W = ctx.W, H = ctx.H;
    const scene = el('div', 'a2-paper', k.root);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'a2-paper-svg', preserveAspectRatio: 'none' }, scene);
    svg.setAttribute('data-allow-offstage', '');
    const sun = svgEl('circle', { cx: W * (ctx.portrait ? 0.76 : 0.84), cy: H * (ctx.portrait ? 0.3 : 0.34), r: Math.min(W, H) * 0.09, fill: (ctx.data.variant || 0) % 2 ? 'var(--bg-2)' : 'var(--accent-2)' }, svg);
    sun.setAttribute('data-layer', 'sun');
    const cloud = (cx, cy, s) => { const g = svgEl('g', { class: 'a2-cloud' }, svg); [[0, 0, 1], [0.9, 0.15, 0.75], [-0.85, 0.2, 0.7]].forEach(([dx, dy, rr]) => svgEl('circle', { cx: cx + dx * 60 * s, cy: cy + dy * 60 * s, r: 52 * s * rr, fill: 'var(--bg)' }, g)); return g; };
    const clouds = [cloud(W * 0.2, H * 0.2, ctx.portrait ? 1.2 : 1.4), cloud(W * 0.55, H * 0.13, 1)];
    const tones = ['var(--bg-2)', 'color-mix(in srgb, var(--accent) 45%, var(--bg-2))', 'var(--accent)', 'color-mix(in srgb, var(--accent) 60%, var(--ink))', 'var(--ink)'];
    const layers = [];
    for (let i = 0; i < 5; i++) {
      const base = H * (0.46 + i * 0.1);
      const dd = hill(W, H, base, H * (0.05 - i * 0.004), ctx.seed + i * 13, 10);
      const g = svgEl('g', { 'data-layer': 'paper-' + i, 'data-depth': String(0.15 + i * 0.22) }, svg);
      svgEl('path', { d: dd, fill: 'rgba(0,0,0,0.22)', transform: 'translate(0,-10)' }, g);
      svgEl('path', { d: dd, fill: tones[i] }, g);
      layers.push(g);
    }
    const banner = el('div', 'a2-banner', scene);
    banner.setAttribute('data-layer', 'banner');
    banner.innerHTML = `${d.kicker ? `<small>${esc(d.kicker)}</small>` : ''}<b>${rich(d.title || 'Once upon a time')}</b>${d.subtitle ? `<span>${rich(d.subtitle)}</span>` : ''}`;
    ctx.tl.from(sun, { attr: { cy: H * 0.7 }, duration: k.T(1.4), ease: 'au.softLand' }, 0);
    layers.forEach((g, i) => ctx.tl.from(g, { y: H * (0.35 + i * 0.05), duration: k.T(1.0), ease: 'au.softLand' }, 0.08 + i * 0.12));
    clouds.forEach((c, i) => { ctx.tl.from(c, { opacity: 0, duration: 0.8 }, 0.4 + i * 0.2); ctx.tl.to(c, { x: (i ? -1 : 1) * W * 0.06, duration: ctx.D, ease: 'none' }, 0); });
    ctx.tl.fromTo(banner, { y: -H * 0.5, rotation: -10 }, { y: 0, rotation: 2, duration: k.T(0.9), ease: 'au.softLand' }, 0.6);
    ctx.tl.to(banner, { rotation: -1.2, duration: 1.4, yoyo: true, repeat: Math.ceil(ctx.D / 1.4), ease: 'sine.inOut' }, 1.5);
    ctx.camera({ at: 0, x: W * 0.02, scale: 1.04, duration: ctx.D, ease: 'none' });
  });

  X.add('vox-board', function (ctx, k) {
    const d = ctx.data;
    const board = el('div', 'a2-vox', k.root);
    const photo = el('div', 'a2-vox-photo', board);
    photo.setAttribute('data-layer', 'photo');
    photo.innerHTML = (d.photo ? media(ctx, d.photo, 'cover') : `<div class="a2-vox-ph">${ctx.icon(d.icon || 'landmark', { size: 220, stroke: 1 })}</div>`) + '<span class="a2-halftone"></span><span class="a2-tape t1"></span><span class="a2-tape t2"></span>';
    const txt = el('div', 'a2-vox-text', board);
    const h = heading(ctx, k, txt, { kicker: d.kicker, title: d.title }, { size: 'lg', style: 'mask' });
    const notes = (d.notes || []).slice(0, 2).map((n, i) => { const s = el('div', 'a2-sticky s' + i, board, esc(n)); s.setAttribute('data-layer', 'note-' + i); return s; });
    const ann = svgEl('svg', { class: 'a2-vox-ann', viewBox: `0 0 ${ctx.W} ${ctx.H}`, width: ctx.W, height: ctx.H }, board);
    const pr = photo.getBoundingClientRect(), br = k.root.getBoundingClientRect();
    const cx = pr.left - br.left + pr.width * 0.55, cy = pr.top - br.top + pr.height * 0.45;
    const shapes = [{ type: 'ellipse', args: [cx, cy, pr.width * 0.62, pr.height * 0.5], stroke: '#E0322B', layer: 'circle' }];
    notes.forEach((nn, i) => {
      const nr = nn.getBoundingClientRect();
      shapes.push({ type: 'line', args: [cx + pr.width * 0.2, cy - pr.height * 0.15 * (i ? -1 : 1), nr.left - br.left + nr.width / 2, nr.top - br.top + 10], stroke: '#E0322B', strokeWidth: 3, layer: 'string-' + i });
    });
    const groups = ctx.rough(ann, shapes, { strokeWidth: 7, roughness: 2.2 });
    ctx.tl.fromTo(photo, { y: 120, rotation: -14, opacity: 0 }, { y: 0, rotation: -3, opacity: 1, duration: k.T(0.8), ease: 'au.softLand' }, 0.1);
    const end = h.play(0.45);
    ctx.draw(groups[0], { at: Math.min(end, k.budget - 1), duration: 0.8 });
    notes.forEach((nn, i) => { ctx.tl.from(nn, { scale: 0.4, rotation: 20, opacity: 0, duration: 0.5, ease: 'au.pop' }, Math.min(end + 0.5 + i * 0.3, k.budget - 0.4)); if (groups[i + 1]) ctx.draw(groups[i + 1], { at: Math.min(end + 0.7 + i * 0.3, k.budget - 0.2), duration: 0.5 }); });
    const img = photo.querySelector('img,video');
    if (img) ctx.tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: ctx.D, ease: 'none' }, 0);
    ctx.camera({ at: 0, scale: 1.06, x: 20, duration: ctx.D, ease: 'none' });
  });

  X.add('three-hero', function (ctx, k) {
    const d = ctx.data;
    const mode = d.mode || (d.images && d.images.length ? 'gallery' : 'shapes');
    const host = el('div', 'a2-three', k.root);
    host.setAttribute('data-layer', 'three');
    host.setAttribute('data-allow-offstage', '');
    const overlay = el('div', 'a2-three-title', k.root);
    const h = heading(ctx, k, overlay, { kicker: d.kicker, title: d.title, subtitle: d.subtitle }, { size: 'xl' });
    const D = ctx.D;
    ctx.three(host, (g) => {
      const T = g.THREE;
      g.scene.fog = new T.Fog(g.color('var(--bg)'), 14, 40);
      const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.18 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; floor.receiveShadow = true;
      g.scene.add(floor);
      if (mode === 'gallery') {
        const imgs = (d.images || []).filter(Boolean);
        const loader = new T.TextureLoader();
        const cards = [];
        const count = 18;
        for (let i = 0; i < count; i++) {
          const ang = (i - count / 2) * 0.16;
          const geo = new T.BoxGeometry(2.4, 1.5, 0.06);
          const m = g.material(['var(--bg-2)', 'var(--accent)', 'var(--ink)'][i % 3], { roughness: 0.5 });
          if (imgs.length) {
            const tex = loader.load(ctx.asset(imgs[i % imgs.length]));
            tex.colorSpace = T.SRGBColorSpace;
            m.map = tex; m.color = new T.Color(0xffffff);
          }
          const mesh = new T.Mesh(geo, m);
          const rad = 9;
          mesh.position.set(Math.sin(ang) * rad, (i % 2) * 1.7 - 0.6, -Math.cos(ang) * rad + rad);
          mesh.rotation.y = -ang;
          mesh.castShadow = true;
          g.scene.add(mesh);
          cards.push({ mesh, ang, base: mesh.position.y });
        }
        return (t) => {
          const p = g.ease(Math.min(1, t / (D * 0.9)));
          g.camera.position.set(Math.sin(p * 0.6) * 1.6, 0.3 + p * 3.2, 2.4 + p * 10.5);
          g.camera.lookAt(0, 0.35 + p * 0.4, 0);
          const wave = (t * 1.6) % 4 - 2;
          cards.forEach((c, i) => {
            const near = Math.exp(-Math.pow(c.ang * 2.2 - wave, 2));
            c.mesh.rotation.x = -near * 0.25;
            c.mesh.position.y = c.base + near * 0.18;
          });
          g.lights.rim.intensity = 1 + Math.sin(t * 2) * 0.4;
        };
      }
      if (mode === 'orbit') {
        floor.visible = false;
        g.scene.fog = null;
        g.starfield(1600, 70);
        const system = new T.Group();
        system.rotation.x = 0.32;
        system.rotation.z = -0.08;
        if (!ctx.portrait) system.position.x = 1.4;
        g.scene.add(system);
        const sunColor = new T.Color('#FFB547').lerp(g.color('var(--accent)'), 0.35);
        const sun = new T.Mesh(new T.SphereGeometry(1.1, 64, 64), new T.MeshBasicMaterial({ color: sunColor }));
        system.add(sun);
        const halo = g.glow('#' + sunColor.getHexString(), 6.5);
        system.add(halo);
        const light = new T.PointLight(sunColor, 60, 40, 1.6);
        system.add(light);
        g.lights.key.intensity = 0.6;
        const specs = [[2.4, 0.26, 'var(--accent)', 1.6], [3.6, 0.38, 'var(--ink-2)', 1.05], [5.2, 0.55, 'var(--accent)', 0.7], [7.0, 0.42, 'var(--bg-2)', 0.48]];
        const planets = specs.map(([r, size, c, speed], i) => {
          const orbit = g.orbitLine(r, r * 0.92, 'var(--ink-2)', 0.28);
          system.add(orbit);
          const mesh = new T.Mesh(new T.SphereGeometry(size, 48, 48), g.material(c, { roughness: 0.45, clearcoat: 0.4 }));
          system.add(mesh);
          if (i === 2) {
            const ring = new T.Mesh(new T.RingGeometry(size * 1.4, size * 2.1, 96), new T.MeshBasicMaterial({ color: g.color('var(--ink-2)'), side: T.DoubleSide, transparent: true, opacity: 0.55 }));
            ring.rotation.x = Math.PI / 2.4;
            mesh.add(ring);
          }
          const trailPts = 40;
          const trailGeo = new T.BufferGeometry();
          trailGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(trailPts * 3), 3));
          const trail = new T.Line(trailGeo, new T.LineBasicMaterial({ color: g.color(c), transparent: true, opacity: 0.55 }));
          system.add(trail);
          return { mesh, r, speed, phase: i * 1.7 + g.rand() * 0.6, trail, trailPts, orbit, born: 0.25 + i * 0.22 };
        });
        return (t) => {
          const intro = g.ease(Math.min(1, t / 1.2));
          sun.scale.setScalar(Math.max(0.001, intro));
          halo.scale.setScalar(6.5 * intro * (1 + Math.sin(t * 2.2) * 0.04));
          planets.forEach((p) => {
            const appear = g.ease(Math.max(0, Math.min(1, (t - p.born) / 0.6)));
            const ang = p.phase + t * p.speed * 0.55;
            p.mesh.position.set(Math.cos(ang) * p.r, 0, Math.sin(ang) * p.r * 0.92);
            p.mesh.scale.setScalar(Math.max(0.001, appear));
            p.mesh.rotation.y = t * 0.8;
            p.orbit.material.opacity = 0.28 * appear;
            const arr = p.trail.geometry.attributes.position.array;
            for (let k = 0; k < p.trailPts; k++) {
              const a = ang - k * 0.035;
              arr[k * 3] = Math.cos(a) * p.r; arr[k * 3 + 1] = 0; arr[k * 3 + 2] = Math.sin(a) * p.r * 0.92;
            }
            p.trail.geometry.attributes.position.needsUpdate = true;
            p.trail.material.opacity = 0.55 * appear;
          });
          const cam = g.ease(Math.min(1, t / Math.max(1, D - 0.6)));
          g.camera.position.set(Math.sin(cam * 0.5) * 3, 6.5 - cam * 2.2, 16 - cam * 4.5);
          g.camera.lookAt(ctx.portrait ? 0 : 1.2, 0, 0);
        };
      }
      const group = new T.Group();
      if (!ctx.portrait) group.position.x = 1.6;
      else group.position.y = -0.6;
      g.scene.add(group);
      const items = [
        [new T.TorusKnotGeometry(0.9, 0.32, 220, 32), 'var(--accent)', [-2.6, 0.2, 0]],
        [new T.SphereGeometry(1.1, 64, 64), 'var(--accent-2)', [2.4, 0.6, -1.2]],
        [new T.BoxGeometry(1.4, 1.4, 1.4, 4, 4, 4), 'var(--ink)', [0.2, -0.8, 1.4]],
        [new T.TorusGeometry(1.2, 0.18, 32, 120), 'var(--bg-2)', [0.6, 1.6, -2.4]],
        [new T.IcosahedronGeometry(0.7, 0), 'var(--accent)', [-1.4, -1.4, 2.2]]
      ];
      const meshes = items.map(([geo, c, pos], i) => {
        const m = new T.Mesh(geo, g.material(c, { roughness: [0.2, 0.05, 0.6, 0.3, 0.4][i], metalness: [0.1, 0.0, 0.0, 0.8, 0.2][i], clearcoat: 0.8 }));
        m.position.set(...pos); m.castShadow = true; group.add(m);
        return { m, pos, ph: g.rand() * 6.28 };
      });
      return (t) => {
        const p = g.ease(Math.min(1, t / 1.6));
        meshes.forEach(({ m, pos, ph }, i) => {
          const s = Math.max(0.0001, g.ease(Math.min(1, Math.max(0, (t - i * 0.12) / 0.9))));
          m.scale.setScalar(s);
          m.position.y = pos[1] + Math.sin(t * 1.1 + ph) * 0.18;
          m.rotation.x = t * (0.3 + i * 0.07) + ph;
          m.rotation.y = t * (0.4 + i * 0.05);
        });
        const orbit = 0.35 * Math.sin(t / D * Math.PI) + p * 0.2;
        g.camera.position.set(Math.sin(orbit) * 10, 1.2 + (1 - p) * 2, Math.cos(orbit) * 10);
        g.camera.lookAt(0, 0, 0);
      };
    }, { fov: 32 });
    h.play(mode === 'gallery' ? 0.6 : 0.9);
  });

  X.add('logo-reveal', function (ctx, k) {
    const d = ctx.data;
    k.root.classList.add('ar-center');
    const stage = el('div', 'a2-logo', k.root);
    const blocks = [0, 1, 2, 3].map((i) => el('i', 'a2-blk b' + i, stage));
    const ring = svgEl('svg', { class: 'a2-ring', viewBox: '0 0 200 200' }, stage);
    svgEl('circle', { cx: 100, cy: 100, r: 92 }, ring);
    const disc = el('div', 'a2-disc', stage);
    disc.setAttribute('data-layer', 'logo');
    disc.innerHTML = d.logo ? `<img src="${ctx.asset(d.logo)}" alt="">` : `<b>${esc((d.name || 'A').trim()[0] || 'A')}</b>`;
    const name = el('div', 'a2-logo-name', k.root, esc(d.name || ''));
    name.setAttribute('data-layer', 'name');
    const tag = el('div', 'a2-logo-tag', k.root, rich(d.tagline || ''));
    tag.setAttribute('data-layer', 'tagline');
    const S = Math.min(ctx.W, ctx.H) * 0.34;
    blocks.forEach((b, i) => {
      const dx = (i % 2 ? 1 : -1) * ctx.W * 0.6, dy = (i < 2 ? -1 : 1) * ctx.H * 0.6;
      ctx.tl.fromTo(b, { x: dx, y: dy, rotation: 90 * (i % 2 ? 1 : -1) }, { x: 0, y: 0, rotation: 45, duration: k.T(0.7), ease: 'au.whip' }, 0.05 + i * 0.06);
      ctx.tl.to(b, { scale: 0, duration: 0.3, ease: 'au.exit' }, 0.85);
    });
    ctx.tl.fromTo(disc, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: k.T(0.6), ease: 'au.glide' }, 0.85);
    ctx.tl.from(disc.firstElementChild, { scale: 1.4, duration: 1.2, ease: 'au.softLand' }, 0.85);
    ctx.draw(ring, { at: 0.95, duration: 0.9 });
    ctx.tl.to(ring, { rotation: 120, duration: ctx.D, ease: 'none' }, 0);
    if (d.name) {
      const s = ctx.split(name, { type: 'chars' });
      ctx.tl.from(s.chars, { opacity: 0, yPercent: 80, duration: 0.5, stagger: 0.03, ease: 'au.softLand' }, 1.25);
    }
    ctx.tl.from(tag, { opacity: 0, y: 14, duration: 0.6 }, Math.min(1.7, k.budget - 0.3));
    void S;
  });

  X.add('kinetic-beat', function (ctx, k) {
    const d = ctx.data;
    const words = (d.words && d.words.length ? d.words : String(d.title || 'Make it move').replace(/\*/g, '').split(/\s+/)).slice(0, 12);
    const beat = 60 / (d.bpm || 120);
    const n = Math.min(words.length, Math.max(1, Math.floor((ctx.D - 0.4) / beat)));
    const stage = el('div', 'a2-beat', k.root);
    stage.setAttribute('data-allow-offstage', '');
    const flood = el('div', 'a2-flood', stage);
    const layouts = ['center', 'giant', 'split', 'vertical', 'outline', 'corner'];
    for (let i = 0; i < n; i++) {
      const at = 0.1 + i * beat;
      const lay = layouts[(i + (ctx.data.variant || 0)) % layouts.length];
      const w = el('div', 'a2-bw l-' + lay, stage);
      w.setAttribute('data-layer', 'beat-' + i);
      if (lay === 'split') { const half = Math.ceil(words[i].length / 2); w.innerHTML = `<span>${esc(words[i].slice(0, half))}</span><span>${esc(words[i].slice(half))}</span>`; }
      else w.textContent = words[i];
      const maxW = (lay === 'vertical' ? ctx.H * 0.8 : ctx.W * 0.88);
      const ww = w.scrollWidth || w.getBoundingClientRect().width;
      if (ww > maxW) w.style.fontSize = (parseFloat(getComputedStyle(w).fontSize) * maxW / ww) + 'px';
      ctx.tl.set(w, { autoAlpha: 0 }, 0);
      const from = { center: { scale: 2.4 }, giant: { scale: 0.3 }, split: { y: 0 }, vertical: { yPercent: 100 }, outline: { scale: 1.3, rotation: -6 }, corner: { xPercent: -40 } }[lay];
      ctx.tl.fromTo(w, Object.assign({ autoAlpha: 1, scale: 1, rotation: lay === 'vertical' ? -90 : 0, xPercent: 0, yPercent: 0 }, from), { autoAlpha: 1, scale: 1, rotation: lay === 'vertical' ? -90 : 0, xPercent: 0, yPercent: 0, duration: beat * 0.6, ease: 'au.punch' }, at);
      if (lay === 'split') { const sp = w.querySelectorAll('span'); ctx.tl.fromTo(sp[0], { yPercent: -120 }, { yPercent: 0, duration: beat * 0.5, ease: 'au.punch' }, at); ctx.tl.fromTo(sp[1], { yPercent: 120 }, { yPercent: 0, duration: beat * 0.5, ease: 'au.punch' }, at); }
      if (i < n - 1) ctx.tl.set(w, { autoAlpha: 0 }, at + beat);
      if (i % 3 === 2) ctx.tl.fromTo(flood, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: beat * 0.4, ease: 'au.whip' }, at - 0.02);
      if (i % 3 === 0 && i > 0) ctx.tl.to(flood, { clipPath: 'inset(0 0 0 100%)', duration: beat * 0.4, ease: 'au.whip' }, at - 0.02);
      if (i % 3 === 2) ctx.tl.set(w, { color: 'var(--bg)' }, at);
    }
  });

  X.add('diagram-build', function (ctx, k) {
    const d = ctx.data;
    const nodes = (d.nodes || ['Input', 'Process', 'Check', 'Output']).slice(0, 6).map((n) => (typeof n === 'string' ? { label: n } : n));
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const area = el('div', 'a2-diagram', box);
    const W = ctx.safe.w, H = ctx.portrait ? ctx.H * 0.48 : ctx.H * 0.5;
    area.style.width = W + 'px'; area.style.height = H + 'px';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'a2-edges' }, area);
    const cols = ctx.portrait ? 2 : Math.min(4, nodes.length);
    const rows = Math.ceil(nodes.length / cols);
    const pos = nodes.map((_, i) => {
      const r = Math.floor(i / cols), c = r % 2 ? cols - 1 - (i % cols) : i % cols;
      return [W * (0.5 + c) / cols, H * (0.5 + r) / rows];
    });
    const end = h.play(0.1);
    const times = k.spread(nodes.length, Math.min(end - 0.2, k.budget - 1.6), k.budget - 0.6);
    nodes.forEach((n, i) => {
      const nd = el('div', 'a2-node' + (i === nodes.length - 1 ? ' is-hero' : ''), area, `<span>${ctx.icon(n.icon || ['database', 'cpu', 'shield-check', 'send', 'cloud', 'sparkles'][i % 6], { size: 34, stroke: 2 })}</span><b>${esc(n.label)}</b>`);
      nd.setAttribute('data-layer', 'node-' + i);
      nd.style.left = pos[i][0] + 'px'; nd.style.top = pos[i][1] + 'px';
      ctx.tl.from(nd, { scale: 0.3, opacity: 0, duration: 0.5, ease: 'au.pop' }, times[i]);
      if (i > 0) {
        const [x0, y0] = pos[i - 1], [x1, y1] = pos[i];
        const mx = (x0 + x1) / 2;
        const path = svgEl('path', { d: y0 === y1 ? `M${x0},${y0} C${mx},${y0 - 40} ${mx},${y1 - 40} ${x1},${y1}` : `M${x0},${y0} C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`, class: 'a2-edge' }, svg);
        ctx.draw(path, { at: times[i] - 0.3, duration: 0.45 });
        const dot = svgEl('circle', { r: 7, class: 'a2-pulse' }, svg);
        if (window.MotionPathPlugin) {
          ctx.tl.set(dot, { opacity: 0 }, 0);
          ctx.tl.to(dot, { opacity: 1, duration: 0.1 }, times[i] + 0.2);
          ctx.tl.to(dot, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, duration: 0.9, repeat: Math.ceil(ctx.D), ease: 'none' }, times[i] + 0.2);
        }
      }
    });
    settle(ctx, k, null);
  });

  X.add('mascot-talk', function (ctx, k) {
    const d = ctx.data;
    const lines = (d.lines && d.lines.length ? d.lines : [d.title || 'Hi there!']).slice(0, 3);
    const stage = el('div', 'a2-mascot-wrap', k.root);
    const bot = el('div', 'a2-mascot', stage);
    bot.setAttribute('data-layer', 'mascot');
    bot.innerHTML = `<svg viewBox="0 0 300 320"><ellipse class="m-shadow" cx="150" cy="306" rx="90" ry="12"/><path class="m-body" d="M150 30 C235 30 270 100 268 180 C266 260 220 295 150 295 C80 295 34 260 32 180 C30 100 65 30 150 30 Z"/><g class="m-eyes"><ellipse cx="112" cy="140" rx="22" ry="27" class="m-eye"/><ellipse cx="190" cy="140" rx="22" ry="27" class="m-eye"/><circle class="m-pupil" cx="118" cy="146" r="10"/><circle class="m-pupil" cx="196" cy="146" r="10"/></g><path class="m-mouth" d="M120 205 Q150 225 180 205 Q150 240 120 205 Z"/><circle class="m-cheek" cx="85" cy="190" r="14"/><circle class="m-cheek" cx="217" cy="190" r="14"/></svg>`;
    const bubble = el('div', 'a2-bubble', stage);
    bubble.setAttribute('data-layer', 'bubble');
    const eyes = bot.querySelector('.m-eyes'), mouth = bot.querySelector('.m-mouth');
    ctx.tl.fromTo(bot, { x: -ctx.W * 0.6, rotation: -20 }, { x: 0, rotation: 0, duration: k.T(0.8), ease: 'au.softLand' }, 0);
    ctx.tl.to(bot, { scaleY: 0.92, scaleX: 1.06, transformOrigin: '50% 100%', duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.75);
    const per = Math.max(0.9, (k.budget - 1) / lines.length);
    const talk = [];
    lines.forEach((ln, i) => {
      const at = 1.0 + i * per;
      const span = el('div', 'a2-bline', bubble, esc(ln));
      ctx.tl.set(span, { autoAlpha: 0 }, 0);
      ctx.tl.fromTo(span, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3 }, at);
      if (i < lines.length - 1) ctx.tl.to(span, { autoAlpha: 0, duration: 0.2 }, at + per - 0.2);
      talk.push([at, at + Math.min(per - 0.3, ln.split(' ').length * 0.28)]);
    });
    ctx.tl.from(bubble, { scale: 0, transformOrigin: '0% 100%', duration: 0.4, ease: 'au.pop' }, 0.9);
    ctx.onFrame((t) => {
      const blink = (t % 2.7) < 0.12;
      eyes.style.transform = blink ? 'scaleY(0.1)' : 'scaleY(1)';
      eyes.style.transformOrigin = '150px 142px';
      const speaking = talk.some(([a, b]) => t >= a && t <= b);
      const open = speaking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 17)) : 0.25;
      mouth.style.transform = `scaleY(${open})`;
      mouth.style.transformOrigin = '150px 205px';
      bot.firstElementChild.style.transform = `translateY(${Math.sin(t * 3) * 6}px)`;
    });
  });
})();
;(function () {
  const X = window.AU_ARCH;
  if (!X) return;
  const { el } = X;
  const GRADE = {
    clean: { f: 'contrast(1.04) saturate(1.06)', o: null },
    'golden-film': { f: 'sepia(0.22) saturate(1.25) contrast(1.06) brightness(1.03)', o: 'radial-gradient(ellipse at 50% 40%, rgba(255,180,90,0.18), rgba(120,60,0,0.22))' },
    'teal-orange': { f: 'saturate(1.25) contrast(1.12)', o: 'linear-gradient(180deg, rgba(0,120,140,0.16), rgba(255,140,60,0.14))' },
    mono: { f: 'grayscale(1) contrast(1.22) brightness(1.02)', o: null },
    vivid: { f: 'saturate(1.5) contrast(1.08)', o: null },
    moody: { f: 'brightness(0.86) contrast(1.22) saturate(0.85)', o: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.55))' },
    cool: { f: 'hue-rotate(-8deg) saturate(1.1) contrast(1.06)', o: 'linear-gradient(180deg, rgba(40,90,200,0.12), rgba(0,30,80,0.12))' },
    faded: { f: 'contrast(0.9) brightness(1.08) saturate(0.8) sepia(0.12)', o: 'linear-gradient(180deg, rgba(255,240,220,0.12), rgba(255,240,220,0.06))' }
  };
  const punch = (p) => 1 - Math.pow(1 - p, 4);
  const glide = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  function zoomAt(zooms, T) {
    let state = { s: 1, x: 0, y: 0 };
    for (let i = 0; i < zooms.length; i++) {
      const z = zooms[i];
      if (z.t > T) break;
      const nextT = i + 1 < zooms.length ? zooms[i + 1].t : Infinity;
      const at = Math.min(T, nextT);
      const p = Math.max(0, Math.min(1, (at - z.t) / Math.max(0.05, z.dur || 0.3)));
      const e = (z.kind === 'push' ? glide : punch)(p);
      state = { s: state.s + ((z.scale || 1) - state.s) * e, x: state.x + ((z.x || 0) - state.x) * e, y: state.y + ((z.y || 0) - state.y) * e };
    }
    return state;
  }
  X.add('footage-edit', function (ctx, k) {
    const d = ctx.data;
    k.root.style.padding = '0';
    const frame = el('div', 'fe-frame', k.root);
    frame.setAttribute('data-layer', 'a-roll');
    frame.setAttribute('data-allow-offstage', '');
    const src = ctx.asset(d.src);
    frame.innerHTML = `<video class="fe-video" src="${src}" muted playsinline preload="auto" data-start="0" data-offset="${d.src_in || 0}" style="object-fit:${d.fit || 'cover'}"></video>`;
    const video = frame.firstElementChild;
    const g = GRADE[d.grade] || GRADE.clean;
    video.style.filter = g.f;
    if (g.o) { const ov = el('div', 'fe-grade', k.root); ov.style.background = g.o; }
    const zooms = (d.zooms || []).slice().sort((a, b) => a.t - b.t);
    const t0 = d.t0 || 0;
    ctx.onFrame((t) => {
      const z = zoomAt(zooms, t0 + t);
      frame.style.transform = `translate(${(-z.x * 100).toFixed(3)}%, ${(-z.y * 100).toFixed(3)}%) scale(${z.s.toFixed(4)})`;
    });
    (d.broll || []).forEach((b, i) => {
      const id = b.asset;
      if (!id) return;
      const s = ctx.asset(id);
      const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(s);
      const box = el('div', 'fe-broll ' + (b.mode === 'pip' ? 'is-pip' : 'is-full'), k.root, isVid ? `<video src="${s}" muted playsinline preload="auto" data-start="${b.t}" data-loop></video>` : `<img src="${s}" alt="">`);
      box.setAttribute('data-layer', 'b-roll-' + i);
      const m = box.firstElementChild;
      const end = Math.min(ctx.D, b.t + (b.dur || 1.6));
      ctx.tl.set(box, { autoAlpha: 0 }, 0);
      if (b.mode === 'pip') {
        ctx.tl.fromTo(box, { autoAlpha: 1, scale: 0.6, rotation: -6, y: 60 }, { autoAlpha: 1, scale: 1, rotation: -2, y: 0, duration: 0.4, ease: 'au.pop' }, b.t);
        ctx.tl.to(box, { autoAlpha: 0, scale: 0.85, duration: 0.2, ease: 'au.exit' }, Math.max(b.t + 0.4, end - 0.2));
      } else {
        ctx.tl.fromTo(box, { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' }, { autoAlpha: 1, clipPath: 'inset(0 0 0 0%)', duration: 0.28, ease: 'au.whip' }, b.t);
        ctx.tl.to(box, { clipPath: 'inset(0 100% 0 0)', duration: 0.24, ease: 'au.whip' }, Math.max(b.t + 0.3, end - 0.24));
      }
      ctx.tl.fromTo(m, { scale: 1.18 }, { scale: 1.02, duration: Math.max(0.6, end - b.t), ease: 'none' }, b.t);
    });
  });
})();
