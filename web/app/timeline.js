import { html, useState, useRef, useEffect, Icon, agentColor, ARCH_ICON } from './lib.js';

const STATUS = {
  planned: ['dot', ''], writing: ['dot work', 'Writing'], qa: ['dot work', 'QA'], written: ['dot', ''], edited: ['dot', ''], rendering: ['dot work', 'Rendering'], rendered: ['dot live', '']
};
const KIND_ICON = { text: 'type', image: 'image', video: 'film', shape: 'square', icon: 'shapes', sticker: 'sticker' };

export function clipLength(c, assets) {
  if (c.dur) return c.dur;
  const a = c.asset && (assets || []).find((x) => x.id === c.asset);
  const full = a && a.meta && a.meta.duration ? a.meta.duration - (c.in || 0) : 0;
  return full > 0 ? full : 0.6;
}

export function Timeline({ project, time, setTime, selectedScene, onSelectScene, onSceneDuration, onLayerTime, onSelectLayer, selectedLayer, progress, previews, agents, agentNames, collapsed, onCollapse,
  onSelectCue, onAudioClip, onClipPatch, selectedClip, onSelectClip, onCuePatch, selectedCue, onDropTimeline, cursors, onContext }) {
  const [pps, setPps] = useState(60);
  const body = useRef(null);
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
  }, []);

  const timeAt = (clientX) => {
    const r = body.current.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + body.current.scrollLeft) / pps);
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
    const x0 = e.clientX;
    const move = (ev) => onMove((ev.clientX - x0) / pps, ev);
    const up = (ev) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      setGhost(null); setSnapAt(null);
      onUp((ev.clientX - x0) / pps, ev);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const fr = (t) => Math.round(t * fps) / fps;

  const startEdge = (e, s, i) => {
    const d0 = s.duration;
    const base = sceneStart[i];
    const calc = (dt, ev) => Math.max(0.4, snap(base + d0 + dt, 'scene:' + s.id, ev) - base);
    dragLoop(e, (dt, ev) => setGhost({ id: s.id, d: calc(dt, ev) }), (dt, ev) => {
      const d = fr(calc(dt, ev));
      if (Math.abs(d - d0) > 0.5 / fps) onSceneDuration(s.id, d);
    });
  };
  const startLayer = (e, s, i, L, kind) => {
    onSelectLayer({ sceneId: s.id, id: L.id, user: true });
    const st = L.start || 0, en = L.end ?? s.duration, base = sceneStart[i];
    const calc = (dt, ev) => {
      let a = st, b = en;
      if (kind === 'move') { [a, b] = snapPair(base + st + dt, base + en + dt, 'layer:' + L.id, ev); a -= base; b -= base; if (a < 0) { b -= a; a = 0; } if (b > s.duration) { a -= b - s.duration; b = s.duration; } }
      else if (kind === 'l') a = Math.max(0, Math.min(en - 0.2, snap(base + st + dt, 'layer:' + L.id, ev) - base));
      else b = Math.min(s.duration, Math.max(st + 0.2, snap(base + en + dt, 'layer:' + L.id, ev) - base));
      return [a, b];
    };
    dragLoop(e, (dt, ev) => { const [a, b] = calc(dt, ev); setGhost({ layer: L.id, a, b }); }, (dt, ev) => {
      if (Math.abs(dt) < 0.01) return;
      const [a, b] = calc(dt, ev);
      onLayerTime(s.id, L.id, { start: Math.round(a * 100) / 100, end: Math.round(b * 100) / 100 });
    });
  };
  const startClip = (e, c, kind) => {
    onSelectClip && onSelectClip(c.id);
    const len = clipLength(c, assets);
    const t0 = c.t, in0 = c.in || 0;
    const a = c.asset && assets.find((x) => x.id === c.asset);
    const full = a && a.meta && a.meta.duration ? a.meta.duration : null;
    const calc = (dt, ev) => {
      if (kind === 'move') { const [x] = snapPair(Math.max(0, t0 + dt), Math.max(0, t0 + dt) + len, 'clip:' + c.id, ev); return { t: Math.max(0, x), dur: c.dur, in: c.in }; }
      if (kind === 'l') {
        const nt = Math.max(t0 - in0, Math.min(t0 + len - 0.1, snap(t0 + dt, 'clip:' + c.id, ev)));
        return { t: nt, in: Math.max(0, in0 + (nt - t0)), dur: len - (nt - t0) };
      }
      const end = snap(t0 + len + dt, 'clip:' + c.id, ev);
      return { t: t0, in: in0, dur: Math.max(0.1, Math.min(full ? full - in0 : 1e9, end - t0)) };
    };
    dragLoop(e, (dt, ev) => setGhost({ clip: c.id, ...calc(dt, ev) }), (dt, ev) => {
      if (Math.abs(dt) < 0.01) return;
      const p = calc(dt, ev);
      const r = (x) => (x == null ? x : Math.round(x * 1000) / 1000);
      if (kind === 'move' && onAudioClip && !onClipPatch) onAudioClip(c.id, r(p.t));
      else onClipPatch && onClipPatch(c.id, kind === 'move' ? { t: r(p.t) } : { t: r(p.t), in: r(p.in), dur: r(p.dur) });
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
  const audioMusic = (project.audio || {}).music;
  const voice = assets.find((a) => a.id === (project.audio || {}).voice);
  const musicAsset = assets.find((a) => a.id === audioMusic);
  const sync = project.sync;
  const badCues = new Set(((sync && sync.cues) || []).filter((c) => !c.ok).map((c) => c.id));
  return html`<div class=${'timeline ' + (collapsed ? 'collapsed' : '')} data-agent-target="timeline">
    <div class="tl-heads">
      <div class="tl-ruler-head"><button class="btn ghost icon sm" onClick=${onCollapse} title="Collapse timeline"><${Icon} name=${collapsed ? 'chevron-up' : 'chevron-down'} size=${14} /></button>
        <button class="btn ghost icon sm" title="Zoom out (Ctrl + wheel)" onClick=${() => setPps(Math.max(12, pps / 1.3))}><${Icon} name="zoom-out" size=${13} /></button>
        <button class="btn ghost icon sm" title="Zoom in (Ctrl + wheel)" onClick=${() => setPps(Math.min(400, pps * 1.3))}><${Icon} name="zoom-in" size=${13} /></button>
        <button class="btn ghost icon sm" title="Fit timeline" onClick=${() => body.current && setPps(Math.max(12, (body.current.clientWidth - 60) / total))}><${Icon} name="maximize-2" size=${13} /></button></div>
      ${collapsed ? null : html`
      <div class="tl-head"><${Icon} name="clapperboard" />Scenes</div>
      <div class="tl-head sm"><${Icon} name="captions" />Captions${sync && !sync.skipped ? html`<span class=${'sync-dot ' + (sync.ok ? 'ok' : 'bad')} title=${sync.ok ? `Sync verified: max drift ${sync.max_drift_ms}ms` : `${sync.failed} cues off sync`}></span>` : null}</div>
      <div class="tl-head sm"><${Icon} name="layers" />Layers</div>
      <div class="tl-head sm"><${Icon} name="audio-lines" />Audio</div>
      <div class="tl-head sm"><${Icon} name="bot" />Agents</div>
      ${project.edit ? html`<div class="tl-head sm"><${Icon} name="scissors" />Edit ops</div>` : null}`}
    </div>
    <div class="tl-body" ref=${body} onDragOver=${onDragOver} onDragLeave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null); }} onDrop=${onDrop}>
      <div class="tl-inner" style=${{ width: width + 'px' }}>
        <div class="tl-ruler" onMouseDown=${onRulerDown}>${ticks}</div>
        ${collapsed ? null : html`
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
        <div class="tl-track sm" data-track="layers" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'layers' })}>
          ${scenes.flatMap((s, i) => (s.layers || []).map((L) => {
    const a = ghost && ghost.layer === L.id ? ghost.a : (L.start || 0);
    const b = ghost && ghost.layer === L.id ? ghost.b : (L.end ?? s.duration);
    return html`<div class=${'clip layer ' + (selectedLayer && selectedLayer.id === L.id ? 'on' : '')} key=${L.id} style=${{ left: (sceneX[i] + a) * pps + 'px', width: Math.max(10, (b - a) * pps) + 'px' }}
              onMouseDown=${(e) => { if (e.button === 2) { onSelectLayer({ sceneId: s.id, id: L.id, user: true }); return; } startLayer(e, s, i, L, 'move'); }}
              onContextMenu=${(e) => ctxMenu(e, { kind: 'layer', scene: s, layer: L })}>
              <span class="edge l" onMouseDown=${(e) => startLayer(e, s, i, L, 'l')}></span>
              <${Icon} name=${KIND_ICON[L.kind] || 'square'} size=${11} />
              <span class="ellipsis">${L.text || L.name || L.kind}</span>
              <span class="edge r" onMouseDown=${(e) => startLayer(e, s, i, L, 'r')}></span></div>`;
  }))}
        </div>
        <div class="tl-track sm alt" data-track="audio" onContextMenu=${(e) => ctxMenu(e, { kind: 'track', track: 'audio' })}>
          ${voice ? html`<div class=${'clip audio ' + ((project.audio || {}).voice_mute ? 'muted' : '')} onContextMenu=${(e) => ctxMenu(e, { kind: 'voice', asset: voice })} title="Right-click for voice options" style=${{ left: 0, width: Math.min(total, voice.meta?.duration || total) * pps + 'px', top: '3px', bottom: '15px' }}><span class="wave"></span><${Icon} name="mic" size=${11} /><span>${voice.name}</span></div>` : null}
          ${audioMusic ? html`<div class="clip audio" onContextMenu=${(e) => ctxMenu(e, { kind: 'music', asset: musicAsset })} title="Right-click to split, trim or remove the music" style=${{ left: 0, width: total * pps + 'px', top: voice ? '15px' : '4px', bottom: voice ? '3px' : '4px', background: '#f5f0ff', borderColor: '#ddd2ff', color: '#5b3df5' }}>
            <span class="wave" style=${{ background: 'repeating-linear-gradient(90deg,#a38cff 0 2px,transparent 2px 6px)' }}></span><${Icon} name="music" size=${11} /><span>${musicAsset ? musicAsset.name : audioMusic === 'auto' ? 'Generated score' : 'Music'}</span></div>` : null}
          ${clips.map((c) => {
    const g = ghost && ghost.clip === c.id ? ghost : null;
    const t = g ? g.t : c.t;
    const len = g && g.dur ? g.dur : clipLength(c, assets);
    const a = c.asset && assets.find((x) => x.id === c.asset);
    const label = c.name || (a && a.name) || c.sfx || 'clip';
    const hasVoice = !!voice || clips.some((x) => x.role === 'voice');
    const hasMusic = !!audioMusic || clips.some((x) => x.role === 'music');
    const tint = c.role === 'music' ? { background: '#f5f0ff', borderColor: '#cbbcff', color: '#5b3df5', top: hasVoice ? '15px' : '4px', bottom: hasVoice ? '3px' : '4px', zIndex: 2 }
      : c.role === 'voice' ? { background: '#eef7ff', borderColor: '#b9dcff', color: '#1769aa', top: '3px', bottom: hasMusic ? '15px' : '4px', zIndex: 2 } : { zIndex: 4 };
    return html`<div class=${'clip sfxclip ' + (c.asset ? 'assetclip ' : '') + (selectedClip === c.id ? 'on ' : '') + (c.mute ? 'muted' : '')} key=${c.id} title=${`${label} at ${c.t}s`}
              style=${{ left: t * pps + 'px', width: Math.max(26, len * pps) + 'px', ...tint }} onMouseDown=${(e) => { if (e.button === 2) { onSelectClip && onSelectClip(c.id); return; } startClip(e, c, 'move'); }}
              onContextMenu=${(e) => ctxMenu(e, { kind: 'clip', clip: c })}>
              ${c.asset ? html`<span class="edge l" onMouseDown=${(e) => startClip(e, c, 'l')}></span>` : null}
              <${Icon} name=${c.role === 'voice' ? 'mic' : c.asset ? 'music-2' : 'audio-lines'} size=${10} /><span class="ellipsis">${label}${c.gain != null && Math.abs(c.gain - 1) > 0.01 && c.role !== 'music' ? ` · ${Math.round(c.gain * 100)}%` : ''}</span>
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
        ${project.edit ? html`<div class="tl-track sm alt edit-ops">${(project.edit.ops || []).map((o) => html`<span class="edit-op" title=${`${o.id} ${o.label}`} style=${{ left: o.t * pps + 'px', background: agentColor(o.agent) }}>${o.label}</span>`)}</div>` : null}`}
        ${snapAt !== null ? html`<div class="snap-line" style=${{ left: snapAt * pps + 'px' }}></div>` : null}
        ${dropAt ? html`<div class="drop-line" style=${{ left: dropAt.t * pps + 'px' }}><span>${dropAt.track} · ${dropAt.t.toFixed(2)}s</span></div>` : null}
        <div class="playhead" style=${{ left: time * pps + 'px' }}></div>
      </div>
    </div>
  </div>`;
}
