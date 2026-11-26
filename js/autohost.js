// ============================================================
// GENERATIONS — Auto-Host + practice bots (mixed into Engine).
//  • Auto-Host: the show runs itself (moves on after reveals, picks a tile if
//    nobody does, judges typed Final Wager answers, rules on Sing It! titles)
//    so the host can put the remote down and PLAY.
//  • Bots: fill seats so one person can try the real show solo (solo.html).
// ============================================================
import { randomAvatar } from './avatar.js';
import { LETTERS } from './util.js';

const BOT_PEOPLE = [
  { name: 'Grandma Pearl', year: 1948, skill: 0.72 },
  { name: 'Uncle Ray', year: 1971, skill: 0.6 },
  { name: 'Auntie Dee', year: 1980, skill: 0.62 },
  { name: 'Cousin Kiki', year: 1999, skill: 0.55 },
  { name: 'Lil Jay', year: 2010, skill: 0.45 },
];
const BOT_TOPTHAT = ['Grandma said so', 'Whoever brought the raisins', 'Uncle Ray, as usual', 'A whole sheet cake', 'The church van', 'Somebody call Auntie', 'Two plates, no shame', 'The good Tupperware'];
const BOT_TRUTHS = [
  ['I won a dance contest in 1979.', 'I can play the piano.', "I've never had a sip of coffee."],
  ['I met a famous singer at the airport.', "I've been to every state in the South.", 'I can juggle five oranges.'],
  ['I was on the local news once.', 'I can do a back handspring.', "I've never lost a game of spades."],
];
const norm = (x) => String(x || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export const AutoHostMixin = {
  // ---------- bots ----------
  addBots(n = 3) {
    const have = Object.values(this.s.players).filter((p) => p.bot).length;
    for (let i = 0; i < n && have + i < BOT_PEOPLE.length; i++) {
      const b = BOT_PEOPLE[have + i];
      const pid = 'bot-' + (have + i) + '-' + Math.random().toString(36).slice(2, 6);
      this.onJoin({ pid, name: b.name, year: b.year, avatar: randomAvatar() });
      Object.assign(this.s.players[pid], { bot: true, skill: b.skill, connected: true });
    }
    this.publish();
  },
  removeBots() {
    for (const p of Object.values(this.s.players)) if (p.bot) { delete this.s.players[p.pid]; for (const t of this.s.teams) t.members = t.members.filter((x) => x !== p.pid); }
    this.publish();
  },
  isBot(pid) { const p = this.s.players[pid]; return !!(p && p.bot); },
  // run each bot action once per state signature, after a human-feeling delay
  botLater(key, ms, fn) {
    this.botQ = this.botQ || {};
    if (this.botQ[key]) return;
    this.botQ[key] = this.now() + ms;
    this.botFns = this.botFns || {};
    this.botFns[key] = fn;
  },
  botRun() {
    if (!this.botQ) return;
    const now = this.now();
    for (const [k, at] of Object.entries(this.botQ)) {
      if (at && now >= at) { this.botQ[k] = 0; const f = this.botFns[k]; delete this.botFns[k]; try { f && f(); } catch (e) { console.warn('bot', e); } }
    }
  },
  botTick() {
    const s = this.s, q = s.q;
    const bots = Object.values(s.players).filter((p) => p.bot);
    if (!bots.length || s.paused) return;
    const say = (m) => this.handleInput(m);
    const sig = (s.phase || '') + ':' + (q ? q.id + ':' + q.stage + ':' + (q.steal ? 's' : '') + ':' + (q.si ? q.si.turn + '.' + q.si.songs.length : '') : '');
    if (sig !== this.botSig) { this.botSig = sig; this.botQ = {}; this.botFns = {}; }

    if (s.phase === 'board') {
      const t = s.teams.find((x) => x.id === s.controlTeam);
      if (t && t.members.length && t.members.every((id) => this.isBot(id))) {
        this.botLater('tile', 2600, () => {
          const open = []; s.board.cats.forEach((c, ci) => c.tiles.forEach((tl, ti) => { if (!tl.used && tl.qid) open.push([ci, ti]); }));
          if (open.length) { const [ci, ti] = rnd(open); this.pickTile(ci, ti); }
        });
      }
    }
    if (s.phase === 'spin' && s.spin && s.spin.stage === 'ready' && this.isBot(s.spin.spinner)) this.botLater('spin', 1800, () => say({ type: 'spin', pid: s.spin.spinner }));
    if (s.phase === 'final_wager') {
      for (const [tid, pid] of Object.entries(s.final.captains || {})) if (this.isBot(pid) && !s.final.wagered[tid]) {
        const t = s.teams.find((x) => x.id === tid);
        this.botLater('fw' + pid, 2500 + Math.random() * 3000, () => say({ type: 'finalWager', pid, amount: Math.round(Math.max(t.score, 500) * (0.3 + Math.random() * 0.5) / 5) * 5 }));
      }
    }
    if (s.phase === 'final_answer') {
      for (const [tid, pid] of Object.entries(s.final.captains || {})) if (this.isBot(pid) && !s.final.answered[tid]) {
        const sk = s.players[pid].skill;
        this.botLater('fa' + pid, 6000 + Math.random() * 8000, () => say({ type: 'finalAnswer', pid, text: Math.random() < sk ? this.cur.full.answer : 'I have no idea, baby' }));
      }
    }
    if (s.phase !== 'question' || !q) return;
    const team = (pid) => this.teamOf(pid);
    const podBots = Object.entries(q.podium || {}).filter(([, pid]) => this.isBot(pid));

    switch (q.stage) {
      case 'open':
        if (q.type === 'family_survey') break;
        for (const [tid, pid] of podBots) if (q.eligible.includes(tid)) {
          const sk = s.players[pid].skill;
          if (Math.random() < 0.25 + sk * 0.6) this.botLater('buzz' + pid, 900 + Math.random() * 3600 * (1.3 - sk), () => say({ type: 'buzz', pid, t: this.now() }));
        }
        break;
      case 'answering':
        if (this.isBot(q.answerer) && q.choices) {
          const sk = s.players[q.answerer].skill, right = this.cur.full.answer;
          const wrong = LETTERS.slice(0, q.choices.length).filter((L) => L !== right);
          this.botLater('ans', 1500 + Math.random() * 3500, () => say({ type: 'answer', pid: q.answerer, choice: Math.random() < sk ? right : rnd(wrong) }));
        }
        break;
      case 'wager':
        if (this.isBot(q.answerer)) this.botLater('wag', 2000, () => say({ type: 'wager', pid: q.answerer, amount: Math.round(q.maxWager * (0.3 + Math.random() * 0.5) / 5) * 5 }));
        break;
      case 'vote':
        for (const b of bots) if (team(b.pid)) this.botLater('v' + b.pid, 1500 + Math.random() * 5000, () => say({ type: 'vote', pid: b.pid, choice: rnd(LETTERS.slice(0, (q.choices || []).length || 2)) }));
        break;
      case 'pick':
        for (const [, pid] of podBots) this.botLater('p' + pid, 2500 + Math.random() * 4000, () => say({ type: 'pick', pid, choice: rnd(LETTERS.slice(0, (q.choices || []).length)) }));
        break;
      case 'pitchvote':
        for (const b of bots) { const mine = team(b.pid); const opts = (q.ogg && q.ogg.order || []).filter((id) => !mine || id !== mine.id); if (opts.length) this.botLater('d' + b.pid, 2000 + Math.random() * 4000, () => say({ type: 'defense', pid: b.pid, team: rnd(opts) })); }
        break;
      case 'blitz':
        for (const [tid, pid] of podBots) {
          const pr = q.blitz.progress[tid];
          if (pr && pr.idx < q.blitz.total) {
            const i = pr.idx, sk = s.players[pid].skill, right = this.cur.blitz[i];
            const n = (q.blitz.qs[i] && q.blitz.qs[i].c || []).length || 2;
            this.botLater('bz' + pid + ':' + i, Math.max(0, q.blitzStart - this.now()) + 1800 + Math.random() * 3000, () => say({ type: 'blitz', pid, i, choice: Math.random() < sk ? right : rnd(LETTERS.slice(0, n).filter((L) => L !== right)) }));
          }
        }
        break;
      case 'ch_act':
        if (this.isBot(q.ch && q.ch.actor)) this.botLater('ch' + q.ch.wi, 4000 + Math.random() * 6000, () => say({ type: 'charades', pid: q.ch.actor, action: Math.random() < 0.7 ? 'got' : 'skip' }));
        break;
      case 'fo_answer': case 'play': case 'steal':
        if (this.isBot(q.guesser)) this.botLater('sg' + (q.strikes || 0) + (q.lastGuess ? q.lastGuess.at : ''), 3500, () => say({ type: 'sguess', pid: q.guesser, text: rnd(['food', 'music', 'church', 'family', 'kids', 'cake', 'spades', 'grill']) }));
        break;
      case 'ht_vote1': case 'ht_vote2': case 'ml_vote': case 'tt_write': case 'tt_vote': case 'tw_vote':
        for (const b of bots) {
          if (q.voted && q.voted[b.pid]) continue;
          this.botLater(q.stage + b.pid, 2500 + Math.random() * 6000, () => {
            if (q.stage === 'ht_vote1' || q.stage === 'ht_vote2') return say({ type: 'party', pid: b.pid, v: Math.random() < 0.5 ? 'agree' : 'disagree' });
            if (q.stage === 'ml_vote') { const c = (q.ml.cands || []).filter((x) => x !== b.pid); return c.length && say({ type: 'party', pid: b.pid, v: rnd(c) }); }
            if (q.stage === 'tt_write') return say({ type: 'party', pid: b.pid, text: rnd(BOT_TOPTHAT) });
            if (q.stage === 'tt_vote') { const e = (q.tt.entries || []).filter((x) => !x.hidden && this.cur.ttAuthors[x.id] !== b.pid); return e.length && say({ type: 'party', pid: b.pid, v: rnd(e).id }); }
            if (q.stage === 'tw_vote' && b.pid !== q.tw.teller) return say({ type: 'party', pid: b.pid, v: Math.floor(Math.random() * 3) });
          });
        }
        break;
      case 'tw_write':
        if (this.isBot(q.tw && q.tw.teller)) this.botLater('tw', 4000, () => say({ type: 'party', pid: q.tw.teller, list: rnd(BOT_TRUTHS), lie: Math.floor(Math.random() * 3) }));
        break;
      case 'si_turn': {
        const tid = this.siActive(), t = s.teams.find((x) => x.id === tid);
        if (t && t.members.length && t.members.every((id) => this.isBot(id)) && !this.cur.pendingTitle) {
          const sang = Math.random() < 0.72;
          if (sang) this.botLater('si', 3000 + Math.random() * 5000, () => say({ type: 'party', pid: t.members[0], text: `A song with “${String(q.si.word).toLowerCase()}” in it (round ${q.si.songs.length + 1})` }));
        }
        break;
      }
    }
  },

  // ---------- Auto-Host ----------
  autoHostTick() {
    const s = this.s, q = s.q;
    if (s.paused || !s.settings.autoHost) return;
    if (['lobby', 'teams', 'champion'].includes(s.phase)) return;
    const now = this.now();
    const sig = [s.phase, q && q.id, q && q.stage, q && q.si && q.si.turn, q && q.ch && q.ch.idx, s.final && s.final.revealIdx, s.final && s.final.judged, s.spin && s.spin.stage].join('|');
    if (sig !== this.ahSig) { this.ahSig = sig; this.ahSince = now; }
    const idle = now - this.ahSince;
    const timerRunning = (q && q.timerEnd && q.timerEnd > now) || (s.final && s.final.timerEnd && s.final.timerEnd > now);
    const after = (ms, fn) => { if (idle >= ms) { this.ahSince = now + 60000; fn(); } };

    if (s.phase === 'segment') return after(4000, () => this.next());
    if (s.phase === 'round_end') return after(6500, () => this.next());
    if (s.phase === 'final_intro') return after(6000, () => this.next());
    if (s.phase === 'spin' && s.spin && (s.spin.stage === 'done' || s.spin.stage === 'again')) return after(3500, () => this.spinNext());
    if (s.phase === 'board') return after(14000, () => {
      const open = []; s.board.cats.forEach((c, ci) => c.tiles.forEach((tl, ti) => { if (!tl.used && tl.qid) open.push([ci, ti]); }));
      if (open.length) { const [ci, ti] = open[Math.floor(Math.random() * open.length)]; this.pickTile(ci, ti); }
    });
    if (s.phase === 'final_reveal') {
      if (!s.final.judged && s.final.revealIdx < s.final.order.length) return after(3500, () => {
        const id = s.final.order[s.final.revealIdx], a = norm((s.final.results[id] || {}).answer);
        const full = this.cur.full || {};
        const ok = !!a && [full.answer, ...(full.acceptAlso || [])].some((x) => { const n = norm(x); return n && (a.includes(n) || (n.includes(a) && a.length >= 4)); });
        this.judgeFinal(ok);
      });
      return after(4500, () => this.next());
    }
    if (s.phase !== 'question' || !q) return;
    if (q.stage === 'si_turn' && this.cur.pendingTitle) return after(1200, () => {
      const t = norm(this.cur.pendingTitle);
      const repeat = q.si.songs.some((x) => norm(x.title) === t);
      this.singJudge(!repeat, repeat ? 'repeat' : undefined);
    });
    if (timerRunning) return;
    const waits = { reveal: 5500, ch_ready: 3500, ch_recap: 4000, si_ready: 2500, si_win: 4500 };
    if (waits[q.stage] != null) return after(waits[q.stage], () => this.next());
    // safety net: nothing has moved for a while and no clock is running
    if (!['fo_answer', 'play', 'steal', 'si_turn', 'answering'].includes(q.stage)) return after(25000, () => this.next());
  },
};
