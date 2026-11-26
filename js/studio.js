// Art & Animation Studio — preview every art slot and trigger every animation.
import { loadArt, ART, ASSET_FILES, ICON_ORDER, BADGE_ORDER, iconHTML, badgeHTML } from './assets.js';
import { renderAvatar, randomAvatar } from './avatar.js';
import { confetti, stamp, banner, shockwave, reaction, mountCrowd, crowdReact, showOpen, roundCard, mountMascot, mascotSay, setConfettiTheme } from './fx.js';
import { THEME_FILES, SPRITE_SETS } from './assets.js';
import { sfx, unlockAudio } from './audio.js';
import { GENERATIONS } from './util.js';

const SLOT_INFO = {
  stage: ['Stage backdrop', 'Behind every host screen'],
  logo: ['Title logo', 'Lobby, landing page, show open'],
  podium: ['Podium', 'Contestant podiums (auto-tinted per team)'],
  icons: ['Icon sheet (24)', 'Category + mini-game icons — see grid below'],
  stamps: ['Stamps', 'CARD REVOKED! / CARD SAVED!'],
  badges: ['Generation crests', 'Lobby player badges'],
  trophy: ['Trophy', 'Champion ceremony'],
  crowd: ['Crowd strip', 'Studio audience along the bottom — bounces & gasps'],
  curtain: ['Curtain', 'Show-open curtains (split in half automatically)'],
  mascot: ['Host mascot (4 poses)', 'Pops up with one-liners: present · point · cheer · gasp'],
  roundFrame: ['Round frame', 'Behind round title cards and Round 2 intros'],
};

const demoTeams = [
  { name: 'Old School', color: '#F2B632', members: ['a', 'b', 'c'] },
  { name: 'New School', color: '#12A4A4', members: ['d', 'e'] },
];
const demoAvatars = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, randomAvatar()]));

function preview(key) {
  if (key === 'stamps') return ART.revoked ? `<img src="${ART.revoked}"> <img src="${ART.saved}" style="margin-left:6px">` : '';
  if (key === 'icons') return Object.keys(ART.icons).length ? `${Object.keys(ART.icons).length}/24 icons cut` : '';
  if (key === 'badges') return Object.keys(ART.badges).length ? BADGE_ORDER.map((g) => badgeHTML(g)).join('') : '';
  if (key === 'mascot') return ART.mascot ? ART.mascot.map((u) => `<img src="${u}" style="height:120px">`).join('') : '';
  return ART[key] ? `<img src="${ART[key]}">` : '';
}
function loaded(key) {
  if (key === 'stamps') return !!ART.revoked;
  if (key === 'icons') return Object.keys(ART.icons).length > 0;
  if (key === 'badges') return Object.keys(ART.badges).length > 0;
  if (key === 'mascot') return !!ART.mascot;
  return !!ART[key];
}

function draw() {
  const el = document.getElementById('studio');
  const slots = Object.entries(ASSET_FILES).map(([k, f]) => {
    const ok = loaded(k), [title, use] = SLOT_INFO[k] || [k, ''];
    return `<div class="slot ${ok ? 'ok' : ''}"><div class="nm">${title}</div><code>assets/${f}.png</code>
      <div class="st" style="color:${ok ? 'var(--emerald)' : 'var(--dim)'}">${ok ? '✅ Gemini art loaded' : '⬜ using built-in art'}</div>
      <div class="pv">${preview(k) || '<span style="color:#888;font-weight:700">built-in</span>'}</div>
      <p style="font-size:12px;margin:8px 0 0">${use}</p></div>`;
  }).join('');
  const icons = ICON_ORDER.map((k, i) => `<div class="ic ${ART.icons[k] ? 'ok' : ''}">${iconHTML(k)}<div>${i + 1}. ${k}</div></div>`).join('');
  const exprs = ['idle', 'focused', 'cheer', 'sweat', 'gasp'];
  const lab = exprs.map((x) => `<div class="hd">${x}</div>`).join('') +
    Object.values(demoAvatars).slice(0, 3).map((a) => exprs.map((x) => `<div class="cell">${renderAvatar(a, x, 120)}</div>`).join('')).join('');
  const podium = (t, pid) => `<div class="podium" style="--tc:${t.color}" id="pod-${pid}"><div class="spot"></div>
      <div class="av">${renderAvatar(demoAvatars[pid], 'focused', 150)}</div>
      <div class="${ART.podium ? 'desk art' : 'desk'}" ${ART.podium ? `style="--podium-art:url(${ART.podium})"` : ''}><div class="led"><div class="pn">Player</div><div class="tn">${t.name}</div><div class="sc">$1,200</div></div></div></div>`;
  el.innerHTML = `
    <h1>Art &amp; Animation Studio</h1>
    <p>Drop Gemini images into <code>assets/</code> using the filenames below, then refresh this page. Green means your art is loaded. Gray means the game is using its built-in art. Every animation in the game can be triggered below, so you can check new art in motion before game night.</p>
    <h2>Art slots</h2><div class="slots">${slots}</div>
    <h2>Icon sheet: order matters</h2><div class="icons-grid">${icons}</div>
    <h2>Generation badges</h2><div class="btns">${BADGE_ORDER.map((g) => `<span class="gen-chip" style="background:${GENERATIONS[g].color};font-size:14px">${badgeHTML(g) || GENERATIONS[g].icon} ${GENERATIONS[g].label}</span>`).join('')}</div>
    <h2>Themes</h2>
    <div class="btns"><button class="btn navy" data-theme="classic">Classic</button>${Object.keys(THEME_FILES).map((t) => `<button class="btn navy" data-theme="${t}" ${ART.themes[t] ? '' : 'disabled'}>${t}${ART.themes[t] ? '' : ' (missing)'}</button>`).join('')}</div>
    <h2>Animated characters</h2>
    <p>Gemini 4-frame strips: <code>&lt;prefix&gt;focused / cheer / sweat / gasp.png</code>. Players can pick these on their phones under "Style."</p>
    ${SPRITE_SETS.map((set) => ART.sprites[set.id] ? `<div class="avlab">${['idle', 'focused', 'cheer', 'sweat', 'gasp'].map((x) => `<div class="hd">${x}</div>`).join('')}${['idle', 'focused', 'cheer', 'sweat', 'gasp'].map((x) => `<div class="cell">${renderAvatar({ sprite: set.id }, x, 140)}</div>`).join('')}</div>` : `<p>⬜ ${set.name}: files <code>assets/${set.prefix}*.png</code> not found</p>`).join('')}
    <h2>Host mascot</h2>
    <div class="btns">${ART.mascot ? [['present', 'Welcome to GENERATIONS!'], ['point', 'Hands on those buzzers!'], ['cheer', "Okayyy! I see you!"], ['gasp', 'Somebody call Grandma!']].map(([m, l]) => `<button class="btn" data-m="${m}" data-l="${l}">${m}</button>`).join('') : '<p>⬜ assets/host_mascot.png not found</p>'}</div>
    <h2>Animations</h2>
    <div class="btns">
      <button class="btn" data-a="showopen">🎬 Show Open</button>
      <button class="btn" data-a="round2">Round 2 Card</button>
      <button class="btn" data-a="round3">Round 3 Card</button>
      <button class="btn red" data-a="revoked">CARD REVOKED!</button>
      <button class="btn green" data-a="saved">CARD SAVED!</button>
      <button class="btn" data-a="confetti">🎉 Confetti</button>
      <button class="btn red" data-a="steal">STEAL! banner</button>
      <button class="btn" data-a="crossover">🌉 Crossover</button>
      <button class="btn" data-a="buzz">🔔 Buzz shockwave</button>
      <button class="btn navy" data-a="reacts">👏🏾 Reaction burst</button>
      <button class="btn navy" data-a="cheer">Crowd cheer</button>
      <button class="btn navy" data-a="gasp">Crowd gasp</button>
    </div>
    <div class="demo-pod" style="margin-top:20px">${podium(demoTeams[0], 'a')}${podium(demoTeams[1], 'd')}</div>
    <h2>Sound board</h2>
    <div class="btns">${['buzz', 'correct', 'wrong', 'scratch', 'stamp', 'tick', 'flip', 'join', 'reveal', 'vote', 'whoosh', 'fanfare'].map((n) => `<button class="btn navy" data-s="${n}">${n}</button>`).join('')}</div>
    <h2>Avatar lab <button class="btn ghost" data-a="reroll" style="font-size:12px;padding:.3em .8em">🎲 reroll</button></h2>
    <p>These are the built-in layered avatars. Their expressions change live during the game. To use Money Moves avatars instead, see "Avatar swap" in the README.</p>
    <div class="avlab">${lab}</div>`;
}

document.addEventListener('click', (e) => {
  unlockAudio();
  const b = e.target.closest('[data-a],[data-s],[data-theme],[data-m]');
  if (!b) return;
  if (b.dataset.s) return sfx(b.dataset.s);
  if (b.dataset.m) return mascotSay(b.dataset.m, b.dataset.l, 2800);
  if (b.dataset.theme) {
    const t = b.dataset.theme, url = t === 'classic' ? ART.stage : ART.themes[t];
    const bg = document.getElementById('bg');
    bg.style.backgroundImage = url ? `url(${url})` : ''; setConfettiTheme(t); confetti(90); return;
  }
  const av = (pid) => renderAvatar(demoAvatars[pid], 'cheer', 90);
  switch (b.dataset.a) {
    case 'showopen': sfx('fanfare'); showOpen(demoTeams, av); setTimeout(() => crowdReact('cheer', 2200), 1800); break;
    case 'round2': sfx('whoosh'); roundCard(2, 'For the Culture Remix'); break;
    case 'round3': sfx('whoosh'); roundCard(3, 'The Final Wager'); break;
    case 'revoked': sfx('stamp'); sfx('scratch'); stamp('revoked'); crowdReact('gasp'); break;
    case 'saved': sfx('stamp'); stamp('saved'); confetti(80); break;
    case 'confetti': sfx('correct'); confetti(150); crowdReact('cheer'); break;
    case 'steal': banner('STEAL!', true, 1300); break;
    case 'crossover': sfx('fanfare'); confetti(70); crowdReact('cheer'); banner('GENERATION<br>CROSSOVER!<div class="banner-sub">Keisha +$100</div>', false, 2200); break;
    case 'buzz': sfx('buzz'); shockwave(document.getElementById('pod-a')); break;
    case 'reacts': ['👏🏾', '🔥', '😂', '🙌🏾', '😱', '🤦🏾', '💯', '🃏'].forEach((r, i) => setTimeout(() => reaction(r, ['Big Mama', 'Jaylen', 'Keisha', 'Uncle Ray'][i % 4]), i * 160)); break;
    case 'cheer': crowdReact('cheer'); break;
    case 'gasp': crowdReact('gasp'); break;
    case 'reroll': for (const k of Object.keys(demoAvatars)) demoAvatars[k] = randomAvatar(); draw(); break;
  }
});

loadArt().then(() => {
  const bg = document.getElementById('bg');
  if (ART.stage) { bg.style.backgroundImage = `url(${ART.stage})`; bg.classList.add('has-art'); }
  bg.style.position = 'fixed';
  mountCrowd(bg);
  mountMascot(document.body);
  draw();
});
