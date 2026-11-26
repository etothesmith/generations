// Visual effects: confetti, stamp slam, banners, screen shake, buzzer shockwave.
import { ART } from './assets.js';

const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let layer = null;
function fxLayer() {
  if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; document.body.appendChild(layer); }
  return layer;
}
function flash(html, ms) {
  const el = document.createElement('div');
  el.innerHTML = html;
  const node = el.firstElementChild;
  fxLayer().appendChild(node);
  setTimeout(() => node.remove(), ms);
  return node;
}

export function shake(target = document.querySelector('.host') || document.body) {
  if (reduced()) return;
  target.classList.remove('screen-shake'); void target.offsetWidth; target.classList.add('screen-shake');
}

export function stamp(kind) {
  const img = kind === 'revoked' ? ART.revoked : ART.saved;
  const html = img
    ? `<img class="stamp-img" src="${img}" alt="">`
    : `<div class="stamp ${kind}">${kind === 'revoked' ? 'CARD<br>REVOKED!' : 'CARD<br>SAVED!'}<small>${kind === 'revoked' ? 'you knew better' : 'you know the culture'}</small></div>`;
  flash(html, 2400);
  if (kind === 'revoked') setTimeout(() => shake(), 180);
}

export function banner(text, red = false, ms = 1600) {
  flash(`<div class="banner-fx ${red ? 'red' : ''}">${text}</div>`, ms);
}

export function shockwave(el) {
  if (!el) return;
  const s = document.createElement('div');
  s.className = 'shock';
  el.appendChild(s);
  setTimeout(() => s.remove(), 950);
}

// ---------- confetti (canvas, capped particles) ----------
let cv = null, ctx = null, parts = [], running = false;
let COLORS = ['#F2B632', '#C8102E', '#1E9E5A', '#FFF6E5', '#12A4A4', '#5B3FA0'];
export const THEME_CONFETTI = {
  classic: ['#F2B632', '#C8102E', '#1E9E5A', '#FFF6E5', '#12A4A4', '#5B3FA0'],
  juneteenth: ['#C8102E', '#151515', '#1E9E5A', '#F2B632', '#FFF6E5'],
  christmas: ['#C8102E', '#1E9E5A', '#F2B632', '#FFF6E5', '#FFFFFF'],
  reunion: ['#12A4A4', '#F2B632', '#E2711D', '#5B3FA0', '#FFF6E5'],
};
export function setConfettiTheme(t) { COLORS = THEME_CONFETTI[t] || THEME_CONFETTI.classic; }
export function confetti(amount = 140) {
  if (reduced()) return;
  if (!cv) {
    cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv);
    ctx = cv.getContext('2d');
  }
  cv.width = innerWidth; cv.height = innerHeight;
  const n = Math.min(150, amount);
  for (let i = 0; i < n && parts.length < 220; i++) {
    parts.push({
      x: innerWidth * (0.15 + Math.random() * 0.7), y: innerHeight * 0.35 + (Math.random() - .5) * 80,
      vx: (Math.random() - .5) * 16, vy: -8 - Math.random() * 12, g: .32 + Math.random() * .1,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
      c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 0,
    });
  }
  if (!running) { running = true; requestAnimationFrame(step); }
}
function step() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter((p) => p.y < cv.height + 40 && p.life < 400);
  for (const p of parts) {
    p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
    ctx.restore();
  }
  if (parts.length) requestAnimationFrame(step);
  else { running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
}

// ---------- floating emoji reactions from phones ----------
export function reaction(e, name) {
  const L = fxLayer();
  if (L.querySelectorAll('.react').length > 40) return;
  const d = document.createElement('div');
  d.className = 'react';
  d.style.left = (4 + Math.random() * 88) + 'vw';
  d.style.setProperty('--drift', ((Math.random() - .5) * 12).toFixed(1) + 'vw');
  d.style.animationDuration = (2.6 + Math.random() * 1.2).toFixed(2) + 's';
  d.innerHTML = `<span class="re">${e}</span>${name ? `<span class="rn">${String(name).replace(/[<>&]/g, '')}</span>` : ''}`;
  L.appendChild(d);
  setTimeout(() => d.remove(), 4200);
}

// ---------- studio audience (Gemini art: assets/crowd.png, else SVG silhouettes) ----------
let crowdEl = null;
export function mountCrowd(parent) {
  crowdEl = document.createElement('div');
  crowdEl.className = 'crowd';
  if (ART.crowd) crowdEl.innerHTML = `<img src="${ART.crowd}" alt="">`;
  else {
    let g = '';
    const rnd = (a) => { const x = Math.sin(a * 999) * 10000; return x - Math.floor(x); };
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 24; i++) {
        const x = i * 70 + (row ? 35 : 0) + rnd(i + row * 50) * 20;
        const y = row ? 150 : 118;
        const hair = rnd(i * 3 + row);
        const head = hair > .7 ? `<circle cx="0" cy="-58" r="34"/>` : hair > .5 ? `<circle cx="-18" cy="-82" r="14"/><circle cx="18" cy="-82" r="14"/>` : '';
        const arm = rnd(i * 7 + row) > .8 ? `<path d="M30 -10 L52 -80" stroke-width="16" stroke-linecap="round" class="arm"/>` : '';
        g += `<g class="fan" style="--d:${(rnd(i + row * 9) * .4).toFixed(2)}s" transform="translate(${x} ${y})">${head}<circle cx="0" cy="-55" r="25"/><path d="M-44 60 Q-46 -12 0 -18 Q46 -12 44 60 Z"/>${arm}</g>`;
      }
    }
    crowdEl.innerHTML = `<svg viewBox="0 0 1700 210" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g fill="#0b0c1f" stroke="#0b0c1f">${g}</g></svg>`;
  }
  parent.appendChild(crowdEl);
  return crowdEl;
}
export function crowdReact(kind = 'cheer', ms = 1600) {
  if (!crowdEl || reduced()) return;
  crowdEl.classList.remove('cheer', 'gasp', 'bob');
  void crowdEl.offsetWidth;
  crowdEl.classList.add(kind);
  clearTimeout(crowdEl._t);
  crowdEl._t = setTimeout(() => crowdEl.classList.remove(kind), ms);
}

// ---------- show open: curtains, logo slam, team intros ----------
export function showOpen(teams, avatarFn, ms = 7000) {
  const L = fxLayer();
  const el = document.createElement('div');
  el.className = 'showopen';
  const curtainStyle = ART.curtain ? `style="background-image:url(${ART.curtain})"` : '';
  const logo = ART.logo ? `<img src="${ART.logo}" alt="GENERATIONS">` : 'GENERATIONS';
  el.innerHTML = `
    <div class="so-curtain l ${ART.curtain ? 'art' : ''}" ${curtainStyle}></div><div class="so-curtain r ${ART.curtain ? 'art' : ''}" ${curtainStyle}></div>
    <div class="so-stage">
      <div class="so-kicker">Live from the living room…</div>
      <div class="so-logo logo">${logo}</div>
      <div class="so-teams">${teams.map((t, i) => `<div class="so-team" style="--tc:${t.color};animation-delay:${2.4 + i * .45}s">
        <div class="so-avs">${t.members.slice(0, 4).map((m) => avatarFn(m)).join('')}</div><div class="so-tn">${t.name}</div></div>`).join('<div class="so-vs">VS</div>')}</div>
      <div class="so-round">Round 1 · The Generations Board</div>
    </div>`;
  const done = () => { el.remove(); if (!L.querySelector('.showopen')) L.style.pointerEvents = 'none'; };
  el.addEventListener('click', done);
  L.appendChild(el);
  L.style.pointerEvents = 'auto';
  setTimeout(() => { el.classList.add('out'); }, ms - 600);
  setTimeout(done, ms);
}

// ---------- round title card ----------
export function roundCard(n, title, ms = 2800) {
  const el = document.createElement('div');
  el.className = 'roundcard';
  const framed = ART.roundFrame ? ` framed" style="background-image:url(${ART.roundFrame})` : '';
  el.innerHTML = `<div class="rc-band"></div><div class="rc-text${framed}"><div class="rc-n">ROUND ${n}</div><div class="rc-t">${title}</div></div>`;
  fxLayer().appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- host mascot (Gemini strip: present, point, cheer, gasp) ----------
const MOOD = { present: 0, point: 1, cheer: 2, gasp: 3 };
let mascotEl = null, mascotTimer = null, mascotPinned = false;
export function mountMascot(parent) {
  if (!ART.mascot) return null;
  mascotEl = document.createElement('div');
  mascotEl.className = 'mascot';
  mascotEl.innerHTML = `<div class="m-bubble"></div><img class="m-img" src="${ART.mascot[0]}" alt="">`;
  parent.appendChild(mascotEl);
  return mascotEl;
}
export function mascotSay(mood = 'present', line = '', ms = 2800, pin = false) {
  if (!mascotEl) return;
  const img = mascotEl.querySelector('.m-img');
  img.src = ART.mascot[MOOD[mood] ?? 0];
  const b = mascotEl.querySelector('.m-bubble');
  b.textContent = line;
  b.classList.toggle('empty', !line);
  mascotEl.classList.remove('pop'); void mascotEl.offsetWidth;
  mascotEl.classList.add('show', 'pop');
  mascotEl.dataset.mood = mood;
  mascotPinned = pin;
  clearTimeout(mascotTimer);
  if (!pin) mascotTimer = setTimeout(() => mascotEl.classList.remove('show'), ms);
}
export function mascotHide() { if (mascotEl && !mascotPinned) mascotEl.classList.remove('show'); }
export function mascotUnpin() { mascotPinned = false; if (mascotEl) mascotEl.classList.remove('show'); }
export const hasMascot = () => !!mascotEl;

// ---------- Family Survey strike: big red X's ----------
export function strikeFx(n = 1) {
  const el = document.createElement('div');
  el.className = 'strike-fx';
  el.innerHTML = Array.from({ length: Math.max(1, Math.min(3, n)) }, () => '<span>✕</span>').join('');
  fxLayer().appendChild(el);
  setTimeout(() => el.remove(), 1300);
  if (n >= 3) shake();
}
