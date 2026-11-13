import { html, useState, useEffect, useRef, Icon, agentColor } from './lib.js';
import { AgentGlyph } from './glyphs.js';

const FEED_ICON = {
  'run.start': 'rocket', 'run.phase': 'flag', 'run.done': 'circle-check', 'run.error': 'circle-alert', 'run.warning': 'triangle-alert', 'barrier': 'git-merge',
  'memory.decision': 'gavel', 'memory.fact': 'quote', 'memory.write': 'database', 'qa.report': 'scan-eye', 'research.results': 'search', 'skill.imported': 'download',
  'agent.skills': 'book-open-text', 'project.outputs': 'film', 'chat.user': 'message-circle', 'edit.op': 'scissors', 'stock.import': 'image-down', 'agent.tool': 'terminal', 'sync.report': 'timer', 'sync.warning': 'triangle-alert', 'sync.align': 'wrench'
};

function describe(ev) {
  const d = ev.data || {};
  switch (ev.kind) {
    case 'run.start': return `Swarm launched · ${d.mode} · ${d.llm}`;
    case 'run.phase': return `Phase: ${d.phase}`;
    case 'run.done': return `Run complete in ${d.elapsed}s · ${d.stats.rendered} rendered · ${d.stats.repairs} repairs`;
    case 'run.error': return `Error: ${d.message}`;
    case 'run.warning': return d.message;
    case 'barrier': return `${d.name}: ${d.detail}`;
    case 'memory.decision': return `${d.author}: ${d.decision}`;
    case 'memory.fact': return `${d.id} ${d.claim}`;
    case 'memory.write': return `${d.author} wrote ${d.key} v${d.version}`;
    case 'qa.report': return `Scene ${d.scene + 1} QA ${d.score}${d.pass ? ' pass' : ' repair'} · round ${d.round}`;
    case 'research.results': return `Searched “${d.query}” · ${d.results.length} results`;
    case 'skill.imported': return `Imported skill ${d.name}`;
    case 'agent.skills': return `${d.agent} loaded ${d.skills.join(', ')}`;
    case 'project.outputs': return `Master ${d.duration.toFixed(2)}s · drift ${Math.round((d.drift || 0) * 1000)}ms`;
    case 'agent.tool': return `scene ${(d.scene ?? 0) + 1} ${d.ok ? '' : 'failed '}${d.tool}${d.arg ? ' ' + d.arg : ''}: ${d.detail || ''}`;
    case 'sync.report': return d.skipped ? `Sync check skipped: ${d.skipped}` : d.ok ? `Sync verified: ${d.checked} cues frame-exact, max drift ${d.max_drift_ms}ms` : `Sync: ${d.failed} of ${d.checked} cues off, max drift ${d.max_drift_ms}ms`;
    case 'sync.warning': return d.message;
    case 'sync.align': return (d.fixes || []).length ? `Timing fixes: ${d.fixes.join('; ')}` : 'Subtitles aligned to the master clock, no fixes needed';
    case 'edit.op': return `${d.id}  ${d.label}  @ ${(d.t || 0).toFixed(2)}s`;
    case 'stock.import': return `b-roll “${d.title || d.query}” from ${d.source}`;
    default: return ev.kind;
  }
}

export function SwarmPanel({ roster, agents, tokens, feed, project, progress, previews, brain, run }) {
  const [focus, setFocus] = useState(null);
  const thinkRef = useRef(null);
  const live = Object.entries(agents).filter(([, a]) => a.state === 'working').map(([id]) => id);
  const current = focus || live[live.length - 1] || Object.keys(tokens).slice(-1)[0];
  const stream = current ? (tokens[current] || '') : '';
  useEffect(() => { if (thinkRef.current) thinkRef.current.scrollTop = thinkRef.current.scrollHeight; }, [stream.length]);
  const scenes = project.scenes || [];
  const stepState = (s, step) => {
    const st = s.status;
    const order = ['planned', 'writing', 'qa', 'written', 'edited', 'rendering', 'rendered'];
    const i = order.indexOf(st);
    if (step === 'write') return st === 'writing' ? 'active' : i >= 2 ? 'done' : '';
    if (step === 'qa') return st === 'qa' ? 'active' : s.qa ? (s.qa.pass ? 'done' : 'fail') : '';
    if (step === 'fix') return s.qa && s.qa.round > 1 ? (s.source === 'house' && s.agent_code ? 'fail' : 'done') : '';
    if (step === 'render') return st === 'rendering' ? 'active' : st === 'rendered' ? 'done' : '';
    return '';
  };
  const facts = (brain.facts || []).slice(-8);
  const decisions = (brain.decisions || []).slice(-8);
  return html`<div>
    <div class="insp-sec" style=${{ paddingBottom: '8px' }}>
      <div class="row"><span class=${'dot ' + (run && run.status === 'running' ? 'live' : '')}></span><b>${run && run.status === 'running' ? `Swarm running · ${run.phase}` : run ? `Last run ${run.status}` : 'Swarm idle'}</b><span class="spacer"></span>
        <span class="chip">${live.length} active</span></div>
    </div>
    <div style=${{ padding: '6px 6px 4px' }}>
      ${roster.filter((a) => (project.edit ? (a.group === 'edit' || ['director', 'render-1', 'render-2', 'render-3', 'editor', 'sync'].includes(a.id)) : a.group !== 'edit')).map((a) => {
    const st = agents[a.id] || { state: 'idle' };
    return html`<div class=${'agent-card ' + (st.state === 'working' ? 'working' : '')} key=${a.id} onClick=${() => setFocus(focus === a.id ? null : a.id)} style=${{ cursor: 'pointer', outline: focus === a.id ? '1.5px solid var(--brand)' : 'none' }}>
          <div class="agent-av" style=${{ '--gc': agentColor(a.id) }}><${AgentGlyph} id=${a.id} color=${agentColor(a.id)} size=${30} working=${st.state === 'working'} /></div>
          <div style=${{ minWidth: 0 }}><div class="agent-name">${a.name}${st.scene != null ? html`<span class="chip" style=${{ height: '17px', fontSize: '10px' }}>S${st.scene + 1}</span>` : null}</div>
            <div class="agent-detail">${st.detail || a.role}</div></div>
          <span class=${'chip ' + (st.state === 'working' ? 'brand' : st.state === 'done' ? 'ok' : st.state === 'error' ? 'err' : '')}>${st.state === 'working' ? html`<span class="dot work"></span>` : null}${st.state}</span>
        </div>`;
  })}
    </div>
    <div class="section-title" style=${{ padding: '8px 14px 0' }}><${Icon} name="brain" size=${12} />Thinking ${current ? '· ' + ((roster.find((r) => r.id === current) || {}).name || current) : ''}</div>
    <div class="think" ref=${thinkRef}>${stream ? html`<span>${stream.slice(-3500)}</span><span class="caret"></span>` : html`<span style=${{ opacity: .5 }}>Agent reasoning and drafts stream here while the swarm works.</span>`}</div>
    <div class="section-title" style=${{ padding: '4px 14px 6px' }}><${Icon} name="workflow" size=${12} />Scene pipeline<span class="spacer"></span><span style=${{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>write · QA · fix · render</span></div>
    <div class="pipeline">${scenes.map((s) => html`<div class="pipe-row" key=${s.id}>
      <span class="n">${String(s.index + 1).padStart(2, '0')}</span><span class="ellipsis">${s.title || s.archetype}</span>
      ${['write', 'qa', 'fix', 'render'].map((step) => html`<span class=${'step ' + stepState(s, step)} title=${step}><${Icon} name=${{ write: 'pen-tool', qa: 'scan-eye', fix: 'wrench', render: 'cpu' }[step]} /></span>`)}</div>`)}</div>
    ${Object.keys(previews).length ? html`<div class="section-title" style=${{ padding: '4px 14px 6px' }}><${Icon} name="server" size=${12} />Render farm</div>
    <div class="farm">${scenes.filter((s) => previews[s.id]).map((s) => html`<div class="farm-cell"><img src=${'data:image/jpeg;base64,' + previews[s.id]} /><span>S${s.index + 1} ${progress[s.id] || 0}%</span></div>`)}</div>` : null}
    ${facts.length || decisions.length ? html`<div class="section-title" style=${{ padding: '8px 14px 4px' }}><${Icon} name="database" size=${12} />Shared brain</div>
      ${facts.map((f) => html`<div class="mem-item"><b>${f.id}</b> ${f.claim} ${f.url ? html`<a href=${f.url} target="_blank" rel="noopener">source</a>` : null}</div>`)}
      ${decisions.map((d) => html`<div class="mem-item"><b>${d.author}</b> ${d.decision}${d.why ? html`<span class="muted"> · ${d.why}</span>` : null}</div>`)}` : null}
    <div class="section-title" style=${{ padding: '10px 14px 4px' }}><${Icon} name="activity" size=${12} />Activity</div>
    <div class="feed">${feed.slice(-60).reverse().map((ev) => html`<div class="feed-item" key=${ev.seq}>
      <${Icon} name=${FEED_ICON[ev.kind] || 'dot'} style=${{ color: ev.kind === 'run.error' ? 'var(--err)' : ev.kind === 'run.warning' ? 'var(--warn)' : undefined }} />
      <span>${describe(ev)}</span><time>${new Date(ev.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>`)}</div>
  </div>`;
}
