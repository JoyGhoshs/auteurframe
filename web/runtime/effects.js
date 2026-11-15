(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const { define } = reg;

  const FX = ['light-leak', 'film-grain', 'vhs', 'glitch', 'old-film', 'scanlines', 'vignette', 'flash', 'light-rays', 'sparkles', 'confetti', 'rain', 'snow',
    'embers', 'bokeh', 'stars', 'dust', 'lens-flare', 'camera-shake', 'zoom-punch', 'hud', 'halftone', 'letterbox', 'rgb-split'];

  function full(ctx, h, p, cls, z) {
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), cls, { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { height: '100%', pointerEvents: 'none', zIndex: String(z == null ? 60 : z), overflow: 'hidden' });
    return el;
  }

  function mul(seed) {
    let a = seed >>> 0;
    return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function canvasIn(ctx, el, scale) {
    const c = document.createElement('canvas');
    c.width = Math.round(ctx.W * (scale || 1));
    c.height = Math.round(ctx.H * (scale || 1));
    Object.assign(c.style, { width: '100%', height: '100%', display: 'block', position: 'absolute', inset: '0' });
    el.appendChild(c);
    return c;
  }

  function visible(ctx, el, at, end, fade) {
    const f = fade == null ? 0.4 : fade;
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.to(el, { autoAlpha: 1, duration: Math.max(0.01, f), ease: 'none' }, at);
    if (end < ctx.D - 0.02) ctx.tl.to(el, { autoAlpha: 0, duration: Math.max(0.01, f), ease: 'none' }, Math.max(at, end - f));
  }

  define('fx', {
    category: 'effects',
    description: 'Overlay effects for the whole frame: light leaks, film grain, VHS, glitch, old film, CRT scanlines, vignette, flash, light rays, sparkles, confetti, rain, snow, embers, bokeh, stars, dust, lens flare, camera shake, zoom punch, HUD frame, halftone, letterbox bars and RGB split. Deterministic per frame.',
    params: {
      kind: { type: 'enum', default: 'light-leak', options: FX },
      intensity: { type: 'number', default: 1, doc: '0.2 subtle to 2 strong' },
      color: { type: 'string', default: '', doc: 'tint colour for light leak, flash, rays, sparkles, HUD (hex or --var)' }
    },
    example: "component('fx', { kind: 'light-leak', at: 0, intensity: 1 })"
  }, (ctx, p, h) => {
    const { at, end } = h.span(p);
    const k = Math.max(0.1, Math.min(3, +p.intensity || 1));
    const tint = h.color(p.color, '');
    const r = mul((ctx.seed || 1) * 131 + FX.indexOf(p.kind) * 977 + Math.round(at * 100));
    const kind = FX.includes(p.kind) ? p.kind : 'light-leak';
    const local = (t) => t - at;
    const live = (t) => t >= at && t <= end;

    if (kind === 'camera-shake' || kind === 'zoom-punch') {
      const target = document.getElementById('au-scene');
      const dur = p.duration == null ? (kind === 'camera-shake' ? 0.8 : 0.5) : Math.max(0.1, +p.duration);
      ctx.onFrame((t) => {
        if (!target) return;
        const u = (t - at) / dur;
        if (u < 0 || u > 1) { target.style.translate = ''; target.style.scale = ''; return; }
        if (kind === 'camera-shake') {
          const amp = 14 * k * (1 - u) * (1 - u);
          const f = Math.floor((t - at) * 30);
          const rr = mul(f * 7919 + 13);
          target.style.translate = `${((rr() - 0.5) * 2 * amp).toFixed(2)}px ${((rr() - 0.5) * 2 * amp).toFixed(2)}px`;
        } else {
          const s = 1 + 0.12 * k * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u * 0.3);
          target.style.scale = s.toFixed(4);
        }
      });
      return { end: Math.min(ctx.D, at + dur) };
    }

    if (kind === 'flash') {
      const el = full(ctx, h, p, 'auc-fx fx-flash', 80);
      el.style.background = tint || '#fff';
      const dur = p.duration == null ? 0.45 : Math.max(0.1, +p.duration);
      ctx.tl.set(el, { autoAlpha: 0 }, 0);
      ctx.tl.to(el, { autoAlpha: Math.min(1, 0.95 * k), duration: 0.06, ease: 'none' }, at);
      ctx.tl.to(el, { autoAlpha: 0, duration: dur, ease: 'power2.out' }, at + 0.06);
      return { el, end: at + dur };
    }

    if (['snow', 'embers', 'bokeh', 'stars', 'dust'].includes(kind)) {
      const el = full(ctx, h, p, 'auc-fx fx-particles', kind === 'bokeh' || kind === 'stars' ? 2 : 55);
      const c = canvasIn(ctx, el, 1);
      ctx.particles(c, { kind, count: Math.round((kind === 'bokeh' ? 40 : kind === 'stars' ? 160 : 110) * k), speed: 1 });
      visible(ctx, el, at, end, 0.6);
      return { el, end };
    }

    const el = full(ctx, h, p, 'auc-fx fx-' + kind, kind === 'letterbox' || kind === 'hud' ? 70 : 60);
    visible(ctx, el, at, end, kind === 'letterbox' ? 0.01 : 0.35);

    if (kind === 'light-leak') {
      const cols = tint ? [tint, tint] : ['rgba(255,140,60,0.9)', 'rgba(255,60,120,0.75)', 'rgba(255,210,120,0.8)'];
      const blobs = cols.map((c, i) => {
        const b = document.createElement('div');
        Object.assign(b.style, { position: 'absolute', width: '70%', height: '90%', borderRadius: '50%', background: `radial-gradient(closest-side, ${c}, transparent)`, mixBlendMode: 'screen', filter: 'blur(30px)' });
        el.appendChild(b);
        return { b, ph: r() * 6.28, sp: 0.15 + r() * 0.2, side: i % 2 };
      });
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const u = local(t);
        blobs.forEach((o, i) => {
          const x = (o.side ? 55 : -25) + Math.sin(u * o.sp + o.ph) * 18;
          const y = -20 + i * 25 + Math.cos(u * o.sp * 0.8 + o.ph) * 12;
          o.b.style.left = x + '%'; o.b.style.top = y + '%';
          o.b.style.opacity = String(Math.min(1, (0.45 + 0.35 * Math.sin(u * 0.9 + o.ph)) * k));
        });
      });
    } else if (kind === 'film-grain' || kind === 'old-film') {
      const c = canvasIn(ctx, el, 0.35);
      const g = c.getContext('2d');
      el.style.mixBlendMode = kind === 'old-film' ? 'multiply' : 'overlay';
      if (kind === 'old-film') {
        const tone = document.createElement('div');
        Object.assign(tone.style, { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse at center, rgba(255,236,200,0.25), rgba(60,40,20,0.65))', mixBlendMode: 'multiply' });
        el.appendChild(tone);
      }
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const f = Math.floor(t * 24);
        const rr = mul(f * 2654435761 + 7);
        const img = g.createImageData(c.width, c.height);
        const amt = (kind === 'old-film' ? 70 : 55) * k;
        for (let i = 0; i < img.data.length; i += 4) {
          const v = 128 + (rr() - 0.5) * amt * 2;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = kind === 'old-film' ? 60 : 90;
        }
        g.putImageData(img, 0, 0);
        if (kind === 'old-film') {
          g.strokeStyle = 'rgba(30,20,10,0.55)';
          for (let s = 0; s < 3; s++) {
            if (rr() < 0.55) { const x = rr() * c.width; g.lineWidth = 0.6 + rr(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rr() - 0.5) * 6, c.height); g.stroke(); }
          }
          g.fillStyle = 'rgba(20,10,5,0.6)';
          for (let s = 0; s < 6; s++) { g.beginPath(); g.arc(rr() * c.width, rr() * c.height, rr() * 2.2, 0, 6.29); g.fill(); }
          el.style.opacity = String(0.85 + 0.15 * rr());
        }
      });
    } else if (kind === 'vhs' || kind === 'scanlines') {
      const lines = document.createElement('div');
      Object.assign(lines.style, { position: 'absolute', inset: '0', background: `repeating-linear-gradient(0deg, rgba(0,0,0,${0.22 * k}) 0 2px, transparent 2px 4px)` });
      el.appendChild(lines);
      const vig = document.createElement('div');
      Object.assign(vig.style, { position: 'absolute', inset: '0', background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55))' });
      el.appendChild(vig);
      const band = document.createElement('div');
      Object.assign(band.style, { position: 'absolute', left: '0', right: '0', height: '9%', background: 'linear-gradient(transparent, rgba(255,255,255,0.12), transparent)', mixBlendMode: 'screen' });
      el.appendChild(band);
      let stamp = null;
      if (kind === 'vhs') {
        stamp = document.createElement('div');
        Object.assign(stamp.style, { position: 'absolute', left: '5%', top: '6%', font: `700 ${Math.round(ctx.H * 0.045)}px monospace`, color: '#fff', textShadow: '2px 0 #f0f, -2px 0 #0ff', letterSpacing: '0.05em' });
        stamp.textContent = 'PLAY ▶';
        el.appendChild(stamp);
        const date = document.createElement('div');
        Object.assign(date.style, { position: 'absolute', right: '5%', bottom: '7%', font: `700 ${Math.round(ctx.H * 0.04)}px monospace`, color: '#fff', textShadow: '2px 0 #f0f, -2px 0 #0ff' });
        date.textContent = 'AM 12:00  JAN. 01 1996';
        el.appendChild(date);
      }
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const u = local(t);
        band.style.top = ((u * 22) % 120 - 10) + '%';
        if (stamp) stamp.style.opacity = Math.floor(u * 2) % 2 ? '1' : '0.25';
        el.style.filter = kind === 'vhs' && Math.floor(t * 24) % 37 === 0 ? 'hue-rotate(25deg)' : '';
      });
    } else if (kind === 'glitch' || kind === 'rgb-split') {
      const target = document.getElementById('au-scene');
      const fid = 'au-rgb-' + Math.floor(r() * 1e9);
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      Object.assign(svg.style, { position: 'absolute' });
      svg.innerHTML = `<filter id="${fid}" x="-5%" y="0" width="110%" height="100%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="0" result="ro"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="0" result="bo"/>
        <feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter>`;
      document.body.appendChild(svg);
      const offs = svg.querySelectorAll('feOffset');
      const bars = kind === 'glitch' ? Array.from({ length: 6 }, (_, i) => {
        const b = document.createElement('div');
        Object.assign(b.style, { position: 'absolute', left: '0', right: '0', mixBlendMode: 'difference', background: i % 2 ? 'rgba(0,255,230,0.55)' : 'rgba(255,0,80,0.55)' });
        el.appendChild(b);
        return b;
      }) : [];
      ctx.onFrame((t) => {
        if (!target) return;
        if (!live(t)) { if (target.style.filter.includes(fid)) target.style.filter = ''; return; }
        const f = Math.floor(t * 24);
        const rr = mul(f * 40503 + 99);
        const on = kind === 'rgb-split' || (f % 18) < 4 || rr() < 0.06 * k;
        const dx = kind === 'rgb-split' ? 5 * k : on ? (6 + rr() * 18) * k : 0;
        offs[0].setAttribute('dx', dx.toFixed(1));
        offs[1].setAttribute('dx', (-dx).toFixed(1));
        target.style.filter = dx ? `url(#${fid})` : '';
        bars.forEach((b) => {
          if (!on) { b.style.opacity = '0'; return; }
          Object.assign(b.style, { top: (rr() * 100) + '%', height: (1 + rr() * 6) + '%', opacity: String(0.4 + rr() * 0.5), transform: `translateX(${(rr() - 0.5) * 40 * k}px)` });
        });
      });
    } else if (kind === 'vignette') {
      el.style.background = `radial-gradient(ellipse at center, transparent ${Math.round(60 - 18 * k)}%, rgba(0,0,0,${Math.min(0.9, 0.55 * k)}))`;
    } else if (kind === 'light-rays') {
      const rays = document.createElement('div');
      const c = tint || 'rgba(255,240,200,0.55)';
      Object.assign(rays.style, { position: 'absolute', left: '-50%', top: '-80%', width: '200%', height: '200%', background: `repeating-conic-gradient(from 0deg at 50% 50%, ${c} 0deg 4deg, transparent 4deg 14deg)`, mixBlendMode: 'screen', opacity: String(0.5 * k), maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 60%)', webkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 60%)' });
      el.appendChild(rays);
      ctx.onFrame((t) => { if (live(t)) rays.style.transform = `rotate(${(local(t) * 6).toFixed(2)}deg)`; });
    } else if (kind === 'sparkles') {
      const stars = Array.from({ length: Math.round(18 * k) }, () => {
        const s = document.createElement('div');
        const size = 14 + r() * 26;
        s.innerHTML = `<svg viewBox="0 0 20 20" width="${size}" height="${size}"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="${tint || '#fff6c8'}"/></svg>`;
        Object.assign(s.style, { position: 'absolute', left: (r() * 96) + '%', top: (r() * 92) + '%', filter: 'drop-shadow(0 0 6px rgba(255,240,180,0.9))' });
        el.appendChild(s);
        return { s, ph: r() * 6.28, sp: 1.5 + r() * 2 };
      });
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const u = local(t);
        stars.forEach((o) => { const v = Math.max(0, Math.sin(u * o.sp + o.ph)); o.s.style.transform = `scale(${v.toFixed(3)}) rotate(${(u * 40).toFixed(1)}deg)`; o.s.style.opacity = v.toFixed(3); });
      });
    } else if (kind === 'confetti' || kind === 'rain') {
      const c = canvasIn(ctx, el, 1);
      const g = c.getContext('2d');
      const n = Math.round((kind === 'rain' ? 220 : 160) * k);
      const pal = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#a06cd5', '#ff8c42'];
      const parts = Array.from({ length: n }, () => ({ x: r(), y: r(), vx: (r() - 0.5), vy: 0.6 + r() * 0.9, rot: r() * 6.28, vr: (r() - 0.5) * 10, c: pal[Math.floor(r() * pal.length)], s: 0.6 + r() }));
      ctx.onFrame((t) => {
        g.clearRect(0, 0, c.width, c.height);
        if (!live(t)) return;
        const u = local(t);
        parts.forEach((q) => {
          if (kind === 'rain') {
            const y = ((q.y + u * q.vy * 1.6) % 1.1) - 0.05;
            const x = q.x - 0.02 * y;
            g.strokeStyle = 'rgba(200,220,255,0.55)'; g.lineWidth = 1.4 * q.s;
            g.beginPath(); g.moveTo(x * c.width, y * c.height); g.lineTo((x - 0.006) * c.width, (y + 0.04) * c.height); g.stroke();
          } else {
            const x = 0.5 + q.vx * 0.9 * Math.min(1, u * 1.6) + Math.sin(u * 2 + q.rot) * 0.02;
            const y = 1.05 - q.vy * 1.6 * u + 0.9 * u * u * 1.4 - q.y * 0.05;
            if (y > 1.1) return;
            g.save(); g.translate(x * c.width, y * c.height); g.rotate(q.rot + u * q.vr);
            g.fillStyle = q.c; g.fillRect(-6 * q.s, -3 * q.s, 12 * q.s, 6 * q.s); g.restore();
          }
        });
      });
    } else if (kind === 'lens-flare') {
      const pieces = [0, 0.35, 0.6, 0.85, 1.2].map((pos, i) => {
        const d = document.createElement('div');
        const size = i === 0 ? 26 : 5 + r() * 9;
        Object.assign(d.style, { position: 'absolute', width: size + '%', aspectRatio: '1', borderRadius: '50%', mixBlendMode: 'screen', transform: 'translate(-50%,-50%)',
          background: i === 0 ? `radial-gradient(circle, rgba(255,255,255,0.95), ${tint || 'rgba(255,200,120,0.5)'} 30%, transparent 70%)` : `radial-gradient(circle, transparent 40%, rgba(160,200,255,0.35) 60%, transparent 72%)` });
        el.appendChild(d);
        return { d, pos };
      });
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const u = local(t);
        const sx = 18 + u * 6, sy = 22 + Math.sin(u * 0.5) * 4;
        pieces.forEach((o) => { o.d.style.left = (sx + (50 - sx) * o.pos * 2) + '%'; o.d.style.top = (sy + (50 - sy) * o.pos * 2) + '%'; o.d.style.opacity = String(Math.min(1, 0.8 * k)); });
      });
    } else if (kind === 'hud') {
      const col = tint || 'rgba(120,230,255,0.9)';
      el.innerHTML = `<svg viewBox="0 0 160 90" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
        <g fill="none" stroke="${col}" stroke-width="0.5"><path d="M6 16 V6 H22"/><path d="M138 6 H154 V16"/><path d="M6 74 V84 H22"/><path d="M138 84 H154 V74"/>
        <circle cx="80" cy="45" r="9"/><path d="M80 31 V38 M80 52 V59 M66 45 H73 M87 45 H94"/></g></svg>
        <div class="hud-read" style="position:absolute;right:6%;top:9%;font:600 ${Math.round(ctx.H * 0.03)}px monospace;color:${col};text-align:right"></div>`;
      const read = el.querySelector('.hud-read');
      ctx.onFrame((t) => {
        if (!live(t)) return;
        const f = Math.floor(local(t) * 12);
        read.innerHTML = `REC ${String(Math.floor(local(t))).padStart(2, '0')}:${String(f % 12 * 5).padStart(2, '0')}<br>ALT ${(1200 + f * 7) % 9999}<br>SIG ${70 + (f * 13) % 29}%`;
      });
    } else if (kind === 'halftone') {
      Object.assign(el.style, { backgroundImage: `radial-gradient(circle, rgba(0,0,0,${0.35 * k}) 1.2px, transparent 1.6px)`, backgroundSize: '9px 9px', mixBlendMode: 'multiply' });
    } else if (kind === 'letterbox') {
      const bars = ['top', 'bottom'].map((side) => {
        const b = document.createElement('div');
        Object.assign(b.style, { position: 'absolute', left: '0', right: '0', [side]: '0', height: (11 * k) + '%', background: '#000' });
        el.appendChild(b);
        return b;
      });
      ctx.tl.from(bars, { scaleY: 0, transformOrigin: (i) => (i ? '50% 100%' : '50% 0%'), duration: 0.8, ease: 'power3.out', immediateRender: false }, at);
    }
    return { el, end };
  });

  const INTROS = ['neon-flicker', 'line-draw', 'minimal-slide', 'shapes-assemble', 'color-burst', 'iridescent', 'retro-80s', 'glitch-reveal', 'split-reveal',
    'countdown', 'terminal', 'cinematic', 'ink-reveal', 'kinetic-stack', 'light-sweep', 'end-card'];

  define('intro', {
    category: 'intro',
    description: 'Full-frame intro, outro and title card designs: neon flicker, line draw, minimal slide, shapes assemble, colour burst, iridescent, retro 80s, glitch reveal, split reveal, countdown, terminal, cinematic, ink reveal, kinetic stack, light sweep, end card. Uses the film palette and fonts.',
    params: {
      style: { type: 'enum', default: 'neon-flicker', options: INTROS },
      title: { type: 'string', default: 'Your Title' },
      subtitle: { type: 'string', default: '' },
      logo: { type: 'string', default: '', doc: 'optional image asset id shown above the title' },
      dark: { type: 'boolean', default: true, doc: 'dark backdrop (false uses the film background colour)' }
    },
    example: "component('intro', { style: 'neon-flicker', title: 'Night Shift', subtitle: 'A short film', at: 0 })"
  }, (ctx, p, h) => {
    const { at, end } = h.span(p);
    const style = INTROS.includes(p.style) ? p.style : 'neon-flicker';
    const tl = ctx.tl;
    const r = mul((ctx.seed || 1) * 977 + INTROS.indexOf(style) * 31);
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-intro intro-' + style, { x: 0, y: 0, w: 100 });
    const dark = p.dark !== false && p.dark !== 'false';
    Object.assign(el.style, { height: '100%', zIndex: '40', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: dark ? '#07070c' : 'var(--bg)', color: dark ? '#fff' : 'var(--ink)', textAlign: 'center', pointerEvents: 'none' });
    const accent = 'var(--accent)', accent2 = 'var(--accent-2)';
    const big = Math.round(Math.min(ctx.W, ctx.H * 1.6) * (String(p.title || '').length > 14 ? 0.075 : 0.105));
    const add = (tag, css, text) => { const n = document.createElement(tag); Object.assign(n.style, css || {}); if (text != null) n.textContent = text; el.appendChild(n); return n; };
    const layer = (css) => { const n = document.createElement('div'); Object.assign(n.style, { position: 'absolute', inset: '0', pointerEvents: 'none' }, css || {}); el.appendChild(n); return n; };
    const logoSrc = p.logo ? (ctx.asset ? ctx.asset(p.logo) : '') : '';
    let logo = null;
    if (logoSrc) {
      logo = add('img', { height: (ctx.H * 0.16) + 'px', marginBottom: (ctx.H * 0.03) + 'px', objectFit: 'contain', position: 'relative', zIndex: '2' });
      logo.src = logoSrc;
    }
    const title = add('div', { font: `800 ${big}px var(--font-display)`, letterSpacing: '-0.02em', lineHeight: '1.02', position: 'relative', zIndex: '2', maxWidth: '86%', whiteSpace: 'pre-wrap' }, p.title || '');
    title.setAttribute('dir', 'auto');
    const sub = p.subtitle ? add('div', { font: `500 ${Math.round(big * 0.3)}px var(--font-body)`, opacity: '0.82', marginTop: (big * 0.28) + 'px', position: 'relative', zIndex: '2', letterSpacing: '0.04em' }, p.subtitle) : null;
    const reveal = (targets, t0, vars) => tl.from(targets, Object.assign({ autoAlpha: 0, y: 30, duration: 0.7, ease: 'au.softLand', immediateRender: false }, vars || {}), at + t0);
    if (logo) reveal(logo, 0.1, { scale: 0.7 });

    if (style === 'neon-flicker') {
      const c = h.color(accent);
      Object.assign(title.style, { color: '#fff', textShadow: `0 0 0.06em #fff, 0 0 0.2em ${c}, 0 0 0.5em ${c}, 0 0 1em ${c}` });
      layer({ background: `radial-gradient(ellipse at 50% 60%, color-mix(in srgb, ${c} 22%, transparent), transparent 65%)` });
      const steps = [0, 0.08, 0.14, 0.3, 0.36, 0.55, 0.6, 0.9];
      tl.set(title, { autoAlpha: 0 }, 0);
      steps.forEach((s, i) => tl.set(title, { autoAlpha: i % 2 ? 0.15 : 1 }, at + 0.2 + s));
      tl.set(title, { autoAlpha: 1 }, at + 1.2);
      if (sub) reveal(sub, 1.3, { y: 0 });
    } else if (style === 'line-draw') {
      title.style.visibility = 'hidden';
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${ctx.W} ${ctx.H}`);
      Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '3' });
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', ctx.W / 2); tx.setAttribute('y', ctx.H / 2 + big * 0.35); tx.setAttribute('text-anchor', 'middle');
      Object.assign(tx.style, { font: `800 ${big}px var(--font-display)`, fill: 'transparent', stroke: dark ? '#fff' : 'var(--ink)', strokeWidth: Math.max(1.5, big * 0.018) + 'px', strokeDasharray: '1600', strokeDashoffset: '1600' });
      tx.textContent = p.title || '';
      svg.appendChild(tx);
      el.appendChild(svg);
      tl.to(tx, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }, at + 0.1);
      tl.to(tx, { fill: dark ? '#fff' : 'var(--ink)', duration: 0.6, ease: 'none' }, at + 1.6);
      if (sub) { sub.style.marginTop = (big * 1.6) + 'px'; reveal(sub, 2.0); }
    } else if (style === 'minimal-slide' || style === 'kinetic-stack') {
      if (style === 'minimal-slide') {
        const bars = [accent, accent2, dark ? '#fff' : 'var(--ink)'].map((c, i) => layer({ background: h.color(c), transformOrigin: i % 2 ? '100% 50%' : '0% 50%' }));
        bars.forEach((b, i) => { tl.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power3.inOut' }, at + i * 0.12); tl.to(b, { scaleX: 0, transformOrigin: i % 2 ? '0% 50%' : '100% 50%', duration: 0.45, ease: 'power3.inOut' }, at + 0.55 + i * 0.12); });
        reveal(title, 1.05, { y: 0, x: -60 });
        if (sub) reveal(sub, 1.3, { y: 0, x: 60 });
      } else {
        const words = String(p.title || '').split(/\s+/).filter(Boolean);
        title.textContent = '';
        title.style.display = 'flex'; title.style.flexDirection = 'column'; title.style.alignItems = 'center';
        words.forEach((w, i) => {
          const s = document.createElement('span');
          s.textContent = w.toUpperCase();
          Object.assign(s.style, { display: 'block', color: i % 2 ? h.color(accent) : 'inherit', fontSize: (big * (i % 2 ? 1.15 : 0.95)) + 'px' });
          title.appendChild(s);
          tl.from(s, { scale: 2.4, autoAlpha: 0, duration: 0.32, ease: 'power4.out', immediateRender: false }, at + 0.15 + i * 0.28);
        });
        if (sub) reveal(sub, 0.3 + words.length * 0.28);
      }
    } else if (style === 'shapes-assemble' || style === 'color-burst') {
      const cols = ['var(--accent)', 'var(--accent-2)', '#ffd166', '#06d6a0', '#ef476f'];
      const n = style === 'color-burst' ? 26 : 9;
      for (let i = 0; i < n; i++) {
        const s = layer({ inset: 'auto', left: '50%', top: '50%', width: (style === 'color-burst' ? 4 + r() * 8 : 8 + r() * 10) + '%', aspectRatio: '1',
          borderRadius: style === 'color-burst' || i % 3 === 0 ? '50%' : i % 3 === 1 ? '18%' : '0', background: h.color(cols[i % cols.length]), transform: 'translate(-50%,-50%)', zIndex: '1' });
        const ang = r() * Math.PI * 2, dist = 40 + r() * 40;
        if (style === 'color-burst') {
          tl.fromTo(s, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0 }, { x: Math.cos(ang) * dist * ctx.W / 100, y: Math.sin(ang) * dist * ctx.H / 100, scale: 1, duration: 1.1, ease: 'expo.out' }, at + 0.1 + r() * 0.15);
          tl.to(s, { scale: 0, duration: 0.5, ease: 'power2.in' }, at + 1.5 + r() * 0.3);
        } else {
          tl.fromTo(s, { xPercent: -50, yPercent: -50, x: Math.cos(ang) * ctx.W * 0.7, y: Math.sin(ang) * ctx.H * 0.7, rotation: r() * 360 },
            { x: Math.cos(ang) * ctx.W * 0.12, y: Math.sin(ang) * ctx.H * 0.18, rotation: 0, duration: 1.1, ease: 'expo.out' }, at + 0.05 + i * 0.05);
          tl.to(s, { scale: 0.4, autoAlpha: 0.25, duration: 0.6, ease: 'power2.inOut' }, at + 1.3);
        }
      }
      reveal(title, style === 'color-burst' ? 1.4 : 1.2, { scale: 0.6, y: 0, ease: 'back.out(2)' });
      if (sub) reveal(sub, 1.6);
    } else if (style === 'iridescent' || style === 'light-sweep') {
      if (style === 'iridescent') {
        Object.assign(title.style, { backgroundImage: 'linear-gradient(100deg, #ff6ec7, #7873f5, #4ade80, #facc15, #ff6ec7)', backgroundSize: '300% 100%', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
        ctx.onFrame((t) => { title.style.backgroundPosition = `${((t - at) * 30) % 300}% 50%`; });
        reveal(title, 0.15, { scale: 1.15, filter: 'blur(14px)', y: 0, duration: 1.1 });
      } else {
        Object.assign(title.style, { backgroundImage: `linear-gradient(110deg, ${dark ? '#9aa0ad' : '#555'} 40%, #fff 50%, ${dark ? '#9aa0ad' : '#555'} 60%)`, backgroundSize: '250% 100%', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
        reveal(title, 0.1, { y: 0, duration: 0.8 });
        tl.fromTo(title, { backgroundPosition: '100% 50%' }, { backgroundPosition: '-50% 50%', duration: 1.6, ease: 'power2.inOut' }, at + 0.6);
      }
      if (sub) reveal(sub, 1.1);
    } else if (style === 'retro-80s') {
      el.style.background = 'linear-gradient(#120024 0%, #3b0a57 45%, #ff2e88 62%, #120024 62.2%)';
      layer({ left: '30%', right: '30%', top: '18%', bottom: '38%', borderRadius: '50%', background: 'linear-gradient(#ffd319, #ff2975 70%)', maskImage: 'repeating-linear-gradient(transparent 0 52%, black 52% 58%, transparent 58% 62%, black 62% 100%)' });
      const grid = layer({ top: '62%', backgroundImage: 'linear-gradient(rgba(255,46,136,0.9) 2px, transparent 2px), linear-gradient(90deg, rgba(255,46,136,0.9) 2px, transparent 2px)', backgroundSize: '8% 18%', transform: 'perspective(300px) rotateX(60deg)', transformOrigin: '50% 0%' });
      ctx.onFrame((t) => { grid.style.backgroundPosition = `0 ${((t - at) * 60) % 100}%`; });
      Object.assign(title.style, { fontStyle: 'italic', backgroundImage: 'linear-gradient(#e0f7ff 0%, #7dd3fc 45%, #1e3a8a 50%, #e0f7ff 75%)', webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 0 #ff2e88)', marginTop: '-12%' });
      reveal(title, 0.4, { scale: 0.3, y: 0, ease: 'back.out(1.6)', duration: 0.9 });
      if (sub) { Object.assign(sub.style, { color: '#7dd3fc', fontStyle: 'italic' }); reveal(sub, 1.1); }
    } else if (style === 'glitch-reveal') {
      tl.set(title, { autoAlpha: 0 }, 0);
      tl.set(title, { autoAlpha: 1 }, at + 0.25);
      ctx.onFrame((t) => {
        const u = t - at;
        const f = Math.floor(t * 24);
        const rr = mul(f * 7 + 3);
        const burst = u > 0.2 && (u < 1.3 || f % 30 < 2);
        const dx = burst ? 4 + rr() * 16 : 0;
        title.style.textShadow = burst ? `${dx}px ${(rr() - 0.5) * 6}px 0 rgba(255,0,80,0.9), ${-dx}px ${(rr() - 0.5) * 6}px 0 rgba(0,240,255,0.9)` : 'none';
        title.style.transform = burst ? `translateX(${((rr() - 0.5) * 18).toFixed(1)}px) skewX(${((rr() - 0.5) * 12).toFixed(1)}deg)` : 'none';
        title.style.clipPath = burst && rr() < 0.45 ? `inset(${(rr() * 45).toFixed(1)}% 0 ${(rr() * 35).toFixed(1)}% 0)` : 'none';
      });
      if (sub) reveal(sub, 1.4, { y: 0 });
    } else if (style === 'split-reveal') {
      const top = layer({ bottom: '50%', background: h.color(accent), zIndex: '5' });
      const bot = layer({ top: '50%', background: h.color(accent2), zIndex: '5' });
      tl.to(top, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, at + 0.35);
      tl.to(bot, { yPercent: 100, duration: 0.9, ease: 'power4.inOut' }, at + 0.35);
      reveal(title, 0.6, { scale: 0.85, y: 0, duration: 0.9 });
      if (sub) reveal(sub, 1.0);
    } else if (style === 'countdown') {
      const num = add('div', { position: 'absolute', font: `900 ${Math.round(ctx.H * 0.5)}px var(--font-display)`, color: h.color(accent), zIndex: '3' }, '3');
      const ring = layer({ inset: 'auto', left: '50%', top: '50%', width: (ctx.H * 0.62) + 'px', height: (ctx.H * 0.62) + 'px', borderRadius: '50%', border: `${Math.round(ctx.H * 0.012)}px solid ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'}`, transform: 'translate(-50%,-50%)' });
      void ring;
      tl.set([title, sub].filter(Boolean), { autoAlpha: 0 }, 0);
      ['3', '2', '1'].forEach((n, i) => {
        tl.call(() => { num.textContent = n; }, null, at + i * 0.6);
        tl.fromTo(num, { scale: 1.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'power3.out', immediateRender: false }, at + i * 0.6);
      });
      ctx.onFrame((t) => { const u = t - at; num.textContent = u < 0.6 ? '3' : u < 1.2 ? '2' : '1'; });
      tl.to(num, { autoAlpha: 0, scale: 0.5, duration: 0.2 }, at + 1.75);
      tl.to([title, sub].filter(Boolean), { autoAlpha: 1, duration: 0.01 }, at + 1.85);
      tl.from(title, { scale: 1.5, duration: 0.5, ease: 'power4.out', immediateRender: false }, at + 1.85);
    } else if (style === 'terminal') {
      el.style.background = '#0b0f14';
      const win = add('div', { width: '72%', padding: '3% 4%', borderRadius: '14px', background: '#11161d', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', textAlign: 'left', font: `600 ${Math.round(big * 0.42)}px var(--font-mono, monospace)`, color: '#7ee787', position: 'relative', zIndex: '2' });
      win.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:4%"><i style="width:14px;height:14px;border-radius:50%;background:#ff5f56"></i><i style="width:14px;height:14px;border-radius:50%;background:#ffbd2e"></i><i style="width:14px;height:14px;border-radius:50%;background:#27c93f"></i></div><div class="tline"></div>';
      title.remove(); if (sub) sub.remove();
      const line = win.querySelector('.tline');
      const text = '> ' + (p.title || '') + (p.subtitle ? '\n  ' + p.subtitle : '');
      reveal(win, 0, { y: 40, duration: 0.5 });
      ctx.onFrame((t) => {
        const n = Math.max(0, Math.min(text.length, Math.floor((t - at - 0.5) * 22)));
        const caret = Math.floor(t * 2.5) % 2 ? '█' : ' ';
        line.textContent = text.slice(0, n) + caret;
        line.style.whiteSpace = 'pre-wrap';
      });
    } else if (style === 'cinematic') {
      const bars = ['top', 'bottom'].map((side) => layer({ inset: 'auto', [side]: '0', left: '0', right: '0', height: '12%', background: '#000', zIndex: '4' }));
      tl.from(bars, { scaleY: 0, transformOrigin: (i) => (i ? '50% 100%' : '50% 0%'), duration: 1, ease: 'power3.out', immediateRender: false }, at);
      Object.assign(title.style, { font: `500 ${Math.round(big * 0.95)}px var(--font-display)`, letterSpacing: '0.02em' });
      tl.fromTo(title, { scale: 1.08, autoAlpha: 0, filter: 'blur(8px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 2.2, ease: 'power2.out', immediateRender: false }, at + 0.4);
      if (sub) { sub.style.textTransform = 'uppercase'; tl.fromTo(sub, { letterSpacing: '0.02em', autoAlpha: 0 }, { letterSpacing: '0.4em', autoAlpha: 0.85, duration: 2.4, ease: 'power2.out', immediateRender: false }, at + 1.0); }
      const sweep = layer({ background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)', zIndex: '3' });
      tl.fromTo(sweep, { xPercent: -100 }, { xPercent: 100, duration: 2, ease: 'power2.inOut' }, at + 1.2);
    } else if (style === 'ink-reveal') {
      const ink = layer({ background: h.color(accent), clipPath: 'circle(0% at 30% 60%)', zIndex: '0' });
      tl.to(ink, { clipPath: 'circle(150% at 30% 60%)', duration: 1.4, ease: 'power3.inOut' }, at + 0.1);
      Object.assign(title.style, { color: '#fff' });
      reveal(title, 0.9, { y: 50, rotation: -3 });
      if (sub) { sub.style.color = '#fff'; reveal(sub, 1.2); }
    } else if (style === 'end-card') {
      title.textContent = p.title && p.title !== 'Your Title' ? p.title : 'Thanks for watching';
      title.style.fontSize = Math.round(big * 0.75) + 'px';
      title.style.marginBottom = '4%';
      el.insertBefore(title, el.firstChild);
      const row = add('div', { display: 'flex', gap: '4%', width: '78%', justifyContent: 'center', position: 'relative', zIndex: '2' });
      [0, 1].forEach((i) => {
        const card = document.createElement('div');
        Object.assign(card.style, { flex: '1', aspectRatio: '16/9', borderRadius: '14px', border: `3px solid ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)'}`, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `600 ${Math.round(big * 0.22)}px var(--font-body)`, opacity: '0.8' });
        card.textContent = i ? 'Next video' : 'Watch this';
        row.appendChild(card);
        tl.from(card, { y: 60, autoAlpha: 0, duration: 0.6, ease: 'au.softLand', immediateRender: false }, at + 0.4 + i * 0.15);
      });
      const btn = add('div', { marginTop: '4%', padding: '1.2% 3.2%', borderRadius: '999px', background: '#ff0033', color: '#fff', font: `800 ${Math.round(big * 0.28)}px var(--font-body)`, position: 'relative', zIndex: '2' }, p.subtitle || 'SUBSCRIBE');
      reveal(title, 0.1);
      tl.from(btn, { scale: 0, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, at + 0.9);
      tl.to(btn, { scale: 1.08, duration: 0.4, ease: 'sine.inOut', repeat: 5, yoyo: true }, at + 1.5);
      if (sub) sub.remove();
    }
    if (end < ctx.D - 0.05) tl.to(el, { autoAlpha: 0, duration: 0.4, ease: 'au.exit' }, end - 0.4);
    return { el, end };
  });
})();
