// ============================================================
// GENERATIONS — Phone controller
// ============================================================
import { applyWorld } from './world.js';
import { createTransport } from './transport.js';
import { GENERATIONS, genFromYear, uid, esc, money, $, LETTERS } from './util.js';
import { renderAvatar, AVATAR_OPTIONS, randomAvatar } from './avatar.js';
import { loadArt, ART } from './assets.js';
import { normalize } from './normalize.js';
import { CallManager, VideoWall, chatItemHTML, startVoiceNote, playVoice, canRecord, CHAT_MAX, VOICE_MAX_SEC } from './social.js';
import { BEEF_TOPICS, GAME_PITCH, GAME_CARDS } from './setupdata.js';

let T, S = null, pid, room;
let profile = { name: '', year: '', gen: '', avatar: randomAvatar() };
let joined = false, editingAvatar = false, step = 1;
let local = {};
let lastFx = null;
let wasAct = false;
let bigText = localStorage.getItem('gen-bigtext') === '1';
// ⚙️ phone setup — everybody sets their remote up their way
const PREF_DEFAULT = { size: bigText ? 'big' : 'normal', layout: 'simple', vib: true, contrast: false, tips: true, hand: 'right' };
let prefs = (() => { try { return { ...PREF_DEFAULT, ...JSON.parse(localStorage.getItem('gen-phone-prefs') || '{}') }; } catch (e) { return { ...PREF_DEFAULT }; } })();
function applyPrefs() {
  const b = document.body;
  b.classList.toggle('bigtext', prefs.size !== 'normal');
  b.classList.toggle('hugetext', prefs.size === 'huge');
  b.classList.toggle('contrast', !!prefs.contrast);
  b.classList.toggle('simple', prefs.layout === 'simple');
  b.classList.toggle('lefty', prefs.hand === 'left');
}
function savePrefs() { try { localStorage.setItem('gen-phone-prefs', JSON.stringify(prefs)); } catch (e) { /* */ } applyPrefs(); }
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ } }
// ---- play-from-anywhere: chat, voice notes, video ----
const chat = { list: [], byId: {}, unread: 0, open: false, wired: false };
let call = null, wall = null, rec = null;
const app = () => $('#app');
const cache = new WeakMap();
function setHTML(el, html) { if (cache.get(el) === html) return; cache.set(el, html); el.innerHTML = html; }
const vib = (p) => { try { if (prefs.vib !== false) navigator.vibrate && navigator.vibrate(p); } catch (e) { /* no-op */ } };

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
  applyPrefs();
  keepAwake(); document.addEventListener('visibilitychange', keepAwake);
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
  // solo.html: join instantly with the name from the setup card
  const QS = new URLSearchParams(location.search);
  if (QS.get('solo') && room) {
    document.body.classList.add('solo');
    profile = { ...profile, name: (QS.get('name') || 'You').slice(0, 16), year: QS.get('year') || '', gen: QS.get('year') ? '' : 'millennial', audience: false, remote: false, avatar: profile.avatar || randomAvatar() };
    await connect(room); sendJoin();
  } else if (room && sessionStorage.getItem('gen-joined') === room && profile.name) { await connect(room); sendJoin(); } // auto-rejoin after a refresh/sleep
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
  applyWorld(S);
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
  setHTML(el, header() + coachStrip() + `<div class="ph-body">${body()}</div>` + captainBar() + reactBar() + (local.prefsOpen ? prefsSheet() : ''));
  // "your turn" nudge: buzz the phone + flash when an action shows up for you
  const act = !!el.querySelector('.ph-body .buzzer.live, .ph-body [data-act=answer]:not([disabled]), .ph-body [data-act=wq], .ph-body [data-act=lifeline], .ph-body [data-act=pickboard], .ph-body [data-act=spin], .ph-body [data-act=chgot], .ph-body [data-act=sisong], .ph-body [data-act=twsend], .ph-body [data-act=ttsend], .ph-body [data-act=fanswer], .ph-body [data-act=blitz], .ph-body [data-act=sguess]');
  if (act && !wasAct) { vib([70, 40, 70]); const b = el.querySelector('.ph-body'); if (b) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); } }
  wasAct = act;
  for (const [id, v] of Object.entries(keep)) { const x = document.getElementById(id); if (x && !x.value && v) x.value = v; }
  if (focus) { const x = document.getElementById(focus); if (x && document.activeElement !== x) { x.focus(); try { x.setSelectionRange(x.value.length, x.value.length); } catch (e) { /* */ } } }
}

const REACTS = ['👏🏾', '🔥', '😂', '🙌🏾', '😱', '🤦🏾', '💯', '🃏'];
function reactBar() {
  if (!S || !me() || S.phase === 'lobby' || prefs.layout === 'simple') return '';
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
    <button class="aa-btn" data-act="prefs" aria-label="Set up my phone">⚙️</button>
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
      <div class="logo" style="font-size:44px;text-align:center">GENERATIONS<br><span class="s2" style="font-size:16px">SEASON 2 · BLOCK PARTY</span></div>
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
      <div class="sub" style="margin-top:10px">No game yet? <a href="learn.html" style="color:var(--gold);font-weight:900">🎓 Practice every game on your own</a></div>
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


// ---------- ⚙️ phone setup sheet ----------
function prefsSheet() {
  const opt = (k, v, l) => `<button class="pf-opt ${prefs[k] === v ? 'on' : ''}" data-act="pref" data-k="${k}" data-v="${v}">${l}</button>`;
  const tog = (k, l) => `<button class="pf-opt ${prefs[k] ? 'on' : ''}" data-act="pref" data-k="${k}" data-v="${prefs[k] ? '' : '1'}">${prefs[k] ? '✓ ' : ''}${l}</button>`;
  return `<div class="pf-wrap" data-act="prefsclose"><div class="pf-sheet" data-act="none">
    <h3>⚙️ Set up my phone</h3>
    <div class="pf-row"><span>Text size</span><div>${opt('size', 'normal', 'Normal')}${opt('size', 'big', 'Big')}${opt('size', 'huge', 'Huge')}</div></div>
    <div class="pf-row"><span>Layout</span><div>${opt('layout', 'simple', '✨ Simple')}${opt('layout', 'full', '🎛️ Everything')}</div><small>Simple shows only what you need. Everything adds reactions & extras.</small></div>
    <div class="pf-row"><span>Buttons on</span><div>${opt('hand', 'right', '👉 Right')}${opt('hand', 'left', '👈 Left')}</div></div>
    <div class="pf-row"><span>Extras</span><div>${tog('tips', '“What\'s next” tips')}${tog('vib', 'Buzz my phone')}${tog('contrast', 'High contrast')}</div></div>
    <button class="btn big" data-act="prefsclose">Done</button>
    <button class="btn navy" data-act="editav" style="margin-top:8px">✏️ Change my avatar</button>
  </div></div>`;
}

// ---------- NOW / NEXT: always tell people what's happening and what's coming ----------
function coachStrip() {
  if (!prefs.tips || !S || !me()) return '';
  const c = nowNext();
  if (!c) return '';
  return `<div class="coach-strip"><div><span class="cs-k">NOW</span>${c.now}</div>${c.next ? `<div class="cs-n"><span class="cs-k nx">NEXT</span>${c.next}</div>` : ''}</div>`;
}
function myPodiumIn(t) {
  // how many questions until I'm at the podium for my team
  if (!t || !t.members.includes(pid)) return null;
  const live = t.members.filter((id) => S.players[id] && S.players[id].connected !== false);
  const cur = upNext(t);
  const i = live.indexOf(cur), mine = live.indexOf(pid);
  if (i < 0 || mine < 0) return null;
  return (mine - i + live.length) % live.length;
}
function nowNext() {
  const s = S, q = s.q, t = myTeam(), m = me();
  const cap = s.setup && s.setup.captain === pid;
  const st = s.setup ? s.setup.step : 'join';
  const steps = { join: 'Join', warmup: 'Warm-up questions', games: 'Vote on the games', beef: 'Settle a beef (optional)', teams: 'Meet your team' };
  const order = ['join', 'warmup', 'games', 'beef', 'teams'].filter((x) => x !== 'warmup' || s.survey);
  if (s.phase === 'lobby') {
    const nx = order[order.indexOf(st) + 1];
    const now = st === 'join' ? (cap ? "You're the <b>Captain</b> 👑 Tap <b>Everybody's In</b> when the family's here" : "You're in! Waiting for everybody to join")
      : st === 'warmup' ? 'Answer <b>3 quick questions</b> below'
      : st === 'games' ? 'Tap your <b>top 3 games</b> in order'
      : st === 'beef' ? 'Call somebody out — or tap <b>🤝 We good</b>' : '';
    return { now, next: nx ? steps[nx] : 'Round 1 starts' };
  }
  if (s.phase === 'teams') return { now: t ? `You're on <b style="color:${t.color}">${esc(t.name)}</b>` : 'Teams are being made', next: s.settings.format === 'party' ? 'The first game' : 'Round 1: The Board' };
  if (m.audience) return { now: "You're in the audience — vote and react!", next: null };
  const pin = t ? myPodiumIn(t) : null;
  const podTxt = pin === 0 ? "<b>You're at the podium</b> for the next question" : pin === 1 ? "You're at the podium <b>after this one</b>" : pin != null ? `You're at the podium in <b>${pin}</b> questions` : null;
  if (s.phase === 'board') {
    const ctrl = teamById(s.controlTeam);
    return { now: s.picker === pid ? '<b>Your pick!</b> Tap a dollar amount' : `${ctrl ? `<b style="color:${ctrl.color}">${esc(ctrl.name)}</b>` : 'A team'} is picking a question`, next: podTxt };
  }
  if (s.phase === 'segment') {
    const seg = s.remix.segments[s.remix.segIdx], nx = s.remix.segments[s.remix.segIdx + 1];
    return { now: `Next game: <b>${esc(seg.label)}</b> — read the TV`, next: nx ? `Then: ${esc(nx.label)}` : 'Then: the final round' };
  }
  if (s.phase === 'question' && q) {
    const onPod = t && q.podium && q.podium[t.id] === pid;
    const N = {
      ready: onPod ? "Tap <b>I'M READY</b>" : `${t && q.podium[t.id] ? esc(pname(q.podium[t.id])) : 'Your teammate'} is at the podium`,
      reading: "Read the question — <b>don't buzz yet</b>", open: onPod ? '<b>BUZZ NOW!</b>' : 'Buzzers are open',
      answering: q.answerer === pid ? '<b>Tap your answer!</b>' : `${esc(pname(q.answerer))} is answering`,
      reveal: 'Answer time — look at the TV', vote: '<b>Vote</b> on your phone', wager: q.answerer === pid ? '<b>Place your wager</b>' : 'Family Wager!',
    };
    const nxt = q.stage === 'reveal' && s.phase === 'question' ? podTxt : podTxt;
    return { now: N[q.stage] || 'Play along on your phone', next: s.round === 1 || q.beef ? nxt : null };
  }
  if (s.phase === 'spin') return { now: 'Sankofa Spin!', next: null };
  if (s.phase === 'round_end') return { now: 'Round over — check the scores', next: s.round === 1 ? 'Round 2: the games you voted for' : 'Final Wager' };
  if (s.phase.startsWith('final')) return { now: 'Final Wager — bet, answer, win', next: 'The winner is crowned' };
  return null;
}

// 👑 Captain controls: the first player in can run the pre-show (and nudge the show on Auto-Host)
function captainBar() {
  if (!S || !S.setup || S.setup.captain !== pid) return '';
  const s = S;
  if (s.phase === 'lobby') {
    const st = s.setup.step;
    const n = Object.values(s.players).filter((p) => !p.audience).length;
    const lbl = { join: "Everybody's In →", warmup: 'Next: Pick Games →', games: 'Next: Settle a Beef →', beef: 'Next: Make Teams →' }[st] || 'Next →';
    return `<div class="cap-bar"><div class="cap-k">👑 CAPTAIN</div><div class="cap-b">${st !== 'join' ? '<button class="btn navy" data-act="cap" data-v="back">←</button>' : ''}<button class="btn big" data-act="cap" data-v="next" ${st === 'join' && n < 2 ? 'disabled' : ''}>${lbl}</button></div>
      ${st === 'join' ? `<div class="cap-set"><span>Show:</span>${[['classic', 'Classic'], ['party', 'Party'], ['trivia', 'Trivia']].map(([k, l]) => `<button class="${(s.settings.format || 'classic') === k ? 'on' : ''}" data-act="capset" data-k="format" data-v="${k}">${l}</button>`).join('')}
        ${s.settings.format === 'party' ? '' : `<span>Length:</span>${[['quick', 'Quick'], ['standard', 'Std'], ['full', 'Full']].map(([k, l]) => `<button class="${(s.settings.boardSize || 'standard') === k ? 'on' : ''}" data-act="capset" data-k="boardSize" data-v="${k}">${l}</button>`).join('')}`}</div>` : ''}</div>`;
  }
  if (s.phase === 'teams') return `<div class="cap-bar"><div class="cap-k">👑 CAPTAIN</div><div class="cap-b"><button class="btn navy" data-act="cap" data-v="back">←</button><button class="btn big green" data-act="cap" data-v="next">🎬 Start the Show</button></div></div>`;
  if (s.settings.autoHost && ['segment', 'round_end', 'final_intro'].includes(s.phase) || (s.settings.autoHost && s.q && s.q.stage === 'reveal')) {
    return `<div class="cap-bar mini"><span class="cap-k">👑</span><button class="btn navy" data-act="cap" data-v="next">⏭ Keep it moving</button></div>`;
  }
  return '';
}

// ---------- the pre-show on the phone: one job per screen ----------
function lobbyBody() {
  const s = S, m = me(), g = GENERATIONS[m.gen] || GENERATIONS.millennial;
  const st = s.setup ? s.setup.step : 'join';
  if (m.audience) return `<div class="av-preview">${renderAvatar(m.avatar, 'cheer', 140)}</div><h2>You're in the audience 👀</h2><div class="msg">React, play along and vote. Watch the TV!</div>`;
  if (st === 'warmup' && s.survey) {
    const sv = s.survey, n = sv.answered[pid] || 0;
    if (n >= sv.prompts.length) return `<div class="big-emoji">✅</div><h2>Warm-up done!</h2><div class="msg">Your answers are secret. They'll show up later in <b>The Family Survey</b> game.</div><div class="sub">Waiting for everybody else…</div>`;
    return `<div class="step-pill">WARM-UP · QUESTION ${n + 1} OF ${sv.prompts.length}</div>
      <div class="warm-q">${esc(sv.prompts[n])}</div>
      <input id="sv-in" class="ph-text big" maxlength="40" autocomplete="off" placeholder="First thing that comes to mind">
      <button class="btn big green" data-act="svsend" data-i="${n}">${n + 1 < sv.prompts.length ? 'Next →' : 'Done ✓'}</button>
      <div class="sub">No wrong answers. These become a game later — so be honest!</div>`;
  }
  if (st === 'games') {
    const opts = (s.vote && s.vote.options) || Object.keys(GAME_CARDS);
    const mine = local.gv || (s.vote && s.vote.picks && s.vote.picks[pid]) || [];
    return `<div class="step-pill">PICK THE GAMES · ${mine.length}/3</div>
      <div class="msg">Tap your <b>top 3</b> in order.<br><small>1st tap = your #1. Tap again to undo.</small></div>
      <div class="gv-list">${opts.map((k) => { const c = GAME_CARDS[k] || [k, '🎲']; const r = mine.indexOf(k); return `<button class="gv-card ${r >= 0 ? 'on' : ''}" data-act="gvpick" data-v="${k}"><span class="gv-e">${c[1]}</span><span class="gv-tx"><b>${esc(c[0])}</b><small>${esc(GAME_PITCH[k] || '')}</small></span><span class="gv-rank">${r >= 0 ? r + 1 : ''}</span></button>`; }).join('')}</div>
      ${mine.length >= 3 ? '<div class="result good">Votes in! ✅ Watch the TV.</div>' : ''}`;
  }
  if (st === 'beef') {
    const B = s.beefs || [];
    const incoming = B.filter((b) => b.to === pid && b.status === 'pending');
    if (incoming.length) {
      const b = incoming[0];
      return `<div class="big-emoji">🥊</div><h2>${esc(pname(b.from))} called you out!</h2><div class="warm-q">“${esc(b.topic)}”</div>
        <div class="msg">Accept and you'll go head-to-head on stage — on opposite teams.</div>
        <div class="pt-row"><button class="opt pt-big pt-agree" data-act="beefreply" data-v="1">🥊 It's on!</button><button class="opt pt-big" data-act="beefreply" data-v="">🙅🏾 Not today</button></div>`;
    }
    const sent = B.find((b) => b.from === pid && b.status !== 'no');
    const mineIn = B.filter((b) => (b.from === pid || b.to === pid) && b.status === 'on');
    if (sent || (s.setup.beefDone || {})[pid]) {
      return `<div class="big-emoji">${mineIn.length ? '🥊' : '🤝'}</div><h2>${mineIn.length ? "It's ON!" : sent ? 'Beef sent!' : 'We good!'}</h2>
        ${mineIn.map((b) => `<div class="msg">You vs <b>${esc(pname(b.from === pid ? b.to : b.from))}</b><br><small>“${esc(b.topic)}”</small></div>`).join('')}
        ${sent && sent.status === 'pending' ? `<div class="msg">Waiting for <b>${esc(pname(sent.to))}</b> to answer…</div>` : ''}<div class="sub">Watch the TV.</div>`;
    }
    const others = Object.values(s.players).filter((p) => p.pid !== pid && !p.audience);
    return `<div class="step-pill">SETTLE A BEEF · OPTIONAL</div>
      <div class="msg">Got beef with somebody? <b>Call them out.</b> If they accept, y'all go head-to-head during the show.</div>
      <div class="sub">1. Who?</div>
      <div class="bf-pick">${others.map((p) => `<button class="${local.beefTo === p.pid ? 'on' : ''}" data-act="beefto" data-v="${p.pid}">${renderAvatar(p.avatar, 'idle', 48)}<span>${esc(p.name)}</span></button>`).join('')}</div>
      <div class="sub">2. What's the beef?</div>
      <div class="bf-topics">${BEEF_TOPICS.map((tp) => `<button class="${local.beefTopic === tp ? 'on' : ''}" data-act="beeftopic" data-v="${esc(tp)}">${esc(tp)}</button>`).join('')}</div>
      <button class="btn big red" data-act="beefsend" ${local.beefTo && local.beefTopic ? '' : 'disabled'}>🥊 Call them out!</button>
      <button class="btn big green" data-act="nobeef">🤝 No beef — we good</button>`;
  }
  // join
  return `<div class="av-preview">${renderAvatar(m.avatar, 'cheer', 140)}</div>
    <h2>You're in!</h2><div class="msg">${g.icon} ${g.label} <span class="sub">(${g.nick})</span></div>
    <div class="how-box"><b>Here's what happens:</b><ol><li>3 quick warm-up questions</li><li>Vote on the games</li><li>Settle a beef (optional)</li><li>Teams → showtime!</li></ol></div>
    ${prefs.layout === 'full' ? `<div class="away-card"><b>📍 Not near the TV?</b> You can play the whole game from this phone. <a href="host.html?watch=${esc(room)}${T.mode === 'demo' ? '&demo' : ''}" target="_blank" rel="noopener">Watch the big screen here</a>.</div>
    <a class="away-card" style="display:block;text-decoration:none;color:inherit" href="cookout.html" target="_blank" rel="noopener"><b>🍗 Waiting?</b> Play <u>Invited to the Cookout</u> in a new tab.</a>` : ''}
    <button class="btn navy" data-act="prefs">⚙️ Set up my phone</button>`;
}

function body() {
  const s = S, t = myTeam(), m = me();
  const g = GENERATIONS[m.gen] || GENERATIONS.millennial;
  switch (s.phase) {
    case 'lobby': return lobbyBody();
    case 'teams':
      return t ? `<div class="team-banner" style="background:${t.color}">You're on<br><span style="font-size:24px">${esc(t.name)}</span></div>
        <div class="sub">Teammates: ${t.members.map((id) => esc(pname(id))).join(', ')}</div>
        ${(s.settings.lineup || []).length ? `<div class="how-box"><b>Tonight's lineup</b><ol>${s.settings.format === 'party' ? '' : '<li>The Board</li>'}${s.settings.lineup.map((k) => `<li>${esc((GAME_CARDS[k] || [k])[0])}</li>`).join('')}${s.settings.format === 'party' ? '' : '<li>Final Wager</li>'}</ol></div>` : ''}` : `<div class="msg">${m.audience ? '👀 Audience seat secured!' : 'Waiting for teams…'}</div>`;
    case 'board': {
      const ctrl = teamById(s.controlTeam);
      const up = t ? upNext(t) : null;
      const mine = t && ctrl && t.id === ctrl.id;
      const iPick = s.picker === pid;
      const pickHead = iPick ? `<div class="pick-me"><div class="pm-k">👉 YOUR PICK!</div><div class="pm-s">Tap a dollar amount below. Bigger = harder.</div></div>`
        : mine ? `<div class="msg"><b style="color:var(--gold)">Your team picks!</b> ${s.picker ? esc(pname(s.picker)) + ' is choosing — help them out (anyone on your team can tap).' : 'Tap a tile 👇🏾'}</div>`
        : `<div class="msg">${ctrl ? `<b style="color:${ctrl.color}">${esc(ctrl.name)}</b> is picking${s.picker ? ` (${esc(pname(s.picker))})` : ''}…` : 'Eyes on the board!'}</div>`;
      return `${scoreStrip()}${pickHead}
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
      return `<div class="step-pill">NEXT GAME · ${s.remix.segIdx + 1} OF ${s.remix.segments.length}</div><h2>${seg.type === 'beef' ? '🥊 ' : ''}${esc(seg.label)}</h2><div class="how-box">${esc(seg.blurb)}</div><div class="sub">👀 Watch the TV — it starts in a moment.</div>`;
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
      const mine = [aw.mvp && aw.mvp.pid === pid ? '⭐ MVP' : '', aw.crossover && aw.crossover.pid === pid ? '🌉 Bridge Builder' : '', aw.thief && aw.thief.pid === pid ? '🦹🏾 Master Thief' : '', aw.closer && aw.closer.pid === pid ? '🎤 The Closer' : '', aw.clown && aw.clown.pid === pid ? '😂 Family Comedian' : '', aw.liar && aw.liar.pid === pid ? '🤥 Smooth Liar' : '', aw.legend && aw.legend.pid === pid ? '👑 Most Likely Legend' : '', aw.singer && aw.singer.pid === pid ? '🎤 Songbird' : ''].filter(Boolean);
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
    ${[...Array(Math.max(...cats.map((c) => (c.tiles || []).length))).keys()].map((r) => cats.map((c, ci) => { const tl = (c.tiles || [])[r]; return !tl || tl.used ? '<span class="pb-used"></span>' : canPick ? `<button class="pb-tile" data-act="pickboard" data-ci="${ci}" data-ti="${r}">${tl.value}</button>` : `<span class="pb-tile">${tl.value}</span>`; }).join('')).join('')}</div>`;
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
  if (['hot_take', 'most_likely', 'top_that', 'two_truths', 'sing_it'].includes(q.type)) return partyBody(q, t);

  // trivia / hashtag / era
  if (q.stage === 'wager') {
    if (q.answerer === pid && !local.wagered) return `<div class="big-emoji">💰</div><h2>Family Wager!</h2><div class="msg">Category: ${esc(q.category)}</div>${wagerUI(q.maxWager, 5, 'wager', `Wager $5 – ${money(q.maxWager)}`)}${timerBar(q.timerEnd, q.timerTotal)}`;
    return `<div class="big-emoji">💰</div><h2>Family Wager!</h2><div class="msg">${esc(pname(q.answerer))} is placing a wager…</div>`;
  }
  if (q.stage === 'ready') {
    const card = `<div class="rd-ph"><div class="rd-v">${money(q.value)}</div><div class="rd-c">${esc(q.category)}</div></div>`;
    if (onPodium) {
      if (q.ready && q.ready[pid]) return `${card}<div class="result good">YOU'RE READY ✓</div><div class="msg">Here comes the question… <b>wait for BUZZ!</b></div>`;
      return `${card}<h2 style="text-align:center">You're at the podium!</h2>
        <ol class="rd-steps"><li>Read the question</li><li>Wait for <b>BUZZ!</b> (too early = locked out)</li><li>Buzz first, then tap your answer</li></ol>
        <button class="buzzer live ready-btn" data-act="ready">I'M READY</button>${timerBar(q.timerEnd, q.timerTotal)}`;
    }
    const myPod = t && q.podium[t.id];
    return `${card}<div class="msg">${myPod ? `<b>${esc(pname(myPod))}</b> is at the podium for your team.` : 'Next question coming up!'}</div>
      <div class="sub">${S.settings.playAlong ? '🤫 You can answer secretly too, for bonus points.' : 'Cheer them on!'}</div>`;
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
    return `${qBox(q)}<div class="buzz-say ${q.stage === 'open' ? 'go' : ''}">${q.steal ? (q.stage === 'open' ? '🔔 STEAL — BUZZ NOW!' : 'STEAL CHANCE — wait for it…') : q.stage === 'open' ? '🔔 BUZZ NOW!' : "✋ Read first — DON'T buzz yet"}</div>
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
  if (q.type === 'sing_it') {
    const si = q.si, active = si.alive.length ? si.alive[si.turn % si.alive.length] : null;
    const mineUp = t && active === t.id, out = t && !si.alive.includes(t.id);
    const word = `<div class="sub" style="text-align:center">Sing a song with the word…</div><div class="ph-word">${esc(si.word)}</div>`;
    const scores = `<div class="ph-scores">${si.order.map((id) => `<div style="--tc:${teamById(id)?.color}${si.alive.includes(id) ? '' : ';opacity:.4'}"><span>${esc(teamById(id)?.name || '')}</span><b>${si.counts[id] || 0}🎵</b></div>`).join('')}</div>`;
    if (q.stage === 'reveal') {
      const won = t && (si.winner || []).includes(t.id);
      return `<div class="result ${won ? 'good' : 'bad'}">${won ? 'LAST ONES SINGING! 👑' : 'Good singing!'}</div>${word}${teamPts(q, t)}${scores}`;
    }
    if (out) return `${word}<div class="big-emoji">😭</div><h2>Your team is out!</h2><div class="msg">Cheer on the rest — and judge them HARD.</div>${scores}`;
    if (mineUp && q.stage === 'si_turn') {
      if (S.settings.autoHost) return `${word}<div class="ph-mic">🎤</div><h2 style="text-align:center">SING IT NOW!</h2><div class="msg">Sing a line out loud, then type the song title. Auto-Host counts it if it's not a repeat. (Honor system!)</div>
        <input id="si-in" class="ph-text" maxlength="60" autocomplete="off" placeholder="Song title"><button class="btn big" data-act="sisong">🎤 We sang it!</button>${timerBar(q.timerEnd, q.timerTotal)}${scores}`;
      return `${word}<div class="ph-mic">🎤</div><h2 style="text-align:center">SING IT NOW!</h2><div class="msg">Sing at least a line out loud — the host decides if it counts. No repeats!</div>
        <input id="si-in" class="ph-text" maxlength="60" autocomplete="off" placeholder="Song title (optional, shows on TV)"><button class="btn navy" data-act="sisong">Show the title on TV</button>${timerBar(q.timerEnd, q.timerTotal)}${scores}`;
    }
    if (mineUp) return `${word}<div class="big-emoji">⏳</div><h2>YOU'RE UP NEXT!</h2><div class="msg">Huddle up — find a song with <b>${esc(si.word)}</b> in it!</div>${scores}`;
    return `${word}<div class="big-emoji">👂🏾</div><div class="msg"><b>${esc(teamById(active)?.name || '')}</b> ${q.stage === 'si_turn' ? 'is singing…' : 'is up next…'}</div><div class="sub">Get your next song ready!</div>${scores}`;
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
  const hum = q.mode === 'hum';
  if (q.stage === 'ch_ready' && hum) return actor ? `<div class="big-emoji">🎵</div><h2>You're humming!</h2><div class="msg">HUM ONLY — no words, no lyrics, no "la la la" with the words in it. When the host starts the clock, your song appears here.</div>` : `<div class="big-emoji">🎵</div><div class="msg"><b>${esc(pname(ch.actor))}</b> is about to hum${t && t.id === tid ? ' for YOUR team — shout the song title!' : '.'}</div>`;
  if (q.stage === 'ch_ready') return actor ? `<div class="big-emoji">🎭</div><h2>You're acting!</h2><div class="msg">No talking, no spelling, no pointing at stuff in the room. When the host starts the clock, your clue appears here.</div>` : `<div class="big-emoji">🎭</div><div class="msg"><b>${esc(pname(ch.actor))}</b> is about to act${t && t.id === tid ? ' for YOUR team — get ready to shout!' : '.'}</div>`;
  if (q.stage === 'ch_act') {
    if (actor) return `<div class="sub">${hum ? 'HUM it! 🎶 No words!' : 'Act it out!'}</div><div class="ch-word">${esc(ch.word || '')}</div>
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
    case 'bigtext': bigText = !bigText; localStorage.setItem('gen-bigtext', bigText ? '1' : '0'); document.body.classList.toggle('bigtext', bigText); cache.delete(app()); draw(); break;
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
    case 'editav': local.prefsOpen = false; editingAvatar = true; draw(); break;
    case 'join':
      if (editingAvatar) {
        editingAvatar = false;
        saveProfile();
        send({ type: 'avatar', avatar: profile.avatar });
        draw(); break;
      }
      await connect(room); sendJoin(); draw(); break;
    case 'ready': vib(40); send({ type: 'ready' }); break;
    case 'buzz':
      if (local.buzzed) return;
      el.classList.add('hit'); vib(80);
      send({ type: 'buzz', t: T.serverNow() });
      if (S.q.stage === 'open') { local.buzzed = true; draw(); }
      break;
    case 'answer': if (local.answer) return; local.answer = v; vib(40); send({ type: 'answer', choice: v }); draw(); break;
    case 'lifeline': send({ type: 'lifeline' }); break;
    case 'spin': vib([40, 30, 80]); send({ type: 'spin' }); break;
    case 'prefs': local.prefsOpen = true; draw(); break;
    case 'prefsclose': if (e.target.closest('.pf-sheet') && el.dataset.act !== 'prefsclose') break; local.prefsOpen = false; draw(); break;
    case 'pref': prefs[el.dataset.k] = el.dataset.v === '' ? false : el.dataset.v === '1' ? true : el.dataset.v; savePrefs(); cache.delete(app()); draw(); break;
    case 'cap': send({ type: 'captain', action: el.dataset.v }); vib(30); break;
    case 'capset': send({ type: 'captain', action: 'set', k: el.dataset.k, v: el.dataset.v }); break;
    case 'gvpick': {
      const cur = (local.gv || (S.vote && S.vote.picks && S.vote.picks[pid]) || []).slice();
      const k = el.dataset.v, i = cur.indexOf(k);
      if (i >= 0) cur.splice(i, 1); else if (cur.length < 3) cur.push(k); else return toast('You already picked 3 — tap one to undo');
      local.gv = cur; send({ type: 'gamevote', list: cur }); vib(20); draw(); break;
    }
    case 'beefto': local.beefTo = el.dataset.v; draw(); break;
    case 'beeftopic': local.beefTopic = el.dataset.v; draw(); break;
    case 'beefsend': if (local.beefTo && local.beefTopic) { send({ type: 'beef', to: local.beefTo, topic: local.beefTopic }); vib([40, 30, 80]); } break;
    case 'nobeef': send({ type: 'nobeef' }); break;
    case 'beefreply': send({ type: 'beefreply', id: (S.beefs || []).find((b) => b.to === pid && b.status === 'pending')?.id, yes: !!el.dataset.v }); vib(60); break;
    case 'svsend': {
      const txt = ($('#sv-in').value || '').trim();
      if (!txt) return toast('Type something first');
      send({ type: 'survey', i: +el.dataset.i, text: txt }); $('#sv-in').value = ''; vib(30); break;
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
    case 'sisong': { const txt = ($('#si-in').value || '').trim(); if (!txt) return toast('Type the song title first'); vib(20); send({ type: 'party', text: txt }); toast('🎵 On the big screen!'); break; }
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
