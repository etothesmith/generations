// Shared by the phone and the remote watch screen.
// Firebase drops empty arrays/objects — put the defaults back.
export function normalize(s) {
  s.players = s.players || {};
  s.teams = (s.teams || []).filter(Boolean);
  for (const t of s.teams) { t.members = t.members || []; t.score = t.score || 0; t.lifelines = t.lifelines || 0; t.rot = t.rot || 0; }
  s.categories = s.categories || [];
  if (s.q) {
    const q = s.q;
    q.podium = q.podium || {}; q.attempted = q.attempted || []; q.eligible = q.eligible || [];
    q.lockouts = q.lockouts || {}; q.choices = q.choices || null; q.timerEnd = q.timerEnd || 0;
    q.huddleUntil = q.huddleUntil || 0; q.voteCount = q.voteCount || 0; q.value = q.value || 0;
    if (q.top !== undefined || q.stage === 'reveal') q.top = q.top || [];
    q.awards = q.awards || {}; q.counts = q.counts || {};
    if (q.type === 'family_survey') { q.board = (q.board || []).map((b) => b || { revealed: false }); q.foTries = q.foTries || []; q.bank = q.bank || 0; q.strikes = q.strikes || 0; }
    if (q.ch) { q.ch.counts = q.ch.counts || {}; q.ch.log = q.ch.log || []; q.ch.order = q.ch.order || []; q.ch.idx = q.ch.idx || 0; }
    q.bench = q.bench || null; q.alongCount = q.alongCount || 0;
    if (q.blitz) { q.blitz.qs = q.blitz.qs || []; q.blitz.progress = q.blitz.progress || {}; for (const k of Object.keys(q.podium)) q.blitz.progress[k] = Object.assign({ idx: 0, correct: 0 }, q.blitz.progress[k]); }
    q.voted = q.voted || {};
    if (q.type === 'hot_take') { q.ht = q.ht || {}; q.ht.speakers = q.ht.speakers || {}; q.ht.devil = q.ht.devil || {}; q.ht.turn = q.ht.turn || 0; }
    if (q.type === 'most_likely') { q.ml = q.ml || {}; q.ml.cands = q.ml.cands || []; q.ml.counts = q.ml.counts || {}; q.ml.top = q.ml.top || []; q.ml.matchers = q.ml.matchers || []; }
    if (q.type === 'top_that') { q.tt = q.tt || {}; q.tt.entries = q.tt.entries || null; q.tt.topIds = q.tt.topIds || []; if (q.tt.entries) q.tt.entries = q.tt.entries.filter(Boolean); }
    if (q.type === 'two_truths') { q.tw = q.tw || {}; q.tw.counts = q.tw.counts || [0, 0, 0]; q.tw.right = q.tw.right || []; q.tw.fooled = q.tw.fooled || 0; }
    if (q.ogg) { q.ogg.picks = q.ogg.picks || {}; q.ogg.order = q.ogg.order || []; if (q.ogg.pitchIdx === undefined) q.ogg.pitchIdx = -1; }
  }
  if (s.final) {
    const f = s.final;
    f.captains = f.captains || {}; f.wagered = f.wagered || {}; f.answered = f.answered || {};
    f.results = f.results || {}; f.order = f.order || []; f.timerEnd = f.timerEnd || 0;
    for (const r of Object.values(f.results)) { if (r.correct === undefined) r.correct = null; if (r.wager === undefined) r.wager = null; }
  }
  if (s.remix) { s.remix.segments = s.remix.segments || []; s.remix.segIdx = s.remix.segIdx || 0; }
  if (s.fx) s.fx.data = s.fx.data || {};
  s.winners = s.winners || [];
  s.stats = s.stats || {}; s.awards = s.awards || {}; s.settings = s.settings || {};
  if (s.season) s.season.teams = s.season.teams || {};
  if (s.survey) { s.survey.prompts = s.survey.prompts || []; s.survey.answered = s.survey.answered || {}; }
  s.round = s.round || 0;
  return s;
}
