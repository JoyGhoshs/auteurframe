(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const INK = '#221c22';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const env = (t, a, e, f) => (t < a || t > e ? 0 : Math.min(1, (t - a) / f, (e - t) / f));
  const SPECIES = {
    dog: { color: '#C98B4E', color2: '#F3DDBF', ears: 'floppy', tail: 'wag', snout: 1, size: [1, 1] },
    cat: { color: '#7E7E86', color2: '#E9E5DF', ears: 'pointy', tail: 'long', snout: 0.45, size: [0.9, 0.85] },
    rabbit: { color: '#F1EDE6', color2: '#F7C9CF', ears: 'long', tail: 'puff', snout: 0.4, size: [0.8, 0.75] },
    fox: { color: '#E07A2E', color2: '#FFF4E6', ears: 'pointy', tail: 'bushy', snout: 1.1, size: [1, 0.9] },
    pig: { color: '#F2A7B5', color2: '#F7C4CE', ears: 'flap', tail: 'curl', snout: 0.7, size: [1.1, 0.95] },
    bird: { color: '#4FA3E0', color2: '#FFD24F', ears: 'none', tail: 'feather', snout: 0, size: [0.6, 0.6] },
    bear: { color: '#8A5A3A', color2: '#D9B08C', ears: 'round', tail: 'puff', snout: 0.9, size: [1.2, 1.1] },
    mouse: { color: '#A9A9B3', color2: '#F7C9CF', ears: 'round-big', earColor: '#F7C9CF', tail: 'long', snout: 0.5, size: [0.6, 0.6] },
    lion: { color: '#E0A040', color2: '#F6DDA8', ears: 'round', tail: 'tuft', snout: 0.9, mane: '#B8642A', size: [1.15, 1.05] },
    sheep: { color: '#F4F1EA', color2: '#E6DED0', ears: 'flap', earColor: '#3A3238', tail: 'puff', snout: 0.6, wool: true, size: [1, 0.95] },
    cow: { color: '#FFFFFF', color2: '#F2B8C4', ears: 'flap', tail: 'tuft', snout: 1, horns: true, spots: true, size: [1.3, 1.1] },
    horse: { color: '#9A6236', color2: '#D9B08C', ears: 'pointy', tail: 'bushy', snout: 1.4, mane: '#3A2418', maneStyle: 'crest', size: [1.3, 1.2] },
    panda: { color: '#FFFFFF', color2: '#F4F4F4', ears: 'round', earColor: '#221c22', tail: 'puff', snout: 0.7, patches: true, legColor: '#221c22', size: [1.15, 1.05] }
  };
  const W0 = 300, H0 = 220;

  function pose(t, p, acts) {
    const o = { x: p.x, dir: p.facing === 'left' ? -1 : 1, legs: 0, bob: Math.sin(t * 2.4) * 1.5, head: 0, tail: Math.sin(t * 3) * 10, ears: 0, sit: 0, lie: 0, beg: 0,
      mouth: 'smile', eyes: 'open', jump: 0, mood: p.expression || 'happy', bark: 0, zz: 0, moving: null };
    let x = p.x;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1);
      if ((a.do === 'walk' || a.do === 'run' || a.do === 'sniff') && a.to != null && t >= at) {
        const from = a.from != null ? +a.from : x;
        x = lerp(from, +a.to, a.do === 'run' ? k : smooth(k));
        if (t < end) o.moving = { run: a.do === 'run', ph: (t - at) * (a.do === 'run' ? 16 : 9) };
        o.dir = +a.to >= from ? 1 : -1;
      }
    });
    o.x = x;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), u = t - at;
      const holds = a.do === 'sit' || a.do === 'sleep' || a.do === 'lie' || a.hold;
      const w = holds && t > end ? 1 : env(t, at, end, 0.18);
      if (t >= at && t <= end && a.expression) o.mood = a.expression;
      if (!w) return;
      switch (a.do) {
        case 'sit': o.sit = Math.max(o.sit, w); break;
        case 'lie': case 'sleep': o.lie = Math.max(o.lie, w); if (a.do === 'sleep') { o.eyes = 'closed'; o.zz = w; } break;
        case 'jump': { const j = clamp(u / Math.min(0.8, end - at), 0, 1); o.jump += Math.sin(j * Math.PI) * 70 * w; break; }
        case 'wag': case 'happy': o.tail = Math.sin(t * 22) * 32; o.bob += Math.abs(Math.sin(t * 10)) * -6 * w; o.mood = 'happy'; break;
        case 'bark': o.bark = Math.max(o.bark, Math.max(0, Math.sin(u * 14)) * w); o.head -= 8 * w; break;
        case 'eat': o.head += (24 + Math.sin(t * 12) * 6) * w; o.tail = Math.sin(t * 18) * 26; break;
        case 'sniff': o.head += 18 * w; o.ears += 4 * w; break;
        case 'look': o.head += (a.dir === 'up' ? -16 : a.dir === 'down' ? 14 : 0) * w; if (a.dir === 'back') o.dir *= -1; break;
        case 'sad': o.mood = 'sad'; o.ears += 18 * w; o.tail = lerp(o.tail, 40, w); o.head += 8 * w; break;
        case 'beg': o.beg = Math.max(o.beg, w); o.tail = Math.sin(t * 20) * 28; break;
        case 'shock': o.mood = 'surprised'; o.jump += Math.sin(clamp(u / 0.3, 0, 1) * Math.PI) * 30 * w; o.ears -= 10 * w; break;
      }
    });
    if (o.moving) {
      o.legs = o.moving.ph;
      o.bob += Math.abs(Math.sin(o.moving.ph)) * (o.moving.run ? -8 : -4);
      o.tail = Math.sin(o.moving.ph) * 14 + (o.moving.run ? -20 : 0);
    }
    return o;
  }

  function draw(sp, c, o, t, blink) {
    const s = SPECIES[sp] || SPECIES.dog;
    const col = c.color || s.color, col2 = c.color2 || s.color2;
    const stroke = `stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
    const thin = `stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"`;
    if (sp === 'bird') {
      const flap = o.moving || o.jump > 2 ? Math.sin(t * 30) * 30 : Math.sin(t * 3) * 4;
      return `<g transform="translate(150 ${150 - o.jump + o.bob})">
        <path d="M-40 10 L-78 -4 L-70 22 Z" fill="${col}" ${stroke}/>
        <line x1="-10" y1="38" x2="-14" y2="64" ${thin}/><line x1="12" y1="38" x2="10" y2="64" ${thin}/>
        <ellipse cx="0" cy="0" rx="50" ry="42" fill="${col}" ${stroke}/>
        <ellipse cx="6" cy="14" rx="30" ry="22" fill="${col2}" stroke="none"/>
        <path d="M-14 -4 Q-40 ${-10 - flap} -48 ${10 - flap * 0.4} Q-26 18 -6 8 Z" fill="${col}" ${stroke}/>
        <g transform="rotate(${o.head * 0.5})"><path d="M44 -12 L68 -4 L44 4 Z" fill="#F2A33A" ${stroke}/>
        ${blink ? `<path d="M22 -16 q6 4 12 0" ${thin}/>` : `<circle cx="28" cy="-16" r="6" fill="${INK}"/><circle cx="30" cy="-18" r="2" fill="#fff"/>`}</g></g>`;
    }
    const [sx, sy] = s.size;
    const sit = o.sit, lie = o.lie, beg = o.beg;
    const bodyTilt = -sit * 28 - beg * 58;
    const legLen = 46 * (1 - lie * 0.85);
    const leg = (x0, y0, ang, front) => {
      const a = ang * Math.PI / 180;
      const x1 = x0 + Math.sin(a) * legLen, y1 = y0 + Math.cos(a) * legLen;
      return `<path d="M${x0} ${y0} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M${x0} ${y0} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${s.legColor || col}" stroke-width="12" stroke-linecap="round"/>`;
    };
    const sw = o.moving ? Math.sin(o.legs) * (o.moving.run ? 38 : 24) : 0;
    const backLegs = sit > 0.3 ? `<ellipse cx="-44" cy="34" rx="34" ry="20" fill="${col}" ${stroke}/>` : leg(-44, 20, -sw, false) + leg(-30, 20, sw * 0.8, false);
    const frontLegs = beg > 0.3 ? `<path d="M50 -6 q18 -10 26 6" stroke="${INK}" stroke-width="20" stroke-linecap="round" fill="none"/><path d="M50 -6 q18 -10 26 6" stroke="${col}" stroke-width="10" stroke-linecap="round" fill="none"/>`
      : leg(40, 18, sw, true) + leg(54, 18, -sw * 0.8, true);
    const tailBase = [-66, -6];
    let tail = '';
    const ta = o.tail;
    if (s.tail === 'wag' || s.tail === 'long') tail = `<path d="M${tailBase[0]} ${tailBase[1]} q-30 ${-20 + ta * 0.4} -40 ${-50 + ta}" ${thin.replace('5', '16')}/><path d="M${tailBase[0]} ${tailBase[1]} q-30 ${-20 + ta * 0.4} -40 ${-50 + ta}" stroke="${col}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
    else if (s.tail === 'bushy') tail = `<path d="M${tailBase[0]} ${tailBase[1]} q-40 ${-10 + ta * 0.3} -64 ${-40 + ta * 0.6} q22 30 64 40 Z" fill="${col}" ${stroke}/><path d="M-118 ${-40 + ta * 0.6} q8 10 18 12" stroke="${col2}" stroke-width="12" stroke-linecap="round" fill="none"/>`;
    else if (s.tail === 'puff') tail = `<circle cx="-72" cy="-10" r="16" fill="${col2 === '#F7C9CF' ? '#fff' : col2}" ${stroke}/>`;
    else if (s.tail === 'curl') tail = `<path d="M-68 -8 q-16 -6 -14 -18 q4 -10 12 -2 q4 8 -8 10" ${thin}/>`;
    else if (s.tail === 'tuft') tail = `<path d="M${tailBase[0]} ${tailBase[1]} q-26 ${10 + ta * 0.3} -34 ${36 + ta * 0.5}" ${thin}/><ellipse cx="${tailBase[0] - 34}" cy="${tailBase[1] + 40 + ta * 0.5}" rx="9" ry="13" fill="${s.mane || INK}" ${stroke.replace('6', '4')}/>`;
    const earsUp = o.ears;
    let ears = '';
    if (s.ears === 'floppy') ears = `<path d="M-14 -40 q-22 ${8 + earsUp} -18 ${44 + earsUp} q14 -4 22 -36 Z" fill="${col2 === s.color2 ? '#8A5A30' : col2}" ${stroke}/>`;
    else if (s.ears === 'pointy') ears = `<path d="M-26 -30 L-20 ${-70 + earsUp} L0 -42 Z" fill="${col}" ${stroke}/><path d="M6 -42 L22 ${-72 + earsUp} L30 -32 Z" fill="${col}" ${stroke}/>`;
    else if (s.ears === 'long') ears = `<path d="M-18 -40 q-12 ${-60 + earsUp} 4 ${-80 + earsUp * 1.5} q18 20 6 80 Z" fill="${col}" ${stroke}/><path d="M6 -42 q2 ${-60 + earsUp} 22 ${-74 + earsUp * 1.5} q12 24 -8 76 Z" fill="${col}" ${stroke}/>`;
    else if (s.ears === 'flap') ears = `<path d="M-20 -34 l-6 -26 l22 14 Z" fill="${s.earColor || col}" ${stroke}/><path d="M10 -38 l8 -26 l12 22 Z" fill="${s.earColor || col}" ${stroke}/>`;
    else if (s.ears === 'round' || s.ears === 'round-big') {
      const r = s.ears === 'round-big' ? 26 : 16, ec = s.earColor || col;
      ears = `<circle cx="-22" cy="${-40 + earsUp * 0.3}" r="${r}" fill="${ec}" ${stroke}/><circle cx="36" cy="${-44 + earsUp * 0.3}" r="${r}" fill="${ec}" ${stroke}/>`
        + (s.ears === 'round-big' ? `<circle cx="-22" cy="-40" r="${r - 10}" fill="${col2}"/><circle cx="36" cy="-44" r="${r - 10}" fill="${col2}"/>` : '');
    }
    if (s.horns) ears += `<path d="M-14 -44 q-14 -18 -4 -30 q2 14 14 22 Z M30 -48 q10 -20 24 -22 q-8 12 -12 26 Z" fill="#F3EAD2" ${stroke.replace('6', '4')}/>`;
    let mane = '';
    if (s.mane && s.maneStyle === 'crest') mane = `<path d="M-30 -30 q-6 -30 18 -48 q-4 18 10 14 q2 -18 22 -22 q-6 16 6 20 q-30 6 -56 36 Z" fill="${s.mane}" ${stroke}/>`;
    else if (s.mane) {
      const pts = [];
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 56 : 70; pts.push(`${(10 + Math.cos(a) * r).toFixed(1)} ${(-6 + Math.sin(a) * r).toFixed(1)}`); }
      mane = `<path d="M${pts.join(' L')} Z" fill="${s.mane}" ${stroke}/>`;
    }
    let wool = '';
    if (s.wool) {
      const puffs = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; puffs.push(`<circle cx="${(Math.cos(a) * 66).toFixed(1)}" cy="${(Math.sin(a) * 36).toFixed(1)}" r="20" fill="${col}" ${stroke.replace('6', '5')}/>`); }
      wool = puffs.join('');
    }
    const patches = s.patches ? `<ellipse cx="2" cy="-12" rx="12" ry="15" fill="${INK}" transform="rotate(20 2 -12)"/><ellipse cx="30" cy="-12" rx="12" ry="15" fill="${INK}" transform="rotate(-20 30 -12)"/>` : '';
    const snout = s.snout;
    const eye = (x) => (blink || o.eyes === 'closed' ? `<path d="M${x - 7} -12 q7 6 14 0" ${thin}/>` : o.mood === 'surprised'
      ? `<circle cx="${x}" cy="-14" r="10" fill="#fff" ${stroke.replace('6', '4')}/><circle cx="${x}" cy="-13" r="4.5" fill="${INK}"/>`
      : s.patches ? `<circle cx="${x}" cy="-14" r="5.5" fill="#fff"/><circle cx="${x + 1}" cy="-14" r="3" fill="${INK}"/>`
        : `<circle cx="${x}" cy="-14" r="6.5" fill="${INK}"/><circle cx="${x + 2}" cy="-16" r="2.2" fill="#fff"/>`);
    const brows = o.mood === 'sad' ? `<path d="M-6 -30 l12 -4 M22 -34 l12 4" ${thin}/>` : o.mood === 'surprised' ? `<path d="M-6 -34 l12 -2 M22 -36 l12 2" ${thin}/>` : '';
    const mouthY = 8 + snout * 4;
    const mouth = o.bark > 0.2 || o.mood === 'surprised' ? `<ellipse cx="${30 + snout * 14}" cy="${mouthY + 4}" rx="8" ry="${6 + o.bark * 6}" fill="#7A1F2B" ${stroke.replace('6', '4')}/>`
      : o.mood === 'sad' ? `<path d="M${22 + snout * 12} ${mouthY + 8} q8 -6 16 0" ${thin}/>` : `<path d="M${20 + snout * 12} ${mouthY} q8 8 18 0" ${thin}/>`;
    const nose = sp === 'pig' ? `<ellipse cx="${46 + snout * 10}" cy="-2" rx="14" ry="11" fill="#E98BA0" ${stroke}/><circle cx="${42 + snout * 10}" cy="-2" r="2.5" fill="${INK}"/><circle cx="${50 + snout * 10}" cy="-2" r="2.5" fill="${INK}"/>`
      : `<ellipse cx="${36 + snout * 22}" cy="-4" rx="${7 + snout * 2}" ry="6" fill="${INK}"/>`;
    const snoutShape = snout > 0.5 && sp !== 'pig' ? `<ellipse cx="${30 + snout * 14}" cy="2" rx="${14 + snout * 12}" ry="16" fill="${col2}" ${stroke}/>` : '';
    const collar = c.collar ? `<path d="M-14 26 q24 12 44 -2" stroke="${c.collar}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="10" cy="36" r="6" fill="#F2C12E" ${stroke.replace('6', '3')}/>` : '';
    const spots = (c.spots || s.spots) ? `<ellipse cx="-20" cy="-12" rx="16" ry="11" fill="${col2 === s.color2 ? '#3A2A20' : col2}" opacity=".85"/><ellipse cx="16" cy="6" rx="10" ry="7" fill="${col2 === s.color2 ? '#3A2A20' : col2}" opacity=".85"/>` : '';
    const zz = o.zz ? `<text x="60" y="-70" font-family="Kalam, cursive" font-size="34" fill="${INK}" opacity="${(0.5 + 0.5 * Math.sin(t * 3)).toFixed(2)}">z z</text>` : '';
    const headX = 58, headY = -36 - sit * 22 - beg * 40 + o.head * 0.4;
    return `<g transform="translate(150 ${(150 - o.jump + o.bob + lie * 30).toFixed(1)}) scale(${sx} ${sy})">
      <ellipse cx="0" cy="${70 - lie * 6}" rx="${86 - o.jump * 0.5}" ry="10" fill="${INK}" opacity="${(0.14 * clamp(1 - o.jump / 120, 0.3, 1)).toFixed(2)}" transform="translate(0 ${o.jump})"/>
      <g transform="rotate(${bodyTilt.toFixed(1)} -40 20)">
        ${tail}${backLegs}${wool}
        <ellipse cx="0" cy="0" rx="74" ry="${42 - lie * 6}" fill="${col}" ${s.wool ? 'stroke="none"' : stroke}/>
        <ellipse cx="10" cy="16" rx="44" ry="18" fill="${col2}" stroke="none"/>
        ${spots}${frontLegs}${collar}
      </g>
      <g transform="translate(${headX} ${headY.toFixed(1)}) rotate(${(o.head + bodyTilt * 0.3).toFixed(1)})">
        ${mane}${s.ears !== 'floppy' ? ears : ''}
        <circle cx="10" cy="-6" r="44" fill="${col}" ${stroke}/>
        ${patches}${snoutShape}${s.ears === 'floppy' ? ears : ''}${brows}${eye(4)}${eye(28)}${nose}${mouth}
        ${o.mood === 'happy' && !o.bark ? `<ellipse cx="-10" cy="10" rx="9" ry="5" fill="#FF8FA3" opacity=".55"/>` : ''}
      </g>${zz}</g>`;
  }

  reg.define('speech', {
    category: 'character', description: 'Speech, thought or shout bubble that follows a character: it finds the speaker every frame (toon, toon-animal or stickman by its layer name, or a world3d cast id), sits above the head with its tail pointing down, never covers a face and stays inside the safe area. Text uses the film type scale.',
    params: {
      target: { type: 'string', default: '', doc: 'layer name of the toon, toon-animal or stickman, or a world3d cast id' },
      text: { type: 'string', default: '' }, kind: { type: 'enum', default: 'speech', options: ['speech', 'thought', 'shout'] },
      size: { type: 'enum', default: 'md', options: ['lg', 'md', 'sm'] }, maxw: { type: 'number', default: 34, doc: 'max width in % of frame width' },
      at: { type: 'number', default: 0.2 }, duration: { type: 'number', default: 1.8 }
    },
    example: "component('speech', { target: 'mia', text: 'Biscuit? Where are you?', at: 0.6, duration: 1.8 })"
  }, (ctx, p, h) => {
    const W = ctx.W, H = ctx.H, safe = ctx.safe;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: null }), 'auc-speech kind-' + p.kind, { x: 0, y: 0 });
    const shout = p.kind === 'shout';
    Object.assign(el.style, { position: 'absolute', maxWidth: (p.maxw / 100 * W) + 'px', width: 'max-content', padding: '0.45em 0.8em', borderRadius: shout ? '10px' : '1.1em',
      background: '#fffdf8', color: '#1d1a1f', border: (shout ? 7 : 5) + 'px solid #221c22', fontFamily: 'var(--font-body)', fontWeight: shout ? 900 : 700,
      fontSize: `var(--fs-${p.size})`, lineHeight: 1.15, textAlign: 'center', textWrap: 'balance', textTransform: shout ? 'uppercase' : 'none', boxShadow: '0 10px 0 rgba(34,28,34,.18)', zIndex: 50,
      transformOrigin: '50% 100%' });
    el.innerHTML = `<span class="sp-text"></span><i class="sp-tail" style="position:absolute;left:50%;bottom:-24px;width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-top:24px solid #221c22;transform:translateX(-50%)"></i><i style="position:absolute;left:50%;bottom:-15px;width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:16px solid #fffdf8;transform:translateX(-50%)"></i>`;
    el.querySelector('.sp-text').textContent = p.text;
    if (p.kind === 'thought') { el.querySelectorAll('i').forEach((i) => i.remove()); el.insertAdjacentHTML('beforeend', '<i style="position:absolute;left:46%;bottom:-26px;width:18px;height:18px;border-radius:50%;background:#fffdf8;border:4px solid #221c22"></i><i style="position:absolute;left:52%;bottom:-46px;width:10px;height:10px;border-radius:50%;background:#fffdf8;border:3px solid #221c22"></i>'); }
    const { at, end } = h.span(p);
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.fromTo(el, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.24, ease: 'back.out(2)' }, at);
    if (end < ctx.D - 0.05) ctx.tl.to(el, { autoAlpha: 0, scale: 0.9, duration: 0.18, ease: 'power2.in' }, Math.max(at + 0.3, end - 0.18));
    const stage = document.getElementById('au-stage');
    ctx.onFrame(() => {
      const a = window.AU_ACTOR ? window.AU_ACTOR(p.target) : null;
      const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
      const bw = el.offsetWidth, bh = el.offsetHeight;
      let cx = W / 2, top = H * 0.3;
      if (a) { cx = a.x - sr.left; top = Math.min(a.top, a.face[1]) - sr.top; }
      let x = cx - bw / 2, y = top - bh - 34;
      x = Math.max(safe.x, Math.min(safe.x + safe.w - bw, x));
      if (y < safe.y * 0.6) y = safe.y * 0.6;
      el.style.left = x.toFixed(1) + 'px';
      el.style.top = y.toFixed(1) + 'px';
      const tail = Math.max(18, Math.min(bw - 18, cx - x));
      el.querySelectorAll('i').forEach((i, k) => { if (p.kind !== 'thought') i.style.left = tail + 'px'; });
    });
    return { el, end };
  });

  reg.define('toon-animal', {
    category: 'character', description: 'Cartoon animal in the same bold outlined style as toon: dog, cat, rabbit, fox, pig, bird, bear, mouse, lion, sheep, cow, horse or panda with expressive face, collar and spots. Acts with walk, run, sniff (with to: x%), sit, lie, sleep, jump, wag, happy, bark, eat, look, sad, beg and shock. Use for pets and animal characters in toon stories.',
    params: {
      at: { type: 'number', default: 0 }, species: { type: 'enum', default: 'dog', options: Object.keys(SPECIES) },
      y: { type: 'number', default: 88, doc: 'ground line in % of frame height' }, h: { type: 'number', default: 22, doc: 'animal height in % of frame height' },
      facing: { type: 'enum', default: 'right', options: ['right', 'left'] }, color: { type: 'string', default: '' }, color2: { type: 'string', default: '', doc: 'belly, ear or spot colour' },
      collar: { type: 'string', default: '', doc: 'collar colour, empty for none' }, spots: { type: 'boolean', default: false }, expression: { type: 'enum', default: 'happy', options: ['happy', 'neutral', 'sad', 'surprised'] },
      actions: { type: 'array', default: [], doc: '[{do: walk|run|sniff (to: x%), sit, lie, sleep, jump, wag, happy, bark, eat, look (dir), sad, beg, shock, at, duration, expression}]' }
    },
    example: "component('toon-animal', { species: 'dog', x: 70, color: '#C98B4E', collar: '#D32F2F', actions: [{ do: 'run', at: 0.4, duration: 1.6, to: 40 }, { do: 'wag', at: 2.2, duration: 1.5 }] })"
  }, (ctx, p, h) => {
    const W = ctx.W, H = ctx.H;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-animal', { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { height: '100%', pointerEvents: 'none', overflow: 'visible' });
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;overflow:visible"><g class="an-root"></g></svg>`;
    el.setAttribute('data-facing', p.facing || 'right');
    const root = el.querySelector('.an-root');
    const { at, end } = h.span(p);
    const k = (p.h / 100 * H) / H0;
    const acts = p.actions || [];
    if (at > 0) {
      ctx.tl.set(el, { autoAlpha: 0 }, 0);
      ctx.tl.set(el, { autoAlpha: 1 }, at);
    }
    ctx.onFrame((t) => {
      const o = pose(t, Object.assign({}, p, { x: p.x != null ? +p.x : 60 }), acts);
      const bt = (t + (p.seed || 1.3)) % 3.1;
      const blink = bt < 0.11;
      const gx = o.x / 100 * W, gy = p.y / 100 * H;
      el.setAttribute('data-facing', o.dir < 0 ? 'left' : 'right');
      root.setAttribute('transform', `translate(${(gx - 150 * k * o.dir).toFixed(1)} ${(gy - (H0 - 0) * k).toFixed(1)}) scale(${(k * o.dir).toFixed(4)} ${k.toFixed(4)})`);
      root.innerHTML = draw(p.species, p, o, t, blink);
    });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });
})();
