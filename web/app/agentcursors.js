import { html, useState, useEffect, Icon, agentColor } from './lib.js';

const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TRACK_OF = { sync: 'captions', captions: 'captions', cutter: 'audio', sound: 'audio', sfx: 'audio', zoom: 'layers', gfx: 'layers', grade: 'scenes' };

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function visibleBox() {
  const body = document.querySelector('.timeline .tl-body');
  return body ? body.getBoundingClientRect() : null;
}

function rowY(track) {
  const row = document.querySelector(`.timeline .tl-track[data-track="${track}"]`);
  if (!row) return null;
  const r = row.getBoundingClientRect();
  return r.height ? r.top + r.height * 0.55 : null;
}

function clipRect(index) {
  const el = document.querySelector(`.timeline [data-agent-target="scene-${index}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width ? r : null;
}

function spot(id, c, project) {
  const box = visibleBox();
  if (!box) return null;
  const scenes = (project && project.scenes) || [];
  const track = c.track || TRACK_OF[id] || (c.t != null ? 'audio' : 'scenes');
  let x = null, y = null;
  let idx = c.scene;
  if (idx == null && c.t != null && scenes.length) {
    const s = scenes.find((sc) => c.t >= sc.start && c.t < sc.start + sc.duration) || scenes[scenes.length - 1];
    idx = s.index;
    const r = clipRect(idx);
    if (r) x = r.left + r.width * Math.max(0, Math.min(1, (c.t - s.start) / Math.max(0.01, s.duration)));
  } else if (idx != null) {
    const r = clipRect(idx);
    if (r) x = r.left + r.width * (0.18 + (hash(id) % 64) / 100);
  }
  if (x == null) {
    const r = clipRect(0);
    const last = clipRect(Math.max(0, scenes.length - 1));
    if (r && last) x = r.left + (last.right - r.left) * Math.max(0.05, Math.min(0.95, c.x ?? 0.5));
    else x = box.left + box.width * (c.x ?? 0.5);
  }
  y = rowY(idx != null && track === 'scenes' ? 'scenes' : track) ?? rowY('scenes');
  if (y == null) return null;
  y += ((hash(id) % 5) - 2) * 3;
  x = Math.max(box.left + 12, Math.min(box.right - 24, x));
  return { x, y };
}

export function AgentCursors({ cursors, agents, agentNames, project }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('resize', on);
    const body = document.querySelector('.timeline .tl-body');
    if (body) body.addEventListener('scroll', on, { passive: true });
    const id = setInterval(on, 2500);
    return () => { window.removeEventListener('resize', on); if (body) body.removeEventListener('scroll', on); clearInterval(id); };
  }, []);
  const now = Date.now();
  const live = Object.entries(cursors || {}).filter(([id, c]) => c.panel && c.panel !== 'stage' && agents[id] && agents[id].state === 'working' && now - c.at < 25000);
  return html`<div class="agent-cursors" aria-hidden="true">${live.map(([id, c]) => {
    const p = spot(id, c, project);
    if (!p) return null;
    const color = agentColor(id);
    const dur = reduce ? 0 : 0.8;
    const flip = p.x > window.innerWidth - 260;
    const phase = (hash(id) % 10) / 10;
    return html`<div class="ac-x" key=${id} style=${{ transform: `translateX(${p.x}px)`, transition: `transform ${dur}s cubic-bezier(.3,.7,.2,1)` }}>
      <div class="ac-y" style=${{ transform: `translateY(${p.y}px)`, transition: `transform ${dur}s cubic-bezier(.55,.05,.25,1)` }}>
        <div class=${'ac-work' + (reduce ? '' : ' on')} style=${{ animationDelay: `${dur + phase}s` }}>
          <span class="ac-ripple" key=${c.at} style=${{ borderColor: color, animationDelay: `${dur}s` }}></span>
          <span class="ac-pulse" style=${{ borderColor: color, animationDelay: `${dur + 1.1 + phase}s` }}></span>
          <${Icon} name="mouse-pointer-2" size=${20} style=${{ color, fill: color }} />
        </div>
        <span class=${'ac-who' + (flip ? ' flip' : '')} style=${{ background: color }}>${agentNames[id] || id}<i>${c.label || (agents[id] && agents[id].detail) || ''}</i><b class="ac-dots"><span></span><span></span><span></span></b></span>
      </div></div>`;
  })}</div>`;
}
