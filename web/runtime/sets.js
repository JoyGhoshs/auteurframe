(function () {
  const reg = window.AU_COMPONENTS;
  if (!reg) return;
  const INK = '#221c22';
  const S = `stroke="${INK}" stroke-width="6" stroke-linejoin="round"`;
  const S4 = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const col = (v, fb) => (v ? (String(v).startsWith('--') ? `var(${v})` : v) : fb);
  const LIT = '#f6d06b', DARKWIN = '#3a4256';

  function windows(x0, y0, cols, rows, w, h, gx, gy, o, seed) {
    let out = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = hash(seed + r * 31 + c * 7);
      const lit = o.night ? k > 0.45 : k > 0.85;
      out += `<rect class="${lit && o.night ? 'tp-light' : ''}" data-k="${k.toFixed(3)}" x="${x0 + c * gx}" y="${y0 + r * gy}" width="${w}" height="${h}" rx="2" fill="${lit ? LIT : (o.night ? DARKWIN : '#bcd7ea')}" ${S4}/>`;
    }
    return out;
  }
  const smoke = (x, y, n) => Array.from({ length: n || 4 }, (_, i) => `<circle class="tp-smoke" data-i="${i}" cx="${x}" cy="${y}" r="${14 + i * 4}" fill="#9a9aa0" opacity=".6"/>`).join('');
  const flame = (x, y, s) => `<g class="tp-flame" data-x="${x}" data-y="${y}"><path d="M${x} ${y - 70 * s} Q${x + 34 * s} ${y - 30 * s} ${x + 20 * s} ${y} L${x - 20 * s} ${y} Q${x - 34 * s} ${y - 30 * s} ${x} ${y - 70 * s} Z" fill="#ff8a2a" ${S4}/><path d="M${x} ${y - 40 * s} Q${x + 14 * s} ${y - 16 * s} ${x + 9 * s} ${y} L${x - 9 * s} ${y} Q${x - 14 * s} ${y - 16 * s} ${x} ${y - 40 * s} Z" fill="#ffd34d"/></g>`;
  const wheel = (cx, cy, r) => `<g class="tp-wheel" data-cx="${cx}" data-cy="${cy}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2b2b30" ${S}/><circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="#b8b8c0" ${S4}/><path d="M${cx - r * 0.42} ${cy} H${cx + r * 0.42}" stroke="${INK}" stroke-width="3"/></g>`;

  const P = {
    house: { vb: [300, 300], svg: (o) => `<rect x="196" y="40" width="34" height="70" fill="#a35b45" ${S}/>${smoke(213, 30, 4)}<path d="M20 150 L150 40 L280 150 Z" fill="${col(o.roof, '#c9503b')}" ${S}/>
      <rect x="40" y="148" width="220" height="146" fill="${col(o.color, '#f2e3c6')}" ${S}/><rect x="128" y="200" width="46" height="94" fill="#7a4a2e" ${S}/>${windows(64, 180, 1, 1, 44, 40, 0, 0, o, 3)}${windows(196, 180, 1, 1, 44, 40, 0, 0, o, 9)}` },
    apartment: { vb: [260, 520], svg: (o) => `<rect x="20" y="40" width="220" height="476" fill="${col(o.color, '#c7b9a5')}" ${S}/><rect x="10" y="30" width="240" height="20" fill="#8a7d6c" ${S}/>
      <rect x="150" y="2" width="50" height="30" fill="#8b8b8b" ${S4}/>${windows(42, 70, 4, 9, 30, 30, 48, 48, o, o.seed || 11)}<rect x="104" y="456" width="52" height="60" fill="#5a4636" ${S}/>` },
    tower: { vb: [200, 760], svg: (o) => `<path d="M100 2 V60" stroke="${INK}" stroke-width="5"/><circle class="tp-blink" cx="100" cy="6" r="8" fill="#ff4d3a"/><rect x="30" y="60" width="140" height="696" fill="${col(o.color, '#5b6575')}" ${S}/>
      ${windows(46, 84, 3, 15, 26, 30, 40, 44, o, o.seed || 21)}` },
    shop: { vb: [300, 260], svg: (o) => `<rect x="20" y="40" width="260" height="216" fill="${col(o.color, '#f1e4c8')}" ${S}/><rect x="30" y="50" width="240" height="44" fill="#fff" ${S4}/>
      <text x="150" y="82" text-anchor="middle" font-family="var(--font-display), sans-serif" font-weight="800" font-size="30" fill="${INK}">${(o.label || 'SHOP').slice(0, 14)}</text>
      <path d="M20 100 H280 L268 132 Q256 146 244 132 Q232 146 220 132 Q208 146 196 132 Q184 146 172 132 Q160 146 148 132 Q136 146 124 132 Q112 146 100 132 Q88 146 76 132 Q64 146 52 132 Q40 146 30 132 Z" fill="${col(o.awning, '#d94b3d')}" ${S4}/>
      <rect x="40" y="152" width="130" height="96" fill="${o.night ? LIT : '#bcd7ea'}" class="${o.night ? 'tp-light' : ''}" ${S4}/><rect x="190" y="152" width="70" height="104" fill="#7a4a2e" ${S4}/>` },
    pharmacy: { vb: [300, 280], svg: (o) => P.shop.svg(Object.assign({ label: 'PHARMACY', awning: '#2f9e6f' }, o)).replace('<rect x="20" y="40"', '<g transform="translate(0 20)"><rect x="20" y="40"') + `</g><g class="tp-blink" data-slow="1"><rect x="128" y="-2" width="44" height="44" rx="6" fill="#2fbf6f" ${S4}/><path d="M150 6 V34 M136 20 H164" stroke="#fff" stroke-width="9"/></g>` },
    hospital: { vb: [360, 340], svg: (o) => `<rect x="20" y="60" width="320" height="276" fill="#f4f4f2" ${S}/><rect x="140" y="10" width="80" height="60" fill="#fff" ${S}/><path d="M180 18 V62 M158 40 H202" stroke="#e23b3b" stroke-width="14"/>
      ${windows(40, 90, 5, 3, 36, 34, 58, 58, o, 41)}<rect x="152" y="266" width="56" height="70" fill="#9fc6dd" ${S4}/>` },
    school: { vb: [360, 320], svg: (o) => `<rect x="150" y="10" width="60" height="90" fill="#c9503b" ${S}/><path d="M180 10 V-30" stroke="${INK}" stroke-width="4"/><path class="tp-flag" d="M180 -30 L216 -20 L180 -10 Z" fill="#2f6fd6" ${S4}/>
      <rect x="20" y="100" width="320" height="216" fill="#e9c98f" ${S}/>${windows(40, 130, 5, 2, 36, 40, 58, 70, o, 51)}<rect x="160" y="246" width="40" height="70" fill="#7a4a2e" ${S4}/>` },
    church: { vb: [240, 380], svg: (o) => `<path d="M120 0 V40 M104 18 H136" stroke="${INK}" stroke-width="7"/><path d="M80 120 L120 40 L160 120 Z" fill="#8a7d6c" ${S}/><rect x="80" y="118" width="80" height="80" fill="#efe6d8" ${S}/>
      <path d="M20 220 L120 160 L220 220 Z" fill="#8a7d6c" ${S}/><rect x="30" y="218" width="180" height="158" fill="#efe6d8" ${S}/><path d="M100 376 V306 Q120 280 140 306 V376 Z" fill="#7a4a2e" ${S4}/><circle cx="120" cy="150" r="16" fill="${o.night ? LIT : '#bcd7ea'}" ${S4}/>` },
    factory: { vb: [420, 300], svg: (o) => `<rect x="300" y="10" width="40" height="150" fill="#8a6a5a" ${S}/>${smoke(320, 4, 5)}<path d="M20 120 L90 70 L90 120 L160 70 L160 120 L230 70 L230 120 L300 70 L300 296 L20 296 Z" fill="#9a9aa0" ${S}/>
      <rect x="300" y="150" width="100" height="146" fill="#7f7f86" ${S}/>${windows(40, 160, 6, 2, 26, 30, 42, 60, o, 61)}` },
    tent: { vb: [260, 180], svg: () => `<path d="M10 176 L130 10 L250 176 Z" fill="#e2a33a" ${S}/><path d="M130 10 L100 176 L160 176 Z" fill="#7a4a2e" ${S4}/>` },
    cabin: { vb: [300, 240], svg: (o) => `<path d="M10 100 L150 10 L290 100 Z" fill="#6b4a32" ${S}/><rect x="30" y="98" width="240" height="138" fill="#a2693f" ${S}/>${[120, 146, 172, 198].map((y) => `<path d="M30 ${y} H270" stroke="${INK}" stroke-width="3"/>`).join('')}
      <rect x="126" y="160" width="48" height="76" fill="#5a3a24" ${S4}/>${windows(56, 130, 1, 1, 40, 36, 0, 0, o, 71)}` },
    bridge: { vb: [1200, 300], svg: () => `<rect x="0" y="200" width="1200" height="40" fill="#7f7f86" ${S}/><path d="M0 200 L150 60 L300 200 L450 60 L600 200 L750 60 L900 200 L1050 60 L1200 200" fill="none" stroke="#b33a2e" stroke-width="16"/>
      <path d="M150 60 H1050" stroke="#b33a2e" stroke-width="16"/>${[150, 450, 750, 1050].map((x) => `<rect x="${x - 14}" y="200" width="28" height="100" fill="#6a6a70" ${S4}/>`).join('')}` },
    gate: { vb: [500, 300], svg: () => `<rect x="10" y="40" width="40" height="256" fill="#5b6575" ${S}/><rect x="450" y="40" width="40" height="256" fill="#5b6575" ${S}/>
      <g class="tp-doorL" data-cx="50"><rect x="50" y="60" width="200" height="220" fill="none" ${S}/>${[80, 110, 140, 170, 200, 230].map((x) => `<path d="M${x} 60 V280" stroke="${INK}" stroke-width="6"/>`).join('')}</g>
      <g class="tp-doorR" data-cx="450"><rect x="250" y="60" width="200" height="220" fill="none" ${S}/>${[280, 310, 340, 370, 400, 430].map((x) => `<path d="M${x} 60 V280" stroke="${INK}" stroke-width="6"/>`).join('')}</g>` },
    fence: { vb: [400, 140], svg: () => `<path d="M0 60 H400 M0 110 H400" stroke="${INK}" stroke-width="8"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${20 + i * 50} 136 V30 L${32 + i * 50} 14 L${44 + i * 50} 30 V136 Z" fill="#f4efe4" ${S4}/>`).join('')}` },
    barricade: { vb: [400, 200], svg: () => Array.from({ length: 9 }, (_, i) => { const r = i < 5 ? 0 : 1; const x = 20 + (i - (r ? 5 : 0)) * 74 + r * 37; return `<rect x="${x}" y="${150 - r * 50}" width="80" height="48" rx="20" fill="#b9a374" ${S4}/>`; }).join('') + `<path d="M10 60 Q40 40 70 60 T130 60 T190 60 T250 60 T310 60 T370 60" fill="none" stroke="#888" stroke-width="4" stroke-dasharray="6 6"/>` },
    wall: { vb: [400, 200], svg: () => `<rect x="0" y="0" width="400" height="200" fill="#b5634a" ${S}/>${Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<rect x="${(c * 70 + (r % 2) * 35) % 400}" y="${r * 40}" width="70" height="40" fill="none" stroke="${INK}" stroke-width="3"/>`).join('')).join('')}` },
    car: { vb: [320, 170], svg: (o) => `<path d="M20 120 L30 80 Q40 60 70 58 L100 24 Q110 12 130 12 L220 12 Q240 12 254 30 L280 60 Q306 64 306 90 L306 120 Z" fill="${col(o.color, '#d94b3d')}" ${S}/>
      <path d="M110 30 L134 22 L170 22 L170 58 L96 58 Z M182 22 L220 22 Q234 24 244 40 L256 58 L182 58 Z" fill="#bcd7ea" ${S4}/><circle cx="296" cy="84" r="8" fill="${LIT}"/>${wheel(84, 128, 30)}${wheel(246, 128, 30)}` },
    'police-car': { vb: [320, 190], svg: (o) => `<g transform="translate(0 20)">${P.car.svg(Object.assign({ color: '#f4f4f2' }, o))}</g><rect x="60" y="80" width="200" height="22" fill="#24345e"/><rect class="tp-siren" data-c="a" x="140" y="12" width="20" height="18" fill="#2f6fd6" ${S4}/><rect class="tp-siren" data-c="b" x="160" y="12" width="20" height="18" fill="#e23b3b" ${S4}/>` },
    bus: { vb: [460, 220], svg: (o) => `<rect x="10" y="20" width="440" height="160" rx="22" fill="${col(o.color, '#f2c230')}" ${S}/>${windows(34, 44, 6, 1, 52, 52, 66, 0, o, 81)}<rect x="400" y="44" width="36" height="96" fill="#bcd7ea" ${S4}/>${wheel(96, 184, 30)}${wheel(364, 184, 30)}` },
    truck: { vb: [420, 220], svg: (o) => `<rect x="10" y="20" width="270" height="150" fill="${col(o.color, '#5f7442')}" ${S}/><path d="M280 70 H360 L404 120 V170 H280 Z" fill="${col(o.color, '#5f7442')}" ${S}/><path d="M296 82 H352 L384 118 H296 Z" fill="#bcd7ea" ${S4}/>${wheel(80, 180, 32)}${wheel(330, 180, 32)}` },
    bicycle: { vb: [240, 160], svg: () => `<circle cx="50" cy="110" r="44" fill="none" ${S}/><circle cx="190" cy="110" r="44" fill="none" ${S}/><path d="M50 110 L100 50 L170 50 L190 110 M100 50 L120 110 L170 50 M90 36 H120 M170 50 L176 28 H196" fill="none" ${S}/>` },
    boat: { vb: [360, 220], svg: (o) => `<path d="M178 10 V140" stroke="${INK}" stroke-width="6"/><path d="M184 18 L300 130 L184 130 Z" fill="#f4f4f2" ${S}/><path d="M20 140 H340 L300 200 H60 Z" fill="${col(o.color, '#b5634a')}" ${S}/>` },
    helicopter: { vb: [420, 220], svg: (o) => `<rect class="tp-rotor" data-cx="200" x="40" y="12" width="320" height="10" rx="5" fill="${INK}"/><path d="M200 22 V48" stroke="${INK}" stroke-width="8"/>
      <path d="M90 60 Q110 46 200 46 Q290 46 300 110 Q300 150 230 150 H110 Q70 150 70 110 Z" fill="${col(o.color, '#566b3a')}" ${S}/><path d="M220 60 Q270 64 280 104 H220 Z" fill="#bcd7ea" ${S4}/><path d="M80 100 L10 90 L10 120 L80 116" fill="${col(o.color, '#566b3a')}" ${S}/>
      <path d="M110 150 V180 M200 150 V180 M80 180 H240" stroke="${INK}" stroke-width="7"/>` },
    plane: { vb: [440, 200], svg: () => `<path d="M20 100 Q40 70 120 70 H380 Q430 76 430 100 Q430 124 380 130 H120 Q40 130 20 100 Z" fill="#f4f4f2" ${S}/><path d="M200 100 L260 10 H300 L270 100 Z M200 100 L260 190 H300 L270 100 Z M60 80 L30 30 H60 L100 80 Z" fill="#c9cdd6" ${S4}/>${windows(140, 84, 7, 1, 18, 18, 30, 0, {}, 91)}` },
    tree: { vb: [240, 320], svg: (o) => `<rect x="104" y="180" width="32" height="136" fill="#7a4a2e" ${S}/><g class="tp-sway"><circle cx="120" cy="120" r="80" fill="${col(o.color, '#4f8a4a')}" ${S}/><circle cx="70" cy="160" r="50" fill="${col(o.color, '#4f8a4a')}" ${S}/><circle cx="170" cy="160" r="50" fill="${col(o.color, '#4f8a4a')}" ${S}/></g>` },
    pine: { vb: [200, 340], svg: (o) => `<rect x="88" y="260" width="24" height="76" fill="#7a4a2e" ${S}/><g class="tp-sway"><path d="M100 10 L170 120 H130 L180 200 H140 L190 270 H10 L60 200 H20 L70 120 H30 Z" fill="${col(o.color, '#2f6b4a')}" ${S}/></g>` },
    palm: { vb: [260, 360], svg: () => `<path d="M140 356 Q120 220 150 110" fill="none" stroke="#9a6a3a" stroke-width="22"/><g class="tp-sway">${[-70, -30, 10, 50, 100].map((a) => `<path d="M150 110 Q${150 + Math.cos(a * Math.PI / 180) * 70} ${110 + Math.sin(a * Math.PI / 180) * 70 - 30} ${150 + Math.cos(a * Math.PI / 180) * 120} ${110 + Math.sin(a * Math.PI / 180) * 120}" fill="none" stroke="#3f8a4a" stroke-width="20" stroke-linecap="round"/>`).join('')}</g>` },
    bush: { vb: [220, 120], svg: (o) => `<path d="M10 116 Q0 60 50 56 Q60 10 110 26 Q160 0 180 50 Q220 60 210 116 Z" fill="${col(o.color, '#5f9a4f')}" ${S}/>` },
    rock: { vb: [200, 120], svg: () => `<path d="M10 116 L30 50 L90 20 L160 34 L190 116 Z" fill="#9a9aa0" ${S}/>` },
    lamp: { vb: [120, 420], svg: (o) => `<path d="M60 416 V60 Q60 30 90 30" fill="none" stroke="${INK}" stroke-width="10"/><path d="M76 30 H112 L104 52 H84 Z" fill="#3a3a40" ${S4}/>
      ${o.night !== false ? `<path class="tp-light" d="M86 52 L40 416 H160 L104 52 Z" fill="rgba(255,220,140,.22)"/><circle class="tp-light" cx="94" cy="56" r="12" fill="${LIT}"/>` : ''}` },
    'traffic-light': { vb: [100, 360], svg: () => `<rect x="44" y="140" width="12" height="216" fill="${INK}"/><rect x="20" y="10" width="60" height="140" rx="12" fill="#2b2b30" ${S}/>
      <circle class="tp-tl" data-c="0" cx="50" cy="40" r="16" fill="#5a1e1e"/><circle class="tp-tl" data-c="1" cx="50" cy="80" r="16" fill="#5a4a1e"/><circle class="tp-tl" data-c="2" cx="50" cy="120" r="16" fill="#1e5a2e"/>` },
    billboard: { vb: [400, 300], svg: (o) => `<path d="M120 300 V180 M280 300 V180" stroke="${INK}" stroke-width="12"/><rect x="10" y="10" width="380" height="180" fill="#fff" ${S}/>
      <text x="200" y="118" text-anchor="middle" font-family="var(--font-display), sans-serif" font-weight="900" font-size="54" fill="${INK}">${(o.label || 'HELLO').slice(0, 12)}</text>` },
    sign: { vb: [200, 220], svg: (o) => `<path d="M100 216 V90" stroke="${INK}" stroke-width="10"/><rect x="10" y="10" width="180" height="84" rx="8" fill="${col(o.color, '#2f9e6f')}" ${S}/>
      <text x="100" y="64" text-anchor="middle" font-family="var(--font-display), sans-serif" font-weight="800" font-size="30" fill="#fff">${(o.label || 'EXIT').slice(0, 10)}</text>` },
    bench: { vb: [260, 120], svg: () => `<rect x="10" y="20" width="240" height="20" fill="#a2693f" ${S4}/><rect x="10" y="56" width="240" height="20" fill="#a2693f" ${S4}/><path d="M40 76 V116 M220 76 V116" stroke="${INK}" stroke-width="10"/>` },
    table: { vb: [260, 140], svg: () => `<rect x="10" y="10" width="240" height="22" fill="#a2693f" ${S}/><path d="M40 32 V136 M220 32 V136" stroke="${INK}" stroke-width="12"/>` },
    chair: { vb: [120, 200], svg: () => `<path d="M20 10 V190 M100 120 V190 M20 110 H100" stroke="${INK}" stroke-width="10"/><rect x="14" y="100" width="94" height="18" fill="#a2693f" ${S4}/><rect x="14" y="10" width="20" height="100" fill="#a2693f" ${S4}/>` },
    bed: { vb: [360, 180], svg: () => `<rect x="10" y="20" width="40" height="156" fill="#7a4a2e" ${S}/><rect x="40" y="90" width="310" height="60" fill="#f4f4f2" ${S}/><rect x="60" y="70" width="80" height="30" rx="12" fill="#fff" ${S4}/><rect x="150" y="84" width="200" height="40" rx="8" fill="#6d8fd6" ${S4}/>` },
    sofa: { vb: [360, 180], svg: (o) => `<rect x="10" y="60" width="340" height="90" rx="20" fill="${col(o.color, '#7a4fc4')}" ${S}/><rect x="40" y="20" width="280" height="70" rx="20" fill="${col(o.color, '#7a4fc4')}" ${S}/><path d="M40 150 V176 M320 150 V176" stroke="${INK}" stroke-width="10"/>` },
    tv: { vb: [300, 220], svg: () => `<rect x="10" y="10" width="280" height="170" rx="10" fill="#2b2b30" ${S}/><rect class="tp-screen" x="28" y="26" width="244" height="138" fill="#5fb3e8"/><path d="M110 216 L150 180 L190 216" fill="none" stroke="${INK}" stroke-width="8"/>` },
    computer: { vb: [300, 240], svg: () => `<rect x="30" y="10" width="240" height="150" rx="10" fill="#2b2b30" ${S}/><rect class="tp-screen" x="46" y="24" width="208" height="122" fill="#7fd0ff"/><path d="M130 160 V196 M170 160 V196 M90 200 H210" stroke="${INK}" stroke-width="10"/><rect x="60" y="210" width="180" height="24" rx="6" fill="#ddd" ${S4}/>` },
    desk: { vb: [340, 180], svg: () => `<rect x="10" y="10" width="320" height="28" fill="#a2693f" ${S}/><rect x="220" y="38" width="100" height="138" fill="#8a5a34" ${S}/><path d="M30 38 V176" stroke="${INK}" stroke-width="12"/>` },
    door: { vb: [140, 260], svg: (o) => `<rect x="10" y="10" width="120" height="246" fill="${col(o.color, '#7a4a2e')}" ${S}/><circle cx="104" cy="140" r="8" fill="#f1c84b" ${S4}/>` },
    window: { vb: [200, 200], svg: (o) => `<rect x="10" y="10" width="180" height="180" fill="${o.night ? '#1d2b4a' : '#bcd7ea'}" ${S}/><path d="M100 10 V190 M10 100 H190" stroke="${INK}" stroke-width="8"/>` },
    beehive: { vb: [200, 240], svg: () => `${[0, 1, 2, 3].map((i) => `<rect x="${30 + i * 6}" y="${40 + i * 44}" width="${140 - i * 12}" height="44" fill="#f1c84b" ${S4}/>`).join('')}<path d="M100 236 V218" stroke="${INK}" stroke-width="6"/>
      ${Array.from({ length: 6 }, (_, i) => `<g class="tp-bee" data-i="${i}"><ellipse rx="7" ry="5" fill="#f1c84b" ${S4}/><path d="M-2 -5 V5" stroke="${INK}" stroke-width="3"/></g>`).join('')}` },
    campfire: { vb: [200, 200], svg: () => `${flame(100, 160, 1.2)}<path d="M30 180 L170 150 M30 150 L170 180" stroke="#7a4a2e" stroke-width="16" stroke-linecap="round"/>${smoke(100, 70, 3)}` },
    fire: { vb: [200, 220], svg: () => `${flame(70, 216, 1.3)}${flame(130, 216, 1.6)}${flame(100, 216, 1.1)}${smoke(100, 40, 5)}` },
    radio: { vb: [220, 160], svg: () => `<path d="M150 40 L190 0" stroke="${INK}" stroke-width="6"/><rect x="10" y="40" width="200" height="116" rx="16" fill="#6b5a4a" ${S}/><circle cx="70" cy="98" r="34" fill="#3a302a" ${S4}/><rect class="tp-screen" x="122" y="66" width="70" height="26" fill="#f6d06b" ${S4}/><circle cx="140" cy="124" r="10" fill="#ddd" ${S4}/><circle cx="176" cy="124" r="10" fill="#ddd" ${S4}/>` },
    barrel: { vb: [140, 180], svg: () => `<rect x="10" y="10" width="120" height="166" rx="18" fill="#3f6b8a" ${S}/><path d="M10 50 H130 M10 136 H130" stroke="${INK}" stroke-width="5"/>` },
    crate: { vb: [160, 160], svg: () => `<rect x="10" y="10" width="140" height="140" fill="#c9954f" ${S}/><path d="M10 10 L150 150 M150 10 L10 150" stroke="${INK}" stroke-width="5"/>` },
    'radio-tower': { vb: [200, 600], svg: () => `<path d="M100 20 L30 596 M100 20 L170 596 M54 400 H146 M70 260 H130 M82 140 H118 M54 400 L130 260 M146 400 L70 260" fill="none" ${S}/><circle class="tp-blink" cx="100" cy="16" r="10" fill="#ff4d3a"/>` },
    'water-tower': { vb: [220, 400], svg: () => `<rect x="30" y="20" width="160" height="140" rx="20" fill="#9fb3c4" ${S}/><path d="M50 160 L30 396 M170 160 L190 396 M40 280 H180 M50 160 L180 280 M170 160 L40 280" fill="none" ${S}/>` },
    windmill: { vb: [260, 420], svg: () => `<path d="M100 416 L112 140 H148 L160 416 Z" fill="#efe6d8" ${S}/><g class="tp-spin" data-cx="130" data-cy="140">${[0, 90, 180, 270].map((a) => `<rect x="124" y="20" width="20" height="120" fill="#c9954f" ${S4} transform="rotate(${a} 130 140)"/>`).join('')}</g><circle cx="130" cy="140" r="12" fill="${INK}"/>` },
    mountain: { vb: [600, 320], svg: (o) => `<path d="M0 316 L200 40 L320 180 L420 90 L600 316 Z" fill="${col(o.color, '#6d7f9a')}" ${S}/><path d="M200 40 L240 96 L210 90 L180 110 L164 90 Z M420 90 L452 134 L420 128 L398 142 Z" fill="#fff"/>` },
    cloud: { vb: [300, 140], svg: () => `<path d="M40 130 Q0 130 10 96 Q20 64 60 72 Q70 22 130 26 Q186 10 206 60 Q260 50 280 92 Q300 130 250 130 Z" fill="#fff" ${S4}/>` },
    sun: { vb: [240, 240], svg: () => `<g class="tp-spin" data-cx="120" data-cy="120">${Array.from({ length: 12 }, (_, i) => `<path d="M120 4 V34" stroke="#f2a530" stroke-width="10" stroke-linecap="round" transform="rotate(${i * 30} 120 120)"/>`).join('')}</g><circle cx="120" cy="120" r="66" fill="#ffd34d" ${S}/>` },
    moon: { vb: [200, 200], svg: () => `<circle cx="100" cy="100" r="80" fill="#f4efd8" ${S}/><circle cx="72" cy="80" r="14" fill="#ddd6b8"/><circle cx="128" cy="124" r="20" fill="#ddd6b8"/><circle cx="120" cy="66" r="9" fill="#ddd6b8"/>` },
    well: { vb: [220, 260], svg: () => `<path d="M30 60 L110 10 L190 60 Z" fill="#c9503b" ${S}/><path d="M50 60 V160 M170 60 V160" stroke="#7a4a2e" stroke-width="10"/><rect x="20" y="150" width="180" height="106" fill="#9a9aa0" ${S}/>` },
    mailbox: { vb: [120, 220], svg: () => `<path d="M60 216 V110" stroke="#7a4a2e" stroke-width="12"/><path d="M10 110 V60 Q10 20 60 20 Q110 20 110 60 V110 Z" fill="#2f6fd6" ${S}/>` },
    hydrant: { vb: [120, 180], svg: () => `<rect x="30" y="40" width="60" height="136" rx="10" fill="#e23b3b" ${S}/><rect x="10" y="80" width="100" height="24" rx="8" fill="#e23b3b" ${S4}/><path d="M30 40 Q60 0 90 40 Z" fill="#e23b3b" ${S4}/>` },
    'trash-can': { vb: [140, 180], svg: () => `<rect x="20" y="40" width="100" height="136" rx="6" fill="#6b7a6a" ${S}/><rect x="10" y="24" width="120" height="20" rx="6" fill="#5a6859" ${S4}/>` },
    'satellite-dish': { vb: [220, 240], svg: () => `<path d="M30 140 Q110 220 190 60 Z" fill="#e8e8ec" ${S}/><path d="M110 100 L150 60" stroke="${INK}" stroke-width="6"/><path d="M100 160 V236 M60 236 H140" stroke="${INK}" stroke-width="10"/>` }
  };

  function propEl(name, o) {
    const def = P[name];
    if (!def) return null;
    const d = document.createElement('div');
    d.innerHTML = `<svg viewBox="-20 -40 ${def.vb[0] + 40} ${def.vb[1] + 50}" width="100%" height="100%" overflow="visible">${def.svg(o)}</svg>`;
    return { el: d, vb: def.vb };
  }

  function animateProp(root, t, o, seed) {
    root.querySelectorAll('.tp-smoke').forEach((c) => {
      const i = +c.getAttribute('data-i'), k = ((t * 0.35 + i / 4 + seed) % 1);
      c.setAttribute('transform', `translate(${(Math.sin(k * 5 + i) * 14).toFixed(1)} ${(-k * 110).toFixed(1)}) scale(${(0.6 + k * 1.2).toFixed(2)})`);
      c.setAttribute('opacity', (0.65 * (1 - k)).toFixed(3));
      c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center';
    });
    root.querySelectorAll('.tp-flame').forEach((f, i) => {
      const x = +f.getAttribute('data-x'), y = +f.getAttribute('data-y');
      f.setAttribute('transform', `translate(${x} ${y}) scale(${(1 + Math.sin(t * 15 + i) * 0.08).toFixed(3)} ${(1 + Math.sin(t * 11 + i * 2) * 0.14).toFixed(3)}) translate(${-x} ${-y})`);
    });
    root.querySelectorAll('.tp-light').forEach((l) => { const k = +(l.getAttribute('data-k') || 0.5); l.setAttribute('opacity', (0.82 + 0.18 * Math.sin(t * (3 + k * 9) + k * 20) * (hash(Math.floor(t * 8) + k * 99) > 0.93 ? 3 : 1)).toFixed(3)); });
    root.querySelectorAll('.tp-blink').forEach((b) => { const slow = b.getAttribute('data-slow'); b.setAttribute('opacity', (Math.floor(t * (slow ? 1 : 1.6)) % 2 ? 0.25 : 1).toFixed(2)); });
    root.querySelectorAll('.tp-spin').forEach((g) => g.setAttribute('transform', `rotate(${((t * (o.spin || 40)) % 360).toFixed(1)} ${g.getAttribute('data-cx')} ${g.getAttribute('data-cy')})`));
    root.querySelectorAll('.tp-rotor').forEach((r) => r.setAttribute('transform', `translate(${r.getAttribute('data-cx')} 0) scale(${Math.cos(t * 40).toFixed(3)} 1) translate(${-r.getAttribute('data-cx')} 0)`));
    root.querySelectorAll('.tp-sway').forEach((g) => g.setAttribute('transform', `rotate(${(Math.sin(t * 1.3 + seed * 9) * 2).toFixed(2)} 120 300)`));
    root.querySelectorAll('.tp-siren').forEach((s) => s.setAttribute('opacity', (Math.floor(t * 6) % 2 === (s.getAttribute('data-c') === 'a' ? 0 : 1) ? 1 : 0.25).toFixed(2)));
    root.querySelectorAll('.tp-tl').forEach((l) => { const on = Math.floor(t / 2) % 3; l.setAttribute('fill', +l.getAttribute('data-c') === on ? ['#ff4d3a', '#ffcf3a', '#3adf6a'][on] : ['#5a1e1e', '#5a4a1e', '#1e5a2e'][+l.getAttribute('data-c')]); });
    root.querySelectorAll('.tp-screen').forEach((s) => s.setAttribute('opacity', (0.85 + Math.sin(t * 9) * 0.08).toFixed(3)));
    root.querySelectorAll('.tp-bee').forEach((b) => { const i = +b.getAttribute('data-i'); const a = t * (2 + i * 0.3) + i * 1.7; b.setAttribute('transform', `translate(${(100 + Math.cos(a) * (60 + i * 8)).toFixed(1)} ${(60 + Math.sin(a * 1.3) * 34).toFixed(1)})`); });
    root.querySelectorAll('.tp-flag').forEach((f) => f.setAttribute('transform', `skewY(${(Math.sin(t * 6) * 6).toFixed(1)})`));
  }

  reg.define('toon-prop', {
    category: 'set', description: 'A cartoon object or building in the toon style (thick ink outline, flat colours) that lives and moves: smoke from chimneys and fires, flickering lit windows, blinking antennas, spinning windmills and rotors, rolling wheels, swaying trees, siren lights, opening gates. Vehicles can drive to a position. ' +
      'Objects: ' + Object.keys(P).join(', ') + '.',
    params: {
      name: { type: 'enum', default: 'house', options: Object.keys(P) }, y: { type: 'number', default: 90, doc: 'baseline (bottom) in % of frame height' },
      h: { type: 'number', default: 40, doc: 'height in % of frame height' }, color: { type: 'string', default: '', doc: 'main colour' }, label: { type: 'string', default: '', doc: 'text for shop, billboard, sign' },
      night: { type: 'boolean', default: false, doc: 'lit windows and lamps' }, flip: { type: 'boolean', default: false }, depth: { type: 'number', default: 0, doc: '0 front to 1 far (blur, haze)' },
      drive: { type: 'object', default: null, doc: 'vehicles: {to: x%, at, duration}' }, open: { type: 'number', default: null, doc: 'gate: scene seconds when it opens' },
      burning: { type: 'boolean', default: false, doc: 'adds flames and smoke on top' }, ruined: { type: 'boolean', default: false, doc: 'darkened, cracked, broken windows' },
      parts: { type: 'string', default: '', doc: 'extra SVG markup in the object coordinate space' }, enter: { type: 'enum', default: 'none', options: ['none', 'rise', 'pop', 'fade'] }
    },
    example: "component('toon-prop', { name: 'pharmacy', x: 70, y: 86, h: 38, night: true })"
  }, (ctx, p, h) => {
    const made = propEl(p.name, p);
    if (!made) throw new Error('unknown toon-prop ' + p.name);
    const hpx = p.h / 100 * ctx.H, wpx = hpx * (made.vb[0] + 40) / (made.vb[1] + 50);
    const el = h.box(Object.assign({}, p, { x: null, y: null }), 'auc-prop', { x: 0, y: 0 });
    Object.assign(el.style, { left: (p.x / 100 * ctx.W - wpx / 2) + 'px', top: (p.y / 100 * ctx.H - hpx) + 'px', width: wpx + 'px', height: hpx + 'px', overflow: 'visible' });
    el.appendChild(made.el.firstChild);
    const svg = el.querySelector('svg');
    if (p.parts) svg.insertAdjacentHTML('beforeend', p.parts);
    if (p.burning) svg.insertAdjacentHTML('beforeend', `${flame(made.vb[0] * 0.3, made.vb[1] * 0.35, 1.4)}${flame(made.vb[0] * 0.65, made.vb[1] * 0.3, 1.8)}${smoke(made.vb[0] * 0.5, made.vb[1] * 0.05, 6)}`);
    if (p.ruined) { svg.style.filter = 'saturate(.5) brightness(.75)'; svg.insertAdjacentHTML('beforeend', `<path d="M${made.vb[0] * 0.3} 10 L${made.vb[0] * 0.42} ${made.vb[1] * 0.3} L${made.vb[0] * 0.34} ${made.vb[1] * 0.45} L${made.vb[0] * 0.48} ${made.vb[1] * 0.7}" fill="none" stroke="${INK}" stroke-width="5"/>`); }
    if (p.flip) svg.style.transform = 'scaleX(-1)';
    if (p.depth) { el.style.filter = `blur(${(p.depth * 2.5).toFixed(1)}px) brightness(${(1 - p.depth * 0.3).toFixed(2)}) saturate(${(1 - p.depth * 0.4).toFixed(2)})`; el.style.zIndex = String(-Math.round(p.depth * 10)); }
    const { at, end } = h.span(p);
    if (p.enter === 'rise') ctx.tl.fromTo(el, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'au.softLand' }, at);
    else if (p.enter === 'pop') ctx.tl.fromTo(el, { scale: 0.5, autoAlpha: 0, transformOrigin: '50% 100%' }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2)' }, at);
    else if (p.enter === 'fade') ctx.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at);
    h.exitOut(p, el, end, { y: 0 });
    const seed = hash(p.x * 3.1 + p.h);
    const doors = [svg.querySelector('.tp-doorL'), svg.querySelector('.tp-doorR')];
    ctx.onFrame((t) => {
      animateProp(svg, t, p, seed);
      let dx = 0;
      if (p.drive) {
        const a = +p.drive.at || 0, d = +p.drive.duration || 2;
        const k = ease((t - a) / d);
        dx = ((+p.drive.to || p.x) - p.x) / 100 * ctx.W * k;
        const moving = t > a && t < a + d;
        svg.querySelectorAll('.tp-wheel').forEach((w) => w.setAttribute('transform', `rotate(${(dx * 1.6 * (p.flip ? -1 : 1)).toFixed(1)} ${w.getAttribute('data-cx')} ${w.getAttribute('data-cy')})`));
        el.style.translate = `${dx.toFixed(1)}px ${moving ? (Math.sin(t * 30) * 1.2).toFixed(2) : 0}px`;
      }
      if (p.open != null && doors[0]) {
        const k = ease((t - p.open) / 1.6);
        doors[0].setAttribute('transform', `translate(50 0) scale(${(1 - k * 0.85).toFixed(3)} 1) translate(-50 0)`);
        doors[1].setAttribute('transform', `translate(450 0) scale(${(1 - k * 0.85).toFixed(3)} 1) translate(-450 0)`);
      }
    });
    return { el, end };
  });

  const SKY = {
    dawn: ['#f4b6a0', '#f8dcb4', '#fff1d6'], day: ['#7ec4ef', '#b8e0f7', '#e8f6ff'], sunset: ['#3b4a7a', '#d0603a', '#f2a35a'], dusk: ['#1f2a4a', '#4a3a6a', '#b0587a'], night: ['#0b1124', '#18234a', '#2c3a6a']
  };
  const SETS = {
    'city-night': { time: 'night', far: 'skyline', props: [['apartment', 14, 46], ['tower', 30, 62], ['shop', 50, 26], ['lamp', 62, 34], ['apartment', 78, 50], ['hydrant', 90, 8]], ground: '#3a3a44' },
    'city-day': { time: 'day', far: 'skyline', props: [['apartment', 12, 44], ['shop', 34, 26], ['tree', 50, 26], ['tower', 66, 60], ['bus', 86, 16]], ground: '#8a8a92' },
    'burning-city': { time: 'sunset', far: 'skyline', burning: true, props: [['apartment', 16, 46, { burning: true, ruined: true }], ['tower', 40, 60, { ruined: true }], ['car', 58, 12, { ruined: true, burning: true }], ['barricade', 76, 12], ['apartment', 90, 40, { ruined: true }]], ground: '#4a3a34' },
    street: { time: 'day', far: 'skyline', props: [['shop', 18, 28, { label: 'CAFE' }], ['pharmacy', 44, 30], ['lamp', 60, 34], ['shop', 76, 28, { label: 'MARKET', awning: '#3a6ab8' }], ['traffic-light', 92, 26]], ground: '#8a8a92' },
    suburb: { time: 'day', far: 'hills', props: [['house', 18, 30], ['tree', 34, 28], ['house', 54, 30, { roof: '#3a6ab8' }], ['fence', 72, 10], ['mailbox', 84, 12], ['tree', 94, 30]], ground: '#7fb05a' },
    rooftop: { time: 'sunset', far: 'skyline', props: [['water-tower', 16, 40], ['satellite-dish', 34, 16], ['beehive', 60, 14], ['beehive', 70, 14], ['radio-tower', 88, 56]], ground: '#8a7d6c' },
    forest: { time: 'day', far: 'mountains', props: [['pine', 10, 46], ['tree', 26, 38], ['pine', 42, 50], ['rock', 56, 10], ['pine', 72, 44], ['tree', 90, 36]], ground: '#5f8a4a' },
    desert: { time: 'day', far: 'dunes', props: [['rock', 20, 12], ['palm', 70, 40], ['rock', 86, 8]], ground: '#e2c27a' },
    beach: { time: 'day', far: 'sea', props: [['palm', 16, 44], ['boat', 60, 16], ['palm', 88, 40]], ground: '#efd9a0' },
    mountains: { time: 'dawn', far: 'mountains', props: [['pine', 14, 30], ['cabin', 40, 26], ['pine', 70, 34], ['pine', 86, 26]], ground: '#7fa06a' },
    farm: { time: 'day', far: 'hills', props: [['windmill', 18, 48], ['house', 46, 28, { roof: '#7a4a2e' }], ['well', 66, 16], ['fence', 84, 10]], ground: '#9ab85a' },
    interior: { time: 'day', interior: '#e9dcc4', props: [['window', 24, 26, { lift: 22 }], ['sofa', 30, 22], ['tv', 72, 22, { lift: 12 }], ['table', 72, 12], ['door', 92, 40]], ground: '#a2693f' },
    office: { time: 'day', interior: '#dfe6ee', props: [['window', 18, 26, { lift: 24 }], ['desk', 48, 24], ['computer', 44, 16, { lift: 22 }], ['chair', 30, 26], ['window', 84, 26, { lift: 24 }]], ground: '#6b7a8a' },
    bridge: { time: 'night', far: 'skyline', props: [['bridge', 50, 30], ['lamp', 20, 30], ['lamp', 80, 30]], ground: '#3a3a44', water: true },
    checkpoint: { time: 'night', far: 'skyline', props: [['barricade', 16, 14], ['gate', 50, 30], ['truck', 82, 18, { color: '#566b3a' }], ['lamp', 30, 40], ['lamp', 70, 40]], ground: '#4a4a50' },
    campsite: { time: 'night', far: 'mountains', props: [['tent', 30, 20], ['campfire', 52, 12], ['pine', 74, 44], ['pine', 90, 36]], ground: '#3f5a3a' }
  };

  function farLayer(kind, W, H, night, seed, burning) {
    if (kind === 'skyline') {
      let x = 0, out = '';
      let i = 0;
      while (x < W * 1.4) {
        const w = 60 + hash(seed + i) * 120, hh = H * (0.18 + hash(seed + i * 3) * 0.32);
        out += `<rect x="${x}" y="${H * 0.78 - hh}" width="${w}" height="${hh + 10}" fill="${night ? '#202a48' : '#7d8aa4'}"/>`;
        for (let r = 0; r < hh / 26 - 1; r++) for (let c = 0; c < w / 22 - 1; c++) if (hash(seed + i * 7 + r * 13 + c) > (night ? 0.6 : 0.97)) out += `<rect x="${x + 8 + c * 22}" y="${H * 0.78 - hh + 10 + r * 26}" width="9" height="12" fill="${night ? '#f6d06b' : '#c9d6e8'}" opacity=".8"/>`;
        if (burning && hash(seed + i * 5) > 0.55) out += `<circle class="tp-smoke" data-i="${i % 4}" cx="${x + w / 2}" cy="${H * 0.78 - hh}" r="40" fill="#5a5a60" opacity=".5"/>`;
        x += w + 4; i++;
      }
      return out;
    }
    if (kind === 'mountains') return `<path d="M0 ${H * 0.78} L${W * 0.15} ${H * 0.35} L${W * 0.3} ${H * 0.6} L${W * 0.48} ${H * 0.28} L${W * 0.66} ${H * 0.58} L${W * 0.84} ${H * 0.32} L${W * 1.1} ${H * 0.78} Z" fill="#7d8fae"/><path d="M0 ${H * 0.78} L${W * 0.25} ${H * 0.5} L${W * 0.55} ${H * 0.7} L${W * 0.8} ${H * 0.52} L${W * 1.2} ${H * 0.78} Z" fill="#5f7a8a"/>`;
    if (kind === 'hills') return `<path d="M0 ${H * 0.8} Q${W * 0.2} ${H * 0.52} ${W * 0.45} ${H * 0.7} Q${W * 0.7} ${H * 0.5} ${W * 1.2} ${H * 0.72} V${H} H0 Z" fill="#8fbf6a" stroke="${INK}" stroke-width="5"/>`;
    if (kind === 'dunes') return `<path d="M0 ${H * 0.78} Q${W * 0.3} ${H * 0.58} ${W * 0.6} ${H * 0.74} Q${W * 0.85} ${H * 0.62} ${W * 1.2} ${H * 0.74} V${H} H0 Z" fill="#d8b066"/>`;
    if (kind === 'sea') return `<rect x="0" y="${H * 0.6}" width="${W * 1.4}" height="${H * 0.2}" fill="#3f8ac4"/><path class="tp-wave" d="M0 ${H * 0.62} Q${W * 0.05} ${H * 0.6} ${W * 0.1} ${H * 0.62} T${W * 0.2} ${H * 0.62} T${W * 0.3} ${H * 0.62} T${W * 0.4} ${H * 0.62} T${W * 0.5} ${H * 0.62} T${W * 0.6} ${H * 0.62} T${W * 0.7} ${H * 0.62} T${W * 0.8} ${H * 0.62} T${W * 0.9} ${H * 0.62} T${W} ${H * 0.62} T${W * 1.1} ${H * 0.62} T${W * 1.2} ${H * 0.62}" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>`;
    return '';
  }

  reg.define('toon-set', {
    category: 'set', description: 'A complete animated environment behind toon characters: sky by time of day (stars and moon at night, sun by day), a far parallax layer (skyline with lit windows, mountains, hills, dunes, sea), living mid-ground objects and buildings, and a ground line. Presets: ' + Object.keys(SETS).join(', ') + '. Add weather (rain, snow, fog), burning, a slow camera pan, extra props.',
    params: {
      preset: { type: 'enum', default: 'city-night', options: Object.keys(SETS) }, time: { type: 'enum', default: '', options: ['', 'dawn', 'day', 'sunset', 'dusk', 'night'] },
      pan: { type: 'number', default: 8, doc: 'camera pan speed in px per second (parallax); negative pans left' }, ground: { type: 'number', default: 78, doc: 'ground line in % of frame height' },
      weather: { type: 'enum', default: 'none', options: ['none', 'rain', 'snow', 'fog', 'ash'] }, burning: { type: 'boolean', default: false },
      props: { type: 'array', default: null, doc: 'replace the preset objects: [[name, x%, h%, {options}]]' }, extra: { type: 'array', default: [], doc: 'add objects: [[name, x%, h%, {options}]]' }
    },
    example: "component('toon-set', { preset: 'burning-city', weather: 'ash', pan: 10 })"
  }, (ctx, p, h) => {
    const def = SETS[p.preset] || SETS['city-night'];
    const time = p.time || def.time;
    const night = time === 'night' || time === 'dusk';
    const burning = p.burning || def.burning;
    const W = ctx.W, H = ctx.H, gy = p.ground / 100 * H;
    const el = h.box(Object.assign({}, p, { x: 0, y: 0, w: 100 }), 'auc-set', { x: 0, y: 0, w: 100 });
    Object.assign(el.style, { height: '100%', overflow: 'hidden', zIndex: '0' });
    const sky = SKY[time] || SKY.day;
    const seed = (ctx.seed || 1) * 7 + p.preset.length;
    let html = '';
    if (def.interior) {
      html += `<div style="position:absolute;inset:0;background:${def.interior}"></div><div style="position:absolute;left:0;right:0;top:${gy}px;bottom:0;background:${def.ground};border-top:6px solid ${INK}"></div>`;
    } else {
      html += `<div style="position:absolute;inset:0;background:linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 55%, ${sky[2]} 100%)"></div>`;
      if (night) html += Array.from({ length: 50 }, (_, i) => `<div class="ts-star" data-i="${i}" style="position:absolute;left:${(hash(seed + i) * 100).toFixed(2)}%;top:${(hash(seed + i * 3) * 50).toFixed(2)}%;width:3px;height:3px;border-radius:50%;background:#fff"></div>`).join('');
      if (burning) html += `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 85%, rgba(255,110,40,.55), transparent 60%)"></div>`;
      html += `<svg class="ts-far" viewBox="0 0 ${W * 1.4} ${H}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:140%;height:100%">${farLayer(def.far, W, H, night, seed, burning)}</svg>`;
      html += `<div style="position:absolute;left:0;right:0;top:${gy}px;bottom:0;background:${def.ground};border-top:6px solid ${INK}"></div>`;
      if (def.water) html += `<div style="position:absolute;left:0;right:0;top:${gy + 20}px;bottom:0;background:#2a4a7a;opacity:.85"></div>`;
    }
    el.innerHTML = html;
    const mid = document.createElement('div');
    mid.className = 'ts-mid';
    mid.style.cssText = 'position:absolute;inset:0;';
    el.appendChild(mid);
    const items = (p.props || def.props).concat(p.extra || []);
    const live = [];
    items.forEach(([name, x, hh, opts], i) => {
      const made = propEl(name, Object.assign({ night, seed: seed + i }, opts || {}));
      if (!made) return;
      const hpx = hh / 100 * H, wpx = hpx * (made.vb[0] + 40) / (made.vb[1] + 50);
      const d = made.el;
      const lift = ((opts || {}).lift || 0) / 100 * H;
      d.style.cssText = `position:absolute;left:${(x / 100 * W - wpx / 2).toFixed(1)}px;top:${(gy - hpx + 6 - lift).toFixed(1)}px;width:${wpx.toFixed(1)}px;height:${hpx.toFixed(1)}px;overflow:visible`;
      const svg = d.querySelector('svg');
      const o = opts || {};
      if (o.burning) svg.insertAdjacentHTML('beforeend', `${flame(made.vb[0] * 0.3, made.vb[1] * 0.35, 1.4)}${flame(made.vb[0] * 0.66, made.vb[1] * 0.28, 1.8)}${smoke(made.vb[0] * 0.5, made.vb[1] * 0.02, 6)}`);
      if (o.ruined) svg.style.filter = 'saturate(.55) brightness(.75)';
      mid.appendChild(d);
      live.push(svg);
    });
    const fx = document.createElement('div');
    fx.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    el.appendChild(fx);
    const flakes = [];
    if (p.weather === 'rain' || p.weather === 'snow' || p.weather === 'ash') {
      for (let i = 0; i < (p.weather === 'rain' ? 120 : 70); i++) {
        const f = document.createElement('div');
        const rain = p.weather === 'rain';
        f.style.cssText = `position:absolute;left:0;top:0;width:${rain ? 2 : 6}px;height:${rain ? 26 : 6}px;border-radius:${rain ? 1 : 3}px;background:${rain ? 'rgba(200,220,255,.6)' : p.weather === 'ash' ? 'rgba(90,85,80,.7)' : '#fff'}`;
        fx.appendChild(f);
        flakes.push({ f, x: hash(seed + i * 9) * W, y: hash(seed + i * 4) * H, s: 0.6 + hash(i) * 0.8 });
      }
    }
    if (p.weather === 'fog') fx.innerHTML = `<div class="ts-fog" style="position:absolute;left:-20%;width:140%;top:40%;height:50%;background:linear-gradient(180deg,transparent,rgba(230,232,240,.6),transparent)"></div>`;
    const far = el.querySelector('.ts-far');
    const stars = el.querySelectorAll('.ts-star');
    ctx.tl.set(el, { autoAlpha: 1 }, 0);
    ctx.onFrame((t) => {
      if (far) far.style.transform = `translateX(${(-p.pan * 0.35 * t).toFixed(1)}px)`;
      mid.style.transform = `translateX(${(-p.pan * t).toFixed(1)}px)`;
      if (far) animateProp(far, t, {}, seed);
      live.forEach((svg, i) => animateProp(svg, t, {}, hash(seed + i)));
      stars.forEach((s, i) => { s.style.opacity = (0.5 + 0.5 * Math.sin(t * (1 + hash(i) * 3) + i)).toFixed(2); });
      flakes.forEach((k) => {
        const rain = p.weather === 'rain';
        const y = (k.y + t * (rain ? 900 : 60) * k.s) % H;
        const x = (k.x + (rain ? -t * 120 : Math.sin(t * 0.8 + k.x) * 30)) % W;
        k.f.style.transform = `translate(${((x + W) % W).toFixed(1)}px, ${y.toFixed(1)}px)${rain ? ' rotate(14deg)' : ''}`;
      });
      const fog = fx.querySelector('.ts-fog');
      if (fog) fog.style.transform = `translateX(${(Math.sin(t * 0.2) * 80).toFixed(1)}px)`;
    });
    return { el, end: ctx.D };
  });
})();
