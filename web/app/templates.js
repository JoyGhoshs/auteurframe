import { html, useState, useEffect, useRef, Icon, api, navigate, toast } from './lib.js';

function playFrame(e) {
  const w = e.target.contentWindow;
  let n = 0;
  const go = () => { if (w && w.AU && w.__AU_READY) w.AU.play({ from: 0, loop: true }); else if (n++ < 200) setTimeout(go, 60); };
  go();
}

function Live({ src, w, h }) {
  const box = useRef(null);
  const [k, setK] = useState(0.2);
  useEffect(() => {
    const ro = new ResizeObserver(() => box.current && setK(box.current.clientWidth / w));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [w]);
  return html`<div class="live-frame" ref=${box} style=${{ aspectRatio: `${w}/${h}`, maxWidth: `calc(64vh * ${w} / ${h})`, margin: "0 auto" }}><iframe key=${src} src=${src} style=${{ width: w + 'px', height: h + 'px', transform: `scale(${k})` }} onLoad=${playFrame}></iframe></div>`;
}

const DIMS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

export function TemplatesPage({ id }) {
  const [list, setList] = useState([]);
  const [cat, setCat] = useState('All');
  const [hover, setHover] = useState(null);
  const [feed, setFeed] = useState(null);
  const [pulling, setPulling] = useState(false);
  const loadList = () => api.get('/api/templates').then((d) => setList(d.templates));
  useEffect(() => { loadList(); api.get('/api/updates').then(setFeed).catch(() => null); }, []);
  const pull = async () => {
    setPulling(true);
    try {
      const r = await api.post('/api/updates/templates', {});
      setFeed(r.summary);
      await loadList();
      window.dispatchEvent(new Event('auteurframe:updates'));
      toast(r.installed.length ? `${r.installed.length} new template${r.installed.length > 1 ? 's' : ''} added` : 'Templates are up to date', 'ok');
      if (r.failed.length) toast(`${r.failed[0].id}: ${r.failed[0].error}`, 'err');
    } catch (e) { toast(e.message, 'err'); }
    setPulling(false);
  };
  if (id) return html`<${TemplateForm} id=${id} list=${list} />`;
  const cats = ['All', ...new Set(list.map((t) => t.category))];
  const shown = list.filter((t) => cat === 'All' || t.category === cat);
  return html`<div class="home"><div class="tpl-page">
    <div class="eyebrow mono">TEMPLATES · NO AI REQUIRED</div>
    <h1 class="h2" style=${{ fontSize: 'clamp(44px, 5.4vw, 84px)' }}>Pick a film. <em style=${{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: '#FF4D2E' }}>Fill the blanks.</em></h1>
    <p class="h-p">Each template is a directed sequence of scenes. Upload your logo, screens, photos or music, type a few lines, and the render farm produces the video. Everything stays editable in the studio afterwards.</p>
    ${feed && feed.pending ? html`<div class="tpl-feed"><${Icon} name="radio-tower" size=${18} /><div class="grow"><b>${feed.pending} new template${feed.pending > 1 ? 's' : ''} from the AuteurFrame feed</b>
      <div class="muted">${feed.templates.filter((t) => t.status !== 'installed').map((t) => t.name).join(' · ')}</div></div>
      <button class="btn brand sm" disabled=${pulling} onClick=${pull}>${pulling ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="download" size=${12} />`}Add to studio</button></div>` : null}
    <div class="tpl-cats">${cats.map((c) => html`<button class=${cat === c ? 'on' : ''} onClick=${() => setCat(c)}>${c}</button>`)}</div>
    <div class="tpl-grid">${shown.map((t) => html`<div class="tpl-card" onMouseEnter=${() => setHover(t.id)} onMouseLeave=${() => setHover(null)} onClick=${() => navigate('/templates/' + t.id)}>
      <div class="tpl-media">${hover === t.id ? html`<${Live} src=${`/api/templates/${t.id}/preview?aspect=16:9`} w=${1920} h=${1080} />` : html`<img class="tpl-img" src=${`/api/templates/${t.id}/poster.jpg?aspect=16:9`} loading="lazy" />`}</div>
      <div class="tpl-body"><div class="row"><span class="mono eyebrow grow">${t.category} · ${t.aspect}</span>${t.source === 'feed' ? html`<span class="chip brand">New</span>` : null}<span class="chip">${t.slots.length} inputs</span></div><b>${t.name}</b><p>${t.description}</p></div></div>`)}</div>
  </div></div>`;
}

function TemplateForm({ id, list }) {
  const t = list.find((x) => x.id === id);
  const [styles, setStyles] = useState([]);
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [aspect, setAspect] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [captions, setCaptions] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [busy, setBusy] = useState('');
  useEffect(() => { api.get('/api/styles').then((d) => setStyles(d.styles)); }, []);
  useEffect(() => {
    if (!t) return;
    const v = {};
    t.slots.forEach((s) => { if (['text', 'textarea', 'list'].includes(s.kind)) v[s.key] = s.default || ''; });
    setValues(v); setAspect(t.aspect); setStyle(t.style); setTitle(t.name);
  }, [t && t.id]);
  if (!t) return html`<div class="tpl-page muted">Loading template…</div>`;
  const [w, h] = DIMS[aspect || t.aspect] || DIMS['16:9'];
  const addFiles = (slot, fl) => setFiles((f) => {
    const cur = f[slot.key] || [];
    const max = slot.kind === 'images' ? (slot.max || 9) : 1;
    const next = slot.kind === 'images' ? [...cur, ...Array.from(fl)].slice(0, max) : Array.from(fl).slice(0, 1);
    return { ...f, [slot.key]: next };
  });
  const missing = t.slots.filter((s) => s.required && (['image', 'images', 'logo', 'audio'].includes(s.kind) ? !(files[s.key] || []).length : !(values[s.key] || '').trim()));
  const go = async () => {
    if (missing.length) { toast(`Please fill: ${missing.map((m) => m.label).join(', ')}`, 'err'); return; }
    try {
      setBusy('Creating production');
      const p = await api.post('/api/projects', { title: title || t.name, brief: `${t.name} template`, aspect, style, duration: 30, fps: 30, options: { mode: 'house', stock: false, template: t.id }, captions: { enabled: captions } });
      let n = 0;
      const all = Object.entries(files).flatMap(([k, arr]) => arr.map((f) => [k, f]));
      for (const [k, f] of all) { n++; setBusy(`Uploading ${n}/${all.length}`); await api.upload(`/api/projects/${p.id}/assets`, f, { role: 'slot:' + k }); }
      setBusy('Directing scenes');
      const vals = {};
      t.slots.forEach((s) => { if (s.kind === 'list') vals[s.key] = (values[s.key] || '').split('\n').map((x) => x.trim()).filter(Boolean); else if (values[s.key] !== undefined) vals[s.key] = values[s.key]; });
      await api.post(`/api/projects/${p.id}/template`, { template: t.id, values: vals, title, captions, render: true });
      navigate('/p/' + p.id);
    } catch (e) { toast(e.message, 'err'); setBusy(''); }
  };
  const sceneCount = { 'app-launch': 4, 'saas-film': 5, showreel: 5, 'paper-story': 5, 'vox-explainer': 6, 'photo-memories': 3, 'music-visualizer': 1, 'code-explainer': 4, 'gallery-3d': 3, 'data-story': 5, 'logo-sting': 1, 'mascot-tips': 4, 'particle-title': 1, 'creator-short': 5 }[t.id] || 3;
  return html`<div class="home"><div class="tpl-page">
    <button class="cta-ghost" style=${{ height: '40px', marginBottom: '20px' }} onClick=${() => navigate('/templates')}><${Icon} name="arrow-left" size=${15} />All templates</button>
    <div class="tpl-form">
      <div class="col" style=${{ gap: '14px' }}>
        <div><div class="eyebrow mono">${t.category} TEMPLATE</div><h1 class="h2" style=${{ fontSize: 'clamp(40px, 4.4vw, 68px)' }}>${t.name}</h1><p class="h-p" style=${{ margin: '12px 0 4px' }}>${t.description}</p></div>
        <div class="slot"><label class="label">Production title</label><input class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} /></div>
        ${t.slots.map((s) => html`<div class="slot">
          <label class="label">${s.label}${s.required ? ' *' : ''}</label>
          ${s.kind === 'text' ? html`<input class="input" value=${values[s.key] || ''} onInput=${(e) => setValues({ ...values, [s.key]: e.target.value })} />` : null}
          ${s.kind === 'textarea' ? html`<textarea class="textarea mono" rows="8" value=${values[s.key] || ''} onInput=${(e) => setValues({ ...values, [s.key]: e.target.value })}></textarea>` : null}
          ${s.kind === 'list' ? html`<textarea class="textarea" rows="4" value=${values[s.key] || ''} onInput=${(e) => setValues({ ...values, [s.key]: e.target.value })}></textarea>` : null}
          ${['image', 'images', 'logo', 'audio'].includes(s.kind) ? html`<div class="slot-files">
            ${(files[s.key] || []).map((f, i) => html`<div class="slot-file">${f.type.startsWith('image/') ? html`<img src=${URL.createObjectURL(f)} />` : html`<${Icon} name=${f.type.startsWith('audio/') ? 'music' : 'film'} size=${24} />`}
              <button onClick=${() => setFiles({ ...files, [s.key]: files[s.key].filter((_, j) => j !== i) })}><${Icon} name="x" size=${11} /></button></div>`)}
            ${s.kind === 'images' || !(files[s.key] || []).length ? html`<label class="slot-add"><${Icon} name=${s.kind === 'audio' ? 'music' : 'image-plus'} size=${22} />
              <input type="file" class="hidden" multiple=${s.kind === 'images'} accept=${s.kind === 'audio' ? 'audio/*' : s.kind === 'logo' ? 'image/*,.svg' : 'image/*,video/*'} onChange=${(e) => addFiles(s, e.target.files)} /></label>` : null}
          </div>` : null}
          ${s.help ? html`<span class="muted" style=${{ fontSize: '11.5px' }}>${s.help}</span>` : null}
          ${['text', 'list'].includes(s.kind) && /\*/.test(s.default || '') ? html`<span class="muted" style=${{ fontSize: '11.5px' }}>Wrap a word in *asterisks* to accent it.</span>` : null}
        </div>`)}
        <div class="slot"><div class="grid2">
          <div class="field"><label class="label">Format</label><select class="select" value=${aspect} onChange=${(e) => setAspect(e.target.value)}>${Object.keys(DIMS).map((a) => html`<option value=${a}>${a}</option>`)}</select></div>
          <div class="field"><label class="label">Visual style</label><select class="select" value=${style} onChange=${(e) => setStyle(e.target.value)}>${styles.map((s) => html`<option value=${s.id}>${s.name}</option>`)}</select></div>
        </div><div class="row" style=${{ marginTop: '6px' }}><button class=${'switch ' + (captions ? 'on' : '')} onClick=${() => setCaptions(!captions)}></button><span>Burn in captions (if you add subtitles later)</span></div></div>
      </div>
      <div class="tpl-preview">
        <${Live} src=${`/api/templates/${t.id}/preview?aspect=${aspect || t.aspect}&scene=${sceneIdx}`} w=${w} h=${h} />
        <div class="tpl-scenes">${Array.from({ length: sceneCount }, (_, i) => html`<button class=${'btn sm ' + (sceneIdx === i ? 'on' : '')} onClick=${() => setSceneIdx(i)}>Scene ${i + 1}</button>`)}</div>
        <span class="muted" style=${{ fontSize: '12px' }}>Preview shows sample content. Your text, images and music replace it when you generate.</span>
        <button class="cta-main" disabled=${!!busy} onClick=${go} style=${{ justifyContent: 'space-between' }}><span>${busy || 'Generate video'}</span><i>${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${18} />` : html`<${Icon} name="arrow-right" size=${18} />`}</i></button>
        ${missing.length ? html`<span class="muted" style=${{ fontSize: '12px' }}>Required: ${missing.map((m) => m.label).join(', ')}</span>` : null}
      </div>
    </div>
  </div></div>`;
}
