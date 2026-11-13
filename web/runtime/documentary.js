(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const inOut = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const backOut = (u) => { u = clamp(u, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const toLL = (x, y) => [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI];
  const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  function glWait(map) {
    return new Promise((res) => {
      let done = false;
      const finish = () => { if (!done) { done = true; res(); } };
      const check = () => { if (map.loaded() && map.areTilesLoaded()) finish(); else map.once('render', check); };
      map.once('render', check);
      map.triggerRepaint();
      setTimeout(finish, 12000);
    });
  }
  function glRecolor(map, el, mode) {
    if (mode !== 'film') return;
    const cs = getComputedStyle(el);
    const v = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
    const bg = v('--bg', '#f4f1ea'), bg2 = v('--bg-2', '#e6e1d6'), ink = v('--ink', '#1d1d1d'), muted = v('--muted', '#8a8a8a');
    map.getStyle().layers.forEach((l) => {
      const id = l.id.toLowerCase();
      try {
        if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', bg);
        else if (l.type === 'fill' && /water|ocean|sea|lake|river/.test(id)) map.setPaintProperty(l.id, 'fill-color', bg2);
        else if (l.type === 'fill' && /building/.test(id)) map.setPaintProperty(l.id, 'fill-color', bg2);
        else if (l.type === 'fill') map.setPaintProperty(l.id, 'fill-color', bg);
        else if (l.type === 'line' && /water|river|stream|canal/.test(id)) map.setPaintProperty(l.id, 'line-color', bg2);
        else if (l.type === 'line' && /boundary|admin|border/.test(id)) map.setPaintProperty(l.id, 'line-color', muted);
        else if (l.type === 'line') map.setPaintProperty(l.id, 'line-color', muted);
        else if (l.type === 'fill-extrusion') map.setPaintProperty(l.id, 'fill-extrusion-color', bg2);
        else if (l.type === 'symbol') { map.setPaintProperty(l.id, 'text-color', ink); map.setPaintProperty(l.id, 'text-halo-color', bg); }
      } catch (e) { }
    });
  }
  function glBuild(spec, box, first, adj) {
    const g = spec.gl;
    const style = g.style || { version: 8, sources: { base: { type: 'raster', tiles: [g.raster], tileSize: 256, maxzoom: g.maxzoom || 18 } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] };
    const ll = toLL(first[0], first[1]);
    const map = new window.maplibregl.Map({ container: box, style, center: ll, zoom: first[2] + adj, pitch: first[3] || 0, bearing: first[4] || 0, interactive: false,
      attributionControl: false, fadeDuration: 0, preserveDrawingBuffer: true, maxPitch: 85, renderWorldCopies: true });
    return map;
  }
  const col = (v, fb) => (v ? (String(v).startsWith('--') ? `var(${v})` : v) : fb);
  const TINTS = {
    none: '', paper: 'sepia(0.35) saturate(0.75) contrast(0.96) brightness(1.03)', mono: 'grayscale(1) contrast(1.05)',
    night: 'invert(1) hue-rotate(180deg) brightness(0.82) contrast(0.92)', warm: 'sepia(0.2) saturate(1.1)', cool: 'saturate(0.8) hue-rotate(-12deg) brightness(0.98)',
    muted: 'saturate(0.45) contrast(0.95) brightness(1.04)'
  };

  if (document.getElementById && document.head && !document.getElementById('au-docu-css')) {
    const st = document.createElement('style');
    st.id = 'au-docu-css';
    st.textContent = `
.auc-map{overflow:hidden;background:var(--bg);}
.auc-map .mp-tiles,.auc-map .mp-layer{position:absolute;left:0;top:0;}
.auc-map .mp-layer{transform-origin:0 0;will-change:transform;}
.auc-map .mp-layer img{position:absolute;display:block;max-width:none;}
.auc-map svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}
.auc-map .mp-land path{fill:var(--bg-2);stroke:var(--muted);stroke-opacity:.55;stroke-width:1;vector-effect:non-scaling-stroke;}
.auc-map .mp-pins{position:absolute;inset:0;}
.auc-map .mp-pin{position:absolute;left:0;top:0;width:0;height:0;}
.auc-map .mp-dot{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:var(--pin);box-shadow:0 0 0 4px var(--bg),0 6px 18px rgba(0,0,0,.25);}
.auc-map .mp-ring{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid var(--pin);}
.auc-map .mp-needle{position:absolute;width:30px;height:42px;margin:-42px 0 0 -15px;}
.auc-map .mp-label{position:absolute;white-space:nowrap;font:700 var(--fs-sm)/1.1 var(--font-body);color:var(--ink);background:var(--bg);padding:.28em .6em;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.18);transform-origin:0 50%;}
.auc-map .mp-label.plain{background:none;box-shadow:none;text-shadow:0 0 6px var(--bg),0 0 2px var(--bg);font-size:var(--fs-md);}
.auc-map .mp-credit{position:absolute;right:.6%;bottom:.5%;font:500 11px/1 var(--font-body);color:var(--ink);opacity:.62;background:color-mix(in srgb,var(--bg) 70%,transparent);padding:3px 6px;border-radius:4px;}
.auc-webpage{perspective:1800px;}
.auc-webpage .wp-card{position:absolute;inset:0;display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.28),0 4px 14px rgba(0,0,0,.12);}
.auc-webpage.frame-none .wp-card{box-shadow:none;border-radius:0;background:none;}
.auc-webpage.frame-paper .wp-card{border-radius:2px;box-shadow:0 18px 50px rgba(0,0,0,.3);}
.auc-webpage .wp-bar{flex:none;height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;background:#eceef1;border-bottom:1px solid #d9dce1;}
.auc-webpage .wp-bar i{width:12px;height:12px;border-radius:50%;background:#ff5f57;display:block;}
.auc-webpage .wp-bar i:nth-child(2){background:#febc2e}.auc-webpage .wp-bar i:nth-child(3){background:#28c840}
.auc-webpage .wp-bar span{margin-left:14px;flex:1;max-width:60%;height:26px;border-radius:13px;background:#fff;color:#555;font:500 13px/26px var(--font-body);padding:0 14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
.auc-webpage .wp-view{position:relative;flex:1;overflow:hidden;}
.auc-webpage .wp-doc{position:absolute;left:0;top:0;width:100%;transform-origin:0 0;}
.auc-webpage .wp-doc img{display:block;width:100%;height:auto;}
.auc-webpage .wp-hl{position:absolute;transform-origin:0 50%;}
.auc-webpage .wp-hl.marker{background:var(--hl);mix-blend-mode:multiply;opacity:.5;border-radius:3px;}
.auc-webpage .wp-hl.box{border:4px solid var(--hl);border-radius:6px;}
.auc-webpage .wp-hl.underline{border-bottom:5px solid var(--hl);}
.auc-webpage .wp-shade{position:absolute;inset:0;background:#000;pointer-events:none;}
`;
    document.head.appendChild(st);
  }

  reg.define('map', {
    category: 'map', description: 'Animated real-world map built by the make_map tool (OpenStreetMap or Esri street, topographic, atlas, relief, satellite or terrain tiles, or Natural Earth vector countries). Plays the camera flight baked into the map asset and draws its routes, pins, labels and highlighted regions frame-exactly.',
    params: {
      src: { type: 'string', default: '', doc: 'map asset id returned by make_map' }, h: { type: 'number', default: null, doc: 'height in % of frame (defaults to the box given to make_map)' },
      tint: { type: 'enum', default: '', options: ['', 'none', 'paper', 'mono', 'night', 'warm', 'cool', 'muted'], doc: 'colour treatment of the tiles; empty uses the one chosen in make_map' },
      labels: { type: 'boolean', default: true, doc: 'show marker and region labels' }, credit: { type: 'boolean', default: true, doc: 'show the map attribution (required by the tile licence)' },
      timeShift: { type: 'number', default: 0, doc: 'seconds to delay the whole map animation' }
    },
    example: "component('map', { src: 'as_map0001', tint: 'paper' })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-map', { x: p.x != null ? p.x : 0, y: p.y != null ? p.y : 0, w: p.w != null ? p.w : 100 });
    el.style.height = (p.h != null ? p.h : 100) + '%';
    const { at, end } = h.span(Object.assign({}, p, { at: 0 }));
    const state = { spec: null };
    const url = new URL(ctx.asset(p.src), location.href);
    ctx.defer(fetch(url.href).then((r) => { if (!r.ok) throw new Error('map asset ' + p.src + ' not found'); return r.json(); }).then((spec) => {
      state.spec = spec;
      if (p.x == null && spec.box) el.style.left = spec.box.x + '%';
      if (p.y == null && spec.box) el.style.top = spec.box.y + '%';
      if (p.w == null && spec.box) el.style.width = spec.box.w + '%';
      if (p.h == null && spec.box) el.style.height = spec.box.h + '%';
      const tiles = document.createElement('div');
      tiles.className = 'mp-tiles';
      const tint = TINTS[p.tint || spec.tint || 'none'];
      if (tint) tiles.style.filter = tint;
      el.appendChild(tiles);
      const waits = [];
      if (spec.engine === 'gl') {
        if (!window.maplibregl) throw new Error('MapLibre is not loaded on this page');
        tiles.style.cssText += ';position:absolute;inset:0;';
        const vw0 = el.clientWidth || spec.view.w;
        const map = glBuild(spec, tiles, spec.camera[0], Math.log2(vw0 / spec.view.w));
        state.map = map;
        waits.push(new Promise((res) => {
          map.once('load', () => {
            const g = spec.gl;
            try {
              if (g.terrain) {
                map.addSource('au-dem', { type: 'raster-dem', tiles: [g.dem || DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
                map.setTerrain({ source: 'au-dem', exaggeration: g.terrain });
              }
              if (g.hillshade) {
                map.addSource('au-dem2', { type: 'raster-dem', tiles: [g.dem || DEM], encoding: 'terrarium', tileSize: 256, maxzoom: 14 });
                const firstSymbol = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
                map.addLayer({ id: 'au-hills', type: 'hillshade', source: 'au-dem2', paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': 'rgba(0,0,0,0.35)' } }, firstSymbol);
              }
              if (g.labels === false) map.getStyle().layers.filter((l) => l.type === 'symbol').forEach((l) => map.setLayoutProperty(l.id, 'visibility', 'none'));
              const srcs = map.getStyle().sources || {};
              const vec = Object.keys(srcs).find((k) => srcs[k].type === 'vector');
              if (g.buildings && vec && !map.getStyle().layers.some((l) => l.type === 'fill-extrusion')) {
                map.addLayer({ id: 'au-buildings', type: 'fill-extrusion', source: vec, 'source-layer': 'building', minzoom: 14,
                  paint: { 'fill-extrusion-color': '#d9d4cc', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.9 } });
              }
              glRecolor(map, el, g.palette);
            } catch (e) { }
            glWait(map).then(res);
          });
          setTimeout(res, 25000);
        }));
      }
      state.layers = (spec.layers || []).map((L) => {
        const div = document.createElement('div');
        div.className = 'mp-layer';
        const tp = spec.tile;
        L.tiles.forEach(([tx, ty, file]) => {
          const img = document.createElement('img');
          img.src = new URL(file, url).href;
          img.style.left = tx * tp + 'px';
          img.style.top = ty * tp + 'px';
          img.style.width = tp + 1 + 'px';
          img.style.height = tp + 1 + 'px';
          div.appendChild(img);
          waits.push(img.decode().catch(() => null));
        });
        tiles.appendChild(div);
        return { z: L.z, x0: L.x0, y0: L.y0, el: div };
      });
      const svgN = document.createElementNS(NS, 'svg');
      svgN.setAttribute('preserveAspectRatio', 'none');
      const svgP0 = document.createElementNS(NS, 'svg');
      const land = document.createElementNS(NS, 'g');
      land.setAttribute('class', 'mp-land');
      const ringsD = (rings) => rings.map((r) => 'M' + r.map((pt) => (pt[0] * 1000).toFixed(5) + ' ' + (pt[1] * 1000).toFixed(5)).join('L') + 'Z').join('');
      (spec.land || []).forEach((c) => { const path = document.createElementNS(NS, 'path'); path.setAttribute('d', ringsD(c.rings)); land.appendChild(path); });
      svgN.appendChild(land);
      state.regions = (spec.regions || []).map((r) => {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', ringsD(r.rings));
        path.setAttribute('fill-rule', 'evenodd');
        path.style.fill = col(r.fill, 'var(--accent)');
        path.style.stroke = col(r.fill, 'var(--accent)');
        path.style.strokeWidth = '2.5';
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        (spec.engine === 'gl' ? svgP0 : svgN).appendChild(path);
        return Object.assign({}, r, { path, pixel: spec.engine === 'gl' });
      });
      el.appendChild(svgN);
      state.svgN = svgN;
      el.appendChild(svgP0);
      state.svgP0 = svgP0;
      const svgP = document.createElementNS(NS, 'svg');
      const shade = document.createElementNS(NS, 'path');
      shade.setAttribute('fill-rule', 'evenodd');
      shade.style.fill = 'rgba(0,0,0,0.5)';
      svgP.appendChild(shade);
      state.shade = shade;
      state.routes = (spec.routes || []).map((r) => {
        const color = col(r.color, 'var(--accent)');
        const under = document.createElementNS(NS, 'path');
        const line = document.createElementNS(NS, 'path');
        under.style.cssText = `fill:none;stroke:var(--bg);stroke-opacity:.85;stroke-width:${r.width + 5}px;stroke-linecap:round;stroke-linejoin:round`;
        line.style.cssText = `fill:none;stroke:${color};stroke-width:${r.width}px;stroke-linecap:round;stroke-linejoin:round`;
        if (r.style === 'dashed' || r.style === 'flight') line.style.strokeDasharray = `${r.width * 2.4} ${r.width * 1.8}`;
        const head = document.createElementNS(NS, 'g');
        head.innerHTML = r.style === 'flight'
          ? `<path d="M0,-14 L4,-4 L14,2 L14,5 L4,2 L3,10 L7,13 L7,15 L0,13 L-7,15 L-7,13 L-3,10 L-4,2 L-14,5 L-14,2 L-4,-4 Z" style="fill:${color};stroke:var(--bg);stroke-width:1.5"/>`
          : `<circle r="${r.width * 1.5}" style="fill:${color};stroke:var(--bg);stroke-width:3"/>`;
        svgP.appendChild(under); svgP.appendChild(line); svgP.appendChild(head);
        const len = [0];
        for (let i = 1; i < r.pts.length; i++) len.push(len[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
        return Object.assign({}, r, { under, line, head, len, total: len[len.length - 1] || 1e-9 });
      });
      el.appendChild(svgP);
      state.svgP = svgP;
      const pins = document.createElement('div');
      pins.className = 'mp-pins';
      el.appendChild(pins);
      const mk = (x, y, label, a, style, color, dur) => {
        const d = document.createElement('div');
        d.className = 'mp-pin';
        d.style.setProperty('--pin', col(color, 'var(--accent)'));
        let inner = '';
        if (style === 'pin') inner = `<svg class="mp-needle" viewBox="0 0 30 42"><path d="M15 41C15 41 2 25 2 15a13 13 0 0 1 26 0c0 10-13 26-13 26z" style="fill:var(--pin);stroke:var(--bg);stroke-width:2.5"/><circle cx="15" cy="15" r="5" style="fill:var(--bg)"/></svg>`;
        else if (style !== 'label') inner = '<div class="mp-ring"></div><div class="mp-dot"></div>';
        d.innerHTML = inner + (label && p.labels ? `<div class="mp-label${style === 'label' ? ' plain' : ''}">${h.esc(label)}</div>` : '');
        pins.appendChild(d);
        return { x, y, at: a, style, el: d, dur, ring: d.querySelector('.mp-ring'), lab: d.querySelector('.mp-label'), mark: d.querySelector('.mp-needle,.mp-dot') };
      };
      state.markers = (spec.markers || []).map((m) => mk(m.x, m.y, m.label, m.at, m.style, m.color, m.duration));
      state.regionLabels = state.regions.filter((r) => r.label).map((r) => mk(r.anchor[0], r.anchor[1], r.label, r.at + 0.3, 'label', r.fill, r.duration));
      if (p.credit && spec.credit) { const c = document.createElement('div'); c.className = 'mp-credit'; c.textContent = spec.credit; el.appendChild(c); }
      return Promise.all(waits);
    }));

    ctx.onFrame((tt) => {
      const spec = state.spec;
      if (!spec) return;
      const t = Math.max(0, tt - (+p.timeShift || 0));
      const vw = el.clientWidth || 1, vh = el.clientHeight || 1;
      const cam = spec.camera;
      const f = clamp(t * spec.fps, 0, cam.length - 1);
      const i = Math.floor(f), k = f - i;
      const a = cam[i], b = cam[Math.min(cam.length - 1, i + 1)];
      const cx = a[0] + (b[0] - a[0]) * k, cy = a[1] + (b[1] - a[1]) * k;
      const z = a[2] + (b[2] - a[2]) * k + Math.log2(vw / spec.view.w);
      const Wp = 512 * Math.pow(2, z);
      const sx = (x) => (x - cx) * Wp + vw / 2, sy = (y) => (y - cy) * Wp + vh / 2;
      let pt = (x, y) => [sx(x), sy(y)];
      if (state.map) {
        const lerpAng = (u, v) => u + ((((v - u) % 360) + 540) % 360 - 180) * k;
        state.map.jumpTo({ center: toLL(cx, cy), zoom: z, pitch: a.length > 3 ? a[3] + (b[3] - a[3]) * k : 0, bearing: a.length > 4 ? lerpAng(a[4], b[4]) : 0 });
        pt = (x, y) => { const q = state.map.project(toLL(x, y)); return [q.x, q.y]; };
      }
      const xy = (x, y, sep) => { const q = pt(x, y); return q[0].toFixed(1) + (sep || ' ') + q[1].toFixed(1); };
      if (state.svgP0) state.svgP0.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      if (state.layers.length) {
        const off = Math.log2(512 / spec.tile);
        const n = z + off - 0.15;
        const need = Math.ceil(n);
        state.layers.forEach((L) => {
          let op = clamp((n - (L.z - 1.2)) / 0.2, 0, 1);
          if (L.z < need - 3) op = 0;
          L.el.style.opacity = String(op);
          L.el.style.visibility = op > 0 ? 'visible' : 'hidden';
          if (op <= 0) return;
          const s = Wp / Math.pow(2, L.z) / spec.tile;
          L.el.style.transform = `translate(${sx(L.x0 / Math.pow(2, L.z)).toFixed(2)}px,${sy(L.y0 / Math.pow(2, L.z)).toFixed(2)}px) scale(${s.toFixed(6)})`;
        });
      }
      state.svgN.setAttribute('viewBox', `${((cx - vw / 2 / Wp) * 1000).toFixed(6)} ${((cy - vh / 2 / Wp) * 1000).toFixed(6)} ${(vw / Wp * 1000).toFixed(6)} ${(vh / Wp * 1000).toFixed(6)}`);
      let shadeD = '', shadeK = 0;
      state.regions.forEach((r) => {
        let e = smooth((t - r.at) / 0.7);
        if (r.duration != null) e *= 1 - smooth((t - r.at - r.duration) / 0.5);
        if (r.pixel) r.path.setAttribute('d', e > 0 ? r.rings.map((ring) => 'M' + ring.map((q) => xy(q[0], q[1])).join('L') + 'Z').join('') : '');
        r.path.style.fillOpacity = String(r.opacity * e);
        r.path.style.strokeOpacity = String(e);
        if (r.spotlight && e > 0) {
          shadeK = Math.max(shadeK, e);
          shadeD += r.rings.map((ring) => 'M' + ring.map((q) => xy(q[0], q[1])).join('L') + 'Z').join('');
        }
      });
      state.svgP.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      state.shade.setAttribute('d', shadeK > 0 ? `M0 0H${vw}V${vh}H0Z` + shadeD : '');
      state.shade.style.opacity = String(shadeK);
      state.routes.forEach((r) => {
        const u = inOut((t - r.at) / Math.max(0.1, r.duration));
        const show = t >= r.at;
        [r.under, r.line, r.head].forEach((n) => { n.style.visibility = show ? 'visible' : 'hidden'; });
        if (!show) return;
        const target = r.total * u;
        let d = '', j = 1, hx = r.pts[0][0], hy = r.pts[0][1], ang = 0;
        d = 'M' + xy(r.pts[0][0], r.pts[0][1]);
        while (j < r.pts.length && r.len[j] <= target) { d += 'L' + xy(r.pts[j][0], r.pts[j][1]); j++; }
        if (j < r.pts.length) {
          const seg = r.len[j] - r.len[j - 1] || 1e-12;
          const q = (target - r.len[j - 1]) / seg;
          hx = r.pts[j - 1][0] + (r.pts[j][0] - r.pts[j - 1][0]) * q;
          hy = r.pts[j - 1][1] + (r.pts[j][1] - r.pts[j - 1][1]) * q;
          const A = pt(r.pts[j - 1][0], r.pts[j - 1][1]), B = pt(r.pts[j][0], r.pts[j][1]);
          ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
          d += 'L' + xy(hx, hy);
        } else {
          const last = r.pts.length - 1;
          hx = r.pts[last][0]; hy = r.pts[last][1];
          const A = pt(r.pts[Math.max(0, last - 1)][0], r.pts[Math.max(0, last - 1)][1]), B = pt(r.pts[last][0], r.pts[last][1]);
          ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
        }
        r.under.setAttribute('d', d);
        r.line.setAttribute('d', d);
        const fade = r.style === 'flight' ? 1 - smooth((t - r.at - r.duration) / 0.4) : 1;
        r.head.setAttribute('transform', `translate(${xy(hx, hy, ',')}) rotate(${(ang * 180 / Math.PI + 90).toFixed(1)})`);
        r.head.style.opacity = String(fade);
      });
      const place = (m) => {
        let e = (t - m.at) / 0.5;
        let vis = t >= m.at;
        if (m.dur != null && t > m.at + m.dur) { vis = t < m.at + m.dur + 0.4; e = 1 - (t - m.at - m.dur) / 0.4; }
        const [X, Y] = pt(m.x, m.y);
        if (!vis || X < -200 || X > vw + 200 || Y < -200 || Y > vh + 200) { m.el.style.visibility = 'hidden'; return; }
        m.el.style.visibility = 'visible';
        m.el.style.transform = `translate(${X.toFixed(1)}px,${Y.toFixed(1)}px)`;
        const s = backOut(e);
        if (m.mark) m.mark.style.transform = m.style === 'pin' ? `translateY(${((1 - smooth(e)) * -40).toFixed(1)}px) scale(${Math.max(0, s).toFixed(3)})` : `scale(${Math.max(0, s).toFixed(3)})`;
        if (m.mark && m.style === 'pin') m.mark.style.transformOrigin = '50% 100%';
        if (m.ring) {
          const q = ((Math.max(0, t - m.at)) % 1.6) / 1.6;
          m.ring.style.transform = `scale(${(1 + q * (m.style === 'pulse' ? 3.2 : 1.8)).toFixed(3)})`;
          m.ring.style.opacity = String((1 - q) * (m.style === 'pulse' ? 0.9 : 0.5) * clamp(e, 0, 1));
        }
        if (m.lab) {
          const le = smooth((t - m.at - 0.2) / 0.45);
          const left = m.style === 'label' ? -m.lab.offsetWidth / 2 : 20;
          const top = m.style === 'pin' ? -58 : (m.style === 'label' ? -m.lab.offsetHeight / 2 : -m.lab.offsetHeight / 2);
          m.lab.style.left = left + 'px';
          m.lab.style.top = top + 'px';
          m.lab.style.opacity = String(le);
          m.lab.style.transform = `translateX(${((1 - le) * -10).toFixed(1)}px)`;
        }
      };
      state.markers.forEach(place);
      state.regionLabels.forEach(place);
      if (state.map) return glWait(state.map);
      return undefined;
    });
    ctx.tl.set(el, { autoAlpha: 1 }, 0);
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });

  reg.define('webpage', {
    category: 'media', description: 'A website screenshot (from the screenshot tool) shown as a browser window, paper print or bare page, with documentary moves: highlighter sweeps, boxes, underlines or hand-drawn circles over phrases, a zoom into a passage, a scroll through a full-page capture, tilt and drop-in.',
    params: {
      src: { type: 'string', default: '', doc: 'screenshot asset id' }, h: { type: 'number', default: 78, doc: 'height in % of frame' },
      frame: { type: 'enum', default: 'browser', options: ['browser', 'paper', 'none'] }, url: { type: 'string', default: '', doc: 'address shown in the browser bar' },
      highlights: { type: 'array', default: [], doc: 'list of {boxes: [[x,y,w,h] in % of the screenshot, one per text line] (or box), at, style: marker|box|underline|circle, color}' },
      focus: { type: 'object', default: null, doc: '{box: [x,y,w,h] %, at, duration, zoom} zooms the camera onto a passage' },
      scroll: { type: 'object', default: null, doc: '{to: % of page height for the top edge, at, duration} for full-page captures' },
      dim: { type: 'number', default: 0, doc: '0 to 0.6: darken the page when the highlights land so they pop' },
      tilt: { type: 'number', default: 0, doc: 'degrees of 3D tilt backwards' }, enter: { type: 'enum', default: 'rise', options: ['rise', 'drop', 'fade', 'none'] }
    },
    example: "component('webpage', { src: 'as_shot0001', url: 'en.wikipedia.org/wiki/Moon', highlights: [{ boxes: [[12.5, 41.2, 38.0, 3.1]], at: 1.2 }], focus: { box: [12.5, 41.2, 38.0, 3.1], at: 2.0 } })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-webpage frame-' + p.frame, { x: 10, y: 6, w: 80 });
    el.style.height = p.h + '%';
    el.innerHTML = `<div class="wp-card">${p.frame === 'browser' ? `<div class="wp-bar"><i></i><i></i><i></i><span>${h.esc(p.url || '')}</span></div>` : ''}<div class="wp-view"><div class="wp-doc"><img src="${ctx.asset(p.src)}" alt=""><div class="wp-marks"></div></div><div class="wp-shade"></div></div></div>`;
    const card = el.querySelector('.wp-card'), view = el.querySelector('.wp-view'), doc = el.querySelector('.wp-doc'), img = doc.querySelector('img'), marks = doc.querySelector('.wp-marks');
    const shade = el.querySelector('.wp-shade');
    ctx.defer(img.decode().catch(() => null));
    const { at, end } = h.span(p);
    const hls = (Array.isArray(p.highlights) ? p.highlights : []).map((hl, n) => {
      const boxes = hl.boxes || (hl.box ? [hl.box] : []);
      const color = col(hl.color, hl.style === 'marker' || !hl.style ? '#ffe14d' : 'var(--accent)');
      const start = hl.at != null ? +hl.at : at + 0.8 + n * 0.9;
      if (!boxes.length) return null;
      if (hl.style === 'circle') {
        const xs = boxes.map((b) => b[0]), ys = boxes.map((b) => b[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = `position:absolute;left:${x0 - 2}%;top:${y0 - 1.6}%;width:${x1 - x0 + 4}%;height:${y1 - y0 + 3.2}%;overflow:visible`;
        svg.innerHTML = `<path pathLength="1" d="M52 4 C84 2 99 22 97 50 C95 80 70 97 46 96 C18 95 2 76 3 48 C4 22 26 6 58 7" style="fill:none;stroke:${color};stroke-width:4;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1"/>`;
        marks.appendChild(svg);
        ctx.tl.to(svg.querySelector('path'), { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, start);
        return { start };
      }
      boxes.forEach((b, li) => {
        const d = document.createElement('div');
        d.className = 'wp-hl ' + (hl.style || 'marker');
        d.style.setProperty('--hl', color);
        const pad = hl.style === 'box' ? 0.6 : 0.15;
        Object.assign(d.style, { left: b[0] - pad + '%', top: b[1] - pad + '%', width: b[2] + pad * 2 + '%', height: b[3] + pad * 2 + '%' });
        marks.appendChild(d);
        if (hl.style === 'box') ctx.tl.fromTo(d, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.out' }, start + li * 0.2);
        else ctx.tl.fromTo(d, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.inOut' }, start + li * 0.35);
      });
      return { start };
    }).filter(Boolean);
    marks.style.cssText = 'position:absolute;inset:0;z-index:2;';
    if (p.dim > 0 && hls.length) {
      doc.insertBefore(shade, marks);
      shade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;z-index:1;pointer-events:none;';
      ctx.tl.to(shade, { opacity: p.dim, duration: 0.5 }, Math.max(0, hls[0].start - 0.3));
    } else shade.remove();
    const enters = { rise: [{ y: 90, autoAlpha: 0, rotationX: p.tilt + 10 }, { y: 0, autoAlpha: 1, rotationX: p.tilt }], drop: [{ y: -120, autoAlpha: 0, rotation: -4, rotationX: p.tilt }, { y: 0, autoAlpha: 1, rotation: 0, rotationX: p.tilt }],
      fade: [{ autoAlpha: 0, rotationX: p.tilt }, { autoAlpha: 1, rotationX: p.tilt }] };
    const en = enters[p.enter];
    if (en) ctx.tl.fromTo(card, en[0], Object.assign({ duration: 0.8, ease: 'power3.out', transformPerspective: 1800 }, en[1]), at);
    else ctx.tl.set(card, { rotationX: p.tilt, transformPerspective: 1800 }, 0);
    ctx.onFrame((t) => {
      const vw = view.clientWidth || 1, vh = view.clientHeight || 1;
      const dh = doc.offsetHeight || vh;
      let top = 0;
      if (p.scroll) {
        const sc = p.scroll;
        const u = inOut((t - (sc.at != null ? +sc.at : at + 0.6)) / Math.max(0.2, +sc.duration || 2.5));
        top = clamp((+sc.to || 0) / 100 * dh, 0, Math.max(0, dh - vh)) * u;
      }
      let s = 1, tx = 0, ty = -top;
      if (p.focus && p.focus.box) {
        const fb = p.focus.box;
        const bw = fb[2] / 100 * vw, bh = fb[3] / 100 * dh;
        const zf = +p.focus.zoom || clamp(Math.min(vw * 0.82 / Math.max(1, bw), vh * 0.5 / Math.max(1, bh)), 1, 3.2);
        const e = inOut((t - (p.focus.at != null ? +p.focus.at : at + 1.5)) / Math.max(0.2, +p.focus.duration || 1.3));
        const px = (fb[0] + fb[2] / 2) / 100 * vw, py = (fb[1] + fb[3] / 2) / 100 * dh;
        s = 1 + (zf - 1) * e;
        const fx = px + (vw / 2 - px) * e, fy = (py - top) + (vh / 2 - (py - top)) * e;
        tx = fx - px * s;
        ty = fy - py * s;
      }
      doc.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
    });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });
})();
