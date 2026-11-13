import { html, useState, useEffect, api } from './lib.js';

let cache = null;
let pending = null;

export function useFonts() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (cache) return;
    pending = pending || api.get('/api/fonts').then((r) => { cache = r; return r; });
    pending.then(setData).catch(() => null);
  }, []);
  return data;
}

export const SCRIPT_LABEL = {
  latin: 'Latin', bengali: 'Bangla', devanagari: 'Devanagari', arabic: 'Arabic and Urdu', hebrew: 'Hebrew', thai: 'Thai',
  'chinese-simplified': 'Chinese simplified', 'chinese-traditional': 'Chinese traditional', japanese: 'Japanese', korean: 'Korean',
  tamil: 'Tamil', telugu: 'Telugu', kannada: 'Kannada', malayalam: 'Malayalam', gurmukhi: 'Gurmukhi', gujarati: 'Gujarati',
  oriya: 'Odia', sinhala: 'Sinhala', khmer: 'Khmer', lao: 'Lao', myanmar: 'Myanmar', ethiopic: 'Ethiopic', armenian: 'Armenian',
  georgian: 'Georgian', cyrillic: 'Cyrillic', greek: 'Greek', vietnamese: 'Vietnamese'
};
const SCRIPT_ALIAS = { 'han-sc': 'chinese-simplified', 'han-tc': 'chinese-traditional' };

export const SAMPLE = {
  latin: 'Motion that moves people', bengali: 'আমার সোনার বাংলা', devanagari: 'नमस्ते दुनिया', arabic: 'مرحبا بالعالم', hebrew: 'שלום עולם',
  thai: 'สวัสดีชาวโลก', 'chinese-simplified': '你好世界', 'chinese-traditional': '你好世界', japanese: 'こんにちは世界', korean: '안녕하세요 세계',
  tamil: 'வணக்கம் உலகம்', telugu: 'హలో ప్రపంచం', kannada: 'ನಮಸ್ಕಾರ ಜಗತ್ತು', malayalam: 'ഹലോ ലോകം', gurmukhi: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', gujarati: 'નમસ્તે દુનિયા',
  cyrillic: 'Привет, мир', greek: 'Γεια σου κόσμε', vietnamese: 'Xin chào thế giới'
};

export function normScripts(list) {
  return (list || []).map((s) => SCRIPT_ALIAS[s] || s);
}

export function sampleFor(family, fonts, prefer) {
  const f = (fonts || []).find((x) => x.family === family);
  const scripts = f ? f.scripts : ['latin'];
  const first = normScripts(prefer || []).find((s) => scripts.includes(s)) || scripts.find((s) => s !== 'latin') || 'latin';
  return SAMPLE[first] || SAMPLE.latin;
}

export function FontSelect({ value, onChange, scripts, extra, sm, title }) {
  const data = useFonts();
  const fonts = (data && data.fonts) || [];
  const order = [...normScripts(scripts), 'latin', ...Object.keys(SCRIPT_LABEL)];
  const seen = new Set();
  const groups = [];
  order.forEach((sc) => {
    if (groups.find((g) => g.sc === sc)) return;
    const items = fonts.filter((f) => f.scripts.includes(sc) && !seen.has(f.family));
    items.forEach((f) => seen.add(f.family));
    if (items.length) groups.push({ sc, items });
  });
  return html`<select class=${'select ' + (sm ? 'sm' : '')} title=${title || 'Typeface'} value=${value || ''} onChange=${(e) => onChange(e.target.value)}>
    ${(extra || []).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
    ${groups.map((g) => html`<optgroup label=${SCRIPT_LABEL[g.sc] || g.sc}>${g.items.map((f) => html`<option value=${f.family}>${f.family}${f.category !== 'sans' ? ' · ' + f.category : ''}</option>`)}</optgroup>`)}
  </select>`;
}

export function useProjectLanguage(pid, deps) {
  const [info, setInfo] = useState(null);
  useEffect(() => { if (pid) api.get(`/api/projects/${pid}/language`).then(setInfo).catch(() => null); }, [pid, ...(deps || [])]);
  return info;
}
