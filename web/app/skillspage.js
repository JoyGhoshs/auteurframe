import { html, useState, useEffect, Icon, api, toast, md, Modal } from './lib.js';

const STAGE_ICON = { direct: 'clapperboard', research: 'globe', write: 'pen-line', design: 'palette', animate: 'sparkles', qa: 'scan-eye', edit: 'scissors', any: 'layers' };

export function SkillsPage({ initial }) {
  const [skills, setSkills] = useState([]);
  const [sel, setSel] = useState(initial || '');
  const [doc, setDoc] = useState(null);
  const [q, setQ] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [need, setNeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const load = () => api.get('/api/skills').then((d) => { setSkills(d.skills); if (!sel && d.skills[0]) setSel(d.skills[0].name); });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (sel) api.get('/api/skills/' + sel).then(setDoc).catch(() => setDoc(null)); }, [sel]);
  const shown = skills.filter((s) => !q || (s.name + s.description + s.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
  const groups = {};
  shown.forEach((s) => { (groups[s.stage] = groups[s.stage] || []).push(s); });
  const doImport = async () => {
    setBusy(true);
    try { const r = await api.post('/api/skills/import', { url: importUrl }); toast(`Imported ${r.name}`, 'ok'); setImportUrl(''); await load(); setSel(r.name); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const scout = async () => {
    setBusy(true);
    try { const r = await api.post('/api/skills/scout', { need }); toast(r.imported.length ? `Scout imported ${r.imported.join(', ')}` : 'Scout found nothing usable', r.imported.length ? 'ok' : 'err'); await load(); if (r.imported[0]) setSel(r.imported[0]); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const toggle = async (s) => { await api.post(`/api/skills/${s.name}/toggle`, { enabled: !s.enabled }); load(); };
  const saveSkill = async () => {
    try { const r = await api.post('/api/skills', { name: editor.name, text: editor.text }); toast('Skill saved', 'ok'); setEditor(null); await load(); setSel(r.name); } catch (e) { toast(e.message, 'err'); }
  };
  return html`<div class="skills-page">
    <div>
      <h1>Skills</h1><div class="muted" style=${{ marginBottom: '14px' }}>Universal SKILL.md files any agent can follow. They are injected by stage into every agent's context.</div>
      <div class="row" style=${{ marginBottom: '10px' }}><input class="input sm" placeholder="Filter skills" value=${q} onInput=${(e) => setQ(e.target.value)} />
        <a class="btn sm" href="/api/skills.zip" title="Download all"><${Icon} name="download" size=${13} /></a>
        <button class="btn sm" title="New skill" onClick=${() => setEditor({ name: '', text: '---\nname: my-skill\ndescription: When to use this skill\nstage: animate\ntags: [custom]\nversion: 1\n---\n\n# My skill\n\n' })}><${Icon} name="plus" size=${13} /></button></div>
      <div class="card" style=${{ padding: '6px', maxHeight: 'calc(100vh - 330px)', overflow: 'auto' }}>
        ${Object.entries(groups).map(([stage, list]) => html`<div class="section-title" style=${{ padding: '10px 10px 4px' }}><${Icon} name=${STAGE_ICON[stage] || 'layers'} size=${12} />${stage}<span class="chip">${list.length}</span></div>
          ${list.map((s) => html`<div class=${'skill-row ' + (sel === s.name ? 'on' : '')} onClick=${() => setSel(s.name)}>
            <div class="grow"><b>${s.name}</b>${s.origin === 'user' ? html` <span class="chip warn" style=${{ height: '17px' }}>imported</span>` : null}<p>${s.description}</p></div>
            <button class=${'switch ' + (s.enabled ? 'on' : '')} onClick=${(e) => { e.stopPropagation(); toggle(s); }}></button></div>`)}`)}
      </div>
      <div class="card" style=${{ padding: '12px', marginTop: '12px' }}>
        <b style=${{ fontSize: '12.5px' }}>Pull a skill from the web</b>
        <div class="row" style=${{ marginTop: '8px' }}><input class="input sm" placeholder="GitHub repo, folder or raw SKILL.md URL" value=${importUrl} onInput=${(e) => setImportUrl(e.target.value)} />
          <button class="btn sm primary" disabled=${busy || !importUrl} onClick=${doImport}>Import</button></div>
        <div class="row" style=${{ marginTop: '8px' }}><input class="input sm" placeholder="Or describe a need: e.g. anime speed lines" value=${need} onInput=${(e) => setNeed(e.target.value)} />
          <button class="btn sm" disabled=${busy || !need} onClick=${scout}>${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="radar" size=${12} />`}Scout</button></div>
        <div class="muted" style=${{ fontSize: '11px', marginTop: '6px' }}>Imported text is sanitised and treated as reference data, never as instructions that override the ruleset.</div>
      </div>
    </div>
    <div class="card" style=${{ padding: '22px 28px', minHeight: '60vh' }}>
      ${doc ? html`<div class="row" style=${{ marginBottom: '6px' }}><span class="chip brand"><${Icon} name=${STAGE_ICON[doc.stage] || 'layers'} size=${12} />${doc.stage}</span>${doc.tags.map((t) => html`<span class="chip">${t}</span>`)}<span class="spacer"></span>
          <button class="btn sm" onClick=${() => setEditor({ name: doc.name, text: doc.raw })}><${Icon} name="pencil" size=${12} />Edit copy</button></div>
        <div class="md" dangerouslySetInnerHTML=${{ __html: md(doc.body) }}></div>` : html`<div class="empty">Select a skill</div>`}
    </div>
    ${editor ? html`<${Modal} title="Skill editor" icon="book-open-text" width="min(860px, 94vw)" onClose=${() => setEditor(null)} foot=${html`<button class="btn" onClick=${() => setEditor(null)}>Cancel</button><button class="btn primary" onClick=${saveSkill}>Save skill</button>`}>
      <div class="col"><input class="input" placeholder="skill-name" value=${editor.name} onInput=${(e) => setEditor({ ...editor, name: e.target.value })} />
      <textarea class="code-area" style=${{ minHeight: '420px' }} value=${editor.text} onInput=${(e) => setEditor({ ...editor, text: e.target.value })}></textarea></div></${Modal}>` : null}
  </div>`;
}
