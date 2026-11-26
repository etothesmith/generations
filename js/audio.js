// Web Audio synthesized sound effects — no audio files needed.
let ctx = null;
let enabled = localStorage.getItem('gen-sound') !== 'off';

export function soundOn() { return enabled; }
export function setSound(on) { enabled = on; localStorage.setItem('gen-sound', on ? 'on' : 'off'); }
export function unlockAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, start, dur, type = 'sine', vol = 0.25, endFreq = null) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.05);
}
function noise(start, dur, vol = 0.3, filterFrom = 2000, filterTo = 200, q = 1) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(filterFrom, start);
  f.frequency.exponentialRampToValueAtTime(filterTo, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(start);
}

const SFX = {
  buzz(t) { tone(140, t, 0.45, 'square', 0.18); tone(146, t, 0.45, 'sawtooth', 0.1); },
  correct(t) { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.35, 'triangle', 0.22)); },
  wrong(t) { tone(392, t, 0.35, 'triangle', 0.25, 370); tone(370, t + 0.35, 0.35, 'triangle', 0.25, 349); tone(349, t + 0.7, 0.9, 'triangle', 0.25, 300); },
  scratch(t) { noise(t, 0.18, 0.5, 3000, 600, 2); noise(t + 0.2, 0.25, 0.5, 500, 2500, 2); },
  stamp(t) { tone(90, t, 0.35, 'sine', 0.7, 40); noise(t, 0.15, 0.6, 800, 100, 0.7); },
  tick(t) { tone(1200, t, 0.05, 'square', 0.08); },
  tock(t) { tone(800, t, 0.05, 'square', 0.08); },
  flip(t) { noise(t, 0.25, 0.25, 600, 4000, 1.5); },
  join(t) { tone(660, t, 0.12, 'sine', 0.2); tone(990, t + 0.1, 0.18, 'sine', 0.2); },
  reveal(t) { tone(330, t, 0.15, 'triangle', 0.2); tone(494, t + 0.15, 0.3, 'triangle', 0.2); },
  vote(t) { tone(880, t, 0.08, 'sine', 0.15); },
  fanfare(t) {
    const n = [[523, 0, .18], [523, .2, .18], [523, .4, .18], [698, .6, .5], [880, 1.1, .2], [784, 1.3, .2], [880, 1.5, .9]];
    n.forEach(([f, s, d]) => { tone(f, t + s, d, 'sawtooth', 0.12); tone(f / 2, t + s, d, 'triangle', 0.15); });
  },
  whoosh(t) { noise(t, 0.4, 0.3, 300, 3000, 0.8); },
  applause(t) { for (let i = 0; i < 26; i++) noise(t + i * 0.07 + Math.random() * 0.05, 0.09, 0.22, 2500, 1500, 1.2); },
  ooh(t) { tone(330, t, 1.1, 'sine', 0.18, 220); tone(415, t, 1.1, 'sine', 0.12, 277); tone(262, t + 0.05, 1.1, 'triangle', 0.1, 196); },
  drumroll(t) { for (let i = 0; i < 28; i++) noise(t + i * 0.055, 0.05, 0.25 + i * 0.012, 900, 300, 0.8); tone(90, t + 1.6, 0.4, 'sine', 0.6, 45); noise(t + 1.6, 0.6, 0.35, 6000, 3000, 0.6); },
  airhorn(t) { [0, 0.28, 0.56].forEach((d, i) => { tone(466, t + d, i === 2 ? 0.7 : 0.22, 'sawtooth', 0.14); tone(587, t + d, i === 2 ? 0.7 : 0.22, 'sawtooth', 0.1); }); },
  crickets(t) { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) tone(4200, t + i * 0.35 + j * 0.04, 0.025, 'sine', 0.06); },
  laugh(t) { [0, .16, .32, .5, .66].forEach((d, i) => tone(520 - i * 30, t + d, 0.12, 'triangle', 0.16, 420 - i * 30)); },
  boo(t) { tone(180, t, 1.2, 'sawtooth', 0.09, 120); tone(190, t, 1.2, 'triangle', 0.12, 125); },
  church(t) { [[262, 0], [330, 0], [392, 0], [523, 0.6], [659, 0.6], [784, 0.6]].forEach(([f, d]) => tone(f, t + d, 1.1, 'sine', 0.1)); },
};

export function sfx(name) {
  if (!enabled) return;
  try {
    unlockAudio();
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.01);
  } catch (e) { /* audio not available */ }
}
