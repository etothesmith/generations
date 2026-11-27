// ============================================================
// BLOCK PARTY color worlds: every part of the show has its own
// color, so players always know "where" they are (Jackbox-style).
// Shared by the TV (host.js), phones (play.js) and the front door.
// ============================================================
export const WORLDS = {
  sunny:  { name: 'Block Party', c: '#FFC23C', d: '#E89A00' }, // pre-show
  tang:   { name: 'The Board',   c: '#FF7A1A', d: '#D9560A' }, // round 1 board
  teal:   { name: 'Survey',      c: '#14B8A6', d: '#0B8577' },
  pink:   { name: 'Hot Take',    c: '#FF3D8B', d: '#CC1F66' },
  grape:  { name: 'Sing It',     c: '#7B4DFF', d: '#5631D6' },
  sky:    { name: 'Party',       c: '#2FA8FF', d: '#1677CC' },
  lime:   { name: 'Act It Out',  c: '#7ED321', d: '#4E9A0F' },
  coral:  { name: 'Remix',       c: '#FF5A4E', d: '#D63A2F' },
  beef:   { name: 'Beef',        c: '#E5303A', d: '#A3141C' },
  royal:  { name: 'Final',       c: '#3B2A8F', d: '#241A63' },
  gold:   { name: 'Champions',   c: '#FFB800', d: '#C98A00' },
};

const TYPE_WORLD = {
  trivia: 'coral', blitz: 'coral', emoji: 'coral', name_that_era: 'coral', saying: 'coral', mama_said: 'coral', card_check: 'coral',
  family_survey: 'teal', majority_rules: 'teal',
  hot_take: 'pink', one_gotta_go: 'pink',
  sing_it: 'grape', hum_it: 'grape', finish_lyric: 'grape',
  most_likely: 'sky', top_that: 'sky', two_truths: 'sky',
  charades: 'lime', beef: 'beef',
};

/** Which color world a game state is in. */
export function worldFor(s) {
  if (!s) return 'sunny';
  const ph = s.phase;
  if (ph === 'lobby' || ph === 'teams') return 'sunny';
  if (ph === 'champion') return 'gold';
  if (ph && ph.startsWith('final')) return 'royal';
  if (ph === 'spin') return 'lime';
  if (ph === 'board' || ph === 'round_end') return 'tang';
  if (ph === 'question' && s.q) {
    if (s.q.beef) return 'beef';
    if (s.round === 1) return 'tang';
    return TYPE_WORLD[s.q.type] || 'coral';
  }
  if (ph === 'segment' && s.remix) {
    const seg = s.remix.segments && s.remix.segments[s.remix.segIdx];
    if (seg) return seg.type === 'beef' ? 'beef' : TYPE_WORLD[seg.type] || 'coral';
  }
  return 'sunny';
}

let cur = null;
/** Paint the page in the right world (sets body[data-world] + CSS vars). */
export function applyWorld(s, el = document.body) {
  const w = worldFor(s);
  if (w === cur) return w;
  cur = w;
  const W = WORLDS[w];
  el.dataset.world = w;
  el.style.setProperty('--world', W.c);
  el.style.setProperty('--world-d', W.d);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = W.c;
  return w;
}
