// ============================================================
// GENERATIONS — Host Remote: run the show from your phone.
// Shows the answer key privately and sends host commands.
// ============================================================
import { createTransport } from './transport.js';
import { esc, money, $, LETTERS, uid } from './util.js';

const qs = new URLSearchParams(location.search);
const room = (qs.get('room') || '').toUpperCase();
const key = qs.get('key') || '';
let T, S = null, P = {};
let mode = localStorage.getItem('gen-remote-mode') || 'simple';
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ } }
const cache = { html: '' };
const vib = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* no-op */ } };

function send(cmd, arg) { vib(25); T.sendInput({ type: 'host', pid: 'remote', key, cmd, arg: arg === undefined ? null : arg }); }

async function boot() {
  document.body.innerHTML = '<div class="stage-bg"><div class="floor"></div></div><div class="phone remote" id="app"></div>';
  if (!room || !key) { $('#app').innerHTML = '<h2>Host Remote</h2><div class="msg">Open this from the 📱 Remote button on the host screen.</div>'; return; }
  T = await createTransport();
  await T.joinRoom(room, 'remote-' + uid(6));
  T.onState((s) => { S = s; draw(); });
  T.onPrivate(key, (p) => { P = p || {}; draw(); });
  document.addEventListener('click', onClick);
  keepAwake(); document.addEventListener('visibilitychange', keepAwake);
  setInterval(() => draw(true), 500);
}

const teamById = (id) => (S.teams || []).find((t) => t.id === id);
const pname = (id) => (S.players && S.players[id] ? S.players[id].name : '—');

function btn(cmd, label, cls = '', arg) {
  return `<button class="btn ${cls}" data-cmd="${cmd}" ${arg !== undefined ? `data-arg='${esc(JSON.stringify(arg))}'` : ''}>${label}</button>`;
}
function timeLeft() {
  const end = S.q && S.q.timerEnd ? S.q.timerEnd : S.final && S.final.timerEnd ? S.final.timerEnd : 0;
  if (!end) return '';
  const left = Math.max(0, Math.ceil((end - T.serverNow()) / 1000));
  return `<span class="rm-time">${left}s</span>`;
}

function answerBox() {
  if (!P.answerText && !P.board) return '';
  if (P.board) return `<div class="rm-key"><div class="lbl">🔒 Survey board (only you see this)</div>${P.board.map((b, i) => `<div>${i + 1}. ${esc(b.label)} <small>(${b.count} said it · ${b.pts})</small></div>`).join('')}</div>`;
  return `<div class="rm-key"><div class="lbl">🔒 Answer (only you see this)</div><div class="ans">${P.answer && P.answer.length === 1 ? P.answer + ': ' : ''}${esc(P.answerText || '')}</div>${P.accept && P.accept.length ? `<div class="also">Also accept: ${esc(P.accept.join(', '))}</div>` : ''}</div>`;
}

function body() {
  const s = S;
  if (!s) return '<div class="msg">Connecting to the show…</div>';
  const q = s.q;
  const scores = (s.teams || []).map((t) => `<div class="rm-score" style="--tc:${t.color}"><span>${esc(t.name)}</span><b>${money(t.score)}</b>
     <button data-cmd="score" data-arg='${esc(JSON.stringify({ team: t.id, d: -100 }))}'>−</button><button data-cmd="score" data-arg='${esc(JSON.stringify({ team: t.id, d: 100 }))}'>+</button></div>`).join('');
  let main = '', acts = '';
  switch (s.phase) {
    case 'lobby':
      main = `<div class="msg">${Object.keys(s.players || {}).length} players in the lobby</div>`;
      acts = btn('form', 'Make Teams →', 'big');
      break;
    case 'teams': main = '<div class="msg">Teams are set.</div>'; acts = btn('start', '🎬 Start the Show', 'big green'); break;
    case 'board': {
      const ctrl = teamById(s.controlTeam);
      main = `<div class="msg">${ctrl ? `<b style="color:${ctrl.color}">${esc(ctrl.name)}</b> picks` : 'Pick a tile'}${s.nextMult ? ' · <b style="color:var(--gold)">2X NEXT!</b>' : ''}</div>
        <div class="rm-board" style="--cols:${s.board.cats.length}">${s.board.cats.map((c) => `<div class="rm-cat">${esc(c.name)}</div>`).join('')}
        ${[0, 1, 2, 3, 4].map((r) => s.board.cats.map((c, ci) => c.tiles[r].used ? '<span></span>' : `<button data-cmd="tile" data-arg='${JSON.stringify({ ci, ti: r })}'>${c.tiles[r].value}${c.tiles[r].dd ? '★' : ''}</button>`).join('')).join('')}</div>
        <div class="sub">★ = hidden Family Wager (only you can see that)</div>`;
      acts = btn('endround', 'End Round 1', 'navy');
      break;
    }
    case 'spin': {
      const sp = s.spin || {};
      main = `<h2>🎡 Sankofa Spin</h2><div class="msg">${esc(teamById(sp.team)?.name || '')} — ${sp.stage === 'ready' ? `${esc(pname(sp.spinner))} spins on their phone (or you can)` : sp.stage === 'spinning' ? 'Spinning…' : sp.stage === 'again' ? 'SPIN AGAIN!' : 'Prize awarded!'}</div>`;
      acts = sp.stage === 'spinning' ? '' : btn('next', sp.stage === 'ready' ? 'SPIN IT' : sp.stage === 'again' ? 'Spin Again' : 'Back to the Board →', 'big');
      break;
    }
    case 'question': {
      main = `<div class="qtext"><span class="cat">${esc(q.category)} · ${q.stage}</span>${esc(q.prompt || '')}</div>${answerBox()}`;
      if (q.type === 'family_survey') {
        main += `<div class="mini-board">${q.board.map((b, i) => b.revealed ? `<div class="on"><span>${i + 1}. ${esc(b.label)}</span><span>${b.pts}</span></div>` : `<button class="rm-sv" data-cmd="sreveal" data-arg="${i}">${i + 1}. ${esc((P.board && P.board[i] && P.board[i].label) || '?')} — tap to award</button>`).join('')}</div>`;
        if (q.lastGuess) main += `<div class="sub">Last guess: ${esc(pname(q.lastGuess.pid))} “${esc(q.lastGuess.text)}” ${q.lastGuess.hit ? '✓' : '✕'} · Strikes: ${q.strikes || 0}</div>`;
        if (['fo_answer', 'play', 'steal'].includes(q.stage)) acts += btn('sstrike', '❌ Strike', 'red');
      }
      if (q.stage === 'answering') acts += btn('judge', '✅ Correct', 'green', 1) + btn('judge', '❌ Wrong', 'red', 0);
      if (q.stage === 'si_turn') acts += btn('judge', '✅ That Counts', 'green', 1) + btn('judge', '❌ Nope / Repeat', 'red', 0);
      const nextLabel = { reading: 'Open Buzzers', wager: 'Default Wager', vote: 'Reveal Votes', pick: 'Start Pitches', pitch: 'Next Pitch', pitchvote: 'Reveal Winner', blitz: 'End Blitz', ch_ready: '▶ Start Clock', ch_act: 'Time!', ch_recap: 'Next Team', reveal: 'Next →', ht_vote1: 'Lock Votes → Debate', ht_argue: 'Next Speaker / Vote', ht_vote2: 'Reveal the Shift', ml_vote: 'Reveal', tt_write: 'Close Writing', tt_vote: 'Reveal Winner', tw_write: 'Skip Teller', tw_vote: 'Reveal the Lie', si_ready: '🎤 Start / Next Team' }[q.stage];
      if (nextLabel) acts += btn('next', nextLabel, 'big');
      if (q.voted && ['ht_vote1', 'ht_vote2', 'ml_vote', 'tt_write', 'tt_vote', 'tw_vote'].includes(q.stage)) main += `<div class="sub">${Object.keys(q.voted).length} in so far</div>`;
      if (q.type === 'top_that' && P.entries) main += `<div class="rm-key"><div class="lbl">🔒 Who wrote what (tap to hide/unhide an answer)</div>${P.entries.map((e) => `<button class="rm-sv" data-cmd="tthide" data-arg='${esc(JSON.stringify(e.id))}' style="${e.hidden ? 'opacity:.4;text-decoration:line-through' : ''}">“${esc(e.text)}” — ${esc(e.by)}</button>`).join('')}</div>`;
      if (q.type === 'charades' && q.ch && q.ch.word && q.stage === 'ch_act') main += `<div class="rm-key"><div class="lbl">Current clue</div><div class="ans">${esc(q.ch.word)}</div></div>`;
      break;
    }
    case 'final_reveal': {
      const f = s.final, id = f.order[f.revealIdx], t = teamById(id), r = f.results && f.results[id];
      main = `${answerBox()}${t && r ? `<div class="qtext"><span class="cat">${esc(t.name)} answered</span>${esc(r.answer)}<br><small>Wager: ${money((P.finalWagers || {})[id] || 0)}</small></div>` : '<div class="msg">All teams revealed.</div>'}`;
      acts = t && !f.judged ? btn('judge', '✅ Correct', 'green', 1) + btn('judge', '❌ Wrong', 'red', 0) : btn('next', 'Next →', 'big');
      break;
    }
    default: {
      const label = { segment: "Let's Go", round_end: 'Next Round →', final_intro: 'Start Wagers', final_wager: 'Close Wagers', final_answer: 'Close Answers', champion: '' }[s.phase];
      if (s.phase === 'champion') acts = btn('nextep', '📺 Next Episode (same teams)', 'big green');
      main = `<div class="msg">${esc(s.phase.replace('_', ' '))}</div>${s.phase.startsWith('final') ? answerBox() : ''}`;
      if (label) acts = btn('next', label, 'big');
    }
  }
  const simple = mode === 'simple';
  const hasTimer = (s.q && s.q.timerEnd) || (s.final && s.final.timerEnd);
  const inPlay = s.phase === 'question' || s.phase.startsWith('final');
  const hypes = [['applause', '👏🏾', 'Applause'], ['ooh', '😮', 'Ooooh'], ['drumroll', '🥁', 'Drumroll'], ['airhorn', '📢', 'Airhorn'], ['laugh', '😂', 'Laugh'], ['crickets', '🦗', 'Crickets'], ['boo', '👎🏾', 'Boo'], ['church', '🙌🏾', 'Amen']];
  const scoreStrip = (s.teams || []).map((t) => `<span class="rm-chip" style="--tc:${t.color}">${esc(t.name)} <b>${money(t.score)}</b></span>`).join('');
  return `<div class="rm-top"><b>🎛️ HOST REMOTE</b><span>Room ${esc(room)} ${timeLeft()}</span>
      <button class="rm-mode" data-local="mode">${simple ? '⚙️ Full' : '✨ Simple'}</button></div>
    ${timerBar()}
    ${simple && s.teams && s.teams.length ? `<div class="rm-strip">${scoreStrip}</div>` : ''}
    ${main}
    <div class="rm-hype">${(simple ? hypes.slice(0, 4) : hypes).map(([k, e, l]) => `<button data-cmd="hype" data-arg='"${k}"'><span>${e}</span>${l}</button>`).join('')}</div>
    ${simple ? '' : `<div class="rm-scores">${scores}</div>`}
    <div class="rm-dock">
      <div class="rm-acts">${acts || '<div class="sub" style="text-align:center;width:100%">Nothing to press — enjoy the show 🍿</div>'}</div>
      <div class="rm-row">${hasTimer ? btn('time', '⏱ +10s', 'navy', 10) : ''}${btn('pause', s.paused ? '▶ Resume' : '⏸ Pause', 'navy')}${inPlay && s.phase === 'question' && s.q && s.q.stage !== 'reveal' ? btn('skip', '⏭ Skip', 'navy') : ''}${simple ? '' : btn('undo', '↶ Undo', 'navy')}</div>
    </div>`;
}
function timerBar() {
  const o = S.q && S.q.timerEnd ? S.q : S.final && S.final.timerEnd ? S.final : null;
  if (!o || !o.timerTotal) return '';
  const left = Math.max(0, o.timerEnd - T.serverNow());
  const pct = Math.max(0, Math.min(100, left / o.timerTotal * 100));
  return `<div class="rm-bar"><i style="width:${pct.toFixed(0)}%;${pct < 25 ? 'background:var(--crimson)' : ''}"></i></div>`;
}

function draw(tick) {
  const html = body();
  if (html === cache.html) return;
  if (tick && document.activeElement && document.activeElement.tagName === 'INPUT') return;
  cache.html = html;
  $('#app').innerHTML = html;
}
function onClick(e) {
  const l = e.target.closest('[data-local]');
  if (l) { mode = mode === 'simple' ? 'full' : 'simple'; localStorage.setItem('gen-remote-mode', mode); cache.html = ''; draw(); return; }
  const b = e.target.closest('[data-cmd]');
  if (!b) return;
  let arg;
  try { arg = b.dataset.arg !== undefined ? JSON.parse(b.dataset.arg) : undefined; } catch (err) { arg = b.dataset.arg; }
  send(b.dataset.cmd, arg);
}
boot();
