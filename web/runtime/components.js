(function () {
  const defs = {};
  const COMMON = {
    at: { type: 'number', default: 0.2, doc: 'start time in scene seconds' },
    duration: { type: 'number', default: null, doc: 'seconds visible; default lasts until the scene ends' },
    x: { type: 'number', default: null, doc: 'left edge in % of frame width (component default if omitted)' },
    y: { type: 'number', default: null, doc: 'top edge in % of frame height' },
    w: { type: 'number', default: null, doc: 'width in % of frame width' },
    exit: { type: 'boolean', default: true, doc: 'animate out at the end of duration' },
    layer: { type: 'string', default: null, doc: 'data-layer id for the editor; auto if omitted' }
  };
  let seq = 0;

  function define(name, meta, build) { defs[name] = { meta: Object.assign({ name, category: 'misc', params: {} }, meta), build }; }

  function helpers(ctx) {
    const root = () => document.querySelector('#au-scene .scene') || document.getElementById('au-scene') || document.body;
    const span = (p) => { const at = Math.max(0, +p.at || 0); const end = p.duration == null ? ctx.D : Math.min(ctx.D, at + Math.max(0.2, +p.duration)); return { at, end }; };
    const box = (p, cls, def) => {
      const el = document.createElement('div');
      el.className = 'auc ' + cls;
      seq += 1;
      el.setAttribute('data-layer', p.layer || (cls.split(' ')[0] + '-' + seq));
      const x = p.x != null ? p.x : def.x, y = p.y != null ? p.y : def.y, w = p.w != null ? p.w : def.w;
      Object.assign(el.style, { position: 'absolute', left: x + '%', top: y + '%' });
      if (w != null) el.style.width = w + '%';
      if (def.center) el.style.transform = 'translate(-50%, -50%)';
      root().appendChild(el);
      return el;
    };
    const exitOut = (p, targets, end, vars) => {
      if (!p.exit || end >= ctx.D - 0.05) return;
      ctx.tl.to(targets, Object.assign({ autoAlpha: 0, y: -24, duration: 0.35, ease: 'au.exit', stagger: 0.03 }, vars || {}), Math.max(0, end - 0.35));
      ctx.tl.set(targets, { autoAlpha: 0 }, end);
    };
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="auc-accent">$1</em>');
    const color = (v, fallback) => (v ? (String(v).startsWith('--') ? `var(${v})` : v) : fallback);
    return { root, span, box, exitOut, esc, rich, color };
  }

  const reg = {
    define,
    has: (n) => !!defs[n],
    list: () => Object.values(defs).map((d) => d.meta),
    meta: (n) => (defs[n] ? defs[n].meta : null),
    run(name, ctx, params) {
      const d = defs[name];
      const spec = Object.assign({}, COMMON, d.meta.params || {});
      const p = {};
      Object.keys(spec).forEach((k) => { p[k] = params[k] !== undefined ? params[k] : spec[k].default; });
      Object.keys(params).forEach((k) => { if (!(k in p)) p[k] = params[k]; });
      return d.build(ctx, p, helpers(ctx));
    },
    common: COMMON
  };
  window.AU_COMPONENTS = reg;

  define('title', {
    category: 'type', description: 'Kinetic headline with optional kicker and subtitle. Styles: rise (word rise), mask (line mask), slam (scale punch per word), chars (character flip), blur.',
    params: { text: { type: 'string', default: 'Your headline', doc: 'headline; wrap a word in *asterisks* to accent it' }, kicker: { type: 'string', default: '', doc: 'small label above' }, subtitle: { type: 'string', default: '', doc: 'line below' },
      style: { type: 'enum', default: 'rise', options: ['rise', 'mask', 'slam', 'chars', 'blur'] }, size: { type: 'enum', default: 'xl', options: ['hero', 'xl', 'lg', 'md'] }, align: { type: 'enum', default: 'center', options: ['left', 'center', 'right'] } },
    example: "component('title', { text: 'The ocean *breathes*', kicker: 'Tides', style: 'mask', at: 0.1 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-title align-' + p.align, { x: p.align === 'center' ? 8 : 9, y: 30, w: p.align === 'center' ? 84 : 70 });
    el.innerHTML = (p.kicker ? `<div class="auc-kicker">${h.esc(p.kicker)}</div>` : '') + `<h2 class="auc-h size-${p.size}">${h.rich(p.text)}</h2>` + (p.subtitle ? `<p class="auc-sub">${h.rich(p.subtitle)}</p>` : '');
    const { at, end } = h.span(p);
    const head = el.querySelector('.auc-h');
    const kick = el.querySelector('.auc-kicker');
    const sub = el.querySelector('.auc-sub');
    if (kick) ctx.tl.fromTo(kick, { autoAlpha: 0, y: -14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'au.softLand' }, at);
    const t0 = at + (kick ? 0.12 : 0);
    if (p.style === 'mask') {
      const s = ctx.split(head, { type: 'lines,words', mask: 'lines' });
      ctx.tl.fromTo(s.lines.length ? s.lines : head, { yPercent: 110 }, { yPercent: 0, duration: 0.8, stagger: 0.09, ease: 'au.softLand' }, t0);
    } else if (p.style === 'slam') {
      const s = ctx.split(head, { type: 'words' });
      ctx.tl.fromTo(s.words, { scale: 1.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.32, stagger: 0.12, ease: 'au.snapSettle' }, t0);
    } else if (p.style === 'chars') {
      const s = ctx.split(head, { type: 'words,chars' });
      ctx.tl.fromTo(s.chars, { yPercent: 70, rotationX: -80, autoAlpha: 0 }, { yPercent: 0, rotationX: 0, autoAlpha: 1, duration: 0.55, stagger: 0.02, ease: 'au.softLand' }, t0);
    } else if (p.style === 'blur') {
      const s = ctx.split(head, { type: 'words' });
      ctx.tl.fromTo(s.words, { filter: 'blur(14px)', autoAlpha: 0, y: 12 }, { filter: 'blur(0px)', autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'au.softLand' }, t0);
    } else {
      const s = ctx.split(head, { type: 'words' });
      ctx.tl.fromTo(s.words, { yPercent: 80, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'au.softLand' }, t0);
    }
    if (sub) ctx.tl.fromTo(sub, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'au.softLand' }, t0 + 0.45);
    h.exitOut(p, [kick, head, sub].filter(Boolean), end);
    return { el, end };
  });

  define('lower-third', {
    category: 'broadcast', description: 'Name and role bar that slides in with an accent bar, like a news or interview lower third.',
    params: { name: { type: 'string', default: 'Name Surname' }, role: { type: 'string', default: 'Role or place' }, side: { type: 'enum', default: 'left', options: ['left', 'right'] } },
    example: "component('lower-third', { name: 'Dr Amara Lee', role: 'Oceanographer', at: 1.0, duration: 4 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-lt side-' + p.side, { x: p.side === 'left' ? 6 : 52, y: ctx.portrait ? 58 : 70, w: ctx.portrait ? 70 : 42 });
    el.innerHTML = `<div class="auc-lt-bar"></div><div class="auc-lt-body"><div class="auc-lt-name">${h.esc(p.name)}</div><div class="auc-lt-role">${h.esc(p.role)}</div></div>`;
    const { at, end } = h.span(p);
    const bar = el.querySelector('.auc-lt-bar'), body = el.querySelector('.auc-lt-body');
    ctx.tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: 'au.softLand' }, at);
    ctx.tl.fromTo(body, { clipPath: p.side === 'left' ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0% 0 0%)', duration: 0.55, ease: 'au.glide' }, at + 0.15);
    ctx.tl.fromTo(el.querySelectorAll('.auc-lt-name, .auc-lt-role'), { x: p.side === 'left' ? -30 : 30, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, stagger: 0.08, ease: 'au.softLand' }, at + 0.25);
    h.exitOut(p, el, end, { x: p.side === 'left' ? -40 : 40, y: 0 });
    return { el, end };
  });

  define('callout', {
    category: 'annotation', description: 'Label with a drawn leader line pointing at a point in the frame, with a pulsing dot at the target. Use to explain parts of an image, diagram or UI.',
    params: { text: { type: 'string', default: 'This part' }, tx: { type: 'number', default: 50, doc: 'target x in % of frame' }, ty: { type: 'number', default: 50, doc: 'target y in % of frame' },
      lx: { type: 'number', default: 70, doc: 'label x in %' }, ly: { type: 'number', default: 25, doc: 'label y in %' } },
    example: "component('callout', { text: 'Tidal bulge', tx: 62, ty: 48, lx: 72, ly: 22, at: 2 })"
  }, (ctx, p, h) => {
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-callout', { x: 0, y: 0, w: 100 });
    el.style.height = '100%';
    const W = ctx.W, H = ctx.H;
    const tx = p.tx / 100 * W, ty = p.ty / 100 * H, lx = p.lx / 100 * W, ly = p.ly / 100 * H;
    const midX = lx + (tx - lx) * 0.2, midY = ty;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="position:absolute;inset:0;overflow:visible"><path class="auc-co-line" d="M${lx},${ly} L${midX},${midY} L${tx},${ty}"/><circle class="auc-co-ring" cx="${tx}" cy="${ty}" r="18"/><circle class="auc-co-dot" cx="${tx}" cy="${ty}" r="8"/></svg><div class="auc-co-label" style="left:${p.lx}%;top:${p.ly}%">${h.rich(p.text)}</div>`;
    const { at, end } = h.span(p);
    ctx.tl.fromTo(el.querySelector('.auc-co-dot'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, ease: 'au.pop' }, at);
    ctx.draw(el.querySelector('.auc-co-line'), { at: at + 0.1, duration: 0.6 });
    ctx.tl.fromTo(el.querySelector('.auc-co-label'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'au.softLand' }, at + 0.55);
    const ring = el.querySelector('.auc-co-ring');
    ctx.onFrame((t) => { const k = Math.max(0, t - at) % 1.4 / 1.4; ring.style.opacity = t < at ? 0 : String(0.8 * (1 - k)); ring.setAttribute('r', String(10 + 26 * k)); });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('highlight', {
    category: 'annotation', description: 'Hand-drawn mark over an existing element: underline, circle, box, strike or marker swipe, drawn on like a pen.',
    params: { target: { type: 'string', default: '.scene h1', doc: 'CSS selector of the element to mark' }, kind: { type: 'enum', default: 'underline', options: ['underline', 'circle', 'box', 'strike', 'marker'] },
      color: { type: 'string', default: '--accent' } },
    example: "component('highlight', { target: '.headline em', kind: 'circle', at: 1.4 })"
  }, (ctx, p, h) => {
    const t = document.querySelector(p.target);
    if (!t) throw new Error('highlight target not found: ' + p.target);
    const stage = (document.getElementById('au-stage') || document.body).getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const sx = ctx.W / stage.width, sy = ctx.H / stage.height;
    const x = (r.left - stage.left) * sx, y = (r.top - stage.top) * sy, w = r.width * sx, hh = r.height * sy;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-hl', { x: 0, y: 0, w: 100 });
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    const c = h.color(p.color, 'var(--accent)');
    const j = () => (ctx.rand() - 0.5) * 6;
    let d;
    if (p.kind === 'circle') {
      const cx = x + w / 2, cy = y + hh / 2, rx = w / 2 + 22, ry = hh / 2 + 16;
      d = `M${cx - rx},${cy + j()} C${cx - rx},${cy - ry} ${cx + rx},${cy - ry + j()} ${cx + rx},${cy} S${cx - rx * 0.6},${cy + ry + j()} ${cx - rx + 6},${cy - 4}`;
    } else if (p.kind === 'box') {
      d = `M${x - 14},${y - 10} L${x + w + 14 + j()},${y - 12} L${x + w + 12},${y + hh + 10 + j()} L${x - 12 + j()},${y + hh + 12} Z`;
    } else if (p.kind === 'strike') {
      d = `M${x - 6},${y + hh * 0.55 + j()} Q${x + w / 2},${y + hh * 0.45} ${x + w + 6},${y + hh * 0.52 + j()}`;
    } else if (p.kind === 'marker') {
      d = `M${x - 8},${y + hh * 0.6} L${x + w + 8},${y + hh * 0.58}`;
    } else {
      d = `M${x - 4},${y + hh + 8 + j()} Q${x + w * 0.5},${y + hh + 2} ${x + w + 6},${y + hh + 10 + j()}`;
    }
    const width = p.kind === 'marker' ? hh * 0.75 : 7;
    el.innerHTML = `<svg viewBox="0 0 ${ctx.W} ${ctx.H}" width="100%" height="100%" style="position:absolute;inset:0;overflow:visible"><path d="${d}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${p.kind === 'marker' ? 'opacity="0.35" style="mix-blend-mode:multiply"' : ''}/></svg>`;
    if (p.kind === 'marker') el.style.zIndex = '-1';
    const { at, end } = h.span(p);
    ctx.draw(el.querySelector('path'), { at, duration: p.kind === 'circle' ? 0.7 : 0.45 });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('stat', {
    category: 'data', description: 'Big animated number that counts up, with prefix, suffix, decimals and a label below.',
    params: { value: { type: 'number', default: 42 }, prefix: { type: 'string', default: '' }, suffix: { type: 'string', default: '' }, decimals: { type: 'number', default: 0 },
      label: { type: 'string', default: '' }, count: { type: 'number', default: 1.4, doc: 'seconds the count takes' } },
    example: "component('stat', { value: 3.8, decimals: 1, suffix: ' cm', label: 'every year', at: 0.6 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-stat', { x: 50, y: 46, center: true });
    el.innerHTML = `<div class="auc-stat-n">0</div>${p.label ? `<div class="auc-stat-l">${h.rich(p.label)}</div>` : ''}`;
    const { at, end } = h.span(p);
    const n = el.querySelector('.auc-stat-n');
    ctx.tl.fromTo(n, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'au.snapSettle' }, at);
    ctx.counter(n, +p.value, { at: at + 0.1, duration: p.count, decimals: p.decimals, prefix: p.prefix, suffix: p.suffix });
    const l = el.querySelector('.auc-stat-l');
    if (l) ctx.tl.fromTo(l, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'au.softLand' }, at + p.count * 0.6);
    h.exitOut(p, [n, l].filter(Boolean), end);
    return { el, end };
  });

  define('bar-chart', {
    category: 'data', description: 'Bar chart that grows bar by bar with values; one bar can be highlighted.',
    params: { data: { type: 'array', default: [{ label: 'A', value: 3 }, { label: 'B', value: 7 }, { label: 'C', value: 5 }], doc: '[{label, value}]' }, unit: { type: 'string', default: '' },
      highlight: { type: 'number', default: null, doc: 'index of the bar to accent' }, h: { type: 'number', default: 46, doc: 'height in % of frame' } },
    example: "component('bar-chart', { data: [{label:'2019',value:12},{label:'2024',value:31}], unit: '%', highlight: 1, at: 0.5 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-chart', { x: 10, y: 26, w: 80 });
    el.style.height = p.h + '%';
    const { at, end } = h.span(p);
    ctx.chart.bar(el, p.data, { at, unit: p.unit, highlight: p.highlight });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('line-chart', {
    category: 'data', description: 'Line chart that draws itself; series values over labels.',
    params: { series: { type: 'array', default: [{ name: 'Value', values: [2, 4, 3, 7, 9] }], doc: '[{name, values:[...]}]' }, labels: { type: 'array', default: [] }, h: { type: 'number', default: 46 } },
    example: "component('line-chart', { series: [{ name: 'CO2', values: [280, 310, 340, 380, 420] }], labels: ['1900','1950','1980','2000','2024'] })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-chart', { x: 10, y: 26, w: 80 });
    el.style.height = p.h + '%';
    const { at, end } = h.span(p);
    ctx.chart.line(el, p.series, { at, labels: p.labels });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('donut', {
    category: 'data', description: 'Donut chart whose segments sweep in; good for shares and percentages.',
    params: { parts: { type: 'array', default: [{ label: 'Yes', value: 64 }, { label: 'No', value: 36 }], doc: '[{label, value}]' }, size: { type: 'number', default: 36, doc: 'diameter in % of the short side' } },
    example: "component('donut', { parts: [{label:'Ocean',value:71},{label:'Land',value:29}] })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-chart auc-donut', { x: 50, y: 48, center: true });
    const px = Math.min(ctx.W, ctx.H) * p.size / 100;
    el.style.width = px + 'px'; el.style.height = px + 'px';
    const { at, end } = h.span(p);
    ctx.chart.donut(el, p.parts, { at });
    h.exitOut(p, el, end, { y: 0, scale: 0.9 });
    return { el, end };
  });

  define('progress', {
    category: 'data', description: 'Progress bar or ring that fills to a percentage with the number counting.',
    params: { value: { type: 'number', default: 72, doc: '0-100' }, kind: { type: 'enum', default: 'bar', options: ['bar', 'ring'] }, label: { type: 'string', default: '' } },
    example: "component('progress', { value: 80, kind: 'ring', label: 'charged', at: 0.4 })"
  }, (ctx, p, h) => {
    const { at, end } = h.span(p);
    if (p.kind === 'ring') {
      const el = h.box(p, 'auc-ring', { x: 50, y: 46, center: true });
      el.innerHTML = `<svg viewBox="0 0 200 200"><circle class="auc-ring-bg" cx="100" cy="100" r="84"/><circle class="auc-ring-fg" cx="100" cy="100" r="84" transform="rotate(-90 100 100)"/></svg><div class="auc-ring-n">0%</div>${p.label ? `<div class="auc-ring-l">${h.esc(p.label)}</div>` : ''}`;
      const fg = el.querySelector('.auc-ring-fg');
      const len = 2 * Math.PI * 84;
      fg.style.strokeDasharray = String(len);
      ctx.tl.fromTo(fg, { strokeDashoffset: len }, { strokeDashoffset: len * (1 - p.value / 100), duration: 1.4, ease: 'au.softLand' }, at);
      ctx.counter(el.querySelector('.auc-ring-n'), p.value, { at, duration: 1.4, suffix: '%' });
      h.exitOut(p, el, end, { y: 0, scale: 0.9 });
      return { el, end };
    }
    const el = h.box(p, 'auc-prog', { x: 12, y: 50, w: 76 });
    el.innerHTML = `<div class="auc-prog-top"><span class="auc-prog-l">${h.esc(p.label)}</span><span class="auc-prog-n">0%</span></div><div class="auc-prog-track"><div class="auc-prog-fill"></div></div>`;
    ctx.tl.fromTo(el.querySelector('.auc-prog-fill'), { scaleX: 0 }, { scaleX: p.value / 100, duration: 1.4, ease: 'au.softLand' }, at);
    ctx.counter(el.querySelector('.auc-prog-n'), p.value, { at, duration: 1.4, suffix: '%' });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('list', {
    category: 'type', description: 'Bulleted list where items reveal one by one with icons; optional title.',
    params: { items: { type: 'array', default: ['First point', 'Second point', 'Third point'] }, title: { type: 'string', default: '' }, icons: { type: 'array', default: [], doc: 'Lucide icon names per item' },
      gap: { type: 'number', default: 0.45, doc: 'seconds between items' } },
    example: "component('list', { title: 'Why it matters', items: ['Longer days', 'Weaker tides', 'No more eclipses'], icons: ['sun','waves','moon'] })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-list', { x: 10, y: 26, w: 80 });
    el.innerHTML = (p.title ? `<div class="auc-list-title">${h.rich(p.title)}</div>` : '') + p.items.map((it, i) => `<div class="auc-li"><span class="auc-li-ic">${ctx.icon(p.icons[i] || 'check', { size: 44, stroke: 2 })}</span><span class="auc-li-t">${h.rich(it)}</span></div>`).join('');
    const { at, end } = h.span(p);
    const title = el.querySelector('.auc-list-title');
    if (title) ctx.tl.fromTo(title, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'au.softLand' }, at);
    el.querySelectorAll('.auc-li').forEach((li, i) => {
      const t = at + (title ? 0.3 : 0) + i * p.gap;
      ctx.tl.fromTo(li.querySelector('.auc-li-ic'), { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.35, ease: 'au.pop' }, t);
      ctx.tl.fromTo(li.querySelector('.auc-li-t'), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'au.softLand' }, t + 0.05);
    });
    h.exitOut(p, el.children, end);
    return { el, end };
  });

  define('steps', {
    category: 'explainer', description: 'Process or timeline: numbered steps joined by a line that draws between them, each step lighting up in turn.',
    params: { steps: { type: 'array', default: ['Collect', 'Analyse', 'Decide'], doc: 'step labels' }, direction: { type: 'enum', default: 'auto', options: ['auto', 'row', 'column'] }, gap: { type: 'number', default: 0.6 } },
    example: "component('steps', { steps: ['Moon pulls', 'Bulge forms', 'Earth spins ahead', 'Moon drifts out'], at: 0.3 })"
  }, (ctx, p, h) => {
    const col = p.direction === 'column' || (p.direction === 'auto' && ctx.portrait);
    const el = h.box(p, 'auc-steps ' + (col ? 'col' : 'row'), col ? { x: 14, y: 20, w: 72 } : { x: 8, y: 38, w: 84 });
    el.innerHTML = `<div class="auc-steps-line"></div>` + p.steps.map((s, i) => `<div class="auc-step"><div class="auc-step-n">${i + 1}</div><div class="auc-step-t">${h.rich(s)}</div></div>`).join('');
    const { at, end } = h.span(p);
    const line = el.querySelector('.auc-steps-line');
    ctx.tl.fromTo(line, col ? { scaleY: 0 } : { scaleX: 0 }, Object.assign(col ? { scaleY: 1 } : { scaleX: 1 }, { duration: p.gap * p.steps.length, ease: 'none' }), at + 0.2);
    el.querySelectorAll('.auc-step').forEach((st, i) => {
      const t = at + i * p.gap;
      ctx.tl.fromTo(st.querySelector('.auc-step-n'), { scale: 0, backgroundColor: 'var(--bg-2)' }, { scale: 1, backgroundColor: 'var(--accent)', duration: 0.4, ease: 'au.pop' }, t);
      ctx.tl.fromTo(st.querySelector('.auc-step-t'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'au.softLand' }, t + 0.1);
    });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('quote', {
    category: 'type', description: 'Quote card with large quotation mark, words revealing, and attribution.',
    params: { text: { type: 'string', default: 'Quote text' }, by: { type: 'string', default: '' } },
    example: "component('quote', { text: 'We barely know what lives there.', by: 'Marine biologist' })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-quote', { x: 10, y: 28, w: 80 });
    el.innerHTML = `<div class="auc-q-mark">&ldquo;</div><blockquote class="auc-q-t">${h.rich(p.text)}</blockquote>${p.by ? `<div class="auc-q-by">${h.esc(p.by)}</div>` : ''}`;
    const { at, end } = h.span(p);
    ctx.tl.fromTo(el.querySelector('.auc-q-mark'), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'au.snapSettle' }, at);
    const s = ctx.split(el.querySelector('.auc-q-t'), { type: 'words' });
    ctx.tl.fromTo(s.words, { autoAlpha: 0.08 }, { autoAlpha: 1, duration: 0.25, stagger: 0.06, ease: 'none' }, at + 0.3);
    const by = el.querySelector('.auc-q-by');
    if (by) ctx.tl.fromTo(by, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.4 }, at + 0.4 + s.words.length * 0.06);
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('image', {
    category: 'media', description: 'Image from project assets with a reveal (wipe, iris, rise, zoom) and a slow Ken Burns move; optional rounded frame and caption.',
    params: { src: { type: 'string', default: '', doc: 'asset id or name' }, reveal: { type: 'enum', default: 'wipe', options: ['wipe', 'iris', 'rise', 'zoom', 'none'] }, kenburns: { type: 'number', default: 1.08, doc: 'end scale of the slow push' },
      fit: { type: 'enum', default: 'cover', options: ['cover', 'contain'] }, radius: { type: 'number', default: 18 }, caption: { type: 'string', default: '' }, h: { type: 'number', default: null, doc: 'height in % of frame' },
      focus: { type: 'array', default: null, doc: '[x%, y%] point the crop centres on and the slow push moves toward (faces or subject from analyze_image)' } },
    example: "component('image', { src: 'as_12ab34cd56', reveal: 'iris', x: 10, y: 15, w: 80, h: 55 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-image', { x: 10, y: 14, w: 80 });
    el.style.height = (p.h != null ? p.h : (ctx.portrait ? 40 : 60)) + '%';
    el.style.borderRadius = p.radius + 'px';
    el.innerHTML = `<img src="${ctx.asset(p.src)}" alt="" style="width:100%;height:100%;object-fit:${p.fit}">` + (p.caption ? `<div class="auc-img-cap">${h.esc(p.caption)}</div>` : '');
    const img = el.querySelector('img');
    if (Array.isArray(p.focus) && p.focus.length === 2) { img.style.objectPosition = p.focus[0] + '% ' + p.focus[1] + '%'; img.style.transformOrigin = p.focus[0] + '% ' + p.focus[1] + '%'; }
    const { at, end } = h.span(p);
    const reveals = { wipe: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], iris: [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }],
      rise: [{ y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }], zoom: [{ scale: 1.25, autoAlpha: 0 }, { scale: 1, autoAlpha: 1 }] };
    const r = reveals[p.reveal];
    if (r) ctx.tl.fromTo(el, r[0], Object.assign({}, r[1], { duration: 0.8, ease: 'au.glide' }), at);
    ctx.tl.fromTo(img, { scale: 1 }, { scale: p.kenburns, duration: Math.max(0.5, end - at), ease: 'none' }, at);
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('clip', {
    category: 'media', description: 'Video asset as a layer (footage, an engine-rendered clip, or an edited media output). Seeks frame-accurately with the scene. Transparent webm clips composite over the scene.',
    params: { src: { type: 'string', default: '', doc: 'asset id of a video' }, from: { type: 'number', default: 0, doc: 'source in-point in seconds' }, h: { type: 'number', default: null },
      fit: { type: 'enum', default: 'cover', options: ['cover', 'contain'] }, radius: { type: 'number', default: 0 }, reveal: { type: 'enum', default: 'none', options: ['none', 'fade', 'wipe', 'rise'] } },
    example: "component('clip', { src: 'as_manimclip01', x: 0, y: 0, w: 100, h: 100, fit: 'contain' })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-clip', { x: 0, y: 0, w: 100 });
    el.style.height = (p.h != null ? p.h : 100) + '%';
    el.style.borderRadius = p.radius + 'px';
    el.style.overflow = 'hidden';
    const { at, end } = h.span(p);
    el.innerHTML = `<video src="${ctx.asset(p.src)}" muted playsinline preload="auto" data-start="${(at - (+p.from || 0)).toFixed(3)}" style="width:100%;height:100%;object-fit:${p.fit}"></video>`;
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.set(el, { autoAlpha: 1 }, at);
    if (p.reveal === 'fade') ctx.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, at);
    if (p.reveal === 'wipe') ctx.tl.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'au.glide' }, at);
    if (p.reveal === 'rise') ctx.tl.fromTo(el, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'au.softLand' }, at);
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('device', {
    category: 'media', description: 'Phone or laptop frame showing an image or video asset, sliding in with a gentle tilt and optional screen scroll.',
    params: { kind: { type: 'enum', default: 'phone', options: ['phone', 'laptop'] }, src: { type: 'string', default: '' }, video: { type: 'boolean', default: false }, scroll: { type: 'number', default: 0, doc: 'screen scroll in % of content height' } },
    example: "component('device', { kind: 'phone', src: 'as_screen01', scroll: 40, at: 0.3 })"
  }, (ctx, p, h) => {
    const phone = p.kind === 'phone';
    const el = h.box(p, 'auc-device ' + p.kind, phone ? { x: 50, y: 50, center: true } : { x: 50, y: 48, center: true });
    const media = p.video ? `<video src="${ctx.asset(p.src)}" muted playsinline preload="auto" data-start="${(+p.at || 0).toFixed(3)}"></video>` : `<img src="${ctx.asset(p.src)}" alt="">`;
    el.innerHTML = `<div class="auc-dev-body"><div class="auc-dev-screen"><div class="auc-dev-scroll">${media}</div></div></div>` + (phone ? '' : '<div class="auc-dev-base"></div>');
    const { at, end } = h.span(p);
    ctx.tl.fromTo(el.querySelector('.auc-dev-body'), { y: 120, rotation: phone ? 6 : 0, rotationX: phone ? 0 : 18, autoAlpha: 0 }, { y: 0, rotation: 0, rotationX: 0, autoAlpha: 1, duration: 0.9, ease: 'au.softLand' }, at);
    if (p.scroll) ctx.tl.fromTo(el.querySelector('.auc-dev-scroll'), { yPercent: 0 }, { yPercent: -p.scroll, duration: Math.max(1, end - at - 1.2), ease: 'au.glide' }, at + 0.9);
    h.exitOut(p, el, end, { y: 80 });
    return { el, end };
  });

  define('cursor', {
    category: 'ui', description: 'Animated mouse cursor that travels through points and clicks with a ripple; for UI walkthroughs.',
    params: { path: { type: 'array', default: [[30, 40], [60, 55]], doc: '[[x%, y%], ...] waypoints' }, clicks: { type: 'array', default: [1], doc: 'indexes of waypoints that click' }, speed: { type: 'number', default: 0.7, doc: 'seconds per segment' } },
    example: "component('cursor', { path: [[20,30],[55,42],[70,70]], clicks: [1,2], at: 1 })"
  }, (ctx, p, h) => {
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-cursor-layer', { x: 0, y: 0, w: 100 });
    el.style.height = '100%';
    el.innerHTML = `<div class="auc-cursor"><svg viewBox="0 0 24 24" width="44" height="44"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21 L14 20 L11 13.5 L17 13.5 Z" fill="var(--ink)" stroke="var(--bg)" stroke-width="1.5"/></svg></div>`;
    const cur = el.querySelector('.auc-cursor');
    const { at, end } = h.span(p);
    const pts = p.path.map(([x, y]) => [x / 100 * ctx.W, y / 100 * ctx.H]);
    ctx.tl.set(cur, { x: pts[0][0], y: pts[0][1], autoAlpha: 0 }, 0);
    ctx.tl.to(cur, { autoAlpha: 1, duration: 0.2 }, at);
    let t = at + 0.2;
    pts.forEach((pt, i) => {
      if (i > 0) { ctx.tl.to(cur, { x: pt[0], y: pt[1], duration: p.speed, ease: 'power2.inOut' }, t); t += p.speed; }
      if (p.clicks.includes(i)) {
        const rip = document.createElement('div');
        rip.className = 'auc-ripple';
        el.appendChild(rip);
        ctx.tl.set(rip, { x: pt[0], y: pt[1], autoAlpha: 0 }, 0);
        ctx.tl.to(cur, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: '10% 10%' }, t);
        ctx.tl.fromTo(rip, { scale: 0.2, autoAlpha: 0.7 }, { scale: 1.6, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, t);
        t += 0.25;
      }
    });
    h.exitOut(p, cur, end, { y: 0 });
    return { el, end: Math.min(end, t) };
  });

  define('chat', {
    category: 'ui', description: 'Messaging thread: bubbles appear one by one with a typing indicator before each incoming message.',
    params: { messages: { type: 'array', default: [{ from: 'them', text: 'Did you see the tide today?' }, { from: 'me', text: 'Twice!' }], doc: "[{from: 'me'|'them', text}]" }, gap: { type: 'number', default: 1.0 } },
    example: "component('chat', { messages: [{from:'them',text:'Why are there two tides?'},{from:'me',text:'The Moon pulls both sides.'}] })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-chat', { x: ctx.portrait ? 8 : 26, y: 18, w: ctx.portrait ? 84 : 48 });
    const { at, end } = h.span(p);
    let t = at;
    p.messages.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'auc-msg ' + (m.from === 'me' ? 'me' : 'them');
      row.innerHTML = `<div class="auc-bubble">${h.rich(m.text)}</div>`;
      el.appendChild(row);
      if (m.from !== 'me') {
        const typing = document.createElement('div');
        typing.className = 'auc-msg them auc-typing';
        typing.innerHTML = '<div class="auc-bubble"><i></i><i></i><i></i></div>';
        el.insertBefore(typing, row);
        ctx.tl.set(typing, { display: 'flex', autoAlpha: 0 }, 0);
        ctx.tl.to(typing, { autoAlpha: 1, duration: 0.2 }, t);
        typing.querySelectorAll('i').forEach((dot, k) => ctx.tl.fromTo(dot, { y: 0 }, { y: -6, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t + k * 0.1));
        t += 0.75;
        ctx.tl.set(typing, { display: 'none' }, t);
      }
      ctx.tl.set(row, { display: 'flex', autoAlpha: 0 }, 0);
      ctx.tl.fromTo(row, { autoAlpha: 0, y: 18, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: 'au.pop', immediateRender: false }, t);
      t += p.gap;
    });
    el.querySelectorAll('.auc-msg:not(.auc-typing)').forEach((r) => { r.style.display = 'none'; });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  define('follow', {
    category: 'cta', description: 'Call-to-action pill (follow, subscribe, link) that pops in, gets clicked, and swaps to a confirmed state.',
    params: { text: { type: 'string', default: 'Follow for more' }, done: { type: 'string', default: 'Following' }, icon: { type: 'string', default: 'bell' } },
    example: "component('follow', { text: 'Subscribe', done: 'Subscribed', at: 3 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-follow', { x: 50, y: ctx.portrait ? 72 : 76, center: true });
    el.innerHTML = `<span class="auc-f-ic">${ctx.icon(p.icon, { size: 34, stroke: 2.2 })}</span><span class="auc-f-a">${h.esc(p.text)}</span><span class="auc-f-b">${h.esc(p.done)}</span>`;
    const { at, end } = h.span(p);
    ctx.tl.fromTo(el, { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'au.pop' }, at);
    const click = at + 1.1;
    ctx.tl.to(el, { scale: 0.92, duration: 0.09, yoyo: true, repeat: 1 }, click);
    ctx.tl.set(el, { className: 'auc auc-follow is-done' }, click + 0.1);
    ctx.tl.fromTo(el.querySelector('.auc-f-ic'), { rotation: 0 }, { rotation: 20, duration: 0.08, yoyo: true, repeat: 5 }, click + 0.15);
    h.exitOut(p, el, end, { y: 0, scale: 0.8 });
    return { el, end };
  });

  define('particles', {
    category: 'ambient', description: 'Seeded ambient particle field (dust, stars, snow, embers, bokeh) on a canvas behind the content.',
    params: { kind: { type: 'enum', default: 'dust', options: ['dust', 'stars', 'snow', 'embers', 'bokeh'] }, count: { type: 'number', default: 90 }, speed: { type: 'number', default: 1 } },
    example: "component('particles', { kind: 'stars', count: 160, at: 0 })"
  }, (ctx, p, h) => {
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-particles', { x: 0, y: 0, w: 100 });
    el.style.height = '100%';
    el.style.zIndex = '0';
    el.innerHTML = '<canvas style="width:100%;height:100%;display:block"></canvas>';
    const canvas = el.querySelector('canvas');
    canvas.style.width = ctx.W + 'px'; canvas.style.height = ctx.H + 'px';
    ctx.particles(canvas, { kind: p.kind, count: p.count, speed: p.speed });
    const { at } = h.span(p);
    ctx.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, at);
    return { el, end: ctx.D };
  });

  define('light-sweep', {
    category: 'ambient', description: 'Glossy light band sweeping across an element (logo, title, card) to add shine.',
    params: { target: { type: 'string', default: '.scene h1' }, angle: { type: 'number', default: 20 }, width: { type: 'number', default: 18, doc: 'band width in %' } },
    example: "component('light-sweep', { target: '.logo', at: 1.2 })"
  }, (ctx, p, h) => {
    const t = document.querySelector(p.target);
    if (!t) throw new Error('light-sweep target not found: ' + p.target);
    if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
    t.style.overflow = 'hidden';
    const band = document.createElement('div');
    band.className = 'auc-sweep';
    band.style.background = `linear-gradient(${90 + p.angle}deg, transparent 0%, rgba(255,255,255,0) ${50 - p.width / 2}%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) ${50 + p.width / 2}%, transparent 100%)`;
    t.appendChild(band);
    const { at } = h.span(p);
    ctx.tl.fromTo(band, { xPercent: -120 }, { xPercent: 120, duration: 0.9, ease: 'power2.inOut' }, at);
    return { el: band, end: at + 0.9 };
  });

  define('logo-sting', {
    category: 'brand', description: 'Logo reveal: mark scales in with an overshoot, a ring pulse and a shine, then an optional wordmark slides out.',
    params: { src: { type: 'string', default: '', doc: 'logo asset id (svg or png)' }, word: { type: 'string', default: '' }, size: { type: 'number', default: 22, doc: 'logo size in % of the short side' } },
    example: "component('logo-sting', { src: 'as_logo0001', word: 'AuteurFrame', at: 0.2 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-logo', { x: 50, y: 46, center: true });
    const px = Math.min(ctx.W, ctx.H) * p.size / 100;
    el.innerHTML = `<div class="auc-logo-ring"></div><div class="auc-logo-mark" style="width:${px}px;height:${px}px">${p.src ? `<img src="${ctx.asset(p.src)}" alt="" style="width:100%;height:100%;object-fit:contain">` : ctx.icon('sparkles', { size: px, stroke: 1.6 })}</div>${p.word ? `<div class="auc-logo-word">${h.esc(p.word)}</div>` : ''}`;
    const { at, end } = h.span(p);
    const mark = el.querySelector('.auc-logo-mark'), ring = el.querySelector('.auc-logo-ring'), word = el.querySelector('.auc-logo-word');
    ctx.tl.fromTo(mark, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'au.snapSettle' }, at);
    ctx.tl.fromTo(ring, { scale: 0.3, autoAlpha: 0.8 }, { scale: 2.2, autoAlpha: 0, duration: 0.9, ease: 'power2.out' }, at + 0.35);
    if (word) ctx.tl.fromTo(word, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'au.glide' }, at + 0.6);
    h.exitOut(p, el, end, { y: 0, scale: 0.9 });
    return { el, end };
  });

  define('split-compare', {
    category: 'explainer', description: 'Two panels side by side (or stacked on vertical) with labels; a divider wipes in and the winning side can be emphasised.',
    params: { left: { type: 'string', default: 'Before' }, right: { type: 'string', default: 'After' }, leftSrc: { type: 'string', default: '' }, rightSrc: { type: 'string', default: '' },
      emphasis: { type: 'enum', default: 'none', options: ['none', 'left', 'right'] } },
    example: "component('split-compare', { left: 'Spring tide', right: 'Neap tide', emphasis: 'left' })"
  }, (ctx, p, h) => {
    const stacked = ctx.portrait;
    const el = h.box(p, 'auc-split ' + (stacked ? 'stack' : 'side'), { x: 6, y: stacked ? 12 : 18, w: 88 });
    el.style.height = stacked ? '62%' : '60%';
    const panel = (label, src, side) => `<div class="auc-sp-panel ${side}">${src ? `<img src="${ctx.asset(src)}" alt="">` : ''}<div class="auc-sp-label">${h.rich(label)}</div></div>`;
    el.innerHTML = panel(p.left, p.leftSrc, 'a') + '<div class="auc-sp-div"></div>' + panel(p.right, p.rightSrc, 'b');
    const { at, end } = h.span(p);
    const [a, b] = el.querySelectorAll('.auc-sp-panel');
    ctx.tl.fromTo(a, stacked ? { yPercent: -20, autoAlpha: 0 } : { xPercent: -20, autoAlpha: 0 }, { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'au.softLand' }, at);
    ctx.tl.fromTo(b, stacked ? { yPercent: 20, autoAlpha: 0 } : { xPercent: 20, autoAlpha: 0 }, { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'au.softLand' }, at + 0.15);
    ctx.tl.fromTo(el.querySelector('.auc-sp-div'), stacked ? { scaleX: 0 } : { scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'au.glide' }, at + 0.3);
    if (p.emphasis !== 'none') {
      const win = p.emphasis === 'left' ? a : b, lose = p.emphasis === 'left' ? b : a;
      ctx.tl.to(win, { scale: 1.04, duration: 0.5, ease: 'au.softLand' }, at + 1.4);
      ctx.tl.to(lose, { autoAlpha: 0.45, duration: 0.5 }, at + 1.4);
    }
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });
})();
