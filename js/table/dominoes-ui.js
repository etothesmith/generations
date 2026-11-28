// Dominoes: board drawing, screens, lessons and table talk.
import * as R from './dominoes.js';
import { esc } from '../util.js';

const { parse, endValue, openEnds, count } = R;

// ---------- drawing (SVG, 1 unit = half a bone) ----------
const PIPS = {
  0: [], 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]],
  4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
  6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]],
};
function halfPips(v, x, y, rot) {
  return PIPS[v].map(([px, py]) => { const [qx, qy] = rot ? [py, px] : [px, py]; return `<circle cx="${(x + qx).toFixed(3)}" cy="${(y + qy).toFixed(3)}" r=".085"/>`; }).join('');
}
/** A bone as SVG. (x,y) top-left; horizontal = 2×1 with a on the left, vertical = 1×2 with a on top. */
export function boneSvg(x, y, a, b, horiz, cls = '') {
  const w = horiz ? 2 : 1, h = horiz ? 1 : 2;
  return `<g class="bone ${cls}"><rect x="${x + .04}" y="${y + .04}" width="${w - .08}" height="${h - .08}" rx=".14"/>
    ${horiz ? `<line x1="${x + 1}" y1="${y + .14}" x2="${x + 1}" y2="${y + .86}"/>` : `<line x1="${x + .14}" y1="${y + 1}" x2="${x + .86}" y2="${y + 1}"/>`}
    <g class="pp">${halfPips(a, x, y, horiz)}${halfPips(b, horiz ? x + 1 : x, horiz ? y : y + 1, horiz)}</g></g>`;
}
/** A bone you hold, as standalone SVG (vertical). */
export function boneIcon(id, cls = '') {
  const [a, b] = parse(id);
  return `<svg class="bone-i ${cls}" data-t="${id}" viewBox="-.05 -.05 1.1 2.1">${boneSvg(0, 0, a, b, false)}</svg>`;
}
export function boneFlat(id) {
  const [a, b] = parse(id);
  return `<svg class="bone-f" viewBox="-.05 -.05 2.1 1.1">${boneSvg(0, 0, a, b, true)}</svg>`;
}

// Lay the line of play out like a real table: arms run out from the center
// and bend so the board stays compact on a phone.
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
const TURN = { L: { after: 5, to: [0, -1] }, R: { after: 5, to: [0, 1] }, U: { after: 3, to: [1, 0] }, D: { after: 3, to: [-1, 0] } };
const portrait = () => typeof window !== 'undefined' && window.innerWidth < window.innerHeight * 0.9;
function layout(board, extra) {
  const out = [];
  const c = board.center;
  if (!c) return { out, anchors: {} };
  const [ca, cb] = parse(c.id);
  const cDbl = ca === cb;
  // center: doubles stand across the line (vertical), others lie along it
  out.push(cDbl ? { x: -.5, y: -1, a: ca, b: cb, h: false, id: c.id, center: true } : { x: -1, y: -.5, a: ca, b: cb, h: true, id: c.id, center: true });
  const anchors = {};
  const start = { L: [cDbl ? -.5 : -1, 0], R: [cDbl ? .5 : 1, 0], U: [0, -1], D: [0, 1] };
  for (const k of ['L', 'R', 'U', 'D']) {
    let [ax, ay] = start[k]; let [dx, dy] = DIRS[k];
    const arm = board.arms[k].slice();
    if (extra && extra.end === k) arm.push(extra.t);
    arm.forEach((t, i) => {
      if (i === (portrait() && (k === 'L' || k === 'R') ? 3 : TURN[k].after)) {
        const prev = arm[i - 1], half = prev.dbl ? 1 : .5;
        const [nx, ny] = TURN[k].to;
        ax = ax - dx * .5 + nx * half; ay = ay - dy * .5 + ny * half; dx = nx; dy = ny;
      }
      const len = t.dbl ? 1 : 2, across = t.dbl ? 2 : 1;
      const cx = ax + dx * len / 2, cy = ay + dy * len / 2;
      const horiz = dx !== 0 ? !t.dbl : t.dbl;
      const w = horiz ? 2 : 1, h = horiz ? 1 : 2;
      // the half touching the line shows "in"; draw so that side faces the anchor
      let a = t.in, b = t.out;
      if (dx < 0 || dy < 0) { a = t.out; b = t.in; }
      if (t.dbl) { a = t.in; b = t.in; }
      out.push({ x: cx - w / 2, y: cy - h / 2, a, b, h: horiz, id: t.id, ghost: t.ghost });
      ax += dx * len; ay += dy * len;
      void across;
    });
    anchors[k] = { x: ax, y: ay, dx, dy };
  }
  return { out, anchors };
}

function boardSvg(g, me, ctx) {
  const b = g.board;
  if (!b.center) return `<div class="ctr-msg">${g.mustLead ? 'The first hand starts with the <b>6|6</b>.' : 'Waiting for the first bone…'}</div>`;
  const { out, anchors } = layout(b);
  const last = g.lastPlay && g.lastPlay.tile;
  let ends = '';
  if (ctx.choices) {
    for (const m of ctx.choices) {
      const A = anchors[m.end];
      const x = A.x + A.dx * .7, y = A.y + A.dy * .7;
      ends += `<g class="endpick" data-end="${m.end}"><circle cx="${x}" cy="${y}" r=".62"/><text x="${x}" y="${y + .2}">${{ L: '◀', R: '▶', U: '▲', D: '▼' }[m.end]}</text></g>`;
    }
  }
  const xs = out.flatMap((t) => [t.x, t.x + (t.h ? 2 : 1)]), ys = out.flatMap((t) => [t.y, t.y + (t.h ? 1 : 2)]);
  const minX = Math.min(...xs, -2) - 1.1, maxX = Math.max(...xs, 2) + 1.1, minY = Math.min(...ys, -2) - 1.1, maxY = Math.max(...ys, 2) + 1.1;
  return `<svg class="dboard" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" preserveAspectRatio="xMidYMid meet">
    ${out.map((t) => boneSvg(t.x, t.y, t.a, t.b, t.h, `${t.id === last ? 'last' : ''} ${t.center && b.center.spinner ? 'spin' : ''}`)).join('')}${ends}</svg>`;
}

// ---------- lessons ----------
const B = (ids) => `<div class="bone-row">${ids.map((i) => boneFlat(i)).join('')}</div>`;
const miniBoard = (center, arms) => {
  const board = { center: { id: center, spinner: parse(center)[0] === parse(center)[1] }, arms: { L: [], R: [], U: [], D: [] }, order: [] };
  for (const [k, ids] of Object.entries(arms || {})) for (const id of ids) {
    const v = endValue({ board }, k), [a, b2] = parse(id);
    board.arms[k].push({ id, in: v, out: a === v ? b2 : a, dbl: a === b2 });
  }
  const g = { board, lastPlay: null };
  return { html: `<div class="tl-board">${boardSvg(g, 0, {})}</div>`, count: count(null, board) };
};

const LESSONS = [
  {
    title: 'The bones',
    say: 'Come sit down. First thing: know your <b>bones</b>.',
    body: `<ul class="tl-list"><li>A double-six set has <b>28 bones</b>. Each has two ends with 0 to 6 dots (pips).</li><li>A bone with the same number on both ends is a <b>double</b> (like 5|5).</li><li>4 players, partners sit <b>across</b>. Everybody draws <b>7 bones</b> and keeps them hidden.</li></ul>${B(['6-6', '5-3', '0-4', '2-2', '1-6'])}`,
    quiz: { q: 'How many pips are on the 5|3?', opts: [{ html: '<b>2</b>', why: '5 + 3 is 8.' }, { html: '<b>8</b>', right: true, why: 'Add both ends: 5 + 3 = 8. Pips matter at the end of the hand.' }, { html: '<b>15</b>', why: 'Just add the two ends: 5 + 3 = 8.' }] },
  },
  {
    title: 'Matching ends',
    say: "You play by <b>matching a number</b> on an open end of the line.",
    body: `<p>The open ends here are a <b>4</b> and a <b>1</b>:</p>${miniBoard('6-4', {}).html.replace('tl-board', 'tl-board sm')}<p>You can play any bone with a 4 or a 1 on it. The matching sides touch, and the other number becomes the new open end.</p>`,
    quiz: { q: 'The open ends are 4 and 1. Which bone can you play?', opts: [{ html: B(['2-5']), why: 'No 4 and no 1 on that one.' }, { html: B(['4-3']), right: true, why: 'The 4 matches the 4 end. Then 3 becomes the new open end.' }, { html: B(['6-6']), why: "No 4 or 1. (The 6 in the middle isn't open: it's already covered.)" }] },
  },
  {
    title: 'The spinner',
    say: "When a hand starts with a double, that double is the <b>spinner</b>. It opens up all four ways.",
    body: `<ul class="tl-list"><li>The first hand always starts with the <b>6|6</b>.</li><li>A double leading the hand is the <b>spinner</b>. Play off its left and right first.</li><li>Once both sides have a bone, you can also play off its <b>top and bottom</b>. Now there are 4 ends!</li><li>A double played anywhere sits <b>crossways</b>.</li></ul>${miniBoard('6-6', { L: ['6-2'], R: ['6-1'], U: ['6-3'] }).html}`,
  },
  {
    title: 'Counting to five',
    say: "Here's where the money is. <b>Add up all the open ends.</b> If it's a multiple of 5, your team scores that many!",
    body: `<ul class="tl-list"><li>After you play, add the open ends: 5, 10, 15, 20, 25… scores that number.</li><li>A <b>double on an end counts both halves</b> (a 5|5 on the end counts 10).</li><li>Slam that bone down and call it: "<b>Gimme fifteen!</b>"</li></ul>${(() => { const m = miniBoard('5-5', {}); return m.html + `<p>Lead the 5|5: the ends are 5 + 5 = <b>${m.count}</b>. That's a multiple of 5, so your team scores <b>10</b> before anybody else even plays!</p><p class="tl-small">While a side of the spinner is still open, that side counts the spinner's number.</p>`; })()}`,
    quiz: { q: 'The ends are 6 and 4. You play 4|5 on the 4. What do the ends add up to now?', opts: [{ html: '<b>10</b>', why: 'The 4 got covered. Now the ends are 6 and 5.' }, { html: '<b>11</b>', right: true, why: 'Ends are 6 and 5 = 11. Not a multiple of 5, so no points this time. Always count before you slam!' }, { html: '<b>15</b>', why: 'Count again: the 4 is covered, so the ends are 6 and 5.' }] },
  },
  {
    title: 'Knocking (passing)',
    say: "Can't play? Then you <b>knock</b>. Everybody's watching when you do…",
    body: `<ul class="tl-list"><li>No bone that matches an end? Knock on the table and you're skipped.</li><li>When someone knocks, they just told everybody they're <b>out of those numbers</b>.</li><li>Good players use that: leave those numbers on the ends to <b>block</b> them again.</li></ul>`,
    quiz: { q: 'Auntie Dee knocked when the ends were 3 and 3. What do you know?', opts: [{ html: '<b>She has no 3s</b>', right: true, why: "Exactly. Keep 3s showing and she's stuck again." }, { html: '<b>She has lots of 3s</b>', why: "If she had any 3, she'd have played it." }, { html: '<b>Nothing</b>', why: 'A knock tells you a lot: she has no 3s.' }] },
  },
  {
    title: 'Domino! (and blocked games)',
    say: 'First one out slams their last bone and hollers "<b>Domino!</b>"',
    body: `<ul class="tl-list"><li>Go out first and your team scores <b>all the pips left in the other team's hands</b>, rounded to the nearest 5.</li><li>If <b>nobody</b> can play, the game is <b>blocked</b>. The team with fewer pips left scores the other team's pips.</li><li>That's why you get rid of <b>heavy bones</b> (like 6|5) early.</li><li>First team to <b>150</b> wins (you can change this in ⚙️ Table settings).</li></ul>`,
    quiz: { q: 'You go out. The other team holds 6|4 and 2|1. What does your team score?', opts: [{ html: '<b>13</b>', why: "Close: it's 13 pips, rounded to the nearest 5." }, { html: '<b>15</b>', right: true, why: '6+4+2+1 = 13, which rounds to 15.' }, { html: '<b>10</b>', why: '13 rounds up to 15, not down to 10.' }] },
  },
  {
    title: 'Play like Grandpa',
    say: 'These are the tricks they don\'t tell you at the cookout…',
    body: `<ul class="tl-list"><li>🧮 <b>Always count the board</b> before you play. Take every 5 you can.</li><li>🛡️ <b>Don't set up the next player.</b> If your play leaves a count they can score off, think twice.</li><li>🏋🏾 <b>Drop your heavy bones early</b> so you don't get caught with them.</li><li>🎨 <b>Keep variety.</b> Holding lots of one number gives you control of that number.</li><li>👂 <b>Listen to the knocks.</b> Block the other team, and don't block your partner.</li></ul><p>Let's play a practice hand. The coach will explain every move.</p>`,
  },
];

const RULES = `<ul class="tl-list">
<li>Double-six set, 4 players, partners sit across. 7 bones each, no boneyard.</li>
<li>First hand: the 6|6 leads. After that, whoever went out (or had the fewest pips in a blocked hand) leads anything.</li>
<li>Match an open end. If the lead is a double it's the <b>spinner</b>: after both sides are played, its top and bottom open too.</li>
<li>After each play, add the open ends. A double on an end counts both halves. Multiples of 5 score that many points.</li>
<li>Can't play? Knock (pass).</li>
<li>Go out = "Domino!": your team scores the other team's leftover pips, rounded to the nearest 5.</li>
<li>Blocked (nobody can play): the team with fewer pips scores the other team's pips (rounded).</li>
<li>First team to the target (150 by default) wins. House rules vary from table to table. This is "fives" (Muggins) scoring.</li></ul>`;

const TALK = {
  score: ['Gimme {n}! 💥', '{n}! Write it down!', "That's {n}, baby!", 'Ka-CHOW! {n} 🔥'],
  domino: ['DOMINO! 🙌🏾 Count \'em up!', 'Domino, sit down! 😂', "I'm out! Domino!"],
  knock: ['*knock knock* 😒', 'Pass… y\'all cold', 'Ugh. Knock.'],
};
const line = (k, n) => TALK[k][Math.floor(Math.random() * TALK[k].length)].replace('{n}', n);

export const DOMINOES = {
  id: 'dominoes',
  title: 'DOMINOES',
  tagline: 'Slam it. Count it. Holler "Domino!"',
  titleArt: 'assets/table/dominoes_title.svg',
  coach: { name: 'Grandpa Earl', img: 'assets/cookout/guest_grandpa.webp' },
  R,
  lessons: LESSONS,
  rulesHtml: RULES,
  options: [
    { key: 'target', label: 'Play to', def: 150, choices: [[100, '100 (quick)'], [150, '150'], [250, '250 (long)']] },
  ],
  practiceOpts: { target: 100 },
  startLine: (g, seats) => `${seats[g.turn].name} has the big 6|6 and leads.`,
  turnHint: (g, me) => {
    const L = R.legal(g, me);
    if (L[0] && L[0].pass) return "You can't match an end, so you have to knock.";
    return 'Match a number on an open end. Count the ends after you play!';
  },
  narrate(e, g, seats) {
    const N = (s) => seats[s].name;
    const [a, b] = e.tile ? parse(e.tile) : [];
    if (e.type === 'play') return e.pts ? `💥 ${N(e.seat)} plays ${a}|${b}: the ends add up to ${e.count}, so +${e.pts} for their team!` : `${N(e.seat)} plays ${a}|${b} (ends add up to ${e.count}, no score)`;
    if (e.type === 'knock') return `✊🏾 ${N(e.seat)} knocks: they can't play.`;
    if (e.type === 'domino') return `🙌🏾 DOMINO! ${N(e.seat)} is out. Their team scores the other team's ${e.result.left} pips → +${e.result.pts}`;
    if (e.type === 'blocked') return e.result.team === null ? '🧱 Blocked! Tie on pips, so nobody scores.' : `🧱 Blocked! ${N(e.result.team)}'s team has fewer pips → +${e.result.pts}`;
    if (e.type === 'deal') return `New hand: ${N(g.turn)} leads.`;
    if (e.type === 'over') return `🏆 ${N(e.winner)} & ${N(e.winner + 2)} win the game!`;
    return null;
  },
  sound(e) { return e.type === 'play' ? (e.pts ? 'stamp' : 'tick') : e.type === 'knock' ? 'tock' : e.type === 'domino' ? 'airhorn' : e.type === 'blocked' ? 'crickets' : null; },
  talk(e) {
    if (e.type === 'play' && e.pts && Math.random() < 0.75) return { seat: e.seat, text: line('score', e.pts) };
    if (e.type === 'domino') return { seat: e.seat, text: line('domino') };
    if (e.type === 'knock' && Math.random() < 0.5) return { seat: e.seat, text: line('knock') };
    return null;
  },
  seatInfo(g, seat) {
    const n = g.hands[seat].length;
    const k = g.knocks[seat].length ? ` · no ${[...g.knocks[seat]].sort().join(',')}` : '';
    return `<b>${n}</b> bone${n === 1 ? '' : 's'}${k}`;
  },
  scoreboard(g, me) {
    const t = me % 2;
    const one = (k, lbl) => `<div class="sc-t t${k} ${k === t ? 'us' : ''}"><small>${lbl}</small><b>${g.scores[k]}</b></div>`;
    return `${one(t, 'US')}<div class="sc-to">to ${g.o.target}<br><span class="cnt">ends: <b>${count(g)}</b></span></div>${one(1 - t, 'THEM')}`;
  },
  center(g, me, seats, ctx) { return boardSvg(g, me, ctx || DOMINOES._ctx || {}); },
  hand(g, me, ctx) {
    const h = g.hands[me], L = ctx.myTurn ? R.legal(g, me) : [];
    const pass = L.length === 1 && L[0].pass;
    const okT = new Set(L.filter((m) => m.tile).map((m) => m.tile));
    const sug = ctx.tip && ctx.tip.tile;
    return `${pass ? '<button class="btn big knock" data-knock="1">✊🏾 Knock (pass)</button>' : ''}
      <div class="bones">${h.map((t) => boneIcon(t, [ctx.myTurn && !pass ? (okT.has(t) ? 'ok' : 'no') : '', ctx.selected === t ? 'sel' : '', sug === t ? 'sug' : ''].join(' '))).join('')}</div>
      ${ctx.selected ? '<div class="tap2">Tap a glowing arrow on the board to choose the end</div>' : ''}`;
  },
  bind(app, g, me, ctx) {
    const L = ctx.myTurn ? R.legal(g, me) : [];
    const kb = app.querySelector('[data-knock]');
    if (kb) kb.onclick = () => ctx.move({ pass: true });
    app.querySelectorAll('#hand .bone-i').forEach((el) => (el.onclick = () => {
      if (!ctx.myTurn) return;
      const t = el.dataset.t, why = R.whyIllegal(g, me, t);
      if (why) return ctx.illegal(why);
      const ms = L.filter((m) => m.tile === t);
      if (ms.length === 1) return ctx.move(ms[0]);
      ctx.select(t);
    }));
    // if a bone is selected and could go on more than one end, show arrows on the board
    const sel = app.querySelector('#hand .bone-i.sel');
    if (sel) {
      const ms = L.filter((m) => m.tile === sel.dataset.t);
      app.querySelector('#center').innerHTML = boardSvg(g, me, { choices: ms });
      app.querySelectorAll('.endpick').forEach((e) => (e.onclick = () => ctx.move(ms.find((m) => m.end === e.dataset.end))));
    }
  },
  handSummary(g, me, seats) {
    const r = g.handResult;
    if (!r) return '';
    const us = me % 2;
    let head = '';
    if (r.kind === 'domino') head = `<h2>${r.team === us ? '🙌🏾 Domino! Your team went out' : `😤 ${esc(seats[r.seat].name)} dominoed`}</h2><p>Leftover pips on the other side: <b>${r.left}</b> → rounds to <b>+${r.pts}</b></p>`;
    else if (r.kind === 'blocked') head = `<h2>🧱 Blocked game</h2><p>Pips left: you ${r.pips[us]}, them ${r.pips[1 - us]}. ${r.team === null ? 'Tie: no points.' : `${r.team === us ? 'You' : 'They'} had fewer → <b>+${r.pts}</b>`}</p>`;
    else head = '<h2>Game point reached!</h2>';
    const hands = [0, 1, 2, 3].map((s) => `<div class="left-h"><small>${s === me ? 'You' : esc(seats[s].name)}</small>${g.hands[s].map((t) => boneFlat(t)).join('') || '—'}</div>`).join('');
    return `${head}<div class="sum-score"><span class="${us === 0 ? 'us' : ''}">${us === 0 ? 'US' : 'THEM'} ${r.totals[0]}</span><span class="${us === 1 ? 'us' : ''}">${us === 1 ? 'US' : 'THEM'} ${r.totals[1]}</span></div><div class="left-hands">${hands}</div>`;
  },
};
