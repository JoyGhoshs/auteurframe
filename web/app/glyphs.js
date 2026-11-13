import { html } from './lib.js';

const G = {
  producer: (c) => html`
    <circle cx="16" cy="16" r="13" fill=${c} opacity=".14"/>
    <circle class="g-spin" cx="16" cy="16" r="10.5" fill="none" stroke=${c} stroke-width="1.6" stroke-dasharray="3 4"/>
    <rect x="10" y="9" width="12" height="15" rx="2.6" fill="#fff" stroke=${c} stroke-width="1.8"/>
    <path d="M13 14h6M13 17.5h6M13 21h3.5" stroke=${c} stroke-width="1.8" stroke-linecap="round"/>
    <rect x="13" y="7.4" width="6" height="3.4" rx="1.2" fill=${c}/>`,
  research: (c) => html`
    <circle cx="14" cy="14" r="11" fill=${c} opacity=".14"/>
    <circle cx="14" cy="14" r="8" fill="#fff" stroke=${c} stroke-width="1.8"/>
    <path d="M6.5 14h15M14 6c-3 3.4-3 12.6 0 16M14 6c3 3.4 3 12.6 0 16" stroke=${c} stroke-width="1.4" fill="none"/>
    <g class="g-scan"><circle cx="22" cy="22" r="5" fill="#fff" stroke=${c} stroke-width="2"/><path d="M25.6 25.6l3.2 3.2" stroke=${c} stroke-width="2.4" stroke-linecap="round"/></g>`,
  director: (c) => html`
    <rect x="4" y="12" width="24" height="15" rx="3" fill=${c} opacity=".16"/>
    <rect x="4" y="12" width="24" height="15" rx="3" fill="none" stroke=${c} stroke-width="1.8"/>
    <g class="g-clap"><path d="M4.4 11.6L26 5.4l1.1 3.9L5.5 15.5z" fill="#fff" stroke=${c} stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M10 9.9l2.4 3.6M15.4 8.3l2.4 3.6M20.8 6.8l2.4 3.6" stroke=${c} stroke-width="1.8"/></g>
    <circle cx="16" cy="19.5" r="2.4" fill=${c}/>`,
  art: (c) => html`
    <path d="M16 4C9 4 4 9 4 15.5S9.5 28 15 28c2.2 0 2.6-1.6 1.7-3-.9-1.5.2-3 2-3h3.3C25.6 22 28 19.5 28 15.6 28 9.2 22.7 4 16 4z" fill=${c} opacity=".16" stroke=${c} stroke-width="1.8"/>
    <circle class="g-pop a" cx="10.5" cy="13" r="2.3" fill=${c}/><circle class="g-pop b" cx="15.5" cy="9.4" r="2.3" fill="#FFB648"/><circle class="g-pop c" cx="21.2" cy="12" r="2.3" fill="#2EC4B6"/><circle class="g-pop d" cx="10" cy="19" r="2.3" fill="#111"/>`,
  animator: (c) => html`
    <rect x="3.5" y="3.5" width="25" height="25" rx="7" fill=${c} opacity=".13"/>
    <path class="g-draw" d="M7 23C10 10 16 8 25 9" fill="none" stroke=${c} stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 23l5.5-6.2M25 9l-4.8 5.6" stroke=${c} stroke-width="1.2" stroke-dasharray="1.6 1.8"/>
    <rect x="5" y="21" width="4" height="4" rx="1" fill="#fff" stroke=${c} stroke-width="1.6"/><rect x="23" y="7" width="4" height="4" rx="1" fill="#fff" stroke=${c} stroke-width="1.6"/>
    <circle cx="12.5" cy="16.8" r="1.8" fill=${c}/><circle cx="20.2" cy="14.6" r="1.8" fill=${c}/>`,
  critic: (c) => html`
    <path d="M4 10V6.5A2.5 2.5 0 016.5 4H10M22 4h3.5A2.5 2.5 0 0128 6.5V10M28 22v3.5a2.5 2.5 0 01-2.5 2.5H22M10 28H6.5A2.5 2.5 0 014 25.5V22" fill="none" stroke=${c} stroke-width="2" stroke-linecap="round"/>
    <path d="M7.5 16s3.2-6 8.5-6 8.5 6 8.5 6-3.2 6-8.5 6-8.5-6-8.5-6z" fill=${c} opacity=".16" stroke=${c} stroke-width="1.8"/>
    <circle cx="16" cy="16" r="3.2" fill=${c}/><rect class="g-scanline" x="6" y="15.2" width="20" height="1.6" rx=".8" fill=${c} opacity=".55"/>`,
  render: (c) => html`
    <rect x="9" y="4.5" width="18" height="13" rx="2.5" fill=${c} opacity=".18" stroke=${c} stroke-width="1.4"/>
    <rect x="6.5" y="8" width="18" height="13" rx="2.5" fill=${c} opacity=".3" stroke=${c} stroke-width="1.4"/>
    <rect x="4" y="11.5" width="18" height="13" rx="2.5" fill="#fff" stroke=${c} stroke-width="1.8"/>
    <path d="M11 15.2v5.6l4.6-2.8z" fill=${c}/>
    <rect class="g-bar" x="4" y="27" width="18" height="2" rx="1" fill=${c}/>`,
  editor: (c) => html`
    <rect x="4" y="7" width="24" height="18" rx="3" fill=${c} opacity=".14" stroke=${c} stroke-width="1.8"/>
    <path d="M4 11.5h24M4 20.5h24" stroke=${c} stroke-width="1.4"/>
    <g fill=${c}><rect x="7" y="8.4" width="2" height="1.8" rx=".5"/><rect x="12" y="8.4" width="2" height="1.8" rx=".5"/><rect x="17" y="8.4" width="2" height="1.8" rx=".5"/><rect x="22" y="8.4" width="2" height="1.8" rx=".5"/>
    <rect x="7" y="21.8" width="2" height="1.8" rx=".5"/><rect x="12" y="21.8" width="2" height="1.8" rx=".5"/><rect x="17" y="21.8" width="2" height="1.8" rx=".5"/><rect x="22" y="21.8" width="2" height="1.8" rx=".5"/></g>
    <path class="g-cut" d="M16 13v6" stroke=${c} stroke-width="2.4" stroke-linecap="round"/>`,
  brain: (c) => html`
    <circle cx="16" cy="16" r="13" fill=${c} opacity=".1"/>
    <circle class="g-spin" cx="16" cy="16" r="12" fill="none" stroke=${c} stroke-width="1" stroke-dasharray="1 3.5"/>
    <path d="M12.5 9a3.5 3.5 0 00-3.4 4.3A3.6 3.6 0 009 20.5a3.5 3.5 0 004.4 2.4A2.6 2.6 0 0016 24V9.8A2.7 2.7 0 0012.5 9zM19.5 9a3.5 3.5 0 013.4 4.3 3.6 3.6 0 01.1 7.2 3.5 3.5 0 01-4.4 2.4A2.6 2.6 0 0116 24V9.8A2.7 2.7 0 0119.5 9z" fill="#fff" stroke=${c} stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="16" cy="16" r="1.6" fill=${c}/>`,
};

export function AgentGlyph({ id, color, size, working }) {
  const ALIAS = { sound: 'render', scout: 'research', narrator: 'editor', cutter: 'editor', captions: 'director', zoom: 'critic', gfx: 'art', broll: 'research', sfx: 'render', grade: 'art', sync: 'critic' };
  const raw = (id || '').split('-')[0];
  const base = ALIAS[raw] || raw;
  const fn = G[base] || G.brain;
  const s = size || 30;
  return html`<svg class=${'glyph ' + (working ? 'is-working' : '')} width=${s} height=${s} viewBox="0 0 32 32" fill="none" style=${{ '--gc': color }}>${fn(color || '#5B3DF5')}</svg>`;
}

export const glyphKinds = Object.keys(G);
