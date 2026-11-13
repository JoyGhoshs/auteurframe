(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  reg.define('model3d', {
    category: '3d', description: 'Real 3D model (GLB asset, for example imported from Polyfork) rendered with lights and soft shadow. Auto-fits and frames the model, plays its embedded animation clip frame-exactly, and can spin, orbit, float or enter with a rise or pop.',
    params: {
      src: { type: 'string', default: '', doc: 'GLB asset id (use import_model to get one)' }, h: { type: 'number', default: 70, doc: 'viewport height in % of frame' },
      clip: { type: 'string', default: '', doc: 'animation clip name or index to play; empty plays the first clip if any' }, clipSpeed: { type: 'number', default: 1 },
      yaw: { type: 'number', default: -25, doc: 'starting rotation around the vertical axis in degrees' }, pitch: { type: 'number', default: 8, doc: 'camera height angle in degrees' },
      spin: { type: 'number', default: 0, doc: 'degrees per second turntable rotation' }, orbit: { type: 'number', default: 18, doc: 'camera orbit in degrees across the duration' },
      zoom: { type: 'number', default: 1, doc: 'end zoom factor (1.15 pushes in)' }, float: { type: 'number', default: 0, doc: 'gentle bob amplitude (0 to 1)' },
      enter: { type: 'enum', default: 'rise', options: ['rise', 'pop', 'spin', 'none'] }, ground: { type: 'boolean', default: true, doc: 'soft contact shadow' },
      lipsync: { type: 'string', default: '', doc: "'voice' or an audio asset id: drives the model's mouth morph target (jawOpen, mouthOpen, viseme_aa) when it has one, otherwise a subtle talking bob" },
      lipsyncAt: { type: 'number', default: 0 }
    },
    example: "component('model3d', { src: 'as_glb000001', clip: 'Walk', x: 10, y: 10, w: 80, h: 80, spin: 0, orbit: 30 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-model', { x: 10, y: 12, w: 80 });
    el.style.height = p.h + '%';
    const { at, end } = h.span(p);
    const url = ctx.asset(p.src);
    ctx.three(el, (g) => {
      const T = g.THREE;
      const pivot = new T.Group();
      g.scene.add(pivot);
      let shadow = null;
      if (p.ground) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
        shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        g.scene.add(shadow);
      }
      const state = { model: null, mixer: null, action: null, radius: 1.5, height: 2 };
      if (!T.GLTFLoader) { throw new Error('GLTFLoader missing from the three bundle'); }
      ctx.defer(new T.GLTFLoader().loadAsync(url).then((gltf) => {
        const model = gltf.scene;
        model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.colorSpace = T.SRGBColorSpace; } });
        pivot.add(model);
        state.model = model;
        if (gltf.animations && gltf.animations.length) {
          const clips = gltf.animations;
          const want = p.clip === '' || p.clip == null ? clips[0] : (/^\d+$/.test(String(p.clip)) ? clips[+p.clip] : clips.find((c) => c.name === p.clip || c.name.toLowerCase().includes(String(p.clip).toLowerCase())));
          if (want) {
            state.mixer = new T.AnimationMixer(model);
            state.action = state.mixer.clipAction(want);
            state.action.play();
            state.mixer.setTime(0);
          }
          el.setAttribute('data-clips', clips.map((c) => c.name).join(','));
        }
        model.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(model, true);
        const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
        const s = 2.6 / Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.001);
        model.scale.multiplyScalar(s);
        model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
        state.height = size.y * s; state.radius = Math.max(size.x, size.z, size.y) * s * 0.75;
        state.mouths = [];
        model.traverse((o) => {
          if (o.morphTargetDictionary && o.morphTargetInfluences) {
            const key = Object.keys(o.morphTargetDictionary).find((k) => /jawopen|mouthopen|viseme_aa|^aa$|mouth_a$|^a$|v_aa/i.test(k));
            if (key) state.mouths.push([o, o.morphTargetDictionary[key]]);
          }
        });
        if (shadow) shadow.scale.setScalar(Math.max(size.x, size.z) * s * 1.6);
      }));
      return (t) => {
        const k = Math.max(0, Math.min(1, (t - at) / Math.max(0.1, end - at)));
        const yaw = (p.yaw + p.spin * Math.max(0, t - at)) * Math.PI / 180;
        pivot.rotation.y = yaw;
        let enterK = 1;
        if (p.enter !== 'none') { const e = Math.max(0, Math.min(1, (t - at) / 0.8)); enterK = 1 - Math.pow(1 - e, 3); }
        pivot.position.y = (p.enter === 'rise' ? (1 - enterK) * -1.2 : 0) + (p.float ? Math.sin(t * 1.6) * 0.08 * p.float : 0);
        const sc = p.enter === 'pop' ? 0.3 + 0.7 * enterK + Math.sin(enterK * Math.PI) * 0.06 : 1;
        pivot.scale.setScalar(sc);
        if (p.enter === 'spin') pivot.rotation.y += (1 - enterK) * Math.PI * 1.5;
        if (state.mixer) state.mixer.setTime(Math.max(0, t - at) * p.clipSpeed);
        if (p.lipsync && window.AU_SPEECH) {
          if (!state.level) state.level = window.AU_SPEECH(p.lipsync, p.lipsyncAt) || (() => 0);
          const lv = Math.min(1, state.level(t) * 1.1);
          if (state.mouths && state.mouths.length) state.mouths.forEach(([o, i]) => { o.morphTargetInfluences[i] = lv; });
          else pivot.position.y += lv * 0.03;
        }
        const orbit = (p.orbit * (k - 0.5)) * Math.PI / 180;
        const dist = (state.radius * 3.1 + 1.2) / (1 + (p.zoom - 1) * k);
        const pitch = p.pitch * Math.PI / 180;
        const lookY = state.height * 0.45;
        g.camera.position.set(Math.sin(orbit) * dist * Math.cos(pitch), lookY + Math.sin(pitch) * dist, Math.cos(orbit) * dist * Math.cos(pitch));
        g.camera.lookAt(0, lookY, 0);
        if (shadow) { shadow.position.y = 0.002; shadow.material.opacity = t < at ? 0 : enterK; }
        el.style.opacity = t < at ? '0' : '1';
      };
    }, { transparent: true });
    h.exitOut(p, el, end, { y: 0, scale: 0.9 });
    return { el, end };
  });

  reg.define('lottie', {
    category: 'media', description: 'Lottie animation from a JSON asset, seeked frame-exactly with the scene (great for icons, stickers and UI micro-animations).',
    params: { src: { type: 'string', default: '', doc: 'Lottie JSON asset id' }, h: { type: 'number', default: 40 }, speed: { type: 'number', default: 1 }, loop: { type: 'boolean', default: true } },
    example: "component('lottie', { src: 'as_lottie001', x: 35, y: 25, w: 30, h: 40 })"
  }, (ctx, p, h) => {
    const el = h.box(p, 'auc-lottie', { x: 35, y: 25, w: 30 });
    el.style.height = p.h + '%';
    const { at, end } = h.span(p);
    if (!window.lottie) throw new Error('declare data-libs="lottie" on the scene root to use the lottie component');
    const state = { anim: null };
    ctx.defer(fetch(ctx.asset(p.src)).then((r) => r.json()).then((data) => {
      state.anim = window.lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
    }));
    ctx.tl.set(el, { autoAlpha: 0 }, 0);
    ctx.tl.set(el, { autoAlpha: 1 }, at);
    ctx.onFrame((t) => {
      const a = state.anim;
      if (!a || !a.totalFrames) return;
      let f = Math.max(0, t - at) * a.frameRate * p.speed;
      f = p.loop ? f % a.totalFrames : Math.min(a.totalFrames - 1, f);
      a.goToAndStop(f, true);
    });
    h.exitOut(p, el, end, { y: 0 });
    return { el, end };
  });
})();
