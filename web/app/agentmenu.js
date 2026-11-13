import { html, useState, useEffect, useRef, Icon, api, toast, Modal } from './lib.js';

export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
    }
    const close = (e) => { if (!ref.current || !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close, true);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => { window.removeEventListener('mousedown', close, true); window.removeEventListener('keydown', key); window.removeEventListener('blur', onClose); };
  }, [x, y]);
  return html`<div class="ctx-menu" ref=${ref} style=${{ left: pos.x + 'px', top: pos.y + 'px' }} onContextMenu=${(e) => e.preventDefault()}>
    ${items.filter(Boolean).map((it) => it.sep ? html`<div class="ctx-sep"></div>` : it.header ? html`<div class="ctx-head ellipsis">${it.header}</div>`
      : html`<button class=${'ctx-item ' + (it.danger ? 'danger' : '')} disabled=${it.disabled} onClick=${() => { onClose(); it.onClick && it.onClick(); }}>
        <${Icon} name=${it.icon || 'dot'} size=${14} /><span class="grow">${it.label}</span>${it.kbd ? html`<span class="kbd">${it.kbd}</span>` : null}</button>`)}
  </div>`;
}

export function AskAgentDialog({ title, placeholder, initial, onSend, onClose }) {
  const [text, setText] = useState(initial || '');
  return html`<${Modal} title=${title || 'Ask the agent'} icon="sparkles" onClose=${onClose} width="560px"
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn brand" disabled=${!text.trim()} onClick=${() => { onSend(text.trim()); onClose(); }}><${Icon} name="send" size=${13} />Send to agent</button>`}>
    <textarea class="textarea" rows="5" autofocus placeholder=${placeholder || 'Describe the change'} value=${text} onInput=${(e) => setText(e.target.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) { onSend(text.trim()); onClose(); } }}></textarea>
    <div class="muted" style=${{ fontSize: '11.5px', marginTop: '6px' }}>The scene agent rewrites the composition with your direction, QA checks it, and the stage updates live. Ctrl+Enter sends.</div>
  </${Modal}>`;
}

export function TextPromptDialog({ title, label, initial, multiline, onSave, onClose }) {
  const [text, setText] = useState(initial || '');
  const save = () => { onSave(text); onClose(); };
  return html`<${Modal} title=${title} icon="pencil" onClose=${onClose} width="520px"
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn brand" onClick=${save}><${Icon} name="check" size=${13} />Save</button>`}>
    ${label ? html`<label class="label">${label}</label>` : null}
    ${multiline ? html`<textarea class="textarea" rows="4" autofocus value=${text} onInput=${(e) => setText(e.target.value)}></textarea>`
      : html`<input class="input" autofocus value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && save()} />`}
  </${Modal}>`;
}

export function ReplicateDialog({ project, scene, initialMode, onClose, onStarted }) {
  const refs = (project.assets || []).filter((a) => a.kind === 'image' || a.kind === 'video');
  const [source, setSource] = useState(scene ? 'scene' : (refs[0] ? 'asset' : 'scene'));
  const [assetId, setAssetId] = useState(refs[0] ? refs[0].id : '');
  const [mode, setMode] = useState(initialMode || 'extend');
  const [count, setCount] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [narration, setNarration] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = useRef(null);
  const sendFile = async (file) => {
    if (!file) return;
    try {
      const a = await api.upload(`/api/projects/${project.id}/assets`, file, { role: 'reference' });
      const asset = a.asset || a;
      setAssetId(asset.id); setSource('asset');
      toast('Reference uploaded', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  const go = async () => {
    setBusy(true);
    try {
      const body = { mode, count, instruction, narration, scene_id: source === 'scene' && scene ? scene.id : null, asset_id: source === 'asset' ? assetId : null };
      const r = await api.post(`/api/projects/${project.id}/replicate`, body);
      toast(`${r.scenes.length} new scene${r.scenes.length > 1 ? 's' : ''}: the agents are writing ${r.scenes.length > 1 ? 'them' : 'it'} now`, 'ok');
      onStarted && onStarted(r);
      onClose();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  const MODES = [['replicate', 'Replicate', 'copy', 'A new shot that matches the source: same look, characters, layout and motion'],
    ['extend', 'Extend the story', 'fast-forward', 'What happens next: same characters, set and style, the next beat'],
    ['variation', 'Variation', 'shuffle', 'Same story moment, a different composition, camera and choreography']];
  return html`<${Modal} title="Replicate with agent" icon="copy-plus" onClose=${onClose} width="640px"
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn brand" disabled=${busy || (source === 'asset' && !assetId)} onClick=${go}>
      ${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${13} />` : html`<${Icon} name="wand-sparkles" size=${13} />`}Create ${count} scene${count > 1 ? 's' : ''}</button>`}>
    <div class="field"><label class="label">Source</label>
      <div class="seg"><button class=${source === 'scene' ? 'on' : ''} disabled=${!scene} onClick=${() => setSource('scene')}>${scene ? `Scene ${scene.index + 1}: ${scene.title || ''}`.slice(0, 40) : 'No scene selected'}</button>
        <button class=${source === 'asset' ? 'on' : ''} onClick=${() => setSource('asset')}>Reference image or video</button></div>
      ${source === 'asset' ? html`<div class="row" style=${{ marginTop: '8px' }}>
        <select class="select sm grow" value=${assetId} onChange=${(e) => setAssetId(e.target.value)}><option value="">Choose a reference…</option>${refs.map((a) => html`<option value=${a.id}>${a.kind}: ${a.name}</option>`)}</select>
        <button class="btn sm" onClick=${() => upload.current.click()}><${Icon} name="upload" size=${12} />Upload</button>
        <input type="file" accept="image/*,video/*" class="hidden" ref=${upload} onChange=${(e) => sendFile(e.target.files[0])} /></div>
        <div class="muted" style=${{ fontSize: '11.5px', marginTop: '4px' }}>A vision model looks at the reference (frames for videos) and rebuilds it with AuteurFrame characters, sets and code.</div>` : null}</div>
    <div class="field"><label class="label">What the agent should make</label>
      <div class="col" style=${{ gap: '6px' }}>${MODES.map(([v, l, icon, d]) => html`<button class=${'opt-row ' + (mode === v ? 'on' : '')} onClick=${() => setMode(v)}>
        <${Icon} name=${icon} size=${16} /><span><b>${l}</b><em>${d}</em></span></button>`)}</div></div>
    <div class="grid2" style=${{ gridTemplateColumns: '140px 1fr', gap: '12px' }}>
      <div class="field"><label class="label">New scenes</label><select class="select" value=${count} onChange=${(e) => setCount(+e.target.value)}>${[1, 2, 3, 4].map((n) => html`<option value=${n}>${n}</option>`)}</select></div>
      <div class="field"><label class="label">Direction</label><input class="input" placeholder=${mode === 'extend' ? 'They reach the bridge at dawn and the gate opens' : 'Make it rain, move the camera closer, add a second zombie'} value=${instruction} onInput=${(e) => setInstruction(e.target.value)} /></div>
    </div>
    <div class="field"><label class="label">Narration for the new scenes (optional, one line per scene)</label>
      <textarea class="textarea" rows="3" placeholder="Leave empty to reuse the source narration (replicate) or to have no narration" value=${narration} onInput=${(e) => setNarration(e.target.value)}></textarea></div>
  </${Modal}>`;
}
