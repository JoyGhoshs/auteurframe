(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const el = (tag, cls, parent, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  };
  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };

  function kit(ctx) {
    const m = Object.assign({ tempo: 1, enter: 'au.softLand', exit: 'au.exit', accent: 'au.snapSettle', stagger: 0.07 }, (ctx.data && ctx.data.motion) || {});
    const variant = Math.abs(parseInt(ctx.data.variant || 0, 10) + Math.floor(ctx.rand() * 7));
    const root = ctx.$('.ar-root') || ctx.$('.scene');
    root.classList.add(ctx.portrait ? 'ar-portrait' : 'ar-landscape');
    const budget = Math.max(1.2, ctx.D - 0.9);
    const T = (x) => x * m.tempo;
    const fitTime = (natural) => Math.min(1, budget / Math.max(0.1, natural * m.tempo));
    const spread = (n, from, to) => {
      const end = Math.min(to == null ? budget - 0.6 : to, budget - 0.4);
      const start = Math.min(from, end);
      return Array.from({ length: n }, (_, i) => start + (n <= 1 ? 0 : (end - start) * i / (n - 1)));
    };
    const shrink = (nodes, maxW) => {
      const list = Array.from(nodes.length != null ? nodes : [nodes]);
      let ratio = 1;
      list.forEach((n) => {
        const prev = n.style.display;
        n.style.display = 'inline-block';
        n.style.whiteSpace = 'nowrap';
        const w = Math.max(n.scrollWidth, n.getBoundingClientRect().width / (parseFloat(getComputedStyle(n).scale) || 1));
        n.style.display = prev;
        if (w > maxW) ratio = Math.min(ratio, maxW / w);
      });
      if (ratio < 1) list.forEach((n) => { n.style.fontSize = (parseFloat(getComputedStyle(n).fontSize) * ratio * 0.97) + 'px'; });
      return ratio;
    };
    return { m, variant, root, budget, T, fitTime, spread, shrink };
  }

  function heading(ctx, k, parent, data, opts) {
    const o = Object.assign({ cls: '', at: 0.15, style: null, size: 'xl' }, opts || {});
    const wrap = el('div', 'ar-head ' + o.cls, parent);
    let kick = null;
    if (data.kicker) {
      kick = el('div', 'ar-kicker', wrap, esc(data.kicker));
      kick.setAttribute('data-layer', 'kicker');
    }
    const title = el('h1', 'ar-title size-' + o.size, wrap, rich(data.title || ''));
    title.setAttribute('data-layer', 'title');
    const plain = String(data.title || '').replace(/\*/g, '');
    const wide = (plain.match(/[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF00-\uFFEF]/g) || []).length;
    const len = plain.length + wide * 0.9;
    const longest = wide ? 0 : Math.max(0, ...plain.split(/\s+/).map((w) => w.length));
    let scale = len <= 14 ? 1 : len <= 26 ? 0.86 : len <= 44 ? 0.72 : len <= 70 ? 0.6 : 0.5;
    if (longest > 11) scale = Math.min(scale, 11 / longest * 0.95 + 0.05);
    title.style.setProperty('--len-scale', scale.toFixed(3));
    let sub = null;
    if (data.subtitle) {
      sub = el('p', 'ar-sub', wrap, rich(data.subtitle));
      sub.setAttribute('data-layer', 'subtitle');
    }
    return { wrap, kick, title, sub, play: (at) => revealHeading(ctx, k, { kick, title, sub }, at == null ? o.at : at, o.style) };
  }

  function revealHeading(ctx, k, parts, at, styleOverride) {
    const { tl } = ctx;
    const styles = ['mask', 'chars', 'slam', 'blur', 'mask'];
    const style = styleOverride || styles[k.variant % styles.length];
    if (parts.kick) tl.from(parts.kick, { opacity: 0, x: -30, duration: k.T(0.5), ease: k.m.enter }, at);
    const t0 = at + (parts.kick ? k.T(0.15) : 0);
    let end = t0;
    if (parts.title) {
      if (style === 'mask') {
        const s = ctx.split(parts.title, { type: 'lines,words', mask: 'lines' });
        tl.from(s.lines.length ? s.lines : parts.title, { yPercent: 115, duration: k.T(0.85), stagger: k.T(0.09), ease: k.m.enter }, t0);
        end = t0 + k.T(0.85 + 0.09 * s.lines.length);
      } else if (style === 'chars') {
        const s = ctx.split(parts.title, { type: 'words,chars' });
        tl.from(s.chars, { opacity: 0, yPercent: 60, rotationX: -70, transformOrigin: '50% 100%', duration: k.T(0.6), stagger: k.T(0.018), ease: k.m.enter }, t0);
        end = t0 + k.T(0.6 + 0.018 * s.chars.length);
      } else if (style === 'slam') {
        const s = ctx.split(parts.title, { type: 'words' });
        tl.from(s.words, { opacity: 0, scale: 1.7, filter: 'blur(10px)', duration: k.T(0.45), stagger: k.T(0.11), ease: 'au.punch' }, t0);
        end = t0 + k.T(0.45 + 0.11 * s.words.length);
      } else {
        const s = ctx.split(parts.title, { type: 'words' });
        tl.from(s.words, { opacity: 0, y: 24, filter: 'blur(14px)', duration: k.T(0.8), stagger: k.T(0.06), ease: k.m.enter }, t0);
        end = t0 + k.T(0.8 + 0.06 * s.words.length);
      }
      parts.title.querySelectorAll('em').forEach((em, i) => {
        tl.fromTo(em, { '--hl': 0 }, { '--hl': 1, duration: k.T(0.5), ease: 'au.glide' }, end - k.T(0.25) + i * 0.12);
      });
    }
    if (parts.sub) {
      tl.from(parts.sub, { opacity: 0, y: 18, duration: k.T(0.6), ease: k.m.enter }, end - k.T(0.2));
      end += k.T(0.4);
    }
    return end;
  }

  function settle(ctx, k, hero) {
    const push = ctx.portrait ? 1.03 : 1.04;
    ctx.camera({ at: 0, scale: push, duration: ctx.D, ease: 'none' });
    if (hero) ctx.ambient(hero, 'float', { amount: 0.6, period: 4 });
  }

  const A = {};

  A['kinetic-title'] = function (ctx, k) {
    const d = ctx.data;
    const center = k.variant % 3 !== 1;
    k.root.classList.add(center ? 'ar-center' : 'ar-left');
    const box = el('div', 'ar-box', k.root);
    if (d.icon) {
      const ic = el('div', 'ar-badge', box, ctx.icon(d.icon, { size: 84, stroke: 1.8 }));
      ic.setAttribute('data-layer', 'icon');
      ctx.tl.from(ic, { scale: 0, rotation: -40, duration: k.T(0.6), ease: 'au.pop' }, 0.1);
    }
    const h = heading(ctx, k, box, d, { size: 'hero' });
    const rule = el('div', 'ar-rule', box);
    rule.setAttribute('data-layer', 'rule');
    const end = h.play(d.icon ? 0.35 : 0.15);
    ctx.tl.from(rule, { scaleX: 0, transformOrigin: center ? '50% 50%' : '0% 50%', duration: k.T(0.8), ease: 'au.glide' }, Math.min(end, k.budget - 0.8));
    settle(ctx, k, null);
  };

  A['word-stack'] = function (ctx, k) {
    const d = ctx.data;
    const words = (d.words && d.words.length ? d.words : String(d.title || '').replace(/\*/g, '').split(/\s+/)).slice(0, 7);
    const stack = el('div', 'ar-stack', k.root);
    const times = k.spread(words.length, 0.1, Math.min(k.budget - 0.5, words.length * 0.55));
    const hero = d.accentIndex != null ? d.accentIndex : words.length - 1;
    const rows = words.map((w, i) => el('div', 'ar-stack-word' + (i === hero ? ' is-hero' : ''), stack, esc(w)));
    k.shrink(rows, ctx.safe.w);
    const maxH = ctx.safe.h * (ctx.portrait ? (document.body.classList.contains('has-captions') ? 0.46 : 0.78) : (document.body.classList.contains('has-captions') ? 0.8 : 0.95));
    const totalH = stack.getBoundingClientRect().height;
    if (totalH > maxH) rows.forEach((r) => { r.style.fontSize = (parseFloat(getComputedStyle(r).fontSize) * maxH / totalH) + 'px'; });
    const clampToCaptions = () => {
      if (!document.body.classList.contains('has-captions')) return;
      const limit = ctx.H * (ctx.portrait ? 0.6 : 0.8);
      for (let pass = 0; pass < 3; pass++) {
        const prev = stack.style.transform;
        stack.style.transform = 'none';
        const r = stack.getBoundingClientRect();
        stack.style.transform = prev;
        if (r.bottom <= limit || r.height <= 0) break;
        const f = Math.max(0.45, (limit - Math.max(0, r.top)) / r.height);
        rows.forEach((row) => { row.style.fontSize = (parseFloat(getComputedStyle(row).fontSize) * f) + 'px'; });
      }
    };
    clampToCaptions();
    let clamped = false;
    ctx.onFrame(() => { if (!clamped) { clamped = true; clampToCaptions(); } });
    words.forEach((w, i) => {
      const row = rows[i];
      row.setAttribute('data-layer', 'word-' + i);
      const from = [{ yPercent: 100, opacity: 0 }, { xPercent: -30, opacity: 0 }, { scale: 2.2, opacity: 0, filter: 'blur(12px)' }][(k.variant + i) % 3];
      ctx.tl.from(row, Object.assign({ duration: k.T(0.42), ease: i === hero ? 'au.punch' : k.m.enter }, from), times[i]);
      if (i === hero) {
        ctx.tl.fromTo(row, { '--hl': 0 }, { '--hl': 1, duration: k.T(0.35), ease: 'au.glide' }, times[i] + k.T(0.25));
        ctx.tl.to(stack, { x: 6, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' }, times[i] + 0.05);
      }
    });
    settle(ctx, k, null);
  };

  A['big-number'] = function (ctx, k) {
    const d = ctx.data;
    k.root.classList.add(k.variant % 2 ? 'ar-left' : 'ar-center');
    const box = el('div', 'ar-box ar-number-box', k.root);
    if (d.kicker) { const kk = el('div', 'ar-kicker', box, esc(d.kicker)); kk.setAttribute('data-layer', 'kicker'); ctx.tl.from(kk, { opacity: 0, y: -16, duration: k.T(0.5) }, 0.1); }
    const num = el('div', 'ar-number', box, '0');
    num.setAttribute('data-layer', 'number');
    const label = el('div', 'ar-number-label', box, rich(d.label || d.title || ''));
    label.setAttribute('data-layer', 'label');
    const value = Number(d.value) || 0;
    ctx.tl.from(num, { opacity: 0, scale: 0.7, duration: k.T(0.5), ease: 'au.pop' }, 0.25);
    ctx.counter(num, value, { from: d.from || 0, at: 0.3, duration: Math.min(k.T(1.8), k.budget - 0.8), decimals: d.decimals || 0, prefix: d.prefix || '', suffix: d.suffix || '' });
    ctx.tl.from(label, { opacity: 0, y: 20, duration: k.T(0.6) }, Math.min(1.0, k.budget - 0.6));
    if (d.context) {
      const c = el('div', 'ar-number-context', box, rich(d.context));
      c.setAttribute('data-layer', 'context');
      ctx.tl.from(c, { opacity: 0, y: 14, duration: k.T(0.6) }, Math.min(1.5, k.budget - 0.4));
    }
    const ring = svgEl('svg', { class: 'ar-number-ring', viewBox: '0 0 200 200' }, k.root);
    ring.setAttribute('data-layer', 'ring');
    svgEl('circle', { cx: 100, cy: 100, r: 92 }, ring);
    ctx.draw(ring, { at: 0.2, duration: Math.min(2.2, k.budget), ease: 'au.glide' });
    ctx.tl.to(ring, { rotation: 40, duration: ctx.D, ease: 'none' }, 0);
    settle(ctx, k, num);
  };

  A['bar-race'] = function (ctx, k) {
    const d = ctx.data;
    const items = (d.items || []).slice(0, ctx.portrait ? 6 : 6);
    const box = el('div', 'ar-grid-2', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'lg' });
    const chartHost = el('div', 'ar-chart-host', box);
    chartHost.setAttribute('data-layer', 'chart');
    const end = h.play(0.1);
    let hi = d.highlight;
    if (hi == null) { let best = -Infinity; items.forEach((it, i) => { if (it.value > best) { best = it.value; hi = i; } }); }
    ctx.chart.bar(chartHost, items, { at: Math.min(end - 0.2, k.budget - 1.4), horizontal: true, unit: d.unit || '', decimals: d.decimals || 0, highlight: hi, stagger: k.T(0.12), duration: k.T(1.0) });
    settle(ctx, k, null);
  };

  A['line-chart'] = function (ctx, k) {
    const d = ctx.data;
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'lg' });
    const host = el('div', 'ar-line-host', box);
    host.setAttribute('data-layer', 'chart');
    const series = (d.series && d.series.length > 1 ? d.series : [3, 4, 3.6, 5.2, 6.1, 5.8, 7.4, 9.2]).map(Number);
    const end = h.play(0.1);
    const w = ctx.portrait ? ctx.safe.w : ctx.safe.w * 0.92;
    const hh = ctx.portrait ? ctx.H * 0.32 : ctx.H * 0.42;
    host.style.height = hh + 'px';
    const at = Math.min(end - 0.3, k.budget - 1.6);
    ctx.chart.line(host, series, { at, duration: Math.min(k.T(1.8), k.budget - at - 0.2), w, h: hh });
    if (d.callout) {
      const c = el('div', 'ar-callout', host, rich(d.callout));
      c.setAttribute('data-layer', 'callout');
      ctx.tl.from(c, { opacity: 0, y: 20, scale: 0.9, duration: k.T(0.5), ease: 'au.pop' }, Math.min(at + 1.6, k.budget - 0.3));
    }
    settle(ctx, k, null);
  };

  A['donut'] = function (ctx, k) {
    const d = ctx.data;
    const parts = (d.parts || [{ label: 'Share', value: 62 }, { label: 'Rest', value: 38 }]).slice(0, 4);
    const box = el('div', 'ar-grid-2 ar-donut-grid', k.root);
    const left = el('div', 'ar-col', box);
    const h = heading(ctx, k, left, { kicker: d.kicker, title: d.title }, { size: 'lg' });
    const legend = el('div', 'ar-legend', left);
    const right = el('div', 'ar-donut-host', box);
    right.setAttribute('data-layer', 'donut');
    const end = h.play(0.1);
    const size = ctx.portrait ? ctx.W * 0.62 : ctx.H * 0.56;
    right.style.width = right.style.height = size + 'px';
    ctx.chart.donut(right, parts, { at: Math.min(end - 0.4, k.budget - 1.6), duration: k.T(1.4), size });
    const total = parts.reduce((a, p) => a + Number(p.value || 0), 0) || 1;
    const center = el('div', 'ar-donut-center', right, '0');
    center.setAttribute('data-layer', 'donut-value');
    ctx.counter(center, Math.round(parts[0].value / total * 100), { at: Math.min(end, k.budget - 1.2), duration: k.T(1.2), suffix: '%' });
    parts.forEach((p, i) => {
      const row = el('div', 'ar-legend-row seg-' + i, legend, `<i></i><span>${esc(p.label)}</span><b>${esc(p.value)}${esc(d.unit || '')}</b>`);
      row.setAttribute('data-layer', 'legend-' + i);
      ctx.tl.from(row, { opacity: 0, x: -24, duration: k.T(0.5) }, Math.min(end + i * k.T(0.15), k.budget - 0.3));
    });
    settle(ctx, k, null);
  };

  A['versus'] = function (ctx, k) {
    const d = ctx.data;
    const L = d.left || { label: 'Before', points: [] };
    const R = d.right || { label: 'After', points: [] };
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const grid = el('div', 'ar-versus', box);
    const end = h.play(0.1);
    const mk = (side, cls) => {
      const card = el('div', 'ar-card ' + cls, grid);
      card.setAttribute('data-layer', cls);
      el('div', 'ar-card-label', card, esc(side.label));
      if (side.value != null) el('div', 'ar-card-value', card, esc(side.value));
      const ul = el('ul', 'ar-card-list', card);
      (side.points || []).slice(0, 3).forEach((p) => el('li', '', ul, rich(p)));
      return card;
    };
    const a = mk(L, 'is-left');
    const vs = el('div', 'ar-vs', grid, 'VS');
    vs.setAttribute('data-layer', 'vs');
    const b = mk(R, 'is-right');
    const t = Math.min(end - 0.2, k.budget - 1.4);
    ctx.tl.from(a, { xPercent: ctx.portrait ? 0 : -30, yPercent: ctx.portrait ? -20 : 0, opacity: 0, rotation: -2, duration: k.T(0.7), ease: k.m.enter }, t);
    ctx.tl.from(b, { xPercent: ctx.portrait ? 0 : 30, yPercent: ctx.portrait ? 20 : 0, opacity: 0, rotation: 2, duration: k.T(0.7), ease: k.m.enter }, t + k.T(0.25));
    ctx.tl.from(vs, { scale: 0, rotation: -90, duration: k.T(0.5), ease: 'au.pop' }, t + k.T(0.45));
    [a, b].forEach((c, ci) => ctx.tl.from(c.querySelectorAll('li'), { opacity: 0, x: -14, duration: k.T(0.4), stagger: k.T(0.12) }, t + k.T(0.6 + ci * 0.25)));
    ctx.tl.to(b, { '--glow': 1, duration: k.T(0.6) }, Math.min(t + 1.6, k.budget - 0.4));
    settle(ctx, k, vs);
  };

  A['timeline'] = function (ctx, k) {
    const d = ctx.data;
    const events = (d.events || []).slice(0, ctx.portrait ? 5 : 5);
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const track = el('div', 'ar-timeline' + (ctx.portrait ? ' is-vertical' : ''), box);
    track.setAttribute('data-layer', 'timeline');
    const line = el('div', 'ar-tl-line', track);
    const end = h.play(0.1);
    const t0 = Math.min(end - 0.2, k.budget - 1.6);
    ctx.tl.from(line, { scaleX: ctx.portrait ? 1 : 0, scaleY: ctx.portrait ? 0 : 1, transformOrigin: '0% 0%', duration: Math.min(k.T(1.6), k.budget - t0), ease: 'au.glide' }, t0);
    const times = k.spread(events.length, t0 + 0.2, k.budget - 0.4);
    events.forEach((e, i) => {
      const node = el('div', 'ar-tl-node' + (i === events.length - 1 ? ' is-hero' : ''), track, `<i></i><b>${esc(e.date)}</b><span>${rich(e.label)}</span>`);
      node.setAttribute('data-layer', 'event-' + i);
      ctx.tl.from(node.querySelector('i'), { scale: 0, duration: k.T(0.35), ease: 'au.pop' }, times[i]);
      ctx.tl.from([node.querySelector('b'), node.querySelector('span')], { opacity: 0, y: 16, duration: k.T(0.45), stagger: 0.06 }, times[i] + 0.08);
    });
    settle(ctx, k, null);
  };

  A['quote'] = function (ctx, k) {
    const d = ctx.data;
    k.root.classList.add('ar-center');
    const box = el('div', 'ar-box ar-quote-box', k.root);
    const mark = el('div', 'ar-quote-mark', box, '“');
    mark.setAttribute('data-layer', 'mark');
    const q = el('blockquote', 'ar-quote', box, rich(d.quote || d.title || ''));
    q.setAttribute('data-layer', 'quote');
    q.setAttribute('data-fit', '');
    const who = el('div', 'ar-quote-who', box, `<b>${esc(d.author || '')}</b>${d.role ? '<span>' + esc(d.role) + '</span>' : ''}`);
    who.setAttribute('data-layer', 'author');
    ctx.tl.from(mark, { scale: 0.3, opacity: 0, rotation: -20, duration: k.T(0.7), ease: 'au.pop' }, 0.1);
    const s = ctx.split(q, { type: 'words' });
    const per = Math.min(0.09, (k.budget - 1.6) / Math.max(1, s.words.length));
    ctx.tl.from(s.words, { opacity: 0.08, y: 8, duration: k.T(0.4), stagger: per, ease: k.m.enter }, 0.35);
    ctx.tl.from(who, { opacity: 0, y: 16, duration: k.T(0.6) }, Math.min(0.5 + per * s.words.length, k.budget - 0.4));
    q.querySelectorAll('em').forEach((em) => ctx.tl.fromTo(em, { '--hl': 0 }, { '--hl': 1, duration: 0.5 }, Math.min(1.2, k.budget - 0.5)));
    settle(ctx, k, mark);
  };

  A['list-reveal'] = function (ctx, k) {
    const d = ctx.data;
    const items = (d.items || []).slice(0, 5);
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const list = el('ol', 'ar-list', box);
    const end = h.play(0.1);
    const times = k.spread(items.length, Math.min(end - 0.2, k.budget - 1.2), k.budget - 0.5);
    items.forEach((it, i) => {
      const li = el('li', 'ar-list-item', list, `<span class="ar-list-num">${String(i + 1).padStart(2, '0')}</span><span class="ar-list-text">${rich(it)}</span>`);
      li.setAttribute('data-layer', 'item-' + i);
      ctx.tl.from(li, { opacity: 0, x: -50, duration: k.T(0.55), ease: k.m.enter }, times[i]);
      ctx.tl.from(li.querySelector('.ar-list-num'), { scale: 0.4, duration: k.T(0.45), ease: 'au.pop' }, times[i]);
      if (i > 0) ctx.tl.to(list.children[i - 1], { opacity: 0.45, duration: 0.3 }, times[i]);
    });
    settle(ctx, k, null);
  };

  A['process-flow'] = function (ctx, k) {
    const d = ctx.data;
    const steps = (d.steps || []).slice(0, ctx.portrait ? 4 : 4);
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const flow = el('div', 'ar-flow' + (ctx.portrait ? ' is-vertical' : ''), box);
    const end = h.play(0.1);
    const times = k.spread(steps.length, Math.min(end - 0.2, k.budget - 1.4), k.budget - 0.5);
    steps.forEach((s, i) => {
      const step = typeof s === 'string' ? { label: s } : s;
      const node = el('div', 'ar-flow-node' + (i === steps.length - 1 ? ' is-hero' : ''), flow, `<div class="ar-flow-icon">${ctx.icon(step.icon || ['lightbulb', 'cog', 'zap', 'rocket', 'check'][i % 5], { size: 56, stroke: 1.8 })}</div><div class="ar-flow-label">${rich(step.label)}</div>`);
      node.setAttribute('data-layer', 'step-' + i);
      ctx.tl.from(node, { opacity: 0, scale: 0.6, y: 30, duration: k.T(0.55), ease: 'au.pop' }, times[i]);
      if (i < steps.length - 1) {
        const arrow = el('div', 'ar-flow-arrow', flow, `<svg viewBox="0 0 120 40"><path d="M4 20 H104 M90 8 L106 20 L90 32"/></svg>`);
        arrow.setAttribute('data-layer', 'arrow-' + i);
        ctx.draw(arrow.querySelector('svg'), { at: times[i] + k.T(0.3), duration: Math.max(0.3, (times[i + 1] - times[i]) * 0.7), ease: 'au.glide' });
      }
    });
    settle(ctx, k, null);
  };

  A['icon-grid'] = function (ctx, k) {
    const d = ctx.data;
    const items = (d.items || []).slice(0, ctx.portrait ? 6 : 6);
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const grid = el('div', 'ar-icon-grid n' + items.length, box);
    const end = h.play(0.1);
    const t0 = Math.min(end - 0.2, k.budget - 1.2);
    items.forEach((it, i) => {
      const item = typeof it === 'string' ? { label: it } : it;
      const cell = el('div', 'ar-icon-cell', grid, `<div class="ar-icon-bubble">${ctx.icon(item.icon || 'sparkles', { size: 64, stroke: 1.7 })}</div><div class="ar-icon-label">${rich(item.label)}</div>`);
      cell.setAttribute('data-layer', 'cell-' + i);
      const order = [i, items.length - 1 - i, (i * 2) % items.length][k.variant % 3];
      ctx.tl.from(cell, { opacity: 0, scale: 0.5, y: 40, duration: k.T(0.55), ease: 'au.pop' }, t0 + order * k.T(0.1));
    });
    ctx.ambient(grid.querySelectorAll('.ar-icon-bubble'), 'float', { amount: 0.8, period: 3.4 });
    settle(ctx, k, null);
  };

  A['doodle-explain'] = function (ctx, k) {
    const d = ctx.data;
    const nodes = (d.nodes || d.steps || ['Idea', 'Problem', 'Answer']).slice(0, 4).map((n) => (typeof n === 'string' ? n : n.label));
    const box = el('div', 'ar-stack-v ar-doodle', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md', style: 'blur' });
    const W = ctx.portrait ? ctx.safe.w : ctx.safe.w;
    const H = ctx.portrait ? ctx.H * 0.48 : ctx.H * 0.5;
    const svg = svgEl('svg', { class: 'ar-doodle-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, box);
    svg.setAttribute('data-layer', 'doodle');
    const labels = el('div', 'ar-doodle-labels', box);
    labels.style.width = W + 'px'; labels.style.height = H + 'px';
    const end = h.play(0.1);
    const n = nodes.length;
    const pts = nodes.map((_, i) => {
      if (ctx.portrait) return [W * (i % 2 ? 0.68 : 0.32), H * (0.15 + 0.7 * i / Math.max(1, n - 1))];
      return [W * (0.12 + 0.76 * i / Math.max(1, n - 1)), H * (i % 2 ? 0.62 : 0.38)];
    });
    const rx = ctx.portrait ? W * 0.26 : Math.min(W / n * 0.42, 260);
    const ry = ctx.portrait ? H * 0.09 : H * 0.2;
    const shapes = [];
    pts.forEach((p, i) => {
      shapes.push({ type: i === n - 1 ? 'rect' : 'ellipse', args: i === n - 1 ? [p[0] - rx, p[1] - ry, rx * 2, ry * 2] : [p[0], p[1], rx * 2, ry * 2], stroke: i === n - 1 ? 'var(--accent)' : 'var(--ink)', fill: i === n - 1 ? 'var(--accent)' : undefined, fillStyle: 'hachure', hachureGap: 14, layer: 'shape-' + i });
      if (i < n - 1) {
        const q = pts[i + 1];
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const ox = Math.cos(ang), oy = Math.sin(ang);
        const pad = ctx.portrait ? ry * 1.25 : rx * 1.08;
        shapes.push({ type: 'arrow', args: [p[0] + ox * pad, p[1] + oy * pad, q[0] - ox * pad, q[1] - oy * pad], layer: 'arrow-' + i, head: 22 });
      }
    });
    const groups = ctx.rough(svg, shapes, { strokeWidth: 4.5, roughness: 1.8 });
    const times = k.spread(n, Math.min(end - 0.3, k.budget - 1.6), k.budget - 0.6);
    let gi = 0;
    pts.forEach((p, i) => {
      ctx.draw(groups[gi], { at: times[i], duration: k.T(0.7), stagger: 0.02 });
      gi++;
      const lab = el('div', 'ar-doodle-label' + (i === n - 1 ? ' is-hero' : ''), labels, esc(nodes[i]));
      lab.setAttribute('data-layer', 'label-' + i);
      lab.style.left = p[0] + 'px'; lab.style.top = p[1] + 'px';
      ctx.tl.from(lab, { opacity: 0, scale: 0.7, duration: k.T(0.4), ease: 'au.pop' }, times[i] + k.T(0.35));
      if (i < n - 1) { ctx.draw(groups[gi], { at: times[i] + k.T(0.55), duration: Math.max(0.25, (times[i + 1] - times[i]) * 0.6) }); gi++; }
    });
    settle(ctx, k, null);
  };

  A['equation'] = function (ctx, k) {
    const d = ctx.data;
    k.root.classList.add('ar-center');
    const box = el('div', 'ar-box ar-eq-box', k.root);
    if (d.title) { const t = el('div', 'ar-eq-title', box, rich(d.title)); t.setAttribute('data-layer', 'title'); ctx.tl.from(t, { opacity: 0, y: -20, duration: k.T(0.6) }, 0.1); }
    const eq = el('div', 'ar-eq', box);
    eq.setAttribute('data-layer', 'equation');
    const glyphs = ctx.math(eq, d.tex || 'E = mc^2', { at: 0.4, duration: Math.min(k.T(1.4), k.budget - 1.2) });
    const kx = eq.querySelector('.katex') || eq;
    const ew = kx.getBoundingClientRect().width;
    const maxW = ctx.safe.w * 0.9;
    if (ew > maxW) eq.style.fontSize = (parseFloat(getComputedStyle(eq).fontSize) * maxW / ew) + 'px';
    const frame = svgEl('svg', { class: 'ar-eq-frame', viewBox: '0 0 100 40', preserveAspectRatio: 'none' }, box);
    svgEl('rect', { x: 1, y: 1, width: 98, height: 38, rx: 3 }, frame);
    frame.setAttribute('data-layer', 'frame');
    ctx.draw(frame, { at: Math.min(1.6, k.budget - 0.8), duration: k.T(0.9) });
    if (glyphs.length > 2) {
      const hero = glyphs[glyphs.length - 1];
      ctx.tl.to(hero, { color: 'var(--accent)', scale: 1.15, duration: k.T(0.4), ease: 'au.pop' }, Math.min(2.0, k.budget - 0.5));
    }
    if (d.note) { const nn = el('div', 'ar-eq-note', box, rich(d.note)); nn.setAttribute('data-layer', 'note'); ctx.tl.from(nn, { opacity: 0, y: 16, duration: k.T(0.6) }, Math.min(2.1, k.budget - 0.4)); }
    settle(ctx, k, null);
  };

  A['image-focus'] = function (ctx, k) {
    const d = ctx.data;
    const box = el('div', 'ar-image-wrap v' + (k.variant % 3), k.root);
    const frame = el('div', 'ar-image-frame', box);
    frame.setAttribute('data-layer', 'image');
    if (d.image) {
      const src = ctx.asset(d.image);
      frame.innerHTML = /\.(mp4|webm|mov)(\?|$)/i.test(src) ? `<video src="${src}" muted playsinline preload="auto" data-loop></video>` : `<img src="${src}" alt="">`;
    } else {
      frame.innerHTML = `<div class="ar-image-placeholder">${ctx.icon(d.icon || 'image', { size: 160, stroke: 1.2 })}</div>`;
    }
    const media = frame.firstElementChild;
    const text = el('div', 'ar-image-text', box);
    const h = heading(ctx, k, text, { kicker: d.kicker, title: d.title, subtitle: d.caption }, { size: 'lg' });
    ctx.tl.fromTo(frame, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: k.T(0.9), ease: 'au.glide' }, 0.05);
    ctx.tl.fromTo(media, { scale: 1.18, xPercent: -2 }, { scale: 1.02, xPercent: 2, duration: ctx.D, ease: 'none' }, 0);
    h.play(0.5);
    if (d.annotate) {
      const ann = svgEl('svg', { class: 'ar-annotate', viewBox: '0 0 300 200' }, frame);
      const g = ctx.rough(ann, [{ type: 'ellipse', args: [150, 100, 250, 150], stroke: 'var(--accent)' }], { strokeWidth: 6, boil: true });
      ctx.draw(g, { at: Math.min(1.4, k.budget - 0.8), duration: k.T(0.7) });
    }
  };

  A['scale-zoom'] = function (ctx, k) {
    const d = ctx.data;
    const levels = (d.levels || [{ label: 'Atom' }, { label: 'Cell' }, { label: 'Human' }, { label: 'Planet' }]).slice(0, 5);
    const stage = el('div', 'ar-scale', k.root);
    stage.setAttribute('data-allow-offstage', '');
    const head = heading(ctx, k, el('div', 'ar-scale-head', k.root), { kicker: d.kicker, title: d.title }, { size: 'md' });
    head.play(0.1);
    const n = levels.length;
    const base = 100;
    const step = 3.4;
    const F = Math.min(ctx.W, ctx.H) * (ctx.portrait ? 0.7 : 0.5) / base;
    const fsSm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-sm')) || 40;
    const circles = levels.map((lv, i) => {
      const c = el('div', 'ar-scale-ring r' + (i % 3), stage, `<span>${esc(typeof lv === 'string' ? lv : lv.label)}</span>`);
      c.setAttribute('data-layer', 'level-' + i);
      const size = base * Math.pow(step, i);
      const kk = Math.pow(step, i) / F;
      c.style.width = c.style.height = size + 'px';
      c.style.marginLeft = c.style.marginTop = (-size / 2) + 'px';
      c.style.borderWidth = (4 * kk) + 'px';
      c.querySelector('span').style.fontSize = (fsSm * kk) + 'px';
      return c;
    });
    const times = k.spread(n, 0.4, k.budget - 0.5);
    ctx.tl.set(stage, { scale: F }, 0);
    circles.forEach((c, i) => {
      ctx.tl.from(c, { scale: 0.3, opacity: 0, duration: k.T(0.6), ease: 'au.pop' }, Math.max(0.15, times[i] - (i ? 0.25 : 0.1)));
      if (i > 0) ctx.tl.to(stage, { scale: F / Math.pow(step, i), duration: Math.max(0.5, times[i] - times[i - 1]), ease: 'au.glide' }, times[i - 1] + 0.05);
    });
    ctx.tl.to(stage, { rotation: 6, duration: ctx.D, ease: 'none' }, 0);
  };

  A['map-pins'] = function (ctx, k) {
    const d = ctx.data;
    const pins = (d.pins || [{ label: 'A', x: 30, y: 40 }, { label: 'B', x: 62, y: 55 }, { label: 'C', x: 75, y: 30 }]).slice(0, 6);
    const box = el('div', 'ar-stack-v', k.root);
    const h = heading(ctx, k, box, { kicker: d.kicker, title: d.title }, { size: 'md' });
    const map = el('div', 'ar-map', box);
    map.setAttribute('data-layer', 'map');
    const mw = ctx.safe.w, mh = ctx.portrait ? ctx.H * 0.45 : ctx.H * 0.5;
    map.style.width = mw + 'px'; map.style.height = mh + 'px';
    const c = el('canvas', 'ar-map-dots', map);
    c.width = mw; c.height = mh;
    const g2 = c.getContext('2d');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
    g2.fillStyle = accent || 'rgba(0,0,0,0.2)';
    const blobs = [[0.18, 0.35, 0.16, 0.22], [0.27, 0.72, 0.08, 0.2], [0.5, 0.3, 0.09, 0.14], [0.53, 0.62, 0.09, 0.22], [0.72, 0.35, 0.2, 0.2], [0.84, 0.75, 0.07, 0.1]];
    for (let x = 6; x < mw; x += 14) {
      for (let y = 6; y < mh; y += 14) {
        const u = x / mw, v = y / mh;
        const inside = blobs.some(([bx, by, rx, ry]) => ((u - bx) / rx) ** 2 + ((v - by) / ry) ** 2 < 1 + Math.sin(u * 40 + v * 30) * 0.12);
        if (inside) { g2.beginPath(); g2.arc(x, y, 3, 0, Math.PI * 2); g2.fill(); }
      }
    }
    const svg = svgEl('svg', { class: 'ar-map-arcs', viewBox: `0 0 ${mw} ${mh}`, width: mw, height: mh }, map);
    const end = h.play(0.1);
    ctx.tl.from(c, { opacity: 0, scale: 1.05, duration: k.T(0.9) }, 0.1);
    const times = k.spread(pins.length, Math.min(end - 0.2, k.budget - 1.4), k.budget - 0.5);
    pins.forEach((p, i) => {
      const x = (p.x / 100) * mw, y = (p.y / 100) * mh;
      const pin = el('div', 'ar-pin' + (i === pins.length - 1 ? ' is-hero' : ''), map, `<i></i><span>${esc(p.label)}</span>`);
      pin.setAttribute('data-layer', 'pin-' + i);
      pin.style.left = x + 'px'; pin.style.top = y + 'px';
      ctx.tl.from(pin, { opacity: 0, y: -30, duration: k.T(0.45), ease: 'au.pop' }, times[i]);
      ctx.tl.fromTo(pin.querySelector('i'), { '--ring': 0 }, { '--ring': 1, duration: 1.2, repeat: 3, ease: 'none' }, times[i]);
      if (i > 0) {
        const prev = pins[i - 1];
        const px = (prev.x / 100) * mw, py = (prev.y / 100) * mh;
        const path = svgEl('path', { d: `M${px},${py} Q${(px + x) / 2},${Math.min(py, y) - mh * 0.2} ${x},${y}` }, svg);
        ctx.draw(path, { at: times[i] - 0.35, duration: 0.5 });
      }
    });
    settle(ctx, k, null);
  };

  A['ui-mockup'] = function (ctx, k) {
    const d = ctx.data;
    const app = d.app || {};
    const box = el('div', 'ar-grid-2 ar-ui-grid', k.root);
    const text = el('div', 'ar-col', box);
    const h = heading(ctx, k, text, { kicker: d.kicker, title: d.title, subtitle: d.subtitle }, { size: 'lg' });
    const win = el('div', 'ar-window', box);
    win.setAttribute('data-layer', 'window');
    win.setAttribute('data-depth', '0.4');
    win.innerHTML = `<div class="ar-window-bar"><i></i><i></i><i></i><span>${esc(app.title || 'Dashboard')}</span></div><div class="ar-window-body"></div>`;
    const body = win.querySelector('.ar-window-body');
    const rows = (app.rows || ['Revenue', 'Active users', 'Conversion']).slice(0, 4);
    rows.forEach((r, i) => {
      const row = el('div', 'ar-ui-row', body, `<span class="ar-ui-ic">${ctx.icon(['trending-up', 'users', 'target', 'zap'][i % 4], { size: 30 })}</span><span class="ar-ui-l">${esc(typeof r === 'string' ? r : r.label)}</span><span class="ar-ui-bar"><b style="width:${30 + ((i * 23 + 17) % 60)}%"></b></span>`);
      row.setAttribute('data-layer', 'row-' + i);
    });
    const metric = el('div', 'ar-ui-metric', win, `<small>${esc(app.metricLabel || 'Growth')}</small><b>0</b>`);
    metric.setAttribute('data-layer', 'metric');
    metric.setAttribute('data-depth', '0.9');
    const cursor = el('div', 'ar-cursor', win, ctx.icon('mouse-pointer-2', { size: 44, stroke: 1.5, fill: 'var(--ink)', color: 'var(--bg)' }));
    cursor.setAttribute('data-layer', 'cursor');
    const end = h.play(0.1);
    ctx.tl.from(win, { y: 120, rotationX: 18, opacity: 0, transformPerspective: 1200, duration: k.T(0.9), ease: k.m.enter }, 0.2);
    ctx.tl.from(body.children, { opacity: 0, x: 30, duration: k.T(0.45), stagger: k.T(0.1) }, 0.7);
    ctx.tl.from(body.querySelectorAll('.ar-ui-bar b'), { scaleX: 0, transformOrigin: '0 50%', duration: k.T(0.8), stagger: k.T(0.1) }, 0.9);
    ctx.tl.from(metric, { scale: 0.6, opacity: 0, duration: k.T(0.5), ease: 'au.pop' }, Math.min(1.3, k.budget - 1));
    ctx.counter(metric.querySelector('b'), Number(app.metric || 128), { at: Math.min(1.4, k.budget - 1), duration: 1.2, suffix: app.metricSuffix || '%', prefix: '+' });
    ctx.tl.fromTo(cursor, { x: 340, y: 260, opacity: 0 }, { x: 120, y: 120, opacity: 1, duration: k.T(0.9), ease: 'au.glide' }, Math.min(1.1, k.budget - 1.2));
    ctx.tl.to(cursor, { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 }, Math.min(2.0, k.budget - 0.3));
    ctx.tl.to(body.children[0] || win, { backgroundColor: 'var(--hl-row)', duration: 0.3 }, Math.min(2.05, k.budget - 0.25));
    ctx.camera({ at: 0, x: ctx.portrait ? 0 : 24, scale: 1.05, duration: ctx.D, ease: 'none' });
    void end;
  };

  A['lower-third'] = function (ctx, k) {
    const d = ctx.data;
    const bg = el('div', 'ar-lt-bg', k.root);
    bg.setAttribute('data-layer', 'background');
    if (d.image) {
      const src = ctx.asset(d.image);
      bg.innerHTML = /\.(mp4|webm|mov)(\?|$)/i.test(src) ? `<video src="${src}" muted playsinline preload="auto" data-loop></video>` : `<img src="${src}" alt="">`;
      ctx.tl.fromTo(bg.firstElementChild, { scale: 1.12 }, { scale: 1.0, duration: ctx.D, ease: 'none' }, 0);
    } else {
      bg.innerHTML = `<div class="ar-lt-art">${ctx.icon(d.icon || 'user-round', { size: 260, stroke: 0.9 })}</div>`;
      ctx.ambient(bg.firstElementChild, 'breathe');
    }
    const lt = el('div', 'ar-lt', k.root, `<div class="ar-lt-bar"></div><div class="ar-lt-text"><b>${esc(d.name || d.title || '')}</b><span>${esc(d.role || d.subtitle || '')}</span></div>`);
    lt.setAttribute('data-layer', 'lower-third');
    ctx.tl.from(lt.querySelector('.ar-lt-bar'), { scaleY: 0, transformOrigin: '50% 100%', duration: k.T(0.4), ease: 'au.glide' }, 0.4);
    ctx.tl.from(lt.querySelector('b'), { xPercent: -30, opacity: 0, duration: k.T(0.6) }, 0.55);
    ctx.tl.from(lt.querySelector('span'), { xPercent: -30, opacity: 0, duration: k.T(0.6) }, 0.7);
  };

  A['end-card'] = function (ctx, k) {
    const d = ctx.data;
    k.root.classList.add('ar-center');
    const box = el('div', 'ar-box ar-end', k.root);
    const mark = el('div', 'ar-end-mark', box, ctx.icon(d.icon || 'sparkle', { size: 96, stroke: 1.6 }));
    mark.setAttribute('data-layer', 'mark');
    const h = heading(ctx, k, box, { title: d.title || 'Thanks for watching', subtitle: d.subtitle }, { size: 'xl' });
    ctx.tl.from(mark, { scale: 0, rotation: 120, duration: k.T(0.7), ease: 'au.pop' }, 0.1);
    const end = h.play(0.35);
    if (d.cta) {
      const cta = el('div', 'ar-cta', box, `${esc(d.cta)}<span>${ctx.icon('arrow-right', { size: 36, stroke: 2.4 })}</span>`);
      cta.setAttribute('data-layer', 'cta');
      ctx.tl.from(cta, { opacity: 0, y: 24, scale: 0.9, duration: k.T(0.55), ease: 'au.pop' }, Math.min(end, k.budget - 0.4));
      ctx.tl.to(cta.querySelector('span'), { x: 8, duration: 0.5, yoyo: true, repeat: Math.ceil(ctx.D), ease: 'sine.inOut' }, Math.min(end + 0.5, k.budget));
    }
    ctx.ambient(mark, 'spin', { period: 6 });
    settle(ctx, k, null);
  };

  function run(name, ctx) {
    const fn = A[name] || A['kinetic-title'];
    const k = kit(ctx);
    k.root.classList.add('arch-' + (A[name] ? name : 'kinetic-title'));
    fn(ctx, k);
  }

  window.AU_ARCH = { run, get list() { return Object.keys(A); }, add: (name, fn) => { A[name] = fn; }, kit, heading, settle, revealHeading, el, svgEl, esc, rich };
})();
