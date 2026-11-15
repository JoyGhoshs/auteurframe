import { html, useState, useEffect, Icon, api, toast } from './lib.js';

const SLIDERS = [
  ['exposure', 'Exposure'], ['contrast', 'Contrast'], ['saturation', 'Saturation'], ['temperature', 'Temperature'], ['tint', 'Tint'],
  ['split', 'Teal / orange split'], ['lift', 'Shadows'], ['gamma', 'Midtones'], ['gain', 'Highlights'], ['fade', 'Fade'], ['vignette', 'Vignette'], ['grain', 'Grain'], ['sharpen', 'Sharpen'], ['bw', 'Black and white']
];
const CAM_PRESETS = [['', 'No camera move'], ['ken-burns-in', 'Ken Burns in'], ['ken-burns-out', 'Ken Burns out'], ['pan-left', 'Pan left'], ['pan-right', 'Pan right'], ['pan-up', 'Pan up'], ['pan-down', 'Pan down'], ['punch-in', 'Punch in'], ['push-out', 'Push out'], ['drift', 'Handheld drift']];
const EASES = ['power2.inOut', 'sine.inOut', 'expo.out', 'expo.inOut', 'power3.out', 'back.out(1.6)', 'none'];
const LOUDNESS = [[-14, 'Social and streaming (-14 LUFS)'], [-16, 'Web and podcast (-16 LUFS)'], [-19, 'Speech heavy (-19 LUFS)'], [-23, 'Broadcast (-23 LUFS)']];

let PRESETS = null;
const listeners = new Set();
export function loadGrades() {
  if (PRESETS) return Promise.resolve(PRESETS);
  return api.get('/api/grades').then((d) => { PRESETS = d; listeners.forEach((f) => f(d)); return d; }).catch(() => null);
}
export function useGrades() {
  const [g, setG] = useState(PRESETS);
  useEffect(() => { if (!PRESETS) { listeners.add(setG); loadGrades(); return () => listeners.delete(setG); } }, []);
  return g;
}

function values(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const base = PRESETS && PRESETS.presets ? ((PRESETS.presets.find((p) => p.id === spec.preset) || {}).values || {}) : {};
  const v = { ...base };
  Object.keys(spec).forEach((k) => { if (SLIDERS.some(([s]) => s === k) && spec[k] != null) v[k] = +spec[k]; });
  const amt = spec.amount == null ? 100 : +spec.amount;
  Object.keys(v).forEach((k) => { v[k] = v[k] * amt / 100; });
  return v;
}

function cssOf(v) {
  if (!v) return { filter: '', vignette: 0, tint: null };
  const parts = [];
  if (v.exposure) parts.push(`brightness(${(1 + v.exposure / 100 * 0.7).toFixed(3)})`);
  if (v.contrast) parts.push(`contrast(${(1 + v.contrast / 100 * 0.6).toFixed(3)})`);
  if (v.bw) parts.push(`grayscale(${Math.min(1, v.bw / 100).toFixed(2)})`);
  if (v.saturation) parts.push(`saturate(${Math.max(0, 1 + v.saturation / 100).toFixed(3)})`);
  if (v.temperature > 0) parts.push(`sepia(${Math.min(0.6, v.temperature / 100 * 0.45).toFixed(3)})`);
  if (v.fade > 0) parts.push(`contrast(${(1 - v.fade / 100 * 0.18).toFixed(3)}) brightness(${(1 + v.fade / 100 * 0.06).toFixed(3)})`);
  let tint = null;
  const t = v.temperature || 0, tv = v.tint || 0;
  if (t < 0 && -t >= Math.abs(tv)) tint = `rgba(60,120,255,${Math.min(0.22, -t / 100 * 0.2).toFixed(3)})`;
  else if (tv) tint = tv > 0 ? `rgba(255,60,200,${Math.min(0.18, tv / 100 * 0.15).toFixed(3)})` : `rgba(60,255,120,${Math.min(0.18, -tv / 100 * 0.15).toFixed(3)})`;
  return { filter: parts.join(' '), vignette: v.vignette || 0, tint };
}

export function gradePreview(project, scene, includeFilm) {
  const film = includeFilm ? cssOf(values(project && project.grade)) : { filter: '', vignette: 0, tint: null };
  const sc = cssOf(values(scene && scene.grade));
  return { filter: [sc.filter, film.filter].filter(Boolean).join(' '), vignette: Math.max(sc.vignette, film.vignette), tint: sc.tint || film.tint };
}

function GradeEditor({ value, onChange, allowInherit }) {
  const grades = useGrades();
  const g = value || {};
  const v = values(g) || {};
  const [open, setOpen] = useState(false);
  const set = (k, x) => onChange({ ...g, [k]: x });
  return html`<div>
    <div class="grid2">
      <select class="select sm" value=${g.preset || 'none'} onChange=${(e) => onChange(e.target.value === 'none' && allowInherit ? null : { preset: e.target.value, amount: g.amount ?? 100 })}>
        ${(grades ? grades.presets : [{ id: 'none', label: 'No grade' }]).map((p) => html`<option value=${p.id}>${allowInherit && p.id === 'none' ? 'Use the film grade' : p.label}</option>`)}
      </select>
      <label class="num-input"><b>MIX</b><input type="range" min="0" max="100" value=${g.amount ?? 100} onChange=${(e) => set('amount', +e.target.value)} /></label>
    </div>
    <button class="btn ghost sm" style=${{ marginTop: '6px' }} onClick=${() => setOpen(!open)}><${Icon} name=${open ? 'chevron-up' : 'sliders-horizontal'} size=${12} />${open ? 'Hide controls' : 'Fine tune'}</button>
    ${open ? html`<div class="grade-sliders">${SLIDERS.map(([k, label]) => html`<label class="grade-row" key=${k}><span>${label}</span>
        <input type="range" min=${k === 'bw' || k === 'fade' || k === 'vignette' || k === 'grain' || k === 'sharpen' ? 0 : -100} max="100" value=${Math.round(g[k] ?? v[k] ?? 0)}
          onChange=${(e) => set(k, +e.target.value)} onDblClick=${() => { const n = { ...g }; delete n[k]; onChange(n); }} />
        <b>${Math.round(g[k] ?? v[k] ?? 0)}</b></label>`)}
      <div class="muted" style=${{ fontSize: '11px' }}>Double-click a slider to reset it to the preset. The master render applies the exact grade; the stage shows a close preview.</div></div>` : null}
  </div>`;
}

function CameraEditor({ scene, time, patch }) {
  const cam = scene.camera || {};
  const keys = Array.isArray(cam.keys) ? cam.keys : [];
  const local = Math.max(0, Math.min(scene.duration, +(time - scene.start).toFixed(2)));
  const setCam = (c) => patch({ camera: c && (c.preset || (c.keys && c.keys.length) || c.shake || (c.follow && c.follow.length)) ? c : null });
  const follow = Array.isArray(cam.follow) ? cam.follow : [];
  const targets = (scene.layers || []).filter((L) => !L.back);
  const tname = (L) => (L.name || L.text || (L.params && (L.params.preset || L.params.species || L.params.name)) || L.component || L.kind || L.id).toString().slice(0, 28);
  const setFollow = (list) => setCam({ ...cam, follow: list });
  const addFollow = () => {
    const actor = targets.find((L) => L.kind === 'component' && /toon|stickman|anime-figure|character|mascot|model-spec/.test(L.component || '')) || targets[0];
    if (!actor) return;
    const from = follow.length ? Math.min(scene.duration - 0.5, local) : 0;
    setFollow(follow.concat([{ target: actor.id, from: +from.toFixed(2), to: scene.duration, zoom: 1.6, lag: 0.35, lead: 0.2, offsetX: 0, offsetY: 0 }]));
  };
  const setF = (i, k, v) => setFollow(follow.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const addKey = () => {
    const prev = keys.length ? keys.reduce((a, k) => (Math.abs(k.t - local) < Math.abs(a.t - local) ? k : a), keys[0]) : { zoom: 1.15, x: 50, y: 50 };
    const next = keys.filter((k) => Math.abs(k.t - local) > 0.02).concat([{ t: local, zoom: prev.zoom ?? 1.15, x: prev.x ?? 50, y: prev.y ?? 50, rotate: prev.rotate || 0, ease: prev.ease || 'power2.inOut' }]).sort((a, b) => a.t - b.t);
    setCam({ ...cam, preset: '', keys: next });
  };
  const setKey = (i, k, val) => setCam({ ...cam, keys: keys.map((x, j) => (j === i ? { ...x, [k]: val } : x)) });
  return html`<div>
    <div class="grid2">
      <select class="select sm" value=${cam.preset || ''} onChange=${(e) => setCam({ ...cam, preset: e.target.value, keys: e.target.value ? [] : keys })}>
        ${CAM_PRESETS.map(([id, label]) => html`<option value=${id}>${label}</option>`)}</select>
      <label class="num-input"><b>AMT</b><input type="range" min="0" max="200" value=${Math.round((cam.intensity ?? 1) * 100)} onChange=${(e) => setCam({ ...cam, intensity: +e.target.value / 100 })} /></label>
    </div>
    <div class="grid2" style=${{ marginTop: '6px' }}>
      <button class="btn sm" onClick=${addKey}><${Icon} name="diamond-plus" size=${12} />Keyframe at ${local.toFixed(2)}s</button>
      <label class="num-input"><b>SHAKE</b><input type="range" min="0" max="200" value=${Math.round((cam.shake || 0) * 100)} onChange=${(e) => setCam({ ...cam, shake: +e.target.value / 100 })} /></label>
    </div>
    ${keys.map((k, i) => html`<div class="cam-key" key=${i}>
      <span class="chip">${(+k.t).toFixed(2)}s</span>
      <label title="Zoom">Z<input type="number" step="0.05" min="1" max="4" value=${k.zoom} onChange=${(e) => setKey(i, 'zoom', Math.max(1, +e.target.value))} /></label>
      <label title="Focus x in percent">X<input type="number" step="1" min="0" max="100" value=${k.x} onChange=${(e) => setKey(i, 'x', +e.target.value)} /></label>
      <label title="Focus y in percent">Y<input type="number" step="1" min="0" max="100" value=${k.y} onChange=${(e) => setKey(i, 'y', +e.target.value)} /></label>
      <label title="Rotation in degrees">R<input type="number" step="0.5" value=${k.rotate || 0} onChange=${(e) => setKey(i, 'rotate', +e.target.value)} /></label>
      <select class="select sm" value=${k.ease || 'power2.inOut'} onChange=${(e) => setKey(i, 'ease', e.target.value)}>${EASES.map((x) => html`<option value=${x}>${x}</option>`)}</select>
      <button class="btn icon sm" title="Delete keyframe" onClick=${() => setCam({ ...cam, keys: keys.filter((_, j) => j !== i) })}><${Icon} name="x" size=${12} /></button>
    </div>`)}
    <div class="muted" style=${{ fontSize: '11px' }}>Zoom pushes in around the focus point; the frame edge never shows. Keyframes replace the preset.</div>
    <div class="row" style=${{ marginTop: '10px' }}><b style=${{ fontSize: '12px' }}>Follow camera</b><span class="spacer"></span>
      <button class="btn sm" disabled=${!targets.length} title=${targets.length ? 'Lock the camera onto a layer, like a game camera' : 'Add a character or layer first'} onClick=${addFollow}><${Icon} name="crosshair" size=${12} />Follow a layer</button></div>
    ${follow.map((f, i) => html`<div class="follow-row" key=${i}>
      <div class="row" style=${{ gap: '6px' }}><select class="select sm" style=${{ flex: 1 }} value=${f.target} onChange=${(e) => setF(i, 'target', e.target.value)}>
        ${targets.map((L) => html`<option value=${L.id}>${tname(L)}</option>`)}${targets.some((L) => L.id === f.target) ? null : html`<option value=${f.target}>missing layer</option>`}</select>
        <button class="btn icon sm" title="Remove" onClick=${() => setFollow(follow.filter((_, j) => j !== i))}><${Icon} name="x" size=${12} /></button></div>
      <div class="follow-grid">
        <label title="Start (s)">FROM<input type="number" step="0.1" min="0" max=${scene.duration} value=${f.from ?? 0} onChange=${(e) => setF(i, 'from', Math.max(0, +e.target.value))} /></label>
        <label title="End (s)">TO<input type="number" step="0.1" min="0" max=${scene.duration} value=${f.to ?? scene.duration} onChange=${(e) => setF(i, 'to', Math.min(scene.duration, +e.target.value))} /></label>
        <label title="Zoom while following">ZOOM<input type="number" step="0.05" min="1" max="4" value=${f.zoom ?? 1.6} onChange=${(e) => setF(i, 'zoom', Math.max(1, +e.target.value))} /></label>
        <label title="Smoothing: how far the camera trails the target, in seconds">LAG<input type="number" step="0.05" min="0" max="2" value=${f.lag ?? 0.35} onChange=${(e) => setF(i, 'lag', Math.max(0, +e.target.value))} /></label>
        <label title="Look-ahead: frame where the target is going, in seconds">LEAD<input type="number" step="0.05" min="0" max="1.5" value=${f.lead ?? 0.2} onChange=${(e) => setF(i, 'lead', Math.max(0, +e.target.value))} /></label>
        <label title="Framing offset x in % (rule of thirds: -12 or 12)">OFF X<input type="number" step="1" value=${f.offsetX || 0} onChange=${(e) => setF(i, 'offsetX', +e.target.value)} /></label>
        <label title="Framing offset y in %">OFF Y<input type="number" step="1" value=${f.offsetY || 0} onChange=${(e) => setF(i, 'offsetY', +e.target.value)} /></label>
        <label title="Keep the horizon still, follow sideways only" class="chk"><input type="checkbox" checked=${!!f.lockY} onChange=${(e) => setF(i, 'lockY', e.target.checked)} />Lock height</label>
      </div></div>`)}
    ${follow.length ? html`<div class="muted" style=${{ fontSize: '11px' }}>Overlapping follows blend from one target to the next, so you can hand the camera from character to character.</div>` : null}
  </div>`;
}

function AudioMaster({ project, patchProject }) {
  const a = project.audio || {};
  const m = { lufs: -16, true_peak: -1.5, duck: 60, voice_clarity: true, sfx_db: -6, music_eq: true, ...(a.master || {}) };
  const set = (k, v) => patchProject({ audio: { master: { ...m, [k]: v } } });
  return html`<div>
    <select class="select sm" value=${m.lufs} onChange=${(e) => set('lufs', +e.target.value)}>${LOUDNESS.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
    <label class="grade-row"><span>Music ducking under voice</span><input type="range" min="0" max="100" value=${m.duck} onChange=${(e) => set('duck', +e.target.value)} /><b>${m.duck}</b></label>
    <label class="grade-row"><span>Sound effects level</span><input type="range" min="-24" max="6" value=${m.sfx_db} onChange=${(e) => set('sfx_db', +e.target.value)} /><b>${m.sfx_db} dB</b></label>
    <label class="grade-row"><span>True peak ceiling</span><input type="range" min="-6" max="0" step="0.5" value=${m.true_peak} onChange=${(e) => set('true_peak', +e.target.value)} /><b>${m.true_peak} dB</b></label>
    <label class="check-row"><input type="checkbox" checked=${m.voice_clarity} onChange=${(e) => set('voice_clarity', e.target.checked)} />Voice clarity (high-pass, de-mud, presence, gentle compression)</label>
    <label class="check-row"><input type="checkbox" checked=${m.music_eq} onChange=${(e) => set('music_eq', e.target.checked)} />Carve the music around the voice</label>
  </div>`;
}

export function LookTab({ project, scene, time, patch, patchProject }) {
  return html`<div>
    <div class="insp-sec">
      <div class="section-title"><${Icon} name="palette" size=${13} />Film colour grade</div>
      <${GradeEditor} value=${project.grade} onChange=${(g) => patchProject({ grade: g })} />
    </div>
    ${scene ? html`<div class="insp-sec">
      <div class="section-title"><${Icon} name="swatch-book" size=${13} />Scene ${scene.index + 1} grade</div>
      <${GradeEditor} value=${scene.grade} allowInherit=${true} onChange=${(g) => patch({ grade: g })} />
      <div class="muted" style=${{ fontSize: '11px' }}>Applied before the film grade, for this scene only.</div>
    </div>
    <div class="insp-sec">
      <div class="section-title"><${Icon} name="video" size=${13} />Scene ${scene.index + 1} camera</div>
      <${CameraEditor} scene=${scene} time=${time} patch=${patch} />
    </div>` : null}
    <div class="insp-sec">
      <div class="section-title"><${Icon} name="audio-lines" size=${13} />Audio master</div>
      <${AudioMaster} project=${project} patchProject=${patchProject} />
    </div>
  </div>`;
}
