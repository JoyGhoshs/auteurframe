import { html, useState, useEffect, useRef, Icon, api, toast, ARCH_ICON } from './lib.js';
import { FontSelect } from './fontpicker.js';
import { ComponentParams, MotionSection } from './motiontools.js';

const ARCHS = ['kinetic-title', 'word-stack', 'big-number', 'bar-race', 'line-chart', 'donut', 'versus', 'timeline', 'quote', 'list-reveal', 'process-flow', 'icon-grid', 'doodle-explain', 'equation', 'image-focus', 'scale-zoom', 'map-pins', 'ui-mockup', 'lower-third', 'end-card', 'phone-showcase', 'ui-cascade', 'code-typing', 'shape-morph', 'particles-type', 'photo-stack', 'music-visualizer', 'paper-cut', 'vox-board', 'three-hero', 'logo-reveal', 'kinetic-beat', 'diagram-build', 'mascot-talk', 'line-art'];
const TRANS = ['fade', 'smoothleft', 'smoothright', 'smoothup', 'slideleft', 'slideup', 'wipeleft', 'wiperight', 'circleopen', 'zoomin', 'fadeblack', 'fadewhite', 'dissolve', 'pixelize', 'hlslice', 'radial', 'squeezeh', 'hblur', 'cut'];
const ENTERS = ['rise', 'fade', 'pop', 'drop', 'slideLeft', 'slideRight', 'zoom', 'blur', 'wipe', 'iris', 'spin', 'none'];
const EXITS = ['none', 'fade', 'sink', 'lift', 'shrink', 'blur', 'slideLeft', 'slideRight', 'wipe'];

function Num({ label, value, onChange, step, min, max, unit }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  const commit = () => { const n = parseFloat(v); if (!isNaN(n) && n !== value) onChange(Math.max(min ?? -1e9, Math.min(max ?? 1e9, n))); };
  return html`<label class="num-input"><b>${label}</b><input value=${v} step=${step || 1} onInput=${(e) => setV(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />${unit ? html`<b style=${{ borderRight: 0, borderLeft: '1px solid var(--line)' }}>${unit}</b>` : null}</label>`;
}

function Text({ value, onCommit, rows, placeholder, mono }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return rows ? html`<textarea class=${'textarea ' + (mono ? 'mono' : '')} rows=${rows} placeholder=${placeholder} value=${v} onInput=${(e) => setV(e.target.value)} onBlur=${() => v !== (value || '') && onCommit(v)}></textarea>`
    : html`<input class="input sm" placeholder=${placeholder} value=${v} onInput=${(e) => setV(e.target.value)} onBlur=${() => v !== (value || '') && onCommit(v)} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />`;
}

export function SceneTab({ project, scene, patch, onRun, onAdd, onDelete, onRenderScene, onThumb, busy }) {
  const [dataText, setDataText] = useState('');
  useEffect(() => setDataText(JSON.stringify(scene.data || {}, null, 1)), [scene.id, JSON.stringify(scene.data)]);
  const t = scene.transition || {};
  return html`<div>
    <div class="insp-sec">
      <div class="row"><span class="chip brand"><${Icon} name=${ARCH_ICON[scene.archetype] || 'square'} size=${12} />Scene ${scene.index + 1}</span>
        <span class=${'chip ' + (scene.source === 'agent' ? 'info' : scene.source === 'user' ? 'warn' : '')}>${scene.source || 'house'}</span>
        <span class="chip">${scene.status}</span><span class="spacer"></span>
        <button class=${'btn icon sm ' + (scene.locked ? 'on' : '')} title=${scene.locked ? 'Locked: the swarm will keep this scene' : 'Lock scene'} onClick=${() => patch({ locked: !scene.locked })}><${Icon} name=${scene.locked ? 'lock' : 'lock-open'} size=${13} /></button></div>
      <div class="field"><label class="label">Title</label><${Text} value=${scene.title} onCommit=${(v) => patch({ title: v })} /></div>
      <div class="field"><label class="label">Narration · becomes captions if no subtitles were uploaded</label><${Text} rows=${3} value=${scene.narration} onCommit=${(v) => patch({ narration: v })} /></div>
      <div class="field"><label class="label">Visual concept · what the agent animates</label><${Text} rows=${3} value=${scene.visual} placeholder="Layout, hero element, camera, how it hands off" onCommit=${(v) => patch({ visual: v })} /></div>
    </div>
    <div class="insp-sec">
      <div class="section-title">Timing and transition</div>
      <div class="grid2"><${Num} label="DUR" unit="s" value=${scene.duration} step=${0.1} min=${0.6} onChange=${(v) => patch({ duration: v })} />
        <${Num} label="START" unit="s" value=${Math.round(scene.start * 100) / 100} onChange=${() => toast('Start follows the previous scene; change durations instead')} /></div>
      <div class="grid2">
        <select class="select sm" value=${t.type || 'fade'} onChange=${(e) => patch({ transition: { ...t, type: e.target.value } })}>${TRANS.map((x) => html`<option value=${x}>${x}</option>`)}</select>
        <${Num} label="XF" unit="s" value=${t.duration ?? 0.5} step=${0.05} min=${0.1} max=${2} onChange=${(v) => patch({ transition: { ...t, duration: v } })} /></div>
    </div>
    <div class="insp-sec">
      <div class="section-title">House archetype<span class="spacer"></span><button class="btn ghost sm" onClick=${() => patch({ variant: (scene.variant || 0) + 1, reseed: (scene.reseed || 0) + 1 })}><${Icon} name="shuffle" size=${12} />Reshuffle</button></div>
      <select class="select sm" value=${scene.archetype} onChange=${(e) => patch({ archetype: e.target.value, code: null })}>${ARCHS.map((a) => html`<option value=${a}>${a}</option>`)}</select>
      <textarea class="textarea mono" rows="8" style=${{ fontSize: '11.5px' }} value=${dataText} onInput=${(e) => setDataText(e.target.value)}></textarea>
      <div class="row"><button class="btn sm" onClick=${() => { try { patch({ data: JSON.parse(dataText) }); } catch (e) { toast('Data is not valid JSON', 'err'); } }}><${Icon} name="check" size=${12} />Apply data</button>
        ${scene.code ? html`<button class="btn sm" onClick=${() => patch({ code: null })}><${Icon} name="undo-2" size=${12} />Use archetype</button>` : null}</div>
      <div class="muted" style=${{ fontSize: '11px' }}>Wrap a word in *asterisks* to accent it. Icons are Lucide names.</div>
    </div>
    <div class="insp-sec">
      <div class="section-title">Actions</div>
      <div class="grid2">
        <button class="btn sm" disabled=${busy} onClick=${onRun}><${Icon} name="sparkles" size=${12} />Re-animate</button>
        <button class="btn sm" disabled=${busy} onClick=${onRenderScene}><${Icon} name="cpu" size=${12} />Render scene</button>
        <button class="btn sm" onClick=${onThumb}><${Icon} name="image" size=${12} />Thumbnail</button>
        <button class="btn sm" onClick=${() => onAdd(scene.index + 1)}><${Icon} name="plus" size=${12} />Scene after</button>
        <button class="btn sm danger" onClick=${onDelete}><${Icon} name="trash-2" size=${12} />Delete scene</button>
      </div>
    </div>
  </div>`;
}

export function LayerTab({ project, scene, selected, onOverride, onLayerPatch, onLayerDelete, onLayerDuplicate, onClear, localTime, record, onRecord }) {
  if (!selected || !scene || selected.sceneId !== scene.id) {
    return html`<div class="empty"><${Icon} name="mouse-pointer-click" /><b style=${{ color: 'var(--ink)' }}>Select something on stage</b>Pause, then click any element to move, scale, rotate, recolour or retext it. Drag media from the left panel onto the stage to add layers.</div>`;
  }
  if (selected.user) {
    const L = (scene.layers || []).find((l) => l.id === selected.id);
    if (!L) return html`<div class="empty">Layer not found</div>`;
    const s = L.style || {};
    const p = (patch) => onLayerPatch(scene.id, L.id, patch);
    const ps = (patch) => onLayerPatch(scene.id, L.id, { style: { ...s, ...patch } });
    return html`<div>
      <div class="insp-sec"><div class="row"><span class="chip ok"><${Icon} name="layers" size=${12} />${L.kind} layer</span><span class="spacer"></span>
        <button class="btn icon sm" title="Duplicate" onClick=${() => onLayerDuplicate(scene.id, L)}><${Icon} name="copy" size=${13} /></button>
        <button class="btn icon sm danger" title="Delete" onClick=${() => onLayerDelete(scene.id, L.id)}><${Icon} name="trash-2" size=${13} /></button></div>
        ${L.kind === 'text' ? html`<${Text} rows=${2} value=${L.text} onCommit=${(v) => p({ text: v })} />` : null}
        ${L.kind === 'icon' ? html`<${Text} value=${L.icon} placeholder="lucide icon name" onCommit=${(v) => p({ icon: v })} />` : null}
      </div>
      ${L.kind === 'component' ? html`<${ComponentParams} layer=${L} onPatch=${p} />` : null}
      <${MotionSection} layer=${L} sceneDuration=${scene.duration} localTime=${localTime} onPatch=${p} record=${record} onRecord=${onRecord} Num=${Num} />
      <div class="insp-sec"><div class="section-title">Transform · % of stage</div>
        <div class="grid2"><${Num} label="X" value=${L.x} onChange=${(v) => p({ x: v })} /><${Num} label="Y" value=${L.y} onChange=${(v) => p({ y: v })} />
          <${Num} label="W" value=${L.w} onChange=${(v) => p({ w: v })} /><${Num} label="H" value=${L.h ?? ''} onChange=${(v) => p({ h: v })} />
          <${Num} label="ROT" unit="°" value=${L.rotate || 0} onChange=${(v) => p({ rotate: v })} /><${Num} label="OPA" value=${L.opacity ?? 1} step=${0.05} min=${0} max=${1} onChange=${(v) => p({ opacity: v })} /></div>
        ${L.kind === 'component' ? html`<div class="row" style=${{ marginTop: '6px' }}><span class="muted" style=${{ fontSize: '12px' }}>Stacking</span>
          <button class=${'btn sm ' + (L.back ? 'on' : '')} onClick=${() => p({ back: !L.back })}><${Icon} name="send-to-back" size=${12} />${L.back ? 'Behind the scene' : 'In front'}</button></div>` : null}</div>
      <div class="insp-sec"><div class="section-title">Timing · seconds in scene</div>
        <div class="grid2"><${Num} label="IN" value=${L.start || 0} step=${0.1} onChange=${(v) => p({ start: v })} /><${Num} label="OUT" value=${L.end ?? scene.duration} step=${0.1} onChange=${(v) => p({ end: v })} /></div>
        <div class="grid3"><select class="select sm" value=${(L.enter && L.enter.preset) || L.enter || 'rise'} onChange=${(e) => p({ enter: { preset: e.target.value, duration: 0.7 } })}>${ENTERS.map((x) => html`<option value=${x}>in: ${x}</option>`)}</select>
          <select class="select sm" value=${(L.exit && L.exit.preset) || L.exit || 'none'} onChange=${(e) => p({ exit: { preset: e.target.value, duration: 0.4 } })}>${EXITS.map((x) => html`<option value=${x}>out: ${x}</option>`)}</select>
          <select class="select sm" value=${L.emphasis || 'none'} onChange=${(e) => p({ emphasis: e.target.value })}>${['none', 'pulse', 'float', 'sway', 'spin'].map((x) => html`<option value=${x}>loop: ${x}</option>`)}</select></div></div>
      ${L.kind === 'text' || L.kind === 'shape' || L.kind === 'icon' ? html`<div class="insp-sec"><div class="section-title">Style</div>
        <div class="kv">
          ${L.kind === 'text' ? html`<span>Size</span><${Num} label="PX" value=${s.size || 64} onChange=${(v) => ps({ size: v })} />
          <span>Weight</span><select class="select sm" value=${s.weight || 700} onChange=${(e) => ps({ weight: +e.target.value })}>${[300, 400, 500, 600, 700, 800, 900].map((w) => html`<option value=${w}>${w}</option>`)}</select>
          <span>Font</span><${FontSelect} sm value=${s.font || 'var(--font-display)'} scripts=${[]} extra=${[['var(--font-display)', 'Theme display'], ['var(--font-body)', 'Theme body'], ['var(--font-mono)', 'Theme mono']]} onChange=${(v) => ps({ font: v })} />
          <span>Align</span><div class="seg">${['left', 'center', 'right'].map((a) => html`<button class=${(s.align || 'left') === a ? 'on' : ''} onClick=${() => ps({ align: a })}><${Icon} name=${'align-' + a} size=${12} /></button>`)}</div>` : null}
          <span>Colour</span><div class="row"><input type="color" value=${/^#/.test(s.color || '') ? s.color : '#111111'} onInput=${(e) => ps({ color: e.target.value })} /><button class="btn ghost sm" onClick=${() => ps({ color: 'var(--accent)' })}>accent</button><button class="btn ghost sm" onClick=${() => ps({ color: 'var(--ink)' })}>ink</button></div>
          ${L.kind !== 'icon' ? html`<span>Fill</span><div class="row"><input type="color" value=${/^#/.test(s.bg || '') ? s.bg : '#ffffff'} onInput=${(e) => ps({ bg: e.target.value })} /><button class="btn ghost sm" onClick=${() => ps({ bg: L.kind === 'shape' ? 'var(--accent)' : '' })}>reset</button></div>
          <span>Radius</span><${Num} label="PX" value=${s.radius ?? (L.kind === 'shape' ? 24 : 0)} onChange=${(v) => ps({ radius: v })} />` : null}
        </div></div>` : null}
    </div>`;
  }
  const ov = (scene.overrides || {})[selected.id] || {};
  const o = (patch) => onOverride(scene.id, selected.id, patch);
  return html`<div>
    <div class="insp-sec"><div class="row"><span class="chip info"><${Icon} name="code-xml" size=${12} />${selected.tag} · ${selected.id}</span><span class="spacer"></span>
      <button class="btn ghost sm" onClick=${() => onClear(scene.id, selected.id)}><${Icon} name="rotate-ccw" size=${12} />Reset</button></div>
      ${selected.text ? html`<div class="field"><label class="label">Text · re-splits the animation</label><${Text} rows=${2} value=${ov.text ?? selected.text} onCommit=${(v) => o({ text: v })} /></div>` : null}</div>
    <div class="insp-sec"><div class="section-title">Offset on top of the animation</div>
      <div class="grid2"><${Num} label="DX" unit="px" value=${ov.dx || 0} onChange=${(v) => o({ dx: v })} /><${Num} label="DY" unit="px" value=${ov.dy || 0} onChange=${(v) => o({ dy: v })} />
        <${Num} label="SCALE" value=${ov.scale ?? 1} step=${0.05} onChange=${(v) => o({ scale: v })} /><${Num} label="ROT" unit="°" value=${ov.rotate || 0} onChange=${(v) => o({ rotate: v })} />
        <${Num} label="OPA" value=${ov.opacity ?? 1} step=${0.05} min=${0} max=${1} onChange=${(v) => o({ opacity: v })} /><${Num} label="SIZE" unit="px" value=${ov.fontSize || ''} onChange=${(v) => o({ fontSize: v })} /></div>
      <div class="row"><span class="muted" style=${{ fontSize: '12px' }}>Colour</span><input type="color" value=${ov.color || '#111111'} onInput=${(e) => o({ color: e.target.value })} />
        <button class="btn ghost sm" onClick=${() => o({ color: 'var(--accent)' })}>accent</button><span class="spacer"></span>
        <button class=${'btn sm ' + (ov.hidden ? 'on' : '')} onClick=${() => o({ hidden: !ov.hidden })}><${Icon} name=${ov.hidden ? 'eye-off' : 'eye'} size=${12} />${ov.hidden ? 'Hidden' : 'Visible'}</button></div>
    </div></div>`;
}

export function CodeTab({ project, scene, patch }) {
  const [code, setCode] = useState('');
  const [meta, setMeta] = useState({});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    api.get(`/api/projects/${project.id}/scenes/${scene.id}/code`).then((d) => { setCode(d.code); setMeta(d); setDirty(false); });
  }, [scene.id, scene.source, scene.code ? scene.code.length : 0]);
  const onKey = (e) => {
    if (e.key === 'Tab') { e.preventDefault(); const t = e.target; const s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); setCode(t.value); setDirty(true); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); apply(); }
  };
  const apply = () => { patch({ code }); setDirty(false); toast('Scene code applied', 'ok'); };
  return html`<div class="insp-sec" style=${{ borderBottom: 0 }}>
    <div class="row"><span class="chip">${meta.source === 'agent' ? 'Agent composition' : meta.source === 'user' ? 'Your code' : 'House archetype wrapper'}</span><span class="spacer"></span>
      ${meta.agent_code ? html`<button class="btn ghost sm" onClick=${() => { setCode(meta.agent_code); setDirty(true); }}><${Icon} name="history" size=${12} />Agent draft</button>` : null}
      <button class="btn sm primary" disabled=${!dirty} onClick=${apply}><${Icon} name="play" size=${12} />Apply</button></div>
    <textarea class="code-area" spellcheck="false" value=${code} onInput=${(e) => { setCode(e.target.value); setDirty(true); }} onKeyDown=${onKey}></textarea>
    <div class="muted" style=${{ fontSize: '11px' }}>Contract: markup in .scene, one style, one script with AU.scene(({ tl, $, D, split, counter, draw, rough, camera }) => ...). All motion on tl. <span class="kbd">Ctrl S</span> applies.</div>
  </div>`;
}

const SUGGEST = ['Make it punchier and faster', 'Use a chart for the number', 'Add a slow camera push and depth', 'More whitespace, fewer elements', 'Hand-drawn doodle style', 'Make the key word huge'];

export function ChatTab({ project, scene, messages, onSend, llm, busy }) {
  const [text, setText] = useState('');
  const log = useRef(null);
  const mine = messages.filter((m) => !m.scene || m.scene === scene.id);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [mine.length]);
  const send = (msg) => { const m = (msg || text).trim(); if (!m) return; onSend(scene.id, m); setText(''); };
  return html`<div class="chat">
    <div class="chat-log" ref=${log}>
      <div class="msg sys">Direct scene ${scene.index + 1}. ${llm ? 'The animator rewrites the composition, QA checks it, and the stage updates live.' : 'No model connected: the house director re-cuts the scene (archetype, pacing, variant).'}</div>
      ${mine.map((m, i) => html`<div class=${'msg ' + m.who} key=${i}>${m.text}</div>`)}
      ${busy ? html`<div class="msg agent"><${Icon} name="loader-circle" cls="spin" size=${13} /> working on it…</div>` : null}
    </div>
    <div class="suggest">${SUGGEST.map((s) => html`<button onClick=${() => send(s)}>${s}</button>`)}</div>
    <div class="chat-input"><input class="input" placeholder="Tell the agent what to change…" value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') send(); }} />
      <button class="btn primary icon" onClick=${() => send()}><${Icon} name="send" size=${14} /></button></div>
  </div>`;
}

export function QATab({ scene }) {
  const draft = scene.qa_draft;
  const official = scene.qa;
  if (!official && !draft) return html`<div class="empty"><${Icon} name="scan-eye" />QA has not checked this scene yet.</div>`;
  const qa = official || { ...draft, round: 'draft', layers: 0 };
  const draftNote = !official && draft ? html`<div class="insp-sec"><div class="muted" style=${{ fontSize: '12px' }}>Live check from the animator's preview #${draft.preview}. The official QA score arrives when the animator hands the scene over.${draft.why ? ' Blocking: ' + draft.why : ''}</div></div>` : null;
  const color = qa.score >= 85 ? 'var(--ok)' : qa.score >= 70 ? 'var(--warn)' : 'var(--err)';
  return html`<div>
    <div class="insp-sec"><div class="row" style=${{ gap: '14px' }}>
      <div class="qa-score" style=${{ background: `conic-gradient(${color} ${qa.score * 3.6}deg, var(--bg-sunk) 0)` }}><span style=${{ width: '44px', height: '44px', borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>${qa.score}</span></div>
      <div class="col" style=${{ gap: '3px' }}><b>${qa.pass ? 'Passed' : 'Needs work'}${!official ? ' (draft)' : ''}</b><span class="muted" style=${{ fontSize: '12px' }}>Round ${qa.round || 1} · ${qa.layers || 0} layers · min type ${qa.minFont || '?'}px</span>
        ${qa.critic ? html`<span class="muted" style=${{ fontSize: '12px' }}>Critic: reads ${qa.critic.reads_clearly ?? '?'}/5 · on-bible ${qa.critic.on_bible ?? '?'}/5</span>` : null}</div></div></div>
    ${draftNote}
    <div class="insp-sec">${(qa.issues || []).length ? qa.issues.map((i) => html`<div class="qa-issue"><b class=${i.severity === 'P0' ? 'chip err' : i.severity === 'P1' ? 'chip warn' : 'chip'} style=${{ alignSelf: 'flex-start' }}>${i.severity} · ${i.kind}</b><span>${i.message}</span><span class="muted">${i.fix}</span></div>`) : html`<div class="muted">No issues. Layout, contrast, type size and motion energy all within the ruleset.</div>`}</div>
    ${qa.critic && qa.critic.frames ? html`<div class="insp-sec"><div class="section-title">Critic saw</div>${qa.critic.frames.map((f) => html`<div style=${{ fontSize: '12px' }}>· ${f}</div>`)}${qa.critic.stranger ? html`<div style=${{ fontSize: '12px', marginTop: '6px' }}><b>A stranger would say:</b> ${qa.critic.stranger}</div>` : null}</div>` : null}
  </div>`;
}
