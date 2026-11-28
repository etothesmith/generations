// ============================================================
// BID WHIST — rules engine, bots and coach (no DOM)
//  • 4 players, partners across. 54 cards (with Big & Little Joker).
//    12 cards each, 6 in the kitty.
//  • Bidding: one time around, starting left of the dealer. Bid 3–7
//    and a direction: ⬆️ Uptown (high cards win), ⬇️ Downtown (low
//    cards win: A, 2, 3 … K) or 🚫 No Trump. A higher number wins; at
//    the same number, No Trump beats a suit bid. Everybody passes?
//    The dealer is stuck and must bid.
//  • The winner picks up the kitty, throws out 6 cards (they count as
//    the team's first book) and names trump (unless No Trump).
//  • Jokers: Big Joker, then Little Joker, are the top two trumps.
//    In No Trump they're worthless and can't win a book.
//  • Bid 4 = you need 6 + 4 = 10 books (the kitty counts as one).
//    Make it: score books over 6. Miss it: lose your bid. No Trump
//    doubles both. First team to 7 wins.
// ============================================================
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
export const DIR_NAME = { up: 'Uptown', down: 'Downtown', nt: 'No Trump' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RV = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
export const team = (s) => s % 2;
export const partner = (s) => (s + 2) % 4;
const isJ = (c) => c === 'BJ' || c === 'LJ';
export const rankOf = (c) => (isJ(c) ? c : c.slice(0, -1));
export const rawSuit = (c) => (isJ(c) ? 'X' : c.slice(-1));
export function cardName(c) { if (c === 'BJ') return 'Big Joker'; if (c === 'LJ') return 'Little Joker'; return rankOf(c) + SUIT_SYM[rawSuit(c)]; }

/** The suit a card plays as under a contract (jokers join trump; in No Trump they're 'X'). */
export function suitOf(c, ct) { if (isJ(c)) return ct && ct.trump ? ct.trump : 'X'; return rawSuit(c); }
/** Strength inside its suit under a contract. */
export function rank(c, ct) {
  const dir = ct ? ct.dir : 'up';
  if (isJ(c)) return ct && ct.trump ? (c === 'BJ' ? 100 : 99) : 0;
  const r = rankOf(c);
  if (r === 'A') return 14;
  return dir === 'down' ? 15 - RV[r] : RV[r];
}
export function makeDeck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(r + s); d.push('BJ', 'LJ'); return d; }
function shuffle(a, rnd = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sortHand(h, ct) {
  const order = { X: -1, S: 0, H: 1, C: 2, D: 3 };
  const trump = ct && ct.trump;
  return h.slice().sort((a, b) => {
    const sa = isJ(a) ? 'X' : rawSuit(a), sb = isJ(b) ? 'X' : rawSuit(b);
    const oa = sa === 'X' ? -2 : sa === trump ? -1 : order[sa], ob = sb === 'X' ? -2 : sb === trump ? -1 : order[sb];
    return oa - ob || rank(b, ct || { dir: 'up', trump: 'S' }) - rank(a, ct || { dir: 'up', trump: 'S' });
  });
}

export function newGame(opts = {}) {
  const s = { game: 'bidwhist', o: { target: opts.target || 7 }, dealer: Math.floor(Math.random() * 4), scores: [0, 0], handNo: 0, history: [], winner: null };
  deal(s);
  return s;
}
export function deal(s, rnd) {
  const d = shuffle(makeDeck(), rnd);
  s.dealer = (s.dealer + 1) % 4;
  s.handNo += 1;
  s.hands = [0, 1, 2, 3].map((i) => sortHand(d.slice(i * 12, i * 12 + 12)));
  s.kitty = d.slice(48);
  s.discards = null;
  s.bids = [null, null, null, null];
  s.high = null;
  s.contract = null;
  s.trick = []; s.played = []; s.tricks = [0, 0, 0, 0]; s.voids = [{}, {}, {}, {}];
  s.lastTrick = null; s.handResult = null;
  s.phase = 'bid';
  s.turn = (s.dealer + 1) % 4;
  s.nbids = 0;
}

const DIRV = { up: 0, down: 0, nt: 1 };
export const beats = (a, b) => !b || a.n > b.n || (a.n === b.n && DIRV[a.dir] > DIRV[b.dir]);
export function bidLabel(b) { return b === 'pass' ? 'Pass' : `${b.n} ${DIR_NAME[b.dir]}`; }

export function legal(s, seat) {
  if (s.turn !== seat) return [];
  if (s.phase === 'bid') {
    const out = [];
    for (let n = 3; n <= 7; n++) for (const dir of ['up', 'down', 'nt']) if (beats({ n, dir }, s.high)) out.push({ bid: { n, dir } });
    const stuck = seat === s.dealer && !s.high;
    if (!stuck) out.unshift({ pass: true });
    return out;
  }
  if (s.phase === 'kitty') return [{ kitty: true }];
  if (s.phase !== 'play') return [];
  const h = s.hands[seat], ct = s.contract;
  const led = ledSuit(s.trick, ct);
  if (!led) return h.slice();
  const f = h.filter((c) => suitOf(c, ct) === led);
  return f.length ? f : h.slice();
}
function ledSuit(trick, ct) { const t = trick.find((x) => suitOf(x.card, ct) !== 'X'); return t ? suitOf(t.card, ct) : null; }

export function whyIllegal(s, seat, card) {
  if (s.phase !== 'play' || s.turn !== seat) return 'Wait for your turn.';
  if (legal(s, seat).includes(card)) return '';
  const led = ledSuit(s.trick, s.contract);
  const tj = s.contract.trump ? ` (the jokers count as ${SUIT_NAME[s.contract.trump]} this hand)` : '';
  return `You have ${SUIT_NAME[led]}, so you have to follow suit${tj}.`;
}

export function trickWinner(trick, ct) {
  const led = ledSuit(trick, ct);
  let best = null;
  for (const t of trick) {
    const su = suitOf(t.card, ct);
    if (su === 'X') continue;
    if (!best) { best = t; continue; }
    const bs = suitOf(best.card, ct);
    if (su === bs) { if (rank(t.card, ct) > rank(best.card, ct)) best = t; }
    else if (ct.trump && su === ct.trump && bs !== ct.trump) best = t;
  }
  if (!best) best = trick[0];
  return { seat: best.seat, card: best.card, cut: !!(ct.trump && suitOf(best.card, ct) === ct.trump && led !== ct.trump), led };
}

export function apply(s, seat, move) {
  const ev = [];
  if (s.phase === 'bid') {
    if (s.turn !== seat) throw new Error('turn');
    if (move.pass) {
      if (seat === s.dealer && !s.high) throw new Error('dealer is stuck');
      s.bids[seat] = 'pass';
      ev.push({ type: 'bid', seat, pass: true });
    } else {
      const b = move.bid;
      if (!b || b.n < 3 || b.n > 7 || !DIR_NAME[b.dir] || !beats(b, s.high)) throw new Error('bad bid');
      s.bids[seat] = { n: b.n, dir: b.dir };
      s.high = { seat, n: b.n, dir: b.dir };
      ev.push({ type: 'bid', seat, bid: s.bids[seat], stuck: seat === s.dealer && s.bids.filter((x) => x === 'pass').length === 3 });
    }
    s.nbids += 1;
    if (s.nbids >= 4) {
      const h = s.high;
      s.contract = { seat: h.seat, n: h.n, dir: h.dir, trump: null };
      s.phase = 'kitty'; s.turn = h.seat;
      s.hands[h.seat] = s.hands[h.seat].concat(s.kitty);
      ev.push({ type: 'won', seat: h.seat, n: h.n, dir: h.dir });
    } else s.turn = (seat + 1) % 4;
    return ev;
  }
  if (s.phase === 'kitty') {
    if (s.turn !== seat) throw new Error('turn');
    const ct = s.contract, h = s.hands[seat];
    const dis = move.discard || [];
    if (dis.length !== 6 || new Set(dis).size !== 6 || !dis.every((c) => h.includes(c))) throw new Error('discard 6');
    if (ct.dir !== 'nt' && !SUITS.includes(move.trump)) throw new Error('name trump');
    ct.trump = ct.dir === 'nt' ? null : move.trump;
    s.discards = dis;
    s.hands[seat] = sortHand(h.filter((c) => !dis.includes(c)), ct);
    for (let p = 0; p < 4; p++) if (p !== seat) s.hands[p] = sortHand(s.hands[p], ct);
    s.phase = 'play'; s.turn = seat;
    ev.push({ type: 'trump', seat, trump: ct.trump, dir: ct.dir });
    return ev;
  }
  if (s.phase !== 'play') throw new Error('not playing');
  const c = move.card;
  if (!legal(s, seat).includes(c)) throw new Error('illegal');
  const ct = s.contract;
  const led = ledSuit(s.trick, ct);
  if (led && suitOf(c, ct) !== led) s.voids[seat][led] = true;
  s.hands[seat] = s.hands[seat].filter((x) => x !== c);
  s.trick.push({ seat, card: c });
  s.played.push(c);
  ev.push({ type: 'card', seat, card: c });
  if (s.trick.length < 4) { s.turn = (seat + 1) % 4; return ev; }
  const w = trickWinner(s.trick, ct);
  s.tricks[w.seat] += 1;
  s.lastTrick = { cards: s.trick.slice(), winner: w.seat, card: w.card, cut: w.cut, why: explainTrick(w, ct) };
  s.phase = 'trick'; s.turn = -1;
  ev.push({ type: 'trick', ...s.lastTrick });
  return ev;
}
function explainTrick(w, ct) {
  if (w.cut) return `cut it with trump (${cardName(w.card)}): they were out of ${SUIT_NAME[w.led]}`;
  const how = ct.dir === 'down' && !isJ(w.card) ? 'lowest' : 'best';
  return `played the ${how} ${SUIT_NAME[suitOf(w.card, ct)] ? SUIT_NAME[suitOf(w.card, ct)].slice(0, -1) : 'card'} (${cardName(w.card)})${ct.dir === 'down' && rankOf(w.card) === 'A' ? ': aces are still boss in Downtown' : ''}`;
}

export const teamBooks = (s, t) => s.tricks[t] + s.tricks[t + 2] + (s.contract && team(s.contract.seat) === t ? 1 : 0);
export const needBooks = (s) => 6 + s.contract.n;

export function advance(s) {
  const ev = [];
  if (s.phase === 'trick') {
    s.trick = [];
    if (s.hands.every((h) => !h.length)) { scoreHand(s); ev.push({ type: 'handend', result: s.handResult }); return ev; }
    s.phase = 'play'; s.turn = s.lastTrick.winner;
  } else if (s.phase === 'hand') {
    if (s.winner !== null) { s.phase = 'over'; ev.push({ type: 'over', winner: s.winner }); return ev; }
    deal(s); ev.push({ type: 'deal' });
  }
  return ev;
}
export function scoreHand(s) {
  const ct = s.contract, t = team(ct.seat), books = teamBooks(s, t), need = needBooks(s);
  const mult = ct.dir === 'nt' ? 2 : 1;
  const made = books >= need;
  const pts = made ? (books - 6) * mult : -ct.n * mult;
  s.scores[t] += pts;
  s.handResult = { team: t, seat: ct.seat, n: ct.n, dir: ct.dir, trump: ct.trump, books, need, made, pts, boston: books === 13, totals: s.scores.slice() };
  s.history.push(s.handResult);
  s.phase = 'hand'; s.turn = -1;
  const T = s.o.target, [a, b] = s.scores;
  if (a >= T || b >= T) s.winner = a >= b ? 0 : 1;
  else if (a <= -T) s.winner = 1; else if (b <= -T) s.winner = 0;
}

// ---------------- the brain ----------------
/** About how many books this hand takes under a contract (no kitty). */
export function estimate(hand, ct) {
  const reasons = [];
  let n = 0;
  const by = { S: [], H: [], D: [], C: [], X: [] };
  for (const c of hand) by[suitOf(c, ct)].push(c);
  for (const k in by) by[k].sort((a, b) => rank(b, ct) - rank(a, ct));
  const full = (su) => makeDeck().filter((c) => suitOf(c, ct) === su).sort((a, b) => rank(b, ct) - rank(a, ct));
  const trump = ct.trump;
  if (trump) {
    const mine = by[trump], all = full(trump);
    let sure = 0;
    mine.forEach((c, i) => { const missing = all.filter((x) => rank(x, ct) > rank(c, ct) && !mine.includes(x)).length; if (missing <= mine.length - 1 - i && missing <= 2) { sure++; } });
    if (sure) reasons.push(`${sure} trump${sure === 1 ? '' : 's'} that should win (${mine.slice(0, sure).map(cardName).join(', ')})`);
    const extra = Math.max(0, mine.length - Math.max(4, sure));
    if (extra) reasons.push(`${mine.length} trumps: the long ones win late (+${extra})`);
    n += sure + extra;
    let ruff = 0;
    for (const su of SUITS) if (su !== trump) { const L = by[su].length; ruff += L === 0 ? 1 : L === 1 ? 0.5 : 0; }
    const spare = Math.max(0, mine.length - sure - extra);
    const r = Math.min(ruff, spare);
    if (r >= 0.5) { n += r; reasons.push('short side suits, so you can cut'); }
  }
  for (const su of SUITS) {
    if (su === trump) continue;
    const cs = by[su], all = full(su);
    let run = 0;
    for (let i = 0; i < cs.length && i < all.length; i++) { if (cs[i] === all[i]) run++; else break; }
    if (run) { n += Math.min(run, trump ? 2 : run); reasons.push(`top ${run === 1 ? 'card' : run + ' cards'} in ${SUIT_NAME[su]} (${cs.slice(0, run).map(cardName).join(', ')})`); }
    else if (cs[0] === all[1] && cs.length >= 2) { n += 0.5; }
    if (!trump && run >= 2 && cs.length >= 5) { n += cs.length - 4; reasons.push(`long ${SUIT_NAME[su]} run`); }
  }
  return { books: n, reasons };
}
function bestTrump(hand, dir) {
  let best = null;
  for (const su of SUITS) {
    const ct = { dir, trump: su };
    const e = estimate(hand, ct);
    const len = hand.filter((c) => suitOf(c, ct) === su).length;
    const score = e.books + len * 0.15;
    if (!best || score > best.score) best = { su, score, e };
  }
  return best;
}
function evalBids(hand) {
  const opts = [];
  for (const dir of ['up', 'down']) { const b = bestTrump(hand, dir); opts.push({ dir, trump: b.su, books: b.e.books, reasons: b.e.reasons }); }
  const nt = estimate(hand, { dir: 'up', trump: null }), ntd = estimate(hand, { dir: 'down', trump: null });
  opts.push({ dir: 'nt', books: Math.max(nt.books, ntd.books) - 0.5, reasons: (nt.books >= ntd.books ? nt : ntd).reasons, ntDir: nt.books >= ntd.books ? 'up' : 'down' });
  return opts.sort((a, b) => b.books - a.books);
}

function unseen(s, seat) {
  const gone = new Set([...s.played, ...s.hands[seat], ...(s.contract && s.contract.seat === seat && s.discards ? s.discards : [])]);
  return makeDeck().filter((c) => !gone.has(c));
}
const lowest = (cs, ct) => cs.slice().sort((a, b) => rank(a, ct) - rank(b, ct))[0];
const highest = (cs, ct) => cs.slice().sort((a, b) => rank(b, ct) - rank(a, ct))[0];
function beatsCard(c, w, ct) {
  const cs = suitOf(c, ct), ws = suitOf(w, ct);
  if (cs === 'X') return false;
  if (ws === 'X') return true;
  if (cs === ws) return rank(c, ct) > rank(w, ct);
  return !!ct.trump && cs === ct.trump;
}
function isBoss(s, seat, c, counting) {
  const ct = s.contract, su = suitOf(c, ct);
  if (su === 'X') return false;
  if (!counting) return rank(c, ct) >= 14;
  return !unseen(s, seat).some((x) => suitOf(x, ct) === su && rank(x, ct) > rank(c, ct));
}

/** style: { bold: -1..1 } shifts bidding; level: easy|medium|hard */
export function think(s, seat, level = 'medium', style = {}) {
  const L = legal(s, seat);
  if (!L.length) return null;
  const bold = style.bold || 0;
  if (s.phase === 'bid') {
    const opts = evalBids(s.hands[seat]);
    const pick = (o) => ({ move: { bid: { n: o.n, dir: o.dir } }, why: o.why });
    const stuck = !L.some((m) => m.pass);
    for (const o of opts) {
      const teamEst = o.books + 2.9 + 1 + 0.6 + bold * 0.8 + (level === 'easy' ? (Math.random() - 0.5) * 1.5 : 0);
      o.n = Math.min(7, Math.floor(teamEst) - 6);
      o.why = `You've got about ${Math.round(o.books * 10) / 10} books ${o.dir === 'nt' ? 'with no trump' : `${DIR_NAME[o.dir]} with ${SUIT_NAME[o.trump]} as trump`}${o.reasons.length ? ` (${o.reasons.slice(0, 3).join('; ')})` : ''}. Count on about 3 from your partner, plus 1 for the kitty → bid ${o.n}.`;
    }
    const p = partner(seat), partnerHigh = s.high && s.high.seat === p;
    const ok = opts.filter((o) => o.n >= 3 && beats({ n: o.n, dir: o.dir }, s.high) && (!partnerHigh || o.n >= s.high.n + 1));
    if (ok.length) return pick(ok[0]);
    if (stuck) { const o = opts[0]; o.n = Math.max(3, Math.min(7, o.n)); if (!beats({ n: o.n, dir: o.dir }, s.high)) o.n = 3; o.why = "Everybody passed, so the dealer is stuck and has to bid. Take the minimum (3) in your best direction."; return pick(o); }
    const top = opts[0];
    return { move: { pass: true }, why: partnerHigh ? `Your partner already has the bid. Don't bid against your own partner unless you're much stronger.` : top.n >= 3 ? `You'd only bid ${top.n}, and that doesn't beat ${bidLabel(s.high)}. Pass.` : `This hand is only worth about ${Math.round(top.books * 10) / 10} books on its own. Not enough to win a bid, so pass.` };
  }
  if (s.phase === 'kitty') {
    const ct = s.contract, h = s.hands[seat];
    let trump = null, why = '';
    if (ct.dir !== 'nt') { const b = bestTrump(h, ct.dir); trump = b.su; why = `Make ${SUIT_NAME[trump]} trump: it's your strongest suit (${h.filter((c) => suitOf(c, { ...ct, trump }) === trump).length} cards counting jokers). `; }
    const c2 = { ...ct, trump };
    const keepScore = (c) => {
      const su = suitOf(c, c2);
      if (su === 'X') return -5;
      if (trump && su === trump) return 50 + rank(c, c2);
      const len = h.filter((x) => suitOf(x, c2) === su).length;
      return rank(c, c2) * 2 + len * 1.5 + (isBoss({ ...s, contract: c2 }, seat, c, false) ? 20 : 0);
    };
    const discard = h.slice().sort((a, b) => keepScore(a) - keepScore(b)).slice(0, 6);
    why += ct.dir === 'nt' ? 'In No Trump the jokers are worthless, so throw them out first, then your weakest cards.' : 'Throw out your weakest side cards; emptying a short suit lets you cut it later.';
    return { move: { discard, trump }, why };
  }
  // ---- play ----
  const ct = s.contract, counting = level === 'hard';
  if (level === 'easy' && Math.random() < 0.3) { const c = L[Math.floor(Math.random() * L.length)]; return { move: { card: c }, why: 'Any legal card.' }; }
  const pick = (c, why) => ({ move: { card: c }, why });
  const t = team(seat), declarer = team(ct.seat) === t;
  if (!s.trick.length) {
    const nonX = L.filter((c) => suitOf(c, ct) !== 'X');
    const pool = nonX.length ? nonX : L;
    const tr = ct.trump ? pool.filter((c) => suitOf(c, ct) === ct.trump) : [];
    if (declarer && tr.length >= 3 && tr.some((c) => isBoss(s, seat, c, counting))) { const c = highest(tr, ct); return pick(c, `Lead your best trump (${cardName(c)}) to pull the other team's trumps, so they can't cut your winners.`); }
    const boss = pool.filter((c) => isBoss(s, seat, c, counting) && suitOf(c, ct) !== ct.trump);
    if (boss.length) { const c = boss[0]; return pick(c, `${cardName(c)} is the boss of ${SUIT_NAME[suitOf(c, ct)]}${ct.dir === 'down' ? ' (Downtown: low wins, and the ace is still on top)' : ''}. Cash it now.`); }
    const pv = s.voids[partner(seat)];
    const forPartner = pool.filter((c) => pv[suitOf(c, ct)] && suitOf(c, ct) !== ct.trump);
    if (forPartner.length && ct.trump) return pick(lowest(forPartner, ct), `Your partner is out of ${SUIT_NAME[suitOf(forPartner[0], ct)]}. Lead it so they can cut.`);
    const by = {}; for (const c of pool) if (suitOf(c, ct) !== ct.trump) (by[suitOf(c, ct)] = by[suitOf(c, ct)] || []).push(c);
    const longest = Object.values(by).sort((a, b) => b.length - a.length)[0] || pool;
    const c = lowest(longest, ct);
    return pick(c, `Lead a weak card from your longest side suit and save your good ones.`);
  }
  const w = trickWinner(s.trick, ct);
  const last = s.trick.length === 3;
  const led = ledSuit(s.trick, ct);
  const following = led && L.every((c) => suitOf(c, ct) === led);
  const winners = L.filter((c) => beatsCard(c, w.card, ct));
  const dump = () => { const non = L.filter((c) => suitOf(c, ct) !== ct.trump); const pool = non.length ? non : L; const x = pool.filter((c) => suitOf(c, ct) === 'X'); return x.length ? x[0] : lowest(pool, ct); };
  if (w.seat === partner(seat) && (last || isBoss(s, seat, w.card, counting))) {
    const c = following ? lowest(L, ct) : dump();
    return pick(c, "Your partner's got this book. Throw your weakest card. Never waste a good one on your own partner.");
  }
  if (winners.length) {
    if (last) { const c = lowest(winners, ct); return pick(c, `You're last, so win it with your cheapest winning card (${cardName(c)}).`); }
    if (!following) { const c = lowest(winners, ct); return pick(c, `Out of ${SUIT_NAME[led]}? Cut it with your lowest trump (${cardName(c)}).`); }
    const boss = winners.filter((c) => isBoss(s, seat, c, counting));
    if (boss.length) { const c = lowest(boss, ct); return pick(c, `${cardName(c)} can't be beaten here. Take the book.`); }
    const c = highest(winners, ct);
    return pick(c, `Play strong (${cardName(c)}) to make them spend their big cards.`);
  }
  const c = following ? lowest(L, ct) : dump();
  return pick(c, following ? "You can't win this one, so throw your weakest card." : `You can't follow ${SUIT_NAME[led] || 'suit'} and can't win, so throw away something you don't need.`);
}
