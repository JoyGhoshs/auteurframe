import { html, useState, useRef, useEffect, Icon, agentColor, ARCH_ICON } from './lib.js';

const STATUS = {
  planned: ['dot', ''], writing: ['dot work', 'Writing'], qa: ['dot work', 'QA'], written: ['dot', ''], edited: ['dot', ''], rendering: ['dot work', 'Rendering'], rendered: ['dot live', '']
};
const KIND_ICON = { text: 'type', image: 'image', video: 'film', shape: 'square', icon: 'shapes', sticker: 'sticker' };
const ACTORS = new Set(['toon', 'toon-animal', 'stickman', 'anime-figure', 'character', 'mascot', 'model-spec']);
const ROW = 26;

export function clipLength(c, assets) {
  if (c.dur) return c.dur;
  const a = c.asset && (assets || []).find((x) => x.id === c.asset);
  const full = a && a.meta && a.meta.duration ? a.meta.duration - (c.in || 0) : 0;
  return full > 0 ? full : 0.6;
}

export function clipLanes(clips, assets) {
  const lanes = {};
  const ends = [];
  clips.forEach((c) => { if (Number.isInteger(c.lane) && c.lane >= 0) { lanes[c.id] = c.lane; ends[c.lane] = Math.max(ends[c.lane] || 0, c.t + clipLength(c, assets)); } });
  clips.slice().filter((c) => lanes[c.id] == null).sort((a, b) => a.t - b.t).forEach((c) => {
    const pref = c.role === 'music' ? 0 : 0;
    let i = pref;
    while ((ends[i] || 0) > c.t + 1e-3) i++;
    lanes[c.id] = i;
    ends[i] = c.t + clipLength(c, assets);
  });
  return lanes;
}

function layerClass(L) {
  if (L.back) return 'scenery';
  if (L.kind === 'component' && L.component === 'fx') return 'fxl';
  if (L.kind === 'component' && L.component === 'intro') return 'introl';
  if (L.kind === 'component' && ACTORS.has(L.component)) return 'actor';
  if (L.kind === 'text') return 'textl';
  return '';
}

function layerIcon(L) {
  if (L.kind !== 'component') return KIND_ICON[L.kind] || 'square';
  if (L.back) return 'mountain';
  if (L.component === 'fx') return 'sparkles';
  if (L.component === 'intro') return 'clapperboard';
  if (ACTORS.has(L.component)) return 'person-standing';
  return 'shapes';
}

export function Timeline({ project, time, setTime, selectedScene, onSelectScene, onSceneDuration, onLayerTime, onLayerMove, onSelectLayer, selectedLayer, multi, progress, previews, agents, agentNames, collapsed, onCollapse,
  onSelectCue, onAudioClip, onClipPatch, selectedClip, onSelectClip, onCuePatch, selectedCue, onDropTimeline, cursors, onContext, height, onResize }) {
  const [pps, setPps] = useState(60);
  const [scrollX, setScrollX] = useState(0);
  const body = useRef(null);
  const vrows = useRef(null);
  const arows = useRef(null);
  const [ghost, setGhost] = useState(null);
  const [snapAt, setSnapAt] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const scenes = project.scenes || [];
  const cues = project.cues || [];
  const assets = project.assets || [];
  const clips = (project.audio || {}).clips || [];
  const total = scenes.reduce((a, s) => a + s.duration, 0) || 10;
  const width = Math.max(total * pps + 160, 400);
  const fps = project.fps || 30;
  const picked = new Set(multi || []);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    setPps(Math.round(Math.max(18, Math.min(160, (el.clientWidth - 60) / total))));
  }, [project.id, scenes.length]);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const x = time * pps;
    if (x < el.scrollLeft + 20 || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - el.clientWidth / 3);
  }, [Math.floor(time * pps / 200)]);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const wheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setPps((p) => Math.max(12, Math.min(400, p * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [collapsed]);

  const timeAt = (clientX) => {
    const r = body.current.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + body.current.scrollLeft) / pps);
  };
  const rowAt = (ref, clientY, count) => {
    if (!ref.current) return 0;
    const r = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(count - 1, Math.floor((clientY - r.top) / ROW)));
  };
  const ctxMenu = (e, payload) => {
    if (!onContext) return;
    e.preventDefault();
    e.stopPropagation();
    onContext(Object.assign({ t: Math.max(0, Math.min(total, timeAt(e.clientX))), x: e.clientX, y: e.clientY }, payload));
  };
  const seekFromEvent = (e) => setTime(Math.max(0, Math.min(total - 0.001, timeAt(e.clientX))));
  const onRulerDown = (e) => {
    seekFromEvent(e);
    const move = (ev) => seekFromEvent(ev);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const startResize = (e) => {
    if (!onResize) return;
    e.preventDefault();
    const y0 = e.clientY, h0 = height || 300;
    const move = (ev) => onResize(Math.max(120, Math.min(Math.round(window.innerHeight * 0.75), h0 - (ev.clientY - y0))));
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  let acc = 0;
  const sceneStart = scenes.map((s) => { const x = acc; acc += s.duration; return x; });
  const snapPoints = (exclude) => {
    const pts = [0, total, time];
    scenes.forEach((s, i) => pts.push(sceneStart[i], sceneStart[i] + s.duration));
    cues.forEach((c) => { if (exclude !== 'cue:' + c.id) pts.push(c.start, c.end); });
    scenes.forEach((s, i) => (s.layers || []).forEach((L) => { if (exclude !== 'layer:' + L.id) pts.push(sceneStart[i] + (L.start || 0), sceneStart[i] + (L.end ?? s.duration)); }));
    clips.forEach((c) => { if (exclude !== 'clip:' + c.id) pts.push(c.t, c.t + clipLength(c, assets)); });
    return pts;
  };
  const snap = (t, exclude, ev) => {
    if (ev && ev.altKey) { setSnapAt(null); return t; }
    const tol = 8 / pps;
    let best = null;
    for (const p of snapPoints(exclude)) if (Math.abs(p - t) < tol && (best === null || Math.abs(p - t) < Math.abs(best - t))) best = p;
    setSnapAt(best);
    return best === null ? t : best;
  };
  const snapPair = (a, b, exclude, ev) => {
    const sa = snap(a, exclude, ev);
    if (sa !== a) return [sa, sa + (b - a)];
    const sb = snap(b, exclude, ev);
    return [a + (sb - b), sb];
  };
  const dragLoop = (e, onMove, onUp) => {
    e.stopPropagation();
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    const move = (ev) => onMove((ev.clientX - x0) / pps, ev, ev.clientY - y0);
    const up = (ev) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      setGhost(null); setSnapAt(null);
      onUp((ev.clientX - x0) / pps, ev, ev.clientY - y0);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const fr = (t) => Math.round(t * fps) / fps;

  const R = Math.max(1, ...scenes.map((s) => (s.layers || []).length));
  const rowOfIndex = (i) => R - 1 - i;

  const startEdge = (e, s, i) => {
    const d0 = s.duration;
    const base = sceneStart[i];
    const calc = (dt, ev) => Math.max(0.4, snap(base + d0 + dt, 'scene:' + s.id, ev) - base);
    dragLoop(e, (dt, ev) => setGhost({ id: s.id, d: calc(dt, ev) }), (dt, ev) => {
      const d = fr(calc(dt, ev));
      if (Math.abs(d - d0) > 0.5 / fps) onSceneDuration(s.id, d);
    });
  };
  const startLayer = (e, s, i, L, kind, index) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) { e.stopPropagation(); onSelectLayer({ sceneId: s.id, id: L.id, user: true }, true); return; }
    onSelectLayer({ sceneId: s.id, id: L.id, user: true });
    const st = L.start || 0, en = L.end ?? s.duration, base = sceneStart[i];
    const n = (s.layers || []).length;
    const calc = (dt, ev) => {
      let a = st, b = en;
      if (kind === 'move') { [a, b] = snapPair(base + st + dt, base + en + dt, 'layer:' + L.id, ev); a -= base; b -= base; if (a < 0) { b -= a; a = 0; } if (b > s.duration) { a -= b - s.duration; b = s.duration; } }
      else if (kind === 'l') a = Math.max(0, Math.min(en - 0.2, snap(base + st + dt, 'layer:' + L.id, ev) - base));
      else b = Math.min(s.duration, Math.max(st + 0.2, snap(base + en + dt, 'layer:' + L.id, ev) - base));
      return [a, b];
    };
    const target = (ev) => (kind === 'move' ? Math.max(0, Math.min(n - 1, R - 1 - rowAt(vrows, ev.clientY, R))) : index);
    dragLoop(e, (dt, ev) => { const [a, b] = calc(dt, ev); setGhost({ layer: L.id, a, b, row: rowOfIndex(target(ev)) }); }, (dt, ev, dy) => {
      const ni = target(ev);
      const moved = Math.abs(dt) >= 0.01;
      if (!moved && ni === index) return;
      const [a, b] = calc(dt, ev);
      const times = moved ? { start: Math.round(a * 100) / 100, end: Math.round(b * 100) / 100 } : null;
      if (ni !== index && onLayerMove) onLayerMove(s.id, L.id, times, ni);
      else if (times) onLayerTime(s.id, L.id, times);
      void dy;
    });
  };
  const lanes = clipLanes(clips, assets);
  const laneCount = Math.max(0, ...Object.values(lanes).map((x) => x + 1));
  const voice = assets.find((a) => a.id === (project.audio || {}).voice);
  const audioMusic = (project.audio || {}).music;
  const musicAsset = assets.find((a) => a.id === audioMusic);
  const fixedRows = (voice ? 1 : 0) + (audioMusic ? 1 : 0);
  const audioRows = fixedRows + laneCount + 1;
  const startClip = (e, c, kind) => {
    onSelectClip && onSelectClip(c.id);
    const len = clipLength(c, assets);
    const t0 = c.t, in0 = c.in || 0;
    const a = c.asset && assets.find((x) => x.id === c.asset);
    const full = a && a.meta && a.meta.duration ? a.meta.duration : null;
    const lane0 = lanes[c.id] || 0;
    const laneAt = (ev) => (kind === 'move' ? Math.max(0, rowAt(arows, ev.clientY, audioRows) - fixedRows) : lane0);
    const calc = (dt, ev) => {
      if (kind === 'move') { const [x] = snapPair(Math.max(0, t0 + dt), Math.max(0, t0 + dt) + len, 'clip:' + c.id, ev); return { t: Math.max(0, x), dur: c.dur, in: c.in }; }
      if (kind === 'l') {
        const nt = Math.max(t0 - in0, Math.min(t0 + len - 0.1, snap(t0 + dt, 'clip:' + c.id, ev)));
        return { t: nt, in: Math.max(0, in0 + (nt - t0)), dur: len - (nt - t0) };
      }
      const end = snap(t0 + len + dt, 'clip:' + c.id, ev);
      return { t: t0, in: in0, dur: Math.max(0.1, Math.min(full ? full - in0 : 1e9, end - t0)) };
    };
    dragLoop(e, (dt, ev) => setGhost({ clip: c.id, lane: laneAt(ev), ...calc(dt, ev) }), (dt, ev) => {
      const ln = laneAt(ev);
      if (Math.abs(dt) < 0.01 && ln === lane0) return;
      const p = calc(dt, ev);
      const r = (x) => (x == null ? x : Math.round(x * 1000) / 1000);
      const lanePatch = ln !== lane0 || !Number.isInteger(c.lane) ? { lane: ln } : {};
      if (kind === 'move' && onAudioClip && !onClipPatch) onAudioClip(c.id, r(p.t));
      else onClipPatch && onClipPatch(c.id, kind === 'move' ? { t: r(p.t), ...lanePatch } : { t: r(p.t), in: r(p.in), dur: r(p.dur) });
    });
  };
  const startCue = (e, c, kind) => {
    onSelectCue && onSelectCue(c);
    const s0 = c.start, e0 = c.end;
    const i = cues.findIndex((x) => x.id === c.id);
    const lo = i > 0 ? cues[i - 1].end : 0;
    const hi = i < cues.length - 1 ? cues[i + 1].start : total + 30;
    const calc = (dt, ev) => {
      let a = s0, b = e0;
      if (kind === 'move') { [a, b] = snapPair(s0 + dt, e0 + dt, 'cue:' + c.id, ev); if (a < lo) { b += lo - a; a = lo; } if (b > hi) { a -= b - hi; b = hi; } }
      else if (kind === 'l') a = Math.max(lo, Math.min(e0 - 0.1, snap(s0 + dt, 'cue:' + c.id, ev)));
      else b = Math.min(hi, Math.max(s0 + 0.1, snap(e0 + dt, 'cue:' + c.id, ev)));
      return [a, b];
    };
    dragLoop(e, (dt, ev) => { const [a, b] = calc(dt, ev); setGhost({ cue: c.id, a, b }); }, (dt, ev) => {
      if (Math.abs(dt) < 0.01) { setTime(c.start + 0.001); return; }
      const [a, b] = calc(dt, ev);
      onCuePatch && onCuePatch(c.id, { start: Math.round(a * 1000) / 1000, end: Math.round(b * 1000) / 1000 });
    });
  };

  const onDragOver = (e) => {
    if (!onDropTimeline) return;
    e.preventDefault();
    const tr = e.target.closest && e.target.closest('[data-track]');
    setDropAt({ t: timeAt(e.clientX), track: tr ? tr.getAttribute('data-track') : 'layers' });
  };
  const onDrop = (e) => {
    e.preventDefault();
    const at = dropAt;
    setDropAt(null);
    if (!onDropTimeline) return;
    const t = Math.min(total - 0.05, timeAt(e.clientX));
    const tr = e.target.closest && e.target.closest('[data-track]');
    const track = tr ? tr.getAttribute('data-track') : (at && at.track) || 'layers';
    const raw = e.dataTransfer.getData('application/x-auteur');
    if (raw) onDropTimeline({ data: JSON.parse(raw), t: fr(t), track });
    else if (e.dataTransfer.files && e.dataTransfer.files.length) onDropTimeline({ files: e.dataTransfer.files, t: fr(t), track });
  };

  const ticks = [];
  const step = pps > 180 ? 0.25 : pps > 90 ? 0.5 : pps > 40 ? 1 : pps > 20 ? 2 : 5;
  for (let t = 0; t <= total + step; t += step) {
    const unit = step * (step < 1 ? 2 : 5);
    const major = Math.abs(t / unit - Math.round(t / unit)) < 1e-6;
    ticks.push(html`<span class=${'tl-tick ' + (major ? '' : 'minor')} style=${{ left: t * pps + 'px' }}>${major ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}${t % 1 ? '.' + String(Math.round((t % 1) * 10)) : ''}` : ''}</span>`);
  }
  const working = Object.entries(agents || {}).filter(([, a]) => a.state === 'working' && a.scene != null);
  let offset = 0;
  const sceneX = scenes.map((s) => { const x = offset; offset += (ghost && ghost.id === s.id ? ghost.d : s.duration); return x; });
  const sync = project.sync;
  const badCues = new Set(((sync && sync.cues) || []).filter((c) => !c.ok).map((c) => c.id));
  const cueById = {};
  cues.forEach((c) => { cueById[c.id] = c; });
  const drift = {};
  scenes.forEach((s, i) => {
    const own = (s.cue_ids || []).map((cid) => cueById[cid]).filter(Boolean);
    if (!own.length) return;
    const first = Math.min(...own.map((c) => c.start));
    const last = Math.max(...own.map((c) => c.end));
    if (i > 0 && (first < s.start - 0.05 || first > s.start + 0.4)) drift[s.id] = `Its caption moved: the first line starts at ${first.toFixed(2)}s, the scene starts at ${s.start.toFixed(2)}s.`;
    else if (last > s.start + s.duration + 0.05 && i === scenes.length - 1) drift[s.id] = `Its last caption ends at ${last.toFixed(2)}s, after the scene ends at ${(s.start + s.duration).toFixed(2)}s.`;
  });
  const vlabel = (r) => {
    const i = R - 1 - r;
    const kinds = scenes.map((s) => (s.layers || [])[i]).filter(Boolean);
    const back = kinds.length && kinds.every((L) => L.back);
    return html`<div class="tl-head lane" key=${'vh' + r}><${Icon} name=${back ? 'mountain' : 'layers'} />V${i + 1}<span class="muted">${back ? 'scenery' : i === R - 1 && R > 1 ? 'front' : ''}</span></div>`;
  };
  const clipStyle = (c) => {
    if (c.role === 'music') return { background: '#f5f0ff', borderColor: '#cbbcff', color: '#5b3df5' };
    if (c.role === 'voice') return { background: '#eef7ff', borderColor: '#b9dcff', color: '#1769aa' };
    return {};
  };
  return html`<div class=${'timeline mt ' + (collapsed ? 'collapsed' : '')} data-agent-target="timeline" style=${collapsed ? {} : { height: (height || 300) + 'px' }}>
    ${collapsed ? null : html`<div class="tl-resize" title="Drag to resize the timeline" onMouseDown=${startResize}></div>`}
    <div class="tl-top">
      <div class="tl-ruler-head"><button class="btn ghost icon sm" onClick=${onCollapse} title="Collapse timeline"><${Icon} name=${collapsed ? 'chevron-up' : 'chevron-down'} size=${14} /></button>
        <button class="btn ghost icon sm" title="Zoom out (Ctrl + wheel)" onClick=${() => setPps(Math.max(12, pps / 1.3))}><${Icon} name="zoom-out" size=${13} /></button>
        <button class="btn ghost icon sm" title="Zoom in (Ctrl + wheel)" onClick=${() => setPps(Math.min(400, pps * 1.3))}><${Icon} name="zoom-in" size=${13} /></button>
        <button class="btn ghost icon sm" title="Fit timeline" onClick=${() => body.current && setPps(Math.max(12, (body.current.clientWidth - 60) / total))}><${Icon} name="maximize-2" size=${13} /></button></div>
      <div class="tl-ruler-wrap"><div class="tl-ruler" style=${{ width: width + 'px', transform: `translateX(${-scrollX}px)` }} onMouseDown=${onRulerDown}>${ticks}
        <span class="ruler-head" style=${{ left: time * pps + 'px' }}></span></div></div>
    </div>
    ${collapsed ? null : html`<div class="tl-scroll">
      <div class="tl-heads">
        <div class="tl-head"><${Icon} name="clapperboard" />Scenes</div>
        <div class="tl-head sm"><${Icon} name="captions" />Captions${sync && !sync.skipped ? html`<span class=${'sync-dot ' + (sync.ok ? 'ok' : 'bad')} title=${sync.ok ? `Sync verified: max drift ${sync.max_drift_ms}ms` : `${sync.failed} cues off sync`}></span>` : null}</div>
        ${Array.from({ length: R }, (_, r) => vlabel(r))}
        ${voice ? html`<div class="tl-head lane"><${Icon} name="mic" />Voice</div>` : null}
        ${audioMusic ? html`<div class="tl-head lane"><${Icon} name="music" />Score</div>` : null}
        ${Array.from({ length: laneCount + 1 }, (_, i) => html`<div class="tl-head lane" key=${'ah' + i}><${Icon} name="audio-lines" />A${i + 1}${i === laneCount ? html`<span class="muted">new</span>` : null}</div>`)}
        <div class="tl-head sm"><${Icon} name="bot" />Agents</div>
        ${project.edit ? html`<div class="tl-head sm"><${Icon} name="scissors" />Edit ops</div>` : null}
      </div>
      <div class="tl-body" ref=${body} onScroll=${(e) => setScrollX(e.currentTarget.scrollLeft)} onDragOver=${onDragOver} onDragLeave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null); }} onDrop=${onDrop}>
        <div class="tl-inner" style=${{ width: width + 'px' }}>
          <div class="tl-track" data-track="scenes" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'scenes' })}>
            ${scenes.map((s, i) => {
    const d = ghost && ghost.id === s.id ? ghost.d : s.duration;
    const st = STATUS[s.status] || ['dot', ''];
    const busy = ['writing', 'qa', 'rendering'].includes(s.status);
    const prev = previews[s.id];
    return html`<div class=${'clip ' + (selectedScene === s.id ? 'on ' : '') + (busy ? 'busy' : '')} key=${s.id} data-agent-target=${'scene-' + s.index} style=${{ left: sceneX[i] * pps + 1 + 'px', width: Math.max(8, d * pps - 2) + 'px' }}
                onMouseDown=${(e) => { if (e.button === 2) { onSelectScene(s.id); return; } e.stopPropagation(); onSelectScene(s.id); setTime(s.start + 0.0001); }}
                onContextMenu=${(e) => ctxMenu(e, { kind: 'scene', scene: s })}>
                ${prev ? html`<img src=${'data:image/jpeg;base64,' + prev} />` : s.thumb ? html`<img src=${s.thumb} />` : null}
                <span class="lab"><${Icon} name=${s.code ? 'code-xml' : ARCH_ICON[s.archetype] || 'square'} size=${11} />${i + 1} · ${s.title || s.archetype}</span>
                <span class="stat"><span class=${st[0]} title=${s.status}></span></span>
                ${s.status === 'rendering' ? html`<span class="prog" style=${{ width: (progress[s.id] || 0) + '%' }}></span>` : null}
                ${ghost && ghost.id === s.id ? html`<span class="ghost-dur">${d.toFixed(2)}s</span>` : null}
                ${s.draft ? html`<span class="draft-dot" title="Animator draft waiting to be applied"></span>` : null}
                ${drift[s.id] ? html`<span class="drift-dot" title=${drift[s.id] + ' Right-click a scene and choose Re-flow scenes to captions, or switch on Scenes follow captions in the Captions panel.'}><${Icon} name="triangle-alert" size=${11} /></span>` : null}
                <span class="edge r" onMouseDown=${(e) => startEdge(e, s, i)}></span>
              </div>`;
  })}
            ${scenes.slice(0, -1).map((s, i) => html`<span class="trans-mark" title=${(s.transition || {}).type} style=${{ left: (sceneX[i] + s.duration) * pps + 'px' }}><${Icon} name=${(s.transition || {}).type === 'cut' ? 'scissors' : 'blend'} /></span>`)}
          </div>
          <div class="tl-track sm alt" data-track="captions" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'captions' })}>
            ${cues.map((c) => {
    const a = ghost && ghost.cue === c.id ? ghost.a : c.start;
    const b = ghost && ghost.cue === c.id ? ghost.b : c.end;
    return html`<div class=${'clip cue ' + (c.synthetic ? 'synthetic ' : '') + (selectedCue === c.id ? 'on ' : '') + (badCues.has(c.id) ? 'bad' : '')} key=${c.id} title=${`${c.text}\n${c.start.toFixed(3)}s to ${c.end.toFixed(3)}s`}
                onMouseDown=${(e) => { if (e.button === 2) { onSelectCue && onSelectCue(c); return; } startCue(e, c, 'move'); }} onContextMenu=${(e) => ctxMenu(e, { kind: 'cue', cue: c })}
                style=${{ left: a * pps + 'px', width: Math.max(4, (b - a) * pps - 1) + 'px' }}>
                <span class="edge l" onMouseDown=${(e) => startCue(e, c, 'l')}></span><span class="ellipsis">${c.text}</span><span class="edge r" onMouseDown=${(e) => startCue(e, c, 'r')}></span></div>`;
  })}
          </div>
          <div class="tl-lanes" ref=${vrows} data-track="layers" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'layers' })} style=${{ height: R * ROW + 'px' }}>
            ${Array.from({ length: R }, (_, r) => html`<div class=${'lane-bg ' + (r % 2 ? 'alt' : '')} key=${'vb' + r} style=${{ top: r * ROW + 'px' }}></div>`)}
            ${scenes.map((s, i) => html`<div class="scene-sep" key=${'sep' + s.id} style=${{ left: sceneX[i] * pps + 'px', height: R * ROW + 'px' }}></div>`)}
            ${scenes.flatMap((s, i) => (s.layers || []).map((L, li) => {
    const g = ghost && ghost.layer === L.id ? ghost : null;
    const a = g ? g.a : (L.start || 0);
    const b = g ? g.b : (L.end ?? s.duration);
    const row = g && g.row != null ? g.row : rowOfIndex(li);
    const on = (selectedLayer && selectedLayer.id === L.id) || picked.has(L.id);
    return html`<div class=${'clip layer lanes ' + layerClass(L) + (on ? ' on' : '') + (L.hidden ? ' off' : '') + (g ? ' dragging' : '')} key=${L.id}
                style=${{ left: (sceneX[i] + a) * pps + 'px', width: Math.max(10, (b - a) * pps) + 'px', top: row * ROW + 2 + 'px', height: ROW - 4 + 'px' }}
                title=${`${L.name || L.text || L.kind} · drag sideways to retime, up or down to change stacking`}
                onMouseDown=${(e) => { if (e.button === 2) { onSelectLayer({ sceneId: s.id, id: L.id, user: true }); return; } startLayer(e, s, i, L, 'move', li); }}
                onContextMenu=${(e) => ctxMenu(e, { kind: 'layer', scene: s, layer: L })}>
                <span class="edge l" onMouseDown=${(e) => startLayer(e, s, i, L, 'l', li)}></span>
                <${Icon} name=${layerIcon(L)} size=${11} />
                <span class="ellipsis">${L.text || L.name || L.kind}</span>
                ${L.locked ? html`<${Icon} name="lock" size=${10} />` : null}
                ${(L.params && L.params.actions && L.params.actions.length) ? html`<span class="act-count">${L.params.actions.length}</span>` : null}
                <span class="edge r" onMouseDown=${(e) => startLayer(e, s, i, L, 'r', li)}></span></div>`;
  }))}
          </div>
          <div class="tl-lanes audio" ref=${arows} data-track="audio" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'audio' })} style=${{ height: audioRows * ROW + 'px' }}>
            ${Array.from({ length: audioRows }, (_, r) => html`<div class=${'lane-bg ' + (r % 2 ? '' : 'alt')} key=${'ab' + r} style=${{ top: r * ROW + 'px' }}></div>`)}
            ${voice ? html`<div class=${'clip audio lanes ' + ((project.audio || {}).voice_mute ? 'muted' : '')} onContextMenu=${(e) => ctxMenu(e, { kind: 'voice', asset: voice })} title="Right-click for voice options"
                style=${{ left: 0, width: Math.min(total, voice.meta?.duration || total) * pps + 'px', top: '2px', height: ROW - 4 + 'px' }}><span class="wave"></span><${Icon} name="mic" size=${11} /><span>${voice.name}</span></div>` : null}
            ${audioMusic ? html`<div class="clip audio lanes" onContextMenu=${(e) => ctxMenu(e, { kind: 'music', asset: musicAsset })} title="Right-click to split, trim or remove the music"
                style=${{ left: 0, width: total * pps + 'px', top: (voice ? ROW : 0) + 2 + 'px', height: ROW - 4 + 'px', background: '#f5f0ff', borderColor: '#ddd2ff', color: '#5b3df5' }}>
              <span class="wave" style=${{ background: 'repeating-linear-gradient(90deg,#a38cff 0 2px,transparent 2px 6px)' }}></span><${Icon} name="music" size=${11} /><span>${musicAsset ? musicAsset.name : audioMusic === 'auto' ? 'Generated score' : 'Music'}</span></div>` : null}
            ${clips.map((c) => {
    const g = ghost && ghost.clip === c.id ? ghost : null;
    const t = g ? g.t : c.t;
    const len = g && g.dur ? g.dur : clipLength(c, assets);
    const lane = g && g.lane != null ? g.lane : (lanes[c.id] || 0);
    const a = c.asset && assets.find((x) => x.id === c.asset);
    const label = c.name || (a && a.name) || c.sfx || 'clip';
    return html`<div class=${'clip sfxclip lanes ' + (c.asset ? 'assetclip ' : '') + (selectedClip === c.id ? 'on ' : '') + (c.mute ? 'muted' : '')} key=${c.id} title=${`${label} at ${c.t}s · drag up or down to move it to another audio track`}
                style=${{ left: t * pps + 'px', width: Math.max(26, len * pps) + 'px', top: (fixedRows + lane) * ROW + 2 + 'px', height: ROW - 4 + 'px', ...clipStyle(c) }}
                onMouseDown=${(e) => { if (e.button === 2) { onSelectClip && onSelectClip(c.id); return; } startClip(e, c, 'move'); }}
                onContextMenu=${(e) => ctxMenu(e, { kind: 'clip', clip: c })}>
                ${c.asset ? html`<span class="edge l" onMouseDown=${(e) => startClip(e, c, 'l')}></span>` : null}
                <${Icon} name=${c.role === 'voice' ? 'mic' : c.role === 'music' ? 'music' : c.asset ? 'music-2' : 'audio-lines'} size=${10} /><span class="ellipsis">${label}${c.gain != null && Math.abs(c.gain - 1) > 0.01 ? ` · ${Math.round(c.gain * 100)}%` : ''}</span>
                ${c.asset ? html`<span class="edge r" onMouseDown=${(e) => startClip(e, c, 'r')}></span>` : null}</div>`;
  })}
          </div>
          <div class="tl-track sm">
            ${working.map(([id, a]) => {
    const s = scenes[a.scene];
    if (!s) return null;
    return html`<span class="agent-mark" key=${id} style=${{ left: (s.start * pps + 4 + (parseInt(id.split('-')[1] || '0', 10) % 3) * 6) + 'px', background: agentColor(id) }}><${Icon} name="bot" size=${10} />${agentNames[id] || id}</span>`;
  })}
            ${Object.entries(cursors || {}).filter(([, c]) => c.target === 'timeline' && Date.now() - c.at < 6000).map(([id, c]) => html`<span class="agent-mark" key=${'c' + id} style=${{ left: (c.t || 0) * pps + 'px', background: agentColor(id) }}><${Icon} name="mouse-pointer-2" size=${10} />${agentNames[id] || id} · ${c.label}</span>`)}
          </div>
          ${project.edit ? html`<div class="tl-track sm alt edit-ops">${(project.edit.ops || []).map((o) => html`<span class="edit-op" title=${`${o.id} ${o.label}`} style=${{ left: o.t * pps + 'px', background: agentColor(o.agent) }}>${o.label}</span>`)}</div>` : null}
          ${snapAt !== null ? html`<div class="snap-line" style=${{ left: snapAt * pps + 'px' }}></div>` : null}
          ${dropAt ? html`<div class="drop-line" style=${{ left: dropAt.t * pps + 'px' }}><span>${dropAt.track} · ${dropAt.t.toFixed(2)}s</span></div>` : null}
          <div class="playhead" style=${{ left: time * pps + 'px' }}></div>
        </div>
      </div>
    </div>`}
  </div>`;
}
