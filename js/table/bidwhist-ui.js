// Bid Whist: screens, lessons and table talk for the shared table shell.
import * as R from './bidwhist.js';
import { cardHtml } from './spades-ui.js';
import { esc } from '../util.js';

const { SUIT_SYM, SUIT_NAME, DIR_NAME, cardName, bidLabel } = R;
const DIR_ICON = { up: '⬆️', down: '⬇️', nt: '🚫' };
const row = (cs) => `<div class="cd-row">${cs.map((c) => cardHtml(c)).join('')}</div>`;
const trickDemo = (cards, win) => `<div class="trick-demo">${cards.map((c, i) => `<div class="td ${i === win ? 'win' : ''}">${cardHtml(c)}<small>${['Led', '2nd', '3rd', '4th'][i]}</small></div>`).join('')}</div>`;
const seen = new Set();
let ks = { key: '', set: new Set(), trump: null };
let bwDir = { key: '', dir: 'up' };

const LESSONS = [
  {
    title: 'Welcome to the Whist table',
    say: "Bid Whist was <b>THE</b> game at a lot of family tables before Spades took over. Let me show you.",
    body: `<ul class="tl-list"><li>4 players, 2 teams. Partners sit <b>across</b>.</li><li>The whole deck <b>plus both jokers</b>: 54 cards.</li><li>Everybody gets <b>12 cards</b>. The other <b>6 go face-down in the kitty</b>.</li><li>Each round of 4 cards is a <b>book</b>. Win the bid, then take enough books to make it.</li></ul>`,
    demo: `<div class="seat-demo"><span class="sd top">Partner</span><span class="sd left">Them</span><span class="sd mid">🂠×6</span><span class="sd right">Them</span><span class="sd bot">You</span></div>`,
  },
  {
    title: 'Uptown or Downtown?',
    say: "Here's what makes Whist special: the winner of the bid decides whether <b>high cards or low cards</b> win.",
    body: `<p><b>⬆️ Uptown</b>: high wins, like usual: <b>A K Q J … 3 2</b>.</p>${row(['AH', 'KH', 'QH', '2H'])}<p><b>⬇️ Downtown</b>: low wins: <b>A 2 3 4 … Q K</b>. The ace stays on top either way!</p>${row(['AH', '2H', '3H', 'KH'])}`,
    quiz: { q: "It's Downtown. Hearts were led. Who wins?", opts: [{ html: trickDemo(['9H', 'KH', '3H', '6H'], -1) + '<b>the K♥</b>', why: 'In Downtown the K is the WORST card.' }, { html: '<b>the 3♥</b>', right: true, why: 'Downtown means low wins. No ace or 2 showed up, so the 3♥ is the lowest, and it takes it.' }, { html: '<b>the 9♥</b>', why: 'Low wins Downtown: look for the smallest heart.' }] },
  },
  {
    title: 'What the bid means',
    say: 'The first 6 books are free. Your bid is <b>how many MORE</b> you\'ll take.',
    body: `<ul class="tl-list"><li>Bids go from <b>3 to 7</b>, plus a direction: ⬆️ Uptown, ⬇️ Downtown or 🚫 No Trump.</li><li>Bid <b>4</b> means your team needs <b>6 + 4 = 10 books</b>.</li><li>Everybody bids once, starting left of the dealer. A <b>higher number</b> wins. At the <b>same number, No Trump beats</b> Uptown or Downtown.</li><li>If everybody else passes, the dealer is <b>stuck</b> and has to bid.</li></ul>`,
    quiz: { q: 'Your team bids 5. How many books do you need?', opts: [{ html: '<b>5</b>', why: "Don't forget the free 6." }, { html: '<b>11</b>', right: true, why: '6 + 5 = 11 books.' }, { html: '<b>13</b>', why: "That's all of them. You only need 6 + 5 = 11." }] },
  },
  {
    title: 'The kitty & trump',
    say: 'Win the bid and the <b>kitty</b> is yours.',
    body: `<ul class="tl-list"><li>The winner picks up the <b>6 kitty cards</b> (now holding 18), then <b>throws 6 away</b>.</li><li>Those 6 thrown cards count as your team's <b>first book</b>.</li><li>Then you <b>name trump</b>: pick your strongest suit. (No trump if you bid No Trump.)</li><li>Smart move: throw away a whole short suit, so you can <b>cut</b> it with trump later.</li></ul>`,
  },
  {
    title: 'The jokers',
    say: "And the jokers? They're the <b>bosses</b>… most of the time.",
    body: `<p>With a trump suit, the <b>Big Joker</b> is the best card in the deck, then the <b>Little Joker</b>. Both count as trump.</p>${row(['BJ', 'LJ', 'AS', 'KS'])}<p>In <b>No Trump</b> the jokers are worthless: they can't win anything. Throw them in the kitty.</p>`,
    quiz: { q: 'Spades are trump. Which card is the boss?', opts: [{ html: row(['AS']), why: 'The A♠ is great, but two cards beat it.' }, { html: row(['BJ']), right: true, why: 'Big Joker, then Little Joker, then the top trumps.' }, { html: row(['LJ']), why: 'The Little Joker is second. The Big Joker is boss.' }] },
  },
  {
    title: 'Follow suit, then cut',
    say: 'Same rule as Spades: if you have the suit that was led, <b>you play it</b>.',
    body: `<ul class="tl-list"><li>Follow suit if you can.</li><li>Out of that suit? <b>Cut</b> it with a trump to win, or throw something away.</li><li>Whoever wins the book leads the next one. The bid winner leads first.</li></ul>`,
    quiz: { q: 'Hearts are trump. Clubs were led. You have no clubs. Which card can win it?', opts: [{ html: row(['AD']), why: "A diamond can't win a club book." }, { html: row(['4H']), right: true, why: 'Any trump beats a non-trump card. Cut it!' }, { html: row(['KS']), why: "A spade isn't trump here, so it can't win a club book." }] },
  },
  {
    title: 'Scoring',
    say: "Make it and count your books over 6. Miss it and it costs you.",
    body: `<table class="tl-tbl"><tr><td>Make your bid</td><td><b>+1 per book over 6</b></td></tr><tr><td>Get <b>set</b></td><td><b>− your bid</b></td></tr><tr><td>🚫 No Trump</td><td>everything <b>×2</b></td></tr><tr><td>Win</td><td>first team to <b>7</b></td></tr></table><p class="tl-small">The kitty counts as one of your books. Take all 13 and that's a <b>Boston</b>!</p>`,
    quiz: { q: 'You bid 4 Uptown and took 11 books (kitty included). Points?', opts: [{ html: '<b>+4</b>', why: 'You count ALL your books over 6, not just your bid.' }, { html: '<b>+5</b>', right: true, why: '11 − 6 = 5. You needed 10, took 11.' }, { html: '<b>+11</b>', why: 'Only books over 6 count: 11 − 6 = 5.' }] },
  },
  {
    title: 'Play like Big Mama',
    say: 'A few things the old heads know…',
    body: `<ul class="tl-list"><li>🧮 <b>Bid with your partner in mind.</b> Count your own sure books, then about 3 more from your partner and 1 for the kitty.</li><li>⬇️ <b>Lots of little cards?</b> Go Downtown. A hand of A, 2, 3s is gold.</li><li>👑 <b>Bid winner:</b> lead your top trumps early to pull theirs out.</li><li>🤝 <b>Never beat your partner's winner.</b></li><li>🎯 Partner out of a suit? Lead it so they can cut.</li></ul><p>Let's play a practice hand. The coach will explain every move.</p>`,
  },
];

const RULES = `<ul class="tl-list">
<li>4 players, partners across. 54 cards (with both jokers): 12 each, 6 in the kitty.</li>
<li><b>Bid</b> once around, starting left of the dealer: 3–7 plus ⬆️ Uptown (high wins), ⬇️ Downtown (low wins: A, 2, 3 … K) or 🚫 No Trump. Higher number wins; at the same number No Trump beats a suit bid. All pass = the dealer is stuck and bids.</li>
<li>The winner takes the kitty, throws out 6 (they count as a book) and names trump. The winner leads first.</li>
<li>Big Joker > Little Joker > top trumps. In No Trump, jokers can't win anything.</li>
<li>Follow suit if you can. Out? Cut with trump or throw anything.</li>
<li><b>Scoring</b>: make it = books over 6. Set = lose your bid. No Trump doubles it. First to 7 wins (−7 loses).</li>
<li>House rules vary a lot from family to family. This is a common version.</li></ul>`;

export const BIDWHIST = {
  id: 'bidwhist',
  title: 'BID WHIST',
  tagline: 'Uptown, Downtown, no trump. Run a Boston.',
  titleArt: 'assets/table/bidwhist_title.svg',
  coach: { name: 'Big Mama Pearl', img: 'assets/cookout/guest_grandma.webp' },
  R,
  lessons: LESSONS,
  rulesHtml: RULES,
  options: [{ key: 'target', label: 'Play to', def: 5, choices: [[5, '5 (quick)'], [7, '7'], [11, '11 (long)']] }],
  practiceOpts: { target: 5 },
  startLine: (g, seats) => `${seats[g.dealer].name} dealt. ${seats[(g.dealer + 1) % 4].name} bids first.`,
  turnHint: (g) => (g.phase === 'bid' ? 'Bid or pass.' : g.phase === 'kitty' ? 'Throw out 6 cards and pick trump.' : g.trick.length ? 'Follow suit if you can.' : 'You lead this book.'),
  talkKey(e, g) {
    if (e.type === 'bid' && e.stuck) return { seat: e.seat, key: 'stuck' };
    if (e.type === 'bid' && e.bid && e.bid.n >= 5) return { seat: e.seat, key: 'bigbid' };
    if (e.type === 'trump' && e.dir === 'down') return { seat: e.seat, key: 'downtown' };
    if (e.type === 'trick' && e.cut) return { seat: e.winner, key: 'cut', p: 0.6 };
    if (e.type === 'handend') {
      const r = e.result;
      if (r.boston) return { seat: r.seat, key: 'boston' };
      if (!r.made) return { seat: (r.seat + 1) % 4, key: 'set' };
      return { seat: r.seat, key: 'made', p: 0.6 };
    }
    return null;
  },
  lines: {
    stuck: ['Stuck again?! Y\'all did this on purpose 😒', 'Dealer\'s stuck… fine. FINE.', 'Oh so nobody got nothing? Okay.', 'Stuck with it. Watch me work though.'],
    bigbid: ['I got a hand, baby 😤', 'Y\'all might as well put the cards down', 'Big bid, big talk', 'Run me my books'],
    downtown: ['We going DOWNTOWN ⬇️', 'Low and slow, baby', 'Little cards, big money'],
    cut: ['Cut! ✂️', 'Ain\'t got none 😏', 'Trump tight!', 'Nope. Mine.', 'Sit down 😂'],
    set: ['SET! Pay up 📉', 'Y\'all got set, sit down!', 'Told you you couldn\'t make that', 'Bid small next time 😂'],
    boston: ['BOSTON!! 🏃🏾‍♂️💨', 'All 13! Get up from the table!', 'Run it! Boston!'],
    made: ['Made it! 💅🏾', 'Like I said.', 'Easy money', 'Count \'em and weep'],
  },
  narrate(e, g, seats) {
    const N = (s) => seats[s].name;
    if (e.type === 'bid') return e.pass ? `${N(e.seat)} passes` : `${N(e.seat)} bids ${bidLabel(e.bid)}${e.stuck ? ' (the dealer was stuck)' : ''}`;
    if (e.type === 'won') return `🎯 ${N(e.seat)} wins the bid: ${e.n} ${DIR_NAME[e.dir]}. They need ${6 + e.n} books. Picking up the kitty…`;
    if (e.type === 'trump') return e.trump ? `Trump is ${SUIT_SYM[e.trump]} ${SUIT_NAME[e.trump]}, ${e.dir === 'down' ? '⬇️ Downtown: LOW cards win (aces still on top)' : '⬆️ Uptown: high cards win'}.` : `🚫 No Trump, ${e.dir === 'nt' ? 'the jokers are worthless this hand' : ''}. Points count double!`;
    if (e.type === 'trick') return `📚 ${N(e.winner)} takes the book: ${e.why}.`;
    if (e.type === 'handend') { const r = e.result; return `${N(r.seat)} & ${N((r.seat + 2) % 4)} ${r.made ? `made it with ${r.books} books (+${r.pts})` : `got SET: ${r.books} of ${r.need} (${r.pts})`}`; }
    if (e.type === 'deal') return `New hand. ${N(g.dealer)} dealt.`;
    if (e.type === 'over') return `🏆 ${N(e.winner)} & ${N(e.winner + 2)} win the game!`;
    return null;
  },
  sound(e) { return { bid: 'tick', won: 'whoosh', trump: 'reveal', trick: 'stamp', handend: 'reveal' }[e.type] || null; },
  seatInfo(g, seat) {
    const b = g.bids[seat];
    if (g.phase === 'bid') return b === null ? (g.turn === seat ? '🤔 bidding…' : '') : b === 'pass' ? 'Pass' : `<b>${b.n} ${DIR_ICON[b.dir]}</b>`;
    const dec = g.contract && g.contract.seat === seat ? '🎯 ' : '';
    if (g.phase === 'kitty') return dec + (g.turn === seat ? 'taking the kitty…' : '');
    return `${dec}<b>${g.tricks[seat]}</b> 📚 · ${g.hands[seat].length}🂠`;
  },
  scoreboard(g, me) {
    const t = me % 2;
    const ct = g.contract;
    const extra = (k) => (ct && R.team(ct.seat) === k && g.phase !== 'bid' && g.phase !== 'kitty' ? `<i>${R.teamBooks(g, k)}/${R.needBooks(g)} books</i>` : ct && g.phase === 'play' ? `<i>${R.teamBooks(g, k)} books</i>` : '<i>&nbsp;</i>');
    const one = (k, lbl) => `<div class="sc-t t${k} ${k === t ? 'us' : ''}"><small>${lbl}</small><b>${g.scores[k]}</b>${extra(k)}</div>`;
    const c = ct && ct.n ? `${ct.n}${DIR_ICON[ct.dir]}${ct.trump ? SUIT_SYM[ct.trump] : ''}` : '';
    return `${one(t, 'US')}<div class="sc-to">to ${g.o.target}${c ? `<br><span class="cnt"><b>${c}</b></span>` : ''}</div>${one(1 - t, 'THEM')}`;
  },
  center(g, me, seats) {
    const P = (s) => (s - me + 4) % 4;
    if (g.phase === 'bid') return `<div class="ctr-msg"><b>Bidding</b>${g.high ? `<br>High: ${bidLabel(g.high)} (${esc(seats[g.high.seat].name)})` : '<br>No bids yet'}<br><small>Kitty: 🂠🂠🂠🂠🂠🂠</small></div>`;
    if (g.phase === 'kitty') { const ct = g.contract; return `<div class="ctr-msg">🎯 <b>${esc(seats[ct.seat].name)}</b> won it: <b>${ct.n} ${DIR_NAME[ct.dir]}</b><br>Picking up the kitty and naming trump…</div>`; }
    const cards = g.phase === 'trick' && g.lastTrick ? g.lastTrick.cards : g.trick;
    const win = g.phase === 'trick' && g.lastTrick ? g.lastTrick.winner : -1;
    const ct = g.contract;
    return `<div class="trick">${cards.map((t) => { const k = g.handNo + ':' + t.card, fresh = !seen.has(k); seen.add(k); return `<div class="tc q${P(t.seat)} ${t.seat === win ? 'win' : ''} ${fresh ? 'new' : ''}">${cardHtml(t.card)}</div>`; }).join('')}
      ${!cards.length ? `<div class="ctr-msg sm">${DIR_ICON[ct.dir]} ${DIR_NAME[ct.dir]}${ct.trump ? ` · trump ${SUIT_SYM[ct.trump]}` : ''}</div>` : ''}</div>`;
  },
  hand(g, me, ctx) {
    const h = g.hands[me];
    let pad = '';
    if (ctx.myTurn && g.phase === 'bid') {
      const L = R.legal(g, me), can = new Set(L.filter((m) => m.bid).map((m) => m.bid.n + m.bid.dir));
      const sug = ctx.tip ? (ctx.tip.pass ? null : ctx.tip.bid) : null;
      const bkey = g.handNo + ':' + me;
      if (bwDir.key !== bkey) bwDir = { key: bkey, dir: sug ? sug.dir : (['up', 'down', 'nt'].find((d) => [3, 4, 5, 6, 7].some((n) => can.has(n + d))) || 'up') };
      const d = bwDir.dir;
      pad = `<div class="bidpad bw"><div class="bp-h">${g.high ? `Beat <b>${bidLabel(g.high)}</b> or pass` : 'Your bid: pick a direction, then a number'}</div>
        <div class="bw-dirs">${['up', 'down', 'nt'].map((x) => `<button class="bidb bwd ${x === d ? 'on' : ''} ${sug && sug.dir === x ? 'sug' : ''}" data-dir="${x}">${DIR_ICON[x]} ${DIR_NAME[x]}</button>`).join('')}</div>
        <div class="bw-nums">${[3, 4, 5, 6, 7].map((n) => `<button class="bidb ${sug && sug.n === n && sug.dir === d ? 'sug' : ''}" data-n="${n}" data-d="${d}" ${can.has(n + d) ? '' : 'disabled'}>${n}</button>`).join('')}
        ${L.some((m) => m.pass) ? `<button class="bidb bw-pass ${ctx.tip && ctx.tip.pass ? 'sug' : ''}" data-pass="1">Pass</button>` : ''}</div>
        ${L.some((m) => m.pass) ? '' : '<div class="bp-h">Everybody passed: the dealer is stuck and has to bid!</div>'}</div>`;
    }
    if (ctx.myTurn && g.phase === 'kitty') {
      const key = g.handNo + ':' + me;
      if (ks.key !== key) ks = { key, set: new Set(), trump: null };
      const ct = g.contract;
      return `<div class="bidpad kit"><div class="bp-h">Tap <b>6 cards</b> to throw out (${ks.set.size}/6)${ct.dir !== 'nt' ? ', then pick trump' : ''}</div>
        ${ct.dir !== 'nt' ? `<div class="bw-tr">${R.SUITS.map((su) => `<button class="bidb tr ${ks.trump === su ? 'on' : ''} ${ctx.tip && ctx.tip.trump === su ? 'sug' : ''} ${/[HD]/.test(su) ? 'red' : ''}" data-tr="${su}">${SUIT_SYM[su]}</button>`).join('')}</div>` : ''}
        <div class="bw-kb"><button class="btn sm navy" data-coachpick="1">🧑🏾‍🏫 Use the coach's pick</button><button class="btn sm" data-kdone="1" ${ks.set.size === 6 && (ct.dir === 'nt' || ks.trump) ? '' : 'disabled'}>✅ Done</button></div></div>
        <div class="cards n${h.length} many">${h.map((c) => cardHtml(c, `ok ${ks.set.has(c) ? 'out' : ''} ${ctx.tip && ctx.tip.discard && ctx.tip.discard.includes(c) && !ks.set.size ? 'sug' : ''}`)).join('')}</div>`;
    }
    const play = ctx.myTurn && g.phase === 'play';
    const L = play ? R.legal(g, me) : [];
    return `${pad}<div class="cards n${h.length}">${h.map((c) => cardHtml(c, [play ? (L.includes(c) ? 'ok' : 'no') : '', play && ctx.tip && ctx.tip.card === c ? 'sug' : ''].join(' '))).join('')}</div>`;
  },
  forced(g, me) {
    if (g.phase !== 'play' || g.turn !== me) return null;
    const L = R.legal(g, me);
    return L.length === 1 ? { card: L[0] } : null;
  },
  bind(app, g, me, ctx) {
    app.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => ctx.move({ bid: { n: +b.dataset.n, dir: b.dataset.d } })));
    app.querySelectorAll('[data-dir]').forEach((b) => (b.onclick = () => { bwDir.dir = b.dataset.dir; ctx.select(Math.random()); }));
    const ps = app.querySelector('[data-pass]'); if (ps) ps.onclick = () => ctx.move({ pass: true });
    if (g.phase === 'kitty' && ctx.myTurn) {
      app.querySelectorAll('#hand .cd').forEach((el) => (el.onclick = () => {
        const c = el.dataset.c;
        if (ks.set.has(c)) ks.set.delete(c); else if (ks.set.size < 6) ks.set.add(c);
        ctx.select(Math.random());
      }));
      app.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => { ks.trump = b.dataset.tr; ctx.select(Math.random()); }));
      const cp = app.querySelector('[data-coachpick]');
      if (cp) cp.onclick = () => { const r = R.think(g, me, 'hard'); ks.set = new Set(r.move.discard); ks.trump = r.move.trump; ctx.select(Math.random()); };
      const dn = app.querySelector('[data-kdone]');
      if (dn) dn.onclick = () => ctx.move({ discard: [...ks.set], trump: ks.trump });
      return;
    }
    app.querySelectorAll('#hand .cd').forEach((el) => (el.onclick = () => {
      if (!ctx.myTurn || g.phase !== 'play') return;
      const c = el.dataset.c, why = R.whyIllegal(g, me, c);
      if (why) return ctx.illegal(why);
      ctx.move({ card: c });
    }));
  },
  handSummary(g, me, seats) {
    const r = g.handResult;
    if (!r) return '';
    const us = r.team === me % 2;
    return `<h2>Hand ${g.handNo}: ${r.made ? (us ? '✅ Your team made it!' : '😤 They made it') : (us ? '📉 Your team got set' : '🎉 You set them!')}</h2>
      <p><b>${esc(seats[r.seat].name)}</b> bid <b>${r.n} ${DIR_NAME[r.dir]}</b>${r.trump ? `, trump ${SUIT_SYM[r.trump]}` : ''}: needed <b>${r.need}</b> books, took <b>${r.books}</b> (kitty included).</p>
      <div class="sum-score"><span class="${me % 2 === 0 ? 'us' : ''}">${me % 2 === 0 ? 'US' : 'THEM'} ${r.totals[0]}</span><span class="${me % 2 === 1 ? 'us' : ''}">${me % 2 === 1 ? 'US' : 'THEM'} ${r.totals[1]}</span></div>
      <p class="sum-why">🧑🏾‍🏫 ${r.made ? `${r.books} books − 6 = ${r.books - 6}${r.dir === 'nt' ? ', doubled for No Trump' : ''} → ${r.pts > 0 ? '+' : ''}${r.pts}.` : `Missed by ${r.need - r.books}, so they lose their bid of ${r.n}${r.dir === 'nt' ? ' (doubled for No Trump)' : ''} → ${r.pts}.`}${r.boston ? ' And that was a BOSTON!' : ''}</p>`;
  },
};
