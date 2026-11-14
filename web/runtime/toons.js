(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const INK = '#221c22';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const env = (t, a, b, r) => { if (t < a || t > b) return 0; const k = Math.min((t - a) / r, (b - t) / r, 1); return ease(k); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const col = (v, fb) => (v ? (String(v).startsWith('--') ? `var(${v})` : v) : fb);

  const PRESETS = {
    kid: { hat: 'none', hair: 'messy', hairColor: '#3b2a20', shirt: '#f2c94c', pants: '#3a5a9a', scale: 0.82 },
    'teen-girl': { hair: 'ponytail', hairColor: '#2b1d16', shirt: '#d94b3d', extras: ['backpack'] },
    'teen-boy': { hat: 'beanie', hatColor: '#e2a33a', shirt: '#7a4fc4', extras: [] },
    'old-man': { hair: 'bald-sides', hairColor: '#e8e4dc', beard: 'full', beardColor: '#eeeae2', shirt: '#7b6a58', brows: 'bushy', scale: 0.96 },
    'old-woman': { hair: 'bun', hairColor: '#d9d6d0', shirt: '#9c6fa8', extras: ['glasses'], scale: 0.94 },
    police: { hat: 'police', hatColor: '#24345e', shirt: '#24345e', extras: ['badge', 'tie'] },
    soldier: { hat: 'military', hatColor: '#566b3a', shirt: '#5f7442', extras: ['badge'] },
    doctor: { hair: 'side', hairColor: '#4a3426', shirt: '#f4f4f2', extras: ['stethoscope', 'glasses'] },
    scientist: { hair: 'wild', hairColor: '#d8d8d8', shirt: '#f4f4f2', extras: ['glasses'] },
    businessman: { hair: 'side', hairColor: '#2a211c', shirt: '#2f3542', extras: ['tie'] },
    chef: { hat: 'chef', shirt: '#f4f4f2', extras: ['apron'] },
    biker: { hat: 'helmet', hatColor: '#f0a830', shirt: '#2f9e8f' },
    beekeeper: { hat: 'beekeeper', hatColor: '#efe6c8', shirt: '#efe6c8', beard: 'full', beardColor: '#eeeae2' },
    thief: { hat: 'beanie', hatColor: '#d9772b', shirt: '#7b4fb8', mouth: 'smirk', expression: 'smirk' },
    zombie: { zombie: true, skin: '#a8c49a', hair: 'messy', hairColor: '#4a4a3a', shirt: '#6b6f5a', pants: '#4d4a44', expression: 'zombie', torn: true },
    hero: { hair: 'spiky', hairColor: '#2a211c', shirt: '#2f6fd6', extras: ['scarf'] },
    teacher: { hair: 'bun', hairColor: '#5a3a26', shirt: '#3f7f6a', extras: ['glasses', 'necklace'], prop: 'pointer' },
    nurse: { hat: 'nurse', hair: 'bun', hairColor: '#3b2a20', shirt: '#7fc8d8', pants: '#7fc8d8', extras: ['stethoscope'], prop: 'clipboard' },
    firefighter: { hat: 'firefighter', hatColor: '#c62f2f', shirt: '#3a3a40', pants: '#3a3a40', extras: ['vest'], vestColor: '#f2c230' },
    astronaut: { hat: 'space', shirt: '#e9ecef', pants: '#c9ced6', extras: ['badge', 'belt'], beltColor: '#8a93a0' },
    pirate: { hat: 'pirate', hatColor: '#1d1a1f', beard: 'full', beardColor: '#3a2418', shirt: '#8a2b2b', extras: ['eyepatch', 'belt'], prop: 'sword' },
    wizard: { hat: 'wizard', hatColor: '#3d3a8c', beard: 'full', beardColor: '#eeeae2', brows: 'bushy', shirt: '#3d3a8c', pants: '#2c2a66', prop: 'wand' },
    king: { hat: 'crown', beard: 'full', beardColor: '#8a5a34', shirt: '#7a2a8a', extras: ['cape', 'sash'], capeColor: '#b23a3a' },
    queen: { hat: 'crown', hair: 'long', hairColor: '#6b3a22', shirt: '#2f6f9e', extras: ['cape', 'necklace'], capeColor: '#7a2a8a' },
    princess: { hat: 'crown', hair: 'long', hairColor: '#e8b84a', shirt: '#e88fb4', extras: ['necklace'] },
    ninja: { hat: 'ninja', hatColor: '#24242c', shirt: '#24242c', pants: '#24242c', extras: ['belt'], beltColor: '#c62f2f', prop: 'sword' },
    farmer: { hat: 'cowboy', hatColor: '#e0c068', shirt: '#3a6ab8', beard: 'stubble', extras: ['belt'] },
    artist: { hat: 'beret', hatColor: '#b83a3a', beard: 'mustache', shirt: '#f2f2ee', extras: ['scarf'], scarfColor: '#e2a33a', prop: 'paintbrush' },
    detective: { hat: 'fedora', hatColor: '#6b5a48', shirt: '#9a8466', extras: ['tie'], tieColor: '#5a3a2a', prop: 'magnifier' },
    graduate: { hat: 'graduation', hair: 'side', hairColor: '#2b1d16', shirt: '#1d1a1f', prop: 'book' },
    builder: { hat: 'hardhat', shirt: '#3a6ab8', extras: ['vest'], prop: 'hammer' },
    viking: { hat: 'viking', hatColor: '#9aa0a8', hair: 'long', hairColor: '#c9772e', beard: 'full', beardColor: '#c9772e', shirt: '#7a5a3a', extras: ['belt'] },
    'mail-carrier': { hat: 'cap', hatColor: '#2f4f8f', shirt: '#6f9fd8', prop: 'bag' },
    singer: { hair: 'curly', hairColor: '#2b1d16', shirt: '#c23b7a', extras: ['earrings'], prop: 'microphone' },
    athlete: { hat: 'headband', hatColor: '#d94b3d', hair: 'side', hairColor: '#2b1d16', shirt: '#2f9e5f', pants: '#1d1a1f', prop: 'ball' },
    photographer: { hair: 'messy', hairColor: '#3b2a20', shirt: '#4a5a6a', extras: ['vest'], vestColor: '#8a7a5a', prop: 'camera' }
  };

  const HATS = {
    none: () => '',
    beanie: (c) => `<path d="M60 70 Q62 20 120 18 Q178 20 180 70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <rect x="56" y="58" width="128" height="24" rx="10" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <path d="M78 60 V80 M98 60 V80 M118 60 V80 M138 60 V80 M158 60 V80" stroke="${INK}" stroke-width="3" opacity=".45"/>`,
    cap: (c) => `<path d="M64 66 Q66 26 120 24 Q174 26 176 66 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M150 62 Q196 60 206 72 Q180 78 150 72 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`,
    police: (c) => `<path d="M58 66 L66 30 Q120 8 174 30 L182 66 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><rect x="58" y="60" width="124" height="16" rx="4" fill="#111" stroke="${INK}" stroke-width="5"/>
      <path d="M72 76 Q120 92 168 76 L172 84 Q120 102 68 84 Z" fill="#111" stroke="${INK}" stroke-width="4"/><path d="M120 34 l6 10 h11 l-9 7 3 11 -11 -7 -11 7 3 -11 -9 -7 h11 Z" fill="#f1c84b" stroke="${INK}" stroke-width="2.5"/>`,
    military: (c) => `<path d="M54 76 Q56 18 120 16 Q184 18 186 76 Q120 64 54 76 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M50 76 Q120 62 190 76" fill="none" stroke="${INK}" stroke-width="6"/>`,
    helmet: (c) => `<path d="M56 74 Q54 18 120 14 Q186 18 184 74 Q120 60 56 74 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M88 26 L94 56 M120 18 V54 M152 26 L146 56" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    beekeeper: (c) => `<ellipse cx="120" cy="58" rx="94" ry="16" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M76 56 Q78 14 120 12 Q162 14 164 56 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <path d="M40 62 Q36 140 70 150 L170 150 Q204 140 200 62" fill="rgba(240,240,232,.28)" stroke="${INK}" stroke-width="3" stroke-dasharray="2 5"/>`,
    cowboy: (c) => `<path d="M30 70 Q120 92 210 70 Q200 84 120 88 Q40 84 30 70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M74 72 Q72 22 98 26 Q120 40 142 26 Q168 22 166 72 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`,
    chef: () => `<path d="M76 70 L80 36 Q60 30 66 12 Q80 -2 100 10 Q120 -6 140 10 Q160 -2 174 12 Q180 30 160 36 L164 70 Z" fill="#fff" stroke="${INK}" stroke-width="6"/>`,
    crown: () => `<path d="M72 64 L76 24 L98 46 L120 16 L142 46 L164 24 L168 64 Z" fill="#f1c84b" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
    hood: (c) => `<path d="M48 120 Q40 20 120 16 Q200 20 192 120 Q186 66 120 62 Q54 66 48 120 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`,
    tophat: () => `<rect x="80" y="-6" width="80" height="62" rx="4" fill="#1d1a1f" stroke="${INK}" stroke-width="6"/><rect x="58" y="52" width="124" height="14" rx="6" fill="#1d1a1f" stroke="${INK}" stroke-width="6"/><rect x="80" y="40" width="80" height="10" fill="#b83a3a"/>`,
    hardhat: (c) => `<path d="M58 70 Q60 20 120 18 Q180 20 182 70 Z" fill="${c || '#f2c230'}" stroke="${INK}" stroke-width="6"/><rect x="48" y="62" width="144" height="14" rx="7" fill="${c || '#f2c230'}" stroke="${INK}" stroke-width="6"/>`,
    headband: (c) => `<path d="M60 62 Q120 46 180 62 L180 76 Q120 60 60 76 Z" fill="${c}" stroke="${INK}" stroke-width="5"/>`,
    party: (c) => `<path d="M92 50 L120 -14 L148 50 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><circle cx="120" cy="-16" r="8" fill="#fff" stroke="${INK}" stroke-width="4"/>`,
    wizard: (c) => `<path d="M72 66 L132 -66 Q142 -72 140 -56 L168 66 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M34 64 Q120 88 206 64 Q196 82 120 84 Q44 82 34 64 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <path d="M118 10 l4 9 h10 l-8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 h10 Z M140 40 l3 6 h6 l-5 4 2 6 -6 -4 -6 4 2 -6 -5 -4 h6 Z" fill="#f1c84b" stroke="${INK}" stroke-width="2"/>`,
    beret: (c) => `<ellipse cx="112" cy="44" rx="70" ry="24" fill="${c}" stroke="${INK}" stroke-width="6" transform="rotate(-10 112 44)"/><path d="M106 22 L104 10" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
    bandana: (c) => `<path d="M60 70 Q58 26 120 24 Q182 26 180 70 Q120 54 60 70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M62 64 L30 82 L40 96 L66 76 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <g fill="#fff" opacity=".8"><circle cx="92" cy="44" r="4"/><circle cx="120" cy="36" r="4"/><circle cx="148" cy="44" r="4"/><circle cx="106" cy="58" r="3"/><circle cx="136" cy="58" r="3"/></g>`,
    firefighter: (c) => `<path d="M56 72 Q56 14 120 12 Q184 14 184 72 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M120 14 V60" stroke="${INK}" stroke-width="4" opacity=".5"/>
      <path d="M36 70 Q120 52 204 70 Q212 86 200 88 Q120 74 40 88 Q28 86 36 70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M104 24 h32 v30 l-16 10 -16 -10 Z" fill="#f1c84b" stroke="${INK}" stroke-width="4"/>`,
    graduation: (c) => `<path d="M80 46 L80 72 Q120 86 160 72 L160 46 Z" fill="#1d1a1f" stroke="${INK}" stroke-width="6"/><path d="M120 6 L204 34 L120 62 L36 34 Z" fill="#1d1a1f" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M120 34 L190 40 L192 78" fill="none" stroke="${c || '#f1c84b'}" stroke-width="5"/><path d="M186 76 h12 l-2 20 h-8 Z" fill="${c || '#f1c84b'}" stroke="${INK}" stroke-width="3"/>`,
    pirate: (c) => `<path d="M34 68 Q44 18 80 40 Q120 0 160 40 Q196 18 206 68 Q120 86 34 68 Z" fill="${c || '#1d1a1f'}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="120" cy="44" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M104 58 L136 66 M136 58 L104 66" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
    nurse: () => `<path d="M74 62 L82 28 L158 28 L166 62 Q120 52 74 62 Z" fill="#fff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M116 32 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 Z" fill="#d94b3d"/>`,
    space: () => `<circle cx="120" cy="96" r="82" fill="rgba(180,220,255,.2)" stroke="${INK}" stroke-width="6"/><path d="M70 52 Q92 26 126 24" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".75" fill="none"/>
      <rect x="56" y="168" width="128" height="20" rx="9" fill="#d9dde3" stroke="${INK}" stroke-width="5"/>`,
    ninja: (c) => `<path fill-rule="evenodd" d="M50 96 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0 Z M70 78 H170 V112 H70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <path d="M186 84 L222 70 L216 90 L226 104 L190 100 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`,
    fedora: (c) => `<path d="M30 70 Q120 92 210 70 Q200 84 120 88 Q40 84 30 70 Z" fill="${c}" stroke="${INK}" stroke-width="6"/><path d="M72 72 Q70 22 102 26 Q120 38 138 26 Q170 22 168 72 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>
      <path d="M72 60 Q120 70 168 60 L168 70 Q120 80 72 70 Z" fill="#1d1a1f"/>`,
    viking: (c) => `<path d="M64 52 Q28 44 30 2 Q46 34 74 38 Z M176 52 Q212 44 210 2 Q194 34 166 38 Z" fill="#f3ead2" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M56 74 Q56 16 120 14 Q184 16 184 74 Z" fill="${c || '#9aa0a8'}" stroke="${INK}" stroke-width="6"/><path d="M120 16 V72 M56 70 H184" stroke="${INK}" stroke-width="5"/>`
  };

  const HAIR = {
    none: () => ['', ''], bald: () => ['', ''],
    messy: (c) => ['', `<path d="M64 74 Q58 30 96 26 Q100 10 122 20 Q140 6 154 26 Q186 30 178 74 Q170 52 150 50 Q140 62 124 48 Q110 62 96 50 Q78 56 64 74 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`],
    bowl: (c) => ['', `<path d="M60 86 Q56 26 120 24 Q184 26 180 86 L166 86 Q160 60 120 58 Q80 60 74 86 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`],
    spiky: (c) => ['', `<path d="M64 72 L58 40 L80 46 L84 16 L104 36 L120 8 L136 36 L156 16 L160 46 L182 40 L176 72 Q150 52 120 54 Q90 52 64 72 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`],
    side: (c) => ['', `<path d="M62 78 Q58 28 118 24 Q182 26 178 70 Q160 44 108 46 Q86 50 62 78 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`],
    ponytail: (c) => [`<path d="M168 60 Q214 70 206 130 Q200 168 214 190 Q178 178 178 132 Q178 98 160 80 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
      `<path d="M62 84 Q56 26 120 24 Q182 26 178 82 Q170 50 132 46 Q104 60 62 84 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`],
    long: (c) => [`<path d="M56 80 Q50 26 120 22 Q190 26 184 80 L190 180 Q170 192 162 150 L78 150 Q70 192 50 180 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`,
      `<path d="M62 84 Q60 30 120 28 Q180 30 178 84 Q160 52 120 52 Q80 52 62 84 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`],
    bun: (c) => [`<circle cx="120" cy="20" r="22" fill="${c}" stroke="${INK}" stroke-width="6"/>`, `<path d="M62 80 Q60 32 120 30 Q180 32 178 80 Q160 56 120 54 Q80 56 62 80 Z" fill="${c}" stroke="${INK}" stroke-width="6"/>`],
    curly: (c) => ['', `<path d="M60 80 Q44 60 62 46 Q58 22 86 24 Q96 6 120 14 Q144 6 156 24 Q184 22 180 46 Q196 62 180 80 Q170 58 150 60 Q136 50 120 58 Q104 50 90 60 Q70 58 60 80 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`],
    wild: (c) => ['', `<path d="M54 92 L36 70 L58 64 L44 38 L72 44 L76 18 L100 34 L120 10 L140 34 L164 18 L168 44 L196 38 L182 64 L204 70 L186 92 Q170 60 120 58 Q70 60 54 92 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`],
    'bald-sides': (c) => ['', `<path d="M58 104 Q54 76 66 66 Q72 84 70 104 Z M182 104 Q186 76 174 66 Q168 84 170 104 Z" fill="${c}" stroke="${INK}" stroke-width="5"/>`],
    mohawk: (c) => ['', `<path d="M104 52 L100 10 L120 -4 L140 10 L136 52 Z" fill="${c}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`]
  };

  const MOUTHS = {
    smile: 'M100 124 Q120 140 140 124', 'smile-small': 'M106 126 Q120 134 134 126', frown: 'M102 134 Q120 120 138 134', flat: 'M104 128 L136 128',
    smirk: 'M102 128 Q122 132 140 120', wavy: 'M100 130 Q108 124 114 130 Q120 136 126 130 Q132 124 140 130', groan: 'M104 132 Q120 126 136 132'
  };
  const EXPR = {
    neutral: { brows: [0, 0], mouth: 'smile-small' }, happy: { brows: [-4, 0], mouth: 'smile' }, sad: { brows: [12, -2], mouth: 'frown' },
    angry: { brows: [-16, 4], mouth: 'flat' }, worried: { brows: [14, -2], mouth: 'wavy', sweat: true }, shocked: { brows: [6, -12], mouth: 'O', eyes: 'big' },
    scared: { brows: [16, -8], mouth: 'wavy', eyes: 'big', sweat: true }, smirk: { brows: [-6, 0], browAsym: true, mouth: 'smirk' },
    laugh: { brows: [-4, -4], mouth: 'grin', eyes: 'closed' }, determined: { brows: [-12, 2], mouth: 'flat' }, sleepy: { brows: [0, 2], mouth: 'flat', eyes: 'sleepy' },
    zombie: { brows: [6, 4], mouth: 'groan', eyes: 'zombie' }, love: { brows: [-4, -2], mouth: 'smile', eyes: 'closed', blush: true }, thinking: { brows: [-8, 0], browAsym: true, mouth: 'flat' }
  };

  function extrasSVG(list, o) {
    const s = new Set(list || []);
    const back = [], body = [], head = [];
    if (s.has('backpack')) back.push(`<rect x="62" y="168" width="116" height="118" rx="24" fill="${col(o.backpackColor, '#4b6b3a')}" stroke="${INK}" stroke-width="6"/>`);
    if (s.has('cape')) back.push(`<path d="M82 160 Q60 300 70 360 L170 360 Q180 300 158 160 Z" fill="${col(o.capeColor, '#c23b3b')}" stroke="${INK}" stroke-width="6"/>`);
    if (s.has('tie')) body.push(`<path d="M114 160 L126 160 L130 176 L124 230 L120 238 L116 230 L110 176 Z" fill="${col(o.tieColor, '#b83a3a')}" stroke="${INK}" stroke-width="4"/>`);
    if (s.has('badge')) body.push(`<path d="M138 186 l6 10 h11 l-9 7 3 11 -11 -7 -11 7 3 -11 -9 -7 h11 Z" fill="#f1c84b" stroke="${INK}" stroke-width="2.5"/>`);
    if (s.has('scarf')) body.push(`<path d="M84 150 Q120 170 156 150 L158 168 Q120 188 82 168 Z M138 166 L150 214 L134 216 L126 170 Z" fill="${col(o.scarfColor, '#8b8f99')}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`);
    if (s.has('apron')) body.push(`<path d="M94 176 L146 176 L150 290 L90 290 Z" fill="#fff" stroke="${INK}" stroke-width="4" opacity=".95"/>`);
    if (s.has('stethoscope')) body.push(`<path d="M100 160 Q96 210 120 214 Q144 210 140 160" fill="none" stroke="#333" stroke-width="4"/><circle cx="120" cy="218" r="7" fill="#999" stroke="${INK}" stroke-width="3"/>`);
    if (s.has('vest')) body.push(`<path d="M86 168 L112 168 L112 296 L86 296 Z M128 168 L154 168 L154 296 L128 296 Z" fill="${col(o.vestColor, '#f08a24')}" stroke="${INK}" stroke-width="4" opacity=".95"/>`);
    if (s.has('glasses')) head.push(`<g fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="4"><circle cx="98" cy="94" r="14"/><circle cx="142" cy="94" r="14"/><path d="M112 94 H128" fill="none"/></g>`);
    if (s.has('sunglasses')) head.push(`<g stroke="${INK}" stroke-width="4"><rect x="80" y="84" width="34" height="20" rx="8" fill="#111"/><rect x="126" y="84" width="34" height="20" rx="8" fill="#111"/><path d="M114 92 H126" fill="none"/></g>`);
    if (s.has('eyepatch')) head.push(`<path d="M62 70 L178 110" stroke="${INK}" stroke-width="4"/><ellipse cx="142" cy="94" rx="15" ry="13" fill="#111" stroke="${INK}" stroke-width="3"/>`);
    if (s.has('bandage')) head.push(`<rect x="132" y="60" width="30" height="12" rx="4" fill="#f4e3c8" stroke="${INK}" stroke-width="3" transform="rotate(-20 147 66)"/>`);
    if (s.has('freckles')) head.push(`<g fill="#c98a6a"><circle cx="90" cy="112" r="2.4"/><circle cx="98" cy="116" r="2.4"/><circle cx="142" cy="116" r="2.4"/><circle cx="150" cy="112" r="2.4"/></g>`);
    if (s.has('scar')) head.push(`<path d="M146 76 L156 104 M146 84 L156 82 M148 94 L158 92" stroke="#8a3a3a" stroke-width="3"/>`);
    if (s.has('bowtie')) body.push(`<path d="M120 164 L100 152 L100 176 Z M120 164 L140 152 L140 176 Z" fill="${col(o.tieColor, '#b83a3a')}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="120" cy="164" r="5" fill="${INK}"/>`);
    if (s.has('necklace')) body.push(`<path d="M92 156 Q120 186 148 156" fill="none" stroke="#f1c84b" stroke-width="4" stroke-dasharray="1 7" stroke-linecap="round"/><circle cx="120" cy="176" r="6" fill="${col(o.gemColor, '#4fa3e0')}" stroke="${INK}" stroke-width="3"/>`);
    if (s.has('sash')) body.push(`<path d="M84 160 L100 156 L160 284 L144 292 Z" fill="${col(o.sashColor, '#f1c84b')}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
    if (s.has('belt')) body.push(`<rect x="78" y="262" width="84" height="14" fill="${col(o.beltColor, '#4a3426')}" stroke="${INK}" stroke-width="4"/><rect x="112" y="260" width="16" height="18" rx="2" fill="#f1c84b" stroke="${INK}" stroke-width="3"/>`);
    if (s.has('earrings')) head.push(`<circle cx="62" cy="114" r="4" fill="#f1c84b"/><circle cx="178" cy="114" r="4" fill="#f1c84b"/>`);
    return { back: back.join(''), body: body.join(''), head: head.join('') };
  }

  const PROPS = {
    none: '', flashlight: `<rect x="-6" y="0" width="12" height="34" rx="4" fill="#2d2d33" stroke="${INK}" stroke-width="3"/><rect x="-9" y="30" width="18" height="10" rx="3" fill="#f1c84b" stroke="${INK}" stroke-width="3"/>`,
    phone: `<rect x="-11" y="-6" width="22" height="38" rx="5" fill="#222" stroke="${INK}" stroke-width="3"/><rect x="-7" y="-1" width="14" height="26" rx="2" fill="#7fd0ff"/>`,
    money: `<rect x="-24" y="-6" width="48" height="24" rx="3" fill="#cfe6a8" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="6" r="6" fill="none" stroke="#5a7a3a" stroke-width="2"/>`,
    radio: `<rect x="-22" y="-8" width="44" height="30" rx="5" fill="#6b5a4a" stroke="${INK}" stroke-width="3"/><circle cx="-8" cy="7" r="7" fill="#333"/><path d="M14 -8 L22 -30" stroke="${INK}" stroke-width="3"/>`,
    sign: `<rect x="-3" y="-60" width="6" height="70" fill="#8a6a44" stroke="${INK}" stroke-width="2"/><rect x="-40" y="-96" width="80" height="44" rx="4" fill="#fff" stroke="${INK}" stroke-width="4"/>`,
    torch: `<rect x="-5" y="-30" width="10" height="44" rx="3" fill="#8a5a34" stroke="${INK}" stroke-width="3"/><path class="tn-flame" d="M0 -62 Q16 -44 8 -32 Q0 -26 -8 -32 Q-16 -44 0 -62 Z" fill="#ff9a2e" stroke="#d2581d" stroke-width="3"/>`,
    book: `<rect x="-20" y="-10" width="40" height="30" rx="2" fill="#3a6ab8" stroke="${INK}" stroke-width="3"/>`,
    bag: `<path d="M-18 -4 h36 l4 34 h-44 Z" fill="#c9a26a" stroke="${INK}" stroke-width="3"/><path d="M-8 -4 Q0 -18 8 -4" fill="none" stroke="${INK}" stroke-width="3"/>`,
    cup: `<path d="M-12 -6 h24 l-3 26 h-18 Z" fill="#fff" stroke="${INK}" stroke-width="3"/>`,
    umbrella: `<path d="M0 30 V-70" stroke="${INK}" stroke-width="4"/><path d="M-54 -66 Q0 -120 54 -66 Z" fill="#d94b3d" stroke="${INK}" stroke-width="4"/>`,
    map: `<path d="M-26 -8 l18 4 l16 -4 l18 4 v30 l-18 -4 l-16 4 l-18 -4 Z" fill="#efe2b8" stroke="${INK}" stroke-width="3"/>`,
    key: `<circle cx="0" cy="-4" r="8" fill="none" stroke="#c9a12a" stroke-width="4"/><path d="M0 4 V26 M0 18 h7 M0 24 h6" stroke="#c9a12a" stroke-width="4"/>`,
    wand: `<path d="M0 24 L0 -46" stroke="#4a3426" stroke-width="6" stroke-linecap="round"/><path d="M0 -66 l5 10 h11 l-9 7 3 11 -10 -7 -10 7 3 -11 -9 -7 h11 Z" fill="#f1c84b" stroke="${INK}" stroke-width="3"/>`,
    sword: `<path d="M-4 -96 L0 -108 L4 -96 L4 -10 L-4 -10 Z" fill="#d9dde3" stroke="${INK}" stroke-width="3"/><rect x="-16" y="-12" width="32" height="7" rx="3" fill="#c9a12a" stroke="${INK}" stroke-width="3"/><rect x="-4" y="-5" width="8" height="22" rx="2" fill="#4a3426" stroke="${INK}" stroke-width="3"/>`,
    clipboard: `<rect x="-20" y="-16" width="40" height="52" rx="4" fill="#c9a26a" stroke="${INK}" stroke-width="3"/><rect x="-15" y="-8" width="30" height="40" fill="#fff"/><rect x="-8" y="-20" width="16" height="8" rx="2" fill="#8a93a0" stroke="${INK}" stroke-width="2"/><path d="M-10 2 h20 M-10 10 h20 M-10 18 h14" stroke="#8a93a0" stroke-width="2"/>`,
    paintbrush: `<path d="M0 24 L0 -40" stroke="#c9772e" stroke-width="6" stroke-linecap="round"/><rect x="-5" y="-50" width="10" height="12" fill="#b0b6bf" stroke="${INK}" stroke-width="2"/><path d="M-5 -50 Q0 -70 5 -50 Z" fill="#d94b3d" stroke="${INK}" stroke-width="2"/>`,
    pointer: `<path d="M0 24 L0 -86" stroke="#8a5a34" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="-88" r="4" fill="#d94b3d"/>`,
    microphone: `<rect x="-5" y="-14" width="10" height="38" rx="4" fill="#2d2d33" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="-22" r="11" fill="#9aa0a8" stroke="${INK}" stroke-width="3"/><path d="M-8 -26 h16 M-8 -20 h16" stroke="${INK}" stroke-width="1.5" opacity=".5"/>`,
    camera: `<rect x="-24" y="-12" width="48" height="32" rx="5" fill="#2d2d33" stroke="${INK}" stroke-width="3"/><rect x="-10" y="-18" width="16" height="7" rx="2" fill="#2d2d33"/><circle cx="0" cy="4" r="10" fill="#4f6a8a" stroke="#d9dde3" stroke-width="4"/>`,
    balloon: `<path d="M0 24 Q-8 -20 2 -60" stroke="${INK}" stroke-width="2" fill="none"/><ellipse cx="2" cy="-86" rx="22" ry="27" fill="#d94b3d" stroke="${INK}" stroke-width="4"/><path d="M-1 -59 l3 5 l3 -5 Z" fill="#d94b3d" stroke="${INK}" stroke-width="2"/>`,
    flower: `<path d="M0 24 Q4 -10 0 -36" stroke="#3f8a3a" stroke-width="4" fill="none"/><g fill="#f28ab2" stroke="${INK}" stroke-width="2.5"><circle cx="0" cy="-52" r="9"/><circle cx="-12" cy="-42" r="9"/><circle cx="12" cy="-42" r="9"/><circle cx="-7" cy="-30" r="8"/><circle cx="7" cy="-30" r="8"/></g><circle cx="0" cy="-40" r="7" fill="#f1c84b" stroke="${INK}" stroke-width="2.5"/>`,
    hammer: `<rect x="-4" y="-40" width="8" height="64" rx="3" fill="#c9772e" stroke="${INK}" stroke-width="3"/><rect x="-20" y="-54" width="40" height="18" rx="3" fill="#8a93a0" stroke="${INK}" stroke-width="3"/>`,
    pan: `<circle cx="0" cy="-34" r="24" fill="#3a3a40" stroke="${INK}" stroke-width="4"/><rect x="-4" y="-10" width="8" height="34" rx="3" fill="#2d2d33" stroke="${INK}" stroke-width="3"/>`,
    ball: `<circle cx="0" cy="-14" r="20" fill="#f2a03a" stroke="${INK}" stroke-width="4"/><path d="M-20 -14 H20 M0 -34 V6 M-14 -28 Q0 -14 -14 0 M14 -28 Q0 -14 14 0" stroke="${INK}" stroke-width="2.5" fill="none"/>`,
    magnifier: `<rect x="-4" y="-6" width="8" height="30" rx="3" fill="#4a3426" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="-24" r="17" fill="rgba(180,220,255,.35)" stroke="${INK}" stroke-width="5"/>`
  };

  function rigSVG(o, id) {
    const skin = o.zombie ? col(o.skin, '#a8c49a') : col(o.skin, '#ffffff');
    const shirt = col(o.shirt, '#d94b3d'), pants = col(o.pants, INK);
    const hat = (HATS[o.hat] || HATS.none)(col(o.hatColor, '#e2a33a'));
    const [hairBack, hairFront] = (HAIR[o.hair] || HAIR.none)(col(o.hairColor, '#2b1d16'));
    const ex = extrasSVG(o.extras, o);
    const beard = o.beard === 'full' ? `<path d="M70 112 Q76 168 120 172 Q164 168 170 112 Q160 136 140 134 Q120 146 100 134 Q80 136 70 112 Z" fill="${col(o.beardColor, '#5a4030')}" stroke="${INK}" stroke-width="5"/>`
      : o.beard === 'stubble' ? `<path d="M80 120 Q120 168 160 120" fill="none" stroke="${INK}" stroke-width="10" stroke-dasharray="1 5" opacity=".35"/>`
        : o.beard === 'mustache' ? `<path d="M100 120 Q110 112 120 120 Q130 112 140 120 Q130 128 120 122 Q110 128 100 120 Z" fill="${col(o.beardColor, '#3a2a20')}" stroke="${INK}" stroke-width="3"/>` : '';
    const torn = o.torn ? `<path d="M86 288 L96 300 L106 288 L116 302 L126 288 L136 300 L146 288 L154 298 L154 304 L86 304 Z" fill="${skin}" stroke="none"/>` : '';
    const limb = 'stroke="' + INK + '" stroke-width="7" stroke-linecap="round" fill="none"';
    const hand = (cls) => `<circle class="${cls}" cx="0" cy="0" r="8" fill="${skin}" stroke="${INK}" stroke-width="4"/>`;
    return `<svg viewBox="-20 -40 280 510" width="100%" height="100%" overflow="visible" data-layer="${id}">
      <g class="tn-flip"><g class="tn-root">
        <ellipse class="tn-shadow" cx="120" cy="448" rx="54" ry="9" fill="rgba(0,0,0,.18)"/>
        <g class="tn-back">${ex.back}</g>
        <g class="tn-legL" transform=""><path d="M108 296 L108 368" ${limb} stroke="${pants === INK ? INK : pants}"/><g class="tn-shinL"><path d="M108 368 L108 438" ${limb}/><ellipse cx="102" cy="440" rx="15" ry="8" fill="#1f1b20"/></g></g>
        <g class="tn-legR"><path d="M132 296 L132 368" ${limb} stroke="${pants === INK ? INK : pants}"/><g class="tn-shinR"><path d="M132 368 L132 438" ${limb}/><ellipse cx="138" cy="440" rx="15" ry="8" fill="#1f1b20"/></g></g>
        <g class="tn-armB"><path d="M80 176 L80 228" ${limb}/><g class="tn-foreB"><path d="M80 228 L80 272" ${limb}/><g transform="translate(80 276)">${hand('tn-handB')}</g></g></g>
        <g class="tn-torso"><rect x="76" y="150" width="88" height="152" rx="30" fill="${shirt}" stroke="${INK}" stroke-width="6"/>${torn}${ex.body}${o.parts && o.parts.body || ''}</g>
        <g class="tn-head"><g transform="translate(120 104) scale(1.22) translate(-120 -96)">
          ${hairBack}
          <circle cx="120" cy="96" r="60" fill="${skin}" stroke="${INK}" stroke-width="6"/>
          ${o.zombie ? `<path d="M80 70 Q90 64 96 74 M150 120 Q156 128 150 134" stroke="#6f8a62" stroke-width="3" fill="none"/><path d="M132 62 l10 4 M134 68 l10 -2" stroke="${INK}" stroke-width="2.5"/>` : ''}
          <g class="tn-face">
            <g class="tn-eyes">
              <g class="tn-eyeL" transform="translate(98 94)"><ellipse class="tn-white" rx="13" ry="14" fill="#fff" stroke="${INK}" stroke-width="3.5" style="display:none"/><ellipse class="tn-pupil" rx="5.5" ry="7.5" fill="${INK}"/><path class="tn-closed" d="M-10 0 Q0 -8 10 0" stroke="${INK}" stroke-width="4" fill="none" style="display:none"/><path class="tn-lid" d="M-13 -2 Q0 -6 13 -2" stroke="${INK}" stroke-width="4" fill="${skin}" style="display:none"/></g>
              <g class="tn-eyeR" transform="translate(142 94)"><ellipse class="tn-white" rx="13" ry="14" fill="#fff" stroke="${INK}" stroke-width="3.5" style="display:none"/><ellipse class="tn-pupil" rx="5.5" ry="7.5" fill="${INK}"/><path class="tn-closed" d="M-10 0 Q0 -8 10 0" stroke="${INK}" stroke-width="4" fill="none" style="display:none"/><path class="tn-lid" d="M-13 -2 Q0 -6 13 -2" stroke="${INK}" stroke-width="4" fill="${skin}" style="display:none"/></g>
            </g>
            <path class="tn-browL" d="M86 72 L110 72" stroke="${INK}" stroke-width="${o.brows === 'bushy' ? 9 : 6}" stroke-linecap="round"/>
            <path class="tn-browR" d="M130 72 L154 72" stroke="${INK}" stroke-width="${o.brows === 'bushy' ? 9 : 6}" stroke-linecap="round"/>
            <ellipse class="tn-blush" cx="88" cy="116" rx="9" ry="5" fill="#f4a3a3" opacity="0"/><ellipse class="tn-blush" cx="152" cy="116" rx="9" ry="5" fill="#f4a3a3" opacity="0"/>
            <path class="tn-mouth" d="${MOUTHS['smile-small']}" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>
            <ellipse class="tn-mouthO" cx="120" cy="130" rx="9" ry="11" fill="#5a1e24" stroke="${INK}" stroke-width="4" style="display:none"/>
            <path class="tn-grin" d="M98 120 Q120 150 142 120 Z" fill="#5a1e24" stroke="${INK}" stroke-width="4" stroke-linejoin="round" style="display:none"/>
            <path class="tn-sweat" d="M176 70 Q184 84 176 90 Q168 84 176 70 Z" fill="#9fd4f2" stroke="${INK}" stroke-width="2.5" style="display:none"/>
            <path class="tn-tear" d="M98 112 Q102 124 98 130 Q94 124 98 112 Z" fill="#9fd4f2" stroke="${INK}" stroke-width="2" style="display:none"/>
          </g>
          ${beard}${hairFront}${ex.head}${hat}${o.parts && o.parts.head || ''}
        </g></g>
        <g class="tn-armF"><path d="M160 176 L160 228" ${limb}/><g class="tn-foreF"><path d="M160 228 L160 272" ${limb}/><g class="tn-handFpos" transform="translate(160 276)">${hand('tn-handF')}<g class="tn-prop">${o.parts && o.parts.prop || PROPS[o.prop] || ''}</g></g></g></g>
        ${o.parts && o.parts.front || ''}
      </g></g>
    </svg>`;
  }

  function pose(t, p, acts, blinks, level, words, rnd) {
    const o = { armB: [8, 6], armF: [-8, -6], legL: [0, 0], legR: [0, 0], head: 0, headY: 0, bob: 0, jump: 0, x: 0, lean: 0, tremble: 0, expression: p.expression, talk: 0, eyes: 0, propUp: 0, face: 1 };
    const breathe = Math.sin(t * 2.2 + rnd * 6) * 1.6;
    o.bob = breathe;
    o.armB[0] += Math.sin(t * 1.6 + rnd * 4) * 2; o.armF[0] -= Math.sin(t * 1.6 + 1 + rnd * 4) * 2;
    o.head = Math.sin(t * 0.9 + rnd * 9) * 2.5;
    let walkX = p.x;
    const shamble = p.zombie && !acts.some((a) => a.do === 'walk' || a.do === 'run' || a.do === 'shamble');
    if (shamble) { o.armB = [-82, -6]; o.armF = [-78, -10]; o.head = 12 + Math.sin(t * 1.3) * 6; o.lean = 6; }
    acts.forEach((a) => {
      const at = +a.at || 0, end = at + (+a.duration || 1), w = env(t, at, end, 0.18), k = clamp((t - at) / Math.max(0.01, end - at), 0, 1);
      const kind = a.do;
      if (t >= at && a.expression && t <= end) o.expression = a.expression;
      if ((kind === 'walk' || kind === 'run' || kind === 'shamble') && a.to != null) {
        const from = a.from != null ? +a.from : walkX;
        if (t >= at) walkX = from + (+a.to - from) * (kind === 'shamble' ? k : ease(k));
        if (t > at && t < end) {
          const sp = kind === 'run' ? 11 : kind === 'shamble' ? 4 : 7;
          const ph = (t - at) * sp;
          const amp = kind === 'run' ? 40 : kind === 'shamble' ? 18 : 26;
          o.legL = [Math.sin(ph) * amp, Math.max(0, -Math.sin(ph)) * amp * 0.9];
          o.legR = [-Math.sin(ph) * amp, Math.max(0, Math.sin(ph)) * amp * 0.9];
          if (kind === 'shamble') { o.armB = [-84 + Math.sin(ph) * 6, -4]; o.armF = [-80 - Math.sin(ph) * 6, -8]; o.head = 14 + Math.sin(ph * 0.5) * 8; o.lean = 7; }
          else { o.armB = [-Math.sin(ph) * amp * 0.9, kind === 'run' ? -60 : -10]; o.armF = [Math.sin(ph) * amp * 0.9, kind === 'run' ? -60 : -10]; }
          o.bob += Math.abs(Math.sin(ph)) * (kind === 'run' ? -8 : -4);
          o.lean = kind === 'run' ? 8 : o.lean;
          o.face = +a.to >= from ? 1 : -1;
        }
      }
      if (!w) return;
      if (kind === 'wave') { o.armF = [-150 * w + o.armF[0] * (1 - w), (-20 + Math.sin(t * 14) * 28) * w]; }
      else if (kind === 'point') { const up = a.dir === 'up'; o.armF = [(up ? -165 : -92) * w, (up ? 0 : 6) * w]; }
      else if (kind === 'talk') { o.talk = Math.max(o.talk, w); o.head += Math.sin(t * 5.3) * 3 * w; o.armB[0] += Math.sin(t * 3.1) * 10 * w; }
      else if (kind === 'look') { o.eyes = (a.dir === 'left' ? -1 : a.dir === 'right' ? 1 : 0) * w; o.head += (a.dir === 'up' ? -8 : a.dir === 'down' ? 10 : 0) * w; }
      else if (kind === 'shock' || kind === 'jump') { o.jump += -Math.sin(Math.min(1, (t - at) / 0.45) * Math.PI) * 46 * (t - at < 0.45 ? 1 : 0); o.armB = [60 * w, -40 * w]; o.armF = [-60 * w, 40 * w]; if (kind === 'shock') o.expression = 'shocked'; }
      else if (kind === 'cheer') { o.armB = [150 * w, 20 * w]; o.armF = [-150 * w, -20 * w]; o.jump += -Math.abs(Math.sin((t - at) * 6)) * 26 * w; o.expression = 'happy'; }
      else if (kind === 'shrug') { o.armB = [40 * w, -110 * w]; o.armF = [-40 * w, 110 * w]; o.head += 8 * w; }
      else if (kind === 'nod') { o.headY += Math.sin(k * Math.PI * 4) * 6 * w; }
      else if (kind === 'shake') { o.head += Math.sin(k * Math.PI * 6) * 10 * w; }
      else if (kind === 'think') { o.armF = [-120 * w, 150 * w]; o.head += -6 * w; o.expression = a.expression || 'thinking'; }
      else if (kind === 'scared' || kind === 'tremble') { o.tremble = 3 * w; o.armB = [30 * w, -120 * w]; o.armF = [-30 * w, 120 * w]; o.expression = a.expression || 'scared'; }
      else if (kind === 'cry') { o.expression = 'sad'; o.cry = w; o.head += 8 * w; }
      else if (kind === 'laugh') { o.expression = 'laugh'; o.bob += Math.abs(Math.sin(t * 12)) * -5 * w; o.head += Math.sin(t * 12) * 3 * w; }
      else if (kind === 'angry') { o.expression = 'angry'; o.armF = [-100 * w, -60 * w + Math.sin(t * 16) * 10 * w]; }
      else if (kind === 'crouch') { o.legL = [30 * w, 70 * w]; o.legR = [-30 * w, 70 * w]; o.bob += 40 * w; o.lean = 6 * w; }
      else if (kind === 'fall') { o.lean = 90 * ease(k); o.bob += 120 * ease(k); }
      else if (kind === 'hold' || kind === 'raise') { o.armF = [(kind === 'raise' ? -150 : -70) * w, (kind === 'raise' ? 10 : -50) * w]; o.propUp = w; }
      else if (kind === 'hug') { o.armB = [-80 * w, -60 * w]; o.armF = [-80 * w, -60 * w]; }
      else if (kind === 'turn') { o.face = k > 0.5 ? -1 : 1; }
      else if (kind === 'pull') { o.armB = [-90 * w, 10 * w]; o.armF = [-90 * w, 10 * w]; o.lean = -10 * w; }
    });
    o.x = walkX;
    if (level) { const lv = level(t); o.talk = Math.max(o.talk && !level ? o.talk : 0, lv > 0.18 ? Math.min(1, lv) : 0); o.talkLevel = lv; }
    else if (o.talk) {
      const hit = words.some((w0) => t >= w0.t && t < w0.e);
      o.talkLevel = words.length ? (hit ? 0.55 + 0.45 * Math.abs(Math.sin(t * 22)) : 0.05) : Math.max(0, Math.sin(t * 2 * Math.PI * 4.6)) * o.talk;
    }
    o.blink = blinks.some((b) => t >= b && t < b + 0.12);
    return o;
  }

  function buildToon(ctx, p, h, cls) {
    const set = (k) => { const v = p[k]; if (v == null || v === '') return false; const d = TOON_PARAMS[k] ? TOON_PARAMS[k].default : undefined; if (Array.isArray(v) && !v.length) return false; return d === undefined || JSON.stringify(v) !== JSON.stringify(d); };
    const base = Object.assign({}, PRESETS[p.preset] || {}, ...Object.keys(p).filter(set).map((k) => ({ [k]: p[k] })));
    if (base.zombie && !p.expression) base.expression = 'zombie';
    if (!base.expression) base.expression = 'neutral';
    const scale = (base.scale || 1);
    const hpx = (p.h || 42) / 100 * ctx.H * scale;
    const wpx = hpx * 280 / 500;
    const el = h.box(Object.assign({}, p, { x: null, y: null }), cls, { x: 0, y: 0 });
    Object.assign(el.style, { left: (p.x / 100 * ctx.W - wpx / 2) + 'px', top: (p.y / 100 * ctx.H - hpx * 0.94) + 'px', width: wpx + 'px', height: hpx + 'px', overflow: 'visible' });
    if (p.depth) { el.style.filter = `blur(${(p.depth * 2.2).toFixed(1)}px) brightness(${(1 - p.depth * 0.25).toFixed(2)})`; el.style.zIndex = String(10 - Math.round(p.depth * 5)); }
    el.innerHTML = rigSVG(base, el.getAttribute('data-layer'));
    const q = (s) => el.querySelector(s);
    const R = { flip: q('.tn-flip'), root: q('.tn-root'), armB: q('.tn-armB'), foreB: q('.tn-foreB'), armF: q('.tn-armF'), foreF: q('.tn-foreF'), legL: q('.tn-legL'), shinL: q('.tn-shinL'),
      legR: q('.tn-legR'), shinR: q('.tn-shinR'), head: q('.tn-head'), torso: q('.tn-torso'), browL: q('.tn-browL'), browR: q('.tn-browR'), mouth: q('.tn-mouth'), mouthO: q('.tn-mouthO'),
      grin: q('.tn-grin'), sweat: q('.tn-sweat'), tear: q('.tn-tear'), blush: el.querySelectorAll('.tn-blush'), eyes: [q('.tn-eyeL'), q('.tn-eyeR')], prop: q('.tn-prop'), flame: q('.tn-flame'), shadow: q('.tn-shadow') };
    const rnd = hash((ctx.seed || 1) + p.x * 13 + (p.y || 0) * 7);
    const acts = (Array.isArray(p.actions) ? p.actions : []).slice().sort((a, b) => (+a.at || 0) - (+b.at || 0));
    const blinks = [];
    for (let b = 0.5 + rnd * 1.6; b < ctx.D + 1; b += 2.0 + hash(b * 9 + rnd) * 2.6) blinks.push(b);
    const level = p.lipsync && window.AU_SPEECH ? window.AU_SPEECH(p.lipsync, p.lipsyncAt) : null;
    const words = [];
    (ctx.cues || []).forEach((c) => (c.words && c.words.length ? c.words : []).forEach((w0) => words.push({ t: +w0.t, e: +(w0.e != null ? w0.e : w0.t + 0.3) })));
    const { at, end } = h.span(p);
    const enter = p.enter || 'pop';
    if (enter === 'pop') ctx.tl.fromTo(el, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 100%' }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, at);
    else if (enter === 'fade') ctx.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at);
    else if (enter === 'rise') ctx.tl.fromTo(el, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'au.softLand' }, at);
    else ctx.tl.set(el, { autoAlpha: 1 }, 0);
    h.exitOut(p, el, end, { y: 30 });
    const rot = (g, a, x, y) => g && g.setAttribute('transform', `rotate(${a.toFixed(2)} ${x} ${y})`);
    const setMouth = (name, talkLv) => {
      R.mouth.style.display = 'none'; R.mouthO.style.display = 'none'; R.grin.style.display = 'none';
      if (talkLv > 0.08) { R.mouthO.style.display = ''; R.mouthO.setAttribute('ry', (3 + talkLv * 11).toFixed(1)); R.mouthO.setAttribute('rx', (11 - talkLv * 3).toFixed(1)); return; }
      if (name === 'O') { R.mouthO.style.display = ''; R.mouthO.setAttribute('ry', '13'); R.mouthO.setAttribute('rx', '10'); return; }
      if (name === 'grin') { R.grin.style.display = ''; return; }
      R.mouth.style.display = ''; R.mouth.setAttribute('d', MOUTHS[name] || MOUTHS['smile-small']);
    };
    ctx.onFrame((t) => {
      const o = pose(t, Object.assign({}, p, base), acts, blinks, level, words, rnd);
      const ex = EXPR[o.expression] || EXPR.neutral;
      const tr = o.tremble ? (hash(Math.floor(t * 30) + rnd) - 0.5) * 2 * o.tremble : 0;
      const faceDir = (p.facing === 'left' ? -1 : 1) * o.face;
      R.flip.setAttribute('transform', faceDir < 0 ? 'translate(240 0) scale(-1 1)' : '');
      R.root.setAttribute('transform', `translate(${tr.toFixed(2)} ${(o.bob + o.jump).toFixed(2)}) rotate(${o.lean.toFixed(2)} 120 440)`);
      rot(R.armB, o.armB[0], 80, 176); rot(R.foreB, o.armB[1], 80, 228);
      rot(R.armF, o.armF[0], 160, 176); rot(R.foreF, o.armF[1], 160, 228);
      rot(R.legL, o.legL[0], 108, 296); rot(R.shinL, o.legL[1], 108, 368);
      rot(R.legR, o.legR[0], 132, 296); rot(R.shinR, o.legR[1], 132, 368);
      R.head.setAttribute('transform', `translate(0 ${o.headY.toFixed(2)}) rotate(${o.head.toFixed(2)} 120 160)`);
      R.torso.setAttribute('transform', `translate(120 300) scale(1 ${(1 + Math.sin(t * 2.2 + rnd * 6) * 0.012).toFixed(4)}) translate(-120 -300)`);
      if (R.shadow) R.shadow.setAttribute('rx', (54 * (1 + o.jump / 160)).toFixed(1));
      const [bIn, bUp] = ex.brows;
      R.browL.setAttribute('transform', `translate(0 ${bUp}) rotate(${bIn} 110 72)`);
      R.browR.setAttribute('transform', `translate(0 ${ex.browAsym ? bUp - 8 : bUp}) rotate(${ex.browAsym ? -bIn * 0.3 : -bIn} 130 72)`);
      const eyeMode = o.blink ? 'blink' : ex.eyes || 'dot';
      R.eyes.forEach((g, i) => {
        const white = g.querySelector('.tn-white'), pupil = g.querySelector('.tn-pupil'), closed = g.querySelector('.tn-closed'), lid = g.querySelector('.tn-lid');
        white.style.display = eyeMode === 'big' || eyeMode === 'zombie' ? '' : 'none';
        closed.style.display = eyeMode === 'closed' ? '' : 'none';
        lid.style.display = eyeMode === 'sleepy' || eyeMode === 'zombie' ? '' : 'none';
        pupil.style.display = eyeMode === 'closed' ? 'none' : '';
        const lx = o.eyes * 5;
        pupil.setAttribute('cx', lx.toFixed(1));
        pupil.setAttribute('ry', eyeMode === 'blink' ? '1.2' : eyeMode === 'zombie' ? '2.5' : eyeMode === 'big' ? '6' : '7.5');
        pupil.setAttribute('rx', eyeMode === 'zombie' ? '2.5' : '5.5');
        if (eyeMode === 'zombie') pupil.setAttribute('cy', i ? '3' : '-2');
      });
      setMouth(ex.mouth, o.talkLevel || 0);
      R.sweat.style.display = ex.sweat ? '' : 'none';
      if (ex.sweat) R.sweat.setAttribute('transform', `translate(0 ${((t * 30) % 20).toFixed(1)})`);
      R.tear.style.display = o.cry ? '' : 'none';
      if (o.cry) R.tear.setAttribute('transform', `translate(0 ${((t * 40) % 30).toFixed(1)})`);
      R.blush.forEach((b) => b.setAttribute('opacity', ex.blush ? '0.8' : '0'));
      if (R.flame) R.flame.setAttribute('transform', `scale(${(1 + Math.sin(t * 17) * 0.08).toFixed(3)} ${(1 + Math.sin(t * 13 + 1) * 0.12).toFixed(3)})`);
      el.style.marginLeft = ((o.x - p.x) / 100 * ctx.W).toFixed(1) + 'px';
    });
    return { el, end };
  }

  const TOON_PARAMS = {
    preset: { type: 'enum', default: '', options: [''].concat(Object.keys(PRESETS)), doc: 'starting look; any field below overrides it' },
    y: { type: 'number', default: 88, doc: 'feet baseline in % of frame height' }, h: { type: 'number', default: 42, doc: 'character height in % of frame height' },
    facing: { type: 'enum', default: 'right', options: ['right', 'left'] },
    skin: { type: 'string', default: '', doc: 'face and hands colour (default white like a cartoon; zombie green)' },
    shirt: { type: 'string', default: '', doc: 'body colour or CSS variable' }, pants: { type: 'string', default: '' },
    hat: { type: 'enum', default: '', options: [''].concat(Object.keys(HATS)), doc: 'empty keeps the preset; none removes it' }, hatColor: { type: 'string', default: '' },
    hair: { type: 'enum', default: '', options: [''].concat(Object.keys(HAIR)) }, hairColor: { type: 'string', default: '' },
    beard: { type: 'enum', default: '', options: ['', 'none', 'full', 'stubble', 'mustache'] }, beardColor: { type: 'string', default: '' },
    extras: { type: 'array', default: [], doc: 'backpack, cape, tie, bowtie, badge, scarf, apron, stethoscope, vest, belt, sash, necklace, glasses, sunglasses, eyepatch, bandage, freckles, scar, earrings (colours: capeColor, tieColor, scarfColor, vestColor, beltColor, sashColor, gemColor, backpackColor)' },
    prop: { type: 'enum', default: '', options: [''].concat(Object.keys(PROPS)), doc: 'item in the front hand' },
    expression: { type: 'enum', default: '', options: [''].concat(Object.keys(EXPR)) },
    zombie: { type: 'boolean', default: false, doc: 'undead look and default shamble pose' }, torn: { type: 'boolean', default: false },
    depth: { type: 'number', default: 0, doc: '0 foreground to 1 far background (blur and darken)' },
    actions: { type: 'array', default: [], doc: "[{do: walk|run|shamble (with to: x%), wave, point (dir), talk, look (dir), shock, jump, cheer, shrug, nod, shake, think, scared, cry, laugh, angry, crouch, fall, hold, raise, hug, turn, pull, at, duration, expression}]" },
    lipsync: { type: 'string', default: '', doc: "'voice' or an audio asset id from speak" }, lipsyncAt: { type: 'number', default: 0 },
    parts: { type: 'object', default: null, doc: 'custom SVG markup in the 240x480 rig space: {head, body, prop, front}; head parts move with the head, prop with the hand' },
    enter: { type: 'enum', default: 'pop', options: ['pop', 'fade', 'rise', 'none'] }
  };

  reg.define('toon', {
    category: 'character', description: 'Story cartoon character in the bold outlined style of animated story channels: big white round head, expressive brows and eyes, coloured body, stick limbs. Build any cast from presets (kid, teen-girl, teen-boy, old-man, old-woman, police, soldier, doctor, nurse, teacher, scientist, businessman, chef, biker, beekeeper, thief, zombie, hero, firefighter, astronaut, pirate, wizard, king, queen, princess, ninja, farmer, artist, detective, graduate, builder, viking, mail-carrier, singer, athlete, photographer) or from parts (hats, hair, beards, extras, props, colours, custom SVG parts). Acts with walk, run, shamble, wave, point, talk with lip sync, shock, cheer, scared, cry, laugh, fall, hug and more, each with an expression.',
    params: TOON_PARAMS,
    example: "component('toon', { preset: 'teen-girl', x: 30, shirt: '#d94b3d', prop: 'flashlight', actions: [{ do: 'run', at: 0.3, duration: 2, to: 60, expression: 'scared' }, { do: 'look', dir: 'left', at: 2.4, duration: 1 }] })"
  }, (ctx, p, h) => buildToon(ctx, p, h, 'auc-toon'));

  reg.define('toon-crowd', {
    category: 'character', description: 'A crowd of toon characters (people or zombies) in depth rows: each one is varied (colours, hair, hats, speed, sway), they shamble, walk or mill around. Use for zombie hordes, protests, audiences, city streets.',
    params: {
      count: { type: 'number', default: 12 }, zombie: { type: 'boolean', default: true }, x0: { type: 'number', default: 0, doc: 'left edge %' }, x1: { type: 'number', default: 100, doc: 'right edge %' },
      y: { type: 'number', default: 92, doc: 'front row baseline %' }, rows: { type: 'number', default: 3 }, h: { type: 'number', default: 34 },
      move: { type: 'enum', default: 'shamble', options: ['shamble', 'walk', 'run', 'idle', 'cheer'] }, dir: { type: 'enum', default: 'right', options: ['right', 'left', 'toward'] },
      speed: { type: 'number', default: 1 }, palette: { type: 'array', default: [], doc: 'shirt colours to pick from' }, reach: { type: 'boolean', default: true, doc: 'zombies reach upward/forward with arms' }
    },
    example: "component('toon-crowd', { count: 14, zombie: true, rows: 3, move: 'shamble', dir: 'right', at: 0.2 })"
  }, (ctx, p, h) => {
    const n = Math.max(1, Math.min(60, Math.round(p.count)));
    const pal = p.palette && p.palette.length ? p.palette : (p.zombie ? ['#6b6f5a', '#5a6470', '#7a5a4a', '#4a5a4a', '#6a5a6a'] : ['#d94b3d', '#3a6ab8', '#f2c94c', '#2f9e8f', '#7a4fc4', '#e07a3a']);
    const hairs = ['messy', 'bowl', 'spiky', 'side', 'curly', 'long', 'bald', 'wild'];
    const els = [];
    let end = ctx.D;
    for (let i = 0; i < n; i++) {
      const r = hash(i * 7.31 + (ctx.seed || 1));
      const row = i % Math.max(1, p.rows);
      const depth = p.rows > 1 ? row / (p.rows - 1) : 0;
      const x = p.x0 + (p.x1 - p.x0) * ((i + hash(i * 3.3) * 0.8) / n);
      const y = p.y - depth * 9;
      const hh = p.h * (1 - depth * 0.35) * (0.9 + hash(i * 5.7) * 0.2);
      const dx = (p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0) * (p.move === 'run' ? 30 : p.move === 'walk' ? 18 : 10) * p.speed;
      const dur = Math.max(0.5, ctx.D - (+p.at || 0));
      const acts = p.move === 'idle' ? [] : p.move === 'cheer' ? [{ do: 'cheer', at: (+p.at || 0) + hash(i) * 0.5, duration: dur }] : [{ do: p.move, at: (+p.at || 0) + hash(i * 2.2) * 0.6, duration: dur, to: x + dx * (0.7 + hash(i * 9) * 0.6) }];
      if (p.zombie && p.reach && hash(i * 4.4) > 0.6) acts.push({ do: 'raise', at: (+p.at || 0) + 0.4 + hash(i) * 2, duration: 1.2 + hash(i * 6) * 1.5 });
      const res = buildToon(ctx, {
        x, y, h: hh, at: (+p.at || 0) + hash(i * 1.7) * 0.4, duration: p.duration, exit: p.exit, zombie: p.zombie, torn: p.zombie, depth: depth * 0.8,
        shirt: pal[Math.floor(r * pal.length)], hair: hairs[Math.floor(hash(i * 8.8) * hairs.length)], hairColor: p.zombie ? '#3d3a30' : ['#2b1d16', '#4a3426', '#d9c27a', '#111'][i % 4],
        skin: p.zombie ? ['#a8c49a', '#9cb58f', '#b3c7a6', '#94ad8c'][i % 4] : '', facing: p.dir === 'left' ? 'left' : 'right', expression: p.zombie ? 'zombie' : (p.move === 'cheer' ? 'happy' : 'neutral'),
        actions: acts, enter: 'fade', layer: (p.layer || 'crowd') + '-' + i
      }, h, 'auc-toon auc-crowd');
      els.push(res.el);
      end = res.end;
    }
    return { el: els[0], end };
  });
})();
