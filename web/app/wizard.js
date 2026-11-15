import { html, useState, useEffect, useRef, Icon, api, navigate, toast, fmtDur } from './lib.js';
import { useFonts } from './fontpicker.js';
import { PRESETS } from './dashboard.js';

export function StyleCard({ s, on, onPick, compact }) {
  const [hover, setHover] = useState(false);
  const box = useRef(null);
  const [scale, setScale] = useState(0.1);
  useEffect(() => { if (box.current) setScale(box.current.clientWidth / 1920); }, [hover]);
  const p = s.palette;
  const font = s.display.split(',')[0];
  const onLoad = (e) => {
    const w = e.target.contentWindow;
    const go = () => { if (w.AU && w.__AU_READY) w.AU.play({ from: 0, loop: true }); else setTimeout(go, 60); };
    go();
  };
  return html`<div class=${'style-card ' + (on ? 'on' : '')} onClick=${() => onPick(s.id)} onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}>
    <div class="style-sw" ref=${box} style=${{ background: p.bg, color: p.ink }}>
      <span class="sw-bar" style=${{ background: p.accent }}></span>
      <span class="sw-dots">${['ink', 'accent', 'accent-2'].map((k) => html`<i style=${{ background: p[k] }}></i>`)}</span>
      <div class="sw-title" style=${{ fontFamily: font, fontWeight: 760 }}>${s.name.split(' ')[0]} <span style=${{ color: p.accent }}>${s.name.split(' ').slice(1).join(' ') || 'Motion'}</span></div>
      ${compact ? null : html`<div class="sw-sub" style=${{ fontFamily: s.body.split(',')[0] }}>${s.category} · ${s.motion}</div>`}
      ${hover ? html`<iframe src=${`/api/styles/${s.id}/preview?seed=5`} style=${{ transform: `scale(${scale})` }} onLoad=${onLoad}></iframe>` : null}
    </div>
    ${on ? html`<span class="style-check"><${Icon} name="check" size=${13} /></span>` : null}
    <div class="style-meta"><b>${s.name}</b>${compact ? null : html`<span>${s.tagline}</span>`}</div>
  </div>`;
}

const CAPS = [
  { id: 'pop', name: 'Pop', demo: html`<span style=${{ font: '900 15px Anton, sans-serif', textTransform: 'uppercase', WebkitTextStroke: '3px #000', paintOrder: 'stroke fill' }}>Make it <span style=${{ color: '#FFE500' }}>pop</span></span>` },
  { id: 'karaoke', name: 'Karaoke', demo: html`<span style=${{ font: '800 13px Inter Variable' }}><span style=${{ color: '#FF5A36' }}>Words light</span> <span style=${{ opacity: .45 }}>as spoken</span></span>` },
  { id: 'boxed', name: 'Boxed', demo: html`<span style=${{ font: '600 12px Inter Variable', background: 'rgba(0,0,0,.8)', padding: '4px 8px', borderRadius: '6px' }}>Clean boxed line</span>` },
  { id: 'minimal', name: 'Minimal', demo: html`<span style=${{ font: '500 12px Inter Variable', opacity: .9 }}>Quiet lower line</span>` },
  { id: 'typewriter', name: 'Typewriter', demo: html`<span style=${{ font: '500 12px JetBrains Mono Variable' }}>Typed out_</span>` },
];

function guessRole(file) {
  const n = file.name.toLowerCase();
  if (/\.(srt|vtt|ass|ssa)$/.test(n) || (/\.json$/.test(n))) return 'subtitles';
  if (file.type.startsWith('audio/')) return /voice|vo|narr|speech/.test(n) ? 'voice' : 'music';
  if (/logo/.test(n)) return 'logo';
  if (file.type.startsWith('video/')) return 'footage';
  return 'reference';
}

export function Wizard({ preset, health }) {
  const base = PRESETS.find((p) => p.id === preset) || {};
  const [styles, setStyles] = useState([]);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [language, setLanguage] = useState('auto');
  const fontData = useFonts();
  const [style, setStyle] = useState(base.style || 'auto');
  const [aspect, setAspect] = useState(base.aspect || '16:9');
  const [duration, setDuration] = useState(base.duration || 30);
  const [fps, setFps] = useState(30);
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState(base.id === 'shorts' ? 'pop' : '');
  const [capOn, setCapOn] = useState(true);
  const [fromNarr, setFromNarr] = useState(false);
  const [research, setResearch] = useState(!!base.research);
  const [narration, setNarration] = useState('off');
  const [medium, setMedium] = useState('auto');
  const [scoutOn, setScoutOn] = useState(true);
  const [libMusic, setLibMusic] = useState(true);
  const [mode, setMode] = useState('auto');
  const [quality, setQuality] = useState('final');
  const [runMode, setRunMode] = useState('full');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('All');
  const input = useRef(null);
  useEffect(() => { api.get('/api/styles').then((d) => setStyles(d.styles)); }, []);
  const cats = ['All', ...new Set(styles.map((s) => s.category))];
  const addFiles = (list) => setFiles((f) => [...f, ...Array.from(list).map((file) => ({ file, role: guessRole(file) }))]);
  const hasSubs = files.some((f) => f.role === 'subtitles');
  const [freeAck, setFreeAck] = useState(false);
  const create = async () => {
    if (!brief.trim() && !hasSubs) { toast('Write a brief or add a subtitle file', 'err'); return; }
    if (mode === 'free' && !freeAck) { toast('Tick the box to confirm you understand the Auteur-Free limits', 'err'); return; }
    setBusy(true);
    try {
      const p = await api.post('/api/projects', {
        title: title || (brief.split(/[.!?]/)[0] || 'Untitled film').slice(0, 70), brief, aspect, style, duration: Number(duration), fps: Number(fps),
        options: { research, mode: mode === 'free' ? 'auto' : mode, quality, audience, tone, language, narration, medium, scout: scoutOn, library_music: libMusic }, captions: { enabled: capOn, style: caption || null, from_narration: fromNarr || narration === 'ai' },
        workspace: (() => { try { return localStorage.getItem('af.ws') || null; } catch (e) { return null; } })()
      });
      for (const f of files) {
        await api.upload(`/api/projects/${p.id}/assets`, f.file, { role: f.role === 'subtitles' ? 'subtitles' : f.role });
      }
      await api.post(`/api/projects/${p.id}/run`, mode === 'free' ? { mode: runMode, options: { free_pool: true, free_ack: true } } : { mode: runMode === 'house' ? 'house' : runMode });
      navigate('/p/' + p.id);
    } catch (e) {
      toast(e.message, 'err');
      setBusy(false);
    }
  };
  const shown = styles.filter((s) => filter === 'All' || s.category === filter);
  const aspects = [['16:9', 'Landscape', 'YouTube, web', 44, 25], ['9:16', 'Vertical', 'Shorts, Reels, TikTok', 20, 36], ['1:1', 'Square', 'Feed posts', 32, 32], ['4:5', 'Portrait', 'Instagram feed', 28, 35]];
  return html`<div class="wizard">
    <div class="wiz-head enter">
      <div class="grow"><span class="chip brand" style=${{ width: 'fit-content' }}><${Icon} name="wand-sparkles" size=${12} />New production</span>
        <h1 style=${{ marginTop: '10px' }}>What are we making?</h1>
        <div class="muted" style=${{ marginTop: '4px' }}>The swarm reads your brief and uploads, then plans, animates and renders scene by scene. You can direct every scene in the editor.</div></div>
      ${base.title ? html`<span class="chip">${base.title} preset</span>` : null}
    </div>

    <section class="wiz-sec enter">
      <h2><span class="num">1</span>Brief</h2><p>Say what the film is about, who it is for and what the viewer should feel or do. Facts and numbers help.</p>
      <div class="grid2" style=${{ gridTemplateColumns: '1fr 320px', gap: '16px' }}>
        <div class="col">
          <input class="input" placeholder="Working title (optional)" value=${title} onInput=${(e) => setTitle(e.target.value)} />
          <textarea class="textarea" rows="7" placeholder="Example: A 40 second explainer on why deep sea mining is stuck between investors and biologists. Mention the 1994 rules, the 2023 deadline and that 90 percent of species there are unknown. End with a question." value=${brief} onInput=${(e) => setBrief(e.target.value)}></textarea>
        </div>
        <div class="col">
          <div class="field"><label class="label">Audience</label><input class="input" placeholder="Curious adults, investors, students" value=${audience} onInput=${(e) => setAudience(e.target.value)} /></div>
          <div class="field"><label class="label">Tone</label><input class="input" placeholder="Urgent, witty, calm, premium" value=${tone} onInput=${(e) => setTone(e.target.value)} /></div>
          <div class="field"><label class="label">Language</label><select class="select" value=${language} onChange=${(e) => setLanguage(e.target.value)}>
            <option value="auto">Auto detect from prompt and subtitles</option>
            ${((fontData && fontData.languages) || [{ code: 'en', name: 'English' }, { code: 'bn', name: 'Bangla' }]).map((l) => html`<option value=${l.code}>${l.name}</option>`)}</select></div>
        </div>
      </div>
    </section>

    <section class="wiz-sec enter">
      <h2><span class="num">2</span>Video design</h2><p>Pick the visual language. Hover a card to see it move. Each film gets its own seeded variation, so no two look the same.</p>
      <div class="row" style=${{ marginBottom: '12px', flexWrap: 'wrap' }}>
        <div class="seg">${cats.map((c) => html`<button class=${filter === c ? 'on' : ''} onClick=${() => setFilter(c)}>${c}</button>`)}</div>
      </div>
      <div class="style-grid"><div class=${'style-card auto-card ' + (style === 'auto' ? 'on' : '')} onClick=${() => setStyle('auto')}>
        <div class="style-sw auto-sw"><span class="auto-orb"></span><div class="sw-title">Auto <span>style</span></div><div class="sw-sub">AI reads your prompt</div></div>
        ${style === 'auto' ? html`<span class="style-check"><${Icon} name="check" size=${13} /></span>` : null}
        <div class="style-meta"><b>Auto from prompt</b><span>The art director picks pack, palette, fonts and motion from what you describe.</span></div></div>
        ${shown.map((s) => html`<${StyleCard} key=${s.id} s=${s} on=${style === s.id} onPick=${setStyle} />`)}</div>
    </section>

    <section class="wiz-sec enter">
      <h2><span class="num">3</span>Format</h2><p>Duration is a target. With subtitles the film follows their timing exactly.</p>
      <div class="row" style=${{ alignItems: 'flex-start', gap: '28px', flexWrap: 'wrap' }}>
        <div class="aspect-row">${aspects.map(([id, name, use, w, h]) => html`<div class=${'aspect ' + (aspect === id ? 'on' : '')} onClick=${() => setAspect(id)}>
          <i style=${{ width: w + 'px', height: h + 'px' }}></i><b>${name} ${id}</b><span>${use}</span></div>`)}</div>
        <div class="col" style=${{ width: '300px' }}>
          <label class="label">Target duration · ${fmtDur(Number(duration))}${hasSubs ? ' (subtitles override)' : ''}</label>
          <input type="range" min="8" max="180" step="1" value=${duration} onInput=${(e) => setDuration(e.target.value)} disabled=${hasSubs} />
          <div class="row"><label class="label" style=${{ margin: 0 }}>Frame rate</label><div class="seg">${[24, 30, 60].map((f) => html`<button class=${fps == f ? 'on' : ''} onClick=${() => setFps(f)}>${f} fps</button>`)}</div></div>
          <div class="row"><label class="label" style=${{ margin: 0 }}>Quality</label><div class="seg">${[['draft', 'Draft 720p'], ['final', 'Final 1080p']].map(([v, l]) => html`<button class=${quality === v ? 'on' : ''} onClick=${() => setQuality(v)}>${l}</button>`)}</div></div>
        </div>
      </div>
    </section>

    <section class="wiz-sec enter">
      <h2><span class="num">4</span>Inputs</h2><p>Subtitles (SRT, VTT, ASS, or JSON with segments or word timings) become the master clock. Images guide the palette and appear in scenes. Audio becomes the voiceover or music bed.</p>
      <div class=${'drop ' + (over ? 'over' : '')} onClick=${() => input.current.click()} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
        onDrop=${(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        <${Icon} name="cloud-upload" /><b style=${{ color: 'var(--ink)' }}>Drop files or click to browse</b><span>.srt .vtt .json · images · logo · voiceover · music · footage</span>
      </div>
      <input type="file" multiple ref=${input} class="hidden" onChange=${(e) => addFiles(e.target.files)} />
      ${files.length ? html`<div class="file-list">${files.map((f, i) => html`<span class="file-pill">
        <${Icon} name=${{ subtitles: 'captions', voice: 'mic', music: 'music', logo: 'badge', footage: 'film', reference: 'image' }[f.role] || 'file'} />
        <span class="ellipsis" style=${{ maxWidth: '180px' }}>${f.file.name}</span>
        <select class="select sm" style=${{ width: '104px' }} value=${f.role} onChange=${(e) => setFiles((l) => l.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
          ${['subtitles', 'reference', 'footage', 'logo', 'voice', 'music'].map((r) => html`<option value=${r}>${r}</option>`)}</select>
        <button class="btn ghost icon sm" onClick=${() => setFiles((l) => l.filter((_, j) => j !== i))}><${Icon} name="x" size=${12} /></button></span>`)}</div>` : null}
    </section>

    <section class="wiz-sec enter">
      <h2><span class="num">5</span>Captions and agents</h2><p>Captions are rendered inside the animation, word synced. Leave the style on auto to let the art director choose.</p>
      <div class="row" style=${{ marginBottom: '12px' }}><button class=${'switch ' + (capOn ? 'on' : '')} onClick=${() => setCapOn(!capOn)}></button><b>Burn in captions</b>
        <button class=${'switch ' + (fromNarr ? 'on' : '')} style=${{ marginLeft: '18px' }} onClick=${() => setFromNarr(!fromNarr)}></button><span>Caption the narration when no subtitle file is given</span>
        <span class="spacer"></span><button class=${'btn sm ' + (caption === '' ? 'on' : '')} onClick=${() => setCaption('')}>Auto from style</button></div>
      <div class="cap-styles" style=${{ opacity: capOn ? 1 : 0.4 }}>${CAPS.map((c) => html`<div class=${'cap-style ' + (caption === c.id ? 'on' : '')} onClick=${() => setCaption(c.id)}><div class="cap-demo">${c.demo}</div><b style=${{ fontSize: '12px' }}>${c.name}</b></div>`)}</div>
      <div class="divider" style=${{ margin: '18px 0' }}></div>
      <div class="row" style=${{ marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}><b style=${{ marginRight: '6px' }}>Characters</b>
        ${[['auto', 'Auto from the brief'], ['3d', '3D characters'], ['toon', '2D cartoon'], ['anime', 'Anime'], ['stickman', 'Stick figures'], ['none', 'No characters']].map(([id, label]) =>
          html`<button class=${'btn sm ' + (medium === id ? 'on' : '')} onClick=${() => setMedium(id)}>${label}</button>`)}
        <span class="muted" style=${{ fontSize: '12px', flexBasis: '100%' }}>Every scene keeps the same characters in this medium. Auto reads the brief.</span></div>
      <div class="grid3" style=${{ gap: '16px' }}>
        <div class="row" style=${{ alignItems: 'flex-start' }}><button class=${'switch ' + (research ? 'on' : '')} onClick=${() => setResearch(!research)}></button>
          <div><b>Web research</b><div class="muted" style=${{ fontSize: '12px' }}>Scout searches DuckDuckGo, Brave, Bing and Wikipedia, opens sources and grounds every number.</div></div></div>
        <div class="row" style=${{ alignItems: 'flex-start' }}><button class=${'switch ' + (narration === 'ai' ? 'on' : '')} onClick=${() => setNarration(narration === 'ai' ? 'off' : 'ai')}></button>
          <div><b>AI narration</b><div class="muted" style=${{ fontSize: '12px' }}>A voice (free neural or ElevenLabs) reads the screenplay; scenes and subtitles follow it word by word. Needs Text to speech switched on in Settings; skipped when you upload a voice or subtitles.</div></div></div>
        <div class="row" style=${{ alignItems: 'flex-start' }}><button class=${'switch ' + (scoutOn ? 'on' : '')} onClick=${() => setScoutOn(!scoutOn)}></button>
          <div><b>Asset scout</b><div class="muted" style=${{ fontSize: '12px' }}>Collects real photos, archival footage, icons, flags and sound effects from free libraries before the animators start.</div></div></div>
        <div class="row" style=${{ alignItems: 'flex-start' }}><button class=${'switch ' + (libMusic ? 'on' : '')} onClick=${() => setLibMusic(!libMusic)}></button>
          <div><b>Library music</b><div class="muted" style=${{ fontSize: '12px' }}>Picks a free licensed music track that fits the mood instead of the generated score.</div></div></div>
        <div><label class="label">Who directs</label><div class="seg">${[['auto', 'Agent swarm'], ...(health && health.free_allowed ? [['free', 'Auteur-Free']] : []), ['house', 'House director']].map(([v, l]) => html`<button class=${mode === v ? 'on' : ''} onClick=${() => setMode(v)}>${l}</button>`)}</div>
          <div class="muted" style=${{ fontSize: '11.5px', marginTop: '6px' }}>${mode === 'free' ? 'Free public models with no key. Slower, rate limited, and your brief goes to third-party services.' : health && health.llm ? 'Your connected model writes original compositions per scene.' : 'No model connected: the deterministic house director builds the film, or choose Auteur-Free.'}</div>
          ${mode === 'free' ? html`<label class="row" style=${{ gap: '8px', marginTop: '8px', fontSize: '12px', cursor: 'pointer' }}><input type="checkbox" checked=${freeAck} onChange=${(e) => setFreeAck(e.target.checked)} />
            <span>I understand Auteur-Free has limits: if they run out, the film may be left unfinished.</span></label>` : null}</div>
        <div><label class="label">After planning</label><div class="seg">${[['full', 'Render the film'], ['plan', 'Stop for review']].map(([v, l]) => html`<button class=${runMode === v ? 'on' : ''} onClick=${() => setRunMode(v)}>${l}</button>`)}</div>
          <div class="muted" style=${{ fontSize: '11.5px', marginTop: '6px' }}>Review lets you edit live previews before spending render time.</div></div>
      </div>
    </section>

    <div class="wiz-bar">
      <div class="row grow"><span class="chip">${style === 'auto' ? 'Auto style' : styles.find((s) => s.id === style)?.name || style}</span><span class="chip">${aspect}</span><span class="chip">${hasSubs ? 'subtitle timed' : fmtDur(Number(duration))}</span>
        <span class="chip">${files.length} files</span>${research ? html`<span class="chip ok">research on</span>` : null}</div>
      <button class="btn" onClick=${() => navigate('/')}>Cancel</button>
      <button class="btn brand lg" disabled=${busy} onClick=${create}>${busy ? html`<${Icon} name="loader-circle" cls="spin" />` : html`<${Icon} name="rocket" />`}${busy ? 'Launching swarm' : 'Create and launch swarm'}</button>
    </div>
  </div>`;
}
