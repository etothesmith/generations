// ============================================================
// Avatar adapter
// ------------------------------------------------------------
// Renders a layered, vector-cartoon avatar (thick charcoal outlines,
// flat fills + one shade tone) as an SVG string.
//
// SWAP POINT (Money Moves / Smith's Classroom 2.0 avatars):
// Replace renderAvatar() with a function that stacks your PNG layers
// for the same fields. Keep the signature:
//   renderAvatar(avatarData, expression, sizePx) -> HTML string
// Expressions used by the game: idle | focused | cheer | sweat | gasp
// ============================================================

import { ART } from './assets.js';

const OUT = '#2B2B2B';

export const AVATAR_OPTIONS = {
  body: ['slim', 'athletic', 'curvy', 'plus'],
  skin: ['#3B2219', '#4E2C1E', '#6B3E26', '#8A5A3C', '#A86F4C', '#C48A5E', '#D9A77E', '#EBC6A0'],
  hair: ['fade', 'afro', 'puffs', 'locs', 'braids', 'twists', 'waves', 'bald', 'silver-fro', 'bob'],
  hairColor: ['#1A1210', '#3A2418', '#6B4423', '#B9B4AE', '#8E2A2A', '#D9A441'],
  outfit: ['tee', 'hoodie', 'blazer', 'jersey', 'church'],
  outfitColor: ['#C8102E', '#F2B632', '#1E9E5A', '#12A4A4', '#5B3FA0', '#1A1B3A', '#FFF6E5', '#E2711D'],
  accessory: ['none', 'glasses', 'shades', 'hoops', 'headwrap', 'cap', 'chain', 'church-hat'],
};

export function randomAvatar() {
  const p = (a) => a[Math.floor(Math.random() * a.length)];
  const o = AVATAR_OPTIONS;
  return { body: p(o.body), skin: p(o.skin), hair: p(o.hair), hairColor: p(o.hairColor.slice(0, 3)), outfit: p(o.outfit), outfitColor: p(o.outfitColor), accessory: Math.random() < 0.5 ? 'none' : p(o.accessory) };
}

function shade(hex, amt = -0.18) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

const S = `stroke="${OUT}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

function bodyLayer(a) {
  const w = { slim: 58, athletic: 72, curvy: 66, plus: 82 }[a.body] || 64;
  const c = a.outfitColor || '#C8102E', cs = shade(c);
  const L = 100 - w, R = 100 + w;
  const curve = a.body === 'curvy' || a.body === 'plus' ? 26 : 14;
  let torso = `<path d="M${L} 240 L${L} ${200 + 4} Q${L} ${176} ${100 - 26} 168 L${100 + 26} 168 Q${R} 176 ${R} ${204} L${R} 240 Z" fill="${c}" ${S}/>`;
  torso += `<path d="M${100 + 26} 170 Q${R} 178 ${R} 206 L${R} 238 L${R - curve} 238 Q${R - 10} 200 ${100 + 22} 174 Z" fill="${cs}"/>`;
  let extra = '';
  if (a.outfit === 'hoodie') {
    extra += `<path d="M${100 - 34} 170 Q100 196 ${100 + 34} 170" fill="none" ${S}/>`;
    extra += `<line x1="92" y1="186" x2="90" y2="212" ${S}/><line x1="108" y1="186" x2="110" y2="212" ${S}/>`;
  } else if (a.outfit === 'blazer' || a.outfit === 'church') {
    const shirt = a.outfit === 'church' ? '#FFF6E5' : '#FFFFFF';
    extra += `<path d="M84 168 L100 206 L116 168 Z" fill="${shirt}" ${S}/>`;
    extra += `<path d="M84 168 L96 214 L78 186 Z M116 168 L104 214 L122 186 Z" fill="${cs}" ${S}/>`;
    if (a.outfit === 'church') extra += `<path d="M94 176 L100 184 L106 176 L100 206 Z" fill="#C8102E" ${S}/>`;
  } else if (a.outfit === 'jersey') {
    extra += `<path d="M84 168 Q100 186 116 168" fill="none" stroke="#FFF6E5" stroke-width="6"/>`;
    extra += `<text x="100" y="228" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="#FFF6E5" stroke="${OUT}" stroke-width="2">23</text>`;
  } else {
    extra += `<path d="M86 168 Q100 182 114 168" fill="none" ${S}/>`;
  }
  return torso + extra;
}

function hairBack(a) {
  const c = a.hairColor || '#1A1210', cs = shade(c, -0.25);
  switch (a.hair) {
    case 'afro': return `<circle cx="100" cy="82" r="68" fill="${c}" ${S}/><path d="M150 50 A68 68 0 0 1 160 120" fill="none" stroke="${cs}" stroke-width="10"/>`;
    case 'silver-fro': return `<circle cx="100" cy="84" r="58" fill="#C9C5BF" ${S}/>`;
    case 'locs': {
      let s = '';
      for (let i = 0; i < 7; i++) {
        const x = 46 + i * 18; if (x > 64 && x < 136) continue;
        s += `<rect x="${x - 7}" y="70" width="14" height="${86 + (i % 2) * 14}" rx="7" fill="${c}" ${S}/>`;
      }
      for (const x of [58, 142]) s += `<rect x="${x - 7}" y="74" width="14" height="96" rx="7" fill="${c}" ${S}/>`;
      return s;
    }
    case 'braids': {
      let s = '';
      for (const x of [54, 146]) {
        for (let k = 0; k < 6; k++) s += `<ellipse cx="${x}" cy="${88 + k * 14}" rx="8" ry="9" fill="${c}" ${S}/>`;
      }
      return s;
    }
    case 'bob': return `<path d="M44 96 Q40 34 100 30 Q160 34 156 96 L156 132 L132 132 L132 96 L68 96 L68 132 L44 132 Z" fill="${c}" ${S}/>`;
    case 'puffs': return `<circle cx="52" cy="46" r="26" fill="${c}" ${S}/><circle cx="148" cy="46" r="26" fill="${c}" ${S}/>`;
    default: return '';
  }
}

function hairFront(a) {
  const c = a.hairColor || '#1A1210', cs = shade(c, -0.25);
  switch (a.hair) {
    case 'fade': return `<path d="M58 78 Q60 36 100 34 Q140 36 142 78 Q132 60 100 58 Q68 60 58 78 Z" fill="${c}" ${S}/><path d="M66 70 L134 70" stroke="${cs}" stroke-width="2"/>`;
    case 'waves': return `<path d="M58 80 Q58 34 100 32 Q142 34 142 80 Q130 58 100 58 Q70 58 58 80 Z" fill="${c}" ${S}/>` +
      [44, 52].map((y) => `<path d="M72 ${y} q7 -5 14 0 t14 0 t14 0 t14 0" fill="none" stroke="${shade(c, 0.35)}" stroke-width="2.5"/>`).join('');
    case 'twists': {
      let s = `<path d="M56 82 Q56 30 100 28 Q144 30 144 82 Q130 58 100 58 Q70 58 56 82 Z" fill="${c}" ${S}/>`;
      for (let i = 0; i < 6; i++) s += `<circle cx="${64 + i * 14.5}" cy="${36 + Math.abs(2.5 - i) * 4}" r="9" fill="${c}" ${S}/>`;
      return s;
    }
    case 'locs': case 'braids':
      return `<path d="M56 84 Q54 30 100 28 Q146 30 144 84 Q132 56 100 56 Q68 56 56 84 Z" fill="${c}" ${S}/>` +
        `<path d="M76 34 L74 56 M92 30 L90 56 M108 30 L110 56 M124 34 L126 56" stroke="${cs}" stroke-width="3"/>`;
    case 'afro': return `<path d="M60 74 Q100 50 140 74" fill="none" stroke="${cs}" stroke-width="4"/>`;
    case 'silver-fro': return `<path d="M62 72 Q100 52 138 72" fill="none" stroke="#9E9993" stroke-width="4"/>`;
    case 'puffs': return `<path d="M58 80 Q58 38 100 36 Q142 38 142 80 Q128 60 100 60 Q72 60 58 80 Z" fill="${c}" ${S}/>`;
    case 'bob': return `<path d="M58 84 Q62 40 100 40 Q138 40 142 84 Q120 62 100 70 Q80 62 58 84 Z" fill="${c}" ${S}/>`;
    default: return '';
  }
}

function face(a, expr) {
  const skin = a.skin || '#8A5A3C', sk = shade(skin);
  let s = '';
  // neck + head
  s += `<path d="M86 140 L86 172 Q100 180 114 172 L114 140 Z" fill="${sk}" ${S}/>`;
  s += `<ellipse cx="57" cy="100" rx="9" ry="13" fill="${skin}" ${S}/><ellipse cx="143" cy="100" rx="9" ry="13" fill="${sk}" ${S}/>`;
  s += `<ellipse cx="100" cy="96" rx="44" ry="52" fill="${skin}" ${S}/>`;
  s += `<path d="M118 52 Q146 70 142 108 Q138 136 112 146 Q132 120 130 92 Q128 66 118 52 Z" fill="${sk}"/>`;
  // eyes / brows / mouth
  const ey = 96;
  const eye = (x) => {
    if (expr === 'cheer') return `<path d="M${x - 8} ${ey + 2} Q${x} ${ey - 8} ${x + 8} ${ey + 2}" fill="none" ${S}/>`;
    if (expr === 'focused') return `<path d="M${x - 9} ${ey} L${x + 9} ${ey}" ${S}/><circle cx="${x + 1}" cy="${ey + 3}" r="3.5" fill="${OUT}"/>`;
    const r = expr === 'gasp' ? 9 : 7;
    return `<circle cx="${x}" cy="${ey}" r="${r}" fill="#fff" ${S} stroke-width="3"/><circle cx="${x + 2}" cy="${ey + 1}" r="${expr === 'gasp' ? 3 : 3.6}" fill="${OUT}"/>`;
  };
  s += eye(82) + eye(118);
  const brow = {
    idle: ['M72 80 Q82 75 92 79', 'M108 79 Q118 75 128 80'],
    focused: ['M72 76 L92 84', 'M108 84 L128 76'],
    cheer: ['M72 76 Q82 70 92 75', 'M108 75 Q118 70 128 76'],
    sweat: ['M72 82 L92 76', 'M108 76 L128 82'],
    gasp: ['M72 72 Q82 66 92 71', 'M108 71 Q118 66 128 72'],
  }[expr] || null;
  const bc = a.hair === 'silver-fro' ? '#9E9993' : (a.hairColor || OUT);
  if (brow) s += brow.map((d) => `<path d="${d}" fill="none" stroke="${bc === '#1A1210' ? OUT : bc}" stroke-width="5" stroke-linecap="round"/>`).join('');
  s += `<path d="M100 104 Q96 116 102 118" fill="none" stroke="${shade(skin, -0.35)}" stroke-width="3" stroke-linecap="round"/>`;
  const mouth = {
    idle: `<path d="M88 128 Q100 136 112 128" fill="none" ${S}/>`,
    focused: `<path d="M90 130 L110 129" ${S}/>`,
    cheer: `<path d="M84 124 Q100 148 116 124 Z" fill="#7A1E1E" ${S}/><path d="M88 126 L112 126" stroke="#fff" stroke-width="4"/>`,
    sweat: `<path d="M86 132 q5 -5 10 0 t10 0 t10 0" fill="none" ${S}/>`,
    gasp: `<ellipse cx="100" cy="132" rx="9" ry="12" fill="#7A1E1E" ${S}/>`,
  }[expr] || '';
  s += mouth;
  if (expr === 'cheer') s += `<ellipse cx="72" cy="114" rx="7" ry="4" fill="#E2711D" opacity=".35"/><ellipse cx="128" cy="114" rx="7" ry="4" fill="#E2711D" opacity=".35"/>`;
  if (expr === 'sweat') s += `<path d="M146 62 Q140 74 146 78 Q152 74 146 62 Z" fill="#7FD3F7" ${S} stroke-width="2.5"/>`;
  return s;
}

function accessory(a, expr) {
  switch (a.accessory) {
    case 'glasses': return `<g fill="none" ${S} stroke-width="3.5"><circle cx="82" cy="96" r="13"/><circle cx="118" cy="96" r="13"/><path d="M95 96 L105 96 M69 94 L57 90 M131 94 L143 90"/></g>`;
    case 'shades': return expr === 'gasp' ? '' : `<path d="M66 88 L96 88 L94 104 Q82 110 70 102 Z M104 88 L134 88 L130 102 Q118 110 106 104 Z" fill="${OUT}"/><path d="M96 92 L104 92" ${S}/><path d="M72 92 L80 92" stroke="#fff" stroke-width="2.5"/>`;
    case 'hoops': return `<circle cx="56" cy="118" r="9" fill="none" stroke="#F2B632" stroke-width="3.5"/><circle cx="144" cy="118" r="9" fill="none" stroke="#F2B632" stroke-width="3.5"/>`;
    case 'headwrap': return `<path d="M52 82 Q50 18 100 16 Q150 18 148 82 Q130 60 100 60 Q70 60 52 82 Z" fill="#E2711D" ${S}/><path d="M66 40 Q100 30 134 40 M60 58 Q100 46 140 58" fill="none" stroke="#F2B632" stroke-width="4"/><circle cx="128" cy="22" r="14" fill="#E2711D" ${S}/>`;
    case 'cap': return `<path d="M54 72 Q56 30 100 28 Q144 30 146 72 Z" fill="#1A1B3A" ${S}/><path d="M134 66 Q160 62 170 72 L146 74 Z" fill="#1A1B3A" ${S}/><circle cx="100" cy="30" r="4" fill="#F2B632"/>`;
    case 'church-hat': return `<ellipse cx="100" cy="56" rx="78" ry="14" fill="#5B3FA0" ${S}/><path d="M64 56 Q66 18 100 16 Q134 18 136 56 Z" fill="#5B3FA0" ${S}/><path d="M66 46 Q100 38 134 46" fill="none" stroke="#F2B632" stroke-width="5"/><circle cx="138" cy="40" r="9" fill="#C8102E" ${S} stroke-width="3"/>`;
    case 'chain': return `<path d="M80 174 Q100 204 120 174" fill="none" stroke="#F2B632" stroke-width="5" stroke-dasharray="3 3"/><circle cx="100" cy="196" r="7" fill="#F2B632" ${S} stroke-width="2.5"/>`;
    default: return '';
  }
}

// Animated Gemini characters: 4-frame strips, stepped with SVG <animate> so every
// place that styles avatar <svg>s keeps working.
const SPRITE_TIMING = { focused: '2.4s', cheer: '.7s', sweat: '1.1s', gasp: '1s' };
function spriteAvatar(set, expr, size) {
  const x = expr === 'idle' ? 'focused' : expr;
  const url = set.strips[x] || set.strips.focused;
  const anim = expr === 'idle' ? '' : `<animate attributeName="x" values="0;-200;-400;-600" dur="${SPRITE_TIMING[x] || '1s'}" calcMode="discrete" repeatCount="indefinite"/>`;
  return `<svg class="avatar-svg sprite expr-${expr}" viewBox="0 0 200 240" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    // inner <svg> clips to exactly one frame, whatever box the outer svg is stretched to
    `<svg x="0" y="0" width="200" height="240" viewBox="0 0 200 240" overflow="hidden"><image href="${url}" x="0" y="0" width="800" height="240" preserveAspectRatio="none">${anim}</image></svg></svg>`;
}

export function renderAvatar(a, expr = 'idle', size = 120) {
  a = a || {};
  if (a.sprite && ART.sprites[a.sprite]) return spriteAvatar(ART.sprites[a.sprite], expr, size);
  const hatHides = a.accessory === 'headwrap' || a.accessory === 'cap' || a.accessory === 'church-hat';
  const back = hatHides && !['locs', 'braids', 'bob'].includes(a.hair) ? '' : hairBack(a);
  const front = hatHides ? '' : hairFront(a);
  return `<svg class="avatar-svg expr-${expr}" viewBox="0 0 200 240" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g class="av-body">${bodyLayer(a)}</g>` +
    `<g class="av-head">${back}${face(a, expr)}${front}${accessory(a, expr)}</g>` +
    `</svg>`;
}
