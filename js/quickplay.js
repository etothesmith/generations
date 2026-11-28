// ============================================================
// QUICK PLAY: GENERATIONS for one person, about 8 minutes.
// You vs. three family bots who know their own eras best.
//   Round 1 · The Board: 4 categories × 3 values, pick and answer
//   Round 2 · Lightning: 5 rapid questions, speed bonus
//   Final Wager: bet on one last question
// Everybody answers every question at the same time (no buzzer
// waiting), so there's never dead air.
// ============================================================
import { sfx, unlockAudio, soundOn, setSound } from './audio.js';
import { esc, shuffle } from './util.js';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const LET = ['A', 'B', 'C', 'D'];
const WORLD = { board: ['#FF7A1A', '#D9560A'], q: ['#FF7A1A', '#D9560A'], lightning: ['#FF5A4E', '#D63A2F'], final: ['#3B2A8F', '#241A63'], end: ['#FFB800', '#C98A00'], menu: ['#FFC23C', '#E89A00'] };
const ROSTER = [
  { name: 'Big Mama', img: 'assets/cookout/guest_grandma.webp', era: 'elders', win: ['Baby, I was THERE for that one 😌', 'Mm-hm. Big Mama knows.', 'Write that down!'], lose: ['Lord, these new questions…', "Hush. I knew that.", 'They tricked me!'] },
  { name: 'Uncle Ray', img: 'assets/cookout/guest_grandpa.webp', era: 'elders', win: ['Old school still rules 😎', "Can't teach that!", 'Ray-Ray with the save!'], lose: ['Who wrote this?!', 'I want a recount', 'My glasses was off'] },
  { name: 'Auntie Dee', img: 'assets/cookout/guest_auntie.webp', era: 'genx', win: ['Period. 💅🏾', 'Auntie stays ready', 'Run me my points'], lose: ['Not today, Satan', 'Ok that one was rigged', 'Mmm. Next.'] },
  { name: 'DJ Cuz', img: 'assets/cookout/guest_dj.webp', era: 'millennial', win: ['Run it back! 🎧', "That's a classic, fam", 'Too easy'], lose: ['Skip that track', 'Bruh…', 'I was buffering'] },
  { name: 'Cousin Tasha', img: 'assets/cookout/guest_cousin.webp', era: 'millennial', win: ['Ate that 🍽️', 'Tasha with the receipts', 'Y\'all slow'], lose: ['Ugh! I knew it!', 'Pause. Who knew that?', 'Nope.'] },
  { name: 'Lil Man', img: 'assets/cookout/guest_teen.webp', era: 'genz', win: ['No cap 🧢', "It's giving genius", 'Ez'], lose: ["That's before my time 😭", 'Who is that??', 'Mid question tbh'] },
];
const LEVELS = { chill: { base: 0.42, speed: [4, 11], label: '😌 Chill' }, normal: { base: 0.58, speed: [3, 9], label: '🙂 Normal' }, spicy: { base: 0.74, speed: [2, 7], label: '🌶️ Spicy' } };

let BANK = [];
// remember what you've already seen (across games) so Quick Play keeps feeling new
const SEEN_KEY = 'qp-seen';
const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } })();
function markSeen(id) { seen.add(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-800))); } catch (e) { /* */ } }
// unseen first; once a pool is used up, start it over
const fresh = (pool) => { const f = pool.filter((q) => !seen.has(q.id)); return f.length >= 3 ? f : pool; };
let P = null; // the game
let timer = null, tick = null;
const prefs = (() => { try { return JSON.parse(localStorage.getItem('qp-prefs') || '{}'); } catch (e) { return {}; } })();

function world(k) { const [c, d] = WORLD[k]; document.body.style.setProperty('--world', c); document.body.style.setProperty('--world-d', d); }

async function load() {
  const qs = await fetch('data/questions.json').then((r) => r.json());
  BANK = qs.filter((q) => q.choices && q.choices.length === 4 && /^[ABCD]$/.test(q.answer) && !['majority_rules', 'one_gotta_go'].includes(q.questionType));
  menu();
}

// ---------------- menu ----------------
function menu() {
  clearAll(); world('menu');
  const lv = prefs.level || 'normal';
  app.innerHTML = `<div class="qp-menu">
    <a class="tb-home" href="index.html">← Home</a>
    <h1 class="tb-title">QUICK PLAY</h1>
    <p class="tb-tag">You vs. the family. About 8 minutes. No room code.</p>
    <div class="qp-fam">${ROSTER.slice(0, 6).map((r) => `<img src="${r.img}" alt="${esc(r.name)}">`).join('')}</div>
    <div class="tb-panel">
      <label class="qp-l">Your name <input id="nm" maxlength="14" value="${esc(prefs.name || '')}" placeholder="Your name"></label>
      <div class="qp-l">How tough is the family?</div>
      <div class="qp-lv">${Object.entries(LEVELS).map(([k, v]) => `<button class="chip ${k === lv ? 'on' : ''}" data-lv="${k}">${v.label}</button>`).join('')}</div>
      <div class="qp-how"><b>How it works:</b> everybody answers every question at once. Right answers score; the fastest right answer gets a ⚡ bonus. Three rounds: <b>The Board → Lightning → Final Wager</b>.</div>
      <button class="btn big" id="go">▶️ Let's Play</button>
    </div>
    <div class="qp-more"><a href="solo.html">🎬 Full show solo (TV + phone)</a><a href="learn.html">🎓 Practice by topic</a></div>
  </div>`;
  app.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => { prefs.level = b.dataset.lv; save(); menu(); }));
  $('#go').onclick = () => { unlockAudio(); prefs.name = $('#nm').value.trim() || 'You'; save(); start(); };
}
const save = () => { try { localStorage.setItem('qp-prefs', JSON.stringify(prefs)); } catch (e) { /* */ } };

// ---------------- game setup ----------------
function start() {
  const bots = shuffle(ROSTER.slice()).slice(0, 3);
  P = {
    lv: LEVELS[prefs.level || 'normal'],
    players: [{ name: prefs.name, me: true, score: 0 }, ...bots.map((b) => ({ ...b, score: 0 }))],
    used: new Set(),
    picker: 0,
  };
  // the board: 4 categories that have at least 3 multiple-choice trivia questions
  const byCat = {};
  for (const q of fresh(BANK.filter((x) => x.questionType === 'trivia' && x.round === 1))) (byCat[q.category] = byCat[q.category] || []).push(q);
  const cats = shuffle(Object.keys(byCat).filter((c) => byCat[c].length >= 3)).slice(0, 4);
  P.board = cats.map((c) => {
    const qs = shuffle(byCat[c].slice()).slice(0, 3).sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1) || a.value - b.value);
    qs.forEach((q) => P.used.add(q.id));
    return { cat: c, tiles: qs.map((q, i) => ({ q, value: (i + 1) * 100, done: false })) };
  });
  const light = shuffle(fresh(BANK.filter((q) => !P.used.has(q.id) && (q.round === 2 || q.questionType !== 'trivia')))).slice(0, 5);
  light.forEach((q) => P.used.add(q.id));
  P.lightning = light;
  P.finalQ = shuffle(fresh(BANK.filter((q) => !P.used.has(q.id) && q.questionType === 'trivia' && (q.difficulty || 1) >= 2)))[0] || shuffle(BANK.filter((q) => !P.used.has(q.id)))[0];
  intro('ROUND 1', 'The Board', 'Pick a category and a value. Everybody answers. Get it right (and fastest) and you pick next.', board);
}

function intro(k, title, line, next) {
  clearAll(); world(k === 'ROUND 1' ? 'board' : k === 'ROUND 2' ? 'lightning' : 'final'); sfx('whoosh');
  app.innerHTML = `<div class="qp-intro"><div class="qp-k">${k}</div><h1>${title}</h1><p>${line}</p><button class="btn big" id="nx">Ready →</button></div>`;
  $('#nx').onclick = next;
  timer = setTimeout(next, 6000);
}

// ---------------- top bar ----------------
function chips(state = {}) {
  const lead = Math.max(...P.players.map((p) => p.score));
  return `<div class="qp-chips">${P.players.map((p, i) => `<div class="qp-chip ${p.me ? 'me' : ''} ${state.locked && state.locked[i] ? 'locked' : ''} ${state.res ? (state.res[i] > 0 ? 'ok' : state.res[i] === 0 ? 'bad' : '') : ''} ${P.picker === i && state.board ? 'pick' : ''}">
    ${p.me ? `<span class="ini">${esc(p.name[0] || 'Y')}</span>` : `<img src="${p.img}" alt="">`}
    <b>${esc(p.me ? 'You' : p.name)}</b><span class="sc">${p.score}${p.score === lead && lead > 0 ? ' 👑' : ''}</span>
    ${state.res && state.res[i] > 0 ? `<i class="gain">+${state.res[i]}</i>` : ''}${state.locked && state.locked[i] && !state.res ? '<i class="lk">🔒</i>' : ''}
    ${state.say && state.say[i] ? `<div class="qp-bub">${esc(state.say[i])}</div>` : ''}
  </div>`).join('')}</div>`;
}
function topbar(label) {
  return `<div class="qp-top"><button class="btn navy sm" id="qx">✕</button><div class="qp-round">${label}</div><button class="btn navy sm" id="snd">${soundOn() ? '🔊' : '🔇'}</button></div>`;
}
function bindTop() {
  $('#qx').onclick = () => { if (confirm('Quit this game?')) menu(); };
  $('#snd').onclick = (e) => { setSound(!soundOn()); e.target.textContent = soundOn() ? '🔊' : '🔇'; };
}

// ---------------- round 1: the board ----------------
function board() {
  clearAll(); world('board');
  const left = P.board.reduce((n, c) => n + c.tiles.filter((t) => !t.done).length, 0);
  if (!left) return intro('ROUND 2', 'Lightning ⚡', '5 rapid-fire questions, 10 seconds each. Speed counts double!', () => lightning(0));
  const pk = P.players[P.picker];
  app.innerHTML = `${topbar('Round 1 · The Board')}${chips({ board: true })}
    <div class="qp-say">${pk.me ? '👉 <b>Your pick!</b> Tap any value.' : `<b>${esc(pk.name)}</b> is picking…`}</div>
    <div class="qp-board">${P.board.map((c, ci) => `<div class="qp-col"><div class="qp-cat">${esc(c.cat)}</div>${c.tiles.map((t, ti) => `<button class="qp-tile ${t.done ? 'done' : ''}" data-c="${ci}" data-t="${ti}" ${t.done || !pk.me ? 'disabled' : ''}>${t.done ? '' : t.value}</button>`).join('')}</div>`).join('')}</div>`;
  bindTop();
  app.querySelectorAll('.qp-tile').forEach((b) => (b.onclick = () => pickTile(+b.dataset.c, +b.dataset.t)));
  if (!pk.me) {
    timer = setTimeout(() => {
      const opts = []; P.board.forEach((c, ci) => c.tiles.forEach((t, ti) => { if (!t.done) opts.push([ci, ti]); }));
      const [ci, ti] = opts[Math.floor(Math.random() * opts.length)];
      const el = app.querySelector(`.qp-tile[data-c="${ci}"][data-t="${ti}"]`); if (el) el.classList.add('flash');
      sfx('tick');
      timer = setTimeout(() => pickTile(ci, ti), 700);
    }, 1300);
  }
}
function pickTile(ci, ti) {
  const t = P.board[ci].tiles[ti];
  if (t.done) return;
  t.done = true; sfx('flip');
  ask(t.q, { value: t.value, secs: 15, label: `Round 1 · ${P.board[ci].cat} · ${t.value}`, after: board, pickNext: true });
}

// ---------------- the question ----------------
function botAnswer(p, q, secs) {
  const eraBonus = q.generationEra === p.era ? 0.2 : q.generationEra === 'all' ? 0.05 : -0.05;
  const acc = Math.max(0.12, Math.min(0.95, P.lv.base + eraBonus - ((q.difficulty || 1) - 1) * 0.08));
  const right = Math.random() < acc;
  const ans = right ? LET.indexOf(q.answer) : shuffle([0, 1, 2, 3].filter((k) => k !== LET.indexOf(q.answer)))[0];
  const [a, b] = P.lv.speed;
  const t = Math.min(secs - 0.5, a + Math.random() * (b - a)) * 1000;
  return { ans, t };
}

function ask(q, o) {
  clearAll();
  markSeen(q.id);
  // shuffle the answer positions every time (decade questions stay in order)
  if (q.questionType !== 'name_that_era') {
    const right = q.choices[LET.indexOf(q.answer)], ch = shuffle(q.choices);
    q = { ...q, choices: ch, answer: LET[ch.indexOf(right)] };
  }
  const n = P.players.length, secs = o.secs;
  const ans = new Array(n).fill(null), at = new Array(n).fill(null);
  const t0 = Date.now();
  let done = false;
  const correct = LET.indexOf(q.answer);
  const plans = P.players.map((p) => (p.me ? null : botAnswer(p, q, secs)));
  const render = (res, say) => {
    app.innerHTML = `${topbar(o.label)}${chips({ locked: ans.map((x) => x !== null), res, say })}
      <div class="qp-q"><div class="qp-cat-tag">${esc(q.category)}${o.value ? ` · ${o.value}` : ''}${o.wagerNote || ''}</div>
        <div class="qp-prompt">${esc(q.prompt)}</div>
        ${res ? '' : `<div class="qp-timer"><i style="animation-duration:${secs}s"></i></div>`}
      </div>
      <div class="qp-opts">${q.choices.map((c, k) => `<button class="qp-opt o${k} ${res ? (k === correct ? 'right' : ans[0] === k ? 'wrong' : 'dim') : ans[0] === k ? 'mine' : ''}" data-k="${k}" ${res || ans[0] !== null ? 'disabled' : ''}><span class="L">${LET[k]}</span>${esc(c)}</button>`).join('')}</div>
      ${res && q.culturalContext ? `<div class="qp-ctx">💡 ${esc(q.culturalContext)}</div>` : ''}
      ${res ? '<button class="btn big qp-next" id="nx">Next →</button>' : ''}`;
    bindTop();
    if (!res) app.querySelectorAll('.qp-opt').forEach((b) => (b.onclick = () => {
      if (ans[0] !== null) return; ans[0] = +b.dataset.k; at[0] = Date.now() - t0; sfx('tick');
      // no waiting around: once you've answered, the bots who are still thinking lock in fast
      plans.forEach((pl, i) => { if (pl && ans[i] === null) setTimeout(() => { if (done || ans[i] !== null) return; ans[i] = pl.ans; at[i] = Date.now() - t0; render(); check(); }, 300 + Math.random() * 1300); });
      render(); check();
    }));
  };
  // bots
  plans.forEach((pl, i) => { if (pl) setTimeout(() => { if (done || ans[i] !== null) return; ans[i] = pl.ans; at[i] = pl.t; render(); check(); }, pl.t); });
  const check = () => { if (!done && ans.every((x) => x !== null)) finish(); };
  const finish = () => {
    if (done) return; done = true; clearAll();
    const rights = ans.map((a) => a === correct);
    const fastest = rights.some(Boolean) ? at.map((t, i) => (rights[i] ? t : Infinity)).reduce((m, t, i, arr) => (t < arr[m] ? i : m), 0) : -1;
    const res = P.players.map((p, i) => {
      if (o.wagers) return rights[i] ? o.wagers[i] : -o.wagers[i];
      if (!rights[i]) return 0;
      return o.value + (i === fastest ? (o.speedBonus || 50) : 0);
    });
    res.forEach((r, i) => { P.players[i].score += r; });
    if (o.pickNext && fastest >= 0) P.picker = fastest;
    const say = P.players.map((p, i) => (p.me || Math.random() < 0.45 ? null : (rights[i] ? p.win : p.lose)[Math.floor(Math.random() * 3)]));
    sfx(rights[0] ? 'correct' : ans[0] === null ? 'buzz' : 'wrong');
    if (o.wagers) res.forEach((r, i) => { if (r < 0) res[i] = 0; });
    render(res, say);
    const fastMsg = fastest >= 0 ? (fastest === 0 ? '⚡ You were fastest!' : `⚡ ${P.players[fastest].name} was fastest`) : 'Nobody got it!';
    const tag = document.createElement('div'); tag.className = 'qp-fast'; tag.textContent = o.wagers ? '' : fastMsg; if (!o.wagers) app.querySelector('.qp-q').appendChild(tag);
    const go = () => { clearAll(); o.after(); };
    $('#nx').onclick = go;
    timer = setTimeout(go, q.culturalContext ? 7000 : 4500);
  };
  render();
  timer = setTimeout(() => { for (let i = 0; i < n; i++) if (ans[i] === null) { ans[i] = -1; at[i] = Infinity; } finish(); }, secs * 1000);
}

// ---------------- round 2: lightning ----------------
function lightning(i) {
  world('lightning');
  if (i >= P.lightning.length) return finalIntro();
  ask(P.lightning[i], { value: 100, speedBonus: 100, secs: 10, label: `Round 2 · Lightning ⚡ ${i + 1}/${P.lightning.length}`, after: () => lightning(i + 1) });
}

// ---------------- final wager ----------------
function finalIntro() {
  clearAll(); world('final'); sfx('drumroll');
  const q = P.finalQ, me = P.players[0];
  const max = Math.max(me.score, 500);
  app.innerHTML = `${topbar('Final Wager')}${chips()}
    <div class="qp-intro sm"><div class="qp-k">FINAL WAGER</div><h1>${esc(q.category)}</h1>
    <p>Bet some or all of your points (up to ${max}). Right = win it. Wrong = lose it.</p>
    <div class="qp-wager"><b id="wv">${Math.round(max / 2)}</b><input type="range" id="wr" min="0" max="${max}" step="25" value="${Math.round(max / 2 / 25) * 25}"></div>
    <div class="qp-wq"><button class="chip" data-w="0">Nothing</button><button class="chip" data-w="${Math.round(max / 2 / 25) * 25}">Half</button><button class="chip" data-w="${max}">All in 😤</button></div>
    <button class="btn big" id="lock">🔒 Lock it in</button></div>`;
  bindTop();
  const wr = $('#wr'), wv = $('#wv');
  wr.oninput = () => (wv.textContent = wr.value);
  app.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { wr.value = b.dataset.w; wv.textContent = wr.value; }));
  $('#lock').onclick = () => {
    const wagers = P.players.map((p, i) => {
      if (p.me) return +wr.value;
      const lead = Math.max(...P.players.map((x) => x.score));
      const m = Math.max(p.score, 500);
      return p.score >= lead ? Math.round(m * 0.35 / 25) * 25 : Math.round(m * (0.6 + Math.random() * 0.4) / 25) * 25;
    });
    ask(q, { value: 0, wagers, secs: 20, label: 'Final Wager', wagerNote: ` · you bet ${wagers[0]}`, after: end });
  };
}

// ---------------- the end ----------------
function end() {
  clearAll(); world('end');
  const order = P.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  const won = order[0].me;
  sfx(won ? 'fanfare' : 'applause');
  app.innerHTML = `<div class="qp-end">
    <h1>${won ? '🏆 YOU WON!' : `👑 ${esc(order[0].name)} wins!`}</h1>
    <p class="tb-tag">${won ? "The family's gonna hear about this one." : (order.findIndex((p) => p.me) === 1 ? 'So close! Run it back?' : 'The family got you this time. Run it back?')}</p>
    <div class="qp-pod">${order.map((p, k) => `<div class="qp-pp r${k}"><div class="av">${p.me ? `<span class="ini">${esc(p.name[0] || 'Y')}</span>` : `<img src="${p.img}" alt="">`}</div><b>${esc(p.me ? 'You' : p.name)}</b><span>${p.score}</span><div class="blk">${k + 1}</div></div>`).join('')}</div>
    ${won ? '' : `<p class="qp-quote">${esc(order[0].name)}: "${esc(order[0].win[Math.floor(Math.random() * 3)])}"</p>`}
    <div class="qp-endb"><button class="btn big" id="again">🔁 Play again</button><button class="btn navy" id="menu">Menu</button></div>
  </div>`;
  if (won) confetti();
  $('#again').onclick = start; $('#menu').onclick = menu;
}
function confetti() {
  const c = document.createElement('div'); c.className = 'qp-conf';
  c.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 1.5}s;background:${['#FF3D8B', '#14B8A6', '#7B4DFF', '#19C26B', '#fff'][i % 5]}"></i>`).join('');
  app.appendChild(c);
}
function clearAll() { clearTimeout(timer); clearInterval(tick); }

window.QP = { get P() { return P; } };
load();
