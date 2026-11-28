// ============================================================
// SPADES — rules engine, bots and coach (no DOM; runs in browser or node)
// Partnership spades: seats 0 & 2 vs 1 & 3. Books = tricks.
// House rule "jokers": take out 2♣ and 2♥, add Big & Little Joker.
// Trump order then: Big Joker > Little Joker > 2♦ > 2♠ > A♠ > K♠ …
// ============================================================
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RV = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

export const team = (seat) => seat % 2;
export const partner = (seat) => (seat + 2) % 4;

export function rankOf(c) { return c === 'BJ' || c === 'LJ' ? c : c.slice(0, -1); }
export function rawSuit(c) { return c === 'BJ' || c === 'LJ' ? 'S' : c.slice(-1); }
/** The suit a card plays as (jokers and, with house rules, the 2♦ are spades). */
export function suitOf(c, o) { if (o && o.jokers && c === '2D') return 'S'; return rawSuit(c); }
/** Power within its playing suit; spades beat everything else. */
export function power(c, o) {
  if (c === 'BJ') return 100; if (c === 'LJ') return 99;
  if (o && o.jokers) { if (c === '2D') return 98; if (c === '2S') return 97; }
  return RV[rankOf(c)];
}
export function cardName(c, o) {
  if (c === 'BJ') return 'Big Joker'; if (c === 'LJ') return 'Little Joker';
  return rankOf(c) + SUIT_SYM[rawSuit(c)];
}

export function makeDeck(o) {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  if (o.jokers) { d.splice(d.indexOf('2C'), 1); d.splice(d.indexOf('2H'), 1); d.push('BJ', 'LJ'); }
  return d;
}
function shuffle(a, rnd = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sortHand(h, o) {
  const order = { S: 0, H: 1, C: 2, D: 3 };
  return h.slice().sort((a, b) => (order[suitOf(a, o)] - order[suitOf(b, o)]) || (power(b, o) - power(a, o)));
}

// ---------------- game flow ----------------
export function newGame(opts = {}) {
  const o = { jokers: !!opts.jokers, target: opts.target || 300, nil: opts.nil !== false };
  const s = { game: 'spades', o, dealer: Math.floor(Math.random() * 4), scores: [0, 0], bags: [0, 0], handNo: 0, history: [], phase: 'bid', winner: null };
  deal(s);
  return s;
}

export function deal(s, rnd) {
  const d = shuffle(makeDeck(s.o), rnd);
  s.hands = [0, 1, 2, 3].map((i) => sortHand(d.slice(i * 13, i * 13 + 13), s.o));
  s.dealer = (s.dealer + 1) % 4;
  s.handNo += 1;
  s.bids = [null, null, null, null];
  s.tricks = [0, 0, 0, 0];
  s.trick = [];
  s.played = [];
  s.voids = [{}, {}, {}, {}];
  s.spadesBroken = false;
  s.turn = (s.dealer + 1) % 4;
  s.phase = 'bid';
  s.lastTrick = null;
  s.handResult = null;
}

export function contract(s, t) { return [t, t + 2].reduce((n, p) => n + (s.bids[p] > 0 ? s.bids[p] : 0), 0); }
export function teamBooks(s, t) { return [t, t + 2].reduce((n, p) => n + (s.bids[p] === 0 ? 0 : s.tricks[p]), 0); }

/** Legal moves for a seat right now. Bids: numbers 0..13. Play: card codes. */
export function legal(s, seat) {
  if (s.turn !== seat) return [];
  if (s.phase === 'bid') return Array.from({ length: 14 }, (_, i) => i).filter((b) => b > 0 || s.o.nil);
  if (s.phase !== 'play') return [];
  const h = s.hands[seat], o = s.o;
  if (!s.trick.length) {
    if (s.spadesBroken) return h.slice();
    const non = h.filter((c) => suitOf(c, o) !== 'S');
    return non.length ? non : h.slice();
  }
  const led = suitOf(s.trick[0].card, o);
  const f = h.filter((c) => suitOf(c, o) === led);
  return f.length ? f : h.slice();
}

/** Why a card can't be played (for the coach), or '' if it can. */
export function whyIllegal(s, seat, card) {
  if (s.phase !== 'play' || s.turn !== seat) return 'Wait for your turn.';
  if (legal(s, seat).includes(card)) return '';
  const o = s.o;
  if (!s.trick.length) return "Spades aren't broken yet: lead another suit first. (Spades break when someone cuts with one.)";
  const led = suitOf(s.trick[0].card, o);
  return `You have ${SUIT_NAME[led]}, so you must follow suit with ${SUIT_NAME[led]}.`;
}

export function trickWinner(trick, o) {
  const led = suitOf(trick[0].card, o);
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const bs = suitOf(best.card, o), ts = suitOf(t.card, o);
    if (ts === bs) { if (power(t.card, o) > power(best.card, o)) best = t; }
    else if (ts === 'S' && bs !== 'S') best = t;
  }
  return { seat: best.seat, card: best.card, cut: suitOf(best.card, o) === 'S' && led !== 'S' };
}

/** Apply a move. Returns a list of events (for sounds, animations, coach). */
export function apply(s, seat, move) {
  const ev = [];
  if (s.phase === 'bid') {
    const b = move.bid;
    if (s.turn !== seat || !legal(s, seat).includes(b)) throw new Error('illegal bid');
    s.bids[seat] = b;
    ev.push({ type: 'bid', seat, bid: b });
    s.turn = (seat + 1) % 4;
    if (s.bids.every((x) => x !== null)) { s.phase = 'play'; s.turn = (s.dealer + 1) % 4; ev.push({ type: 'playstart' }); }
    return ev;
  }
  if (s.phase !== 'play') throw new Error('not playing');
  const c = move.card;
  if (!legal(s, seat).includes(c)) throw new Error('illegal card');
  const o = s.o;
  if (s.trick.length) {
    const led = suitOf(s.trick[0].card, o);
    if (suitOf(c, o) !== led) s.voids[seat][led] = true;
  }
  if (suitOf(c, o) === 'S' && !s.spadesBroken) { s.spadesBroken = true; ev.push({ type: 'broken', seat, card: c }); }
  s.hands[seat] = s.hands[seat].filter((x) => x !== c);
  s.trick.push({ seat, card: c });
  s.played.push(c);
  ev.push({ type: 'card', seat, card: c });
  if (s.trick.length < 4) { s.turn = (seat + 1) % 4; return ev; }
  const w = trickWinner(s.trick, o);
  s.tricks[w.seat] += 1;
  s.lastTrick = { cards: s.trick.slice(), winner: w.seat, card: w.card, cut: w.cut, why: explainTrick(s.trick, w, o) };
  s.phase = 'trick';
  s.turn = -1;
  ev.push({ type: 'trick', ...s.lastTrick });
  return ev;
}

/** Host calls this after showing a finished trick / hand for a moment. */
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

function explainTrick(trick, w, o) {
  const led = suitOf(trick[0].card, o);
  if (w.cut) return `cut it with ${cardName(w.card, o)}: they were out of ${SUIT_NAME[led]}, and a spade beats any other suit`;
  if (led === 'S') return `played the highest spade (${cardName(w.card, o)})`;
  return `played the highest ${SUIT_NAME[led].slice(0, -1)} (${cardName(w.card, o)}) and nobody cut it`;
}

export function scoreHand(s) {
  const res = [0, 1].map((t) => {
    const seats = [t, t + 2], con = contract(s, t), books = teamBooks(s, t);
    let pts = 0, bags = 0; const notes = [];
    for (const p of seats) if (s.bids[p] === 0) {
      if (s.tricks[p] === 0) { pts += 100; notes.push({ seat: p, k: 'nilmade' }); }
      else { pts -= 100; bags += s.tricks[p]; notes.push({ seat: p, k: 'nilfail', n: s.tricks[p] }); }
    }
    let made = null;
    if (con > 0) {
      made = books >= con;
      if (made) { pts += con * 10; bags += books - con; } else pts -= con * 10;
    }
    if (books + seats.reduce((n, p) => n + (s.bids[p] === 0 ? s.tricks[p] : 0), 0) === 13 && con > 0) notes.push({ k: 'boston' });
    s.bags[t] += bags; pts += bags;
    let bagPenalty = false;
    while (s.bags[t] >= 10) { s.bags[t] -= 10; pts -= 100; bagPenalty = true; }
    s.scores[t] += pts;
    return { team: t, contract: con, books, made, bags, bagPenalty, pts, notes, total: s.scores[t] };
  });
  s.handResult = res;
  s.history.push(res.map((r) => r.pts));
  s.phase = 'hand';
  s.turn = -1;
  const [a, b] = s.scores, T = s.o.target;
  if ((a >= T || b >= T) && a !== b) s.winner = a > b ? 0 : 1;
  else if (a <= -200 && b > a) s.winner = 1;
  else if (b <= -200 && a > b) s.winner = 0;
}

// ---------------- bidding brain (also the coach's "count your books") ----------------
export function estimate(hand, o) {
  const reasons = [];
  let n = 0;
  const bySuit = { S: [], H: [], D: [], C: [] };
  for (const c of hand) bySuit[suitOf(c, o)].push(c);
  for (const k in bySuit) bySuit[k].sort((a, b) => power(b, o) - power(a, o));
  // spades: a spade is a book if you hold enough smaller spades to outlast the missing bigger ones
  const allSp = makeDeck(o).filter((c) => suitOf(c, o) === 'S').sort((a, b) => power(b, o) - power(a, o));
  const mine = bySuit.S; let spBooks = 0; const counted = new Set();
  mine.forEach((c, i) => {
    const missing = allSp.filter((x) => power(x, o) > power(c, o) && !mine.includes(x)).length;
    const below = mine.length - 1 - i;
    if (missing <= below && missing <= 2) { spBooks += 1; counted.add(c); reasons.push(missing === 0 ? `${cardName(c, o)} is the boss spade: a sure book` : `${cardName(c, o)} should win; you've got ${below} smaller spade${below === 1 ? '' : 's'} to protect it`); }
  });
  const spare = mine.filter((c) => !counted.has(c)).length;
  const extra = Math.max(0, Math.min(mine.length - 4, spare - 1));
  if (extra > 0) reasons.push(`${mine.length} spades is a lot: long spades usually take ${extra} extra book${extra === 1 ? '' : 's'} late in the hand`);
  n += spBooks + extra;
  // side suits
  let ruff = 0;
  for (const su of ['H', 'D', 'C']) {
    const cs = bySuit[su], len = cs.length;
    const has = (r) => cs.some((c) => rankOf(c) === r);
    if (has('A') && len <= 6) { n += 1; reasons.push(`A${SUIT_SYM[su]} is a book (aces win unless somebody cuts)`); }
    if (has('K') && len >= 2 && len <= 5) { const v = has('A') ? 0.9 : 0.6; n += v; reasons.push(`K${SUIT_SYM[su]} with backup${has('A') ? ' behind your ace' : ''} is ${has('A') ? 'very likely' : 'maybe'} a book`); }
    if (has('Q') && len >= 3 && (has('A') || has('K')) && len <= 5) { n += 0.3; }
    if (len === 0) ruff += 1; else if (len === 1 && !has('A')) ruff += 0.6; else if (len === 2) ruff += 0.25;
  }
  const ruffV = Math.min(ruff, Math.max(0, spare - extra));
  if (ruffV >= 0.6) { n += ruffV; reasons.push(`short in a side suit with spare spades, so you can cut (+${Math.round(ruffV * 10) / 10})`); }
  const books = Math.max(0, n);
  const highSpade = mine.some((c) => power(c, o) >= 11);
  const nilOk = o.nil && books < 1.2 && !highSpade && mine.length <= 3 && !hand.some((c) => rankOf(c) === 'A');
  return { books, bid: Math.max(1, Math.floor(books + 0.6)), nilOk, reasons };
}

// ---------------- card play brain ----------------
function unseen(s, seat) {
  const gone = new Set([...s.played, ...s.hands[seat]]);
  return makeDeck(s.o).filter((c) => !gone.has(c));
}
/** Nobody else can still beat this card in its suit (spades still might cut). */
function isBoss(s, seat, c, counting) {
  const o = s.o, su = suitOf(c, o);
  if (!counting) return su === 'S' ? power(c, o) >= 14 && power(c, o) >= Math.max(...unseen(s, seat).filter((x) => suitOf(x, o) === 'S').map((x) => power(x, o)), 0) : rankOf(c) === 'A';
  return !unseen(s, seat).some((x) => suitOf(x, o) === su && power(x, o) > power(c, o));
}
const lowest = (cs, o) => cs.slice().sort((a, b) => power(a, o) - power(b, o))[0];
const highest = (cs, o) => cs.slice().sort((a, b) => power(b, o) - power(a, o))[0];
function beats(c, w, led, o) {
  const cs = suitOf(c, o), ws = suitOf(w, o);
  if (cs === ws) return power(c, o) > power(w, o);
  return cs === 'S' && ws !== 'S';
}

/**
 * Pick a move for a bot (or the coach). level: 'easy' | 'medium' | 'hard'.
 * Returns { move, why } — "why" is a plain-English reason for the coach.
 */
export function think(s, seat, level = 'medium') {
  const o = s.o, L = legal(s, seat);
  if (!L.length) return null;
  if (s.phase === 'bid') {
    const e = estimate(s.hands[seat], o);
    const p = partner(seat), pb = s.bids[p];
    let bid = e.bid;
    if (level === 'easy') bid = Math.max(1, Math.round(e.books + (Math.random() - 0.5)));
    if (level !== 'easy' && e.nilOk && pb !== 0 && (pb === null || pb >= 3)) return { move: { bid: 0 }, why: 'This hand is so weak it may not win a single book. Bidding Nil is worth +100 if you take zero books.', reasons: e.reasons };
    bid = Math.min(13, bid);
    const why = e.reasons.length ? `Count your books: ${e.reasons.slice(0, 4).join('; ')}. That's about ${Math.round(e.books * 10) / 10}, so bid ${bid}.` : `No sure books in this hand, so bid the minimum (${bid}). (Nil might be worth a look.)`;
    return { move: { bid }, why, reasons: e.reasons };
  }
  const counting = level === 'hard';
  if (level === 'easy' && Math.random() < 0.35) { const c = L[Math.floor(Math.random() * L.length)]; return { move: { card: c }, why: 'Any legal card.' }; }
  const t = team(seat), p = partner(seat);
  const need = Math.max(0, contract(s, t) - teamBooks(s, t));
  const madeIt = contract(s, t) > 0 && need === 0;
  const iNil = s.bids[seat] === 0, pNil = s.bids[p] === 0;
  const oppNil = [1, 3].map((x) => (seat + x) % 4).filter((x) => s.bids[x] === 0 && s.tricks[x] === 0);
  const pick = (c, why) => ({ move: { card: c }, why });

  // ---- leading ----
  if (!s.trick.length) {
    if (iNil) return pick(lowest(L, o), "You bid Nil, so lead your lowest card and let somebody else take it.");
    const nonS = L.filter((c) => suitOf(c, o) !== 'S');
    if (oppNil.length) {
      const lowLead = lowest(nonS.length ? nonS : L, o);
      return pick(lowLead, 'An opponent bid Nil. Lead low cards so they get stuck winning a book.');
    }
    const bosses = L.filter((c) => isBoss(s, seat, c, counting) && suitOf(c, o) !== 'S');
    if (bosses.length && !madeIt) {
      const c = highest(bosses, o);
      return pick(c, `${cardName(c, o)} is the boss of ${SUIT_NAME[suitOf(c, o)]}: nobody can follow suit and beat it, so cash it now before someone runs out and can cut it.`);
    }
    const sp = L.filter((c) => suitOf(c, o) === 'S');
    if (counting && sp.length >= 3 && sp.some((c) => isBoss(s, seat, c, true)) && !madeIt) {
      const c = highest(sp, o);
      return pick(c, `Lead your boss spade (${cardName(c, o)}) to pull out the other team's spades, so they can't cut your winners later.`);
    }
    const pv = s.voids[p];
    const partnerCut = nonS.filter((c) => pv[suitOf(c, o)] && !s.voids[(seat + 1) % 4][suitOf(c, o)]);
    if (partnerCut.length && !pNil && !madeIt) return pick(lowest(partnerCut, o), `Your partner is out of ${SUIT_NAME[suitOf(partnerCut[0], o)]}. Lead it low so they can cut it with a spade.`);
    const pool = nonS.length ? nonS : L;
    const bySuit = {};
    for (const c of pool) (bySuit[suitOf(c, o)] = bySuit[suitOf(c, o)] || []).push(c);
    const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
    if (madeIt) return pick(lowest(pool, o), 'Your team already made its bid. Lead low and try not to take extra books (bags).');
    const c = lowest(longest, o);
    return pick(c, `Lead low from your longest suit (${SUIT_NAME[suitOf(c, o)]}): it keeps your high cards for later and runs the others out of that suit.`);
  }

  // ---- following ----
  const led = suitOf(s.trick[0].card, o);
  const w = trickWinner(s.trick, o);
  const last = s.trick.length === 3;
  const winners = L.filter((c) => beats(c, w.card, led, o));
  const losers = L.filter((c) => !beats(c, w.card, led, o));
  const following = L.every((c) => suitOf(c, o) === led);
  const dumpable = (cs) => { const n = cs.filter((c) => suitOf(c, o) !== 'S'); return n.length ? n : cs; };

  if (iNil) {
    if (losers.length) { const c = highest(losers, o); return pick(c, `You bid Nil. Play your highest card that still loses (${cardName(c, o)}) to get rid of danger cards safely.`); }
    return pick(lowest(L, o), 'Every card you have wins this one. Play the lowest and hope your partner covers you.');
  }
  if (pNil && w.seat === p && winners.length) {
    const c = last ? lowest(winners, o) : highest(winners, o);
    return pick(c, `Your partner bid Nil and is winning this trick. Cover them by winning it yourself (${cardName(c, o)}).`);
  }
  if (oppNil.includes(w.seat) && losers.length) {
    const c = highest(losers, o);
    return pick(c, 'The Nil bidder is winning this one. Stay under them so they get stuck with the book.');
  }
  if (w.seat === p) {
    const safe = last || isBoss(s, seat, w.card, counting);
    if (safe || !winners.length) {
      const c = following ? lowest(L, o) : lowest(dumpable(L), o);
      return pick(c, last ? 'Your partner already has this book won. Play your lowest card: never waste a good card on your own partner.' : `Your partner's ${cardName(w.card, o)} is the boss, so play low and save your good cards.`);
    }
  }
  if (winners.length && (!madeIt || oppNil.length)) {
    if (last) {
      const c = lowest(winners, o);
      return pick(c, `You're last to play, so win it with your cheapest winning card (${cardName(c, o)}).`);
    }
    const boss = winners.filter((c) => isBoss(s, seat, c, counting));
    if (boss.length && following) { const c = lowest(boss, o); return pick(c, `${cardName(c, o)} can't be beaten in ${SUIT_NAME[led]}, so take the book.`); }
    if (!following) { const c = lowest(winners, o); return pick(c, `You're out of ${SUIT_NAME[led]}, so cut it with your lowest spade (${cardName(c, o)}).`); }
    const hi = highest(winners, o);
    if (power(hi, o) >= 12) return pick(hi, `Play high (${cardName(hi, o)}) to beat what's there and force out the bigger cards.`);
    const c = lowest(L, o);
    return pick(c, 'Your winners are small and could get topped. Save them, play low and let your partner try.');
  }
  if (madeIt && losers.length) {
    const c = highest(losers, o);
    return pick(c, `Your team made its bid. Duck with ${cardName(c, o)} to dodge bags (10 bags = −100).`);
  }
  const c = following ? lowest(L, o) : lowest(dumpable(L), o);
  return pick(c, following ? "You can't win this one, so throw your lowest card." : `You can't follow ${SUIT_NAME[led]}. Throw away a low card from a short suit (keep your spades for cutting).`);
}
