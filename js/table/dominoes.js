// ============================================================
// DOMINOES — partners, double-six set, scoring by fives ("Muggins" style)
// No DOM; runs in browser or node.
//  • 4 players, partners sit across (seats 0 & 2 vs 1 & 3), 7 bones each.
//  • First hand: whoever holds the 6|6 sets it down. After that,
//    whoever won the last hand leads anything.
//  • If the lead is a double it's the SPINNER: play off both sides,
//    then off its top and bottom too (4 ends).
//  • After every play add up the ends. A multiple of 5 scores that many.
//    (A double on an end counts both halves.)
//  • Go out ("Domino!") and your team scores the other team's
//    leftover pips, rounded to the nearest 5.
//  • Nobody can play = blocked: the team with fewer pips scores the
//    other team's pips (rounded to 5).
// ============================================================
export const team = (seat) => seat % 2;
export const partner = (seat) => (seat + 2) % 4;
export const tid = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
export const parse = (id) => id.split('-').map(Number);
export const pips = (id) => { const [a, b] = parse(id); return a + b; };
export const isDouble = (id) => { const [a, b] = parse(id); return a === b; };
export const round5 = (n) => Math.round(n / 5) * 5;

export function makeSet() { const t = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push(tid(a, b)); return t; }
function shuffle(a, rnd = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sortHand = (h) => h.slice().sort((x, y) => pips(y) - pips(x) || (isDouble(y) - isDouble(x)));

export function newGame(opts = {}) {
  const s = { game: 'dominoes', o: { target: opts.target || 150 }, scores: [0, 0], handNo: 0, leader: null, phase: 'play', winner: null, history: [] };
  deal(s);
  return s;
}

export function deal(s, rnd) {
  const set = shuffle(makeSet(), rnd);
  s.hands = [0, 1, 2, 3].map((i) => sortHand(set.slice(i * 7, i * 7 + 7)));
  s.handNo += 1;
  s.board = { center: null, arms: { L: [], R: [], U: [], D: [] }, order: [] };
  s.knocks = [[], [], [], []];
  s.passes = 0;
  s.lastPlay = null;
  s.handResult = null;
  s.phase = 'play';
  if (s.leader === null) s.turn = s.hands.findIndex((h) => h.includes('6-6'));
  else s.turn = s.leader;
  s.mustLead = s.leader === null ? '6-6' : null;
}

function armOpen(s, k) {
  const b = s.board;
  if (!b.center) return false;
  if (k === 'L' || k === 'R') return true;
  return !!b.center.spinner && b.arms.L.length > 0 && b.arms.R.length > 0;
}
/** The number showing on an end (what you must match). */
export function endValue(s, k) {
  const b = s.board, arm = b.arms[k];
  if (arm.length) return arm[arm.length - 1].out;
  const [a, c] = parse(b.center.id);
  return k === 'R' ? c : a;
}
export function openEnds(s) { return ['L', 'R', 'U', 'D'].filter((k) => armOpen(s, k)); }

/** Total of the ends right now (the "count"). */
export function count(s, board) {
  const b = board || s.board;
  if (!b.center) return 0;
  const tmp = { board: b };
  let n = 0;
  for (const k of ['L', 'R', 'U', 'D']) {
    if (!armOpen(tmp, k)) continue;
    const arm = b.arms[k];
    if (arm.length) { const t = arm[arm.length - 1]; n += t.dbl ? t.out * 2 : t.out; }
    else if (k === 'L' || k === 'R') n += endValue(tmp, k);
  }
  return n;
}

/** All legal moves: {tile, end} or {pass:true}. */
export function legal(s, seat) {
  if (s.phase !== 'play' || s.turn !== seat) return [];
  const h = s.hands[seat];
  if (!s.board.center) {
    if (s.mustLead) return h.includes(s.mustLead) ? [{ tile: s.mustLead, end: 'C' }] : [];
    return h.map((t) => ({ tile: t, end: 'C' }));
  }
  const out = [];
  const ends = openEnds(s);
  const seen = new Set();
  for (const t of h) {
    const [a, b] = parse(t);
    for (const k of ends) {
      const v = endValue(s, k);
      if (a !== v && b !== v) continue;
      // don't list the same tile on two ends that look identical (e.g. both sides of a fresh spinner)
      const key = t + ':' + v + ':' + (s.board.arms[k].length ? 'x' : k === 'U' || k === 'D' ? 'ud' : 'lr');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tile: t, end: k });
    }
  }
  return out.length ? out : [{ pass: true }];
}

export function whyIllegal(s, seat, tile) {
  if (s.phase !== 'play' || s.turn !== seat) return 'Wait for your turn.';
  if (!s.board.center && s.mustLead && tile !== s.mustLead) return 'The first hand always starts with the big 6|6.';
  if (legal(s, seat).some((m) => m.tile === tile)) return '';
  const vals = [...new Set(openEnds(s).map((k) => endValue(s, k)))];
  return `That bone doesn't match an open end. You need a ${vals.join(' or a ')}.`;
}

function place(board, tile, end) {
  const [a, b] = parse(tile);
  if (end === 'C') {
    board.center = { id: tile, spinner: a === b };
    board.order.push({ tile, end: 'C' });
    return;
  }
  const tmp = { board };
  const v = endValue(tmp, end);
  const out = a === v ? b : a;
  board.arms[end].push({ id: tile, in: v, out, dbl: a === b });
  board.order.push({ tile, end });
}
export function cloneBoard(b) { return { center: b.center && { ...b.center }, arms: { L: b.arms.L.slice(), R: b.arms.R.slice(), U: b.arms.U.slice(), D: b.arms.D.slice() }, order: b.order.slice() }; }

export function apply(s, seat, move) {
  const ev = [];
  const L = legal(s, seat);
  if (move.pass) {
    if (!(L.length === 1 && L[0].pass)) throw new Error('you have a play');
    for (const k of openEnds(s)) { const v = endValue(s, k); if (!s.knocks[seat].includes(v)) s.knocks[seat].push(v); }
    s.passes += 1;
    s.lastPlay = { seat, pass: true };
    ev.push({ type: 'knock', seat });
    if (s.passes >= 4) { blocked(s); ev.push({ type: 'blocked', result: s.handResult }); return ev; }
    s.turn = (seat + 1) % 4;
    return ev;
  }
  if (!L.some((m) => m.tile === move.tile && m.end === move.end)) throw new Error('illegal');
  place(s.board, move.tile, move.end);
  s.hands[seat] = s.hands[seat].filter((t) => t !== move.tile);
  s.passes = 0;
  s.mustLead = null;
  const c = count(s);
  const pts = c > 0 && c % 5 === 0 ? c : 0;
  if (pts) s.scores[team(seat)] += pts;
  s.lastPlay = { seat, tile: move.tile, end: move.end, count: c, pts };
  ev.push({ type: 'play', seat, tile: move.tile, end: move.end, count: c, pts });
  if (!s.hands[seat].length) { domino(s, seat); ev.push({ type: 'domino', seat, result: s.handResult }); return ev; }
  if (checkWin(s)) { ev.push({ type: 'over', winner: s.winner }); return ev; }
  s.turn = (seat + 1) % 4;
  return ev;
}

const teamPips = (s, t) => [t, t + 2].reduce((n, p) => n + s.hands[p].reduce((m, x) => m + pips(x), 0), 0);
function domino(s, seat) {
  const t = team(seat), other = 1 - t;
  const left = teamPips(s, other), pts = round5(left);
  s.scores[t] += pts;
  s.handResult = { kind: 'domino', seat, team: t, left, pts, totals: s.scores.slice() };
  s.leader = seat;
  s.history.push(s.handResult);
  s.phase = 'hand'; s.turn = -1;
  checkWin(s);
}
function blocked(s) {
  const a = teamPips(s, 0), b = teamPips(s, 1);
  let t = null, pts = 0;
  if (a !== b) { t = a < b ? 0 : 1; pts = round5(t === 0 ? b : a); s.scores[t] += pts; }
  // lowest single hand leads next
  const low = [0, 1, 2, 3].sort((x, y) => s.hands[x].reduce((m, z) => m + pips(z), 0) - s.hands[y].reduce((m, z) => m + pips(z), 0))[0];
  s.leader = low;
  s.handResult = { kind: 'blocked', team: t, pips: [a, b], pts, totals: s.scores.slice() };
  s.history.push(s.handResult);
  s.phase = 'hand'; s.turn = -1;
  checkWin(s);
}
function checkWin(s) {
  const [a, b] = s.scores, T = s.o.target;
  if ((a >= T || b >= T) && a !== b) { s.winner = a > b ? 0 : 1; s.phase = 'hand'; s.turn = -1; if (!s.handResult) s.handResult = { kind: 'reached', team: s.winner, totals: s.scores.slice() }; return true; }
  return false;
}
export function advance(s) {
  if (s.phase !== 'hand') return [];
  if (s.winner !== null) { s.phase = 'over'; return [{ type: 'over', winner: s.winner }]; }
  deal(s);
  return [{ type: 'deal' }];
}

// ---------------- the brain (bots + coach) ----------------
function unseenFor(s, seat) {
  const gone = new Set([...s.hands[seat], ...s.board.order.map((o) => o.tile)]);
  return makeSet().filter((t) => !gone.has(t));
}
/** Could the next player score after this board? Returns expected points they could grab. */
function danger(s, seat, board) {
  const nxt = (seat + 1) % 4;
  const tmpS = { board };
  const ends = openEndsB(board);
  const pool = unseenFor(s, seat).filter((t) => { const [a, b] = parse(t); return !(s.knocks[nxt].includes(a) && s.knocks[nxt].includes(b)); });
  if (!pool.length) return 0;
  let best = 0, hits = 0;
  for (const t of pool) {
    const [a, b] = parse(t);
    for (const k of ends) {
      const v = endValue(tmpS, k);
      if (a !== v && b !== v) continue;
      const nb = cloneBoard(board); place(nb, t, k);
      const c = count(null, nb);
      if (c > 0 && c % 5 === 0) { hits += 1; best = Math.max(best, c); break; }
    }
  }
  // chance the next player holds one of the scoring bones (they hold ~7 of the unseen)
  const p = Math.min(1, (hits / pool.length) * Math.min(7, s.hands[nxt].length));
  return p * best;
}
function openEndsB(board) { return openEnds({ board }); }

export function think(s, seat, level = 'medium') {
  const L = legal(s, seat);
  if (!L.length) return null;
  if (L[0].pass) {
    const vals = [...new Set(openEnds(s).map((k) => endValue(s, k)))];
    return { move: { pass: true }, why: `No bone in your hand has a ${vals.join(' or ')}, so you have to knock (pass). Everyone now knows you're out of ${vals.join('s and ')}s.` };
  }
  if (level === 'easy' && Math.random() < 0.4) { const m = L[Math.floor(Math.random() * L.length)]; return { move: m, why: 'Any bone that fits.' }; }
  const hand = s.hands[seat];
  const suitCount = (v) => hand.filter((t) => parse(t).includes(v)).length;
  const opp = [(seat + 1) % 4, (seat + 3) % 4];
  let best = null;
  for (const m of L) {
    const nb = cloneBoard(s.board); place(nb, m.tile, m.end);
    const c = count(null, nb), pts = c > 0 && c % 5 === 0 ? c : 0;
    const [a, b] = parse(m.tile);
    let score = pts * 3 + (a + b) * 0.6 + (a === b ? 2.5 : 0);
    const why = [];
    if (pts) why.push(`the ends add up to ${c}, a multiple of 5, so your team scores ${pts}`);
    // keep a number you have lots of (control); avoid playing your last of a number
    const keep = a === b ? 0 : (suitCount(a) - 1) + (suitCount(b) - 1);
    score += keep * 0.4;
    if (level === 'hard') {
      const d = danger(s, seat, nb);
      score -= d * 1.6;
      if (d >= 5 && !pts) why.push(`careful: it leaves a count the next player could score off of`);
      const ends = openEndsB(nb).map((k) => endValue({ board: nb }, k));
      const blocks = opp.filter((p) => ends.every((v) => s.knocks[p].includes(v)));
      if (blocks.length) { score += 4 * blocks.length; why.push(`it blocks an opponent: they already knocked on ${[...new Set(ends)].join(' and ')}`); }
      const pv = ends.filter((v) => s.knocks[partner(seat)].includes(v)).length;
      score -= pv * 0.8;
    }
    if (!pts && a + b >= 9) why.push(`it gets rid of a heavy bone (${a + b} pips) that would count against you if someone goes out`);
    if (a === b && !pts) why.push('doubles are hard to play later, so get them down early');
    if (!best || score > best.score) best = { m, score, why };
  }
  const { m, why } = best;
  const where = m.end === 'C' ? 'to start' : { L: 'on the left', R: 'on the right', U: 'on top of the spinner', D: 'under the spinner' }[m.end];
  const [a, b] = parse(m.tile);
  return { move: m, why: `Play ${a}|${b} ${where}${why.length ? ': ' + why.join('; ') : '. Nothing scores here, so keep your options open.'}.` };
}
