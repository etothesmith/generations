// ============================================================
// GENERATIONS — the Pre-Show (mixed into Engine).
// A guided setup everybody does together, one simple task at a time:
//   1. JOIN      — scan the code, pick a name + avatar
//   2. WARM-UP   — 3 quick survey questions (they become the Family Survey game)
//   3. PICK GAMES— everybody taps their top 3; the votes build the lineup AND its order
//   4. BEEF      — optional: call somebody out; accepted beefs become 1-on-1 Beef Battles
//   5. TEAMS     — rivals land on opposite teams, then showtime
// The first player to join is the CAPTAIN: their phone can move the pre-show along,
// so with Auto-Host on nobody has to stand at the TV.
// ============================================================
import { REMIX_PLAN } from './engine.js';
import { PARTY_TYPES } from './party.js';

import { SETUP_STEPS, stepsFor, BEEF_TOPICS, GAME_PITCH } from './setupdata.js';
export { SETUP_STEPS, BEEF_TOPICS, GAME_PITCH };
const LINEUP_SIZE = { short: 5, normal: 7, long: 9 };
const BEEF_Q = 3;           // questions per Beef Battle
const BEEF_BONUS = 300;     // to the winner's team

export const SetupMixin = {
  setupState() {
    if (!this.s.setup) this.s.setup = { step: 'join', captain: null };
    if (!this.s.vote) this.s.vote = { picks: {} };
    if (!this.s.beefs) this.s.beefs = [];
    return this.s.setup;
  },
  humans() { return Object.values(this.s.players).filter((p) => !p.bot && !p.audience); },
  pickCaptain() {
    const su = this.setupState();
    const cur = su.captain && this.s.players[su.captain];
    if (cur && cur.connected !== false && !cur.audience) return;
    const next = this.humans().filter((p) => p.connected !== false).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    su.captain = next ? next.pid : null;
  },
  setCaptain(pid) { if (this.s.players[pid]) { this.setupState().captain = pid; this.publish(); } },
  setupSteps() { return stepsFor(this.s); },
  setupGo(step) {
    const su = this.setupState();
    if (step === 'teams') {
      su.step = 'teams'; this.lockLineup();
      // sensible default: one team per generation only when every generation has 2+ people
      if (!this.s.teamModeChosen) {
        const g = this.genGroups(), sizes = Object.values(g).map((x) => x.length);
        this.s.teamMode = sizes.length >= 2 && sizes.length <= 4 && sizes.every((n) => n >= 2) ? 'gen' : 'agesplit';
      }
      this.formTeams(); this.fx('whoosh'); return;
    }
    su.step = step; this.s.phase = 'lobby';
    if (step === 'games' || step === 'beef' || step === 'warmup') su.stepAt = this.now();
    if (step === 'games') this.s.vote.options = this.gameOptions();
    this.fx('whoosh');
    this.publish();
  },
  setupNext() {
    const su = this.setupState();
    if (this.s.phase === 'teams') return this.startGame();
    const steps = this.setupSteps().map((x) => x.id);
    const i = steps.indexOf(su.step);
    const nx = steps[Math.max(0, i) + 1] || 'teams';
    this.setupGo(nx);
  },
  setupBack() {
    const su = this.setupState();
    const steps = this.setupSteps().map((x) => x.id);
    if (this.s.phase === 'teams') { this.s.phase = 'lobby'; su.step = steps[steps.length - 2] || 'join'; this.publish(); return; }
    const i = steps.indexOf(su.step);
    if (i > 0) { su.step = steps[i - 1]; this.publish(); }
  },
  // progress counts the TV + phones show ("5 of 7 done")
  setupProgress() {
    const su = this.setupState(), hs = this.humans().filter((p) => p.connected !== false);
    const n = hs.length;
    if (su.step === 'warmup' && this.s.survey) { const need = this.s.survey.prompts.length; return { done: hs.filter((p) => (this.s.survey.answered[p.pid] || 0) >= need).length, n }; }
    if (su.step === 'games') return { done: hs.filter((p) => (this.s.vote.picks[p.pid] || []).length >= Math.min(3, this.gameOptions().length)).length, n };
    if (su.step === 'beef') return { done: hs.filter((p) => this.s.setup.beefDone && this.s.setup.beefDone[p.pid]).length, n };
    return { done: n, n };
  },

  // the Captain's phone can run the pre-show (and nudge the show along when Auto-Host is on)
  onCaptain(pid, m) {
    const s = this.s, su = this.setupState();
    if (pid !== su.captain) return;
    switch (m.action) {
      case 'next':
        if (['lobby', 'teams'].includes(s.phase)) return this.setupNext();
        if (s.settings.autoHost) return s.phase === 'spin' ? this.spinNext() : this.next();
        return;
      case 'back': return this.setupBack();
      case 'pause': return this.togglePause();
      case 'set': if (['format', 'boardSize', 'remixLength', 'answerTime', 'autoHost'].includes(m.k) && s.phase === 'lobby') this.setSetting(m.k, m.k === 'autoHost' ? !!m.v : m.v); return;
      case 'split': if (s.phase === 'teams') { this.setTeamMode(m.mode, +m.n || 2); this.formTeams(); } return;
    }
  },
  // ---------- game vote ----------
  gameOptions() {
    const fmt = this.s.settings.format || 'classic';
    return REMIX_PLAN.map((p) => p.type).filter((t) => {
      if (fmt === 'trivia') return !PARTY_TYPES.includes(t) && !['charades', 'family_survey', 'one_gotta_go'].includes(t);
      if (t === 'family_survey') return !!this.s.survey;
      return true;
    });
  },
  onGameVote(pid, list) {
    if (this.s.phase !== 'lobby' || this.setupState().step !== 'games' || !this.s.players[pid]) return;
    const ok = this.gameOptions();
    const picks = [...new Set((Array.isArray(list) ? list : []).filter((t) => ok.includes(t)))].slice(0, 3);
    this.s.vote.picks[pid] = picks;
    this.publish();
  },
  gameTally() {
    const pts = {};
    for (const t of this.gameOptions()) pts[t] = 0;
    for (const picks of Object.values(this.s.vote.picks || {})) picks.forEach((t, i) => { if (pts[t] != null) pts[t] += 3 - i; });
    return Object.entries(pts).map(([type, p]) => ({ type, pts: p })).sort((a, b) => b.pts - a.pts || this.gameOptions().indexOf(a.type) - this.gameOptions().indexOf(b.type));
  },
  lockLineup() {
    const voted = this.gameTally().filter((x) => x.pts > 0).map((x) => x.type);
    if (!voted.length) { this.s.settings.lineup = null; return; }
    const k = LINEUP_SIZE[this.s.settings.remixLength] || 7;
    const fill = this.gameOptions().filter((t) => !voted.includes(t));
    // keep the room's picks in vote order, then top up with the house favorites
    this.s.settings.lineup = [...voted, ...fill].slice(0, k);
  },

  // ---------- beef ----------
  onBeef(pid, to, topic) {
    if (this.s.phase !== 'lobby' || this.setupState().step !== 'beef') return;
    if (!this.s.players[pid] || !this.s.players[to] || pid === to) return;
    if (this.s.beefs.some((b) => b.from === pid && b.status !== 'no')) return;
    if (this.s.beefs.some((b) => (b.from === pid && b.to === to) || (b.from === to && b.to === pid))) return;
    topic = BEEF_TOPICS.includes(topic) ? topic : String(topic || '').trim().slice(0, 50) || BEEF_TOPICS[BEEF_TOPICS.length - 1];
    this.s.beefs.push({ id: 'b' + Math.random().toString(36).slice(2, 7), from: pid, to, topic, status: 'pending', score: {} });
    this.markBeefDone(pid);
    this.fx('beef', { from: pid, to });
    this.publish();
  },
  onBeefReply(pid, id, yes) {
    const b = this.s.beefs.find((x) => x.id === id);
    if (!b || b.to !== pid || b.status !== 'pending') return;
    b.status = yes ? 'on' : 'no';
    this.markBeefDone(pid);
    this.fx(yes ? 'beefon' : 'beefoff', { id });
    this.publish();
  },
  markBeefDone(pid) { const su = this.setupState(); su.beefDone = { ...(su.beefDone || {}), [pid]: true }; },
  onNoBeef(pid) { this.markBeefDone(pid); this.publish(); },
  cancelBeef(id) { this.s.beefs = this.s.beefs.filter((b) => b.id !== id); this.publish(); },
  liveBeefs() {
    return (this.s.beefs || []).filter((b) => b.status === 'on' && this.s.players[b.from] && this.s.players[b.to]);
  },
  // after teams are made: put rivals on opposite teams (swap with someone of the same generation if we can)
  separateBeefs() {
    const T = this.s.teams;
    if (T.length < 2) return;
    const locked = new Set();
    for (const b of this.liveBeefs()) {
      const ta = this.teamOf(b.from), tb = this.teamOf(b.to);
      locked.add(b.from);
      if (!ta || !tb || ta.id !== tb.id) { locked.add(b.to); continue; }
      const other = T.filter((t) => t.id !== ta.id).sort((x, y) => x.members.length - y.members.length)[0];
      const gen = this.s.players[b.to].gen;
      const swap = other.members.find((id) => !locked.has(id) && this.s.players[id] && this.s.players[id].gen === gen) || other.members.find((id) => !locked.has(id));
      ta.members = ta.members.filter((id) => id !== b.to);
      other.members.push(b.to);
      if (swap) { other.members = other.members.filter((id) => id !== swap); ta.members.push(swap); }
      locked.add(b.to);
    }
  },
  // Beef Battles get sprinkled through Round 2
  beefSegments(used) {
    const segs = [];
    for (const b of this.liveBeefs()) {
      const ta = this.teamOf(b.from), tb = this.teamOf(b.to);
      if (!ta || !tb || ta.id === tb.id) continue;
      const qids = [];
      for (let i = 0; i < BEEF_Q; i++) {
        const q = this.pickOne((x) => x.questionType === 'trivia' && x.round === 1 && x.value <= 300, used);
        if (q) { used.add(q.id); qids.push(q.id); }
      }
      if (qids.length) segs.push({ type: 'beef', label: 'Settle the Beef', icon: 'mic', beef: b.id, qids, idx: 0,
        blurb: `${this.s.players[b.from].name} called out ${this.s.players[b.to].name}: “${b.topic}.” ${BEEF_Q} questions, head to head. Winner takes ${BEEF_BONUS} for the team — and the bragging rights.` });
    }
    return segs;
  },
  beefPodium(id) {
    const b = this.s.beefs.find((x) => x.id === id);
    if (!b) return null;
    const ta = this.teamOf(b.from), tb = this.teamOf(b.to);
    return ta && tb ? { [ta.id]: b.from, [tb.id]: b.to } : null;
  },
  beefPoint(q, pid) {
    if (!q || !q.beef) return;
    const b = this.s.beefs.find((x) => x.id === q.beef);
    if (b) b.score[pid] = (b.score[pid] || 0) + 1;
  },
  settleBeef(id) {
    const b = this.s.beefs.find((x) => x.id === id);
    if (!b || b.settled) return;
    const a = b.score[b.from] || 0, c = b.score[b.to] || 0;
    b.settled = true;
    b.winner = a === c ? null : a > c ? b.from : b.to;
    if (b.winner) { const t = this.teamOf(b.winner); if (t) this.award(t.id, BEEF_BONUS, 'beef:' + b.id); }
    this.fx('beefwin', { id, winner: b.winner, a, c });
  },
};
