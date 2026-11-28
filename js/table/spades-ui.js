// Spades: screens, lessons and table talk for the shared table shell.
import * as R from './spades.js';
import { esc } from '../util.js';

const { SUIT_SYM, SUIT_NAME, cardName, suitOf } = R;
const red = (c) => c === 'BJ' || /[HD]$/.test(c);

export function cardHtml(c, cls = '', o) {
  if (c === 'BJ' || c === 'LJ') return `<div class="cd jk ${c === 'BJ' ? 'big' : 'lil'} ${cls}" data-c="${c}"><span class="cr">${c === 'BJ' ? 'BIG' : 'LIL'}</span><span class="cs">🃏</span><span class="cj">JOKER</span></div>`;
  const r = R.rankOf(c), s = R.rawSuit(c);
  const trump = o && o.jokers && c === '2D' ? ' tr' : '';
  return `<div class="cd ${red(c) ? 'r' : 'b'}${trump} ${cls}" data-c="${c}"><span class="cr">${r}</span><span class="cs">${SUIT_SYM[s]}</span><span class="cc">${SUIT_SYM[s]}</span></div>`;
}
const row = (cs, o) => `<div class="cd-row">${cs.map((c) => cardHtml(c, '', o)).join('')}</div>`;
const trickDemo = (cards, win, o) => `<div class="trick-demo">${cards.map((c, i) => `<div class="td ${i === win ? 'win' : ''}">${cardHtml(c, '', o)}<small>${['Led', '2nd', '3rd', '4th'][i]}</small></div>`).join('')}</div>`;
const J = { jokers: true };
const seenCards = new Set();

const LESSONS = [
  {
    title: 'The table',
    say: "Pull up a chair! Spades is a <b>team</b> game. Your partner sits across from you.",
    body: `<ul class="tl-list"><li>4 players, 2 teams. Partners sit <b>across</b> from each other.</li><li>Everybody gets <b>13 cards</b>.</li><li>Each round of 4 cards is a <b>book</b> (a "trick"). Whoever plays the best card takes the book.</li><li>Before playing, your team <b>bids</b> how many books it will take. Make your bid and you score; miss it and you get <b>set</b>.</li></ul>`,
    demo: `<div class="seat-demo"><span class="sd top">Partner</span><span class="sd left">Them</span><span class="sd mid">🃏</span><span class="sd right">Them</span><span class="sd bot">You</span></div>`,
  },
  {
    title: 'Which card is bigger?',
    say: 'Aces are high, 2s are low. And <b>spades beat every other suit</b>. That\'s why they call them trump.',
    body: `<p>Inside each suit: <b>A K Q J 10 9 8 7 6 5 4 3 2</b>. The ace is the biggest.</p>${row(['AH', 'KH', 'QH', 'JH', '10H', '2H'])}<p>Any spade, even the little 2♠, beats any heart, diamond or club.</p>${row(['2S', 'AD'])}`,
    quiz: { q: 'Which card is bigger?', opts: [{ html: row(['KD']), why: 'The K♦ is big, but…' }, { html: row(['3S']), right: true, why: 'Any spade beats any other suit. The 3♠ wins.' }] },
  },
  {
    title: 'Follow suit',
    say: "This is the one rule that gets folks in trouble. <b>If you have the suit that was led, you have to play it.</b>",
    body: `<ul class="tl-list"><li>The first card of a book sets the suit. Everyone must play that suit if they can.</li><li>If you're <b>out</b> of that suit you can play anything: <b>cut</b> it with a spade to win, or throw away a low card.</li><li>Not following when you could is a <b>renege</b>: cheating. Don't worry, this app won't let you.</li></ul>`,
    quiz: { q: 'Hearts were led. You hold these. What can you play?', opts: [{ html: `${row(['KH', '4H'])}<small>either heart</small>`, right: true, why: "You have hearts, so you must play a heart, either one." }, { html: `${row(['5S'])}<small>cut with the spade</small>`, why: "Not while you still hold hearts. You can only cut when you're out of the suit led." }, { html: `${row(['9C'])}<small>throw the club</small>`, why: 'You must follow suit while you have hearts.' }] },
    demo: `<p class="tl-small">Your hand:</p>${row(['KH', '4H', '5S', '9C'])}`,
  },
  {
    title: 'Who wins the book?',
    say: 'Highest card of the suit that was led wins. <b>Unless somebody cut it with a spade</b>: then the highest spade wins.',
    body: `<p>Here hearts were led, but somebody was out of hearts and cut with a little spade:</p>${trickDemo(['10H', 'AH', '3S', 'KH'], 2)}<p>The <b>3♠</b> takes it. Even the A♥ loses to a spade.</p>`,
    quiz: { q: 'Clubs were led. Who wins?', opts: [{ html: trickDemo(['8C', 'QC', 'AD', '9C'], -1), why: 'Look again: the A♦ is a different suit, so it can\'t win a club book.' }, { html: '<b>The Q♣</b>', right: true, why: "Nobody cut, so the highest club wins. The A♦ doesn't count: it wasn't the suit led." }, { html: '<b>The A♦</b>', why: "The A♦ is a different suit and not a spade, so it can't win a club book." }] },
  },
  {
    title: 'Breaking spades',
    say: "You can't just lead off with spades. They've got to be <b>broken</b> first.",
    body: `<ul class="tl-list"><li>You <b>can't lead</b> a spade until a spade has been played in some book (someone cut with one). That's "breaking spades."</li><li>The exception: if all you have left is spades, go ahead.</li><li>Leading your big spades later pulls the other team's spades out, so they can't cut your winners.</li></ul>`,
    quiz: { q: "First book of the hand. Spades aren't broken. Which can you lead?", opts: [{ html: row(['AS']), why: "Not yet: spades aren't broken." }, { html: row(['7D']), right: true, why: "Lead a non-spade until spades are broken." }] },
  },
  {
    title: 'Counting your books (bidding)',
    say: "Bidding is where games are won. Count the cards that should <b>win a book on their own</b>.",
    body: `<ul class="tl-list"><li><b>Aces</b> of hearts, clubs and diamonds: usually 1 book each.</li><li><b>Kings</b> with another card of the suit behind them: maybe a book.</li><li><b>Big spades</b> (A♠, K♠ with backup…): books.</li><li><b>Lots of spades</b> (5+): the extras usually win late.</li><li><b>Short in a suit</b> plus spare spades: you can cut, worth about 1.</li><li>Your team's bid = your bid + your partner's bid.</li></ul>`,
    demo: `<p class="tl-small">Example hand:</p>${row(['AS', 'KS', '7S', '4S', 'AH', '9H', '5H', 'KC', '8C', 'QD', '6D', '3D', '2D'])}`,
    quiz: { q: 'About how many books is that hand worth?', opts: [{ html: '<b>1</b>', why: 'Too low: you\'d take bags.' }, { html: '<b>4</b>', right: true, why: 'A♠ and K♠ (with backup) are 2, the A♥ is 1, and the K♣ with a card behind it is maybe 1. Call it 4.' }, { html: '<b>8</b>', why: "Too high: you'd get set. Only count cards that can really win." }] },
  },
  {
    title: 'Scoring: bids, bags & Nil',
    say: "Make your bid, but don't go too far over. Them <b>bags</b> add up.",
    body: `<table class="tl-tbl"><tr><td>Make your bid</td><td><b>10 × bid</b></td></tr><tr><td>Each extra book (a <b>bag</b>)</td><td><b>+1</b></td></tr><tr><td>Get <b>set</b> (miss your bid)</td><td><b>−10 × bid</b></td></tr><tr><td>Every 10 bags</td><td><b>−100</b> 😬</td></tr><tr><td><b>Nil</b> (bid 0) and take none</td><td><b>+100</b></td></tr><tr><td>Bid Nil but take a book</td><td><b>−100</b></td></tr></table><p class="tl-small">First team to the target (300 by default) wins. Take all 13 books and you ran a <b>Boston</b>!</p>`,
    quiz: { q: 'Your team bid 5 and took 7 books. How many points?', opts: [{ html: '<b>50</b>', why: 'Close, but the 2 extra books are bags worth 1 each.' }, { html: '<b>52</b>', right: true, why: '5 × 10 = 50, plus 2 bags = 52. (Those 2 bags also count toward the −100 at 10.)' }, { html: '<b>70</b>', why: 'Extra books are only worth 1 each.' }] },
  },
  {
    title: 'House rules: Jokers & Deuces',
    say: "A lot of families play with the jokers in. Here's how that goes.",
    body: `<p>Take out the <b>2♣ and 2♥</b> and add both jokers. The top of trump becomes:</p>${row(['BJ', 'LJ', '2D', '2S', 'AS', 'KS'], J)}<p><b>Big Joker → Little Joker → 2♦ → 2♠ → A♠ → K♠ …</b> The 2♦ counts as a spade. Turn it on in ⚙️ Table settings.</p>`,
    quiz: { q: 'Jokers are in. Which is the biggest?', opts: [{ html: row(['AS'], J), why: 'The A♠ is only 5th from the top with jokers in.' }, { html: row(['2D'], J), why: 'The 2♦ is big (3rd), but not the biggest.' }, { html: row(['LJ'], J), right: true, why: 'Big Joker > Little Joker > 2♦ > 2♠ > A♠. With no Big Joker here, the Little Joker is the boss.' }] },
  },
  {
    title: 'Play like a pro',
    say: "A few things I tell every new player at the table…",
    body: `<ul class="tl-list"><li>🅰️ <b>Cash your aces early</b>, before somebody runs out of the suit and cuts them.</li><li>🤝 <b>Never beat your partner's winner.</b> If they've got the book, throw your lowest card.</li><li>✂️ Out of a suit? <b>Cut</b> with your <i>lowest</i> spade that still wins.</li><li>🎯 Partner is out of a suit? <b>Lead that suit</b> so they can cut it.</li><li>👀 <b>Count the spades</b>. There are 13 (16 with jokers). Once the big ones are gone, your little ones are bosses.</li><li>🎒 Already made your bid? Duck. Don't eat extra bags.</li></ul><p>Now let's play a practice hand. The coach will explain every move.</p>`,
  },
];

const RULES = `<ul class="tl-list">
<li>4 players, partners sit across. 13 cards each. Deal moves to the left every hand.</li>
<li><b>Bid</b>: starting left of the dealer, everyone says how many books they'll take. 0 = <b>Nil</b>. A team's bid is both partners' bids added together (a Nil bidder's books don't count toward it).</li>
<li><b>Play</b>: the player left of the dealer leads. Follow suit if you can. If you can't, play anything; a spade "cuts" and wins unless a bigger spade is played.</li>
<li>No leading spades until they're <b>broken</b> (unless you only have spades).</li>
<li><b>Scoring</b>: make it = 10 × bid + 1 per bag. Set = −10 × bid. 10 bags = −100. Nil made +100, Nil missed −100 (the Nil bidder's books become bags).</li>
<li>First team to the target wins. A team that falls to −200 loses.</li>
<li><b>Jokers & Deuces</b> (optional): remove 2♣ 2♥, add jokers. Big Joker > Little Joker > 2♦ > 2♠ > A♠ > K♠ …</li></ul>`;

const TALK = {
  cut: ['Cut! ✂️', "Sorry baby, I ain't got none 😏", 'Snip snip!', 'Mine. 😤'],
  set: ['Y\'all got SET! 📉', 'Set! Sit down somewhere 😂', 'Read \'em and weep'],
  nil: ['Going Nil. Pray for me 🙏', 'Nil! Cover me partner'],
  boston: ['BOSTON!! 🏃🏾‍♂️💨', 'Run it! All 13!'],
  bigbid: ['We got this 💪🏾', "Don't play with me"],
};
const pickLine = (k) => TALK[k][Math.floor(Math.random() * TALK[k].length)];

function teamName(t, me) { return t === me % 2 ? 'Your team' : 'Them'; }

export const SPADES = {
  id: 'spades',
  title: 'SPADES',
  tagline: 'Talk trash. Count books. Never renege.',
  titleArt: 'assets/table/spades_title.svg',
  coach: { name: 'Unc', img: 'assets/cookout/guest_grill.webp' },
  R,
  lessons: LESSONS,
  rulesHtml: RULES,
  options: [
    { key: 'target', label: 'Play to', def: 300, choices: [[200, '200 (quick)'], [300, '300'], [500, '500 (long)']] },
    { key: 'jokers', label: 'House rule', def: false, choices: [[false, 'Regular deck'], [true, '🃏 Jokers & Deuces']] },
    { key: 'nil', label: 'Nil bids', def: true, choices: [[true, 'Allowed'], [false, 'No Nil']] },
  ],
  practiceOpts: { target: 200, jokers: false },
  startLine: (g, seats) => `${seats[g.dealer].name} dealt. ${seats[(g.dealer + 1) % 4].name} bids first.`,
  turnHint: (g) => (g.phase === 'bid' ? 'How many books can you take?' : g.trick.length ? `Follow ${SUIT_NAME[suitOf(g.trick[0].card, g.o)]} if you can.` : 'You lead this book.'),

  narrate(e, g, seats) {
    const N = (s) => seats[s].name;
    if (e.type === 'bid') return e.bid === 0 ? `${N(e.seat)} bids NIL (zero books)! 😱` : `${N(e.seat)} bids ${e.bid}`;
    if (e.type === 'playstart') return `Bids are in: ${N(0)} & ${N(2)} need ${R.contract(g, 0)}, ${N(1)} & ${N(3)} need ${R.contract(g, 1)}. ${N((g.dealer + 1) % 4)} leads.`;
    if (e.type === 'broken') return `♠ Spades are broken! ${N(e.seat)} cut with ${cardName(e.card, g.o)}.`;
    if (e.type === 'trick') return `📚 ${N(e.winner)} takes the book: ${e.why}.`;
    if (e.type === 'handend') {
      return e.result.map((r) => `${N(r.team)} & ${N(r.team + 2)}: ${r.contract ? `${r.made ? 'made' : 'SET on'} ${r.contract}` : 'no bid'} (${r.pts >= 0 ? '+' : ''}${r.pts})`).join(' · ');
    }
    if (e.type === 'deal') return `New hand. ${N(g.dealer)} dealt.`;
    if (e.type === 'over') return `🏆 ${N(e.winner)} & ${N(e.winner + 2)} win the game!`;
    return null;
  },
  sound(e) { return { bid: 'tick', broken: 'whoosh', trick: 'stamp', handend: 'reveal' }[e.type] || null; },
  talk(e, g) {
    if (e.type === 'trick' && e.cut && Math.random() < 0.6) return { seat: e.winner, text: pickLine('cut') };
    if (e.type === 'bid' && e.bid === 0) return { seat: e.seat, text: pickLine('nil') };
    if (e.type === 'bid' && e.bid >= 6) return { seat: e.seat, text: pickLine('bigbid') };
    if (e.type === 'handend') {
      const setT = e.result.find((r) => r.contract && r.made === false);
      if (setT) return { seat: 1 - setT.team, text: pickLine('set') };
      const b = e.result.find((r) => r.notes.some((n) => n.k === 'boston'));
      if (b) return { seat: b.team, text: pickLine('boston') };
    }
    return null;
  },
  seatInfo(g, seat) {
    const b = g.bids[seat];
    if (g.phase === 'bid') return b === null ? (g.turn === seat ? '🤔 bidding…' : '') : `Bid <b>${b === 0 ? 'Nil' : b}</b>`;
    return `Bid <b>${b === 0 ? 'Nil' : b}</b> · <b>${g.tricks[seat]}</b> 📚 · ${g.hands[seat].length}🂠`;
  },
  scoreboard(g, me) {
    const t = me % 2;
    const one = (k, lbl) => `<div class="sc-t t${k} ${k === t ? 'us' : ''}"><small>${lbl}</small><b>${g.scores[k]}</b><i>${g.bags[k]} bag${g.bags[k] === 1 ? '' : 's'}${g.phase !== 'bid' ? ` · ${R.teamBooks(g, k)}/${R.contract(g, k)}📚` : ''}</i></div>`;
    return `${one(t, 'US')}<div class="sc-to">to ${g.o.target}${g.o.jokers ? '<br>🃏' : ''}</div>${one(1 - t, 'THEM')}`;
  },
  center(g, me, seats) {
    const P = (s) => (s - me + 4) % 4;
    const cards = g.phase === 'trick' && g.lastTrick ? g.lastTrick.cards : g.trick;
    const win = g.phase === 'trick' && g.lastTrick ? g.lastTrick.winner : -1;
    if (g.phase === 'bid') {
      return `<div class="ctr-msg"><b>Bidding</b><br>${[0, 1, 2, 3].map((k) => { const s = (me + k) % 4; return `${k === 0 ? 'You' : esc(seats[s].name)}: ${g.bids[s] === null ? '…' : g.bids[s] === 0 ? 'Nil' : g.bids[s]}`; }).join('<br>')}</div>`;
    }
    return `<div class="trick">${cards.map((t) => { const k = g.handNo + ':' + t.card, fresh = !seenCards.has(k); seenCards.add(k); return `<div class="tc q${P(t.seat)} ${t.seat === win ? 'win' : ''} ${fresh ? 'new' : ''}">${cardHtml(t.card, '', g.o)}</div>`; }).join('')}
      ${!cards.length ? `<div class="ctr-msg sm">${g.spadesBroken ? '♠ broken' : '♠ not broken yet'}</div>` : ''}</div>`;
  },
  hand(g, me, ctx) {
    const h = g.hands[me], L = ctx.myTurn ? R.legal(g, me) : [];
    let pad = '';
    if (ctx.myTurn && g.phase === 'bid') {
      const sug = ctx.tip ? ctx.tip.bid : null;
      pad = `<div class="bidpad"><div class="bp-h">Your bid: how many books?</div>${L.map((b) => `<button class="bidb ${b === sug ? 'sug' : ''}" data-bid="${b}">${b === 0 ? 'Nil' : b}</button>`).join('')}</div>`;
    }
    const play = ctx.myTurn && g.phase === 'play';
    return `${pad}<div class="cards n${h.length}">${h.map((c) => {
      const cls = [play ? (L.includes(c) ? 'ok' : 'no') : '', ctx.selected === c ? 'sel' : '', play && ctx.tip && ctx.tip.card === c ? 'sug' : ''].join(' ');
      return cardHtml(c, cls, g.o);
    }).join('')}</div>${play && ctx.selected ? '<div class="tap2">Tap it again to play</div>' : ''}`;
  },
  bind(app, g, me, ctx) {
    app.querySelectorAll('[data-bid]').forEach((b) => (b.onclick = () => ctx.move({ bid: +b.dataset.bid })));
    app.querySelectorAll('#hand .cd').forEach((el) => (el.onclick = () => {
      if (!ctx.myTurn || g.phase !== 'play') return;
      const c = el.dataset.c, why = R.whyIllegal(g, me, c);
      if (why) return ctx.illegal(why);
      if (el.classList.contains('sel')) ctx.move({ card: c }); else ctx.select(c);
    }));
  },
  handSummary(g, me, seats) {
    const res = g.handResult;
    if (!res) return '';
    const rows = res.slice().sort((a, b) => (a.team === me % 2 ? -1 : 1)).map((r) => {
      const nn = r.notes.map((n) => n.k === 'nilmade' ? `✅ ${esc(seats[n.seat].name)} made Nil (+100)` : n.k === 'nilfail' ? `❌ ${esc(seats[n.seat].name)} missed Nil (−100)` : n.k === 'boston' ? '🏃🏾‍♂️ BOSTON!' : '').filter(Boolean).join('<br>');
      return `<tr class="${r.team === me % 2 ? 'us' : ''}"><td><b>${teamName(r.team, me)}</b><br><small>${esc(seats[r.team].name)} & ${esc(seats[r.team + 2].name)}</small></td>
        <td>${r.contract ? `bid ${r.contract}<br>took ${r.books}` : '—'}</td>
        <td>${r.contract ? (r.made ? '✅ made it' : '📉 SET') : ''}${r.bags ? `<br>+${r.bags} bag${r.bags === 1 ? '' : 's'}` : ''}${r.bagPenalty ? '<br>🎒 10 bags: −100' : ''}${nn ? '<br>' + nn : ''}</td>
        <td class="pts">${r.pts >= 0 ? '+' : ''}${r.pts}<br><small>= ${r.total}</small></td></tr>`;
    }).join('');
    return `<h2>Hand ${g.handNo} results</h2><table class="sum-tbl">${rows}</table><p class="sum-why">${explainHand(res, me)}</p>`;
  },
};

function explainHand(res, me) {
  const us = res.find((r) => r.team === me % 2);
  if (!us.contract) return '';
  if (us.made === false) return `🧑🏾‍🏫 You needed ${us.contract} and took ${us.books}, so you lose 10 × ${us.contract}. Next time, only count cards that can really win on their own.`;
  if (us.bags >= 3) return `🧑🏾‍🏫 Made it, but ${us.bags} bags. Once you've made your bid, try ducking (play under) so you don't pile up bags.`;
  return '🧑🏾‍🏫 Nice: you made your bid without many bags. That\'s how you win at Spades.';
}
