import { html, useState, useEffect, useRef, Icon, api, navigate, toast } from './lib.js';
import { useFonts } from './fontpicker.js';

const IDEAS = [
  'Fast creator edit: punch-in zooms on every key phrase, word-pop captions, whoosh on every cut',
  'Remove all pauses, add stock b-roll for the nouns I mention, golden film look',
  'Calm documentary feel: slow pushes, minimal captions, moody grade, soft music',
  'Add a hook title in the first second, a progress bar and a follow button at the end',
  'Highlight every number with a big stat card and a pop sound',
];

export function EditWizard({ health }) {
  const [video, setVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [dims, setDims] = useState(null);
  const [subs, setSubs] = useState(null);
  const [files, setFiles] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [aspect, setAspect] = useState('auto');
  const [cut, setCut] = useState(true);
  const [stockOn, setStockOn] = useState(true);
  const [caps, setCaps] = useState('pop');
  const [music, setMusic] = useState('minimal');
  const [grade, setGrade] = useState('auto');
  const [language, setLanguage] = useState('auto');
  const fontData = useFonts();
  const [moods, setMoods] = useState([]);
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);
  const vin = useRef(null);
  useEffect(() => { api.get('/api/audio/library').then((d) => setMoods(d.moods)); }, []);
  const pickVideo = (f) => {
    if (!f) return;
    setVideo(f);
    setVideoUrl(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 60));
  };
  const onMeta = (e) => setDims({ w: e.target.videoWidth, h: e.target.videoHeight, d: e.target.duration });
  const finalAspect = aspect !== 'auto' ? aspect : dims ? (dims.h > dims.w * 1.2 ? '9:16' : dims.w > dims.h * 1.2 ? '16:9' : '1:1') : '9:16';
  const go = async () => {
    if (!video) { toast('Add a video to edit', 'err'); return; }
    try {
      setBusy('Creating project');
      const gradeWord = grade === 'auto' ? '' : ` Grade: ${grade}.`;
      const brief = (prompt || 'Make this a fast, engaging short with zooms, captions and b-roll.') + gradeWord;
      const p = await api.post('/api/projects', { title: title || 'Video edit', brief, aspect: finalAspect, style: 'creator-bold', duration: Math.max(5, Math.round((dims && dims.d) || 30)), fps: 30,
        options: { mode: 'auto', stock: stockOn, cut_silence: cut, language }, captions: { enabled: caps !== 'none', style: caps === 'none' ? null : caps }, workspace: localStorage.getItem('af.ws') || null });
      setBusy('Uploading video');
      await api.upload(`/api/projects/${p.id}/assets`, video, { role: 'footage' });
      if (subs) { setBusy('Reading subtitles'); await api.upload(`/api/projects/${p.id}/assets`, subs, { role: 'subtitles' }); }
      let n = 0;
      for (const f of files) { n++; setBusy(`Uploading files ${n}/${files.length}`); await api.upload(`/api/projects/${p.id}/assets`, f, { role: f.type.startsWith('audio/') ? 'music' : 'reference' }); }
      await api.patch(`/api/projects/${p.id}`, { audio: { music: music ? 'mood:' + music : null } });
      await api.post(`/api/projects/${p.id}/run`, { mode: 'edit' });
      navigate('/p/' + p.id);
    } catch (e) { toast(e.message, 'err'); setBusy(''); }
  };
  return html`<div class="wizard">
    <div class="wiz-head"><div class="grow"><span class="chip brand" style=${{ width: 'fit-content' }}><${Icon} name="clapperboard" size=${12} />Edit my video</span>
      <h1 style=${{ marginTop: '10px' }}>Tell the edit swarm what to do</h1>
      <div class="muted" style=${{ marginTop: '4px' }}>Cut, caption, zoom, b-roll, sound and grade agents edit your clip together. You can change every edit afterwards in the studio.</div></div></div>
    <div class="ew-grid">
      <div class="col" style=${{ gap: '14px' }}>
        <section class="wiz-sec">
          <h2><span class="num">1</span>Your video</h2><p>MP4, MOV or WebM. Vertical clips become shorts automatically.</p>
          ${video ? html`<div class="ew-video"><video src=${videoUrl} controls onLoadedMetadata=${onMeta}></video>
              <div class="row"><span class="chip">${video.name}</span>${dims ? html`<span class="chip">${dims.w}×${dims.h}</span><span class="chip">${Math.round(dims.d)}s</span>` : null}<span class="spacer"></span><button class="btn sm" onClick=${() => { setVideo(null); setVideoUrl(''); setDims(null); }}>Replace</button></div></div>` :
      html`<div class=${'drop ' + (over ? 'over' : '')} style=${{ padding: '40px' }} onClick=${() => vin.current.click()} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
              onDrop=${(e) => { e.preventDefault(); setOver(false); pickVideo(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/'))); }}>
              <${Icon} name="cloud-upload" /><b style=${{ color: 'var(--ink)' }}>Drop your clip or click to browse</b><span>Talking head, podcast, product demo, vlog</span></div>`}
          <input type="file" accept="video/*" class="hidden" ref=${vin} onChange=${(e) => pickVideo(e.target.files[0])} />
        </section>
        <section class="wiz-sec">
          <h2><span class="num">2</span>Edit instructions</h2><p>Describe the pace, look and graphics. Mention words, moments or products you want highlighted.</p>
          <textarea class="textarea" rows="5" placeholder="Fast creator edit with punch-in zooms on key words, pop captions, b-roll of a coffee shop when I say coffee, golden film look, follow button at the end" value=${prompt} onInput=${(e) => setPrompt(e.target.value)}></textarea>
          <div class="chips-wrap">${IDEAS.map((s) => html`<button class="sugg" onClick=${() => setPrompt(prompt ? prompt + ' ' + s : s)}>${s.split(':')[0]}</button>`)}</div>
        </section>
        <section class="wiz-sec">
          <h2><span class="num">3</span>Extra files</h2><p>Subtitles make captions and timing exact. Images become b-roll inserts. Audio becomes the music bed.</p>
          <div class="grid2">
            <label class="slot-btn"><${Icon} name="captions" size=${18} /><span>${subs ? subs.name : 'Add SRT, VTT or JSON subtitles'}</span><input type="file" class="hidden" accept=".srt,.vtt,.ass,.json" onChange=${(e) => setSubs(e.target.files[0] || null)} /></label>
            <label class="slot-btn"><${Icon} name="images" size=${18} /><span>${files.length ? `${files.length} files attached` : 'Add images, logos or music'}</span><input type="file" class="hidden" multiple accept="image/*,audio/*,.svg" onChange=${(e) => setFiles([...files, ...Array.from(e.target.files)])} /></label>
          </div>
          ${files.length ? html`<div class="file-list">${files.map((f, i) => html`<span class="file-pill"><${Icon} name=${f.type.startsWith('audio/') ? 'music' : 'image'} /><span class="ellipsis" style=${{ maxWidth: '160px' }}>${f.name}</span>
            <button class="btn ghost icon sm" onClick=${() => setFiles(files.filter((_, j) => j !== i))}><${Icon} name="x" size=${12} /></button></span>`)}</div>` : null}
        </section>
      </div>
      <aside class="wiz-sec ew-side">
        <h2>Edit settings</h2>
        <div class="field"><label class="label">Title</label><input class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} /></div>
        <div class="field"><label class="label">Format · ${finalAspect}</label><div class="seg">${['auto', '9:16', '1:1', '16:9'].map((a) => html`<button class=${aspect === a ? 'on' : ''} onClick=${() => setAspect(a)}>${a}</button>`)}</div></div>
        <div class="row"><button class=${'switch ' + (cut ? 'on' : '')} onClick=${() => setCut(!cut)}></button><span>Remove silences and pauses (jump cuts)</span></div>
        <div class="row"><button class=${'switch ' + (stockOn ? 'on' : '')} onClick=${() => setStockOn(!stockOn)}></button><span>Find stock b-roll automatically</span></div>
        <div class="field"><label class="label">Language</label><select class="select" value=${language} onChange=${(e) => setLanguage(e.target.value)}>
          <option value="auto">Auto detect from subtitles</option>${((fontData && fontData.languages) || []).map((l) => html`<option value=${l.code}>${l.name}</option>`)}</select></div>
        <div class="field"><label class="label">Captions</label><div class="seg" style=${{ flexWrap: 'wrap' }}>${['pop', 'karaoke', 'boxed', 'minimal', 'none'].map((c) => html`<button class=${caps === c ? 'on' : ''} onClick=${() => setCaps(c)}>${c}</button>`)}</div>
          <span class="muted" style=${{ fontSize: '11px' }}>${subs ? 'Captions follow your subtitle file word by word.' : 'Without a subtitle file there is no transcript, so captions are skipped.'}</span></div>
        <div class="field"><label class="label">Grade</label><select class="select" value=${grade} onChange=${(e) => setGrade(e.target.value)}>
          ${[['auto', 'From my instructions'], ['golden-film', 'Golden film'], ['teal-orange', 'Teal and orange'], ['mono', 'Black and white'], ['vivid', 'Vivid pop'], ['moody', 'Moody'], ['cool', 'Cool'], ['faded', 'Faded retro'], ['clean', 'Clean']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></div>
        <div class="field"><label class="label">Music bed</label><select class="select" value=${music} onChange=${(e) => setMusic(e.target.value)}><option value="">None</option>${moods.map((m) => html`<option value=${m.id}>${m.label} · ${m.bpm} bpm</option>`)}</select></div>
        <div class="muted" style=${{ fontSize: '11.5px' }}>${health && health.llm ? 'Your model plans the edit from the transcript and your instructions.' : 'No model connected: the house editor applies creator-style rules.'}</div>
        <button class="btn brand lg" disabled=${!!busy} onClick=${go}>${busy ? html`<${Icon} name="loader-circle" cls="spin" />` : html`<${Icon} name="sparkles" />`}${busy || 'Start the edit swarm'}</button>
      </aside>
    </div>
  </div>`;
}
