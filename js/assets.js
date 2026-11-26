// ============================================================
// Asset loader for Gemini-made art.
// Drop PNG/JPG files into /assets with the names below. Anything
// missing falls back to built-in CSS/emoji art automatically.
// Magenta (#FF00FF) backgrounds are removed in the browser, and
// sprite sheets are cut into pieces automatically.
// ============================================================

export const ASSET_FILES = {
  stage: 'stage_bg',          // 16:9 backdrop (no keying)
  podium: 'podium',           // single podium, magenta bg
  icons: 'icons_sheet',       // 24 icons in a 6x4 grid, magenta bg
  stamps: 'stamps',           // REVOKED + SAVED side by side, magenta bg
  badges: 'badges_sheet',     // 5 generation crests in a row, magenta bg
  trophy: 'trophy',           // trophy, magenta bg
  logo: 'logo',               // GENERATIONS title logo, magenta bg
  crowd: 'crowd',             // wide strip of audience silhouettes, magenta bg
  curtain: 'curtain',         // full-screen stage curtain (closed), no keying
  mascot: 'host_mascot',      // 4-frame strip: present, point, cheer, gasp (magenta bg)
  roundFrame: 'round_frame',  // ornate frame behind round titles (magenta bg)
  partyStage: 'stage_bg_party', // Party Night backyard-cookout backdrop (no keying)
  family: 'family_banner',    // four-generations family lineup (pre-keyed, transparent)
};
// Party game scene badges (pre-keyed, transparent)
export const PARTY_FILES = { hot_take: 'party_hot_take', most_likely: 'party_most_likely', top_that: 'party_top_that', two_truths: 'party_two_truths' };
// Theme backdrops (lobby "Theme" picker). Missing files are simply not offered.
export const THEME_FILES = { juneteenth: 'stage_bg_juneteenth', christmas: 'stage_bg_christmas', reunion: 'stage_bg_reunion' };
// Animated avatar characters: 4-frame strips per expression, named <prefix><expression>.png
export const SPRITE_SETS = [
  { id: 'gold', name: 'Gold Jacket', prefix: 'avatar_' },
  // add more Gemini characters here, e.g. { id: 'auntie', name: 'Auntie', prefix: 'avatar2_' }
];
const SPRITE_EXPRS = ['focused', 'cheer', 'sweat', 'gasp'];
// icon order inside icons_sheet (left→right, top→bottom)
export const ICON_ORDER = [
  'boombox', 'mic', 'tv', 'balloon', 'sankofa', 'crown',
  'card', 'stamp', 'spades', 'pie', 'hashtag', 'cassette',
  'film', 'vinyl', 'basketball', 'church', 'slipper', 'star',
  'gradcap', 'masks', 'skillet', 'shoes', 'bolt', 'smiley',
];
export const BADGE_ORDER = ['elders', 'genx', 'millennial', 'genz', 'alpha'];
export const ICON_FALLBACK = {
  boombox: '📻', mic: '🎤', tv: '📺', balloon: '🎈', sankofa: '🕊️', crown: '👑', card: '🃏', stamp: '🔖', spades: '♠️',
  pie: '🥧', hashtag: '#️⃣', cassette: '📼', film: '🎬', vinyl: '💿', basketball: '🏀', church: '⛪', slipper: '🩴', star: '⭐',
  gradcap: '🎓', masks: '🎭', skillet: '🍳', shoes: '👟', bolt: '⚡', smiley: '😎',
};

export const ART = { stage: null, podium: null, trophy: null, logo: null, crowd: null, curtain: null, mascot: null, roundFrame: null, revoked: null, saved: null, icons: {}, badges: {}, themes: {}, sprites: {}, party: {}, partyStage: null, family: null };

function loadImg(name) {
  return new Promise((res) => {
    // try the format each file actually ships in first (avoids 404 noise), then the others
    const pref = /^(stage_bg|curtain)/.test(name) ? 'jpg' : /^(party_|family_)/.test(name) ? 'webp' : 'png';
    const exts = [pref, ...['png', 'webp', 'jpg'].filter((e) => e !== pref)];
    let i = 0;
    const tryNext = () => {
      if (i >= exts.length) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => { i++; tryNext(); };
      img.src = `assets/${name}.${exts[i]}`;
    };
    tryNext();
  });
}

function keyMagenta(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    // "magenta-ness": strong red + blue, weak green
    const m = Math.min(r, b) - g;
    if (m > 120) p[i + 3] = 0;
    else if (m > 60) {
      p[i + 3] = Math.round(255 * (120 - m) / 60);
      // de-spill: pull magenta tint out of the edge
      p[i] = Math.min(r, g + 40); p[i + 2] = Math.min(b, g + 40);
    }
  }
  x.putImageData(d, 0, 0);
  return { canvas: c, data: d };
}

function trimToUrl(canvas, box) {
  const [x0, y0, x1, y1] = box;
  const c = document.createElement('canvas');
  c.width = x1 - x0; c.height = y1 - y0;
  c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function bboxOf(d, x0, y0, x1, y1) {
  let minX = x1, minY = y1, maxX = x0, maxY = y0;
  const w = d.width, p = d.data;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (p[(y * w + x) * 4 + 3] > 40) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  return [minX, minY, maxX + 1, maxY + 1];
}

// Split a keyed sheet into sprites using empty rows/columns as gutters.
function splitByGutters(d) {
  const { width: w, height: h, data: p } = d;
  const rowFill = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 40) rowFill[y]++;
  const bands = runs(rowFill, Math.max(2, w * 0.002), Math.max(4, h * 0.01));
  const boxes = [];
  for (const [y0, y1] of bands) {
    const colFill = new Array(w).fill(0);
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) if (p[(y * w + x) * 4 + 3] > 40) colFill[x]++;
    for (const [x0, x1] of runs(colFill, 1, Math.max(4, w * 0.01))) {
      const b = bboxOf(d, x0, y0, x1, y1);
      if (b && (b[2] - b[0]) * (b[3] - b[1]) > w * h * 0.003) boxes.push(b);
    }
  }
  return boxes;
}
function runs(fill, thresh, minGap) {
  const out = []; let start = -1, gap = 0;
  for (let i = 0; i <= fill.length; i++) {
    const on = i < fill.length && fill[i] > thresh;
    if (on) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) {
      gap++;
      if (gap >= minGap || i === fill.length) { out.push([start, i - gap + 1]); start = -1; gap = 0; }
    }
  }
  return out;
}
function gridBoxes(d, cols, rows) {
  const out = [], cw = d.width / cols, ch = d.height / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const b = bboxOf(d, Math.round(c * cw), Math.round(r * ch), Math.round((c + 1) * cw), Math.round((r + 1) * ch));
    out.push(b);
  }
  return out;
}
function sliceSheet(img, cols, rows) {
  const { canvas, data } = keyMagenta(img);
  let boxes = splitByGutters(data);
  if (boxes.length !== cols * rows) boxes = gridBoxes(data, cols, rows);
  return boxes.map((b) => (b ? trimToUrl(canvas, b) : null));
}
// Cut an evenly spaced strip into frames that all share ONE crop box (no jitter),
// bottom-aligned in 5:6 cells. Several strips can share a box so a character
// stays the same size across expressions. Returns { strip: blobURL, frames: [blobURL...] }.
function unionBox(list, n) {
  let box = null;
  for (const { data } of list) {
    const cw = data.width / n;
    for (let k = 0; k < n; k++) {
      const b = bboxOf(data, Math.round(k * cw), 0, Math.round((k + 1) * cw), data.height);
      if (!b) continue;
      const rel = [b[0] - k * cw, b[1], b[2] - k * cw, b[3]];
      box = box ? [Math.min(box[0], rel[0]), Math.min(box[1], rel[1]), Math.max(box[2], rel[2]), Math.max(box[3], rel[3])] : rel;
    }
  }
  return box;
}
function toBlobURL(c) {
  return new Promise((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL()), 'image/png'));
}
async function buildStrip(keyedImg, n, box, maxCell = 320) {
  const { canvas, data } = keyedImg;
  const cw = data.width / n;
  const bw = box[2] - box[0], bh = box[3] - box[1];
  let cellW = Math.max(bw, bh / 1.2), scale = Math.min(1, maxCell / cellW);
  cellW = Math.ceil(cellW * scale); const cellH = Math.ceil(cellW * 1.2);
  const strip = document.createElement('canvas');
  strip.width = cellW * n; strip.height = cellH;
  const sx = strip.getContext('2d');
  const frames = [];
  for (let k = 0; k < n; k++) {
    const dw = bw * scale, dh = bh * scale;
    const dx = k * cellW + (cellW - dw) / 2, dy = cellH - dh;
    sx.drawImage(canvas, k * cw + box[0], box[1], bw, bh, dx, dy, dw, dh);
    const f = document.createElement('canvas'); f.width = cellW; f.height = cellH;
    f.getContext('2d').drawImage(canvas, k * cw + box[0], box[1], bw, bh, (cellW - dw) / 2, dy, dw, dh);
    frames.push(await toBlobURL(f));
  }
  return { strip: await toBlobURL(strip), frames };
}

function keyed(img) {
  const { canvas, data } = keyMagenta(img);
  const b = bboxOf(data, 0, 0, data.width, data.height);
  return b ? trimToUrl(canvas, b) : null;
}

export async function loadArt(opts = {}) {
  const imgs = {};
  const want = opts.only ? Object.fromEntries(Object.entries(ASSET_FILES).filter(([k]) => opts.only.includes(k))) : ASSET_FILES;
  await Promise.all(Object.entries(want).map(async ([k, f]) => { imgs[k] = await loadImg(f); }));
  // themes + animated characters
  if (!opts.only || opts.only.includes('themes')) {
    await Promise.all(Object.entries(THEME_FILES).map(async ([k, f]) => { const im = await loadImg(f); if (im) ART.themes[k] = im.src; }));
  }
  if (!opts.only || opts.only.includes('party')) {
    await Promise.all(Object.entries(PARTY_FILES).map(async ([k, f]) => { const im = await loadImg(f); if (im) ART.party[k] = im.src; }));
  }
  if (!opts.only || opts.only.includes('sprites')) {
    for (const set of SPRITE_SETS) {
      try {
        const loaded = {};
        await Promise.all(SPRITE_EXPRS.map(async (x) => { const im = await loadImg(set.prefix + x); if (im) loaded[x] = keyMagenta(im); }));
        if (!loaded.focused) continue;
        const box = unionBox(Object.values(loaded), 4);
        const strips = {};
        for (const [x, k] of Object.entries(loaded)) strips[x] = (await buildStrip(k, 4, box)).strip;
        ART.sprites[set.id] = { id: set.id, name: set.name, strips };
      } catch (e) { console.warn('sprite set failed', set.id, e); }
    }
  }
  try {
    if (imgs.stage) ART.stage = imgs.stage.src;
    if (imgs.partyStage) ART.partyStage = imgs.partyStage.src;
    if (imgs.family) ART.family = imgs.family.src;
    if (imgs.podium) ART.podium = keyed(imgs.podium);
    if (imgs.trophy) ART.trophy = keyed(imgs.trophy);
    if (imgs.logo) ART.logo = keyed(imgs.logo);
    if (imgs.crowd) ART.crowd = keyed(imgs.crowd);
    if (imgs.curtain) ART.curtain = imgs.curtain.src;
    if (imgs.roundFrame) ART.roundFrame = keyed(imgs.roundFrame);
    if (imgs.mascot) {
      const k = keyMagenta(imgs.mascot);
      ART.mascot = (await buildStrip(k, 4, unionBox([k], 4), 420)).frames; // [present, point, cheer, gasp]
    }
    if (imgs.stamps) { const [a, b] = sliceSheet(imgs.stamps, 2, 1); ART.revoked = a; ART.saved = b; }
    if (imgs.icons) sliceSheet(imgs.icons, 6, 4).forEach((u, i) => { if (u) ART.icons[ICON_ORDER[i]] = u; });
    if (imgs.badges) sliceSheet(imgs.badges, 5, 1).forEach((u, i) => { if (u) ART.badges[BADGE_ORDER[i]] = u; });
  } catch (e) {
    // file:// pages can't read pixels — open the game through a web server
    console.warn('Art processing failed (are you on file://?)', e);
  }
  return ART;
}

export function iconHTML(key, cls = 'icon') {
  if (ART.icons[key]) return `<img class="${cls}" src="${ART.icons[key]}" alt="">`;
  return `<span class="${cls} icon-emoji">${ICON_FALLBACK[key] || '★'}</span>`;
}
export function badgeHTML(gen, cls = 'badge-img') {
  if (ART.badges[gen]) return `<img class="${cls}" src="${ART.badges[gen]}" alt="">`;
  return '';
}
