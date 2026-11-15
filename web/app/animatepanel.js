import { html, useState, Icon, api, toast, Modal } from './lib.js';
import { thumbUrl } from './motiontools.js';

const KIND_ICON = { text: 'type', image: 'image', video: 'film', shape: 'square', icon: 'shapes', sticker: 'sticker', component: 'person-standing' };
const QUICK = ['Faster', 'Slower', 'Bouncier', 'Smoother', 'Fade in', 'Pop in', 'Float', 'Stagger 0.2s', 'Fade out'];
const IDEAS = {
  component: ['walk to the right side, stop and wave', 'run in from the left, look around, then jump with joy', 'sneak slowly to the centre, then get scared'],
  text: ['slam in word by word, then pulse once on the last word', 'type it on, hold, then slide out to the left', 'drop in with a bounce and a slight tilt'],
  other: ['fly in on an arc from the top left and settle with a small bounce', 'slowly push in and drift for a cinematic feel', 'spin in, then float gently']
};

export function layerName(L) {
  return (L.name || L.text || (L.params && (L.params.preset || L.params.species || L.params.name || L.params.model)) || L.component || L.kind || 'layer').toString().slice(0, 40);
}

export function LayerThumb({ L, project }) {
  if (L.kind === 'component') {
    const p = L.params || {};
    const v = p.preset || p.species || p.name || p.model || p.outfit || p.style || p.kind || '';
    return html`<img class="layer-thumb" src=${thumbUrl(L.component, v)} loading="lazy" alt="" />`;
  }
  if ((L.kind === 'image' || L.kind === 'sticker') && L.src) {
    const a = (project.assets || []).find((x) => x.id === L.src);
    if (a && a.url) return html`<img class="layer-thumb" src=${a.url} loading="lazy" alt="" />`;
  }
  return html`<span class="layer-thumb"><${Icon} name=${KIND_ICON[L.kind] || 'square'} size=${14} /></span>`;
}

export function AnimateDialog({ project, scene, ids, onClose, onDone, llm, freeChoice }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [useFree, setUseFree] = useState(false);
  const layers = (scene.layers || []).filter((L) => ids.includes(L.id));
  const kind = layers.some((L) => L.kind === 'component') ? 'component' : layers.some((L) => L.kind === 'text') ? 'text' : 'other';
  const send = async (instruction) => {
    const msg = (instruction || text).trim();
    if (!msg || busy) return;
    setBusy(true);
    try {
      const r = await api.post(`/api/projects/${project.id}/scenes/${scene.id}/animate`, { ids, instruction: msg, use_free: freeChoice && useFree });
      toast(`${r.draft.by === 'instant' ? 'Instant' : 'Agent'} draft ready: ${r.draft.note}. Apply or discard it above the stage.`, 'ok');
      onDone();
      onClose();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  return html`<${Modal} title=${`Animate ${layers.length} layer${layers.length > 1 ? 's' : ''}`} icon="wand-sparkles" onClose=${busy ? () => null : onClose} width="600px"
    foot=${html`<span class="muted grow" style=${{ fontSize: '12px' }}>${busy ? 'The animator is working…' : 'Changes arrive as a draft you can play, apply or discard.'}</span>
      <button class="btn" disabled=${busy} onClick=${onClose}>Cancel</button>
      <button class="btn brand" disabled=${busy || !text.trim()} onClick=${() => send()}><${Icon} name=${busy ? 'loader-circle' : 'send'} cls=${busy ? 'spin' : ''} size=${13} />Animate</button>`}>
    <div class="sel-chips">${layers.map((L) => html`<span class="chip" key=${L.id}><${LayerThumb} L=${L} project=${project} />${layerName(L)}</span>`)}</div>
    <textarea class="textarea" rows="4" autofocus disabled=${busy} placeholder=${'For example: ' + IDEAS[kind][0]} value=${text} onInput=${(e) => setText(e.target.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}></textarea>
    ${freeChoice ? html`<div class="seg" style=${{ marginTop: '8px' }}>
      <button class=${!useFree ? 'on' : ''} onClick=${() => setUseFree(false)}><${Icon} name="brain-circuit" size=${12} />My model</button>
      <button class=${useFree ? 'on' : ''} title="Public no-key models with rate limits; your prompt goes to third-party services" onClick=${() => setUseFree(true)}><${Icon} name="zap" size=${12} />Auteur-Free</button></div>` : null}
    <div class="muted" style=${{ fontSize: '11.5px', marginTop: '8px' }}>Quick commands apply instantly without the model:</div>
    <div class="quick-cmds">${QUICK.map((q) => html`<button class="chip btnchip" disabled=${busy} onClick=${() => send(q)}>${q}</button>`)}</div>
    ${llm ? html`<div class="muted" style=${{ fontSize: '11.5px', marginTop: '10px' }}>Ideas:</div>
      <div class="quick-cmds">${IDEAS[kind].map((q) => html`<button class="chip btnchip" disabled=${busy} onClick=${() => setText(q)}>${q}</button>`)}</div>`
      : html`<div class="muted" style=${{ fontSize: '11.5px', marginTop: '10px' }}>Connect a model under Models to describe motion in your own words.</div>`}
  </${Modal}>`;
}

export function FreeFilmDialog({ hasModel, onStart, onClose }) {
  const [ack, setAck] = useState(false);
  return html`<${Modal} title="Make the film with Auteur-Free?" icon="zap" onClose=${onClose} width="580px"
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button>
      ${hasModel ? null : html`<button class="btn" onClick=${() => onStart(false)}>Use the house director</button>`}
      <button class="btn brand" disabled=${!ack} onClick=${() => onStart(true)}><${Icon} name="zap" size=${13} />Agree and continue</button>`}>
    <div style=${{ fontSize: '13px', lineHeight: 1.6 }}>
      <p style=${{ marginTop: 0 }}>Auteur-Free runs the whole agent swarm on public models that need no key. It is free, but it has limits:</p>
      <ul style=${{ paddingLeft: '18px', margin: '0 0 10px' }}>
        <li>Each provider allows only a few requests per minute or hour, so a full film is slower than with your own model.</li>
        <li>If the free limits run out part way, <b>the film can be left unfinished</b>: remaining scenes keep a simple house design. You can re-run those scenes later or connect your own model.</li>
        <li>Your brief and scene content go to third-party services (LLM7.io, OVHcloud, Kilo, Pollinations, BlockRun), and some may log prompts. Do not use it for private material.</li>
      </ul>
      <label class="row" style=${{ gap: '8px', cursor: 'pointer' }}><input type="checkbox" checked=${ack} onChange=${(e) => setAck(e.target.checked)} />
        <span>I understand the limits and that the film may be unfinished.</span></label>
    </div>
  </${Modal}>`;
}

export function NewSceneDialog({ at, llm, onCreate, onClose }) {
  const [title, setTitle] = useState('New scene');
  const [duration, setDuration] = useState(4);
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { await onCreate({ title: title.trim() || 'New scene', duration: Math.max(0.5, Math.min(120, +duration || 4)), idea: idea.trim() }); onClose(); }
    catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  return html`<${Modal} title="New scene" icon="clapperboard" onClose=${onClose} width="480px"
    foot=${html`<span class="muted grow" style=${{ fontSize: '12px' }}>Inserted ${at.label}. Drag its right edge on the timeline to make it longer or shorter.</span>
      <button class="btn" onClick=${onClose}>Cancel</button><button class="btn brand" disabled=${busy} onClick=${go}><${Icon} name="plus" size=${13} />Create scene</button>`}>
    <div class="field"><label class="label">Scene name</label><input class="input" autofocus value=${title} onInput=${(e) => setTitle(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && go()} /></div>
    <div class="field"><label class="label">Duration (seconds)</label>
      <div class="row"><input class="input" type="number" step="0.5" min="0.5" max="120" style=${{ width: '110px' }} value=${duration} onInput=${(e) => setDuration(e.target.value)} />
        ${[2, 4, 6, 10].map((d) => html`<button class=${'btn sm ' + (+duration === d ? 'on' : '')} onClick=${() => setDuration(d)}>${d}s</button>`)}</div></div>
    <div class="field"><label class="label">What happens (optional)</label>
      <textarea class="textarea" rows="3" placeholder=${llm ? 'Describe it and the agent builds the scene, or leave empty for a blank scene you build by hand' : 'Leave empty for a blank scene you build by hand'} value=${idea} onInput=${(e) => setIdea(e.target.value)}></textarea></div>
  </${Modal}>`;
}

export function DraftBar({ scene, onPlay, onApply, onDiscard }) {
  const d = scene.draft;
  if (!d) return null;
  return html`<div class="draft-bar"><${Icon} name=${d.by === 'instant' ? 'zap' : 'sparkles'} size=${14} />
    <b>${d.by === 'instant' ? 'Instant edit' : 'Animator draft'}</b><span class="ellipsis" style=${{ maxWidth: '280px', opacity: 0.85 }}>${d.note || d.instruction}</span>
    <button class="btn sm" onClick=${onPlay}><${Icon} name="play" size=${12} />Play</button>
    <button class="btn sm brand" onClick=${onApply}><${Icon} name="check" size=${12} />Apply</button>
    <button class="btn sm ghost" style=${{ color: '#fff' }} onClick=${onDiscard}><${Icon} name="x" size=${12} />Discard</button></div>`;
}

export function LayersPanel({ project, scene, selected, multi, onSelect, onPatch, onMove, onAnimate, onDelete, onFollow }) {
  const [rename, setRename] = useState(null);
  if (!scene) return html`<div class="muted">No scene selected.</div>`;
  const list = (scene.layers || []).slice().reverse();
  const picked = new Set(multi || []);
  if (selected && selected.user) picked.add(selected.id);
  return html`<div>
    <div class="muted" style=${{ fontSize: '12px', marginBottom: '8px' }}>Scene ${scene.index + 1}: top of the list is in front. Shift or Ctrl click to select several, then animate them together.</div>
    <div class="row" style=${{ marginBottom: '8px' }}><button class="btn sm brand" disabled=${!picked.size} onClick=${() => onAnimate(Array.from(picked))}><${Icon} name="wand-sparkles" size=${12} />Animate ${picked.size || ''} with agent</button></div>
    ${!list.length ? html`<div class="empty" style=${{ padding: '24px 8px' }}><${Icon} name="layers" />No layers yet. Add characters, scenery, text or effects from the library.</div>` : null}
    <div class="layer-list">${list.map((L) => html`<div key=${L.id} class=${'layer-row ' + (picked.has(L.id) ? 'on ' : '') + (L.hidden ? 'off' : '')}
        onClick=${(e) => onSelect({ sceneId: scene.id, id: L.id, user: true, text: L.text }, e.shiftKey || e.ctrlKey || e.metaKey)}>
      <${LayerThumb} L=${L} project=${project} />
      ${rename === L.id ? html`<input class="input sm" autofocus value=${layerName(L)} onClick=${(e) => e.stopPropagation()}
          onBlur=${(e) => { setRename(null); if (e.target.value.trim()) onPatch(L.id, { name: e.target.value.trim().slice(0, 60) }); }} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRename(null); }} />`
        : html`<span class="ellipsis" onDblClick=${(e) => { e.stopPropagation(); setRename(L.id); }} title="Double-click to rename">${layerName(L)}</span>`}
      <span class="tools" onClick=${(e) => e.stopPropagation()}>
        <button class="btn ghost icon sm" title="Move forward" onClick=${() => onMove(L.id, 1)}><${Icon} name="chevron-up" size=${12} /></button>
        <button class="btn ghost icon sm" title="Move backward" onClick=${() => onMove(L.id, -1)}><${Icon} name="chevron-down" size=${12} /></button>
        ${!L.back && onFollow ? html`<button class=${'btn ghost icon sm ' + (((scene.camera || {}).follow || []).some((f) => f.target === L.id) ? 'on' : '')} title="Camera follows this layer" onClick=${() => onFollow(L.id)}><${Icon} name="crosshair" size=${12} /></button>` : null}
        <button class="btn ghost icon sm" title=${L.hidden ? 'Show' : 'Hide'} onClick=${() => onPatch(L.id, { hidden: !L.hidden })}><${Icon} name=${L.hidden ? 'eye-off' : 'eye'} size=${12} /></button>
        <button class="btn ghost icon sm" title=${L.locked ? 'Unlock' : 'Lock so it cannot be clicked on stage'} onClick=${() => onPatch(L.id, { locked: !L.locked })}><${Icon} name=${L.locked ? 'lock' : 'lock-open'} size=${12} /></button>
        <button class="btn ghost icon sm danger" title="Delete" onClick=${() => onDelete(L.id)}><${Icon} name="trash-2" size=${12} /></button>
      </span></div>`)}</div>
  </div>`;
}
