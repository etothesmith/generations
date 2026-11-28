// ============================================================
// GENERATIONS — Practice Academy: learn every game on your own.
// No host, no room code. Practice content only (data/practice.json),
// so nothing here ever spoils a real game.
// ============================================================
import { esc, money, LETTERS } from './util.js';
import { sfx, unlockAudio } from './audio.js';

const A = 'assets/cookout/';
const BOTS = {
  grandma: { name: 'Grandma Pearl', img: A + 'guest_grandma.webp' },
  uncle: { name: 'Uncle Ray', img: A + 'guest_dj.webp' },
  auntie: { name: 'Auntie Dee', img: A + 'guest_auntie.webp' },
};
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = () => document.getElementById('app');

let P = null;            // practice.json
let prog = store.get('gen-learn', { done: {}, pts: 0, name: '' });
let run = 0;             // bumps when leaving a lesson so stale async flows stop
let pts = 0;             // points in the current lesson

// ---------- tiny UI kit (same look as the real phone) ----------
function top(title) {
  const n = LESSONS.filter((l) => prog.done[l.id]).length;
  return `<div class="lr-top"><button data-act="menu" aria-label="All lessons">☰</button><div class="ttl">${esc(title)}</div><div class="pts">${money(prog.pts)}</div></div>
    <div class="lr-prog"><i style="width:${(n / LESSONS.length * 100).toFixed(0)}%"></i></div>`;
}
const coach = (html, face = '🎙️') => `<div class="coach"><span class="cf">${face}</span><div>${html}</div></div>`;
const timer = (ms) => `<div class="ptimer" data-end="${Date.now() + ms}" data-total="${ms}"><i></i></div>`;
const qbox = (cat, prompt, extra = '') => `<div class="qtext"><span class="cat">${esc(cat)}</span>${prompt}${extra}</div>`;
const opts = (choices, act, o = {}) => `<div class="opts">${choices.map((c, i) => {
  const L = LETTERS[i];
  let cls = o.sel === L ? 'sel' : '';
  if (o.reveal) cls = L === o.answer ? 'right' : L === o.sel ? 'wrong' : '';
  if (o.strike && o.strike.includes(L)) cls += ' struck';
  return `<button class="opt ${cls}" data-act="${act}" data-v="${L}" ${o.disabled || (o.strike && o.strike.includes(L)) ? 'disabled' : ''} ${o.strike && o.strike.includes(L) ? 'style="opacity:.3;text-decoration:line-through"' : ''}><span class="L">${L}</span><span>${esc(c)}</span></button>`;
}).join('')}</div>`;
const bots = (says = {}) => `<div class="bots">${Object.entries(BOTS).map(([k, b]) => `<div class="bot"><img src="${b.img}" alt="">${esc(b.name)}<span class="say">${says[k] ? esc(says[k]) : ''}</span></div>`).join('')}</div>`;
function show(title, html) { app().innerHTML = top(title) + html; window.scrollTo(0, 0); }

// wait for a tap on [data-act] (in `acts`) or a timeout. Resolves {act, v} or {act:'timeout'}.
function wait(acts, ms = 0, onEarly) {
  const my = run;
  return new Promise((res) => {
    let to = null;
    const h = (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.dataset.act === 'menu') return;
      if (onEarly && onEarly(el)) return;
      if (!acts.includes(el.dataset.act)) return;
      done({ act: el.dataset.act, v: el.dataset.v, el });
    };
    const done = (r) => { clearTimeout(to); document.removeEventListener('click', h); clearInterval(chk); res(r); };
    const chk = setInterval(() => { if (my !== run) done({ act: 'abort' }); }, 200);
    document.addEventListener('click', h);
    if (ms) to = setTimeout(() => done({ act: 'timeout' }), ms);
  });
}
const alive = (my) => my === run;
function earn(n, why) { pts += n; prog.pts += n; store.set('gen-learn', prog); if (n > 0) { sfx('correct'); vib(40); } return `<div class="msg" style="color:#7CF29A">+${money(n)} ${esc(why || '')}</div>`; }

setInterval(() => {
  document.querySelectorAll('.ptimer').forEach((el) => {
    const left = Math.max(0, +el.dataset.end - Date.now()), total = +el.dataset.total;
    el.firstElementChild.style.width = (left / total * 100) + '%';
    el.classList.toggle('low', left < 4000);
  });
}, 100);

// ---------- reusable game flows ----------
const Q = (id) => P.questions.find((q) => q.id === id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Buzz-in question. tutorial=true walks through false start, steal and huddle.
async function buzzQuestion(title, q, { tutorial = false, cat } = {}) {
  const my = run;
  const right = q.answer;
  const catL = `${cat || q.category} · ${money(q.value || 200)}`;
  const prompt = q.questionType === 'emoji' ? `<span class="emoji-big">${esc(q.prompt)}</span>Name that movie, show or song!` : q.questionType === 'hashtag' ? `<span style="font-family:var(--display);font-size:28px;color:var(--gold)">${esc(q.prompt.replace(/^Decode this hashtag:\s*/i, ''))}</span>` : esc(q.prompt).replace(/\n/g, '<br>');
  // 0) Ready? card — same as game night
  show(title, `<div class="big-emoji" style="font-family:var(--display);color:var(--gold);font-size:64px">${money(q.value || 200)}</div><div class="msg" style="text-transform:uppercase;font-weight:900">${esc(cat || q.category)}</div>
    <ol style="text-align:left;max-width:300px;margin:8px auto;font-weight:700;line-height:1.5"><li>Read the question</li><li>Wait for <b>BUZZ!</b></li><li>Buzz first, then tap your answer</li></ol>
    <button class="buzzer live" data-act="rdy" style="font-size:32px;background:radial-gradient(circle at 35% 30%,#5bf08f,#1d9b4f 70%)">I'M READY</button>
    ${tutorial ? coach("On game night the podium player taps <b>I'M READY</b> first. Then the question appears.") : ''}`);
  const rr = await wait(['rdy'], 20000);
  if (!alive(my)) return;
  // 1) reading: buzzer locked
  let early = false;
  show(title, `${qbox(catL, prompt)}<div class="sub">Don't buzz early — wait for it!</div><button class="buzzer locked" data-act="buzz">WAIT…</button>
    ${tutorial ? coach("Everybody gets a moment to read. <b>Try tapping the buzzer now</b> and see what happens…") : ''}`);
  const r0 = await wait(['buzz'], tutorial ? 3500 : 2200);
  if (!alive(my)) return;
  if (r0.act === 'buzz') {
    early = true; sfx('wrong'); vib(200);
    show(title, `${qbox(catL, prompt)}<button class="buzzer locked" data-act="x">TOO SOON!</button>${coach('That\'s a <b>false start</b>. Buzz before it says BUZZ! and you\'re locked out for a second. Okay… get ready…')}`);
    await sleep(1600); if (!alive(my)) return;
  }
  // 2) open
  sfx('reveal');
  show(title, `${qbox(catL, prompt)}<div class="sub">Buzzers are open!</div><button class="buzzer live" data-act="buzz">BUZZ!</button>${timer(tutorial ? 7000 : 5000)}
    ${tutorial && !early ? coach('NOW! <b>Tap BUZZ!</b> First buzz gets to answer.') : ''}`);
  const r1 = await wait(['buzz'], tutorial ? 7000 : 5000);
  if (!alive(my)) return;
  let steal = false;
  if (r1.act !== 'buzz') {
    // Uncle Ray buzzes and misses, then it's your steal
    const wrong = LETTERS.slice(0, q.choices.length).filter((L) => L !== right)[0];
    sfx('buzz');
    show(title, `${qbox(catL, prompt)}${bots({ uncle: `"${q.choices[LETTERS.indexOf(wrong)]}!"` })}<div class="msg">Uncle Ray buzzed first…</div>`);
    await sleep(1800); if (!alive(my)) return;
    sfx('wrong');
    show(title, `${qbox(catL, prompt)}<div class="result bad">Uncle Ray missed!</div><button class="buzzer live" data-act="buzz">STEAL!</button>${timer(6000)}
      ${coach('When somebody misses, the other team gets a <b>STEAL</b>. Buzz to steal it!')}`);
    const r2 = await wait(['buzz'], 6000);
    if (!alive(my)) return;
    if (r2.act !== 'buzz') { show(title, `<div class="result bad">Nobody got it</div>${opts(q.choices, 'x', { reveal: true, answer: right, disabled: true })}<div class="sub">${esc(q.culturalContext || '')}</div>`); await sleep(2600); return 0; }
    steal = true;
  }
  // 3) answer
  sfx('buzz'); vib([40, 30, 40]);
  let strike = [];
  let huddle = false;
  const ans = () => show(title, `${qbox(catL, prompt)}${huddle ? `<div class="team-banner" style="background:var(--violet)">HUDDLE! Your team can help for 15 seconds</div>${bots({ auntie: `It's not ${strike.join(' or ')}!` })}` : ''}
      ${opts(q.choices, 'answer', { strike })}${!huddle && tutorial ? '<button class="btn lifeline" data-act="huddle">📞 Family Huddle (2 left)</button>' : ''}${timer(huddle ? 15000 : 10000)}
      ${tutorial && !huddle ? coach(`You ${steal ? 'stole it' : 'got the buzz'}! Tap your answer. Not sure? <b>📞 Family Huddle</b> gives your team 15 seconds to help (2 per game).`) : ''}`);
  ans();
  let r3 = await wait(['answer', 'huddle'], 10000);
  if (!alive(my)) return;
  if (r3.act === 'huddle') {
    huddle = true; sfx('join');
    strike = LETTERS.slice(0, q.choices.length).filter((L) => L !== right).slice(0, 2);
    ans();
    r3 = await wait(['answer'], 15000);
    if (!alive(my)) return;
  }
  const sel = r3.act === 'answer' ? r3.v : null;
  const ok = sel === right;
  if (!ok) sfx('wrong');
  const val = q.value || 200;
  show(title, `<div class="result ${ok ? 'good' : 'bad'}">${ok ? (steal ? 'STOLEN!' : 'YOU GOT IT!') : sel ? 'Not quite!' : "Time's up!"}</div>
    ${opts(q.choices, 'x', { reveal: true, answer: right, sel, disabled: true })}${ok ? earn(val, steal ? 'steal' : '') : ''}<div class="sub">${esc(q.culturalContext || '')}</div>`);
  await sleep(2600);
  return ok ? val : 0;
}

async function lessonEnd(l, extra = '') {
  prog.done[l.id] = true; store.set('gen-learn', prog);
  sfx('fanfare');
  const i = LESSONS.indexOf(l), nx = LESSONS[i + 1];
  show(l.name, `<div class="big-emoji">${l.icon}</div><h2>${esc(l.name)}: learned!</h2>${extra}
    <div class="msg">You earned <b>${money(pts)}</b> practice points.</div>
    ${l.tip ? coach(`<b>Game-night tip:</b> ${l.tip}`, '💡') : ''}
    <div class="lr-foot"><button class="btn navy" data-act="again" data-v="${l.id}">↺ Again</button>${nx ? `<button class="btn big" data-act="lesson" data-v="${nx.id}">Next: ${esc(nx.name)} →</button>` : '<button class="btn big green" data-act="diploma">🎓 Get my diploma</button>'}</div>
    <button class="btn navy" data-act="menu" style="width:100%;margin-top:8px">All lessons</button>`);
}

// ---------- the lessons ----------
const LESSONS = [
  { id: 'trivia', group: 'Round 1 · The Board', icon: '🔔', name: 'Buzz-In Trivia', sub: 'Buzz, answer, steal',
    how: ['The host picks a tile. One player per team is on the podium (it rotates every question).', 'Wait for <b>BUZZ!</b> Buzzing early locks you out for a second.', 'First buzz answers. Miss it and the other team can <b>STEAL</b>.', 'Stuck? <b>📞 Family Huddle</b> gives your team 15 seconds to help.'],
    tip: 'Everybody on the bench can secretly play along on their phone for bonus points.',
    async play(l) { await buzzQuestion(l.name, Q('prac-001'), { tutorial: true }); if (!alive(this.my)) return; await buzzQuestion(l.name, Q('prac-003')); } },
  { id: 'wager', group: 'Round 1 · The Board', icon: '💰', name: 'Family Wager', sub: 'Hidden bonus tiles',
    how: ['Some tiles hide a <b>Family Wager</b>. Only the team that picked it plays.', 'The podium player slides to pick a wager, then answers with no buzzing.', 'Right = win the wager. Wrong = lose it.'],
    tip: "Behind? ALL IN can change the whole game.",
    async play(l) {
      const my = this.my, q = Q('prac-004');
      const max = Math.max(500, prog.pts);
      show(l.name, `<div class="big-emoji">💰</div><h2>Family Wager!</h2><div class="msg">Category: ${esc(q.category)}</div>
        <div class="range-wrap"><div class="sub">Wager $5 – ${money(max)}</div><div class="amt" id="w-amt">${money(Math.round(max / 2 / 5) * 5)}</div>
        <input type="range" id="w-range" min="5" max="${max}" step="5" value="${Math.round(max / 2 / 5) * 5}">
        <div class="quick"><button data-act="wq" data-v="5">Min</button><button data-act="wq" data-v="${Math.round(max / 2 / 5) * 5}">Half</button><button data-act="wq" data-v="${max}">ALL IN</button></div></div>
        <button class="btn big" data-act="lock">Lock In Wager 🔒</button>${coach('Slide or tap Min / Half / ALL IN, then lock it in. These are practice points, so go wild.')}`);
      const rng = document.getElementById('w-range'), amt = document.getElementById('w-amt');
      rng.oninput = () => { amt.textContent = money(+rng.value); };
      let r;
      while ((r = await wait(['wq', 'lock'])).act === 'wq') { rng.value = r.v; amt.textContent = money(+r.v); }
      if (!alive(my) || r.act !== 'lock') return;
      const bet = +rng.value;
      show(l.name, `${qbox(`${q.category} · Wager ${money(bet)}`, esc(q.prompt))}${opts(q.choices, 'answer')}${timer(15000)}`);
      const a = await wait(['answer'], 15000); if (!alive(my)) return;
      const ok = a.v === q.answer;
      if (!ok) { sfx('wrong'); prog.pts = Math.max(0, prog.pts - bet); pts -= bet; store.set('gen-learn', prog); }
      show(l.name, `<div class="result ${ok ? 'good' : 'bad'}">${ok ? 'WAGER WON!' : 'Wager lost…'}</div>${opts(q.choices, 'x', { reveal: true, answer: q.answer, sel: a.v, disabled: true })}${ok ? earn(bet, 'wager') : `<div class="msg">−${money(bet)}</div>`}<div class="sub">${esc(q.culturalContext || '')}</div>`);
      await sleep(2800);
    } },
  { id: 'quick', group: 'Round 2 · The Remix', icon: '⚡', name: 'Mama Said · Emoji · Hashtag · Era', sub: '4 quick buzz games',
    how: ['<b>Mama Said</b>: finish the saying.', '<b>Emoji Decode</b>: name the movie, show or song.', '<b>Hashtag Decode</b>: what does it mean?', '<b>Name That Era</b>: which decade? All four are buzz-in, just like trivia.'],
    tip: 'Elders get bonus "crossover" points for getting a Gen Z question right (and the other way around).',
    async play(l) { for (const id of ['prac-011', 'prac-012', 'prac-010', 'prac-013']) { await buzzQuestion(l.name, Q(id)); if (!alive(this.my)) return; } } },
  { id: 'majority', group: 'Round 2 · The Remix', icon: '🗳️', name: 'Majority Rules', sub: 'Think like the room',
    how: ['Everybody votes on their phone.', 'There is no right answer. Pick what you think <b>most of the room</b> will pick.', 'Match the majority and your team scores.'],
    tip: "Don't vote your favorite — vote the family's favorite.",
    async play(l) {
      const my = this.my, q = Q('prac-009');
      show(l.name, `${qbox('Majority Rules', esc(q.prompt))}<div class="sub">Everybody votes! Match the room to score.</div>${opts(q.choices, 'vote')}${timer(15000)}${bots()}`);
      const r = await wait(['vote'], 15000); if (!alive(my)) return;
      const bv = { grandma: 'A', uncle: 'B', auntie: 'A' };
      const all = [...Object.values(bv), r.v].filter(Boolean);
      const cnt = Object.fromEntries(q.choices.map((c, i) => [LETTERS[i], all.filter((x) => x === LETTERS[i]).length]));
      const max = Math.max(...Object.values(cnt));
      const hit = r.v && cnt[r.v] === max;
      sfx('reveal');
      show(l.name, `<div class="result ${hit ? 'good' : 'bad'}">${hit ? 'YOU MATCHED!' : 'NOT THE MAJORITY'}</div>
        <div class="tally">${q.choices.map((c, i) => { const L = LETTERS[i]; return `<div class="row ${cnt[L] === max ? 'top' : ''}"><span style="width:110px">${esc(c)}</span><span class="bar"><i style="width:${cnt[L] / all.length * 100}%"></i></span>${cnt[L]}</div>`; }).join('')}</div>
        ${bots({ grandma: q.choices[0], uncle: q.choices[1], auntie: q.choices[0] })}${hit ? earn(50, 'match') : ''}`);
      await sleep(3200);
    } },
  { id: 'survey', group: 'Round 2 · The Remix', icon: '📋', name: 'Family Survey', sub: 'Guess what the family said',
    how: ['Before the show, everybody answers survey questions on their phone.', 'Teams guess the most popular answers. Type it on your phone.', 'Three wrong guesses = three strikes, and the other team can steal.'],
    tip: 'Go with the obvious answer first. The top answer is worth the most.',
    async play(l) {
      const my = this.my, sv = P.solo.survey;
      const found = new Set(); let strikes = 0; const tried = [];
      const draw = (msg = '') => show(l.name, `${qbox('Family Survey', esc(sv.prompt))}
        <div class="sv-board">${sv.board.map((b, i) => found.has(i) ? `<div><span>${i + 1}. ${esc(b.label)}</span><span>${b.pts}</span></div>` : `<div class="miss"><span>${i + 1}.</span><span>??</span></div>`).join('')}</div>
        <div class="strikes">${'❌'.repeat(strikes)}</div>${msg}
        <input class="txt-in" id="sv-in" maxlength="40" placeholder="Type a guess…" autocomplete="off"><button class="btn big" data-act="guess">Guess</button>
        ${strikes === 0 && !found.size ? coach('Type an answer you think lots of people gave, like <b>blanket</b>.') : ''}`);
      draw();
      while (strikes < 3 && found.size < sv.board.length) {
        const inp = () => document.getElementById('sv-in');
        inp()?.focus();
        const kh = (e) => { if (e.key === 'Enter') document.querySelector('[data-act=guess]')?.click(); };
        document.addEventListener('keydown', kh);
        const r = await wait(['guess']); document.removeEventListener('keydown', kh);
        if (!alive(my)) return;
        const g = (inp()?.value || '').trim().toLowerCase();
        if (!g) continue;
        tried.push(g);
        const i = sv.board.findIndex((b, k) => !found.has(k) && b.match.some((m) => g.includes(m) || m.includes(g) && g.length > 3));
        if (i >= 0) { found.add(i); sfx('correct'); draw(earn(sv.board[i].pts, sv.board[i].label)); } else { strikes++; sfx('buzz'); vib(200); draw(`<div class="msg">“${esc(g)}” — not on the board!</div>`); }
      }
      sv.board.forEach((_, i) => found.add(i));
      draw(`<div class="msg">${found.size && strikes < 3 ? 'You cleared the board!' : 'Three strikes! Here\'s the whole board.'}</div>`);
      document.querySelector('[data-act=guess]')?.remove(); document.getElementById('sv-in')?.remove();
      await sleep(3200);
    } },
  { id: 'hot', group: 'Party Games', icon: '🔥', name: 'Settle It!', sub: 'Hot takes & debates',
    how: ['A hot take pops up. Vote <b>Agree</b> or <b>Disagree</b>.', 'One person from each side gets 20 seconds to argue.', 'Everybody votes again. The side that <b>changes the most minds</b> wins.'],
    tip: 'Funny beats logical. Make the room laugh and they\'ll switch.',
    async play(l) {
      const my = this.my, take = P.hotTakes[0];
      const box = `<div class="qtext"><span class="cat">🔥 Settle It! · Hot Take</span>“${esc(take)}”</div>`;
      const vote = (k, msg) => `${box}<div class="sub">${msg}</div><div class="pt-row"><button class="opt pt-big pt-agree" data-act="hv" data-v="agree">👍🏾 AGREE</button><button class="opt pt-big pt-disagree" data-act="hv" data-v="disagree">👎🏾 DISAGREE</button></div>${timer(15000)}`;
      show(l.name, vote(1, 'Where do you stand?') + bots());
      const r1 = await wait(['hv'], 15000); if (!alive(my)) return;
      const me = r1.v || 'agree', other = me === 'agree' ? 'disagree' : 'agree';
      show(l.name, `${box}${bots({ grandma: other.toUpperCase(), uncle: other.toUpperCase(), auntie: me.toUpperCase() })}<div class="msg">It's 2 against 2. Somebody has to change a mind. Time to argue!</div>`);
      await sleep(2200); if (!alive(my)) return;
      show(l.name, `<div class="big-emoji">🎤</div><h2>YOUR TURN!</h2><div class="msg">Argue for <b>${me.toUpperCase()}</b>. Convince the room!</div>${box}${timer(20000)}
        ${coach('Say it out loud (nobody\'s listening… probably). On game night everybody hears you. Tap when you\'re done.')}<button class="btn big" data-act="done">I made my case 🎤</button>`);
      await wait(['done'], 20000); if (!alive(my)) return;
      show(l.name, vote(2, 'Did they change your mind? Vote again!') + bots());
      await wait(['hv'], 12000); if (!alive(my)) return;
      sfx('reveal');
      show(l.name, `<div class="result good">You changed a mind!</div>${bots({ grandma: me.toUpperCase() + ' now!', uncle: other.toUpperCase(), auntie: me.toUpperCase() })}<div class="msg">Grandma switched to <b>${me.toUpperCase()}</b>. Your side gained the most votes.</div>${earn(100, 'debate win')}`);
      await sleep(3000);
    } },
  { id: 'likely', group: 'Party Games', icon: '👑', name: 'Who in the Family…?', sub: 'Most likely to…',
    how: ['A "who\'s most likely to…" question pops up.', 'Vote for a player (not yourself!).', 'Pick who the <b>room</b> picks to score. The winner gets crowned on TV.'],
    tip: 'Think about who everybody ELSE would point at.',
    async play(l) {
      const my = this.my, ml = P.mostLikely[0];
      show(l.name, `<div class="qtext"><span class="cat">👑 Who in the Family…</span>…is most likely to ${esc(ml)}</div>
        <div class="opts">${Object.entries(BOTS).map(([k, b]) => `<button class="opt" data-act="ml" data-v="${k}"><img src="${b.img}" alt="" style="height:40px"><span>${esc(b.name)}</span></button>`).join('')}<button class="opt" disabled style="opacity:.4"><span>You (can't vote for yourself)</span></button></div>${timer(15000)}`);
      const r = await wait(['ml'], 15000); if (!alive(my)) return;
      const hit = r.v === 'uncle';
      sfx('reveal');
      show(l.name, `<div class="result ${hit ? 'good' : 'bad'}">${hit ? 'YOU MATCHED THE ROOM!' : 'The room picked Uncle Ray'}</div>${bots({ grandma: 'Uncle Ray', uncle: 'Auntie Dee', auntie: 'Uncle Ray' })}<div class="msg">👑 Uncle Ray is crowned!</div>${hit ? earn(50, 'match') : ''}`);
      await sleep(3000);
    } },
  { id: 'topthat', group: 'Party Games', icon: '😂', name: 'Top That!', sub: 'Funniest answer wins',
    how: ['Finish the sentence on your phone. Funniest wins.', 'Answers show up with <b>no names</b>.', "Everybody votes. You can't vote for your own."],
    tip: 'Short and specific is funnier than long.',
    async play(l) {
      const my = this.my, prompt = P.topThat[0], botAns = P.solo.topThatBots[prompt] || ['Team Cornbread', 'The Plate Snatchers', 'Grandma Knows Best'];
      show(l.name, `<div class="qtext"><span class="cat">😂 Top That!</span>${esc(prompt)}</div><input class="txt-in" id="tt-in" maxlength="80" placeholder="Your funniest answer…"><button class="btn big" data-act="send">Send it</button>${timer(45000)}`);
      document.getElementById('tt-in').focus();
      await wait(['send'], 45000); if (!alive(my)) return;
      const mine = (document.getElementById('tt-in')?.value || '').trim() || 'The Practice Squad';
      const list = [...botAns.map((t, i) => ({ t, who: Object.keys(BOTS)[i] })), { t: mine, who: 'me' }].sort(() => Math.random() - .5);
      show(l.name, `<div class="qtext"><span class="cat">😂 Vote for the funniest</span>${esc(prompt)}</div><div class="ans-list">${list.map((a, i) => a.who === 'me' ? `<button class="opt" disabled style="opacity:.5"><span>“${esc(a.t)}”</span><small>yours</small></button>` : `<button class="opt" data-act="tv" data-v="${i}"><span>“${esc(a.t)}”</span></button>`).join('')}</div>${timer(20000)}`);
      await wait(['tv'], 20000); if (!alive(my)) return;
      sfx('fanfare');
      show(l.name, `<div class="result good">YOURS WON!</div><div class="qtext">“${esc(mine)}”</div>${bots({ grandma: 'Voted yours 😂', uncle: 'Voted yours', auntie: 'Hmph.' })}${earn(100, 'most votes')}`);
      await sleep(3000);
    } },
  { id: 'twotruths', group: 'Party Games', icon: '🎭', name: 'Two Truths & a Lie', sub: 'Spot it, then fool them',
    how: ['One player types two true things and one lie, then marks the lie.', 'Everybody else votes on which one is the lie.', 'Guess right = points. Fool people = points for the teller.'],
    tip: 'The best lies sound boring. The best truths sound wild.',
    async play(l) {
      const my = this.my, s = P.solo.twoTruths[0];
      show(l.name, `<div class="qtext"><span class="cat">🎭 ${esc(BOTS[s.who].name)}'s turn</span>Which one is the LIE?</div>${opts(s.items, 'lie')}${timer(20000)}${bots()}`);
      const r = await wait(['lie'], 20000); if (!alive(my)) return;
      const ok = r.v === LETTERS[s.lie];
      show(l.name, `<div class="result ${ok ? 'good' : 'bad'}">${ok ? 'YOU SPOTTED IT!' : 'Fooled you!'}</div>${opts(s.items, 'x', { reveal: true, answer: LETTERS[s.lie], sel: r.v, disabled: true })}<div class="sub">${esc(s.tell)}</div>${ok ? earn(50, 'spotted') : ''}`);
      await sleep(3200); if (!alive(my)) return;
      show(l.name, `<h2>Now YOU tell 🎭</h2><div class="sub">Type two truths and a lie, then tap the one that's the lie.</div>
        ${[0, 1, 2].map((i) => `<div style="display:flex;gap:6px;align-items:center"><input class="txt-in" id="tw${i}" maxlength="80" placeholder="Statement ${i + 1}"><button class="btn navy" data-act="mark" data-v="${i}" id="mk${i}" style="flex:none;padding:12px">🤥</button></div>`).join('')}
        <button class="btn big" data-act="tsend">Send to the family</button>${coach('Tap 🤥 next to your lie. On game night the TV shows all three and everybody votes.')}`);
      let lie = null, rr;
      while ((rr = await wait(['mark', 'tsend'])).act === 'mark') { lie = +rr.v; [0, 1, 2].forEach((i) => { document.getElementById('mk' + i).style.background = i === lie ? 'var(--crimson)' : ''; }); }
      if (!alive(my)) return;
      if (lie === null) lie = 2;
      const items = [0, 1, 2].map((i) => (document.getElementById('tw' + i)?.value || '').trim() || ['I can cook', 'I can sing', "I've been to the moon"][i]);
      show(l.name, `<div class="qtext"><span class="cat">🎭 Your turn</span>The family is voting…</div>${opts(items, 'x', { disabled: true })}`);
      await sleep(1800); if (!alive(my)) return;
      const guesses = { grandma: (lie + 1) % 3, uncle: lie, auntie: (lie + 2) % 3 };
      sfx('reveal');
      show(l.name, `<div class="result good">You fooled 2 of 3!</div>${opts(items, 'x', { reveal: true, answer: LETTERS[lie], disabled: true })}${bots({ grandma: 'Guessed ' + LETTERS[guesses.grandma], uncle: 'Guessed ' + LETTERS[guesses.uncle] + ' ✓', auntie: 'Guessed ' + LETTERS[guesses.auntie] })}${earn(100, 'fooled 2')}`);
      await sleep(3200);
    } },
  { id: 'sing', group: 'Party Games', icon: '🎤', name: 'Sing It!', sub: 'Songs with the word',
    how: ['A word drops on the TV.', 'Teams take turns singing a song with that word in it before the clock runs out.', 'The host taps ✅ or ❌. <b>No repeats!</b> Last team singing wins.'],
    tip: "Hum the first line to yourself while the other team sings.",
    async play(l) {
      const my = this.my, word = P.singWords[0], botSongs = (P.solo.singBots || {})[word] || ['Happy Birthday'];
      const used = [];
      for (let round = 0; round < 2; round++) {
        show(l.name, `<div class="qtext"><span class="cat">🎤 Sing It! · Your turn</span><span style="font-family:var(--display);font-size:40px;color:var(--gold)">${esc(word)}</span></div>
          <input class="txt-in" id="si-in" maxlength="60" placeholder="Song title (optional)"><button class="btn big" data-act="sang">🎤 I sang it!</button>${timer(15000)}
          ${round === 0 ? coach(`Sing a line with “${esc(word.toLowerCase())}” in it. The host decides if it counts. Song titles help the host keep track of repeats.`) : coach('Your turn again! Remember: <b>no repeats</b>.')}`);
        const r = await wait(['sang'], 15000); if (!alive(my)) return;
        const title = (document.getElementById('si-in')?.value || '').trim().toLowerCase();
        if (r.act !== 'sang' || (title && used.includes(title))) {
          sfx('wrong'); show(l.name, `<div class="result bad">${r.act !== 'sang' ? "Time's up!" : 'REPEAT! That one was sung already.'}</div>${coach('Out of the round. On game night your team sits out until the next word.')}`); await sleep(2800); return;
        }
        if (title) used.push(title);
        sfx('correct'); show(l.name, `<div class="result good">✅ That counts!</div>${earn(100, 'song')}`); await sleep(1500); if (!alive(my)) return;
        const b = round === 0 ? 'grandma' : 'uncle';
        show(l.name, `<div class="msg">${esc(BOTS[b].name)} is singing…</div>${bots({ [b]: `🎶 ${botSongs[round] || '…'}` })}`); await sleep(2200); if (!alive(my)) return;
        if (round === 1) { sfx('wrong'); show(l.name, `<div class="result good">Uncle Ray froze! 🥶</div><div class="msg">You're the last one singing — you WIN the word!</div>${earn(200, 'last one singing')}`); await sleep(3000); }
      }
    } },
  { id: 'hum', group: 'Party Games', icon: '🎶', name: 'Hum That Tune', sub: 'No words allowed',
    how: ['The hummer sees a song on their phone.', 'Hum it. No words!', 'Tap <b>✓ Got it</b> when your team says the title, or <b>↷ Skip</b> to pass.'],
    tip: 'Start with the chorus — it\'s the part everybody knows.',
    async play(l) { await cardRound(l, this.my, P.humSongs, '🎶 Hum it! No words!', 'HUM this one to somebody nearby (or to yourself). When they guess it, tap Got it.'); } },
  { id: 'charades', group: 'Party Games', icon: '🎭', name: 'Culture Charades', sub: 'Act it out',
    how: ['The actor sees a clue on their phone.', 'Act it out with <b>no talking</b>.', 'Tap <b>✓ Got it</b> when your team guesses it, or <b>↷ Skip</b>.'],
    tip: 'Hold up fingers for the number of words first.',
    async play(l) { await cardRound(l, this.my, P.charades, '🎭 Act it out!', 'Act it out for whoever is around. Tap Got it when they say it.'); } },
  { id: 'ogg', group: 'Round 2 · The Remix', icon: '🥧', name: "One's Gotta Go", sub: 'Kick one out, defend it',
    how: ['Podium players pick one of four things to kick out.', 'Each gets 10 seconds to make their case.', 'The room votes on the best defense.'],
    tip: 'Confidence wins. Say it like you mean it.',
    async play(l) {
      const my = this.my, q = Q('prac-014');
      show(l.name, `${qbox("One's Gotta Go", esc(q.prompt))}<div class="msg">Which one's gotta go?</div>${opts(q.choices, 'pick')}${timer(15000)}`);
      const r = await wait(['pick'], 15000); if (!alive(my)) return;
      const mine = q.choices[LETTERS.indexOf(r.v || 'D')];
      show(l.name, `<div class="big-emoji">🎤</div><h2>YOUR TURN!</h2><div class="msg">Tell the room why <b>${esc(mine)}</b> has gotta go!</div>${timer(10000)}<button class="btn big" data-act="done">Done 🎤</button>`);
      await wait(['done'], 10000); if (!alive(my)) return;
      show(l.name, `<div class="msg">Grandma Pearl says <b>${esc(q.choices.find((c) => c !== mine))}</b> gotta go…</div>${bots({ grandma: '"Too much arguing!"' })}`);
      await sleep(2200); if (!alive(my)) return;
      sfx('reveal');
      show(l.name, `<div class="result good">BEST DEFENSE!</div>${bots({ grandma: 'Voted for you', uncle: 'Voted for you', auntie: 'Voted Grandma' })}<div class="msg">The room agreed: <b>${esc(mine)}</b> has gotta go.</div>${earn(200, 'best defense')}`);
      await sleep(3000);
    } },
  { id: 'blitz', group: 'Round 2 · The Remix', icon: '⚡', name: '60-Second Blitz', sub: 'Tap fast!',
    how: ['Podium players answer as many as they can on their phones.', 'Each right answer scores. Wrong ones just cost time.', 'Practice blitz is 30 seconds. The real one is 60.'],
    tip: 'Don\'t overthink — first instinct is usually right.',
    async play(l) {
      const my = this.my, qs = [...P.solo.blitz].sort(() => Math.random() - .5);
      for (const n of [3, 2, 1]) { show(l.name, `<div class="big-emoji" style="font-size:90px">${n}</div><div class="msg">Get ready…</div>`); sfx('tick'); await sleep(700); if (!alive(my)) return; }
      const end = Date.now() + 30000; let right = 0, i = 0;
      while (Date.now() < end && i < qs.length) {
        const q = qs[i++]; const order = Math.random() < .5 ? [0, 1] : [1, 0];
        show(l.name, `<div class="sub">⚡ BLITZ · ${right} right</div><div class="mini-q">${esc(q.q)}</div><div class="blz">${order.map((k) => `<button class="opt" data-act="b" data-v="${k}">${esc(q.c[k])}</button>`).join('')}</div><div class="ptimer" data-end="${end}" data-total="30000"><i></i></div>`);
        const r = await wait(['b'], Math.max(1, end - Date.now())); if (!alive(my)) return;
        if (r.act === 'b') { if (+r.v === q.a) { right++; sfx('vote'); vib(20); } else sfx('tock'); }
      }
      show(l.name, `<div class="result good">${right} RIGHT!</div>${earn(right * 25, `${right} × $25`)}`);
      await sleep(2600);
    } },
  { id: 'final', group: 'Round 3', icon: '🏆', name: 'Final Wager', sub: 'Bet it all',
    how: ['Every team sees the <b>category</b> first, then bets some or all of its points.', 'Then the question shows. Type your answer on your phone.', 'The host reveals each team. Right = win your wager, wrong = lose it.'],
    tip: 'Leading? Bet small enough that you still win if you miss.',
    async play(l) {
      const my = this.my, q = Q('prac-015');
      const max = Math.max(100, prog.pts);
      show(l.name, `<div class="big-emoji">🏆</div><h2>Final Wager</h2><div class="qtext"><span class="cat">Category</span>Game Night</div>
        <div class="range-wrap"><div class="sub">Bet up to ${money(max)}</div><div class="amt" id="w-amt">${money(Math.round(max / 2 / 5) * 5)}</div><input type="range" id="w-range" min="0" max="${max}" step="5" value="${Math.round(max / 2 / 5) * 5}"></div>
        <button class="btn big" data-act="lock">Lock In 🔒</button>`);
      const rng = document.getElementById('w-range'); rng.oninput = () => { document.getElementById('w-amt').textContent = money(+rng.value); };
      await wait(['lock']); if (!alive(my)) return;
      const bet = +rng.value;
      show(l.name, `${qbox('Final Wager · Game Night', esc(q.prompt))}<input class="txt-in" id="fa" maxlength="60" placeholder="Type your answer…"><button class="btn big" data-act="fs">Submit</button>${timer(30000)}`);
      document.getElementById('fa').focus();
      await wait(['fs'], 30000); if (!alive(my)) return;
      const a = (document.getElementById('fa')?.value || '').trim();
      const ok = [q.answer, ...(q.acceptAlso || [])].some((x) => a.toLowerCase().replace(/[^a-z]/g, '').includes(String(x).toLowerCase().replace(/[^a-z]/g, '')));
      sfx('drumroll'); show(l.name, `<div class="big-emoji">🥁</div><div class="msg">You wrote: <b>${esc(a || '(nothing)')}</b></div>`); await sleep(1800); if (!alive(my)) return;
      if (!ok) { sfx('wrong'); prog.pts = Math.max(0, prog.pts - bet); store.set('gen-learn', prog); }
      show(l.name, `<div class="result ${ok ? 'good' : 'bad'}">${ok ? 'CORRECT!' : 'Not quite!'}</div><div class="qtext">${esc(q.answer)}</div>${ok ? earn(bet, 'final wager') : `<div class="msg">−${money(bet)}</div>`}`);
      await sleep(3000);
    } },
];

async function cardRound(l, my, list, label, tipText) {
  const deck = [...list].sort(() => Math.random() - .5);
  const end = Date.now() + 45000; let got = 0, i = 0, first = true;
  while (Date.now() < end && i < deck.length) {
    show(l.name, `<div class="sub">${label} · ${got} got</div><div class="cardclue">${esc(deck[i])}</div>
      <div class="pt-row"><button class="opt pt-big pt-agree" data-act="got">✓ GOT IT</button><button class="opt pt-big" data-act="skip">↷ SKIP</button></div>
      <div class="ptimer" data-end="${end}" data-total="45000"><i></i></div>${first ? coach(tipText) : ''}`);
    first = false;
    const r = await wait(['got', 'skip'], Math.max(1, end - Date.now())); if (!alive(my)) return;
    if (r.act === 'got') { got++; sfx('correct'); vib(30); } else if (r.act === 'skip') sfx('tock');
    i++;
  }
  show(l.name, `<div class="result good">${got} GOT!</div>${earn(got * 50, `${got} × $50`)}`);
  await sleep(2400);
}

// ---------- screens ----------
function menu() {
  run++;
  const n = LESSONS.filter((l) => prog.done[l.id]).length;
  const groups = [...new Set(LESSONS.map((l) => l.group))];
  const nextL = LESSONS.find((l) => !prog.done[l.id]);
  app().innerHTML = `${top('Practice Academy')}
    <div class="lr-hero"><div class="kicker" style="color:var(--teal);font-weight:900;letter-spacing:.2em;font-size:12px">GENERATIONS</div><h1>PRACTICE<br>ACADEMY 🎓</h1>
    <p>Learn every game on your own, at your own pace. These practice questions <b>never</b> show up on game night.</p>
    <p style="font-size:14px;opacity:.75">${n} of ${LESSONS.length} lessons done</p></div>
    ${nextL ? `<button class="btn big" data-act="lesson" data-v="${nextL.id}" style="width:100%">${n ? 'Keep going' : 'Start'}: ${nextL.icon} ${esc(nextL.name)} →</button>` : '<button class="btn big green" data-act="diploma" style="width:100%">🎓 See my diploma</button>'}
    ${groups.map((g) => `<div class="lr-sec">${esc(g)}</div><div class="lr-grid">${LESSONS.filter((l) => l.group === g).map((l) => `<button class="lr-card ${prog.done[l.id] ? 'done' : ''}" data-act="lesson" data-v="${l.id}"><span class="ic">${l.icon}</span><span>${esc(l.name)}<small>${esc(l.sub)}</small></span></button>`).join('')}</div>`).join('')}
    <div class="lr-foot"><a class="btn red" href="play.html">📱 Join a real game</a><a class="btn navy" href="cookout.html">🍗 Cookout game</a></div>
    <div class="lr-foot"><a class="btn navy" href="how-to-play.html">📖 How to Play</a><a class="btn navy" href="index.html">🏠 Home</a></div>
    ${n ? '<button class="btn navy" data-act="reset" style="width:100%;margin-top:10px;opacity:.7">Reset my progress</button>' : ''}`;
}
async function lesson(id) {
  const l = LESSONS.find((x) => x.id === id); if (!l) return menu();
  run++; const my = run; pts = 0;
  show(l.name, `<div class="big-emoji">${l.icon}</div><h2>${esc(l.name)}</h2>
    <div class="how"><h3>HOW IT WORKS</h3><ol>${l.how.map((h) => `<li>${h}</li>`).join('')}</ol></div>
    <button class="btn big" data-act="go">Try it ▶</button>`);
  const r = await wait(['go']); if (my !== run || r.act !== 'go') return;
  unlockAudio();
  await l.play.call({ my }, l);
  if (my !== run) return;
  lessonEnd(l);
}
function diploma() {
  run++;
  const n = LESSONS.filter((l) => prog.done[l.id]).length;
  sfx('fanfare');
  app().innerHTML = `${top('Your Diploma')}
    <div class="diploma"><div style="font-size:44px">🎓</div><div style="font-weight:900;letter-spacing:.2em;font-size:12px">GENERATIONS PRACTICE ACADEMY</div>
    <h2>Certified Ready<br>for Game Night</h2><div class="nm">${esc(prog.name || 'Your Name Here')}</div>
    <div style="font-weight:700">${n} of ${LESSONS.length} games learned · ${money(prog.pts)} practice points</div></div>
    <input class="txt-in" id="nm" maxlength="30" placeholder="Put your name on it" value="${esc(prog.name || '')}">
    <button class="btn navy" data-act="savename" style="width:100%">Save name</button>
    ${n < LESSONS.length ? coach(`Finish the other ${LESSONS.length - n} lesson${LESSONS.length - n === 1 ? '' : 's'} to make it official.`) : coach("You know every game. See you on game night! Screenshot this and drop it in the family chat. 📸", '🏆')}
    <div class="lr-foot"><a class="btn red" href="play.html">📱 Join a real game</a><button class="btn navy" data-act="menu">All lessons</button></div>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'menu') return menu();
  if (a === 'lesson' || a === 'again') return lesson(el.dataset.v);
  if (a === 'diploma') return diploma();
  if (a === 'savename') { prog.name = (document.getElementById('nm').value || '').trim(); store.set('gen-learn', prog); return diploma(); }
  if (a === 'reset') { if (confirm('Start over? This clears your lessons and points.')) { prog = { done: {}, pts: 0, name: prog.name }; store.set('gen-learn', prog); menu(); } }
});

(async () => {
  app().innerHTML = '<div class="msg">Loading practice…</div>';
  P = await fetch('data/practice.json').then((r) => r.json());
  // shuffle answer positions so the right answer isn't always A
  for (const q of P.questions || []) {
    if (['trivia', 'hashtag', 'saying', 'emoji'].includes(q.questionType) && q.choices && 'ABCD'.includes(q.answer) && q.answer) {
      const right = q.choices['ABCD'.indexOf(q.answer)];
      const ch = q.choices.slice().sort(() => Math.random() - 0.5);
      q.choices = ch; q.answer = 'ABCD'[ch.indexOf(right)];
    }
  }
  const want = new URLSearchParams(location.search).get('lesson');
  if (want) lesson(want); else menu();
})();
window.__learn = { LESSONS, get prog() { return prog; } };
