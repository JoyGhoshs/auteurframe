import { html, useState, useEffect, useRef, Icon, api, navigate, toast, ago, fmtDur, Modal } from './lib.js';

export const PRESETS = [
  { id: 'explainer', icon: 'presentation', color: '#5B3DF5', title: 'Explainer film', text: 'A 45 second explainer with data, research and a clear argument.', style: 'cosmic-flat', aspect: '16:9', duration: 45, research: true },
  { id: 'shorts', icon: 'smartphone', color: '#FF4D2E', title: 'Viral short', text: 'Vertical 9:16 short with punchy captions synced to your SRT.', style: 'creator-bold', aspect: '9:16', duration: 30 },
  { id: 'data', icon: 'chart-spline', color: '#0EA5E9', title: 'Data story', text: 'Numbers count up, charts draw on, one hot accent on the story.', style: 'data-cinema', aspect: '16:9', duration: 40, research: true },
  { id: 'launch', icon: 'rocket', color: '#10B981', title: 'Product launch', text: 'Floating UI, gradient light, confident kinetic type.', style: 'gradient-product', aspect: '16:9', duration: 30 },
];

const CREATE = [
  { id: 'prompt', title: 'Create from prompt', sub: 'Motion film from one sentence', icon: 'wand-sparkles', grad: 'linear-gradient(135deg,#2DE1C2,#22B8E6)', go: '/new' },
  { id: 'edit', title: 'Edit my video', sub: 'Zooms, captions, b-roll by agents', icon: 'clapperboard', grad: 'linear-gradient(135deg,#A78BFA,#F472B6)', go: '/new/edit' },
  { id: 'blank', title: 'Blank project', sub: 'Build it yourself, scene by scene', icon: 'square-dashed', blank: true },
  { id: 'srt', title: 'Subtitles to video', sub: 'SRT or JSON drives every cut', icon: 'captions', go: '/new/shorts' },
  { id: 'tpl', title: 'Use a template', sub: 'Fill blanks, no AI needed', icon: 'layout-template', go: '/templates' },
  { id: 'explain', title: 'Explainer', sub: 'Research and data driven', icon: 'presentation', go: '/new/explainer' },
];

export function currentWorkspace() {
  try { return localStorage.getItem('af.ws') || ''; } catch (e) { return ''; }
}

function WorkspaceList({ ws, current, onPick, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const create = async (name) => {
    setAdding(false);
    if (!name.trim()) return;
    try { const w = await api.post('/api/workspaces', { name }); toast(`Workspace "${w.name}" created`, 'ok'); await onChanged(); onPick(w.id); } catch (e) { toast(e.message, 'err'); }
  };
  const rename = async (w, name) => {
    setEditing(null);
    if (!name.trim() || name.trim() === w.name) return;
    try { await api.patch(`/api/workspaces/${w.id}`, { name }); onChanged(); } catch (e) { toast(e.message, 'err'); }
  };
  const remove = async (w) => {
    setConfirm(null);
    try { const r = await api.del(`/api/workspaces/${w.id}`); toast(`Workspace deleted${r.moved ? `; ${r.moved} project${r.moved > 1 ? 's' : ''} moved to All projects` : ''}`, 'ok'); if (current === w.id) onPick(''); onChanged(); } catch (e) { toast(e.message, 'err'); }
  };
  const field = (initial, done) => html`<input class="input sm cc-ws-input" autofocus value=${initial} placeholder="Workspace name" onClick=${(e) => e.stopPropagation()}
    onBlur=${(e) => done(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = initial; e.target.blur(); } }} />`;
  return html`<div class="cc-ws">
    <div class="cc-sec cc-sec-row">Workspaces<button class="cc-ws-add" title="New workspace" onClick=${() => setAdding(true)}><${Icon} name="plus" size=${13} /></button></div>
    <a class=${'cc-space ' + (!current ? 'on' : '')} onClick=${() => onPick('')}><span style=${{ background: '#64748B' }}><${Icon} name="layers" size=${12} /></span>All projects<em>${ws.total}</em></a>
    ${ws.workspaces.map((w) => html`<a key=${w.id} class=${'cc-space ' + (current === w.id ? 'on' : '')} onClick=${() => onPick(w.id)}>
      <span style=${{ background: w.color }}>${(w.name || '?').slice(0, 1).toUpperCase()}</span>
      ${editing === w.id ? field(w.name, (v) => rename(w, v)) : html`<i class="ellipsis">${w.name}</i>`}
      ${confirm === w.id ? html`<div class="cc-ws-confirm" onClick=${(e) => e.stopPropagation()}>Delete?<button onClick=${() => remove(w)}>Yes</button><button onClick=${() => setConfirm(null)}>No</button></div>`
        : html`<em>${w.count}</em><div class="cc-ws-tools" onClick=${(e) => e.stopPropagation()}>
          <button title="Rename" onClick=${() => setEditing(w.id)}><${Icon} name="pencil" size=${12} /></button>
          <button title="Delete workspace (projects are kept)" onClick=${() => setConfirm(w.id)}><${Icon} name="trash-2" size=${12} /></button></div>`}</a>`)}
    ${adding ? html`<div class="cc-space">${field('', create)}</div>` : html`<a class="cc-space cc-ws-new" onClick=${() => setAdding(true)}><span><${Icon} name="plus" size=${12} /></span>New workspace</a>`}
  </div>`;
}

const BLANK_SCENE = '<div class="scene"></div><script>AU.scene(() => {});</script>';
const FORMATS = [['16:9', 'Landscape'], ['9:16', 'Vertical'], ['1:1', 'Square'], ['4:5', 'Portrait']];

export function BlankProjectDialog({ onClose }) {
  const [title, setTitle] = useState('Untitled project');
  const [aspect, setAspect] = useState('16:9');
  const [style, setStyle] = useState('editorial-paper');
  const [styles, setStyles] = useState([]);
  const [scenes, setScenes] = useState(1);
  const [len, setLen] = useState(5);
  const [fps, setFps] = useState(30);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/api/styles').then((d) => setStyles(d.styles || [])).catch(() => null); }, []);
  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const n = Math.max(1, Math.min(20, +scenes || 1));
      const d = Math.max(0.5, Math.min(120, +len || 5));
      const p = await api.post('/api/projects', { title: title.trim() || 'Untitled project', brief: '', aspect, style, duration: Math.max(5, n * d), fps: +fps, options: { mode: 'house', manual: true }, workspace: currentWorkspace() || null });
      for (let i = 0; i < n; i++) await api.post(`/api/projects/${p.id}/scenes`, { at: i, title: `Scene ${i + 1}`, duration: d, code: BLANK_SCENE });
      navigate('/p/' + p.id);
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  };
  return html`<${Modal} title="Blank project" icon="square-dashed" width="min(560px, 94vw)" onClose=${() => { if (!busy) onClose(); }}
    foot=${html`<span class="grow"></span><button class="btn" disabled=${busy} onClick=${onClose}>Cancel</button>
      <button class="btn brand" disabled=${busy} onClick=${create}><${Icon} name=${busy ? 'loader-circle' : 'plus'} cls=${busy ? 'spin' : ''} size=${14} />Create blank project</button>`}>
        <div class="muted" style=${{ fontSize: '12.5px', marginBottom: '12px' }}>An empty studio with blank scenes. Add characters, scenery, text and effects from the library, animate them by hand or ask the agent, and add or resize scenes on the timeline.</div>
        <div class="field"><label class="label">Project name</label><input class="input" autofocus value=${title} onInput=${(e) => setTitle(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && create()} /></div>
        <div class="field"><label class="label">Format</label><div class="seg">${FORMATS.map(([v, l]) => html`<button class=${aspect === v ? 'on' : ''} onClick=${() => setAspect(v)}>${l} · ${v}</button>`)}</div></div>
        <div class="field"><label class="label">Look (colours and fonts)</label><select class="select" value=${style} onChange=${(e) => setStyle(e.target.value)}>
          ${(styles.length ? styles : [{ id: 'editorial-paper', name: 'Editorial Paper' }]).map((s) => html`<option value=${s.id}>${s.name}</option>`)}</select></div>
        <div class="row" style=${{ gap: '12px', flexWrap: 'wrap' }}>
          <div class="field"><label class="label">Blank scenes</label><input class="input" type="number" min="1" max="20" style=${{ width: '90px' }} value=${scenes} onInput=${(e) => setScenes(e.target.value)} /></div>
          <div class="field"><label class="label">Seconds each</label><input class="input" type="number" min="0.5" max="120" step="0.5" style=${{ width: '90px' }} value=${len} onInput=${(e) => setLen(e.target.value)} /></div>
          <div class="field"><label class="label">Frame rate</label><div class="seg">${[24, 30, 60].map((f) => html`<button class=${+fps === f ? 'on' : ''} onClick=${() => setFps(f)}>${f}</button>`)}</div></div>
        </div>
  </${Modal}>`;
}

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

function ProjectTile({ p, onChange, workspaces }) {
  const [hover, setHover] = useState(false);
  const [moving, setMoving] = useState(false);
  const move = async (wid) => {
    setMoving(false);
    try { await api.post(`/api/projects/${p.id}/workspace`, { workspace: wid }); const w = (workspaces || []).find((x) => x.id === wid); toast(w ? `Moved to ${w.name}` : 'Moved to All projects', 'ok'); onChange(); } catch (e) { toast(e.message, 'err'); }
  };
  const del = async (e) => { e.stopPropagation(); await api.del(`/api/projects/${p.id}`); toast('Moved to trash'); onChange(); };
  const dup = async (e) => { e.stopPropagation(); await api.post(`/api/projects/${p.id}/duplicate`); toast('Duplicated', 'ok'); onChange(); };
  const tall = p.aspect === '9:16' || p.aspect === '4:5';
  return html`<div class=${'cc-tile ' + (tall ? 'tall' : '')} onClick=${() => navigate('/p/' + p.id)} onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}>
    <div class="cc-thumb" style=${{ background: (p.palette || {}).bg || '#eef0f4' }}>
      ${p.poster ? html`<img src=${p.poster + '?v=' + Math.round(p.updated)} />` : html`<span class="cc-empty"><${Icon} name="film" size=${26} /></span>`}
      ${hover && p.master ? html`<video src=${p.master} autoplay muted loop playsinline></video>` : null}
      <span class="cc-dur">${fmtDur(p.duration)}</span>
      <div class="cc-act"><button title="Move to workspace" onClick=${(e) => { e.stopPropagation(); setMoving(!moving); }}><${Icon} name="folder-input" size=${13} /></button><button title="Duplicate" onClick=${dup}><${Icon} name="copy" size=${13} /></button><button title="Delete" onClick=${del}><${Icon} name="trash-2" size=${13} /></button></div>
      ${moving ? html`<div class="cc-move" onClick=${(e) => e.stopPropagation()}><b>Move to</b>
        <button class=${!p.workspace ? 'on' : ''} onClick=${() => move(null)}><${Icon} name="layers" size=${12} />No workspace</button>
        ${(workspaces || []).map((w) => html`<button key=${w.id} class=${p.workspace === w.id ? 'on' : ''} onClick=${() => move(w.id)}><i style=${{ background: w.color }}></i>${w.name}</button>`)}
        ${(workspaces || []).length ? null : html`<span class="muted">Create a workspace in the sidebar first.</span>`}</div>` : null}
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
  const [blank, setBlank] = useState(false);
  const [ws, setWs] = useState({ workspaces: [], total: 0, unfiled: 0 });
  const [current, setCurrent] = useState(currentWorkspace());
  const loadWs = () => api.get('/api/workspaces').then((d) => {
    setWs(d);
    if (current && !d.workspaces.some((w) => w.id === current)) pick('');
  }).catch(() => null);
  const pick = (id) => { setCurrent(id); try { localStorage.setItem('af.ws', id || ''); } catch (e) { } setTab('recent'); };
  const load = () => { loadWs(); return api.get('/api/projects').then((d) => setProjects(d.projects)).catch((e) => toast(e.message, 'err')); };
  useEffect(() => { load(); api.get('/api/templates').then((d) => setTpls(d.templates)); }, []);
  const space = ws.workspaces.find((w) => w.id === current);
  const shownP = projects && (current ? projects.filter((p) => p.workspace === current) : projects);
  useEffect(() => { if (projects && projects.length === 0) setTab('templates'); }, [projects]);
  const cats = ['All', ...new Set(tpls.map((t) => t.category))];
  const shownT = tpls.filter((t) => cat === 'All' || t.category === cat);
  const nav = [['home', 'house', 'Start', '/'], ['recent', 'clock-3', 'Recent projects', '/'], ['templates', 'layout-template', 'Templates', '/templates'], ['skills', 'book-open-text', 'Agent skills', '/skills'], ['models', 'plug-zap', 'Models', '/settings']];
  return html`<div class="cc">
    ${blank ? html`<${BlankProjectDialog} onClose=${() => setBlank(false)} />` : null}
    <aside class="cc-side">
      <button class="cc-new" onClick=${() => navigate('/new')}><${Icon} name="plus" size=${18} />Create new</button>
      <button class="cc-blank" onClick=${() => setBlank(true)}><${Icon} name="square-dashed" size=${16} />Blank project</button>
      <nav>${nav.map(([k, ic, label, go]) => html`<a class=${k === 'home' ? 'on' : ''} onClick=${() => (k === 'recent' ? setTab('recent') : navigate(go))}><${Icon} name=${ic} size=${17} />${label}</a>`)}</nav>
      <${WorkspaceList} ws=${ws} current=${current} onPick=${pick} onChanged=${loadWs} />
      <div class="cc-status">
        <div><i class=${health && health.renderer ? 'ok' : ''}></i>${health && health.renderer ? `${health.renderer.max} render nodes online` : 'Render farm starting'}</div>
        <div><i class=${health && (health.llm || health.free) ? 'ok' : 'warn'}></i>${health && health.llm ? 'Agent swarm connected' : health && health.free ? 'Auteur-Free (no key)' : 'House director only'}</div>
        <div style=${{ marginTop: '6px', cursor: 'pointer', opacity: 0.75 }} onClick=${() => navigate('/settings')} title="Copyright, license and source code">AuteurFrame by Abdur Rahman Maheer · AGPL-3.0</div>
        ${health && !health.llm ? html`<button onClick=${() => navigate('/settings')}>Connect a model</button>` : null}
      </div>
    </aside>
    <main class="cc-main">
      <div class="cc-create">${CREATE.map((c, i) => html`<button class=${'cc-card ' + (c.grad ? 'hero' : '')} style=${c.grad ? { background: c.grad } : null} onClick=${() => (c.blank ? setBlank(true) : navigate(c.go))}>
        <span class="cc-ic"><${Icon} name=${c.icon} size=${i < 2 ? 22 : 20} /></span><b>${c.title}</b><em>${c.sub}</em></button>`)}</div>

      <h2 class="cc-h">Create your first video in minutes</h2>
      <div class="cc-first">
        <div class="cc-first-media" onClick=${() => navigate('/templates/app-launch')}><${Live} src="/api/templates/app-launch/preview?aspect=16:9" w=${1920} h=${1080} /><span class="cc-play"><${Icon} name="play" size=${16} /></span></div>
        <div class="cc-first-copy"><b>Four ways to start</b>
          <ol><li><span>1</span><p>Describe a film and let the swarm write, animate and render it.</p></li><li><span>2</span><p>Upload a clip and ask for zooms, captions and b-roll.</p></li><li><span>3</span><p>Pick a template, drop in your logo and screens.</p></li>
            <li><span>4</span><p>Start a <a class="cc-inline" onClick=${() => setBlank(true)}>blank project</a> and build it yourself, with the agent when you want it.</p></li></ol>
          <button class="btn primary" onClick=${() => navigate('/new')}><${Icon} name="wand-sparkles" size=${14} />Start creating</button></div>
      </div>

      <div class="cc-tabs"><button class=${tab === 'recent' ? 'on' : ''} onClick=${() => setTab('recent')}>${space ? space.name : 'Recent projects'}</button><button class=${tab === 'templates' ? 'on' : ''} onClick=${() => setTab('templates')}>Video templates</button>
        <span class="spacer"></span>${tab === 'recent' ? html`<button class="cc-link" onClick=${load}><${Icon} name="refresh-cw" size=${13} />Refresh</button>` : html`<button class="cc-link" onClick=${() => navigate('/templates')}>View more <${Icon} name="chevron-right" size=${14} /></button>`}</div>
      ${tab === 'recent' ? (projects === null ? html`<div class="cc-grid">${[0, 1, 2, 3, 4].map(() => html`<div class="cc-tile"><div class="cc-thumb shimmer"></div></div>`)}</div>` :
        shownP.length === 0 ? html`<div class="cc-none"><${Icon} name=${space ? 'folder-open' : 'clapperboard'} size=${26} /><b>${space ? `No projects in ${space.name} yet` : 'No projects yet'}</b><span>${space ? 'New projects you create while this workspace is open go here, or move one in with the folder button on its tile.' : 'Create one above, or start from a template.'}</span></div>` :
          html`<div class="cc-grid">${shownP.map((p) => html`<${ProjectTile} key=${p.id} p=${p} onChange=${load} workspaces=${ws.workspaces} />`)}</div>`) :
        html`<div><div class="cc-cats">${cats.map((c) => html`<button class=${cat === c ? 'on' : ''} onClick=${() => setCat(c)}>${c}</button>`)}</div>
          <div class="cc-grid">${shownT.map((t) => html`<div class="cc-tile tpl" onMouseEnter=${() => setHover(t.id)} onMouseLeave=${() => setHover(null)} onClick=${() => navigate('/templates/' + t.id)}>
            <div class="cc-thumb">${hover === t.id ? html`<${Live} src=${`/api/templates/${t.id}/preview?aspect=16:9`} w=${1920} h=${1080} />` : html`<img src=${`/api/templates/${t.id}/poster.jpg?aspect=16:9`} loading="lazy" />`}<span class="cc-dur">${t.aspect}</span></div>
            <b class="ellipsis">${t.name}</b><span>${t.category}</span></div>`)}</div></div>`}
    </main>
  </div>`;
}
