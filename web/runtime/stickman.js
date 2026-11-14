(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const E = (p, a, b) => smooth((p - a) / (b - a));
  const out = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const env = (t, a, e, f) => (t < a || t > e ? 0 : Math.min(1, (t - a) / f, (e - t) / f));
  const angLerp = (a, b, k) => { const d = ((b - a + 540) % 360) - 180; return a + d * k; };
  const B = { thigh: 80, shin: 80, torso: 118, neck: 19, head: 46, upper: 86, fore: 84 };
  const TOTAL = B.thigh + B.shin + B.torso + B.neck + B.head * 2;
  const MOOD = { neutral: 'flat', happy: 'happy', laugh: 'happy', love: 'happy', excited: 'happy', smirk: 'happy', sad: 'sad', cry: 'sad', shocked: 'shock', scared: 'shock', worried: 'shock', thinking: 'curious', curious: 'curious', angry: 'grit', determined: 'grit', yell: 'grit', grit: 'grit', flat: 'flat', shock: 'shock' };
  const STYLES = {
    classic: { ink: '#1E1C1A', head: 'none', accent: '#D7372C', width: 15 },
    filled: { ink: '#1E1C1A', head: '#FFFFFF', accent: '#D7372C', width: 15 },
    chalk: { ink: '#F4F1E8', head: 'none', accent: '#FFD23F', width: 13 },
    neon: { ink: '#7CF7FF', head: 'none', accent: '#FF3DCB', width: 12, glow: true },
    marker: { ink: '#22223B', head: '#FFFFFF', accent: '#FF6B35', width: 18 }
  };

  function solve(hx, hy, fx, fy, l1, l2, bend) {
    let dx = fx - hx, dy = fy - hy;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.5;
    if (d > max) { fx = hx + dx / d * max; fy = hy + dy / d * max; dx = fx - hx; dy = fy - hy; d = max; }
    d = Math.max(d, Math.abs(l1 - l2) + 0.5);
    const a = Math.atan2(dy, dx);
    const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const ka = a - bend * Math.acos(c);
    return [[hx, hy], [hx + Math.cos(ka) * l1, hy + Math.sin(ka) * l1], [fx, fy]];
  }

  function chain(sx, sy, a, b) {
    const ex = sx + Math.cos(a * DEG) * B.upper, ey = sy + Math.sin(a * DEG) * B.upper;
    return [[sx, sy], [ex, ey], [ex + Math.cos(b * DEG) * B.fore, ey + Math.sin(b * DEG) * B.fore]];
  }

  const path = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');

  function pose(t, p, acts, extraX) {
    const o = { lean: 0, head: 0, la: 100, lb: 112, ra: 80, rb: 68, sx: 1, sy: 1, r: 0, y: 0, x: p.x, mood: MOOD[p.expression] || 'flat', walk: null, kick: 0, fall: 0, talk: 0 };
    o.la += Math.sin(t * 1.6) * 3; o.ra -= Math.sin(t * 1.6 + 1) * 3; o.head = Math.sin(t * 0.9) * 2;
    o.sy = 1 + Math.sin(t * 2.2) * 0.008;
    let dist = 0, dir = p.facing === 'left' ? -1 : 1, x = p.x;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1);
      if ((a.do === 'walk' || a.do === 'run') && a.to != null && t >= at) {
        const from = a.from != null ? +a.from : x;
        const kk = a.do === 'run' ? k : smooth(k);
        const nx = lerp(from, +a.to, kk);
        dist += Math.abs(nx - from);
        x = nx;
        if (t < end) { dir = +a.to >= from ? 1 : -1; o.walk = { run: a.do === 'run' }; }
        else if (a.face !== false) dir = +a.to >= from ? 1 : -1;
      }
    });
    o.x = x; o.dir = dir; o.dist = dist;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1), u = t - at;
      const holds = a.do === 'fall' || a.hold;
      const w = holds && t > end ? 1 : env(t, at, end, 0.14);
      if (t >= at && t <= end && a.expression) o.mood = MOOD[a.expression] || o.mood;
      if (!w) return;
      const set = (key, v) => { o[key] = (key === 'la' || key === 'lb' || key === 'ra' || key === 'rb') ? angLerp(o[key], v, w) : lerp(o[key], v, w); };
      switch (a.do) {
        case 'wave': set('ra', -60); set('rb', -100 + Math.sin(t * 13) * 32); o.mood = a.expression ? o.mood : 'happy'; break;
        case 'point': if (a.dir === 'up') { set('ra', -80); set('rb', -86); } else { set('ra', -4); set('rb', -2); } break;
        case 'talk': o.talk = Math.max(o.talk, w); set('ra', 40 + Math.sin(t * 3.4) * 22); set('rb', -20 + Math.sin(t * 4.1) * 30); set('head', Math.sin(t * 5) * 4); break;
        case 'cheer': set('la', -112); set('lb', -100); set('ra', -68); set('rb', -80); o.y -= Math.abs(Math.sin(u * 7)) * 34 * w; o.mood = 'happy'; break;
        case 'shock': case 'double-take': {
          const j = clamp(u / 0.32, 0, 1); o.y -= Math.sin(j * Math.PI) * 40 * w;
          set('la', -118); set('lb', -98); set('ra', -62); set('rb', -82); set('lean', -10); o.mood = 'shock';
          if (a.do === 'double-take') o.head += Math.sin(clamp(u / 0.4, 0, 1) * Math.PI * 2) * 20 * w;
          break;
        }
        case 'think': set('ra', 70); set('rb', -110); set('head', -8); o.mood = 'curious'; break;
        case 'shrug': set('la', 150); set('lb', 200); set('ra', 30); set('rb', -20); set('head', 8); break;
        case 'punch': { const s = u < 0.18 ? -smooth(u / 0.18) : smooth((u - 0.18) / 0.08); set('ra', s < 0 ? lerp(80, 150, -s) : lerp(150, -2, s)); set('rb', s < 0 ? lerp(68, -150, -s) : lerp(-150, -2, s)); set('lean', s > 0 ? 10 : -6); o.mood = 'grit'; break; }
        case 'kick': { const s = Math.sin(clamp(u / Math.min(0.6, end - at), 0, 1) * Math.PI); o.kick = s * w; set('lean', -12 * s); set('la', 130); set('ra', 30); o.mood = 'grit'; break; }
        case 'fall': o.fall = out(k) * w; set('la', -150); set('ra', -40); o.mood = 'shock'; break;
        case 'nod': o.head += Math.sin(k * Math.PI * 4) * 10 * w; break;
        case 'shake': o.head += Math.sin(k * Math.PI * 6) * 14 * w; break;
        case 'look': o.look = (a.dir === 'back' ? -1 : 1) * w; break;
        case 'crouch': o.crouch = Math.max(o.crouch || 0, w); set('lean', 14); break;
        case 'jump': {
          const T = Math.max(0.9, end - at);
          const ph = u / T;
          const keys = [[0, 1, 1, 0], [0.16, 1.18, 0.7, 0], [0.24, 0.88, 1.12, 0], [0.62, 0.95, 1.06, 1], [0.7, 1.4, 0.6, 0], [0.82, 0.92, 1.08, 0], [1, 1, 1, 0]];
          let i = 1; while (i < keys.length - 1 && ph > keys[i][0]) i++;
          const a0 = keys[i - 1], a1 = keys[i], f = smooth((ph - a0[0]) / Math.max(0.001, a1[0] - a0[0]));
          o.sx = lerp(a0[1], a1[1], f); o.sy = lerp(a0[2], a1[2], f);
          const air = clamp((ph - 0.24) / 0.46, 0, 1);
          o.y -= (ph > 0.24 && ph < 0.7 ? 4 * air * (1 - air) : 0) * (+a.height || 150);
          o.tuck = ph > 0.28 && ph < 0.66 ? Math.sin((ph - 0.28) / 0.38 * Math.PI) : 0;
          o.crouch = Math.max(o.crouch || 0, ph < 0.24 ? Math.sin(ph / 0.24 * Math.PI) * 0.8 : ph > 0.7 && ph < 0.86 ? Math.sin((ph - 0.7) / 0.16 * Math.PI) * 0.9 : 0);
          set('la', ph < 0.24 ? 140 : -120); set('lb', ph < 0.24 ? 120 : -100); set('ra', ph < 0.24 ? 40 : -60); set('rb', ph < 0.24 ? 60 : -80);
          if (ph > 0.3 && ph < 0.62) o.mood = 'happy';
          break;
        }
      }
    });
    if (o.walk) {
      o.lean = lerp(o.lean, o.walk.run ? 14 : 3, 1);
      const sw = Math.sin(o.dist / 232 * Math.PI * 2);
      o.la = 90 - sw * (o.walk.run ? 40 : 24); o.lb = o.la - (o.walk.run ? 80 : 20);
      o.ra = 90 + sw * (o.walk.run ? 40 : 24); o.rb = o.ra - (o.walk.run ? 80 : 20);
    }
    return o;
  }

  function face(o, st, t, blink) {
    const s = st;
    const eyeR = 7, ry = blink ? 1 : eyeR;
    const fx = 14;
    let eyes = '', mouth = '', brows = '';
    const ink = s.ink;
    if (o.mood === 'grit') {
      eyes = `<path d="M${fx - 18} -12 l10 6 l-10 6 M${fx + 22} -12 l-10 6 l10 6" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      mouth = `<rect x="${fx - 12}" y="12" width="26" height="11" rx="2" fill="#fff" stroke="${ink}" stroke-width="4"/>`;
    } else {
      eyes = `<ellipse cx="${fx - 10}" cy="-6" rx="${eyeR * 0.8}" ry="${ry}" fill="${ink}"/><ellipse cx="${fx + 14}" cy="-6" rx="${eyeR * 0.8}" ry="${ry}" fill="${ink}"/>`;
      if (o.mood === 'shock' || o.talk > 0.1) {
        const h = o.mood === 'shock' ? 13 : 4 + Math.abs(Math.sin(t * 17)) * 9 * o.talk;
        mouth = `<ellipse cx="${fx + 2}" cy="18" rx="9" ry="${h}" fill="${ink}"/>`;
      } else if (o.mood === 'happy') mouth = `<path d="M${fx - 12} 12 Q${fx + 2} 30 ${fx + 16} 12" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      else if (o.mood === 'sad') mouth = `<path d="M${fx - 10} 22 Q${fx + 2} 10 ${fx + 14} 22" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      else mouth = `<path d="M${fx - 8} 16 L${fx + 12} 16" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
      if (o.mood === 'curious' || o.mood === 'sad') brows = `<path d="M${fx - 18} -22 L${fx - 4} ${o.mood === 'sad' ? -26 : -20} M${fx + 6} ${o.mood === 'sad' ? -26 : -24} L${fx + 22} -20" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`;
      if (o.mood === 'shock') brows = `<path d="M${fx - 18} -24 L${fx - 4} -27 M${fx + 6} -27 L${fx + 22} -24" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`;
    }
    return eyes + brows + mouth;
  }

  reg.define('stickman', {
    category: 'character', description: 'Stick figure actor drawn as one clean ink line (classic, filled head, chalk, neon or marker style) with a real rig: arms posed by angle, legs solved with IK so feet stay planted, walk and run cycles driven by distance travelled (no foot sliding), squash-and-stretch jumps with anticipation and landing, moods (flat, happy, sad, shock, curious, grit) with natural blinks, optional beanie and shirt colour, plus impact bursts and a short stage shake. Same action list style as toon.',
    params: {
      at: { type: 'number', default: 0, doc: 'start time in scene seconds' },
      y: { type: 'number', default: 86, doc: 'ground line in % of frame height' }, h: { type: 'number', default: 46, doc: 'figure height in % of frame height' },
      style: { type: 'enum', default: 'classic', options: Object.keys(STYLES) }, ink: { type: 'string', default: '', doc: 'line colour' }, accent: { type: 'string', default: '' },
      facing: { type: 'enum', default: 'right', options: ['right', 'left'] }, expression: { type: 'string', default: 'neutral' },
      hat: { type: 'enum', default: 'none', options: ['none', 'beanie', 'cap', 'hair'] }, shirt: { type: 'string', default: '', doc: 'shirt colour drawn behind the torso line' },
      actions: { type: 'array', default: [], doc: '[{do: walk|run (to: x%), wave, point (dir up), talk, cheer, shock, double-take, think, shrug, punch, kick, fall, nod, shake, crouch, jump (height), at, duration, expression}]' },
      impacts: { type: 'array', default: [], doc: '[{at, x, y}] burst of speed strokes plus a 0.16 s stage shake at each contact' },
      shadow: { type: 'boolean', default: true }
    },
    example: "component('stickman', { x: 30, actions: [{ do: 'walk', at: 0.2, duration: 1.6, to: 55 }, { do: 'shock', at: 2, duration: 1 }], impacts: [{ at: 2.0 }] })"
  }, (ctx, p, h) => {
    const st = Object.assign({}, STYLES[p.style] || STYLES.classic);
    if (p.ink) st.ink = p.ink;
    if (p.accent) st.accent = p.accent;
    const W = ctx.W, H = ctx.H;
    const k = (p.h / 100 * H) / TOTAL;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-stickman', { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { height: '100%', pointerEvents: 'none', overflow: 'visible' });
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;overflow:visible${st.glow ? `;filter:drop-shadow(0 0 6px ${st.ink}) drop-shadow(0 0 16px ${st.accent})` : ''}"><g class="sm-shadow"></g><g class="sm-root"></g><g class="sm-fx"></g></svg>`;
    const root = el.querySelector('.sm-root'), shadowG = el.querySelector('.sm-shadow'), fxG = el.querySelector('.sm-fx');
    const acts = p.actions || [];
    const { at, end } = h.span(p);
    const impacts = (p.impacts || []).map((m) => ({ at: +m.at || 0, x: m.x, y: m.y }));
    const stage = h.root();
    if (at > 0) {
      ctx.tl.set(el, { autoAlpha: 0 }, 0);
      ctx.tl.set(el, { autoAlpha: 1 }, at);
    }
    ctx.onFrame((t) => {
      const o = pose(t, Object.assign({}, p, { x: +p.x || 40 }), acts);
      const gx = o.x / 100 * W, gy = p.y / 100 * H;
      const crouch = o.crouch || 0;
      const legH = (B.thigh + B.shin) * (1 - crouch * 0.32) - 4;
      const hipY = -legH;
      const feet = [0, 1].map((i) => {
        let fx = i ? 18 : -18, fy = 0;
        if (o.walk) {
          const run = o.walk.run, ph = ((o.dist / (run ? 248 : 232)) * 100 / 100 + i * 0.5) % 1;
          const span = run ? 62 : 58;
          fx = ph < 0.5 ? span - 4 * span * ph : -span + 2 * span * E(ph, 0.5, 1);
          fy = ph < 0.5 ? 0 : -(run ? 70 : 53) * Math.sin((ph - 0.5) * 2 * Math.PI);
        }
        if (o.tuck) { fx = lerp(fx, i ? 30 : 6, o.tuck); fy = lerp(fy, -70, o.tuck); }
        if (o.kick && i === 1) { fx = lerp(fx, 140, o.kick); fy = lerp(fy, -120, o.kick); }
        return [fx, fy];
      });
      const shoulder = [Math.sin(o.lean * DEG) * B.torso, hipY - Math.cos(o.lean * DEG) * B.torso];
      const neckTop = [shoulder[0] + Math.sin((o.lean + o.head) * DEG) * B.neck, shoulder[1] - Math.cos((o.lean + o.head) * DEG) * B.neck];
      const headC = [neckTop[0] + Math.sin((o.lean + o.head) * DEG) * B.head, neckTop[1] - Math.cos((o.lean + o.head) * DEG) * B.head];
      const legs = feet.map((f) => solve(0, hipY, f[0], f[1], B.thigh, B.shin, -1));
      const armL = chain(shoulder[0], shoulder[1], o.la, o.lb), armR = chain(shoulder[0], shoulder[1], o.ra, o.rb);
      const blinkPh = (t + (p.seed || 0) * 0.7) % 3.4;
      const blink = Math.exp(-Math.pow((blinkPh - 2.8) / 0.048, 2)) > 0.5;
      const sw = st.width;
      const ink = st.ink;
      const torso = `M0 ${hipY.toFixed(1)} Q${(shoulder[0] * 0.4 + Math.sin(o.lean * DEG) * 8).toFixed(1)} ${((hipY + shoulder[1]) / 2).toFixed(1)} ${shoulder[0].toFixed(1)} ${shoulder[1].toFixed(1)} L${neckTop[0].toFixed(1)} ${neckTop[1].toFixed(1)}`;
      let svg = '';
      if (p.shirt) svg += `<path d="M0 ${hipY + 6} L${shoulder[0].toFixed(1)} ${(shoulder[1] + 4).toFixed(1)}" stroke="${p.shirt}" stroke-width="${sw * 3.1}" stroke-linecap="round" fill="none"/>`;
      svg += `<path d="${path(armL)}" stroke="${ink}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>`;
      legs.forEach((l, i) => { svg += `<path d="${path(l)}" stroke="${ink}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${i ? 1 : 0.92}"/>`; });
      svg += `<path d="${torso}" stroke="${ink}" stroke-width="${sw + 1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<path d="${path(armR)}" stroke="${ink}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<g transform="translate(${headC[0].toFixed(1)} ${headC[1].toFixed(1)}) rotate(${(o.lean * 0.5 + o.head).toFixed(1)})">`;
      svg += `<circle r="${B.head}" fill="${st.head}" stroke="${ink}" stroke-width="${sw}"/>`;
      if (p.hat === 'beanie') svg += `<path d="M-${B.head + 4} -6 Q0 -${B.head * 2.1} ${B.head + 4} -6 Z" fill="${st.accent}" stroke="${ink}" stroke-width="${sw * 0.7}"/><rect x="-${B.head + 6}" y="-14" width="${(B.head + 6) * 2}" height="14" rx="6" fill="${st.accent}" stroke="${ink}" stroke-width="${sw * 0.6}"/>`;
      if (p.hat === 'cap') svg += `<path d="M-${B.head} -10 Q0 -${B.head * 1.9} ${B.head} -10 Z" fill="${st.accent}" stroke="${ink}" stroke-width="${sw * 0.6}"/><path d="M${B.head - 6} -12 L${B.head + 30} -8" stroke="${ink}" stroke-width="${sw * 0.8}" stroke-linecap="round"/>`;
      if (p.hat === 'hair') svg += `<path d="M-${B.head} -6 Q-${B.head * 0.8} -${B.head * 1.3} 0 -${B.head * 1.05} Q${B.head * 0.9} -${B.head * 1.2} ${B.head} -10 Q${B.head * 1.2} 30 ${B.head * 0.6} 50" stroke="${ink}" stroke-width="${sw * 0.7}" fill="none" stroke-linecap="round"/>`;
      svg += face(o, st, t, blink) + '</g>';
      const fall = o.fall || 0;
      const rot = -o.dir * 0 + fall * -88;
      const lift = o.y;
      root.setAttribute('transform', `translate(${gx.toFixed(1)} ${(gy + lift * k + fall * 10 * k).toFixed(1)}) scale(${(k * o.dir * o.sx).toFixed(4)} ${(k * o.sy).toFixed(4)}) rotate(${(rot * o.dir).toFixed(1)})`);
      root.innerHTML = svg;
      if (p.shadow) {
        const s = clamp(1 + lift / 300, 0.4, 1);
        shadowG.innerHTML = `<ellipse cx="${gx.toFixed(1)}" cy="${(gy + 4).toFixed(1)}" rx="${(70 * k * s).toFixed(1)}" ry="${(12 * k * s).toFixed(1)}" fill="${ink}" opacity="${(0.14 * s).toFixed(3)}"/>`;
      }
      let fx = '', shake = 0;
      impacts.forEach((m, j) => {
        const u = t - m.at;
        if (u < 0 || u > 0.3) return;
        const cx = m.x != null ? m.x / 100 * W : gx + o.dir * 120 * k, cy = m.y != null ? m.y / 100 * H : gy - 260 * k;
        const r0 = (38 + out(u / 0.25) * 75) * k * 1.4, r1 = r0 + 34 * k;
        const op = clamp(1 - u / 0.25, 0, 1);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + j;
          fx += `<line x1="${(cx + Math.cos(a) * r0).toFixed(1)}" y1="${(cy + Math.sin(a) * r0).toFixed(1)}" x2="${(cx + Math.cos(a) * r1).toFixed(1)}" y2="${(cy + Math.sin(a) * r1).toFixed(1)}" stroke="${i % 2 ? st.accent : ink}" stroke-width="${(sw * k * 0.9).toFixed(1)}" stroke-linecap="round" opacity="${op.toFixed(2)}"/>`;
        }
        if (u < 0.16) shake += Math.sin(u * 145) * 5 * (1 - u / 0.16);
      });
      fxG.innerHTML = fx;
      if (stage && impacts.length) stage.style.translate = shake ? `${shake.toFixed(2)}px ${(shake * 0.35).toFixed(2)}px` : '';
    });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });
})();
