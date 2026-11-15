import { html, useState, useEffect, useRef, Icon, api, toast, fmtDur } from './lib.js';
import { FontSelect, useFonts, useProjectLanguage, sampleFor, SCRIPT_LABEL, normScripts } from './fontpicker.js';
import { StyleCard } from './wizard.js';

const POPULAR = ['sparkles', 'rocket', 'zap', 'heart', 'star', 'check', 'arrow-right', 'globe', 'brain', 'trending-up', 'chart-line', 'users', 'shield-check', 'lightbulb', 'flame', 'clock', 'target', 'trophy', 'map-pin', 'message-circle', 'camera', 'music', 'gem', 'leaf', 'sun', 'moon', 'cloud', 'cpu', 'code-xml', 'database', 'lock', 'gift', 'bell', 'bookmark', 'circle-play', 'thumbs-up'];

const LIB_KINDS = [['image', 'Photos'], ['vector', 'Vectors'], ['footage', 'Footage'], ['sfx', 'Sound FX'], ['music', 'Music'], ['generate', 'Generate']];
const QUICK_FX = [['Remove background', [{ op: 'cutout' }]], ['Paper sticker', [{ op: 'sticker' }, { op: 'trim', margin: 4 }]], ['Duotone print', [{ op: 'duotone' }, { op: 'grain', amount: 0.05 }]],
  ['Smart crop 9:16', [{ op: 'crop', aspect: '9:16' }]], ['Smart crop 16:9', [{ op: 'crop', aspect: '16:9' }]], ['Blur background', [{ op: 'blur_bg', radius: 16 }]], ['Pencil sketch', [{ op: 'sketch' }]], ['Upscale 2x', [{ op: 'upscale', factor: 2 }]]];

function LibraryFinder({ project, scene }) {
  const [kind, setKind] = useState('image');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState('');
  const audio = kind === 'sfx' || kind === 'music';
  const search = async () => {
    if (!q.trim()) return;
    if (kind === 'generate') {
      setBusy('gen');
      try { await api.post(`/api/projects/${project.id}/generate-image`, { prompt: q }); toast('Generated image added to the media bin', 'ok'); } catch (e) { toast(e.message, 'err'); }
      setBusy('');
      return;
    }
    setBusy('search');
    setRes(null);
    try {
      const d = await api.get(`/api/library/search?q=${encodeURIComponent(q)}&kind=${kind === 'vector' ? 'image' : kind}&style=${kind === 'vector' ? 'vector' : 'photo'}`);
      setRes(d.results || []);
    } catch (e) { toast(e.message, 'err'); }
    setBusy('');
  };
  const collect = async (item, i) => {
    setBusy('c' + i);
    const body = { item, kind: kind === 'vector' ? 'image' : kind };
    if (kind === 'music') body.place = 'music';
    if (kind === 'footage') { body.start = 0; body.duration = 8; }
    try {
      await api.post(`/api/projects/${project.id}/library/collect`, body);
      toast(kind === 'music' ? 'Music set as the film bed' : kind === 'sfx' ? 'Sound added to Files; drag it onto the timeline' : 'Added to the media bin', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    setBusy('');
  };
  return html`<div style=${{ marginTop: '14px' }}>
    <div class="section-title" style=${{ marginBottom: '8px' }}>Find free media<span class="chip">no keys</span></div>
    <div class="seg" style=${{ flexWrap: 'wrap', marginBottom: '8px' }}>${LIB_KINDS.map(([v, l]) => html`<button class=${kind === v ? 'on' : ''} onClick=${() => { setKind(v); setRes(null); }}>${l}</button>`)}</div>
    <div class="row"><input class="input sm grow" placeholder=${kind === 'generate' ? 'Describe an illustration to generate' : 'Search Openverse, Wikimedia, NASA, Internet Archive, Freesound'} value=${q}
      onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && search()} />
      <button class="btn sm" onClick=${search}>${busy === 'search' || busy === 'gen' ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name=${kind === 'generate' ? 'sparkles' : 'search'} size=${12} />`}</button></div>
    ${res && !res.length ? html`<div class="muted" style=${{ fontSize: '12px', marginTop: '8px' }}>Nothing found. Try simpler English words.</div>` : null}
    ${res && res.length && !audio ? html`<div class="asset-grid" style=${{ marginTop: '8px' }}>${res.slice(0, 18).map((r, i) => html`<div class="asset" title=${`${r.title || ''} · ${r.license || ''} · ${r.source || ''}`} onClick=${() => collect(r, i)}>
      <div class="asset-thumb">${r.thumb ? html`<img src=${r.thumb} loading="lazy" />` : html`<${Icon} name="film" />`}</div>
      <div class="asset-name">${busy === 'c' + i ? html`<${Icon} name="loader-circle" cls="spin" size=${11} />` : html`<${Icon} name="plus" size=${11} />`}<span class="ellipsis">${r.title || r.id}</span></div></div>`)}</div>
      <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Click to add. Credits are recorded for the end card.${kind === 'footage' ? ' Footage adds the first 8 seconds; ask an animator for a precise cut.' : ''}</div>` : null}
    ${res && res.length && audio ? html`<div style=${{ marginTop: '8px' }}>${res.slice(0, 14).map((r, i) => html`<div class="row" style=${{ padding: '4px 0', fontSize: '12px', gap: '6px' }}>
      <audio controls preload="none" src=${r.url} style=${{ height: '26px', width: '120px' }}></audio><span class="grow ellipsis" title=${r.title}>${r.title}</span><span class="chip">${r.duration ? r.duration.toFixed(1) + 's' : '?'}</span>
      <button class="btn sm" onClick=${() => collect(r, i)}>${busy === 'c' + i ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : 'Add'}</button></div>`)}</div>` : null}
  </div>`;
}

export function MediaPanel({ project, onUpload, onDeleteAsset, onAddLayer, scene }) {
  const [fxFor, setFxFor] = useState(null);
  const [fxBusy, setFxBusy] = useState(false);
  const runFx = async (a, ops, label) => {
    setFxBusy(true);
    try { await api.post(`/api/projects/${project.id}/images/${a.id}/edit`, { ops, name: `${a.name} (${label.toLowerCase()})` }); toast(`${label}: new image in the media bin`, 'ok'); } catch (e) { toast(e.message, 'err'); }
    setFxBusy(false);
    setFxFor(null);
  };
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState('');
  const [showIcons, setShowIcons] = useState(false);
  const icons = Object.keys(window.AU_ICONS || {});
  const found = q ? icons.filter((n) => n.includes(q.toLowerCase())).slice(0, 60) : POPULAR;
  const visual = (project.assets || []).filter((a) => ['image', 'video', 'svg'].includes(a.kind));
  const other = (project.assets || []).filter((a) => !['image', 'video', 'svg'].includes(a.kind));
  const dragData = (e, data) => { e.dataTransfer.setData('application/x-auteur', JSON.stringify(data)); e.dataTransfer.effectAllowed = 'copy'; };
  return html`<div>
    <div class=${'drop ' + (over ? 'over' : '')} style=${{ padding: '14px' }} onClick=${() => input.current.click()} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
      onDrop=${(e) => { e.preventDefault(); setOver(false); onUpload(e.dataTransfer.files); }}>
      <${Icon} name="upload" /><b style=${{ color: 'var(--ink)', fontSize: '12px' }}>Upload media</b><span style=${{ fontSize: '11px' }}>Images, video, audio, SVG, subtitles</span></div>
    <input type="file" multiple class="hidden" ref=${input} onChange=${(e) => onUpload(e.target.files)} />
    <${LibraryFinder} project=${project} scene=${scene} />
    <div class="section-title" style=${{ margin: '16px 0 8px' }}>Add to scene ${scene ? scene.index + 1 : ''}</div>
    <div class="add-tiles">
      ${[['text', 'type', 'Text', { kind: 'text', text: 'Your words', w: 40 }], ['title', 'heading', 'Headline', { kind: 'text', text: 'Big idea', w: 60, style: { size: 140, weight: 800 } }],
    ['label', 'tag', 'Label', { kind: 'text', text: 'LABEL', w: 18, style: { size: 34, weight: 700, bg: 'var(--accent)', color: 'var(--bg)', radius: 999, align: 'center', transform: 'uppercase' } }],
    ['shape', 'square', 'Shape', { kind: 'shape', w: 16, h: 16, style: { radius: 24 } }], ['circle', 'circle', 'Circle', { kind: 'shape', shape: 'circle', w: 12, h: 21 }],
    ['icon', 'shapes', 'Icon', null]].map(([id, icon, label, layer]) => html`<div class="add-tile" draggable=${!!layer} onDragStart=${(e) => layer && dragData(e, { layer })}
        onClick=${() => (layer ? onAddLayer(layer) : setShowIcons(!showIcons))}><${Icon} name=${icon} />${label}</div>`)}
    </div>
    ${showIcons ? html`<div style=${{ marginTop: '10px' }}><input class="input sm" placeholder=${`Search ${icons.length} icons`} value=${q} onInput=${(e) => setQ(e.target.value)} />
      <div class="icon-pick">${found.map((n) => html`<button title=${n} draggable onDragStart=${(e) => dragData(e, { layer: { kind: 'icon', icon: n, w: 10, enter: { preset: 'pop' }, emphasis: 'float' } })}
        onClick=${() => onAddLayer({ kind: 'icon', icon: n, w: 10, enter: { preset: 'pop' }, emphasis: 'float' })}><${Icon} name=${n} size=${18} /></button>`)}</div></div>` : null}
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Media bin<span class="chip">${visual.length}</span></div>
    ${visual.length ? html`<div class="asset-grid">${visual.map((a) => html`<div class="asset" draggable onDragStart=${(e) => dragData(e, { asset: a })} onDblClick=${() => onAddLayer({ kind: a.kind === 'video' ? 'video' : 'image', src: a.id, w: 36, h: a.meta && a.meta.width ? 36 * (a.meta.height / a.meta.width) * (project.width / project.height) : 30, name: a.name })}>
      <div class="asset-thumb">${a.kind === 'video' ? html`<video src=${a.url} muted preload="metadata"></video>` : html`<img src=${a.url} loading="lazy" />`}</div>
      <div class="asset-name"><${Icon} name=${a.kind === 'video' ? 'film' : 'image'} size=${11} /><span class="ellipsis">${a.name}</span></div>
      <button class="btn icon sm asset-del" onClick=${() => onDeleteAsset(a.id)}><${Icon} name="x" size=${12} /></button>
      ${a.kind === 'image' ? html`<button class="btn icon sm" title="Quick edit" style=${{ position: 'absolute', top: '4px', left: '4px' }} onClick=${(e) => { e.stopPropagation(); setFxFor(fxFor === a.id ? null : a.id); }}><${Icon} name=${fxBusy && fxFor === a.id ? 'loader-circle' : 'wand-sparkles'} cls=${fxBusy && fxFor === a.id ? 'spin' : ''} size=${12} /></button>` : null}
</div>`)}</div>
      ${fxFor && visual.find((x) => x.id === fxFor) ? html`<div class="card" style=${{ padding: '8px', marginTop: '8px' }}><div class="row" style=${{ marginBottom: '6px', fontSize: '12px' }}><b class="grow ellipsis">Quick edit: ${visual.find((x) => x.id === fxFor).name}</b>
        <button class="btn ghost icon sm" onClick=${() => setFxFor(null)}><${Icon} name="x" size=${12} /></button></div>
        <div class="row" style=${{ flexWrap: 'wrap', gap: '6px' }}>${QUICK_FX.map(([label, ops]) => html`<button class="btn sm" disabled=${fxBusy} onClick=${() => runFx(visual.find((x) => x.id === fxFor), ops, label)}>${label}</button>`)}</div>
        <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Runs locally (background removal uses an on-device model). The original stays untouched.</div></div>` : null}
      <div class="muted" style=${{ fontSize: '11px', marginTop: '8px' }}>Drag onto the stage to place by position, or onto the timeline to place at a time. Double-click to drop at the playhead.</div>` :
      html`<div class="muted" style=${{ fontSize: '12px' }}>No images or footage yet.</div>`}
    ${other.length ? html`<div class="section-title" style=${{ margin: '16px 0 8px' }}>Files</div>${other.map((a) => html`<div class=${'row ' + (a.kind === 'audio' ? 'file-drag' : '')} style=${{ padding: '5px 0', fontSize: '12px' }} draggable=${a.kind === 'audio'} onDragStart=${(e) => a.kind === 'audio' && dragData(e, { asset: a })} title=${a.kind === 'audio' ? 'Drag onto the timeline' : ''}>
      <${Icon} name=${{ audio: 'music', subtitle: 'captions', font: 'type', document: 'file-text', data: 'braces' }[a.kind] || 'file'} size=${14} /><span class="grow ellipsis">${a.name}</span><span class="chip">${a.role}</span>
      <button class="btn ghost icon sm" onClick=${() => onDeleteAsset(a.id)}><${Icon} name="x" size=${12} /></button></div>`)}` : null}
  </div>`;
}

export function DesignPanel({ project, styles, onPatch, scene, onScenePatch }) {
  const pal = (project.bible || {}).palette || {};
  const [tmp, setTmp] = useState(pal);
  useEffect(() => setTmp(pal), [JSON.stringify(pal)]);
  const keys = ['bg', 'bg-2', 'ink', 'ink-2', 'muted', 'accent', 'accent-2'];
  const b = project.bible || {};
  const fontData = useFonts();
  const lang = useProjectLanguage(project.id, [project.updated && Math.floor(project.updated / 30)]);
  const scripts = (lang && lang.scripts) || [];
  const ff = b.font_family || {};
  const setFamily = (k, v) => {
    const cur = { ...((project.bible_overrides || {}).font_family || {}) };
    if (v) cur[k] = v; else delete cur[k];
    onPatch({ bible_overrides: { ...(project.bible_overrides || {}), font_family: cur } });
  };
  const langs = (fontData && fontData.languages) || [];
  const curLang = (project.options || {}).language || 'auto';
  return html`<div>
    <div class="section-title" style=${{ marginBottom: '8px' }}>Language and typefaces</div>
    <div class="kv">
      <span>Language</span><select class="select sm" value=${curLang} onChange=${(e) => onPatch({ options: { ...(project.options || {}), language: e.target.value } })}>
        <option value="auto">Auto detect${lang ? ' (' + ((langs.find((l) => l.code === lang.lang) || {}).name || lang.lang) + ')' : ''}</option>
        ${langs.map((l) => html`<option value=${l.code}>${l.name}</option>`)}</select>
      <span>Display</span><${FontSelect} sm value=${ff.display || ''} scripts=${scripts} extra=${[['', 'Style default']]} onChange=${(v) => setFamily('display', v)} />
      <span>Body</span><${FontSelect} sm value=${ff.body || ''} scripts=${scripts} extra=${[['', 'Style default']]} onChange=${(v) => setFamily('body', v)} />
    </div>
    <div class="type-preview">
      <div style=${{ fontFamily: (ff.display ? `'${ff.display}', ` : '') + ((b.fonts || {}).display || 'inherit'), fontWeight: 800, fontSize: '22px' }}>${sampleFor(ff.display, fontData && fontData.fonts, scripts)}</div>
      <div style=${{ fontFamily: (ff.body ? `'${ff.body}', ` : '') + ((b.fonts || {}).body || 'inherit'), fontSize: '13px' }}>${sampleFor(ff.body, fontData && fontData.fonts, scripts)} · ${((b.fonts || {}).body || '').split(',')[0].replace(/'/g, '')}</div>
      ${scripts.length ? html`<div class="muted" style=${{ fontSize: '10.5px' }}>Scripts in this film: ${normScripts(scripts).map((s) => SCRIPT_LABEL[s] || s).join(', ')}. Each gets a matching face automatically.</div>` : null}
    </div>
    <div class="section-title" style=${{ margin: '16px 0 8px' }}>Palette tokens</div>
    <div class="palette-row">${keys.map((k) => html`<label><input type="color" value=${/^#/.test(tmp[k] || '') ? tmp[k] : '#000000'} onInput=${(e) => setTmp({ ...tmp, [k]: e.target.value })}
      onChange=${(e) => onPatch({ palette: { [k]: e.target.value } })} />${k}</label>`)}</div>
    <div class="kv" style=${{ marginTop: '12px' }}>
      <span>Display</span><b class="ellipsis" style=${{ fontFamily: (b.fonts || {}).display }}>${((b.fonts || {}).display || '').split(',')[0].replace(/'/g, '')}</b>
      <span>Body</span><span class="ellipsis" style=${{ fontFamily: (b.fonts || {}).body }}>${((b.fonts || {}).body || '').split(',')[0].replace(/'/g, '')}</span>
      <span>Motion</span><span>${(b.motion || {}).name} · tempo ×${(b.motion || {}).tempo}</span>
      <span>Ground</span><select class="select sm" value=${b.ground} onChange=${(e) => onPatch({ bible_overrides: { ...(project.bible_overrides || {}), ground: e.target.value } })}>
        ${['paper', 'solid', 'spotlight', 'mesh', 'aurora', 'grid', 'blueprint', 'dots', 'stars', 'halftone', 'scanlines', 'clay'].map((g) => html`<option value=${g}>${g}</option>`)}</select>
      <span>Texture</span><select class="select sm" value=${b.texture} onChange=${(e) => onPatch({ bible_overrides: { ...(project.bible_overrides || {}), texture: e.target.value } })}>
        ${['grain', 'paper', 'halftone', 'scanlines', 'vignette', 'none'].map((g) => html`<option value=${g}>${g}</option>`)}</select>
      ${b.motif ? html`<span>Motif</span><span style=${{ fontSize: '11.5px' }}>${b.motif}</span>` : null}
    </div>
    <${LensDesigner} project=${project} scene=${scene} onPatch=${onPatch} onScenePatch=${onScenePatch} />
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Style pack</div>
    <div class="style-mini">${styles.map((s) => html`<${StyleCard} key=${s.id} s=${s} compact on=${project.style === s.id} onPick=${(id) => onPatch({ style: id })} />`)}</div>
  </div>`;
}

const LENSES = [['none', 'No lens', 'circle-off'], ['documentary', 'Documentary', 'film'], ['fisheye', 'Fisheye', 'circle-dot'], ['wide', 'Wide angle', 'scan'],
  ['telephoto', 'Telephoto', 'zoom-in'], ['anamorphic', 'Anamorphic', 'rectangle-horizontal'], ['tilt-shift', 'Tilt-shift', 'layers'], ['macro', 'Macro', 'flower'],
  ['vintage', 'Vintage film', 'clapperboard'], ['vhs', 'VHS', 'cassette-tape'], ['crt', 'CRT', 'monitor'], ['security', 'Security cam', 'cctv'],
  ['viewfinder', 'Viewfinder', 'video'], ['dreamy', 'Dreamy', 'sparkles'], ['night-vision', 'Night vision', 'moon']];
const LENS_MOVES = [['none', 'Static'], ['push', 'Push in'], ['pull', 'Pull out'], ['crash', 'Crash zoom'], ['dolly', 'Dolly zoom'], ['rack', 'Rack focus']];
const LENS_OVERLAYS = ['vignette', 'chromatic', 'flare', 'leaks', 'dust', 'grain', 'bokeh', 'scanlines', 'letterbox', 'rec'];

function LensDesigner({ project, scene, onPatch, onScenePatch }) {
  const [target, setTarget] = useState(scene && scene.lens ? 'scene' : 'film');
  const cur = (target === 'scene' ? scene && scene.lens : project.lens) || { type: 'none' };
  const save = (patch) => {
    const next = { ...cur, ...patch };
    if (target === 'scene' && scene && onScenePatch) onScenePatch(scene.id, { lens: next.type === 'none' && !patch.type ? null : next });
    else onPatch({ lens: next });
  };
  const ov = new Set(cur.overlays || []);
  return html`<div>
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Lens designer</div>
    <div class="seg" style=${{ marginBottom: '8px' }}>${[['film', 'Whole film'], ['scene', scene ? `Scene ${scene.index + 1}` : 'Scene']].map(([v, l]) => html`<button class=${target === v ? 'on' : ''} disabled=${v === 'scene' && !scene} onClick=${() => setTarget(v)}>${l}</button>`)}</div>
    <div class="row" style=${{ flexWrap: 'wrap', gap: '6px' }}>${LENSES.map(([id, label, icon]) => html`<button class=${'btn sm ' + ((cur.type || 'none') === id ? 'brand' : '')} onClick=${() => save({ type: id })}><${Icon} name=${icon} size=${12} />${label}</button>`)}</div>
    ${cur.type && cur.type !== 'none' ? html`<div class="kv" style=${{ marginTop: '10px' }}>
      <span>Strength</span><input type="range" min="0" max="2" step="0.1" value=${cur.strength ?? 1} onChange=${(e) => save({ strength: parseFloat(e.target.value) })} />
      <span>Lens move</span><select class="select sm" value=${cur.move || 'none'} onChange=${(e) => save({ move: e.target.value })}>${LENS_MOVES.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>
      ${cur.move && cur.move !== 'none' && cur.move !== 'rack' ? html`<span>Zoom to</span><input type="range" min="1.02" max="2" step="0.02" value=${cur.zoom ?? 1.25} onChange=${(e) => save({ zoom: parseFloat(e.target.value) })} />
        <span>Move starts</span><input class="input sm" type="number" step="0.1" min="0" style=${{ width: '80px' }} value=${cur.moveAt ?? 0.4} onChange=${(e) => save({ moveAt: parseFloat(e.target.value) || 0 })} />` : null}
    </div>
    <div class="row" style=${{ flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>${LENS_OVERLAYS.map((o) => html`<button class=${'chip ' + (ov.has(o) ? 'ok' : '')} style=${{ cursor: 'pointer' }} onClick=${() => { const n = new Set(ov); if (n.has(o)) n.delete(o); else n.add(o); save({ overlays: [...n] }); }}>${o}</button>`)}</div>
    <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Applies on top of the scene code in previews and renders. Agents can also call component('lens', ...) per shot.</div>` : null}
  </div>`;
}

export function CaptionsPanel({ project, onPatch, onSubtitles, onCueEdit, onCheckSync, syncing, selectedCue, onSeek, onReflow }) {
  const cap = project.captions || {};
  const [paste, setPaste] = useState('');
  const input = useRef(null);
  const cues = project.cues || [];
  const set = (p) => onPatch({ captions: p });
  const capLang = useProjectLanguage(project.id, [cues.length]);
  const capScripts = (capLang && capLang.scripts) || [];
  return html`<div>
    <div class="row"><button class=${'switch ' + (cap.enabled !== false ? 'on' : '')} onClick=${() => set({ enabled: cap.enabled === false })}></button><b>Burned-in captions</b></div>
    <div class="row" style=${{ marginTop: '8px' }}><button class=${'switch ' + (cap.from_narration ? 'on' : '')} onClick=${() => set({ from_narration: !cap.from_narration })}></button><span style=${{ fontSize: '12px' }}>Caption the narration when there is no subtitle file</span></div>
    ${(project.scenes || []).some((s) => (s.cue_ids || []).length) ? html`<div class="reflow-box">
      <div class="row"><button class=${'switch ' + (cap.link_scenes ? 'on' : '')} onClick=${() => set({ link_scenes: !cap.link_scenes })}></button><b style=${{ fontSize: '12px' }}>Scenes follow captions</b></div>
      <div class="muted" style=${{ fontSize: '11.5px', margin: '4px 0 6px' }}>${cap.link_scenes ? 'When you move, split, merge, add or delete a caption, the scene cuts move with it.' : 'Off: moving a caption leaves the scenes where they are, and the timeline flags any scene whose caption moved.'}</div>
      <button class="btn sm" onClick=${onReflow}><${Icon} name="align-horizontal-distribute-center" size=${12} />Re-flow scenes now</button></div>` : null}
    <div class="section-title" style=${{ margin: '14px 0 6px' }}>Style</div>
    <div class="seg" style=${{ flexWrap: 'wrap' }}>${[['', 'Auto'], ['pop', 'Pop'], ['karaoke', 'Karaoke'], ['boxed', 'Boxed'], ['minimal', 'Minimal'], ['typewriter', 'Type']].map(([v, l]) => html`<button class=${(cap.style || '') === v ? 'on' : ''} onClick=${() => set({ style: v || null })}>${l}</button>`)}</div>
    <div class="kv" style=${{ marginTop: '12px' }}>
      <span>Position</span><div class="seg">${['top', 'middle', 'bottom'].map((p) => html`<button class=${(cap.position || 'bottom') === p ? 'on' : ''} onClick=${() => set({ position: p })}>${p}</button>`)}</div>
      <span>Size</span><input type="range" min="0.6" max="1.6" step="0.05" value=${cap.size || 1} onChange=${(e) => set({ size: parseFloat(e.target.value) })} />
      <span>Highlight</span><div class="row"><input type="color" value=${cap.highlight || '#ffe500'} onChange=${(e) => set({ highlight: e.target.value })} /><button class="btn ghost sm" onClick=${() => set({ highlight: null })}>accent</button></div>
    </div>
    <div class="kv" style=${{ marginTop: '10px' }}><span>Caption font</span><${FontSelect} sm value=${cap.font_family || ''} scripts=${capScripts} extra=${[['', 'Same as display']]} onChange=${(v) => set({ font_family: v || null })} /></div>
    <div class="section-title" style=${{ margin: '14px 0 6px' }}>Timing</div>
    <div class="seg">${[['exact', 'Exact SRT cues'], ['words', 'Short word chunks']].map(([v, l]) => html`<button class=${(cap.sync || 'exact') === v ? 'on' : ''} onClick=${() => set({ sync: v })}>${l}</button>`)}</div>
    <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>${(cap.sync || 'exact') === 'exact' ? 'Each subtitle shows exactly from its start to its end time. Word timings in a JSON file are always used exactly.' : 'Splits cues into 3 to 4 word pages; without word timings the page changes inside a cue are estimated.'}</div>
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Master clock</div>
    <div class="row" style=${{ marginBottom: '8px' }}><span class=${'chip ' + (cues.length && !project.cues_synthetic ? 'ok' : '')}>${cues.length ? (project.cues_synthetic ? 'Estimated from narration' : 'Subtitle driven') : 'No cues'}</span><span class="chip">${cues.length} cues</span></div>
    <button class="btn sm" onClick=${() => input.current.click()}><${Icon} name="upload" size=${12} />Upload SRT / VTT / JSON</button>
    <input type="file" class="hidden" accept=".srt,.vtt,.ass,.ssa,.json,.txt" ref=${input} onChange=${(e) => e.target.files[0] && onSubtitles(e.target.files[0])} />
    <textarea class="textarea mono" rows="4" style=${{ marginTop: '8px', fontSize: '11px' }} placeholder="Or paste SRT / VTT / JSON here" value=${paste} onInput=${(e) => setPaste(e.target.value)}></textarea>
    <div class="row" style=${{ marginTop: '6px' }}><button class="btn sm primary" disabled=${!paste.trim()} onClick=${() => { onSubtitles(paste); setPaste(''); }}>Use pasted cues</button>
      <span class="muted" style=${{ fontSize: '11px' }}>Re-plan to fit scenes to new cues.</span></div>
    <div class="section-title" style=${{ margin: '18px 0 8px' }}>Sync check</div>
    ${(() => {
    const sy = project.sync;
    return html`<div class=${'sync-card ' + (sy && !sy.skipped ? (sy.ok ? 'ok' : 'bad') : '')}>
      <div class="row"><${Icon} name=${sy && sy.ok ? 'badge-check' : 'timer'} size=${15} /><b class="grow">${sy ? (sy.skipped ? 'Nothing to check' : sy.ok ? `${sy.checked}/${sy.checked} cues frame-exact` : `${sy.failed} of ${sy.checked} cues off`) : 'Not verified yet'}</b>
        <button class="btn sm" disabled=${syncing || !cues.length} onClick=${onCheckSync}><${Icon} name=${syncing ? 'loader-circle' : 'scan-search'} cls=${syncing ? 'spin' : ''} size=${12} />${syncing ? 'Checking' : 'Check sync'}</button></div>
      ${sy && !sy.skipped ? html`<div class="muted" style=${{ fontSize: '11px', marginTop: '4px' }}>Max drift ${sy.max_drift_ms}ms (one frame is ${sy.frame_ms}ms). The Sync agent probes every cue in the real scene documents.</div>` : html`<div class="muted" style=${{ fontSize: '11px', marginTop: '4px' }}>The Sync agent checks every caption frame by frame against your SRT before mastering.</div>`}
      ${sy && (sy.fixes || []).length ? html`<div style=${{ fontSize: '11px', marginTop: '6px' }}>${sy.fixes.map((f) => html`<div class="row"><${Icon} name="wrench" size=${11} />${f}</div>`)}</div>` : null}
      ${sy && (sy.warnings || []).length ? html`<div style=${{ fontSize: '11px', marginTop: '6px', color: 'var(--warn, #b45309)' }}>${sy.warnings.map((f) => html`<div class="row"><${Icon} name="triangle-alert" size=${11} />${f}</div>`)}</div>` : null}
    </div>`;
  })()}
    <div class="section-title" style=${{ margin: '18px 0 6px' }}>Cues<span class="spacer"></span><span style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>drag on the timeline to retime</span></div>
    ${cues.slice(0, 300).map((c) => {
    const bad = project.sync && (project.sync.cues || []).find((x) => x.id === c.id && !x.ok);
    return html`<div class=${'cue-row ' + (selectedCue === c.id ? 'on ' : '') + (bad ? 'bad' : '')}>
      <div class="row cue-times">
        <button class="btn ghost icon sm" title="Jump to cue" onClick=${() => onSeek && onSeek(c.start + 0.001)}><${Icon} name="locate-fixed" size=${12} /></button>
        <input class="input sm mono" value=${c.start.toFixed(3)} title="Start (s)" onChange=${(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v < c.end) onCueEdit(c.id, { start: v }); }} />
        <span class="muted">→</span>
        <input class="input sm mono" value=${c.end.toFixed(3)} title="End (s)" onChange=${(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > c.start) onCueEdit(c.id, { end: v }); }} />
        ${bad ? html`<span class="chip bad" title="Measured drift">${bad.in_ms == null ? 'missing' : bad.in_ms + 'ms'}</span>` : null}
      </div>
      <input class="input sm" value=${c.text} onChange=${(e) => onCueEdit(c.id, { text: e.target.value })} /></div>`;
  })}
  </div>`;
}

export function NarrationBox({ project }) {
  const a = project.audio || {};
  const lang = ((project.options || {}).language || 'auto') === 'auto' ? '' : (project.options || {}).language;
  const [voices, setVoices] = useState([]);
  const [vsel, setVsel] = useState(a.tts_voice || '');
  const [rate, setRate] = useState('+0%');
  const [narrBusy, setNarrBusy] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [prov, setProv] = useState('edge');
  useEffect(() => { api.get('/api/tts/voices?lang=' + encodeURIComponent(lang || '')).then((d) => { setTtsOn(!!d.enabled); setProv(d.provider || 'edge'); setVoices(d.voices || []); if (!vsel) setVsel(d.default || ''); }).catch(() => null); }, [lang]);
  if (!ttsOn) return html`<div><div class="section-title" style=${{ marginBottom: '8px' }}>AI narration</div>
    <div class="muted" style=${{ fontSize: '12px' }}>Text to speech is off. Switch it on in Models > Voice and generation (free neural voices or ElevenLabs).</div>
    <div class="divider" style=${{ margin: '14px 0' }}></div></div>`;
  const narrate = async () => {
    setNarrBusy(true);
    try {
      const d = await api.post(`/api/projects/${project.id}/voice/tts`, { voice: vsel, rate });
      toast(`Narration voiced (${fmtDur(d.duration)}); scenes and subtitles now follow the voice`, 'ok');
    } catch (e) { toast(e.message, 'err'); }
    setNarrBusy(false);
  };
  return html`<div>
    <div class="section-title" style=${{ marginBottom: '8px' }}>AI narration<span class="chip">${prov === 'elevenlabs' ? 'ElevenLabs' : 'free'}</span></div>
    <div class="row"><select class="select sm grow" value=${vsel} onChange=${(e) => setVsel(e.target.value)}><option value="">Agent casts the voice</option>${voices.map((v) => html`<option value=${v.id}>${v.name} · ${[v.gender, v.age, v.accent].filter(Boolean).join(', ')}</option>`)}</select>
      <select class="select sm" style=${{ width: '86px' }} value=${rate} onChange=${(e) => setRate(e.target.value)}>${['-10%', '+0%', '+8%', '+15%'].map((r) => html`<option value=${r}>${r === '+0%' ? 'normal' : r}</option>`)}</select></div>
    <button class="btn sm brand" style=${{ marginTop: '8px' }} disabled=${narrBusy} onClick=${narrate}>${narrBusy ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="mic" size=${12} />`}Voice the narration</button>
    <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Reads every scene's narration with a neural voice (322 voices, Bangla included), re-times scenes to the speech and writes word-exact subtitles. Re-render afterwards.</div>
    <div class="divider" style=${{ margin: '14px 0' }}></div>
  </div>`;
}

export function AudioPanel({ project, onPatch, onUpload }) {
  const a = project.audio || {};
  const audios = (project.assets || []).filter((x) => x.kind === 'audio');
  const input = useRef(null);
  return html`<div>
    <${NarrationBox} project=${project} />
    <div class="section-title" style=${{ marginBottom: '8px' }}>Music bed</div>
    <select class="select sm" value=${a.music || ''} onChange=${(e) => onPatch({ audio: { music: e.target.value || null } })}>
      <option value="auto">Generated score (style matched)</option><option value="">No music</option>${audios.map((x) => html`<option value=${x.id}>${x.name}</option>`)}</select>
    <div class="kv" style=${{ marginTop: '10px' }}><span>Music level</span><input type="range" min="-32" max="-6" step="1" value=${a.music_gain ?? -18} onChange=${(e) => onPatch({ audio: { music_gain: parseFloat(e.target.value) } })} /></div>
    <div class="section-title" style=${{ margin: '16px 0 8px' }}>Voiceover</div>
    <select class="select sm" value=${a.voice || ''} onChange=${(e) => onPatch({ audio: { voice: e.target.value || null } })}>
      <option value="">None</option>${audios.map((x) => html`<option value=${x.id}>${x.name}${x.meta && x.meta.duration ? ' · ' + fmtDur(x.meta.duration) : ''}</option>`)}</select>
    <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Voiceover starts at 0s and ducks the music automatically. Pair it with its SRT for exact timing.</div>
    <div class="row" style=${{ marginTop: '14px' }}><button class=${'switch ' + (a.sfx !== false ? 'on' : '')} onClick=${() => onPatch({ audio: { sfx: a.sfx === false } })}></button><span>Transition whooshes and payoff hit</span></div>
    <button class="btn sm" style=${{ marginTop: '14px' }} onClick=${() => input.current.click()}><${Icon} name="upload" size=${12} />Upload audio</button>
    <input type="file" accept="audio/*" class="hidden" ref=${input} onChange=${(e) => onUpload(e.target.files, 'music')} />
    <div class="muted" style=${{ fontSize: '11px', marginTop: '10px' }}>Master loudness is normalised to −16 LUFS, true peak −1.5 dBTP.</div>
  </div>`;
}

export function ResearchPanel() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [page, setPage] = useState(null);
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true); setPage(null);
    try { setRes(await api.post('/api/research/search', { q })); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const open = async (url) => {
    setBusy(true);
    try { setPage(await api.post('/api/research/browse', { url })); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return html`<div>
    <div class="row"><input class="input sm" placeholder="Search the open web" value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && search()} />
      <button class="btn sm primary icon" onClick=${search}>${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${13} />` : html`<${Icon} name="search" size=${13} />`}</button></div>
    <div class="muted" style=${{ fontSize: '11px', margin: '6px 0 10px' }}>Keyless scraping: DuckDuckGo, Brave, Bing, Mojeek, Wikipedia. Pages open in the render farm's headless browser.</div>
    ${page ? html`<div class="card" style=${{ overflow: 'hidden', marginBottom: '10px' }}>
      ${page.frame ? html`<img src=${'data:image/jpeg;base64,' + page.frame} style=${{ width: '100%', display: 'block' }} />` : null}
      <div style=${{ padding: '8px 10px' }}><b style=${{ fontSize: '12px' }}>${page.title}</b><div class="muted" style=${{ fontSize: '11px', maxHeight: '180px', overflow: 'auto', marginTop: '4px', whiteSpace: 'pre-wrap' }}>${(page.text || '').slice(0, 1600)}</div>
      <button class="btn sm" style=${{ marginTop: '6px' }} onClick=${() => { navigator.clipboard && navigator.clipboard.writeText(page.url); toast('Link copied'); }}><${Icon} name="link" size=${12} />Copy link</button></div></div>` : null}
    ${res ? html`<div class="muted" style=${{ fontSize: '11px', marginBottom: '6px' }}>${res.engines.map((e) => `${e.engine}${e.error ? ' (blocked)' : ' ' + e.count}`).join(' · ')}</div>
      ${res.results.map((r) => html`<div class="result"><a href="#" onClick=${(e) => { e.preventDefault(); open(r.url); }}>${r.title || r.url}</a>${r.snippet ? html`<div style=${{ fontSize: '11.5px', color: 'var(--ink-2)', marginTop: '2px' }}>${r.snippet}</div>` : null}<small>${r.engine} · ${r.url}</small></div>`)}` : null}
  </div>`;
}

export function HistoryPanel({ project, onRestore }) {
  const [revs, setRevs] = useState([]);
  useEffect(() => { api.get(`/api/projects/${project.id}/revisions`).then((d) => setRevs(d.revisions)); }, [project.updated]);
  return html`<div>${revs.length ? revs.map((r) => html`<div class="row" style=${{ padding: '7px 0', borderBottom: '1px dashed var(--line)', fontSize: '12px' }}>
    <${Icon} name="history" size=${13} /><div class="grow"><b class="mono" style=${{ fontSize: '11px' }}>${r.id}</b><div class="muted">${r.reason || 'save'} · ${r.scenes} scenes</div></div>
    <button class="btn sm" onClick=${() => onRestore(r.id)}>Restore</button></div>`) : html`<div class="muted">No revisions yet.</div>`}</div>`;
}

export function ExportPanel({ project }) {
  const o = project.outputs || {};
  const v = Math.round(o.updated || 0);
  return html`<div class="col" style=${{ gap: '10px' }}>
    ${o.master ? html`<video src=${o.master + '?v=' + v} controls style=${{ width: '100%', borderRadius: '10px', background: '#000' }}></video>
      <div class="kv"><span>Duration</span><b class="mono">${(o.duration || 0).toFixed(2)}s</b><span>Drift</span><span class="mono">${Math.round((o.drift || 0) * 1000)} ms</span>
        <span>Size</span><span class="mono">${((o.size || 0) / 1048576).toFixed(1)} MB</span><span>Seams</span><span>${(o.transitions || []).join(', ')}</span></div>` : html`<div class="muted">Render the film to unlock downloads.</div>`}
    <a class=${'btn ' + (o.master ? 'primary' : '')} href=${o.master || '#'} download><${Icon} name="download" size=${14} />Master MP4</a>
    <a class="btn" href=${o.srt || '#'} download><${Icon} name="captions" size=${14} />Subtitles SRT</a>
    <a class="btn" href=${o.poster || '#'} download><${Icon} name="image" size=${14} />Poster frame</a>
    <a class="btn" href=${`/api/projects/${project.id}/export`}><${Icon} name="package" size=${14} />Project bundle (scenes, code, skills)</a>
    <a class="btn" href="/api/skills.zip"><${Icon} name="book-open-text" size=${14} />Universal skill pack</a>
  </div>`;
}
