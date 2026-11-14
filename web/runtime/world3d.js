(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const env = (t, a, e, f) => (t < a || t > e ? 0 : Math.min(1, (t - a) / f, (e - t) / f));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mul = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const LOOKS = {
    lowpoly: { seg: 2, steps: 1, boil: 0, desc: 'faceted low-poly, flat shading, bold colours (stylised 3D cartoon)' },
    felt: { seg: 6, steps: 2, boil: 1, desc: 'handmade felt and fabric with fibres, stitched edges and brass button joints, animated on twos like stop-motion' },
    clay: { seg: 7, steps: 2, boil: 1, desc: 'plasticine clay with soft fingerprints, animated on twos like claymation' },
    toy: { seg: 6, steps: 1, boil: 0, desc: 'glossy plastic toy with clearcoat highlights' },
    paper: { seg: 1, steps: 3, boil: 1.4, desc: 'flat cardstock cut-outs with paper grain, animated on threes' }
  };

  const EXPR = {
    neutral: { brows: [0, 0], mouth: 'smile-small' }, happy: { brows: [-4, 2], mouth: 'smile' }, sad: { brows: [16, -2], mouth: 'frown' },
    angry: { brows: [-20, 4], mouth: 'teeth' }, worried: { brows: [16, -2], mouth: 'wavy', sweat: true }, shocked: { brows: [8, -14], mouth: 'O', eyes: 'big' },
    scared: { brows: [18, -10], mouth: 'wavy', eyes: 'big', sweat: true }, smirk: { brows: [-6, 0], asym: true, mouth: 'smirk' },
    laugh: { brows: [-4, -4], mouth: 'grin', eyes: 'closed' }, determined: { brows: [-16, 2], mouth: 'teeth' }, sleepy: { brows: [0, 3], mouth: 'flat', eyes: 'sleepy' },
    zombie: { brows: [6, 4], mouth: 'groan', eyes: 'zombie' }, love: { brows: [-4, -2], mouth: 'smile', eyes: 'closed', blush: true }, thinking: { brows: [-10, 0], asym: true, mouth: 'flat' },
    yell: { brows: [-14, 0], mouth: 'yell' }, excited: { brows: [-2, -8], mouth: 'grin', eyes: 'big' }
  };

  const PRESETS = {
    scientist: { skin: '#f0c7a0', hair: 'messy', hairColor: '#4a3426', shirt: '#2fa39a', pants: '#2d3a4e', outfit: 'labcoat', extras: ['goggles'] },
    soldier: { skin: '#e6b48f', hair: 'short', hairColor: '#3b2a20', shirt: '#3c4f86', pants: '#3a3f4a', outfit: 'armor', hat: 'helmet', propL: 'shield', prop: 'sword' },
    knight: { skin: '#e6b48f', hair: 'short', hairColor: '#3b2a20', shirt: '#7a2f2f', pants: '#3a3f4a', outfit: 'armor', hat: 'helmet', propL: 'shield', prop: 'sword' },
    kid: { skin: '#c98d62', hair: 'spiky', hairColor: '#231a16', shirt: '#e3a62a', pants: '#2e3542', outfit: 'hoodie', scale: 0.82 },
    'teen-girl': { skin: '#f2c9a5', hair: 'ponytail', hairColor: '#3a2418', shirt: '#d94b3d', pants: '#344a7a', outfit: 'casual', extras: ['backpack'] },
    'teen-boy': { skin: '#d9a47c', hair: 'short', hairColor: '#2b1d16', hat: 'cap', hatColor: '#2f6fd6', shirt: '#7a4fc4', pants: '#2d3442', outfit: 'casual' },
    businessman: { skin: '#e8b996', hair: 'side', hairColor: '#2a2a2e', shirt: '#2b3446', pants: '#2b3446', outfit: 'suit' },
    chef: { skin: '#f0c7a0', hair: 'short', hairColor: '#5a3b26', hat: 'chef', shirt: '#f4f4f0', pants: '#2b2b30', outfit: 'casual', extras: ['mustache'] },
    'old-man': { skin: '#e8bf9c', hair: 'bald', hairColor: '#d8d8d8', shirt: '#7a6a4f', pants: '#4a4a52', outfit: 'casual', extras: ['beard', 'glasses'] },
    hero: { skin: '#f0c7a0', hair: 'side', hairColor: '#1f1a18', shirt: '#2f5fd6', pants: '#1f2a52', outfit: 'casual', extras: ['cape'] },
    astronaut: { skin: '#f0c7a0', hair: 'short', hairColor: '#3b2a20', shirt: '#eef0f4', pants: '#d8dbe2', outfit: 'suit-space', hat: 'space' },
    zombie: { skin: '#9bb57e', hair: 'messy', hairColor: '#2c2c22', shirt: '#6b6f5a', pants: '#3d3a33', outfit: 'casual', expression: 'zombie' },
    farmer: { skin: '#e2ad84', hair: 'short', hairColor: '#6a4628', hat: 'straw', shirt: '#c7473a', pants: '#3a5e9a', outfit: 'overalls' },
    robot: { skin: '#b9c2cf', hair: 'bald', shirt: '#9aa6b6', pants: '#7d8898', outfit: 'robot', face: 'visor' }
  };

  const SETS = {
    none: { time: 'studio' }, studio: { time: 'studio' }, lab: { time: 'lab' }, battlefield: { time: 'sunset' }, suburb: { time: 'day' },
    'living-room': { time: 'interior' }, forest: { time: 'day' }, 'city-night': { time: 'night' }, space: { time: 'space' }
  };

  const LIGHT = {
    studio: { sky: ['#20232c', '#14161d'], key: ['#ffffff', 2.4], fill: 0.8, rim: 1.2, fog: null, ground: '#6a6a72' },
    day: { sky: ['#5fa8ff', '#cfe6ff'], key: ['#fff4e2', 2.6], fill: 1.0, rim: 0.6, fog: ['#cfe6ff', 30, 90], ground: '#9a9a86' },
    sunset: { sky: ['#3a2a5e', '#ff8a4c'], key: ['#ffb27a', 2.6], fill: 0.7, rim: 1.6, fog: ['#c46a5a', 24, 80], ground: '#8a6a58' },
    night: { sky: ['#05070f', '#1b2240'], key: ['#9fb4ff', 1.2], fill: 0.5, rim: 1.8, fog: ['#0b1020', 18, 60], ground: '#3a4058' },
    lab: { sky: ['#071018', '#0e2230'], key: ['#d6efff', 1.8], fill: 0.75, rim: 2.2, fog: ['#081420', 16, 44], ground: '#5a7080' },
    interior: { sky: ['#e8c99a', '#f4dfba'], key: ['#ffe2b8', 2.2], fill: 0.95, rim: 0.7, fog: null, ground: '#b8957a' },
    space: { sky: ['#02030a', '#0b0f24'], key: ['#ffffff', 2.4], fill: 0.35, rim: 1.4, fog: null, ground: '#30364a' }
  };

  function roundBox(T, w, h, d, r, seg) {
    const g = new T.BoxGeometry(w, h, d, seg, seg, seg);
    if (r <= 0) return g;
    const p = g.attributes.position, v = new T.Vector3(), inner = new T.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      inner.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
      v.sub(inner);
      if (v.lengthSq() > 1e-9) v.normalize().multiplyScalar(r);
      v.add(inner);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  function shade(hex, k) {
    const n = parseInt(hex.replace('#', ''), 16);
    const f = (c) => clamp(Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)), 0, 255);
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  function makeKit(T, look, seed) {
    const L = LOOKS[look] || LOOKS.lowpoly;
    const cache = new Map();
    const texCache = new Map();
    const canvasTex = (key, draw, size) => {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas'); c.width = c.height = size || 256;
      draw(c.getContext('2d'), c.width);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      texCache.set(key, tex);
      return tex;
    };
    const felt = (hex, stitch) => canvasTex('felt' + hex + stitch, (x, s) => {
      x.fillStyle = hex; x.fillRect(0, 0, s, s);
      const r = mul(seed + hex.length * 31 + parseInt(hex.slice(1), 16) % 997);
      for (let i = 0; i < 3400; i++) {
        const px = r() * s, py = r() * s, a = r() * Math.PI * 2, l = 2 + r() * 8;
        x.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.1})` : `rgba(0,0,0,${0.05 + r() * 0.1})`;
        x.lineWidth = 0.5 + r() * 0.9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
      }
      if (stitch) { x.setLineDash([10, 8]); x.lineWidth = 2.6; x.strokeStyle = 'rgba(45,28,16,.5)'; x.strokeRect(13, 13, s - 26, s - 26); }
    });
    const clayTex = (hex) => canvasTex('clay' + hex, (x, s) => {
      x.fillStyle = hex; x.fillRect(0, 0, s, s);
      const r = mul(seed + 77);
      for (let i = 0; i < 70; i++) {
        const px = r() * s, py = r() * s, rad = 6 + r() * 26;
        const g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
      x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) { const px = r() * s, py = r() * s; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px, py, 3 + k * 3, r() * 3, r() * 3 + 2.4); x.stroke(); } }
    });
    const paperTex = (hex) => canvasTex('paper' + hex, (x, s) => {
      x.fillStyle = hex; x.fillRect(0, 0, s, s);
      const r = mul(seed + 5);
      for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; x.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2); }
    });
    const mat = (hex, opt) => {
      const o = opt || {};
      const key = hex + '|' + JSON.stringify(o);
      if (cache.has(key)) return cache.get(key);
      let m;
      if (o.glass) m = new T.MeshPhysicalMaterial({ color: hex, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: o.opacity || 0.35 });
      else if (o.emissive) m = new T.MeshStandardMaterial({ color: hex, emissive: new T.Color(o.emissive), emissiveIntensity: o.intensity || 1.5, roughness: 0.4 });
      else if (o.metal) m = new T.MeshStandardMaterial({ color: hex, metalness: 0.85, roughness: o.rough != null ? o.rough : 0.35, flatShading: look === 'lowpoly' });
      else if (look === 'felt') { const tex = felt(hex, !!o.stitch); m = new T.MeshPhysicalMaterial({ color: '#ffffff', map: tex, bumpMap: tex, bumpScale: 2.2, roughness: 1, metalness: 0, sheen: 1, sheenRoughness: 0.85, sheenColor: new T.Color(shade(hex, 0.35)) }); }
      else if (look === 'clay') { const tex = clayTex(hex); m = new T.MeshStandardMaterial({ color: '#ffffff', map: tex, bumpMap: tex, bumpScale: 1.6, roughness: 0.72, metalness: 0 }); }
      else if (look === 'toy') m = new T.MeshPhysicalMaterial({ color: hex, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.18 });
      else if (look === 'paper') { const tex = paperTex(hex); m = new T.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.95, flatShading: true }); }
      else m = new T.MeshStandardMaterial({ color: hex, roughness: 0.78, metalness: 0, flatShading: true });
      if (o.side) m.side = T.DoubleSide;
      cache.set(key, m);
      return m;
    };
    const box = (w, h, d, hex, opt) => {
      const o = opt || {};
      const r = o.r != null ? o.r : Math.min(w, h, d) * (look === 'lowpoly' ? 0.14 : look === 'paper' ? 0 : look === 'toy' ? 0.3 : 0.4);
      const mesh = new T.Mesh(roundBox(T, w, h, d, r, look === 'paper' ? 1 : (o.seg || L.seg)), mat(hex, o));
      mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
      return mesh;
    };
    const cyl = (rt, rb, h, hex, opt) => { const o = opt || {}; const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, o.n || (look === 'lowpoly' ? 8 : 20), 1, !!o.open), mat(hex, o)); m.castShadow = o.shadow !== false; m.receiveShadow = true; return m; };
    const ball = (r, hex, opt) => { const o = opt || {}; const lp = look === 'lowpoly' || look === 'paper'; const m = new T.Mesh(lp ? new T.IcosahedronGeometry(r, o.detail != null ? o.detail : 1) : new T.SphereGeometry(r, 24, 18), mat(hex, o)); m.castShadow = o.shadow !== false; m.receiveShadow = true; return m; };
    const cone = (r, h, hex, opt) => { const o = opt || {}; const m = new T.Mesh(new T.ConeGeometry(r, h, o.n || (look === 'lowpoly' ? 6 : 18)), mat(hex, o)); m.castShadow = o.shadow !== false; m.receiveShadow = true; return m; };
    return { L, look, mat, box, cyl, ball, cone, canvasTex };
  }

  function drawFace(x, s, e, st, look) {
    x.clearRect(0, 0, s, s);
    const felt = look === 'felt' || look === 'clay';
    const ink = '#1c1416';
    const ey = 132, ex = [80, 176];
    const dir = st.eyes * 9;
    const closed = st.blink || e.eyes === 'closed';
    ex.forEach((cx, i) => {
      if (st.visor) return;
      if (closed) { x.strokeStyle = ink; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(cx, ey + 6, 16, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); return; }
      if (e.eyes === 'sleepy') { x.fillStyle = ink; x.beginPath(); x.ellipse(cx + dir, ey + 6, 14, 7, 0, 0, Math.PI); x.fill(); return; }
      if (felt || e.eyes === 'big') {
        const r = felt ? (e.eyes === 'big' ? 30 : 26) : 24;
        x.fillStyle = '#fbfaf6'; x.beginPath(); x.arc(cx, ey, r, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 3; x.stroke();
        x.fillStyle = ink; x.beginPath(); x.arc(cx + dir * 1.2, ey + 2, felt ? 12 : 10, 0, Math.PI * 2); x.fill();
        if (!felt) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + dir + 4, ey - 3, 3.5, 0, Math.PI * 2); x.fill(); }
        return;
      }
      if (e.eyes === 'zombie') { x.fillStyle = '#e8e2b0'; x.beginPath(); x.arc(cx, ey, 16, 0, Math.PI * 2); x.fill(); x.fillStyle = ink; x.beginPath(); x.arc(cx + (i ? 4 : -4), ey + 3, 4, 0, Math.PI * 2); x.fill(); return; }
      x.fillStyle = ink; x.beginPath(); x.ellipse(cx + dir, ey, 16, 22, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + dir + 5, ey - 8, 5.5, 0, Math.PI * 2); x.fill();
    });
    if (st.visor) {
      x.fillStyle = '#0d1a24'; x.beginPath(); x.roundRect(36, 86, 184, 66, 30); x.fill();
      x.fillStyle = '#5fe3ff'; [96, 160].forEach((cx) => { x.beginPath(); x.roundRect(cx - 20, 106 + (closed ? 10 : 0), 40, closed ? 6 : 24, 8); x.fill(); });
    }
    const [ang, lift] = e.brows;
    x.strokeStyle = ink; x.lineCap = 'round'; x.lineWidth = felt ? 9 : 14;
    ex.forEach((cx, i) => {
      if (st.visor) return;
      const sgn = i === 0 ? 1 : -1;
      const a = (e.asym && i === 1 ? -ang * 0.6 : ang) * DEG * sgn;
      const by = ey - (felt ? 44 : 38) + lift;
      x.save(); x.translate(cx, by); x.rotate(-a); x.beginPath(); x.moveTo(-20, 0); x.lineTo(20, 0); x.stroke(); x.restore();
    });
    const my = 196, talk = st.talk;
    x.save(); x.translate(128, my); x.scale(1.35, 1.35); x.translate(-128, -my);
    x.fillStyle = felt ? '#5a1d22' : '#3a1418'; x.strokeStyle = ink; x.lineWidth = 8; x.lineCap = 'round';
    const mouth = talk > 0.12 ? 'talk' : e.mouth;
    if (mouth === 'talk' || mouth === 'O' || mouth === 'yell') {
      const h = mouth === 'talk' ? 8 + talk * 26 : mouth === 'yell' ? 34 : 26, w = mouth === 'yell' ? 34 : mouth === 'O' ? 18 : 22;
      x.beginPath(); x.ellipse(128, my + 4, w, h, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e06a78'; x.beginPath(); x.ellipse(128, my + 4 + h * 0.45, w * 0.6, h * 0.35, 0, 0, Math.PI * 2); x.fill();
      if (mouth === 'yell') { x.fillStyle = '#fff'; x.fillRect(100, my - 26, 56, 9); }
    } else if (mouth === 'grin') {
      x.beginPath(); x.moveTo(90, my - 8); x.quadraticCurveTo(128, my + 46, 166, my - 8); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.fillRect(98, my - 8, 60, 10);
    } else if (mouth === 'teeth') {
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(100, my - 8, 56, 22, 6); x.fill(); x.lineWidth = 6; x.stroke();
      x.lineWidth = 3; x.beginPath(); x.moveTo(100, my + 3); x.lineTo(156, my + 3); x.stroke();
    } else if (mouth === 'smile' || mouth === 'smile-small') {
      const w = mouth === 'smile' ? 32 : 20;
      x.beginPath(); x.arc(128, my - 14, w, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    } else if (mouth === 'frown') { x.beginPath(); x.arc(128, my + 22, 24, Math.PI * 1.2, Math.PI * 1.8); x.stroke(); }
    else if (mouth === 'wavy') { x.beginPath(); x.moveTo(100, my); for (let i = 0; i <= 8; i++) x.lineTo(100 + i * 7, my + (i % 2 ? -6 : 6)); x.stroke(); }
    else if (mouth === 'smirk') { x.beginPath(); x.moveTo(104, my + 4); x.quadraticCurveTo(136, my + 10, 156, my - 10); x.stroke(); }
    else if (mouth === 'groan') { x.beginPath(); x.ellipse(128, my + 4, 24, 12, 0.1, 0, Math.PI * 2); x.fill(); }
    else { x.beginPath(); x.moveTo(106, my); x.lineTo(150, my); x.stroke(); }
    x.restore();
    if (e.blush) { x.fillStyle = 'rgba(255,110,130,.45)'; [60, 196].forEach((cx) => { x.beginPath(); x.ellipse(cx, 160, 20, 11, 0, 0, Math.PI * 2); x.fill(); }); }
    if (e.sweat) { x.fillStyle = '#7cc7ff'; x.beginPath(); x.moveTo(214, 60); x.quadraticCurveTo(232, 92, 214, 98); x.quadraticCurveTo(196, 92, 214, 60); x.fill(); }
  }

  function buildFigure(T, kit, spec, idx) {
    const p = Object.assign({}, PRESETS[spec.preset] || {}, spec);
    const look = kit.look;
    const s = p.scale || 1;
    const root = new T.Group();
    const body = new T.Group(); root.add(body);
    const D = { legLen: 0.66, thigh: 0.33, shin: 0.33, legT: 0.24, torsoW: 0.66, torsoH: 0.66, torsoD: 0.38, headW: 0.62, headH: 0.6, headD: 0.56, armT: 0.2, upper: 0.32, fore: 0.3 };
    if (look === 'felt' || look === 'clay') Object.assign(D, { headW: 0.7, headH: 0.66, headD: 0.62, torsoW: 0.6 });
    const skin = p.skin || '#f0c7a0', shirt = p.shirt || '#3b6fd6', pants = p.pants || '#2d3442', shoes = p.shoes || '#2a2420';
    body.position.y = D.legLen;
    const legs = [];
    [-1, 1].forEach((side) => {
      const hip = new T.Group(); hip.position.set(side * 0.16, 0, 0); body.add(hip);
      const thigh = kit.box(D.legT, D.thigh + 0.04, D.legT, pants); thigh.position.y = -D.thigh / 2; hip.add(thigh);
      const knee = new T.Group(); knee.position.y = -D.thigh; hip.add(knee);
      const shin = kit.box(D.legT * 0.94, D.shin, D.legT * 0.94, pants); shin.position.y = -D.shin / 2; knee.add(shin);
      const foot = kit.box(D.legT * 1.08, 0.12, D.legT * 1.5, shoes); foot.position.set(0, -D.shin + 0.02, 0.06); knee.add(foot);
      legs.push({ hip, knee });
    });
    const spine = new T.Group(); body.add(spine);
    const outfit = p.outfit || 'casual';
    const torsoColor = outfit === 'labcoat' ? '#f3f4f2' : outfit === 'robot' ? shirt : shirt;
    const torso = kit.box(D.torsoW, D.torsoH, D.torsoD, torsoColor, { stitch: look === 'felt' }); torso.position.y = D.torsoH / 2; spine.add(torso);
    const hipBlock = kit.box(D.torsoW * 0.96, 0.18, D.torsoD * 0.96, pants); hipBlock.position.y = -0.02; spine.add(hipBlock);
    if (outfit === 'labcoat') {
      const under = kit.box(D.torsoW * 0.5, D.torsoH * 0.9, 0.02, shirt); under.position.set(0, D.torsoH * 0.52, D.torsoD / 2 + 0.005); spine.add(under);
      [-1, 1].forEach((sd) => { const flap = kit.box(D.torsoW * 0.48, 0.36, 0.06, '#f3f4f2'); flap.position.set(sd * D.torsoW * 0.25, -0.2, D.torsoD / 2 - 0.02); flap.rotation.x = 0.05; spine.add(flap); });
      const back = kit.box(D.torsoW * 0.98, 0.38, 0.06, '#f3f4f2'); back.position.set(0, -0.2, -D.torsoD / 2 + 0.02); spine.add(back);
    }
    if (outfit === 'armor' || outfit === 'robot') {
      const plate = kit.box(D.torsoW * 1.04, D.torsoH * 0.62, D.torsoD * 1.08, outfit === 'robot' ? shade(shirt, -0.15) : '#9aa3ad', { metal: look !== 'felt' && look !== 'clay' }); plate.position.y = D.torsoH * 0.64; spine.add(plate);
      const belt = kit.box(D.torsoW * 1.02, 0.1, D.torsoD * 1.06, '#5a3b22'); belt.position.y = 0.14; spine.add(belt);
    }
    if (outfit === 'suit') { const tie = kit.box(0.08, 0.36, 0.03, '#b83a3a'); tie.position.set(0, D.torsoH * 0.55, D.torsoD / 2 + 0.01); spine.add(tie); const sh = kit.box(0.22, 0.2, 0.02, '#f4f4f0'); sh.position.set(0, D.torsoH * 0.82, D.torsoD / 2 + 0.005); spine.add(sh); }
    if (outfit === 'hoodie') {
      const hood = new T.Mesh(new T.TorusGeometry(0.26, 0.09, 10, 20), kit.mat(shade(shirt, -0.08))); hood.position.set(0, D.torsoH + 0.02, -0.08); hood.rotation.x = Math.PI / 2.4; hood.castShadow = true; spine.add(hood);
      [-1, 1].forEach((sd) => { const cord = kit.cyl(0.012, 0.012, 0.22, '#f4f1ea'); cord.position.set(sd * 0.08, D.torsoH - 0.14, D.torsoD / 2 + 0.03); spine.add(cord); const tip = kit.cyl(0.02, 0.02, 0.05, '#e9e4da'); tip.position.set(sd * 0.08, D.torsoH - 0.26, D.torsoD / 2 + 0.03); spine.add(tip); });
      const pocket = kit.box(D.torsoW * 0.62, 0.16, 0.04, shade(shirt, -0.05)); pocket.position.set(0, 0.18, D.torsoD / 2 + 0.01); spine.add(pocket);
    }
    if (outfit === 'overalls') { const bib = kit.box(D.torsoW * 0.62, D.torsoH * 0.55, 0.03, pants); bib.position.set(0, D.torsoH * 0.32, D.torsoD / 2 + 0.01); spine.add(bib); }
    if (outfit === 'suit-space') { const pack = kit.box(D.torsoW * 0.8, D.torsoH * 0.9, 0.26, '#cfd4dc'); pack.position.set(0, D.torsoH * 0.5, -D.torsoD / 2 - 0.12); spine.add(pack); }
    const extras = new Set(p.extras || []);
    if (extras.has('backpack')) { const bp = kit.box(D.torsoW * 0.78, D.torsoH * 0.8, 0.24, p.backpackColor || '#4b6b3a'); bp.position.set(0, D.torsoH * 0.5, -D.torsoD / 2 - 0.1); spine.add(bp); }
    if (extras.has('cape')) { const cape = kit.box(D.torsoW * 1.1, D.torsoH + 0.55, 0.04, p.capeColor || '#c23b3b', { side: true }); cape.position.set(0, D.torsoH / 2 - 0.26, -D.torsoD / 2 - 0.04); spine.add(cape); }
    const neck = new T.Group(); neck.position.y = D.torsoH; spine.add(neck);
    const head = new T.Group(); neck.add(head);
    if (outfit !== 'robot') { const nk = kit.cyl(0.13, 0.15, 0.16, skin, { n: look === 'lowpoly' ? 8 : 16 }); nk.position.y = 0.02; neck.add(nk); }
    const headMesh = outfit === 'robot' ? kit.box(D.headW, D.headH, D.headD, skin, { metal: true }) : kit.box(D.headW, D.headH, D.headD, skin);
    headMesh.position.y = D.headH / 2 + 0.04; head.add(headMesh);
    const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 256;
    const faceTex = new T.CanvasTexture(faceCanvas); faceTex.colorSpace = T.SRGBColorSpace;
    const face = new T.Mesh(new T.PlaneGeometry(D.headW * 0.94, D.headH * 0.94), new T.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    face.position.set(0, D.headH / 2 + 0.04, D.headD / 2 + 0.006); head.add(face);
    const hairC = p.hairColor || '#2b1d16';
    const top = D.headH + 0.04;
    const hair = p.hair || 'short';
    if (hair !== 'bald' && p.hat !== 'helmet' && p.hat !== 'space') {
      if (hair === 'spiky' || hair === 'messy') {
        const cap = kit.box(D.headW * 1.04, 0.14, D.headD * 1.04, hairC); cap.position.y = top - 0.02; head.add(cap);
        const r = mul(idx * 97 + 13);
        for (let i = 0; i < (hair === 'spiky' ? 11 : 8); i++) {
          const c = kit.cone(0.09 + r() * 0.05, 0.22 + r() * 0.14, hairC, { n: 4 });
          c.position.set((r() - 0.5) * D.headW * 0.9, top + 0.06, (r() - 0.6) * D.headD * 0.8);
          c.rotation.set((r() - 0.5) * 0.9 - 0.3, r() * 3, (r() - 0.5) * 1.1); head.add(c);
        }
        const fringe = kit.box(D.headW * 1.02, 0.12, 0.12, hairC); fringe.position.set(0, top - 0.1, D.headD / 2 - 0.02); fringe.rotation.x = -0.2; head.add(fringe);
      } else {
        const cap = kit.box(D.headW * 1.06, 0.18, D.headD * 1.06, hairC); cap.position.y = top - 0.04; head.add(cap);
        const backH = kit.box(D.headW * 1.06, D.headH * (hair === 'long' || hair === 'ponytail' ? 0.85 : 0.55), 0.12, hairC); backH.position.set(0, top - D.headH * 0.36, -D.headD / 2 - 0.02); head.add(backH);
        if (hair === 'side') { const sw = kit.box(D.headW * 0.6, 0.1, 0.14, hairC); sw.position.set(D.headW * 0.18, top - 0.08, D.headD / 2 - 0.02); sw.rotation.z = -0.25; head.add(sw); }
        if (hair === 'ponytail') { const pt = kit.box(0.14, 0.38, 0.14, hairC); pt.position.set(0, top - 0.3, -D.headD / 2 - 0.14); pt.rotation.x = 0.4; head.add(pt); }
        if (hair === 'bun') { const bn = kit.ball(0.14, hairC); bn.position.set(0, top + 0.08, -0.1); head.add(bn); }
        if (hair === 'curly') { const r = mul(idx + 5); for (let i = 0; i < 9; i++) { const b = kit.ball(0.1, hairC); b.position.set((r() - 0.5) * D.headW, top + 0.02, (r() - 0.5) * D.headD); head.add(b); } }
      }
    }
    const hatC = p.hatColor;
    if (p.hat === 'helmet') {
      const dome = new T.Mesh(new T.SphereGeometry(D.headW * 0.62, look === 'lowpoly' ? 10 : 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(hatC || '#8c949e', { metal: look !== 'felt' && look !== 'clay' }));
      dome.scale.set(1, 0.72, 1); dome.position.y = top - 0.1; dome.castShadow = true; head.add(dome);
      const rim = kit.cyl(D.headW * 0.66, D.headW * 0.66, 0.05, hatC || '#7c838c', { metal: look !== 'felt' && look !== 'clay' }); rim.position.y = top - 0.1; head.add(rim);
      const nose = kit.box(0.06, 0.24, 0.04, hatC || '#7c838c', { metal: true }); nose.position.set(0, top - 0.2, D.headD / 2 + 0.06); head.add(nose);
    } else if (p.hat === 'cap') {
      const c = kit.box(D.headW * 1.06, 0.18, D.headD * 1.06, hatC || '#2f6fd6'); c.position.y = top + 0.02; head.add(c);
      const bill = kit.box(D.headW * 0.8, 0.04, 0.26, hatC || '#2f6fd6'); bill.position.set(0, top - 0.04, D.headD / 2 + 0.12); head.add(bill);
    } else if (p.hat === 'hardhat') {
      const c = new T.Mesh(new T.SphereGeometry(D.headW * 0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat(hatC || '#f2c12e')); c.scale.set(1, 0.8, 1); c.position.y = top - 0.04; c.castShadow = true; head.add(c);
      const rim = kit.cyl(D.headW * 0.72, D.headW * 0.72, 0.04, hatC || '#f2c12e'); rim.position.y = top - 0.04; head.add(rim);
    } else if (p.hat === 'chef') { const c = kit.cyl(0.26, 0.24, 0.3, '#ffffff'); c.position.y = top + 0.15; head.add(c); const puff = kit.ball(0.3, '#ffffff'); puff.position.y = top + 0.38; head.add(puff); }
    else if (p.hat === 'beanie') { const c = kit.box(D.headW * 1.06, 0.26, D.headD * 1.06, hatC || '#e2a33a'); c.position.y = top + 0.02; head.add(c); const pom = kit.ball(0.08, '#ffffff'); pom.position.y = top + 0.2; head.add(pom); }
    else if (p.hat === 'crown') { const c = kit.cyl(0.24, 0.26, 0.16, '#e8b923', { metal: true, open: true, side: true }); c.position.y = top + 0.08; head.add(c); }
    else if (p.hat === 'tophat') { const c = kit.cyl(0.24, 0.24, 0.42, hatC || '#1d1d22'); c.position.y = top + 0.22; head.add(c); const rim = kit.cyl(0.4, 0.4, 0.04, hatC || '#1d1d22'); rim.position.y = top + 0.02; head.add(rim); }
    else if (p.hat === 'straw') { const rim = kit.cyl(0.62, 0.62, 0.04, '#d9b25b'); rim.position.y = top + 0.0; head.add(rim); const c = kit.cyl(0.28, 0.32, 0.2, '#d9b25b'); c.position.y = top + 0.1; head.add(c); }
    else if (p.hat === 'space') { const bubble = new T.Mesh(new T.SphereGeometry(D.headW * 0.86, 28, 20), kit.mat('#bfe6ff', { glass: true, opacity: 0.22 })); bubble.position.y = D.headH / 2 + 0.04; head.add(bubble); }
    if (extras.has('goggles')) {
      const gy = top - 0.13; const band = kit.box(D.headW * 1.08, 0.09, D.headD * 1.08, '#2b2b30'); band.position.y = gy; head.add(band);
      [-1, 1].forEach((sd) => { const fr = kit.cyl(0.13, 0.13, 0.08, '#3a3d44', { n: 16 }); fr.rotation.x = Math.PI / 2 - 0.5; fr.position.set(sd * 0.15, gy + 0.03, D.headD / 2 + 0.03); head.add(fr); const gl = new T.Mesh(new T.CircleGeometry(0.11, 18), kit.mat('#9fe3ff', { glass: true, opacity: 0.55 })); gl.rotation.x = -0.5; gl.position.set(sd * 0.15, gy + 0.05, D.headD / 2 + 0.07); head.add(gl); });
    }
    if (extras.has('glasses')) { [-1, 1].forEach((sd) => { const fr = new T.Mesh(new T.TorusGeometry(0.085, 0.014, 6, 18), kit.mat('#1d1d22')); fr.position.set(sd * 0.15, D.headH / 2 + 0.1, D.headD / 2 + 0.02); head.add(fr); }); }
    if (extras.has('beard')) { const b = kit.box(D.headW * 0.8, 0.22, 0.12, hairC); b.position.set(0, 0.16, D.headD / 2 + 0.02); head.add(b); }
    if (extras.has('mustache')) { const m = kit.box(0.24, 0.06, 0.05, hairC); m.position.set(0, D.headH / 2 - 0.06, D.headD / 2 + 0.02); head.add(m); }
    const arms = [];
    [-1, 1].forEach((side) => {
      const sh = new T.Group(); sh.position.set(side * (D.torsoW / 2 + D.armT / 2 + 0.01), D.torsoH - 0.1, 0); spine.add(sh);
      const sleeve = outfit === 'labcoat' ? '#f3f4f2' : outfit === 'armor' ? '#9aa3ad' : torsoColor;
      const up = kit.box(D.armT, D.upper + 0.04, D.armT, sleeve); up.position.y = -D.upper / 2 + 0.02; sh.add(up);
      if (outfit === 'armor') { const pad = kit.ball(0.17, '#8c949e', { metal: look !== 'felt' && look !== 'clay' }); pad.scale.set(1, 0.7, 1); pad.position.y = 0.04; sh.add(pad); }
      if (look === 'felt' || look === 'clay') { const btn = kit.cyl(0.07, 0.07, 0.04, '#b8892f', { metal: true, n: 16 }); btn.rotation.z = Math.PI / 2; btn.position.set(side * (D.armT / 2 + 0.02), -0.04, 0); sh.add(btn); }
      const el = new T.Group(); el.position.y = -D.upper; sh.add(el);
      const fore = kit.box(D.armT * 0.92, D.fore, D.armT * 0.92, outfit === 'robot' ? sleeve : (p.shortSleeves ? skin : sleeve)); fore.position.y = -D.fore / 2; el.add(fore);
      const hand = kit.ball(D.armT * 0.62, outfit === 'robot' ? '#7d8898' : skin); hand.position.y = -D.fore - 0.04; el.add(hand);
      const grip = new T.Group(); grip.position.y = -D.fore - 0.06; el.add(grip);
      arms.push({ sh, el, grip });
    });
    const uprights = [];
    const addProp = (name, grip, left) => {
      if (!name) return;
      const g = new T.Group(); grip.add(g);
      if (name === 'shield' || name === 'sign' || name === 'umbrella') uprights.push(g);
      if (name === 'shield') { const d = kit.cyl(0.42, 0.42, 0.06, '#8a5a32', { n: look === 'lowpoly' ? 10 : 28 }); d.rotation.x = Math.PI / 2; d.position.set(left ? 0.1 : -0.1, 0.05, 0.14); g.add(d); const boss = kit.ball(0.1, '#9aa3ad', { metal: true }); boss.position.set(left ? 0.1 : -0.1, 0.05, 0.19); g.add(boss); const ring = new T.Mesh(new T.TorusGeometry(0.41, 0.03, 6, 28), kit.mat('#6d737b', { metal: true })); ring.position.set(left ? 0.1 : -0.1, 0.05, 0.17); g.add(ring); }
      else if (name === 'sword') { const blade = kit.box(0.06, 0.03, 0.9, '#d6dbe2', { metal: true, r: 0.01 }); blade.position.z = 0.5; g.add(blade); const guard = kit.box(0.26, 0.05, 0.05, '#6d5330'); guard.position.z = 0.05; g.add(guard); }
      else if (name === 'wrench') { const h = kit.box(0.06, 0.04, 0.5, '#9aa3ad', { metal: true }); h.position.z = 0.25; g.add(h); }
      else if (name === 'phone') { const ph = kit.box(0.14, 0.26, 0.03, '#1d1f26', { r: 0.02 }); ph.position.set(0, 0.04, 0.1); g.add(ph); }
      else if (name === 'book') { const b = kit.box(0.28, 0.36, 0.06, '#7a2f2f'); b.position.set(0, 0.06, 0.12); g.add(b); }
      else if (name === 'cup') { const c = kit.cyl(0.07, 0.06, 0.14, '#f4f1ea'); c.position.set(0, 0.04, 0.1); g.add(c); }
      else if (name === 'torch') { const h = kit.cyl(0.03, 0.04, 0.5, '#6d4a2a'); h.rotation.x = Math.PI / 2.6; h.position.z = 0.18; g.add(h); const f = kit.ball(0.1, '#ffb347', { emissive: '#ff7a1a', intensity: 3 }); f.position.set(0, 0.2, 0.36); g.add(f); }
      else if (name === 'flashlight') { const h = kit.cyl(0.05, 0.05, 0.3, '#2b2b30'); h.rotation.x = Math.PI / 2; h.position.z = 0.16; g.add(h); }
      else if (name === 'sign') { const st = kit.cyl(0.025, 0.025, 1, '#8a5a32'); st.position.set(0, 0.4, 0.1); g.add(st); const bd = kit.box(0.6, 0.4, 0.04, '#f4efe2'); bd.position.set(0, 0.9, 0.1); g.add(bd); }
      else if (name === 'umbrella') { const st = kit.cyl(0.02, 0.02, 1, '#2b2b30'); st.position.set(0, 0.45, 0.08); g.add(st); const top = kit.cone(0.6, 0.3, p.umbrellaColor || '#d94b3d'); top.position.set(0, 1.0, 0.08); g.add(top); }
      else if (name === 'briefcase') { const b = kit.box(0.4, 0.3, 0.1, '#4a3222'); b.position.set(0, -0.12, 0); g.add(b); }
      else if (name === 'flask') { const b = kit.ball(0.1, '#7cf2b0', { glass: true, opacity: 0.6 }); b.position.set(0, 0.08, 0.1); g.add(b); }
      return g;
    };
    addProp(p.prop, arms[1].grip, false);
    addProp(p.propL, arms[0].grip, true);
    root.scale.setScalar(s);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const st = { lastFace: '' };
    return { p, root, body, spine, neck, head, legs, arms, D, face, faceCanvas, faceTex, st, uprights, height: (D.legLen + D.torsoH + D.headH + 0.1) * s };
  }

  function modelSpecOf(m) {
    const lib = (window.AU_MODEL && window.AU_MODEL.LIBRARY) || {};
    const spec = typeof m === 'string' ? lib[m] : m;
    if (!spec) throw new Error(`world3d: unknown model "${m}"; use one of ${Object.keys(lib).join(', ')} or a ModelSpec object`);
    return spec;
  }

  function buildModel(T, kit, m, look, colors) {
    let spec = modelSpecOf(m);
    if (colors) {
      spec = JSON.parse(JSON.stringify(spec));
      spec.palette = spec.palette || {};
      Object.entries(colors).forEach(([k, v]) => { spec.palette[k] = Object.assign({}, spec.palette[k] || {}, { color: v }); });
    }
    const built = window.AU_MODEL.build(T, spec, { look, kit });
    built.report.errors.forEach((e) => { throw new Error('model spec: ' + e); });
    built.report.warnings.forEach((w) => console.warn('model spec: ' + w));
    return built;
  }

  function buildModelFigure(T, kit, c, idx, look) {
    const m = buildModel(T, kit, c.model, look, c.colors);
    const root = new T.Group();
    root.add(m.root);
    const s = c.scale || 1;
    root.scale.setScalar(s);
    return { p: c, root, model: m, isModel: true, height: m.size.y * s, idx, lastY: 0, uprights: [], st: {} };
  }

  function posePerson(t, f, cast, worldT) {
    const p = f.p;
    const acts = p.actions || [];
    const rnd = hash(f.idx * 7.3 + 1);
    const o = { lA: [0, 8, 10], rA: [0, 8, 10], lL: [0, 0], rL: [0, 0], spF: 0, spS: 0, hY: 0, hP: 0, hR: 0, y: 0, x: p.x || 0, z: p.z || 0, yaw: null, roll: 0, pitch: 0, expr: p.expression || 'neutral', talk: 0, eyes: 0, air: 0 };
    o.y = Math.sin(t * 2.2 + rnd * 6) * 0.008;
    o.lA[0] += Math.sin(t * 1.5 + rnd * 4) * 3; o.rA[0] -= Math.sin(t * 1.5 + 1 + rnd * 4) * 3;
    o.hY = Math.sin(t * 0.8 + rnd * 9) * 4;
    let moving = null;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1);
      const kind = a.do;
      if ((kind === 'walk' || kind === 'run' || kind === 'march' || kind === 'sneak') && a.to != null && t >= at) {
        const to = Array.isArray(a.to) ? a.to : [+a.to, o.z];
        const from = a.from != null ? (Array.isArray(a.from) ? a.from : [+a.from, o.z]) : [o.x, o.z];
        const kk = kind === 'run' ? k : ease(k);
        o.x = lerp(from[0], to[0], kk); o.z = lerp(from[1], to[1], kk);
        if (t < end) moving = { kind, ph: (t - at) * (kind === 'run' ? 11 : kind === 'sneak' ? 4 : 7), dir: Math.atan2(to[0] - from[0], to[1] - from[1]) };
      }
    });
    if (moving) {
      const { kind, ph } = moving;
      const amp = kind === 'run' ? 46 : kind === 'march' ? 34 : kind === 'sneak' ? 20 : 28;
      o.lL = [Math.sin(ph) * amp, Math.max(0, -Math.sin(ph)) * amp * 1.3];
      o.rL = [-Math.sin(ph) * amp, Math.max(0, Math.sin(ph)) * amp * 1.3];
      o.lA = [-Math.sin(ph) * amp * 0.9, 8, kind === 'run' ? 80 : 18];
      o.rA = [Math.sin(ph) * amp * 0.9, 8, kind === 'run' ? 80 : 18];
      if (kind === 'march') { o.lA[2] = 0; o.rA[2] = 0; }
      o.y += Math.abs(Math.sin(ph)) * (kind === 'run' ? 0.07 : 0.035);
      o.spF = kind === 'run' ? 14 : kind === 'sneak' ? 18 : 3;
      o.yaw = moving.dir;
    }
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1);
      const w = (a.do === 'fall' || a.do === 'sit' || a.hold) && t > end ? 1 : env(t, at, end, +a.blend || 0.2);
      if (t >= at && t <= end && a.expression) o.expr = a.expression;
      if (!w) return;
      const kind = a.do;
      const mix = (arr, tgt) => { for (let i = 0; i < tgt.length; i++) if (tgt[i] != null) arr[i] = lerp(arr[i], tgt[i], w); };
      const u = t - at;
      if (kind === 'wave') { mix(o.rA, [20, 150, 20 + Math.sin(t * 13) * 26]); }
      else if (kind === 'point') { const up = a.dir === 'up'; mix(o.rA, [up ? 165 : 88, 6, 0]); if (a.dir === 'left' || a.dir === 'right') o.hY = lerp(o.hY, a.dir === 'left' ? 30 : -30, w); }
      else if (kind === 'talk') { o.talk = Math.max(o.talk, w); o.hP += Math.sin(t * 5.1) * 4 * w; mix(o.rA, [40 + Math.sin(t * 3.3) * 18, 14, 60]); mix(o.lA, [20 + Math.sin(t * 2.7 + 1) * 10, 10, 40]); }
      else if (kind === 'look') { o.eyes = (a.dir === 'left' ? -1 : a.dir === 'right' ? 1 : 0) * w; o.hY += (a.dir === 'left' ? 34 : a.dir === 'right' ? -34 : 0) * w; o.hP += (a.dir === 'up' ? -16 : a.dir === 'down' ? 18 : 0) * w; }
      else if (kind === 'shock') { o.y += Math.sin(clamp(u / 0.35, 0, 1) * Math.PI) * 0.16; mix(o.lA, [70, 40, 110]); mix(o.rA, [70, 40, 110]); o.spF = lerp(o.spF, -10, w); o.hP -= 8 * w; o.expr = a.expression || 'shocked'; }
      else if (kind === 'jump') { const j = clamp(u / Math.min(0.7, end - at), 0, 1); o.y += Math.sin(j * Math.PI) * 0.6 * w; mix(o.lL, [40, 70]); mix(o.rL, [40, 70]); mix(o.lA, [150, 30, 10]); mix(o.rA, [150, 30, 10]); }
      else if (kind === 'cheer') { mix(o.lA, [170, 20, 10]); mix(o.rA, [170, 20, 10]); o.y += Math.abs(Math.sin(u * 7)) * 0.16 * w; o.expr = a.expression || 'excited'; }
      else if (kind === 'shrug') { mix(o.lA, [30, 30, 100]); mix(o.rA, [30, 30, 100]); o.hR += 10 * w; }
      else if (kind === 'nod') { o.hP += Math.sin(k * Math.PI * 4) * 12 * w; }
      else if (kind === 'shake') { o.hY += Math.sin(k * Math.PI * 6) * 18 * w; }
      else if (kind === 'think') { mix(o.rA, [70, 10, 140]); o.hR += 8 * w; o.hP -= 6 * w; o.expr = a.expression || 'thinking'; }
      else if (kind === 'scared' || kind === 'tremble') { o.x += Math.sin(t * 60) * 0.012 * w; mix(o.lA, [90, 30, 130]); mix(o.rA, [90, 30, 130]); o.spF = lerp(o.spF, -8, w); o.expr = a.expression || 'scared'; }
      else if (kind === 'cry') { o.expr = 'sad'; o.hP += 14 * w; mix(o.rA, [70, 10, 130]); }
      else if (kind === 'laugh') { o.expr = 'laugh'; o.y += Math.abs(Math.sin(t * 12)) * 0.04 * w; o.spF = lerp(o.spF, -8, w); }
      else if (kind === 'angry') { o.expr = a.expression || 'angry'; mix(o.rA, [100, 20, 90 + Math.sin(t * 18) * 14]); o.spF = lerp(o.spF, 8, w); }
      else if (kind === 'yell' || kind === 'battle-cry') { o.expr = 'yell'; mix(o.rA, [160, 20, 10]); o.spF = lerp(o.spF, -6, w); o.hP -= 10 * w; }
      else if (kind === 'crouch' || kind === 'brace') { mix(o.lL, [50, 80]); mix(o.rL, [-10, 50]); o.y -= 0.16 * w; o.spF = lerp(o.spF, 12, w); if (kind === 'brace') { mix(o.lA, [50, -6, 70]); mix(o.rA, [30, 12, 40]); o.expr = a.expression || 'determined'; } }
      else if (kind === 'block') { mix(o.lA, [85, -10, 80]); o.spF = lerp(o.spF, 10, w); o.expr = a.expression || 'determined'; }
      else if (kind === 'attack' || kind === 'swing') { const s = Math.sin(clamp(u * 4, 0, Math.PI)); mix(o.rA, [150 - s * 160, 20, 20]); o.spF = lerp(o.spF, 12 * s, w); o.expr = a.expression || 'yell'; }
      else if (kind === 'punch') { const s = Math.max(0, Math.sin(u * 14)); mix(o.rA, [90, 0, 90 - s * 90]); mix(o.lA, [60, 10, 110]); o.expr = a.expression || 'angry'; }
      else if (kind === 'throw') { const s = clamp(u / 0.5, 0, 1); mix(o.rA, [s < 0.6 ? lerp(40, 190, s / 0.6) : lerp(190, 60, (s - 0.6) / 0.4), 20, 30]); o.spF = lerp(o.spF, s < 0.6 ? -10 : 20, w); }
      else if (kind === 'fall') { o.pitch = lerp(0, -90, ease(k)) * w; o.y += -0.1 * ease(k) * w; mix(o.lA, [140, 40, 10]); mix(o.rA, [140, 40, 10]); }
      else if (kind === 'fly' || kind === 'tumble' || kind === 'blown-away') {
        const h = a.height != null ? +a.height : 3.2;
        o.air = w;
        o.y += easeOut(k) * h * w;
        if (a.to != null) { const to = Array.isArray(a.to) ? a.to : [+a.to, o.z]; o.x = lerp(o.x, to[0], easeOut(k)); o.z = lerp(o.z, to[1], easeOut(k)); }
        o.roll += Math.sin(u * 2.3) * 28 * w; o.pitch += (kind === 'tumble' ? u * 140 : Math.sin(u * 1.7) * 22) * w;
        mix(o.lA, [120 + Math.sin(u * 9) * 40, 70, 40]); mix(o.rA, [140 + Math.sin(u * 8 + 1) * 40, 70, 40]);
        mix(o.lL, [30 + Math.sin(u * 7) * 40, 60]); mix(o.rL, [-20 + Math.sin(u * 6 + 2) * 40, 40]);
        o.expr = a.expression || 'scared';
      }
      else if (kind === 'hold' || kind === 'raise') { mix(o.rA, [kind === 'raise' ? 165 : 60, 10, kind === 'raise' ? 10 : 70]); }
      else if (kind === 'hug') { mix(o.lA, [80, -10, 70]); mix(o.rA, [80, -10, 70]); }
      else if (kind === 'sit') { mix(o.lL, [90, 90]); mix(o.rL, [90, 90]); o.y -= 0.3 * w; }
      else if (kind === 'dance') { o.y += Math.abs(Math.sin(t * 8)) * 0.1 * w; o.spS += Math.sin(t * 4) * 12 * w; mix(o.lA, [100 + Math.sin(t * 8) * 50, 40, 60]); mix(o.rA, [100 - Math.sin(t * 8) * 50, 40, 60]); mix(o.lL, [Math.max(0, Math.sin(t * 8)) * 40, Math.max(0, Math.sin(t * 8)) * 50]); }
      else if (kind === 'turn') { const to = a.dir === 'left' ? -90 : a.dir === 'right' ? 90 : a.dir === 'back' ? 180 : 0; o.yaw = lerp(o.yaw == null ? 0 : o.yaw, to * DEG, ease(k)); }
      else if (kind === 'type') { mix(o.lA, [60, 6, 70 + Math.sin(t * 22) * 8]); mix(o.rA, [60, 6, 70 + Math.sin(t * 20 + 1) * 8]); o.hP += 10 * w; }
      else if (kind === 'zap' || kind === 'electrocuted') { o.x += Math.sin(t * 90) * 0.02 * w; mix(o.lA, [60 + Math.sin(t * 70) * 30, 60, 30]); mix(o.rA, [60 + Math.sin(t * 66) * 30, 60, 30]); o.expr = 'shocked'; }
    });
    return o;
  }

  function applyPose(T, f, o, facingDefault) {
    const { root, body, spine, head, legs, arms } = f;
    root.position.set(o.x, 0, o.z);
    const baseYaw = facingDefault;
    const want = o.yaw != null ? o.yaw : baseYaw;
    root.rotation.y = want;
    body.position.y = f.D.legLen + o.y / f.root.scale.x;
    body.rotation.set(o.pitch * DEG, 0, o.roll * DEG);
    spine.rotation.set(o.spF * DEG, 0, o.spS * DEG);
    head.rotation.set(o.hP * DEG, o.hY * DEG, o.hR * DEG);
    const arm = (a, v, side) => { a.sh.rotation.set(-v[0] * DEG, 0, side * v[1] * DEG); a.el.rotation.set(-v[2] * DEG, 0, 0); };
    arm(arms[0], o.lA, -1); arm(arms[1], o.rA, 1);
    const leg = (l, v) => { l.hip.rotation.set(-v[0] * DEG, 0, 0); l.knee.rotation.set(v[1] * DEG, 0, 0); };
    leg(legs[0], o.lL); leg(legs[1], o.rL);
    if (f.uprights.length) {
      root.updateMatrixWorld(true);
      const rq = new T.Quaternion(); root.getWorldQuaternion(rq);
      const pq = new T.Quaternion();
      f.uprights.forEach((u) => { u.parent.getWorldQuaternion(pq); u.quaternion.copy(pq.invert().multiply(rq)); });
    }
  }

  function updateFace(f, o, t, look, step) {
    const e = EXPR[o.expr] || EXPR.neutral;
    const blinkSeed = f.idx * 3.1;
    const bt = (t + hash(blinkSeed) * 3) % 3.4;
    const blink = bt < 0.12 && !o.air;
    const talk = o.talk ? Math.round((0.5 + 0.5 * Math.abs(Math.sin(t * 17 + f.idx))) * o.talk * 4) / 4 : 0;
    const key = [o.expr, blink, talk, Math.round(o.eyes * 2), f.p.face === 'visor'].join('|');
    if (key === f.st.lastFace) return;
    f.st.lastFace = key;
    drawFace(f.faceCanvas.getContext('2d'), 256, e, { blink, talk, eyes: o.eyes, visor: f.p.face === 'visor' }, look);
    f.faceTex.needsUpdate = true;
  }

  function skyTexture(T, kit, top, bottom, stars) {
    return kit.canvasTex('sky' + top + bottom + stars, (x, s) => {
      const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, top); g.addColorStop(0.62, bottom); g.addColorStop(1, bottom);
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      if (stars) { const r = mul(9); for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; x.fillRect(r() * s, r() * s * 0.7, 1.2, 1.2); } }
    }, 512);
  }

  function ground(T, kit, size, hex, bumps, seed) {
    const geo = new T.PlaneGeometry(size, size, 40, 40);
    geo.rotateX(-Math.PI / 2);
    if (bumps) { const pos = geo.attributes.position, r = mul(seed || 3); for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const d = Math.hypot(x, z); pos.setY(i, d > 7 ? (r() - 0.3) * bumps * Math.min(1, (d - 7) / 6) : (r() - 0.5) * 0.02); } geo.computeVertexNormals(); }
    const m = new T.Mesh(geo, kit.mat(hex));
    m.receiveShadow = true;
    return m;
  }

  function house(T, kit, wall, roof, r) {
    const g = new T.Group();
    const b = kit.box(4, 3, 3.6, wall); b.position.y = 1.5; g.add(b);
    const rf = new T.Mesh(new T.CylinderGeometry(0.01, 3.1, 1.8, 4, 1), kit.mat(roof)); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.9); rf.position.y = 3.9; rf.castShadow = true; g.add(rf);
    const door = kit.box(0.8, 1.5, 0.08, '#6b4a2e'); door.position.set(0.8, 0.75, 1.82); g.add(door);
    [[-1, 1.8], [0.2, 2.2]].forEach(([x0]) => { const w = kit.box(0.8, 0.7, 0.06, '#bfe3ff', { emissive: '#3a5a7a', intensity: 0.2 }); w.position.set(x0 - 0.2, 1.8, 1.82); g.add(w); });
    g.rotation.y = (r() - 0.5) * 0.2;
    return g;
  }

  function tree(T, kit, r, style) {
    const g = new T.Group();
    const trunk = kit.cyl(0.14, 0.2, 1.2, '#6b4a2e'); trunk.position.y = 0.6; g.add(trunk);
    if (style === 'pine') { [0, 1, 2].forEach((i) => { const c = kit.cone(1.1 - i * 0.28, 1.3, '#2f7a4a'); c.position.y = 1.4 + i * 0.75; g.add(c); }); }
    else { const c = kit.ball(1 + r() * 0.3, r() < 0.5 ? '#4f9a4a' : '#3f8a52', { detail: 0 }); c.position.y = 2; c.scale.y = 0.9; g.add(c); }
    return g;
  }

  function buildSet(T, g, kit, name, opts) {
    const grp = new T.Group();
    const r = mul(opts.seed || 11);
    const anchors = {};
    const updates = [];
    const time = opts.time || (SETS[name] || {}).time || 'day';
    const lt = LIGHT[time] || LIGHT.day;
    if (name !== 'none') {
      g.scene.background = skyTexture(T, kit, lt.sky[0], lt.sky[1], time === 'night' || time === 'space');
      if (lt.fog) g.scene.fog = new T.Fog(lt.fog[0], lt.fog[1], lt.fog[2]);
    }
    if (name === 'studio') {
      const c = opts.color || '#2b2f3c';
      const floor = ground(T, kit, 60, c); grp.add(floor);
      const wall = new T.Mesh(new T.CylinderGeometry(14, 14, 16, 48, 1, true, -Math.PI / 2, Math.PI), kit.mat(c, { side: true })); wall.rotation.y = Math.PI; wall.position.set(0, 8, 2); wall.receiveShadow = true; grp.add(wall);
    } else if (name === 'lab') {
      const tex = kit.canvasTex('labfloor', (x, s) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#1f2a33' : '#26333e'; x.fillRect(i * s / 8, j * s / 8, s / 8, s / 8); } });
      tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(6, 6);
      const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
      const wall = kit.box(30, 9, 0.4, '#1a2630'); wall.position.set(0, 4.5, -6); grp.add(wall);
      for (let i = 0; i < 4; i++) { const w = kit.box(2.4, 3, 0.1, '#163a52', { emissive: '#1a5a8a', intensity: 0.6 }); w.position.set(-7.5 + i * 3, 4.6, -5.75); grp.add(w); }
      const bench = kit.box(4, 0.2, 1.2, '#4a5560'); bench.position.set(-4.5, 1.1, -3.5); grp.add(bench);
      [-5.6, -4.8, -4, -3.4].forEach((x0, i) => { const fl = kit.ball(0.22, ['#7cf2b0', '#6fb3ff', '#ff6fa8', '#ffd23f'][i], { glass: true, opacity: 0.7 }); fl.position.set(x0, 1.45, -3.4); grp.add(fl); const pl = new T.PointLight(['#7cf2b0', '#6fb3ff', '#ff6fa8', '#ffd23f'][i], 0.6, 3); pl.position.copy(fl.position); grp.add(pl); });
      const coil = new T.Group(); coil.position.set(opts.coil ? opts.coil[0] : 2.4, 0, opts.coil ? opts.coil[1] : -2.2); grp.add(coil);
      const base = kit.cyl(0.9, 1.1, 0.6, '#3a4048', { metal: true }); base.position.y = 0.3; coil.add(base);
      const stripes = kit.canvasTex('copper', (x, s) => { for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? '#b8692f' : '#e0954f'; x.fillRect(0, i * s / 64, s, s / 64); } });
      const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 3, 32), new T.MeshStandardMaterial({ map: stripes, metalness: 0.7, roughness: 0.35 })); body.position.y = 2.1; body.castShadow = true; coil.add(body);
      const tor = new T.Mesh(new T.TorusGeometry(0.75, 0.3, 16, 32), kit.mat('#b9c2cf', { metal: true, rough: 0.2 })); tor.rotation.x = Math.PI / 2; tor.position.y = 3.8; tor.castShadow = true; coil.add(tor);
      anchors.coil = new T.Vector3(coil.position.x, 3.9, coil.position.z);
      const cl = new T.PointLight('#7fd4ff', 0, 14); cl.position.set(coil.position.x, 4.2, coil.position.z); grp.add(cl); anchors.coilLight = cl;
    } else if (name === 'battlefield') {
      grp.add(ground(T, kit, 120, '#6f6a44', 1.6, 4));
      const sun = g.glow('#ffb36b', 26); sun.position.set(-18, 9, -60); grp.add(sun);
      for (let i = 0; i < 6; i++) { const hill = new T.Mesh(new T.IcosahedronGeometry(10 + r() * 8, 0), kit.mat(['#5a5a3c', '#4c5038', '#5e563a'][i % 3])); hill.scale.y = 0.35; hill.position.set(-40 + i * 16, -1, -44 - r() * 10); grp.add(hill); }
      const castle = new T.Group(); castle.position.set(opts.castle ? opts.castle[0] : 7, 0, opts.castle ? opts.castle[1] : -24); grp.add(castle);
      const keep = kit.box(7, 6, 4, '#7c7568'); keep.position.y = 3; castle.add(keep);
      [-4, 4].forEach((x0) => { const tw = kit.cyl(1.4, 1.6, 9, '#6e675b'); tw.position.set(x0, 4.5, 0); castle.add(tw); const rf = kit.cone(1.8, 2.4, '#5a2f2a'); rf.position.set(x0, 10.2, 0); castle.add(rf); });
      for (let i = 0; i < 7; i++) { const cr = kit.box(0.6, 0.7, 0.6, '#7c7568'); cr.position.set(-3 + i, 6.3, 1.7); castle.add(cr); }
      anchors.castle = new T.Vector3(castle.position.x, 5, castle.position.z);
      const cat = new T.Group(); cat.position.set(opts.catapult ? opts.catapult[0] : -3.6, 0, opts.catapult ? opts.catapult[1] : -3); cat.rotation.y = 0.5; grp.add(cat);
      const frame = kit.box(1.6, 0.3, 3, '#7a5530'); frame.position.y = 0.6; cat.add(frame);
      [-0.8, 0.8].forEach((x0) => { [-1.1, 1.1].forEach((z0) => { const wh = kit.cyl(0.45, 0.45, 0.2, '#5a3d22', { n: 10 }); wh.rotation.z = Math.PI / 2; wh.position.set(x0 * 1.1, 0.45, z0); cat.add(wh); }); const up = kit.box(0.24, 1.8, 0.24, '#7a5530'); up.position.set(x0 * 0.7, 1.4, 0.2); cat.add(up); });
      const arm = new T.Group(); arm.position.set(0, 2.1, 0.2); cat.add(arm);
      const beam = kit.box(0.2, 0.2, 3.6, '#8a6238'); beam.position.z = -1.2; arm.add(beam);
      const cup = kit.box(0.6, 0.25, 0.6, '#6b4a2e'); cup.position.set(0, 0.15, -2.9); arm.add(cup);
      anchors.catapult = cat; anchors.catapultArm = arm;
      for (let i = 0; i < 3; i++) anchors['smoke' + i] = new T.Vector3(castle.position.x - 3 + i * 3, 7, castle.position.z);
    } else if (name === 'suburb') {
      grp.add(ground(T, kit, 140, '#6fae5a', 0.6, 7));
      const road = kit.box(8, 0.05, 140, '#3d4048', { r: 0 }); road.position.set(0, 0.02, -40); road.receiveShadow = true; grp.add(road);
      for (let i = 0; i < 18; i++) { const dash = kit.box(0.18, 0.06, 1.6, '#f4f1e8', { r: 0 }); dash.position.set(0, 0.05, 6 - i * 4.4); grp.add(dash); }
      [-1, 1].forEach((sd) => { const walk = kit.box(2, 0.12, 140, '#b9b4a8', { r: 0 }); walk.position.set(sd * 5, 0.06, -40); grp.add(walk); for (let i = 0; i < 6; i++) { const h = house(T, kit, ['#e8d9c0', '#cfe0ea', '#f2c9a5', '#d8e6c8'][(i + (sd > 0 ? 1 : 0)) % 4], ['#a5463c', '#5a5f6e', '#7a4a3a'][i % 3], r); h.position.set(sd * 10, 0, -4 - i * 9); h.rotation.y += sd > 0 ? -Math.PI / 2 : Math.PI / 2; grp.add(h); const tr = tree(T, kit, r); tr.position.set(sd * 6.6, 0, -8 - i * 9); grp.add(tr); const lamp = kit.cyl(0.06, 0.08, 3.6, '#4a4d55'); lamp.position.set(sd * 4.3, 1.8, -2 - i * 9); grp.add(lamp); } });
      for (let i = 0; i < 6; i++) { const cl = new T.Group(); for (let k = 0; k < 4; k++) { const b = kit.ball(1.6 + r() * 1.2, '#ffffff', { detail: 0 }); b.position.set(k * 1.6, r(), r()); cl.add(b); } cl.position.set(-30 + i * 12, 16 + r() * 6, -60 - r() * 10); grp.add(cl); }
      anchors.cars = [];
    } else if (name === 'living-room') {
      const wood = kit.canvasTex('planks', (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a8794f' : '#b8875a'; x.fillRect(0, i * s / 8, s, s / 8); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, i * s / 8, s, 2); } });
      wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(4, 4);
      const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ map: wood, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
      const wall = kit.box(24, 8, 0.4, opts.wall || '#e9d7b8'); wall.position.set(0, 4, -4.5); grp.add(wall);
      const rug = kit.box(5, 0.04, 3.2, '#d9c7a3', { r: 0.02 }); rug.position.set(0, 0.03, 0.4); grp.add(rug);
      const sofaC = opts.sofa || '#d8a23a';
      const sofa = new T.Group(); sofa.position.set(0, 0, -3); grp.add(sofa);
      const seat = kit.box(4.6, 0.6, 1.4, sofaC); seat.position.y = 0.6; sofa.add(seat);
      const back = kit.box(4.6, 1.3, 0.4, sofaC); back.position.set(0, 1.3, -0.55); sofa.add(back);
      [-1, 1].forEach((sd) => { const armr = kit.box(0.5, 1.0, 1.4, shade(sofaC, -0.08)); armr.position.set(sd * 2.5, 0.9, 0); sofa.add(armr); const cush = kit.box(1.1, 0.9, 0.3, sd > 0 ? '#c9572f' : '#d67a3a'); cush.position.set(sd * 1.6, 1.2, -0.25); cush.rotation.z = sd * 0.15; sofa.add(cush); });
      const lamp = new T.Group(); lamp.position.set(3.6, 0, -3.4); grp.add(lamp);
      const pole = kit.cyl(0.05, 0.05, 2.6, '#3a3330'); pole.position.y = 1.3; lamp.add(pole);
      const shadeM = kit.cyl(0.35, 0.55, 0.6, '#f2e6cc', { emissive: '#ffcf8a', intensity: 0.6 }); shadeM.position.y = 2.7; lamp.add(shadeM);
      const ll = new T.PointLight('#ffcf8a', 1.4, 9); ll.position.set(3.6, 2.6, -3.2); grp.add(ll);
      const plant = new T.Group(); plant.position.set(-3.8, 0, -3.4); grp.add(plant); const pot = kit.cyl(0.35, 0.28, 0.6, '#b8653a'); pot.position.y = 0.3; plant.add(pot); for (let i = 0; i < 6; i++) { const lf = kit.cone(0.16, 1, '#4f8a4a'); lf.position.set(Math.cos(i) * 0.15, 0.9, Math.sin(i) * 0.15); lf.rotation.set(Math.sin(i * 2) * 0.5, 0, Math.cos(i * 2) * 0.5); plant.add(lf); }
    } else if (name === 'forest') {
      grp.add(ground(T, kit, 120, '#5c9a4a', 1.2, 9));
      for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 7 + r() * 30; const tr = tree(T, kit, r, r() < 0.5 ? 'pine' : 'round'); tr.position.set(Math.cos(a) * d, 0, -Math.abs(Math.sin(a) * d) - 3); tr.scale.setScalar(0.9 + r() * 0.8); grp.add(tr); }
      for (let i = 0; i < 10; i++) { const rock = kit.ball(0.4 + r() * 0.6, '#8a8f96', { detail: 0 }); rock.position.set((r() - 0.5) * 20, 0.2, -2 - r() * 12); rock.scale.y = 0.6; grp.add(rock); }
    } else if (name === 'city-night') {
      grp.add(ground(T, kit, 140, '#2a2d38'));
      for (let i = 0; i < 26; i++) { const h = 6 + r() * 22; const b = kit.box(3 + r() * 3, h, 3 + r() * 3, ['#2c3346', '#353b52', '#252a3a'][i % 3]); b.position.set(-40 + i * 3.2, h / 2, -24 - r() * 20); grp.add(b); for (let k = 0; k < 6; k++) { if (r() < 0.5) continue; const w = kit.box(0.5, 0.6, 0.05, '#ffd88a', { emissive: '#ffb84a', intensity: 1.4, r: 0 }); w.position.set(b.position.x + (r() - 0.5) * 2, 2 + r() * (h - 3), b.position.z + 1.6 + r() * 0.8); grp.add(w); } }
      const street = kit.box(10, 0.05, 140, '#1d2029', { r: 0 }); street.position.set(0, 0.02, -40); grp.add(street);
    } else if (name === 'space') {
      const planet = kit.ball(14, '#5ce1a2'); planet.position.set(18, -6, -50); grp.add(planet);
      const moon = kit.ball(2.4, '#c9c3b8'); moon.position.set(-12, 10, -30); grp.add(moon);
      const deck = kit.box(10, 0.4, 6, '#8d96a6', { metal: true }); deck.position.y = -0.2; grp.add(deck);
    }
    return { grp, anchors, updates, time, lt };
  }

  function boltMesh(T, n) {
    const grp = new T.Group();
    const segs = [];
    const core = new T.MeshBasicMaterial({ color: '#e8f8ff' });
    const halo = new T.MeshBasicMaterial({ color: '#6fd0ff', transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < n; i++) { const a = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1, 5), core); const b = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 1, 6), halo); grp.add(a, b); segs.push([a, b]); }
    const up = new T.Vector3(0, 1, 0), dirV = new T.Vector3(), q = new T.Quaternion();
    const set = (pts) => {
      segs.forEach(([a, b], i) => {
        const p0 = pts[i], p1 = pts[i + 1];
        if (!p1) { a.visible = b.visible = false; return; }
        a.visible = b.visible = true;
        dirV.subVectors(p1, p0); const len = dirV.length(); dirV.normalize(); q.setFromUnitVectors(up, dirV);
        [a, b].forEach((m) => { m.position.copy(p0).addScaledVector(dirV, len / 2); m.quaternion.copy(q); m.scale.set(1, len, 1); });
      });
    };
    return { grp, set };
  }

  function jagged(T, a, b, r, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n; const p = new T.Vector3().lerpVectors(a, b, k);
      if (i > 0 && i < n) { const amp = Math.sin(k * Math.PI) * 0.55; p.x += (r() - 0.5) * amp; p.y += (r() - 0.5) * amp; p.z += (r() - 0.5) * amp; }
      pts.push(p);
    }
    return pts;
  }

  function buildFx(T, g, kit, list, anchors, figures, seed) {
    const out = [];
    (list || []).forEach((fx, fi) => {
      const at = +fx.at || 0, dur = +fx.duration || 1.5, end = at + dur;
      const r0 = seed + fi * 101;
      const pos = (v, fallback) => {
        if (v == null) return fallback.clone();
        if (Array.isArray(v)) return new T.Vector3(v[0], v.length > 2 ? v[1] : 1.2, v.length > 2 ? v[2] : v[1]);
        if (typeof v === 'string' && figures[v]) return null;
        if (typeof v === 'string' && anchors[v] && anchors[v].isVector3) return anchors[v].clone();
        return fallback.clone();
      };
      const figPos = (id) => { const f = figures[id]; return f ? new T.Vector3(f.root.position.x, f.height * 0.85 + f.lastY, f.root.position.z) : null; };
      if (fx.type === 'lightning') {
        const bolts = []; const count = fx.bolts || 4;
        for (let i = 0; i < count; i++) { const b = boltMesh(T, 14); g.scene.add(b.grp); bolts.push(b); }
        const light = anchors.coilLight || new T.PointLight('#7fd4ff', 0, 14); if (!anchors.coilLight) g.scene.add(light);
        const from = pos(fx.from, anchors.coil || new T.Vector3(0, 4, 0));
        out.push((t) => {
          const on = t >= at && t <= end;
          const step = Math.floor(t * 15);
          const flick = on ? 0.4 + 0.6 * hash(step * 3.7 + fi) : 0;
          light.intensity = on ? 18 * flick : 0;
          if (!anchors.coilLight) light.position.copy(from);
          bolts.forEach((b, i) => {
            const vis = on && hash(step * 1.3 + i * 7 + fi) > 0.25;
            b.grp.visible = vis;
            if (!vis) return;
            const r = mul(r0 + step * 31 + i);
            let to = null;
            if (i === 0 && fx.to) to = typeof fx.to === 'string' ? figPos(fx.to) : pos(fx.to, from);
            if (!to) { const a = r() * Math.PI * 2, rr = 1.2 + r() * 1.8; to = new T.Vector3(from.x + Math.cos(a) * rr, from.y - 0.5 - r() * 2.4, from.z + Math.sin(a) * rr); }
            b.set(jagged(T, from, to, r, 13));
          });
          return on ? 0.25 * flick : 0;
        });
      } else if (fx.type === 'fireball') {
        const ball = kit.ball(0.45, '#ffb347', { emissive: '#ff6a1a', intensity: 4 }); g.scene.add(ball);
        const glow = g.glow('#ff8a3a', 4); g.scene.add(glow);
        const light = new T.PointLight('#ff8a3a', 0, 16); g.scene.add(light);
        const trail = []; for (let i = 0; i < 18; i++) { const sp = g.glow(i % 3 ? '#ffb36b' : '#6a6a6a', 1.6); g.scene.add(sp); trail.push(sp); }
        const from = pos(fx.from, anchors.catapult ? new T.Vector3(anchors.catapult.position.x, 4, anchors.catapult.position.z - 2) : new T.Vector3(-4, 3, -2));
        const to = pos(fx.to, anchors.castle || new T.Vector3(8, 4, -24));
        const arc = (k) => { const p = new T.Vector3().lerpVectors(from, to, k); p.y += Math.sin(k * Math.PI) * (fx.arc != null ? +fx.arc : 8); return p; };
        out.push((t) => {
          const k = (t - at) / dur;
          const vis = k >= 0 && k <= 1;
          ball.visible = glow.visible = vis; light.intensity = vis ? 6 : 0;
          trail.forEach((sp, i) => { const kk = k - (i + 1) * 0.018; sp.visible = vis && kk > 0; if (sp.visible) { sp.position.copy(arc(kk)); sp.material.opacity = (1 - i / trail.length) * 0.7; sp.scale.setScalar(1 + i * 0.12); } });
          if (vis) { const p = arc(k); ball.position.copy(p); glow.position.copy(p); light.position.copy(p); ball.rotation.set(t * 6, t * 4, 0); }
          if (anchors.catapultArm && t >= at - 0.3) { const u = clamp((t - at + 0.3) / 0.35, 0, 1); anchors.catapultArm.rotation.x = -easeOut(u) * 1.6 + (u >= 1 ? Math.sin((t - at) * 12) * Math.exp(-(t - at) * 4) * 0.12 : 0); }
          return k > 0.97 && k < 1.05 ? 0.6 : 0;
        });
        if (fx.impact !== false) out.push(explosion(T, g, kit, to, end, r0 + 5, 1.2));
      } else if (fx.type === 'explosion') {
        out.push(explosion(T, g, kit, pos(fx.at_pos || fx.pos, new T.Vector3(0, 0.5, -3)), at, r0, +fx.size || 1));
      } else if (fx.type === 'tornado' || fx.type === 'debris') {
        const center = pos(fx.pos, new T.Vector3(0, 0, -8));
        const r = mul(r0);
        const parts = [];
        if (fx.type === 'tornado') { for (let i = 0; i < 90; i++) { const sp = g.glow(i % 2 ? '#8f9196' : '#b9bcc2', 2.6 + r() * 2); sp.material.blending = T.NormalBlending; sp.material.opacity = 0.45; g.scene.add(sp); parts.push({ sp, h: r() * 14, a: r() * Math.PI * 2, sp0: 2 + r() * 2 }); } }
        const debris = [];
        const kinds = fx.objects || ['car', 'rock', 'rock', 'board', 'car', 'bike', 'rock', 'board', 'barrel', 'rock'];
        const count = fx.count || 14;
        for (let i = 0; i < count; i++) {
          const kind = kinds[i % kinds.length];
          let m;
          if (kind === 'car') { m = new T.Group(); const b = kit.box(1.6, 0.6, 0.9, ['#d94b3d', '#3b6fd6', '#f2c12e', '#8b8f99'][i % 4]); m.add(b); const cab = kit.box(0.9, 0.45, 0.8, '#bfe3ff'); cab.position.y = 0.45; m.add(cab); [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].forEach(([x0, z0]) => { const w = kit.cyl(0.2, 0.2, 0.15, '#1d1d22', { n: 8 }); w.rotation.x = Math.PI / 2; w.position.set(x0, -0.3, z0); m.add(w); }); }
          else if (kind === 'board') m = kit.box(1.4, 0.1, 0.4, '#8a6238');
          else if (kind === 'barrel') m = kit.cyl(0.3, 0.3, 0.7, '#7a5530');
          else if (kind === 'bike') { m = new T.Group(); [-0.4, 0.4].forEach((x0) => { const w = new T.Mesh(new T.TorusGeometry(0.28, 0.04, 6, 14), kit.mat('#2b2b30')); w.position.x = x0; m.add(w); }); const fr = kit.box(0.8, 0.06, 0.06, '#f2c12e'); fr.position.y = 0.15; m.add(fr); }
          else m = kit.ball(0.25 + r() * 0.35, '#7d7a74', { detail: 0 });
          g.scene.add(m);
          debris.push({ m, a: r() * Math.PI * 2, rad: 2.5 + r() * 6, h: 0.5 + r() * 9, sp: 0.6 + r() * 1.1, spin: [r() * 3, r() * 3, r() * 3], scale: kind === 'car' ? 1 : 1 });
        }
        out.push((t) => {
          const on = t >= at - 0.01 && t <= end;
          const u = Math.max(0, t - at);
          const grow = clamp(u / 0.8, 0, 1) * (t > end - 0.5 ? clamp((end - t) / 0.5, 0, 1) : 1);
          parts.forEach((p) => { p.sp.visible = on; if (!on) return; const a = p.a + u * p.sp0; const rad = 0.6 + p.h * 0.32; p.sp.position.set(center.x + Math.cos(a) * rad, p.h, center.z + Math.sin(a) * rad); p.sp.material.opacity = 0.42 * grow; });
          debris.forEach((d) => { d.m.visible = on && grow > 0.05; if (!d.m.visible) return; const a = d.a + u * d.sp; const rad = d.rad * (0.7 + 0.3 * Math.sin(u * 0.7 + d.a)); d.m.position.set(center.x + Math.cos(a) * rad, d.h * grow + Math.sin(u * 2 + d.a) * 0.6, center.z + Math.sin(a) * rad * 0.7); d.m.rotation.set(u * d.spin[0], u * d.spin[1], u * d.spin[2]); });
          return on ? 0.05 * grow : 0;
        });
      } else if (fx.type === 'sparks' || fx.type === 'confetti' || fx.type === 'snow' || fx.type === 'rain' || fx.type === 'dust' || fx.type === 'embers') {
        const r = mul(r0);
        const n = fx.count || (fx.type === 'rain' ? 400 : 160);
        const colors = { sparks: ['#ffd23f', '#ffb347'], confetti: ['#ff5c7a', '#ffd23f', '#5ce1a2', '#6fb3ff', '#a99bff'], snow: ['#ffffff'], rain: ['#9fc4ff'], dust: ['#d9c7a3'], embers: ['#ff8a3a', '#ffcf6b'] }[fx.type];
        const geo = new T.BufferGeometry(); const P = new Float32Array(n * 3), C = new Float32Array(n * 3), seeds = [];
        for (let i = 0; i < n; i++) { const c = new T.Color(colors[i % colors.length]); C.set([c.r, c.g, c.b], i * 3); seeds.push([r(), r(), r(), r()]); }
        geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('color', new T.BufferAttribute(C, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({ size: fx.type === 'rain' ? 0.05 : fx.type === 'confetti' ? 0.16 : 0.1, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: fx.type === 'sparks' || fx.type === 'embers' ? T.AdditiveBlending : T.NormalBlending }));
        g.scene.add(pts);
        const c0 = pos(fx.pos, new T.Vector3(0, 0, -2));
        out.push((t) => {
          const on = t >= at && t <= end; pts.visible = on; if (!on) return 0;
          const u = t - at;
          for (let i = 0; i < n; i++) {
            const [a, b, c, d] = seeds[i];
            let x, y, z;
            if (fx.type === 'sparks') { const life = (u * 1.6 + a) % 1; const ang = b * Math.PI * 2; const v = 2 + c * 3; x = c0.x + Math.cos(ang) * v * life; z = c0.z + Math.sin(ang) * v * life; y = c0.y + 1.5 + d * 2 * life - 4.9 * life * life; }
            else if (fx.type === 'confetti') { const fall = (u * (0.6 + a * 0.5) + b * 6) % 6; x = c0.x + (c - 0.5) * 10 + Math.sin(u * 2 + d * 6) * 0.4; y = 6 - fall; z = c0.z + (d - 0.5) * 6; }
            else { const sp = fx.type === 'rain' ? 9 : fx.type === 'snow' ? 0.7 : 0.25; const fall = (u * sp * (0.7 + a * 0.6) + b * 10) % 10; x = c0.x + (c - 0.5) * 22 + (fx.type === 'snow' ? Math.sin(u + d * 6) * 0.4 : 0); y = 10 - fall; z = c0.z + (d - 0.5) * 16; }
            P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
          }
          geo.attributes.position.needsUpdate = true;
          return 0;
        });
      }
    });
    return out;
  }

  function explosion(T, g, kit, p0, at, seed, size) {
    const flash = g.glow('#ffd28a', 8 * size); flash.position.copy(p0); g.scene.add(flash);
    const fire = kit.ball(1, '#ffb347', { emissive: '#ff6a1a', intensity: 3 }); fire.position.copy(p0); g.scene.add(fire);
    const light = new T.PointLight('#ffb36b', 0, 30); light.position.copy(p0); g.scene.add(light);
    const r = mul(seed);
    const bits = []; for (let i = 0; i < 16; i++) { const b = kit.ball(0.18 + r() * 0.2, i % 2 ? '#3a3330' : '#6b6560', { detail: 0 }); g.scene.add(b); bits.push({ b, v: new T.Vector3((r() - 0.5) * 8, 4 + r() * 6, (r() - 0.5) * 8) }); }
    const smoke = []; for (let i = 0; i < 10; i++) { const s = g.glow('#5a5654', 3); s.material.blending = T.NormalBlending; g.scene.add(s); smoke.push({ s, v: new T.Vector3((r() - 0.5) * 1.5, 1 + r() * 1.6, (r() - 0.5) * 1.5) }); }
    return (t) => {
      const u = t - at;
      const on = u >= 0 && u < 3;
      flash.visible = fire.visible = on && u < 0.9;
      if (on) { flash.material.opacity = Math.max(0, 1 - u / 0.5); fire.scale.setScalar(size * (0.4 + easeOut(u / 0.6) * 1.6)); fire.material.opacity = 1; light.intensity = Math.max(0, 40 * (1 - u / 0.8)); }
      else light.intensity = 0;
      bits.forEach(({ b, v }) => { b.visible = on; if (on) { b.position.set(p0.x + v.x * u * size, Math.max(0.1, p0.y + v.y * u - 4.9 * u * u), p0.z + v.z * u * size); b.rotation.set(u * 5, u * 3, 0); } });
      smoke.forEach(({ s, v }) => { s.visible = on; if (on) { s.position.set(p0.x + v.x * u, p0.y + v.y * u, p0.z + v.z * u); s.material.opacity = 0.55 * Math.max(0, 1 - u / 3); s.scale.setScalar(2 + u * 2.4 * size); } });
      return u >= 0 && u < 0.5 ? 0.9 * (1 - u / 0.5) : 0;
    };
  }

  window.AU_W3D = { makeKit, roundBox, LOOKS, shade, mul, hash };

  const SHOTS = { extreme: [16, 1.2, 6], wide: [9, 1.0, 3.2], full: [5.5, 1.0, 1.8], medium: [3.6, 1.25, 1.4], close: [1.9, 1.55, 1.6], extremeclose: [1.1, 1.6, 1.6], low: [3.6, 1.0, 0.35], high: [6, 1.0, 7], ots: [2.6, 1.4, 1.7] };

  reg.define('world3d', {
    category: '3d', description: 'Procedural 3D world built entirely in code (no model files): a set (studio, lab with a Tesla coil, battlefield with castle and catapult, suburb street, living room, forest, city at night, space), a cast of stylised 3D characters made from primitives (presets scientist, soldier, knight, kid, teen-girl, teen-boy, businessman, chef, old-man, hero, astronaut, zombie, farmer, robot; any hair, hat, outfit, props, expressive painted faces) that act on a timeline with the same actions as toon, effects (lightning, fireball, explosion, tornado, debris, sparks, confetti, rain, snow, dust, embers) and a directed camera (shots, moves, automatic shake). Looks: lowpoly (faceted 3D cartoon), felt (stop-motion fabric with stitches and button joints), clay (claymation), toy (glossy plastic), paper (cardstock on threes). Works in 16:9, 9:16 and 1:1.',
    params: {
      at: { type: 'number', default: 0, doc: 'start time in scene seconds (the world is visible from the first frame by default)' },
      set: { type: 'enum', default: 'studio', options: Object.keys(SETS), doc: 'environment; none gives a transparent background' },
      look: { type: 'enum', default: 'lowpoly', options: Object.keys(LOOKS), doc: 'material and motion style for the whole world' },
      time: { type: 'enum', default: '', options: ['', 'day', 'sunset', 'night', 'studio', 'lab', 'interior', 'space'], doc: 'lighting and sky; empty uses the set default' },
      props: { type: 'array', default: [], doc: "ModelSpec set dressing: [{model: library name (dog, cat, bird, car, tree, house, chair, table, desk-lamp, sofa) or a ModelSpec object, x, z, yaw, scale, colors}]" },
      cast: { type: 'array', default: [], doc: "a cast member may be a ModelSpec creature or object instead of a person: {id, model: 'dog' or a spec, x, z, facing, scale, colors, actions: walk/run (to), wag, nod, spin, joint}. People: characters: [{id, preset, x, z, facing (degrees, 0 faces camera), scale, skin, hair (short|side|spiky|messy|ponytail|bun|long|curly|bald), hairColor, hat (helmet|cap|hardhat|chef|beanie|crown|tophat|straw|space|none), hatColor, shirt, pants, shoes, outfit (casual|labcoat|armor|hoodie|suit|overalls|suit-space|robot), extras [goggles, glasses, backpack, cape, beard, mustache], prop (sword|shield|wrench|phone|book|cup|torch|flashlight|sign|umbrella|briefcase|flask), propL, expression, actions: [{do, at, duration, to: x or [x,z], dir, expression, height}]}]. Actions: walk, run, march, sneak, wave, point, talk, look, shock, jump, cheer, shrug, nod, shake, think, scared, cry, laugh, angry, yell, crouch, brace, block, attack, punch, throw, fall, fly, tumble, blown-away, hold, raise, hug, sit, dance, turn, type, zap. Expressions: " + Object.keys(EXPR).join(', ') },
      fx: { type: 'array', default: [], doc: "effects: [{type: lightning|fireball|explosion|tornado|debris|sparks|confetti|rain|snow|dust|embers, at, duration, from, to (cast id, anchor name like coil/castle, or [x,y,z]), pos, count, arc, size}]" },
      camera: { type: 'object', default: null, doc: "{shot: extreme|wide|full|medium|close|extremeclose|low|high|ots, target: cast id or [x,y,z], yaw: degrees around the target, orbit: degrees across the scene, push: end zoom like 1.15, moves: [{at, duration, shot, target, yaw}], shake: 0 to 2}" },
      steps: { type: 'number', default: 0, doc: 'animate on 1s, 2s or 3s (stop-motion); 0 uses the look default' },
      boil: { type: 'number', default: -1, doc: 'stop-motion jitter amount 0 to 2; -1 uses the look default' },
      exposure: { type: 'number', default: 1.05 },
      seed: { type: 'number', default: 7 },
      set_options: { type: 'object', default: null, doc: 'set details: {color (studio backdrop), sofa, wall, coil: [x,z], castle: [x,z], catapult: [x,z]}' }
    },
    example: "component('world3d', { set: 'lab', look: 'lowpoly', cast: [{ id: 'doc', preset: 'scientist', x: -0.6, z: 0.6, facing: 20, actions: [{ do: 'shock', at: 1.2, duration: 1.4 }] }], fx: [{ type: 'lightning', at: 0.8, duration: 3, to: 'doc' }], camera: { shot: 'medium', target: 'doc', yaw: -18, push: 1.15 } })"
  }, (ctx, p, h) => {
    const el = h.box(Object.assign({ x: 0, y: 0, w: 100 }, p), 'auc-world3d', { x: 0, y: 0, w: 100 });
    el.style.height = (p.h != null ? p.h : 100) + '%';
    const { at, end } = h.span(p);
    const look = LOOKS[p.look] ? p.look : 'lowpoly';
    const L = LOOKS[look];
    const steps = p.steps > 0 ? Math.round(p.steps) : L.steps;
    const boil = p.boil >= 0 ? p.boil : L.boil;
    ctx.three(el, (g) => {
      const T = g.THREE;
      const kit = makeKit(T, look, p.seed || 7);
      const setName = SETS[p.set] ? p.set : 'studio';
      const built = buildSet(T, g, kit, setName, Object.assign({ seed: p.seed, time: p.time }, p.set_options || {}));
      g.scene.add(built.grp);
      const lt = built.lt;
      g.lights.key.color = new T.Color(lt.key[0]); g.lights.key.intensity = lt.key[1];
      g.lights.key.position.set(6, 11, 8);
      g.lights.fill.intensity = lt.fill; g.lights.fill.groundColor = new T.Color(lt.ground || '#7a7a80'); g.lights.fill.color = new T.Color(lt.sky[1]).lerp(new T.Color('#ffffff'), 0.5);
      g.lights.rim.intensity = lt.rim;
      if (setName === 'battlefield') g.lights.key.position.set(-10, 7, -8);
      g.lights.key.shadow.camera.left = -16; g.lights.key.shadow.camera.right = 16; g.lights.key.shadow.camera.top = 16; g.lights.key.shadow.camera.bottom = -16; g.lights.key.shadow.mapSize.set(2048, 2048);
      g.renderer.toneMappingExposure = p.exposure || 1.05;
      if (setName === 'none') { const sh = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: 0.28 })); sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true; g.scene.add(sh); }
      const figures = {};
      (p.props || []).forEach((pr, i) => {
        const m = buildModel(T, kit, pr.model, look, pr.colors);
        const holder = new T.Group();
        holder.add(m.root);
        holder.position.set(+pr.x || 0, 0, +pr.z || 0);
        holder.rotation.y = (+pr.yaw || 0) * DEG;
        holder.scale.setScalar(+pr.scale || 1);
        g.scene.add(holder);
      });
      const list = (p.cast || []).map((c, i) => {
        const f = c.model ? buildModelFigure(T, kit, c, i, look) : buildFigure(T, kit, c, i);
        f.idx = i; f.lastY = 0;
        f.facing = (c.facing != null ? +c.facing : 0) * DEG;
        g.scene.add(f.root);
        figures[c.id || ('c' + i)] = f;
        return f;
      });
      const fxs = buildFx(T, g, kit, p.fx, built.anchors, figures, (p.seed || 7) * 13);
      const cam = Object.assign({ shot: list.length > 1 ? 'full' : 'medium', yaw: 0, orbit: 10, push: 1.08, moves: [], shake: 1 }, p.camera || {});
      const aspect = g.w / g.h;
      const fit = aspect < 1 ? 1 / Math.max(0.45, aspect) * 0.62 : 1;
      const targetPos = (tg) => {
        if (Array.isArray(tg)) return new T.Vector3(tg[0], tg[1], tg[2]);
        if (tg && figures[tg]) { const f = figures[tg]; return new T.Vector3(f.root.position.x, Math.max(0, f.lastY) * 0.85, f.root.position.z); }
        if (tg && built.anchors[tg] && built.anchors[tg].isVector3) return built.anchors[tg].clone().setY(0);
        if (!list.length) return new T.Vector3(0, 0, 0);
        const c = new T.Vector3(); list.forEach((f) => c.add(f.root.position)); return c.multiplyScalar(1 / list.length);
      };
      const spread = () => { if (list.length < 2) return 0; let lo = 1e9, hi = -1e9; list.forEach((f) => { lo = Math.min(lo, f.root.position.x); hi = Math.max(hi, f.root.position.x); }); return hi - lo; };
      const shotPose = (s, k) => {
        const sh = SHOTS[s.shot] || SHOTS.medium;
        const tp = targetPos(s.target);
        const figH = s.target && figures[s.target] ? figures[s.target].height / 1.9 : 1;
        const dist = (sh[0] * figH + (s.target ? 0 : spread() * 0.75)) * fit / (1 + ((cam.push || 1) - 1) * k);
        const yaw = ((s.yaw != null ? s.yaw : cam.yaw) + (cam.orbit || 0) * (k - 0.5)) * DEG;
        const pos = new T.Vector3(tp.x + Math.sin(yaw) * dist, sh[2] * figH + tp.y, tp.z + Math.cos(yaw) * dist);
        const lookAt = new T.Vector3(tp.x, sh[1] * figH + tp.y, tp.z);
        return { pos, lookAt };
      };
      const D = ctx.D;
      let shakeLevel = 0;
      const stepT = (t) => (steps > 1 ? Math.floor(t * ctx.fps / steps) * steps / ctx.fps : t);
      return (t0) => {
        const t = stepT(t0);
        const stepIdx = Math.floor(t0 * ctx.fps / Math.max(1, steps));
        list.forEach((f) => {
          const o = posePerson(t, f, list, t0);
          if (f.isModel) {
            f.root.position.set(o.x, Math.max(0, o.y > 0.05 ? o.y : 0), o.z);
            f.root.rotation.set(0, o.yaw != null ? o.yaw : f.facing, 0);
            window.AU_MODEL.animate(f.model, t, f.p.actions || []);
            f.lastY = 0;
            return;
          }
          applyPose(T, f, o, f.facing);
          f.lastY = o.y;
          if (boil > 0) { const j = boil * 0.006; f.root.position.x += (hash(stepIdx * 1.7 + f.idx) - 0.5) * j; f.root.rotation.y += (hash(stepIdx * 2.3 + f.idx) - 0.5) * j * 2; f.head.rotation.z += (hash(stepIdx * 3.1 + f.idx) - 0.5) * j * 3; }
          updateFace(f, o, t, look, stepIdx);
        });
        let shake = 0;
        fxs.forEach((fn) => { shake = Math.max(shake, fn(t) || 0); });
        shakeLevel = Math.max(shake, shakeLevel * 0.85);
        const k = clamp((t - at) / Math.max(0.1, (end || D) - at), 0, 1);
        let pose = shotPose(cam, k);
        (cam.moves || []).forEach((m) => {
          const ma = +m.at || 0, md = +m.duration || 1;
          if (t < ma) return;
          const mk = ease(clamp((t - ma) / md, 0, 1));
          const next = shotPose(Object.assign({}, cam, m), k);
          pose = { pos: pose.pos.clone().lerp(next.pos, mk), lookAt: pose.lookAt.clone().lerp(next.lookAt, mk) };
        });
        const amp = shakeLevel * 0.12 * (cam.shake != null ? cam.shake : 1);
        g.camera.position.set(pose.pos.x + Math.sin(t0 * 47) * amp, pose.pos.y + Math.cos(t0 * 53) * amp, pose.pos.z);
        g.camera.lookAt(pose.lookAt);
        if (boil > 0) g.camera.rotation.z += (hash(stepIdx * 5.9) - 0.5) * 0.002 * boil;
        g.camera.fov = 35; g.camera.updateProjectionMatrix();
        el.style.opacity = t0 < at ? '0' : '1';
        g.camera.updateMatrixWorld(true);
        const box = el.getBoundingClientRect();
        const actors = {};
        const pv = new T.Vector3();
        list.forEach((f) => {
          const sc = f.root.scale.x;
          let half;
          if (f.isModel) {
            f.root.getWorldPosition(pv);
            pv.y += f.height * 0.85;
            half = Math.max(0.08, f.height * 0.18);
          } else {
            f.head.getWorldPosition(pv);
            pv.y += f.D.headH * 0.55 * sc;
            half = f.D.headW * 0.62 * sc;
          }
          const c = pv.clone().project(g.camera);
          const edge = pv.clone().add(new T.Vector3(half, 0, 0)).project(g.camera);
          const rx = Math.abs(edge.x - c.x) / 2 * box.width;
          const cx = box.left + (c.x + 1) / 2 * box.width, cy = box.top + (1 - c.y) / 2 * box.height;
          if (c.z < 1) actors[f.p.id || ('c' + f.idx)] = { face: [cx - rx, cy - rx * 1.1, rx * 2, rx * 2.2], top: cy - rx * 1.3, x: cx };
        });
        el.__auActors = actors;
      };
    }, { transparent: (p.set || 'studio') === 'none', fov: 35 });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  reg.define('figure3d', {
    category: '3d', description: 'One procedural 3D character (no model file) on a transparent background with a soft shadow, to drop over any 2D scene: same presets, outfits, props, faces, actions and looks (lowpoly, felt, clay, toy, paper) as world3d.',
    params: {
      at: { type: 'number', default: 0 }, preset: { type: 'string', default: 'kid' }, look: { type: 'enum', default: 'lowpoly', options: Object.keys(LOOKS) }, h: { type: 'number', default: 80, doc: 'viewport height in % of frame' },
      actions: { type: 'array', default: [] }, expression: { type: 'string', default: '' }, facing: { type: 'number', default: 15 }, shot: { type: 'enum', default: 'full', options: Object.keys(SHOTS) },
      outfit: { type: 'string', default: '' }, shirt: { type: 'string', default: '' }, pants: { type: 'string', default: '' }, hair: { type: 'string', default: '' }, hat: { type: 'string', default: '' }, prop: { type: 'string', default: '' }
    },
    example: "component('figure3d', { preset: 'kid', look: 'felt', x: 30, y: 10, w: 40, h: 85, actions: [{ do: 'shock', at: 0.5, duration: 1.2 }] })"
  }, (ctx, p, h) => {
    const c = { id: 'hero', preset: p.preset, facing: p.facing, actions: p.actions, expression: p.expression || undefined };
    ['outfit', 'shirt', 'pants', 'hair', 'hat', 'prop'].forEach((k) => { if (p[k]) c[k] = p[k]; });
    const r = reg.run('world3d', ctx, { set: 'none', look: p.look, cast: [c], camera: { shot: p.shot, target: 'hero', orbit: 8, push: 1.05 }, x: p.x != null ? p.x : 20, y: p.y != null ? p.y : 10, w: p.w != null ? p.w : 60, h: p.h, at: p.at, duration: p.duration, exit: p.exit, layer: p.layer });
    return r;
  });
})();
