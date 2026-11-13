import { html, useState, useEffect, useRef, Icon, api, navigate, toast, ago, fmtDur } from './lib.js';

export const PRESETS = [
  { id: 'explainer', icon: 'presentation', color: '#5B3DF5', title: 'Explainer film', text: 'A 45 second explainer with data, research and a clear argument.', style: 'cosmic-flat', aspect: '16:9', duration: 45, research: true },
  { id: 'shorts', icon: 'smartphone', color: '#FF4D2E', title: 'Viral short', text: 'Vertical 9:16 short with punchy captions synced to your SRT.', style: 'creator-bold', aspect: '9:16', duration: 30 },
  { id: 'data', icon: 'chart-spline', color: '#0EA5E9', title: 'Data story', text: 'Numbers count up, charts draw on, one hot accent on the story.', style: 'data-cinema', aspect: '16:9', duration: 40, research: true },
  { id: 'launch', icon: 'rocket', color: '#10B981', title: 'Product launch', text: 'Floating UI, gradient light, confident kinetic type.', style: 'gradient-product', aspect: '16:9', duration: 30 },
];

const CREATE = [
  { id: 'prompt', title: 'Create from prompt', sub: 'Motion film from one sentence', icon: 'wand-sparkles', grad: 'linear-gradient(135deg,#2DE1C2,#22B8E6)', go: '/new' },
  { id: 'edit', title: 'Edit my video', sub: 'Zooms, captions, b-roll by agents', icon: 'clapperboard', grad: 'linear-gradient(135deg,#A78BFA,#F472B6)', go: '/new/edit' },
  { id: 'srt', title: 'Subtitles to video', sub: 'SRT or JSON drives every cut', icon: 'captions', go: '/new/shorts' },
  { id: 'tpl', title: 'Use a template', sub: 'Fill blanks, no AI needed', icon: 'layout-template', go: '/templates' },
  { id: 'explain', title: 'Explainer', sub: 'Research and data driven', icon: 'presentation', go: '/new/explainer' },
];

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
  return html`<div class="cc-live" ref=${box} style=${{ aspectRatio: `${w}/${h}` }}><iframe src=${src} style=${{ width: w + 'px', height: h + 'px', transform: `scale(${k})` }} onLoad=${playFrame}></iframe></div>`;
}

function ProjectTile({ p, onChange }) {
  const [hover, setHover] = useState(false);
  const del = async (e) => { e.stopPropagation(); await api.del(`/api/projects/${p.id}`); toast('Moved to trash'); onChange(); };
  const dup = async (e) => { e.stopPropagation(); await api.post(`/api/projects/${p.id}/duplicate`); toast('Duplicated', 'ok'); onChange(); };
  const tall = p.aspect === '9:16' || p.aspect === '4:5';
  return html`<div class=${'cc-tile ' + (tall ? 'tall' : '')} onClick=${() => navigate('/p/' + p.id)} onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}>
    <div class="cc-thumb" style=${{ background: (p.palette || {}).bg || '#eef0f4' }}>
      ${p.poster ? html`<img src=${p.poster + '?v=' + Math.round(p.updated)} />` : html`<span class="cc-empty"><${Icon} name="film" size=${26} /></span>`}
      ${hover && p.master ? html`<video src=${p.master} autoplay muted loop playsinline></video>` : null}
      <span class="cc-dur">${fmtDur(p.duration)}</span>
      <div class="cc-act"><button title="Duplicate" onClick=${dup}><${Icon} name="copy" size=${13} /></button><button title="Delete" onClick=${del}><${Icon} name="trash-2" size=${13} /></button></div>
    </div>
    <b class="ellipsis">${p.title}</b><span>${p.status === 'mastered' ? 'Rendered' : p.status === 'planned' ? 'Planned' : 'Draft'} · ${ago(p.updated)}</span>
  </div>`;
}

export function Dashboard({ health }) {
  const [projects, setProjects] = useState(null);
  const [tpls, setTpls] = useState([]);
  const [tab, setTab] = useState('recent');
  const [cat, setCat] = useState('All');
  const [hover, setHover] = useState(null);
  const load = () => api.get('/api/projects').then((d) => setProjects(d.projects)).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); api.get('/api/templates').then((d) => setTpls(d.templates)); }, []);
  useEffect(() => { if (projects && projects.length === 0) setTab('templates'); }, [projects]);
  const cats = ['All', ...new Set(tpls.map((t) => t.category))];
  const shownT = tpls.filter((t) => cat === 'All' || t.category === cat);
  const nav = [['home', 'house', 'Start', '/'], ['recent', 'clock-3', 'Recent projects', '/'], ['templates', 'layout-template', 'Templates', '/templates'], ['skills', 'book-open-text', 'Agent skills', '/skills'], ['models', 'plug-zap', 'Models', '/settings']];
  return html`<div class="cc">
    <aside class="cc-side">
      <button class="cc-new" onClick=${() => navigate('/new')}><${Icon} name="plus" size=${18} />Create new</button>
      <nav>${nav.map(([k, ic, label, go]) => html`<a class=${k === 'home' ? 'on' : ''} onClick=${() => (k === 'recent' ? setTab('recent') : navigate(go))}><${Icon} name=${ic} size=${17} />${label}</a>`)}</nav>
      <div class="cc-sec">Workspace</div>
      <a class="cc-space"><span>A</span>My studio</a>
      <div class="cc-status">
        <div><i class=${health && health.renderer ? 'ok' : ''}></i>${health && health.renderer ? `${health.renderer.max} render nodes online` : 'Render farm starting'}</div>
        <div><i class=${health && health.llm ? 'ok' : 'warn'}></i>${health && health.llm ? 'Agent swarm connected' : 'House director only'}</div>
        <div style=${{ marginTop: '6px', cursor: 'pointer', opacity: 0.75 }} onClick=${() => navigate('/settings')} title="Copyright, license and source code">AuteurFrame by Joy Ghosh · AGPL-3.0</div>
        ${health && !health.llm ? html`<button onClick=${() => navigate('/settings')}>Connect a model</button>` : null}
      </div>
    </aside>
    <main class="cc-main">
      <div class="cc-create">${CREATE.map((c, i) => html`<button class=${'cc-card ' + (c.grad ? 'hero' : '')} style=${c.grad ? { background: c.grad } : null} onClick=${() => navigate(c.go)}>
        <span class="cc-ic"><${Icon} name=${c.icon} size=${i < 2 ? 22 : 20} /></span><b>${c.title}</b><em>${c.sub}</em></button>`)}</div>

      <h2 class="cc-h">Create your first video in minutes</h2>
      <div class="cc-first">
        <div class="cc-first-media" onClick=${() => navigate('/templates/app-launch')}><${Live} src="/api/templates/app-launch/preview?aspect=16:9" w=${1920} h=${1080} /><span class="cc-play"><${Icon} name="play" size=${16} /></span></div>
        <div class="cc-first-copy"><b>Three ways to start</b>
          <ol><li><span>1</span>Describe a film and let the swarm write, animate and render it.</li><li><span>2</span>Upload a clip and ask for zooms, captions and b-roll.</li><li><span>3</span>Pick a template, drop in your logo and screens.</li></ol>
          <button class="btn primary" onClick=${() => navigate('/new')}><${Icon} name="wand-sparkles" size=${14} />Start creating</button></div>
      </div>

      <div class="cc-tabs"><button class=${tab === 'recent' ? 'on' : ''} onClick=${() => setTab('recent')}>Recent projects</button><button class=${tab === 'templates' ? 'on' : ''} onClick=${() => setTab('templates')}>Video templates</button>
        <span class="spacer"></span>${tab === 'recent' ? html`<button class="cc-link" onClick=${load}><${Icon} name="refresh-cw" size=${13} />Refresh</button>` : html`<button class="cc-link" onClick=${() => navigate('/templates')}>View more <${Icon} name="chevron-right" size=${14} /></button>`}</div>
      ${tab === 'recent' ? (projects === null ? html`<div class="cc-grid">${[0, 1, 2, 3, 4].map(() => html`<div class="cc-tile"><div class="cc-thumb shimmer"></div></div>`)}</div>` :
        projects.length === 0 ? html`<div class="cc-none"><${Icon} name="clapperboard" size=${26} /><b>No projects yet</b><span>Create one above, or start from a template.</span></div>` :
          html`<div class="cc-grid">${projects.map((p) => html`<${ProjectTile} key=${p.id} p=${p} onChange=${load} />`)}</div>`) :
        html`<div><div class="cc-cats">${cats.map((c) => html`<button class=${cat === c ? 'on' : ''} onClick=${() => setCat(c)}>${c}</button>`)}</div>
          <div class="cc-grid">${shownT.map((t) => html`<div class="cc-tile tpl" onMouseEnter=${() => setHover(t.id)} onMouseLeave=${() => setHover(null)} onClick=${() => navigate('/templates/' + t.id)}>
            <div class="cc-thumb">${hover === t.id ? html`<${Live} src=${`/api/templates/${t.id}/preview?aspect=16:9`} w=${1920} h=${1080} />` : html`<img src=${`/api/templates/${t.id}/poster.jpg?aspect=16:9`} loading="lazy" />`}<span class="cc-dur">${t.aspect}</span></div>
            <b class="ellipsis">${t.name}</b><span>${t.category}</span></div>`)}</div></div>`}
    </main>
  </div>`;
}
