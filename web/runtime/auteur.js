(function () {
  const CFG = Object.assign({
    W: 1920, H: 1080, D: 6, fps: 30, seed: 1, mode: 'render', theme: {}, cues: [], data: {}, assets: {},
    captions: { enabled: true, style: 'pop', position: 'bottom' }, layers: [], overrides: {}, ground: 'paper',
    texture: 'grain', sceneIndex: 0, globalStart: 0, safe: null
  }, window.AU_CONFIG || {});

  function mulberry(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry(CFG.seed * 9301 + 49297 + CFG.sceneIndex * 233280);
  Math.random = rng;
  const FIXED_NOW = 1767225600000;
  const RealDate = Date;
  if (CFG.mode === 'render') {
    window.Date = class extends RealDate {
      constructor(...args) { if (args.length) { super(...args); } else { super(FIXED_NOW); } }
      static now() { return FIXED_NOW; }
    };
  }

  const W = CFG.W, H = CFG.H, D = Math.max(0.5, CFG.D);
  const RX = {
    complex: /[\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\uFB1D-\uFDFF\uFE70-\uFEFF]/,
    rtl: /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/,
    nospace: /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/,
    cjk: /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/,
    latin: /[A-Za-z\u00C0-\u024F]/
  };
  const LANG = CFG.lang || 'en';
  function segments(text, granularity) {
    const str = String(text || '');
    if (window.Intl && Intl.Segmenter) {
      try { return Array.from(new Intl.Segmenter(LANG, { granularity }).segment(str)).map((x) => ({ s: x.segment, word: x.isWordLike !== false })); } catch (e) { }
    }
    return granularity === 'grapheme' ? Array.from(str).map((c) => ({ s: c, word: true })) : str.split(/(\s+)/).filter(Boolean).map((x) => ({ s: x, word: !/^\s+$/.test(x) }));
  }
  function tokenize(text) {
    const str = String(text || '').replace(/\s+/g, ' ').trim();
    if (!str) return [];
    if (!RX.nospace.test(str)) return str.split(' ').filter(Boolean).map((w, i, a) => ({ w, sp: i < a.length - 1 }));
    const out = [];
    segments(str, 'word').forEach((seg) => {
      if (/^\s+$/.test(seg.s)) { if (out.length) out[out.length - 1].sp = true; return; }
      if (!seg.word && out.length) { out[out.length - 1].w += seg.s; return; }
      out.push({ w: seg.s, sp: false });
    });
    return out;
  }
  function graphemes(text) { return segments(text, 'grapheme').length; }
  const portrait = H > W;
  const safe = CFG.safe || (portrait
    ? { x: Math.round(W * 0.08), y: Math.round(H * 0.1), w: Math.round(W * 0.84), h: Math.round(H * 0.72) }
    : { x: Math.round(W * 0.06), y: Math.round(H * 0.08), w: Math.round(W * 0.88), h: Math.round(H * 0.84) });

  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e.error || 'error')));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && e.reason.message || e.reason || 'rejection')));

  const g = window.gsap;
  if (g) {
    const plugins = ['SplitText', 'DrawSVGPlugin', 'MorphSVGPlugin', 'MotionPathPlugin', 'ScrambleTextPlugin', 'TextPlugin', 'CustomEase', 'CustomBounce', 'CustomWiggle', 'Physics2DPlugin', 'Flip'];
    g.registerPlugin(...plugins.map((n) => window[n]).filter(Boolean));
    g.ticker.lagSmoothing(0);
    g.ticker.sleep();
    g.config({ nullTargetWarn: false });
    g.defaults({ lazy: false });
    const bez = (name, a, b, c, d) => window.CustomEase && window.CustomEase.create(name, `${a},${b},${c},${d}`);
    bez('au.softLand', 0.16, 1, 0.3, 1);
    bez('au.glide', 0.65, 0, 0.35, 1);
    bez('au.whip', 0.7, 0, 0.12, 1);
    bez('au.exit', 0.55, 0, 1, 0.45);
    bez('au.punch', 0.12, 0.9, 0.18, 1);
    const alias = (name, ease) => g.registerEase(name, g.parseEase(ease));
    alias('au.snapSettle', 'back.out(1.1)');
    alias('au.pop', 'back.out(1.32)');
    alias('au.drift', 'sine.inOut');
    alias('au.anticipate', 'back.in(1.25)');
    alias('au.float', 'sine.inOut');
    alias('au.breathe', 'sine.inOut');
    alias('au.linear', 'none');
  }

  const stage = () => document.getElementById('au-stage');
  const world = () => document.getElementById('au-scene');
  const $ = (sel, root) => (typeof sel === 'string' ? (root || world() || document).querySelector(sel) : sel);
  const $$ = (sel, root) => Array.from((root || world() || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const range = (a, b) => a + (b - a) * rng();

  const frameHooks = [];
  const pendingVideos = new Set();
  let tl = null;
  let sceneFn = null;
  let built = false;
  let playing = false;
  let playHandle = 0;
  let current = 0;
  const cam = { x: 0, y: 0, scale: 1, rotate: 0 };
  const parallax = [];
  const overrideState = new Map();

  function css(el, props) { Object.assign(el.style, props); return el; }
  function make(tag, cls, parent, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  }

  function icon(name, opts) {
    const o = Object.assign({ size: 48, stroke: 2, color: 'currentColor', fill: 'none' }, opts || {});
    const inner = (window.AU_ICONS || {})[name] || (window.AU_ICONS || {})['circle'] || '';
    return `<svg class="au-icon" xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" viewBox="0 0 24 24" fill="${o.fill}" stroke="${o.color}" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  function asset(name) { return (CFG.assets || {})[name] || name; }

  function split(el, opts) {
    const target = $(el);
    if (!target || !window.SplitText) return { chars: [], words: [], lines: [] };
    const o = Object.assign({ type: 'chars,words,lines', linesClass: 'au-line', wordsClass: 'au-word', charsClass: 'au-char' }, opts || {});
    if (o.mask === undefined && /lines/.test(o.type)) o.mask = false;
    const text = target.textContent || '';
    if (RX.complex.test(text) && /chars/.test(o.type)) {
      o.type = o.type.split(',').filter((x) => x.trim() !== 'chars').join(',') || 'words';
      if (!/words/.test(o.type)) o.type += ',words';
      const res = new window.SplitText(target, o);
      try { res.chars = res.words; } catch (e) { return { chars: res.words, words: res.words, lines: res.lines || [], revert: () => res.revert() }; }
      return res;
    }
    if (RX.nospace.test(text) && /words|chars/.test(o.type)) {
      const types = o.type.split(',').map((x) => x.trim()).filter((x) => x && x !== 'words');
      if (!types.includes('chars')) types.push('chars');
      const res = new window.SplitText(target, Object.assign({}, o, { type: types.join(',') }));
      try { res.words = res.chars; } catch (e) { return { chars: res.chars, words: res.chars, lines: res.lines || [], revert: () => res.revert() }; }
      return res;
    }
    return new window.SplitText(target, o);
  }

  function fit(el, opts) {
    const node = $(el);
    if (!node) return;
    const o = Object.assign({ min: 18, max: null, box: null, step: 0.94 }, opts || {});
    const box = o.box ? $(o.box) : node.parentElement;
    let size = o.max || parseFloat(getComputedStyle(node).fontSize) || 64;
    node.style.fontSize = size + 'px';
    const fits = () => {
      if (node.scrollWidth > node.clientWidth + 1 || (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1)) return false;
      if (!box || box.id === 'au-scene' || box.classList.contains('scene')) return true;
      const r = node.getBoundingClientRect(), b = box.getBoundingClientRect();
      return r.right <= b.right + 1 && r.left >= b.left - 1 && (box.clientHeight === 0 || r.bottom <= b.bottom + 1);
    };
    let guard = 0;
    while (!fits() && size > o.min && guard < 60) {
      size = Math.max(o.min, size * o.step);
      node.style.fontSize = size + 'px';
      guard++;
    }
    return size;
  }

  function autoFit() {
    $$('[data-fit]').forEach((el) => {
      const min = parseFloat(el.getAttribute('data-fit-min')) || Math.round(Math.min(W, H) * 0.032);
      fit(el, { min });
    });
  }

  function counter(el, to, opts) {
    const node = $(el);
    const o = Object.assign({ from: 0, decimals: 0, prefix: '', suffix: '', at: 0, duration: 1.6, ease: 'au.softLand', separator: ',' }, opts || {});
    const fmt = (v) => {
      const fixed = Math.abs(v).toFixed(o.decimals);
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, o.separator);
      return (v < 0 ? '-' : '') + o.prefix + parts.join('.') + o.suffix;
    };
    const state = { v: o.from };
    if (node) node.textContent = fmt(o.from);
    tl.to(state, { v: to, duration: o.duration, ease: o.ease, onUpdate: () => { if (node) node.textContent = fmt(state.v); } }, o.at);
    return state;
  }

  function draw(sel, opts) {
    const o = Object.assign({ at: 0, duration: 1.2, ease: 'au.glide', stagger: 0.08, from: '0%', to: '100%' }, opts || {});
    const targets = typeof sel === 'string' ? $$(sel) : (sel instanceof Element ? [sel] : Array.from(sel || []));
    const paths = [];
    targets.forEach((t) => {
      if (t.matches('path,line,polyline,polygon,circle,ellipse,rect')) paths.push(t);
      else paths.push(...t.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect'));
    });
    if (!paths.length) return tl;
    if (window.DrawSVGPlugin) {
      tl.fromTo(paths, { drawSVG: o.from }, { drawSVG: o.to, duration: o.duration, ease: o.ease, stagger: o.stagger }, o.at);
    } else {
      paths.forEach((p, i) => {
        const len = p.getTotalLength ? p.getTotalLength() : 1000;
        css(p, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(p, { strokeDashoffset: 0, duration: o.duration, ease: o.ease }, o.at + i * o.stagger);
      });
    }
    return tl;
  }

  function rough(svgSel, shapes, opts) {
    const svg = $(svgSel);
    const o = Object.assign({ boil: true, boilFps: 8, variants: 3, roughness: 1.6, bowing: 1.2, stroke: 'var(--ink)', strokeWidth: 4, fill: undefined, fillStyle: 'hachure', hachureGap: 10, seed: CFG.seed }, opts || {});
    if (!svg || !window.rough) return [];
    const rc = window.rough.svg(svg);
    const resolve = (v) => {
      if (typeof v !== 'string' || !v.startsWith('var(')) return v;
      const name = v.slice(4, -1).trim();
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#111';
    };
    const groups = [];
    shapes.forEach((shape, si) => {
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      holder.setAttribute('class', 'au-rough ' + (shape.cls || ''));
      if (shape.layer) holder.setAttribute('data-layer', shape.layer);
      const frames = [];
      const count = o.boil ? o.variants : 1;
      for (let v = 0; v < count; v++) {
        const opt = {
          seed: (o.seed * 31 + si * 7 + v * 101) % 2147483646 + 1,
          roughness: shape.roughness ?? o.roughness, bowing: shape.bowing ?? o.bowing,
          stroke: resolve(shape.stroke ?? o.stroke), strokeWidth: shape.strokeWidth ?? o.strokeWidth,
          fill: resolve(shape.fill ?? o.fill), fillStyle: shape.fillStyle ?? o.fillStyle, hachureGap: shape.hachureGap ?? o.hachureGap,
          disableMultiStroke: shape.single ?? false
        };
        let node;
        const a = shape.args || [];
        switch (shape.type) {
          case 'rect': node = rc.rectangle(...a, opt); break;
          case 'circle': node = rc.circle(...a, opt); break;
          case 'ellipse': node = rc.ellipse(...a, opt); break;
          case 'line': node = rc.line(...a, opt); break;
          case 'polygon': node = rc.polygon(a[0], opt); break;
          case 'curve': node = rc.curve(a[0], opt); break;
          case 'arc': node = rc.arc(...a, opt); break;
          case 'arrow': {
            const [x1, y1, x2, y2] = a;
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const head = shape.head || 26;
            node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            node.appendChild(rc.line(x1, y1, x2, y2, opt));
            node.appendChild(rc.linearPath([[x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45)], [x2, y2], [x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45)]], opt));
            break;
          }
          default: node = rc.path(a[0] || shape.d, opt);
        }
        node.setAttribute('class', 'au-boil');
        if (v > 0) node.style.visibility = 'hidden';
        holder.appendChild(node);
        frames.push(node);
      }
      svg.appendChild(holder);
      groups.push(holder);
      if (frames.length > 1) {
        onFrame((t) => {
          const k = Math.floor(t * o.boilFps) % frames.length;
          frames.forEach((f, i) => { f.style.visibility = i === k ? 'visible' : 'hidden'; });
        });
      }
    });
    return groups;
  }

  function applyTranslate(el) {
    const st = overrideState.get(el) || { dx: 0, dy: 0 };
    const depth = parseFloat(el.getAttribute('data-depth') || '0');
    const px = depth ? -cam.x * depth : 0;
    const py = depth ? -cam.y * depth : 0;
    const dx = (st.dx || 0) + px, dy = (st.dy || 0) + py;
    el.style.translate = (dx || dy) ? `${dx}px ${dy}px` : '';
  }

  function applyCamera() {
    const w = world();
    if (!w) return;
    w.style.transformOrigin = '50% 50%';
    w.style.transform = `translate(${-cam.x}px, ${-cam.y}px) scale(${cam.scale}) rotate(${cam.rotate}deg)`;
    parallax.forEach(applyTranslate);
  }

  function camera(opts) {
    const o = Object.assign({ at: 0, duration: 1.2, ease: 'au.glide' }, opts || {});
    const to = {};
    ['x', 'y', 'scale', 'rotate'].forEach((k) => { if (o[k] !== undefined) to[k] = o[k]; });
    tl.to(cam, Object.assign(to, { duration: o.duration, ease: o.ease, onUpdate: applyCamera }), o.at);
    return tl;
  }

  function onFrame(fn) { frameHooks.push(fn); return fn; }

  function particles(canvasSel, opts) {
    const canvas = $(canvasSel);
    if (!canvas) return;
    const o = Object.assign({ count: 70, kind: 'dust', color: null, speed: 1, size: [1.5, 5], opacity: [0.15, 0.6] }, opts || {});
    canvas.width = canvas.clientWidth || W;
    canvas.height = canvas.clientHeight || H;
    const ctx2 = canvas.getContext('2d');
    const r = mulberry(CFG.seed + 77 + CFG.sceneIndex);
    const pts = Array.from({ length: o.count }, () => ({
      x: r(), y: r(), s: lerp(o.size[0], o.size[1], r()), a: lerp(o.opacity[0], o.opacity[1], r()),
      vx: (r() - 0.5) * 0.02, vy: o.kind === 'snow' ? 0.03 + r() * 0.04 : o.kind === 'embers' ? -(0.03 + r() * 0.05) : (r() - 0.5) * 0.02,
      ph: r() * Math.PI * 2, hue: r()
    }));
    const color = o.color || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fff';
    onFrame((t) => {
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach((p) => {
        let x = (p.x + p.vx * t * o.speed + Math.sin(t * 0.6 + p.ph) * 0.004) % 1;
        let y = (p.y + p.vy * t * o.speed) % 1;
        if (x < 0) x += 1; if (y < 0) y += 1;
        const tw = o.kind === 'stars' ? 0.55 + 0.45 * Math.sin(t * 2.2 + p.ph * 3) : 1;
        ctx2.globalAlpha = p.a * tw;
        ctx2.fillStyle = color;
        ctx2.beginPath();
        if (o.kind === 'confetti') {
          ctx2.save(); ctx2.translate(x * canvas.width, y * canvas.height); ctx2.rotate(t * 2 + p.ph);
          ctx2.fillRect(-p.s, -p.s * 0.4, p.s * 2, p.s * 0.8); ctx2.restore();
        } else {
          ctx2.arc(x * canvas.width, y * canvas.height, o.kind === 'bokeh' ? p.s * 6 : p.s, 0, Math.PI * 2);
          ctx2.fill();
        }
      });
      ctx2.globalAlpha = 1;
    });
  }

  function ambient(sel, kind, opts) {
    const targets = typeof sel === 'string' ? $$(sel) : [sel];
    const o = Object.assign({ amount: 1, period: 3.2 }, opts || {});
    const reps = Math.ceil(D / o.period) + 1;
    targets.forEach((el, i) => {
      const phase = ((i * 0.37) % 1) * Math.min(0.6, o.period * 0.25);
      const base = { duration: o.period / 2, ease: 'sine.inOut', repeat: reps * 2, yoyo: true };
      if (kind === 'float') tl.fromTo(el, { y: -6 * o.amount }, Object.assign({ y: 6 * o.amount }, base), phase);
      else if (kind === 'breathe') tl.fromTo(el, { scale: 1 }, Object.assign({ scale: 1 + 0.025 * o.amount }, base), phase);
      else if (kind === 'sway') tl.fromTo(el, { rotation: -1.5 * o.amount }, Object.assign({ rotation: 1.5 * o.amount }, base), phase);
      else if (kind === 'spin') tl.to(el, { rotation: 360 * (D / (o.period * 4)), duration: D, ease: 'none' }, 0);
      else if (kind === 'drift') tl.fromTo(el, { x: -10 * o.amount }, { x: 10 * o.amount, duration: D, ease: 'none' }, 0);
      else if (kind === 'pulse') tl.fromTo(el, { opacity: 0.55 }, Object.assign({ opacity: 1 }, base), phase);
    });
  }

  function typewrite(sel, opts) {
    const el = $(sel);
    if (!el) return;
    const o = Object.assign({ at: 0, cps: 22, cursor: true }, opts || {});
    const text = el.textContent;
    el.textContent = '';
    const units = RX.complex.test(text) ? segments(text, 'word').map((x) => x.s) : segments(text, 'grapheme').map((x) => x.s);
    const spans = units.map((ch) => make('span', 'au-tw', el, ch === ' ' ? '&nbsp;' : ch.replace(/&/g, '&amp;').replace(/</g, '&lt;')));
    spans.forEach((s) => { s.style.opacity = 0; });
    let cur = null;
    if (o.cursor) cur = make('span', 'au-caret', el, '');
    spans.forEach((s, i) => tl.set(s, { opacity: 1 }, o.at + i / o.cps));
    if (cur) {
      const end = o.at + spans.length / o.cps;
      const blinks = Math.max(1, Math.floor((D - end) / 0.5));
      tl.fromTo(cur, { opacity: 1 }, { opacity: 0, duration: 0.25, repeat: blinks, yoyo: true, ease: 'steps(1)' }, end);
    }
    return spans;
  }

  function scramble(sel, opts) {
    const el = $(sel);
    if (!el) return;
    const o = Object.assign({ at: 0, duration: 1.1, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&', text: null }, opts || {});
    const finalText = o.text || el.textContent;
    if (window.ScrambleTextPlugin) {
      tl.to(el, { duration: o.duration, scrambleText: { text: finalText, chars: o.chars, revealDelay: 0.25, speed: 0.6 }, ease: 'none' }, o.at);
    }
  }

  function math(sel, tex, opts) {
    const el = $(sel);
    if (!el) return [];
    const o = Object.assign({ at: 0, duration: 1.2, display: true, write: true }, opts || {});
    if (window.katex) {
      try { window.katex.render(tex, el, { displayMode: o.display, throwOnError: false, output: 'html' }); } catch (e) { el.textContent = tex; }
    } else el.textContent = tex;
    const glyphs = $$('.katex-html .base > span, .katex-html .mord, .katex-html .mbin, .katex-html .mrel, .katex-html .mopen, .katex-html .mclose, .katex-html .mop', el)
      .filter((n) => !n.querySelector('.mord, .mbin, .mrel'));
    if (o.write && glyphs.length) {
      tl.from(glyphs, { opacity: 0, y: 18, filter: 'blur(6px)', duration: 0.5, ease: 'au.softLand', stagger: o.duration / Math.max(1, glyphs.length) }, o.at);
    }
    return glyphs;
  }

  function ns(tag, attrs, parent) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  }

  const pending = [];
  function defer(promise) {
    const p = Promise.resolve(promise).catch((e) => { errors.push('asset: ' + (e && e.message || e)); });
    pending.push(p);
    return p;
  }

  function interpolate(x, input, output, opts) {
    const o = Object.assign({ clamp: true, ease: null }, opts || {});
    const ins = input.length ? input : [0, 1], outs = output.length ? output : [0, 1];
    let i = 1;
    while (i < ins.length - 1 && x > ins[i]) i++;
    const a = ins[i - 1], b = ins[i];
    let p = b === a ? 1 : (x - a) / (b - a);
    if (o.clamp) p = Math.max(0, Math.min(1, p));
    if (o.ease) p = (typeof o.ease === 'function' ? o.ease : g.parseEase(o.ease))(p);
    return outs[i - 1] + (outs[i] - outs[i - 1]) * p;
  }

  function spring(t, opts) {
    const o = Object.assign({ from: 0, to: 1, stiffness: 120, damping: 14, mass: 1, at: 0, velocity: 0 }, opts || {});
    const x = t - o.at;
    if (x <= 0) return o.from;
    const w0 = Math.sqrt(o.stiffness / o.mass), zeta = o.damping / (2 * Math.sqrt(o.stiffness * o.mass));
    const d0 = o.from - o.to, v0 = o.velocity;
    let y;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      y = Math.exp(-zeta * w0 * x) * (d0 * Math.cos(wd * x) + ((v0 + zeta * w0 * d0) / wd) * Math.sin(wd * x));
    } else if (zeta === 1) {
      y = Math.exp(-w0 * x) * (d0 + (v0 + w0 * d0) * x);
    } else {
      const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1)), r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
      const c2 = (v0 - r1 * d0) / (r2 - r1), c1 = d0 - c2;
      y = c1 * Math.exp(r1 * x) + c2 * Math.exp(r2 * x);
    }
    return o.to + y;
  }

  function cameraKeys(cam) {
    const k = Math.max(0, Math.min(2, cam.intensity == null ? 1 : +cam.intensity));
    const z = 1 + 0.12 * k;
    const P = {
      'ken-burns-in': [{ t: 0, zoom: 1, x: 50, y: 50 }, { t: D, zoom: z, x: 52, y: 47, ease: 'sine.inOut' }],
      'ken-burns-out': [{ t: 0, zoom: z, x: 48, y: 53 }, { t: D, zoom: 1, x: 50, y: 50, ease: 'sine.inOut' }],
      'pan-left': [{ t: 0, zoom: z, x: 58, y: 50 }, { t: D, zoom: z, x: 42, y: 50, ease: 'sine.inOut' }],
      'pan-right': [{ t: 0, zoom: z, x: 42, y: 50 }, { t: D, zoom: z, x: 58, y: 50, ease: 'sine.inOut' }],
      'pan-up': [{ t: 0, zoom: z, x: 50, y: 58 }, { t: D, zoom: z, x: 50, y: 42, ease: 'sine.inOut' }],
      'pan-down': [{ t: 0, zoom: z, x: 50, y: 42 }, { t: D, zoom: z, x: 50, y: 58, ease: 'sine.inOut' }],
      'punch-in': [{ t: 0, zoom: 1, x: 50, y: 50 }, { t: Math.min(D * 0.4, 1.2), zoom: 1, x: 50, y: 50 }, { t: Math.min(D * 0.4, 1.2) + 0.22, zoom: 1 + 0.2 * k, x: cam.x != null ? cam.x : 50, y: cam.y != null ? cam.y : 46, ease: 'expo.out' }],
      'push-out': [{ t: 0, zoom: 1 + 0.2 * k, x: 50, y: 50 }, { t: 0.5, zoom: 1, x: 50, y: 50, ease: 'expo.out' }],
      drift: [0, 0.33, 0.66, 1].map((f, i) => ({ t: f * D, zoom: 1.06 * (1 + 0.02 * k), x: 50 + Math.sin(i * 2.1) * 2.5 * k, y: 50 + Math.cos(i * 1.7) * 2 * k, ease: 'sine.inOut' }))
    };
    const keys = (Array.isArray(cam.keys) && cam.keys.length ? cam.keys : (P[cam.preset] || [])).map((x) => ({
      t: clamp(+x.t || 0, 0, D), zoom: Math.max(1, +x.zoom || 1), x: x.x == null ? 50 : +x.x, y: x.y == null ? 50 : +x.y, rotate: +x.rotate || 0, ease: x.ease || 'power2.inOut'
    }));
    return keys.sort((a, b) => a.t - b.t);
  }

  function sceneCamera(cam) {
    if (!cam || (!cam.preset && !(cam.keys && cam.keys.length) && !cam.shake)) return;
    const host = document.getElementById('au-scene');
    if (!host) return;
    const keys = cameraKeys(cam);
    const easeFn = (name) => { try { return gsap.parseEase(name) || ((x) => x); } catch (e) { return (x) => x; } };
    const eases = keys.map((k) => easeFn(k.ease));
    const shake = Math.max(0, +cam.shake || 0);
    host.style.willChange = 'transform';
    onFrame((t) => {
      let st = { zoom: 1, x: 50, y: 50, rotate: 0 };
      if (keys.length === 1 || (keys.length && t <= keys[0].t)) st = keys[0];
      else if (keys.length && t >= keys[keys.length - 1].t) st = keys[keys.length - 1];
      else for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i].t) {
          const a = keys[i - 1], b = keys[i];
          const f = eases[i]((t - a.t) / Math.max(1e-6, b.t - a.t));
          st = { zoom: lerp(a.zoom, b.zoom, f), x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), rotate: lerp(a.rotate, b.rotate, f) };
          break;
        }
      }
      const z = Math.max(1, st.zoom);
      const fx = st.x / 100 * W, fy = st.y / 100 * H;
      let dx = W / 2 - fx, dy = H / 2 - fy;
      const minDx = W - fx - (W - fx) * z, maxDx = fx * z - fx;
      const minDy = H - fy - (H - fy) * z, maxDy = fy * z - fy;
      dx = clamp(dx, minDx, maxDx); dy = clamp(dy, minDy, maxDy);
      if (shake) { const s = shake * 6; dx += Math.sin(t * 37) * s + Math.sin(t * 91) * s * 0.4; dy += Math.cos(t * 41) * s * 0.7; }
      host.style.transformOrigin = fx + 'px ' + fy + 'px';
      host.style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) rotate(' + st.rotate.toFixed(3) + 'deg) scale(' + z.toFixed(4) + ')';
    });
  }

  let currentCtx = null;
  function component(name, params) {
    const reg = window.AU_COMPONENTS;
    if (!reg || !reg.has(name)) { errors.push('component: unknown ' + name); return null; }
    try { return reg.run(name, currentCtx, params || {}); } catch (e) { errors.push('component ' + name + ': ' + (e && e.message || e)); console.error(e); return null; }
  }

  function cssColor(v) {
    if (typeof v !== 'string') return v;
    const m = v.match(/^(?:var\()?(--[\w-]+)\)?$/);
    return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : v;
  }

  function roomEnvironment(T, renderer) {
    const env = new T.Scene();
    const box = new T.BoxGeometry(1, 1, 1);
    const room = new T.Mesh(box, new T.MeshStandardMaterial({ side: T.BackSide, color: 0x7a7a80 }));
    room.scale.set(30, 18, 30);
    env.add(room);
    const panel = (x, y, z, sx, sy, sz, intensity) => {
      const m = new T.Mesh(box, new T.MeshBasicMaterial({ color: new T.Color(intensity, intensity, intensity) }));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); env.add(m);
    };
    panel(-10, 6, 0, 0.2, 6, 12, 6);
    panel(10, 4, -4, 0.2, 4, 8, 3);
    panel(0, 8.9, 0, 14, 0.2, 10, 4);
    panel(0, 3, 14, 10, 4, 0.2, 2);
    const pmrem = new T.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
    return tex;
  }

  function three(sel, setup, opts) {
    const host = $(sel);
    const T = window.THREE;
    if (!host || !T) { errors.push('three.js unavailable'); return null; }
    const o = Object.assign({ fov: 35, shadows: true, exposure: 1.0, env: true, transparent: true }, opts || {});
    const w = host.clientWidth || W, h = host.clientHeight || H;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: o.transparent, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch (e) { errors.push('webgl: ' + e.message); return null; }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure;
    renderer.shadowMap.enabled = o.shadows;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const scene = new T.Scene();
    if (o.env) scene.environment = roomEnvironment(T, renderer);
    const camera = new T.PerspectiveCamera(o.fov, w / h, 0.1, 120);
    camera.position.set(0, 0, 10);
    const color = (v) => new T.Color(cssColor(v));
    const key = new T.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 8, 6);
    key.castShadow = o.shadows;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.camera.near = 1; key.shadow.camera.far = 40;
    ['left', 'bottom'].forEach((k) => { key.shadow.camera[k] = -12; });
    ['right', 'top'].forEach((k) => { key.shadow.camera[k] = 12; });
    const fill = new T.HemisphereLight(0xffffff, color('var(--bg-2)'), 0.6);
    const rim = new T.DirectionalLight(color('var(--accent)'), 1.4);
    rim.position.set(-6, 3, -6);
    scene.add(key, fill, rim);
    const r = mulberry(CFG.seed + 4242);
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const api = { THREE: T, renderer, scene, camera, lights: { key, fill, rim }, w, h, D, rand: r, color, ease, clamp, lerp,
      material: (c, extra) => new T.MeshPhysicalMaterial(Object.assign({ color: color(c), roughness: 0.35, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }, extra || {})) };
    api.glow = (c, size) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const x = cv.getContext('2d');
      const col = new T.Color(cssColor(c));
      const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const tex = new T.CanvasTexture(cv);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(size || 3);
      return sp;
    };
    api.starfield = (count, radius) => {
      const n = count || 1200, R = radius || 60;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = R * (0.6 + r() * 0.4);
        pos[i * 3] = rr * Math.sqrt(1 - u * u) * Math.cos(th); pos[i * 3 + 1] = rr * u; pos[i * 3 + 2] = rr * Math.sqrt(1 - u * u) * Math.sin(th);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
      scene.add(pts);
      return pts;
    };
    api.orbitLine = (rx, rz, c, opacity) => {
      const curve = new T.EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2);
      const pts = curve.getPoints(160).map((p) => new T.Vector3(p.x, 0, p.y));
      const line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: color(c || 'var(--ink-2)'), transparent: true, opacity: opacity ?? 0.35 }));
      return line;
    };
    let update = null;
    try { update = setup(api); } catch (e) { errors.push('three setup: ' + e.message); }
    onFrame((t) => {
      try { if (update) update(t); } catch (e) { if (errors.length < 50) errors.push('three frame: ' + e.message); }
      renderer.render(scene, camera);
    });
    return api;
  }

  const chart = {
    bar(sel, data, opts) {
      const host = $(sel);
      if (!host) return;
      const o = Object.assign({ at: 0, stagger: 0.12, duration: 1.1, horizontal: false, unit: '', decimals: 0, highlight: -1, max: null }, opts || {});
      host.classList.add('au-chart', o.horizontal ? 'au-bars-h' : 'au-bars-v');
      const max = o.max || Math.max(...data.map((d) => d.value)) || 1;
      data.forEach((d, i) => {
        const row = make('div', 'au-bar-row' + (i === o.highlight ? ' is-hero' : ''), host);
        const label = make('div', 'au-bar-label', row, d.label);
        const track = make('div', 'au-bar-track', row);
        const fill = make('div', 'au-bar-fill', track);
        const val = make('div', 'au-bar-value', o.horizontal ? track : row);
        row.setAttribute('data-layer', 'bar-' + i);
        const pct = clamp(d.value / max, 0, 1) * 100;
        const at = o.at + i * o.stagger;
        if (o.horizontal) { fill.style.width = pct + '%'; tl.from(fill, { scaleX: 0, transformOrigin: '0% 50%', duration: o.duration, ease: 'au.softLand' }, at); }
        else { fill.style.height = pct + '%'; tl.from(fill, { scaleY: 0, transformOrigin: '50% 100%', duration: o.duration, ease: 'au.softLand' }, at); }
        tl.from(label, { opacity: 0, y: 10, duration: 0.5, ease: 'au.softLand' }, at);
        counter(val, d.value, { at, duration: o.duration, decimals: o.decimals, suffix: o.unit });
      });
    },
    line(sel, series, opts) {
      const host = $(sel);
      if (!host) return;
      const o = Object.assign({ at: 0, duration: 1.8, w: host.clientWidth || 900, h: host.clientHeight || 420, labels: [], dot: true, area: true, grid: 4 }, opts || {});
      const svg = ns('svg', { viewBox: `0 0 ${o.w} ${o.h}`, width: o.w, height: o.h, class: 'au-line-chart' }, host);
      const min = Math.min(...series), max = Math.max(...series);
      const pad = 24;
      const px = (i) => pad + (i / Math.max(1, series.length - 1)) * (o.w - pad * 2);
      const py = (v) => o.h - pad - ((v - min) / Math.max(1e-9, max - min)) * (o.h - pad * 2);
      for (let k = 0; k <= o.grid; k++) {
        const y = pad + (k / o.grid) * (o.h - pad * 2);
        const gl = ns('line', { x1: pad, x2: o.w - pad, y1: y, y2: y, class: 'au-grid-line' }, svg);
        tl.from(gl, { opacity: 0, duration: 0.4 }, o.at + k * 0.05);
      }
      const d = series.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
      if (o.area) {
        const area = ns('path', { d: `${d} L${px(series.length - 1)},${o.h - pad} L${px(0)},${o.h - pad} Z`, class: 'au-area' }, svg);
        tl.from(area, { opacity: 0, duration: 0.8 }, o.at + o.duration * 0.6);
      }
      const path = ns('path', { d, class: 'au-line-path' }, svg);
      draw(path, { at: o.at, duration: o.duration, ease: 'au.glide' });
      if (o.dot && window.MotionPathPlugin) {
        const dot = ns('circle', { r: 10, class: 'au-line-dot', cx: 0, cy: 0 }, svg);
        tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2 }, o.at);
        tl.to(dot, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, duration: o.duration, ease: 'au.glide' }, o.at);
      }
      return svg;
    },
    donut(sel, parts, opts) {
      const host = $(sel);
      if (!host) return;
      const o = Object.assign({ at: 0, duration: 1.4, size: Math.min(host.clientWidth || 420, host.clientHeight || 420), thickness: 0.18, gap: 0.012 }, opts || {});
      const svg = ns('svg', { viewBox: '0 0 100 100', width: o.size, height: o.size, class: 'au-donut' }, host);
      const total = parts.reduce((a, p) => a + p.value, 0) || 1;
      let acc = 0;
      const r = 50 - o.thickness * 50;
      ns('circle', { cx: 50, cy: 50, r, class: 'au-donut-track', 'stroke-width': o.thickness * 100 }, svg);
      parts.forEach((p, i) => {
        const frac = p.value / total;
        const c = ns('circle', { cx: 50, cy: 50, r, class: 'au-donut-seg seg-' + i, 'stroke-width': o.thickness * 100, transform: `rotate(${-90 + acc * 360} 50 50)` }, svg);
        if (p.color) c.style.stroke = p.color;
        if (window.DrawSVGPlugin) tl.fromTo(c, { drawSVG: '0% 0%' }, { drawSVG: `0% ${Math.max(0, frac - o.gap) * 100}%`, duration: o.duration * frac + 0.4, ease: 'au.softLand' }, o.at + acc * o.duration * 0.8);
        acc += frac;
      });
      return svg;
    }
  };

  function chunkWords(words, maxWords, maxChars) {
    const pages = [];
    let page = [];
    let chars = 0;
    words.forEach((w) => {
      const len = w.w.length + 1;
      const brk = /[.!?;:]$/.test(page.length ? page[page.length - 1].w : '');
      if (page.length && (page.length >= maxWords || chars + len > maxChars || brk)) { pages.push(page); page = []; chars = 0; }
      page.push(w); chars += len;
    });
    if (page.length) pages.push(page);
    return pages;
  }

  function syllables(w) {
    const str = String(w);
    const digits = str.replace(/\D/g, '').length;
    if (RX.cjk.test(str)) return Math.max(1, graphemes(str.replace(/[\s\p{P}]/gu, '')) + digits * 0.9);
    if (!RX.latin.test(str) || RX.complex.test(str)) return Math.max(1, graphemes(str.replace(/[\s\p{P}]/gu, '')) / 2.2 + digits * 0.9);
    const s = str.toLowerCase().replace(/[^a-z]/g, '').replace(/(?:[^laeiouy]e)$/, 'x');
    const m = s.match(/[aeiouy]+/g);
    return Math.max(1, (m ? m.length : 1) + digits * 0.9);
  }

  function cueWords(cue) {
    if (cue.words && cue.words.length) return cue.words.map((w) => ({ t: w.t, e: w.e ?? w.t + 0.3, w: String(w.w).trim(), sp: !RX.nospace.test(String(w.w)) })).filter((w) => w.w);
    const toks = tokenize(cue.text);
    const tokens = toks.map((x) => x.w);
    const span = Math.max(0.2, cue.end - cue.start);
    const pauses = tokens.map((t, i) => (i < tokens.length - 1 ? (/[.!?\u0964\u0965\u06D4\u3002\uFF01\uFF1F]$/.test(t) ? 1.1 : /[,;:\u060C\u3001\uFF0C]$/.test(t) ? 0.6 : 0.15) : 0));
    const weights = tokens.map((t, i) => syllables(t) + pauses[i]);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let t = cue.start;
    return tokens.map((w, i) => {
      const d = span * weights[i] / total;
      const item = { t, e: t + d - span * pauses[i] / total, w, sp: toks[i].sp };
      t += d;
      return item;
    });
  }

  function splitEven(words, n) {
    const out = [];
    const per = Math.ceil(words.length / n);
    for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per));
    return out;
  }

  function captionPages(style) {
    const cap = CFG.captions || {};
    const sync = cap.sync || 'exact';
    const lineStyles = { karaoke: [14, portrait ? 26 : 46], boxed: [14, portrait ? 26 : 44], minimal: [16, portrait ? 30 : 56], typewriter: [14, portrait ? 26 : 48] };
    const [mw, mc] = lineStyles[style] || [portrait ? 3 : 4, portrait ? 16 : 24];
    const pages = [];
    const cues = (CFG.cues || []).slice().sort((a, b) => a.start - b.start);
    cues.forEach((cue, ci) => {
      const words = cueWords(cue);
      if (!words.length) return;
      const timed = !!(cue.words && cue.words.length);
      let groups;
      if (sync === 'words' || (timed && sync !== 'cue')) groups = chunkWords(words, mw, mc);
      else groups = words.length > 18 ? splitEven(words, Math.ceil(words.length / 14)) : [words];
      const nextCue = cues[ci + 1];
      groups.forEach((g, gi) => {
        const start = gi === 0 ? cue.start : g[0].t;
        const end = gi === groups.length - 1 ? Math.min(cue.end, nextCue ? nextCue.start : cue.end) : groups[gi + 1][0].t;
        pages.push({ words: g, start, end, text: g.map((w) => w.w).join(' '), cue: cue.id ?? ci, exact: timed || groups.length === 1 });
      });
    });
    return pages.filter((p) => p.end > 0.001 && p.start < D);
  }

  function buildCaptions() {
    const cap = CFG.captions || {};
    const host = document.getElementById('au-captions');
    if (!host || cap.enabled === false || !CFG.cues || !CFG.cues.length) return;
    const style = cap.style || 'pop';
    host.className = `au-captions cap-${style} pos-${cap.position || 'bottom'} ${portrait ? 'is-portrait' : 'is-landscape'}`;
    if (cap.font) host.style.setProperty('--cap-font', cap.font);
    if (cap.color) host.style.setProperty('--cap-ink', cap.color);
    if (cap.highlight) host.style.setProperty('--cap-hi', cap.highlight);
    if (cap.size) host.style.setProperty('--cap-scale', cap.size);
    const P = (x) => Math.max(0, x);
    const pages = captionPages(style);
    pages.forEach((p, pi) => {
      const el = make('div', 'au-cap-page', host);
      el.setAttribute('dir', 'auto');
      el.setAttribute('data-layer', 'caption-' + pi);
      el.setAttribute('data-cue', String(p.cue));
      el.setAttribute('data-start', p.start.toFixed(3));
      el.setAttribute('data-end', p.end.toFixed(3));
      const start = p.start;
      const end = Math.min(p.end, D);
      const cont = start < 0.001;
      const spans = p.words.map((w, wi) => {
        const s = make('span', 'au-cap-word', el, w.w.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
        if (w.sp !== false && wi < p.words.length - 1) make('span', 'au-cap-sp', el, ' ');
        return s;
      });
      tl.set(el, { autoAlpha: 0 }, 0);
      tl.set(el, { autoAlpha: 1 }, P(start));
      if (!cont) {
        if (style === 'pop') tl.fromTo(el, { y: 22, scale: 0.92 }, { y: 0, scale: 1, duration: 0.22, ease: 'au.pop', immediateRender: false }, start);
        else if (style === 'karaoke' || style === 'minimal') tl.fromTo(el, { y: 12 }, { y: 0, duration: 0.25, ease: 'au.softLand', immediateRender: false }, start);
        else if (style === 'boxed') tl.fromTo(el, { clipPath: 'inset(0 100% 0 0 round 14px)' }, { clipPath: 'inset(0 0% 0 0 round 14px)', duration: 0.3, ease: 'au.softLand', immediateRender: false }, start);
      }
      p.words.forEach((w, i) => {
        const wt = w.t, we = Math.min(w.e, end);
        if (style === 'pop') {
          if (wt > 0.001 && wt > start + 0.001) tl.fromTo(spans[i], { scale: 0.8, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.16, ease: 'au.pop', immediateRender: false }, wt);
          else if (!cont && wt > 0.001) tl.fromTo(spans[i], { scale: 0.8 }, { scale: 1, duration: 0.16, ease: 'au.pop', immediateRender: false }, wt);
          tl.set(spans[i], { attr: { class: 'au-cap-word is-on' } }, P(wt));
          tl.set(spans[i], { attr: { class: 'au-cap-word is-said' } }, P(we));
        } else if (style === 'karaoke') {
          const span = Math.max(0.06, w.e - w.t);
          if (w.e <= 0.001) tl.set(spans[i], { '--fill': '100%' }, 0);
          else if (wt < 0) tl.fromTo(spans[i], { '--fill': Math.round((-wt / span) * 100) + '%' }, { '--fill': '100%', duration: w.e, ease: 'none', immediateRender: false }, 0);
          else tl.fromTo(spans[i], { '--fill': '0%' }, { '--fill': '100%', duration: span, ease: 'none', immediateRender: false }, wt);
        } else if (style === 'boxed') {
          tl.set(spans[i], { opacity: 0.45 }, 0);
          tl.to(spans[i], { opacity: 1, duration: 0.1 }, P(wt));
        } else if (style === 'typewriter') {
          tl.set(spans[i], { opacity: 0 }, 0);
          tl.set(spans[i], { opacity: 1 }, P(wt));
        }
      });
      const next = pages[pi + 1];
      const handoff = next && next.start - end < 0.06;
      if (end < D - 0.001) {
        if (handoff) tl.set(el, { autoAlpha: 0 }, end);
        else tl.to(el, { autoAlpha: 0, duration: Math.min(0.04, Math.max(0.02, end - P(start))), ease: 'none' }, Math.max(P(start), end - 0.04));
      }
    });
    const maxW = W * (portrait ? 0.86 : 0.82);
    const maxLines = { pop: portrait ? 3 : 2, karaoke: 3, boxed: 3, minimal: 3, typewriter: 3 }[style] || 3;
    host.querySelectorAll('.au-cap-page').forEach((page) => {
      const prev = { v: page.style.visibility, o: page.style.opacity };
      page.style.visibility = 'visible'; page.style.opacity = '1';
      let fs = parseFloat(getComputedStyle(page).fontSize);
      for (let k = 0; k < 10; k++) {
        let widest = 0;
        page.querySelectorAll('.au-cap-word').forEach((w) => { widest = Math.max(widest, w.getBoundingClientRect().width); });
        const lh = parseFloat(getComputedStyle(page).lineHeight) || fs * 1.15;
        const lines = Math.round(page.getBoundingClientRect().height / lh);
        if (widest <= maxW * 0.98 && lines <= maxLines) break;
        fs *= 0.9;
        page.style.fontSize = fs + 'px';
      }
      page.style.visibility = prev.v; page.style.opacity = prev.o;
    });
  }

  function captionBox(pad) {
    const host = document.getElementById('au-captions');
    const pages = host ? Array.from(host.querySelectorAll('.au-cap-page')) : [];
    if (!pages.length) return null;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    pages.forEach((el) => {
      const prev = { v: el.style.visibility, o: el.style.opacity, t: el.style.transform };
      el.style.visibility = 'visible'; el.style.opacity = '1'; el.style.transform = 'none';
      const r = el.getBoundingClientRect();
      el.style.visibility = prev.v; el.style.opacity = prev.o; el.style.transform = prev.t;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    });
    const p = pad == null ? Math.round(Math.min(W, H) * 0.05) : pad;
    const ev = (v) => Math.max(0, Math.floor(v / 2) * 2);
    const x = ev(x0 - p), y = ev(y0 - p);
    const w = Math.min(W - x, ev(x1 - x0 + 2 * p + 2)), h = Math.min(H - y, ev(y1 - y0 + 2 * p + 2));
    return { x, y, width: w, height: h };
  }

  async function captionTrack(times) {
    const out = [];
    for (const t of times) {
      await seek(t);
      const vis = [];
      $$('#au-captions .au-cap-page', document).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) return;
        vis.push({ cue: el.getAttribute('data-cue'), text: el.textContent.replace(/\s+/g, ' ').trim(), op: Math.round(parseFloat(cs.opacity) * 100) / 100 });
      });
      out.push({ t, visible: vis });
    }
    return out;
  }

  const ENTER = {
    fade: { from: { opacity: 0 }, ease: 'au.softLand' },
    rise: { from: { opacity: 0, y: 60 }, ease: 'au.softLand' },
    drop: { from: { opacity: 0, y: -60 }, ease: 'au.softLand' },
    slideLeft: { from: { opacity: 0, x: 120 }, ease: 'au.softLand' },
    slideRight: { from: { opacity: 0, x: -120 }, ease: 'au.softLand' },
    pop: { from: { opacity: 0, scale: 0.6 }, ease: 'au.pop' },
    zoom: { from: { opacity: 0, scale: 1.35 }, ease: 'au.softLand' },
    blur: { from: { opacity: 0, filter: 'blur(24px)', scale: 1.04 }, ease: 'au.softLand' },
    wipe: { from: { clipPath: 'inset(0 100% 0 0)' }, to: { clipPath: 'inset(0 0% 0 0)' }, ease: 'au.glide' },
    iris: { from: { clipPath: 'circle(0% at 50% 50%)' }, to: { clipPath: 'circle(75% at 50% 50%)' }, ease: 'au.glide' },
    spin: { from: { opacity: 0, rotation: -25, scale: 0.7 }, ease: 'au.pop' },
    none: null
  };
  const EXIT = {
    fade: { to: { opacity: 0 } }, sink: { to: { opacity: 0, y: 50 } }, lift: { to: { opacity: 0, y: -50 } },
    shrink: { to: { opacity: 0, scale: 0.7 } }, blur: { to: { opacity: 0, filter: 'blur(20px)' } },
    slideLeft: { to: { opacity: 0, x: -140 } }, slideRight: { to: { opacity: 0, x: 140 } }, wipe: { to: { clipPath: 'inset(0 0 0 100%)' } }, none: null
  };

  const KEY_EASE = {
    linear: (u) => u, in: (u) => u * u * u, out: (u) => 1 - Math.pow(1 - u, 3),
    inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    back: (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
    bounce: (u) => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) { u -= 1.5 / d; return n * u * u + 0.75; } if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + 0.9375; } u -= 2.625 / d; return n * u * u + 0.984375; },
    hold: () => 0
  };

  function layerKeys(L) {
    return (Array.isArray(L.keys) ? L.keys : []).filter((k) => k && isFinite(+k.t)).map((k) => ({
      t: clamp(+k.t, 0, D), dx: +k.dx || 0, dy: +k.dy || 0, scale: k.scale == null || !isFinite(+k.scale) ? 1 : +k.scale,
      rotate: +k.rotate || 0, opacity: k.opacity == null || !isFinite(+k.opacity) ? 1 : clamp(+k.opacity, 0, 1), ease: KEY_EASE[k.ease] ? k.ease : 'inOut'
    })).sort((a, b) => a.t - b.t);
  }

  function keyValue(keys, t) {
    if (t <= keys[0].t) return keys[0];
    const last = keys[keys.length - 1];
    if (t >= last.t) return last;
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1];
    const u = KEY_EASE[b.ease]((t - a.t) / Math.max(1e-4, b.t - a.t));
    return { dx: lerp(a.dx, b.dx, u), dy: lerp(a.dy, b.dy, u), scale: lerp(a.scale, b.scale, u), rotate: lerp(a.rotate, b.rotate, u), opacity: lerp(a.opacity, b.opacity, u) };
  }

  function keyMotion(wrap, L, pivot) {
    const keys = layerKeys(L);
    if (!keys.length) return;
    wrap.style.transformOrigin = pivot;
    const apply = (t) => {
      const v = keyValue(keys, t);
      wrap.style.transform = `translate(${(v.dx * W / 100).toFixed(2)}px, ${(v.dy * H / 100).toFixed(2)}px) rotate(${v.rotate.toFixed(3)}deg) scale(${v.scale.toFixed(4)})`;
      wrap.style.opacity = String(v.opacity);
    };
    onFrame(apply);
    apply(0);
  }

  function keyWrap(parent, L, z) {
    const wrap = make('div', 'au-ukeys', parent);
    css(wrap, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: z });
    return wrap;
  }

  function buildUserComponents() {
    const reg = window.AU_COMPONENTS;
    const root = document.querySelector('#au-scene .scene') || document.getElementById('au-scene');
    if (!reg || !root) return;
    (CFG.layers || []).forEach((L, i) => {
      if (L.hidden || L.kind !== 'component' || !L.component) return;
      if (!reg.has(L.component)) { errors.push('layer ' + (L.id || i) + ': unknown component ' + L.component); return; }
      const id = L.id || 'user-' + i;
      const before = new Set(Array.from(root.children));
      const params = Object.assign({}, L.params || {}, { layer: id });
      component(L.component, params);
      const wrap = keyWrap(root, L, L.z != null ? 20 + (+L.z || 0) : 'auto');
      wrap.setAttribute('data-user-comp', id);
      if (L.back) root.insertBefore(wrap, root.firstChild);
      Array.from(root.children).filter((n) => !before.has(n) && n !== wrap).forEach((n) => { wrap.appendChild(n); });
      const main = wrap.querySelector(`[data-layer="${CSS.escape(id)}"]`);
      if (main) { main.setAttribute('data-user', '1'); main.style.pointerEvents = 'auto'; }
      const start = clamp(L.start || 0, 0, D);
      const end = clamp(L.end ?? D, start + 0.1, D);
      if (start > 0.001) { tl.set(wrap, { autoAlpha: 0 }, 0); tl.set(wrap, { autoAlpha: 1 }, start); }
      if (end < D - 0.01) tl.set(wrap, { autoAlpha: 0 }, end);
      const px = params.x != null ? +params.x : 50, py = params.y != null ? +params.y : 50;
      keyMotion(wrap, L, `${px}% ${py}%`);
    });
  }

  function buildUserLayers() {
    const host = document.getElementById('au-user');
    if (!host) return;
    (CFG.layers || []).forEach((L, i) => {
      if (L.hidden || L.kind === 'component') return;
      const hasKeys = Array.isArray(L.keys) && L.keys.length > 0;
      const parent = hasKeys ? keyWrap(host, L, 10 + (L.z || i)) : host;
      const el = make('div', 'au-ulayer kind-' + (L.kind || 'text'), parent);
      if (hasKeys) el.style.pointerEvents = 'auto';
      el.setAttribute('data-layer', L.id || 'user-' + i);
      el.setAttribute('data-user', '1');
      css(el, {
        left: (L.x ?? 10) + '%', top: (L.y ?? 10) + '%', width: (L.w ?? 30) + '%', height: L.h != null ? L.h + '%' : 'auto',
        zIndex: 10 + (L.z || i), opacity: L.opacity ?? 1, rotate: (L.rotate || 0) + 'deg'
      });
      const s = L.style || {};
      if (L.kind === 'image' || L.kind === 'sticker') {
        el.innerHTML = `<img src="${asset(L.src)}" alt="" style="width:100%;height:100%;object-fit:${L.fit || 'contain'};border-radius:${s.radius || 0}px">`;
      } else if (L.kind === 'video') {
        el.innerHTML = `<video src="${asset(L.src)}" muted playsinline preload="auto" data-start="${L.start || 0}" style="width:100%;height:100%;object-fit:${L.fit || 'cover'};border-radius:${s.radius || 0}px"></video>`;
      } else if (L.kind === 'shape') {
        css(el, { background: s.bg || 'var(--accent)', borderRadius: (s.radius ?? 24) + (L.shape === 'circle' ? '%' : 'px'), border: s.border || 'none' });
        if (L.shape === 'circle') el.style.borderRadius = '50%';
      } else if (L.kind === 'icon') {
        el.innerHTML = icon(L.icon || 'sparkles', { size: '100%', stroke: s.stroke || 1.75, color: s.color || 'var(--accent)' });
        el.style.aspectRatio = '1';
      } else {
        el.textContent = L.text || 'Text';
        el.setAttribute('dir', 'auto');
        css(el, {
          fontFamily: !s.font ? 'var(--font-display)' : /^var\(|,/.test(String(s.font)) ? s.font : `'${String(s.font).replace(/['"]/g, '')}', var(--font-display)`, fontSize: (s.size || 64) + 'px', fontWeight: s.weight || 700,
          color: s.color || 'var(--ink)', textAlign: s.align || 'left', lineHeight: s.leading || 1.05,
          background: s.bg || 'transparent', padding: s.bg ? '0.25em 0.5em' : '0', borderRadius: (s.radius || 0) + 'px',
          letterSpacing: s.tracking || '-0.01em', textTransform: s.transform || 'none'
        });
        const fx = s.effect || 'none';
        const c = s.color || 'var(--ink)';
        if (fx === 'outline') css(el, { color: 'transparent', webkitTextStroke: `${Math.max(2, (s.size || 64) * 0.035)}px ${c}` });
        else if (fx === 'neon') css(el, { color: '#fff', textShadow: `0 0 0.08em #fff, 0 0 0.25em ${c}, 0 0 0.6em ${c}` });
        else if (fx === 'gradient') css(el, { backgroundImage: `linear-gradient(100deg, ${s.color || 'var(--accent)'}, ${s.color2 || 'var(--accent-2)'})`, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', padding: '0.05em 0' });
        else if (fx === 'shadow') css(el, { textShadow: `0.06em 0.06em 0 ${s.shadow || 'var(--accent)'}` });
        else if (fx === 'highlight') css(el, { background: s.bg || 'var(--accent)', color: s.color || 'var(--bg)', padding: '0.08em 0.3em', boxDecorationBreak: 'clone', webkitBoxDecorationBreak: 'clone' });
        else if (fx === 'glass') css(el, { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.35)', padding: '0.3em 0.6em', borderRadius: (s.radius || 18) + 'px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' });
        else if (fx === 'stroke-fill') css(el, { paintOrder: 'stroke fill', webkitTextStroke: `${Math.max(3, (s.size || 64) * 0.09)}px ${s.stroke || '#000'}` });
      }
      const start = clamp(L.start || 0, 0, D);
      const end = clamp(L.end ?? D, start + 0.1, D);
      const enterName = (L.enter && L.enter.preset) || L.enter || 'rise';
      const textFx = (L.kind === 'text') && ['chars', 'words', 'typewriter', 'scramble', 'bounce'].includes(enterName);
      const en = textFx ? null : ENTER[enterName];
      const ex = EXIT[(L.exit && L.exit.preset) || L.exit || 'none'];
      const ed = (L.enter && L.enter.duration) || 0.7;
      const xd = (L.exit && L.exit.duration) || 0.4;
      if (start > 0.001) {
        tl.set(el, { autoAlpha: 0 }, 0);
        tl.set(el, { autoAlpha: 1 }, start);
      }
      if (textFx) {
        if (enterName === 'typewriter') {
          const chars = split(el, { type: 'chars' }).chars;
          chars.forEach((ch, i) => { tl.set(ch, { opacity: 0 }, 0); tl.set(ch, { opacity: 1 }, start + i * Math.min(0.06, ed / Math.max(1, chars.length))); });
        } else if (enterName === 'scramble' && window.ScrambleTextPlugin) {
          const txt = el.textContent;
          tl.fromTo(el, { scrambleText: { text: '' } }, { duration: Math.max(0.6, ed * 1.4), scrambleText: { text: txt, chars: 'upperCase', revealDelay: 0.2 }, ease: 'none' }, start);
        } else if (enterName === 'words') {
          const words = split(el, { type: 'words' }).words;
          tl.from(words, { opacity: 0, y: 30, filter: 'blur(10px)', duration: 0.6, stagger: Math.min(0.12, ed / Math.max(1, words.length)), ease: 'au.softLand', immediateRender: false }, start);
        } else if (enterName === 'bounce') {
          const chars = split(el, { type: 'chars' }).chars;
          tl.from(chars, { yPercent: -120, opacity: 0, duration: 0.6, stagger: 0.035, ease: 'bounce.out', immediateRender: false }, start);
        } else {
          const sp = split(el, { type: 'chars,words' });
          tl.from(sp.chars, { yPercent: 90, opacity: 0, rotationX: -80, transformOrigin: '50% 100%', duration: 0.55, stagger: Math.min(0.035, ed / Math.max(1, sp.chars.length)), ease: 'au.softLand', immediateRender: false }, start);
        }
      }
      if (en) {
        if (en.to) tl.fromTo(el, en.from, Object.assign({}, en.to, { duration: ed, ease: en.ease }), start);
        else tl.from(el, Object.assign({}, en.from, { duration: ed, ease: en.ease, immediateRender: false }), start);
      }
      const emph = L.emphasis || 'none';
      if (emph !== 'none') {
        const period = 2.4;
        const reps = Math.max(1, Math.floor((end - start - ed) / (period / 2)));
        const props = emph === 'pulse' ? { scale: 1.05 } : emph === 'float' ? { y: -14 } : emph === 'spin' ? { rotation: 360 } : { rotation: 3 };
        tl.to(el, Object.assign(props, { duration: emph === 'spin' ? (end - start) : period / 2, ease: emph === 'spin' ? 'none' : 'sine.inOut', repeat: emph === 'spin' ? 0 : reps, yoyo: emph !== 'spin' }), start + ed);
      }
      if (ex && end < D - 0.05) tl.to(el, Object.assign({}, ex.to, { duration: xd, ease: 'au.exit' }), end - xd);
      if (end < D - 0.01) tl.set(el, { autoAlpha: 0 }, end);
      if (hasKeys) keyMotion(parent, L, `${(L.x ?? 10) + (L.w ?? 30) / 2}% ${(L.y ?? 10) + (L.h ?? 10) / 2}%`);
    });
  }

  function buildGround() {
    const ground = document.getElementById('au-ground');
    if (!ground) return;
    const kind = CFG.ground || 'paper';
    ground.className = 'au-ground ground-' + kind;
    if (kind === 'mesh' || kind === 'aurora') {
      const blobs = [0, 1, 2, 3].map((i) => make('div', 'au-blob b' + i, ground));
      blobs.forEach((b, i) => {
        tl.fromTo(b, { xPercent: -20 + i * 10, yPercent: -10 + i * 6, scale: 1 }, { xPercent: 20 - i * 12, yPercent: 14 - i * 5, scale: 1.25 - i * 0.05, duration: D, ease: 'sine.inOut' }, 0);
      });
    } else if (kind === 'grid' || kind === 'blueprint' || kind === 'dots') {
      const pane = make('div', 'au-grid-pane', ground);
      tl.fromTo(pane, { backgroundPosition: '0px 0px' }, { backgroundPosition: `${-W * 0.03}px ${-H * 0.02}px`, duration: D, ease: 'none' }, 0);
    } else if (kind === 'stars') {
      const c = make('canvas', 'au-ground-canvas', ground);
      css(c, { width: '100%', height: '100%' });
      particles(c, { count: 140, kind: 'stars', color: '#ffffff', size: [0.6, 2.2], opacity: [0.2, 0.9], speed: 0.2 });
    } else if (kind === 'spotlight' || kind === 'paper' || kind === 'solid' || kind === 'halftone' || kind === 'scanlines' || kind === 'clay') {
      const light = make('div', 'au-light', ground);
      tl.fromTo(light, { xPercent: -8, yPercent: -6, opacity: 0.85 }, { xPercent: 8, yPercent: 5, opacity: 1, duration: D, ease: 'sine.inOut' }, 0);
    }
    const texture = CFG.texture || 'grain';
    if (texture !== 'none') {
      const tex = document.getElementById('au-texture');
      if (tex) {
        tex.className = 'au-texture tex-' + texture;
        if (texture === 'grain') {
          const c = make('canvas', '', tex);
          c.width = 256; c.height = 256;
          const cx = c.getContext('2d');
          const r = mulberry(CFG.seed + 991);
          const img = cx.createImageData(256, 256);
          for (let i = 0; i < img.data.length; i += 4) { const v = Math.floor(r() * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
          cx.putImageData(img, 0, 0);
          tex.style.backgroundImage = `url(${c.toDataURL()})`;
          c.remove();
          onFrame((t) => {
            const k = Math.floor(t * 12);
            const rr = mulberry(k + 7);
            tex.style.backgroundPosition = `${Math.floor(rr() * 256)}px ${Math.floor(rr() * 256)}px`;
          });
        }
      }
    }
  }

  function applyOverrides(phase) {
    const ov = CFG.overrides || {};
    Object.entries(ov).forEach(([id, o]) => {
      const el = document.querySelector(`#au-scene [data-layer="${CSS.escape(id)}"]`);
      if (!el || !o) return;
      if (phase === 'pre') {
        if (o.text != null) el.textContent = o.text;
        if (o.html != null) el.innerHTML = o.html;
        return;
      }
      setOverride(el, o);
    });
  }

  function setOverride(el, o) {
    const st = overrideState.get(el) || { dx: 0, dy: 0 };
    if (o.dx != null) st.dx = o.dx;
    if (o.dy != null) st.dy = o.dy;
    overrideState.set(el, st);
    applyTranslate(el);
    if (o.scale != null) el.style.scale = String(o.scale);
    if (o.rotate != null) el.style.rotate = o.rotate + 'deg';
    if (o.opacity != null) el.style.filter = `opacity(${o.opacity})`;
    if (o.hidden != null) el.style.visibility = o.hidden ? 'hidden' : '';
    if (o.z != null) { el.style.zIndex = String(o.z); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
    if (o.color) el.style.setProperty('color', o.color, 'important');
    if (o.fontSize) el.style.setProperty('font-size', o.fontSize + 'px', 'important');
  }

  function autoTag() {
    const w = world();
    if (!w) return;
    let n = 0;
    const root = w.querySelector('.scene') || w;
    Array.from(root.children).forEach((el) => {
      if (!el.hasAttribute('data-layer') && !el.classList.contains('au-ukeys') && !/^(STYLE|SCRIPT)$/.test(el.tagName)) el.setAttribute('data-layer', 'auto-' + (n++));
    });
    $$('[data-depth]').forEach((el) => parallax.push(el));
  }

  function sampleText() {
    const seen = new Set();
    const walk = (v) => {
      if (typeof v === 'string') { for (const ch of v) if (seen.size < 3000) seen.add(ch); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk([CFG.data, (CFG.cues || []).map((c) => c.text), (CFG.layers || []).map((l) => l.text)]);
    const st = document.getElementById('au-stage');
    if (st) walk(st.textContent || '');
    return Array.from(seen).join('') + 'Aa0';
  }

  async function waitAssets() {
    try { await document.fonts.ready; } catch (e) { }
    const sample = sampleText();
    const rs = getComputedStyle(document.documentElement);
    const stacks = ['--font-display', '--font-body', '--font-caption'].map((v) => rs.getPropertyValue(v).trim()).filter(Boolean);
    await Promise.all(stacks.flatMap((stack) => ['400', '700', '800'].map((wt) => document.fonts.load(`${wt} 40px ${stack}`, sample).catch(() => null))));
    const fams = new Set();
    $$('*', document.getElementById('au-stage') || document).slice(0, 400).forEach((el) => {
      const f = getComputedStyle(el).fontFamily;
      if (f) fams.add(f.split(',')[0].trim().replace(/["']/g, ''));
    });
    const rootStyle = getComputedStyle(document.documentElement);
    ['--font-display', '--font-body', '--font-mono', '--font-caption'].forEach((v) => {
      const f = rootStyle.getPropertyValue(v);
      if (f) f.split(',').slice(0, 2).forEach((x) => { const n = x.trim().replace(/["']/g, ''); if (n && !/^(serif|sans-serif|monospace|cursive|system-ui)$/.test(n)) fams.add(n); });
    });
    await Promise.all([...fams].map((f) => Promise.all(['400', '700', '800'].map((wt) => document.fonts.load(`${wt} 32px "${f}"`).catch(() => null)))));
    try { await document.fonts.ready; } catch (e) { }
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((im) => (im.complete ? (im.decode ? im.decode().catch(() => null) : null) : new Promise((r) => { im.onload = im.onerror = () => r(); }))));
    const vids = Array.from(document.querySelectorAll('video'));
    await Promise.all(vids.map((v) => (v.readyState >= 2 ? null : new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', r, { once: true }); setTimeout(r, 8000); }))));
  }

  function absorbStrays(t0) {
    const kids = g.globalTimeline.getChildren(false, true, true);
    kids.forEach((child) => {
      if (child === tl) return;
      const start = child.startTime() - t0;
      g.globalTimeline.remove(child);
      tl.add(child, Math.max(0, start));
    });
  }

  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  async function boot() {
    if (built) return ready;
    built = true;
    document.documentElement.style.setProperty('--W', W + 'px');
    document.documentElement.style.setProperty('--H', H + 'px');
    document.documentElement.style.setProperty('--safe-x', safe.x + 'px');
    document.documentElement.style.setProperty('--safe-y', safe.y + 'px');
    document.documentElement.style.setProperty('--safe-w', safe.w + 'px');
    document.documentElement.style.setProperty('--safe-h', safe.h + 'px');
    document.body.classList.add(portrait ? 'is-portrait' : (W === H ? 'is-square' : 'is-landscape'), 'mode-' + CFG.mode);
    const allText = sampleText();
    if (CFG.rtl || RX.rtl.test(allText)) document.body.classList.add('script-rtl');
    if (CFG.complex || RX.complex.test(allText)) document.body.classList.add('script-complex');
    if (CFG.cjk || RX.cjk.test(allText)) document.body.classList.add('script-cjk');
    if (CFG.captionsOn) document.body.classList.add('has-captions');
    document.documentElement.lang = LANG;
    await waitAssets();
    tl = g.timeline({ paused: true, defaults: { ease: 'au.softLand', lazy: false } });
    const POS = { to: 2, from: 2, fromTo: 3, set: 2, add: 1, call: 2 };
    Object.entries(POS).forEach(([m, i]) => {
      const orig = tl[m].bind(tl);
      tl[m] = (...args) => { if (typeof args[i] === 'number' && args[i] < 0) args[i] = 0; return orig(...args); };
    });
    const t0 = g.globalTimeline.time();
    applyOverrides('pre');
    autoFit();
    buildGround();
    const ctx = {
      tl, W, H, D, fps: CFG.fps, seed: CFG.seed, rand: rng, pick, range, clamp, lerp, theme: CFG.theme, cues: CFG.cues, data: CFG.data || {},
      assets: CFG.assets, safe, portrait, $, $$, icon, split, counter, draw, rough, camera, chart, math, typewrite, scramble, onFrame, particles, ambient, fit, asset, three, cssColor,
      index: CFG.sceneIndex, globalStart: CFG.globalStart, component, defer, interpolate, spring, make, css,
      ones: (d) => 'steps(' + Math.max(1, Math.round(d * 24)) + ')', twos: (d) => 'steps(' + Math.max(1, Math.round(d * 12)) + ')', threes: (d) => 'steps(' + Math.max(1, Math.round(d * 8)) + ')',
      held: (t, on) => Math.floor(t * 24 / (on || 2) + 1e-6) / (24 / (on || 2)),
      dip: (at, color, inDur, outDur) => {
        const host = document.querySelector('#au-scene .scene') || document.getElementById('au-scene');
        if (!host) return null;
        const el = make('div', 'au-dip', host);
        css(el, { position: 'absolute', inset: '0', background: cssColor(color || 'var(--ink)'), opacity: 0, zIndex: 900, pointerEvents: 'none' });
        el.setAttribute('data-layer', 'dip-' + Math.round(at * 100));
        const a = inDur == null ? 0.25 : inDur, b = outDur == null ? 0.35 : outDur;
        if (at - a > 0) tl.to(el, { opacity: 1, duration: a, ease: 'power2.in' }, at - a); else tl.set(el, { opacity: 1 }, 0);
        if (at + 0.05 < D) tl.to(el, { opacity: 0, duration: b, ease: 'power2.out' }, at + 0.05);
        return el;
      }
    };
    currentCtx = ctx;
    try { if (sceneFn) sceneFn(ctx); } catch (e) { errors.push('scene: ' + (e && e.message || e)); console.error(e); }
    try { buildUserComponents(); } catch (e) { errors.push('component layers: ' + e.message); }
    try { if (CFG.lens && CFG.lens.type && CFG.lens.type !== 'none' && !window.__AU_LENS_USED) component('lens', CFG.lens); } catch (e) { errors.push('lens: ' + e.message); }
    try { sceneCamera(CFG.camera); } catch (e) { errors.push('camera: ' + e.message); }
    for (let guard = 0; pending.length && guard < 4; guard++) {
      const batch = pending.splice(0, pending.length);
      await Promise.race([Promise.all(batch), new Promise((r) => setTimeout(r, 20000))]);
    }
    try { autoFit(); } catch (e) { errors.push('fit: ' + e.message); }
    try { absorbStrays(t0); } catch (e) { errors.push('strays: ' + e.message); }
    autoTag();
    try { buildUserLayers(); } catch (e) { errors.push('layers: ' + e.message); }
    try { buildCaptions(); } catch (e) { errors.push('captions: ' + e.message); }
    applyOverrides('post');
    if (tl.duration() < D) tl.set({}, {}, D);
    const steps = Math.max(8, Math.ceil(D * 4));
    for (let i = 1; i <= steps; i++) tl.seek(D * i / steps, false);
    tl.seek(0, false);
    window.__AU_READY = true;
    await seek(0);
    readyResolve(true);
    return ready;
  }

  function seekVideos(t) {
    const vids = Array.from(document.querySelectorAll('video'));
    const waits = [];
    vids.forEach((v) => {
      const start = parseFloat(v.getAttribute('data-start') || '0');
      const offset = parseFloat(v.getAttribute('data-offset') || '0');
      let local = Math.max(0, t - start + offset);
      if (v.duration && isFinite(v.duration)) local = v.loop || v.hasAttribute('data-loop') ? local % v.duration : Math.min(local, v.duration - 0.04);
      if (playing && !v.paused && Math.abs(v.currentTime - local) < 0.25) return;
      if (Math.abs(v.currentTime - local) < 0.5 / CFG.fps) return;
      waits.push(new Promise((r) => {
        const done = () => { v.removeEventListener('seeked', done); r(); };
        v.addEventListener('seeked', done);
        setTimeout(done, 1500);
        v.currentTime = local;
      }));
    });
    return waits.length ? Promise.all(waits) : null;
  }

  function seek(t) {
    if (!tl) return Promise.resolve();
    current = clamp(t, 0, D);
    tl.seek(current, false);
    tl.seek(current, false);
    document.getAnimations().forEach((a) => { try { a.pause(); a.currentTime = current * 1000; } catch (e) { } });
    const hookWaits = [];
    for (let i = 0; i < frameHooks.length; i++) {
      try {
        const r = frameHooks[i](current, ctxLite);
        if (r && typeof r.then === 'function' && !playing) hookWaits.push(Promise.race([r.catch((e) => { if (errors.length < 50) errors.push('frame: ' + (e && e.message || e)); }), new Promise((res) => setTimeout(res, 15000))]));
      } catch (e) { if (errors.length < 50) errors.push('frame: ' + e.message); }
    }
    const v = seekVideos(current);
    if (v) hookWaits.push(v);
    return hookWaits.length ? Promise.all(hookWaits).then(() => current) : Promise.resolve(current);
  }
  const ctxLite = { W, H, D, get t() { return current; } };

  function play(opts) {
    const o = Object.assign({ from: current, rate: 1, loop: false, onTime: null, onEnd: null }, opts || {});
    pause();
    playing = true;
    const startWall = performance.now();
    const startT = o.from >= D - 0.01 ? 0 : o.from;
    document.querySelectorAll('video').forEach((v) => { v.play().catch(() => null); });
    const step = () => {
      if (!playing) return;
      let t = startT + (performance.now() - startWall) / 1000 * o.rate;
      if (t >= D) {
        if (o.loop) { play(Object.assign({}, o, { from: 0 })); return; }
        seek(D); playing = false; document.querySelectorAll('video').forEach((v) => v.pause());
        if (o.onTime) o.onTime(D);
        if (o.onEnd) o.onEnd();
        return;
      }
      seek(t);
      if (o.onTime) o.onTime(t);
      playHandle = requestAnimationFrame(step);
    };
    playHandle = requestAnimationFrame(step);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(playHandle);
    document.querySelectorAll('video').forEach((v) => v.pause());
  }

  function layers() {
    const st = stage();
    if (!st) return [];
    const base = st.getBoundingClientRect();
    const sx = W / base.width, sy = H / base.height;
    return $$('[data-layer]', st).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        id: el.getAttribute('data-layer'), user: el.hasAttribute('data-user'), tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 80),
        x: (r.left - base.left) * sx, y: (r.top - base.top) * sy, w: r.width * sx, h: r.height * sy,
        visible: cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.02 && r.width > 0 && r.height > 0,
        caption: el.closest('#au-captions') != null
      };
    });
  }

  function override(id, patch) {
    const el = document.querySelector(`[data-layer="${CSS.escape(id)}"]`);
    if (!el) return false;
    if (el.hasAttribute('data-user')) {
      if (patch.x != null) el.style.left = patch.x + '%';
      if (patch.y != null) el.style.top = patch.y + '%';
      if (patch.w != null) el.style.width = patch.w + '%';
      if (patch.h != null) el.style.height = patch.h + '%';
      if (patch.rotate != null) el.style.rotate = patch.rotate + 'deg';
      return true;
    }
    setOverride(el, patch);
    return true;
  }

  function contrastOf(el) {
    const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : [0, 0, 0, 1]; };
    const lum = ([r, g2, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g2) + 0.0722 * f(b); };
    const fg = parse(getComputedStyle(el).color);
    let node = el, bg = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c[3] === undefined || c[3] > 0.5) { if (getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)') { bg = c; break; } }
      node = node.parentElement;
    }
    if (!bg) bg = parse(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().replace('#', '').length === 6 ? hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()) : 'rgb(255,255,255)');
    const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  function hexToRgb(h) { const v = h.replace('#', ''); return `rgb(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)})`; }

  function actorFaces() {
    const out = [];
    $$('#au-scene .auc-toon').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') return;
      out.push({ id: el.getAttribute('data-layer') || 'toon', face: [r.left + r.width * 0.22, r.top + r.height * 0.06, r.width * 0.56, r.height * 0.28], top: r.top, x: r.left + r.width / 2 });
    });
    $$('#au-scene .auc-stickman').forEach((el) => {
      const c = el.querySelector('.sm-root circle');
      if (!c || getComputedStyle(el).visibility === 'hidden') return;
      const r = c.getBoundingClientRect();
      out.push({ id: el.getAttribute('data-layer') || 'stickman', face: [r.left, r.top, r.width, r.height], top: r.top, x: r.left + r.width / 2 });
    });
    $$('#au-scene .auc-animal').forEach((el) => {
      const g = el.querySelector('.an-root');
      if (!g || getComputedStyle(el).visibility === 'hidden') return;
      const r = g.getBoundingClientRect();
      const left = el.getAttribute('data-facing') === 'left';
      out.push({ id: el.getAttribute('data-layer') || 'animal', face: left ? [r.left, r.top, r.width * 0.55, r.height * 0.6] : [r.left + r.width * 0.45, r.top, r.width * 0.55, r.height * 0.6],
        top: r.top, x: left ? r.left + r.width * 0.3 : r.left + r.width * 0.7 });
    });
    $$('#au-scene .auc-world3d').forEach((el) => {
      if (getComputedStyle(el).visibility === 'hidden' || el.style.opacity === '0') return;
      Object.entries(el.__auActors || {}).forEach(([id, a]) => out.push(Object.assign({ id }, a)));
    });
    return out;
  }

  function actorRect(id) {
    const faces = actorFaces();
    return faces.find((f) => f.id === id) || null;
  }

  function typeScale() {
    const cs = getComputedStyle(document.documentElement);
    return ['--fs-hero', '--fs-xl', '--fs-lg', '--fs-md', '--fs-sm', '--fs-min'].map((k) => parseFloat(cs.getPropertyValue(k))).filter((v) => v > 0);
  }

  async function probe(times) {
    const st = stage();
    const out = { errors: errors.slice(), frames: [], duration: D, layers: 0, textNodes: 0, minFont: null };
    const minFontPx = Math.min(W, H) * 0.026;
    for (const t of times) {
      await seek(t);
      const issues = [];
      const texts = [];
      const seen = new Set();
      const report = (kind, owner, extra) => {
        const key = kind + '|' + (owner.getAttribute('data-layer') || owner.className || owner.tagName);
        if (seen.has(key)) return;
        seen.add(key);
        issues.push(Object.assign({ kind, layer: owner.getAttribute('data-layer') || '', text: (owner.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) }, extra || {}));
      };
      $$('#au-scene *', document).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        let op = 1, n = el;
        while (n && n.id !== 'au-stage') { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
        if (op < 0.35) return;
        const ownText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim().length > 0);
        const owner = el.closest('#au-scene [data-layer]') || el;
        if (ownText && !el.closest('.katex')) {
          const fs = parseFloat(cs.fontSize) * (r.height / Math.max(1, el.offsetHeight || r.height));
          texts.push({ el, owner, r, fs, text: (owner.textContent || '').trim().slice(0, 40) });
          if (fs < minFontPx && el.textContent.trim().length > 2) report('tiny-text', owner, { size: Math.round(fs) });
          if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.whiteSpace === 'nowrap') report('overflow', owner);
          if (op > 0.9 && t > 0.3) {
            const c = contrastOf(el);
            if (c < 3) report('low-contrast', owner, { ratio: Math.round(c * 10) / 10 });
          }
        }
        const offstage = el.hasAttribute('data-allow-offstage') || el.closest('[data-allow-offstage]');
        if (!offstage && ownText && (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H)) return;
        if (!offstage && ownText && (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2)) report('off-canvas', owner, { rect: [r.left, r.top, r.width, r.height].map(Math.round) });
        else if (!offstage && ownText && (r.left < safe.x * 0.6 || r.right > W - safe.x * 0.6 || r.top < safe.y * 0.5 || r.bottom > H - safe.y * 0.5)) report('outside-safe', owner);
      });
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i], b = texts[j];
          if (a.owner === b.owner || a.el.contains(b.el) || b.el.contains(a.el) || a.owner.contains(b.owner) || b.owner.contains(a.owner)) continue;
          if (seen.has('overlap|' + a.text + '|' + b.text)) continue;
          const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
          const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
          const area = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
          if (area > 0 && ix * iy / area > 0.25) { seen.add('overlap|' + a.text + '|' + b.text); issues.push({ kind: 'text-overlap', a: a.text, b: b.text, layer: a.owner.getAttribute('data-layer') || '' }); }
        }
      }
      const visibleBox = (node) => {
        let n = node, depth = 0;
        while (n && n.id !== 'au-scene' && depth < 5) {
          const cs = getComputedStyle(n);
          const bg = cs.backgroundColor;
          const filled = (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
          if (filled) {
            const r = n.getBoundingClientRect();
            if (r.width * r.height < W * H * 0.6) return { el: n, r };
            return null;
          }
          n = n.parentElement; depth++;
        }
        return null;
      };
      texts.forEach((x) => {
        if (x.el.closest('.katex')) return;
        const b = visibleBox(x.el);
        if (!b) return;
        let tr;
        try { const range = document.createRange(); range.selectNodeContents(x.el); tr = range.getBoundingClientRect(); } catch (e) { return; }
        if (!tr || tr.width < 2) return;
        const over = Math.max(b.r.left - tr.left, tr.right - b.r.right, b.r.top - tr.top, tr.bottom - b.r.bottom);
        if (over > Math.max(4, x.fs * 0.15)) report('text-outside-box', x.owner, { size: Math.round(over) });
      });
      const faces = actorFaces();
      const scale = typeScale();
      const bodies = $$('#au-scene .auc-toon').filter((el) => getComputedStyle(el).visibility !== 'hidden').map((el) => el.getBoundingClientRect().height);
      if (bodies.length && t > 0.4 && Math.max(...bodies) < H * 0.26) issues.push({ kind: 'tiny-actor', layer: '', text: 'characters', size: Math.round(Math.max(...bodies) / H * 100) });
      const hero = scale.length ? Math.max(...scale) : H * 0.2;
      texts.forEach((x) => {
        if (x.el.closest('.auc-speech') || x.el.closest('.auc-toon') || x.el.closest('.auc-stickman') || x.el.closest('.auc-animal')) return;
        faces.forEach((f) => {
          const [fx, fy, fw, fh] = f.face;
          const ix = Math.max(0, Math.min(x.r.right, fx + fw) - Math.max(x.r.left, fx));
          const iy = Math.max(0, Math.min(x.r.bottom, fy + fh) - Math.max(x.r.top, fy));
          if (fw * fh > 0 && ix * iy / (fw * fh) > 0.18) report('text-over-face', x.owner, { actor: f.id });
        });
        if (x.fs > hero * 1.18 && x.text.length > 1) report('oversized-text', x.owner, { size: Math.round(x.fs) });
        else if (scale.length && x.fs >= Math.min(...scale) && x.text.length > 2) {
          const near = scale.reduce((m, v) => Math.min(m, Math.abs(Math.log(x.fs / v))), 9);
          if (near > Math.log(1.16)) report('off-scale-text', x.owner, { size: Math.round(x.fs) });
        }
      });
      out.textNodes = Math.max(out.textNodes, texts.length);
      texts.forEach((x) => { out.minFont = out.minFont == null ? x.fs : Math.min(out.minFont, x.fs); });
      out.frames.push({ t, issues: issues.slice(0, 12), texts: texts.length });
    }
    out.layers = $$('[data-layer]', st).length;
    out.errors = errors.slice();
    if (out.minFont != null) out.minFont = Math.round(out.minFont);
    return out;
  }

  window.AU_ACTOR = actorRect;
  window.AU = {
    config: CFG, W, H, D, safe, portrait, ready, errors,
    scene(fn) { sceneFn = fn; },
    boot, seek, play, pause, layers, override, probe, captionTrack, captionBox, component, defer, interpolate, spring,
    icon, split, counter, draw, rough, camera, chart, math, typewrite, scramble, onFrame, particles, ambient, fit, asset, three, cssColor,
    get time() { return current; }, get timeline() { return tl; }, get playing() { return playing; }
  };
})();
