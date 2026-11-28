// ============================================================
// TABLE GAMES — shared shell for Spades and Dominoes
//  • 🎓 Teach Me: step-by-step lessons with "try it" questions
//  • 🤖 Play the Bots: you + 3 family bots, coach optional
//  • 🌐 Play Online: start a table (room code) or join one; empty seats are bots
// The person who starts the table runs the game (host-authoritative), like
// GENERATIONS: everyone else just sends moves. The coach explains every play.
// ============================================================
import { createTransport } from '../transport.js';
import { sfx, unlockAudio, soundOn, setSound } from '../audio.js';
import { roomCode, uid, esc } from '../util.js';

export const BOTS = [
  { name: 'Big Mama', img: 'assets/cookout/guest_grandma.webp' },
  { name: 'Auntie Dee', img: 'assets/cookout/guest_auntie.webp' },
  { name: 'DJ Cuz', img: 'assets/cookout/guest_dj.webp' },
  { name: 'Cousin Tasha', img: 'assets/cookout/guest_cousin.webp' },
  { name: 'Lil Man', img: 'assets/cookout/guest_teen.webp' },
  { name: 'Lil Sis', img: 'assets/cookout/guest_lilsis.webp' },
];
const LEVELS = [['easy', '🙂 Easy', 'Cousins who just learned'], ['medium', '😏 Medium', 'The aunties'], ['hard', '😤 Hard', "Big Mama's table"]];
const $ = (s, r = document) => r.querySelector(s);
const pos = (seat, me) => (seat - me + 4) % 4; // 0 me (bottom), 1 left, 2 top (partner), 3 right

export function startTable(G) {
  const app = $('#app');
  const qs = new URLSearchParams(location.search);
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('tbl-' + k) || 'null'); localStorage.setItem('tbl-' + k, JSON.stringify(v)); } catch (e) { return null; } return v; };
  const prefs = Object.assign({ name: '', level: 'medium', coach: true, opts: {} }, store(G.id + '-prefs') || {});
  for (const o of G.options) if (prefs.opts[o.key] === undefined) prefs.opts[o.key] = o.def;
  const savePrefs = () => store(G.id + '-prefs', prefs);
  const myPid = store('pid') || store('pid', uid(10));

  // ---------- runtime ----------
  let T = null;          // transport (online only)
  let isHost = false;    // this browser runs the game
  let H = null;          // host-side state (also used offline)
  let V = null;          // the view everybody renders: {phase, seats, g, feed, bubble, code, opts}
  let timer = null, pending = null, selected = null, lastSeen = '', coachMsg = '', handShown = 0;

  // ================= SCREENS =================
  function menu() {
    stop();
    document.body.dataset.screen = 'menu';
    app.innerHTML = `
    <div class="tb-menu">
      <a class="tb-home" href="index.html">← Home</a>
      ${G.titleArt ? `<img class="tb-title-art" src="${G.titleArt}" alt="" onerror="this.remove()">` : ''}
      <h1 class="tb-title">${G.title}</h1>
      <p class="tb-tag">${G.tagline}</p>
      <div class="tb-cards">
        <button class="tb-big learn" data-a="learn"><span class="e">🎓</span><b>Teach Me to Play</b><small>${G.lessons.length} quick lessons, then a practice hand with the coach</small></button>
        <button class="tb-big bots" data-a="bots"><span class="e">🤖</span><b>Play the Bots</b><small>You and a bot partner vs. two family bots</small></button>
        <button class="tb-big online" data-a="online"><span class="e">🌐</span><b>Play Online</b><small>Start a table and send the code. Empty seats get bots.</small></button>
      </div>
      <div class="tb-join">
        <input id="jcode" maxlength="4" placeholder="CODE" autocomplete="off" value="${esc(qs.get('join') || '')}">
        <button class="btn" data-a="join">Join a Table →</button>
      </div>
      <details class="tb-set" ${qs.get('join') ? '' : ''}>
        <summary>⚙️ Table settings</summary>
        <label>Your name <input id="pname" maxlength="14" value="${esc(prefs.name)}" placeholder="Your name"></label>
        <div class="tb-row"><span>Bots</span>${LEVELS.map(([v, l, d]) => `<button class="chip ${prefs.level === v ? 'on' : ''}" data-lv="${v}" title="${d}">${l}</button>`).join('')}</div>
        ${G.options.map((o) => `<div class="tb-row"><span>${o.label}</span>${o.choices.map(([v, l]) => `<button class="chip ${prefs.opts[o.key] === v ? 'on' : ''}" data-opt="${o.key}" data-v="${esc(JSON.stringify(v))}">${l}</button>`).join('')}</div>`).join('')}
        <div class="tb-row"><span>Coach</span><button class="chip ${prefs.coach ? 'on' : ''}" data-coach="1">🧑🏾‍🏫 Explain every move</button><button class="chip ${prefs.coach ? '' : 'on'}" data-coach="0">Hints only when I ask</button></div>
      </details>
      <a class="tb-rules" href="#" data-a="rules">📜 Full rules</a>
    </div>`;
    app.onclick = (e) => {
      const b = e.target.closest('button,a'); if (!b) return;
      unlockAudio();
      const nm = $('#pname'); if (nm) { prefs.name = nm.value.trim(); }
      if (b.dataset.lv) { prefs.level = b.dataset.lv; savePrefs(); return menu(); }
      if (b.dataset.opt) { prefs.opts[b.dataset.opt] = JSON.parse(b.dataset.v); savePrefs(); return menu(); }
      if (b.dataset.coach) { prefs.coach = b.dataset.coach === '1'; savePrefs(); return menu(); }
      const a = b.dataset.a; if (!a) return;
      e.preventDefault(); savePrefs();
      if (a === 'learn') return lessons(0);
      if (a === 'bots') return startLocal();
      if (a === 'online') return needName(hostOnline);
      if (a === 'join') { const c = ($('#jcode').value || '').trim().toUpperCase(); if (c.length !== 4) { $('#jcode').focus(); return; } return needName(() => joinOnline(c)); }
      if (a === 'rules') return rules();
    };
    if (qs.get('join') && !prefs.name) setTimeout(() => { const d = $('.tb-set'); if (d) d.open = true; }, 0);
  }

  function needName(then) {
    if (prefs.name) return then();
    document.body.dataset.screen = 'name';
    app.innerHTML = `<div class="tb-menu"><div class="tb-panel"><h2>What should the table call you?</h2>
      <input id="nm2" maxlength="14" placeholder="Your name" autofocus><button class="btn big" id="nmgo">Let's go</button>
      <button class="btn navy" id="nmback">← Back</button></div></div>`;
    $('#nm2').focus();
    const go = () => { const v = $('#nm2').value.trim(); if (!v) return $('#nm2').focus(); prefs.name = v; savePrefs(); then(); };
    $('#nmgo').onclick = go; $('#nm2').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#nmback').onclick = menu;
  }

  function rules() {
    document.body.dataset.screen = 'rules';
    app.innerHTML = `<div class="tb-menu"><div class="tb-panel tb-rules-panel"><h2>${G.title}: the rules</h2>${G.rulesHtml}
      <button class="btn big" id="rback">Got it</button></div></div>`;
    $('#rback').onclick = menu;
  }

  // ---------- lessons ----------
  function lessons(i) {
    stop();
    document.body.dataset.screen = 'learn';
    const L = G.lessons[i], last = i === G.lessons.length - 1;
    app.innerHTML = `<div class="tb-learn">
      <div class="tl-top"><button class="btn navy sm" id="lx">✕</button><div class="tl-dots">${G.lessons.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div><span class="tl-n">${i + 1}/${G.lessons.length}</span></div>
      <div class="tl-card">
        <div class="tl-coach">${G.coach.img ? `<img src="${G.coach.img}" alt="" onerror="this.outerHTML='<span>🧑🏾‍🏫</span>'">` : '<span>🧑🏾‍🏫</span>'}<div class="tl-say"><b>${esc(G.coach.name)}:</b> ${L.say || ''}</div></div>
        <h2>${L.title}</h2>
        <div class="tl-body">${L.body}</div>
        ${L.demo ? `<div class="tl-demo">${L.demo}</div>` : ''}
        ${L.quiz ? `<div class="tl-quiz"><div class="tq-q">🤔 ${L.quiz.q}</div><div class="tq-opts">${L.quiz.opts.map((o, k) => `<button class="tq-o" data-k="${k}">${o.html}</button>`).join('')}</div><div class="tq-ex" id="tqex"></div></div>` : ''}
      </div>
      <div class="tl-nav">
        <button class="btn navy" id="lb" ${i === 0 ? 'disabled' : ''}>← Back</button>
        ${last ? '<button class="btn big" id="lgo">🃏 Practice hand with the coach</button>' : `<button class="btn big" id="ln" ${L.quiz ? 'disabled' : ''}>Next →</button>`}
      </div></div>`;
    $('#lx').onclick = menu;
    $('#lb').onclick = () => lessons(i - 1);
    if ($('#ln')) $('#ln').onclick = () => lessons(i + 1);
    if ($('#lgo')) $('#lgo').onclick = () => { prefs.coach = true; savePrefs(); startLocal({ level: 'easy', practice: true }); };
    if (L.quiz) app.querySelectorAll('.tq-o').forEach((b) => (b.onclick = () => {
      const o = L.quiz.opts[+b.dataset.k];
      b.classList.add(o.right ? 'right' : 'wrong');
      sfx(o.right ? 'correct' : 'wrong');
      $('#tqex').innerHTML = `<b>${o.right ? '✅ Yes!' : '❌ Not quite.'}</b> ${o.why || L.quiz.why || ''}`;
      if (o.right) { app.querySelectorAll('.tq-o').forEach((x) => (x.disabled = true)); const n = $('#ln') || $('#lgo'); if (n) n.disabled = false; }
    }));
    if (L.after) L.after(app.querySelector('.tl-card'));
  }

  // ================= HOSTING (offline or online) =================
  function freshSeats(humans) {
    const pool = BOTS.slice().sort(() => Math.random() - 0.5);
    return [0, 1, 2, 3].map((i) => humans[i] || { kind: 'bot', name: pool[i].name, img: pool[i].img });
  }
  function startLocal(extra = {}) {
    stop();
    isHost = true; T = null;
    H = { phase: 'game', seats: freshSeats([{ kind: 'human', pid: myPid, name: prefs.name || 'You' }]), level: extra.level || prefs.level, opts: { ...prefs.opts }, practice: !!extra.practice, feed: [], bubble: null };
    if (extra.practice && G.practiceOpts) Object.assign(H.opts, G.practiceOpts);
    H.g = G.R.newGame(H.opts);
    feed(G.startLine ? G.startLine(H.g, H.seats) : 'Shuffle up and deal!');
    publish();
  }
  async function hostOnline() {
    stop();
    app.innerHTML = '<div class="tb-menu"><div class="tb-panel"><h2>Setting the table…</h2></div></div>';
    try {
      T = await createTransport();
      let code; for (let k = 0; k < 8; k++) { code = roomCode(); if (!(await T.roomExists(code))) break; }
      await T.createRoom(code);
      isHost = true;
      H = { phase: 'lobby', code, seats: [{ kind: 'human', pid: myPid, name: prefs.name }, null, null, null], level: prefs.level, opts: { ...prefs.opts }, feed: [], bubble: null, online: true };
      T.onInput(onInput);
      if (T.onPresence) T.onPresence((map) => { H.present = map; });
      publish();
    } catch (e) { console.error(e); app.innerHTML = `<div class="tb-menu"><div class="tb-panel"><h2>Couldn't start an online table</h2><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Back</button></div></div>`; }
  }
  async function joinOnline(code) {
    stop();
    app.innerHTML = `<div class="tb-menu"><div class="tb-panel"><h2>Finding table ${esc(code)}…</h2></div></div>`;
    try {
      T = await createTransport();
      if (!(await T.roomExists(code))) { app.innerHTML = `<div class="tb-menu"><div class="tb-panel"><h2>No table called ${esc(code)}</h2><p>Check the code with whoever started it.</p><button class="btn big" id="bk">Back</button></div></div>`; $('#bk').onclick = menu; return; }
      isHost = false;
      await T.joinRoom(code, myPid);
      T.onState((st) => { if (!st || st.game !== G.id) return; V = { ...st, g: st.g ? JSON.parse(st.g) : null, seats: JSON.parse(st.seats || '[]'), feed: st.feed ? JSON.parse(st.feed) : [] }; draw(); });
      const hello = () => T.sendInput({ t: 'join', pid: myPid, name: prefs.name });
      hello(); setTimeout(hello, 1500);
    } catch (e) { console.error(e); app.innerHTML = `<div class="tb-menu"><div class="tb-panel"><h2>Couldn't join</h2><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Back</button></div></div>`; }
  }

  function seatOf(pid) { return H.seats.findIndex((s) => s && s.kind === 'human' && s.pid === pid); }
  function onInput(m) {
    if (!H || !m) return;
    if (m.t === 'join') {
      let i = seatOf(m.pid);
      if (i < 0 && H.phase === 'lobby') { i = H.seats.findIndex((s) => !s); if (i >= 0) H.seats[i] = { kind: 'human', pid: m.pid, name: String(m.name || 'Player').slice(0, 14) }; sfx('join'); }
      else if (i < 0 && H.phase === 'game') {
        // a bot is keeping a seat warm? hand it over
        const b = H.seats.findIndex((s) => s.kind === 'bot' && s.wasPid === m.pid);
        if (b >= 0) { H.seats[b] = { kind: 'human', pid: m.pid, name: H.seats[b].wasName }; feed(`${H.seats[b].name} is back at the table`); }
      }
      return publish();
    }
    if (m.t === 'move') { const i = seatOf(m.pid); if (i >= 0) humanMove(i, m.move); return; }
    if (m.t === 'next') { if (seatOf(m.pid) >= 0) nextHand(); return; }
    if (m.t === 'leave') { const i = seatOf(m.pid); if (i >= 0) { if (H.phase === 'lobby') H.seats[i] = null; else botTakeover(i); publish(); } }
  }
  function botTakeover(i) {
    const s = H.seats[i]; const b = BOTS[(i + 3) % BOTS.length];
    H.seats[i] = { kind: 'bot', name: b.name, img: b.img, wasPid: s.pid, wasName: s.name };
    feed(`🤖 ${b.name} is holding ${s.name}'s seat`);
  }

  function publish() {
    if (!isHost) return;
    V = { game: G.id, phase: H.phase, code: H.code || null, seats: H.seats, g: H.g || null, feed: H.feed, bubble: H.bubble, level: H.level, opts: H.opts, online: !!H.online, practice: !!H.practice };
    if (T) T.publishState({ game: G.id, phase: H.phase, code: H.code, seats: JSON.stringify(H.seats), g: H.g ? JSON.stringify(H.g) : '', feed: JSON.stringify(H.feed), bubble: H.bubble || '', level: H.level, opts: H.opts, online: true, at: Date.now() });
    draw();
    schedule();
  }
  function feed(line, ev) {
    H.feed.push({ t: line, at: Date.now() });
    if (H.feed.length > 8) H.feed.shift();
  }
  function say(seat, text) { H.bubble = { seat, text, at: Date.now() }; }

  function handle(seat, move) {
    let ev;
    try { ev = G.R.apply(H.g, seat, move); } catch (e) { return false; }
    for (const e of ev) {
      const line = G.narrate(e, H.g, H.seats); if (line) feed(line);
      const s = G.sound && G.sound(e, H.g); if (s) sfx(s);
      const tk = G.talk && G.talk(e, H.g);
      if (tk && H.seats[tk.seat] && H.seats[tk.seat].kind === 'bot') say(tk.seat, tk.text);
    }
    publish();
    return true;
  }
  function humanMove(seat, move) { if (H.g && H.g.turn === seat) handle(seat, move); }
  function nextHand() {
    if (!H.g || H.g.phase !== 'hand') return;
    const ev = G.R.advance(H.g);
    for (const e of ev) { const line = G.narrate(e, H.g, H.seats); if (line) feed(line); if (e.type === 'over') sfx('fanfare'); }
    publish();
  }
  function schedule() {
    clearTimeout(timer);
    if (!isHost || !H || H.phase !== 'game' || !H.g) return;
    const g = H.g;
    if (g.phase === 'trick') { timer = setTimeout(() => { const ev = G.R.advance(g); for (const e of ev) { const l = G.narrate(e, g, H.seats); if (l) feed(l); if (e.type === 'handend') sfx('reveal'); } publish(); }, 1700); return; }
    if (g.phase === 'hand') { if (H.online) timer = setTimeout(nextHand, 25000); return; }
    if (g.phase === 'over') return;
    const seat = g.turn;
    if (seat < 0) return;
    const S = H.seats[seat];
    if (S.kind === 'bot') {
      const lv = H.practice ? 'easy' : H.level;
      timer = setTimeout(() => { const r = G.R.think(g, seat, lv); if (r) handle(seat, r.move); }, 650 + Math.random() * 650);
    }
  }
  function stop() { clearTimeout(timer); }

  // ================= RENDER =================
  function mySeat() { if (!V) return 0; const i = V.seats.findIndex((s) => s && s.kind === 'human' && s.pid === myPid); return i < 0 ? 0 : i; }
  function draw() {
    if (!V) return;
    if (V.phase === 'lobby') return lobby();
    if (!V.g) return;
    game();
  }

  function lobby() {
    document.body.dataset.screen = 'lobby';
    const link = `${location.origin}${location.pathname}?join=${V.code}`;
    const me = mySeat();
    app.innerHTML = `<div class="tb-menu"><div class="tb-panel lobby">
      <div class="tb-k">YOUR TABLE CODE</div>
      <div class="tb-code">${esc(V.code)}</div>
      <p>Friends go to <b>${esc(location.host + location.pathname)}</b>, tap <b>Join a Table</b> and type the code. Or send them the link:</p>
      <div class="tb-link"><input readonly value="${esc(link)}"><button class="btn sm" id="cp">Copy</button></div>
      <div class="tb-seats">${[0, 1, 2, 3].map((i) => {
        const s = V.seats[i];
        const tm = i % 2 === me % 2 ? 'Your team' : 'Other team';
        return `<div class="tb-seat ${s ? 'full' : ''}" data-i="${i}"><span class="ts-team">${i === me ? 'You' : tm}</span><b>${s ? esc(s.name) : 'Open seat'}</b><small>${s ? (s.kind === 'bot' ? '🤖 bot' : '📱 player') : 'a bot sits here if nobody joins'}</small>${isHost && s && i !== 0 ? `<button class="x" data-kick="${i}">✕</button>` : ''}</div>`;
      }).join('')}</div>
      <p class="tb-note">Partners sit across from each other: seats 1 & 3 vs. 2 & 4.${isHost ? ' Tap two seats to swap them.' : ''}</p>
      ${isHost ? '<button class="btn big" id="deal">🃏 Deal! (bots fill empty seats)</button>' : '<p class="tb-wait">Waiting for the host to deal…</p>'}
      <button class="btn navy" id="lv">Leave</button>
    </div></div>`;
    $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link); $('#cp').textContent = 'Copied!'; };
    $('#lv').onclick = () => { if (T && !isHost) T.sendInput({ t: 'leave', pid: myPid }); if (T && isHost && T.closeRoom) T.closeRoom(); location.href = location.pathname; };
    if (isHost) {
      $('#deal').onclick = () => {
        H.seats = freshSeats(H.seats);
        H.phase = 'game'; H.g = G.R.newGame(H.opts); H.feed = [];
        feed(G.startLine ? G.startLine(H.g, H.seats) : 'Shuffle up and deal!'); sfx('fanfare');
        publish();
      };
      let first = null;
      app.querySelectorAll('.tb-seat').forEach((el) => (el.onclick = (e) => {
        if (e.target.dataset.kick) { const k = +e.target.dataset.kick; H.seats[k] = null; first = null; return publish(); }
        const i = +el.dataset.i;
        if (first === null) { first = i; el.classList.add('pick'); return; }
        [H.seats[first], H.seats[i]] = [H.seats[i], H.seats[first]]; first = null; publish();
      }));
    }
  }

  function tryMove(move) {
    if (!V || !V.g) return;
    const me = mySeat();
    if (isHost) humanMove(me, move); else T.sendInput({ t: 'move', pid: myPid, move });
    selected = null; coachMsg = '';
  }

  function game() {
    document.body.dataset.screen = 'game';
    const g = V.g, me = mySeat(), seats = V.seats;
    const myTurn = g.turn === me && !['trick', 'hand', 'over'].includes(g.phase);
    // coach: on your turn, what would a strong player do and why
    let coach = '';
    const key = `${g.handNo}:${g.phase}:${g.turn}:${(g.played || g.board?.order || []).length}:${(g.bids || []).join()}`;
    if (key !== lastSeen) { lastSeen = key; coachMsg = ''; selected = null; if (myTurn) sfx('tick'); }
    const tip = myTurn ? G.R.think(g, me, 'hard') : null;
    if (coachMsg) coach = coachMsg;
    else if (myTurn && tip) coach = prefs.coach ? `<b>Coach says:</b> ${tip.why}` : `It's your turn. ${G.turnHint(g, me)} <button class="btn sm" id="hint">💡 Hint</button>`;
    else if (g.phase === 'trick' || g.phase === 'hand' || g.phase === 'over') coach = '';
    else if (g.turn >= 0) coach = `Waiting on <b>${esc(seats[g.turn].name)}</b>…`;
    const lastFeed = V.feed.length ? V.feed[V.feed.length - 1].t : '';
    const bub = V.bubble && Date.now() - V.bubble.at < 4500 ? V.bubble : null;
    const seatBox = (seat) => {
      const s = seats[seat], p = pos(seat, me);
      const img = s.img ? `<img src="${s.img}" alt="">` : `<span class="ini">${esc((s.name || '?')[0])}</span>`;
      return `<div class="tb-p p${p} ${g.turn === seat ? 'turn' : ''} t${seat % 2}">
        ${bub && bub.seat === seat ? `<div class="tb-bub">${esc(bub.text)}</div>` : ''}
        <div class="av">${img}</div><div class="nm">${esc(p === 0 ? 'You' : s.name)}${p === 2 ? ' <small>partner</small>' : ''}</div>
        <div class="inf">${G.seatInfo(g, seat)}</div></div>`;
    };
    app.innerHTML = `<div class="tb-game">
      <div class="tb-bar">
        <button class="btn navy sm" id="quit">✕</button>
        <div class="tb-score">${G.scoreboard(g, me)}</div>
        <button class="btn navy sm" id="snd">${soundOn() ? '🔊' : '🔇'}</button>
        <button class="btn navy sm" id="coachT" title="Coach">${prefs.coach ? '🧑🏾‍🏫 On' : '🧑🏾‍🏫 Off'}</button>
      </div>
      <div class="tb-table">
        ${[1, 2, 3].map((p) => seatBox((me + p) % 4)).join('')}
        <div class="tb-center" id="center">${G.center(g, me, seats)}</div>
        ${seatBox(me)}
      </div>
      <div class="tb-feed">${lastFeed ? esc(lastFeed) : ''}</div>
      <div class="tb-coach ${myTurn ? 'mine' : ''}">${G.coach.img ? `<img src="${G.coach.img}" alt="" onerror="this.outerHTML='<span class=ce>🧑🏾‍🏫</span>'">` : '<span class="ce">🧑🏾‍🏫</span>'}<div>${coach || '&nbsp;'}</div></div>
      <div class="tb-hand" id="hand">${G.hand(g, me, { myTurn, selected, tip: prefs.coach && tip ? tip.move : null })}</div>
      ${g.phase === 'hand' || g.phase === 'over' ? summary(g, me) : ''}
    </div>`;
    $('#quit').onclick = () => { if (confirm('Leave this game?')) { if (T && !isHost) T.sendInput({ t: 'leave', pid: myPid }); location.href = location.pathname; } };
    $('#snd').onclick = () => { setSound(!soundOn()); game(); };
    $('#coachT').onclick = () => { prefs.coach = !prefs.coach; savePrefs(); game(); };
    if ($('#hint')) $('#hint').onclick = () => { coachMsg = `<b>Coach says:</b> ${tip.why}`; game(); };
    G.bind(app, g, me, {
      myTurn,
      select: (x) => { selected = x; game(); },
      move: (m) => { sfx('flip'); tryMove(m); },
      illegal: (why) => { coachMsg = `🚫 ${why}`; sfx('wrong'); game(); },
    });
    const nx = $('#nexthand');
    if (nx) nx.onclick = () => { if (isHost) nextHand(); else T.sendInput({ t: 'next', pid: myPid }); };
    const again = $('#again');
    if (again) again.onclick = () => { if (isHost && H.online) { H.g = G.R.newGame(H.opts); H.feed = []; feed('New game!'); publish(); } else startLocal({ practice: V.practice, level: V.practice ? 'easy' : undefined }); };
    const home = $('#tohome'); if (home) home.onclick = () => (location.href = location.pathname);
    if (bub) setTimeout(() => { if (V && V.bubble === bub) game(); }, 4600 - (Date.now() - bub.at));
  }

  function summary(g, me) {
    const over = g.phase === 'over' || (g.winner !== null && g.winner !== undefined && g.phase === 'hand');
    const won = over && g.winner === me % 2;
    const sk = g.handNo + ':' + g.phase, fresh = sk !== handShown; handShown = sk;
    return `<div class="tb-sum ${fresh ? 'new' : ''}"><div class="tb-sumcard ${over ? (won ? 'won' : 'lost') : ''}">
      ${over ? `<div class="big">${won ? '🏆 You won!' : '😤 They got you this time'}</div>` : ''}
      ${G.handSummary(g, me, V.seats)}
      ${over ? `<div class="tb-sumbtns"><button class="btn big" id="${g.phase === 'over' ? 'again' : 'nexthand'}">${g.phase === 'over' ? '🔁 Play again' : 'See final score →'}</button><button class="btn navy" id="tohome">Menu</button></div>`
        : `<button class="btn big" id="nexthand">${isHost || !V.online ? 'Deal next hand →' : 'Ready for next hand →'}</button>`}
    </div></div>`;
  }

  if (qs.get('join')) menu(); else menu();
  window.TABLE = { get H() { return H; }, get V() { return V; }, handle: (s, m) => handle(s, m), mySeat };
}
