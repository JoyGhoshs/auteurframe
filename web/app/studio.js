import { html, useState, useEffect, useRef, useCallback, Icon, api, toast, useEvents, fmtTime, fmtDur, navigate } from './lib.js';
import { BrandMark } from './main.js';
import { Stage, sceneAt } from './stage.js';
import { Timeline } from './timeline.js';
import { SceneTab, LayerTab, CodeTab, ChatTab, QATab } from './inspector.js';
import { LookTab } from './looktab.js';
import { AgentCursors } from './agentcursors.js';
import { SwarmPanel } from './swarmpanel.js';
import { MediaPanel, DesignPanel, CaptionsPanel, AudioPanel, ResearchPanel, HistoryPanel, ExportPanel } from './leftpanels.js';
import { TextPanel, StockPanel, SoundPanel } from './editorpanels.js';
import { ComponentsPanel, componentPatch, recordDrag } from './motiontools.js';
import { ContextMenu, AskAgentDialog, ReplicateDialog, TextPromptDialog } from './agentmenu.js';
import { clipLength } from './timeline.js';

const LEFT = [
  ['media', 'image-plus', 'Media and elements'], ['components', 'shapes', 'Characters, props and components'], ['text', 'type', 'Text styles'], ['stock', 'images', 'Stock and icons'], ['design', 'palette', 'Design'], ['captions', 'captions', 'Captions and timing'], ['audio', 'audio-lines', 'Sound'],
  ['research', 'globe', 'Research'], ['history', 'history', 'Revisions'], ['export', 'download', 'Export']
];
const VISUAL_KEYS = ['code', 'data', 'archetype', 'overrides', 'layers', 'variant', 'reseed', 'duration', 'has_code', 'transition', 'source', 'ground', 'texture', 'camera', 'lens'];

export function Studio({ id, health }) {
  const [project, setProject] = useState(null);
  const [styles, setStyles] = useState([]);
  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState('live');
  const [guides, setGuides] = useState(false);
  const [left, setLeft] = useState('media');
  const [tab, setTab] = useState('swarm');
  const [selScene, setSelScene] = useState(null);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState({});
  const [roster, setRoster] = useState([]);
  const [agents, setAgents] = useState({});
  const [tokens, setTokens] = useState({});
  const [cursors, setCursors] = useState({});
  const [feed, setFeed] = useState([]);
  const [browse, setBrowse] = useState(null);
  const [progress, setProgress] = useState({});
  const [previews, setPreviews] = useState({});
  const [chat, setChat] = useState([]);
  const [run, setRun] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [recordKeys, setRecordKeys] = useState(false);
  const reloadTimer = useRef(null);
  const timeRef = useRef(0);
  const setTime = useCallback((t) => { timeRef.current = t; setTimeState(t); }, []);
  const lastSnap = useRef(0);
  const projRefLatest = useRef(null);
  const snapping = useRef(null);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [selClip, setSelClip] = useState(null);
  const [selCue, setSelCue] = useState(null);
  const [edited, setEdited] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const clipboard = useRef(null);
  const lastCopy = useRef('layer');

  const load = useCallback(async () => {
    try {
      const p = await api.get(`/api/projects/${id}`);
      setProject(p);
      if (p.run) { setRun(p.run); setAgents((a) => ({ ...p.run.agents, ...a })); }
      return p;
    } catch (e) { toast(e.message, 'err'); }
  }, [id]);
  const reloadSoon = () => { clearTimeout(reloadTimer.current); reloadTimer.current = setTimeout(load, 250); };
  useEffect(() => {
    load();
    api.get('/api/styles').then((d) => setStyles(d.styles));
    api.get(`/api/projects/${id}/history`).then(setHist).catch(() => null);
    api.get(`/api/projects/${id}/run`).then((d) => { setRoster(d.roster); if (d.run) setRun(d.run); });
  }, [id]);
  const bump = (sid) => setVersions((v) => ({ ...v, [sid]: (v[sid] || 0) + 1 }));
  const bumpAll = () => setVersions((v) => { const n = { ...v }; (project ? project.scenes : []).forEach((s) => { n[s.id] = (n[s.id] || 0) + 1; }); n.__all = (n.__all || 0) + 1; return n; });

  useEvents(id, (ev) => {
    const d = ev.data || {};
    switch (ev.kind) {
      case 'agent.status':
        setAgents((a) => ({ ...a, [d.agent]: { state: d.state, detail: d.detail, scene: d.scene } }));
        break;
      case 'agent.token':
        setTokens((t) => ({ ...t, [d.agent]: ((t[d.agent] || '') + d.text).slice(-6000) }));
        break;
      case 'agent.cursor':
        setCursors((c) => ({ ...c, [d.agent]: { ...d, at: Date.now() } }));
        break;
      case 'browse.frame':
        setBrowse({ url: d.url, jpeg: d.jpeg, at: Date.now() });
        break;
      case 'render.progress':
        setProgress((p) => ({ ...p, [d.id]: d.pct }));
        break;
      case 'render.preview':
        setPreviews((p) => ({ ...p, [d.id]: d.jpeg }));
        break;
      case 'scene.update':
        setProject((p) => {
          if (!p) return p;
          const scenes = p.scenes.map((s) => (s.id === d.id ? { ...s, ...d.patch } : s));
          return { ...p, scenes };
        });
        if (Object.keys(d.patch || {}).some((k) => VISUAL_KEYS.includes(k)) || (d.patch && d.patch.status === 'written')) {
          if (d.by !== 'user') bump(d.id);
          if (d.patch && 'duration' in d.patch) reloadSoon();
        }
        if (d.patch && d.patch.has_code) reloadSoon();
        break;
      case 'chat.user':
        break;
      case 'chat.agent':
        setChat((c) => [...c, { who: 'agent', text: d.message, scene: d.scene }]);
        break;
      case 'run.start':
        setRun({ status: 'running', phase: 'starting', mode: d.mode });
        if (d.roster) setRoster(d.roster);
        setTokens({});
        setFeed((f) => [...f, ev]);
        break;
      case 'run.phase':
        setRun((r) => ({ ...(r || {}), status: 'running', phase: d.phase }));
        setFeed((f) => [...f, ev]);
        if (d.phase === 'animate' || d.phase === 'produce') reloadSoon();
        break;
      case 'project.scenes': case 'project.bible': case 'project.update': case 'asset.added':
        reloadSoon();
        if (ev.kind === 'project.bible' || ev.kind === 'project.update') bumpAll();
        if (ev.kind === 'project.scenes') setFeed((f) => [...f, ev]);
        break;
      case 'sync.report': reloadSoon(); break;
      case 'project.outputs':
        setEdited(false);
        setFeed((f) => [...f, ev]);
        reloadSoon();
        break;
      case 'run.done': case 'run.error': case 'run.cancelled':
        setRun((r) => ({ ...(r || {}), status: ev.kind === 'run.done' ? 'done' : ev.kind === 'run.error' ? 'error' : 'cancelled' }));
        setFeed((f) => [...f, ev]);
        if (ev.kind === 'run.done') toast('Swarm finished', 'ok');
        if (ev.kind === 'run.error') toast(d.message, 'err');
        setChat((c) => c.some((m) => m.pending) ? [...c.filter((m) => !m.pending), { who: 'agent', text: ev.kind === 'run.done' ? 'Done. The scene has been rewritten, checked by QA and reloaded on stage.' : 'That did not work: ' + (d.message || 'cancelled'), scene: c.find((m) => m.pending)?.scene }] : c);
        reloadSoon();
        setTimeout(bumpAll, 300);
        break;
      default:
        if (['memory.decision', 'memory.fact', 'qa.report', 'research.results', 'barrier', 'run.warning', 'skill.imported', 'agent.skills', 'memory.write', 'edit.op', 'stock.import', 'sync.report', 'sync.warning', 'sync.align', 'agent.tool'].includes(ev.kind)) setFeed((f) => [...f.slice(-300), ev]);
        if (ev.kind === 'memory.decision' || ev.kind === 'memory.fact') setProject((p) => p ? { ...p, memory: { ...(p.memory || {}), [ev.kind === 'memory.fact' ? 'facts' : 'decisions']: [...((p.memory || {})[ev.kind === 'memory.fact' ? 'facts' : 'decisions'] || []), d] } } : p);
    }
  });

  useEffect(() => {
    const key = (e) => {
      if (!project || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); splitAt(); return; }
      if (mod && e.key.toLowerCase() === 'c' && selClip) { const c = clipsOf().find((x) => x.id === selClip); if (c) { clipBoard.current = { ...c }; lastCopy.current = 'clip'; toast('Clip copied'); } return; }
      if (mod && e.key.toLowerCase() === 'v' && clipBoard.current && lastCopy.current === 'clip') { e.preventDefault(); const d = { ...clipBoard.current, id: 'c' + Math.random().toString(36).slice(2, 8), t: Math.round(timeRef.current * 1000) / 1000 }; setClips([...clipsOf(), d]); setSelClip(d.id); return; }
      if (mod && e.key.toLowerCase() === 'c' && selected && selected.user) {
        const s = project.scenes.find((x) => x.id === selected.sceneId); const L = s && (s.layers || []).find((l) => l.id === selected.id);
        if (L) { clipboard.current = JSON.parse(JSON.stringify(L)); lastCopy.current = 'layer'; toast('Layer copied'); } return;
      }
      if (mod && e.key.toLowerCase() === 'v' && clipboard.current) { e.preventDefault(); pasteLayer(); return; }
      if (mod && e.key.toLowerCase() === 'd' && selected && selected.user) { e.preventDefault(); const s = project.scenes.find((x) => x.id === selected.sceneId); const L = s && (s.layers || []).find((l) => l.id === selected.id); if (L) duplicateLayer(s.id, L); return; }
      if (mod) return;
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') { e.preventDefault(); if (!playing && timeRef.current >= total() - 0.05) setTime(0); setPlaying((p) => !p); }
      if ((e.key === 's' || e.key === 'S') && selClip) {
        e.preventDefault();
        const c = clipsOf().find((x) => x.id === selClip);
        const len = c ? clipLength(c, project.assets || []) : 0;
        if (c && timeRef.current > c.t + 0.05 && timeRef.current < c.t + len - 0.05) { splitClip(c, Math.round(timeRef.current * 1000) / 1000); return; }
      }
      if ((e.key === 'm' || e.key === 'M') && selClip) { const c = clipsOf().find((x) => x.id === selClip); if (c) onClipPatch(c.id, { mute: !c.mute }); return; }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitAt(); }
      if (e.key === 'j' || e.key === 'J') setTime(Math.max(0, timeRef.current - 2));
      if (e.key === 'l' || e.key === 'L') setTime(Math.min(total() - 0.001, timeRef.current + 2));
      if (e.key === 'ArrowRight') setTime(Math.min(total() - 0.001, timeRef.current + (e.shiftKey ? 1 : 1 / (project ? project.fps : 30))));
      if (e.key === 'ArrowLeft') setTime(Math.max(0, timeRef.current - (e.shiftKey ? 1 : 1 / (project ? project.fps : 30))));
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const i = project.scenes.findIndex((s) => s.id === (sceneAt(project, timeRef.current) || {}).id);
        const t = project.scenes[Math.max(0, Math.min(project.scenes.length - 1, i + (e.key === 'ArrowUp' ? -1 : 1)))];
        if (t) setTime(t.start + 0.001);
      }
      if (e.key === 'Home') setTime(0);
      if (e.key === 'End') setTime(Math.max(0, total() - 0.001));
      if (e.key === 'Escape') setSelected(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selClip) { deleteClip(selClip); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && selected.user) deleteLayer(selected.sceneId, selected.id);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const audioRef = useRef(null);
  const audioKey = project ? JSON.stringify([project.audio, (project.scenes || []).map((s) => Math.round(s.duration * 100)), project.style, (project.edit || {}).ranges, (project.assets || []).length]) : '';
  const audioSrc = project && (project.scenes || []).length ? `/api/projects/${id}/audio/preview.wav?k=${audioKey.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)}` : '';
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing && view !== 'master') {
      a.currentTime = timeRef.current;
      a.play().catch(() => null);
    } else a.pause();
  }, [playing, view, audioSrc]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a || view === 'master') return;
    if (!playing) { if (Math.abs(a.currentTime - time) > 0.04) a.currentTime = time; }
    else if (Math.abs(a.currentTime - time) > 0.3) a.currentTime = time;
  }, [time]);
  projRefLatest.current = project;
  if (!project) return html`<div style=${{ height: '100%', display: 'grid', placeItems: 'center' }}><div class="row muted"><${Icon} name="loader-circle" cls="spin" />Opening studio…</div></div>`;
  const total = () => (project.scenes || []).reduce((a, s) => a + s.duration, 0);
  const scene = sceneAt(project, time);
  const current = (selScene && project.scenes.find((s) => s.id === selScene)) || scene;
  const agentNames = Object.fromEntries((roster || []).map((r) => [r.id, r.name]));
  const running = run && run.status === 'running';
  const totalDur = total();
  const outputs = project.outputs || {};
  const stale = !!outputs.master && (edited || (!!outputs.key && outputs.key !== project.content_key));
  const needsRender = (project.scenes || []).length > 0 && (!outputs.master || stale);

  const snap = (force) => {
    setEdited(true);
    const now = Date.now();
    const coalesce = !force && now - lastSnap.current < 700;
    lastSnap.current = now;
    if (coalesce && snapping.current) return snapping.current;
    if (coalesce) return Promise.resolve();
    snapping.current = api.post(`/api/projects/${id}/history/snap`).then(setHist).catch(() => null);
    return snapping.current;
  };
  const step = async (kind) => {
    if (!hist[kind]) { toast(kind === 'undo' ? 'Nothing to undo' : 'Nothing to redo'); return; }
    lastSnap.current = 0;
    try {
      if (snapping.current) await snapping.current;
      const r = await api.post(`/api/projects/${id}/history/${kind}`);
      setProject((cur) => ({ ...r.project, run: cur.run }));
      setHist({ undo: r.undo, redo: r.redo });
      bumpAll();
    } catch (e) { toast(e.message, 'err'); load(); }
  };
  const undo = () => step('undo');
  const redo = () => step('redo');
  const splitAt = async () => {
    const s = sceneAt(project, timeRef.current);
    if (!s) return;
    await snap(true);
    try {
      const p = await api.post(`/api/projects/${id}/scenes/${s.id}/split`, { at: timeRef.current - s.start });
      setProject((cur) => ({ ...p, run: cur.run })); bumpAll(); toast('Scene split at playhead', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  const patchProject = async (body) => {
    if (['scenes', 'audio', 'captions', 'cues'].some((k) => k in body)) await snap();
    try { const p = await api.patch(`/api/projects/${id}`, body); setProject((cur) => ({ ...p, run: cur.run })); bumpAll(); } catch (e) { toast(e.message, 'err'); }
  };
  const patchScene = async (sid, body, quiet) => {
    setProject((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === sid ? { ...s, ...body } : s)) }));
    try {
      await snap();
      await api.patch(`/api/projects/${id}/scenes/${sid}`, body);
      if (Object.keys(body).some((k) => VISUAL_KEYS.includes(k) || k === 'overrides')) bump(sid);
      if ('duration' in body) load();
    } catch (e) { toast(e.message, 'err'); load(); }
  };
  const onOverride = (sid, lid, patch) => {
    const s = project.scenes.find((x) => x.id === sid);
    const ov = { ...(s.overrides || {}) };
    ov[lid] = { ...(ov[lid] || {}), ...patch };
    patchScene(sid, { overrides: ov });
  };
  const clearOverride = (sid, lid) => {
    const s = project.scenes.find((x) => x.id === sid);
    const ov = { ...(s.overrides || {}) };
    delete ov[lid];
    patchScene(sid, { overrides: ov });
  };
  const onLayerPatch = (sid, lid, patch, fromStage) => {
    const s = project.scenes.find((x) => x.id === sid);
    const local = Math.max(0, timeRef.current - (s.start || 0));
    patchScene(sid, { layers: (s.layers || []).map((l) => {
      if (l.id !== lid) return l;
      if (fromStage && recordKeys) return { ...l, ...recordDrag(l, patch, local) };
      return l.kind === 'component' ? componentPatch(l, patch) : { ...l, ...patch };
    }) });
  };
  const addLayer = (layer, pos, targetScene) => {
    const s = targetScene || current;
    if (!s) { toast('Create scenes first', 'err'); return; }
    const L = { x: 30, y: 30, w: 30, start: 0.2, end: s.duration, enter: { preset: 'rise', duration: 0.7 }, exit: { preset: 'none' }, ...layer, id: 'L' + Math.random().toString(36).slice(2, 8) };
    if (pos) { L.x = Math.max(0, pos.x - (L.w || 30) / 2); L.y = Math.max(0, pos.y - (L.h || 10) / 2); }
    patchScene(s.id, { layers: [...(s.layers || []), L] });
    setSelected({ sceneId: s.id, id: L.id, user: true });
    setTab('layer');
  };
  const deleteLayer = (sid, lid) => {
    const s = project.scenes.find((x) => x.id === sid);
    patchScene(sid, { layers: (s.layers || []).filter((l) => l.id !== lid) });
    setSelected(null);
  };
  const duplicateLayer = (sid, L) => {
    const s = project.scenes.find((x) => x.id === sid);
    patchScene(sid, { layers: [...(s.layers || []), { ...L, id: 'L' + Math.random().toString(36).slice(2, 8), x: (L.x || 0) + 3, y: (L.y || 0) + 3 }] });
  };
  const placeAsset = (a, pos, s, extra) => {
    const ratio = a.meta && a.meta.width ? (a.meta.height / a.meta.width) * (project.width / project.height) : (a.kind === 'svg' ? project.width / project.height : 0.6);
    const w = a.kind === 'svg' ? 14 : 34;
    addLayer({ kind: a.kind === 'video' ? 'video' : (a.kind === 'svg' ? 'sticker' : 'image'), src: a.id, w, h: Math.round(w * ratio * 10) / 10, name: a.name, enter: { preset: 'pop', duration: 0.6 }, style: { radius: a.kind === 'svg' ? 0 : 16 }, fit: a.kind === 'svg' ? 'contain' : 'cover', emphasis: a.kind === 'svg' ? 'float' : 'none', ...(extra || {}) }, pos, s);
  };
  const onDropAsset = async (s, data, pos) => {
    if (data.layer) return addLayer(data.layer, pos, s);
    if (data.stock) {
      try {
        const r = await api.post(`/api/projects/${id}/stock/import`, data.stock);
        await load();
        placeAsset(r.asset, pos, s);
      } catch (e) { toast(e.message, 'err'); }
      return;
    }
    placeAsset(data.asset, pos, s);
  };
  const onImported = async (asset) => { await load(); placeAsset(asset, null, current); };
  const clipsOf = () => ((projRefLatest.current || project).audio || {}).clips || [];
  const setClips = (list) => patchProject({ audio: { clips: list } });
  const onClipPatch = (cid, p) => setClips(clipsOf().map((x) => (x.id === cid ? { ...x, ...p } : x)));
  const deleteClip = (cid) => { setClips(clipsOf().filter((x) => x.id !== cid)); setSelClip(null); };
  const addAudioClip = (a, t) => {
    const c = { id: 'c' + Math.random().toString(36).slice(2, 8), asset: a.id, name: a.name, t: Math.max(0, Math.round(t * 1000) / 1000), gain: 1, fade_in: 0.02, fade_out: 0.15 };
    if (a.meta && a.meta.duration) c.dur = Math.round(Math.min(a.meta.duration, Math.max(0.2, totalDur - c.t + 0.5)) * 1000) / 1000;
    setClips([...clipsOf(), c]);
    setSelClip(c.id);
    toast(`${a.name} placed at ${c.t.toFixed(2)}s`, 'ok');
  };
  const sceneAtTime = (t) => project.scenes.find((s) => t >= s.start - 1e-6 && t < s.start + s.duration - 1e-6) || project.scenes[project.scenes.length - 1];
  const timed = (s, t, len) => { const a = Math.max(0, Math.round((t - s.start) * 100) / 100); return { start: a, end: Math.min(s.duration, Math.round((a + len) * 100) / 100) }; };
  const uploadOne = async (f, role) => {
    const r = await api.upload(`/api/projects/${id}/assets`, f, { role });
    return r.asset;
  };
  const onDropTimeline = async ({ data, files, t }) => {
    const s = sceneAtTime(t);
    if (!s) { toast('Create scenes first', 'err'); return; }
    try {
      if (files) {
        for (const f of Array.from(files)) {
          const isAudio = f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
          const a = await uploadOne(f, isAudio ? 'clip' : 'reference');
          await load();
          if (a.kind === 'audio') addAudioClip(a, t);
          else if (['image', 'video', 'svg'].includes(a.kind)) placeAsset(a, null, s, timed(s, t, a.kind === 'video' && a.meta && a.meta.duration ? a.meta.duration : 3));
        }
        return;
      }
      if (data.asset && data.asset.kind === 'audio') { addAudioClip(data.asset, t); return; }
      if (data.layer) { addLayer({ ...data.layer, ...timed(s, t, 3) }, null, s); return; }
      if (data.stock) {
        const r = await api.post(`/api/projects/${id}/stock/import`, data.stock);
        await load();
        placeAsset(r.asset, null, s, timed(s, t, 3));
        return;
      }
      if (data.asset) placeAsset(data.asset, null, s, timed(s, t, data.asset.kind === 'video' && data.asset.meta && data.asset.meta.duration ? data.asset.meta.duration : 3));
    } catch (e) { toast(e.message, 'err'); }
  };
  const pasteLayer = () => {
    const s = sceneAtTime(timeRef.current);
    if (!s || !clipboard.current) return;
    const L = clipboard.current;
    const len = Math.max(0.3, (L.end ?? s.duration) - (L.start || 0));
    addLayer({ ...L, id: undefined, ...timed(s, timeRef.current, len) }, null, s);
  };
  const onCuePatch = async (cid, p) => {
    await snap(true);
    setProject((cur) => ({ ...cur, cues: (cur.cues || []).map((c) => (c.id === cid ? { ...c, ...p } : c)) }));
    try { await api.patch(`/api/projects/${id}/cues/${cid}`, p); bumpAll(); } catch (e) { toast(e.message, 'err'); load(); }
  };
  const checkSync = async () => {
    setSyncing(true);
    try {
      const r = await api.post(`/api/projects/${id}/sync`, { fix: true });
      await load(); bumpAll();
      toast(r.skipped ? r.skipped : r.ok ? `Sync verified: ${r.checked} cues within one frame` : `${r.failed} of ${r.checked} cues off sync`, r.ok ? 'ok' : 'err');
    } catch (e) { toast(e.message, 'err'); }
    setSyncing(false);
  };
  const renderSceneNow = async () => {
    if (!current) return;
    try { await api.post(`/api/projects/${id}/scenes/${current.id}/render`); setTab('swarm'); toast(`Rendering scene ${current.index + 1} live`, 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const upload = async (files, role) => {
    for (const f of Array.from(files)) {
      try {
        const r = await api.upload(`/api/projects/${id}/assets`, f, { role: role || (f.type.startsWith('audio/') ? 'music' : /\.(srt|vtt|ass|ssa|json)$/i.test(f.name) ? 'subtitles' : 'reference') });
        toast(r.subtitles ? `Subtitles loaded: ${r.subtitles.count} cues` : `Added ${f.name}`, 'ok');
      } catch (e) { toast(e.message, 'err'); }
    }
    load();
  };
  const setSubtitles = async (src) => {
    try {
      if (typeof src === 'string') { const r = await api.post(`/api/projects/${id}/subtitles`, { text: src }); toast(`${r.count} cues loaded`, 'ok'); }
      else await upload([src], 'subtitles');
      load(); bumpAll();
    } catch (e) { toast(e.message, 'err'); }
  };
  const startRun = async (mode) => {
    if (mode !== 'render') await snap(true);
    try { const r = await api.post(`/api/projects/${id}/run`, { mode }); setRun(r); setTab('swarm'); toast(mode === 'render' ? 'Rendering all scenes' : 'Swarm launched', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const cancel = async () => { await api.post(`/api/projects/${id}/cancel`); toast('Cancelling'); };
  const [ctxMenu, setCtxMenu] = useState(null);
  const [tlMenu, setTlMenu] = useState(null);
  const [textPrompt, setTextPrompt] = useState(null);
  const clipBoard = useRef(null);
  const rid = () => 'c' + Math.random().toString(36).slice(2, 8);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const cueApi = async (fn) => { await snap(true); try { await fn(); await load(); bumpAll(); } catch (e) { toast(e.message, 'err'); } };
  const splitClip = (c, T) => {
    const len = clipLength(c, project.assets || []);
    if (!(T > c.t + 0.05 && T < c.t + len - 0.05)) { toast('Put the playhead inside the clip to split it', 'err'); return; }
    const k = T - c.t;
    const a = { ...c, dur: r3(k), fade_out: Math.min(c.fade_out || 0, 0.02) };
    const b = { ...c, id: rid(), t: r3(T), in: r3((c.in || 0) + k), dur: r3(len - k), fade_in: 0.02 };
    setClips(clipsOf().flatMap((x) => (x.id === c.id ? [a, b] : [x])));
    setSelClip(b.id);
  };
  const materialize = async (track, then) => {
    await snap(true);
    try {
      const r = await api.post(`/api/projects/${id}/audio/to-clip`, { track });
      const fresh = await api.get(`/api/projects/${id}`);
      setProject(fresh);
      projRefLatest.current = fresh;
      if (then) then(r.clip);
      else { setSelClip(r.clip.id); toast(track === 'voice' ? 'Voiceover is now an editable clip (captions keep their timing)' : 'Music is now an editable clip', 'ok'); }
    } catch (e) { toast(e.message, 'err'); }
  };
  const tlItems = (m) => {
    const T = r3(m.t != null ? m.t : time);
    const llmOn = !!(health && health.llm);
    const items = [];
    if (m.kind === 'clip') {
      const c = clipsOf().find((x) => x.id === m.clip.id) || m.clip;
      const len = clipLength(c, project.assets || []);
      const inside = T > c.t + 0.05 && T < c.t + len - 0.05;
      const a = c.asset && (project.assets || []).find((x) => x.id === c.asset);
      items.push({ header: `${c.role === 'music' ? 'Music' : c.role === 'voice' ? 'Voice' : 'Sound'} · ${c.name || (a && a.name) || c.sfx || 'clip'}` });
      items.push({ label: 'Split at playhead', icon: 'scissors', kbd: 'S', disabled: !inside, onClick: () => splitClip(c, T) });
      items.push({ label: 'Delete', icon: 'trash-2', kbd: 'Del', danger: true, onClick: () => deleteClip(c.id) });
      items.push({ label: 'Duplicate', icon: 'copy', onClick: () => { const d = { ...c, id: rid(), t: r3(c.t + len) }; setClips([...clipsOf(), d]); setSelClip(d.id); } });
      items.push({ label: 'Copy', icon: 'clipboard-copy', kbd: 'Ctrl C', onClick: () => { clipBoard.current = { ...c }; toast('Clip copied'); } });
      items.push({ sep: true });
      items.push({ label: 'Trim start to playhead', icon: 'arrow-right-to-line', disabled: !inside, onClick: () => onClipPatch(c.id, { t: T, in: r3((c.in || 0) + (T - c.t)), dur: r3(len - (T - c.t)) }) });
      items.push({ label: 'Trim end to playhead', icon: 'arrow-left-to-line', disabled: !inside, onClick: () => onClipPatch(c.id, { dur: r3(T - c.t) }) });
      items.push({ label: 'Move start to playhead', icon: 'move-horizontal', onClick: () => onClipPatch(c.id, { t: T }) });
      items.push({ sep: true });
      items.push({ label: c.mute ? 'Unmute' : 'Mute', icon: c.mute ? 'volume-2' : 'volume-x', kbd: 'M', onClick: () => onClipPatch(c.id, { mute: !c.mute }) });
      items.push({ label: 'Louder (+3 dB)', icon: 'volume-2', onClick: () => onClipPatch(c.id, { gain: r3(Math.min(2.5, (c.gain ?? 1) * 1.41)) }) });
      items.push({ label: 'Quieter (-3 dB)', icon: 'volume-1', onClick: () => onClipPatch(c.id, { gain: r3(Math.max(0.05, (c.gain ?? 1) / 1.41)) }) });
      items.push({ label: 'Fade in 0.5 s', icon: 'trending-up', onClick: () => onClipPatch(c.id, { fade_in: 0.5 }) });
      items.push({ label: 'Fade out 0.5 s', icon: 'trending-down', onClick: () => onClipPatch(c.id, { fade_out: 0.5 }) });
      items.push({ label: 'Remove fades', icon: 'minus', onClick: () => onClipPatch(c.id, { fade_in: 0.02, fade_out: 0.02 }) });
      items.push({ label: 'Rename…', icon: 'pencil', onClick: () => setTextPrompt({ title: 'Rename clip', initial: c.name || (a && a.name) || c.sfx || '', onSave: (v) => onClipPatch(c.id, { name: v }) }) });
      items.push({ label: 'Open in Sound panel', icon: 'sliders-horizontal', onClick: () => { setSelClip(c.id); setLeft('audio'); } });
    } else if (m.kind === 'music') {
      const cfgA = project.audio || {};
      items.push({ header: `Music bed · ${m.asset ? m.asset.name : cfgA.music === 'auto' ? 'Generated score' : 'Music'}` });
      items.push({ label: 'Split at playhead', icon: 'scissors', onClick: () => materialize('music', (clip) => { setTimeout(() => splitClip(clip, T), 0); toast('Music split at ' + T.toFixed(2) + 's', 'ok'); }) });
      items.push({ label: 'Trim start to playhead', icon: 'arrow-right-to-line', onClick: () => materialize('music', (clip) => setTimeout(() => onClipPatch(clip.id, { t: T, in: T, dur: r3(clip.dur - T) }), 0)) });
      items.push({ label: 'Trim end to playhead', icon: 'arrow-left-to-line', onClick: () => materialize('music', (clip) => setTimeout(() => onClipPatch(clip.id, { dur: T }), 0)) });
      items.push({ label: 'Convert to editable clip', icon: 'square-split-horizontal', onClick: () => materialize('music') });
      items.push({ sep: true });
      items.push({ label: 'Louder (+3 dB)', icon: 'volume-2', onClick: () => patchProject({ audio: { music_gain: Math.min(-4, (cfgA.music_gain ?? -18) + 3) } }) });
      items.push({ label: 'Quieter (-3 dB)', icon: 'volume-1', onClick: () => patchProject({ audio: { music_gain: Math.max(-36, (cfgA.music_gain ?? -18) - 3) } }) });
      items.push({ label: 'Change music…', icon: 'music', onClick: () => setLeft('audio') });
      items.push({ label: 'Remove music', icon: 'trash-2', danger: true, onClick: () => patchProject({ audio: { music: '' } }) });
    } else if (m.kind === 'voice') {
      const cfgA = project.audio || {};
      items.push({ header: `Voiceover · ${m.asset ? m.asset.name : ''}` });
      items.push({ label: cfgA.voice_mute ? 'Unmute voice' : 'Mute voice', icon: cfgA.voice_mute ? 'mic' : 'mic-off', onClick: () => patchProject({ audio: { voice_mute: !cfgA.voice_mute } }) });
      items.push({ label: 'Split at playhead', icon: 'scissors', onClick: () => materialize('voice', (clip) => setTimeout(() => splitClip(clip, T), 0)) });
      items.push({ label: 'Convert to editable clip', icon: 'square-split-horizontal', onClick: () => materialize('voice') });
      items.push({ label: 'Re-voice with AI…', icon: 'sparkles', onClick: () => setLeft('audio') });
      items.push({ label: 'Remove voiceover', icon: 'trash-2', danger: true, onClick: () => patchProject({ audio: { voice: null } }) });
    } else if (m.kind === 'cue') {
      const c = m.cue;
      items.push({ header: `Caption · ${String(c.text).slice(0, 30)}` });
      items.push({ label: 'Edit text…', icon: 'pencil', onClick: () => setTextPrompt({ title: 'Edit caption', initial: c.text, multiline: true, onSave: (v) => onCuePatch(c.id, { text: v }) }) });
      items.push({ label: 'Split at playhead', icon: 'scissors', disabled: !(T > c.start + 0.05 && T < c.end - 0.05), onClick: () => cueApi(() => api.post(`/api/projects/${id}/cues/${c.id}/split`, { at: T })) });
      items.push({ label: 'Merge with next', icon: 'merge', onClick: () => cueApi(() => api.post(`/api/projects/${id}/cues/${c.id}/merge`, {})) });
      items.push({ label: 'Start at playhead', icon: 'arrow-right-to-line', disabled: T >= c.end - 0.05, onClick: () => onCuePatch(c.id, { start: T }) });
      items.push({ label: 'End at playhead', icon: 'arrow-left-to-line', disabled: T <= c.start + 0.05, onClick: () => onCuePatch(c.id, { end: T }) });
      items.push({ label: 'Delete caption', icon: 'trash-2', danger: true, onClick: () => cueApi(() => api.del(`/api/projects/${id}/cues/${c.id}`)) });
    } else if (m.kind === 'layer') {
      const s = m.scene, L = m.layer;
      const lt = r3(T - s.start);
      const inside = lt > (L.start || 0) + 0.05 && lt < (L.end ?? s.duration) - 0.05;
      items.push({ header: `Layer · ${L.text || L.name || L.kind}` });
      items.push({ label: 'Delete', icon: 'trash-2', kbd: 'Del', danger: true, onClick: () => deleteLayer(s.id, L.id) });
      items.push({ label: 'Duplicate', icon: 'copy', kbd: 'Ctrl D', onClick: () => duplicateLayer(s.id, L) });
      items.push({ label: 'Copy', icon: 'clipboard-copy', kbd: 'Ctrl C', onClick: () => { clipboard.current = JSON.parse(JSON.stringify(L)); toast('Layer copied'); } });
      items.push({ label: 'Trim start to playhead', icon: 'arrow-right-to-line', disabled: !inside, onClick: () => onLayerPatch(s.id, L.id, { start: lt }) });
      items.push({ label: 'Trim end to playhead', icon: 'arrow-left-to-line', disabled: !inside, onClick: () => onLayerPatch(s.id, L.id, { end: lt }) });
      items.push({ label: 'Bring to front', icon: 'bring-to-front', onClick: () => reorderLayer(s.id, L.id, true) });
      items.push({ label: 'Send to back', icon: 'send-to-back', onClick: () => reorderLayer(s.id, L.id, false) });
      items.push({ label: 'Edit properties', icon: 'sliders-horizontal', onClick: () => { setSelected({ sceneId: s.id, id: L.id, user: true }); setTab('layer'); } });
    } else if (m.kind === 'scene') {
      const s = m.scene;
      const i = project.scenes.findIndex((x) => x.id === s.id);
      const inside = T > s.start + 0.1 && T < s.start + s.duration - 0.1;
      const order = project.scenes.map((x) => x.id);
      const move = async (dir) => { const o = order.slice(); const j = i + dir; [o[i], o[j]] = [o[j], o[i]]; await snap(true); await api.post(`/api/projects/${id}/scenes/reorder`, { order: o }); load(); bumpAll(); };
      items.push({ header: `Scene ${i + 1} · ${(s.title || '').slice(0, 30)}` });
      items.push({ label: 'Split at playhead', icon: 'scissors', kbd: 'S', disabled: !inside, onClick: async () => { await snap(true); try { await api.post(`/api/projects/${id}/scenes/${s.id}/split`, { at: r3(T - s.start) }); load(); bumpAll(); } catch (e) { toast(e.message, 'err'); } } });
      items.push({ label: 'Duplicate scene', icon: 'copy', onClick: async () => { await snap(true); await api.post(`/api/projects/${id}/scenes/${s.id}/duplicate`, {}); load(); bumpAll(); } });
      items.push({ label: 'Move left', icon: 'arrow-left', disabled: i === 0, onClick: () => move(-1) });
      items.push({ label: 'Move right', icon: 'arrow-right', disabled: i === project.scenes.length - 1, onClick: () => move(1) });
      items.push({ label: `Transition: ${((s.transition || {}).type || 'fade')} → cut`, icon: 'scissors-line-dashed', disabled: (s.transition || {}).type === 'cut', onClick: () => patchScene(s.id, { transition: { ...(s.transition || {}), type: 'cut' } }) });
      items.push({ label: 'Transition: crossfade', icon: 'blend', disabled: (s.transition || {}).type === 'fade', onClick: () => patchScene(s.id, { transition: { ...(s.transition || {}), type: 'fade', duration: 0.5 } }) });
      items.push({ label: 'Transition: wipe', icon: 'move-right', onClick: () => patchScene(s.id, { transition: { ...(s.transition || {}), type: 'wipeleft', duration: 0.5 } }) });
      items.push({ label: s.locked ? 'Unlock scene' : 'Lock scene (agents keep it)', icon: s.locked ? 'lock-open' : 'lock', onClick: () => patchScene(s.id, { locked: !s.locked }) });
      items.push({ sep: true });
      items.push({ label: 'Render this scene', icon: 'cpu', disabled: running, onClick: async () => { try { await api.post(`/api/projects/${id}/scenes/${s.id}/render`); setTab('swarm'); } catch (e) { toast(e.message, 'err'); } } });
      items.push({ label: 'Improve with the agent…', icon: 'wand-sparkles', disabled: !llmOn, onClick: () => setAskAgent({ sid: s.id, title: `Direct scene ${i + 1}`, prefix: '' }) });
      items.push({ label: 'Extend the story from here…', icon: 'fast-forward', disabled: !llmOn, onClick: () => setReplicate({ scene: s, mode: 'extend' }) });
      items.push({ label: 'Replicate with agent…', icon: 'copy-plus', disabled: !llmOn, onClick: () => setReplicate({ scene: s, mode: 'replicate' }) });
      items.push({ sep: true });
      items.push({ label: 'Delete scene', icon: 'trash', danger: true, onClick: async () => { await snap(true); await api.del(`/api/projects/${id}/scenes/${s.id}`); setSelScene(null); load(); } });
    } else if (m.kind === 'track') {
      if (m.track === 'audio') {
        items.push({ header: `Audio track · ${T.toFixed(2)}s` });
        items.push({ label: 'Paste clip here', icon: 'clipboard-paste', disabled: !clipBoard.current, onClick: () => { const d = { ...clipBoard.current, id: rid(), t: T }; setClips([...clipsOf(), d]); setSelClip(d.id); } });
        items.push({ label: 'Add sound effect…', icon: 'audio-lines', onClick: () => setLeft('audio') });
        items.push({ label: 'Find free sound or music…', icon: 'search', onClick: () => setLeft('media') });
      } else if (m.track === 'captions') {
        items.push({ header: `Captions · ${T.toFixed(2)}s` });
        items.push({ label: 'Add caption here…', icon: 'captions', onClick: () => setTextPrompt({ title: 'New caption', initial: '', onSave: (v) => cueApi(() => api.post(`/api/projects/${id}/cues`, { start: T, text: v || 'New caption' })) }) });
      } else if (m.track === 'layers') {
        items.push({ header: `Layers · ${T.toFixed(2)}s` });
        items.push({ label: 'Paste layer here', icon: 'clipboard-paste', disabled: !clipboard.current, onClick: () => { timeRef.current = T; pasteLayer(); } });
        items.push({ label: 'Add text here', icon: 'type', onClick: () => { const s = sceneAtTime(T); s && addLayer({ kind: 'text', text: 'Your words', w: 40, start: r3(T - s.start) }, null, s); } });
      } else {
        items.push({ header: 'Scenes' });
        items.push({ label: 'Add scene at the end', icon: 'plus', onClick: () => addScene(project.scenes.length) });
      }
      items.push({ label: 'Move playhead here', icon: 'locate', onClick: () => setTime(T) });
    }
    return items;
  };
  const [askAgent, setAskAgent] = useState(null);
  const [replicate, setReplicate] = useState(null);
  const layerLabel = (sel) => (sel && (sel.text || sel.tag || sel.id) || '').toString().slice(0, 40);
  const reorderLayer = (sid, lid, front) => {
    const s = project.scenes.find((x) => x.id === sid);
    const list = (s.layers || []).filter((l) => l.id !== lid);
    const L = (s.layers || []).find((l) => l.id === lid);
    if (!L) return;
    patchScene(sid, { layers: front ? [...list, L] : [L, ...list] });
  };
  const menuItems = () => {
    const sel = selected;
    const sc = (sel && project.scenes.find((x) => x.id === sel.sceneId)) || current;
    const ov = sel && sc ? ((sc.overrides || {})[sel.id] || {}) : {};
    const llmOn = !!(health && health.llm);
    const items = [];
    if (sel && sc) {
      items.push({ header: `${sel.user ? 'Layer' : 'Element'} · ${layerLabel(sel)}` });
      items.push({ label: 'Delete', icon: 'trash-2', kbd: 'Del', danger: true, onClick: () => (sel.user ? deleteLayer(sc.id, sel.id) : (onOverride(sc.id, sel.id, { hidden: true }), setSelected(null))) });
      if (sel.user) items.push({ label: 'Duplicate', icon: 'copy', kbd: 'Ctrl D', onClick: () => { const L = (sc.layers || []).find((l) => l.id === sel.id); L && duplicateLayer(sc.id, L); } });
      items.push({ label: 'Bring to front', icon: 'bring-to-front', onClick: () => (sel.user ? reorderLayer(sc.id, sel.id, true) : onOverride(sc.id, sel.id, { z: 50 })) });
      items.push({ label: 'Send to back', icon: 'send-to-back', onClick: () => (sel.user ? reorderLayer(sc.id, sel.id, false) : onOverride(sc.id, sel.id, { z: -1 })) });
      items.push({ label: ov.hidden ? 'Show' : 'Hide', icon: ov.hidden ? 'eye' : 'eye-off', onClick: () => onOverride(sc.id, sel.id, { hidden: !ov.hidden }) });
      if (!sel.user && Object.keys(ov).length) items.push({ label: 'Reset my changes', icon: 'rotate-ccw', onClick: () => clearOverride(sc.id, sel.id) });
      items.push({ label: 'Edit properties', icon: 'sliders-horizontal', onClick: () => setTab('layer') });
      items.push({ label: 'Ask the agent to change this…', icon: 'sparkles', disabled: !llmOn, onClick: () => setAskAgent({ sid: sc.id, title: `Change “${layerLabel(sel)}”`, prefix: `In this scene, change the element "${layerLabel(sel)}" (data-layer ${sel.id}): ` }) });
      items.push({ sep: true });
    }
    if (sc) {
      items.push({ header: `Scene ${sc.index + 1} · ${(sc.title || '').slice(0, 30)}` });
      items.push({ label: 'Add text here', icon: 'type', onClick: () => addLayer({ kind: 'text', text: 'Your words', w: 40, start: Math.max(0, Math.round((time - sc.start) * 10) / 10) }, null, sc) });
      items.push({ label: 'Improve this scene with the agent…', icon: 'wand-sparkles', disabled: !llmOn, onClick: () => setAskAgent({ sid: sc.id, title: `Direct scene ${sc.index + 1}`, prefix: '' }) });
      items.push({ label: 'Replicate with agent…', icon: 'copy-plus', disabled: !llmOn, onClick: () => setReplicate({ scene: sc, mode: 'replicate' }) });
      items.push({ label: 'Extend the story from here…', icon: 'fast-forward', disabled: !llmOn, onClick: () => setReplicate({ scene: sc, mode: 'extend' }) });
      items.push({ label: 'Make a variation…', icon: 'shuffle', disabled: !llmOn, onClick: () => setReplicate({ scene: sc, mode: 'variation' }) });
      items.push({ sep: true });
      items.push({ label: 'Reload preview', icon: 'refresh-cw', onClick: () => bump(sc.id) });
      items.push({ label: 'Split at playhead', icon: 'scissors', kbd: 'S', onClick: () => splitAt() });
      items.push({ label: 'Delete scene', icon: 'trash', danger: true, onClick: async () => { await snap(true); await api.del(`/api/projects/${id}/scenes/${sc.id}`); setSelScene(null); load(); } });
    }
    return items;
  };
  const sendChat = async (sid, msg) => {
    setChat((c) => [...c, { who: 'user', text: msg, scene: sid }, ...(health && health.llm ? [{ who: 'agent', text: 'On it. Rewriting the composition…', scene: sid, pending: true }] : [])]);
    try { await api.post(`/api/projects/${id}/scenes/${sid}/chat`, { message: msg }); if (!(health && health.llm)) { load(); bump(sid); } } catch (e) { toast(e.message, 'err'); }
  };
  const addScene = async (at) => { await snap(true); await api.post(`/api/projects/${id}/scenes`, { at }); load(); };
  const delScene = async () => { if (!current) return; await snap(true); await api.del(`/api/projects/${id}/scenes/${current.id}`); setSelScene(null); load(); };
  const thumb = async () => { if (!current) return; try { await api.post(`/api/projects/${id}/scenes/${current.id}/thumb`, {}); load(); } catch (e) { toast(e.message, 'err'); } };
  const restore = async (rev) => { await snap(true); await api.post(`/api/projects/${id}/revisions/${rev}`); toast('Revision restored', 'ok'); load(); bumpAll(); };
  const saveTitle = async (v) => { setEditTitle(false); if (v && v !== project.title) patchProject({ title: v }); };
  const rendered = project.scenes.filter((s) => s.status === 'rendered').length;
  const tabs = [['swarm', 'bot', 'Swarm'], ['scene', 'clapperboard', 'Scene'], ['layer', 'move', 'Layer'], ['look', 'palette', 'Look'], ['code', 'code-xml', 'Code'], ['chat', 'message-circle', 'Direct'], ['qa', 'scan-eye', 'QA']];
  const leftDef = LEFT.find((l) => l[0] === left) || LEFT[0];
  const workingCount = Object.values(agents).filter((a) => a.state === 'working').length;
  return html`<div style=${{ display: 'grid', gridTemplateRows: '52px 1fr', height: '100%' }}>
    ${audioSrc ? html`<audio ref=${audioRef} src=${audioSrc} preload="auto"></audio>` : null}
    <header class="topbar" style=${{ height: '52px' }}>
      <div class="brand" onClick=${() => navigate('/')}><${BrandMark} size=${28} /></div>
      <button class="btn ghost sm" onClick=${() => navigate('/')}><${Icon} name="chevron-left" size=${14} />Productions</button>
      <div style=${{ width: '1px', height: '22px', background: 'var(--line)' }}></div>
      ${editTitle ? html`<input class="input sm" style=${{ width: '280px' }} autofocus value=${project.title} onBlur=${(e) => saveTitle(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />`
      : html`<b class="ellipsis" style=${{ maxWidth: '320px', fontSize: '14px', cursor: 'text' }} onClick=${() => setEditTitle(true)}>${project.title}</b>`}
      <span class="chip">${project.aspect}</span><span class="chip">${(project.bible || {}).name}</span><span class="chip mono">${fmtDur(totalDur)}</span>
      ${running ? html`<span class="chip brand"><span class="dot work"></span>${run.phase} · ${workingCount} agents</span>` : run && run.status === 'done' ? html`<span class="chip ok"><${Icon} name="check" size=${11} />${rendered}/${project.scenes.length} rendered</span>` : null}
      <div class="spacer"></div>
      <div class="seg"><button class=${view === 'live' ? 'on' : ''} onClick=${() => setView('live')}><${Icon} name="radio" size=${12} />Live</button>
        <button class=${view === 'scene' ? 'on' : ''} title="Play the rendered segment of the current scene" onClick=${() => { setView('scene'); setPlaying(false); }}><${Icon} name="square-play" size=${12} />Scene render</button>
        <button class=${view === 'master' ? 'on' : ''} onClick=${() => { setView('master'); setPlaying(false); }} disabled=${!(project.outputs || {}).master}><${Icon} name="film" size=${12} />Master</button></div>
      ${running ? html`<button class="btn" onClick=${cancel}><${Icon} name="square" size=${13} />Stop</button>` : html`
        <button class="btn" title="Re-plan and animate every scene without rendering" onClick=${() => startRun('plan')}><${Icon} name="list-video" size=${14} />Plan</button>
        <button class=${'btn ' + (needsRender && outputs.master ? 'brand render-hot' : '')} title=${stale ? 'You changed the edit since the last render. Render to update the master.' : 'Render the current edit and master it'} disabled=${!project.scenes.length} onClick=${() => startRun('render')}><${Icon} name="cpu" size=${14} />${stale ? 'Render changes' : 'Render'}</button>
        <button class=${'btn ' + (needsRender && outputs.master ? '' : 'brand')} onClick=${() => startRun(project.edit ? 'edit' : 'full')}><${Icon} name="wand-sparkles" size=${14} />${project.edit ? 'Re-edit with swarm' : 'Generate film'}</button>`}
      ${outputs.master && !stale && !running ? html`<a class="btn icon" title="Download master" href=${outputs.master} download><${Icon} name="download" size=${15} /></a>`
      : html`<button class="btn icon" disabled title=${running ? 'Rendering…' : stale ? 'Render your changes to enable download' : 'Render the film first'}><${Icon} name="download" size=${15} /></button>`}
    </header>
    <div class="studio" style=${{ gridTemplateRows: collapsed ? '1fr 34px' : '1fr 248px' }}>
      <nav class="rail">${LEFT.map(([k, icon, tip]) => html`<button class=${left === k ? 'on' : ''} data-tip=${tip} onClick=${() => setLeft(k)}><${Icon} name=${icon} /></button>`)}
        <div class="spacer"></div><button data-tip="Skills library" onClick=${() => navigate('/skills')}><${Icon} name="book-open-text" /></button>
        <button data-tip="Model settings" onClick=${() => navigate('/settings')}><${Icon} name="settings" /></button></nav>
      <aside class="leftpanel" data-agent-target="left">
        <div class="panel-head"><${Icon} name=${leftDef[1]} />${leftDef[2]}</div>
        <div class="panel-body">
          ${left === 'media' ? html`<${MediaPanel} project=${project} scene=${current} onUpload=${upload} onDeleteAsset=${async (aid) => { await api.del(`/api/projects/${id}/assets/${aid}`); load(); }} onAddLayer=${(l) => addLayer(l)} />` : null}
          ${left === 'design' ? html`<${DesignPanel} project=${project} styles=${styles} onPatch=${patchProject} scene=${current} onScenePatch=${(sid, body) => patchScene(sid, body).then(() => bumpAll && bumpAll())} />` : null}
          ${left === 'captions' ? html`<${CaptionsPanel} project=${project} onPatch=${patchProject} onSubtitles=${setSubtitles} onCueEdit=${async (cid, p) => { await snap(true); await api.patch(`/api/projects/${id}/cues/${cid}`, p); load(); bumpAll(); }} onCheckSync=${checkSync} syncing=${syncing} selectedCue=${selCue} onSeek=${(t) => setTime(t)} />` : null}
          ${left === 'audio' ? html`<${SoundPanel} project=${project} time=${time} onPatch=${patchProject} onUpload=${upload} selectedClip=${selClip} onSelectClip=${setSelClip} onClipPatch=${onClipPatch} onDeleteClip=${deleteClip} onAddClip=${(a) => addAudioClip(a, timeRef.current)} />` : null}
          ${left === 'components' ? html`<${ComponentsPanel} scene=${current} onAdd=${(l) => addLayer({ ...l, start: Math.max(0, Math.round((time - (current ? current.start : 0)) * 10) / 10) })} />` : null}
          ${left === 'text' ? html`<${TextPanel} scene=${current} onAdd=${(l) => addLayer({ ...l, start: Math.max(0, Math.round((time - (current ? current.start : 0)) * 10) / 10) })} />` : null}
          ${left === 'stock' ? html`<${StockPanel} project=${project} scene=${current} onImported=${onImported} />` : null}
          ${left === 'research' ? html`<${ResearchPanel} />` : null}
          ${left === 'history' ? html`<${HistoryPanel} project=${project} onRestore=${restore} />` : null}
          ${left === 'export' ? html`<${ExportPanel} project=${project} />` : null}
        </div>
      </aside>
      <main class="center">
        <div class="stagebar">
          <div class="seg"><button class=${!guides ? 'on' : ''} onClick=${() => setGuides(false)}>Clean</button><button class=${guides ? 'on' : ''} onClick=${() => setGuides(true)}><${Icon} name="frame" size=${12} />Safe area</button></div>
          <span class="muted" style=${{ fontSize: '12px' }}>${playing ? 'Playing live HTML composition' : 'Paused: click elements to edit, drag media in'}</span>
          <div class="spacer"></div>
          ${current ? html`<span class="chip">${current.title}</span>` : null}
          <button class="btn sm" disabled=${!(health && health.llm) || running} title="Create new scenes from this scene or a reference image or video" onClick=${() => setReplicate({ scene: current, mode: 'extend' })}><${Icon} name="copy-plus" size=${12} />Replicate with agent</button>
          <button class="btn sm" disabled=${!current} onClick=${() => current && bump(current.id)}><${Icon} name="refresh-cw" size=${12} />Reload</button>
        </div>
        <div style=${{ display: 'contents' }} onContextMenu=${(e) => { if (view !== 'live') return; e.preventDefault(); setPlaying(false); setCtxMenu({ x: e.clientX, y: e.clientY }); }}>
        <${Stage} project=${project} time=${time} setTime=${setTime} playing=${playing} setPlaying=${setPlaying} versions=${versions} view=${view} guides=${guides}
          selected=${selected} onSelect=${(s) => { setSelected(s); if (s) setTab('layer'); }} onOverride=${onOverride} onLayerPatch=${onLayerPatch} onDropAsset=${onDropAsset}
          cursors=${cursors} agents=${agents} browse=${browse} progress=${progress} previews=${previews} agentNames=${agentNames} />
        </div>
        ${ctxMenu ? html`<${ContextMenu} x=${ctxMenu.x} y=${ctxMenu.y} items=${menuItems()} onClose=${() => setCtxMenu(null)} />` : null}
        ${askAgent ? html`<${AskAgentDialog} title=${askAgent.title} placeholder="What should change? For example: make the zombies slower, add rain, push the camera in on her face" onSend=${(t) => { sendChat(askAgent.sid, (askAgent.prefix || '') + t); setTab('chat'); }} onClose=${() => setAskAgent(null)} />` : null}
        ${replicate ? html`<${ReplicateDialog} project=${project} scene=${replicate.scene} initialMode=${replicate.mode} onClose=${() => setReplicate(null)} onStarted=${() => { load(); setTab('swarm'); }} />` : null}
        <div class="transport">
          <button class="btn ghost icon sm" onClick=${() => setTime(0)}><${Icon} name="skip-back" size=${14} /></button>
          <button class="btn ghost icon sm" onClick=${() => { const i = project.scenes.findIndex((s) => s.id === (scene || {}).id); const p = project.scenes[Math.max(0, i - 1)]; p && setTime(p.start + 0.001); }}><${Icon} name="chevrons-left" size=${14} /></button>
          <button class="play" onClick=${() => { if (time >= totalDur - 0.05) setTime(0); setPlaying(!playing); }}><${Icon} name=${playing ? 'pause' : 'play'} /></button>
          <button class="btn ghost icon sm" onClick=${() => { const i = project.scenes.findIndex((s) => s.id === (scene || {}).id); const n = project.scenes[i + 1]; n && setTime(n.start + 0.001); }}><${Icon} name="chevrons-right" size=${14} /></button>
          <span class="tc">${fmtTime(time, project.fps)} / ${fmtTime(totalDur, project.fps)}</span>
          <div class="tsep"></div>
          <button class="btn ghost icon sm" title="Undo (Ctrl+Z)" disabled=${!hist.undo} onClick=${undo}><${Icon} name="undo-2" size=${14} /></button>
          <button class="btn ghost icon sm" title="Redo (Ctrl+Shift+Z)" disabled=${!hist.redo} onClick=${redo}><${Icon} name="redo-2" size=${14} /></button>
          <button class="btn ghost icon sm" title="Split scene at playhead (S)" onClick=${splitAt}><${Icon} name="scissors" size=${14} /></button>
          <span class="muted keys" style=${{ fontSize: '11.5px' }}>${project.fps} fps · <span class="kbd">Space</span> play · <span class="kbd">S</span> split · <span class="kbd">J</span><span class="kbd">L</span> 2s · <span class="kbd">↑</span><span class="kbd">↓</span> scene</span>
          <div class="spacer"></div>
          ${project.cues && project.cues.length ? html`<span class=${'chip ' + (project.cues_synthetic ? '' : 'ok')}><${Icon} name="captions" size=${11} />${project.cues_synthetic ? 'narration timed' : 'subtitle clock'} · ${project.cues.length}</span>` : null}
        </div>
      </main>
      <aside class="rightpanel" data-agent-target="inspector">
        <div class="tabs">${tabs.map(([k, icon, label]) => html`<button class=${tab === k ? 'on' : ''} data-agent-target=${'tab-' + k} onClick=${() => setTab(k)}><${Icon} name=${icon} /><span class="tab-label">${label}</span>${k === 'swarm' && workingCount ? html`<span class="badge">${workingCount}</span>` : null}</button>`)}</div>
        <div class="scroll" data-agent-target=${tab === 'swarm' ? 'swarm' : 'panel'} style=${{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          ${tab === 'swarm' ? html`<${SwarmPanel} roster=${roster} agents=${agents} tokens=${tokens} feed=${feed} project=${project} progress=${progress} previews=${previews} brain=${project.memory || {}} run=${run} />` : null}
          ${tab === 'scene' && current ? html`<${SceneTab} project=${project} scene=${current} patch=${(b) => patchScene(current.id, b)} busy=${running}
              onRun=${() => sendChat(current.id, 'Re-animate this scene with a fresh, more cinematic idea.')} onAdd=${addScene} onDelete=${delScene} onThumb=${thumb}
              onRenderScene=${renderSceneNow} />` : null}
          ${tab === 'layer' ? html`<${LayerTab} project=${project} scene=${current} selected=${selected} onOverride=${onOverride} onLayerPatch=${onLayerPatch} onLayerDelete=${deleteLayer} onLayerDuplicate=${duplicateLayer} onClear=${clearOverride}
              localTime=${current ? time - (current.start || 0) : 0} record=${recordKeys} onRecord=${setRecordKeys} />` : null}
          ${tab === 'look' ? html`<${LookTab} project=${project} scene=${current} time=${time} patch=${(b) => current && patchScene(current.id, b)} patchProject=${patchProject} />` : null}
          ${tab === 'code' && current ? html`<${CodeTab} project=${project} scene=${current} patch=${(b) => patchScene(current.id, b)} />` : null}
          ${tab === 'chat' && current ? html`<${ChatTab} project=${project} scene=${current} messages=${chat} onSend=${sendChat} llm=${health && health.llm} busy=${running && run.mode === 'scene'} />` : null}
          ${tab === 'qa' && current ? html`<${QATab} scene=${current} />` : null}
          ${!current && tab !== 'swarm' && tab !== 'layer' && tab !== 'look' ? html`<div class="empty"><${Icon} name="clapperboard" />No scene selected.</div>` : null}
        </div>
      </aside>
      <${Timeline} project=${project} time=${time} setTime=${(t) => { setTime(t); }} selectedScene=${current ? current.id : null} onSelectScene=${(sid) => { setSelScene(sid); if (tab === 'swarm') setTab('scene'); }}
        onSceneDuration=${(sid, d) => patchScene(sid, { duration: d })} onLayerTime=${(sid, lid, p) => onLayerPatch(sid, lid, p)} onSelectLayer=${(s) => { setSelected(s); setSelClip(null); setTab('layer'); }}
        selectedLayer=${selected} progress=${progress} previews=${previews} agents=${agents} agentNames=${agentNames} collapsed=${collapsed} onCollapse=${() => setCollapsed(!collapsed)}
        cursors=${cursors} onClipPatch=${onClipPatch} selectedClip=${selClip} onSelectClip=${(cid) => { setSelClip(cid); setSelected(null); setLeft('audio'); }}
        onCuePatch=${onCuePatch} selectedCue=${selCue} onSelectCue=${(c) => { setSelCue(c.id); setSelClip(null); }} onDropTimeline=${onDropTimeline}
        onContext=${(m) => { setPlaying(false); setTlMenu(m); }} />
      <${AgentCursors} cursors=${cursors} agents=${agents} agentNames=${agentNames} project=${project} />
      ${tlMenu ? html`<${ContextMenu} x=${tlMenu.x} y=${tlMenu.y} items=${tlItems(tlMenu)} onClose=${() => setTlMenu(null)} />` : null}
      ${textPrompt ? html`<${TextPromptDialog} ...${textPrompt} onClose=${() => setTextPrompt(null)} />` : null}
    </div>
  </div>`;
}
