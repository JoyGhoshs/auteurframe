import { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from '/vendor/preact.js';

export { html, render, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect };

export function Icon({ name, size, cls, style }) {
  const inner = (window.AU_ICONS || {})[name] || (window.AU_ICONS || {})['circle'] || '';
  const s = size || 16;
  return html`<span class=${'ic ' + (cls || '')} style=${Object.assign({ width: s + 'px', height: s + 'px' }, style || {})}
    dangerouslySetInnerHTML=${{ __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>` }}></span>`;
}

async function request(method, url, body, isForm) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.detail) ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : res.statusText;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b === undefined ? {} : b),
  patch: (u, b) => request('PATCH', u, b),
  put: (u, b) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, file, extra) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(extra || {}).forEach(([k, v]) => fd.append(k, v));
    return request('POST', u, fd, true);
  }
};

const toastListeners = new Set();
export function toast(message, kind) {
  const item = { id: Math.random(), message: String(message), kind: kind || 'info' };
  toastListeners.forEach((fn) => fn(item));
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (item) => {
      setItems((list) => [...list, item].slice(-4));
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== item.id)), item.kind === 'err' ? 7000 : 3600);
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  return html`<div class="toast-wrap">${items.map((t) => html`<div class=${'toast ' + (t.kind === 'err' ? 'err' : '')} key=${t.id}>
    <${Icon} name=${t.kind === 'err' ? 'circle-alert' : t.kind === 'ok' ? 'circle-check' : 'info'} /><span>${t.message}</span></div>`)}</div>`;
}

export function Modal({ title, icon, onClose, children, foot, width }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="modal-back" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal" style=${width ? { width } : null}>
      <div class="modal-head">${icon ? html`<${Icon} name=${icon} size=${18} />` : null}<span class="grow">${title}</span>
        <button class="btn ghost icon sm" onClick=${onClose}><${Icon} name="x" /></button></div>
      <div class="modal-body">${children}</div>
      ${foot ? html`<div class="modal-foot">${foot}</div>` : null}
    </div></div>`;
}

export function useEvents(pid, onEvent) {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  useEffect(() => {
    if (!pid) return;
    let es = null;
    let closed = false;
    let last = 0;
    let retry = null;
    const open = () => {
      es = new EventSource(`/api/projects/${pid}/events?since=${last}`);
      es.onmessage = (m) => {
        try {
          const ev = JSON.parse(m.data);
          last = Math.max(last, ev.seq || 0);
          ref.current(ev);
        } catch (e) { }
      };
      es.onerror = () => {
        es.close();
        if (!closed) retry = setTimeout(open, 1500);
      };
    };
    open();
    return () => { closed = true; clearTimeout(retry); if (es) es.close(); };
  }, [pid]);
}

export function fmtTime(t, fps) {
  const s = Math.max(0, t || 0);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const fr = Math.floor((s - Math.floor(s)) * (fps || 30));
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}

export function fmtDur(t) {
  if (!t && t !== 0) return '';
  return t >= 60 ? `${Math.floor(t / 60)}m ${Math.round(t % 60)}s` : `${(Math.round(t * 10) / 10)}s`;
}

export function ago(ts) {
  const d = Date.now() / 1000 - ts;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

export const AGENT_COLORS = {
  producer: '#0EA5E9', research: '#10B981', director: '#F59E0B', art: '#EC4899', 'animator-1': '#5B3DF5', 'animator-2': '#8B5CF6',
  'animator-3': '#6366F1', 'animator-4': '#A855F7', critic: '#EF4444', 'render-1': '#14B8A6', 'render-2': '#0D9488', 'render-3': '#0F766E', editor: '#111827',
  cutter: '#F43F5E', scout: '#84CC16', narrator: '#F97316', sound: '#0EA5E9', captions: '#F59E0B', zoom: '#8B5CF6', gfx: '#EC4899', broll: '#10B981', sfx: '#0EA5E9', grade: '#F97316', sync: '#06B6D4'
};
export const agentColor = (id) => AGENT_COLORS[id] || '#5B3DF5';

export function navigate(path) { location.hash = path; }

export function md(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = [];
  let src = String(text || '').replace(/```[a-z]*\n([\s\S]*?)```/g, (_, code) => { blocks.push(`<pre><code>${esc(code)}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  const lines = esc(src).split('\n');
  const out = [];
  let list = null, table = null, para = null;
  const inline = (s) => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*]+)\*/g, '$1<i>$2</i>').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const flush = () => {
    if (para) { out.push(`<p>${inline(para.join(' '))}</p>`); para = null; }
    if (list) { out.push(`<${list.t}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.t}>`); list = null; }
    if (table) { out.push(`<table>${table.join('')}</table>`); table = null; }
  };
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s:\-|]+\|\s*$/.test(line)) continue;
      const cells = line.trim().slice(1, -1).split('|').map((c) => inline(c.trim()));
      if (!table) { flush(); table = [`<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`]; } else table.push(`<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    const oli = line.match(/^\s*\d+\.\s+(.*)/);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (li || oli) {
      const t = li ? 'ul' : 'ol';
      if (!list || list.t !== t) { flush(); list = { t, items: [] }; }
      list.items.push((li || oli)[1]);
    } else if (!line.trim()) flush();
    else if (/^\u0000\d+\u0000$/.test(line.trim())) { flush(); out.push(line.trim()); }
    else if (list && /^\s+\S/.test(line)) list.items[list.items.length - 1] += ' ' + line.trim();
    else { if (list || table) flush(); para = para || []; para.push(line.trim()); }
  }
  flush();
  return out.join('\n').replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
}

export const ARCH_ICON = {
  'kinetic-title': 'type', 'word-stack': 'list-collapse', 'big-number': 'hash', 'bar-race': 'chart-bar-big', 'line-chart': 'chart-spline', donut: 'chart-pie',
  versus: 'columns-2', timeline: 'git-commit-horizontal', quote: 'quote', 'list-reveal': 'list-ordered', 'process-flow': 'workflow', 'icon-grid': 'layout-grid',
  'doodle-explain': 'pencil-line', equation: 'sigma', 'image-focus': 'image', 'scale-zoom': 'zoom-in', 'map-pins': 'map-pinned', 'ui-mockup': 'app-window',
  'lower-third': 'panel-bottom', 'end-card': 'flag', 'phone-showcase': 'smartphone', 'ui-cascade': 'app-window', 'code-typing': 'code-xml', 'shape-morph': 'shapes', 'particles-type': 'sparkles',
  'photo-stack': 'images', 'music-visualizer': 'audio-waveform', 'paper-cut': 'scissors', 'vox-board': 'newspaper', 'three-hero': 'box', 'logo-reveal': 'badge', 'kinetic-beat': 'drum', 'diagram-build': 'network', 'mascot-talk': 'smile'
};
