// ============================================================
// GENERATIONS — Phone controller
// ============================================================
import { createTransport } from './transport.js';
import { GENERATIONS, genFromYear, uid, esc, money, $, LETTERS } from './util.js';
import { renderAvatar, AVATAR_OPTIONS, randomAvatar } from './avatar.js';
import { loadArt, ART } from './assets.js';
import { normalize } from './normalize.js';
import { CallManager, VideoWall, chatItemHTML, startVoiceNote, playVoice, canRecord, CHAT_MAX, VOICE_MAX_SEC } from './social.js';

let T, S = null, pid, room;
let profile = { name: '', year: '', gen: '', avatar: randomAvatar() };
let joined = false, editingAvatar = false, step = 1;
let local = {};
let lastFx = null;
// ---- play-from-anywhere: chat, voice notes, video ----
const chat = { list: [], byId: {}, unread: 0, open: false, wired: false };
let call = null, wall = null, rec = null;
const app = () => $('#app');
const cache = new WeakMap();
function setHTML(el, html) { if (cache.get(el) === html) return; cache.set(el, html); el.innerHTML = html; }
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* no-op */ } };

async function boot() {
  document.body.innerHTML = `<div class="stage-bg"><div class="floor"></div></div><div class="vw phone-vw" id="vw"></div><div class="phone" id="app"></div>
    <div id="social" class="hidden">
      <button class="chat-fab" data-act="chatopen" aria-label="Open family chat">💬<span class="badge hidden" id="chatbadge">0</span></button>
      <div class="chat-sheet hidden" id="chatsheet" role="dialog" aria-label="Family chat">
        <div class="cs-head"><b>Family Chat</b><span id="callinfo" class="cs-callinfo"></span><button class="cs-x" data-act="chatclose" aria-label="Close chat">✕</button></div>
        <div class="cs-call" id="callbar"></div>
        <div class="cs-list" id="chatlist"></div>
        <div class="cs-input">
          <input id="chat-in" maxlength="${CHAT_MAX}" autocomplete="off" placeholder="Say something to the family…" aria-label="Message">
          <button class="cs-send" data-act="chatsend" aria-label="Send">➤</button>
          <button class="cs-mic" data-act="rec" id="micbtn" aria-label="Record a voice note">🎤</button>
        </div>
      </div>
    </div>`;
  room = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  T = await createTransport();
  try { await loadArt({ only: ['sprites', 'logo', 'family'] }); } catch (e) { /* art is optional */ }
  // on a real phone, remember the player's name/avatar (demo tabs share storage, so skip it there)
  const saved = T.mode === 'firebase' ? JSON.parse(localStorage.getItem('gen-profile') || 'null') : JSON.parse(sessionStorage.getItem('gen-profile') || 'null');
  if (saved) profile = saved;
  pid = sessionStorage.getItem('gen-pid');
  if (!pid && T.mode === 'firebase') {
    const last = JSON.parse(localStorage.getItem('gen-last') || 'null');
    if (last && last.room === room && Date.now() - last.at < 12 * 3600e3) pid = last.pid;
  }
  if (!pid) pid = uid(12);
  sessionStorage.setItem('gen-pid', pid);
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  // auto-rejoin after a refresh/sleep
  if (room && sessionStorage.getItem('gen-joined') === room && profile.name) { await connect(room); sendJoin(); }
  draw();
  requestAnimationFrame(frame);
}

function where() { return profile.remote ? '🏠 away' : ''; }
function wireSocial() {
  if (chat.wired) return;
  chat.wired = true;
  $('#social').classList.remove('hidden');
  wall = new VideoWall($('#vw'));
  call = new CallManager(T, { pid, name: profile.name || 'Player', where: where() }, { onChange: () => { wall.update(call.tiles()); document.body.classList.toggle('in-call', call.inCall && call.tiles().length > 0); drawCallBar(); } });
  T.onChat((m, old) => {
    if (!m || chat.byId[m.id]) return;
    chat.byId[m.id] = m; chat.list.push(m);
    if (chat.list.length > 80) { const x = chat.list.shift(); delete chat.byId[x.id]; }
    if (!old && m.pid !== pid) {
      if (!chat.open) { chat.unread++; vib(30); toast(m.kind === 'voice' ? `🎤 ${m.name} sent a voice note` : `💬 ${m.name}: ${String(m.text || '').slice(0, 40)}`); }
    }
    drawChat();
  });
  drawCallBar();
}
function drawChat() {
  const el = $('#chatlist'); if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  el.innerHTML = chat.list.length ? chat.list.map((m) => chatItemHTML(m, pid)).join('') : '<div class="cs-empty">No messages yet. Say hi to the family! 👋🏾</div>';
  if (atBottom || chat.open) el.scrollTop = el.scrollHeight;
  const b = $('#chatbadge'); if (b) { b.textContent = chat.unread; b.classList.toggle('hidden', !chat.unread); }
}
function drawCallBar() {
  const el = $('#callbar'); if (!el || !call) return;
  const n = call.count();
  if (!call.inCall) {
    el.innerHTML = `<button class="btn green" data-act="calljoin" data-v="video">📹 Join video call${n ? ` (${n} in)` : ''}</button><button class="btn navy" data-act="calljoin" data-v="audio">🎧 Voice only</button>`;
  } else {
    el.innerHTML = `<button class="btn ${call.muted ? 'red' : 'navy'}" data-act="callmute">${call.muted ? '🔇 Unmute' : '🎙️ Mute'}</button>${call.local && call.local.getVideoTracks().length ? `<button class="btn ${call.camOff ? 'red' : 'navy'}" data-act="callcam">${call.camOff ? '📷 Camera on' : '📷 Camera off'}</button>` : ''}<button class="btn red" data-act="callleave">Leave call</button>`;
  }
  const ci = $('#callinfo'); if (ci) ci.textContent = n ? `📹 ${n} on video` : '';
}
async function sendVoice(res) {
  if (!res || !res.dataUrl) return;
  if (res.dataUrl.length > 380000) return toast('That voice note was too long — keep it under 30 seconds');
  if (res.dur < 0.8) return toast('Hold on — that was too short');
  try { await T.sendChat({ pid, name: profile.name, where: where(), color: myTeam()?.color || '', kind: 'voice', audio: res.dataUrl, dur: Math.round(res.dur * 10) / 10 }); toast('🎤 Voice note sent!'); }
  catch (e) { toast('Could not send that voice note'); }
}

async function connect(code) {
  room = code;
  await T.joinRoom(code, pid);
  wireSocial();
  T.onState((s) => { S = normalize(s); onState(); });
}

function sendJoin() {
  joined = true;
  sessionStorage.setItem('gen-joined', room);
  localStorage.setItem('gen-last', JSON.stringify({ room, pid, at: Date.now() }));
  saveProfile();
  T.sendInput({ type: 'join', pid, audience: !!profile.audience, remote: !!profile.remote, name: profile.name, year: profile.year ? +profile.year : null, gen: profile.gen || genFromYear(profile.year), avatar: profile.avatar });
}
function saveProfile() {
  sessionStorage.setItem('gen-profile', JSON.stringify(profile));
  if (T.mode === 'firebase') localStorage.setItem('gen-profile', JSON.stringify(profile));
}
function send(msg) { T.sendInput({ ...msg, pid }); }

function onState() {
  if (S.fx && S.fx.id !== lastFx) {
    lastFx = S.fx.id;
    const my = myTeam();
    if (S.fx.type === 'correct' && my && (S.fx.data.team === my.id || S.fx.data.pid === pid)) vib([60, 40, 60, 40, 120]);
    if (S.fx.type === 'wrong' && S.fx.data.pid === pid) vib(300);
    if (S.fx.type === 'falsestart' && S.fx.data.pid === pid) vib([200, 80, 200]);
    if (S.fx.type === 'champion') vib([100, 60, 100, 60, 300]);
    if (S.fx.type === 'crossover' && S.fx.data.pid === pid) { vib([80, 50, 80, 50, 200]); toast(`🌉 Generation Crossover! +${money(S.fx.data.bonus)}`); }
  }
  const key = S.q ? S.q.id + ':' + S.q.flipId : S.phase + ':' + S.round;
  if (local.key !== key) local = { key };
  if (S.q && S.q.stage === 'open' && local.openEnd !== S.q.timerEnd) { local.openEnd = S.q.timerEnd; local.buzzed = false; }
  if (S.q && S.q.type === 'family_survey') { const k = S.q.stage + ':' + S.q.guesser + ':' + S.q.timerEnd; if (local.turnKey !== k) { local.turnKey = k; local.sguessSent = false; } }
  // host restarted the game / we were removed
  if (joined && S.players && !S.players[pid] && S.phase === 'lobby' && !local.rejoinSent) { local.rejoinSent = true; sendJoin(); }
  draw();
}

const myTeam = () => S && S.teams ? S.teams.find((t) => t.members.includes(pid)) : null;
const me = () => S && S.players ? S.players[pid] : null;
const pname = (id) => (S.players[id] ? S.players[id].name : '—');
const teamById = (id) => S.teams.find((t) => t.id === id);

// ---------------- views ----------------
function draw() {
  const el = app();
  if (!joined || editingAvatar) return setHTML(el, joinView());
  if (!S || !me()) return setHTML(el, `${header()}<div class="ph-body"><h2>Joining…</h2><div class="sub">Room ${esc(room)}. Make sure the big screen is on.</div></div>`);
  const keep = {};
  el.querySelectorAll('input[id],textarea[id]').forEach((x) => { if (x.type !== 'checkbox' && x.type !== 'range') keep[x.id] = x.value; });
  const focus = document.activeElement && document.activeElement.id;
  setHTML(el, header() + `<div class="ph-body">${body()}</div>` + reactBar());
  for (const [id, v] of Object.entries(keep)) { const x = document.getElementById(id); if (x && !x.value && v) x.value = v; }
  if (focus) { const x = document.getElementById(focus); if (x && document.activeElement !== x) { x.focus(); try { x.setSelectionRange(x.value.length, x.value.length); } catch (e) { /* */ } } }
}

const REACTS = ['👏🏾', '🔥', '😂', '🙌🏾', '😱', '🤦🏾', '💯', '🃏'];
function reactBar() {
  if (!S || !me() || S.phase === 'lobby') return '';
  const q = S.q, t = myTeam();
  // keep the screen clean for whoever is on the clock
  if (q && t && q.podium && q.podium[t.id] === pid && ['open', 'answering', 'blitz', 'wager', 'pick'].includes(q.stage)) return '';
  if (q && (q.guesser === pid || (q.ch && q.ch.actor === pid && q.stage === 'ch_act'))) return '';
  if (S.phase === 'final_answer' || S.phase === 'final_wager') return '';
  return `<div class="react-bar">${REACTS.map((e) => `<button data-act="react" data-v="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>`;
}

function header() {
  const m = me(), t = myTeam();
  if (!m) return '';
  const g = GENERATIONS[m.gen] || GENERATIONS.millennial;
  return `<div class="ph-top">
    <div class="mini">${renderAvatar(m.avatar, 'idle', 46)}</div>
    <div class="me"><div class="n">${esc(m.name)}</div><div class="t" style="color:${t ? t.color : g.color}">${t ? esc(t.name) : m.audience ? '👀 Audience' : g.icon + ' ' + g.label}</div></div>
    ${t ? `<div class="score">${money(t.score)}</div>` : ''}
  </div><div class="kente-strip" style="border-radius:4px"></div>`;
}

function years() {
  const now = new Date().getFullYear();
  let o = '<option value="">Birth year…</option>';
  for (let y = now - 3; y >= 1925; y--) o += `<option ${+profile.year === y ? 'selected' : ''}>${y}</option>`;
  return o;
}

function joinView() {
  if (step === 1 && !editingAvatar) {
    return `<div class="ph-body">
      ${ART.logo ? `<div style="text-align:center"><img src="${ART.logo}" alt="GENERATIONS" style="max-width:88%;max-height:110px"></div>` : '<div class="logo" style="font-size:44px;text-align:center">GENERATIONS</div>'}
      ${ART.family ? `<img class="ph-family" src="${ART.family}" alt="">` : ''}
      <div class="sub">The family game show</div>
      <div class="field"><label>Room code</label><input class="code" id="j-room" maxlength="4" autocomplete="off" autocapitalize="characters" value="${esc(room)}"></div>
      <div class="field"><label>Your name</label><input id="j-name" maxlength="16" autocomplete="off" value="${esc(profile.name)}" placeholder="Big Mama, Uncle Ray…"></div>
      <div class="field"><label>Birth year (sorts you into your generation)</label><select id="j-year">${years()}</select></div>
      <div class="sub">Rather not say? <button class="btn ghost" style="width:auto;padding:6px 10px;font-size:13px" data-act="pickgen">Pick my generation</button></div>
      ${profile.gen && !profile.year ? `<div class="sub" style="color:var(--gold)">Generation: ${GENERATIONS[profile.gen].label}</div>` : ''}
      <div id="genpick" class="hidden picker"><div class="opts-row" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">${Object.values(GENERATIONS).map((g) => `<button class="tx" data-act="gen" data-gen="${g.key}">${g.icon} ${g.label}</button>`).join('')}</div></div>
      <label class="sub" style="display:flex;gap:8px;align-items:center;justify-content:center"><input type="checkbox" id="j-aud" style="width:auto" ${profile.audience ? 'checked' : ''}> 👀 I'm just watching (Audience — no team)</label>
      <label class="sub" style="display:flex;gap:8px;align-items:center;justify-content:center"><input type="checkbox" id="j-remote" style="width:auto" ${profile.remote ? 'checked' : ''}> 🏠 I'm playing from somewhere else</label>
      <button class="btn big" data-act="step2">Next: My Avatar →</button>
    </div>`;
  }
  const a = profile.avatar, O = AVATAR_OPTIONS;
  const row = (label, key, list, swatch) => `<div class="prow"><span>${label}</span><div class="opts-row">${list.map((v) => swatch
    ? `<button class="sw ${a[key] === v ? 'on' : ''}" style="background:${v}" data-act="av" data-k="${key}" data-v="${v}"></button>`
    : `<button class="tx ${a[key] === v ? 'on' : ''}" data-act="av" data-k="${key}" data-v="${v}">${v.replace('-', ' ')}</button>`).join('')}</div></div>`;
  return `<div class="ph-body">
    <h2>Build Your Avatar</h2>
    <div class="av-preview">${renderAvatar(a, 'cheer', 150)}</div>
    ${Object.keys(ART.sprites).length ? `<div class="picker"><div class="prow"><span>Style</span><div class="opts-row">
      <button class="tx ${!a.sprite ? 'on' : ''}" data-act="sprite" data-v="">Build my own</button>
      ${Object.values(ART.sprites).map((sp) => `<button class="tx ${a.sprite === sp.id ? 'on' : ''}" data-act="sprite" data-v="${sp.id}">✨ ${esc(sp.name)}</button>`).join('')}
    </div></div></div>` : ''}
    <div class="picker" style="${a.sprite ? 'opacity:.35;pointer-events:none' : ''}">
      ${row('Skin', 'skin', O.skin, true)}
      ${row('Hair', 'hair', O.hair)}
      ${row('Color', 'hairColor', O.hairColor, true)}
      ${row('Body', 'body', O.body)}
      ${row('Outfit', 'outfit', O.outfit)}
      ${row('Fit color', 'outfitColor', O.outfitColor, true)}
      ${row('Extra', 'accessory', O.accessory)}
    </div>
    <div style="display:flex;gap:10px"><button class="btn navy" data-act="randomav">🎲 Surprise Me</button>
    <button class="btn big green" data-act="join">${editingAvatar ? 'Save' : "I'm In!"}</button></div>
    ${editingAvatar ? '' : '<button class="btn ghost" data-act="back1">← Back</button>'}
  </div>`;
}

function timerBar(end, total) {
  if (!end) return '';
  return `<div class="ptimer" data-end="${end}" data-total="${total}"><i></i></div>`;
}
function qBox(q, extra = '') {
  const isTag = q.type === 'hashtag';
  const p = isTag ? q.prompt.replace(/^Decode this hashtag:\s*/i, '') : q.prompt;
  const ERA = { elders: "👑 OGs' question", genx: '📻 Gen X special', millennial: '📱 Millennial throwback', genz: '⚡ Gen Z check' };
  const m = me(), mineGen = m ? (m.gen === 'alpha' ? 'genz' : m.gen) : null;
  const eraLine = q.era && ERA[q.era] && !q.isDD ? `<span class="cat" style="color:var(--teal)">${ERA[q.era]}${mineGen && mineGen !== q.era ? ' — crossover bonus if you get it!' : ''}</span>` : '';
  if (q.type === 'emoji') return `<div class="qtext">${eraLine}<span class="cat">Emoji Decode · ${money(q.value)}</span><span class="emoji-big">${esc(q.prompt)}</span>Name that movie, show or song!${extra}</div>`;
  return `<div class="qtext">${eraLine}<span class="cat">${esc(q.category)}${q.value ? ' · ' + money(q.value) : ''}</span>${isTag ? `<span style="font-family:var(--display);font-size:30px;color:var(--gold)">${esc(p)}</span>` : esc(p)}${extra}</div>`;
}
function optButtons(q, act, opts = {}) {
  return `<div class="opts">${q.choices.map((c, i) => {
    const L = LETTERS[i];
    let cls = opts.sel === L ? 'sel' : '';
    if (opts.reveal) cls = L === q.answer ? 'right' : (L === q.chosen ? 'wrong' : '');
    return `<button class="opt ${cls}" data-act="${act}" data-v="${L}" ${opts.disabled ? 'disabled' : ''}><span class="L">${L}</span><span>${esc(c)}</span></button>`;
  }).join('')}</div>`;
}
function wagerUI(max, min, act, label) {
  const start = Math.min(max, Math.max(min, Math.round(max / 2 / 5) * 5));
  return `<div class="range-wrap"><div class="sub">${label}</div><div class="amt" id="w-amt">${money(start)}</div>
    <input type="range" id="w-range" min="${min}" max="${max}" step="5" value="${start}">
    <div class="quick"><button data-act="wq" data-v="${min}">Min</button><button data-act="wq" data-v="${Math.round(max / 2 / 5) * 5}">Half</button><button data-act="wq" data-v="${max}">ALL IN</button></div></div>
    <button class="btn big" data-act="${act}">Lock In Wager 🔒</button>`;
}

function surveyCard() {
  const sv = S.survey;
  if (!sv || !sv.prompts.length) return '';
  const n = sv.answered[pid] || 0;
  if (n >= sv.prompts.length) return `<div class="survey-card"><div class="lbl">📋 Family Survey</div><div class="ask">✓ Done! Your answers are secret until Round 2.</div></div>`;
  return `<div class="survey-card"><div class="lbl">📋 Family Survey ${n + 1}/${sv.prompts.length} — for later!</div>
    <div class="ask">${esc(sv.prompts[n])}</div>
    <input id="sv-in" maxlength="40" autocomplete="off" placeholder="First thing that comes to mind">
    <button class="btn green" data-act="svsend" data-i="${n}">Send</button></div>`;
}

function body() {
  const s = S, t = myTeam(), m = me();
  const g = GENERATIONS[m.gen] || GENERATIONS.millennial;
  switch (s.phase) {
    case 'lobby':
      return `<div class="av-preview">${renderAvatar(m.avatar, 'cheer', 150)}</div>
        <h2>You're in!</h2><div class="msg">${g.icon} ${g.label} <span class="sub">(${g.nick})</span></div>
        <div class="sub">${m.audience ? "You're in the audience 👀 — react, play along, and vote!" : "Watch the big screen. The host will make teams when everybody's here."}</div>
        ${surveyCard()}
        <div class="away-card"><b>📍 Not near the TV?</b> You can play the whole game from this phone. Want the big-screen view too? Open <a href="host.html?watch=${esc(room)}${T.mode === 'demo' ? '&demo' : ''}" target="_blank" rel="noopener">the live show</a> on a laptop or TV. Tap 💬 to chat, send voice notes or hop on video with the family.</div>
        <button class="btn navy" data-act="editav">✏️ Change My Avatar</button>`;
    case 'teams':
      return t ? `<div class="team-banner" style="background:${t.color}">You're on<br><span style="font-size:24px">${esc(t.name)}</span></div>
        <div class="sub">Teammates: ${t.members.map((id) => esc(pname(id))).join(', ')}</div>${surveyCard()}` : `<div class="msg">${m.audience ? '👀 Audience seat secured!' : 'Waiting for teams…'}</div>${surveyCard()}`;
    case 'board': {
      const ctrl = teamById(s.controlTeam);
      const up = t ? upNext(t) : null;
      const mine = t && ctrl && t.id === ctrl.id;
      return `${scoreStrip()}<div class="msg">${mine ? '<b style="color:var(--gold)">Your team picks!</b> Tap a tile 👇🏾' : ctrl ? esc(ctrl.name) + ' is picking…' : 'Eyes on the board!'}</div>
        ${miniBoard(mine)}
        ${up ? `<div class="team-banner" style="background:${t.color}">${up === pid ? "YOU'RE UP NEXT! Get ready to buzz 🔔" : 'Up next for your team: ' + esc(pname(up))}</div>` : ''}
        ${(S.survey && (S.survey.answered[pid] || 0) < S.survey.prompts.length) ? surveyCard() : ''}`;
    }
    case 'question': return questionBody();
    case 'spin': {
      const sp = s.spin || {};
      const prizes = ['+200', 'DOUBLE NEXT', '+1 HUDDLE', 'COOKOUT! +100 ALL', '+300', 'SPIN AGAIN'];
      if (sp.stage === 'ready' && sp.spinner === pid) return `<div class="big-emoji">🎡</div><h2>Spin the Wheel!</h2><div class="msg">Your team won the right to spin.</div><button class="buzzer live" data-act="spin" style="font-size:44px">SPIN!</button>`;
      if (sp.stage === 'ready') return `<div class="big-emoji">🎡</div><h2>Sankofa Spin</h2><div class="msg">${esc(pname(sp.spinner))} is about to spin…</div>`;
      if (sp.stage === 'spinning') return `<div class="big-emoji">🌀</div><h2>Spinning…</h2><div class="msg">Watch the big screen!</div>`;
      return `<div class="big-emoji">🎉</div><h2>${esc(prizes[sp.result] || '')}</h2><div class="msg">${sp.stage === 'again' ? 'Spin again!' : (teamById(sp.team)?.name || '') + ' scores!'}</div>`;
    }
    case 'segment': {
      const seg = s.remix.segments[s.remix.segIdx];
      return `<h2>${esc(seg.label)}</h2><div class="msg">${esc(seg.blurb)}</div>`;
    }
    case 'round_end':
      return `<h2>End of Round ${s.round}</h2>${s.teams.map((x) => `<div class="team-banner" style="background:${x.color}">${esc(x.name)} — ${money(x.score)}</div>`).join('')}`;
    case 'final_intro':
      return `<div class="big-emoji">👑</div><h2>Final Wager</h2><div class="msg">Category:<br><span style="color:var(--gold)">${esc(s.final.category)}</span></div>`;
    case 'final_wager': {
      const capt = t && s.final.captains[t.id];
      if (capt === pid && !s.final.wagered[t.id] && !local.finalWagered) return `<div class="msg">You're the captain! 👑</div>${wagerUI(Math.max(t.score, 500), 0, 'fwager', `Wager $0 – ${money(Math.max(t.score, 500))}`)}${timerBar(s.final.timerEnd, s.final.timerTotal)}`;
      if (capt === pid) return `<div class="big-emoji">🔒</div><div class="msg">Wager locked. Keep it secret!</div>`;
      return `<div class="big-emoji">🤫</div><div class="msg">Captain <b>${esc(pname(capt))}</b> is placing your team's wager.</div><div class="sub">Help them decide — quietly!</div>`;
    }
    case 'final_answer': {
      const capt = t && s.final.captains[t.id];
      const q = { category: s.final.category, prompt: s.final.prompt, value: 0 };
      if (capt === pid && !s.final.answered[t.id] && !local.finalAnswered) return `${qBox(q)}<textarea id="f-text" rows="2" maxlength="80" placeholder="Type your team's answer"></textarea><button class="btn big green" data-act="fanswer">Lock In Answer 🔒</button>${timerBar(s.final.timerEnd, s.final.timerTotal)}`;
      if (capt === pid) return `${qBox(q)}<div class="msg">Answer locked! 🔒</div>`;
      return `${qBox(q)}<div class="msg">Huddle up and help <b>${esc(pname(capt))}</b>!</div>`;
    }
    case 'final_reveal': {
      const r = t && s.final.results[t.id];
      if (r && r.correct !== null && r.correct !== undefined) return `<div class="result ${r.correct ? 'good' : 'bad'}">${r.correct ? 'CORRECT!' : 'NOT QUITE'}</div><div class="msg">${r.correct ? '+' : '−'}${money(r.wager)}</div>`;
      return `<div class="big-emoji">🥁</div><div class="msg">Revealing answers on the big screen…</div>`;
    }
    case 'champion': {
      const won = t && (s.winners || []).includes(t.id);
      const st = (s.stats || {})[pid];
      const aw = s.awards || {};
      const mine = [aw.mvp && aw.mvp.pid === pid ? '⭐ MVP' : '', aw.crossover && aw.crossover.pid === pid ? '🌉 Bridge Builder' : '', aw.thief && aw.thief.pid === pid ? '🦹🏾 Master Thief' : '', aw.closer && aw.closer.pid === pid ? '🎤 The Closer' : '', aw.clown && aw.clown.pid === pid ? '😂 Family Comedian' : '', aw.liar && aw.liar.pid === pid ? '🤥 Smooth Liar' : '', aw.legend && aw.legend.pid === pid ? '👑 Most Likely Legend' : ''].filter(Boolean);
      return `<div class="big-emoji">${won ? '🏆' : '👏🏾'}</div><h2>${won ? 'CHAMPIONS!' : 'Good Game!'}</h2><div class="msg">${won ? 'Your team won it all!' : 'Run it back?'}</div>
        ${mine.length ? `<div class="team-banner" style="background:var(--violet)">You won: ${mine.join(' · ')}</div>` : ''}
        ${st ? `<div class="sub">Your game: ${st.correct || 0} correct · ${st.crossovers || 0} crossover · ${money(st.points || 0)} earned</div>` : ''}`;
    }
  }
  return '';
}

function scoreStrip() {
  return `<div class="ph-scores">${S.teams.map((x) => `<div style="--tc:${x.color}"><span>${esc(x.name)}</span><b>${money(x.score)}</b></div>`).join('')}</div>`;
}
function miniBoard(canPick) {
  const b = S.board; if (!b || !b.cats) return '';
  const cats = b.cats;
  return `<div class="ph-board" style="--n:${cats.length}">${cats.map((c) => `<div class="pb-cat">${esc(c.name)}</div>`).join('')}
    ${[0, 1, 2, 3, 4].map((r) => cats.map((c, ci) => { const tl = (c.tiles || [])[r]; return !tl || tl.used ? '<span class="pb-used"></span>' : canPick ? `<button class="pb-tile" data-act="pickboard" data-ci="${ci}" data-ti="${r}">${tl.value}</button>` : `<span class="pb-tile">${tl.value}</span>`; }).join('')).join('')}</div>`;
}
function upNext(team) {
  const mbr = team.members;
  if (!mbr.length) return null;
  for (let k = 0; k < mbr.length; k++) {
    const id = mbr[(team.rot + k) % mbr.length];
    if (S.players[id] && S.players[id].connected) return id;
  }
  return mbr[team.rot % mbr.length];
}

function questionBody() {
  const q = S.q, t = myTeam();
  const onPodium = t && q.podium[t.id] === pid;
  const now = T.serverNow();

  if (q.type === 'majority_rules') {
    if (q.stage === 'vote') {
      if (local.vote) return `${qBox(q)}<div class="big-emoji">🗳️</div><div class="msg">You voted <b>${local.vote}</b>. Waiting for the room…</div>`;
      return `${qBox(q)}<div class="sub">Everybody votes! Match the room to score.</div>${optButtons(q, 'vote')}${timerBar(q.timerEnd, q.timerTotal)}`;
    }
    const hit = local.vote && q.top && q.top.includes(local.vote);
    return `<div class="result ${hit ? 'good' : 'bad'}">${hit ? 'YOU MATCHED!' : local.vote ? 'NOT THE MAJORITY' : 'NO VOTE'}</div><div class="msg">${hit ? '+' + q.value + ' for your team' : ''}</div>`;
  }

  if (q.type === 'one_gotta_go') {
    const og = q.ogg;
    if (q.stage === 'pick') {
      if (onPodium && !og.picks[t.id] && !local.pick) return `${qBox(q)}<div class="msg">You're on the podium! Which one's gotta go?</div>${optButtons(q, 'pick')}${timerBar(q.timerEnd, q.timerTotal)}`;
      if (onPodium) return `${qBox(q)}<div class="msg">Locked in! Get your 10-second argument ready 🎤</div>`;
      return `${qBox(q)}<div class="msg">Podium players are choosing…</div>`;
    }
    if (q.stage === 'pitch') {
      const cur = og.order[og.pitchIdx];
      const pick = q.choices[LETTERS.indexOf(og.picks[cur])];
      if (onPodium && cur === t.id) return `<div class="big-emoji">🎤</div><h2>YOUR TURN!</h2><div class="msg">Tell the room why <b>${esc(pick)}</b> has gotta go!</div>${timerBar(q.timerEnd, q.timerTotal)}`;
      return `<div class="big-emoji">👂🏾</div><div class="msg"><b>${esc(pname(q.podium[cur]))}</b> says <b>${esc(pick)}</b> gotta go…</div>`;
    }
    if (q.stage === 'pitchvote') {
      if (local.defense) return `<div class="big-emoji">🗳️</div><div class="msg">Vote locked!</div>`;
      const opts = og.order.filter((id) => !t || id !== t.id);
      if (!opts.length) return `<div class="msg">Waiting for votes…</div>`;
      return `<div class="msg">Who had the BEST defense?</div><div class="opts">${opts.map((id) => `<button class="opt" data-act="defense" data-v="${id}"><span class="L" style="background:${teamById(id).color}"></span><span>${esc(teamById(id).name)}<br><small>kick out ${esc(q.choices[LETTERS.indexOf(og.picks[id])])}</small></span></button>`).join('')}</div>${timerBar(q.timerEnd, q.timerTotal)}`;
    }
    const won = t && q.top && q.top.includes(t.id);
    return `<div class="result ${won ? 'good' : 'bad'}">${won ? 'BEST DEFENSE!' : 'The room has spoken'}</div><div class="msg">${won ? '+' + q.value : ''}</div>`;
  }

  if (q.type === 'blitz') return blitzBody(q, t, onPodium, now);
  if (q.type === 'family_survey') return surveyBody(q, t, onPodium);
  if (q.type === 'charades') return charadesBody(q, t);
  if (['hot_take', 'most_likely', 'top_that', 'two_truths'].includes(q.type)) return partyBody(q, t);

  // trivia / hashtag / era
  if (q.stage === 'wager') {
    if (q.answerer === pid && !local.wagered) return `<div class="big-emoji">💰</div><h2>Family Wager!</h2><div class="msg">Category: ${esc(q.category)}</div>${wagerUI(q.maxWager, 5, 'wager', `Wager $5 – ${money(q.maxWager)}`)}${timerBar(q.timerEnd, q.timerTotal)}`;
    return `<div class="big-emoji">💰</div><h2>Family Wager!</h2><div class="msg">${esc(pname(q.answerer))} is placing a wager…</div>`;
  }
  if (q.stage === 'reveal') {
    const mine = t && q.winnerTeam === t.id;
    const head = q.result === 'correct'
      ? `<div class="result ${mine ? 'good' : 'bad'}">${mine ? 'YOUR TEAM GOT IT!' : esc(teamById(q.winnerTeam)?.name || '') + ' got it'}</div>`
      : `<div class="result bad">${q.stamp === 'revoked' ? 'CARD REVOKED!' : 'Nobody got it'}</div>`;
    return `${head}${q.choices ? optButtons(q, '', { reveal: true, disabled: true }) : `<div class="qtext">${esc(q.answerText || '')}</div>`}<div class="sub">${esc(q.context || '')}</div>`;
  }
  if (onPodium && q.eligible.includes(t.id)) {
    if (q.stage === 'answering' && q.answerer === pid) {
      const life = t.lifelines > 0 && !q.huddleUsed ? `<button class="btn lifeline" data-act="lifeline">📞 Family Huddle (${t.lifelines} left)</button>` : '';
      const huddle = q.huddleUntil > now ? `<div class="team-banner" style="background:var(--violet)">HUDDLE! Your team can help for 15 seconds</div>` : '';
      return `${qBox(q)}${huddle}${q.choices ? optButtons(q, 'answer', { sel: local.answer, disabled: !!local.answer }) : '<div class="msg">Say your answer OUT LOUD! 🗣️</div>'}${life}${timerBar(q.timerEnd, q.timerTotal)}`;
    }
    if (q.stage === 'answering') return `${qBox(q)}<div class="msg">${esc(pname(q.answerer))} is answering…${q.attempted.includes(t.id) ? '' : '<br>If they miss, you can STEAL!'}</div>`;
    const locked = (q.lockouts && q.lockouts[pid] > now) || q.stage !== 'open' || local.buzzed;
    const label = local.buzzed ? 'BUZZED!' : (q.lockouts && q.lockouts[pid] > now ? 'TOO SOON!' : q.stage === 'open' ? 'BUZZ!' : 'WAIT…');
    return `${qBox(q)}<div class="sub">${q.steal ? 'STEAL CHANCE!' : q.stage === 'open' ? 'Buzzers are open!' : "Don't buzz early — wait for it!"}</div>
      <button class="buzzer ${q.stage === 'open' && !locked ? 'live' : ''} ${local.buzzed ? 'won' : ''} ${locked && !local.buzzed && q.stage !== 'reading' ? 'locked' : ''} ${q.stage === 'reading' ? 'locked' : ''}" data-act="buzz">${label}</button>
      ${timerBar(q.stage === 'open' ? q.timerEnd : 0, q.timerTotal)}`;
  }
  // bench (+ secret play-along)
  const myPod = t && q.podium[t.id];
  const canAlong = S.settings.playAlong && q.choices && ['reading', 'open', 'answering', 'wager'].includes(q.stage) && ['trivia', 'hashtag', 'saying', 'emoji', 'name_that_era'].includes(q.type);
  if (canAlong) {
    return `${qBox(q)}${myPod ? `<div class="sub">${esc(pname(myPod))} is on the podium for your team.</div>` : ''}
      <div class="along"><div class="lbl">🤫 Play along — secret answer${t ? ' (bonus for your team!)' : ''}</div>
      ${local.along ? `<div class="msg">Locked in: <b>${local.along}</b> 🤫</div>` : optButtons(q, 'along')}</div>`;
  }
  const huddle = t && q.stage === 'answering' && q.huddleUntil > now && teamOfAnswerer() === t.id;
  return `${qBox(q)}${huddle ? `<div class="team-banner" style="background:var(--violet)">📞 FAMILY HUDDLE! Help ${esc(pname(q.answerer))} — shout it out!</div>` : ''}
    <div class="sub">${myPod ? `${esc(pname(myPod))} is on the podium for your team.` : ''} You're on the bench this round.</div>
    ${q.choices ? `<div class="opts" style="opacity:.75">${q.choices.map((c, i) => `<div class="opt" style="box-shadow:none"><span class="L">${LETTERS[i]}</span><span>${esc(c)}</span></div>`).join('')}</div>` : ''}`;
}

// ---------------- Party games ----------------
function teamPts(q, t) { return t && q.awards && q.awards[t.id] ? `<div class="msg">Your team +${q.awards[t.id]}</div>` : ''; }
function partyBody(q, t) {
  const tb = timerBar(q.timerEnd, q.timerTotal);
  const voted = !!q.voted[pid];
  if (q.type === 'hot_take') {
    const h = q.ht, box = `<div class="qtext"><span class="cat">🔥 Settle It! · Hot Take</span>“${esc(q.prompt)}”</div>`;
    if (q.stage === 'ht_vote1' || q.stage === 'ht_vote2') {
      const k = q.stage, mine = local[k];
      return `${box}<div class="sub">${k === 'ht_vote2' ? 'Did they change your mind? Vote again!' : 'Where do you stand?'}</div>
        <div class="pt-row"><button class="opt pt-big pt-agree ${mine === 'agree' ? 'sel' : ''}" data-act="htvote" data-v="agree">👍🏾 AGREE</button><button class="opt pt-big pt-disagree ${mine === 'disagree' ? 'sel' : ''}" data-act="htvote" data-v="disagree">👎🏾 DISAGREE</button></div>
        ${mine ? `<div class="msg">You said <b>${mine.toUpperCase()}</b> — tap the other to switch</div>` : ''}${tb}`;
    }
    if (q.stage === 'ht_argue') {
      const side = h.turn ? 'disagree' : 'agree', sp = h.speakers[side];
      if (sp === pid) return `<div class="big-emoji">🎤</div><h2>YOUR TURN!</h2><div class="msg">Argue for <b>${side.toUpperCase()}</b>${h.devil[side] ? " (nobody picked this side — play devil's advocate!)" : ''}. Convince the room!</div>${box}${tb}`;
      const otherMine = h.speakers[h.turn ? 'agree' : 'disagree'] === pid && !h.turn;
      return `<div class="big-emoji">👂🏾</div><div class="msg"><b>${esc(pname(sp))}</b> is arguing <b>${side.toUpperCase()}</b>…${otherMine ? '<br>You\'re up NEXT for the other side! 🎤' : ''}</div>${box}`;
    }
    const won = h.winSide && t && q.awards[t.id];
    return `<div class="result ${won ? 'good' : 'bad'}">${h.winSide ? `${h.winSide.toUpperCase()} GAINED ${Math.abs(h.shift || 0)}%` : 'NOBODY BUDGED'}</div>${teamPts(q, t)}${box}`;
  }
  if (q.type === 'most_likely') {
    const ml = q.ml, box = `<div class="qtext"><span class="cat">👑 Who in the Family…?</span>Most likely to ${esc(q.prompt)}</div>`;
    if (q.stage === 'ml_vote') {
      if (voted || local.ml) return `${box}<div class="big-emoji">🗳️</div><div class="msg">You picked <b>${esc(pname(local.ml))}</b>. No take-backs! 😂</div>`;
      const c = ml.cands.filter((id) => id !== pid);
      return `${box}<div class="ml-pick">${c.map((id) => `<button data-act="mlvote" data-v="${id}">${renderAvatar(S.players[id]?.avatar, 'idle', 64)}<div>${esc(pname(id))}</div></button>`).join('')}</div>${tb}`;
    }
    const me2 = ml.top.includes(pid), hit = ml.matchers.includes(pid);
    return `<div class="result ${hit ? 'good' : 'bad'}">${me2 ? "IT'S YOU! 👑" : hit ? 'YOU MATCHED!' : 'The family picked…'}</div><div class="msg"><b>${ml.top.map((x) => esc(pname(x))).join(' & ') || 'nobody'}</b></div>${teamPts(q, t)}${box}`;
  }
  if (q.type === 'top_that') {
    const tt = q.tt, box = `<div class="qtext"><span class="cat">😂 Top That!</span>${esc(q.prompt)}</div>`;
    if (q.stage === 'tt_write') {
      if (voted && local.ttText) return `${box}<div class="msg">Locked in: <b>“${esc(local.ttText)}”</b><br>Waiting on everybody… 🤭</div>`;
      return `${box}<div class="sub">Make the room laugh. Keep it family-friendly-ish 😅</div><input id="tt-in" class="ph-text" maxlength="80" autocomplete="off" placeholder="Your answer"><button class="btn big green" data-act="ttsend">Send It</button>${tb}`;
    }
    if (q.stage === 'tt_vote') {
      if (voted || local.ttVote) return `${box}<div class="big-emoji">🗳️</div><div class="msg">Vote locked!</div>`;
      const list = (tt.entries || []).filter((e) => !e.hidden && e.text !== local.ttText);
      if (!list.length) return `${box}<div class="msg">Sit tight — the room is voting!</div>`;
      return `${box}<div class="sub">Tap the FUNNIEST (yours is hidden)</div><div class="opts">${list.map((e) => `<button class="opt" data-act="ttvote" data-v="${e.id}"><span>${esc(e.text)}</span></button>`).join('')}</div>${tb}`;
    }
    const mine = (tt.entries || []).find((e) => e.by === pid);
    const won = mine && tt.topIds.includes(mine.id);
    return `<div class="result ${won ? 'good' : 'bad'}">${won ? 'ROOM FAVORITE! 🏆' : mine ? `${mine.votes} vote${mine.votes === 1 ? '' : 's'}` : "That's a wrap!"}</div>${teamPts(q, t)}${box}`;
  }
  if (q.type === 'two_truths') {
    const tw = q.tw, teller = tw.teller === pid;
    if (q.stage === 'tw_write') {
      if (!teller) return `<div class="big-emoji">🤥</div><h2>Two Truths & a Lie</h2><div class="msg"><b>${esc(pname(tw.teller))}</b> is cooking up two truths and a lie… get your detective hat on 🕵🏾</div>`;
      const lie = local.twLie;
      return `<h2>You're the teller! 🤫</h2><div class="sub">Type 2 TRUE things about you and 1 LIE. Tap “Lie” next to the fake one.</div>
        <div class="tw-pick">${[0, 1, 2].map((i) => `<div class="tw-line"><input id="tw-${i}" class="ph-text" maxlength="90" autocomplete="off" placeholder="Statement ${i + 1}"><button class="tw-lie ${lie === i ? 'on' : ''}" data-act="twlie" data-v="${i}">${lie === i ? '🤥 LIE' : 'Lie?'}</button></div>`).join('')}</div>
        <button class="btn big green" data-act="twsend">Lock It In</button>${tb}`;
    }
    const list = (tw.statements || []);
    if (q.stage === 'tw_vote') {
      if (teller) return `<div class="big-emoji">😐</div><h2>Poker face!</h2><div class="msg">The family is voting. Don't smile… don't you DARE smile.</div>`;
      if (voted || local.twVote !== undefined) return `<div class="big-emoji">🕵🏾</div><div class="msg">You think #${(local.twVote ?? 0) + 1} is the lie. We'll see…</div>`;
      return `<div class="sub">Which one is <b>${esc(pname(tw.teller))}</b>'s LIE?</div><div class="opts">${list.map((st, i) => `<button class="opt" data-act="twvote" data-v="${i}"><span class="L">${i + 1}</span><span>${esc(st)}</span></button>`).join('')}</div>${tb}`;
    }
    if (!list.length) return `<div class="msg">Skipped — no statements this time.</div>`;
    const hit = tw.right.includes(pid);
    return `<div class="result ${teller ? (tw.fooled ? 'good' : 'bad') : hit ? 'good' : 'bad'}">${teller ? (tw.fooled ? `YOU FOOLED ${tw.fooled}!` : 'BUSTED!') : hit ? 'CAUGHT THE LIE!' : 'YOU GOT FOOLED!'}</div>
      <div class="msg">The lie: <b>${esc(list[tw.lie] || '')}</b></div>${teamPts(q, t)}`;
  }
  return '';
}

function surveyBody(q, t, onPodium) {
  const board = `<div class="mini-board">${q.board.map((b, i) => b.revealed ? `<div class="on"><span>${i + 1}. ${esc(b.label)}</span><span>${b.pts}</span></div>` : `<div><span>${i + 1}.</span><span>?</span></div>`).join('')}</div>`;
  const head = `<div class="qtext"><span class="cat">The Family Survey · Bank ${money(q.bank)} · ${'✕'.repeat(q.strikes)}</span>${esc(q.prompt)}</div>`;
  if (q.stage === 'reveal') {
    const won = t && q.winnerTeam === t.id;
    return `<div class="result ${won ? 'good' : 'bad'}">${won ? (q.stolen ? 'STOLEN!' : 'BOARD WON!') : 'Survey closed'}</div>${head}${board}`;
  }
  if (['fo_answer', 'play', 'steal'].includes(q.stage) && q.guesser === pid && !local.sguessSent) {
    const label = q.stage === 'steal' ? 'ONE guess to steal it all — huddle with your team!' : q.stage === 'fo_answer' ? 'Face-off! What did the family say?' : "Your turn! What's on the board?";
    return `${head}<div class="msg">${label}</div><input id="sg-in" maxlength="40" autocomplete="off" placeholder="Type your answer"><button class="btn big green" data-act="sguess">Lock It In</button>${timerBar(q.timerEnd, q.timerTotal)}${board}`;
  }
  if (['reading', 'open'].includes(q.stage) && onPodium) {
    return `${head}<div class="sub">Buzz in to control the board!</div><button class="buzzer ${q.stage === 'open' && !local.buzzed ? 'live' : 'locked'} ${local.buzzed ? 'won' : ''}" data-act="buzz">${local.buzzed ? 'BUZZED!' : q.stage === 'open' ? 'BUZZ!' : 'WAIT…'}</button>`;
  }
  const who = q.guesser ? esc(pname(q.guesser)) : '';
  return `${head}<div class="msg">${q.stage === 'steal' ? `${who} is trying to STEAL!` : who ? `${who} is guessing…` : 'Get ready…'}</div>${board}`;
}

function charadesBody(q, t) {
  const ch = q.ch, tid = ch.order[ch.idx];
  const actor = ch.actor === pid;
  if (q.stage === 'reveal') { const won = t && q.top && q.top.includes(t.id); return `<div class="result ${won ? 'good' : 'bad'}">${won ? 'BEST ACTORS!' : "That's a wrap!"}</div>${t ? `<div class="msg">Your team got ${ch.counts[t.id] || 0}</div>` : ''}`; }
  if (q.stage === 'ch_ready') return actor ? `<div class="big-emoji">🎭</div><h2>You're acting!</h2><div class="msg">No talking, no spelling, no pointing at stuff in the room. When the host starts the clock, your clue appears here.</div>` : `<div class="big-emoji">🎭</div><div class="msg"><b>${esc(pname(ch.actor))}</b> is about to act${t && t.id === tid ? ' for YOUR team — get ready to shout!' : '.'}</div>`;
  if (q.stage === 'ch_act') {
    if (actor) return `<div class="sub">Act it out!</div><div class="ch-word">${esc(ch.word || '')}</div>
      <div style="display:flex;gap:10px"><button class="btn navy" data-act="chskip">↷ Skip</button><button class="btn big green" data-act="chgot">✓ Got it!</button></div>
      <div class="blitz-ph"><div class="count">${ch.counts[tid]} correct</div></div>${timerBar(q.timerEnd, q.timerTotal)}`;
    return `<div class="big-emoji">🗣️</div><h2>${t && t.id === tid ? 'GUESS OUT LOUD!' : 'Watch & laugh'}</h2><div class="msg">${esc(pname(ch.actor))} is acting · ${ch.counts[tid]} correct</div>`;
  }
  return `<div class="msg">${esc(teamById(tid)?.name || '')} got ${ch.counts[tid]}!</div>`;
}

function blitzBody(q, t, onPodium, now) {
  const b = q.blitz;
  if (q.stage === 'reveal') {
    const pr = t ? b.progress[t.id] : null;
    const won = t && q.top && q.top.includes(t.id);
    return `<div class="result ${won ? 'good' : 'bad'}">${won ? 'BLITZ WINNERS!' : 'TIME!'}</div>${pr ? `<div class="msg">Your team: ${pr.correct} right · +${money((q.awards || {})[t.id] || 0)}</div>` : ''}`;
  }
  if (!onPodium) {
    const pr = t ? b.progress[t.id] : null;
    return `<div class="big-emoji">⚡</div><h2>60-Second Blitz!</h2><div class="msg">Cheer on ${t ? esc(pname(q.podium[t.id])) : 'the podium'}!</div>${pr ? `<div class="blitz-ph"><div class="count">${pr.correct} right · ${pr.idx}/${b.total}</div></div>` : ''}`;
  }
  if (now < q.blitzStart) return `<div class="big-emoji">⚡</div><h2>Get Ready!</h2><div class="msg">Answer as many as you can. Wrong answers just skip ahead — so GO FAST!</div>`;
  const pr = b.progress[t.id];
  const i = Math.max(pr.idx, local.blitzIdx || 0);
  if (local.blitzCorrect === undefined) local.blitzCorrect = 0;
  if (i >= b.total) return `<div class="big-emoji">🏁</div><h2>Done!</h2><div class="msg">${pr.correct} right. Wait for the clock…</div>`;
  const cur = b.qs[i];
  return `<div class="blitz-ph"><div class="count">⚡ ${i + 1} / ${b.total} · ${pr.correct} right</div></div>
    <div class="qtext"><span class="cat">${esc(cur.cat)}</span>${esc(cur.p)}</div>
    <div class="opts">${cur.c.map((c, k) => `<button class="opt" data-act="blitz" data-i="${i}" data-v="${LETTERS[k]}"><span class="L">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join('')}</div>
    ${timerBar(q.timerEnd, q.timerTotal)}`;
}

function teamOfAnswerer() { const t = S.teams.find((x) => x.members.includes(S.q.answerer)); return t && t.id; }

// ---------------- timers ----------------
function frame() {
  requestAnimationFrame(frame);
  const now = T ? T.serverNow() : Date.now();
  document.querySelectorAll('.ptimer').forEach((el) => {
    const end = +el.dataset.end, total = +el.dataset.total;
    const left = Math.max(0, end - now);
    el.firstElementChild.style.width = (Math.max(0, Math.min(1, left / total)) * 100) + '%';
    el.classList.toggle('low', left < 4000);
  });
  // lockout / huddle expiries need a redraw
  if (S && S.q) {
    const k = (S.q.lockouts && S.q.lockouts[pid] > now ? 'L' : '') + (S.q.huddleUntil > now ? 'H' : '') + (S.q.blitzStart && now >= S.q.blitzStart ? 'B' : '');
    if (k !== local.flags) { local.flags = k; draw(); }
  }
}

// ---------------- events ----------------
function toast(t) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'chat-in') { e.preventDefault(); onClick({ target: document.querySelector('[data-act=chatsend]') }); } });
function onInput(e) {
  if (e.target.id === 'w-range') { const a = $('#w-amt'); if (a) a.textContent = money(+e.target.value); }
  if (e.target.id === 'j-room') { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); }
  if (e.target.id === 'j-name') profile.name = e.target.value;
  if (e.target.id === 'j-aud') profile.audience = e.target.checked;
  if (e.target.id === 'j-remote') profile.remote = e.target.checked;
  if (e.target.id === 'j-year') { profile.year = e.target.value; if (profile.year) profile.gen = genFromYear(profile.year); }
}
async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, v = el.dataset.v;
  switch (a) {
    case 'pickgen': $('#genpick').classList.toggle('hidden'); break;
    case 'gen': profile.gen = el.dataset.gen; profile.year = ''; cache.delete(app()); draw(); break;
    case 'step2': {
      const code = ($('#j-room').value || '').toUpperCase();
      profile.name = ($('#j-name').value || '').trim();
      if (code.length !== 4) return toast('Enter the 4-letter room code');
      if (!profile.name) return toast('Enter your name');
      if (!profile.year && !profile.gen) return toast('Pick your birth year or generation');
      if (!(await T.roomExists(code))) return toast(`Room ${code} not found — check the big screen`);
      room = code; step = 2; draw(); break;
    }
    case 'back1': step = 1; draw(); break;
    case 'av': profile.avatar = { ...profile.avatar, [el.dataset.k]: v }; draw(); break;
    case 'randomav': profile.avatar = randomAvatar(); draw(); break;
    case 'sprite': profile.avatar = { ...profile.avatar, sprite: v || undefined }; if (!v) delete profile.avatar.sprite; draw(); break;
    case 'editav': editingAvatar = true; draw(); break;
    case 'join':
      if (editingAvatar) {
        editingAvatar = false;
        saveProfile();
        send({ type: 'avatar', avatar: profile.avatar });
        draw(); break;
      }
      await connect(room); sendJoin(); draw(); break;
    case 'buzz':
      if (local.buzzed) return;
      el.classList.add('hit'); vib(80);
      send({ type: 'buzz', t: T.serverNow() });
      if (S.q.stage === 'open') { local.buzzed = true; draw(); }
      break;
    case 'answer': if (local.answer) return; local.answer = v; vib(40); send({ type: 'answer', choice: v }); draw(); break;
    case 'lifeline': send({ type: 'lifeline' }); break;
    case 'spin': vib([40, 30, 80]); send({ type: 'spin' }); break;
    case 'svsend': {
      const txt = ($('#sv-in').value || '').trim();
      if (!txt) return toast('Type something first');
      send({ type: 'survey', i: +el.dataset.i, text: txt }); vib(30); break;
    }
    case 'sguess': {
      const txt = ($('#sg-in').value || '').trim();
      if (!txt) return toast('Type a guess first');
      local.sguessSent = true; send({ type: 'sguess', text: txt }); vib(40); draw(); break;
    }
    case 'along': if (local.along) return; local.along = v; vib(30); send({ type: 'along', choice: v }); draw(); break;
    case 'htvote': local[S.q.stage] = v; vib(40); send({ type: 'party', v }); draw(); break;
    case 'mlvote': if (local.ml) return; local.ml = v; vib(40); send({ type: 'party', v }); draw(); break;
    case 'ttsend': {
      const txt = ($('#tt-in').value || '').trim();
      if (!txt) return toast('Type something funny first 😄');
      local.ttText = txt.replace(/\s+/g, ' ').slice(0, 80); vib(40); send({ type: 'party', text: txt }); draw(); break;
    }
    case 'ttvote': if (local.ttVote) return; local.ttVote = v; vib(40); send({ type: 'party', v }); draw(); break;
    case 'twlie': local.twLie = +v; cache.delete(app()); draw(); break;
    case 'twsend': {
      const list = [0, 1, 2].map((i) => ($('#tw-' + i).value || '').trim());
      if (list.some((x) => !x)) return toast('Fill in all three');
      if (local.twLie === undefined) return toast('Tap “Lie?” next to the fake one');
      vib(60); send({ type: 'party', list, lie: local.twLie }); break;
    }
    case 'twvote': if (local.twVote !== undefined) return; local.twVote = +v; vib(40); send({ type: 'party', v: +v }); draw(); break;
    case 'chatopen': chat.open = true; chat.unread = 0; $('#chatsheet').classList.remove('hidden'); document.body.classList.add('chat-open'); drawChat(); break;
    case 'chatclose': chat.open = false; $('#chatsheet').classList.add('hidden'); document.body.classList.remove('chat-open'); break;
    case 'chatsend': {
      const inp = $('#chat-in'); const txt = (inp.value || '').trim().slice(0, CHAT_MAX);
      if (!txt) return;
      inp.value = ''; vib(15);
      T.sendChat({ pid, name: profile.name, where: where(), color: myTeam()?.color || '', kind: 'text', text: txt });
      break;
    }
    case 'rec': {
      const b = $('#micbtn');
      if (rec) { const r = rec; rec = null; b.classList.remove('live'); b.textContent = '🎤'; sendVoice(await r.stop()); break; }
      if (!canRecord()) return toast("This phone can't record voice notes in the browser");
      try {
        rec = await startVoiceNote((sec) => { b.textContent = `⏹ ${Math.ceil(VOICE_MAX_SEC - sec)}`; if (sec >= VOICE_MAX_SEC && rec) { const r = rec; rec = null; b.classList.remove('live'); b.textContent = '🎤'; r.stop().then(sendVoice); } });
        b.classList.add('live'); vib(40); toast('Recording… tap ⏹ to send');
      } catch (e) { rec = null; toast('Allow the microphone to send voice notes'); }
      break;
    }
    case 'playvoice': { const m = chat.byId[el.dataset.id]; if (m && m.audio) { el.classList.add('playing'); playVoice(m.audio, () => el.classList.remove('playing')); } break; }
    case 'calljoin':
      try { await call.join({ video: v === 'video', audio: true }); toast(v === 'video' ? '📹 You joined the video call' : '🎧 You joined by voice'); }
      catch (e) { toast('Allow the camera/microphone to join the call'); }
      drawCallBar(); break;
    case 'callleave': call.leave(); drawCallBar(); break;
    case 'callmute': call.toggleMute(); break;
    case 'callcam': call.toggleCam(); break;
    case 'pickboard': vib(30); send({ type: 'tile', ci: +el.dataset.ci, ti: +el.dataset.ti }); break;
    case 'chgot': vib(40); send({ type: 'charades', action: 'got' }); break;
    case 'chskip': vib(15); send({ type: 'charades', action: 'skip' }); break;
    case 'blitz': {
      const i = +el.dataset.i;
      if ((local.blitzIdx || 0) > i) return;
      local.blitzIdx = i + 1; vib(25);
      send({ type: 'blitz', i, choice: v }); draw(); break;
    }
    case 'react': {
      const now = Date.now();
      if (now - (local.lastReact || 0) < 650) return;
      local.lastReact = now; vib(15);
      send({ type: 'react', e: v });
      el.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 250 });
      break;
    }
    case 'vote': local.vote = v; vib(40); send({ type: 'vote', choice: v }); draw(); break;
    case 'pick': local.pick = v; vib(40); send({ type: 'pick', choice: v }); draw(); break;
    case 'defense': local.defense = v; vib(40); send({ type: 'defense', team: v }); draw(); break;
    case 'wq': { const r = $('#w-range'); if (r) { r.value = v; $('#w-amt').textContent = money(+v); } break; }
    case 'wager': local.wagered = true; send({ type: 'wager', amount: +$('#w-range').value }); draw(); break;
    case 'fwager': local.finalWagered = true; send({ type: 'finalWager', amount: +$('#w-range').value }); draw(); break;
    case 'fanswer': {
      const txt = ($('#f-text').value || '').trim();
      if (!txt) return toast('Type an answer first');
      local.finalAnswered = true; send({ type: 'finalAnswer', text: txt }); draw(); break;
    }
  }
}

boot();
