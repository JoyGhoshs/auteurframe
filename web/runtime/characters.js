(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const SKIN = { light: '#F2CFB0', tan: '#E0A97E', brown: '#B57A50', dark: '#7A4E31', deep: '#5A3622' };
  const J = {
    armL: [70, 136], foreL: [64, 194], armR: [130, 136], foreR: [136, 194],
    legL: [88, 246], shinL: [86, 320], legR: [112, 246], shinR: [114, 320], head: [100, 122]
  };
  const env = (t, a, b, ramp) => {
    if (t <= a || t >= b) return 0;
    const r = Math.min(ramp, (b - a) / 2);
    if (t < a + r) { const k = (t - a) / r; return k * k * (3 - 2 * k); }
    if (t > b - r) { const k = (b - t) / r; return k * k * (3 - 2 * k); }
    return 1;
  };
  const col = (v, fallback) => (!v ? fallback : String(v).startsWith('--') ? `var(${v})` : v);

  function hairPath(kind) {
    if (kind === 'none') return '';
    if (kind === 'long') return 'M58 80 Q56 30 100 30 Q144 30 142 80 L146 150 Q130 120 132 70 Q120 52 100 52 Q80 52 68 70 Q70 120 54 150 Z';
    if (kind === 'bun') return 'M60 74 Q62 32 100 34 Q138 32 140 74 Q128 54 100 54 Q72 54 60 74 Z M100 6 a16 16 0 1 0 0.1 0 Z';
    if (kind === 'curly') return 'M58 76 Q50 40 74 34 Q80 18 100 24 Q120 16 128 34 Q152 40 142 76 Q130 56 100 56 Q70 56 58 76 Z';
    return 'M60 72 Q62 30 100 32 Q140 30 140 72 Q128 52 100 52 Q74 52 60 72 Z';
  }

  function rigSVG(p, uid) {
    const skin = SKIN[p.skin] || p.skin || SKIN.tan;
    const shirt = col(p.shirt, 'var(--accent)');
    const pants = col(p.pants, 'var(--ink-2)');
    const hair = col(p.hair, 'var(--ink)');
    const shoes = col(p.shoes, 'var(--ink)');
    const ol = p.outline ? 'stroke="var(--ink)" stroke-width="3"' : '';
    const limb = (x1, y1, x2, y2, c, w) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
    const leg = (s, hip, knee, ankle, footX) => `<g class="ch-${s}">${limb(hip[0], hip[1], knee[0], knee[1], pants, 26)}<g class="ch-${s.replace('leg', 'shin')}">${limb(knee[0], knee[1], ankle[0], ankle[1], pants, 22)}<ellipse cx="${footX}" cy="402" rx="18" ry="9" fill="${shoes}"/></g></g>`;
    const arm = (s, sh, el, wr) => `<g class="ch-${s}">${limb(sh[0], sh[1], el[0], el[1], shirt, 21)}<g class="ch-${s.replace('arm', 'fore')}">${limb(el[0], el[1], wr[0], wr[1], skin, 15)}<circle cx="${wr[0]}" cy="${wr[1] + 4}" r="11" fill="${skin}"/></g></g>`;
    return `<svg viewBox="0 0 200 420" width="100%" height="100%" style="overflow:visible" xmlns="http://www.w3.org/2000/svg">
<g class="ch-move"><g class="ch-bob">
${leg('legL', J.legL, J.shinL, [86, 392], 80)}${leg('legR', J.legR, J.shinR, [114, 392], 120)}
<rect class="ch-torso" x="66" y="116" width="68" height="140" rx="30" fill="${shirt}" ${ol}/>
${p.accessory === 'tie' ? '<path d="M100 124 L94 140 L100 190 L106 140 Z" fill="var(--ink)"/>' : ''}
${arm('armL', J.armL, J.foreL, [62, 246])}${arm('armR', J.armR, J.foreR, [138, 246])}
<g class="ch-head">
<rect x="90" y="104" width="20" height="22" rx="6" fill="${skin}"/>
<circle cx="100" cy="76" r="42" fill="${skin}" ${ol}/>
<path d="${hairPath(p.hairStyle)}" fill="${hair}"/>
${p.accessory === 'glasses' ? '<g fill="none" stroke="var(--ink)" stroke-width="3"><circle cx="85" cy="76" r="11"/><circle cx="115" cy="76" r="11"/><path d="M96 76 H104"/></g>' : ''}
<circle cx="80" cy="92" r="7" fill="var(--accent)" opacity=".25"/><circle cx="120" cy="92" r="7" fill="var(--accent)" opacity=".25"/>
<g class="ch-eyes"><ellipse class="ch-eye" cx="85" cy="76" rx="5" ry="6.5" fill="var(--ink)"/><ellipse class="ch-eye" cx="115" cy="76" rx="5" ry="6.5" fill="var(--ink)"/></g>
<path class="ch-brow" d="M77 62 Q85 58 93 62 M107 62 Q115 58 123 62" stroke="${hair}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<path class="ch-mouth-c" d="M90 97 Q100 104 110 97" stroke="var(--ink)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<path class="ch-mouth-o" d="M90 95 Q100 113 110 95 Z" fill="var(--ink)" style="display:none"/>
</g></g></g></svg>`;
  }

  function pose(t, p, acts, blinkTimes, talkWords) {
    const o = { armL: 0, foreL: 0, armR: 0, foreR: 0, legL: 0, shinL: 0, legR: 0, shinR: 0, head: 0, headY: 0, bob: 0, x: 0, jump: 0, mouth: false, eye: 1, look: 0, face: p.facing === 'left' ? -1 : 1 };
    o.bob = Math.sin(t * 2.1) * 1.6;
    o.armL = 4 + Math.sin(t * 2.1) * 1.5; o.armR = -4 - Math.sin(t * 2.1) * 1.5;
    let walkX = 0;
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1.2), w = env(t, at, end, 0.25), k = t - at;
      const kind = a.do;
      if (kind === 'walk' || kind === 'run') {
        const run = kind === 'run';
        const period = run ? 0.42 : 0.62;
        const dist = ((a.to != null ? +a.to : p.x + (run ? 30 : 20)) - (a.from != null ? +a.from : NaN));
        const span = Math.max(0.3, end - at);
        const prog = t <= at ? 0 : t >= end ? 1 : (t - at) / span;
        const phase = Math.max(0, Math.min(k, span)) / period * Math.PI * 2;
        const swing = (run ? 34 : 24) * w;
        o.legL += swing * Math.sin(phase); o.legR -= swing * Math.sin(phase);
        o.shinL += Math.max(0, -Math.sin(phase + 0.6)) * (run ? 40 : 22) * w; o.shinR += Math.max(0, Math.sin(phase + 0.6)) * (run ? 40 : 22) * w;
        o.armR += (run ? 30 : 16) * Math.sin(phase) * w; o.armL += (run ? 30 : 16) * Math.sin(phase) * w;
        if (run) { o.foreR -= 60 * w; o.foreL += 60 * w; }
        o.bob += -Math.abs(Math.sin(phase)) * (run ? 9 : 5) * w;
        if (!Number.isNaN(dist)) walkX += dist * prog; else walkX += ((+a.to || p.x) - p.x) * prog;
        if (t > at) o.face = ((a.to != null ? +a.to : p.x + 1) >= (a.from != null ? +a.from : p.x)) ? 1 : -1;
      } else if (kind === 'wave') {
        o.armR += -150 * w; o.foreR += (-15 + 28 * Math.sin(k * 2 * Math.PI * 2.4)) * w; o.head += 4 * w;
      } else if (kind === 'point') {
        const dir = a.dir || 'right';
        if (dir === 'left') { o.armL += 95 * w; } else if (dir === 'up') { o.armR += -168 * w; } else { o.armR += -95 * w; }
        o.look += (dir === 'left' ? -3 : dir === 'right' ? 3 : 0) * w;
      } else if (kind === 'present') {
        o.armR += -62 * w; o.foreR += -35 * w; o.armL += 30 * w;
      } else if (kind === 'think') {
        o.armR += -38 * w; o.foreR += -128 * w; o.head += 9 * w; o.look += 2 * w;
      } else if (kind === 'celebrate') {
        o.armR += -160 * w; o.armL += 160 * w; o.foreR += 12 * Math.sin(k * 14) * w; o.foreL -= 12 * Math.sin(k * 14) * w;
        o.jump += -46 * Math.abs(Math.sin(Math.PI * k / 0.55)) * w; o.mouth = o.mouth || (w > 0.5);
      } else if (kind === 'shrug') {
        o.armR += -48 * w; o.foreR += 80 * w; o.armL += 48 * w; o.foreL += -80 * w; o.head += -7 * w;
      } else if (kind === 'nod') {
        o.headY += 5 * Math.max(0, Math.sin(k * Math.PI * 4)) * w;
      } else if (kind === 'shake') {
        o.head += 9 * Math.sin(k * Math.PI * 5) * w;
      } else if (kind === 'look') {
        o.look += (a.dir === 'left' ? -3.5 : 3.5) * w;
      } else if (kind === 'sad') {
        o.head += 10 * w; o.headY += 4 * w; o.armR += 6 * w; o.armL += -6 * w;
      }
      if (kind === 'talk' && t > at && t < end) {
        const words = talkWords.filter((x) => x.t < end && x.e > at);
        if (words.length) o.mouth = o.mouth || words.some((x) => t >= x.t && t < x.e && ((t - x.t) % 0.22) < 0.13);
        else o.mouth = o.mouth || Math.sin(t * 2 * Math.PI * 4.6 + Math.sin(t * 3.1) * 1.4) > 0.15;
        o.head += Math.sin(k * 3.3) * 2.5;
      }
    });
    o.x = walkX;
    if (blinkTimes.some((b) => t >= b && t < b + 0.12)) o.eye = 0.12;
    return o;
  }

  reg.define('character', {
    category: 'character', description: 'Rigged 2D explainer character (vector, flat style) with procedural, frame-exact actions: idle breathing and blinking, walk/run to a position, wave, point, present, talk (mouth follows word timings), think, celebrate, shrug, nod, shake, look, sad. Actions can overlap and blend.',
    params: {
      x: { type: 'number', default: 50, doc: 'centre x of the feet in %' }, y: { type: 'number', default: 88, doc: 'feet line y in %' }, h: { type: 'number', default: 46, doc: 'height in % of frame height' },
      facing: { type: 'enum', default: 'right', options: ['right', 'left'] }, skin: { type: 'string', default: 'tan', doc: 'light|tan|brown|dark|deep or a colour' },
      hairStyle: { type: 'enum', default: 'short', options: ['short', 'long', 'bun', 'curly', 'none'] }, hair: { type: 'string', default: '--ink' }, shirt: { type: 'string', default: '--accent' },
      pants: { type: 'string', default: '--ink-2' }, shoes: { type: 'string', default: '--ink' }, accessory: { type: 'enum', default: 'none', options: ['none', 'glasses', 'tie'] }, outline: { type: 'boolean', default: false },
      lipsync: { type: 'string', default: '', doc: "'voice' (film narration) or an audio asset id from speak: the mouth follows the real audio while a talk action runs, or all the time if there is no talk action" },
      lipsyncAt: { type: 'number', default: 0, doc: 'scene seconds when that audio line starts' },
      actions: { type: 'array', default: [{ do: 'wave', at: 0.6, duration: 1.6 }], doc: "[{do:'walk'|'run'|'wave'|'point'|'present'|'talk'|'think'|'celebrate'|'shrug'|'nod'|'shake'|'look'|'sad', at, duration, to (walk/run target x %), dir (point/look: left|right|up)}]" }
    },
    example: "component('character', { x: 20, skin: 'brown', hairStyle: 'curly', actions: [{ do: 'walk', at: 0.2, duration: 1.8, to: 45 }, { do: 'wave', at: 2.1, duration: 1.4 }, { do: 'talk', at: 2.4, duration: 2.5 }] })"
  }, (ctx, p, h) => {
    const hpx = p.h / 100 * ctx.H, wpx = hpx * 200 / 420;
    const el = h.box(Object.assign({}, p, { x: null, y: null }), 'auc-char', { x: 0, y: 0 });
    Object.assign(el.style, { left: (p.x / 100 * ctx.W - wpx / 2) + 'px', top: (p.y / 100 * ctx.H - hpx) + 'px', width: wpx + 'px', height: hpx + 'px' });
    el.innerHTML = rigSVG(p, el.getAttribute('data-layer'));
    const q = (s) => el.querySelector(s);
    const parts = { armL: q('.ch-armL'), foreL: q('.ch-foreL'), armR: q('.ch-armR'), foreR: q('.ch-foreR'), legL: q('.ch-legL'), shinL: q('.ch-shinL'), legR: q('.ch-legR'), shinR: q('.ch-shinR'), head: q('.ch-head') };
    const bob = q('.ch-bob'), eyes = el.querySelectorAll('.ch-eye'), mc = q('.ch-mouth-c'), mo = q('.ch-mouth-o');
    const acts = (p.actions || []).map((a) => Object.assign({}, a, a.do === 'walk' || a.do === 'run' ? { from: a.from != null ? a.from : null } : {})).sort((a, b) => (+a.at || 0) - (+b.at || 0));
    let cursor = p.x;
    acts.forEach((a) => { if (a.do === 'walk' || a.do === 'run') { if (a.from == null) a.from = cursor; if (a.to == null) a.to = cursor + 20; cursor = +a.to; } });
    const blinks = [];
    for (let b = 0.8 + ctx.rand() * 1.5; b < ctx.D; b += 2.2 + ctx.rand() * 2) blinks.push(b);
    const words = [];
    (ctx.cues || []).forEach((c) => (c.words && c.words.length ? c.words : [{ t: c.start, e: c.end }]).forEach((w) => words.push({ t: +w.t, e: +(w.e != null ? w.e : w.t + 0.3) })));
    const { at, end } = h.span(p);
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'au.softLand' }, at);
    h.exitOut(p, el, end, { y: 30 });
    const level = p.lipsync && window.AU_SPEECH ? window.AU_SPEECH(p.lipsync, p.lipsyncAt) : null;
    const hasTalk = acts.some((a) => a.do === 'talk');
    ctx.onFrame((t) => {
      const o = pose(t, p, acts, blinks, words);
      if (level) {
        const inTalk = !hasTalk || acts.some((a) => a.do === 'talk' && t > (+a.at || 0) && t < (+a.at || 0) + (+a.duration || 1));
        o.mouth = inTalk && level(t) > 0.22;
        if (o.mouth) o.head += Math.sin(t * 9) * 1.2;
      }
      const rot = (k, a) => parts[k].setAttribute('transform', `rotate(${a.toFixed(2)} ${J[k][0]} ${J[k][1]})`);
      ['armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'].forEach((k) => rot(k, o[k]));
      parts.head.setAttribute('transform', `translate(0 ${o.headY.toFixed(2)}) rotate(${o.head.toFixed(2)} 100 122)`);
      bob.setAttribute('transform', `translate(0 ${(o.bob + o.jump).toFixed(2)})`);
      el.style.marginLeft = (o.x / 100 * ctx.W).toFixed(1) + 'px';
      q('.ch-move').setAttribute('transform', o.face < 0 ? 'translate(200 0) scale(-1 1)' : '');
      eyes.forEach((e) => { e.setAttribute('ry', (6.5 * o.eye).toFixed(2)); e.setAttribute('transform', `translate(${o.look.toFixed(2)} 0)`); });
      mc.style.display = o.mouth ? 'none' : ''; mo.style.display = o.mouth ? '' : 'none';
    });
    return { el, end };
  });

  reg.define('mascot', {
    category: 'character', description: 'Cute mascot (blob, drop, star or robot) with squash-and-stretch hops, blinks, talking mouth, look and spin. Good for kids, tips, brand explainers.',
    params: { x: { type: 'number', default: 50 }, y: { type: 'number', default: 80, doc: 'ground line y in %' }, size: { type: 'number', default: 26, doc: 'height in % of frame height' },
      shape: { type: 'enum', default: 'blob', options: ['blob', 'drop', 'star', 'robot'] }, color: { type: 'string', default: '--accent' },
      actions: { type: 'array', default: [{ do: 'hop', at: 0.4, duration: 1.5 }], doc: "[{do:'hop'|'talk'|'spin'|'look'|'celebrate'|'shake', at, duration, dir}]" },
      lipsync: { type: 'string', default: '', doc: "'voice' or an audio asset id: the mouth follows the real audio" }, lipsyncAt: { type: 'number', default: 0 } },
    example: "component('mascot', { shape: 'drop', x: 30, actions: [{do:'hop',at:0.3,duration:1.2},{do:'talk',at:1.5,duration:2}] })"
  }, (ctx, p, h) => {
    const hpx = p.size / 100 * ctx.H;
    const el = h.box(Object.assign({}, p, { x: null, y: null }), 'auc-mascot', { x: 0, y: 0 });
    Object.assign(el.style, { left: (p.x / 100 * ctx.W - hpx / 2) + 'px', top: (p.y / 100 * ctx.H - hpx) + 'px', width: hpx + 'px', height: hpx + 'px' });
    const c = col(p.color, 'var(--accent)');
    const body = { blob: 'M100 30 C150 30 180 70 180 120 C180 170 150 190 100 190 C50 190 20 170 20 120 C20 70 50 30 100 30 Z', drop: 'M100 10 C130 60 175 95 175 135 C175 175 142 195 100 195 C58 195 25 175 25 135 C25 95 70 60 100 10 Z',
      star: 'M100 15 L124 72 L185 76 L138 114 L154 175 L100 142 L46 175 L62 114 L15 76 L76 72 Z', robot: 'M40 50 H160 Q172 50 172 62 V176 Q172 188 160 188 H40 Q28 188 28 176 V62 Q28 50 40 50 Z M96 50 V26 M104 26 a8 8 0 1 0 -0.1 0' }[p.shape];
    el.innerHTML = `<svg viewBox="0 0 200 200" width="100%" height="100%" style="overflow:visible"><ellipse class="m-shadow" cx="100" cy="196" rx="62" ry="8" fill="var(--ink)" opacity=".18"/><g class="m-body"><path d="${body}" fill="${c}" ${p.shape === 'robot' ? 'stroke="var(--ink)" stroke-width="4"' : ''}/><g class="m-eyes"><ellipse class="m-eye" cx="78" cy="112" rx="9" ry="12" fill="var(--ink)"/><ellipse class="m-eye" cx="122" cy="112" rx="9" ry="12" fill="var(--ink)"/><circle cx="81" cy="107" r="3" fill="#fff"/><circle cx="125" cy="107" r="3" fill="#fff"/></g><path class="m-mc" d="M86 142 Q100 152 114 142" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round"/><path class="m-mo" d="M86 140 Q100 166 114 140 Z" fill="var(--ink)" style="display:none"/></g></svg>`;
    const bodyG = el.querySelector('.m-body'), eyes = el.querySelectorAll('.m-eye'), mc = el.querySelector('.m-mc'), mo = el.querySelector('.m-mo'), shadow = el.querySelector('.m-shadow');
    const blinks = [];
    for (let b = 0.7 + ctx.rand(); b < ctx.D; b += 1.8 + ctx.rand() * 2) blinks.push(b);
    const { at, end } = h.span(p);
    ctx.tl.fromTo(el, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'au.pop' }, at);
    h.exitOut(p, el, end, { y: 0, scale: 0.6 });
    ctx.onFrame((t) => {
      let y = Math.sin(t * 2.2) * 2, sx = 1, sy = 1, rot = 0, look = 0, mouth = false;
      (p.actions || []).forEach((a) => {
        const a0 = +a.at || 0, a1 = a0 + (+a.duration || 1), w = env(t, a0, a1, 0.15), k = t - a0;
        if (a.do === 'hop' || a.do === 'celebrate') {
          const ph = (k % 0.6) / 0.6;
          const air = Math.sin(Math.PI * ph);
          y += -38 * air * w; sy += (ph < 0.12 || ph > 0.88 ? -0.14 : 0.08 * air) * w; sx += (ph < 0.12 || ph > 0.88 ? 0.14 : -0.05 * air) * w;
          if (a.do === 'celebrate') mouth = mouth || w > 0.4;
        } else if (a.do === 'spin') { rot += 360 * Math.min(1, Math.max(0, k / (a1 - a0))) * (w > 0 ? 1 : 0); }
        else if (a.do === 'look') { look += (a.dir === 'left' ? -5 : 5) * w; }
        else if (a.do === 'shake') { rot += 8 * Math.sin(k * 30) * w; }
        if (a.do === 'talk' && t > a0 && t < a1) mouth = Math.sin(t * 2 * Math.PI * 4.4 + Math.sin(t * 2.7)) > 0.1;
      });
      if (p.lipsync && window.AU_SPEECH) { const lv = window.AU_SPEECH(p.lipsync, p.lipsyncAt); if (lv) mouth = lv(t) > 0.22; }
      bodyG.setAttribute('transform', `translate(100 190) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-100 -190) translate(0 ${y.toFixed(2)}) rotate(${rot.toFixed(1)} 100 110)`);
      shadow.setAttribute('rx', (62 * (1 + y / 120)).toFixed(1));
      const blink = blinks.some((b) => t >= b && t < b + 0.11);
      eyes.forEach((e) => { e.setAttribute('ry', blink ? '1.5' : '12'); e.setAttribute('transform', `translate(${look} 0)`); });
      mc.style.display = mouth ? 'none' : ''; mo.style.display = mouth ? '' : 'none';
    });
    return { el, end };
  });

  reg.define('sprite', {
    category: 'character', description: 'Frame-by-frame sprite from a sprite sheet asset (for example a sprite-gen atlas). Give the manifest (asset id of its JSON, or inline) and a state; frames play at the state fps, looping, frame-exact.',
    params: { src: { type: 'string', default: '', doc: 'sprite sheet image asset id' }, manifest: { type: 'string', default: '', doc: 'asset id of the JSON manifest, or a JSON object' }, state: { type: 'string', default: 'idle' },
      grid: { type: 'array', default: null, doc: '[cols, rows, frameCount] when there is no manifest' }, fps: { type: 'number', default: 12 }, h: { type: 'number', default: 30 }, moveTo: { type: 'number', default: null, doc: 'x % to travel to over the duration' } },
    example: "component('sprite', { src: 'as_atlas0001', manifest: 'as_manif0001', state: 'walk', x: 10, y: 60, h: 28, moveTo: 70 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-sprite', { x: 40, y: 50 });
    el.style.height = p.h + '%';
    el.style.backgroundImage = `url("${ctx.asset(p.src)}")`;
    el.style.backgroundRepeat = 'no-repeat';
    el.style.imageRendering = 'auto';
    const { at, end } = h.span(p);
    const state = { frames: [], fps: p.fps, loop: true, sheetW: 0, sheetH: 0 };
    const loadImg = new Promise((res) => { const im = new Image(); im.onload = () => { state.sheetW = im.naturalWidth; state.sheetH = im.naturalHeight; res(); }; im.onerror = () => res(); im.src = ctx.asset(p.src); });
    const pick = (m) => {
      const layout = m.frame_layout || m.frameLayout || m;
      const states = layout.states || layout.animations || layout;
      const st = states[p.state] || Object.values(states).find((v) => v && (v.frames || v.rects)) || {};
      const rects = st.frames || st.rects || [];
      state.frames = rects.map((r) => (Array.isArray(r) ? { x: r[0], y: r[1], w: r[2], h: r[3] } : { x: r.x, y: r.y, w: r.w || r.width, h: r.h || r.height }));
      state.fps = st.fps || p.fps; state.loop = st.loop !== false;
    };
    const loadManifest = typeof p.manifest === 'object' && p.manifest ? Promise.resolve(pick(p.manifest)) :
      p.manifest ? fetch(ctx.asset(p.manifest)).then((r) => r.json()).then(pick) : Promise.resolve();
    ctx.defer(Promise.all([loadImg, loadManifest]).then(() => {
      if (!state.frames.length && p.grid && state.sheetW) {
        const [cols, rows, count] = p.grid; const fw = state.sheetW / cols, fh = state.sheetH / rows;
        for (let i = 0; i < (count || cols * rows); i++) state.frames.push({ x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh });
      }
    }));
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.set(el, { autoAlpha: 1 }, at);
    h.exitOut(p, el, end, { y: 0 });
    const x0 = p.x != null ? p.x : 40;
    ctx.onFrame((t) => {
      if (!state.frames.length) return;
      const n = state.frames.length;
      let i = Math.floor(Math.max(0, t - at) * state.fps);
      i = state.loop ? i % n : Math.min(n - 1, i);
      const f = state.frames[i];
      const scale = el.clientHeight / f.h;
      el.style.width = (f.w * scale) + 'px';
      el.style.backgroundSize = `${state.sheetW * scale}px ${state.sheetH * scale}px`;
      el.style.backgroundPosition = `${-f.x * scale}px ${-f.y * scale}px`;
      if (p.moveTo != null) el.style.left = (x0 + (p.moveTo - x0) * Math.max(0, Math.min(1, (t - at) / Math.max(0.1, end - at)))) + '%';
    });
    return { el, end };
  });
})();
