// ============================================================
// GENERATIONS — Party games (mixed into Engine.prototype).
//   Settle It!            hot_take    vote → two speakers argue → re-vote. The side that GAINS ground wins.
//   Who in the Family…?   most_likely everybody votes for a player. Match the room, score.
//   Top That!             top_that    everybody writes a punchline, the room votes (anonymous).
//   Two Truths & a Lie    two_truths  a rotating teller types 3 statements; the room hunts the lie.
// ============================================================
import { shuffle, uid } from './util.js';

export const PARTY = {
  htVote: 20000, htArgue: 20000, htWin: 200,
  mlVote: 25000, mlMatch: 50,
  ttWrite: 60000, ttVote: 30000, ttPerVote: 50, ttTop: 100,
  twWrite: 90000, twVote: 25000, twRight: 50, twFool: 50,
};
export const PARTY_TYPES = ['hot_take', 'most_likely', 'top_that', 'two_truths'];
export const PARTY_STAGES = ['ht_vote1', 'ht_argue', 'ht_vote2', 'ml_vote', 'tt_write', 'tt_vote', 'tw_write', 'tw_vote'];
const POOL_KEY = { hot_take: 'hotTakes', most_likely: 'mostLikely', top_that: 'topThat' };
const clean = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

const methods = {
  partyAvailable(type) {
    if (type === 'two_truths') return true;
    return (this.extras[POOL_KEY[type]] || []).length > 0;
  },
  partyPrompt(type) {
    return this.deck(type, this.extras[POOL_KEY[type]] || [], 1)[0] || '';
  },
  partyBase(type, label, prompt, stage, extra = {}) {
    this.cur = { full: { id: `__${type}__`, answer: null, culturalContext: '' }, presses: [], lockUntil: {}, votes: {} };
    this.s.q = {
      id: `__${type}__`, type, category: label, prompt, choices: null, value: 0, isDD: false, stage,
      podium: {}, attempted: [], eligible: [], timerEnd: 0, timerTotal: 0, result: null, lockouts: {},
      flipId: uid(5), era: 'all', huddleUntil: 0, huddleUsed: true, awards: null, top: null,
      voteCount: 0, voted: {}, ...extra,
    };
    this.s.phase = 'question';
  },
  partyMark(pid) {
    const q = this.s.q;
    q.voted[pid] = 1;
    q.voteCount = Object.keys(q.voted).length;
    this.fx('vote');
  },
  partyAllIn(exclude = []) {
    const q = this.s.q;
    const need = this.connectedIds().filter((id) => !exclude.includes(id));
    return need.length > 0 && need.every((id) => q.voted[id]);
  },
  partyResetVotes() { const q = this.s.q; q.voted = {}; q.voteCount = 0; this.cur.votes = {}; },
  startParty(type) {
    if (type === 'hot_take') return this.startHotTake();
    if (type === 'most_likely') return this.startMostLikely();
    if (type === 'top_that') return this.startTopThat();
    if (type === 'two_truths') return this.startTwoTruths();
  },

  // ---------- Settle It! ----------
  startHotTake() {
    this.partyBase('hot_take', 'Settle It!', this.partyPrompt('hot_take'), 'ht_vote1', {
      value: PARTY.htWin, ht: { split1: null, split2: null, speakers: null, turn: 0, shift: 0, winSide: null, devil: null },
    });
    this.cur.v1 = {}; this.cur.v2 = {};
    this.setTimer(PARTY.htVote);
    this.fx('flip');
    this.publish();
  },
  htSplit(v) {
    let agree = 0, disagree = 0;
    for (const x of Object.values(v)) { if (x === 'agree') agree++; else if (x === 'disagree') disagree++; }
    return { agree, disagree };
  },
  htArgue() {
    const q = this.s.q, v = this.cur.v1;
    q.ht.split1 = this.htSplit(v);
    const onTeam = (id) => this.teamOf(id) && this.s.players[id] && this.s.players[id].connected;
    const pick = (side, avoidPid, avoidTeam) => {
      let ids = Object.keys(v).filter((id) => v[id] === side && onTeam(id) && id !== avoidPid);
      let devil = false;
      if (!ids.length) { ids = this.connectedIds().filter((id) => onTeam(id) && id !== avoidPid); devil = true; }
      const pref = ids.filter((id) => !avoidTeam || this.teamOf(id).id !== avoidTeam);
      const pool = pref.length ? pref : ids;
      return { pid: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null, devil };
    };
    const a = pick('agree');
    const d = pick('disagree', a.pid, a.pid ? this.teamOf(a.pid).id : null);
    q.ht.speakers = { agree: a.pid, disagree: d.pid };
    q.ht.devil = { agree: a.devil, disagree: d.devil };
    this.cur.v2 = { ...v };           // keep your first vote unless you change it
    this.partyResetVotes();
    q.ht.turn = q.ht.speakers.agree ? 0 : 1;
    if (!q.ht.speakers.agree && !q.ht.speakers.disagree) return this.htVote2();
    q.stage = 'ht_argue';
    this.setTimer(PARTY.htArgue);
    this.fx('buzz', { pid: q.ht.speakers[q.ht.turn ? 'disagree' : 'agree'] });
    this.publish();
  },
  htNextSpeaker() {
    const q = this.s.q;
    if (q.ht.turn === 0 && q.ht.speakers.disagree) {
      q.ht.turn = 1;
      this.setTimer(PARTY.htArgue);
      this.fx('buzz', { pid: q.ht.speakers.disagree });
      return this.publish();
    }
    this.htVote2();
  },
  htVote2() {
    const q = this.s.q;
    q.stage = 'ht_vote2';
    this.partyResetVotes();
    this.setTimer(PARTY.htVote);
    this.fx('whoosh');
    this.publish();
  },
  htReveal() {
    const q = this.s.q;
    const s1 = q.ht.split1, s2 = this.htSplit(this.cur.v2);
    q.ht.split2 = s2;
    const pct = (x) => (x.agree + x.disagree ? x.agree / (x.agree + x.disagree) : 0.5);
    const shift = Math.round((pct(s2) - pct(s1)) * 100);
    q.ht.shift = shift;
    const winSide = shift > 0 ? 'agree' : shift < 0 ? 'disagree' : null;
    q.ht.winSide = winSide;
    const awards = {};
    if (winSide) {
      const sp = q.ht.speakers[winSide], t = sp && this.teamOf(sp);
      if (t) {
        awards[t.id] = q.value; this.award(t.id, q.value, 'settle-it');
        const st = this.stat(sp); st.persuade = (st.persuade || 0) + 1;
      }
    }
    Object.assign(q, { stage: 'reveal', timerEnd: 0, awards, result: 'party', top: winSide ? [winSide] : [] });
    this.fx('partyreveal', { kind: 'ht', side: winSide, pid: winSide ? q.ht.speakers[winSide] : null });
    this.publish();
  },

  // ---------- Who in the Family…? ----------
  startMostLikely() {
    const cands = this.connectedIds().filter((id) => this.teamOf(id));
    this.partyBase('most_likely', 'Who in the Family…?', this.partyPrompt('most_likely'), 'ml_vote', {
      value: PARTY.mlMatch, ml: { cands, counts: null, top: null, matchers: null },
    });
    this.setTimer(PARTY.mlVote);
    this.fx('flip');
    this.publish();
  },
  mlReveal() {
    const q = this.s.q, counts = {};
    for (const t of Object.values(this.cur.votes)) counts[t] = (counts[t] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const top = max ? Object.keys(counts).filter((k) => counts[k] === max) : [];
    const awards = {}, matchers = [];
    for (const [voter, target] of Object.entries(this.cur.votes)) {
      if (!top.includes(target)) continue;
      matchers.push(voter);
      const t = this.teamOf(voter);
      if (t) awards[t.id] = (awards[t.id] || 0) + q.value;
    }
    for (const [tid, pts] of Object.entries(awards)) this.award(tid, pts, 'most-likely');
    for (const pid of top) { const st = this.stat(pid); st.crowned = (st.crowned || 0) + 1; }
    q.ml.counts = counts; q.ml.top = top; q.ml.matchers = matchers;
    Object.assign(q, { stage: 'reveal', timerEnd: 0, awards, result: 'party', top });
    this.fx('partyreveal', { kind: 'ml', pid: top[0] || null, n: top.length });
    this.publish();
  },

  // ---------- Top That! ----------
  startTopThat() {
    this.partyBase('top_that', 'Top That!', this.partyPrompt('top_that'), 'tt_write', {
      value: PARTY.ttPerVote, tt: { entries: null, topIds: null },
    });
    this.cur.tt = {};
    this.setTimer(PARTY.ttWrite);
    this.fx('flip');
    this.publish();
  },
  ttVoteStage() {
    const q = this.s.q;
    const list = shuffle(Object.entries(this.cur.tt));
    this.cur.ttAuthors = {};
    q.tt.entries = list.map(([pid, text], i) => { this.cur.ttAuthors['e' + i] = pid; return { id: 'e' + i, text, hidden: false }; });
    if (q.tt.entries.length < 2) return this.ttReveal();
    q.stage = 'tt_vote';
    this.partyResetVotes();
    this.setTimer(PARTY.ttVote);
    this.fx('whoosh');
    this.publish();
  },
  ttHide(eid) {
    const q = this.s.q;
    if (!q || q.type !== 'top_that' || !q.tt.entries) return;
    const e = q.tt.entries.find((x) => x.id === eid);
    if (!e) return;
    e.hidden = !e.hidden;
    if (e.hidden) for (const [pid, v] of Object.entries(this.cur.votes)) if (v === eid) { delete this.cur.votes[pid]; delete q.voted[pid]; }
    q.voteCount = Object.keys(q.voted).length;
    this.publish();
  },
  ttReveal() {
    const q = this.s.q, counts = {};
    for (const v of Object.values(this.cur.votes)) counts[v] = (counts[v] || 0) + 1;
    const entries = (q.tt.entries || []).filter((e) => !e.hidden);
    for (const e of entries) { e.votes = counts[e.id] || 0; e.by = this.cur.ttAuthors[e.id]; }
    entries.sort((a, b) => b.votes - a.votes);
    const max = entries.length ? entries[0].votes : 0;
    const topIds = max ? entries.filter((e) => e.votes === max).map((e) => e.id) : [];
    const awards = {};
    for (const e of entries) {
      const t = this.teamOf(e.by);
      if (!t) continue;
      let pts = e.votes * q.value + (topIds.includes(e.id) ? PARTY.ttTop : 0);
      if (pts) awards[t.id] = (awards[t.id] || 0) + pts;
      if (e.votes) { const st = this.stat(e.by); st.laughs = (st.laughs || 0) + e.votes; }
    }
    for (const [tid, pts] of Object.entries(awards)) this.award(tid, pts, 'top-that');
    q.tt.entries = entries; q.tt.topIds = topIds;
    Object.assign(q, { stage: 'reveal', timerEnd: 0, awards, result: 'party', top: topIds });
    this.fx('partyreveal', { kind: 'tt', pid: topIds.length ? entries[0].by : null });
    this.publish();
  },

  // ---------- Two Truths & a Lie ----------
  startTwoTruths() {
    const teams = this.s.teams.filter((t) => t.members.some((id) => this.s.players[id] && this.s.players[id].connected));
    const team = teams[(this.twCount = (this.twCount || 0) + 1) % Math.max(1, teams.length)] || this.s.teams[0];
    const teller = this.podiumFor(team);
    this.partyBase('two_truths', 'Two Truths & a Lie', '', 'tw_write', {
      value: PARTY.twRight, podium: { [team.id]: teller },
      tw: { teller, team: team.id, statements: null, lie: null, counts: null, right: null, fooled: 0 },
    });
    this.setTimer(PARTY.twWrite);
    this.fx('buzz', { pid: teller, team: team.id });
    this.publish();
  },
  twVoteStage() {
    const q = this.s.q;
    q.stage = 'tw_vote';
    this.partyResetVotes();
    this.setTimer(PARTY.twVote);
    this.fx('whoosh');
    this.publish();
  },
  twReveal() {
    const q = this.s.q, tw = q.tw;
    const awards = {}, counts = [0, 0, 0], right = [];
    let fooled = 0;
    if (tw.statements) {
      tw.lie = this.cur.twLie;
      for (const [pid, i] of Object.entries(this.cur.votes)) {
        counts[i] = (counts[i] || 0) + 1;
        const t = this.teamOf(pid);
        if (i === tw.lie) right.push(pid);
        if (!t || t.id === tw.team) continue;          // teammates know the teller — no points either way
        if (i === tw.lie) awards[t.id] = (awards[t.id] || 0) + PARTY.twRight;
        else fooled++;
      }
      if (fooled) {
        awards[tw.team] = (awards[tw.team] || 0) + fooled * PARTY.twFool;
        const st = this.stat(tw.teller); st.fooled = (st.fooled || 0) + fooled;
      }
      for (const [tid, pts] of Object.entries(awards)) this.award(tid, pts, 'two-truths');
    }
    tw.counts = counts; tw.right = right; tw.fooled = fooled;
    Object.assign(q, { stage: 'reveal', timerEnd: 0, awards, result: tw.statements ? 'party' : 'skipped', top: [] });
    this.fx('partyreveal', { kind: 'tw', pid: tw.teller, fooled, ok: !!tw.statements });
    this.publish();
  },

  // ---------- inputs ----------
  onParty(pid, m) {
    const q = this.s.q;
    if (!q || this.s.paused || !this.s.players[pid] || !PARTY_STAGES.includes(q.stage)) return;
    switch (q.stage) {
      case 'ht_vote1': case 'ht_vote2': {
        if (!['agree', 'disagree'].includes(m.v)) return;
        (q.stage === 'ht_vote1' ? this.cur.v1 : this.cur.v2)[pid] = m.v;
        this.partyMark(pid);
        if (this.partyAllIn()) return q.stage === 'ht_vote1' ? this.htArgue() : this.htReveal();
        return this.publish();
      }
      case 'ml_vote': {
        if (m.v === pid || !q.ml.cands.includes(m.v) || q.voted[pid]) return;
        this.cur.votes[pid] = m.v;
        this.partyMark(pid);
        if (this.partyAllIn()) return this.mlReveal();
        return this.publish();
      }
      case 'tt_write': {
        const text = clean(m.text, 80);
        if (!text) return;
        this.cur.tt[pid] = text;
        this.partyMark(pid);
        if (this.partyAllIn()) return this.ttVoteStage();
        return this.publish();
      }
      case 'tt_vote': {
        const e = (q.tt.entries || []).find((x) => x.id === m.v);
        if (!e || e.hidden || this.cur.ttAuthors[e.id] === pid) return;
        this.cur.votes[pid] = e.id;
        this.partyMark(pid);
        const authorsOnly = this.connectedIds().filter((id) => {
          const mine = Object.keys(this.cur.ttAuthors).filter((k) => this.cur.ttAuthors[k] === id);
          return q.tt.entries.filter((x) => !x.hidden && !mine.includes(x.id)).length === 0; // nothing they can vote for
        });
        if (this.partyAllIn(authorsOnly)) return this.ttReveal();
        return this.publish();
      }
      case 'tw_write': {
        if (pid !== q.tw.teller) return;
        const st = (m.list || []).slice(0, 3).map((x) => clean(x, 90));
        const lie = +m.lie;
        if (st.length !== 3 || st.some((x) => !x) || ![0, 1, 2].includes(lie)) return;
        q.tw.statements = st;
        this.cur.twLie = lie;
        return this.twVoteStage();
      }
      case 'tw_vote': {
        const i = +m.v;
        if (pid === q.tw.teller || ![0, 1, 2].includes(i)) return;
        this.cur.votes[pid] = i;
        this.partyMark(pid);
        if (this.partyAllIn([q.tw.teller])) return this.twReveal();
        return this.publish();
      }
    }
  },
  // host Next / timer expiry for party stages. Returns true when handled.
  partyNext() {
    const q = this.s.q;
    if (!q || !PARTY_STAGES.includes(q.stage)) return false;
    switch (q.stage) {
      case 'ht_vote1': this.htArgue(); break;
      case 'ht_argue': this.htNextSpeaker(); break;
      case 'ht_vote2': this.htReveal(); break;
      case 'ml_vote': this.mlReveal(); break;
      case 'tt_write': this.ttVoteStage(); break;
      case 'tt_vote': this.ttReveal(); break;
      case 'tw_write': this.twReveal(); break;
      case 'tw_vote': this.twReveal(); break;
    }
    return true;
  },
  partyPrivate(v) {
    const q = this.s.q;
    if (!q) return;
    if (q.type === 'two_truths' && this.cur && this.cur.twLie !== undefined && q.tw.statements) {
      v.answerText = `The lie is #${this.cur.twLie + 1}: ${q.tw.statements[this.cur.twLie]}`;
    }
    if (q.type === 'top_that' && q.tt.entries && this.cur.ttAuthors) {
      v.entries = q.tt.entries.map((e) => ({ id: e.id, text: e.text, hidden: !!e.hidden, by: this.s.players[this.cur.ttAuthors[e.id]]?.name || '?' }));
    }
    if (q.type === 'hot_take' || q.type === 'most_likely') v.answerText = 'No right answer — the room decides';
  },

  // ---------- Season mode ----------
  recordSeason() {
    const s = this.s;
    if (!s.gameId) return;
    s.season = s.season || { ep: 0, teams: {}, recorded: null };
    s.season.teams = s.season.teams || {};
    if (s.season.recorded === s.gameId) return;
    s.season.recorded = s.gameId;
    s.season.ep = (s.season.ep || 0) + 1;
    for (const t of s.teams) {
      const r = (s.season.teams[t.name] = s.season.teams[t.name] || { pts: 0, wins: 0, color: t.color });
      r.pts += t.score; r.color = t.color;
      if ((s.winners || []).includes(t.id)) r.wins++;
    }
  },
  nextEpisode() {
    const s = this.s;
    Object.assign(s, { q: null, final: null, remix: null, winners: null, awards: null, board: null, spin: null, paused: false });
    this.cur = null;
    if (s.settings.format !== 'party') s.categories = this.freshCategories();
    this.startGame({ keepRotation: true });
  },
  resetSeason() { this.s.season = null; this.publish(); },
};

export function installParty(Engine) { Object.assign(Engine.prototype, methods); }
