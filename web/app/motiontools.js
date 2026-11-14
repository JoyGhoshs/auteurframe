import { html, useState, useEffect, Icon } from './lib.js';

let manifestPromise = null;
export function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('/runtime/components.json').then((r) => (r.ok ? r.json() : { components: [] })).then((d) => {
      const by = {};
      (d.components || []).forEach((c) => { by[c.name] = c; });
      return by;
    }).catch(() => ({}));
  }
  return manifestPromise;
}

export function useManifest() {
  const [m, setM] = useState(null);
  useEffect(() => { let live = true; loadManifest().then((x) => live && setM(x)); return () => { live = false; }; }, []);
  return m;
}

const MODELS3D = ['dog', 'cat', 'bird', 'car', 'tree', 'house', 'chair', 'table', 'desk-lamp', 'sofa'];
const BACKGROUND = new Set(['toon-set', 'world3d', 'particles', 'light-sweep', 'map']);
const r2 = (v) => Math.round(v * 100) / 100;

export function starter(name, value) {
  switch (name) {
    case 'toon': return { params: { preset: value || 'kid', x: 50, y: 88, h: 42, actions: [] }, label: value || 'character' };
    case 'toon-animal': return { params: { species: value || 'dog', x: 50, y: 88, h: 22, actions: [] }, label: value || 'animal' };
    case 'toon-set': return { params: { preset: value || 'street' }, label: value || 'set', back: true };
    case 'toon-prop': return { params: { name: value || 'tree', x: 50, y: 90, h: 40 }, label: value || 'prop' };
    case 'model-spec': return { params: { model: value || 'dog', x: 30, y: 14, w: 40, h: 70, actions: [] }, label: (value || 'model') + ' (3D)' };
    case 'stickman': return { params: { x: 50, y: 86, h: 46, actions: [] }, label: 'stick figure' };
    case 'speech': return { params: { target: '', text: 'Hello!' }, label: 'speech' };
    case 'world3d': return { params: { set: value || 'studio', cast: [] }, label: '3D world', back: true };
    default: return { params: {}, label: name, back: BACKGROUND.has(name) };
  }
}

export function componentLayer(name, value, startAt) {
  const s = starter(name, value);
  const p = s.params;
  return { kind: 'component', component: name, params: p, name: s.label, back: !!s.back, x: p.x ?? 50, y: p.y ?? 50, w: p.w ?? 30, start: startAt || 0, enter: { preset: 'none' } };
}

export function componentPatch(l, patch) {
  const out = { ...l, ...patch };
  const params = { ...(l.params || {}), ...(patch.params || {}) };
  if (patch.params) {
    if ('x' in patch.params) out.x = patch.params.x;
    if ('y' in patch.params) out.y = patch.params.y;
  }
  if ('x' in patch && 'x' in params) params.x = r2(patch.x);
  if ('y' in patch && 'y' in params) params.y = r2(patch.y);
  if ('w' in patch && l.w) {
    const k = patch.w / l.w;
    if (params.h != null) params.h = r2(params.h * k);
    else if (params.w != null) params.w = r2(params.w * k);
  }
  out.params = params;
  return out;
}

const EASES = ['inOut', 'linear', 'in', 'out', 'back', 'bounce', 'hold'];
const EASE = {
  linear: (u) => u, in: (u) => u * u * u, out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  back: (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
  bounce: (u) => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) { u -= 1.5 / d; return n * u * u + 0.75; } if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + 0.9375; } u -= 2.625 / d; return n * u * u + 0.984375; },
  hold: () => 0
};
const KEY0 = { dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1 };
const norm = (k) => ({ ...KEY0, ease: 'inOut', ...k });

export function keyAt(keys, t) {
  const ks = (keys || []).map(norm).sort((a, b) => a.t - b.t);
  if (!ks.length) return { ...KEY0 };
  if (t <= ks[0].t) return ks[0];
  const last = ks[ks.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (i < ks.length - 2 && ks[i + 1].t <= t) i++;
  const a = ks[i], b = ks[i + 1];
  const u = (EASE[b.ease] || EASE.inOut)((t - a.t) / Math.max(1e-4, b.t - a.t));
  const L = (p, q) => p + (q - p) * u;
  return { dx: L(a.dx, b.dx), dy: L(a.dy, b.dy), scale: L(a.scale, b.scale), rotate: L(a.rotate, b.rotate), opacity: L(a.opacity, b.opacity) };
}

export function setKey(keys, t, values) {
  const ks = (keys || []).map(norm);
  const at = r2(t);
  const i = ks.findIndex((k) => Math.abs(k.t - at) < 0.04);
  const base = i >= 0 ? ks[i] : { ...keyAt(ks, at), t: at, ease: 'inOut' };
  const next = { ...base, ...values, t: at };
  ['dx', 'dy', 'scale', 'rotate', 'opacity'].forEach((k) => { next[k] = r2(next[k]); });
  if (i >= 0) ks[i] = next; else ks.push(next);
  return ks.sort((a, b) => a.t - b.t);
}

export function recordDrag(L, patch, t) {
  const cur = keyAt(L.keys, t);
  const vals = {};
  if ('x' in patch) vals.dx = cur.dx + (patch.x - (L.x ?? 10));
  if ('y' in patch) vals.dy = cur.dy + (patch.y - (L.y ?? 10));
  if ('rotate' in patch) vals.rotate = patch.rotate;
  if ('w' in patch && L.w) vals.scale = cur.scale * (patch.w / L.w);
  return { keys: setKey(L.keys, t, vals) };
}

const PRESETS = [
  ['slide-in-left', 'Slide in from left', (s, e, t) => [{ t: s, dx: -60 }, { t: s + 0.8, dx: 0, ease: 'out' }]],
  ['slide-in-right', 'Slide in from right', (s, e, t) => [{ t: s, dx: 60 }, { t: s + 0.8, dx: 0, ease: 'out' }]],
  ['slide-out-right', 'Slide out right', (s, e, t) => [{ t: Math.max(s, e - 0.8), dx: 0 }, { t: e, dx: 60, ease: 'in' }]],
  ['walk-across', 'Travel across (left to right)', (s, e, t) => [{ t: s, dx: -30 }, { t: e, dx: 30, ease: 'linear' }]],
  ['walk-back', 'Travel across (right to left)', (s, e, t) => [{ t: s, dx: 30 }, { t: e, dx: -30, ease: 'linear' }]],
  ['drop-bounce', 'Drop in with bounce', (s, e, t) => [{ t: s, dy: -50 }, { t: s + 1.0, dy: 0, ease: 'bounce' }]],
  ['pop', 'Pop in', (s, e, t) => [{ t: s, scale: 0.01 }, { t: s + 0.45, scale: 1, ease: 'back' }]],
  ['hop', 'Three hops at playhead', (s, e, t) => [0, 1, 2].flatMap((i) => [{ t: t + i * 0.5, dy: 0, ease: 'in' }, { t: t + i * 0.5 + 0.25, dy: -8, ease: 'out' }]).concat([{ t: t + 1.5, dy: 0, ease: 'in' }])],
  ['arc', 'Arc jump right at playhead', (s, e, t) => [{ t, dx: 0, dy: 0 }, { t: t + 0.4, dx: 10, dy: -16, ease: 'out' }, { t: t + 0.8, dx: 20, dy: 0, ease: 'in' }]],
  ['shake', 'Shake at playhead', (s, e, t) => Array.from({ length: 11 }, (_, i) => ({ t: t + i * 0.06, dx: i === 0 || i === 10 ? 0 : (i % 2 ? 1.2 : -1.2), ease: 'linear' }))],
  ['float', 'Gentle float', (s, e, t) => { const out = []; for (let x = s, i = 0; x <= e + 0.001; x += 0.9, i++) out.push({ t: x, dy: i % 2 ? -2 : 0, ease: 'inOut' }); return out; }],
  ['push-in', 'Slow push in', (s, e, t) => [{ t: s, scale: 1 }, { t: e, scale: 1.2, ease: 'inOut' }]],
  ['spin', 'Spin once', (s, e, t) => [{ t: s, rotate: 0 }, { t: e, rotate: 360, ease: 'linear' }]],
  ['fade-in-out', 'Fade in and out', (s, e, t) => [{ t: s, opacity: 0 }, { t: s + 0.5, opacity: 1 }, { t: Math.max(s + 0.6, e - 0.5), opacity: 1 }, { t: e, opacity: 0 }]]
];

export function MotionSection({ layer, sceneDuration, localTime, onPatch, record, onRecord, Num }) {
  const L = layer;
  const keys = (L.keys || []).map(norm).sort((a, b) => a.t - b.t);
  const s0 = L.start || 0, e0 = L.end ?? sceneDuration;
  const t = Math.max(0, Math.min(sceneDuration, localTime || 0));
  const put = (ks) => onPatch({ keys: ks });
  const edit = (i, field, v) => put(keys.map((k, j) => (j === i ? { ...k, [field]: v } : k)).sort((a, b) => a.t - b.t));
  const applyPreset = (id) => {
    const p = PRESETS.find((x) => x[0] === id);
    if (!p) return;
    const raw = p[2](s0, e0, t).map((k) => ({ ...k, t: r2(Math.max(0, Math.min(sceneDuration, k.t))) }));
    let ks = keys.filter((k) => !raw.some((r) => Math.abs(r.t - k.t) < 0.04));
    raw.forEach((k) => { ks = setKey(ks, k.t, k); });
    put(ks);
  };
  const cur = keyAt(keys, t);
  return html`<div class="insp-sec"><div class="row"><div class="section-title" style=${{ margin: 0 }}>Motion · keyframes</div><span class="spacer"></span>
      <button class=${'btn sm ' + (record ? 'on danger' : '')} title="While on, dragging, resizing or rotating this layer on stage writes a keyframe at the playhead" onClick=${() => onRecord(!record)}><${Icon} name="circle-dot" size=${12} />${record ? 'Recording' : 'Record'}</button></div>
    <div class="muted" style=${{ fontSize: '12px', margin: '4px 0 8px' }}>Playhead ${t.toFixed(2)}s · offset ${cur.dx.toFixed(1)}%, ${cur.dy.toFixed(1)}% · scale ${cur.scale.toFixed(2)} · ${cur.rotate.toFixed(0)}° · opacity ${cur.opacity.toFixed(2)}</div>
    <div class="row" style=${{ gap: '6px', flexWrap: 'wrap' }}>
      <button class="btn sm" onClick=${() => put(setKey(keys, t, {}))}><${Icon} name="diamond-plus" size=${12} />Key at playhead</button>
      <select class="select sm" value="" onChange=${(e) => { applyPreset(e.target.value); e.target.value = ''; }}><option value="">Motion preset…</option>${PRESETS.map((p) => html`<option value=${p[0]}>${p[1]}</option>`)}</select>
      ${keys.length ? html`<button class="btn ghost sm danger" onClick=${() => put([])}><${Icon} name="trash-2" size=${12} />Clear</button>` : null}
    </div>
    ${keys.length ? html`<div class="keylist">${keys.map((k, i) => html`<div class="keyrow">
      <${Num} label="T" value=${k.t} step=${0.1} min=${0} max=${sceneDuration} onChange=${(v) => edit(i, 't', r2(v))} />
      <${Num} label="X" unit="%" value=${k.dx} onChange=${(v) => edit(i, 'dx', v)} />
      <${Num} label="Y" unit="%" value=${k.dy} onChange=${(v) => edit(i, 'dy', v)} />
      <${Num} label="S" value=${k.scale} step=${0.05} min=${0} onChange=${(v) => edit(i, 'scale', v)} />
      <${Num} label="R" unit="°" value=${k.rotate} onChange=${(v) => edit(i, 'rotate', v)} />
      <${Num} label="O" value=${k.opacity} step=${0.05} min=${0} max=${1} onChange=${(v) => edit(i, 'opacity', v)} />
      <select class="select sm" title="Easing into this key" value=${k.ease} onChange=${(e) => edit(i, 'ease', e.target.value)}>${EASES.map((x) => html`<option value=${x}>${x}</option>`)}</select>
      <button class="btn icon sm" title="Delete key" onClick=${() => put(keys.filter((_, j) => j !== i))}><${Icon} name="x" size=${12} /></button>
    </div>`)}</div>` : html`<div class="muted" style=${{ fontSize: '12px', marginTop: '6px' }}>No keyframes. Add one at the playhead, pick a preset, or switch on Record and drag the layer on stage.</div>`}
  </div>`;
}

function ParamField({ name, spec, value, onChange }) {
  const [raw, setRaw] = useState('');
  const [err, setErr] = useState('');
  const isJson = spec.type === 'array' || spec.type === 'object';
  useEffect(() => { if (isJson) setRaw(value == null ? '' : JSON.stringify(value, null, 1)); }, [JSON.stringify(value)]);
  const label = html`<span title=${spec.doc || ''}>${name}</span>`;
  if (spec.type === 'enum') {
    return html`${label}<select class="select sm" value=${value ?? spec.default ?? ''} onChange=${(e) => onChange(e.target.value)}>${(spec.options || []).map((o) => html`<option value=${o}>${o === '' ? '(default)' : o}</option>`)}</select>`;
  }
  if (spec.type === 'boolean') return html`${label}<input type="checkbox" checked=${!!(value ?? spec.default)} onChange=${(e) => onChange(e.target.checked)} />`;
  if (spec.type === 'number') return html`${label}<input class="input sm" type="number" step="any" value=${value ?? spec.default ?? ''} onChange=${(e) => { const n = parseFloat(e.target.value); onChange(isNaN(n) ? undefined : n); }} />`;
  if (isJson) {
    return html`${label}<div><textarea class="textarea mono" rows="3" value=${raw} onInput=${(e) => setRaw(e.target.value)} onBlur=${() => {
      if (!raw.trim()) { setErr(''); onChange(undefined); return; }
      try { onChange(JSON.parse(raw)); setErr(''); } catch (e) { setErr('Not valid JSON: ' + e.message.slice(0, 60)); }
    }}></textarea>${err ? html`<div class="muted" style=${{ color: 'var(--danger, #c62f2f)', fontSize: '11px' }}>${err}</div>` : null}</div>`;
  }
  const colourish = /colou?r|skin|shirt|pants|coat|collar|bg|fill|stroke/i.test(name);
  return html`${label}<div class="row">${colourish ? html`<input type="color" value=${/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#888888'} onInput=${(e) => onChange(e.target.value)} />` : null}
    <input class="input sm" value=${value ?? ''} placeholder=${spec.default ?? ''} onChange=${(e) => onChange(e.target.value === '' ? undefined : e.target.value)} /></div>`;
}

export function ComponentParams({ layer, onPatch }) {
  const m = useManifest();
  const meta = m && m[layer.component];
  const [all, setAll] = useState(false);
  if (!m) return html`<div class="insp-sec muted">Loading component settings…</div>`;
  if (!meta) return html`<div class="insp-sec muted">Unknown component ${layer.component}</div>`;
  const params = layer.params || {};
  const specs = Object.entries(meta.params || {});
  const set = (k, v) => { const next = { ...params }; if (v === undefined) delete next[k]; else next[k] = v; onPatch({ params: next }); };
  const shown = all ? specs : specs.filter(([k]) => k in params || specs.length <= 10 || /^(preset|species|name|model|set|look|text|target|style|kind|color|expression|facing|x|y|h|w|actions)$/.test(k));
  return html`<div class="insp-sec"><div class="row"><div class="section-title" style=${{ margin: 0 }}>${layer.component} settings</div><span class="spacer"></span>
      <button class="btn ghost sm" onClick=${() => setAll(!all)}>${all ? 'Fewer' : `All ${specs.length}`}</button></div>
    <div class="muted" style=${{ fontSize: '12px', margin: '4px 0 8px' }}>${meta.description.slice(0, 220)}</div>
    <div class="kv">${shown.map(([k, spec]) => html`<${ParamField} key=${k} name=${k} spec=${spec} value=${params[k]} onChange=${(v) => set(k, v)} />`)}</div>
    ${meta.example ? html`<details style=${{ marginTop: '8px' }}><summary class="muted" style=${{ fontSize: '12px', cursor: 'pointer' }}>Example</summary><pre class="mono" style=${{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>${meta.example}</pre></details>` : null}
  </div>`;
}

export function ComponentsPanel({ scene, onAdd }) {
  const m = useManifest();
  const [q, setQ] = useState('');
  if (!m) return html`<div class="muted">Loading the component library…</div>`;
  const opts = (name, key) => (((m[name] || {}).params || {})[key] || {}).options || [];
  const groups = [
    ['Characters', 'toon', opts('toon', 'preset').filter(Boolean)],
    ['Animals', 'toon-animal', opts('toon-animal', 'species')],
    ['Scenery and sets', 'toon-set', opts('toon-set', 'preset')],
    ['Props, buildings, furniture', 'toon-prop', opts('toon-prop', 'name')],
    ['3D models', 'model-spec', MODELS3D]
  ];
  const term = q.trim().toLowerCase();
  const match = (s) => !term || s.toLowerCase().includes(term);
  const others = Object.values(m).filter((c) => match(c.name + ' ' + c.category + ' ' + c.description)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const drag = (name, value) => (e) => { e.dataTransfer.setData('application/x-auteur', JSON.stringify({ layer: componentLayer(name, value) })); };
  return html`<div>
    <div class="muted" style=${{ fontSize: '12px', marginBottom: '8px' }}>Click to add to scene ${scene ? scene.index + 1 : ''} at the playhead, or drag onto the stage. Then set details and keyframes in the Layer tab.</div>
    <input class="input sm" placeholder="Search characters, props, sets, components" value=${q} onInput=${(e) => setQ(e.target.value)} style=${{ width: '100%', marginBottom: '10px' }} />
    ${groups.map(([title, name, values]) => {
      const vs = values.filter(match);
      if (!vs.length) return null;
      return html`<div class="comp-group"><div class="section-title">${title} <span class="muted">${vs.length}</span></div>
        <div class="chip-cloud">${vs.map((v) => html`<button class="chip btnchip" draggable onDragStart=${drag(name, v)} onClick=${() => onAdd(componentLayer(name, v))}>${v}</button>`)}</div></div>`;
    })}
    ${others.length ? html`<div class="comp-group"><div class="section-title">All components <span class="muted">${others.length}</span></div>
      ${others.map((c) => html`<button class="comp-row" draggable onDragStart=${drag(c.name)} onClick=${() => onAdd(componentLayer(c.name))} title=${c.description}>
        <b>${c.name}</b><span class="chip">${c.category}</span><span class="muted ellipsis">${c.description.slice(0, 90)}</span></button>`)}</div>` : null}
  </div>`;
}
