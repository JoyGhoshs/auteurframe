(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const PRESETS = {
    none: {},
    fisheye: { barrel: 0.75, overlays: ['vignette'] },
    wide: { barrel: 0.28, overlays: ['vignette'] },
    telephoto: { push: 1.06, overlays: ['vignette', 'bokeh'] },
    anamorphic: { overlays: ['letterbox', 'flare', 'vignette'], streak: true, tint: 'saturate(1.08) hue-rotate(-6deg)' },
    'tilt-shift': { tilt: 0.75, tint: 'saturate(1.35) contrast(1.05)' },
    macro: { tilt: 1, overlays: ['bokeh', 'vignette'], push: 1.04 },
    vintage: { overlays: ['grain', 'dust', 'vignette'], weave: 1, tint: 'sepia(0.45) contrast(1.08) saturate(0.85)' },
    vhs: { overlays: ['scanlines', 'grain', 'vhs'], chroma: 3.5, jitter: 1, tint: 'saturate(1.25) contrast(1.05)' },
    crt: { barrel: 0.32, overlays: ['scanlines', 'vignette', 'glow'], chroma: 1.5, tint: 'contrast(1.1) saturate(1.1)' },
    security: { barrel: 0.45, overlays: ['scanlines', 'rec', 'grain'], tint: 'grayscale(1) contrast(1.25) brightness(1.05)' },
    viewfinder: { overlays: ['rec'] },
    dreamy: { overlays: ['leaks', 'bokeh', 'vignette'], tint: 'saturate(1.1) brightness(1.04)', glow: true },
    documentary: { overlays: ['grain', 'vignette'], weave: 0.3 },
    'night-vision': { barrel: 0.2, overlays: ['scanlines', 'grain', 'circle'], tint: 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(3) brightness(1.1)' }
  };

  function barrelMap(k) {
    const n = 128, c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d'), im = g.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = i / (n - 1) * 2 - 1, v = j / (n - 1) * 2 - 1, r2 = u * u + v * v;
      const dx = -u * r2 * k * 0.5, dy = -v * r2 * k * 0.5;
      const o = (j * n + i) * 4;
      im.data[o] = clamp(128 + dx * 127, 0, 255); im.data[o + 1] = clamp(128 + dy * 127, 0, 255); im.data[o + 2] = 128; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  }

  reg.define('lens', {
    category: 'camera', description: 'Lens and camera look for the whole scene: fisheye, wide, telephoto, anamorphic (letterbox, streak flares), tilt-shift miniature, macro, vintage film (gate weave, dust, grain), VHS, CRT, security camera, camcorder viewfinder, dreamy, night vision. Adds lens moves: push-in, crash zoom, dolly zoom (vertigo) and rack focus between two elements. Overlays: vignette, chromatic aberration, flares, light leaks, dust, grain, bokeh, scanlines, letterbox, REC frame.',
    params: {
      type: { type: 'enum', default: 'documentary', options: Object.keys(PRESETS) },
      strength: { type: 'number', default: 1, doc: '0 to 2 scales the whole look' },
      overlays: { type: 'array', default: null, doc: "extra overlays: vignette, chromatic, flare, leaks, dust, grain, bokeh, scanlines, letterbox, rec, glow, circle" },
      move: { type: 'enum', default: 'none', options: ['none', 'push', 'crash', 'dolly', 'pull', 'rack'], doc: 'lens move over the scene' },
      moveAt: { type: 'number', default: 0.4 }, moveDuration: { type: 'number', default: null, doc: 'seconds (crash defaults to 0.3)' },
      zoom: { type: 'number', default: 1.25, doc: 'end zoom for push, crash and dolly' },
      focus: { type: 'array', default: [50, 45], doc: '[x%, y%] the zoom centres on' },
      focusA: { type: 'string', default: '', doc: 'rack focus: CSS selector sharp first' }, focusB: { type: 'string', default: '', doc: 'rack focus: CSS selector sharp after the rack' },
      flare: { type: 'array', default: [78, 22], doc: '[x%, y%] light source for flares' }, tint: { type: 'string', default: '', doc: 'extra CSS filter for the colour look' }
    },
    example: "component('lens', { type: 'anamorphic', move: 'push', zoom: 1.12, focus: [40, 45] })"
  }, (ctx, p, h) => {
    window.__AU_LENS_USED = true;
    const preset = Object.assign({}, PRESETS[p.type] || {});
    const k = clamp(+p.strength, 0, 2);
    const root = h.root();
    const ground = document.getElementById('au-ground');
    const targets = [root].concat(ground ? [ground] : []);
    const stage = document.getElementById('au-scene') || root.parentElement || root;
    const W = ctx.W, H = ctx.H;
    const overlays = new Set((preset.overlays || []).concat(Array.isArray(p.overlays) ? p.overlays : []));
    const id = 'au-lens-' + Math.floor(Math.random() * 1e9).toString(36);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    const chroma = (preset.chroma || 0) + (overlays.has('chromatic') ? 2.2 : 0);
    let filterParts = '';
    if (preset.barrel) filterParts += `<feImage href="${barrelMap(1)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bent"/>`;
    const src = preset.barrel ? 'bent' : 'SourceGraphic';
    if (chroma) filterParts += `<feColorMatrix in="${src}" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="${chroma * k}" dy="0" result="ro"/>
      <feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="${-chroma * k}" dy="0" result="bo"/>
      <feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/>`;
    if (filterParts) {
      svg.innerHTML = `<filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${filterParts}</filter>`;
      document.body.appendChild(svg);
    }
    const disp = svg.querySelector('feDisplacementMap');
    const cssTint = [preset.tint || '', p.tint || ''].join(' ').trim();
    targets.forEach((el) => { el.style.filter = [filterParts ? `url(#${id})` : '', cssTint].join(' ').trim(); el.style.transformOrigin = `${p.focus[0]}% ${p.focus[1]}%`; });
    const layer = document.createElement('div');
    layer.className = 'au-lens-layer';
    layer.setAttribute('data-layer', 'lens');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9000;overflow:hidden;';
    stage.appendChild(layer);
    const add = (css, html) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;' + css; if (html) d.innerHTML = html; layer.appendChild(d); return d; };
    const parts = {};
    if (overlays.has('vignette')) parts.vig = add(`background:radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,${0.55 * k}) 100%);`);
    if (overlays.has('circle')) add('background:radial-gradient(circle at 50% 50%, transparent 44%, #000 46%);');
    if (preset.tilt) {
      const blur = 7 * preset.tilt * k;
      add(`top:0;bottom:auto;height:42%;backdrop-filter:blur(${blur}px);-webkit-mask-image:linear-gradient(#000 20%,transparent);mask-image:linear-gradient(#000 20%,transparent);`);
      add(`top:auto;bottom:0;height:42%;backdrop-filter:blur(${blur}px);-webkit-mask-image:linear-gradient(transparent,#000 80%);mask-image:linear-gradient(transparent,#000 80%);`);
    }
    if (overlays.has('letterbox')) {
      const bar = Math.max(0, (H - W / 2.39) / 2);
      parts.lbTop = add(`bottom:auto;height:${bar}px;background:#000;transform-origin:top;`);
      parts.lbBot = add(`top:auto;height:${bar}px;background:#000;transform-origin:bottom;`);
    }
    if (overlays.has('scanlines')) add('background:repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);mix-blend-mode:multiply;');
    if (overlays.has('glow')) add('background:radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.06), transparent 70%);mix-blend-mode:screen;');
    if (overlays.has('leaks')) {
      parts.leakA = add('mix-blend-mode:screen;filter:blur(40px);background:radial-gradient(circle at 50% 50%, rgba(255,140,60,.55), transparent 60%);width:70%;height:90%;');
      parts.leakB = add('mix-blend-mode:screen;filter:blur(50px);background:radial-gradient(circle at 50% 50%, rgba(255,60,120,.35), transparent 60%);width:60%;height:80%;');
    }
    if (overlays.has('flare') || preset.streak) {
      const ghosts = [0.25, 0.5, 0.72, 1.15, 1.4].map((f, i) => `<div data-f="${f}" style="position:absolute;width:${[60, 120, 40, 180, 90][i]}px;height:${[60, 120, 40, 180, 90][i]}px;margin:-${[30, 60, 20, 90, 45][i]}px;border-radius:50%;background:radial-gradient(circle, rgba(${['255,220,170', '170,210,255', '255,180,120', '200,170,255', '170,255,230'][i]},${0.22 * k}), transparent 70%);"></div>`).join('');
      parts.flare = add('mix-blend-mode:screen;', `<div class="src" style="position:absolute;width:260px;height:260px;margin:-130px;border-radius:50%;background:radial-gradient(circle, rgba(255,245,225,${0.75 * k}), rgba(255,200,140,.18) 30%, transparent 65%);"></div>${preset.streak ? `<div class="streak" style="position:absolute;left:-10%;width:120%;height:3px;margin-top:-1px;background:linear-gradient(90deg, transparent, rgba(110,170,255,${0.85 * k}), rgba(220,240,255,${0.9 * k}), rgba(110,170,255,${0.85 * k}), transparent);filter:blur(1px);"></div>` : ''}${ghosts}`);
    }
    if (overlays.has('bokeh')) {
      const dots = Array.from({ length: 14 }, (_, i) => `<div style="position:absolute;left:${(hash(i + 3) * 100).toFixed(1)}%;top:${(hash(i + 50) * 100).toFixed(1)}%;width:${30 + hash(i + 9) * 90}px;height:${30 + hash(i + 9) * 90}px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,${0.10 + hash(i) * 0.12}), transparent 70%);" data-i="${i}"></div>`).join('');
      parts.bokeh = add('mix-blend-mode:screen;', dots);
    }
    let grainCanvas = null, dustCanvas = null;
    if (overlays.has('grain')) { grainCanvas = document.createElement('canvas'); grainCanvas.width = 256; grainCanvas.height = 256; grainCanvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;opacity:${0.18 * k};mix-blend-mode:overlay;image-rendering:pixelated;`; layer.appendChild(grainCanvas); }
    if (overlays.has('dust') || overlays.has('vhs')) { dustCanvas = document.createElement('canvas'); dustCanvas.width = Math.round(W / 2); dustCanvas.height = Math.round(H / 2); dustCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'; layer.appendChild(dustCanvas); }
    if (overlays.has('rec')) {
      parts.rec = add('font:600 28px var(--font-mono, monospace);color:#fff;text-shadow:0 0 6px rgba(0,0,0,.6);', `
        <div style="position:absolute;left:5%;top:7%;width:7%;height:10%;border-left:4px solid #fff;border-top:4px solid #fff;"></div>
        <div style="position:absolute;right:5%;top:7%;width:7%;height:10%;border-right:4px solid #fff;border-top:4px solid #fff;"></div>
        <div style="position:absolute;left:5%;bottom:7%;width:7%;height:10%;border-left:4px solid #fff;border-bottom:4px solid #fff;"></div>
        <div style="position:absolute;right:5%;bottom:7%;width:7%;height:10%;border-right:4px solid #fff;border-bottom:4px solid #fff;"></div>
        <div style="position:absolute;left:8%;top:10%;display:flex;align-items:center;gap:12px;"><span class="dot" style="width:18px;height:18px;border-radius:50%;background:#ff3b30;display:inline-block;"></span>REC</div>
        <div class="tc" style="position:absolute;right:8%;top:10%;">00:00:00:00</div>
        <div style="position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border:2px solid rgba(255,255,255,.8);"></div>`);
    }
    const D = ctx.D, fps = ctx.fps || 30;
    const mvDur = p.moveDuration != null ? +p.moveDuration : (p.move === 'crash' ? 0.3 : Math.max(0.5, D - p.moveAt));
    const A = p.focusA ? Array.from(document.querySelectorAll(p.focusA)) : [];
    const B = p.focusB ? Array.from(document.querySelectorAll(p.focusB)) : [];
    ctx.onFrame((t) => {
      const frame = Math.round(t * fps);
      let z = preset.push ? 1 + (preset.push - 1) * (t / D) : 1;
      let blur = 0;
      const u = (t - p.moveAt) / mvDur;
      if (p.move === 'push') z *= 1 + (p.zoom - 1) * ease(u);
      if (p.move === 'pull') z *= p.zoom - (p.zoom - 1) * ease(u);
      if (p.move === 'crash') { const e = clamp(u, 0, 1); z *= 1 + (p.zoom - 1) * (1 - Math.pow(1 - e, 3)); blur = u > 0 && u < 1 ? Math.sin(e * Math.PI) * 6 : 0; }
      let barrel = (preset.barrel || 0) * k;
      if (p.move === 'dolly') { const e = ease(u); z *= 1 + (p.zoom - 1) * e; barrel = Math.max(barrel, 0) + (1 - e) * 0.6 * k - e * 0.25 * k; }
      if (disp) disp.setAttribute('scale', String(Math.round(barrel * Math.min(W, H) * 0.32)));
      if (A.length || B.length) {
        const e = p.move === 'rack' ? ease(u) : 0;
        A.forEach((el) => { el.style.filter = `blur(${(e * 9).toFixed(2)}px)`; });
        B.forEach((el) => { el.style.filter = `blur(${((1 - e) * 9).toFixed(2)}px)`; });
      }
      let tx = 0, ty = 0;
      if (preset.weave) { tx = (hash(frame) - 0.5) * 2.2 * preset.weave; ty = (hash(frame + 99) - 0.5) * 3 * preset.weave; }
      if (preset.jitter && hash(frame * 3) > 0.93) tx += (hash(frame * 7) - 0.5) * 14;
      const fl = [filterParts ? `url(#${id})` : '', cssTint, blur ? `blur(${blur.toFixed(2)}px)` : ''].join(' ').trim();
      targets.forEach((el) => { el.style.scale = z.toFixed(4); el.style.translate = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`; el.style.filter = fl; });
      if (parts.lbTop) { const e = clamp(t / 0.6, 0, 1); parts.lbTop.style.transform = `scaleY(${ease(e)})`; parts.lbBot.style.transform = `scaleY(${ease(e)})`; }
      if (parts.flare) {
        const fx = p.flare[0] / 100 * W + Math.sin(t * 0.6) * 18, fy = p.flare[1] / 100 * H + Math.cos(t * 0.5) * 10;
        const cx = W / 2, cy = H / 2;
        parts.flare.querySelector('.src').style.transform = `translate(${fx}px, ${fy}px)`;
        const st = parts.flare.querySelector('.streak');
        if (st) st.style.top = fy + 'px';
        parts.flare.querySelectorAll('[data-f]').forEach((g) => { const f = +g.getAttribute('data-f'); g.style.transform = `translate(${(fx + (cx - fx) * f * 2).toFixed(1)}px, ${(fy + (cy - fy) * f * 2).toFixed(1)}px)`; });
      }
      if (parts.leakA) {
        parts.leakA.style.transform = `translate(${(Math.sin(t * 0.4) * 30 - 10).toFixed(1)}%, ${(Math.cos(t * 0.3) * 10 - 20).toFixed(1)}%)`;
        parts.leakB.style.transform = `translate(${(60 + Math.cos(t * 0.35) * 25).toFixed(1)}%, ${(30 + Math.sin(t * 0.27) * 15).toFixed(1)}%)`;
        parts.leakA.style.opacity = (0.5 + 0.5 * Math.sin(t * 0.8)).toFixed(3);
      }
      if (parts.bokeh) parts.bokeh.querySelectorAll('[data-i]').forEach((d) => { const i = +d.getAttribute('data-i'); d.style.transform = `translate(${(Math.sin(t * 0.3 + i) * 20).toFixed(1)}px, ${(-t * (6 + i)).toFixed(1)}px)`; });
      if (grainCanvas) {
        const g = grainCanvas.getContext('2d'), im = g.createImageData(256, 256);
        for (let i = 0; i < im.data.length; i += 4) { const v = hash(i * 0.37 + frame * 13.1) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
        g.putImageData(im, 0, 0);
      }
      if (dustCanvas) {
        const g = dustCanvas.getContext('2d'), w = dustCanvas.width, hh = dustCanvas.height;
        g.clearRect(0, 0, w, hh);
        if (overlays.has('dust')) {
          g.fillStyle = 'rgba(20,15,10,.55)';
          for (let i = 0; i < 9; i++) { const r = hash(frame * 31 + i) * 2.4 + 0.4; g.beginPath(); g.arc(hash(frame * 17 + i * 3) * w, hash(frame * 23 + i * 7) * hh, r, 0, Math.PI * 2); g.fill(); }
          if (hash(frame * 5) > 0.7) { g.strokeStyle = 'rgba(240,235,220,.35)'; g.lineWidth = 1; const x = hash(frame * 11) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (hash(frame) - 0.5) * 6, hh); g.stroke(); }
        }
        if (overlays.has('vhs')) {
          const y = ((t * 0.18) % 1) * hh;
          g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, y, w, 10);
          for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${hash(frame * 3 + i) * 0.25})`; g.fillRect(hash(frame + i * 5) * w, y + hash(i + frame) * 10, hash(i * 9) * 30, 1); }
          g.font = '600 18px monospace'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('PLAY ▶', w * 0.06, hh * 0.1);
        }
      }
      if (parts.rec) {
        const dot = parts.rec.querySelector('.dot');
        dot.style.opacity = Math.floor(t * 1.6) % 2 ? '0.15' : '1';
        const tt = (ctx.globalStart || 0) + t, f = Math.floor((tt % 1) * fps);
        const s2 = (n) => String(n).padStart(2, '0');
        parts.rec.querySelector('.tc').textContent = `${s2(Math.floor(tt / 3600))}:${s2(Math.floor(tt / 60) % 60)}:${s2(Math.floor(tt) % 60)}:${s2(f)}`;
      }
    });
    return { el: layer, end: D };
  });
})();
