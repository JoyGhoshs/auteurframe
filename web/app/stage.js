import { gradePreview, useGrades } from './looktab.js';
import { html, useState, useEffect, useRef, useCallback, Icon, agentColor } from './lib.js';

export function sceneAt(project, t) {
  const scenes = project.scenes || [];
  if (!scenes.length) return null;
  for (const s of scenes) if (t >= s.start && t < s.start + s.duration - 1e-6) return s;
  return t <= 0 ? scenes[0] : scenes[scenes.length - 1];
}

function docUrl(pid, sid, ver, mode) {
  return `/api/projects/${pid}/scenes/${sid}/doc?mode=${mode}&v=${ver || 0}`;
}

function waitReady(frame, cb) {
  let n = 0;
  const tick = () => {
    const w = frame && frame.contentWindow;
    if (w && w.AU && w.__AU_READY) cb(w);
    else if (n++ < 400) setTimeout(tick, 40);
  };
  tick();
}

export function Stage({ project, time, setTime, playing, setPlaying, versions, view, guides, selected, onSelect, onOverride, onLayerPatch, onDropAsset, cursors, agents, browse, progress, previews, agentNames }) {
  const wrap = useRef(null);
  const frames = [useRef(null), useRef(null)];
  const [slots, setSlots] = useState([{ sid: null, ver: 0 }, { sid: null, ver: 0 }]);
  const [active, setActive] = useState(0);
  const [readyKey, setReadyKey] = useState('');
  const [fit, setFit] = useState({ k: 0.4, w: 0, h: 0 });
  const [layers, setLayers] = useState([]);
  const [hover, setHover] = useState(null);
  const [errors, setErrors] = useState([]);
  const drag = useRef(null);
  const timeRef = useRef(time);
  timeRef.current = time;
  const video = useRef(null);
  const segVideo = useRef(null);
  const capFrame = useRef(null);
  const W = project.width, H = project.height;
  const scene = sceneAt(project, time);
  const sid = scene ? scene.id : null;
  const ver = sid ? (versions[sid] || 0) : 0;
  const mode = guides ? 'edit' : 'preview';
  const sceneIds = new Set((project.scenes || []).map((s) => s.id));
  const sceneKey = (project.scenes || []).map((s) => s.id).join(',');

  useEffect(() => {
    if (slots.every((x) => !x.sid || sceneIds.has(x.sid))) return;
    setSlots((cur) => cur.map((x) => (x.sid && !sceneIds.has(x.sid) ? { sid: null, ver: 0 } : x)));
  }, [sceneKey]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 48;
      const k = Math.min((el.clientWidth - pad) / W, (el.clientHeight - pad) / H);
      setFit({ k: Math.max(0.05, k), w: W * k, h: H * k });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  useEffect(() => {
    if (!sid || view === 'master') return;
    const key = sid + ':' + ver + ':' + mode;
    const cur = slots[active];
    if (cur.sid === sid && cur.ver === ver && cur.mode === mode) return;
    const back = 1 - active;
    const b = slots[back];
    if (b.sid === sid && b.ver === ver && b.mode === mode) {
      setActive(back);
      return;
    }
    const next = slots.slice();
    next[back] = { sid, ver, mode };
    setSlots(next);
    void key;
  }, [sid, ver, mode, view]);

  const onFrameLoad = (i) => () => {
    const slot = slots[i];
    waitReady(frames[i].current, (w) => {
      const s = (project.scenes || []).find((x) => x.id === slot.sid);
      if (!s) return;
      const local = Math.max(0, Math.min(s.duration - 0.001, timeRef.current - s.start));
      w.AU.seek(local);
      if (sceneAt(project, timeRef.current)?.id === slot.sid) {
        setActive(i);
        setReadyKey(slot.sid + ':' + slot.ver + ':' + Date.now());
      }
    });
  };

  const win = () => {
    const f = frames[active].current;
    return f && f.contentWindow && f.contentWindow.AU && f.contentWindow.__AU_READY ? f.contentWindow : null;
  };

  useEffect(() => {
    if (view === 'master' || playing) return;
    const w = win();
    if (!w || !scene || slots[active].sid !== scene.id) return;
    w.AU.pause();
    w.AU.seek(Math.max(0, Math.min(scene.duration - 0.001, time - scene.start)));
    const t = setTimeout(() => {
      try {
        setLayers(w.AU.layers());
        setErrors((w.AU.errors || []).slice(0, 3));
      } catch (e) { }
    }, 30);
    return () => clearTimeout(t);
  }, [time, readyKey, playing, view]);

  useEffect(() => {
    if (view !== 'live' || !playing || !scene) return;
    const w = win();
    if (!w || slots[active].sid !== scene.id) return;
    let last = 0;
    const startAt = Math.max(0, time - scene.start);
    w.AU.play({
      from: startAt >= scene.duration - 0.02 ? 0 : startAt,
      onTime: (t) => {
        const now = performance.now();
        if (now - last > 40) { last = now; setTime(scene.start + t); }
        if (t > scene.duration - 1.2) preloadNext(scene);
      },
      onEnd: () => {
        const idx = project.scenes.findIndex((s) => s.id === scene.id);
        const nxt = project.scenes[idx + 1];
        if (nxt) setTime(nxt.start + 0.0001);
        else { setPlaying(false); setTime(scene.start + scene.duration - 0.001); }
      }
    });
    return () => { try { w.AU.pause(); } catch (e) { } };
  }, [playing, readyKey, view, sid, active]);

  const preloadNext = (s) => {
    const idx = project.scenes.findIndex((x) => x.id === s.id);
    const nxt = project.scenes[idx + 1];
    if (!nxt) return;
    const back = 1 - active;
    const nv = versions[nxt.id] || 0;
    setSlots((cur) => (cur[back].sid === nxt.id && cur[back].ver === nv ? cur : cur.map((x, i) => (i === back ? { sid: nxt.id, ver: nv, mode } : x))));
  };

  useEffect(() => {
    const v = video.current;
    if (!v || view !== 'master') return;
    if (playing) v.play().catch(() => setPlaying(false)); else v.pause();
  }, [playing, view]);
  useEffect(() => {
    const v = segVideo.current;
    if (!v || view !== 'scene' || !scene) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else { v.pause(); const lt = Math.max(0, time - scene.start); if (Math.abs(v.currentTime - lt) > 0.05) v.currentTime = lt; }
  }, [playing, view, time, sid]);
  useEffect(() => {
    if (view !== 'scene' || !scene) return;
    let raf = 0;
    const tick = () => {
      const v = segVideo.current;
      const f = capFrame.current;
      const w = f && f.contentWindow;
      if (w && w.AU && w.__AU_READY) {
        const t = scene.start + (v && !isNaN(v.currentTime) ? v.currentTime : Math.max(0, time - scene.start));
        if (Math.abs((w.AU.time || 0) - t) > 0.004) w.AU.seek(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view, sid, scene && scene.start]);
  useEffect(() => {
    const v = video.current;
    if (!v || view !== 'master' || playing) return;
    if (Math.abs(v.currentTime - time) > 0.05) v.currentTime = time;
  }, [time, view]);

  const toStage = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / fit.k, y: (e.clientY - r.top) / fit.k };
  };
  const pick = (pt) => {
    const hits = layers.filter((l) => l.visible && !l.caption && pt.x >= l.x && pt.x <= l.x + l.w && pt.y >= l.y && pt.y <= l.y + l.h && l.w * l.h < W * H * 0.85);
    hits.sort((a, b) => (b.user - a.user) || (a.w * a.h - b.w * b.h));
    return hits[0] || null;
  };
  const editable = view === 'live' && !playing;
  const onMove = (e) => {
    if (!editable) return;
    const pt = toStage(e);
    const d = drag.current;
    if (d) {
      const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
      const w = win();
      if (!w) return;
      if (d.kind === 'move') {
        if (d.layer.user) w.AU.override(d.layer.id, { x: d.base.x + dx / W * 100, y: d.base.y + dy / H * 100 });
        else w.AU.override(d.layer.id, { dx: d.base.dx + dx, dy: d.base.dy + dy });
      } else if (d.kind === 'resize') {
        if (d.layer.user) w.AU.override(d.layer.id, { w: Math.max(2, d.base.w + dx / W * 100), h: d.base.h != null ? Math.max(2, d.base.h + dy / H * 100) : undefined });
        else w.AU.override(d.layer.id, { scale: Math.max(0.1, d.base.scale * (1 + (dx + dy) / Math.max(80, d.layer.w + d.layer.h))) });
      } else if (d.kind === 'rotate') {
        const cx = d.layer.x + d.layer.w / 2, cy = d.layer.y + d.layer.h / 2;
        const ang = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
        w.AU.override(d.layer.id, { rotate: Math.round(ang) });
        d.lastRot = Math.round(ang);
      }
      d.delta = { dx, dy };
      setLayers(w.AU.layers());
      return;
    }
    setHover(pick(pt));
  };
  const userLayer = (id) => (scene.layers || []).find((l) => l.id === id);
  const beginDrag = (e, kind, layer) => {
    if (!editable || !layer) return;
    e.stopPropagation();
    const ov = (scene.overrides || {})[layer.id] || {};
    const ul = layer.user ? userLayer(layer.id) : null;
    drag.current = {
      kind, layer, start: toStage({ clientX: e.clientX, clientY: e.clientY, currentTarget: e.currentTarget.closest('.stage-overlay') }),
      base: ul ? { x: ul.x ?? 10, y: ul.y ?? 10, w: ul.w ?? 30, h: ul.h, rotate: ul.rotate || 0 } : { dx: ov.dx || 0, dy: ov.dy || 0, scale: ov.scale || 1, rotate: ov.rotate || 0 }
    };
  };
  const onDown = (e) => {
    if (!editable) return;
    const pt = toStage(e);
    const layer = pick(pt);
    onSelect(layer ? { sceneId: scene.id, id: layer.id, user: layer.user, tag: layer.tag, text: layer.text } : null);
    if (layer) {
      const ov = (scene.overrides || {})[layer.id] || {};
      const ul = layer.user ? userLayer(layer.id) : null;
      drag.current = { kind: 'move', layer, start: pt, base: ul ? { x: ul.x ?? 10, y: ul.y ?? 10, w: ul.w ?? 30, h: ul.h } : { dx: ov.dx || 0, dy: ov.dy || 0, scale: ov.scale || 1 } };
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.delta && d.kind !== 'rotate') return;
    const { dx, dy } = d.delta || { dx: 0, dy: 0 };
    if (d.layer.user) {
      const patch = d.kind === 'move' ? { x: round(d.base.x + dx / W * 100), y: round(d.base.y + dy / H * 100) }
        : d.kind === 'resize' ? { w: round(Math.max(2, d.base.w + dx / W * 100)), ...(d.base.h != null ? { h: round(Math.max(2, d.base.h + dy / H * 100)) } : {}) }
          : { rotate: d.lastRot || 0 };
      onLayerPatch(scene.id, d.layer.id, patch, true);
    } else {
      const patch = d.kind === 'move' ? { dx: Math.round(d.base.dx + dx), dy: Math.round(d.base.dy + dy) }
        : d.kind === 'resize' ? { scale: round(Math.max(0.1, d.base.scale * (1 + (dx + dy) / Math.max(80, d.layer.w + d.layer.h))), 3) }
          : { rotate: d.lastRot || 0 };
      onOverride(scene.id, d.layer.id, patch);
    }
  };
  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-auteur');
    if (!raw || !scene) return;
    const pt = toStage(e);
    onDropAsset(scene, JSON.parse(raw), { x: round(pt.x / W * 100), y: round(pt.y / H * 100) });
  };
  const sel = selected && scene && selected.sceneId === scene.id ? layers.find((l) => l.id === selected.id) : null;
  const box = (l, cls, handles) => html`<div class=${'sel ' + cls} style=${{ left: l.x * fit.k + 'px', top: l.y * fit.k + 'px', width: l.w * fit.k + 'px', height: l.h * fit.k + 'px' }}>
    ${handles ? html`<span class="tag">${l.user ? 'Layer' : '<' + l.tag + '>'} ${l.id}</span>
      ${['nw', 'ne', 'sw', 'se'].map((h) => html`<span class=${'h ' + h} onMouseDown=${(e) => beginDrag(e, 'resize', l)}></span>`)}
      <span class="h rot" onMouseDown=${(e) => beginDrag(e, 'rotate', l)}></span>` : null}</div>`;
  const idx = scene ? scene.index : -1;
  const look = gradePreview(project, scene, true);
  useGrades();
  const liveCursors = Object.entries(cursors || {}).filter(([id, c]) => {
    const st = agents[id];
    return st && st.state === 'working' && (!c.panel || c.panel === 'stage') && (c.scene == null || c.scene === idx) && Date.now() - c.at < 20000 && c.target !== 'browser';
  });
  const browsing = browse && Date.now() - browse.at < 25000 && agents.research && agents.research.state === 'working';
  const rendering = scene && scene.status === 'rendering';
  const sceneFile = scene && scene.render && scene.render.file ? `/media/${project.id}/renders/${scene.render.file}` : null;
  const master = project.outputs && project.outputs.master;
  const sceneScale = { transform: `scale(${fit.k})`, width: W + 'px', height: H + 'px' };
  const capEnabled = (project.captions || {}).enabled !== false && (project.cues || []).length && (!project.cues_synthetic || (project.captions || {}).from_narration);
  const capKey = view === 'scene' && capEnabled ? String(JSON.stringify([project.cues, project.captions, (project.bible || {}).fonts, (project.options || {}).language]).split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) : '';
  return html`<div class="stage-wrap" ref=${wrap} data-agent-target="stage">
    ${!scene ? html`<div class="empty"><${Icon} name="clapperboard" /><b style=${{ color: 'var(--ink)' }}>No scenes yet</b>Launch the swarm to plan the film.</div>` : html`
    <div class="stage-frame" style=${{ width: fit.w + 'px', height: fit.h + 'px', filter: view === 'master' ? '' : look.filter }}>
      ${view === 'master' ? (master ? html`<video ref=${video} src=${master + '?v=' + Math.round(project.outputs.updated || 0)} playsinline
          onTimeUpdate=${(e) => playing && setTime(e.target.currentTime)} onEnded=${() => setPlaying(false)}></video>` : html`<div class="empty" style=${{ position: 'absolute', inset: 0, background: '#fff' }}><${Icon} name="film" />No master yet. Generate or render the film.</div>`) :
      slots.map((slot, i) => slot.sid && sceneIds.has(slot.sid) ? html`<iframe key=${slot.sid + ':' + slot.ver + ':' + slot.mode} ref=${frames[i]} class=${i === active ? '' : 'back'} style=${sceneScale}
          src=${docUrl(project.id, slot.sid, slot.ver, slot.mode)} onLoad=${onFrameLoad(i)}></iframe>` : null)}
      ${view === 'live' ? html`<div class=${'stage-overlay ' + (editable ? 'edit' : '')} onMouseMove=${onMove} onMouseDown=${onDown} onMouseUp=${onUp} onMouseLeave=${() => { setHover(null); onUp(); }}
          onDragOver=${(e) => e.preventDefault()} onDrop=${onDrop}>
        ${editable && hover && (!sel || hover.id !== sel.id) ? box(hover, 'hover', false) : null}
        ${editable && sel ? box(sel, '', true) : null}
      </div>` : null}
      ${view !== 'master' && look.tint ? html`<div class="grade-tint" style=${{ background: look.tint }}></div>` : null}
      ${view !== 'master' && look.vignette ? html`<div class="grade-vig" style=${{ opacity: Math.min(1, look.vignette / 70) }}></div>` : null}
      ${liveCursors.map(([id, c]) => html`<div class="cursor" key=${id} style=${{ left: c.x * fit.w + 'px', top: c.y * fit.h + 'px', color: agentColor(id) }}>
        <span class="ring" style=${{ background: agentColor(id) }}></span>
        <${Icon} name="mouse-pointer-2" size=${22} style=${{ color: agentColor(id), fill: agentColor(id) }} />
        <span class="who" style=${{ background: agentColor(id) }}>${agentNames[id] || id}<i>${c.label || (agents[id] && agents[id].detail) || ''}</i></span></div>`)}
      ${view === 'scene' ? (sceneFile ? html`<video class="scene-video" ref=${segVideo} src=${sceneFile} playsinline muted style=${{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 6, background: '#000' }}
          onTimeUpdate=${(e) => playing && setTime(scene.start + e.target.currentTime)} onEnded=${() => setPlaying(false)}></video>
        ${capKey ? html`<iframe class="cap-overlay" ref=${capFrame} key=${capKey} src=${`/api/projects/${project.id}/captions/doc?k=${capKey}`} style=${{ ...sceneScale, position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', zIndex: 7, pointerEvents: 'none', background: 'transparent', border: 0 }}></iframe>` : null}`
        : html`<div class="monitor" style=${{ background: '#fff', color: 'var(--muted)', fontSize: '13px' }}>This scene has not been rendered yet. Use Render scene in the Scene tab.</div>`) : null}
      ${rendering && previews[scene.id] ? html`<div class="monitor"><img src=${'data:image/jpeg;base64,' + previews[scene.id]} />
        <span class="monitor-tag"><i></i>REC · SCENE ${idx + 1}</span>
        <div class="monitor-bar"><${Icon} name="cpu" size=${14} />Rendering live in headless Chrome<span class="bar"><i style=${{ width: (progress[scene.id] || 0) + '%' }}></i></span><b class="mono">${progress[scene.id] || 0}%</b></div></div>`
      : rendering ? html`<div class="render-glass"><div class="render-pill"><${Icon} name="cpu" size=${14} />Rendering scene ${idx + 1}
        <span class="bar"><i style=${{ width: (progress[scene.id] || 0) + '%' }}></i></span><b class="mono">${progress[scene.id] || 0}%</b></div></div>` : null}
      ${errors.length && view !== 'master' ? html`<div class="stage-err"><b>Scene script error:</b> ${errors.join(' · ')}</div>` : null}
    </div>
    ${browsing ? html`<div class="pip"><div class="pip-bar"><i></i><i></i><i></i><span class="pip-url">${browse.url}</span><${Icon} name="globe" size=${12} /></div>
      <img src=${'data:image/jpeg;base64,' + browse.jpeg} /></div>` : null}
    <div class="stage-hud">
      <span class="chip"><${Icon} name=${view === 'master' ? 'film' : 'radio'} size=${12} />${view === 'master' ? 'Rendered master' : 'Live composition'}</span>
      ${scene ? html`<span class="chip">Scene ${idx + 1}/${project.scenes.length} · ${scene.archetype || 'custom'} · ${scene.source || 'house'}</span>` : null}
      <span class="chip mono">${W}×${H} · ${Math.round(fit.k * 100)}%</span>
    </div>`}
  </div>`;
}

function round(v, d) { const m = Math.pow(10, d == null ? 2 : d); return Math.round(v * m) / m; }
