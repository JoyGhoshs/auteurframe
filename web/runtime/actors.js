(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

  function speech(src, at) {
    const S = ((window.AU_CONFIG || {}).speech) || {};
    const key = !src || src === true || src === 'voice' ? 'voice' : src;
    const d = S[key];
    if (!d || !d.levels || !d.levels.length) return null;
    const start = key === 'voice' ? 0 : (+at || 0);
    return (t) => {
      const f = (t - start) * d.fps;
      if (f < 0 || f >= d.levels.length - 1) return 0;
      const i = Math.floor(f), k = f - i;
      return d.levels[i] * (1 - k) + d.levels[i + 1] * k;
    };
  }
  window.AU_SPEECH = speech;

  function hashRand(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  reg.define('talking-head', {
    category: 'character', description: 'Turns one portrait photo or illustration into a talking, blinking, breathing head. The face is rigged automatically from landmarks; the jaw and lips follow the narration or a dialogue line from the speak tool, eyes blink, the head sways and nods on words. Use for presenters, historical figures, interviews and character dialogue.',
    params: {
      src: { type: 'string', default: '', doc: 'image asset id of a front-facing portrait' },
      lipsync: { type: 'string', default: 'voice', doc: "'voice' for the film narration or an audio asset id from speak" },
      lipsyncAt: { type: 'number', default: 0, doc: 'scene seconds when that audio line starts' },
      gain: { type: 'number', default: 1, doc: 'mouth opening strength (0.5 subtle to 1.6 expressive)' },
      motion: { type: 'number', default: 0.6, doc: 'head sway and nod amount (0 still to 1 lively)' },
      blink: { type: 'boolean', default: true }, smile: { type: 'number', default: 0, doc: '0 to 1 lifts the mouth corners' },
      h: { type: 'number', default: 80, doc: 'height in % of frame' }, frame: { type: 'enum', default: 'none', options: ['none', 'circle', 'card', 'polaroid'] },
      enter: { type: 'enum', default: 'rise', options: ['rise', 'fade', 'pop', 'none'] }
    },
    example: "component('talking-head', { src: 'as_portrait01', lipsync: 'as_line0001', lipsyncAt: 0.6, x: 30, y: 8, w: 40, h: 84, frame: 'card' })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-talking auc-th-' + p.frame, { x: 25, y: 8, w: 50 });
    el.style.height = p.h + '%';
    el.style.overflow = 'hidden';
    if (p.frame === 'circle') el.style.borderRadius = '50%';
    if (p.frame === 'card') Object.assign(el.style, { borderRadius: '22px', boxShadow: '0 30px 70px rgba(0,0,0,.28)', background: 'var(--bg-2)' });
    if (p.frame === 'polaroid') Object.assign(el.style, { padding: '14px 14px 54px', background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.3)', boxSizing: 'border-box' });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    el.appendChild(canvas);
    const g = canvas.getContext('2d');
    const rigs = ((window.AU_CONFIG || {}).rigs) || {};
    const rig = rigs[p.src];
    const img = new Image();
    img.src = ctx.asset(p.src);
    ctx.defer(img.decode());
    const level = speech(p.lipsync, p.lipsyncAt);
    const rnd = hashRand((ctx.seed || 1) * 7 + 3);
    const blinks = [];
    for (let b = 0.6 + rnd() * 1.4; b < ctx.D + 1; b += 2.1 + rnd() * 2.6) blinks.push(b);
    const words = [];
    const S = ((window.AU_CONFIG || {}).speech) || {};
    const sd = S[p.lipsync && p.lipsync !== 'voice' ? p.lipsync : 'voice'];
    ((sd && sd.words) || []).forEach((w) => words.push(w.t + (p.lipsync && p.lipsync !== 'voice' ? +p.lipsyncAt || 0 : 0)));
    const { at, end } = h.span(p);
    const enters = { rise: [{ y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }], fade: [{ autoAlpha: 0 }, { autoAlpha: 1 }], pop: [{ scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1 }] };
    const en = enters[p.enter];
    if (en) ctx.tl.fromTo(el, en[0], Object.assign({ duration: 0.7, ease: 'au.softLand' }, en[1]), at);
    h.exitOut(p, el, end, { y: 0 });
    const tri = (sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) => {
      const cxm = (dx0 + dx1 + dx2) / 3, cym = (dy0 + dy1 + dy2) / 3;
      const grow = (x, y) => { const vx = x - cxm, vy = y - cym, l = Math.hypot(vx, vy) || 1; return [x + vx / l * 0.7, y + vy / l * 0.7]; };
      const [e0x, e0y] = grow(dx0, dy0), [e1x, e1y] = grow(dx1, dy1), [e2x, e2y] = grow(dx2, dy2);
      g.save();
      g.beginPath(); g.moveTo(e0x, e0y); g.lineTo(e1x, e1y); g.lineTo(e2x, e2y); g.closePath(); g.clip();
      const den = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
      if (Math.abs(den) < 1e-9) { g.restore(); return; }
      const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / den;
      const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / den;
      const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / den;
      const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / den;
      const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / den;
      const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / den;
      g.transform(a, b, c, d, e, f);
      g.drawImage(img, 0, 0);
      g.restore();
    };
    ctx.onFrame((t) => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch || !img.naturalWidth) return;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const iw = img.naturalWidth, ih = img.naturalHeight;
      let s, ox, oy;
      if (rig) {
        const fx = rig.center[0] * iw, fy = (rig.center[1] + 0.06) * ih;
        s = Math.max(cw / iw, ch / ih);
        ox = clamp(cw / 2 - fx * s, cw - iw * s, 0); oy = clamp(ch * 0.45 - fy * s, ch - ih * s, 0);
      } else {
        s = Math.max(cw / iw, ch / ih); ox = (cw - iw * s) / 2; oy = (ch - ih * s) / 2;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      const breath = 1 + Math.sin(t * 1.7) * 0.004;
      if (!rig) {
        g.setTransform(s * breath, 0, 0, s * breath, ox - (breath - 1) * cw / 2, oy - (breath - 1) * ch / 2);
        g.drawImage(img, 0, 0);
        return;
      }
      const P = rig.points, G = rig.groups;
      const gapRest = G.lo_in.reduce((acc, i, k) => acc + (P[i][1] - P[G.up_in[G.up_in.length - 1 - k] ?? G.up_in[0]][1]), 0) / G.lo_in.length;
      const closedRest = Math.abs(gapRest) * (img.naturalHeight || 1) < Math.abs(P[G.lips_out[10]][0] - P[G.lips_out[0]][0]) * (img.naturalWidth || 1) * 0.06;
      const lv = level ? clamp(level(t) * p.gain, 0, 1.3) : 0;
      const open = smooth(clamp((lv - 0.15) / 0.95, 0, 1));
      let blink = 0;
      if (p.blink) blinks.forEach((b) => { if (t >= b && t < b + 0.18) blink = Math.max(blink, Math.sin((t - b) / 0.18 * Math.PI)); });
      const lips = G.lips_out.map((i) => P[i]);
      const mx = lips.reduce((a, q) => a + q[0], 0) / lips.length, my = lips.reduce((a, q) => a + q[1], 0) / lips.length;
      const mw = Math.abs(P[G.lips_out[10]][0] - P[G.lips_out[0]][0]);
      const drop = open * mw * 0.16 * (img.naturalWidth / img.naturalHeight);
      const chin = P[rig.chin];
      const D = P.map((q) => [q[0], q[1]]);
      const R = P.map((q) => [q[0], q[1]]);
      const lower = new Set(G.lo_in.concat(G.lo_out));
      G.lo_in.forEach((i) => { D[i][1] += drop; });
      G.lo_out.forEach((i) => { D[i][1] += drop * 0.92; });
      for (let i = 0; i < rig.fixed; i++) {
        if (lower.has(i) || G.up_in.includes(i)) continue;
        const q = P[i];
        if (q[1] > my + 0.002) {
          const w = clamp((q[1] - my) / Math.max(0.01, chin[1] - my), 0, 1);
          const side = 1 - clamp(Math.abs(q[0] - mx) / (rig.face_w * 0.7), 0, 1);
          D[i][1] += drop * 0.7 * w * (0.35 + 0.65 * side);
        }
      }
      if (p.smile) [G.lips_out[0], G.lips_out[10], G.lips_in[0], G.lips_in[10]].forEach((i) => { D[i][1] -= p.smile * mw * 0.06; D[i][0] += (P[i][0] < mx ? -1 : 1) * p.smile * mw * 0.03; });
      [['eye_r_up', 'eye_r_lo'], ['eye_l_up', 'eye_l_lo']].forEach(([u, l]) => G[u].forEach((i, k) => {
        const j = G[l][Math.min(k, G[l].length - 1)];
        D[i][1] += (P[j][1] - P[i][1]) * blink * 0.92;
      }));
      G.brow_r.concat(G.brow_l).forEach((i) => { D[i][1] -= open * mw * 0.03; });
      let nod = 0;
      words.forEach((w0) => { const k = t - w0; if (k > 0 && k < 0.45) nod = Math.max(nod, Math.sin(k / 0.45 * Math.PI)); });
      const m = p.motion;
      const rot = (Math.sin(t * 0.9) * 1.6 + Math.sin(t * 2.3 + 1) * 0.6) * m * Math.PI / 180;
      const tx = Math.sin(t * 0.7) * 0.004 * m, ty = (nod * 0.006 + Math.sin(t * 1.1) * 0.002) * m;
      const pivot = [chin[0], chin[1] + rig.face_w * 0.25];
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const turn = (A, i) => {
        const vx = A[i][0] - pivot[0], vy = (A[i][1] - pivot[1]) / rig.aspect;
        A[i][0] = pivot[0] + (vx * cr - vy * sr) + tx;
        A[i][1] = pivot[1] + (vx * sr + vy * cr) * rig.aspect + ty;
      };
      for (let i = 0; i < rig.fixed; i++) { turn(D, i); turn(R, i); }
      g.setTransform(breath, 0, 0, breath, -(breath - 1) * cw / 2, -(breath - 1) * ch / 2);
      const X = (q) => ox + q[0] * iw * s, Y = (q) => oy + q[1] * ih * s;
      g.save();
      g.translate(ox, oy); g.scale(s, s); g.drawImage(img, 0, 0);
      g.restore();
      const lcorner = G.lips_in[0], rcorner = G.lips_in[10];
      if (open > 0.02) {
        const rest = [lcorner].concat(G.lo_in, [rcorner]).map((i) => R[i]);
        const moved = G.lo_in.slice().reverse().map((i) => D[i]);
        const poly = rest.concat(moved);
        g.save();
        g.beginPath(); poly.forEach((q, k) => (k ? g.lineTo(X(q), Y(q)) : g.moveTo(X(q), Y(q)))); g.closePath();
        g.fillStyle = '#2a0c10'; g.fill(); g.clip();
        const top = Math.min(...rest.map((q) => Y(q))), bottom = Math.max(...moved.map((q) => Y(q)));
        const left = Math.min(...poly.map((q) => X(q))), right = Math.max(...poly.map((q) => X(q)));
        if (closedRest) { g.fillStyle = '#efe8df'; g.fillRect(left, top - 1, right - left, (bottom - top) * 0.24 + 1); }
        g.fillStyle = '#7d2632'; g.beginPath(); g.ellipse((left + right) / 2, bottom, (right - left) * 0.3, (bottom - top) * 0.42, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      const inMouth = new Set(rig.mouth_tris);
      rig.tris.forEach((tr, k) => {
        const a = tr[0], b = tr[1], c = tr[2];
        if (a >= rig.fixed && b >= rig.fixed && c >= rig.fixed) return;
        const T = inMouth.has(k) ? R : D;
        tri(P[a][0] * iw, P[a][1] * ih, P[b][0] * iw, P[b][1] * ih, P[c][0] * iw, P[c][1] * ih,
          X(T[a]), Y(T[a]), X(T[b]), Y(T[b]), X(T[c]), Y(T[c]));
      });
    });
    return { el, end };
  });
})();
