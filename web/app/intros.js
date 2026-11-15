import { html, useState, Icon, api, toast } from './lib.js';
import { useManifest, thumbUrl, componentLayer } from './motiontools.js';

const BLANK = '<div class="scene"></div><script>AU.scene(() => {});</script>';
const OUTROS = new Set(['end-card', 'light-sweep', 'cinematic', 'line-draw']);

export function IntrosPanel({ project, scene, onAddLayer, onChanged, snap }) {
  const m = useManifest();
  const [title, setTitle] = useState(project.title || 'Your Title');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState('');
  if (!m) return html`<div class="muted">Loading designs…</div>`;
  const styles = ((((m.intro || {}).params || {}).style || {}).options) || [];
  const layerFor = (style) => {
    const L = componentLayer('intro', style);
    L.params = { ...L.params, title, subtitle };
    L.name = style.replace(/-/g, ' ') + (style === 'end-card' ? '' : ' title');
    return L;
  };
  const addScene = async (style, where) => {
    setBusy(style + where);
    try {
      await snap(true);
      const at = where === 'start' ? 0 : (project.scenes || []).length;
      await api.post(`/api/projects/${project.id}/scenes`, { at, title: style === 'end-card' ? 'End card' : `${title} (intro)`, duration: style === 'countdown' ? 4.5 : 4, code: BLANK, layers: [{ ...layerFor(style), id: 'L' + Math.random().toString(36).slice(2, 8), start: 0 }] });
      toast(where === 'start' ? 'Intro added as the first scene' : 'Added as the last scene', 'ok');
      await onChanged();
    } catch (e) { toast(e.message, 'err'); }
    setBusy('');
  };
  return html`<div>
    <div class="muted" style=${{ fontSize: '12px', marginBottom: '8px' }}>Pick a design. It uses your film's colours and fonts. Add it as its own scene, or lay it over the current scene.</div>
    <div class="field"><label class="label">Title</label><input class="input sm" value=${title} onInput=${(e) => setTitle(e.target.value)} /></div>
    <div class="field"><label class="label">Subtitle (optional)</label><input class="input sm" value=${subtitle} placeholder="For end card: button text" onInput=${(e) => setSubtitle(e.target.value)} /></div>
    <div class="lib-grid" style=${{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>${styles.map((s) => html`<div class="lib-card" key=${s} style=${{ cursor: 'default' }}
        draggable onDragStart=${(e) => e.dataTransfer.setData('application/x-auteur', JSON.stringify({ layer: layerFor(s) }))}>
      <img src=${thumbUrl('intro', s)} loading="lazy" alt="" />
      <span>${s.replace(/-/g, ' ')}</span>
      <div class="row" style=${{ gap: '3px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button class="btn sm" disabled=${!!busy} title="Insert as the first scene" onClick=${() => addScene(s, 'start')}><${Icon} name="skip-back" size=${11} />${OUTROS.has(s) && s === 'end-card' ? 'Start' : 'Intro'}</button>
        <button class="btn sm" disabled=${!!busy} title="Insert as the last scene" onClick=${() => addScene(s, 'end')}><${Icon} name="skip-forward" size=${11} />${s === 'end-card' ? 'Outro' : 'End'}</button>
        <button class="btn sm ghost" disabled=${!scene} title="Lay over the current scene at the playhead" onClick=${() => onAddLayer(layerFor(s))}><${Icon} name="layers" size=${11} /></button>
      </div></div>`)}</div>
  </div>`;
}
