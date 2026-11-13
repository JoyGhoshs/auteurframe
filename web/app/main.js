import { html, render, useState, useEffect, Icon, Toasts, Modal, api, navigate } from './lib.js';
import { Dashboard } from './dashboard.js';
import { Wizard } from './wizard.js';
import { Studio } from './studio.js';
import { Settings } from './settings.js';
import { SkillsPage } from './skillspage.js';
import { TemplatesPage } from './templates.js';
import { EditWizard } from './editwizard.js';

function parseRoute() {
  const h = location.hash.replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) return { name: 'studio', id: parts[1] };
  if (parts[0] === 'new' && parts[1] === 'edit') return { name: 'edit-new' };
  if (parts[0] === 'new') return { name: 'new', preset: parts[1] || '' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'templates') return { name: 'templates', id: parts[1] || '' };
  if (parts[0] === 'skills') return { name: 'skills', skill: parts[1] || '' };
  return { name: 'home' };
}

export function BrandMark({ size }) {
  const s = size || 30;
  return html`<div class="brand-mark" style=${{ width: s + 'px', height: s + 'px' }}>
    <svg width=${s * 0.72} height=${s * 0.72} viewBox="0 0 32 32" role="img" aria-label="AuteurFrame"><path d="M16 3.2 26.6 28.8H21.9L16 14.4 10.1 28.8H5.4Z" fill="#F5F7FA"/><path d="M4.6 18.1h22.8v3.6H4.6Z" fill="#4D74FF"/></svg>
  </div>`;
}

function UpdateChips({ updates }) {
  if (!updates) return null;
  return html`${updates.update_available ? html`<a class="chip brand" href=${updates.download} target="_blank" rel="noopener" title=${(updates.notes || []).join('\n')}><${Icon} name="arrow-up-circle" size=${12} />AuteurFrame ${updates.latest} available</a>` : null}
    ${updates.pending ? html`<span class="chip info" style=${{ cursor: 'pointer' }} onClick=${() => navigate('/templates')}><${Icon} name="layout-template" size=${12} />${updates.pending} new template${updates.pending > 1 ? 's' : ''}</span>` : null}`;
}

function Topbar({ route, health, updates, children }) {
  const link = (href, label, icon, on) => html`<a href=${'#' + href} class=${on ? 'on' : ''}><${Icon} name=${icon} />${label}</a>`;
  return html`<header class="topbar">
    <div class="brand" onClick=${() => navigate('/')}><${BrandMark} /><div>Auteur<span class="brand-frame">Frame</span><small>Motion Studio</small></div></div>
    <nav class="nav">
      ${link('/', 'Productions', 'layout-dashboard', route.name === 'home')}
      ${link('/new', 'New', 'sparkles', route.name === 'new')}
      ${link('/templates', 'Templates', 'layout-template', route.name === 'templates')}
      ${link('/skills', 'Skills', 'book-open-text', route.name === 'skills')}
      ${link('/settings', 'Models', 'plug-zap', route.name === 'settings')}
    </nav>
    <div class="spacer"></div>
    ${children}
    <div class="row" title="Render service and model status">
      <${UpdateChips} updates=${updates} />
      <span class=${'chip ' + (health && health.renderer ? 'ok' : 'warn')}><span class=${'dot ' + (health && health.renderer ? 'live' : '')}></span>${health && health.renderer ? `Render farm · ${health.renderer.max} nodes` : 'Render farm starting'}</span>
      <span class=${'chip ' + (health && health.llm ? 'brand' : '')} style=${{ cursor: 'pointer' }} onClick=${() => navigate('/settings')}>
        <${Icon} name=${health && health.llm ? 'brain-circuit' : 'brain'} size=${12} />${health && health.llm ? 'Agent swarm online' : 'House director (no model)'}</span>
    </div>
  </header>`;
}

function FirstLaunchNotice({ legal, onDone }) {
  const [busy, setBusy] = useState(false);
  const done = async () => {
    if (busy) return;
    setBusy(true);
    try { await api.post('/api/legal/accept', {}); } catch (e) { }
    onDone();
  };
  const repo = legal.repository || 'https://github.com/joyghoshs/auteurframe';
  const link = (label, path) => html`<a href=${repo + path} target="_blank" rel="noopener">${label}</a>`;
  return html`<${Modal} title="Welcome to AuteurFrame" icon="sparkles" onClose=${done} width="min(620px, 92vw)"
    foot=${html`<span class="muted grow" style=${{ fontSize: '12px' }}>Shown once. You can read this again under Models, About AuteurFrame.</span>
      <button class="btn brand" disabled=${busy} onClick=${done}>I understand, continue</button>`}>
    <div style=${{ fontSize: '13px', lineHeight: 1.65 }}>
      <p style=${{ marginTop: 0 }}><b>AuteurFrame by Joy Ghosh</b> · version ${legal.version}<br />${legal.copyright || 'Copyright (c) 2026 Joy Ghosh'}.</p>
      <p>AuteurFrame is free software under the GNU Affero General Public License v3 with ${link('additional terms', '/blob/main/LICENSE-EXCEPTIONS.md')}.
        You may use it for any purpose, including paid work. If you share a modified version or run one as an online service, you must offer its full source code under the same license.
        ${' '}${link('Commercial licenses', '/blob/main/COMMERCIAL.md')} are available if you cannot meet those conditions.</p>
      <p><b>No warranty.</b> AuteurFrame comes as is, without any warranty, to the extent permitted by law. You are responsible for the films you make,
        for checking the licenses of media you collect, and for the terms of the AI and voice services you connect.</p>
      <p style=${{ marginBottom: 0 }}>Modified versions must keep the "AuteurFrame by Joy Ghosh" notice.
        ${' '}${link('Full license', '/blob/main/LICENSE')} · ${link('Source code', '')} · ${link('Third-party notices', '/blob/main/THIRD_PARTY_NOTICES.md')}</p>
    </div>
  </${Modal}>`;
}

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [health, setHealth] = useState(null);
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    let alive = true;
    const tick = () => api.get('/api/health').then((h) => alive && setHealth(h)).catch(() => alive && setHealth(null));
    tick();
    const t = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const [legal, setLegal] = useState(null);
  useEffect(() => { api.get('/api/legal').then(setLegal).catch(() => null); }, []);
  const [updates, setUpdates] = useState(null);
  useEffect(() => {
    const load = () => api.get('/api/updates').then(setUpdates).catch(() => null);
    load();
    window.addEventListener('auteurframe:updates', load);
    return () => window.removeEventListener('auteurframe:updates', load);
  }, []);
  let page;
  if (route.name === 'studio') page = html`<${Studio} id=${route.id} key=${route.id} health=${health} />`;
  else if (route.name === 'new') page = html`<div class="page"><${Wizard} preset=${route.preset} health=${health} /></div>`;
  else if (route.name === 'settings') page = html`<div class="page"><${Settings} health=${health} /></div>`;
  else if (route.name === 'skills') page = html`<div class="page"><${SkillsPage} initial=${route.skill} /></div>`;
  else if (route.name === 'edit-new') page = html`<div class="page"><${EditWizard} health=${health} /></div>`;
  else if (route.name === 'templates') page = html`<div class="page"><${TemplatesPage} id=${route.id} key=${route.id} /></div>`;
  else page = html`<div class="page"><${Dashboard} health=${health} /></div>`;
  return html`<div class="shell">
    ${route.name === 'studio' ? null : html`<${Topbar} route=${route} health=${health} updates=${updates} />`}
    ${route.name === 'studio' ? html`<div style=${{ gridRow: '1 / 3', minHeight: 0 }}>${page}</div>` : page}
    ${legal && legal.show ? html`<${FirstLaunchNotice} legal=${legal} onDone=${() => setLegal({ ...legal, show: false })} />` : null}
    <${Toasts} />
  </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
