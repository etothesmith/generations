// ============================================================
// GENERATIONS — game engine (runs on the HOST screen only).
// Owns the full game state, processes player inputs, runs timers,
// and publishes a player-safe copy of the state.
// ============================================================
import { genFromYear, GENERATIONS, GEN_ORDER, TEAM_COLORS, TEAM_NAMES, shuffle, uid } from './util.js';
import { installParty, PARTY_TYPES, PARTY_STAGES } from './party.js';
import { AutoHostMixin } from './autohost.js';
export { PARTY, PARTY_TYPES } from './party.js';

export const TIMES = {
  open: 12000, answer: 10000, steal: 5000, stealOpen: 6000, ddAnswer: 15000,
  wager: 25000, vote: 20000, pick: 15000, pitch: 10000, pitchVote: 15000,
  finalWager: 30000, finalAnswer: 45000, collect: 300, falseStart: 1000, huddle: 15000,
};
export const DEFAULT_CATS = ['Slang Across the Generations', 'Classic Black Cinema', 'Motown & Soul', 'Black TV Classics', 'Black History Deep Cuts', 'Card Check'];
export const CAT_ICONS = {
  'Slang Across the Generations': 'hashtag', 'Black TV Classics': 'tv', 'Who Said It?': 'mic',
  'Black History Deep Cuts': 'sankofa', 'Trailblazers': 'crown', 'Card Check': 'card',
  'Classic Black Cinema': 'film', 'Motown & Soul': 'vinyl', 'R&B & Hip-Hop': 'boombox',
  'Sports Legends': 'basketball', 'Church & Gospel': 'church', "Little Ones' Corner": 'balloon',
  'Black America Road Trip': 'star', 'Civil Rights Movement': 'mic', 'Inventors & Innovators': 'bolt',
  'HBCU Life': 'gradcap', 'Comedy Kings & Queens': 'masks', 'Soul Food Kitchen': 'skillet', 'Soul Train & Dance': 'shoes',
  'Black Business & Money': 'card', 'Barbershop & Beauty Shop': 'crown', 'Jazz & Blues': 'vinyl',
};
// generation a question was written for -> who gets a Crossover Bonus for answering it
const GEN_GROUP = { elders: 'elders', genx: 'genx', millennial: 'millennial', genz: 'genz', alpha: 'genz' };
export const ANSWER_TIMES = { quick: 10000, relaxed: 15000, family: 20000 };
export const REMIX_LENGTHS = {
  short: { majority_rules: 1, hot_take: 1, hashtag: 0, most_likely: 1, saying: 1, top_that: 0, emoji: 1, family_survey: 1, two_truths: 0, sing_it: 1, hum_it: 0, charades: 0, one_gotta_go: 0, name_that_era: 1, blitz: 1 },
  normal: { majority_rules: 1, hot_take: 1, hashtag: 1, most_likely: 2, saying: 1, top_that: 1, emoji: 1, family_survey: 1, two_truths: 1, sing_it: 2, hum_it: 1, charades: 1, one_gotta_go: 1, name_that_era: 1, blitz: 1 },
  long: { majority_rules: 2, hot_take: 2, hashtag: 2, most_likely: 3, saying: 2, top_that: 2, emoji: 2, family_survey: 2, two_truths: 2, sing_it: 3, hum_it: 1, charades: 1, one_gotta_go: 1, name_that_era: 2, blitz: 1 },
};
// "Party Night" show format: no board, the whole night is the fun stuff
export const PARTY_LENGTHS = {
  short: { majority_rules: 1, hot_take: 2, most_likely: 2, saying: 1, top_that: 1, family_survey: 1, two_truths: 1, sing_it: 2, hum_it: 1, charades: 1, one_gotta_go: 1 },
  normal: { majority_rules: 1, hot_take: 2, most_likely: 3, saying: 1, top_that: 2, emoji: 1, family_survey: 1, two_truths: 2, sing_it: 3, hum_it: 1, charades: 1, one_gotta_go: 1, blitz: 1 },
  long: { majority_rules: 2, hot_take: 3, hashtag: 1, most_likely: 4, saying: 1, top_that: 3, emoji: 1, family_survey: 2, two_truths: 3, sing_it: 4, hum_it: 2, charades: 2, one_gotta_go: 2, name_that_era: 1, blitz: 1 },
};
// 🎓 Practice Run: every game once, with practice-only content (data/practice.json) that never enters real games
export const PRACTICE_PLAN = [
  { type: 'trivia', label: 'Buzz-In Trivia', count: 2, icon: 'mic', blurb: "🎓 PRACTICE · Each team has one player at the podium (it rotates every question). WAIT for BUZZ! on your phone — buzz early and you're locked out for a second. First buzz answers; miss it and the other team can STEAL. Stuck? Tap 📞 Family Huddle for 15 seconds of team help." },
  { type: 'majority_rules', label: 'Majority Rules', count: 1, icon: 'stamp', blurb: '🎓 PRACTICE · EVERYBODY votes on their phone. No right answer — pick what you think the ROOM will pick. Match the majority and your team scores.' },
  { type: 'hot_take', label: 'Settle It!', count: 1, icon: 'mic', party: true, blurb: '🎓 PRACTICE · Vote Agree or Disagree on the hot take. One person from each side argues for 20 seconds, then everybody votes again. The side that changes the most minds wins.' },
  { type: 'most_likely', label: 'Who in the Family…?', count: 1, icon: 'crown', party: true, blurb: '🎓 PRACTICE · Vote for the player MOST likely to do the thing (not yourself!). Pick who the room picks to score.' },
  { type: 'top_that', label: 'Top That!', count: 1, icon: 'smiley', party: true, blurb: "🎓 PRACTICE · Finish the sentence on your phone — funniest wins. Answers show with no names, and you can't vote for your own." },
  { type: 'two_truths', label: 'Two Truths & a Lie', count: 1, icon: 'masks', party: true, blurb: '🎓 PRACTICE · One player types two true things and one lie (and taps which one is the lie). Everyone else votes on the lie.' },
  { type: 'sing_it', label: 'Sing It!', count: 1, icon: 'mic', party: true, blurb: '🎓 PRACTICE · A word drops. Teams take turns singing a song with that word in it before the clock runs out. The host taps ✅ or ❌. No repeats! Last team singing wins.' },
  { type: 'hum_it', label: 'Hum That Tune', count: 1, icon: 'vinyl', party: true, blurb: '🎓 PRACTICE · The hummer sees a song on their phone. HUM it — no words! Tap ✓ Got it when your team says the title, ↷ Skip to pass.' },
  { type: 'charades', label: 'Culture Charades', count: 1, icon: 'masks', blurb: '🎓 PRACTICE · The actor sees a clue on their phone. Act it out with NO talking. Tap ✓ Got it or ↷ Skip.' },
  { type: 'one_gotta_go', label: "One's Gotta Go", count: 1, icon: 'pie', blurb: '🎓 PRACTICE · Podium players pick one to kick out, make a 10-second case, then the room votes on the best defense.' },
  { type: 'saying', label: 'Mama Said', count: 1, icon: 'slipper', blurb: '🎓 PRACTICE · Buzz in and finish the saying.' },
  { type: 'emoji', label: 'Emoji Decode', count: 1, icon: 'smiley', blurb: '🎓 PRACTICE · Buzz in and name what the emojis mean.' },
  { type: 'blitz', label: '60-Second Blitz', count: 1, icon: 'bolt', blurb: '🎓 PRACTICE · Podium players answer as many as they can on their phones before the clock runs out. Tap fast!' },
];
export const SHOW_FORMATS = {
  classic: { label: 'Classic Show', blurb: 'Board → Remix → Final Wager' },
  party: { label: 'Party Night', blurb: 'No board — all the laughs & arguments' },
  trivia: { label: 'Trivia Only', blurb: 'Straight culture knowledge, no party games' },
  practice: { label: '🎓 Practice Run', blurb: 'Learn every game with practice questions (they never show up in real games)' },
};
export const REMIX_PLAN = [
  { type: 'majority_rules', label: 'Majority Rules', count: 2, icon: 'stamp', blurb: 'EVERYBODY votes on their phone. Match the room, earn 50 for your team!' },
  { type: 'hot_take', label: 'Settle It!', count: 1, icon: 'mic', party: true, blurb: "A hot take hits the screen. EVERYBODY votes Agree or Disagree. One person from each side gets 20 seconds to argue — then we vote again. Whoever flips the room wins 200!" },
  { type: 'hashtag', label: 'Hashtag Decode', count: 2, icon: 'hashtag', blurb: 'Podium players: buzz in and decode the hashtag. 200 points!' },
  { type: 'most_likely', label: 'Who in the Family…?', count: 2, icon: 'crown', party: true, blurb: "Who in this family is MOST likely to…? Everybody votes for somebody (not yourself!). Pick who the room picks and your team gets 50. No hard feelings!" },
  { type: 'saying', label: 'Mama Said', count: 2, icon: 'slipper', blurb: 'Every family has the sayings. Buzz in and finish what Mama (or Grandma) always said!' },
  { type: 'top_that', label: 'Top That!', count: 1, icon: 'smiley', party: true, blurb: "Finish the sentence on your phone — funniest answer wins. Answers are anonymous until the votes are in. +50 per vote, +100 for the room's favorite!" },
  { type: 'emoji', label: 'Emoji Decode', count: 2, icon: 'smiley', blurb: 'Movies, shows and songs — in emoji. Buzz in and name it!' },
  { type: 'family_survey', label: 'The Family Survey', count: 1, icon: 'stamp', blurb: "Remember those survey questions on your phone? We asked YOUR family. Find the top answers — three strikes and the other team can steal!" },
  { type: 'two_truths', label: 'Two Truths & a Lie', count: 1, icon: 'masks', party: true, blurb: "One family member secretly types two true stories and one lie about themselves. Everybody else hunts the lie. Catch it: +50. Fool 'em: the teller's team gets +50 per fooled voter!" },
  { type: 'charades', label: 'Culture Charades', count: 1, icon: 'masks', blurb: "One player per team acts it out — no talking! The team shouts guesses. 45 seconds, +100 for every one you get." },
  { type: 'sing_it', label: 'Sing It!', count: 2, icon: 'mic', party: true, blurb: "A word drops on the screen. Teams take turns SINGING a song with that word in it — 15 seconds on the clock. No repeats! Miss, stall or get ruled out by the host and your team is done. Last team singing wins! +100 a song, +200 to the champs." },
  { type: 'hum_it', label: 'Hum That Tune', count: 1, icon: 'vinyl', party: true, blurb: "One player per team gets a classic song on their phone and HUMS it — no words, no lyrics, no dancing the moves. The team shouts the title. 45 seconds, +100 every one you get!" },
  { type: 'one_gotta_go', label: "One's Gotta Go", count: 1, icon: 'pie', blurb: 'Pick one to kick out, then make your case in 10 seconds. The room votes on the best defense!' },
  { type: 'name_that_era', label: 'Name That Era', count: 3, icon: 'cassette', blurb: 'Buzz in and name the decade. 200 points!' },
  { type: 'blitz', label: '60-Second Blitz', count: 1, icon: 'bolt', blurb: 'Podium players answer as many as they can on their phones in 60 seconds. +100 every time you get one right. GO GO GO!' },
];
export const BLITZ = { seconds: 60, count: 15, points: 100 };
export const SURVEY = { faceoff: 15000, guess: 20000, steal: 25000, mult: 3, maxAnswers: 6 };
export const CHARADES = { seconds: 45, points: 100 };
// Sankofa Spin: a prize wheel every few board tiles in Round 1
export const SPIN = { every: 6, seconds: 5.2, autoSpinMs: 15000 };
export const WHEEL = [
  { label: '+200', short: '+200', color: '#F2B632' },
  { label: 'DOUBLE NEXT', short: '2X', color: '#C8102E' },
  { label: '+1 HUDDLE', short: '📞+1', color: '#1E9E5A' },
  { label: 'COOKOUT! +100 ALL', short: '🍗', color: '#12A4A4' },
  { label: '+300', short: '+300', color: '#5B3FA0' },
  { label: 'SPIN AGAIN', short: '↻', color: '#E2711D' },
];

// ---- fuzzy matching for the Family Survey ----
function normAnswer(t) {
  let x = String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  x = x.replace(/^(a|an|the|my|some|her|his|your|our)\s+/, '');
  x = x.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
  return x;
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function similar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length < b.length ? a : b, long = a.length < b.length ? b : a;
  if (short.length >= 4 && (long.includes(short))) return true;
  return lev(a, b) <= (long.length >= 7 ? 2 : long.length >= 4 ? 1 : 0);
}
const VALUES = [100, 200, 300, 400, 500];
const readMs = (text) => Math.max(2500, Math.min(7000, 1600 + String(text).split(/\s+/).length * 220));

export class Engine {
  constructor(transport, bank, { onChange, onFx, extras }) {
    this.extras = extras || { survey: [], charades: [] };
    this.t = transport;
    this.bank = bank;
    this.byId = Object.fromEntries(bank.map((q) => [q.id, q]));
    this.onChange = onChange || (() => {});
    this.onFx = onFx || (() => {});
    this.cur = null;       // private per-question data (answer key, votes...)
    this.undo = [];
    this.seen = new Set(JSON.parse(localStorage.getItem('gen-seen') || '[]'));
    this.s = {
      code: null, seq: 0, phase: 'lobby', paused: false,
      players: {}, teams: [], teamMode: 'gen', teamCount: 2, canMerge: false,
      round: 0, controlTeam: null, board: null, remix: null, final: null,
      q: null, fx: null, categories: DEFAULT_CATS.slice(),
      settings: { answerTime: 'relaxed', remixLength: 'normal', theme: 'classic', playAlong: true, format: 'classic', remixOff: {}, autoHost: false },
      season: null,
      stats: {},
      survey: null,
    };
    this.surveyAnswers = [];
    this.setupSurvey();
    if (bank.length) this.s.categories = this.freshCategories();
    setInterval(() => this.tick(), 100);
  }
  now() { return this.t.serverNow(); }
  publish() {
    this.s.seq++;
    this.t.publishState(this.s);
    this.onChange(this.s);
    if (this.hostKey && this.t.publishPrivate) {
      const pv = JSON.stringify(this.privateView());
      if (pv !== this._lastPriv) { this._lastPriv = pv; this.t.publishPrivate(this.hostKey, JSON.parse(pv)); }
    }
    // survive an accidental refresh of the host tab
    try { sessionStorage.setItem('gen-host-save', JSON.stringify({ s: this.s, cur: this.cur, undo: this.undo, survey: this.surveyAnswers, at: Date.now() })); } catch (e) { /* storage full/blocked */ }
  }
  restore(saved) {
    Object.assign(this.s, saved.s);
    this.cur = saved.cur;
    this.undo = saved.undo || [];
    if (saved.survey) this.surveyAnswers = saved.survey;
    if (this.s.paused) this.pausedAt = this.now();
  }
  fx(type, data = {}) {
    this.s.fx = { id: uid(6), type, data, at: this.now() };
    this.onFx(type, data);
  }
  markSeen(id) {
    if (this.practice) return;
    this.seen.add(id);
    localStorage.setItem('gen-seen', JSON.stringify([...this.seen]));
  }

  // ---------------- players ----------------
  teamOf(pid) { return this.s.teams.find((t) => t.members.includes(pid)); }
  connectedIds() { return Object.values(this.s.players).filter((p) => p.connected).map((p) => p.pid); }

  setPresence(map) {
    let changed = false;
    for (const p of Object.values(this.s.players)) {
      if (p.bot) continue;
      const c = !!map[p.pid];
      if (p.connected !== c) { p.connected = c; changed = true; }
    }
    if (changed) this.publish();
  }

  onJoin(m) {
    const name = String(m.name || 'Player').trim().slice(0, 16) || 'Player';
    const gen = m.gen || genFromYear(m.year);
    let p = this.s.players[m.pid];
    if (!p) {
      // same name + disconnected = same person on a new phone/tab: take over the seat
      const old = Object.values(this.s.players).find((x) => !x.connected && x.name.toLowerCase() === name.toLowerCase());
      if (old) { this.renamePid(old.pid, m.pid); p = this.s.players[m.pid]; }
    }
    if (!p) {
      p = { pid: m.pid, name, year: m.year || null, gen, avatar: m.avatar || null, connected: true, joinedAt: this.now(), audience: !!m.audience, remote: !!m.remote };
      this.s.players[m.pid] = p;
      if (this.s.teams.length && !p.audience) this.placeLateJoiner(p);
      this.fx('join', { pid: m.pid });
    } else {
      p.name = name; p.year = m.year || p.year; p.gen = gen; if (m.avatar) p.avatar = m.avatar; p.connected = true; p.remote = !!m.remote;
      if (m.audience !== undefined && !this.teamOf(p.pid)) p.audience = !!m.audience;
    }
    this.publish();
  }
  renamePid(oldPid, newPid) {
    const p = this.s.players[oldPid];
    delete this.s.players[oldPid];
    p.pid = newPid; this.s.players[newPid] = p;
    for (const t of this.s.teams) t.members = t.members.map((x) => (x === oldPid ? newPid : x));
    const q = this.s.q;
    if (q) {
      for (const k of Object.keys(q.podium || {})) if (q.podium[k] === oldPid) q.podium[k] = newPid;
      if (q.answerer === oldPid) q.answerer = newPid;
    }
    if (this.s.final && this.s.final.captains) for (const k in this.s.final.captains) if (this.s.final.captains[k] === oldPid) this.s.final.captains[k] = newPid;
  }
  placeLateJoiner(p) {
    let team = this.s.teamMode === 'gen' ? this.s.teams.find((t) => t.gens && t.gens.includes(p.gen === 'alpha' ? 'genz' : p.gen)) : null;
    if (!team) team = this.s.teams.slice().sort((a, b) => a.members.length - b.members.length)[0];
    team.members.push(p.pid);
  }
  kick(pid) {
    delete this.s.players[pid];
    for (const t of this.s.teams) t.members = t.members.filter((x) => x !== pid);
    this.publish();
  }

  // ---------------- teams ----------------
  setTeamMode(mode, count) {
    this.s.teamMode = mode;
    if (count) this.s.teamCount = count;
    this.publish();
  }
  // ---------- team splits ----------
  // Which ways can this room split up? Depends on the generations that actually showed up.
  genGroups() {
    const groups = {};
    for (const p of Object.values(this.s.players).filter((x) => !x.audience)) {
      const g = p.gen === 'alpha' ? 'genz' : (p.gen || 'millennial');
      (groups[g] = groups[g] || []).push(p.pid);
    }
    return groups;
  }
  availableSplits() {
    const g = this.genGroups(), keys = GEN_ORDER.filter((k) => g[k]);
    const n = Object.values(g).reduce((a, b) => a + b.length, 0);
    const has = (...ks) => ks.some((k) => g[k]);
    const out = [];
    if (keys.length >= 2) out.push({ mode: 'gen', label: `Each generation is a team (${keys.length})`, hint: keys.map((k) => `${GENERATIONS[k].label} ${g[k].length}`).join(' · ') });
    if (has('elders', 'genx') && has('millennial', 'genz')) out.push({ mode: 'oldnew', label: 'Old School vs. New School', hint: 'Elders + Gen X vs. Millennials + Gen Z' });
    if (has('elders', 'genz') && has('genx', 'millennial') && keys.length >= 3) out.push({ mode: 'bookends', label: 'Grandparents & Grandkids vs. The Parents', hint: 'Elders + Gen Z vs. Gen X + Millennials' });
    if (n >= 2) out.push({ mode: 'agesplit', label: 'Older Half vs. Younger Half', hint: 'Split right down the middle by birth year — even teams' });
    for (const c of [2, 3, 4]) if (n >= c * 2 || (c === 2 && n >= 2)) out.push({ mode: 'mixed', n: c, label: `Mixed Generations ×${c}`, hint: 'Every team gets young AND old' });
    for (const c of [2, 3, 4]) if (n >= c * 2 || (c === 2 && n >= 2)) out.push({ mode: 'random', n: c, label: `Random ×${c}`, hint: 'Pure luck of the draw' });
    return out;
  }
  formTeams() {
    const players = Object.values(this.s.players).filter((p) => !p.audience);
    const groups = this.genGroups();
    const keys = GEN_ORDER.filter((g) => groups[g]);
    const birth = (p) => p.year || { elders: 1955, genx: 1972, millennial: 1988, genz: 2004, alpha: 2015 }[p.gen] || 1990;
    const mode = this.s.teamMode;
    let teams = [];
    const pids = (list) => list.map((p) => p.pid);
    const OLD = ['elders', 'genx'];
    if (mode === 'gen') {
      if (keys.length < 2) { this.s.teamMode = 'agesplit'; return this.formTeams(); }
      teams = keys.map((g, i) => this.newTeam(i, GENERATIONS[g].nick, GENERATIONS[g].color, groups[g], [g]));
    } else if (mode === 'oldnew') {
      return this.mergeOldNew();
    } else if (mode === 'bookends') {
      const a = players.filter((p) => ['elders', 'genz', 'alpha'].includes(p.gen)), b = players.filter((p) => !['elders', 'genz', 'alpha'].includes(p.gen));
      if (!a.length || !b.length) { this.s.teamMode = 'agesplit'; return this.formTeams(); }
      teams = [this.newTeam(0, 'Grandparents & Grandkids', '#5B3FA0', pids(a), ['elders', 'genz']), this.newTeam(1, 'The Parents', '#E2711D', pids(b), ['genx', 'millennial'])];
    } else if (mode === 'agesplit') {
      const sorted = players.slice().sort((a, b) => birth(a) - birth(b));
      const half = Math.ceil(sorted.length / 2);
      teams = [this.newTeam(0, 'The Older Crew', '#F2B632', pids(sorted.slice(0, half)), null), this.newTeam(1, 'The Younger Crew', '#12A4A4', pids(sorted.slice(half)), null)];
    } else {
      const n = Math.max(2, Math.min(4, this.s.teamCount, players.length));
      const names = shuffle(TEAM_NAMES);
      teams = Array.from({ length: n }, (_, i) => this.newTeam(i, names[i], TEAM_COLORS[i], []));
      if (mode === 'mixed') {
        // snake draft by age so every team gets a spread of generations
        const order = shuffle(players).sort((a, b) => birth(a) - birth(b));
        order.forEach((p, i) => { const r = Math.floor(i / n), k = i % n; teams[r % 2 ? n - 1 - k : k].members.push(p.pid); });
      } else {
        shuffle(players).forEach((p, i) => teams[i % n].members.push(p.pid));
      }
    }
    this.s.teams = teams;
    this.s.canMerge = mode === 'gen' && teams.some((t) => t.members.length < 2);
    this.s.phase = 'teams';
    this.publish();
  }
  mergeOldNew() {
    const players = Object.values(this.s.players).filter((p) => !p.audience);
    const old = players.filter((p) => ['elders', 'genx'].includes(p.gen)).map((p) => p.pid);
    const neu = players.filter((p) => !['elders', 'genx'].includes(p.gen)).map((p) => p.pid);
    if (!old.length || !neu.length) {
      // everybody's the same generation — fall back to random teams
      this.s.teamMode = 'agesplit';
      return this.formTeams();
    }
    this.s.teams = [
      this.newTeam(0, 'Old School', '#F2B632', old, ['elders', 'genx']),
      this.newTeam(1, 'New School', '#12A4A4', neu, ['millennial', 'genz']),
    ];
    this.s.canMerge = false;
    this.s.phase = 'teams';
    this.publish();
  }
  newTeam(i, name, color, members, gens) {
    return { id: 't' + i, name, color, score: 0, lifelines: 2, rot: 0, members, gens: gens || null };
  }
  movePlayer(pid) {
    const t = this.teamOf(pid);
    if (!t || this.s.teams.length < 2) return;
    const i = this.s.teams.indexOf(t);
    t.members = t.members.filter((x) => x !== pid);
    this.s.teams[(i + 1) % this.s.teams.length].members.push(pid);
    this.publish();
  }
  renameTeam(id, name) {
    const t = this.s.teams.find((x) => x.id === id);
    if (t && name.trim()) { t.name = name.trim().slice(0, 28); this.publish(); }
  }
  podiumFor(team) {
    const m = team.members;
    if (!m.length) return null;
    for (let k = 0; k < m.length; k++) {
      const pid = m[(team.rot + k) % m.length];
      if (this.s.players[pid] && this.s.players[pid].connected) return pid;
    }
    return m[team.rot % m.length];
  }
  rotate(teamIds) {
    for (const t of this.s.teams) {
      if (teamIds && !teamIds.includes(t.id)) continue;
      const cur = this.podiumFor(t);
      const i = t.members.indexOf(cur);
      t.rot = t.members.length ? (i + 1) % t.members.length : 0;
    }
  }

  // ---------------- scoring ----------------
  award(teamId, delta, label) {
    const t = this.s.teams.find((x) => x.id === teamId);
    if (!t || !delta) return;
    t.score += delta;
    this.undo.push({ teamId, delta, label });
    if (this.undo.length > 50) this.undo.shift();
  }
  manualScore(teamId, delta) { this.award(teamId, delta, 'manual'); this.publish(); }
  undoLast() {
    const u = this.undo.pop();
    if (!u) return;
    const t = this.s.teams.find((x) => x.id === u.teamId);
    if (t) t.score -= u.delta;
    this.fx('undo', u);
    this.publish();
  }

  // ---------------- question picking ----------------
  pool(filter) {
    const all = this.bank.filter(filter);
    const fresh = all.filter((q) => !this.seen.has(q.id));
    return { all, fresh };
  }
  pickOne(filter, exclude) {
    const { all, fresh } = this.pool((q) => filter(q) && !exclude.has(q.id));
    const list = fresh.length ? fresh : all;
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  availableCategories() {
    const cats = {};
    for (const q of this.bank) if (q.round === 1 && ['trivia', 'hashtag', 'name_that_era'].includes(q.questionType)) cats[q.category] = (cats[q.category] || 0) + 1;
    return Object.entries(cats).filter(([, n]) => n >= 5).map(([c]) => c);
  }
  setCategories(list) { this.s.categories = list; this.publish(); }
  shuffleCategories() {
    const cats = this.freshCategories();
    // keep at least one "for everybody" category in the mix
    const pick = cats.slice(0, 6);
    if (!pick.includes('Card Check') && cats.includes('Card Check')) pick[5] = 'Card Check';
    this.s.categories = pick;
    this.publish();
  }
  setSetting(k, v) { this.s.settings[k] = v; this.publish(); }
  answerMs() { return ANSWER_TIMES[this.s.settings.answerTime] || TIMES.answer; }
  stat(pid) { return (this.s.stats[pid] = this.s.stats[pid] || { correct: 0, crossovers: 0, steals: 0, points: 0 }); }

  buildBoard() {
    const used = new Set();
    const cats = this.s.categories.map((name) => {
      const tiles = VALUES.map((v) => {
        let q = this.pickOne((x) => x.round === 1 && x.category === name && x.value === v, used);
        if (!q) q = this.pickOne((x) => x.round === 1 && x.category === name, used);
        if (q) used.add(q.id);
        return { qid: q ? q.id : null, value: v, used: !q, dd: false };
      });
      return { name, icon: CAT_ICONS[name] || 'stamp', tiles };
    });
    // two Family Wagers, different categories, never in the $100 row
    const spots = shuffle(cats.flatMap((c, ci) => c.tiles.map((t, ti) => ({ ci, ti })).filter((x) => x.ti > 0 && !c.tiles[x.ti].used)));
    const picked = [];
    for (const s of spots) {
      if (picked.length >= 2) break;
      if (!picked.some((p) => p.ci === s.ci)) picked.push(s);
    }
    picked.forEach(({ ci, ti }) => { cats[ci].tiles[ti].dd = true; });
    return { cats };
  }

  // ---------------- flow ----------------
  startGame(opts = {}) {
    for (const t of this.s.teams) { t.score = 0; t.lifelines = 2; if (!opts.keepRotation) t.rot = 0; }
    this.s.gameId = uid(6);
    this.s.winners = null; this.s.awards = null;
    this.undo = [];
    this.s.stats = {};
    this.s.tilesPlayed = 0; this.s.nextMult = 0;
    this.s.controlTeam = this.s.teams[0] ? this.s.teams[0].id : null;
    if (this.s.settings.format === 'practice') {
      this.enterPractice();
      this.s.board = null;
      this.fx('showopen');
      return this.startRound2({ quiet: true });
    }
    this.exitPractice();
    if (this.s.settings.format === 'party') {
      this.s.board = null;
      this.fx('showopen');
      return this.startRound2({ quiet: true });
    }
    this.s.round = 1;
    this.s.board = this.buildBoard();
    this.s.phase = 'board';
    this.fx('showopen');
    this.publish();
  }
  pickTile(ci, ti) {
    if (this.s.phase !== 'board') return;
    const tile = this.s.board.cats[ci].tiles[ti];
    if (!tile || tile.used || !tile.qid) return;
    this.startQuestion(this.byId[tile.qid], { ci, ti, dd: tile.dd, value: tile.value });
  }
  setTimer(ms) {
    this.s.q.timerEnd = this.now() + ms;
    this.s.q.timerTotal = ms;
  }
  startQuestion(full, opts = {}) {
    const podium = {};
    for (const t of this.s.teams) { const p = this.podiumFor(t); if (p) podium[t.id] = p; }
    // shuffle answer positions so nobody learns "it's always A"
    if (['trivia', 'hashtag', 'saying', 'emoji'].includes(full.questionType) && full.choices && full.choices.length && 'ABCD'.includes(full.answer)) {
      const right = full.choices['ABCD'.indexOf(full.answer)];
      const ch = shuffle(full.choices);
      full = { ...full, choices: ch, answer: 'ABCD'[ch.indexOf(right)] };
    }
    this.cur = { full, opts, presses: [], collectUntil: 0, lockUntil: {}, votes: {}, defense: {} };
    if (!opts.dd) this.s.nextMult = 0;
    const q = this.s.q = {
      id: full.id, type: full.questionType, category: full.category, prompt: full.prompt,
      choices: full.choices && full.choices.length ? full.choices : null,
      value: (opts.value || full.value || 0) * (this.s.nextMult && !opts.dd ? this.s.nextMult : 1), isDD: !!opts.dd, doubled: !!(this.s.nextMult && !opts.dd),
      stage: '', podium, attempted: [], eligible: Object.keys(podium),
      buzzWinner: null, answerer: null, steal: false, timerEnd: 0, timerTotal: 0,
      chosen: null, result: null, answer: null, answerText: null, context: null,
      wager: null, stamp: null, voteCount: 0, counts: null, top: null, awards: null,
      ogg: null, huddleUntil: 0, huddleUsed: false, lockouts: {}, flipId: uid(5),
      era: full.generationEra || 'all', crossover: null,
    };
    this.s.phase = 'question';
    this.fx('flip');
    const type = full.questionType;
    if (type === 'majority_rules') { q.stage = 'vote'; this.setTimer(TIMES.vote); }
    else if (type === 'one_gotta_go') {
      q.stage = 'pick'; this.setTimer(TIMES.pick);
      q.ogg = { picks: {}, order: Object.keys(podium), pitchIdx: -1 };
    } else if (q.isDD) {
      const team = this.s.controlTeam && podium[this.s.controlTeam] ? this.s.controlTeam : Object.keys(podium)[0];
      q.answerer = podium[team];
      q.eligible = [team];
      q.stage = 'wager';
      q.maxWager = Math.max(this.s.teams.find((t) => t.id === team).score, 500);
      this.setTimer(TIMES.wager);
      this.fx('dailydouble', { team });
    } else { q.stage = 'reading'; this.setTimer(readMs(full.prompt)); }
    this.publish();
  }
  openBuzzers() {
    const q = this.s.q;
    if (!q || !['reading', 'open'].includes(q.stage)) return;
    q.stage = 'open';
    q.buzzWinner = null; q.answerer = null;
    this.cur.presses = []; this.cur.collectUntil = 0;
    this.setTimer(q.steal ? TIMES.stealOpen : TIMES.open);
    this.fx('open');
    this.publish();
  }
  onBuzz(pid, t) {
    const q = this.s.q;
    if (!q || this.s.paused || this.s.phase !== 'question') return;
    const team = this.teamOf(pid);
    if (!team || q.podium[team.id] !== pid || !q.eligible.includes(team.id)) return;
    const now = this.now();
    if (q.stage === 'reading') {
      this.cur.lockUntil[pid] = now + TIMES.falseStart;
      q.lockouts[pid] = now + TIMES.falseStart;
      this.fx('falsestart', { pid });
      this.publish();
      return;
    }
    if (q.stage !== 'open') return;
    if ((this.cur.lockUntil[pid] || 0) > now) return;
    if (this.cur.presses.some((p) => p.pid === pid)) return;
    this.cur.presses.push({ pid, t: Math.min(t || now, now) });
    if (!this.cur.collectUntil) this.cur.collectUntil = now + TIMES.collect;
  }
  resolveBuzz() {
    const q = this.s.q;
    const winner = this.cur.presses.slice().sort((a, b) => a.t - b.t)[0];
    this.cur.collectUntil = 0;
    if (!winner || q.stage !== 'open') return;
    q.buzzWinner = winner.pid;
    this.fx('buzz', { pid: winner.pid, team: this.teamOf(winner.pid).id });
    if (q.type === 'family_survey') return this.surveyTurn(winner.pid, 'fo_answer', SURVEY.faceoff);
    this.goAnswering(winner.pid, q.steal ? Math.round(this.answerMs() / 2) : this.answerMs());
  }
  goAnswering(pid, ms) {
    const q = this.s.q;
    q.stage = 'answering';
    q.answerer = pid;
    q.chosen = null;
    this.setTimer(ms);
    this.publish();
  }
  onWager(pid, amount) {
    const q = this.s.q;
    if (!q || q.stage !== 'wager' || pid !== q.answerer) return;
    q.wager = Math.max(5, Math.min(q.maxWager, Math.round(+amount || 0)));
    this.fx('reveal');
    this.goAnswering(pid, this.answerMs() + 5000);
  }
  onAnswer(pid, choice) {
    const q = this.s.q;
    if (!q || q.stage !== 'answering' || pid !== q.answerer || !q.choices || this.s.paused) return;
    q.chosen = choice;
    q.answerMs = q.timerTotal && !q.huddleUsed ? this.now() - (q.timerEnd - q.timerTotal) : null;
    this.judge(choice === this.cur.full.answer);
  }
  onLifeline(pid) {
    const q = this.s.q;
    if (!q || q.stage !== 'answering' || pid !== q.answerer || q.huddleUsed) return;
    const team = this.teamOf(pid);
    if (!team || team.lifelines <= 0) return;
    team.lifelines--;
    q.huddleUsed = true;
    q.huddleUntil = this.now() + TIMES.huddle;
    q.timerEnd += TIMES.huddle;
    q.timerTotal += TIMES.huddle;
    this.fx('huddle', { team: team.id });
    this.publish();
  }
  judge(correct) {
    if (this.s.q && this.s.q.type === 'sing_it') return this.singJudge(!!correct);
    const q = this.s.q;
    if (!q || q.stage !== 'answering') return;
    const team = this.teamOf(q.answerer);
    if (!team) return this.reveal();
    if (correct) {
      const pts = q.isDD ? q.wager : q.value;
      this.award(team.id, pts, q.id);
      q.result = 'correct';
      q.winnerTeam = team.id;
      const st = this.stat(q.answerer);
      st.correct++; st.points += pts; if (q.steal) st.steals++;
      // Generation Crossover: answering a question written for ANOTHER generation
      const p = this.s.players[q.answerer];
      const mine = p ? GEN_GROUP[p.gen] : null;
      if (!q.isDD && q.era && q.era !== 'all' && mine && GEN_GROUP[q.era] !== mine) {
        const bonus = Math.max(50, Math.round(q.value / 2 / 50) * 50);
        this.award(team.id, bonus, q.id + ':crossover');
        q.crossover = { bonus, era: q.era };
        st.crossovers++; st.points += bonus;
        setTimeout(() => this.fx('crossover', { pid: q.answerer, bonus, era: q.era }), 900);
      }
      // On Fire: 3+ right in a row
      st.streak = (st.streak || 0) + 1;
      if (st.streak >= 3 && !q.isDD) {
        this.award(team.id, 50, q.id + ':fire');
        q.fire = { pid: q.answerer, streak: st.streak };
        st.points += 50; st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
        setTimeout(() => this.fx('onfire', { pid: q.answerer, streak: st.streak }), 1500);
      }
      st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
      // Underdog: last place and 500+ behind gets +50% (Kahoot lesson: keep the trailing team in it)
      if (!q.isDD && this.s.round < 3 && this.s.teams.length > 1) {
        const others = this.s.teams.filter((t) => t.id !== team.id);
        const before = team.score - pts - (q.crossover ? q.crossover.bonus : 0) - (q.fire ? 50 : 0);
        const lead = Math.max(...others.map((t) => t.score));
        if (others.every((t) => t.score >= before) && lead - before >= 500) {
          const bonus = Math.max(50, Math.round(q.value / 2 / 50) * 50);
          this.award(team.id, bonus, q.id + ':underdog');
          q.underdog = bonus; st.points += bonus;
          setTimeout(() => this.fx('underdog', { team: team.id, bonus }), 2100);
        }
      }
      // Lightning: tapped the right answer within 3 seconds (no huddle)
      if (!q.isDD && q.answerMs != null && q.answerMs < 3000) {
        this.award(team.id, 25, q.id + ':lightning');
        q.lightning = 25; st.points += 25;
        setTimeout(() => this.fx('lightning', { pid: q.answerer }), 600);
      }
      if (q.category === 'Card Check') q.stamp = 'saved';
      this.fx('correct', { pid: q.answerer, team: team.id });
      return this.reveal();
    }
    { const st = this.stat(q.answerer); st.streak = 0; }
    this.fx('wrong', { pid: q.answerer, team: team.id });
    if (q.isDD) {
      this.award(team.id, -q.wager, q.id);
      q.result = 'wrong';
      return this.reveal();
    }
    q.attempted.push(team.id);
    const remaining = Object.keys(q.podium).filter((id) => !q.attempted.includes(id));
    if (!remaining.length) { q.result = 'wrong'; return this.reveal(); }
    q.steal = true;
    q.eligible = remaining;
    q.huddleUsed = false;
    if (remaining.length === 1) {
      this.fx('steal', { team: remaining[0] });
      this.goAnswering(q.podium[remaining[0]], Math.round(this.answerMs() / 2));
    } else {
      this.fx('steal', {});
      q.stage = 'reading'; // reset so openBuzzers accepts
      this.openBuzzers();
    }
  }
  reveal() {
    const q = this.s.q, full = this.cur.full;
    q.stage = 'reveal';
    q.timerEnd = 0;
    q.huddleUntil = 0;
    q.answer = full.answer;
    q.answerText = q.choices && 'ABCD'.includes(full.answer) ? q.choices['ABCD'.indexOf(full.answer)] : full.answer;
    q.context = full.culturalContext || '';
    if (!q.result) q.result = 'none';
    this.scorePlayAlong();
    if (q.category === 'Card Check' && q.result !== 'correct') { q.stamp = 'revoked'; this.fx('revoked'); }
    else if (q.stamp === 'saved') this.fx('saved');
    else if (q.result !== 'correct') this.fx('reveal');
    this.publish();
  }

  // ---------- Play-Along: the bench answers secretly for a small team bonus ----------
  canPlayAlong(pid) {
    const q = this.s.q;
    if (!q || !this.s.settings.playAlong || !q.choices || !['trivia', 'hashtag', 'saying', 'emoji', 'name_that_era'].includes(q.type)) return false;
    if (!['reading', 'open', 'answering', 'wager'].includes(q.stage)) return false;
    const p = this.s.players[pid];
    if (!p) return false;
    const t = this.teamOf(pid);
    return p.audience || (t && q.podium[t.id] !== pid);
  }
  onPlayAlong(pid, choice) {
    if (!this.canPlayAlong(pid) || !'ABCD'.includes(choice)) return;
    this.cur.along = this.cur.along || {};
    if (this.cur.along[pid]) return;
    this.cur.along[pid] = choice;
    this.s.q.alongCount = Object.keys(this.cur.along).length;
    this.publish();
  }
  scorePlayAlong() {
    const q = this.s.q, along = (this.cur && this.cur.along) || {};
    if (!q.choices || !Object.keys(along).length || !'ABCD'.includes(this.cur.full.answer || '')) return;
    const bench = {};
    for (const t of this.s.teams) {
      const seats = t.members.filter((pid) => q.podium[t.id] !== pid && this.s.players[pid] && this.s.players[pid].connected);
      if (!seats.length) continue;
      const right = seats.filter((pid) => along[pid] === this.cur.full.answer).length;
      const bonus = Math.round((50 * right) / seats.length / 10) * 10;
      bench[t.id] = { right, size: seats.length, bonus };
      if (bonus) this.award(t.id, bonus, q.id + ':bench');
    }
    for (const [pid, c] of Object.entries(along)) if (c === this.cur.full.answer) { const st = this.stat(pid); st.along = (st.along || 0) + 1; }
    q.bench = bench;
  }

  // ---------- The Family Survey ----------
  // "Decks" remember what this TV has already shown (across nights) and deal
  // unseen cards first, so the game keeps feeling new. Resets once everything's been used.
  deckUsed(key) { try { return new Set(JSON.parse(localStorage.getItem('gen-deck-' + key) || '[]')); } catch (e) { return new Set(); } }
  deckMark(key, items) {
    if (this.practice) return;
    const used = this.deckUsed(key);
    for (const it of items) used.add(it);
    try { localStorage.setItem('gen-deck-' + key, JSON.stringify([...used])); } catch (e) { /* storage full */ }
  }
  deck(key, list, n, mark = true) {
    let used = this.deckUsed(key);
    let fresh = list.filter((x) => !used.has(x));
    if (fresh.length < n) { try { localStorage.removeItem('gen-deck-' + key); } catch (e) { /* */ } used = new Set(); fresh = list.slice(); }
    const picked = shuffle(fresh).slice(0, n);
    // top up with older cards if the list itself is short
    if (picked.length < n) picked.push(...shuffle(list.filter((x) => !picked.includes(x))).slice(0, n - picked.length));
    if (mark) this.deckMark(key, picked);
    return picked;
  }
  freshness() {
    const pool = this.bank.filter((q) => q.round === 1 || q.round === 2 || q.round === 3);
    const unseen = pool.filter((q) => !this.seen.has(q.id)).length;
    return { unseen, total: pool.length };
  }
  resetSeen() { this.seen = new Set(); localStorage.setItem('gen-seen', '[]'); for (const k of ['survey', 'charades', 'hot_take', 'most_likely', 'top_that']) localStorage.removeItem('gen-deck-' + k); this.publish(); }
  freshCategories() {
    // favor categories with the most questions this TV hasn't shown yet, with some randomness
    const cats = this.availableCategories();
    const score = (c) => this.bank.filter((q) => q.round === 1 && q.category === c && !this.seen.has(q.id)).length + Math.random() * 8;
    return cats.map((c) => [c, score(c)]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
  }
  setupSurvey() {
    const pool = this.deck('survey', this.extras.survey || [], 3);
    this.s.survey = pool.length ? { prompts: pool.slice(0, 3), answered: {} } : null;
    this.surveyAnswers = (this.s.survey ? this.s.survey.prompts : []).map(() => ({}));
  }
  onSurveyAnswer(pid, i, text) {
    const sv = this.s.survey;
    if (!sv || !this.s.players[pid]) return;
    i = +i;
    if (!(i >= 0 && i < sv.prompts.length)) return;
    text = String(text || '').trim().slice(0, 40);
    if (!text) return;
    this.surveyAnswers[i][pid] = text;
    sv.answered[pid] = this.surveyAnswers.filter((a) => a[pid]).length;
    this.publish();
  }
  surveyReadyPrompts() {
    return (this.s.survey ? this.s.survey.prompts : []).map((_, i) => i).filter((i) => Object.keys(this.surveyAnswers[i] || {}).length >= 3);
  }
  buildSurveyBoard(i) {
    const answers = Object.values(this.surveyAnswers[i] || {});
    const clusters = [];
    for (const raw of answers) {
      const n = normAnswer(raw);
      if (!n) continue;
      let c = clusters.find((x) => x.keys.some((k) => similar(k, n)));
      if (!c) { c = { keys: [], raws: {}, count: 0 }; clusters.push(c); }
      if (!c.keys.includes(n)) c.keys.push(n);
      c.count++;
      c.raws[raw] = (c.raws[raw] || 0) + 1;
    }
    clusters.sort((a, b) => b.count - a.count);
    const total = answers.length;
    return clusters.slice(0, SURVEY.maxAnswers).map((c) => {
      const best = Object.entries(c.raws).sort((a, b) => b[1] - a[1])[0][0]; // most common spelling, first one wins ties
      const label = best.charAt(0).toUpperCase() + best.slice(1);
      return { label, keys: c.keys, count: c.count, pts: Math.max(5, Math.round((c.count / total) * 100)) * SURVEY.mult };
    });
  }
  startSurvey(promptIdx) {
    const board = this.buildSurveyBoard(promptIdx);
    const podium = {};
    for (const t of this.s.teams) { const p = this.podiumFor(t); if (p) podium[t.id] = p; }
    this.cur = { full: { id: '__survey__' + promptIdx, answer: null, culturalContext: '' }, board, presses: [], collectUntil: 0, lockUntil: {}, order: [], oi: 0, snap: null };
    this.s.q = {
      id: '__survey__' + promptIdx, type: 'family_survey', category: 'The Family Survey', prompt: this.s.survey.prompts[promptIdx],
      respondents: Object.keys(this.surveyAnswers[promptIdx]).length, choices: null, value: 0, isDD: false,
      stage: 'reading', podium, attempted: [], eligible: Object.keys(podium), buzzWinner: null, answerer: null, steal: false,
      timerEnd: 0, timerTotal: 0, result: null, lockouts: {}, flipId: uid(5), era: 'all', huddleUntil: 0, huddleUsed: true,
      board: board.map(() => ({ revealed: false })), bank: 0, strikes: 0, control: null, guesser: null, lastGuess: null,
      foTries: [], stealTeam: null, awards: null,
    };
    this.s.phase = 'question';
    this.setTimer(4500);
    this.fx('flip');
    this.publish();
  }
  surveyMatch(text) {
    const n = normAnswer(text);
    if (!n) return -1;
    const q = this.s.q;
    return this.cur.board.findIndex((e, i) => !q.board[i].revealed && e.keys.some((k) => similar(k, n)));
  }
  surveyTurn(pid, stage, ms) {
    const q = this.s.q;
    q.stage = stage; q.guesser = pid; q.answerer = pid;
    this.setTimer(ms);
    this.publish();
  }
  revealSurvey(i, toBank = true) {
    const q = this.s.q, e = this.cur.board[i];
    q.board[i] = { revealed: true, label: e.label, pts: e.pts, count: e.count };
    if (toBank) q.bank += e.pts;
  }
  onSurveyGuess(pid, text) {
    const q = this.s.q;
    if (!q || q.type !== 'family_survey' || !['fo_answer', 'play', 'steal'].includes(q.stage) || pid !== q.guesser || this.s.paused) return;
    const idx = this.surveyMatch(text);
    q.lastGuess = { pid, text: String(text || '').slice(0, 40), hit: idx >= 0, at: this.now() };
    this.surveyResolve(idx);
  }
  surveyResolve(idx) {
    const q = this.s.q;
    const team = this.teamOf(q.guesser);
    // remember the state before a miss so the host can overrule it ("that counts!")
    if (idx < 0) this.cur.snap = JSON.parse(JSON.stringify({ q, oi: this.cur.oi }));
    else this.cur.snap = null;
    if (q.stage === 'fo_answer') {
      if (team && !q.foTries.includes(team.id)) q.foTries.push(team.id);
      if (idx >= 0) {
        this.revealSurvey(idx);
        this.fx('surveyhit', { i: idx, team: team && team.id });
        q.control = team.id;
        return this.surveyPlay();
      }
      this.fx('strike', { n: 1, small: true });
      const other = Object.keys(q.podium).find((id) => !q.foTries.includes(id));
      if (other && q.foTries.length < 2) return this.surveyTurn(q.podium[other], 'fo_answer', SURVEY.faceoff);
      q.control = q.foTries[0] || Object.keys(q.podium)[0];
      return this.surveyPlay();
    }
    if (q.stage === 'play') {
      if (idx >= 0) {
        this.revealSurvey(idx);
        this.fx('surveyhit', { i: idx, team: team && team.id });
        const st = this.stat(q.guesser); st.survey = (st.survey || 0) + 1;
        if (q.board.every((b) => b.revealed)) return this.surveyWin(q.control, false);
        return this.surveyNext();
      }
      q.strikes++;
      this.fx('strike', { n: q.strikes });
      if (q.strikes >= 3) return this.surveySteal();
      return this.surveyNext();
    }
    if (q.stage === 'steal') {
      if (idx >= 0) {
        this.revealSurvey(idx);
        this.fx('surveyhit', { i: idx, team: q.stealTeam });
        return this.surveyWin(q.stealTeam, true);
      }
      this.fx('strike', { n: 1, small: true });
      return this.surveyWin(q.control, false);
    }
  }
  surveyPlay() {
    const q = this.s.q;
    const t = this.s.teams.find((x) => x.id === q.control);
    const conn = t.members.filter((pid) => this.s.players[pid] && this.s.players[pid].connected);
    const list = conn.length ? conn : t.members.slice();
    // start with the teammate after the face-off player so everybody gets a turn
    const start = Math.max(0, list.indexOf(q.podium[t.id]));
    this.cur.order = list.slice(start + 1).concat(list.slice(0, start + 1));
    this.cur.oi = 0;
    this.fx('control', { team: t.id });
    this.surveyTurn(this.cur.order[0], 'play', SURVEY.guess);
  }
  surveyNext() {
    this.cur.oi = (this.cur.oi + 1) % this.cur.order.length;
    this.surveyTurn(this.cur.order[this.cur.oi], 'play', SURVEY.guess);
  }
  surveySteal() {
    const q = this.s.q;
    const ids = this.s.teams.map((t) => t.id);
    const others = ids.filter((id) => id !== q.control && q.podium[id]);
    if (!others.length) return this.surveyWin(q.control, false);
    // with 3-4 teams, the next team in line gets the steal
    q.stealTeam = others.sort((a, b) => ((ids.indexOf(a) - ids.indexOf(q.control) + ids.length) % ids.length) - ((ids.indexOf(b) - ids.indexOf(q.control) + ids.length) % ids.length))[0];
    this.fx('steal', { team: q.stealTeam });
    this.surveyTurn(q.podium[q.stealTeam], 'steal', SURVEY.steal);
  }
  surveyWin(teamId, stolen) {
    const q = this.s.q;
    this.cur.board.forEach((_, i) => { if (!q.board[i].revealed) this.revealSurvey(i, false); });
    q.awards = {};
    if (q.bank > 0 && teamId) { q.awards[teamId] = q.bank; this.award(teamId, q.bank, q.id); }
    q.winnerTeam = teamId; q.stolen = stolen;
    Object.assign(q, { stage: 'reveal', timerEnd: 0, result: 'survey', top: teamId ? [teamId] : [], guesser: null });
    this.fx(stolen ? 'fanfare' : 'correct', { team: teamId });
    this.publish();
  }
  hostSurveyReveal(i) {
    const q = this.s.q;
    if (!q || q.type !== 'family_survey' || q.board[i] && q.board[i].revealed) return;
    if (['fo_answer', 'play', 'steal'].includes(q.stage)) {
      // overrule the last auto-strike if it just happened
      if (this.cur.snap && q.lastGuess && !q.lastGuess.hit && this.now() - q.lastGuess.at < 15000) {
        const keepLast = { ...q.lastGuess, hit: true, overruled: true };
        this.s.q = Object.assign(q, this.cur.snap.q);
        this.cur.oi = this.cur.snap.oi;
        this.s.q.lastGuess = keepLast;
        this.cur.snap = null;
        this.fx('undo', {});
      }
      return this.surveyResolve(i);
    }
    if (q.stage === 'reveal') { this.revealSurvey(i, false); this.publish(); }
  }
  hostSurveyStrike() {
    const q = this.s.q;
    if (!q || q.type !== 'family_survey' || !['fo_answer', 'play', 'steal'].includes(q.stage)) return;
    q.lastGuess = { pid: q.guesser, text: '(host: no)', hit: false, at: this.now() };
    this.surveyResolve(-1);
  }

  // ---------- Culture Charades ----------
  startCharades(kind = 'act') {
    const hum = kind === 'hum';
    const podium = {};
    for (const t of this.s.teams) { const p = this.podiumFor(t); if (p) podium[t.id] = p; }
    const order = Object.keys(podium);
    const all = (hum ? this.extras.humSongs : this.extras.charades) || [];
    const pool = this.deck(hum ? 'humSongs' : 'charades', all, Math.min(all.length, 40));
    const per = {};
    order.forEach((tid, i) => { per[tid] = pool.filter((_, k) => k % order.length === i); });
    this.cur = { full: { id: '__charades__', answer: null, culturalContext: '' }, per, presses: [], lockUntil: {} };
    this.s.q = {
      id: '__charades__', type: 'charades', category: hum ? 'Hum That Tune' : 'Culture Charades', prompt: hum ? 'Hum That Tune' : 'Culture Charades', choices: null, value: CHARADES.points, mode: hum ? 'hum' : 'act',
      isDD: false, stage: 'ch_ready', podium, attempted: [], eligible: order, timerEnd: 0, timerTotal: 0, result: null, lockouts: {},
      flipId: uid(5), era: 'all', huddleUntil: 0, huddleUsed: true, awards: null,
      ch: { order, idx: 0, actor: podium[order[0]], word: null, wi: 0, counts: {}, log: [] },
    };
    for (const tid of order) this.s.q.ch.counts[tid] = 0;
    this.s.phase = 'question';
    this.fx('flip');
    this.publish();
  }
  charadesGo() {
    const q = this.s.q, ch = q.ch, tid = ch.order[ch.idx];
    ch.wi = 0; ch.word = this.cur.per[tid][0] || 'Free style!'; ch.log = [];
    q.stage = 'ch_act';
    this.setTimer(CHARADES.seconds * 1000);
    this.fx('buzz', { team: tid, pid: ch.actor });
    this.publish();
  }
  onCharades(pid, action) {
    const q = this.s.q;
    if (!q || q.type !== 'charades' || q.stage !== 'ch_act' || pid !== q.ch.actor || this.s.paused) return;
    const ch = q.ch, tid = ch.order[ch.idx];
    const got = action === 'got';
    ch.log.push({ word: ch.word, got });
    if (got) { ch.counts[tid]++; const st = this.stat(pid); st.charades = (st.charades || 0) + 1; }
    ch.wi++;
    ch.word = this.cur.per[tid][ch.wi % Math.max(1, this.cur.per[tid].length)];
    this.fx(got ? 'chgot' : 'chskip', { team: tid });
    this.publish();
  }
  charadesTimeUp() {
    const q = this.s.q;
    q.stage = 'ch_recap'; q.timerEnd = 0; q.ch.word = null;
    this.fx('fanfare');
    this.publish();
  }
  charadesNext() {
    const q = this.s.q, ch = q.ch;
    ch.idx++;
    if (ch.idx < ch.order.length) {
      ch.actor = q.podium[ch.order[ch.idx]];
      q.stage = 'ch_ready';
      this.fx('whoosh');
      return this.publish();
    }
    const awards = {}; let max = 0;
    for (const [tid, n] of Object.entries(ch.counts)) { if (n) { awards[tid] = n * q.value; this.award(tid, awards[tid], 'charades'); } max = Math.max(max, n); }
    Object.assign(q, { stage: 'reveal', awards, top: max ? Object.keys(ch.counts).filter((k) => ch.counts[k] === max) : [], result: 'charades' });
    this.fx('correct', {});
    this.publish();
  }

  // Majority Rules
  onVote(pid, choice) {
    const q = this.s.q;
    if (!q || q.stage !== 'vote' || !this.s.players[pid]) return;
    this.cur.votes[pid] = choice;
    q.voteCount = Object.keys(this.cur.votes).length;
    this.fx('vote');
    const need = this.connectedIds().filter((id) => this.teamOf(id));
    if (need.every((id) => this.cur.votes[id])) return this.revealMajority();
    this.publish();
  }
  revealMajority() {
    const q = this.s.q;
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const v of Object.values(this.cur.votes)) if (counts[v] !== undefined) counts[v]++;
    const max = Math.max(...Object.values(counts));
    const top = max > 0 ? Object.keys(counts).filter((k) => counts[k] === max) : [];
    const awards = {};
    for (const [pid, v] of Object.entries(this.cur.votes)) {
      const t = this.teamOf(pid);
      if (t && top.includes(v)) awards[t.id] = (awards[t.id] || 0) + q.value;
    }
    for (const [tid, pts] of Object.entries(awards)) this.award(tid, pts, q.id);
    Object.assign(q, { stage: 'reveal', timerEnd: 0, counts, top, awards, result: 'majority', context: this.cur.full.culturalContext });
    this.fx('correct', {});
    this.publish();
  }

  // One's Gotta Go
  onPick(pid, choice) {
    const q = this.s.q;
    if (!q || q.stage !== 'pick') return;
    const team = this.teamOf(pid);
    if (!team || q.podium[team.id] !== pid) return;
    q.ogg.picks[team.id] = choice;
    this.fx('vote');
    if (q.ogg.order.every((id) => q.ogg.picks[id])) return this.startPitches();
    this.publish();
  }
  startPitches() {
    const q = this.s.q;
    q.stage = 'pitch';
    q.ogg.order = q.ogg.order.filter((id) => q.ogg.picks[id]);
    if (!q.ogg.order.length) return this.revealOgg();
    q.ogg.pitchIdx = 0;
    this.setTimer(TIMES.pitch);
    this.fx('whoosh');
    this.publish();
  }
  nextPitch() {
    const q = this.s.q;
    q.ogg.pitchIdx++;
    if (q.ogg.pitchIdx >= q.ogg.order.length) {
      q.stage = 'pitchvote';
      q.voteCount = 0;
      this.setTimer(TIMES.pitchVote);
    } else this.setTimer(TIMES.pitch);
    this.fx('whoosh');
    this.publish();
  }
  onDefenseVote(pid, teamId) {
    const q = this.s.q;
    if (!q || q.stage !== 'pitchvote') return;
    const mine = this.teamOf(pid);
    if (!mine || mine.id === teamId || !q.ogg.order.includes(teamId)) return;
    this.cur.defense[pid] = teamId;
    q.voteCount = Object.keys(this.cur.defense).length;
    this.fx('vote');
    const need = this.connectedIds().filter((id) => { const t = this.teamOf(id); return t && q.ogg.order.some((o) => o !== t.id); });
    if (need.every((id) => this.cur.defense[id])) return this.revealOgg();
    this.publish();
  }
  revealOgg() {
    const q = this.s.q;
    const counts = {};
    for (const id of q.ogg.order) counts[id] = 0;
    for (const v of Object.values(this.cur.defense)) if (counts[v] !== undefined) counts[v]++;
    const max = Math.max(0, ...Object.values(counts));
    const top = max > 0 ? Object.keys(counts).filter((k) => counts[k] === max) : [];
    const awards = {};
    for (const id of top) { awards[id] = q.value; this.award(id, q.value, q.id); }
    Object.assign(q, { stage: 'reveal', timerEnd: 0, counts, top, awards, result: 'ogg', context: this.cur.full.culturalContext });
    if (top.length) this.fx('correct', {}); else this.fx('reveal');
    this.publish();
  }

  // 60-Second Blitz: every podium player answers a private stack of quick questions at once
  startBlitz() {
    const podium = {};
    for (const t of this.s.teams) { const p = this.podiumFor(t); if (p) podium[t.id] = p; }
    const onBoard = new Set((this.s.board ? this.s.board.cats : []).flatMap((c) => c.tiles.map((t) => t.qid)));
    let pool = this.bank.filter((x) => x.round === 1 && x.questionType === 'trivia' && x.value <= 200 && x.choices && x.choices.length === 4 && !onBoard.has(x.id));
    const fresh = pool.filter((x) => !this.seen.has(x.id));
    pool = shuffle(fresh.length >= BLITZ.count ? fresh : pool).slice(0, BLITZ.count);
    const qs = [], answers = [], ids = [];
    for (const x of pool) {
      const right = x.choices['ABCD'.indexOf(x.answer)];
      const ch = shuffle(x.choices);
      qs.push({ p: x.prompt, c: ch, cat: x.category });
      answers.push('ABCD'[ch.indexOf(right)]);
      ids.push(x.id);
    }
    const progress = {};
    for (const id of Object.keys(podium)) progress[id] = { idx: 0, correct: 0, last: null };
    this.cur = { full: { id: '__blitz__', answer: null, culturalContext: '' }, blitz: answers, blitzIds: ids, presses: [], lockUntil: {} };
    this.s.q = {
      id: '__blitz__', type: 'blitz', category: '60-Second Blitz', prompt: '60-Second Blitz', choices: null,
      value: BLITZ.points, isDD: false, stage: 'blitz', podium, attempted: [], eligible: Object.keys(podium),
      buzzWinner: null, answerer: null, steal: false, timerEnd: 0, timerTotal: 0, chosen: null, result: null,
      answer: null, answerText: null, context: null, wager: null, stamp: null, voteCount: 0, counts: null, top: null,
      awards: null, ogg: null, huddleUntil: 0, huddleUsed: true, lockouts: {}, flipId: uid(5), era: 'all', crossover: null,
      blitz: { qs, progress, total: qs.length },
    };
    this.s.phase = 'question';
    this.setTimer(BLITZ.seconds * 1000 + 3000); // 3-second "ready, set" countdown
    this.s.q.blitzStart = this.now() + 3000;
    this.fx('blitz');
    this.publish();
  }
  onBlitzAnswer(pid, i, choice) {
    const q = this.s.q;
    if (!q || q.type !== 'blitz' || q.stage !== 'blitz' || this.s.paused) return;
    if (this.now() < q.blitzStart - 250) return;
    const team = this.teamOf(pid);
    if (!team || q.podium[team.id] !== pid) return;
    const pr = q.blitz.progress[team.id];
    if (!pr || pr.idx !== +i || pr.idx >= q.blitz.total) return;
    const ok = choice === this.cur.blitz[pr.idx];
    if (ok) { pr.correct++; const st = this.stat(pid); st.correct++; st.points += q.value; }
    pr.last = ok ? 'right' : 'wrong';
    pr.idx++;
    this.fx('blitzhit', { team: team.id, ok });
    if (Object.values(q.blitz.progress).every((x) => x.idx >= q.blitz.total)) return this.endBlitz();
    this.publish();
  }
  endBlitz() {
    const q = this.s.q;
    if (!q || q.stage !== 'blitz') return;
    const awards = {}, counts = {};
    let max = 0;
    for (const [tid, pr] of Object.entries(q.blitz.progress)) {
      counts[tid] = pr.correct; max = Math.max(max, pr.correct);
      if (pr.correct) { awards[tid] = pr.correct * q.value; this.award(tid, awards[tid], 'blitz'); }
    }
    for (const id of this.cur.blitzIds.slice(0, Math.max(...Object.values(q.blitz.progress).map((p) => p.idx), 0))) this.markSeen(id);
    q.blitz.answers = this.cur.blitz;
    Object.assign(q, { stage: 'reveal', timerEnd: 0, awards, counts, top: max ? Object.keys(counts).filter((k) => counts[k] === max) : [], result: 'blitz' });
    this.fx('fanfare');
    this.publish();
  }

  // host "Next" button — context aware
  next() {
    const s = this.s, q = s.q;
    if (s.phase === 'question' && q) {
      if (this.partyNext()) return;
      if (q.stage === 'reading') return this.openBuzzers();
      if (q.stage === 'wager') return this.onWager(q.answerer, Math.min(q.value, q.maxWager));
      if (q.stage === 'vote') return this.revealMajority();
      if (q.stage === 'pick') return this.startPitches();
      if (q.stage === 'pitch') return this.nextPitch();
      if (q.stage === 'pitchvote') return this.revealOgg();
      if (q.stage === 'blitz') return this.endBlitz();
      if (q.stage === 'ch_ready') return this.charadesGo();
      if (q.stage === 'ch_act') return this.charadesTimeUp();
      if (q.stage === 'ch_recap') return this.charadesNext();
      if (q.type === 'family_survey' && ['fo_answer', 'play', 'steal'].includes(q.stage)) return;
      if (q.stage === 'reveal') return this.endQuestion();
      return;
    }
    if (s.phase === 'spin') return this.spinNext();
    if (s.phase === 'segment') return this.startSegmentQuestion();
    if (s.phase === 'round_end') return s.round === 1 ? this.startRound2() : (s.settings.format === 'party' ? this.champion() : this.startFinal());
    if (s.phase === 'final_intro') return this.finalWagerStage();
    if (s.phase === 'final_wager') return this.finalAnswerStage();
    if (s.phase === 'final_answer') return this.finalRevealStage();
    if (s.phase === 'final_reveal') return this.finalNext();
  }
  skip() {
    const q = this.s.q;
    if (this.s.phase === 'segment') { this.s.remix.segIdx++; return this.afterSegment(); }
    if (!q) return;
    if (q.stage !== 'reveal') { q.result = 'skipped'; }
    this.endQuestion();
  }
  endQuestion() {
    const s = this.s, q = s.q;
    if (!q) return;
    if (!q.id.startsWith('__')) this.markSeen(q.id);
    const podiumTeams = Object.keys(q.podium || {});
    if (q.type !== 'majority_rules') this.rotate(podiumTeams);
    if (q.winnerTeam) s.controlTeam = q.winnerTeam;
    s.q = null;
    this.cur = null;
    if (s.round === 1) {
      for (const c of s.board.cats) for (const t of c.tiles) if (t.qid === q.id) t.used = true;
      const left = s.board.cats.some((c) => c.tiles.some((t) => !t.used));
      s.tilesPlayed = (s.tilesPlayed || 0) + 1;
      if (left && s.tilesPlayed % SPIN.every === 0) return this.startSpin();
      s.phase = left ? 'board' : 'round_end';
      if (!left) this.fx('fanfare');
    } else if (s.round === 2) {
      const seg = s.remix.segments[s.remix.segIdx];
      seg.idx++;
      if (seg.idx >= seg.qids.length) { s.remix.segIdx++; return this.afterSegment(); }
      return this.startSegmentQuestion();
    }
    this.publish();
  }
  endRoundEarly() {
    if (this.s.round === 1 || this.s.round === 2) {
      this.s.q = null; this.cur = null;
      this.s.phase = 'round_end';
      this.fx('fanfare');
      this.publish();
    }
  }

  // Round 2
  // swap in the practice-only bank and decks; nothing from them is tracked as "seen"
  enterPractice() {
    const P = this.extras.practice || (this._real && this._real.extras.practice);
    if (!P || this.practice) return;
    this._real = { bank: this.bank, byId: this.byId, extras: this.extras };
    this.bank = P.questions || [];
    this.byId = Object.fromEntries(this.bank.map((q) => [q.id, q]));
    this.extras = { ...P, survey: [], practice: P };
    this.practice = true;
  }
  exitPractice() {
    if (!this.practice || !this._real) return;
    Object.assign(this, { bank: this._real.bank, byId: this._real.byId, extras: this._real.extras });
    this._real = null; this.practice = false;
  }
  remixLengths() {
    const st = this.s.settings, fmt = st.format || 'classic';
    const lens = { ...((fmt === 'party' ? PARTY_LENGTHS : REMIX_LENGTHS)[st.remixLength] || (fmt === 'party' ? PARTY_LENGTHS : REMIX_LENGTHS).normal) };
    for (const p of REMIX_PLAN) if (lens[p.type] === undefined) lens[p.type] = 0;
    if (fmt === 'trivia') for (const t of PARTY_TYPES) lens[t] = 0;
    for (const [k, off] of Object.entries(st.remixOff || {})) if (off) lens[k] = 0;
    return lens;
  }
  toggleRemix(type) {
    const st = this.s.settings;
    st.remixOff = { ...(st.remixOff || {}) };
    if (st.remixOff[type]) delete st.remixOff[type]; else st.remixOff[type] = true;
    this.publish();
  }
  startRound2(opts = {}) {
    const s = this.s;
    s.round = 2;
    const used = new Set();
    const segments = [];
    const lens = this.practice ? Object.fromEntries(PRACTICE_PLAN.map((p) => [p.type, p.count])) : this.remixLengths();
    for (const plan of (this.practice ? PRACTICE_PLAN : REMIX_PLAN)) {
      const qids = [];
      const n = lens[plan.type] ?? plan.count;
      for (let i = 0; i < n; i++) {
        if (plan.type === 'blitz') { qids.push('__blitz__'); continue; }
        if (PARTY_TYPES.includes(plan.type)) { if (this.partyAvailable(plan.type)) qids.push(`__${plan.type}__${i}`); continue; }
        if (plan.type === 'charades') { if ((this.extras.charades || []).length) qids.push('__charades__'); continue; }
        if (plan.type === 'hum_it') { if ((this.extras.humSongs || []).length) qids.push('__hum__' + i); continue; }
        if (plan.type === 'family_survey') {
          const ready = this.surveyReadyPrompts().filter((k) => !qids.includes('__survey__' + k));
          if (ready.length) qids.push('__survey__' + ready[0]);
          continue;
        }
        const q = this.pickOne((x) => x.questionType === plan.type, used);
        if (q) { used.add(q.id); qids.push(q.id); }
      }
      if (qids.length) segments.push({ ...plan, qids, idx: 0 });
    }
    s.remix = { segments, segIdx: 0 };
    if (!opts.quiet) this.onFx('roundcard', { n: 2, title: 'For the Culture Remix' });
    this.afterSegment();
  }
  afterSegment() {
    const s = this.s;
    if (s.remix.segIdx >= s.remix.segments.length) { s.phase = 'round_end'; this.fx('fanfare'); }
    else { s.phase = 'segment'; this.fx('whoosh'); }
    this.publish();
  }
  startSegmentQuestion() {
    const seg = this.s.remix.segments[this.s.remix.segIdx];
    if (seg.type === 'blitz') return this.startBlitz();
    if (seg.type === 'charades') return this.startCharades();
    if (seg.type === 'hum_it') return this.startCharades('hum');
    if (PARTY_TYPES.includes(seg.type)) return this.startParty(seg.type);
    if (seg.type === 'family_survey') return this.startSurvey(+seg.qids[seg.idx].replace('__survey__', ''));
    this.startQuestion(this.byId[seg.qids[seg.idx]], { value: this.byId[seg.qids[seg.idx]].value });
  }

  // Round 3: Final Wager
  startFinal() {
    const s = this.s;
    s.round = 3;
    const fq = this.pickOne((x) => x.questionType === 'final', new Set());
    this.cur = { full: fq, finalWagers: {}, finalAnswers: {} };
    const captains = {};
    for (const t of s.teams) { const p = this.podiumFor(t); if (p) captains[t.id] = p; }
    s.final = {
      category: fq.finalCategory || fq.category, prompt: null, captains,
      wagered: {}, answered: {}, order: s.teams.slice().sort((a, b) => a.score - b.score).map((t) => t.id),
      revealIdx: -1, results: {}, answer: null, context: null, timerEnd: 0, timerTotal: 0, judged: false,
    };
    s.phase = 'final_intro';
    this.fx('roundcard', { n: 3, title: 'The Final Wager' });
    this.publish();
  }
  finalTimer(ms) { this.s.final.timerEnd = this.now() + ms; this.s.final.timerTotal = ms; }
  finalWagerStage() {
    this.s.phase = 'final_wager';
    this.finalTimer(TIMES.finalWager);
    this.publish();
  }
  onFinalWager(pid, amount) {
    const s = this.s;
    if (s.phase !== 'final_wager') return;
    const team = this.teamOf(pid);
    if (!team || s.final.captains[team.id] !== pid) return;
    const max = Math.max(team.score, 500);
    this.cur.finalWagers[team.id] = Math.max(0, Math.min(max, Math.round(+amount || 0)));
    s.final.wagered[team.id] = true;
    this.fx('vote');
    if (Object.keys(s.final.captains).every((id) => s.final.wagered[id])) return this.finalAnswerStage();
    this.publish();
  }
  finalAnswerStage() {
    const s = this.s;
    s.phase = 'final_answer';
    s.final.prompt = this.cur.full.prompt;
    this.finalTimer(TIMES.finalAnswer);
    this.fx('reveal');
    this.publish();
  }
  onFinalAnswer(pid, text) {
    const s = this.s;
    if (s.phase !== 'final_answer') return;
    const team = this.teamOf(pid);
    if (!team || s.final.captains[team.id] !== pid) return;
    this.cur.finalAnswers[team.id] = String(text || '').slice(0, 80);
    s.final.answered[team.id] = true;
    this.fx('vote');
    if (Object.keys(s.final.captains).every((id) => s.final.answered[id])) return this.finalRevealStage();
    this.publish();
  }
  finalRevealStage() {
    const s = this.s;
    s.phase = 'final_reveal';
    s.final.timerEnd = 0;
    s.final.order = s.teams.slice().sort((a, b) => a.score - b.score).map((t) => t.id);
    s.final.revealIdx = 0;
    this.showFinalTeam();
  }
  showFinalTeam() {
    const s = this.s, id = s.final.order[s.final.revealIdx];
    s.final.results[id] = { answer: this.cur.finalAnswers[id] || '(no answer)', wager: null, correct: null };
    s.final.judged = false;
    this.fx('finalteam', { team: id });
    this.publish();
  }
  judgeFinal(correct) {
    const s = this.s;
    if (s.phase !== 'final_reveal' || s.final.judged || s.final.revealIdx >= s.final.order.length) return;
    const id = s.final.order[s.final.revealIdx];
    const w = this.cur.finalWagers[id] || 0;
    s.final.results[id].wager = w;
    s.final.results[id].correct = correct;
    s.final.judged = true;
    this.award(id, correct ? w : -w, 'final');
    this.fx(correct ? 'correct' : 'wrong', { team: id });
    this.publish();
  }
  finalNext() {
    const s = this.s;
    if (s.final.revealIdx < s.final.order.length && !s.final.judged) return;
    s.final.revealIdx++;
    if (s.final.revealIdx < s.final.order.length) return this.showFinalTeam();
    if (!s.final.answer) {
      s.final.answer = this.cur.full.answer;
      s.final.context = this.cur.full.culturalContext;
      this.fx('reveal');
      return this.publish();
    }
    this.markSeen(this.cur.full.id);
    this.champion();
  }
  champion() {
    const s = this.s;
    s.q = null;
    s.phase = 'champion';
    const max = Math.max(...s.teams.map((t) => t.score));
    s.winners = s.teams.filter((t) => t.score === max).map((t) => t.id);
    s.awards = this.computeAwards();
    this.recordSeason();
    this.fx('champion');
    this.publish();
  }
  computeAwards() {
    const entries = Object.entries(this.s.stats).filter(([pid]) => this.s.players[pid]);
    const best = (key, min = 1) => {
      let top = null;
      for (const [pid, st] of entries) if (st[key] >= min && (!top || st[key] > top[1][key])) top = [pid, st];
      return top ? { pid: top[0], n: top[1][key] } : null;
    };
    return {
      mvp: best('points', 1),
      crossover: best('crossovers', 1),
      thief: best('steals', 1),
      fire: best('bestStreak', 3),
      bench: best('along', 2),
      actor: best('charades', 2),
      closer: best('persuade', 1),
      clown: best('laughs', 2),
      liar: best('fooled', 2),
      legend: best('crowned', 2),
      singer: best('songs', 3),
    };
  }
  newGame() {
    const s = this.s;
    this.exitPractice();
    Object.assign(s, { phase: 'lobby', teams: [], round: 0, board: null, remix: null, final: null, q: null, winners: null, paused: false });
    this.cur = null; this.undo = [];
    this.setupSurvey();
    this.s.categories = this.freshCategories();
    this.publish();
  }

  // ---------------- pause & timers ----------------
  addTime(sec) {
    const s = this.s, ms = Math.max(5, Math.min(30, sec)) * 1000;
    if (s.q && s.q.timerEnd) { s.q.timerEnd += ms; s.q.timerTotal = (s.q.timerTotal || 0) + ms; }
    else if (s.final && s.final.timerEnd) { s.final.timerEnd += ms; s.final.timerTotal = (s.final.timerTotal || 0) + ms; }
    else return;
    this.onFx('addtime', { sec: ms / 1000 });
  }
  hype(name) {
    if (!['applause', 'ooh', 'drumroll', 'airhorn', 'crickets', 'laugh', 'boo', 'church'].includes(name)) return;
    const now = Date.now();
    if (now - (this.lastHype || 0) < 900) return;
    this.lastHype = now;
    this.onFx('hype', { name });
  }
  togglePause() {
    const s = this.s;
    if (!s.paused) { s.paused = true; this.pausedAt = this.now(); }
    else {
      const d = this.now() - this.pausedAt;
      if (s.q && s.q.timerEnd) s.q.timerEnd += d;
      if (s.q && s.q.huddleUntil) s.q.huddleUntil += d;
      if (s.final && s.final.timerEnd) s.final.timerEnd += d;
      s.paused = false;
    }
    this.publish();
  }
  tick() {
    const s = this.s;
    if (s.paused) return;
    try { this.botTick(); this.botRun(); this.autoHostTick(); } catch (e) { console.warn('auto', e); }
    const now = this.now();
    const q = s.q;
    if (s.phase === 'question' && q && this.cur) {
      if (this.cur.collectUntil && now >= this.cur.collectUntil) return this.resolveBuzz();
      if (q.timerEnd && now >= q.timerEnd) {
        q.timerEnd = 0;
        if (PARTY_STAGES.includes(q.stage)) return this.partyNext();
        switch (q.stage) {
          case 'reading': return this.openBuzzers();
          case 'open': if (q.type === 'family_survey') return this.surveyTurn(q.podium[Object.keys(q.podium)[0]], 'fo_answer', SURVEY.faceoff);
            if (!q.result) q.result = q.steal ? 'wrong' : 'none'; return this.reveal();
          case 'answering': return this.judge(false);
          case 'wager': return this.onWager(q.answerer, Math.min(q.value, q.maxWager));
          case 'vote': return this.revealMajority();
          case 'pick': return this.startPitches();
          case 'pitch': return this.nextPitch();
          case 'pitchvote': return this.revealOgg();
          case 'blitz': return this.endBlitz();
          case 'ch_act': return this.charadesTimeUp();
          case 'fo_answer': case 'play': case 'steal':
            q.lastGuess = { pid: q.guesser, text: '(time!)', hit: false, at: this.now() };
            return this.surveyResolve(-1);
        }
      }
    }
    if (s.phase === 'spin' && s.spin) {
      if (s.spin.stage === 'ready' && now >= s.spin.autoAt) return this.doSpin(null);
      if (s.spin.stage === 'spinning' && now >= s.spin.startAt + SPIN.seconds * 1000 + 300) return this.applySpin();
    }
    if (s.final && s.final.timerEnd && now >= s.final.timerEnd) {
      s.final.timerEnd = 0;
      if (s.phase === 'final_wager') return this.finalAnswerStage();
      if (s.phase === 'final_answer') return this.finalRevealStage();
    }
  }

  // Live emoji reactions from phones (host-only effect, never stored in state)
  onReact(pid, e) {
    const ok = ['👏🏾', '🔥', '😂', '🙌🏾', '😱', '🤦🏾', '💯', '🃏'];
    if (!this.s.players[pid] || !ok.includes(e)) return;
    this.lastReact = this.lastReact || {};
    const now = Date.now();
    if (now - (this.lastReact[pid] || 0) < 600) return;
    this.lastReact[pid] = now;
    this.onFx('react', { pid, e, name: this.s.players[pid].name });
  }

  // ---------- Sankofa Spin ----------
  startSpin() {
    const s = this.s;
    const team = s.teams.find((t) => t.id === s.controlTeam) || s.teams[0];
    s.phase = 'spin';
    s.spin = { team: team.id, spinner: this.podiumFor(team), stage: 'ready', result: null, startAt: 0, turns: 0, autoAt: this.now() + SPIN.autoSpinMs, history: (s.spin && s.spin.team === team.id && s.spin.stage === 'again') ? s.spin.history : [] };
    this.fx('spinready', { team: team.id });
    this.publish();
  }
  doSpin(pid) {
    const sp = this.s.spin;
    if (this.s.phase !== 'spin' || !sp || sp.stage !== 'ready') return;
    if (pid && pid !== sp.spinner) return;
    // SPIN AGAIN can't come up twice in a row
    let r = Math.floor(Math.random() * WHEEL.length);
    if (r === 5 && sp.history.includes(5)) r = Math.floor(Math.random() * 5);
    sp.result = r; sp.stage = 'spinning'; sp.startAt = this.now(); sp.turns = 4 + Math.floor(Math.random() * 3);
    sp.history.push(r);
    this.fx('spin', { result: r });
    this.publish();
  }
  applySpin() {
    const s = this.s, sp = s.spin, team = s.teams.find((t) => t.id === sp.team);
    sp.stage = 'done';
    switch (sp.result) {
      case 0: this.award(team.id, 200, 'spin'); break;
      case 1: s.nextMult = 2; break;
      case 2: team.lifelines++; break;
      case 3: for (const t of s.teams) this.award(t.id, 100, 'spin'); break;
      case 4: this.award(team.id, 300, 'spin'); break;
      case 5: sp.stage = 'again'; break;
    }
    this.fx('spinresult', { result: sp.result, team: team.id });
    this.publish();
  }
  spinNext() {
    const sp = this.s.spin;
    if (!sp) return;
    if (sp.stage === 'ready') return this.doSpin(null);
    if (sp.stage === 'again') return this.startSpin();
    if (sp.stage === 'done') { this.s.phase = 'board'; this.s.spin = null; this.fx('whoosh'); this.publish(); }
  }

  // ---------- Host remote (phone) ----------
  setHostKey(key) { this.hostKey = key; }
  privateView() {
    const s = this.s, q = s.q;
    const v = { phase: s.phase };
    if (q && this.cur && this.cur.full) {
      const f = this.cur.full;
      v.answer = f.answer || null;
      v.answerText = f.choices && 'ABCD'.includes(f.answer || '') ? f.choices['ABCD'.indexOf(f.answer)] : (f.answer || null);
      v.accept = f.acceptAlso || [];
      v.context = f.culturalContext || '';
      if (q.type === 'family_survey' && this.cur.board) v.board = this.cur.board.map((e) => ({ label: e.label, count: e.count, pts: e.pts }));
    }
    if (q && this.cur) this.partyPrivate(v);
    if (s.phase && s.phase.startsWith('final') && this.cur && this.cur.full) {
      v.answer = this.cur.full.answer; v.answerText = this.cur.full.answer; v.accept = this.cur.full.acceptAlso || [];
      v.finalAnswers = this.cur.finalAnswers || {}; v.finalWagers = this.cur.finalWagers || {};
    }
    return v;
  }
  onHostCmd(m) {
    if (!this.hostKey || m.key !== this.hostKey) return;
    const a = m.arg;
    switch (m.cmd) {
      case 'next': return this.s.phase === 'spin' ? this.spinNext() : this.next();
      case 'judge': return this.s.phase === 'final_reveal' ? this.judgeFinal(!!a) : this.judge(!!a);
      case 'skip': return this.skip();
      case 'pause': return this.togglePause();
      case 'time': return this.addTime(+a || 10);
      case 'hype': return this.hype(String(a));
      case 'undo': return this.undoLast();
      case 'tile': return this.pickTile(+a.ci, +a.ti);
      case 'sreveal': return this.hostSurveyReveal(+a);
      case 'sstrike': return this.hostSurveyStrike();
      case 'tthide': return this.ttHide(String(a));
      case 'nextep': return this.s.phase === 'champion' ? this.nextEpisode() : null;
      case 'score': return this.manualScore(a.team, +a.d);
      case 'endround': return this.endRoundEarly();
      case 'start': return this.s.phase === 'teams' ? this.startGame() : null;
      case 'form': return this.s.phase === 'lobby' ? this.formTeams() : null;
    }
  }

  // ---------------- inputs ----------------
  handleInput(m) {
    if (!m || !m.pid) return;
    switch (m.type) {
      case 'join': return this.onJoin(m);
      case 'avatar': if (this.s.players[m.pid]) { this.s.players[m.pid].avatar = m.avatar; this.publish(); } return;
      case 'buzz': return this.onBuzz(m.pid, m.t);
      case 'answer': return this.onAnswer(m.pid, m.choice);
      case 'lifeline': return this.onLifeline(m.pid);
      case 'wager': return this.onWager(m.pid, m.amount);
      case 'vote': return this.onVote(m.pid, m.choice);
      case 'pick': return this.onPick(m.pid, m.choice);
      case 'defense': return this.onDefenseVote(m.pid, m.team);
      case 'finalWager': return this.onFinalWager(m.pid, m.amount);
      case 'finalAnswer': return this.onFinalAnswer(m.pid, m.text);
      case 'blitz': return this.onBlitzAnswer(m.pid, m.i, m.choice);
      case 'react': return this.onReact(m.pid, m.e);
      case 'along': return this.onPlayAlong(m.pid, m.choice);
      case 'survey': return this.onSurveyAnswer(m.pid, m.i, m.text);
      case 'sguess': return this.onSurveyGuess(m.pid, m.text);
      case 'charades': return this.onCharades(m.pid, m.action);
      case 'spin': return this.doSpin(m.pid);
      case 'tile': { // a player on the team in control can pick from their phone (great for family playing from elsewhere)
        const t = this.teamOf(m.pid);
        if (this.s.phase === 'board' && t && t.id === this.s.controlTeam) this.pickTile(+m.ci, +m.ti);
        return;
      }
      case 'party': return this.onParty(m.pid, m);
      case 'host': return this.onHostCmd(m);
    }
  }
}

installParty(Engine);
Object.assign(Engine.prototype, AutoHostMixin);
