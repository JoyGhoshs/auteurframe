(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const R = Math.PI / 180;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const held = (t, on) => { const rate = 24 / (on || 2); return Math.floor(t * rate + 1e-6) / rate; };
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  let uid = 0;

  const SCRIPTS = {
    indigo: { name: 'Indigo night', sky: '#1c2f68', sky2: '#0e1531', ink: '#0c1125', moon: '#dce6ff', accent: '#e23d4c', practical: '#f3c56c', iris: '#e3a04b', skin: '#f2c5b0', hair: '#191720', sclera: '#f7f4ef', line: '#e8efff', coat: '#222a4a' },
    ember: { name: 'Ember dusk', sky: '#e8875a', sky2: '#5c2a3c', ink: '#24121b', moon: '#ffe3b8', accent: '#d8343c', practical: '#ffd36e', iris: '#b5523a', skin: '#f3c3a6', hair: '#2a1a1c', sclera: '#fbf3ea', line: '#ffe9d2', coat: '#4a2a36' },
    noon: { name: 'Paper noon', sky: '#bfe0f2', sky2: '#f3e3c2', ink: '#2b2620', moon: '#fffaf0', accent: '#c9472f', practical: '#fff4dc', iris: '#5d4334', skin: '#f3cbb5', hair: '#33261d', sclera: '#fbf8f2', line: '#2b2620', coat: '#41546e' },
    sakura: { name: 'Sakura morning', sky: '#f9d9e2', sky2: '#c8e0f4', ink: '#2d2233', moon: '#fff6f8', accent: '#e86f92', practical: '#fff1c9', iris: '#6c4a8a', skin: '#f6d2c2', hair: '#3b2a3c', sclera: '#fdf9f7', line: '#fff3f6', coat: '#5a6b9e' },
    festival: { name: 'Festival night', sky: '#2a1642', sky2: '#120a1f', ink: '#120b1b', moon: '#ffd9a3', accent: '#ff4f6e', practical: '#ffb326', iris: '#ffcf9e', skin: '#f2c3ae', hair: '#1a1020', sclera: '#f7f2ee', line: '#fff0e8', coat: '#3c2050' },
    storm: { name: 'Storm grey', sky: '#5d6b7a', sky2: '#262d36', ink: '#11161c', moon: '#e4ecf2', accent: '#3fa7d6', practical: '#f4e9b0', iris: '#5a8fb0', skin: '#e9c4b2', hair: '#14181d', sclera: '#f2f4f5', line: '#dce7ef', coat: '#2b3540' },
    dawn: { name: 'First light', sky: '#ffc9a0', sky2: '#6f7fb8', ink: '#1d1d33', moon: '#fff2dc', accent: '#ef6a4a', practical: '#ffe3a6', iris: '#7a5a3a', skin: '#f3c9b2', hair: '#2b2335', sclera: '#fbf6f0', line: '#fff3e6', coat: '#384a7a' },
    neon: { name: 'Neon city', sky: '#33206e', sky2: '#120b2e', ink: '#0b0716', moon: '#e9f7ff', accent: '#ff3fa4', practical: '#3ff0e0', iris: '#3ff0e0', skin: '#efc2b4', hair: '#2a2148', sclera: '#f4f2f6', line: '#c9f9ff', coat: '#3d2f78' }
  };

  function paints(p) {
    const base = SCRIPTS[p.script] || SCRIPTS.indigo;
    const out = Object.assign({}, base);
    ['ink', 'line', 'accent', 'practical', 'moon', 'sky', 'sky2', 'sclera'].forEach((k) => { if (p[k + 'Color']) out[k] = p[k + 'Color']; });
    return out;
  }

  const HAIR = {
    short: {
      back: 'M-47 -6 Q-52 -62 0 -64 Q52 -62 47 -6 Q44 20 38 26 L-38 26 Q-44 20 -47 -6 Z',
      front: 'M-47 -4 Q-50 -60 0 -63 Q50 -60 47 -4 L41 -14 L36 4 L28 -15 L19 -1 L10 -19 L0 -3 L-10 -20 L-19 -2 L-28 -16 L-36 3 L-41 -14 Z',
      locks: []
    },
    spiky: {
      back: 'M-48 -4 L-62 -30 L-50 -40 L-58 -66 L-34 -62 L-26 -86 L-6 -68 L8 -90 L20 -66 L42 -80 L44 -56 L64 -50 L52 -30 L60 -6 L46 14 L-40 18 Z',
      front: 'M-47 -4 Q-50 -58 0 -62 Q50 -58 47 -4 L42 -10 L40 8 L30 -14 L22 6 L12 -18 L4 2 L-6 -20 L-14 2 L-24 -16 L-32 6 L-40 -10 Z',
      locks: []
    },
    messy: {
      back: 'M-50 0 Q-60 -40 -40 -58 Q-30 -76 -4 -68 Q14 -80 34 -64 Q60 -54 54 -14 Q58 14 48 30 L-44 30 Q-58 18 -50 0 Z',
      front: 'M-48 -2 Q-52 -58 0 -63 Q52 -58 48 -2 L44 -6 L46 12 L34 -10 L30 10 L20 -16 L12 4 L2 -18 L-6 6 L-16 -16 L-24 4 L-34 -12 L-38 10 L-44 -6 Z',
      locks: ['M-46 -6 L-52 34 L-40 20 Z', 'M46 -6 L52 30 L40 18 Z']
    },
    long: {
      back: 'M-50 -16 Q-58 -66 0 -66 Q58 -66 50 -16 L60 96 Q44 108 22 100 L0 104 L-22 100 Q-44 108 -60 96 Z',
      front: 'M-47 -4 Q-50 -60 0 -63 Q50 -60 47 -4 L40 -12 L34 6 L26 -14 L16 2 L8 -18 L-2 0 L-12 -18 L-20 2 L-30 -14 L-38 4 L-42 -10 Z',
      locks: ['M-47 -6 Q-56 30 -50 66 L-40 56 Q-44 24 -40 -2 Z', 'M47 -6 Q56 30 50 66 L40 56 Q44 24 40 -2 Z']
    },
    bob: {
      back: 'M-50 -10 Q-58 -64 0 -66 Q58 -64 50 -10 L54 40 Q40 50 24 44 L-24 44 Q-40 50 -54 40 Z',
      front: 'M-48 -4 Q-52 -60 0 -63 Q52 -60 48 -4 L38 -16 L30 2 L20 -18 L8 -2 L-2 -20 L-14 -2 L-24 -18 L-34 0 L-42 -14 Z',
      locks: ['M-48 -6 Q-54 20 -50 42 L-38 36 Q-42 16 -40 -4 Z', 'M48 -6 Q54 20 50 42 L38 36 Q42 16 40 -4 Z']
    },
    ponytail: {
      back: 'M-47 -6 Q-52 -62 0 -64 Q52 -62 47 -6 Q44 18 38 24 L-38 24 Q-44 18 -47 -6 Z',
      front: 'M-47 -4 Q-50 -60 0 -63 Q50 -60 47 -4 L40 -14 L33 2 L24 -16 L14 0 L6 -20 L-4 -2 L-14 -20 L-22 0 L-32 -14 L-40 2 Z',
      locks: ['M-46 -6 L-50 30 L-40 22 Z', 'M46 -6 L50 30 L40 22 Z'],
      tail: 'M-34 -50 Q-78 -46 -88 6 Q-92 50 -70 92 Q-72 46 -56 14 Q-48 -16 -30 -36 Z'
    },
    twintails: {
      back: 'M-48 -6 Q-52 -62 0 -64 Q52 -62 48 -6 Q46 16 40 24 L-40 24 Q-46 16 -48 -6 Z',
      front: 'M-47 -4 Q-50 -60 0 -63 Q50 -60 47 -4 L38 -16 L30 2 L20 -18 L8 -2 L-2 -20 L-14 -2 L-24 -18 L-34 0 L-42 -14 Z',
      locks: [],
      tails: ['M-44 -40 Q-84 -30 -86 20 Q-88 70 -70 110 Q-66 60 -60 26 Q-56 -6 -40 -26 Z', 'M44 -40 Q84 -30 86 20 Q88 70 70 110 Q66 60 60 26 Q56 -6 40 -26 Z']
    },
    bun: {
      back: 'M-47 -6 Q-52 -62 0 -64 Q52 -62 47 -6 Q44 18 38 24 L-38 24 Q-44 18 -47 -6 Z',
      front: 'M-47 -4 Q-50 -60 0 -63 Q50 -60 47 -4 L36 -18 L26 0 L14 -20 L2 -4 L-10 -20 L-20 -2 L-32 -18 L-42 -4 Z',
      locks: ['M-46 -6 L-48 34 L-40 26 Z', 'M46 -6 L48 34 L40 26 Z'],
      bun: 'M-22 -70 a22 20 0 1 0 44 0 a22 20 0 1 0 -44 0 Z'
    }
  };
  const SHEEN = 'M-36 -36 Q-24 -50 -2 -54 L-3 -50 L-8 -47 L-12 -51 L-17 -45 L-22 -49 L-27 -42 L-31 -45 Z';

  function hairParts(style, P, c, sway) {
    const h = HAIR[style] || HAIR.short;
    const ink = P.ink, lw = 1.6;
    const s = sway || 0;
    const back = `<path d="${h.back}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"/>`
      + (h.tail ? `<g transform="rotate(${f1(s * 6)} -34 -46)"><path d="${h.tail}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"/></g>` : '')
      + (h.tails ? h.tails.map((d, i) => `<g transform="rotate(${f1(s * (i ? -5 : 5))} ${i ? 44 : -44} -36)"><path d="${d}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"/></g>`).join('') : '')
      + (h.bun ? `<path d="${h.bun}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}"/>` : '');
    const locks = h.locks.map((d, i) => `<g transform="rotate(${f1(s * (i ? -3 : 3))} ${i ? 46 : -46} -6)"><path d="${d}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"/></g>`).join('');
    const front = `<path d="${h.front}" fill="${c.hair}" stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"/>`
      + `<path d="${SHEEN}" fill="${c.sheen}" opacity=".7"/>` + locks;
    return { back, front };
  }

  function castColors(p, P) {
    return { hair: p.hairColor || P.hair, skin: p.skin || P.skin, iris: p.iris || P.iris, coat: p.coat || P.coat, accent: p.accent || P.accent, sheen: p.sheen || P.line, pants: p.pants || P.ink };
  }

  function eye(cx, dir, P, c, o, id) {
    const X = (x) => f1(cx + x * dir);
    const ink = P.ink;
    if (o.closed || o.happy) {
      const d = o.happy ? `M${X(-11)} 7 Q${X(1)} -4 ${X(13)} 5` : `M${X(-11)} 5 Q${X(1)} 10 ${X(13)} 3`;
      return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
    }
    const sy = o.wide ? 1.12 : o.narrow ? 0.8 : 1;
    const ty = o.narrow ? 2 : 0;
    const sclera = `M${X(-12)} 4 Q${X(-1)} -9 ${X(14)} -2 Q${X(13)} 10 ${X(2)} 13 Q${X(-8)} 13 ${X(-12)} 4 Z`;
    const gx = cx + dir + (o.gaze || 0) * 4;
    const ir = o.wide ? [5, 6.5] : [6.5, 8.5];
    const cid = `ae${id}${dir > 0 ? 'r' : 'l'}`;
    return `<g transform="translate(0 ${f1(4 + ty)}) scale(1 ${sy}) translate(0 -4)">
      <defs><clipPath id="${cid}"><path d="${sclera}"/></clipPath></defs>
      <path d="${sclera}" fill="${P.sclera}"/>
      <g clip-path="url(#${cid})">
        <ellipse cx="${f1(gx)}" cy="5" rx="${ir[0]}" ry="${ir[1]}" fill="${c.iris}"/>
        <ellipse cx="${f1(gx)}" cy="6" rx="${f1(ir[0] * 0.42)}" ry="${f1(ir[1] * 0.48)}" fill="${P.ink}"/>
        <rect x="${f1(gx - 4)}" y="-1" width="3.2" height="4.4" rx=".6" fill="${P.sclera}" transform="rotate(-14 ${f1(gx)} 1)"/>
        <circle cx="${f1(gx + 2.6)}" cy="9.5" r="1.2" fill="${P.sclera}"/>
        <path d="M${X(-14)} -12 L${X(16)} -12 L${X(16)} ${o.narrow ? 0 : -14} Z" fill="${c.skin}"/>
      </g>
      <path d="M${X(-13)} 5 Q${X(-2)} -11 ${X(15)} -3 L${X(17)} 0 L${X(13)} -1 Q${X(-1)} -6 ${X(-11)} 6 Z" fill="${ink}"/>
      <path d="M${X(14)} -2 L${X(19)} -5 L${X(15)} 1 Z" fill="${ink}"/>
      ${o.wide ? '' : `<path d="M${X(4)} 13 Q${X(9)} 12.5 ${X(12)} 8.5" fill="none" stroke="${ink}" stroke-width="1.1" stroke-linecap="round"/>`}
    </g>`;
  }

  function brow(cx, dir, c, o) {
    const X = (x) => f1(cx + x * dir);
    const tilt = o.angry ? 16 : o.sad ? -14 : 0;
    const lift = o.wide ? -5 : o.angry ? 2 : 0;
    return `<g transform="translate(0 ${lift}) rotate(${f1(-tilt * dir)} ${X(-10)} -12)"><path d="M${X(-10)} -11 Q${X(2)} -17 ${X(14)} -12 L${X(14)} -10 Q${X(2)} -14 ${X(-10)} -9 Z" fill="${c.hair}"/></g>`;
  }

  const MOUTHS = {
    rest: (P) => `<path d="M-5 0 Q0 1.6 5 0" fill="none" stroke="${P.ink}" stroke-width="1.5" stroke-linecap="round"/>`,
    smile: (P) => `<path d="M-7 -1 Q0 5 7 -1" fill="none" stroke="${P.ink}" stroke-width="1.6" stroke-linecap="round"/>`,
    frown: (P) => `<path d="M-6 2 Q0 -3 6 2" fill="none" stroke="${P.ink}" stroke-width="1.5" stroke-linecap="round"/>`,
    open: (P, c) => `<path d="M-6 -1 Q0 -2 6 -1 Q4 7 0 8 Q-4 7 -6 -1 Z" fill="${P.ink}"/><path d="M-3 5 Q0 3 3 5 Q2 7.4 0 7.6 Q-2 7.4 -3 5 Z" fill="${c.accent}" opacity=".7"/>`,
    o: (P) => `<ellipse cx="0" cy="2" rx="3.4" ry="4.4" fill="${P.ink}"/>`,
    shout: (P, c) => `<path d="M-9 -3 Q0 -5 9 -3 Q7 12 0 13 Q-7 12 -9 -3 Z" fill="${P.ink}"/><path d="M-5 8 Q0 5 5 8 Q3 12 0 12.4 Q-3 12 -5 8 Z" fill="${c.accent}" opacity=".7"/>`,
    grit: (P) => `<rect x="-7" y="-2.5" width="14" height="5.5" rx="1.5" fill="${P.sclera}" stroke="${P.ink}" stroke-width="1.3"/><path d="M-7 0.3 H7" stroke="${P.ink}" stroke-width=".8"/>`
  };
  const EXPR = {
    neutral: { mouth: 'rest' }, happy: { mouth: 'smile', happy: true }, smile: { mouth: 'smile' }, sad: { mouth: 'frown', sad: true },
    angry: { mouth: 'grit', angry: true, narrow: true }, surprised: { mouth: 'o', wide: true }, shocked: { mouth: 'shout', wide: true },
    determined: { mouth: 'rest', angry: true, narrow: true }, worried: { mouth: 'frown', sad: true }, crying: { mouth: 'frown', sad: true, tears: true },
    shout: { mouth: 'shout', angry: true }, sleepy: { mouth: 'rest', closed: true }, blush: { mouth: 'smile', blush: true }
  };

  function outfitBust(outfit, P, c) {
    const ink = P.ink;
    const sh = `<path d="M-96 170 Q-90 104 -42 88 L-16 78 L16 78 L42 88 Q90 104 96 170 Z" fill="${c.coat}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
    const shade = `<path d="M-96 170 Q-90 104 -42 88 L-30 84 Q-56 110 -60 170 Z" fill="${ink}" opacity=".2"/>`;
    const parts = {
      uniform: `<path d="M-42 88 L0 132 L42 88 L56 96 L0 150 L-56 96 Z" fill="${P.sclera}" stroke="${ink}" stroke-width="1.2"/><path d="M-10 126 L0 138 L10 126 L16 142 L0 148 L-16 142 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1"/>`,
      coat: `<path d="M-30 84 L-22 64 L0 76 L22 64 L30 84 L14 102 L0 90 L-14 102 Z" fill="${c.coat}" stroke="${ink}" stroke-width="1.4"/><path d="M0 90 V170" stroke="${ink}" stroke-width="1"/>`,
      hoodie: `<path d="M-50 92 Q-40 70 0 72 Q40 70 50 92 Q30 84 0 86 Q-30 84 -50 92 Z" fill="${c.coat}" stroke="${ink}" stroke-width="1.4"/><path d="M-8 92 V128 M8 92 V128" stroke="${P.line}" stroke-width="2"/>`,
      kimono: `<path d="M-30 84 L18 160 M30 84 L-6 124" stroke="${P.sclera}" stroke-width="7"/><path d="M-30 84 L18 160 M30 84 L-6 124" stroke="${ink}" stroke-width="1" opacity=".6"/><path d="M-90 150 H90 V170 H-90 Z" fill="${c.accent}"/>`,
      armor: `<path d="M-92 120 Q-84 90 -50 86 L-40 110 Q-70 112 -92 128 Z M92 120 Q84 90 50 86 L40 110 Q70 112 92 128 Z" fill="${P.line}" stroke="${ink}" stroke-width="1.4"/><path d="M-30 96 H30 L24 132 H-24 Z" fill="${P.line}" opacity=".75" stroke="${ink}" stroke-width="1.2"/>`,
      jacket: `<path d="M-16 80 L-34 130 L-22 134 L0 98 L22 134 L34 130 L16 80" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M-12 80 L0 98 L12 80 Z" fill="${P.sclera}"/>`,
      dress: `<path d="M-40 88 Q0 110 40 88 L44 96 Q0 122 -44 96 Z" fill="${P.sclera}" stroke="${ink}" stroke-width="1.2"/>`,
      shirt: `<path d="M-14 80 L0 98 L14 80 Z" fill="${c.skin}" stroke="${ink}" stroke-width="1.2"/>`
    };
    return sh + shade + (parts[outfit] || parts.shirt);
  }

  function accessory(acc, P, c, sway) {
    const ink = P.ink, s = sway || 0;
    if (acc === 'scarf') return { neck: `<path d="M-30 74 Q0 92 30 74 L32 90 Q0 108 -32 90 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1.4"/><g transform="rotate(${f1(s * 8)} 22 92)"><path d="M18 90 L30 92 L44 150 L28 146 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1.4"/></g>`, head: '' };
    if (acc === 'ribbon') return { neck: `<path d="M0 88 L-16 80 L-16 98 Z M0 88 L16 80 L16 98 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1.2"/><circle cx="0" cy="89" r="3.4" fill="${c.accent}" stroke="${ink}" stroke-width="1"/>`, head: '' };
    if (acc === 'tie') return { neck: `<path d="M-4 84 H4 L6 92 L2 132 L0 136 L-2 132 L-6 92 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1"/>`, head: '' };
    if (acc === 'headband') return { neck: '', head: `<path d="M-49 -30 Q0 -50 49 -30 L48 -22 Q0 -42 -48 -22 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1.2"/><g transform="rotate(${f1(s * 10)} -48 -26)"><path d="M-48 -28 L-76 -18 L-70 -10 L-48 -22 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1.2"/></g>` };
    if (acc === 'hairclip') return { neck: '', head: `<path d="M22 -42 L36 -48 L38 -40 L24 -36 Z" fill="${c.accent}" stroke="${ink}" stroke-width="1"/>` };
    if (acc === 'glasses') return { neck: '', head: `<g fill="none" stroke="${ink}" stroke-width="1.3"><rect x="-34" y="-4" width="26" height="18" rx="5"/><rect x="8" y="-4" width="26" height="18" rx="5"/><path d="M-8 4 H8"/></g>` };
    return { neck: '', head: '' };
  }

  function faceSVG(p, P, c, st, id) {
    const turn = clamp(st.turn, -1, 1);
    const tx = turn * 7;
    const ex = Object.assign({}, EXPR[st.expression] || EXPR.neutral, st.blink ? { closed: true, happy: false } : {});
    const mouth = st.mouth || ex.mouth;
    const hair = hairParts(p.hair, P, c, st.sway);
    const acc = accessory(p.accessory, P, c, st.sway);
    const chin = f1(turn * 6);
    const face = `M-45 -8 Q${f1(-44 + Math.max(0, turn) * 6)} 28 ${f1(-18 + turn * 4)} 44 Q${f1(-6 + turn * 5)} 52 ${chin} 52 Q${f1(6 + turn * 5)} 52 ${f1(18 + turn * 4)} 44 Q${f1(44 + Math.min(0, turn) * 6)} 28 45 -8 Q44 -56 0 -58 Q-44 -56 -45 -8 Z`;
    const farL = turn > 0.35, farR = turn < -0.35;
    const eL = eye(-19 + tx, -1, P, c, Object.assign({}, ex, { gaze: st.gaze }), id);
    const eR = eye(19 + tx, 1, P, c, Object.assign({}, ex, { gaze: st.gaze }), id);
    const eyes = `<g transform="translate(${f1(-19 + tx)} 6) scale(${farL ? 0.84 : 1} 1) translate(${f1(19 - tx)} -6)">${eL}</g><g transform="translate(${f1(19 + tx)} 6) scale(${farR ? 0.84 : 1} 1) translate(${f1(-19 - tx)} -6)">${eR}</g>`;
    const brows = brow(-19 + tx, -1, c, ex) + brow(19 + tx, 1, c, ex);
    const tears = ex.tears ? `<path d="M${f1(-12 + tx)} 18 Q${f1(-14 + tx)} 34 ${f1(-10 + tx)} 46 L${f1(-6 + tx)} 46 Q${f1(-9 + tx)} 32 ${f1(-7 + tx)} 18 Z M${f1(26 + tx)} 18 Q${f1(24 + tx)} 34 ${f1(28 + tx)} 46 L${f1(32 + tx)} 46 Q${f1(29 + tx)} 32 ${f1(31 + tx)} 18 Z" fill="${P.line}" opacity=".75"/>` : '';
    const blush = ex.blush || st.blush ? `<g stroke="${c.accent}" stroke-width="1.3" opacity=".6" stroke-linecap="round"><path d="M${f1(-30 + tx)} 26 l4 -5 M${f1(-25 + tx)} 26 l4 -5 M${f1(-20 + tx)} 26 l4 -5 M${f1(20 + tx)} 26 l4 -5 M${f1(25 + tx)} 26 l4 -5 M${f1(30 + tx)} 26 l4 -5"/></g>` : '';
    return `<g transform="translate(0 ${f1(st.bob || 0)}) rotate(${f1(st.tilt || 0)} 0 60)">
      ${hair.back}
      ${outfitBust(p.outfit, P, c)}
      <path d="M-15 40 L-15 86 Q0 94 15 86 L15 40 Z" fill="${c.skin}" stroke="${P.ink}" stroke-width="1.4"/>
      <path d="M-15 44 Q0 66 15 44 L15 60 Q0 76 -15 60 Z" fill="${P.ink}" opacity=".2"/>
      ${acc.neck}
      ${farR ? '' : `<ellipse cx="${f1(-45 + Math.max(0, turn) * 4)}" cy="10" rx="5" ry="9" fill="${c.skin}" stroke="${P.ink}" stroke-width="1.2"/>`}
      ${farL ? '' : `<ellipse cx="${f1(45 + Math.min(0, turn) * 4)}" cy="10" rx="5" ry="9" fill="${c.skin}" stroke="${P.ink}" stroke-width="1.2"/>`}
      <path d="${face}" fill="${c.skin}" stroke="${P.ink}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M-44 -10 Q-40 -26 -20 -24 L-6 -10 L8 -26 L24 -12 L40 -24 Q46 -14 45 -6 Q30 -4 20 -8 Q0 4 -20 -8 Q-34 -2 -44 -10 Z" fill="${P.ink}" opacity=".2"/>
      ${eyes}
      <path d="M${f1(tx * 1.6 + 2)} 18 L${f1(tx * 1.6 - 1)} 25 L${f1(tx * 1.6 + 3)} 25" fill="none" stroke="${P.ink}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(${f1(tx * 1.1)} 35)">${(MOUTHS[mouth] || MOUTHS.rest)(P, c)}</g>
      ${blush}${tears}
      ${hair.front}
      ${brows}
      ${acc.head}
    </g>`;
  }

  function speechLevel(p) {
    return p.lipsync && window.AU_SPEECH ? window.AU_SPEECH(p.lipsync, p.lipsyncAt) : null;
  }

  function faceState(t, p, acts, seed, level) {
    const tq = held(t, 2);
    const st = { turn: +p.turn || 0, expression: p.expression || 'neutral', gaze: 0, mouth: null, blink: false, sway: 0, bob: 0, tilt: 0, blush: false };
    const blinkEvery = 3.1 + hash(seed) * 1.4;
    const ph = (t + hash(seed + 3) * blinkEvery) % blinkEvery;
    if (ph < 2 / 24) st.blink = true;
    let lastTurnEnd = -1;
    acts.forEach((a) => {
      const at = +a.at || 0, dur = a.duration == null ? 1 : +a.duration, end = at + dur;
      if (t < at) return;
      const inside = t <= end;
      if (a.do === 'turn') {
        const from = a.from != null ? +a.from : st.turn;
        const to = +a.to || 0;
        const k = clamp(Math.floor((t - at) * 12) / 2, 0, 1);
        st.turn = lerp(from, to, k);
        lastTurnEnd = at + 2 / 12;
        return;
      }
      if (!inside) {
        if (a.hold && a.expression) st.expression = a.expression;
        return;
      }
      if (a.expression) st.expression = a.expression;
      if (a.do === 'talk') {
        const shapes = ['open', 'rest', 'o', 'open', 'smile', 'open', 'rest'];
        st.mouth = shapes[Math.floor(hash(Math.floor(tq * 12) + seed) * shapes.length)];
      } else if (a.do === 'blink') st.blink = (t - at) < 2 / 24;
      else if (a.do === 'look') st.gaze = a.dir === 'left' ? -1 : a.dir === 'right' ? 1 : 0;
      else if (a.do === 'nod') st.bob = Math.floor((t - at) * 6) % 2 ? 4 : 0;
      else if (a.do === 'shock') { st.expression = a.expression || 'shocked'; st.bob = (t - at) < 2 / 24 ? -6 : 0; }
      else if (a.do === 'cry') st.expression = 'crying';
      else if (a.do === 'shout') { st.expression = a.expression || 'shout'; st.mouth = 'shout'; }
      else if (a.do === 'laugh') { st.expression = 'happy'; st.mouth = Math.floor(tq * 12) % 2 ? 'open' : 'smile'; st.bob = Math.floor(tq * 12) % 2 ? 2 : 0; }
      else if (a.do === 'blush') st.blush = true;
      else if (a.do === 'tilt') st.tilt = +a.angle || 6;
    });
    if (level) {
      const v = level(t);
      if (v > 0.05) st.mouth = v > 0.5 ? 'open' : v > 0.22 ? 'o' : 'rest';
    }
    if (lastTurnEnd > 0 && t >= lastTurnEnd && t < lastTurnEnd + 6 / 24) st.sway += Math.floor((t - lastTurnEnd) * 12) % 2 ? -1 : 1;
    const wind = +p.wind || 0;
    if (wind) st.sway += (Math.floor(tq * 12) % 4 < 2 ? 1 : -1) * wind;
    return st;
  }

  const FACE_PARAMS = {
    script: { type: 'enum', default: 'indigo', options: Object.keys(SCRIPTS), doc: 'colour script: the closed palette for the whole film' },
    x: { type: 'number', default: 50, doc: 'centre of the bust in % of frame width' }, y: { type: 'number', default: 100, doc: 'bottom of the bust in % of frame height' },
    h: { type: 'number', default: 92, doc: 'bust height in % of frame height (92 close-up, 60 medium close-up)' },
    facing: { type: 'enum', default: 'right', options: ['right', 'left'] },
    hair: { type: 'enum', default: 'short', options: Object.keys(HAIR) }, hairColor: { type: 'string', default: '' }, iris: { type: 'string', default: '' }, skin: { type: 'string', default: '' },
    outfit: { type: 'enum', default: 'coat', options: ['coat', 'uniform', 'hoodie', 'kimono', 'armor', 'jacket', 'dress', 'shirt'] }, coat: { type: 'string', default: '' }, accent: { type: 'string', default: '' },
    accessory: { type: 'enum', default: 'none', options: ['none', 'scarf', 'ribbon', 'tie', 'headband', 'hairclip', 'glasses'] },
    expression: { type: 'enum', default: 'neutral', options: Object.keys(EXPR) }, turn: { type: 'number', default: 0.25, doc: '-1 looks left of frame, 0 front, 1 right' },
    wind: { type: 'number', default: 0, doc: '0 to 1: hair and scarf sway on twos' },
    actions: { type: 'array', default: [], doc: "[{do: talk|blink|turn (to)|look (dir)|nod|shock|cry|shout|laugh|blush|tilt, at, duration, expression, hold}]; expressions cut on the drawing, never tween" },
    lipsync: { type: 'string', default: '', doc: "'voice' or an audio asset id" }, lipsyncAt: { type: 'number', default: 0 },
    enter: { type: 'enum', default: 'cut', options: ['cut', 'none'], doc: 'anime characters cut in with the shot; they never fade in' }
  };

  reg.define('anime-face', {
    category: 'character', description: 'Anime close-up: a cel-painted bust with large eyes (sclera, iris, pupil, two window catchlights), two or three hair masses with one hard sheen band, one hard shadow shape and tapered ink line, in a closed colour script. Acts on twos: talk with lip sync, blink, discrete head turns with hair follow-through, looks, shock, cry, shout, laugh, blush. Use for close-ups and reaction shots in anime films; pair with anime-figure for wide and action shots using the same hair, colours and outfit.',
    params: FACE_PARAMS,
    example: "component('anime-face', { layer: 'ren', script: 'indigo', hair: 'messy', hairColor: '#191720', iris: '#e3a04b', outfit: 'coat', accessory: 'scarf', x: 38, turn: 0.4, actions: [{ do: 'talk', at: 0.4, duration: 1.6 }, { do: 'turn', at: 2.2, to: -0.2 }, { do: 'shock', at: 2.6, duration: 0.8 }] })"
  }, (ctx, p, h) => {
    const P = paints(p), c = castColors(p, P);
    const id = ++uid;
    const hpx = (p.h || 92) / 100 * ctx.H;
    const wpx = hpx * 220 / 250;
    const el = h.box(Object.assign({}, p, { x: null, y: null }), 'auc-anime-face', { x: 0, y: 0 });
    Object.assign(el.style, { left: (p.x / 100 * ctx.W - wpx / 2) + 'px', top: (p.y / 100 * ctx.H - hpx) + 'px', width: wpx + 'px', height: hpx + 'px', overflow: 'visible' });
    const flip = p.facing === 'left' ? -1 : 1;
    el.innerHTML = `<svg viewBox="-110 -80 220 250" width="100%" height="100%" overflow="visible"><g transform="scale(${flip} 1)"><g class="af-body"></g></g></svg>`;
    const g = el.querySelector('.af-body');
    const acts = (p.actions || []).slice().sort((a, b) => (+a.at || 0) - (+b.at || 0));
    const seed = (ctx.seed || 1) * 7 + id * 13;
    const level = speechLevel(p);
    let key = '';
    const draw = (t) => {
      const st = faceState(t, p, acts, seed, level);
      const k = JSON.stringify(st);
      if (k === key) return;
      key = k;
      g.innerHTML = faceSVG(p, P, c, st, id);
    };
    draw(0);
    ctx.onFrame((t) => draw(t));
    const { at, end } = h.span(p);
    if (at > 0.001) { ctx.tl.set(el, { autoAlpha: 0 }, 0); ctx.tl.set(el, { autoAlpha: 1 }, at); }
    if (end < ctx.D - 0.01) ctx.tl.set(el, { autoAlpha: 0 }, end);
    return el;
  });

  const BONE = { neck: 22, torso: 200, upper: 140, fore: 128, thigh: 196, shin: 196, head: 1 };
  const STAND = { lean: 0, head: 0, sL: 8, eL: 8, sR: -6, eR: 6, hL: 4, kL: 2, hR: -4, kR: 2 };
  const mirrorPose = (q) => Object.assign({}, q, { sL: q.sR, eL: q.eR, sR: q.sL, eR: q.eL, hL: q.hR, kL: q.kR, hR: q.hL, kR: q.kL });
  const POSES = {
    stand: STAND,
    breathe: Object.assign({}, STAND, { sL: 10, eL: 12, sR: -4, eR: 10, head: 2 }),
    walk1: { lean: 4, head: 0, sL: -24, eL: 12, sR: 26, eR: 22, hL: 26, kL: 6, hR: -22, kR: 28 },
    walk2: { lean: 3, head: 2, sL: -2, eL: 14, sR: 4, eR: 14, hL: 2, kL: 34, hR: 4, kR: 4, lift: 6 },
    run1: { lean: 18, head: -4, sL: -58, eL: 84, sR: 62, eR: 74, hL: 52, kL: 34, hR: -36, kR: 84 },
    run2: { lean: 15, head: -4, sL: -6, eL: 92, sR: 8, eR: 92, hL: 12, kL: 104, hR: 8, kR: 14, air: 26 },
    crouch: { lean: 30, head: -14, sL: -34, eL: 64, sR: -44, eR: 74, hL: 78, kL: 124, hR: 62, kR: 112 },
    leap: { lean: 8, head: -14, sL: 150, eL: 12, sR: 140, eR: 22, hL: 34, kL: 66, hR: -12, kR: 34, air: 150 },
    land: { lean: 24, head: 6, sL: 40, eL: 30, sR: 50, eR: 40, hL: 70, kL: 116, hR: 40, kR: 90 },
    windup: { lean: -12, head: 6, sL: -62, eL: 44, sR: 168, eR: 64, hL: 28, kL: 34, hR: -26, kR: 22 },
    strike: { lean: 28, head: -6, sL: -44, eL: 34, sR: 98, eR: 4, hL: 48, kL: 54, hR: -42, kR: 12 },
    follow: { lean: 32, head: -2, sL: -30, eL: 30, sR: 60, eR: 8, hL: 50, kL: 60, hR: -44, kR: 14 },
    reach: { lean: 10, head: -6, sL: 12, eL: 12, sR: 124, eR: 8, hL: 10, kL: 6, hR: -10, kR: 6 },
    point: { lean: 2, head: 0, sL: 8, eL: 8, sR: 92, eR: 0, hL: 4, kL: 2, hR: -4, kR: 2 },
    wave1: { lean: 0, head: 4, sL: 8, eL: 8, sR: 150, eR: 24, hL: 4, kL: 2, hR: -4, kR: 2 },
    wave2: { lean: 0, head: 4, sL: 8, eL: 8, sR: 150, eR: -26, hL: 4, kL: 2, hR: -4, kR: 2 },
    kneel: { lean: 8, head: 10, sL: 14, eL: 20, sR: 6, eR: 30, hL: 92, kL: 92, hR: -8, kR: 170 },
    hit: { lean: -24, head: 20, sL: 44, eL: 24, sR: 56, eR: 34, hL: -10, kL: 22, hR: 12, kR: 30 },
    lookup: Object.assign({}, STAND, { lean: -6, head: -26, sL: 14, eL: 8, sR: -10, eR: 8 }),
    crossed: Object.assign({}, STAND, { sL: 26, eL: 112, sR: 24, eR: 116 }),
    fist: Object.assign({}, STAND, { lean: 6, head: -4, sR: 36, eR: 120, sL: -10, eL: 20 }),
    sit: { lean: 4, head: 4, sL: 20, eL: 40, sR: 14, eR: 44, hL: 90, kL: 90, hR: 86, kR: 88, seat: true }
  };
  ['walk1', 'walk2', 'run1', 'run2'].forEach((k) => { POSES[k.replace('1', '3').replace('2', '4')] = mirrorPose(POSES[k]); });

  function fk(q) {
    const hip = [0, 0];
    const up = [Math.sin((q.lean || 0) * R), -Math.cos((q.lean || 0) * R)];
    const neck = [hip[0] + up[0] * BONE.torso, hip[1] + up[1] * BONE.torso];
    const shoulder = [hip[0] + up[0] * (BONE.torso - 18), hip[1] + up[1] * (BONE.torso - 18)];
    const limb = (base, a1, a2, l1, l2, back) => {
      const A = ((q.lean || 0) * (back ? 0 : 1) + a1) * R;
      const j = [base[0] + Math.sin(A) * l1, base[1] + Math.cos(A) * l1];
      const B = A + (back ? -a2 : a2) * R;
      return [j, [j[0] + Math.sin(B) * l2, j[1] + Math.cos(B) * l2]];
    };
    const armL = limb(shoulder, q.sL, q.eL, BONE.upper, BONE.fore, false);
    const armR = limb(shoulder, q.sR, q.eR, BONE.upper, BONE.fore, false);
    const legL = limb(hip, q.hL, q.kL, BONE.thigh, BONE.shin, true);
    const legR = limb(hip, q.hR, q.kR, BONE.thigh, BONE.shin, true);
    const headC = [neck[0] + up[0] * (BONE.neck + 50), neck[1] + up[1] * (BONE.neck + 50)];
    const low = q.seat ? 0 : Math.max(legL[1][1], legR[1][1]);
    return { hip, neck, shoulder, armL, armR, legL, legR, headC, low, up };
  }

  function limb(a, b, c, w1, w2, fill, ink) {
    const line = (p1, p2, w, col) => `<path d="M${f1(p1[0])} ${f1(p1[1])} L${f1(p2[0])} ${f1(p2[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    return line(a, b, w1 + 7, ink) + line(b, c, w2 + 7, ink) + line(a, b, w1, fill) + line(b, c, w2, fill);
  }

  function seg(a, b, w, fill, ink) {
    return `<path d="M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])}" stroke="${ink}" stroke-width="${w + 7}" stroke-linecap="round"/>`
      + `<path d="M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
  }

  function figureSVG(p, P, c, q, st, id) {
    const sil = st.silhouette;
    const ink = P.ink;
    const col = sil ? { hair: st.silFill, skin: st.silFill, coat: st.silFill, pants: st.silFill, accent: st.silFill, iris: st.silFill, sheen: P.line } : c;
    const k = fk(q);
    const shoe = (pt) => `<ellipse cx="${f1(pt[0] + 14)}" cy="${f1(pt[1] + 4)}" rx="30" ry="13" fill="${sil ? st.silFill : ink}"/>`;
    const hand = (pt) => `<circle cx="${f1(pt[0])}" cy="${f1(pt[1])}" r="17" fill="${col.skin}" stroke="${ink}" stroke-width="3.5"/>`;
    const farArm = limb(k.shoulder, k.armL[0], k.armL[1], 38, 32, col.coat, ink) + hand(k.armL[1]);
    const farLeg = limb(k.hip, k.legL[0], k.legL[1], 50, 42, col.pants, ink) + shoe(k.legL[1]);
    const nearLeg = limb(k.hip, k.legR[0], k.legR[1], 52, 44, col.pants, ink) + shoe(k.legR[1]);
    const nearArm = limb(k.shoulder, k.armR[0], k.armR[1], 40, 34, col.coat, ink) + hand(k.armR[1]);
    const pp = [k.up[1] * -1, k.up[0]];
    const P2 = (base, s, d) => [base[0] + pp[0] * s + k.up[0] * d, base[1] + pp[1] * s + k.up[1] * d];
    const sw = (st.sway || 0) * 18 + (st.speed || 0) * -40;
    const long = ['coat', 'kimono', 'dress'].includes(p.outfit);
    const tail = long ? [P2(k.hip, -64 + sw, -110), P2(k.hip, 64 + sw * 0.6, -110)] : [P2(k.hip, -48, -20), P2(k.hip, 48, -20)];
    const torsoPts = [P2(k.shoulder, -62, 10), P2(k.shoulder, 62, 10), P2(k.hip, 48, 0), tail[1], tail[0], P2(k.hip, -48, 0)];
    const torso = `<path d="M${torsoPts.map((v) => f1(v[0]) + ' ' + f1(v[1])).join(' L')} Z" fill="${col.coat}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/>`;
    const torsoShade = sil ? '' : `<path d="M${[P2(k.shoulder, -62, 10), P2(k.shoulder, -20, 6), P2(k.hip, -10, 0), tail[0]].map((v) => f1(v[0]) + ' ' + f1(v[1])).join(' L')} Z" fill="${ink}" opacity=".2"/>`;
    const belt = !sil && p.outfit === 'uniform' ? `<path d="M${f1(P2(k.shoulder, -20, 4)[0])} ${f1(P2(k.shoulder, -20, 4)[1])} L${f1(P2(k.shoulder, 0, -26)[0])} ${f1(P2(k.shoulder, 0, -26)[1])} L${f1(P2(k.shoulder, 20, 4)[0])} ${f1(P2(k.shoulder, 20, 4)[1])}" fill="none" stroke="${c.accent}" stroke-width="12"/>` : '';
    const scarf = p.accessory === 'scarf' ? `<path d="M${f1(k.neck[0] - 28)} ${f1(k.neck[1] + 6)} Q${f1(k.neck[0])} ${f1(k.neck[1] + 20)} ${f1(k.neck[0] + 28)} ${f1(k.neck[1] + 6)} L${f1(k.neck[0] + 26)} ${f1(k.neck[1] + 26)} Q${f1(k.neck[0])} ${f1(k.neck[1] + 40)} ${f1(k.neck[0] - 26)} ${f1(k.neck[1] + 26)} Z" fill="${col.accent}" stroke="${ink}" stroke-width="5"/>`
      + `<path d="M${f1(k.neck[0] - 20)} ${f1(k.neck[1] + 24)} L${f1(k.neck[0] - 90 + sw * 0.8)} ${f1(k.neck[1] + 40 - Math.abs(st.speed || 0) * 30)} L${f1(k.neck[0] - 84 + sw * 0.8)} ${f1(k.neck[1] + 64 - Math.abs(st.speed || 0) * 30)} L${f1(k.neck[0] - 12)} ${f1(k.neck[1] + 36)} Z" fill="${col.accent}" stroke="${ink}" stroke-width="5"/>` : '';
    const hair = hairParts(p.hair, P, col, st.sway);
    const eyes = sil ? '' : `<g><path d="M8 -4 Q16 -10 26 -6" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="18" cy="4" rx="5" ry="${st.blink ? 1 : 9}" fill="${c.iris}" stroke="${ink}" stroke-width="2"/><circle cx="16" cy="0" r="2" fill="${P.sclera}"/>
      <path d="M-22 -4 Q-15 -9 -8 -6" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="-14" cy="4" rx="4" ry="${st.blink ? 1 : 8}" fill="${c.iris}" stroke="${ink}" stroke-width="2"/>
      <path d="${st.mouthOpen ? 'M10 30 Q16 38 22 30 Z' : 'M10 32 Q16 34 22 31'}" fill="${st.mouthOpen ? ink : 'none'}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/></g>`;
    const head = `<g transform="translate(${f1(k.headC[0])} ${f1(k.headC[1])}) rotate(${f1((q.head || 0) + (q.lean || 0) * 0.3)})">${hair.back}
      <path d="M-44 -8 Q-42 26 -12 44 Q4 52 18 44 Q44 26 44 -8 Q42 -54 0 -56 Q-42 -54 -44 -8 Z" fill="${col.skin}" stroke="${ink}" stroke-width="3.5"/>
      ${sil ? '' : `<path d="M-44 -10 Q-30 -2 -18 -8 Q0 4 20 -8 Q30 -4 44 -6 L44 -18 Q0 -10 -44 -22 Z" fill="${ink}" opacity=".2"/>`}${eyes}${hair.front}</g>`;
    const neck = seg(k.neck, [k.neck[0] + k.up[0] * 26, k.neck[1] + k.up[1] * 26], 30, col.skin, ink);
    const body = `${farArm}${farLeg}${nearLeg}${torso}${torsoShade}${belt}${neck}${scarf}${head}${nearArm}`;
    if (sil && st.rim) {
      const lit = body.replace(/(fill|stroke)="(?!none)[^"]*"/g, `$1="${P.line}"`);
      return `<g><g transform="translate(9 -7)" opacity=".85">${lit}</g>${body}</g>`;
    }
    return `<g>${body}</g>`;
  }

  function figureState(t, p, acts) {
    const tq = held(t, 2);
    let x = +p.x || 50, facing = p.facing === 'left' ? -1 : 1;
    let pose = 'stand', speed = 0, smear = null, expr = p.expression || 'neutral', air = 0, talk = false;
    if (Math.floor(tq / 1.5) % 2) pose = 'breathe';
    for (const a of acts) {
      const at = +a.at || 0, dur = a.duration == null ? 1 : +a.duration, end = at + dur, u = tq - at;
      if (tq < at) continue;
      if (a.expression && tq <= end) expr = a.expression;
      if ((a.do === 'walk' || a.do === 'run') && a.to != null) {
        const from = a.from != null ? +a.from : x;
        const k = clamp(u / Math.max(0.01, dur), 0, 1);
        x = lerp(from, +a.to, k);
        if (tq < end) {
          facing = +a.to >= from ? 1 : -1;
          speed = a.do === 'run' ? 1 : 0.4;
          const cyc = a.do === 'run' ? ['run1', 'run2', 'run3', 'run4'] : ['walk1', 'walk2', 'walk3', 'walk4'];
          const per = a.do === 'run' ? 2 / 24 : 6 / 24;
          pose = cyc[Math.floor(u / per + 1e-6) % 4];
        }
        continue;
      }
      if (a.do === 'turn') { facing = a.dir === 'left' ? -1 : a.dir === 'right' ? 1 : -facing; continue; }
      if (tq > end && !a.hold) continue;
      const hold = tq > end;
      switch (a.do) {
        case 'strike': case 'attack': case 'slash': {
          const ant = 4 / 24, sm = 2 / 24;
          if (u < ant) pose = 'windup';
          else if (u < ant + sm) { pose = 'strike'; smear = { travel: a.to != null ? (+a.to - x) : 12 * facing }; }
          else if (u < ant + sm + 4 / 24) pose = 'strike';
          else pose = 'follow';
          if (a.to != null && u >= ant) x = lerp(x, +a.to, clamp((u - ant) / sm, 0, 1));
          if (u >= ant && u < ant + sm && a.to != null) facing = +a.to >= x ? 1 : -1;
          break;
        }
        case 'jump': {
          const ant = 4 / 24, rise = Math.max(0.3, dur - ant - 4 / 24);
          if (u < ant) pose = 'crouch';
          else if (u < ant + rise) { pose = 'leap'; air = Math.sin(clamp((u - ant) / rise, 0, 1) * Math.PI) * (+a.height || 220); }
          else if (u < ant + rise + 4 / 24) pose = 'land';
          else pose = 'stand';
          if (a.to != null) x = lerp(x, +a.to, clamp((u - ant) / rise, 0, 1));
          break;
        }
        case 'wave': pose = Math.floor(u / (6 / 24)) % 2 ? 'wave2' : 'wave1'; break;
        case 'talk': talk = !hold; pose = Math.floor(u / 0.75) % 2 ? 'breathe' : 'stand'; break;
        case 'hit': case 'recoil': pose = u < 2 / 24 ? 'hit' : (hold ? 'stand' : 'hit'); break;
        default: if (POSES[a.do]) pose = a.do;
      }
    }
    return { x, facing, pose, speed, smear, expr, air, talk };
  }

  const FIG_PRESETS = {
    schoolgirl: { hair: 'twintails', hairColor: '#3b2a3c', outfit: 'uniform', coat: '#24345e', accent: '#e23d4c', accessory: 'ribbon', iris: '#6c4a8a' },
    schoolboy: { hair: 'messy', hairColor: '#1d1b26', outfit: 'uniform', coat: '#1f2a44', accent: '#c9472f', accessory: 'tie', iris: '#5d4334' },
    delinquent: { hair: 'spiky', hairColor: '#c9a227', outfit: 'jacket', coat: '#2b2b2b', accent: '#d8343c', accessory: 'headband', iris: '#b5523a', expression: 'determined' },
    idol: { hair: 'long', hairColor: '#e86f92', outfit: 'dress', coat: '#ff6fa8', accent: '#ffe066', accessory: 'hairclip', iris: '#ff4f6e', expression: 'smile' },
    'shrine-maiden': { hair: 'long', hairColor: '#141218', outfit: 'kimono', coat: '#f4f1ec', accent: '#d8343c', accessory: 'ribbon', iris: '#7a3a3a' },
    samurai: { hair: 'bun', hairColor: '#141218', outfit: 'kimono', coat: '#2d3a5c', accent: '#c9472f', accessory: 'none', iris: '#5a4030', expression: 'determined' },
    ninja: { hair: 'short', hairColor: '#14181d', outfit: 'hoodie', coat: '#22262e', accent: '#d8343c', accessory: 'scarf', iris: '#8a2c2c', expression: 'determined' },
    ronin: { hair: 'messy', hairColor: '#2a2a2e', outfit: 'kimono', coat: '#5a4a3a', accent: '#a83232', accessory: 'scarf', iris: '#6a5a4a' },
    knight: { hair: 'short', hairColor: '#c9a46a', outfit: 'armor', coat: '#9aa6b5', accent: '#3a6ab8', accessory: 'none', iris: '#3a6ab8', expression: 'determined' },
    mage: { hair: 'long', hairColor: '#e6e9f2', outfit: 'coat', coat: '#4a2f7a', accent: '#f3c56c', accessory: 'none', iris: '#7a5ae0' },
    witch: { hair: 'long', hairColor: '#5a2a6a', outfit: 'dress', coat: '#24182e', accent: '#7ae06a', accessory: 'ribbon', iris: '#7ae06a', expression: 'smile' },
    detective: { hair: 'short', hairColor: '#3a2a1d', outfit: 'coat', coat: '#8a6a44', accent: '#2b2620', accessory: 'tie', iris: '#5d4334', expression: 'determined' },
    'office-worker': { hair: 'short', hairColor: '#20202a', outfit: 'shirt', coat: '#e9eef5', pants: '#2b3346', accent: '#3a6ab8', accessory: 'tie', iris: '#4a4a5a' },
    hacker: { hair: 'messy', hairColor: '#3ff0e0', outfit: 'hoodie', coat: '#1b1b2e', accent: '#3ff0e0', accessory: 'glasses', iris: '#3ff0e0' },
    athlete: { hair: 'ponytail', hairColor: '#4a2a1a', outfit: 'shirt', coat: '#ff7a1a', pants: '#1d2433', accent: '#ffffff', accessory: 'headband', iris: '#7a5a3a', expression: 'happy' },
    rocker: { hair: 'spiky', hairColor: '#d8343c', outfit: 'jacket', coat: '#141414', accent: '#c0c0c0', accessory: 'none', iris: '#d8343c', expression: 'shout' },
    chef: { hair: 'short', hairColor: '#2a1a1c', outfit: 'shirt', coat: '#ffffff', pants: '#2b2b2b', accent: '#d8343c', accessory: 'scarf', iris: '#5d4334', expression: 'happy' },
    doctor: { hair: 'bob', hairColor: '#2b2335', outfit: 'coat', coat: '#f6f7fa', accent: '#3fa7d6', accessory: 'glasses', iris: '#5a8fb0' },
    soldier: { hair: 'short', hairColor: '#2a2418', outfit: 'jacket', coat: '#566b3a', pants: '#3f4a2a', accent: '#c9a227', accessory: 'none', iris: '#4a5a3a', expression: 'determined' },
    pilot: { hair: 'short', hairColor: '#6a4a2a', outfit: 'jacket', coat: '#7a5a3a', accent: '#ffffff', accessory: 'scarf', iris: '#3a6ab8' },
    princess: { hair: 'long', hairColor: '#f3d27a', outfit: 'dress', coat: '#f7a8c8', accent: '#ffd36e', accessory: 'hairclip', iris: '#3fa7d6', expression: 'smile' },
    butler: { hair: 'short', hairColor: '#e4ecf2', outfit: 'coat', coat: '#141418', accent: '#ffffff', accessory: 'tie', iris: '#4a4a5a' },
    sensei: { hair: 'messy', hairColor: '#cfd4dc', outfit: 'jacket', coat: '#2f3e5c', accent: '#ef6a4a', accessory: 'glasses', iris: '#5a6a8a', expression: 'smile' },
    cyberpunk: { hair: 'bob', hairColor: '#ff3fa4', outfit: 'jacket', coat: '#1b1036', accent: '#3ff0e0', accessory: 'glasses', iris: '#ff3fa4' },
    'street-fighter': { hair: 'spiky', hairColor: '#141218', outfit: 'shirt', coat: '#d8343c', pants: '#2a2a3a', accent: '#ffffff', accessory: 'headband', iris: '#5a3a2a', expression: 'determined' },
    'sakura-girl': { hair: 'bob', hairColor: '#e86f92', outfit: 'uniform', coat: '#f4f1ec', accent: '#e86f92', accessory: 'hairclip', iris: '#6c4a8a', expression: 'blush' }
  };

  const FIG_PARAMS = {
    preset: { type: 'enum', default: '', options: [''].concat(Object.keys(FIG_PRESETS)), doc: 'ready-made character look; any hair, outfit or colour you set overrides it' },
    script: FACE_PARAMS.script,
    x: { type: 'number', default: 50, doc: 'feet centre in % of frame width' }, y: { type: 'number', default: 90, doc: 'ground line in % of frame height' },
    h: { type: 'number', default: 60, doc: 'figure height in % of frame height' }, facing: { type: 'enum', default: 'right', options: ['right', 'left'] },
    hair: FACE_PARAMS.hair, hairColor: FACE_PARAMS.hairColor, iris: FACE_PARAMS.iris, skin: FACE_PARAMS.skin, outfit: FACE_PARAMS.outfit, coat: FACE_PARAMS.coat,
    pants: { type: 'string', default: '' }, accent: FACE_PARAMS.accent, accessory: FACE_PARAMS.accessory, expression: FACE_PARAMS.expression,
    silhouette: { type: 'enum', default: 'auto', options: ['auto', 'on', 'off'], doc: 'auto draws figures under 32% of frame height as flat silhouettes, the way wide anime shots do' },
    pose: { type: 'enum', default: 'stand', options: Object.keys(POSES) },
    wind: { type: 'number', default: 0 },
    actions: { type: 'array', default: [], doc: "[{do: walk|run (to: x%)|strike|slash (anticipation 4 frames, smear 2 frames, hold)|jump (height, to)|wave|talk|turn (dir)|hit|reach|point|kneel|lookup|crossed|fist|sit|crouch|stand, at, duration, expression, hold: true}]" },
    enter: FACE_PARAMS.enter
  };

  reg.define('anime-figure', {
    category: 'character', description: 'Anime full-body character in limited animation: discrete key drawings held on twos (walk and run cycles, crouch, leap, land, windup, strike with a one-frame smear, follow-through, wave, reach, point, kneel, hit, sit), never tweened between poses. Same hair, colours and outfit as anime-face so the character matches across shot sizes. Wide shots draw it as a flat silhouette with a rim line.',
    params: FIG_PARAMS,
    example: "component('anime-figure', { layer: 'ren', script: 'indigo', hair: 'messy', outfit: 'coat', accessory: 'scarf', x: 20, h: 64, actions: [{ do: 'run', at: 0.2, duration: 1.4, to: 55 }, { do: 'strike', at: 1.8, duration: 1.2, to: 68, hold: true }] })"
  }, (ctx, p, h) => {
    const pre = FIG_PRESETS[p.preset];
    if (pre) Object.keys(pre).forEach((k) => { const d = FIG_PARAMS[k] ? FIG_PARAMS[k].default : undefined; if (p[k] == null || p[k] === '' || p[k] === d) p[k] = pre[k]; });
    const P = paints(p), c = castColors(p, P);
    const id = ++uid;
    const hpx = (p.h || 60) / 100 * ctx.H;
    const scale = hpx / 820;
    const el = h.box(Object.assign({}, p, { x: null, y: null }), 'auc-anime-figure', { x: 0, y: 0 });
    const wpx = 600 * scale;
    Object.assign(el.style, { left: '0px', top: (p.y / 100 * ctx.H - hpx) + 'px', width: wpx + 'px', height: hpx + 'px', overflow: 'visible' });
    el.innerHTML = `<svg viewBox="-300 -800 600 820" width="100%" height="100%" overflow="visible"><g class="afg-smear"></g><g class="afg-body"></g></svg>`;
    const gb = el.querySelector('.afg-body'), gs = el.querySelector('.afg-smear');
    const acts = (p.actions || []).slice().sort((a, b) => (+a.at || 0) - (+b.at || 0));
    if (p.pose && p.pose !== 'stand' && !acts.length) acts.push({ do: p.pose, at: 0, duration: ctx.D, hold: true });
    const sil = p.silhouette === 'on' || (p.silhouette !== 'off' && (p.h || 60) < 32);
    let key = '';
    const draw = (t) => {
      const s = figureState(t, p, acts);
      const q = POSES[s.pose] || STAND;
      const blink = (t % 3.7) < 2 / 24;
      const tq = held(t, 2);
      const sway = (+p.wind || 0) ? (Math.floor(tq * 12) % 4 < 2 ? 1 : -1) * (+p.wind || 0) : 0;
      const st = { silhouette: sil, silFill: P.ink, rim: true, sway, speed: s.speed * s.facing, blink, mouthOpen: s.talk && Math.floor(tq * 12) % 2 === 0 };
      const k2 = [s.pose, f1(s.x), s.facing, !!s.smear, f1(s.air), st.blink, st.mouthOpen, sway].join('|');
      if (k2 === key) return;
      key = k2;
      const k = fk(q);
      const lift = (q.air || 0) + s.air;
      const dy = -k.low - lift;
      el.style.left = (s.x / 100 * ctx.W - wpx / 2) + 'px';
      gb.setAttribute('transform', `scale(${s.facing} 1) translate(0 ${f1(dy)})`);
      gb.innerHTML = figureSVG(p, P, c, q, st, id);
      if (s.smear) {
        const dir = Math.sign(s.smear.travel || 1) * s.facing;
        gs.setAttribute('transform', `scale(${s.facing} 1) translate(${f1(-160 * dir)} ${f1(dy)}) scale(1.7 0.92)`);
        gs.innerHTML = `<g opacity=".9">${figureSVG(p, P, c, q, { silhouette: true, silFill: sil ? P.ink : c.coat, sway: 0, speed: 0 }, id)}</g>`
          + `<g fill="${P.line}" opacity=".85"><path d="M-260 -520 L40 -500 L-260 -490 Z"/><path d="M-300 -380 L60 -370 L-300 -362 Z"/><path d="M-240 -240 L20 -232 L-240 -226 Z"/></g>`;
      } else gs.innerHTML = '';
    };
    draw(0);
    ctx.onFrame((t) => draw(t));
    const { at, end } = h.span(p);
    if (at > 0.001) { ctx.tl.set(el, { autoAlpha: 0 }, 0); ctx.tl.set(el, { autoAlpha: 1 }, at); }
    if (end < ctx.D - 0.01) ctx.tl.set(el, { autoAlpha: 0 }, end);
    return el;
  });

  function skylineLayer(rnd, y0, minH, maxH, fill, op, windows, practical) {
    let x = -20, d = '', win = '';
    while (x < 1960) {
      const w = 60 + rnd() * 120, hgt = minH + rnd() * (maxH - minH);
      const top = y0 - hgt;
      d += `M${f1(x)} ${y0} V${f1(top)} H${f1(x + w)} V${y0} Z `;
      if (rnd() < 0.3) d += `M${f1(x + w * 0.3)} ${f1(top)} V${f1(top - 30 - rnd() * 40)} H${f1(x + w * 0.36)} V${f1(top)} Z `;
      if (windows) {
        for (let wy = top + 18; wy < y0 - 20; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) if (rnd() < windows) win += `M${f1(wx)} ${f1(wy)} h9 v12 h-9 Z `;
      }
      x += w + rnd() * 6;
    }
    return `<path d="${d}" fill="${fill}" opacity="${op}"/>` + (win ? `<path d="${win}" fill="${practical}"/>` : '');
  }

  function setSVG(preset, P, rnd, p) {
    const sky = `<rect x="0" y="0" width="1920" height="1080" fill="url(#asky${p.__id})"/>`;
    const defs = `<defs><linearGradient id="asky${p.__id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky2}"/><stop offset="1" stop-color="${P.sky}"/></linearGradient></defs>`;
    const stars = () => { let s = ''; for (let i = 0; i < 70; i++) s += `M${f1(rnd() * 1920)} ${f1(rnd() * 520)} h2.4 v2.4 h-2.4 Z `; return `<path d="${s}" fill="${P.line}" opacity=".7"/>`; };
    const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="${P.moon}" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="${P.moon}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.18}" fill="${P.sky}" opacity=".18"/>`;
    const hills = (y, amp, fill, op, seed) => { let d = `M0 1080 L0 ${y}`; for (let x = 0; x <= 1920; x += 120) d += ` Q${x + 60} ${f1(y - amp * (0.5 + hash(x + seed) * 0.8))} ${x + 120} ${f1(y + hash(x * 3 + seed) * amp * 0.3)}`; return `<path d="${d} L1920 1080 Z" fill="${fill}" opacity="${op}"/>`; };
    const out = { back: defs + sky, mid: '', front: '' };
    switch (preset) {
      case 'rooftop': case 'city-night':
        out.back += stars() + moon(1460, 250, 92) + skylineLayer(rnd, 820, 120, 420, P.ink, 0.45, 0.05, P.practical) + skylineLayer(rnd, 900, 80, 300, P.ink, 0.8, 0.12, P.practical);
        out.front = preset === 'rooftop' ? `<path d="M0 860 H1920 V1080 H0 Z" fill="${P.ink}"/><path d="M0 860 H1920" stroke="${P.line}" stroke-width="3" opacity=".35"/><path d="M1500 860 V700 H1640 V860 Z M1520 700 L1570 660 L1620 700 Z M180 860 V800 M180 800 H260" fill="${P.ink}" stroke="${P.ink}" stroke-width="8"/>` : `<path d="M0 940 H1920 V1080 H0 Z" fill="${P.ink}"/>`;
        break;
      case 'street-rain': {
        out.back += skylineLayer(rnd, 760, 200, 520, P.ink, 0.55, 0.08, P.practical);
        out.mid = `<path d="M0 760 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".85"/>` + Array.from({ length: 9 }, (_, i) => `<rect x="${f1(80 + i * 220 + rnd() * 40)}" y="${f1(800 + rnd() * 200)}" width="${f1(60 + rnd() * 90)}" height="4" fill="${P.practical}" opacity=".45"/>`).join('')
          + `<path d="M1400 1080 V420 Q1400 380 1440 380 H1520" fill="none" stroke="${P.ink}" stroke-width="16"/><path d="M1500 386 L1590 760 H1300 L1480 386 Z" fill="${P.practical}" opacity=".16"/><rect x="1494" y="376" width="44" height="18" rx="6" fill="${P.practical}"/>`;
        break;
      }
      case 'field-dusk':
        out.back += `<circle cx="1320" cy="640" r="120" fill="${P.practical}" opacity=".9"/>` + hills(700, 120, P.ink, 0.35, 1) + hills(780, 90, P.ink, 0.6, 2) + hills(880, 60, P.ink, 0.9, 3)
          + `<path d="M260 880 V360 M1700 880 V420 M260 400 Q980 520 1700 450" fill="none" stroke="${P.ink}" stroke-width="6"/>`;
        break;
      case 'shrine':
        out.back += moon(380, 220, 70) + hills(760, 160, P.ink, 0.5, 4) + `<path d="M0 860 H1920 V1080 H0 Z" fill="${P.ink}"/>`
          + `<g fill="${P.accent}" stroke="${P.ink}" stroke-width="6"><path d="M700 380 H1220 L1240 350 H680 Z"/><rect x="730" y="420" width="460" height="28"/><rect x="770" y="380" width="44" height="480"/><rect x="1106" y="380" width="44" height="480"/></g>`
          + Array.from({ length: 6 }, (_, i) => `<g transform="translate(${180 + i * 300} 760)"><rect x="-6" y="0" width="12" height="100" fill="${P.ink}"/><rect x="-22" y="-44" width="44" height="50" rx="12" fill="${P.practical}" stroke="${P.ink}" stroke-width="5"/></g>`).join('');
        break;
      case 'classroom':
        out.back += `<rect x="0" y="0" width="1920" height="1080" fill="${P.sky}" opacity=".35"/>` + `<g fill="${P.sky}" stroke="${P.ink}" stroke-width="10"><rect x="120" y="120" width="520" height="520"/><rect x="700" y="120" width="520" height="520"/><rect x="1280" y="120" width="520" height="520"/></g>`
          + `<path d="M380 120 V640 M120 380 H640 M960 120 V640 M700 380 H1220 M1540 120 V640 M1280 380 H1800" stroke="${P.ink}" stroke-width="8"/>`
          + `<path d="M0 700 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".88"/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${120 + i * 300} 900 h220 v-20 h-220 Z M${140 + i * 300} 900 v120 M${320 + i * 300} 900 v120" fill="${P.ink}" stroke="${P.ink}" stroke-width="10"/>`).join('');
        break;
      case 'bedroom':
        out.back += `<rect x="0" y="0" width="1920" height="1080" fill="${P.ink}" opacity=".82"/><rect x="1180" y="140" width="520" height="460" fill="url(#asky${p.__id})" stroke="${P.ink}" stroke-width="14"/>` + moon(1520, 300, 56)
          + `<path d="M1440 140 V600 M1180 370 H1700" stroke="${P.ink}" stroke-width="10"/><path d="M1180 600 L1320 1080 H1720 L1700 600 Z" fill="${P.moon}" opacity=".08"/>`
          + `<path d="M120 760 H900 V880 H120 Z M120 700 H260 V760 H120 Z" fill="${P.coat}" stroke="${P.ink}" stroke-width="8"/><path d="M200 500 L260 380 L320 500 Z" fill="${P.practical}"/><path d="M240 500 L120 760 H400 L280 500 Z" fill="${P.practical}" opacity=".15"/>`;
        break;
      case 'seaside':
        out.back += moon(1500, 260, 60) + `<path d="M0 620 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".7"/>` + `<path d="M0 620 H1920" stroke="${P.line}" stroke-width="3" opacity=".5"/>`
          + `<path d="M0 1080 L0 700 L380 640 L520 700 L560 1080 Z" fill="${P.ink}"/><path d="M420 640 V460 H470 V640 Z" fill="${P.sclera}" stroke="${P.ink}" stroke-width="6"/><path d="M410 460 H480 L445 420 Z" fill="${P.accent}"/>`;
        break;
      case 'sakura-path':
        out.back += hills(640, 80, P.ink, 0.25, 6) + `<path d="M760 1080 L900 620 H1020 L1160 1080 Z" fill="${P.moon}" opacity=".6"/>`
          + [[260, 520], [560, 470], [1360, 470], [1660, 520]].map(([x, y]) => `<path d="M${x} 1080 V${y + 120}" stroke="${P.ink}" stroke-width="26"/><ellipse cx="${x}" cy="${y}" rx="230" ry="150" fill="${P.accent}" opacity=".55"/><ellipse cx="${x + 40}" cy="${y - 30}" rx="150" ry="100" fill="${P.accent}" opacity=".75"/>`).join('');
        break;
      case 'ruins':
        out.back += hills(760, 60, P.ink, 0.4, 7) + Array.from({ length: 7 }, (_, i) => { const x = 120 + i * 270 + rnd() * 60, hh = 220 + rnd() * 360; return `<path d="M${f1(x)} 900 V${f1(900 - hh)} L${f1(x + 30)} ${f1(900 - hh - 30)} L${f1(x + 70)} ${f1(900 - hh + 10)} V900 Z" fill="${P.ink}" opacity=".75"/>`; }).join('')
          + `<path d="M0 900 H1920 V1080 H0 Z" fill="${P.ink}"/>`;
        break;
      case 'sky':
        out.back += [[300, 700, 1], [1200, 820, 1.3], [1600, 420, 0.8], [600, 300, 0.7]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-260 60 Q-260 -40 -150 -40 Q-120 -140 0 -130 Q120 -170 170 -60 Q280 -60 280 60 Z" fill="${P.moon}"/><path d="M-260 60 Q-100 20 280 60 L280 70 H-260 Z" fill="${P.ink}" opacity=".15"/></g>`).join('');
        break;
      case 'city-day':
        out.back += `<circle cx="1500" cy="230" r="90" fill="${P.moon}" opacity=".9"/>` + skylineLayer(rnd, 820, 160, 480, P.ink, 0.25, 0.04, P.sky) + skylineLayer(rnd, 900, 100, 340, P.ink, 0.5, 0.08, P.sky2)
          + `<path d="M0 900 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".8"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="${60 + i * 240}" y="980" width="120" height="10" fill="${P.moon}" opacity=".5"/>`).join('');
        break;
      case 'train-platform':
        out.back += hills(700, 70, P.ink, 0.3, 9) + `<path d="M0 760 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".55"/>`
          + `<path d="M0 820 H1920 M0 880 H1920" stroke="${P.line}" stroke-width="6" opacity=".55"/>` + Array.from({ length: 24 }, (_, i) => `<rect x="${i * 84}" y="826" width="40" height="50" fill="${P.ink}" opacity=".5"/>`).join('')
          + `<path d="M0 900 H1920 V1080 H0 Z" fill="${P.ink}"/><path d="M0 900 H1920" stroke="${P.practical}" stroke-width="8" stroke-dasharray="60 30"/>`
          + `<path d="M200 900 V420 M1720 900 V420 M140 420 H1780 L1720 360 H200 Z" fill="${P.ink}" stroke="${P.ink}" stroke-width="18"/><rect x="820" y="470" width="280" height="70" rx="10" fill="${P.practical}" opacity=".9"/>`;
        break;
      case 'convenience-store':
        out.back += stars() + skylineLayer(rnd, 700, 120, 380, P.ink, 0.5, 0.06, P.practical)
          + `<rect x="420" y="380" width="1080" height="520" fill="${P.ink}"/><rect x="460" y="500" width="1000" height="400" fill="${P.practical}" opacity=".85"/><rect x="420" y="400" width="1080" height="70" fill="${P.accent}"/>`
          + Array.from({ length: 5 }, (_, i) => `<rect x="${500 + i * 190}" y="560" width="150" height="16" fill="${P.ink}" opacity=".35"/><rect x="${500 + i * 190}" y="680" width="150" height="16" fill="${P.ink}" opacity=".35"/>`).join('')
          + `<path d="M0 900 H1920 V1080 H0 Z" fill="${P.ink}"/><path d="M460 900 L300 1080 H1620 L1460 900 Z" fill="${P.practical}" opacity=".18"/>`;
        break;
      case 'forest-path':
        out.back += hills(620, 90, P.ink, 0.25, 11) + `<path d="M800 1080 Q900 820 960 640 Q1020 820 1120 1080 Z" fill="${P.moon}" opacity=".35"/>`
          + Array.from({ length: 14 }, (_, i) => { const x = i < 7 ? 40 + i * 110 : 1100 + (i - 7) * 120, s = 0.7 + rnd() * 0.6; return `<g transform="translate(${f1(x)} 1080) scale(${f1(s)})"><rect x="-14" y="-420" width="28" height="420" fill="${P.ink}"/><path d="M0 -720 L-140 -380 H140 Z M0 -600 L-170 -260 H170 Z" fill="${P.ink}" opacity=".9"/></g>`; }).join('');
        break;
      case 'mountain-pass':
        out.back += `<path d="M0 780 L320 340 L520 560 L820 220 L1120 600 L1400 300 L1920 760 V1080 H0 Z" fill="${P.ink}" opacity=".35"/><path d="M820 220 L760 300 L860 290 L900 330 Z M1400 300 L1350 360 L1450 350 Z" fill="${P.moon}"/>`
          + hills(820, 120, P.ink, 0.6, 12) + `<path d="M0 1080 L0 900 Q600 860 1100 940 T1920 920 V1080 Z" fill="${P.ink}"/>`;
        break;
      case 'beach-day':
        out.back += `<circle cx="1480" cy="260" r="110" fill="${P.moon}"/>` + `<path d="M0 560 H1920 V820 H0 Z" fill="${P.sky}" opacity=".9"/><path d="M0 560 H1920" stroke="${P.line}" stroke-width="4" opacity=".6"/>`
          + Array.from({ length: 8 }, (_, i) => `<path d="M${i * 260} ${640 + (i % 3) * 50} q40 -14 80 0" stroke="${P.moon}" stroke-width="6" fill="none" opacity=".7"/>`).join('')
          + `<path d="M0 820 Q960 760 1920 820 V1080 H0 Z" fill="${P.practical}"/><path d="M300 1080 V700 M300 700 Q200 640 120 690 M300 700 Q380 620 470 670 M300 700 Q260 600 180 600" stroke="${P.ink}" stroke-width="18" fill="none"/>`;
        break;
      case 'school-roof':
        out.back += `<circle cx="1460" cy="300" r="80" fill="${P.moon}" opacity=".8"/>` + skylineLayer(rnd, 900, 60, 260, P.ink, 0.35, 0.03, P.sky)
          + `<path d="M0 860 H1920 V1080 H0 Z" fill="${P.ink}" opacity=".9"/>` + `<path d="M0 640 H1920 M0 860 H1920" stroke="${P.ink}" stroke-width="10"/>` + Array.from({ length: 33 }, (_, i) => `<path d="M${i * 60} 640 V860" stroke="${P.ink}" stroke-width="6"/>`).join('');
        break;
      case 'temple-stairs':
        out.back += moon(1480, 230, 64) + hills(620, 140, P.ink, 0.45, 13)
          + `<g fill="${P.accent}" stroke="${P.ink}" stroke-width="6"><path d="M760 300 H1160 L1176 276 H744 Z"/><rect x="784" y="330" width="352" height="22"/><rect x="814" y="300" width="34" height="300"/><rect x="1072" y="300" width="34" height="300"/></g>`
          + Array.from({ length: 12 }, (_, i) => `<rect x="${f1(700 - i * 40)}" y="${600 + i * 40}" width="${f1(520 + i * 80)}" height="40" fill="${P.ink}" opacity="${f1(0.55 + i * 0.035)}" stroke="${P.line}" stroke-opacity=".25" stroke-width="2"/>`).join('');
        break;
      case 'snow-field':
        out.back += hills(640, 110, P.moon, 0.5, 14) + hills(760, 80, P.moon, 0.8, 15) + `<path d="M0 860 Q960 820 1920 860 V1080 H0 Z" fill="${P.moon}"/>`
          + Array.from({ length: 6 }, (_, i) => `<g transform="translate(${180 + i * 320} 860)"><rect x="-8" y="-120" width="16" height="120" fill="${P.ink}"/><path d="M0 -330 L-80 -110 H80 Z" fill="${P.ink}" opacity=".8"/><path d="M0 -330 L-30 -250 H30 Z" fill="${P.moon}"/></g>`).join('');
        break;
      case 'festival-street':
        out.back += stars() + skylineLayer(rnd, 760, 160, 380, P.ink, 0.6, 0.1, P.practical) + `<path d="M0 860 H1920 V1080 H0 Z" fill="${P.ink}"/>`
          + [380, 520].map((y, j) => `<path d="M0 ${y} Q480 ${y + 70} 960 ${y} T1920 ${y}" stroke="${P.ink}" stroke-width="5" fill="none"/>` + Array.from({ length: 12 }, (_, i) => { const x = 80 + i * 160 + j * 60; const yy = y + Math.sin(i * 0.9) * 26 + 40; return `<ellipse cx="${x}" cy="${f1(yy)}" rx="28" ry="38" fill="${i % 2 ? P.accent : P.practical}"/><ellipse cx="${x}" cy="${f1(yy)}" rx="60" ry="70" fill="${P.practical}" opacity=".12"/>`; }).join('')).join('');
        break;
      case 'space':
        out.back += stars() + stars() + `<circle cx="1420" cy="760" r="420" fill="${P.accent}" opacity=".55"/><path d="M960 820 Q1420 640 1900 700" stroke="${P.moon}" stroke-width="10" fill="none" opacity=".45"/>`
          + moon(420, 260, 70) + `<circle cx="1420" cy="760" r="420" fill="none" stroke="${P.moon}" stroke-width="3" opacity=".4"/>`;
        break;
      case 'desert-dunes':
        out.back += `<circle cx="1380" cy="330" r="120" fill="${P.practical}"/>` + hills(720, 120, P.accent, 0.35, 16) + hills(820, 90, P.practical, 0.55, 17) + hills(930, 60, P.ink, 0.8, 18);
        break;
      case 'hallway':
        out.back += `<path d="M0 0 H1920 V1080 H0 Z" fill="${P.sky}" opacity=".35"/><path d="M0 0 L760 360 H1160 L1920 0 Z" fill="${P.ink}" opacity=".25"/><path d="M0 1080 L760 720 H1160 L1920 1080 Z" fill="${P.ink}" opacity=".75"/>`
          + `<rect x="760" y="360" width="400" height="360" fill="${P.moon}" opacity=".85"/>` + [0, 1, 2, 3].map((i) => { const a = 120 + i * 150, b = a * 0.42; return `<path d="M${f1(a * 0.9)} ${f1(b + 40)} V${f1(1080 - b - 40)}" stroke="${P.ink}" stroke-width="${12 - i * 2}"/><path d="M${f1(1920 - a * 0.9)} ${f1(b + 40)} V${f1(1080 - b - 40)}" stroke="${P.ink}" stroke-width="${12 - i * 2}"/>`; }).join('');
        break;
      case 'void': default:
        out.back += `<defs><radialGradient id="avoid${p.__id}" cx="50%" cy="52%" r="60%"><stop offset="0" stop-color="${P.moon}" stop-opacity=".42"/><stop offset="1" stop-color="${P.moon}" stop-opacity=".12"/></radialGradient></defs><rect x="0" y="0" width="1920" height="1080" fill="url(#avoid${p.__id})"/>`;
    }
    return out;
  }

  const SET_PARAMS = {
    script: FACE_PARAMS.script,
    preset: { type: 'enum', default: 'city-night', options: ['city-night', 'rooftop', 'street-rain', 'field-dusk', 'shrine', 'classroom', 'bedroom', 'seaside', 'sakura-path', 'ruins', 'sky', 'city-day', 'train-platform', 'convenience-store', 'forest-path', 'mountain-pass', 'beach-day', 'school-roof', 'temple-stairs', 'snow-field', 'festival-street', 'space', 'desert-dunes', 'hallway', 'void'] },
    weather: { type: 'enum', default: 'none', options: ['none', 'rain', 'snow', 'petals', 'embers', 'fireflies'], doc: 'rain and embers on ones, snow and petals on twos; positions are seeded' },
    push: { type: 'number', default: 1, doc: 'camera push across the shot, 1.06 at most (only on holds; cut closer instead of zooming)' },
    letterbox: { type: 'boolean', default: false }, seed: { type: 'number', default: 0 }
  };

  reg.define('anime-set', {
    category: 'set', description: 'Painted anime background in a closed colour script: sky gradient, moon or sun, layered skylines with lit practical windows, hills, shrine, classroom, bedroom, rainy street, seaside, sakura path, ruins, open sky or a void for action. Weather runs on ones or twos from seeded positions, an optional 100 to 106 percent push holds the shot, and letterbox bars frame cinematic shots.',
    params: SET_PARAMS,
    example: "component('anime-set', { preset: 'rooftop', script: 'indigo', weather: 'rain', push: 1.06, letterbox: true })"
  }, (ctx, p, h) => {
    const P = paints(p);
    const id = ++uid;
    p.__id = id;
    const rnd = mulberry(1000 + (+p.seed || 0) * 31 + (ctx.seed || 0));
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-anime-set', { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { left: '0px', top: '0px', width: '100%', height: '100%', overflow: 'hidden', zIndex: '0' });
    const s = setSVG(p.preset, P, rnd, p);
    const wx = mulberry(77 + (+p.seed || 0));
    const drops = Array.from({ length: p.weather === 'rain' ? 140 : p.weather === 'none' ? 0 : 60 }, () => [wx() * 1920, wx() * 1080, 0.5 + wx() * 0.8]);
    el.innerHTML = `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><g class="as-cam">${s.back}${s.mid}<g class="as-wx"></g>${s.front}</g>`
      + (p.letterbox ? `<rect x="0" y="0" width="1920" height="70" fill="${P.ink}"/><rect x="0" y="1010" width="1920" height="70" fill="${P.ink}"/>` : '') + `</svg>`;
    const cam = el.querySelector('.as-cam'), wxg = el.querySelector('.as-wx');
    const push = clamp(+p.push || 1, 1, 1.08);
    if (push > 1) ctx.tl.fromTo(cam, { scale: 1, transformOrigin: '50% 55%' }, { scale: push, duration: ctx.D, ease: 'power1.inOut' }, 0);
    if (p.weather !== 'none') {
      const on = p.weather === 'rain' || p.weather === 'embers' ? 1 : 2;
      ctx.onFrame((t) => {
        const tq = held(t, on);
        let d = '';
        drops.forEach(([x0, y0, sp], i) => {
          if (p.weather === 'rain') { const y = (y0 + tq * 1900 * sp) % 1180 - 100, x = x0 - (y + 100) * 0.12; d += `M${f1(x)} ${f1(y)} l-12 ${f1(70 * sp)} `; }
          else if (p.weather === 'snow') { const y = (y0 + tq * 90 * sp) % 1120 - 20; const x = x0 + Math.sin(tq * 1.3 + i) * 20; d += `M${f1(x)} ${f1(y)} m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 `; }
          else if (p.weather === 'petals') { const y = (y0 + tq * 120 * sp) % 1120 - 20; const x = (x0 + tq * 60 + Math.sin(tq * 2 + i) * 30) % 1960; d += `M${f1(x)} ${f1(y)} q6 -6 12 0 q-6 6 -12 0 `; }
          else if (p.weather === 'embers') { const y = 1100 - (y0 + tq * 220 * sp) % 1140; const x = x0 + Math.sin(tq * 3 + i) * 24; d += `M${f1(x)} ${f1(y)} h4 v4 h-4 Z `; }
          else if (p.weather === 'fireflies') { if (Math.floor(tq * 4 + i) % 3) { const x = x0 + Math.sin(tq * 0.7 + i) * 40, y = 600 + (y0 % 400) + Math.cos(tq * 0.9 + i) * 30; d += `M${f1(x)} ${f1(y)} m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 `; } }
        });
        const fill = p.weather === 'rain' ? `fill="none" stroke="${P.line}" stroke-width="2.4" opacity=".55"` : p.weather === 'petals' ? `fill="${P.accent}" opacity=".85"` : p.weather === 'embers' || p.weather === 'fireflies' ? `fill="${P.practical}"` : `fill="${P.sclera}" opacity=".9"`;
        wxg.innerHTML = `<path d="${d}" ${fill}/>`;
      });
    }
    return el;
  });

  const FX_PARAMS = {
    script: FACE_PARAMS.script,
    type: { type: 'enum', default: 'speedlines', options: ['speedlines', 'focus', 'impact', 'slash', 'sparks', 'flash'], doc: 'speedlines and focus lines flicker on ones; impact and flash last two frames' },
    x: { type: 'number', default: 50 }, y: { type: 'number', default: 50 }, angle: { type: 'number', default: 0, doc: 'direction of travel for speedlines and slash, degrees' },
    size: { type: 'number', default: 40, doc: 'size in % of frame height' }, color: { type: 'enum', default: 'line', options: ['line', 'accent', 'practical', 'moon', 'ink'] }
  };

  reg.define('anime-fx', {
    category: 'ambient', description: 'Anime effects drawn as flat shapes on ones: parallel speed lines or radial focus lines that flicker every frame, a two-frame impact burst, a tapered blade slash with a trailing smear, sparks and a full-frame flash. Use them inside the one sakuga action shot, not everywhere.',
    params: FX_PARAMS,
    example: "component('anime-fx', { type: 'slash', x: 62, y: 46, angle: -20, at: 1.9, duration: 0.3 })"
  }, (ctx, p, h) => {
    const P = paints(p);
    const col = P[p.color] || P.line;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-anime-fx', { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { left: '0px', top: '0px', width: '100%', height: '100%', pointerEvents: 'none' });
    el.innerHTML = `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><g class="ax"></g></svg>`;
    const g = el.querySelector('.ax');
    const { at, end } = h.span(p);
    const cx = p.x / 100 * 1920, cy = p.y / 100 * 1080, S = p.size / 100 * 1080;
    const seed = Math.round(at * 1000) + 5;
    ctx.onFrame((t) => {
      if (t < at || t > end) { if (g.innerHTML) g.innerHTML = ''; return; }
      const fr = Math.floor((t - at) * 24);
      const rnd = mulberry(seed + fr * 17);
      let s = '';
      if (p.type === 'speedlines') {
        let d = '';
        for (let i = 0; i < 26; i++) { const y = rnd() * 1080, len = 300 + rnd() * 900, x = rnd() * 1920, w = 2 + rnd() * 7; d += `M${f1(x)} ${f1(y - w)} L${f1(x + len)} ${f1(y)} L${f1(x)} ${f1(y + w)} Z `; }
        s = `<g transform="rotate(${p.angle} 960 540)"><path d="${d}" fill="${col}" opacity=".75"/></g>`;
      } else if (p.type === 'focus') {
        let d = '';
        for (let i = 0; i < 48; i++) { const a = rnd() * Math.PI * 2, r0 = S * (0.8 + rnd() * 0.4), r1 = 1400, w = 0.006 + rnd() * 0.012; d += `M${f1(cx + Math.cos(a - w) * r1)} ${f1(cy + Math.sin(a - w) * r1)} L${f1(cx + Math.cos(a) * r0)} ${f1(cy + Math.sin(a) * r0)} L${f1(cx + Math.cos(a + w) * r1)} ${f1(cy + Math.sin(a + w) * r1)} Z `; }
        s = `<path d="${d}" fill="${col}" opacity=".8"/>`;
      } else if (p.type === 'impact') {
        if (fr < 2) { let d = ''; const n = 14; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? S * 0.35 : S * (0.8 + rnd() * 0.5); d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r) + ' '; } s = `<path d="${d}Z" fill="${col}"/><path d="${d}Z" fill="none" stroke="${P.ink}" stroke-width="6" transform="translate(${f1(cx)} ${f1(cy)}) scale(.55) translate(${f1(-cx)} ${f1(-cy)})"/>`; }
        else if (fr < 5) s = `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(S * (0.5 + fr * 0.15))}" fill="none" stroke="${col}" stroke-width="${f1(18 - fr * 3)}"/>`;
      } else if (p.type === 'slash') {
        const k = Math.min(1, fr / 2);
        const arc = `M${f1(-S)} ${f1(S * 0.25)} Q0 ${f1(-S * 0.5)} ${f1(S)} ${f1(-S * 0.1)} Q0 ${f1(-S * 0.3)} ${f1(-S)} ${f1(S * 0.25)} Z`;
        s = `<g transform="translate(${f1(cx)} ${f1(cy)}) rotate(${p.angle}) scale(${f1(0.4 + k * 0.6)} 1)" opacity="${fr > 4 ? 0.5 : 1}"><path d="${arc}" fill="${col}"/><path d="M${f1(-S)} ${f1(S * 0.25)} Q0 ${f1(-S * 0.42)} ${f1(S)} ${f1(-S * 0.1)}" fill="none" stroke="${P.moon}" stroke-width="5"/></g>`;
      } else if (p.type === 'sparks') {
        let d = '';
        for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, r = S * (0.2 + fr * 0.08 + rnd() * 0.3), l = 18 + rnd() * 30; d += `M${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)} l${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l)} `; }
        s = `<path d="${d}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      } else if (p.type === 'flash') {
        if (fr < 2) s = `<rect x="0" y="0" width="1920" height="1080" fill="${col}"/>`;
      }
      if (g.innerHTML !== s) g.innerHTML = s;
    });
    return el;
  });

  window.AU_ANIME = { SCRIPTS, HAIR: Object.keys(HAIR), POSES: Object.keys(POSES), held, paints: (name) => Object.assign({}, SCRIPTS[name] || SCRIPTS.indigo) };
})();
