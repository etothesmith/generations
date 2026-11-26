// ============================================================
// GENERATIONS — Host / big-screen view
// ============================================================
import { createTransport } from './transport.js';
import { Engine, DEFAULT_CATS, CAT_ICONS, REMIX_PLAN, TIMES, BLITZ, WHEEL, SPIN, PARTY, PARTY_TYPES, SHOW_FORMATS } from './engine.js';
import { GENERATIONS, roomCode, esc, money, $, $$, LETTERS } from './util.js';
import { renderAvatar } from './avatar.js';
import { loadArt, ART, iconHTML, badgeHTML } from './assets.js';
import { sfx, unlockAudio, soundOn, setSound } from './audio.js';
import { strikeFx } from './fx.js';
import { confetti, stamp, banner, shockwave, shake, reaction, mountCrowd, crowdReact, showOpen, roundCard, mountMascot, mascotSay, mascotUnpin, setConfettiTheme } from './fx.js';
import qrcode from '../vendor/qrcode.mjs';
import { openEditor, loadCustom } from './editor.js';
import { CallManager, VideoWall, playVoice } from './social.js';
import { normalize } from './normalize.js';

const WATCH = (new URLSearchParams(location.search).get('watch') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
// TV social layer: family chat feed, voice notes, and the video wall
const tvs = { feed: true, voices: true, call: null, wall: null, seen: new Set(), q: [] };

let T, E, S;              // transport, engine, latest state
const exprOverride = {};  // pid -> { expr, until }
let scoreEdit = false;
let lobbyOpen = false;   // lobby settings panel expanded
let lastLow = null, lastHuddle = null, lastTickSec = null, lastBlitz = null, lastSeg = null;
const prevScores = {};

const ui = {};
const cache = new WeakMap();
const seenAnim = new Set();
function setHTML(el, html) {
  if (!el) return;
  if (cache.get(el) === html) return;
  cache.set(el, html);
  el.innerHTML = html;
  // entrance animations play once per thing, not on every re-render
  el.querySelectorAll('[data-k]').forEach((n) => {
    if (seenAnim.has(n.dataset.k)) n.style.animation = 'none';
    else seenAnim.add(n.dataset.k);
  });
}

// ---------------- boot ----------------
async function boot() {
  document.body.innerHTML = `
    <div class="stage-bg" id="bg"><div class="floor"></div></div>
    <div class="host" id="host">
      <div><div class="topbar" id="top"></div><div class="kente-strip"></div></div>
      <div class="main" id="main"></div>
      <div class="scorestrip" id="scores"></div>
      <div class="controls" id="controls"></div>
    </div>`;
  ui.top = $('#top'); ui.main = $('#main'); ui.scores = $('#scores'); ui.controls = $('#controls'); ui.bg = $('#bg');
  document.body.insertAdjacentHTML('beforeend', '<div class="tv-chat" id="tvchat" aria-live="polite"></div><div class="vw tv-vw" id="tvvw"></div>');
  if (WATCH) return bootWatch();

  const [art, bank] = await Promise.all([loadArt(), loadBank(), loadExtras()]);
  if (art.stage) { ui.bg.style.backgroundImage = `url(${art.stage})`; ui.bg.classList.add('has-art'); }
  mountCrowd(ui.bg);
  mountMascot(document.body);

  T = await createTransport();
  if (T.mode === 'demo') {
    const f = document.createElement('div'); f.className = 'demo-flag';
    f.textContent = 'LOCAL DEMO MODE — players must use this same browser. Add Firebase keys in js/config.js to use phones.';
    document.body.appendChild(f);
  }
  // Refreshed the host tab mid-game? Pick up right where we left off.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('gen-host-save') || 'null'); } catch (e) { saved = null; }
  if (saved && (Date.now() - saved.at > 6 * 3600e3 || !saved.s || !saved.s.code)) saved = null;
  let code = null;
  if (saved) {
    code = saved.s.code;
    try { await T.createRoom(code); } catch (e) { saved = null; }
  }
  if (!saved) {
    code = roomCode();
    for (let i = 0; i < 5 && await T.roomExists(code); i++) code = roomCode();
    await T.createRoom(code);
  }

  E = new Engine(T, bank, { onChange: render, onFx, extras: EXTRAS });
  // secret key for the phone Host Remote (survives a refresh of this tab)
  let hk = sessionStorage.getItem('gen-host-key');
  if (!hk) { hk = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20); sessionStorage.setItem('gen-host-key', hk); }
  E.setHostKey(hk);
  if (saved) E.restore(saved);
  E.s.code = code;
  E.s.mode = T.mode;
  T.onInput((m) => E.handleInput(m));
  T.onPresence((map) => E.setPresence(map));
  E.publish();
  wireTvSocial('tv-' + code, '📺 The House');
  window.GEN = { engine: E, transport: T }; // handy for debugging in the browser console

  document.addEventListener('click', delegate);
  document.addEventListener('focusout', onRename);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('h3[data-team]')) { e.preventDefault(); e.target.blur(); } }, true);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  requestAnimationFrame(frame);
}

let EXTRAS = { survey: [], charades: [] };
async function loadExtras() {
  try { EXTRAS = await (await fetch('data/extras.json', { cache: 'no-cache' })).json(); } catch (e) { /* optional */ }
  return EXTRAS;
}
export async function loadBank() {
  let base = [];
  try { base = await (await fetch('data/questions.json', { cache: 'no-cache' })).json(); }
  catch (e) { alert('Could not load data/questions.json. Open the game through a web server (see README).'); }
  return base.concat(loadCustom());
}

// ---------------- remote "watch" screen: the live show anywhere (no engine) ----------------
async function bootWatch() {
  document.body.classList.add('watch');
  const [art] = await Promise.all([loadArt(), loadExtras()]);
  if (art.stage) { ui.bg.style.backgroundImage = `url(${art.stage})`; ui.bg.classList.add('has-art'); }
  mountCrowd(ui.bg);
  mountMascot(document.body);
  T = await createTransport();
  if (!(await T.roomExists(WATCH))) { ui.main.innerHTML = `<div class="segment"><h1>Room ${esc(WATCH)} not found</h1><p>Check the 4-letter code on the big screen.</p></div>`; return; }
  await T.watchRoom(WATCH);
  // a tiny stand-in for the engine so the TV views can render from the published state
  E = { s: {}, cur: null, pausedAt: 0, hostKey: null, availableCategories: () => [], freshness: () => ({ unseen: 0, total: 0 }) };
  let lastFxId = null;
  T.onState((raw) => {
    const st = normalize(raw);
    E.s = st;
    if (st.paused && !E.pausedAt) E.pausedAt = T.serverNow(); if (!st.paused) E.pausedAt = 0;
    const fxNew = st.fx && st.fx.id !== lastFxId && lastFxId !== null;
    if (st.fx) { if (fxNew) onFx(st.fx.type, st.fx.data || {}); lastFxId = st.fx.id; } else if (lastFxId === null) lastFxId = '';
    render(st);
  });
  window.GEN = { engine: E, transport: T, watch: true };
  wireTvSocial('watch-' + Math.random().toString(36).slice(2, 8), '🏠 ' + (localStorage.getItem('gen-watch-name') || 'Watch party'));
  document.addEventListener('click', delegate);
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  requestAnimationFrame(frame);
}
function viewWatchLobby(s) {
  const players = Object.values(s.players || {}).sort((a, b) => a.joinedAt - b.joinedAt);
  const url = joinUrl(s.code);
  return `<div class="lobby">
    <div class="join-card"><div class="lbl">Join from your phone</div><div class="code">${s.code}</div><div class="qr">${qrSvg(url)}</div><div class="url">${esc(url)}</div></div>
    <div class="lobby-right">
      ${ART.logo ? `<div class="logo huge"><img src="${ART.logo}" alt="GENERATIONS"></div>` : `<div class="logo huge">GENERATIONS</div>`}
      <div class="tagline">📍 Watching the live show from away</div>
      <div class="player-grid">${players.length ? players.map((p) => playerCard(p)).join('') : `<div class="empty-note">${ART.family ? `<img class="family-hero" src="${ART.family}" alt="">` : ''}Waiting for the family to join…</div>`}</div>
      <div class="hint">Scan the code to play on your phone. Use 📹 below to video chat with the house.</div>
    </div></div>`;
}

// ---------------- TV social: chat feed, voice notes, video wall ----------------
function wireTvSocial(myPid, myName) {
  if (!T.onChat) return;
  tvs.wall = new VideoWall($('#tvvw'));
  tvs.call = new CallManager(T, { pid: myPid, name: myName, where: WATCH ? 'away' : '' }, { onChange: () => { tvs.wall.update(tvs.call.tiles()); document.body.classList.toggle('tv-call', tvs.wall.tiles.size > 0); if (S) renderControls(S); } });
  const startAt = Date.now();
  T.onChat((m, old) => {
    if (!m || tvs.seen.has(m.id)) return;
    tvs.seen.add(m.id);
    const fresh = !old && (m.at || 0) > startAt - 15000;
    if (fresh) showChatBubble(m);
  });
}
function showChatBubble(m) {
  const feed = $('#tvchat'); if (!feed) return;
  const el = document.createElement('div');
  el.className = 'tvc-msg' + (m.kind === 'voice' ? ' voice' : '');
  const who = `<b style="color:${m.color || 'var(--gold)'}">${esc(m.name || 'Family')}</b>${m.where ? ` <small>${esc(m.where)}</small>` : ''}`;
  el.innerHTML = m.kind === 'voice' ? `${who}<span class="tvc-v">🎤 voice note · ${Math.round(m.dur || 0)}s <span class="tvc-bars"><i></i><i></i><i></i><i></i></span></span>` : `${who}<span>${esc(m.text || '')}</span>`;
  feed.appendChild(el);
  while (feed.children.length > 5) feed.firstChild.remove();
  sfx('join');
  const life = m.kind === 'voice' ? Math.max(9000, (m.dur || 5) * 1000 + 4000) : 12000;
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, life);
  if (m.kind === 'voice' && m.audio && tvs.voices && soundOn()) {
    tvs.q.push({ m, el });
    if (tvs.q.length === 1) playNextVoice();
  }
}
function playNextVoice() {
  const item = tvs.q[0]; if (!item) return;
  item.el.classList.add('playing');
  playVoice(item.m.audio, () => { item.el.classList.remove('playing'); tvs.q.shift(); setTimeout(playNextVoice, 400); });
}
function showCallModal() {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="box" style="text-align:center;max-width:560px">
    <h2>📹 Video call with the family</h2>
    <p class="note">Family playing from somewhere else can join from their phone (💬 → Join video call). Their faces show up on this screen.</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
      <button class="btn green" data-act="tvcalljoin" data-v="cam">📷 Use this computer's camera &amp; mic</button>
      <button class="btn navy" data-act="tvcalljoin" data-v="watch">👀 Just show their video here</button>
      <button class="btn ghost" data-act="modalclose">Cancel</button>
    </div></div>`;
  document.body.appendChild(wrap);
}
async function tvCallJoin(mode, el) {
  el.closest('.modal')?.remove();
  try { await tvs.call.join({ video: true, audio: true, send: mode === 'cam' }); }
  catch (e) { await tvs.call.join({ send: false }); alert('No camera/microphone allowed — showing family video only.'); }
}

// ---------------- render ----------------
let appliedTheme = null;
function partyMoment(s) {
  if (s.settings && s.settings.format === 'party' && s.phase !== 'lobby' && s.phase !== 'teams') return true;
  if (s.phase === 'question' && s.q && PARTY_TYPES.includes(s.q.type)) return true;
  if (s.phase === 'segment' && s.remix) { const seg = s.remix.segments[s.remix.segIdx]; return !!(seg && seg.party); }
  return false;
}
function applyTheme(s) {
  const t = (s.settings && s.settings.theme) || 'classic';
  const party = !!ART.partyStage && partyMoment(s);
  const key = t + (party ? ':party' : '');
  if (key === appliedTheme) return;
  appliedTheme = key;
  document.body.classList.toggle('party-night', party);
  const url = party ? ART.partyStage : t !== 'classic' && ART.themes[t] ? ART.themes[t] : ART.stage;
  ui.bg.style.backgroundImage = url ? `url(${url})` : '';
  ui.bg.classList.toggle('has-art', !!url);
  setConfettiTheme(t);
}
function render(s) {
  S = s;
  applyTheme(s);
  renderTop(s);
  renderMain(s);
  renderScores(s);
  renderControls(s);
}

function roundName(s) {
  if (s.phase === 'lobby' || s.phase === 'teams') return ['Lobby', 'Grab your phones!'];
  if (s.phase === 'champion') return ['Champions', 'Game over'];
  if (s.round === 1) return ['Round 1', 'The Generations Board'];
  if (s.round === 2) return s.settings && s.settings.format === 'party' ? ['Party Night', 'Laughs · Arguments · Receipts'] : ['Round 2', 'For the Culture Remix'];
  return ['Round 3', 'The Final Wager'];
}
function renderTop(s) {
  const [a, b] = roundName(s);
  const logo = ART.logo ? `<div class="logo small" style="height:5vh"><img src="${ART.logo}" alt="GENERATIONS"></div>` : `<div class="logo small">GENERATIONS</div>`;
  setHTML(ui.top, `${logo}<div class="round-label">${a}<small>${b}</small></div><div class="room-pill">Room <b>${s.code}</b></div>`);
}

function joinUrl(code) {
  const base = location.href.replace(/[^/]*$/, '');
  return `${base}play.html?room=${code}${T && T.mode === 'demo' && /[?&]demo\b/.test(location.search) ? '&demo' : ''}`;
}
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
}

function playerCard(p, opts = {}) {
  if (p.remote && !opts.noAway) opts = { ...opts, away: true };
  const g = GENERATIONS[p.gen] || GENERATIONS.millennial;
  return `<div class="pcard ${p.connected ? '' : 'off'}" data-k="p-${S ? S.phase : ''}-${p.pid}" data-act="${opts.act || ''}" data-pid="${p.pid}">
    <div class="av">${renderAvatar(p.avatar, 'idle', 120)}</div>
    <div class="nm">${esc(p.name)}${opts.away ? ' <span class="away-tag" title="Playing from somewhere else">🏠</span>' : ''}</div>
    <span class="gen-chip" style="background:${g.color};color:${p.gen === 'genx' || p.gen === 'millennial' ? '#fff' : '#2B2B2B'}">${badgeHTML(p.gen) || g.icon} ${g.label}</span>
    ${opts.kick ? `<button class="x" data-act="kick" data-pid="${p.pid}" title="Remove">✕</button>` : ''}
  </div>`;
}

function renderMain(s) {
  if (WATCH && s.phase === 'lobby') return setHTML(ui.main, viewWatchLobby(s));
  const fn = { spin: viewSpin, lobby: viewLobby, teams: viewTeams, board: viewBoard, question: viewQuestion, segment: viewSegment, round_end: viewRoundEnd, final_intro: viewFinal, final_wager: viewFinal, final_answer: viewFinal, final_reveal: viewFinal, champion: viewChampion }[s.phase];
  setHTML(ui.main, fn ? fn(s) : '');
}

function viewLobby(s) {
  const players = Object.values(s.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const url = joinUrl(s.code);
  const cats = E.availableCategories();
  const catBtns = cats.map((c) => `<button class="cat-toggle ${s.categories.includes(c) ? 'on' : ''}" data-act="cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  return `<div class="lobby">
    <div class="join-card">
      <div class="lbl">Scan to join or go to the link</div>
      <div class="code">${s.code}</div>
      <div class="qr">${qrSvg(url)}</div>
      <div class="url">${esc(url)}</div>
    </div>
    <div class="lobby-right">
      ${ART.logo ? `<div class="logo huge"><img src="${ART.logo}" alt="GENERATIONS"></div>` : `<div class="logo huge">GENERATIONS</div>`}
      <div class="tagline">The Family Game Show · Culture · History · Generations</div>
      ${(() => { const f = E.freshness(); const low = f.unseen < f.total * 0.25; return `<div class="hint fresh-meter" style="margin:0">🆕 <b style="color:var(--gold)">${f.unseen}</b> of ${f.total} questions this TV hasn't played yet${low ? ` · <button class="cat-toggle" data-act="resetseen">Start fresh</button>` : ''}</div>`; })()}
      ${s.survey ? `<div class="hint" style="margin:0">📋 Family Survey answered on phones: <b style="color:var(--gold)">${Object.values(s.survey.answered || {}).filter((n) => n >= s.survey.prompts.length).length}/${players.length}</b> done · used in Round 2${players.some((p) => p.audience) ? ` · 👀 Audience: ${players.filter((p) => p.audience).map((p) => esc(p.name)).join(', ')}` : ''}</div>` : ''}
      <div class="player-grid ${players.length ? "" : "empty"}">${players.length ? players.map((p) => playerCard(p, { kick: true })).join('') : `<div class="empty-note">${ART.family ? `<img class="family-hero" src="${ART.family}" alt="">` : ''}Waiting for the family to join…<br>Everybody scan the code with your phone 📱</div>`}</div>
      <div class="settings ${lobbyOpen ? 'open' : ''}">
        <div class="grp always set-summary"><span>Show</span>
          ${Object.entries(SHOW_FORMATS).map(([k, f]) => `<button data-act="set" data-k="format" data-v="${k}" title="${esc(f.blurb)}" class="seg-btn ${(s.settings.format || 'classic') === k ? 'on' : ''}">${f.label}</button>`).join('')}
          <button class="cat-toggle cust" data-act="lobbyopen">${lobbyOpen ? '✓ Done' : '⚙️ Customize the show'}</button>
        </div>
        <div class="grp"><span>Teams</span>
          <div class="seg">
            <button data-act="mode" data-mode="gen" class="${s.teamMode === 'gen' ? 'on' : ''}">By Generation</button>
            <button data-act="mode" data-mode="random" data-n="2" class="${s.teamMode === 'random' && s.teamCount === 2 ? 'on' : ''}">Random ×2</button>
            <button data-act="mode" data-mode="random" data-n="3" class="${s.teamMode === 'random' && s.teamCount === 3 ? 'on' : ''}">×3</button>
            <button data-act="mode" data-mode="random" data-n="4" class="${s.teamMode === 'random' && s.teamCount === 4 ? 'on' : ''}">×4</button>
          </div>
        </div>
        <div class="grp"><span>Answer time</span><div class="seg">
            ${[['quick', 'Quick 10s'], ['relaxed', 'Relaxed 15s'], ['family', 'Grandma-Friendly 20s']].map(([k, l]) => `<button data-act="set" data-k="answerTime" data-v="${k}" class="${s.settings.answerTime === k ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        ${Object.keys(ART.themes).length ? `<div class="grp"><span>Theme</span><div class="seg">
            ${[['classic', 'Classic'], ['juneteenth', 'Juneteenth'], ['christmas', 'Christmas'], ['reunion', 'Family Reunion']].filter(([k]) => k === 'classic' || ART.themes[k]).map(([k, l]) => `<button data-act="set" data-k="theme" data-v="${k}" class="${(s.settings.theme || 'classic') === k ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>` : ''}
        <div class="grp"><span>Bench</span><div class="seg"><button data-act="set" data-k="playAlong" data-v="${s.settings.playAlong ? '' : '1'}" class="${s.settings.playAlong ? 'on' : ''}">📱 Play-Along ${s.settings.playAlong ? 'ON' : 'OFF'}</button></div></div>
        <div class="grp"><span>Remix</span><div class="seg">
            ${[['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']].map(([k, l]) => `<button data-act="set" data-k="remixLength" data-v="${k}" class="${s.settings.remixLength === k ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="grp" style="flex-basis:100%"><span>Games</span>${REMIX_PLAN.map((p) => {
          const off = (s.settings.remixOff || {})[p.type] || (s.settings.format === 'trivia' && p.party);
          return `<button class="cat-toggle ${off ? '' : 'on'}" data-act="remixtoggle" data-type="${p.type}" ${s.settings.format === 'trivia' && p.party ? 'disabled' : ''}>${p.party ? '🎉 ' : ''}${esc(p.label)}</button>`;
        }).join('')}</div>
        ${s.season && s.season.ep ? `<div class="grp" style="flex-basis:100%"><span>Season</span><span class="hint" style="margin:0">📺 ${s.season.ep} episode${s.season.ep > 1 ? 's' : ''} played · ${seasonLine(s)}</span><button class="cat-toggle" data-act="resetseason">Reset season</button></div>` : ''}
        ${s.settings.format === 'party' ? '' : `<div class="grp" style="flex-basis:100%"><span>Board ${s.categories.length}/6</span>${catBtns}<button class="cat-toggle" data-act="shufflecats" style="border-color:var(--gold)">🎲 Shuffle</button></div>`}
      </div>
      <div style="display:flex;gap:1vw;justify-content:center">
        <button class="btn ghost" data-act="newroom" title="Start over with a brand-new room code">🔄 New Room</button>
        <button class="btn ghost" data-act="editor">✏️ Family Questions</button>
        <button class="btn big" data-act="form" ${players.length < 2 || (s.categories.length < 3 && s.settings.format !== 'party') ? 'disabled' : ''}>Make Teams →</button>
      </div>
    </div>
  </div>`;
}

function viewTeams(s) {
  const cols = s.teams.map((t) => `<div class="team-col" data-k="tc-${t.id}" style="--tc:${t.color}">
      <h3 contenteditable="true" spellcheck="false" data-team="${t.id}">${esc(t.name)}</h3>
      <div class="mem">${t.members.map((pid) => s.players[pid] ? playerCard(s.players[pid], { act: 'move' }) : '').join('') || '<div class="hint">Empty</div>'}</div>
    </div>`).join('');
  return `<div style="width:100%">
    <div class="segment" style="margin-bottom:1vh">${ART.family ? `<img class="family-strip" src="${ART.family}" alt="">` : ''}<h1 style="font-size:clamp(26px,4vw,70px)">Meet the Teams</h1></div>
    <div class="teams-wrap" style="--n:${s.teams.length}">${cols}</div>
    <div class="hint">Tap a player to move them to another team · Tap a team name to rename it</div>
    <div style="display:flex;gap:1vw;justify-content:center;margin-top:1vh">
      <button class="btn ghost" data-act="back">← Lobby</button>
      ${s.teamMode === 'gen' ? `<button class="btn navy" data-act="merge">Old School vs. New School</button>` : `<button class="btn navy" data-act="form">🔀 Reshuffle</button>`}
      <button class="btn big green" data-act="start" ${s.teams.filter((t) => t.members.length).length < 2 ? 'disabled' : ''}>Start the Show! 🎬</button>
    </div>
    ${s.canMerge ? `<div class="hint" style="color:var(--gold)">Some generations only have one player — tap “Old School vs. New School” to merge.</div>` : ''}
  </div>`;
}

function viewBoard(s) {
  const cats = s.board.cats;
  let html = `<div class="board" style="--cols:${cats.length}">`;
  html += cats.map((c) => `<div class="cat-head">${iconHTML(c.icon)}<div class="cn">${esc(c.name)}</div></div>`).join('');
  for (let r = 0; r < 5; r++) {
    html += cats.map((c, ci) => {
      const t = c.tiles[r];
      return `<div class="tile ${t.used ? 'used' : ''}" data-act="tile" data-ci="${ci}" data-ti="${r}">${t.used ? '' : '$' + t.value}</div>`;
    }).join('');
  }
  html += '</div>';
  const ctrl = s.teams.find((t) => t.id === s.controlTeam);
  html += `<div class="board-foot">${ctrl ? `<span style="color:${ctrl.color}">●</span> <b>${esc(ctrl.name)}</b> picks the next tile` : ''} · 2 hidden <b>Family Wagers</b> on the board</div>`;
  return html;
}

function teamById(s, id) { return s.teams.find((t) => t.id === id); }
function teamOfPid(s, pid) { return s.teams.find((t) => t.members.includes(pid)); }
function pname(s, pid) { return s.players[pid] ? s.players[pid].name : '—'; }

function exprFor(s, pid) {
  const o = exprOverride[pid];
  if (o && o.until > Date.now()) return o.expr;
  const q = s.q;
  if (!q) return 'idle';
  const team = teamOfPid(s, pid);
  if (q.stage === 'reveal') {
    if (q.stamp === 'revoked') return 'gasp';
    if (team && (q.winnerTeam === team.id || (q.top && q.awards && q.awards[team.id]))) return 'cheer';
    return 'idle';
  }
  if (q.stage === 'answering' && q.answerer === pid) return (q.timerEnd - T.serverNow() < 3000) ? 'sweat' : 'focused';
  if (['reading', 'open', 'pick', 'wager'].includes(q.stage)) return 'focused';
  return 'idle';
}

function podiumsHTML(s, q) {
  return `<div class="podiums" id="podiums">${s.teams.map((t) => {
    const pid = q.podium[t.id];
    if (!pid) return '';
    const p = s.players[pid] || {};
    const buzzed = q.answerer === pid && q.stage === 'answering';
    let tag = '';
    if (q.lockouts && q.lockouts[pid] > T.serverNow()) tag = `<div class="tag red">FALSE START</div>`;
    else if (buzzed) tag = `<div class="tag">${q.steal ? 'STEAL!' : 'BUZZED IN'}</div>`;
    else if (q.stage === 'reveal' && q.winnerTeam === t.id) tag = `<div class="tag grn">+${money(q.isDD ? q.wager : q.value)}</div>`;
    else if (q.stage === 'reveal' && q.awards && q.awards[t.id]) tag = `<div class="tag grn">+${money(q.awards[t.id])}</div>`;
    else if (q.ogg && q.stage === 'pick' && q.ogg.picks[t.id]) tag = `<div class="tag grn">LOCKED IN</div>`;
    else if (q.ogg && q.stage === 'pitch' && q.ogg.order[q.ogg.pitchIdx] === t.id) tag = `<div class="tag">MAKE YOUR CASE!</div>`;
    else if (q.attempted && q.attempted.includes(t.id) && q.stage !== 'reveal') tag = `<div class="tag red">✕</div>`;
    const stk = (s.stats && s.stats[pid] && s.stats[pid].streak) || 0;
    if (!tag && stk >= 2) tag = `<div class="tag fire">${'🔥'.repeat(Math.min(stk, 5))}</div>`;
    const deskCls = ART.podium ? 'desk art' : 'desk';
    const deskStyle = ART.podium ? `style="--podium-art:url(${ART.podium})"` : '';
    return `<div class="podium ${buzzed ? 'buzzed' : ''} ${q.stage === 'open' && q.eligible.includes(t.id) ? 'active' : ''} ${p.connected === false ? 'away' : ''}" style="--tc:${t.color}" data-team="${t.id}">
      <div class="spot"></div>${tag}
      <div class="av">${renderAvatar(p.avatar, exprFor(s, pid), 150)}</div>
      <div class="${deskCls}" ${deskStyle}><div class="lifes" title="Lifelines">${'📞'.repeat(t.lifelines)}</div>
        <div class="led"><div class="pn">${esc(p.name || '')}</div><div class="tn">${esc(t.name)}</div><div class="sc">${money(t.score)}</div></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function timerHTML(q) {
  if (!q.timerEnd) return '';
  return `<div class="timer" id="tbar"><i></i></div><div class="timer-num" id="tnum"></div>`;
}

function choicesHTML(q, mode) {
  if (!q.choices) return '';
  return `<div class="choices">${q.choices.map((c, i) => {
    const L = LETTERS[i];
    let cls = '';
    if (q.stage === 'reveal' && mode === 'trivia') {
      if (L === q.answer) cls = 'right';
      else if (L === q.chosen) cls = 'wrongpick';
      else cls = 'dim';
    }
    if (q.stage === 'reveal' && mode === 'majority') cls = q.top.includes(L) ? 'right' : 'dim';
    let extra = '';
    if (mode === 'majority' && q.stage === 'reveal') {
      const total = Math.max(1, Object.values(q.counts).reduce((a, b) => a + b, 0));
      extra = `<span class="bar"><i style="width:${(q.counts[L] / total) * 100}%"></i></span><span class="cnt">${q.counts[L]}</span>`;
    }
    return `<div class="choice ${cls}"><span class="L">${L}</span><span>${esc(c)}</span>${extra}</div>`;
  }).join('')}</div>`;
}

function catMeta(q, s) {
  const seg = s.round === 2 && s.remix ? s.remix.segments[s.remix.segIdx] : null;
  const icon = seg ? seg.icon : (CAT_ICONS[q.category] || 'stamp');
  const val = q.isDD && q.wager ? `WAGER ${money(q.wager)}` : (q.type === 'majority_rules' ? '+50 / match' : money(q.value));
  const ERA = { elders: ['👑', "The OGs' Question"], genx: ['📻', 'Gen X Special'], millennial: ['📱', 'Millennial Throwback'], genz: ['⚡', 'Gen Z Check'] };
  const e = ERA[q.era];
  const chip = e && !q.isDD ? `<span class="era-chip" style="background:${GENERATIONS[q.era].color}" title="Another generation gets a Crossover Bonus">${e[0]} ${e[1]}</span>` : '';
  return `<div class="qmeta">${iconHTML(icon)}<span>${esc(seg ? seg.label : q.category)}</span><span class="val">${val}</span>${q.doubled ? '<span class="era-chip" style="background:var(--crimson)">2X SPIN BONUS</span>' : ''}${chip}</div>`;
}

function viewQuestion(s) {
  const q = s.q;
  const huddle = q.huddleUntil && q.huddleUntil > T.serverNow()
    ? `<div class="huddle"><div>📞 FAMILY HUDDLE!<small>${esc(teamOfPid(s, q.answerer)?.name || '')} — 15 seconds to help!</small></div></div>` : '';
  const paused = s.paused ? '<div class="paused-badge">PAUSED</div>' : '';
  let body = '', status = '', below = '';

  if (q.type === 'majority_rules') {
    body = `<div class="prompt">${esc(q.prompt)}</div>${choicesHTML(q, 'majority')}`;
    if (q.stage === 'vote') status = `EVERYBODY VOTE ON YOUR PHONE! <span class="hl">${q.voteCount}</span> in`;
    else {
      const aw = Object.entries(q.awards || {}).map(([id, pts]) => `<span style="color:${teamById(s, id)?.color}">${esc(teamById(s, id)?.name)} +${pts}</span>`).join(' · ');
      status = q.top.length ? `The room says <span class="hl">${q.top.map((L) => esc(q.choices[LETTERS.indexOf(L)])).join(' & ')}</span>` : 'Nobody voted!';
      below = aw ? `<div class="context"><b>Points:</b> ${aw}</div>` : '';
    }
    return `<div class="qwrap"><div class="qcard" data-k="q-${q.flipId}" data-flip="${q.flipId}">${paused}${catMeta(q, s)}${body}<div class="status-banner">${status}</div>${below}${timerHTML(q)}</div>
      <div class="lock-grid">${s.teams.map((t) => `<div class="lock" style="--tc:${t.color}">${esc(t.name)}<div class="st">${money(t.score)}</div></div>`).join('')}</div></div>`;
  }

  if (q.type === 'one_gotta_go') {
    const og = q.ogg;
    body = `<div class="prompt">${esc(q.prompt)}</div>`;
    if (q.stage === 'pick') {
      body += `<div class="choices">${q.choices.map((c, i) => `<div class="choice"><span class="L">${LETTERS[i]}</span><span>${esc(c)}</span></div>`).join('')}</div>`;
      status = 'Podium players: pick the one that has GOTTA GO!';
    } else if (q.stage === 'pitch') {
      const tid = og.order[og.pitchIdx], t = teamById(s, tid);
      const pick = q.choices[LETTERS.indexOf(og.picks[tid])];
      body += `<div class="answer-big" style="color:${t.color}">${esc(pname(s, q.podium[tid]))} says…</div><div class="dd-splash" style="font-size:clamp(30px,5vw,90px)">${esc(pick)} GOTTA GO!</div>`;
      status = `10 seconds — make your case! <span class="hl">(${og.pitchIdx + 1}/${og.order.length})</span>`;
    } else if (q.stage === 'pitchvote') {
      body += `<div class="choices">${og.order.map((tid) => `<div class="choice"><span class="L" style="background:${teamById(s, tid).color}"></span><span>${esc(teamById(s, tid).name)}: kick out <b>${esc(q.choices[LETTERS.indexOf(og.picks[tid])])}</b></span></div>`).join('')}</div>`;
      status = `Room: vote for the BEST DEFENSE on your phone! <span class="hl">${q.voteCount}</span> in`;
    } else {
      body += `<div class="choices">${og.order.map((tid) => `<div class="choice ${q.top.includes(tid) ? 'right' : 'dim'}"><span class="L" style="background:${teamById(s, tid).color}"></span><span>${esc(teamById(s, tid).name)}: <b>${esc(q.choices[LETTERS.indexOf(og.picks[tid])])}</b></span><span class="cnt" style="margin-left:auto">${q.counts[tid]} 🗳️</span></div>`).join('')}</div>`;
      status = q.top.length ? `Best defense: <span class="hl">${q.top.map((id) => esc(teamById(s, id).name)).join(' & ')}</span> +${q.value}` : 'No votes — no points!';
    }
    return `<div class="qwrap"><div class="qcard" data-k="q-${q.flipId}" data-flip="${q.flipId}">${paused}${catMeta(q, s)}${body}<div class="status-banner">${status}</div>${timerHTML(q)}</div>${podiumsHTML(s, q)}</div>`;
  }

  if (q.type === 'blitz') return viewBlitz(s, q, paused);
  if (q.type === 'family_survey') return viewSurvey(s, q, paused);
  if (q.type === 'charades') return viewCharades(s, q, paused);
  if (PARTY_TYPES.includes(q.type)) return viewParty(s, q, paused);

  // trivia, hashtag, era, saying, emoji
  if (q.stage === 'wager') {
    const t = teamOfPid(s, q.answerer);
    body = `<div class="dd-splash">FAMILY<br>WAGER!</div><div class="status-banner">${esc(pname(s, q.answerer))} for <span style="color:${t?.color}">${esc(t?.name)}</span> is wagering on their phone…<br><small>Category: ${esc(q.category)} · up to ${money(q.maxWager)}</small></div>`;
    return `<div class="qwrap"><div class="qcard" data-k="q-${q.flipId}" data-flip="${q.flipId}">${paused}${body}${timerHTML(q)}</div>${podiumsHTML(s, q)}</div>`;
  }
  const isTag = q.type === 'hashtag';
  const ptxt = isTag ? q.prompt.replace(/^Decode this hashtag:\s*/i, '') : q.prompt;
  const isEmoji = q.type === 'emoji';
  body = `${isTag ? '<div class="status-banner" style="margin:0">Decode this hashtag!</div>' : ''}${isEmoji ? '<div class="status-banner" style="margin:0">Name this movie, show or song!</div>' : ''}<div class="prompt ${isTag ? 'hashtag' : ''} ${isEmoji ? 'emoji' : ''} ${ptxt.length > 110 ? 'long' : ''}">${esc(ptxt)}</div>`;
  const showChoices = q.stage !== 'reading' || !q.choices ? true : true;
  if (showChoices) body += choicesHTML(q, 'trivia');
  if (q.stage === 'reading') status = 'Get ready…';
  else if (q.stage === 'open') status = q.steal ? `<span class="hl">STEAL!</span> Buzz in!` : '<span class="hl">BUZZERS OPEN!</span>';
  else if (q.stage === 'answering') status = `${esc(pname(s, q.answerer))}${q.steal ? ' — STEAL!' : ''} — what's your answer?`;
  else if (q.stage === 'reveal') {
    const t = q.winnerTeam ? teamById(s, q.winnerTeam) : null;
    if (q.result === 'correct') status = `<span class="hl">CORRECT!</span> ${esc(t?.name)} ${q.isDD && q.wager ? '+' + money(q.wager) : '+' + money(q.value)}${q.crossover ? ` <span class="xover">+${money(q.crossover.bonus)} CROSSOVER!</span>` : ''}`;
    else if (q.result === 'skipped') status = 'Skipped';
    else if (q.isDD && q.wager) status = `Not this time… −${money(q.wager)}`;
    else status = q.result === 'none' ? "Nobody buzzed in!" : 'Nobody got it!';
    if (!q.choices) below += `<div class="answer-big">${esc(q.answerText)}</div>`;
    const perks = [];
    if (q.fire) perks.push(`🔥 ${esc(pname(s, q.fire.pid))} is ON FIRE (${q.fire.streak} in a row) +$50`);
    if (q.underdog) perks.push(`🐾 Underdog bonus +${money(q.underdog)}`);
    if (q.bench) {
      const b = Object.entries(q.bench).filter(([, v]) => v.size).map(([id, v]) => `<span style="color:${teamById(s, id)?.color}">${esc(teamById(s, id)?.name)} ${v.right}/${v.size}${v.bonus ? ' +' + v.bonus : ''}</span>`);
      if (b.length) perks.push(`📱 Play-along: ${b.join(' · ')}`);
    }
    if (perks.length) below += `<div class="perks">${perks.join('<br>')}</div>`;
    if (q.context) below += `<div class="context"><b>Did you know?</b> ${esc(q.context)}</div>`;
  }
  return `<div class="qwrap"><div class="qcard" data-k="q-${q.flipId}" data-flip="${q.flipId}">${paused}${huddle}${catMeta(q, s)}${body}<div class="status-banner">${status}</div>${below}${timerHTML(q)}</div>${podiumsHTML(s, q)}</div>`;
}

function viewBlitz(s, q, paused) {
  const now = T.serverNow();
  const pre = q.stage === 'blitz' && now < q.blitzStart;
  const ids = Object.keys(q.podium);
  const lanes = ids.map((tid) => {
    const t = teamById(s, tid), pid = q.podium[tid], p = s.players[pid] || {}, pr = q.blitz.progress[tid] || { idx: 0, correct: 0 };
    const win = q.stage === 'reveal' && q.top && q.top.includes(tid);
    const expr = q.stage === 'reveal' ? (win ? 'cheer' : 'idle') : pre ? 'focused' : (q.timerEnd - now < 10000 ? 'sweat' : 'focused');
    return `<div class="lane ${win ? 'win' : ''}" style="--tc:${t.color}" data-lane="${tid}">
      <div class="av">${renderAvatar(p.avatar, expr, 110)}</div>
      <div class="ln">${esc(p.name || '')}</div><div class="lt">${esc(t.name)}</div>
      <div class="big">${pr.correct}<small> ✓</small></div>
      <div class="lbar"><i style="width:${(pr.idx / q.blitz.total) * 100}%"></i></div>
      <div class="lt" style="color:var(--dim);filter:none">${pr.idx}/${q.blitz.total} answered${q.awards && q.awards[tid] ? ` · <b style="color:var(--gold)">+${money(q.awards[tid])}</b>` : ''}</div>
    </div>`;
  }).join('');
  let head;
  if (pre) head = `<div class="blitz-cd" id="blitzcd">3</div><div class="status-banner">Podium players — eyes on your phones!</div>`;
  else if (q.stage === 'blitz') head = `<div class="dd-splash" style="font-size:clamp(30px,5vw,90px)">60-SECOND BLITZ</div><div class="status-banner"><span class="hl">GO GO GO!</span> +${money(q.value)} for every right answer</div>`;
  else head = `<div class="dd-splash" style="font-size:clamp(30px,5vw,90px)">TIME!</div><div class="status-banner">${q.top.length ? `Blitz winner: <span class="hl">${q.top.map((id) => esc(teamById(s, id).name)).join(' & ')}</span>` : 'Nobody scored!'}</div>`;
  return `<div class="qwrap" style="grid-template-rows:auto"><div class="qcard" data-k="q-${q.flipId}" data-flip="${q.flipId}" style="min-height:0">${paused}${head}<div class="blitz-lanes" style="--n:${ids.length}">${lanes}</div>${q.stage === 'blitz' && !pre ? timerHTML(q) : ''}</div></div>`;
}

function viewSurvey(s, q, paused) {
  const ctrl = q.control ? teamById(s, q.control) : null;
  const stealT = q.stealTeam ? teamById(s, q.stealTeam) : null;
  const tiles = q.board.map((b, i) => b.revealed
    ? `<div class="sv-tile on" data-k="sv-${q.flipId}-${i}"><span class="sv-n">${i + 1}</span><span class="sv-l">${esc(b.label)}</span><span class="sv-p">${b.pts}</span></div>`
    : `<button class="sv-tile" data-act="sreveal" data-i="${i}" title="Host: tap to reveal / award"><span class="sv-big">${i + 1}</span></button>`).join('');
  const strikes = [0, 1, 2].map((k) => `<span class="sv-x ${k < q.strikes ? 'on' : ''}">✕</span>`).join('');
  let status = '';
  const g = q.guesser ? pname(s, q.guesser) : '';
  if (q.stage === 'reading') status = 'Get ready to buzz for control…';
  else if (q.stage === 'open') status = '<span class="hl">BUZZ IN</span> for control of the board!';
  else if (q.stage === 'fo_answer') status = `Face-off: <span class="hl">${esc(g)}</span>, type your answer!`;
  else if (q.stage === 'play') status = `<span style="color:${ctrl?.color}">${esc(ctrl?.name)}</span> has the board — <span class="hl">${esc(g)}</span>, your turn!`;
  else if (q.stage === 'steal') status = `<span style="color:${stealT?.color}">${esc(stealT?.name)}</span>: huddle up — ONE guess to STEAL ${money(q.bank)}!`;
  else if (q.stage === 'reveal') status = q.winnerTeam ? `${q.stolen ? '<span class="hl">STOLEN!</span> ' : ''}${esc(teamById(s, q.winnerTeam)?.name)} takes <span class="hl">${money(q.awards[q.winnerTeam] || 0)}</span>` : 'Nobody scored!';
  const last = q.lastGuess && q.stage !== 'reveal' ? `<div class="sv-guess ${q.lastGuess.hit ? 'hit' : 'miss'}">${esc(pname(s, q.lastGuess.pid))}: “${esc(q.lastGuess.text)}” ${q.lastGuess.hit ? '✓' : '✕'}</div>` : '';
  return `<div class="qwrap"><div class="qcard sv" data-k="q-${q.flipId}" style="min-height:0">${paused}
    <div class="qmeta">${iconHTML('stamp')}<span>The Family Survey</span><span class="val">Bank ${money(q.bank)}</span></div>
    <div class="sv-ask">We asked ${q.respondents} people in THIS room…</div>
    <div class="prompt" style="font-size:clamp(18px,2.4vw,44px)">${esc(q.prompt)}</div>
    <div class="sv-board">${tiles}</div>
    <div class="sv-row"><div class="sv-strikes">${strikes}</div>${last}</div>
    <div class="status-banner">${status}</div>${timerHTML(q)}</div>${podiumsHTML(s, q)}</div>`;
}

function viewCharades(s, q, paused) {
  const ch = q.ch, tid = ch.order[ch.idx], t = teamById(s, tid);
  const lanes = ch.order.map((id) => {
    const tt = teamById(s, id);
    return `<div class="lock ${id === tid && q.stage !== 'reveal' ? 'done' : ''}" style="--tc:${tt.color}">${esc(tt.name)}<div class="st">${ch.counts[id] || 0} ✓</div></div>`;
  }).join('');
  let body;
  if (q.stage === 'ch_ready') body = `<div class="dd-splash" style="font-size:clamp(28px,4.6vw,86px)">CULTURE CHARADES</div>
      <div class="ch-actor">${renderAvatar(s.players[ch.actor]?.avatar, 'focused', 150)}<div><div class="ch-who">${esc(pname(s, ch.actor))}</div><div style="color:${t.color};font-weight:900">${esc(t.name)}</div></div></div>
      <div class="status-banner">Actor: your phone shows the clue. NO TALKING! ${esc(t.name)} shouts guesses. Host starts the clock.</div>`;
  else if (q.stage === 'ch_act') body = `<div class="ch-who" style="color:${t.color}">${esc(pname(s, ch.actor))} is acting for ${esc(t.name)}!</div>
      <div class="blitz-cd" style="font-size:clamp(70px,12vw,220px)">${ch.counts[tid]}</div><div class="status-banner">GUESS OUT LOUD! <span class="hl">+${money(q.value)}</span> each</div>${timerHTML(q)}`;
  else if (q.stage === 'ch_recap') body = `<div class="ch-who" style="color:${t.color}">${esc(t.name)}: ${ch.counts[tid]} correct!</div>
      <div class="ch-log">${ch.log.map((l) => `<span class="${l.got ? 'got' : 'skip'}">${l.got ? '✓' : '↷'} ${esc(l.word)}</span>`).join('') || '<span>No clues played</span>'}</div>
      <div class="status-banner">${ch.idx + 1 < ch.order.length ? 'Next team up!' : 'Final tally next!'}</div>`;
  else body = `<div class="dd-splash" style="font-size:clamp(28px,4.6vw,86px)">CHARADES RESULTS</div><div class="status-banner">${q.top.length ? `Best actors: <span class="hl">${q.top.map((id) => esc(teamById(s, id).name)).join(' & ')}</span>` : 'Nobody scored!'}</div>`;
  return `<div class="qwrap" style="grid-template-rows:auto"><div class="qcard" data-k="q-${q.flipId}-${q.stage}-${ch.idx}" style="min-height:0">${paused}<div class="qmeta">${iconHTML('masks')}<span>Culture Charades</span></div>${body}<div class="lock-grid">${lanes}</div></div></div>`;
}


// ---------------- Party games ----------------
const pct = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 50);
function splitBar(sp, label) {
  const a = pct(sp.agree, sp.disagree);
  return `<div class="ht-row"><span class="ht-lbl">${label}</span><div class="ht-bar">
    <div class="ag" style="width:${a}%">${a >= 12 ? `AGREE ${a}%` : ''}</div><div class="dg" style="width:${100 - a}%">${100 - a >= 12 ? `DISAGREE ${100 - a}%` : ''}</div></div>
    <span class="ht-n">${sp.agree}–${sp.disagree}</span></div>`;
}
function votedRow(s, q, exclude = []) {
  const ids = Object.values(s.players).filter((p) => p.connected && !exclude.includes(p.pid)).map((p) => p.pid);
  return `<div class="voted-row">${ids.map((pid) => `<div class="vr ${q.voted[pid] ? 'in' : ''}">${renderAvatar(s.players[pid]?.avatar, q.voted[pid] ? 'cheer' : 'idle', 54)}<span>${esc(pname(s, pid))}</span></div>`).join('')}</div>`;
}
function teamStrip(s, q) {
  return `<div class="lock-grid">${s.teams.map((t) => `<div class="lock ${q.awards && q.awards[t.id] ? 'done' : ''}" style="--tc:${t.color}">${esc(t.name)}<div class="st">${money(t.score)}${q.awards && q.awards[t.id] ? ` <b style="color:var(--gold)">+${q.awards[t.id]}</b>` : ''}</div></div>`).join('')}</div>`;
}
function speakerCard(s, pid, side, devil, live) {
  const t = teamOfPid(s, pid);
  return `<div class="ht-speaker ${side} ${live ? 'live' : ''}">${renderAvatar(s.players[pid]?.avatar, live ? 'focused' : 'idle', live ? 150 : 80)}
    <div><div class="ht-side">${side === 'agree' ? '👍🏾 AGREE' : '👎🏾 DISAGREE'}${devil ? ' <small>(devil\'s advocate!)</small>' : ''}</div>
    <div class="ht-name">${esc(pname(s, pid))}</div><div style="color:${t?.color};font-weight:900">${esc(t?.name || '')}</div></div></div>`;
}
function viewParty(s, q, paused) {
  const ICON = { hot_take: 'mic', most_likely: 'crown', top_that: 'smiley', two_truths: 'masks' };
  let body = '', status = '';
  if (q.type === 'hot_take') {
    const h = q.ht;
    body = `<div class="ht-stamp">HOT TAKE</div><div class="prompt ht-prompt">“${esc(q.prompt)}”</div>`;
    if (q.stage === 'ht_vote1') { body += votedRow(s, q); status = `Agree or Disagree? <span class="hl">Vote on your phone!</span> ${q.voteCount} in`; }
    else if (q.stage === 'ht_argue') {
      const side = h.turn ? 'disagree' : 'agree', other = h.turn ? 'agree' : 'disagree';
      body += splitBar(h.split1, 'Round 1') + `<div class="ht-stage">${speakerCard(s, h.speakers[side], side, h.devil[side], true)}${h.speakers[other] && !h.turn ? speakerCard(s, h.speakers[other], other, h.devil[other], false) : ''}</div>`;
      status = `<span class="hl">${esc(pname(s, h.speakers[side]))}</span>, you got 20 seconds — CONVINCE US!`;
    } else if (q.stage === 'ht_vote2') {
      body += splitBar(h.split1, 'Round 1') + votedRow(s, q);
      status = `Anybody change their mind? <span class="hl">VOTE AGAIN!</span> ${q.voteCount} in`;
    } else {
      body += splitBar(h.split1, 'Before') + splitBar(h.split2, 'After');
      const w = h.winSide;
      body += w ? `<div class="ht-stage">${speakerCard(s, h.speakers[w], w, h.devil[w], true)}</div>` : '';
      status = w ? `${w === 'agree' ? 'AGREE' : 'DISAGREE'} gained <span class="hl">${Math.abs(h.shift)}%</span>! ${esc(pname(s, h.speakers[w]))} flipped the room — <span class="hl">+${q.value}</span>` : 'Nobody budged! The family is SET in its ways. 😂';
    }
  }
  if (q.type === 'most_likely') {
    const ml = q.ml;
    body = `<div class="ml-ask">Who in the family is MOST likely to…</div><div class="prompt ml-prompt">${esc(q.prompt)}</div>`;
    if (q.stage === 'ml_vote') { body += votedRow(s, q); status = `Vote for somebody on your phone (not yourself!) · <span class="hl">${q.voteCount}</span> in`; }
    else {
      const cands = ml.cands.slice().sort((a, b) => (ml.counts[b] || 0) - (ml.counts[a] || 0));
      body += `<div class="ml-grid">${cands.map((pid) => {
        const n = ml.counts[pid] || 0, top = ml.top.includes(pid);
        return `<div class="ml-c ${top ? 'top' : ''} ${n ? '' : 'dim'}">${top ? '<span class="ml-crown">👑</span>' : ''}${renderAvatar(s.players[pid]?.avatar, top ? 'gasp' : 'idle', top ? 130 : 80)}<div class="ml-n">${esc(pname(s, pid))}</div><div class="ml-v">${n} vote${n === 1 ? '' : 's'}</div></div>`;
      }).join('')}</div>`;
      status = ml.top.length ? `The family has spoken: <span class="hl">${ml.top.map((p) => esc(pname(s, p))).join(' & ')}</span>! ${ml.matchers.length} matched the room (+${q.value} each)` : 'Nobody voted!';
    }
  }
  if (q.type === 'top_that') {
    const tt = q.tt;
    body = `<div class="prompt tt-prompt">${esc(q.prompt).replace('____', '<span class="tt-blank">______</span>')}</div>`;
    if (q.stage === 'tt_write') { body += votedRow(s, q); status = `Everybody: finish it on your phone! Funniest wins · <span class="hl">${q.voteCount}</span> in`; }
    else if (q.stage === 'tt_vote') {
      body += `<div class="tt-grid">${tt.entries.map((e, i) => `<div class="tt-card ${e.hidden ? 'hid' : ''}" style="animation-delay:${i * .12}s"><span class="tt-num">${i + 1}</span><span class="tt-text">${e.hidden ? '(removed by host)' : esc(e.text)}</span><button class="tt-hide" data-act="tthide" data-id="${e.id}" title="Host: hide/unhide this answer">${e.hidden ? '↺' : '🙈'}</button></div>`).join('')}</div>`;
      status = `Vote for the FUNNIEST on your phone (not your own!) · <span class="hl">${q.voteCount}</span> in`;
    } else {
      const ents = tt.entries || [];
      body += `<div class="tt-grid">${ents.map((e) => `<div class="tt-card ${tt.topIds.includes(e.id) ? 'win' : ''}"><span class="tt-num">${tt.topIds.includes(e.id) ? '🏆' : e.votes}</span><span class="tt-text">${esc(e.text)}<small>— ${esc(pname(s, e.by))}${e.votes ? ` · ${e.votes} vote${e.votes > 1 ? 's' : ''}` : ''}</small></span>${renderAvatar(s.players[e.by]?.avatar, tt.topIds.includes(e.id) ? 'cheer' : 'idle', 60)}</div>`).join('') || '<div class="hint">Not enough answers this time!</div>'}</div>`;
      status = tt.topIds.length ? `Room favorite: <span class="hl">${tt.topIds.map((id) => esc(pname(s, ents.find((e) => e.id === id).by))).join(' & ')}</span> (+${PARTY.ttTop} bonus)` : 'No votes — tough crowd!';
    }
  }
  if (q.type === 'two_truths') {
    const tw = q.tw, tt = teamById(s, tw.team);
    const head = `<div class="ch-actor">${renderAvatar(s.players[tw.teller]?.avatar, q.stage === 'reveal' ? 'cheer' : 'focused', 130)}<div><div class="ch-who">${esc(pname(s, tw.teller))}</div><div style="color:${tt?.color};font-weight:900">${esc(tt?.name || '')}</div></div></div>`;
    if (q.stage === 'tw_write') { body = `<div class="dd-splash" style="font-size:clamp(26px,4.4vw,80px)">TWO TRUTHS<br>& A LIE</div>${head}`; status = `${esc(pname(s, tw.teller))} is secretly typing two true stories and one LIE… 🤫`; }
    else {
      body = head + `<div class="tw-list">${(tw.statements || []).map((st, i) => {
        const rev = q.stage === 'reveal', lie = rev && i === tw.lie;
        return `<div class="tw-item ${rev ? (lie ? 'lie' : 'truth') : ''}" style="animation-delay:${rev ? i * .5 : i * .15}s"><span class="tw-n">${i + 1}</span><span class="tw-t">${esc(st)}</span>${rev ? `<span class="tw-tag">${lie ? 'LIE!' : 'TRUE'}</span><span class="tw-c">${tw.counts[i] || 0} 🗳️</span>` : ''}</div>`;
      }).join('')}</div>`;
      if (q.stage === 'tw_vote') { body += votedRow(s, q, [tw.teller]); status = `Which one is the <span class="hl">LIE</span>? Vote on your phone! ${q.voteCount} in`; }
      else status = !tw.statements ? 'No statements this time — skipped!' : tw.fooled ? `${esc(pname(s, tw.teller))} fooled <span class="hl">${tw.fooled}</span> ${tw.fooled === 1 ? 'person' : 'people'}! 🤥` : `Nobody fell for it… ${esc(pname(s, tw.teller))} can't lie to this family! 😂`;
    }
  }
  return `<div class="qwrap" style="grid-template-rows:auto"><div class="qcard party ${q.type}" data-k="q-${q.flipId}" style="min-height:0">${paused}${ART.party[q.type] ? `<img class="party-sticker" src="${ART.party[q.type]}" alt="">` : ''}<div class="qmeta">${iconHTML(ICON[q.type])}<span>${esc(q.category)}</span></div>${body}<div class="status-banner">${status}</div>${timerHTML(q)}</div>${teamStrip(s, q)}</div>`;
}

// ---------- Sankofa Spin wheel (drawn in SVG) ----------
function wheelSVG() {
  const cx = 200, cy = 200, r = 170;
  const pt = (deg, rad) => [cx + rad * Math.sin(deg * Math.PI / 180), cy - rad * Math.cos(deg * Math.PI / 180)];
  let segs = '';
  WHEEL.forEach((w, i) => {
    const a0 = i * 60 - 30, a1 = i * 60 + 30;
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    segs += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${w.color}" stroke="#2B2B2B" stroke-width="5"/>`;
    segs += `<path d="M${cx} ${cy} L${pt(a0 + 2, r * .97).map((v) => v.toFixed(1)).join(' ')} A${r * .97} ${r * .97} 0 0 1 ${pt(a1 - 2, r * .97).map((v) => v.toFixed(1)).join(' ')} Z" fill="url(#kshade)" opacity=".35"/>`;
    const words = w.label.split(' ');
    segs += `<g transform="rotate(${i * 60} ${cx} ${cy})"><text x="${cx}" y="${cy - r * .7}" text-anchor="middle" font-family="Bungee, Arial Black" font-size="${words.length > 1 ? 17 : 26}" fill="#FFF6E5" stroke="#2B2B2B" stroke-width="4" paint-order="stroke">${words.map((wd, k) => `<tspan x="${cx}" dy="${k ? 20 : 0}">${esc(wd)}</tspan>`).join('')}</text></g>`;
  });
  let bulbs = '';
  for (let k = 0; k < 24; k++) { const [bx, by] = pt(k * 15, r + 14); bulbs += `<circle class="bulb ${k % 2 ? 'b2' : 'b1'}" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6"/>`; }
  return `<svg viewBox="0 0 400 400" class="wheel-svg"><defs><radialGradient id="kshade"><stop offset="60%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".6"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r + 24}" fill="#1A1B3A" stroke="#F2B632" stroke-width="10"/>${bulbs}
    <g id="wheel-rot">${segs}</g>
    <circle cx="${cx}" cy="${cy}" r="44" fill="#151515" stroke="#F2B632" stroke-width="8"/></svg>`;
}
function viewSpin(s) {
  const sp = s.spin || {}, t = teamById(s, sp.team) || {};
  let status;
  if (sp.stage === 'ready') status = `<b style="color:${t.color}">${esc(t.name)}</b> — ${esc(pname(s, sp.spinner))}, spin it from your phone!`;
  else if (sp.stage === 'spinning') status = 'Round and round it goes…';
  else if (sp.stage === 'again') status = '<span class="hl">SPIN AGAIN!</span>';
  else status = `<span class="hl">${esc(WHEEL[sp.result].label)}</span> for ${esc(t.name)}!`;
  return `<div class="spin-wrap" data-k="spin-${sp.history ? sp.history.length : 0}">
    <div class="dd-splash" style="font-size:clamp(28px,4.4vw,80px)">THE SANKOFA SPIN</div>
    <div class="wheel-box"><div class="wheel-pointer"></div>${wheelSVG()}<div class="wheel-hub">${iconHTML('sankofa', 'hub-icon')}</div></div>
    <div class="status-banner">${status}</div>
    <div class="hint">Prizes: +200 · Double the next question · +1 Family Huddle · Cookout (+100 everybody) · +300 · Spin again</div></div>`;
}

function viewSegment(s) {
  const seg = s.remix.segments[s.remix.segIdx];
  return `<div class="segment ${ART.roundFrame ? 'framed' : ''}" ${ART.roundFrame ? `style="background-image:url(${ART.roundFrame})"` : ''}>
    <div class="pill">${s.settings.format === 'party' ? 'Party Night' : 'Round 2'} · ${s.remix.segIdx + 1} of ${s.remix.segments.length}</div><br>
    ${seg.party && ART.party[seg.type] ? `<img class="seg-art" src="${ART.party[seg.type]}" alt="">` : iconHTML(seg.icon)}
    <h1>${esc(seg.label)}</h1>
    <p>${esc(seg.blurb)}</p>
    <button class="btn big" data-act="next">Let's Go!</button>
  </div>`;
}

function standingsHTML(s) {
  const max = Math.max(1, ...s.teams.map((t) => Math.max(0, t.score)));
  return `<div class="standings">${s.teams.map((t, i) => `<div class="stand" style="--tc:${t.color}">
    <div class="avrow">${t.members.slice(0, 4).map((pid) => renderAvatar(s.players[pid]?.avatar, 'cheer', 70)).join('')}</div>
    <div class="bar" style="height:${8 + (Math.max(0, t.score) / max) * 26}vh;animation-delay:${i * .15}s">${money(t.score)}</div>
    <div class="tn">${esc(t.name)}</div></div>`).join('')}</div>`;
}

function viewRoundEnd(s) {
  const party = s.settings.format === 'party';
  const nextLabel = s.round === 1 ? 'On to Round 2: The Remix →' : party ? 'Crown the Champions 🏆' : 'On to the Final Wager →';
  return `<div class="segment"><div class="pill">${party ? 'Party Night' : `End of Round ${s.round}`}</div><h1>${s.round === 1 ? 'Board Cleared!' : party ? "That's the Party!" : 'Remix Complete!'}</h1>${standingsHTML(s)}<button class="btn big" data-act="next">${nextLabel}</button></div>`;
}

function viewFinal(s) {
  const f = s.final;
  const paused = s.paused ? '<div class="paused-badge">PAUSED</div>' : '';
  if (s.phase === 'final_intro') {
    return `<div class="segment ${ART.roundFrame ? 'framed' : ''}" ${ART.roundFrame ? `style="background-image:url(${ART.roundFrame})"` : ''}><div class="pill">Round 3</div>${iconHTML('crown')}<h1>The Final Wager</h1>
      <p>Tonight's category:<br><span style="color:var(--gold);font-family:var(--display);font-size:1.6em">${esc(f.category)}</span></p>
      <p style="font-size:clamp(12px,1.3vw,24px);opacity:.85">Captains will wager privately on their phones — from $0 up to their score (or up to $500 if they're behind).</p>
      <button class="btn big" data-act="next">Captains, Place Your Wagers →</button></div>`;
  }
  const locks = (key) => `<div class="lock-grid">${s.teams.filter((t) => f.captains[t.id]).map((t) => `<div class="lock ${f[key][t.id] ? 'done' : ''}" style="--tc:${t.color}">
     ${renderAvatar(s.players[f.captains[t.id]]?.avatar, f[key][t.id] ? 'cheer' : 'focused', 60)}<div>${esc(pname(s, f.captains[t.id]))}</div><div style="color:${t.color}">${esc(t.name)}</div><div class="st">${f[key][t.id] ? 'LOCKED ✓' : '…'}</div></div>`).join('')}</div>`;
  if (s.phase === 'final_wager') {
    return `<div class="qwrap"><div class="qcard">${paused}<div class="qmeta">${iconHTML('crown')}<span>Final Wager</span></div><div class="prompt">${esc(f.category)}</div><div class="status-banner">Captains: lock in your wager on your phone!</div>${f.timerEnd ? '<div class="timer" id="tbar"><i></i></div><div class="timer-num" id="tnum"></div>' : ''}</div>${locks('wagered')}</div>`;
  }
  if (s.phase === 'final_answer') {
    return `<div class="qwrap"><div class="qcard">${paused}<div class="qmeta">${iconHTML('crown')}<span>${esc(f.category)}</span></div><div class="prompt">${esc(f.prompt)}</div><div class="status-banner">Captains: huddle with your team and type your answer!</div>${f.timerEnd ? '<div class="timer" id="tbar"><i></i></div><div class="timer-num" id="tnum"></div>' : ''}</div>${locks('answered')}</div>`;
  }
  // final_reveal
  if (f.revealIdx >= f.order.length) {
    return `<div class="segment"><div class="pill">The correct answer</div><div class="qmeta" style="justify-content:center;margin-top:2vh">${esc(f.prompt)}</div>
      <div class="answer-big" style="font-size:clamp(30px,5vw,90px)">${esc(f.answer)}</div>
      ${f.context ? `<div class="context" style="max-width:70vw;margin:2vh auto">${esc(f.context)}</div>` : ''}
      ${standingsHTML(s)}<button class="btn big" data-act="next">Crown the Champions 🏆</button></div>`;
  }
  const id = f.order[f.revealIdx], t = teamById(s, id), r = f.results[id] || {};
  const capt = f.captains[id];
  const wline = r.wager === null || r.wager === undefined ? '' : `<div class="w ${r.correct ? 'plus' : 'minus'}">${r.correct ? '+' : '−'}${money(r.wager)} → ${money(t.score)}</div>`;
  return `<div style="text-align:center;width:100%">
    <div class="qmeta" style="justify-content:center">${esc(f.category)} — ${esc(f.prompt)}</div>
    <div class="final-team">
      <div class="who">${renderAvatar(s.players[capt]?.avatar, r.correct === true ? 'cheer' : r.correct === false ? 'gasp' : 'focused', 180)}<div style="font-weight:900;font-size:clamp(14px,1.5vw,28px);color:${t.color}">${esc(t.name)}</div></div>
      <div class="ans"><div class="l">Their answer</div><div class="t">${esc(r.answer)}</div>${wline}</div>
    </div>
    <div class="hint">${f.judged ? 'Press Next for the next team' : 'Host: judge it with ✅ / ❌ below (tap 👁 Peek to see the answer)'}</div>
  </div>`;
}

function viewChampion(s) {
  const winners = (s.winners || []).map((id) => teamById(s, id));
  const trophy = ART.trophy ? `<img class="trophy" src="${ART.trophy}" alt="">` : `<span class="trophy-fallback">🏆</span>`;
  return `<div class="champ ${s.season && s.season.ep ? 'has-season' : ''}">${trophy}
    <h1>${winners.map((t) => esc(t.name)).join(' & ')}</h1>
    <div class="tagline">Grand Champions of Generations</div>
    <div class="avrow">${winners.flatMap((t) => t.members.map((pid) => renderAvatar(s.players[pid]?.avatar, 'cheer', 150))).join('')}</div>
    ${awardsHTML(s)}
    ${standingsHTML(s)}
    ${seasonHTML(s)}
    <div style="display:flex;gap:1vw;justify-content:center;flex-wrap:wrap">
      <button class="btn green" data-act="nextep" title="Same teams, fresh questions, season totals keep counting">📺 Next Episode (same teams)</button>
      <button class="btn navy" data-act="newgame">New Teams / Lobby</button>
    </div>
  </div>`;
}

function awardsHTML(s) {
  const a = s.awards || {};
  const card = (x, title, line) => x ? `<div class="award"><div class="aw-av">${renderAvatar(s.players[x.pid]?.avatar, 'cheer', 70)}</div><div><div class="aw-t">${title}</div><div class="aw-n">${esc(pname(s, x.pid))}</div><div class="aw-l">${line(x.n)}</div></div></div>` : '';
  const html = card(a.mvp, '⭐ MVP', (n) => `${money(n)} at the podium`) +
    card(a.crossover, '🌉 Bridge Builder', (n) => `${n} crossover answer${n > 1 ? 's' : ''}`) +
    card(a.thief, '🦹🏾 Master Thief', (n) => `${n} steal${n > 1 ? 's' : ''}`) +
    card(a.fire, '🔥 On Fire', (n) => `${n} right in a row`) +
    card(a.bench, '🛋️ Armchair Expert', (n) => `${n} play-along answers right`) +
    card(a.actor, '🎭 Best Actor', (n) => `${n} charades clues`) +
    card(a.closer, '🎤 The Closer', (n) => `flipped the room ${n}×`) +
    card(a.clown, '😂 Family Comedian', (n) => `${n} Top That! votes`) +
    card(a.liar, '🤥 Smooth Liar', (n) => `fooled ${n} people`) +
    card(a.legend, '👑 Most Likely Legend', (n) => `picked by the room ${n}×`);
  return html ? `<div class="awards">${html}</div>` : '';
}

function seasonRows(s) {
  return Object.entries((s.season && s.season.teams) || {}).sort((a, b) => b[1].wins - a[1].wins || b[1].pts - a[1].pts);
}
function seasonLine(s) { return seasonRows(s).slice(0, 3).map(([n, r]) => `${esc(n)} ${r.wins}W`).join(' · '); }
function seasonHTML(s) {
  if (!s.season || !s.season.ep) return '';
  return `<div class="season"><div class="season-h">📺 SEASON STANDINGS · after episode ${s.season.ep}</div>${seasonRows(s).map(([n, r], i) => `<div class="season-r" style="--tc:${r.color}"><span class="sr-rank">${i === 0 ? '👑' : i + 1}</span><span class="sr-n">${esc(n)}</span><span class="sr-w">${r.wins} win${r.wins === 1 ? '' : 's'}</span><span class="sr-p">${money(r.pts)}</span></div>`).join('')}</div>`;
}

function renderScores(s) {
  if (!s.teams.length || s.phase === 'teams') { setHTML(ui.scores, ''); return; }
  setHTML(ui.scores, s.teams.map((t) => `<div class="score-chip ${s.controlTeam === t.id && s.phase === 'board' ? 'ctrl' : ''}" style="--tc:${t.color}" data-team="${t.id}">
    <span style="color:${t.color}">●</span>${esc(t.name)} <span class="s">${money(t.score)}</span>
    <span class="adj"><button data-act="adj" data-team="${t.id}" data-d="-100">−</button><button data-act="adj" data-team="${t.id}" data-d="100">+</button></span>
  </div>`).join(''));
  ui.scores.classList.toggle('edit', scoreEdit);
  for (const t of s.teams) {
    if (prevScores[t.id] !== undefined && prevScores[t.id] !== t.score) {
      const el = ui.scores.querySelector(`[data-team="${t.id}"]`);
      if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }
    prevScores[t.id] = t.score;
  }
}

function peekText(s) {
  if (s.phase === 'question' && s.q && ['blitz', 'charades', 'hot_take', 'most_likely', 'top_that'].includes(s.q.type)) return '';
  if (s.phase === 'question' && s.q && s.q.type === 'two_truths') return E.cur && E.cur.twLie !== undefined && s.q.tw.statements ? `The lie is #${E.cur.twLie + 1}` : '';
  if (s.phase === 'question' && s.q && s.q.type === 'family_survey' && E.cur && E.cur.board) return E.cur.board.map((e, i) => `${i + 1}. ${e.label} (${e.count})`).join('  ·  ');
  if (s.phase === 'question' && E.cur && E.cur.full) {
    const f = E.cur.full;
    if (!f.answer) return 'No right answer — the room decides';
    const i = 'ABCD'.indexOf(f.answer);
    return (f.choices && i >= 0 ? `${f.answer}: ${f.choices[i]}` : f.answer) + (f.acceptAlso && f.acceptAlso.length ? ` (also: ${f.acceptAlso.join(', ')})` : '');
  }
  if (s.phase && s.phase.startsWith('final') && E.cur && E.cur.full) return E.cur.full.answer + (E.cur.full.acceptAlso?.length ? ` (also: ${E.cur.full.acceptAlso.join(', ')})` : '');
  return '';
}

function socialButtons() {
  if (!tvs.call) return '';
  const c = tvs.call;
  const n = c.count();
  return `<button class="btn navy ${tvs.feed ? 'on' : ''}" data-act="tvfeed" title="Show family chat on screen">💬 Chat ${tvs.feed ? 'ON' : 'OFF'}</button>`
    + `<button class="btn navy ${tvs.voices ? 'on' : ''}" data-act="tvvoices" title="Play voice notes out loud">🎤 Voice notes ${tvs.voices ? 'ON' : 'OFF'}</button>`
    + (c.inCall ? `${c.local ? `<button class="btn navy" data-act="tvmute">${c.muted ? '🔇 Unmute' : '🎙️ Mute'}</button>` : ''}<button class="btn red" data-act="tvcallleave">📹 Leave call</button>`
      : `<button class="btn green" data-act="tvcall">📹 Video call${n ? ` (${n})` : ''}</button>`);
}
function renderControls(s) {
  if (WATCH) { setHTML(ui.controls, socialButtons() + `<button class="btn navy" data-act="sound">${soundOn() ? '🔊' : '🔇'}</button>`); return; }
  const b = [];
  const q = s.q;
  const next = (label, extra = '') => b.push(`<button class="btn" data-act="next" ${extra}>${label}<span class="kbd">␣</span></button>`);
  if (s.phase === 'question' && q) {
    if (q.stage === 'reading') next('Open Buzzers');
    if (q.stage === 'wager') next('Use Default Wager');
    if (q.stage === 'answering') {
      b.push(`<button class="btn green" data-act="judge" data-v="1">✅ Correct<span class="kbd">C</span></button>`);
      b.push(`<button class="btn red" data-act="judge" data-v="0">❌ Wrong<span class="kbd">X</span></button>`);
    }
    if (q.stage === 'vote') next('Reveal Votes');
    if (q.stage === 'pick') next('Start Pitches');
    if (q.stage === 'pitch') next('Next Pitch');
    if (q.stage === 'pitchvote') next('Reveal Winner');
    if (q.stage === 'blitz') next('End Blitz');
    if (q.stage === 'ch_ready') next('▶ Start Clock');
    if (q.stage === 'ch_act') next('Time!');
    if (q.stage === 'ch_recap') next(q.ch.idx + 1 < q.ch.order.length ? 'Next Team →' : 'Final Tally →');
    const PN = { ht_vote1: 'Lock Votes → Debate', ht_vote2: 'Reveal the Shift', ml_vote: 'Reveal', tt_write: 'Close Writing', tt_vote: 'Reveal Winner', tw_write: 'Skip This Teller', tw_vote: 'Reveal the Lie' };
    if (q.stage === 'ht_argue') next(q.ht.turn === 0 && q.ht.speakers.disagree ? 'Other Side →' : 'Vote Again');
    else if (PN[q.stage]) next(PN[q.stage]);
    if (q.type === 'family_survey' && ['fo_answer', 'play', 'steal'].includes(q.stage)) {
      b.push(`<button class="btn red" data-act="sstrike">❌ Strike<span class="kbd">X</span></button>`);
      b.push(`<span class="hint" style="margin:0 .4vw">Tap a hidden answer to award it</span>`);
    }
    if (q.stage === 'reveal') next('Next →');
    if (q.stage !== 'reveal') b.push(`<button class="btn navy" data-act="skip">Skip<span class="kbd">S</span></button>`);
  }
  if (s.phase === 'spin' && s.spin) {
    if (s.spin.stage === 'ready') next('Spin It');
    if (s.spin.stage === 'again') next('Spin Again');
    if (s.spin.stage === 'done') next('Back to the Board →');
  }
  if (s.phase === 'segment') { next("Let's Go"); b.push(`<button class="btn navy" data-act="skip">Skip Segment</button>`); }
  if (s.phase === 'board') b.push(`<button class="btn navy" data-act="endround">End Round 1 Early</button>`);
  if (s.phase === 'round_end') next(s.round === 1 ? 'Round 2 →' : s.settings.format === 'party' ? 'Champions →' : 'Final Wager →');
  if (s.phase === 'final_intro') next('Start Wagers');
  if (s.phase === 'final_wager') next('Close Wagers');
  if (s.phase === 'final_answer') next('Close Answers');
  if (s.phase === 'final_reveal') {
    const f = s.final;
    if (f.revealIdx < f.order.length && !f.judged) {
      b.push(`<button class="btn green" data-act="fjudge" data-v="1">✅ Correct<span class="kbd">C</span></button>`);
      b.push(`<button class="btn red" data-act="fjudge" data-v="0">❌ Wrong<span class="kbd">X</span></button>`);
    } else next('Next →');
  }
  const peek = peekText(s);
  if (peek) b.push(`<span class="peek"><button class="btn navy" data-act="peek">👁 Peek</button><span class="peek-pop">${esc(peek)}</span></span>`);
  if (!['lobby', 'teams'].includes(s.phase)) {
    b.push('<span class="sep"></span>');
    b.push(`<button class="btn navy" data-act="pause">${s.paused ? '▶ Resume' : '⏸ Pause'}<span class="kbd">P</span></button>`);
    b.push(`<button class="btn navy ${scoreEdit ? 'on' : ''}" data-act="scores">± Scores</button>`);
    b.push(`<button class="btn navy" data-act="undo">↶ Undo Last Points</button>`);
  }
  b.push(`<button class="btn navy" data-act="remote" title="Run the show from your phone">📱 Remote</button>`);
  b.push(socialButtons());
  b.push(`<button class="btn navy" data-act="sound">${soundOn() ? '🔊' : '🔇'}</button>`);
  if (!['lobby', 'teams', 'champion'].includes(s.phase)) b.push(`<button class="btn ghost" data-act="end">End Game</button>`);
  setHTML(ui.controls, b.join(''));
}

// ---------------- animation frame: timers, ticks, huddle ----------------
function frame() {
  requestAnimationFrame(frame);
  if (!S) return;
  const now = T.serverNow();
  let end = 0, total = 1;
  if (S.phase === 'question' && S.q && S.q.timerEnd) { end = S.q.timerEnd; total = S.q.timerTotal; }
  else if (S.final && S.final.timerEnd && ['final_wager', 'final_answer'].includes(S.phase)) { end = S.final.timerEnd; total = S.final.timerTotal; }
  const bar = $('#tbar'), num = $('#tnum');
  if (end && bar) {
    const left = S.paused ? Math.max(0, end - (E.pausedAt || now)) : Math.max(0, end - now);
    const pct = Math.max(0, Math.min(1, left / total));
    bar.firstElementChild.style.transform = `scaleX(${pct})`;
    const sec = Math.ceil(left / 1000);
    const low = left < 5000;
    bar.classList.toggle('low', low);
    if (num) { num.textContent = sec; num.classList.toggle('low', low); }
    if (low && sec !== lastTickSec && sec > 0 && !S.paused) { sfx(sec % 2 ? 'tick' : 'tock'); }
    lastTickSec = sec;
    const isLow = S.q && S.q.stage === 'answering' && left < 3000;
    if (isLow !== lastLow) { lastLow = isLow; renderMain(S); }
  }
  if (S.q && S.q.type === 'blitz' && S.q.stage === 'blitz') {
    const cd = $('#blitzcd');
    const left = S.q.blitzStart - now;
    if (cd) cd.textContent = left > 0 ? Math.ceil(left / 1000) : 'GO!';
    const started = left <= 0;
    if (started !== lastBlitz) { lastBlitz = started; renderMain(S); if (started) { sfx('buzz'); crowdReact('cheer'); } }
  }
  if (S.phase === 'spin' && S.spin) {
    const g = document.getElementById('wheel-rot'), sp = S.spin;
    if (g) {
      let ang = 0;
      const final = 360 * (sp.turns || 4) - (sp.result || 0) * 60;
      if (sp.stage === 'spinning') {
        const p = Math.min(1, (now - sp.startAt) / (SPIN.seconds * 1000));
        ang = final * (1 - Math.pow(1 - p, 3.2));
        const seg = Math.floor((ang + 30) / 60);
        if (seg !== lastSeg) { lastSeg = seg; if (p < 1) sfx('tick'); }
      } else if (sp.stage === 'done' || sp.stage === 'again') ang = final;
      g.setAttribute('transform', `rotate(${ang.toFixed(2)} 200 200)`);
    }
  }
  const h = !!(S.q && S.q.huddleUntil && S.q.huddleUntil > now);
  if (h !== lastHuddle) { lastHuddle = h; renderMain(S); }
}

// ---------------- host mascot lines ----------------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = {
  correct: ['Ohhh, they KNEW that!', 'Somebody\'s been paying attention!', "That's what I'm talking about!", 'Put some respect on it!', 'Grown-folks knowledge right there!', 'Okayyy! I see you!'],
  wrong: ['Ohhh nooo!', 'Not like that, baby!', 'Somebody call Grandma!', 'The ancestors felt that one…', "Whew. We're gonna pray on that.", 'Close… but no potato salad.'],
  revoked: ['Hand over the card. Right now.', 'Card revoked! No appeals!', "Your auntie is SHAKING her head."],
  steal: ['STEAL! Who wants it?', "Door's open — take it!"],
  open: ['Hands on those buzzers!', 'Buzzers are live!'],
  majority: ['No wrong answers — just wrong family members!', 'Match the room, win the points!'],
};
const nm = (pid) => (E.s.players[pid] ? E.s.players[pid].name : '');
const tm = (id) => { const t = E.s.teams.find((x) => x.id === id); return t ? t.name : ''; };

// ---------------- effects from engine ----------------
function setExpr(pid, expr, ms = 2200) { if (pid) exprOverride[pid] = { expr, until: Date.now() + ms }; }
function onFx(type, data) {
  switch (type) {
    case 'join': sfx('join'); break;
    case 'flip': sfx('flip'); break;
    case 'whoosh': sfx('whoosh'); mascotUnpin();
      if (E.s.phase === 'segment' && E.s.remix) { const seg = E.s.remix.segments[E.s.remix.segIdx]; if (seg) setTimeout(() => mascotSay('point', `Next up: ${seg.label}!`, 2600), E.s.remix.segIdx === 0 ? 3000 : 300); }
      break;
    case 'open': sfx('reveal'); break;
    case 'buzz':
      sfx('buzz'); if (Math.random() < .35) mascotSay('point', `${nm(data.pid)} buzzed in!`, 1800);
      setTimeout(() => shockwave(document.querySelector(`.podium[data-team="${data.team}"]`)), 30);
      break;
    case 'falsestart': sfx('wrong'); setExpr(data.pid, 'gasp', 1000); setTimeout(() => S && renderMain(S), 1050); break;
    case 'correct':
      sfx('correct'); crowdReact('cheer'); if (data.pid || Math.random() < .5) mascotSay('cheer', pick(LINES.correct), 2400); setExpr(data.pid, 'cheer', 3000);
      setTimeout(() => confetti(data.pid ? 90 : 60), 50);
      break;
    case 'wrong': sfx(Math.random() < .5 ? 'wrong' : 'scratch'); setExpr(data.pid, 'gasp', 1800); crowdReact('gasp'); mascotSay('gasp', pick(LINES.wrong), 2200); break;
    case 'steal': setTimeout(() => banner('STEAL!', true, 1300), 400); setTimeout(() => mascotSay('point', pick(LINES.steal), 1800), 1500); break;
    case 'dailydouble': sfx('fanfare'); mascotSay('point', `FAMILY WAGER! ${tm(data.team)}, how much you got?`, 3200); break;
    case 'huddle': sfx('join'); break;
    case 'revoked': setTimeout(() => { sfx('stamp'); sfx('scratch'); stamp('revoked'); crowdReact('gasp', 1200); mascotSay('gasp', pick(LINES.revoked), 2600); }, 350); break;
    case 'saved': setTimeout(() => { sfx('stamp'); stamp('saved'); confetti(80); }, 350); break;
    case 'reveal': sfx('reveal'); break;
    case 'vote': sfx('vote'); break;
    case 'partyreveal': {
      const who = nm(data.pid);
      sfx(data.pid ? 'fanfare' : 'reveal'); crowdReact(data.pid ? 'cheer' : 'gasp', 2200); if (data.pid) { confetti(80); setExpr(data.pid, 'cheer', 3500); }
      const L = {
        ht: data.side ? [`${who} said what needed to be said!`, `${who} could argue with a stop sign!`, `Somebody give ${who} a law degree!`] : ['Y\'all are STUBBORN!', 'Nobody moved an inch!'],
        ml: data.pid ? [`${who}… the family has SPOKEN!`, `Sorry ${who}, the receipts don't lie!`, `${who}, you know it's true!`] : ['Nobody wanted to snitch!'],
        tt: data.pid ? [`${who} is a whole comedian!`, `${who} need a Netflix special!`, `${who} took that one!`] : ['Tough crowd tonight!'],
        tw: data.fooled ? [`${who} lie too smooth!`, `Never trust ${who} again!`, `${who} had y'all FOOLED!`] : [`${who} can't lie to save their life!`, 'This family knows EVERYTHING!'],
      };
      setTimeout(() => mascotSay(data.pid ? 'cheer' : 'gasp', pick(L[data.kind] || ['Whew!']), 2800), 500);
      break;
    }
    case 'fanfare': sfx('fanfare'); confetti(120); break;
    case 'champion': sfx('fanfare'); crowdReact('cheer', 4000); setTimeout(() => mascotSay('cheer', `Give it up for ${(E.s.winners || []).map(tm).join(' & ')}!`, 5000), 1200); confetti(150); setTimeout(() => confetti(150), 900); setTimeout(() => confetti(150), 1800); break;
    case 'undo': banner('UNDONE', true, 900); break;
    case 'strike': sfx('buzz'); sfx('wrong'); strikeFx(data.small ? 1 : data.n); crowdReact('gasp'); if (!data.small) mascotSay('gasp', data.n >= 3 ? 'THREE STRIKES! Other team — steal it!' : pick(['Survey says… nope!', "That ain't up there!", 'Strike!']), 2000); break;
    case 'surveyhit': sfx('correct'); setTimeout(() => sfx('reveal'), 200); crowdReact('cheer'); if (Math.random() < .5) mascotSay('cheer', pick(['Survey says… YES!', "It's on the board!", 'The family agrees!']), 1800); break;
    case 'control': banner(`${esc(tm(data.team))}<div class="banner-sub">has the board!</div>`, false, 1500); break;
    case 'onfire': sfx('fanfare'); banner(`🔥 ON FIRE! 🔥<div class="banner-sub">${esc(nm(data.pid))} · ${data.streak} in a row</div>`, false, 1900); break;
    case 'underdog': banner(`UNDERDOG BONUS!<div class="banner-sub">${esc(tm(data.team))} +${money(data.bonus)}</div>`, false, 1900); mascotSay('point', "Don't count 'em out!", 2200); break;
    case 'spinready': sfx('fanfare'); mascotSay('point', `Sankofa Spin! ${tm(data.team)}, spin that wheel!`, 3000); crowdReact('cheer'); break;
    case 'spin': sfx('whoosh'); lastSeg = null; break;
    case 'spinresult': {
      const w = WHEEL[data.result];
      sfx(data.result === 5 ? 'reveal' : 'fanfare'); confetti(data.result === 3 ? 150 : 90); crowdReact('cheer', 2000);
      banner(`${esc(w.label)}<div class="banner-sub">${data.result === 3 ? 'Everybody eats!' : esc(tm(data.team))}</div>`, false, 2200);
      setTimeout(() => mascotSay('cheer', { 0: 'Two hundred! Cha-ching!', 1: 'DOUBLE POINTS on the next question!', 2: 'An extra Family Huddle — use it wisely!', 3: "It's a COOKOUT! Everybody gets a plate!", 4: 'THREE HUNDRED! Somebody is blessed!', 5: 'Run it back — spin again!' }[data.result], 2600), 2300);
      break;
    }
    case 'chgot': sfx('correct'); crowdReact('bob', 600); break;
    case 'chskip': sfx('tock'); break;
    case 'react': reaction(data.e, data.name); if (Math.random() < .25) crowdReact('bob', 700); break;
    case 'showopen': setTimeout(() => mascotSay('present', 'Welcome to GENERATIONS! Phones out, family!', 3800), 7200); sfx('fanfare'); setTimeout(() => sfx('whoosh'), 500); showOpen(E.s.teams.filter((t) => t.members.length), (pid) => renderAvatar(E.s.players[pid]?.avatar, 'cheer', 90)); setTimeout(() => crowdReact('cheer', 2200), 1800); break;
    case 'roundcard': setTimeout(() => mascotSay('present', data.n === 3 ? "It's FINAL WAGER time. Captains, don't get scared now!" : `Round ${data.n}! Let's get it!`, 3200), 2900); sfx('whoosh'); setTimeout(() => sfx('fanfare'), 500); roundCard(data.n, data.title); setTimeout(() => crowdReact('cheer'), 700); break;
    case 'blitz': lastBlitz = null; sfx('fanfare'); mascotSay('point', 'Fingers ready… 60 seconds on the clock!', 2900); break;
    case 'blitzhit': {
      sfx(data.ok ? 'vote' : 'tock');
      setTimeout(() => {
        const el = document.querySelector(`[data-lane="${data.team}"]`);
        if (el) { el.classList.remove('flash-right', 'flash-wrong'); void el.offsetWidth; el.classList.add(data.ok ? 'flash-right' : 'flash-wrong'); }
      }, 30);
      break;
    }
    case 'crossover': {
      const who = S && S.players[data.pid] ? S.players[data.pid].name : '';
      sfx('fanfare'); confetti(70); crowdReact('cheer'); setTimeout(() => mascotSay('cheer', `Look at ${who} crossing generations!`, 2600), 2300);
      banner(`GENERATION<br>CROSSOVER!<div class="banner-sub">${esc(who)} +${money(data.bonus)}</div>`, false, 2200);
      break;
    }
  }
}

// ---------------- events ----------------
function delegate(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !el.dataset.act) return;
  unlockAudio();
  const a = el.dataset.act, d = el.dataset;
  const social = { tvfeed: 1, tvvoices: 1, tvcall: 1, tvcalljoin: 1, tvcallleave: 1, tvmute: 1, modalclose: 1, sound: 1 };
  if (WATCH && !social[a]) return;
  switch (a) {
    case 'tvfeed': tvs.feed = !tvs.feed; $('#tvchat').classList.toggle('hidden', !tvs.feed); renderControls(S); break;
    case 'tvvoices': tvs.voices = !tvs.voices; renderControls(S); break;
    case 'tvcall': showCallModal(); break;
    case 'tvcalljoin': tvCallJoin(d.v, el); break;
    case 'tvcallleave': tvs.call.leave(); break;
    case 'tvmute': tvs.call.toggleMute(); break;
    case 'modalclose': el.closest('.modal')?.remove(); break;
    case 'mode': E.setTeamMode(d.mode, d.n ? +d.n : null); break;
    case 'cat': {
      const list = S.categories.slice();
      const i = list.indexOf(d.cat);
      if (i >= 0) list.splice(i, 1); else if (list.length < 6) list.push(d.cat);
      E.setCategories(list); break;
    }
    case 'kick': e.stopPropagation(); E.kick(d.pid); break;
    case 'remote': showRemote(); break;
    case 'set': E.setSetting(d.k, d.k === 'playAlong' ? !!d.v : d.v); break;
    case 'sreveal': E.hostSurveyReveal(+d.i); break;
    case 'sstrike': E.hostSurveyStrike(); break;
    case 'shufflecats': E.shuffleCategories(); break;
    case 'form': E.formTeams(); break;
    case 'merge': E.mergeOldNew(); break;
    case 'back': E.s.phase = 'lobby'; E.s.teams = []; E.publish(); break;
    case 'move': E.movePlayer(d.pid); break;
    case 'start': E.startGame(); break;
    case 'tile': E.pickTile(+d.ci, +d.ti); break;
    case 'next': E.next(); break;
    case 'judge': E.judge(d.v === '1'); break;
    case 'fjudge': E.judgeFinal(d.v === '1'); break;
    case 'skip': E.skip(); break;
    case 'pause': E.togglePause(); break;
    case 'scores': scoreEdit = !scoreEdit; renderControls(S); renderScores(S); break;
    case 'adj': E.manualScore(d.team, +d.d); break;
    case 'undo': E.undoLast(); break;
    case 'sound': setSound(!soundOn()); renderControls(S); break;
    case 'endround': if (confirmInline(el, 'Sure? Tap again')) E.endRoundEarly(); break;
    case 'end': if (confirmInline(el, 'Tap again to end')) E.champion(); break;
    case 'newgame': mascotUnpin(); E.newGame(); break;
    case 'nextep': mascotUnpin(); E.nextEpisode(); break;
    case 'resetseason': if (confirmInline(el, 'Tap again')) E.resetSeason(); break;
    case 'remixtoggle': E.toggleRemix(d.type); break;
    case 'lobbyopen': lobbyOpen = !lobbyOpen; renderMain(S); break;
    case 'resetseen': if (confirmInline(el, 'Tap again to reset')) E.resetSeen(); break;
    case 'tthide': E.ttHide(d.id); break;
    case 'newroom': if (confirmInline(el, 'Tap again')) { sessionStorage.removeItem('gen-host-save'); T.closeRoom().finally(() => location.reload()); } break;
    case 'peek': el.parentElement.classList.toggle('show'); setTimeout(() => el.parentElement && el.parentElement.classList.remove('show'), 2500); break;
    case 'editor': openEditor(E, async () => { const bank = await loadBank(); E.bank = bank; E.byId = Object.fromEntries(bank.map((q) => [q.id, q])); E.publish(); }); break;
  }
}
function showRemote() {
  const url = location.href.replace(/[^/]*$/, '') + `remote.html?room=${E.s.code}&key=${E.hostKey}${T.mode === 'demo' ? '&demo' : ''}`;
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="box" style="text-align:center;max-width:520px">
    <h2>📱 Host Remote</h2>
    <p class="note">Scan this with <b>the host's</b> phone to run the show from your hand. It shows the <b>answers privately</b>, the hidden Family Wager tiles, the Family Survey board, and every button. Keep it secret — anyone with this code can control the game.</p>
    <div style="width:260px;margin:10px auto;background:#fff;padding:8px;border-radius:12px">${qrSvg(url)}</div>
    <p class="note" style="word-break:break-all">${esc(url)}</p>
    <button class="btn red" id="rm-close">Got it — hide this</button></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#rm-close').onclick = () => wrap.remove();
}
function confirmInline(el, msg) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  const old = el.innerHTML; el.innerHTML = msg;
  setTimeout(() => { if (el.isConnected) { el.innerHTML = old; delete el.dataset.armed; } }, 2500);
  return false;
}
function onRename(e) {
  const h = e.target.closest && e.target.closest('h3[data-team]');
  if (h) { cache.delete(ui.main); E.renameTeam(h.dataset.team, h.textContent); }
}
function onKey(e) {
  if (e.target.closest('input, textarea, [contenteditable], .modal')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { e.preventDefault(); E.next(); }
  else if (k === 'c') { if (S.phase === 'final_reveal') E.judgeFinal(true); else E.judge(true); }
  else if (k === 'x') { if (S.phase === 'final_reveal') E.judgeFinal(false); else if (S.q && S.q.type === 'family_survey') E.hostSurveyStrike(); else E.judge(false); }
  else if (k === 'p') E.togglePause();
  else if (k === 's') E.skip();
}

boot();
