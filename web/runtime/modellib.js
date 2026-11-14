(function () {
  if (!window.AU_MODEL) return;
  const LIB = {
    dog: {
      name: 'dog', category: 'quadruped', dims: { L: 0.62, leg: 0.3, t: 0.07 },
      palette: { coat: { preset: 'fur', color: '#b07840' }, dark: { preset: 'fur', color: '#3a2a1e' }, belly: { preset: 'fur', color: '#e8cfa6' } },
      parts: [
        { id: 'torso', use: 'torso', with: { len: 'L', chest: 0.27, hip: 0.22, belly: 0.25 }, offset: [0, 'leg', 0], mat: 'coat' },
        { id: 'neck', prim: 'capsule', size: [0.12, 0.2, 0.12], parent: 'torso', self: '-Y', at: [0.5, 0.62, 0.92], rot: [35, 0, 0], mat: 'coat' },
        { id: 'head', use: 'head', with: { w: 0.19, h: 0.18, d: 0.2, snout: 0.12, ears: 'floppy' }, parent: 'neck', self: [0.5, 0.22, 0.3], at: [0.5, 0.8, 0.5], rot: [-35, 0, 0], mat: 'coat', joint: { name: 'neck_nod', type: 'hinge', axis: '+X', range: [-30, 25] } },
        { id: 'leg_front_l', use: 'limb', with: { len: 'leg+0.04', thick: 't', segs: 3, foot: 'paw', bend: 'back' }, parent: 'torso', at: [0.78, 0.25, 0.84], mirror: 'x', mat: 'coat', joint: { name: 'shoulder_l', type: 'hinge', axis: '+X', range: [-45, 45] } },
        { id: 'leg_back_l', use: 'limb', with: { len: 'leg+0.04', thick: 't*1.1', segs: 3, foot: 'paw', bend: 'fwd' }, parent: 'torso', at: [0.78, 0.25, 0.14], mirror: 'x', mat: 'coat', joint: { name: 'hip_l', type: 'hinge', axis: '+X', range: [-45, 45] } },
        { id: 'tail', use: 'tail', with: { len: 0.26, d: 0.04, curl: 0.7 }, parent: 'torso', self: 'center', at: [0.5, 0.78, 0.02], mat: 'dark', joint: { name: 'tail_wag', type: 'hinge', axis: '+Y', range: [-40, 40] } },
        { id: 'collar', prim: 'torus', size: [0.13, 0.025, 0.13], parent: 'neck', self: 'center', at: [0.5, 0.3, 0.5], mat: { preset: 'plastic', color: '#c0302a' } }
      ]
    },
    cat: {
      name: 'cat', category: 'quadruped', dims: { L: 0.46, leg: 0.22, t: 0.05 },
      palette: { coat: { preset: 'fur', color: '#8a8d96' }, dark: { preset: 'fur', color: '#4a4d56' } },
      parts: [
        { id: 'torso', use: 'torso', with: { len: 'L', chest: 0.18, hip: 0.17, belly: 0.19 }, offset: [0, 'leg', 0], mat: 'coat' },
        { id: 'head', use: 'head', with: { w: 0.16, h: 0.14, d: 0.14, snout: 0.03, ears: 'pointy' }, parent: 'torso', self: [0.5, 0.25, 0.25], at: [0.5, 0.82, 0.94], mat: 'coat', joint: { name: 'neck_nod', type: 'hinge', axis: '+X', range: [-25, 25] } },
        { id: 'leg_front_l', use: 'limb', with: { len: 'leg+0.03', thick: 't', segs: 2, foot: 'paw', bend: 'back' }, parent: 'torso', at: [0.75, 0.25, 0.85], mirror: 'x', mat: 'coat', joint: { name: 'shoulder_l', type: 'hinge', axis: '+X', range: [-45, 45] } },
        { id: 'leg_back_l', use: 'limb', with: { len: 'leg+0.03', thick: 't*1.1', segs: 2, foot: 'paw', bend: 'fwd' }, parent: 'torso', at: [0.75, 0.25, 0.12], mirror: 'x', mat: 'coat', joint: { name: 'hip_l', type: 'hinge', axis: '+X', range: [-45, 45] } },
        { id: 'tail', use: 'tail', with: { len: 0.36, d: 0.035, curl: 1.1 }, parent: 'torso', self: 'center', at: [0.5, 0.75, 0.02], mat: 'dark', joint: { name: 'tail_wag', type: 'hinge', axis: '+Y', range: [-30, 30] } }
      ]
    },
    bird: {
      name: 'bird', category: 'bird', dims: { s: 0.18 },
      palette: { body: { preset: 'plastic', color: '#4fa3e0' }, belly: { preset: 'plastic', color: '#ffd24f' }, beak: { preset: 'plastic', color: '#f2a33a' } },
      parts: [
        { id: 'body', prim: 'sphere', size: ['s*1.2', 's', 's*1.5'], offset: [0, 's*0.45', 0], mat: 'body' },
        { id: 'belly', prim: 'sphere', size: ['s', 's*0.8', 's*1.1'], parent: 'body', self: 'center', at: [0.5, 0.4, 0.6], mat: 'belly' },
        { id: 'head', use: 'head', with: { w: 's*0.8', h: 's*0.8', d: 's*0.8' }, parent: 'body', self: '-Y', at: [0.5, 0.82, 0.78], mat: 'body', joint: { name: 'neck_nod', type: 'hinge', axis: '+X', range: [-30, 30] } },
        { id: 'beak', prim: 'cone', size: ['s*0.24', 's*0.36', 's*0.24'], d2: 0, parent: 'head', self: '-Y', at: [0.5, 0.42, 0.96], rot: [90, 0, 0], mat: 'beak' },
        { id: 'wing_l', prim: 'sphere', size: ['s*0.22', 's*0.7', 's*1.1'], parent: 'body', self: [0.2, 0.9, 0.5], at: [0.95, 0.7, 0.5], rot: [0, 0, -30], mirror: 'x', mat: 'body', joint: { name: 'wing_l', type: 'hinge', axis: '+Z', range: [-70, 20] } },
        { id: 'tailfan', prim: 'cone', size: ['s*0.6', 's*0.5', 's*0.16'], d2: 0, parent: 'body', self: '-Y', at: [0.5, 0.55, 0.05], rot: [-110, 0, 0], mat: 'body' },
        { id: 'leg_l', prim: 'cylinder', size: ['s*0.06', 's*0.4', 's*0.06'], parent: 'body', self: '+Y', at: [0.62, 0.12, 0.55], mirror: 'x', mat: 'beak' },
        { id: 'foot_l', prim: 'box', size: ['s*0.16', 's*0.04', 's*0.22'], parent: 'leg_l', self: '+Y', at: '-Y', mirror: 'x', mat: 'beak' }
      ]
    },
    car: {
      name: 'car', category: 'vehicle', dims: { W: 1.8, L: 4.0, H: 0.7, wd: 0.66 },
      palette: { paint: { preset: 'paint', color: '#d94b3d' }, glass: { preset: 'glass', color: '#9fd4ff' }, trim: { preset: 'chrome', color: '#c9ced6' }, light: { preset: 'emissive', color: '#fff3c4' }, tail: { preset: 'emissive', color: '#ff3b3b' } },
      parts: [
        { id: 'body', prim: 'box', size: ['W', 'H', 'L'], r: 0.18, offset: [0, 'wd*0.42', 0], mat: 'paint' },
        { id: 'cabin', prim: 'box', size: ['W*0.86', 'H*0.85', 'L*0.5'], r: 0.2, parent: 'body', self: '-Y', at: [0.5, 0.92, 0.42], mat: 'paint' },
        { id: 'windshield', prim: 'box', size: ['W*0.8', 'H*0.62', 0.04], r: 0.01, parent: 'cabin', self: 'center', at: [0.5, 0.55, 1.0], rot: [-20, 0, 0], mat: 'glass' },
        { id: 'side_window_l', prim: 'box', size: [0.03, 'H*0.5', 'L*0.4'], r: 0.01, parent: 'cabin', self: 'center', at: [1.0, 0.56, 0.5], mirror: 'x', mat: 'glass' },
        { id: 'wheel_fl', use: 'wheel', with: { d: 'wd', w: 0.24 }, parent: 'body', self: 'center', at: [0.98, 0.1, 0.8], mirror: 'x', joint: { name: 'wheel_fl_spin', type: 'spin', axis: '+X' } },
        { id: 'wheel_bl', use: 'wheel', with: { d: 'wd', w: 0.24 }, parent: 'body', self: 'center', at: [0.98, 0.1, 0.2], mirror: 'x', joint: { name: 'wheel_bl_spin', type: 'spin', axis: '+X' } },
        { id: 'headlight_l', prim: 'sphere', size: [0.26, 0.16, 0.06], parent: 'body', self: 'center', at: [0.8, 0.62, 1.0], mirror: 'x', mat: 'light' },
        { id: 'taillight_l', prim: 'box', size: [0.3, 0.12, 0.04], parent: 'body', self: 'center', at: [0.82, 0.66, 0.0], mirror: 'x', mat: 'tail' },
        { id: 'bumper', prim: 'box', size: ['W*0.9', 0.1, 0.12], parent: 'body', self: 'center', at: [0.5, 0.18, 1.0], mat: 'trim' }
      ]
    },
    tree: {
      name: 'tree', category: 'plant', dims: { h: 2.2, r: 0.9 },
      palette: { bark: { preset: 'wood', color: '#6b4a2e' }, leaf: { preset: 'fabric', color: '#4f9a4a' } },
      parts: [
        { id: 'trunk', prim: 'cylinder', size: [0.26, 'h*0.55', 0.26], d2: 0.16, mat: 'bark' },
        { id: 'branch_l', prim: 'cylinder', size: [0.08, 'h*0.22', 0.08], d2: 0.04, parent: 'trunk', self: '-Y', at: [0.6, 0.75, 0.5], rot: [0, 0, -40], mirror: 'x', mat: 'bark' },
        { id: 'crown', use: 'canopy', with: { r: 'r', clumps: 6 }, parent: 'trunk', self: [0.5, 0.15, 0.5], at: '+Y', mat: 'leaf' }
      ]
    },
    house: {
      name: 'house', category: 'building', dims: { W: 4, D: 3.4, H: 2.6 },
      palette: { wall: { preset: 'paint', color: '#f2e3c6' }, roof: { preset: 'paint', color: '#c9503b' }, wood: { preset: 'wood', color: '#7a4a2e' }, glass: { preset: 'glass', color: '#bcd7ea' } },
      parts: [
        { id: 'walls', prim: 'box', size: ['W', 'H', 'D'], r: 0.04, mat: 'wall' },
        { id: 'roof', use: 'roof', with: { type: 'gable', w: 'W', d: 'D', h: 1.5, overhang: 0.3 }, parent: 'walls', self: '-Y', at: '+Y', mat: 'roof' },
        { id: 'door', prim: 'box', size: [0.9, 1.9, 0.08], r: 0.03, parent: 'walls', self: '-Y-Z', at: [0.62, 0, 1.0], mat: 'wood' },
        { id: 'window_l', prim: 'box', size: [0.8, 0.8, 0.06], r: 0.02, parent: 'walls', self: '-Z', at: [0.22, 0.6, 1.0], mat: 'glass' },
        { id: 'window_frame', prim: 'box', size: [0.9, 0.08, 0.1], r: 0.01, parent: 'window_l', self: '+Y', at: '-Y', mat: 'wood' },
        { id: 'chimney', prim: 'box', size: [0.45, 1.2, 0.45], r: 0.03, parent: 'walls', self: '-Y', at: [0.78, 0.9, 0.35], mat: { preset: 'paint', color: '#a35b45' } },
        { id: 'step', prim: 'box', size: [1.3, 0.14, 0.5], r: 0.02, parent: 'walls', self: '-Y-Z', at: [0.62, 0, 1.0], offset: [0, 0, 0.0], mat: { preset: 'paint', color: '#b9b4a8' } }
      ]
    },
    chair: {
      name: 'chair', category: 'furniture', dims: { s: 0.45, h: 0.45 },
      palette: { wood: { preset: 'wood', color: '#a2693f' }, seat: { preset: 'fabric', color: '#d94b3d' } },
      parts: [
        { id: 'seat', prim: 'box', size: ['s', 0.06, 's'], r: 0.015, offset: [0, 'h', 0], mat: 'seat' },
        { id: 'leg_front_l', prim: 'cylinder', size: [0.045, 'h', 0.045], parent: 'seat', self: '+Y', at: [0.9, 0, 0.9], mirror: 'x', mat: 'wood' },
        { id: 'leg_back_l', prim: 'cylinder', size: [0.045, 'h', 0.045], parent: 'seat', self: '+Y', at: [0.9, 0, 0.1], mirror: 'x', mat: 'wood' },
        { id: 'post_l', prim: 'cylinder', size: [0.04, 's*1.0', 0.04], parent: 'seat', self: '-Y', at: [0.9, 1, 0.08], mirror: 'x', mat: 'wood' },
        { id: 'back', prim: 'box', size: ['s*0.95', 's*0.45', 0.04], r: 0.015, parent: 'seat', self: '-Y', at: [0.5, 1, 0.06], offset: [0, 's*0.45', 0], mat: 'wood' }
      ]
    },
    table: {
      name: 'table', category: 'furniture', dims: { w: 1.2, d: 0.7, h: 0.74 },
      palette: { wood: { preset: 'wood', color: '#8a5a32' } },
      parts: [
        { id: 'top', prim: 'box', size: ['w', 0.05, 'd'], r: 0.015, offset: [0, 'h', 0], mat: 'wood' },
        { id: 'leg_front_l', prim: 'box', size: [0.06, 'h', 0.06], r: 0.01, parent: 'top', self: '+Y', at: [0.93, 0, 0.9], mirror: 'x', mat: 'wood' },
        { id: 'leg_back_l', prim: 'box', size: [0.06, 'h', 0.06], r: 0.01, parent: 'top', self: '+Y', at: [0.93, 0, 0.1], mirror: 'x', mat: 'wood' }
      ]
    },
    'desk-lamp': {
      name: 'desk_lamp', category: 'prop', dims: { arm: 0.32, rod: 0.022 },
      palette: { body: { preset: 'paint', color: '#2f6f8f' }, steel: { preset: 'chrome', color: '#c9ced6' } },
      parts: [
        { id: 'base', prim: 'cylinder', size: [0.2, 0.035, 0.2], mat: 'body' },
        { id: 'knuckle', prim: 'sphere', size: [0.045, 0.045, 0.045], parent: 'base', self: 'center', at: '+Y', mat: 'steel' },
        { id: 'arm_low', prim: 'cylinder', size: ['rod', 'arm', 'rod'], parent: 'knuckle', self: '-Y', at: 'center', rot: [-25, 0, 0], mat: 'body', joint: { name: 'shoulder', type: 'hinge', axis: '+X', range: [-60, 40] } },
        { id: 'elbow', prim: 'sphere', size: [0.04, 0.04, 0.04], parent: 'arm_low', self: 'center', at: '+Y', mat: 'steel' },
        { id: 'arm_up', prim: 'cylinder', size: ['rod', 'arm', 'rod'], parent: 'elbow', self: '-Y', at: 'center', rot: [70, 0, 0], mat: 'body', joint: { name: 'elbow', type: 'hinge', axis: '+X', range: [-80, 60] } },
        { id: 'shade', prim: 'cone', size: [0.18, 0.16, 0.18], d2: 0.05, shell: 0.004, open: '-Y', parent: 'arm_up', self: '+Y', at: '+Y', rot: [-80, 0, 0], mat: 'body', joint: { name: 'tilt', type: 'hinge', axis: '+X', range: [-45, 45] } },
        { id: 'bulb', prim: 'sphere', size: [0.06, 0.06, 0.06], parent: 'shade', self: 'center', at: [0.5, 0.25, 0.5], mat: { preset: 'emissive', color: '#fff1c8' } }
      ]
    },
    sofa: {
      name: 'sofa', category: 'furniture', dims: { w: 2.0, d: 0.9 },
      palette: { cloth: { preset: 'fabric', color: '#d8a23a' }, cushion: { preset: 'fabric', color: '#c9572f' }, wood: { preset: 'wood', color: '#5a3a24' } },
      parts: [
        { id: 'base', prim: 'box', size: ['w', 0.42, 'd'], r: 0.08, offset: [0, 0.08, 0], mat: 'cloth' },
        { id: 'back', prim: 'box', size: ['w', 0.5, 0.22], r: 0.08, parent: 'base', self: '-Y-Z', at: [0.5, 1, 0], mat: 'cloth' },
        { id: 'arm_l', prim: 'box', size: [0.22, 0.3, 'd'], r: 0.08, parent: 'base', self: '-Y', at: [0.95, 1, 0.5], offset: [0, -0.02, 0], mirror: 'x', mat: 'cloth' },
        { id: 'cushion_l', prim: 'box', size: ['w*0.4', 0.12, 'd*0.7'], r: 0.05, parent: 'base', self: '-Y', at: [0.72, 1, 0.58], mirror: 'x', mat: 'cushion' },
        { id: 'foot_front_l', prim: 'cylinder', size: [0.06, 0.08, 0.06], parent: 'base', self: '+Y', at: [0.94, 0, 0.9], mirror: 'x', mat: 'wood' },
        { id: 'foot_back_l', prim: 'cylinder', size: [0.06, 0.08, 0.06], parent: 'base', self: '+Y', at: [0.94, 0, 0.1], mirror: 'x', mat: 'wood' }
      ]
    }
  };
  window.AU_MODEL.LIBRARY = LIB;

  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  reg.define('model-spec', {
    category: '3d', description: 'A 3D model generated from a ModelSpec: a JSON list of named parts (box, cylinder, cone, sphere, capsule, torus, lathe, loft, tube, gable) attached to each other by anchors, with templates (head, torso, limb, tail, wheel, roof, canopy, eye), mirroring, named joints and materials. Use a library model by name (' + Object.keys(LIB).join(', ') + ') or write your own spec for any character, animal, vehicle, building, furniture or prop. Validation rejects single-blob models and floating parts. Animate with walk, run, wag, nod, flap, spin or a named joint.',
    params: {
      at: { type: 'number', default: 0 }, model: { type: 'string', default: '', doc: 'library model name' }, spec: { type: 'object', default: null, doc: 'a ModelSpec object (see the procedural-3d-world skill)' },
      look: { type: 'enum', default: 'lowpoly', options: ['lowpoly', 'felt', 'clay', 'toy', 'paper'] }, h: { type: 'number', default: 70, doc: 'viewport height in % of frame' },
      yaw: { type: 'number', default: -30 }, pitch: { type: 'number', default: 12 }, spin: { type: 'number', default: 0, doc: 'turntable degrees per second' }, orbit: { type: 'number', default: 20 },
      zoom: { type: 'number', default: 1.05 }, enter: { type: 'enum', default: 'pop', options: ['pop', 'rise', 'none'] }, colors: { type: 'object', default: null, doc: 'palette overrides {name: "#hex"}' },
      actions: { type: 'array', default: [], doc: '[{do: walk|run|wag|nod|flap|spin|joint, at, duration, joint, to, amount}]' }
    },
    example: "component('model-spec', { model: 'dog', x: 20, y: 15, w: 60, h: 70, actions: [{ do: 'walk', at: 0, duration: 3 }, { do: 'wag', at: 3, duration: 2 }] })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-modelspec', { x: 15, y: 12, w: 70 });
    el.style.height = p.h + '%';
    const { at, end } = h.span(p);
    let spec = p.spec || LIB[p.model];
    if (!spec) throw new Error(`model-spec: unknown model "${p.model}"; use one of ${Object.keys(LIB).join(', ')} or pass a spec`);
    if (p.colors) {
      spec = JSON.parse(JSON.stringify(spec));
      spec.palette = spec.palette || {};
      Object.entries(p.colors).forEach(([k, v]) => { spec.palette[k] = Object.assign({}, spec.palette[k] || {}, { color: v }); });
    }
    ctx.three(el, (g) => {
      const T = g.THREE;
      const model = window.AU_MODEL.build(T, spec, { look: p.look });
      model.report.errors.forEach((e) => { throw new Error('model spec: ' + e); });
      model.report.warnings.forEach((w) => console.warn('model spec: ' + w));
      const pivot = new T.Group();
      pivot.add(model.root);
      g.scene.add(pivot);
      const size = model.size;
      const radius = Math.max(size.x, size.y, size.z) * 0.75;
      const shadowCv = document.createElement('canvas'); shadowCv.width = shadowCv.height = 128;
      const sx = shadowCv.getContext('2d'); const gr = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
      const shadow = new T.Mesh(new T.PlaneGeometry(Math.max(size.x, size.z) * 1.6, Math.max(size.x, size.z) * 1.6), new T.MeshBasicMaterial({ map: new T.CanvasTexture(shadowCv), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001;
      g.scene.add(shadow);
      return (t) => {
        const k = Math.max(0, Math.min(1, (t - at) / Math.max(0.1, end - at)));
        const e = Math.max(0, Math.min(1, (t - at) / 0.6));
        const ee = 1 - Math.pow(1 - e, 3);
        pivot.rotation.y = (p.yaw + p.spin * Math.max(0, t - at)) * Math.PI / 180;
        pivot.scale.setScalar(p.enter === 'pop' ? 0.3 + 0.7 * ee + Math.sin(ee * Math.PI) * 0.05 : 1);
        pivot.position.y = p.enter === 'rise' ? (1 - ee) * -size.y : 0;
        const acts = (p.actions || []).map((a) => (a.do === 'flap' ? Object.assign({}, a, { do: 'joint-flap' }) : a));
        window.AU_MODEL.animate(model, t, acts.filter((a) => a.do !== 'joint-flap'));
        acts.filter((a) => a.do === 'joint-flap' && t >= (+a.at || 0) && t <= (+a.at || 0) + (+a.duration || 1)).forEach(() => {
          Object.entries(model.joints).forEach(([n, j]) => { if (/wing/.test(n)) { const v = Math.sin(t * 22) * 45; j.node.rotation.z = j.node.userData.rest.z + (/_r$/.test(n) ? -v : v) * Math.PI / 180; } });
        });
        const orbit = (p.orbit * (k - 0.5)) * Math.PI / 180;
        const dist = (radius * 3.1 + 0.2) / (1 + (p.zoom - 1) * k);
        const pitch = p.pitch * Math.PI / 180;
        const lookY = size.y * 0.45;
        g.camera.position.set(Math.sin(orbit) * dist * Math.cos(pitch), lookY + Math.sin(pitch) * dist, Math.cos(orbit) * dist * Math.cos(pitch));
        g.camera.near = Math.max(0.005, radius * 0.02);
        g.camera.updateProjectionMatrix();
        g.camera.lookAt(0, lookY, 0);
        el.style.opacity = t < at ? '0' : '1';
      };
    }, { transparent: true });
    h.exitOut(p, el, end, { y: 0, scale: 0.9 });
    return { el, end };
  });
})();
