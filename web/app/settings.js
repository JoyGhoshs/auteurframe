import { html, useState, useEffect, useRef, Icon, api, toast, Modal } from './lib.js';

const LOGO = { anthropic: ['#D97757', 'A'], openai: ['#111', 'O'], google: ['#4285F4', 'G'], openrouter: ['#6467F2', 'R'], groq: ['#F55036', 'Q'], deepseek: ['#4D6BFE', 'D'], mistral: ['#FA520F', 'M'], xai: ['#000', 'X'], together: ['#0F6FFF', 'T'], ollama: ['#333', 'L'], lmstudio: ['#7C3AED', 'S'], custom: ['#64748B', 'C'] };
const ROLE_INFO = { director: 'Plans the screenplay and timing', writer: 'Fits narration to subtitles', art: 'Extends the style bible', animator: 'Writes HTML/GSAP scene code (use your strongest coder)', critic: 'Reviews frames and probe reports (vision helps)', research: 'Plans queries and extracts facts (a fast model is fine)' };

function ConnEditor({ initial, presets, onSave, onClose }) {
  const [c, setC] = useState(initial || { provider: 'anthropic', label: '', base_url: '', api_key: '', model: '' });
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const preset = presets[c.provider] || presets.custom;
  useEffect(() => { setModels(preset.models || []); }, [c.provider]);
  const fetchModels = async () => {
    setLoading(true);
    try { const r = await api.post('/api/settings/models', { provider: c.provider, base_url: c.base_url || preset.base_url, api_key: c.api_key, id: c.id }); setModels(r.models); toast(`${r.models.length} models`, 'ok'); } catch (e) { toast(e.message, 'err'); }
    setLoading(false);
  };
  return html`<${Modal} title=${initial ? 'Edit connection' : 'Connect a model'} icon="plug-zap" onClose=${onClose}
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${() => onSave(c)}>Save connection</button>`}>
    <div class="col" style=${{ gap: '12px' }}>
      <div class="field"><label class="label">Provider</label>
        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>${Object.entries(presets).map(([k, p]) => html`<button class=${'btn sm ' + (c.provider === k ? 'on' : '')} onClick=${() => setC({ ...c, provider: k, kind: undefined, base_url: '', model: '' })}>${p.label.replace(' (local)', '')}</button>`)}</div></div>
      <div class="field"><label class="label">Base URL</label><input class="input" placeholder=${preset.base_url || 'https://your-endpoint/v1'} value=${c.base_url} onInput=${(e) => setC({ ...c, base_url: e.target.value })} /></div>
      <div class="field"><label class="label">API key ${['ollama', 'lmstudio'].includes(c.provider) ? '(not needed locally)' : ''}</label><input class="input mono" type="password" placeholder="sk-…" value=${c.api_key} onInput=${(e) => setC({ ...c, api_key: e.target.value })} /></div>
      <div class="field"><label class="label">Model</label><div class="row"><input class="input" list="model-list" placeholder="model id" value=${c.model} onInput=${(e) => setC({ ...c, model: e.target.value })} />
        <button class="btn" onClick=${fetchModels}>${loading ? html`<${Icon} name="loader-circle" cls="spin" />` : html`<${Icon} name="list" />`}Fetch</button></div>
        <datalist id="model-list">${models.map((m) => html`<option value=${m} />`)}</datalist>
        <div class="row" style=${{ flexWrap: 'wrap', marginTop: '6px', gap: '4px' }}>${models.slice(0, 8).map((m) => html`<button class="btn sm ghost" onClick=${() => setC({ ...c, model: m })}>${m}</button>`)}</div></div>
      <div class="row"><button class=${'switch ' + ((c.vision ?? preset.vision) ? 'on' : '')} onClick=${() => setC({ ...c, vision: !(c.vision ?? preset.vision) })}></button><span>Model accepts images (lets the critic see frames)</span></div>
      <div class="field"><label class="label">Rate limits</label>
        <div class="row"><button class=${'switch ' + (c.rate_limit !== false ? 'on' : '')} onClick=${() => setC({ ...c, rate_limit: c.rate_limit === false })}></button><span>${c.rate_limit !== false ? 'Rate limiter on' : 'Rate limiter off (requests go out as fast as the agents ask)'}</span></div>
        <div class="row" style=${{ gap: '8px', opacity: c.rate_limit === false ? 0.45 : 1, pointerEvents: c.rate_limit === false ? 'none' : 'auto' }}>
          <input class="input sm" type="number" min="1" placeholder=${/:free$|\/free$/.test(c.model || '') ? '12 (free default)' : '120'} value=${c.rpm || ''} disabled=${c.rate_limit === false} style=${{ width: '140px' }} onInput=${(e) => setC({ ...c, rpm: e.target.value ? +e.target.value : undefined })} /><span class="muted" style=${{ fontSize: '12px' }}>requests / min</span>
          <input class="input sm" type="number" min="1" placeholder=${/:free$|\/free$/.test(c.model || '') ? '1' : '6'} value=${c.concurrency || ''} disabled=${c.rate_limit === false} style=${{ width: '90px' }} onInput=${(e) => setC({ ...c, concurrency: e.target.value ? +e.target.value : undefined })} /><span class="muted" style=${{ fontSize: '12px' }}>at once</span></div>
        <span class="muted" style=${{ fontSize: '11px' }}>All agents share these limits. Free models default to 12 per minute, one at a time. When the provider answers 429 the whole connection pauses for the time it asks, then speeds up again. With the limiter off a 429 still pauses the connection briefly.</span></div>
      <div class="field"><label class="label">Thinking mode</label>
        <div class="seg">${[['auto', 'Auto'], ['off', 'Off'], ['on', 'On']].map(([v, l]) => html`<button class=${(c.thinking || 'auto') === v ? 'on' : ''} onClick=${() => setC({ ...c, thinking: v })}>${l}</button>`)}</div>
        <span class="muted" style=${{ fontSize: '11px' }}>Auto turns thinking off for DeepSeek models so the whole token budget goes to scene code. Use On only for models that need it.</span></div>
      <div class="muted" style=${{ fontSize: '11.5px' }}>Keys stay on this machine in data/settings.json and are only sent to the provider you choose.</div>
    </div></${Modal}>`;
}

export function Settings({ health }) {
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState(null);
  const [testing, setTesting] = useState({});
  const load = () => api.get('/api/settings').then(setS);
  useEffect(() => { load(); }, []);
  if (!s) return html`<div class="settings muted">Loading…</div>`;
  const save = async (conns, extra) => { try { setS(await api.post('/api/settings', { connections: conns, ...(extra || {}) })); toast('Saved', 'ok'); } catch (e) { toast(e.message, 'err'); } };
  const saveConn = (c) => {
    const list = s.connections.filter((x) => x.id !== c.id);
    save(c.id ? s.connections.map((x) => (x.id === c.id ? c : x)) : [...list, c]);
    setEdit(null);
  };
  const test = async (cid) => {
    setTesting((t) => ({ ...t, [cid]: 'busy' }));
    const r = await api.post('/api/settings/test', { connection: cid });
    setTesting((t) => ({ ...t, [cid]: r }));
  };
  const route = (role, key, value) => api.post('/api/settings', { routing: { ...s.routing, [role]: { ...(s.routing[role] || {}), [key]: value } } }).then(setS);
  return html`<div class="settings">
    <div class="row" style=${{ alignItems: 'flex-end', marginBottom: '20px' }}>
      <div class="grow"><h1>Models</h1><div class="muted">Connect any LLM. The swarm is model independent and bound by the platform ruleset. With no model, the house director still produces complete films.</div></div>
      <button class="btn brand" onClick=${() => setEdit({})}><${Icon} name="plus" />Connect model</button>
    </div>
    <div class="card" style=${{ marginBottom: '18px' }}>
      ${s.connections.length ? s.connections.map((c) => {
    const [col, ch] = LOGO[c.provider] || LOGO.custom;
    const t = testing[c.id];
    return html`<div class="conn"><div class="conn-logo" style=${{ background: col }}>${ch}</div>
          <div><b>${c.label || (s.presets[c.provider] || {}).label || c.provider}</b> <span class="chip mono">${c.model}</span> <span class=${'chip' + (c.rate_limit === false ? ' err' : '')}>${c.rate_limit === false ? 'rate limiter off' : `${c.rpm || (/:free$|\/free$/.test(c.model || '') ? 12 : 120)}/min`}</span>
            <div class="muted mono" style=${{ fontSize: '11px', marginTop: '3px' }}>${c.base_url} · key ${c.has_key ? c.api_key : 'none'}</div>
            ${t && t !== 'busy' ? html`<div class=${t.ok ? 'chip ok' : 'chip err'} style=${{ marginTop: '6px', height: 'auto', padding: '3px 8px', whiteSpace: 'normal' }}>${t.ok ? `Replied “${t.reply}” in ${t.ms} ms` : t.error}</div>` : null}</div>
          <div class="row"><button class="btn sm" onClick=${() => test(c.id)}>${t === 'busy' ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="activity" size=${12} />`}Test</button>
            <button class="btn sm" onClick=${() => setEdit(c)}>Edit</button>
            <button class="btn sm danger" onClick=${() => save(s.connections.filter((x) => x.id !== c.id))}><${Icon} name="trash-2" size=${12} /></button></div></div>`;
  }) : html`<div class="empty" style=${{ padding: '36px' }}><${Icon} name="plug-zap" /><b style=${{ color: 'var(--ink)' }}>No model connected</b>Films are produced by the deterministic house director. Connect Claude, GPT, Gemini, OpenRouter, or a local Ollama model to unlock agent-written compositions, research synthesis and the vision critic.</div>`}
    </div>
    ${s.connections.length ? html`<div class="card" style=${{ padding: '16px 18px', marginBottom: '18px' }}>
      <div class="row" style=${{ marginBottom: '6px' }}><b>Role routing</b><span class="muted" style=${{ fontSize: '12px' }}>Each agent can use a different model. Unrouted roles use the first connection, with the rest as fallbacks.</span></div>
      ${s.roles.map((role) => html`<div class="route"><div><b style=${{ textTransform: 'capitalize' }}>${role}</b><div class="muted" style=${{ fontSize: '11px' }}>${ROLE_INFO[role]}</div></div>
        <select class="select sm" value=${(s.routing[role] || {}).connection || ''} onChange=${(e) => route(role, 'connection', e.target.value)}><option value="">Default chain</option>${s.connections.map((c) => html`<option value=${c.id}>${c.label || c.provider} · ${c.model}</option>`)}</select>
        <input class="input sm" placeholder="model override (optional)" value=${(s.routing[role] || {}).model || ''} onChange=${(e) => route(role, 'model', e.target.value)} /></div>`)}
    </div>` : null}
    <div class="card" style=${{ padding: '16px 18px' }}>
      <b>Generation</b>
      <div class="kv" style=${{ gridTemplateColumns: '180px 1fr', marginTop: '10px' }}>
        <span>Temperature ${s.temperature}</span><input type="range" min="0" max="1.2" step="0.05" value=${s.temperature} onChange=${(e) => api.post('/api/settings', { temperature: parseFloat(e.target.value) }).then(setS)} />
        <span>Max output tokens</span><input class="input sm" style=${{ width: '120px' }} value=${s.max_tokens} onChange=${(e) => api.post('/api/settings', { max_tokens: parseInt(e.target.value, 10) || 8000 }).then(setS)} />
        <span>Vision critic</span><button class=${'switch ' + (s.vision_critic ? 'on' : '')} onClick=${() => api.post('/api/settings', { vision_critic: !s.vision_critic }).then(setS)}></button>
        <span>Render farm</span><span>${health && health.renderer ? `${health.renderer.chrome} · ${health.renderer.max} parallel Chrome nodes` : 'starting'}</span>
      </div>
    </div>
    <div class="card" style=${{ padding: '16px 18px', marginTop: '18px' }}>
      <div class="row"><b>Stock media</b><span class="muted" style=${{ fontSize: '12px' }}>Openverse and Wikimedia Commons work without keys. Add keys for more photos and stock video.</span></div>
      <div class="kv" style=${{ gridTemplateColumns: '180px 1fr', marginTop: '10px' }}>
        ${[['pexels', 'Pexels API key', 'https://www.pexels.com/api/'], ['pixabay', 'Pixabay API key', 'https://pixabay.com/api/docs/'], ['unsplash', 'Unsplash access key', 'https://unsplash.com/developers']].map(([k, label, link]) => html`
          <span>${label}</span><div class="row"><input class="input sm mono" type="password" placeholder=${(s.stock || {})[k] || 'not set'} onChange=${(e) => api.post('/api/settings', { stock: { [k]: e.target.value } }).then((r) => { setS(r); toast('Saved', 'ok'); })} />
            <a class="btn ghost sm" href=${link} target="_blank" rel="noopener"><${Icon} name="external-link" size=${12} /></a></div>`)}
      </div>
    </div>
    <${VoiceGenCard} s=${s} setS=${setS} />
    <${UpdatesCard} />
    <${LegalCard} health=${health} />
    ${edit ? html`<${ConnEditor} initial=${edit.id ? edit : null} presets=${s.presets} onSave=${saveConn} onClose=${() => setEdit(null)} />` : null}
  </div>`;
}

const REPO = 'https://github.com/joyghoshs/auteurframe';

function LegalCard({ health }) {
  const links = [['Source code', REPO, 'code-xml'], ['License', REPO + '/blob/main/LICENSE', 'scale'], ['Additional terms', REPO + '/blob/main/LICENSE-EXCEPTIONS.md', 'file-text'],
    ['Commercial license', REPO + '/blob/main/COMMERCIAL.md', 'briefcase'], ['Third-party notices', REPO + '/blob/main/THIRD_PARTY_NOTICES.md', 'library']];
  return html`<div class="card" id="legal" style=${{ padding: '16px 18px', marginTop: '18px' }}>
    <div class="row"><b>About AuteurFrame</b><span class="chip mono">${health && health.version ? 'v' + health.version : ''}</span></div>
    <div style=${{ fontSize: '12.5px', lineHeight: 1.65, marginTop: '8px' }}>
      <b>AuteurFrame by Abdur Rahman Maheer</b><br />
      Copyright (c) 2026 Abdur Rahman Maheer. AuteurFrame is free software: you can redistribute it and modify it under the terms of the
      GNU Affero General Public License version 3 with the additional permission and terms in LICENSE-EXCEPTIONS.md.
      It comes with absolutely no warranty. Commercial licenses are available from the author.
    </div>
    <div class="row" style=${{ flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>${links.map(([label, href, icon]) => html`<a class="btn ghost sm" href=${href} target="_blank" rel="noopener"><${Icon} name=${icon} size=${12} />${label}</a>`)}</div>
  </div>`;
}

function UpdatesCard() {
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { api.get('/api/updates').then(setU).catch(() => null); }, []);
  const checkNow = async () => { setBusy('check'); try { setU(await api.get('/api/updates?force=true')); } catch (e) { toast(e.message, 'err'); } setBusy(''); };
  const toggle = async () => { try { setU(await api.post('/api/updates/prefs', { check: !(u && u.check) })); } catch (e) { toast(e.message, 'err'); } };
  const pull = async () => {
    setBusy('pull');
    try {
      const r = await api.post('/api/updates/templates', {});
      setU(r.summary);
      toast(r.installed.length ? `${r.installed.length} template${r.installed.length > 1 ? 's' : ''} installed` : 'Templates are up to date', 'ok');
      if (r.failed.length) toast(`${r.failed.length} template${r.failed.length > 1 ? 's' : ''} failed: ${r.failed[0].error}`, 'err');
    } catch (e) { toast(e.message, 'err'); }
    setBusy('');
  };
  if (!u) return null;
  return html`<div class="card" style=${{ padding: '16px 18px', marginTop: '18px' }}>
    <div class="row"><b>Updates</b><span class="muted" style=${{ fontSize: '12px' }}>AuteurFrame reads release.json from the project repository to announce new versions and new templates. Nothing else is sent.</span></div>
    <div class="kv" style=${{ gridTemplateColumns: '180px 1fr', marginTop: '10px' }}>
      <span>Installed version</span><span class="mono">${u.current}</span>
      <span>Latest version</span><div class="row"><span class="mono">${u.checked_at ? u.latest : 'not checked yet'}</span>
        ${u.update_available ? html`<a class="btn brand sm" href=${u.download} target="_blank" rel="noopener"><${Icon} name="download" size=${12} />Get ${u.latest}</a>` : null}
        <button class="btn sm" onClick=${checkNow}>${busy === 'check' ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="refresh-cw" size=${12} />`}Check now</button></div>
      <span>Check automatically</span><div class="row"><button class=${'switch ' + (u.check ? 'on' : '')} onClick=${toggle}></button><span class="muted" style=${{ fontSize: '12px' }}>At most every six hours</span></div>
      <span>Template feed</span><div class="row"><span>${u.templates.length ? `${u.templates.length} published · ${u.pending} new or updated` : 'No templates listed yet'}</span>
        ${u.pending ? html`<button class="btn sm" onClick=${pull}>${busy === 'pull' ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="download" size=${12} />`}Install</button>` : null}</div>
      ${u.notes && u.notes.length && u.update_available ? html`<span>What is new</span><ul style=${{ margin: 0, paddingLeft: '18px', fontSize: '12.5px' }}>${u.notes.map((n) => html`<li>${n}</li>`)}</ul>` : null}
      ${u.error ? html`<span></span><span class="chip warn" style=${{ height: 'auto', whiteSpace: 'normal', padding: '4px 8px' }}>${u.error}</span>` : null}
    </div>
  </div>`;
}

function VoiceGenCard({ s, setS }) {
  const m = s.media || {};
  const [voices, setVoices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const player = useRef(null);
  const setM = (patch) => api.post('/api/settings', { media: patch }).then((r) => { setS(r); toast('Saved', 'ok'); }).catch((e) => toast(e.message, 'err'));
  const loadVoices = async () => {
    setBusy(true);
    try { const d = await api.get('/api/tts/voices'); setVoices(d.voices || []); if (!(d.voices || []).length) toast('No voices returned', 'err'); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  useEffect(() => { if (m.tts) loadVoices(); }, [m.tts, m.tts_provider, m.has_elevenlabs_key]);
  const shown = voices.filter((v) => !q || JSON.stringify(v).toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return html`<div class="card" style=${{ padding: '16px 18px', marginTop: '18px' }}>
    <audio ref=${player}></audio>
    <div class="row"><b>Voice and generation</b><span class="muted" style=${{ fontSize: '12px' }}>Both are off by default. Agents only speak or generate images when you switch them on here.</span></div>
    <div class="kv" style=${{ gridTemplateColumns: '180px 1fr', marginTop: '10px' }}>
      <span>Text to speech</span><div class="row"><button class=${'switch ' + (m.tts ? 'on' : '')} onClick=${() => setM({ tts: !m.tts })}></button><span class="muted" style=${{ fontSize: '12px' }}>Narration, character dialogue and lip sync</span></div>
      ${m.tts ? html`
        <span>Voice provider</span><div class="seg">${[['edge', 'Free neural voices'], ['elevenlabs', 'ElevenLabs']].map(([v, l]) => html`<button class=${(m.tts_provider || 'edge') === v ? 'on' : ''} onClick=${() => setM({ tts_provider: v, default_voice: '' })}>${l}</button>`)}</div>
        ${m.tts_provider === 'elevenlabs' ? html`
          <span>ElevenLabs API key</span><div class="row"><input class="input sm mono" type="password" placeholder=${m.elevenlabs_key || 'not set'} onChange=${(e) => setM({ elevenlabs_key: e.target.value })} />
            <a class="btn ghost sm" href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener"><${Icon} name="external-link" size=${12} /></a></div>
          <span>Model</span><select class="select sm" value=${m.elevenlabs_model || 'eleven_multilingual_v2'} onChange=${(e) => setM({ elevenlabs_model: e.target.value })}>
            ${['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_v3'].map((x) => html`<option value=${x}>${x}</option>`)}</select>` : null}
        <span>Default voice</span><div class="row"><select class="select sm grow" value=${m.default_voice || ''} onChange=${(e) => setM({ default_voice: e.target.value })}>
            <option value="">Agent decides per film (casting from the brief, tone and language)</option>
            ${voices.map((v) => html`<option value=${v.id}>${v.name} · ${[v.gender, v.age, v.accent].filter(Boolean).join(', ')}</option>`)}</select>
          <button class="btn sm" onClick=${loadVoices}>${busy ? html`<${Icon} name="loader-circle" cls="spin" size=${12} />` : html`<${Icon} name="refresh-cw" size=${12} />`}</button></div>` : null}
      <span>Image generation</span><div class="row"><button class=${'switch ' + (m.image_gen ? 'on' : '')} onClick=${() => setM({ image_gen: !m.image_gen })}></button><span class="muted" style=${{ fontSize: '12px' }}>Pollinations illustrations when nothing real exists</span></div>
      ${m.image_gen ? html`<span>Pollinations key (optional)</span><div class="row"><input class="input sm mono" type="password" placeholder=${m.pollinations_key || 'not set: free tier, images carry their small logo'} onChange=${(e) => setM({ pollinations_key: e.target.value })} />
        <a class="btn ghost sm" href="https://enter.pollinations.ai" target="_blank" rel="noopener"><${Icon} name="external-link" size=${12} /></a></div>` : null}
    </div>
    ${m.tts && voices.length ? html`<div style=${{ marginTop: '12px' }}>
      <div class="row"><b style=${{ fontSize: '13px' }}>Voices</b><span class="chip">${voices.length}</span><input class="input sm grow" placeholder="Filter: deep, female, british, warm, narration…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
      <div style=${{ maxHeight: '260px', overflow: 'auto', marginTop: '8px' }}>${shown.map((v) => html`<div class="row" style=${{ padding: '4px 0', fontSize: '12px', borderBottom: '1px dashed var(--line)' }}>
        ${v.preview ? html`<button class="btn ghost icon sm" onClick=${() => { const a = player.current; a.src = v.preview; a.play().catch(() => null); }}><${Icon} name="play" size=${12} /></button>` : null}
        <b style=${{ minWidth: '120px' }}>${v.name}</b><span class="muted grow ellipsis">${[v.gender, v.age, v.accent, v.description, v.use_case].filter(Boolean).join(' · ')}</span>
        <button class=${'btn sm ' + (m.default_voice === v.id ? 'brand' : '')} onClick=${() => setM({ default_voice: m.default_voice === v.id ? '' : v.id })}>${m.default_voice === v.id ? 'Default' : 'Set default'}</button></div>`)}</div></div>` : null}
  </div>`;
}
