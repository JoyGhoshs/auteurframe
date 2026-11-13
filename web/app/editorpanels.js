import { html, useState, useEffect, useRef, Icon, api, toast } from './lib.js';
import { NarrationBox } from './leftpanels.js';

export const TEXT_PRESETS = [
  { id: 'title', name: 'Big title', sample: 'Big Title', css: { font: '800 26px var(--display)', letterSpacing: '-0.03em' }, layer: { kind: 'text', text: 'Big Title', w: 64, x: 18, y: 36, style: { size: 160, weight: 800, align: 'center' }, enter: { preset: 'chars', duration: 0.8 } } },
  { id: 'bounce', name: 'Kinetic bounce', sample: 'BOUNCE', css: { font: '900 22px var(--display)' }, layer: { kind: 'text', text: 'BOUNCE', w: 60, x: 20, y: 38, style: { size: 150, weight: 900, align: 'center', transform: 'uppercase' }, enter: { preset: 'bounce', duration: 0.8 } } },
  { id: 'outline', name: 'Outline', sample: 'Outline', css: { font: '800 24px var(--display)', color: 'transparent', WebkitTextStroke: '1.4px #111' }, layer: { kind: 'text', text: 'Outline', w: 60, x: 20, y: 38, style: { size: 150, weight: 800, align: 'center', effect: 'outline' }, enter: { preset: 'words' } } },
  { id: 'neon', name: 'Neon', sample: 'Neon', css: { font: '700 24px var(--display)', color: '#fff', textShadow: '0 0 6px #3df, 0 0 14px #3df', background: '#0b0b14', borderRadius: '6px', padding: '0 8px' }, layer: { kind: 'text', text: 'Neon nights', w: 60, x: 20, y: 40, style: { size: 120, weight: 700, align: 'center', effect: 'neon', color: '#33DDFF' }, enter: { preset: 'blur' } } },
  { id: 'gradient', name: 'Gradient', sample: 'Gradient', css: { font: '800 24px var(--display)', backgroundImage: 'linear-gradient(90deg,#5B3DF5,#FF4D2E)', WebkitBackgroundClip: 'text', color: 'transparent' }, layer: { kind: 'text', text: 'Gradient', w: 60, x: 20, y: 38, style: { size: 150, weight: 800, align: 'center', effect: 'gradient' }, enter: { preset: 'chars' } } },
  { id: 'highlight', name: 'Highlighter', sample: 'Highlight', css: { font: '700 20px var(--display)', background: '#FFE500', padding: '0 6px' }, layer: { kind: 'text', text: 'Key point', w: 40, x: 30, y: 44, style: { size: 90, weight: 700, align: 'center', effect: 'highlight', bg: '#FFE500', color: '#111' }, enter: { preset: 'wipe' } } },
  { id: 'typewriter', name: 'Typewriter', sample: 'type_', css: { font: '500 18px var(--mono)' }, layer: { kind: 'text', text: 'Typed letter by letter', w: 60, x: 20, y: 44, style: { size: 64, weight: 500, align: 'center', font: 'var(--font-mono)' }, enter: { preset: 'typewriter', duration: 1.4 } } },
  { id: 'scramble', name: 'Scramble', sample: 'X7#K9', css: { font: '700 18px var(--mono)', letterSpacing: '0.1em' }, layer: { kind: 'text', text: 'DECODED', w: 50, x: 25, y: 42, style: { size: 110, weight: 700, align: 'center', font: 'var(--font-mono)', tracking: '0.08em' }, enter: { preset: 'scramble', duration: 1.0 } } },
  { id: 'lower', name: 'Lower third', sample: 'Name · Role', css: { font: '600 14px var(--font)', borderLeft: '4px solid #FF4D2E', paddingLeft: '8px', textAlign: 'left' }, layer: { kind: 'text', text: 'Jordan Lee · Founder', w: 40, x: 6, y: 78, style: { size: 54, weight: 700, align: 'left', bg: 'rgba(14,14,18,0.86)', color: '#ffffff', radius: 10 }, enter: { preset: 'slideRight' } } },
  { id: 'label', name: 'Label pill', sample: 'NEW', css: { font: '700 13px var(--font)', background: '#111', color: '#fff', borderRadius: '99px', padding: '3px 12px' }, layer: { kind: 'text', text: 'NEW', w: 14, x: 43, y: 20, style: { size: 40, weight: 800, align: 'center', bg: 'var(--accent)', color: 'var(--bg)', radius: 999, transform: 'uppercase', tracking: '0.08em' }, enter: { preset: 'pop' }, emphasis: 'pulse' } },
  { id: 'caption', name: 'Caption stroke', sample: 'SAY IT', css: { font: '900 20px Anton, var(--display)', color: '#fff', WebkitTextStroke: '3px #000', paintOrder: 'stroke fill' }, layer: { kind: 'text', text: 'SAY IT LOUD', w: 70, x: 15, y: 62, style: { size: 110, weight: 900, align: 'center', transform: 'uppercase', color: '#ffffff', effect: 'stroke-fill' }, enter: { preset: 'pop' } } },
  { id: 'glass', name: 'Glass card', sample: 'Glass', css: { font: '600 16px var(--font)', background: 'rgba(91,61,245,0.12)', border: '1px solid rgba(91,61,245,0.3)', borderRadius: '10px', padding: '2px 10px' }, layer: { kind: 'text', text: 'Frosted glass card', w: 44, x: 28, y: 40, style: { size: 64, weight: 650, align: 'center', effect: 'glass', color: '#ffffff', radius: 22 }, enter: { preset: 'zoom' } } },
];

export function TextPanel({ onAdd, scene }) {
  return html`<div>
    <div class="muted" style=${{ fontSize: '12px', marginBottom: '10px' }}>Click a style to add it to scene ${scene ? scene.index + 1 : ''} at the playhead. Edit words, timing and animation in the Layer tab.</div>
    <div class="text-presets">${TEXT_PRESETS.map((p) => html`<button class="text-preset" draggable onDragStart=${(e) => { e.dataTransfer.setData('application/x-auteur', JSON.stringify({ layer: p.layer })); }} onClick=${() => onAdd(p.layer)}>
      <span class="tp-sample" style=${p.css}>${p.sample}</span><span class="tp-name">${p.name}</span></button>`)}</div>
  </div>`;
}

export function StockPanel({ project, onImported, scene, onAddLayer }) {
  const [tab, setTab] = useState('photos');
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('auto');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState('');
  const search = async (query) => {
    const term = (query ?? q).trim();
    if (!term) return;
    setBusy(true); setRes(null);
    try {
      if (tab === 'icons') setRes(await api.get(`/api/icons/search?q=${encodeURIComponent(term)}`));
      else setRes(await api.get(`/api/stock/search?q=${encodeURIComponent(term)}&kind=${tab === 'videos' ? 'video' : 'image'}&source=${src}`));
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  useEffect(() => { if (q) search(); }, [tab, src]);
  const importItem = async (item, place) => {
    setImporting(item.id);
    try {
      const r = await api.post(`/api/projects/${project.id}/stock/import`, item);
      toast('Added to media bin', 'ok');
      onImported(r.asset, place);
    } catch (e) { toast(e.message, 'err'); }
    setImporting('');
  };
  const importIcon = async (icon) => {
    setImporting(icon.name);
    try {
      const r = await api.post(`/api/projects/${project.id}/icons/import`, { name: icon.name });
      onImported(r.asset, true);
    } catch (e) { toast(e.message, 'err'); }
    setImporting('');
  };
  return html`<div>
    <div class="seg" style=${{ width: '100%', marginBottom: '8px' }}>${[['photos', 'image', 'Photos'], ['videos', 'film', 'Videos'], ['icons', 'shapes', 'Icons']].map(([k, ic, l]) => html`<button class=${tab === k ? 'on' : ''} style=${{ flex: 1 }} onClick=${() => { setTab(k); setRes(null); }}><${Icon} name=${ic} size=${12} />${l}</button>`)}</div>
    <div class="row"><input class="input sm" placeholder=${tab === 'icons' ? 'Search 200,000 icons' : 'Search free stock'} value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && search()} />
      <button class="btn sm primary icon" onClick=${() => search()}>${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${13} />` : html`<${Icon} name="search" size=${13} />`}</button></div>
    ${tab !== 'icons' ? html`<select class="select sm" style=${{ marginTop: '6px' }} value=${src} onChange=${(e) => setSrc(e.target.value)}>
      ${[['auto', 'All sources'], ['openverse', 'Openverse (free)'], ['wikimedia', 'Wikimedia Commons (free)'], ['pexels', 'Pexels (key)'], ['pixabay', 'Pixabay (key)'], ['unsplash', 'Unsplash (key)']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>` : null}
    ${!res && !busy ? html`<div class="chips-wrap">${(tab === 'icons' ? ['rocket', 'heart', 'chart', 'arrow', 'star', 'globe', 'camera', 'music'] : ['ocean', 'city night', 'mountains', 'technology', 'office team', 'abstract texture', 'space', 'nature']).map((s) => html`<button class="sugg" onClick=${() => { setQ(s); search(s); }}>${s}</button>`)}</div>` : null}
    ${res && res.sources ? html`<div class="muted" style=${{ fontSize: '10.5px', margin: '6px 0' }}>${res.sources.map((s) => `${s.source}${s.error ? ' (' + s.error.slice(0, 40) + ')' : ' ' + s.count}`).join(' · ')}</div>` : null}
    ${res && res.results ? html`<div class="stock-grid">${res.results.map((r) => html`<div class="stock-item" title=${`${r.title}\n${r.author || ''} · ${r.license || ''}`} onClick=${() => importItem(r, false)}
        draggable onDragStart=${(e) => e.dataTransfer.setData('application/x-auteur', JSON.stringify({ stock: r }))}>
      ${r.thumb ? html`<img src=${r.thumb} loading="lazy" referrerpolicy="no-referrer" />` : html`<${Icon} name="film" />`}
      ${r.kind === 'video' ? html`<span class="stock-badge"><${Icon} name="play" size=${10} /></span>` : null}
      ${importing === r.id ? html`<span class="stock-busy"><${Icon} name="loader-circle" cls="spin" size=${18} /></span>` : html`<span class="stock-add"><${Icon} name="plus" size=${14} /></span>`}
      <span class="stock-src">${r.source}</span></div>`)}</div>` : null}
    ${res && res.icons ? html`<div class="icon-pick" style=${{ gridTemplateColumns: 'repeat(5, 1fr)', maxHeight: 'none' }}>${res.icons.map((ic) => html`<button title=${ic.name} onClick=${() => importIcon(ic)}>
      ${importing === ic.name ? html`<${Icon} name="loader-circle" cls="spin" size=${16} />` : html`<img src=${ic.svg} style=${{ width: '100%', height: '100%' }} loading="lazy" />`}</button>`)}</div>` : null}
    <div class="muted" style=${{ fontSize: '10.5px', marginTop: '10px' }}>Click to add to the media bin and place on scene ${scene ? scene.index + 1 : ''}. Attribution is stored with each asset. Add Pexels, Pixabay or Unsplash keys in Models for more results.</div>
  </div>`;
}

export function SoundPanel({ project, time, onPatch, onUpload, selectedClip, onSelectClip, onClipPatch, onDeleteClip, onAddClip }) {
  const [lib, setLib] = useState({ moods: [], sfx: [] });
  const [playing, setPlaying] = useState('');
  const player = useRef(null);
  const input = useRef(null);
  useEffect(() => { api.get('/api/audio/library').then(setLib); }, []);
  const a = project.audio || {};
  const audios = (project.assets || []).filter((x) => x.kind === 'audio');
  const preview = (url, key) => {
    const el = player.current;
    if (playing === key) { el.pause(); setPlaying(''); return; }
    el.src = url; el.currentTime = 0; el.play().catch(() => null); setPlaying(key);
  };
  const clips = a.clips || [];
  const addClip = (sfx) => onPatch({ audio: { clips: [...clips, { id: 'c' + Math.random().toString(36).slice(2, 7), sfx, t: Math.round(time * 100) / 100, gain: 0.8 }] } });
  const music = a.music || '';
  return html`<div>
    <audio ref=${player} onEnded=${() => setPlaying('')}></audio>
    <${NarrationBox} project=${project} />
    <div class="section-title" style=${{ marginBottom: '8px' }}>Music</div>
    <div class="mood-list">
      <button class=${'mood ' + (music === 'auto' ? 'on' : '')} onClick=${() => onPatch({ audio: { music: 'auto' } })}><span class="mood-ic"><${Icon} name="wand-sparkles" size=${14} /></span><span><b>Style matched</b><em>Scored to the visual style</em></span></button>
      ${lib.moods.map((m) => html`<div class=${'mood ' + (music === 'mood:' + m.id ? 'on' : '')} onClick=${() => onPatch({ audio: { music: 'mood:' + m.id } })}>
        <button class="mood-ic" onClick=${(e) => { e.stopPropagation(); preview(`/api/audio/mood/${m.id}.wav`, m.id); }}><${Icon} name=${playing === m.id ? 'pause' : 'play'} size=${13} /></button>
        <span><b>${m.label}</b><em>${m.description} · ${m.bpm} bpm</em></span></div>`)}
      ${audios.map((x) => html`<div class=${'mood ' + (music === x.id ? 'on' : '')} onClick=${() => onPatch({ audio: { music: x.id } })}>
        <button class="mood-ic" onClick=${(e) => { e.stopPropagation(); preview(x.url, x.id); }}><${Icon} name=${playing === x.id ? 'pause' : 'play'} size=${13} /></button><span><b class="ellipsis">${x.name}</b><em>Your upload</em></span></div>`)}
      <button class=${'mood ' + (music === '' || music === null ? 'on' : '')} onClick=${() => onPatch({ audio: { music: null } })}><span class="mood-ic"><${Icon} name="volume-x" size=${14} /></span><span><b>No music</b></span></button>
    </div>
    <div class="row" style=${{ marginTop: '8px' }}><button class="btn sm" onClick=${() => input.current.click()}><${Icon} name="upload" size=${12} />Upload music or voice</button>
      <input type="file" accept="audio/*" class="hidden" ref=${input} onChange=${(e) => onUpload(e.target.files, 'music')} /></div>
    <div class="kv" style=${{ marginTop: '10px' }}><span>Music level</span><input type="range" min="-32" max="-6" step="1" value=${a.music_gain ?? -18} onChange=${(e) => onPatch({ audio: { music_gain: parseFloat(e.target.value) } })} />
      <span>Voiceover</span><select class="select sm" value=${a.voice || ''} onChange=${(e) => onPatch({ audio: { voice: e.target.value || null } })}><option value="">None</option>${audios.map((x) => html`<option value=${x.id}>${x.name}</option>`)}</select></div>
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Sound effects<span class="spacer"></span><span style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>adds at playhead</span></div>
    <div class="sfx-grid">${lib.sfx.map((s) => html`<div class="sfx" title=${s.description}>
      <button class="sfx-play" onClick=${() => preview(`/api/audio/sfx/${s.id}.wav`, 'sfx:' + s.id)}><${Icon} name=${playing === 'sfx:' + s.id ? 'pause' : 'play'} size=${12} /></button>
      <span class="grow ellipsis">${s.label}</span><button class="btn ghost icon sm" title="Add at playhead" onClick=${() => addClip(s.id)}><${Icon} name="plus" size=${13} /></button></div>`)}</div>
    ${audios.length ? html`<div class="section-title" style=${{ margin: '18px 0 8px' }}>Your audio<span class="spacer"></span><span style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>drag to the timeline</span></div>
      ${audios.map((x) => html`<div class="sfx" draggable onDragStart=${(e) => { e.dataTransfer.setData('application/x-auteur', JSON.stringify({ asset: x })); e.dataTransfer.effectAllowed = 'copy'; }}>
        <button class="sfx-play" onClick=${() => preview(x.url, 'a:' + x.id)}><${Icon} name=${playing === 'a:' + x.id ? 'pause' : 'play'} size=${12} /></button>
        <span class="grow ellipsis">${x.name}</span><span class="muted mono" style=${{ fontSize: '10px' }}>${x.meta && x.meta.duration ? x.meta.duration.toFixed(1) + 's' : ''}</span>
        <button class="btn ghost icon sm" title="Place at playhead" onClick=${() => onAddClip && onAddClip(x)}><${Icon} name="plus" size=${13} /></button></div>`)}` : null}
    ${clips.length ? html`<div class="section-title" style=${{ margin: '16px 0 6px' }}>On the timeline<span class="chip">${clips.length}</span></div>${clips.map((c) => {
    const on = selectedClip === c.id;
    const set = (p) => (onClipPatch ? onClipPatch(c.id, p) : onPatch({ audio: { clips: clips.map((x) => (x.id === c.id ? { ...x, ...p } : x)) } }));
    const name = c.name || c.sfx || 'clip';
    return html`<div class=${'clip-row ' + (on ? 'on' : '')} onClick=${() => onSelectClip && onSelectClip(c.id)}>
      <div class="row"><${Icon} name=${c.asset ? 'music-2' : 'audio-lines'} size=${13} /><span class="grow ellipsis">${name}</span>
        <input class="input sm mono" style=${{ width: '68px' }} value=${c.t} title="Start (s)" onChange=${(e) => set({ t: Math.max(0, parseFloat(e.target.value) || 0) })} /><span class="muted">s</span>
        <button class=${'btn ghost icon sm ' + (c.mute ? 'on' : '')} title=${c.mute ? 'Unmute' : 'Mute'} onClick=${(e) => { e.stopPropagation(); set({ mute: !c.mute }); }}><${Icon} name=${c.mute ? 'volume-x' : 'volume-2'} size=${12} /></button>
        <button class="btn ghost icon sm" title="Delete (Del)" onClick=${(e) => { e.stopPropagation(); onDeleteClip ? onDeleteClip(c.id) : onPatch({ audio: { clips: clips.filter((x) => x.id !== c.id) } }); }}><${Icon} name="trash-2" size=${12} /></button></div>
      ${on ? html`<div class="kv clip-kv">
        <span>Volume</span><div class="row"><input type="range" min="0" max="2" step="0.05" value=${c.gain ?? 0.8} onChange=${(e) => set({ gain: parseFloat(e.target.value) })} /><span class="mono muted">${Math.round((c.gain ?? 0.8) * 100)}%</span></div>
        ${c.asset ? html`<span>Trim in</span><input class="input sm mono" value=${c.in || 0} onChange=${(e) => set({ in: Math.max(0, parseFloat(e.target.value) || 0) })} />
        <span>Length</span><input class="input sm mono" value=${c.dur || ''} placeholder="full" onChange=${(e) => set({ dur: parseFloat(e.target.value) || null })} />
        <span>Fade in</span><input type="range" min="0" max="3" step="0.05" value=${c.fade_in || 0} onChange=${(e) => set({ fade_in: parseFloat(e.target.value) })} />
        <span>Fade out</span><input type="range" min="0" max="3" step="0.05" value=${c.fade_out || 0} onChange=${(e) => set({ fade_out: parseFloat(e.target.value) })} />` : null}
      </div>` : null}</div>`;
  })}` : null}
    <div class="row" style=${{ marginTop: '14px' }}><button class=${'switch ' + (a.sfx !== false ? 'on' : '')} onClick=${() => onPatch({ audio: { sfx: a.sfx === false } })}></button><span style=${{ fontSize: '12px' }}>Auto whoosh on cuts and a payoff hit</span></div>
    <div class="muted" style=${{ fontSize: '11px', marginTop: '10px' }}>Master loudness −16 LUFS. Music ducks automatically under voiceover.</div>
  </div>`;
}
