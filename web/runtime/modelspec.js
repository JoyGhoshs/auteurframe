(function () {
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CREATURES = new Set(['biped', 'quadruped', 'bird', 'fish']);
  const MIN_PARTS = { biped: 10, quadruped: 10, bird: 7, fish: 5, vehicle: 8, building: 6, furniture: 4, prop: 3, plant: 3 };
  const PRESET = {
    skin: { rough: 0.8 }, fur: { rough: 0.95 }, fabric: { rough: 1 }, wood: { rough: 0.85 }, paint: { rough: 0.5 }, metal: { metal: true, rough: 0.4 },
    chrome: { metal: true, rough: 0.12 }, plastic: { rough: 0.35 }, glossy: { rough: 0.2 }, rubber: { rough: 0.95 }, glass: { glass: true }, emissive: { emissive: true }
  };

  function evalExpr(v, dims, where) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return 0;
    const src = String(v);
    let i = 0;
    const peek = () => src[i];
    const skip = () => { while (src[i] === ' ') i++; };
    const num = () => {
      skip();
      if (peek() === '(') { i++; const x = expr(); skip(); if (src[i] !== ')') throw new Error('missing )'); i++; return x; }
      if (peek() === '-') { i++; return -num(); }
      const m = /^(\d+(?:\.\d+)?|\.\d+)/.exec(src.slice(i));
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      const n = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (n) { i += n[0].length; if (!(n[0] in dims)) throw new Error(`unknown dim "${n[0]}"`); return dims[n[0]]; }
      throw new Error(`cannot read "${src.slice(i, i + 8)}"`);
    };
    const term = () => { let x = num(); for (;;) { skip(); if (peek() === '*') { i++; x *= num(); } else if (peek() === '/') { i++; x /= num(); } else return x; } };
    const expr = () => { let x = term(); for (;;) { skip(); if (peek() === '+') { i++; x += term(); } else if (peek() === '-') { i++; x -= term(); } else return x; } };
    try {
      const out = expr();
      skip();
      if (i < src.length) throw new Error(`unexpected "${src.slice(i)}"`);
      if (!isFinite(out)) throw new Error('not a finite number');
      return out;
    } catch (e) { throw new Error(`${where}: ${e.message} in "${src}"`); }
  }

  function anchor(box, a) {
    const min = box.min, max = box.max;
    const c = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    if (Array.isArray(a)) return [min.x + (max.x - min.x) * a[0], min.y + (max.y - min.y) * a[1], min.z + (max.z - min.z) * a[2]];
    const p = [c.x, c.y, c.z];
    if (!a || a === 'center') return p;
    const re = /([+-])([XYZ])/g;
    let m;
    while ((m = re.exec(a))) {
      const k = 'XYZ'.indexOf(m[2]);
      p[k] = m[1] === '+' ? [max.x, max.y, max.z][k] : [min.x, min.y, min.z][k];
    }
    return p;
  }

  function mirrorAnchor(a) {
    if (Array.isArray(a)) return [1 - a[0], a[1], a[2]];
    if (typeof a === 'string') return a.replace(/([+-])X/, (s, sign) => (sign === '+' ? '-X' : '+X'));
    return a;
  }

  function loftGeometry(T, stations, seg) {
    const M = seg || 20;
    const pos = [], idx = [];
    const ring = (z, w, h, n, dy) => {
      const pts = [];
      for (let k = 0; k < M; k++) {
        const t = k / M * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
        const e = 2 / Math.max(1.2, n || 2.4);
        pts.push([Math.sign(ct) * Math.pow(Math.abs(ct), e) * w / 2, (dy || 0) + Math.sign(st) * Math.pow(Math.abs(st), e) * h / 2, z]);
      }
      return pts;
    };
    const rings = stations.map((s) => ring(s[0], s[1], s[2], s[3], s[4]));
    rings.forEach((r) => r.forEach((p) => pos.push(p[0], p[1], p[2])));
    for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < M; k++) {
      const a = r * M + k, b = r * M + (k + 1) % M, c = (r + 1) * M + k, d = (r + 1) * M + (k + 1) % M;
      idx.push(a, c, b, b, c, d);
    }
    [0, rings.length - 1].forEach((r, j) => {
      const s = stations[r];
      const center = pos.length / 3;
      pos.push(0, s[4] || 0, s[0]);
      for (let k = 0; k < M; k++) {
        const a = r * M + k, b = r * M + (k + 1) % M;
        if (j === 0) idx.push(center, a, b); else idx.push(center, b, a);
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function gableGeometry(T, w, h, d) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.lineTo(-w / 2, 0);
    const g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  }

  function geometry(T, W3D, part, look) {
    const [w, h, d] = part._size;
    const lp = look === 'lowpoly' || look === 'paper';
    const seg = lp ? 8 : 20;
    switch (part.prim) {
      case 'box': return W3D.roundBox(T, w, h, d, Math.min(part._r != null ? part._r : Math.min(w, h, d) * (lp ? 0.12 : 0.22), Math.min(w, h, d) / 2 - 1e-4), lp ? 2 : 5);
      case 'cylinder': case 'cone': {
        const top = part.prim === 'cone' ? (part._d2 || 0) / 2 : (part._d2 != null ? part._d2 / 2 : w / 2);
        const g = new T.CylinderGeometry(top, w / 2, h, lp ? 10 : 28, 1, !!part.shell);
        if (d && w && Math.abs(d - w) > 1e-6) g.scale(1, 1, d / w);
        if (part.open === '-Y') g.rotateX(Math.PI);
        return g;
      }
      case 'sphere': { const g = lp ? new T.IcosahedronGeometry(0.5, 1) : new T.SphereGeometry(0.5, 28, 20); g.scale(w, h, d); return g; }
      case 'capsule': { const r = Math.min(w, d) / 2; const g = new T.CapsuleGeometry(r, Math.max(0.0001, h - 2 * r), lp ? 4 : 8, lp ? 8 : 16); g.scale(w / (2 * r), 1, d / (2 * r)); return g; }
      case 'torus': { const tube = Math.max(0.002, h / 2); const g = new T.TorusGeometry(Math.max(tube, w / 2 - tube), tube, lp ? 6 : 12, lp ? 14 : 32); g.rotateX(Math.PI / 2); if (d && w) g.scale(1, 1, d / w); return g; }
      case 'lathe': { const pts = (part.profile || [[0, 0], [w / 2, 0], [w / 2, h], [0, h]]).map((p) => new T.Vector2(Math.max(0, p[0]), p[1])); return new T.LatheGeometry(pts, lp ? 10 : 32); }
      case 'loft': return loftGeometry(T, part._stations || [[-d / 2, w, h, 2.4], [d / 2, w, h, 2.4]], lp ? 10 : 22);
      case 'tube': {
        const pts = (part._path || [[0, 0, 0], [0, h, 0]]).map((p) => new T.Vector3(p[0], p[1], p[2]));
        return new T.TubeGeometry(new T.CatmullRomCurve3(pts), lp ? 12 : 32, Math.max(0.002, (part._r || w / 2)), lp ? 6 : 12, false);
      }
      case 'gable': return gableGeometry(T, w, h, d);
      default: throw new Error(`part "${part.id}": unknown prim "${part.prim}"`);
    }
  }

  function expandTemplates(parts) {
    const out = [];
    parts.forEach((p) => {
      if (!p.use) { out.push(p); return; }
      const w = p.with || {};
      const base = Object.assign({}, p);
      delete base.use; delete base.with;
      const id = p.id, mat = p.mat;
      const sub = (o) => out.push(Object.assign({ mat }, o));
      if (p.use === 'torso') {
        const len = w.len || 0.5, chest = w.chest || 0.24, hip = w.hip || chest * 0.85, belly = w.belly || chest * 1.05, axis = w.axis || 'z';
        if (axis === 'y') out.push(Object.assign(base, { prim: 'loft', stations: [[0, hip, hip * 0.8, 2.6], [`${len}*0.35`, belly, belly * 0.85, 2.6], [`${len}*0.8`, chest, chest * 0.8, 2.6], [len, `${chest}*0.7`, `${chest}*0.6`, 2.6]], rot: base.rot || [-90, 0, 0] }));
        else out.push(Object.assign(base, { prim: 'loft', stations: [[0, hip, hip, 2.6], [`${len}*0.35`, belly, belly, 2.6], [`${len}*0.75`, chest, chest, 2.6], [len, `${chest}*0.8`, `${chest}*0.85`, 2.6]] }));
      } else if (p.use === 'head') {
        const W = w.w || 0.2, H = w.h || 0.2, D = w.d || 0.2, snout = w.snout || 0;
        out.push(Object.assign(base, { prim: 'sphere', size: [W, H, D] }));
        if (snout) {
          sub({ id: id + '_snout', prim: 'capsule', size: [`${W}*0.55`, snout, `${H}*0.5`], parent: id, self: '-Y', at: [0.5, 0.36, 0.85], rot: [90, 0, 0] });
          sub({ id: id + '_nose', prim: 'sphere', size: [`${W}*0.2`, `${H}*0.14`, `${W}*0.16`], parent: id + '_snout', self: 'center', at: '+Y', mat: { preset: 'glossy', color: '#1d1a1f' } });
        }
        const ey = snout ? 0.66 : 0.58, ez = snout ? 0.86 : 0.9;
        sub({ id: id + '_eye_l', prim: 'sphere', size: [`${W}*0.2`, `${W}*0.2`, `${W}*0.12`], parent: id, self: 'center', at: [0.68, ey, ez], mat: { preset: 'glossy', color: '#fbfaf6' }, mirror: 'x' });
        sub({ id: id + '_pupil_l', prim: 'sphere', size: [`${W}*0.1`, `${W}*0.1`, `${W}*0.06`], parent: id + '_eye_l', self: 'center', at: [0.5, 0.5, 0.95], mat: { preset: 'glossy', color: '#141114' }, mirror: 'x' });
        const ears = w.ears || 'none';
        if (ears === 'floppy') sub({ id: id + '_ear_l', prim: 'sphere', size: [`${W}*0.18`, `${H}*0.62`, `${D}*0.42`], parent: id, self: '+Y', at: [0.95, 0.86, 0.5], rot: [0, 0, 22], mirror: 'x', joint: { name: id + '_ear_flop_l', type: 'hinge', axis: '+Z', range: [-20, 30] } });
        else if (ears === 'pointy') sub({ id: id + '_ear_l', prim: 'cone', size: [`${W}*0.32`, `${H}*0.42`, `${D}*0.16`], d2: 0, parent: id, self: '-Y', at: [0.75, 0.88, 0.45], rot: [0, 0, -14], mirror: 'x' });
        else if (ears === 'round') sub({ id: id + '_ear_l', prim: 'sphere', size: [`${W}*0.34`, `${W}*0.34`, `${D}*0.12`], parent: id, self: '-Y', at: [0.8, 0.85, 0.45], mirror: 'x' });
        else if (ears === 'long') sub({ id: id + '_ear_l', prim: 'capsule', size: [`${W}*0.22`, `${H}*1.1`, `${D}*0.1`], parent: id, self: '-Y', at: [0.68, 0.9, 0.45], rot: [0, 0, -8], mirror: 'x' });
      } else if (p.use === 'limb') {
        const len = w.len || 0.3, thick = w.thick || 0.06, segs = Math.max(1, Math.min(3, w.segs || 2)), bend = w.bend === 'fwd' ? 1 : -1;
        const segLen = `(${len})/${segs}`;
        out.push(Object.assign(base, { prim: 'capsule', size: [thick, `${segLen}+${thick}*0.5`, thick], self: base.self || '+Y' }));
        let prev = id;
        for (let k = 2; k <= segs; k++) {
          const sid = id + '_' + k;
          sub({ id: sid, prim: 'capsule', size: [`${thick}*${(1 - k * 0.08).toFixed(2)}`, `${segLen}+${thick}*0.5`, `${thick}*${(1 - k * 0.08).toFixed(2)}`], parent: prev, self: '+Y', at: [0.5, 0.06, 0.5],
            joint: { name: sid.replace(/_l$|_r$/, '') + '_bend' + (id.endsWith('_l') ? '_l' : id.endsWith('_r') ? '_r' : ''), type: 'hinge', axis: '+X', range: bend > 0 ? [-5, 90] : [-90, 5] } });
          prev = sid;
        }
        const foot = w.foot || 'paw';
        if (foot === 'paw') sub({ id: id + '_foot', prim: 'sphere', size: [`${thick}*1.35`, `${thick}*0.8`, `${thick}*1.7`], parent: prev, self: [0.5, 0.2, 0.3], at: [0.5, 0, 0.5] });
        else if (foot === 'hoof') sub({ id: id + '_foot', prim: 'cylinder', size: [`${thick}*1.2`, `${thick}*0.7`, `${thick}*1.2`], parent: prev, self: '+Y', at: '-Y', mat: { preset: 'rubber', color: '#2b2420' } });
        else if (foot === 'shoe') sub({ id: id + '_foot', prim: 'box', size: [`${thick}*1.3`, `${thick}*0.8`, `${thick}*2.2`], parent: prev, self: [0.5, 0.6, 0.25], at: [0.5, 0, 0.5], mat: { preset: 'rubber', color: '#2b2420' } });
        else if (foot === 'hand') sub({ id: id + '_foot', prim: 'sphere', size: [`${thick}*1.4`, `${thick}*1.4`, `${thick}*1.2`], parent: prev, self: '+Y', at: [0.5, 0.1, 0.5] });
      } else if (p.use === 'tail') {
        const len = w.len || 0.25, dd = w.d || 0.04, curl = w.curl != null ? w.curl : 0.5;
        out.push(Object.assign(base, { prim: 'tube', r: `${dd}/2`, path: [[0, 0, 0], [0, `${len}*0.35*${curl}`, `-${len}*0.45`], [0, `${len}*0.8*${curl}`, `-${len}*0.8`], [0, `${len}*1.1*${curl}`, `-${len}*0.85`]] }));
      } else if (p.use === 'wheel') {
        const dd = w.d || 0.5, ww = w.w || 0.18;
        out.push(Object.assign(base, { prim: 'torus', size: [dd, ww, dd], rot: [0, 0, 90], mat: base.mat || { preset: 'rubber', color: '#222226' }, joint: base.joint || { name: id + '_spin', type: 'spin', axis: '+Y' } }));
        sub({ id: id + '_hub', prim: 'cylinder', size: [`${dd}*0.55`, `${ww}*0.9`, `${dd}*0.55`], parent: id, self: 'center', at: 'center', mat: { preset: 'chrome', color: '#c9ced6' } });
      } else if (p.use === 'roof') {
        const kind = w.type || 'gable', W = w.w || 4, D = w.d || 3, H = w.h || 1.6, over = w.overhang || 0.25;
        if (kind === 'flat') out.push(Object.assign(base, { prim: 'box', size: [`${W}+${over}*2`, 0.2, `${D}+${over}*2`] }));
        else if (kind === 'hip') out.push(Object.assign(base, { prim: 'cone', size: [`(${W}+${over}*2)*1.42`, H, `(${D}+${over}*2)*1.42`], d2: 0 }));
        else out.push(Object.assign(base, { prim: 'gable', size: [`${W}+${over}*2`, H, `${D}+${over}*2`] }));
      } else if (p.use === 'canopy') {
        const r = w.r || 1, n = Math.max(3, Math.min(9, w.clumps || 5));
        out.push(Object.assign(base, { prim: 'sphere', size: [`${r}*1.3`, `${r}*1.15`, `${r}*1.3`] }));
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2;
          sub({ id: `${id}_c${k}`, prim: 'sphere', size: [`${r}*0.75`, `${r}*0.7`, `${r}*0.75`], parent: id, self: 'center', at: [+(0.5 + Math.cos(a) * 0.42).toFixed(3), +(0.42 + (k % 2) * 0.22).toFixed(3), +(0.5 + Math.sin(a) * 0.42).toFixed(3)] });
        }
      } else if (p.use === 'eye') {
        const dd = w.d || 0.05;
        out.push(Object.assign(base, { prim: 'sphere', size: [dd, dd, dd * 0.6], mat: base.mat || { preset: 'glossy', color: '#fbfaf6' } }));
        sub({ id: id + '_pupil', prim: 'sphere', size: [`${dd}*0.5`, `${dd}*0.5`, `${dd}*0.3`], parent: id, self: 'center', at: [0.5, 0.5, 0.95], mat: { preset: 'glossy', color: '#141114' } });
      } else {
        throw new Error(`part "${id}": unknown template "${p.use}"`);
      }
    });
    return out;
  }

  function expandMirror(parts) {
    const byId = new Map(parts.map((p) => [p.id, p]));
    const children = new Map();
    parts.forEach((p) => { if (p.parent) { if (!children.has(p.parent)) children.set(p.parent, []); children.get(p.parent).push(p); } });
    const out = parts.slice();
    const rename = (id) => (/_l$/.test(id) ? id.replace(/_l$/, '_r') : /_l_/.test(id) ? id.replace(/_l_/, '_r_') : id + '_r');
    const done = new Set();
    parts.forEach((p) => {
      if (p.mirror !== 'x' || done.has(p.id)) return;
      if (p.parent && byId.get(p.parent) && byId.get(p.parent).mirror === 'x') return;
      const map = new Map();
      const copy = (q, isRoot) => {
        const c = JSON.parse(JSON.stringify(q));
        c.id = rename(q.id);
        map.set(q.id, c.id);
        delete c.mirror;
        if (!isRoot && map.has(q.parent)) c.parent = map.get(q.parent);
        if (isRoot) {
          c.at = mirrorAnchor(q.at);
          if (Array.isArray(c.offset)) c.offset = [typeof c.offset[0] === 'number' ? -c.offset[0] : `-(${c.offset[0]})`, c.offset[1], c.offset[2]];
        } else {
          c.at = mirrorAnchor(q.at);
        }
        c.self = mirrorAnchor(q.self);
        if (Array.isArray(c.rot)) c.rot = [c.rot[0], -c.rot[1], -c.rot[2]];
        if (c.joint && c.joint.name) c.joint.name = rename(c.joint.name.replace(/_r$/, '_l'));
        out.push(c);
        done.add(q.id);
        (children.get(q.id) || []).forEach((k) => copy(k, false));
      };
      copy(p, true);
    });
    return out;
  }

  function resolve(spec) {
    const dims = {};
    Object.entries(spec.dims || {}).forEach(([k, v]) => { dims[k] = evalExpr(v, dims, `dims.${k}`); });
    let parts = expandTemplates(spec.parts || []);
    parts = expandMirror(parts);
    parts.forEach((p) => {
      const where = `part "${p.id}"`;
      p._size = (p.size || [0.1, 0.1, 0.1]).map((v) => Math.max(0.0005, Math.abs(evalExpr(v, dims, where + ' size'))));
      p._r = p.r != null ? evalExpr(p.r, dims, where + ' r') : null;
      p._d2 = p.d2 != null ? evalExpr(p.d2, dims, where + ' d2') : null;
      p._offset = (p.offset || [0, 0, 0]).map((v) => evalExpr(v, dims, where + ' offset'));
      p._rot = (p.rot || [0, 0, 0]).map((v) => evalExpr(v, dims, where + ' rot'));
      if (p.stations) p._stations = p.stations.map((s) => s.map((v, k) => (k === 3 && typeof v === 'number' ? v : evalExpr(v, dims, where + ' stations'))));
      if (p.path) p._path = p.path.map((pt) => pt.map((v) => evalExpr(v, dims, where + ' path')));
    });
    return { dims, parts };
  }

  function material(kit, mat, palette, look) {
    let m = mat;
    if (typeof m === 'string') m = palette[m] || { color: m.startsWith('#') ? m : '#c9c3b8' };
    m = m || { color: '#c9c3b8' };
    const pr = PRESET[m.preset] || {};
    const color = m.color || '#c9c3b8';
    if (pr.glass) return kit.mat(color, { glass: true, opacity: 0.4 });
    if (pr.emissive) return kit.mat(color, { emissive: color, intensity: 2 });
    if (pr.metal && look !== 'felt' && look !== 'clay') return kit.mat(color, { metal: true, rough: pr.rough });
    return kit.mat(color);
  }

  function build(T, spec, opts) {
    const W3D = window.AU_W3D;
    const o = opts || {};
    const look = o.look || 'lowpoly';
    const kit = o.kit || W3D.makeKit(T, look, o.seed || 7);
    const report = { errors: [], warnings: [] };
    if (!spec || typeof spec !== 'object') throw new Error('model spec must be an object');
    const { parts } = resolve(spec);
    const ids = new Set();
    parts.forEach((p) => {
      if (!/^[a-z][a-z0-9_]*$/.test(p.id || '')) report.errors.push(`part id "${p.id}" must be lower-case letters, digits and _`);
      if (ids.has(p.id)) report.errors.push(`duplicate part id "${p.id}"`);
      ids.add(p.id);
    });
    parts.forEach((p) => { if (p.parent && !ids.has(p.parent)) report.errors.push(`part "${p.id}" has unknown parent "${p.parent}"`); });
    const roots = parts.filter((p) => !p.parent);
    if (!roots.length) report.errors.push('no root part (a part without parent)');
    const root = new T.Group();
    root.name = spec.name || 'model';
    const nodes = {}, joints = {}, sockets = {};
    const palette = spec.palette || {};
    const pending = new Map();
    parts.forEach((p) => { const k = p.parent || ''; if (!pending.has(k)) pending.set(k, []); pending.get(k).push(p); });
    const place = (p, parentBody, parentBox) => {
      const geo = geometry(T, W3D, p, look);
      geo.computeBoundingBox();
      const box = geo.boundingBox;
      const mesh = new T.Mesh(geo, material(kit, p.mat, palette, look));
      mesh.castShadow = true; mesh.receiveShadow = true;
      const pivot = new T.Group();
      pivot.name = p.id;
      const at = parentBox ? anchor(parentBox, p.at || 'center') : [0, 0, 0];
      pivot.position.set(at[0] + p._offset[0], at[1] + p._offset[1], at[2] + p._offset[2]);
      pivot.rotation.set(p._rot[0] * DEG, p._rot[1] * DEG, p._rot[2] * DEG);
      pivot.userData.rest = pivot.rotation.clone();
      const self = anchor(box, p.self || (parentBox ? 'center' : '-Y'));
      const body = new T.Group();
      body.position.set(-self[0], -self[1], -self[2]);
      body.add(mesh);
      pivot.add(body);
      parentBody.add(pivot);
      nodes[p.id] = { pivot, body, mesh, box, part: p };
      if (p.joint && p.joint.name) joints[p.joint.name] = { node: pivot, type: p.joint.type, axis: p.joint.axis || '+X', range: p.joint.range || [-45, 45] };
      Object.entries(p.sockets || {}).forEach(([name, a]) => { const s = new T.Group(); const q = anchor(box, a); s.position.set(q[0], q[1], q[2]); body.add(s); sockets[name] = s; });
      (pending.get(p.id) || []).forEach((c) => place(c, body, box));
    };
    if (!report.errors.length) roots.forEach((r) => place(r, root, null));
    const placed = Object.keys(nodes).length;
    if (!report.errors.length && placed < parts.length) report.errors.push(`${parts.length - placed} parts are not connected to a root (check parent ids for cycles)`);
    root.updateMatrixWorld(true);
    const world = new T.Box3().setFromObject(root);
    if (isFinite(world.min.y)) root.position.y -= world.min.y;
    root.updateMatrixWorld(true);
    const cat = spec.category || 'prop';
    if ((MIN_PARTS[cat] || 3) > placed) report.errors.push(`a ${cat} needs at least ${MIN_PARTS[cat]} parts after templates; this model has ${placed}. Build it from named parts (use the head, torso, limb and tail templates) instead of one shape.`);
    if (CREATURES.has(cat) && placed) {
      const ids = Object.keys(nodes);
      const roots = (re) => ids.filter((id) => re.test(id) && !/_(2|3|foot|hub)$/.test(id) && !/_(2|3|foot)_r$/.test(id)).length;
      if (!ids.some((id) => /head/.test(id))) report.errors.push(`a ${cat} needs a head part (use the head template: { id: 'head', use: 'head', with: { w, h, d, snout, ears } })`);
      if (cat === 'quadruped' && roots(/^leg/) < 4) report.errors.push('a quadruped needs four legs: two limb parts with mirror "x" (front and back), each from the limb template');
      if (cat === 'biped' && (roots(/^leg/) < 2 || roots(/^arm/) < 2)) report.errors.push('a biped needs two legs and two arms: limb templates with mirror "x" named leg_l and arm_l');
      if (cat === 'bird' && ids.filter((id) => /wing/.test(id)).length < 2) report.errors.push('a bird needs two wings: one wing part with mirror "x"');
      const vols = Object.values(nodes).map((n) => { const s = n.box.getSize(new T.Vector3()); return s.x * s.y * s.z; });
      const total = vols.reduce((a, b) => a + b, 0) || 1;
      const big = Math.max(...vols) / total;
      if (big > 0.85) report.errors.push(`one part holds ${Math.round(big * 100)}% of the volume: the model reads as a single blob ("egg"). Split it into a head, torso and limbs with the templates.`);
    }
    const diag = world.getSize(new T.Vector3()).length() || 1;
    Object.values(nodes).forEach((n) => {
      const p = n.part;
      if (!p.parent || !nodes[p.parent]) return;
      const a = new T.Box3().setFromObject(n.mesh), b = new T.Box3().setFromObject(nodes[p.parent].mesh);
      b.expandByScalar(diag * 0.02);
      if (!a.intersectsBox(b)) report.warnings.push(`part "${p.id}" floats away from its parent "${p.parent}"; attach it with self/at anchors instead of offsets`);
    });
    const colors = new Set(Object.values(nodes).map((n) => n.mesh.material.color && n.mesh.material.color.getHexString()));
    if (colors.size < 2) report.warnings.push('the model uses one colour; give parts at least two colours so they read');
    return { root, nodes, joints, sockets, report, size: world.getSize(new T.Vector3()), parts: placed };
  }

  function axisVec(axis) {
    const s = axis && axis[0] === '-' ? -1 : 1;
    const k = (axis || '+X').slice(-1);
    return { k, s };
  }

  function setJoint(j, deg) {
    const { k, s } = axisVec(j.axis);
    const rest = j.node.userData.rest;
    const v = clamp(deg, j.type === 'spin' ? -1e9 : (j.range || [-180, 180])[0], j.type === 'spin' ? 1e9 : (j.range || [-180, 180])[1]) * DEG * s;
    j.node.rotation.set(rest.x + (k === 'X' ? v : 0), rest.y + (k === 'Y' ? v : 0), rest.z + (k === 'Z' ? v : 0));
  }

  function animate(model, t, actions, opts) {
    const o = opts || {};
    const joints = model.joints;
    Object.values(joints).forEach((j) => setJoint(j, 0));
    let moving = null;
    (actions || []).forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1);
      if (t < at || t > end) return;
      const u = t - at;
      const amt = a.amount != null ? +a.amount : 1;
      if (a.do === 'walk' || a.do === 'run') moving = { run: a.do === 'run', u, amt };
      else if (a.do === 'wag') Object.entries(joints).forEach(([n, j]) => { if (/wag|tail/.test(n)) setJoint(j, Math.sin(u * 14) * 35 * amt); });
      else if (a.do === 'nod') Object.entries(joints).forEach(([n, j]) => { if (/neck|nod|head/.test(n)) setJoint(j, Math.sin(u * 8) * 18 * amt); });
      else if (a.do === 'spin') Object.values(joints).forEach((j) => { if (j.type === 'spin') setJoint(j, u * 360 * (a.speed || 1)); });
      else if (a.do === 'joint' && joints[a.joint]) {
        const k = clamp(u / Math.max(0.01, end - at), 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        setJoint(joints[a.joint], (a.from || 0) + ((a.to != null ? a.to : 30) - (a.from || 0)) * (a.hold ? e : Math.sin(k * Math.PI)));
      }
    });
    if (moving) {
      const ph = moving.u * (moving.run ? 12 : 7);
      const amp = (moving.run ? 34 : 22) * moving.amt;
      Object.entries(joints).forEach(([n, j]) => {
        const side = /_r$/.test(n) ? 1 : -1;
        const front = /shoulder|front|arm/.test(n) ? 1 : -1;
        if (/shoulder|hip|leg/.test(n)) setJoint(j, Math.sin(ph) * amp * side * front);
        else if (/bend|knee|elbow/.test(n)) setJoint(j, Math.max(0, Math.sin(ph + (side > 0 ? 0 : Math.PI))) * amp * 1.2 * (j.range && j.range[1] > 10 ? 1 : -1));
        else if (/wag|tail/.test(n)) setJoint(j, Math.sin(ph * 2) * 18);
        else if (j.type === 'spin') setJoint(j, moving.u * 540);
      });
      model.root.position.y = Math.abs(Math.sin(ph)) * 0.02 * (model.size ? model.size.y : 1);
    } else if (o.idle !== false) {
      Object.entries(joints).forEach(([n, j]) => { if (/wag|tail/.test(n)) setJoint(j, Math.sin(t * 3) * 8); });
    }
  }

  window.AU_MODEL = { build, animate, resolve, evalExpr, anchor };
})();
