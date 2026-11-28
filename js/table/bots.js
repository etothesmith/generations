// ============================================================
// The family bots: a big cast, different personalities and play
// styles, and table talk that doesn't repeat. Every table gets a
// fresh mix, so no two games feel the same.
// ============================================================
import { renderAvatar, randomAvatar } from '../avatar.js';

// photo characters (from the cookout art)
const PHOTO = [
  { name: 'Big Mama', img: 'assets/cookout/guest_grandma.webp' },
  { name: 'Uncle Ray', img: 'assets/cookout/guest_grandpa.webp' },
  { name: 'Auntie Dee', img: 'assets/cookout/guest_auntie.webp' },
  { name: 'DJ Cuz', img: 'assets/cookout/guest_dj.webp' },
  { name: 'Cousin Tasha', img: 'assets/cookout/guest_cousin.webp' },
  { name: 'Lil Man', img: 'assets/cookout/guest_teen.webp' },
  { name: 'Lil Sis', img: 'assets/cookout/guest_lilsis.webp' },
  { name: 'Pitmaster Pete', img: 'assets/cookout/guest_grill.webp' },
];
// drawn characters (a brand-new face every time)
const NAMES = ['Aunt Bev', 'Cousin Pookie', 'Deacon Jones', 'Uncle Junebug', 'Ms. Pat', 'Big Ant', 'Nae Nae', 'Lil Rodney', 'Auntie Pam', 'Cousin Dre', 'Sister Gloria', 'Uncle Clyde', 'Tiny', 'Peaches', 'Boo', 'Cousin Kiki', 'Unc Leroy', 'Mama Jean', 'Cousin Shay', 'Big Rob', 'Lil Tay', 'Mr. Willie', 'Miss Ruby', 'Coach T', 'Dee Dee', 'Brother Marcus', 'Auntie Vee', 'JJ', 'Cousin Man-Man', 'Granny Lou', 'Uncle Smitty', 'Keisha', 'Tyrone', 'Cousin Bree', 'Pop-Pop', 'Aunt Sharon', 'Lil Mike', 'Sweet Pea', 'Cousin Ronnie', 'Ms. Hattie'];

export const STYLES = {
  shark: { label: '🦈 plays to win', bold: 0.35, chat: 0.55, speed: [500, 1000] },
  wild: { label: '🎲 bids big', bold: 0.8, chat: 0.75, speed: [400, 850] },
  steady: { label: '🧘🏾 cool and steady', bold: 0, chat: 0.35, speed: [700, 1300] },
  careful: { label: '🐢 plays it safe', bold: -0.5, chat: 0.3, speed: [900, 1700] },
  mouth: { label: '🗣️ all mouth', bold: 0.2, chat: 1, speed: [450, 950] },
  sweet: { label: '🍬 sweet as pie', bold: -0.15, chat: 0.6, speed: [650, 1200] },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Three (or n) bots, never the same name twice; skips the coach's character. */
export function castBots(n = 3, avoid = []) {
  const out = [], used = new Set(avoid);
  const photo = shuffled(PHOTO.filter((p) => !used.has(p.name) && !avoid.includes(p.img)));
  const names = shuffled(NAMES.filter((x) => !used.has(x)));
  const styles = shuffled(Object.keys(STYLES));
  for (let i = 0; i < n; i++) {
    const usePhoto = photo.length && Math.random() < 0.55;
    const base = usePhoto ? photo.pop() : { name: names.pop(), av: randomAvatar() };
    used.add(base.name);
    out.push({ kind: 'bot', ...base, style: styles[i % styles.length] });
  }
  return out;
}
export function botFace(s) {
  if (s.img) return `<img src="${s.img}" alt="">`;
  if (s.av) return renderAvatar(s.av, 'cheer', 52);
  return '';
}

// ---------- table talk that doesn't repeat ----------
const COMMON = {
  start: ['Shuffle up and deal!', "Y'all ready to lose?", 'Let\'s get it!', 'I been waiting all week for this', 'Somebody turn the music up 🎶', 'No crying at my table', 'Bring the snacks over here', "Don't be slow-playing me tonight", "Who's keeping score? 'Cause I'm winning", 'Pull up a chair, baby'],
  nudge: ['Take your time, baby… but not ALL of it 😂', 'We waiting on you!', 'Today, please 🙏🏾', 'You need the coach? 👀', 'The food getting cold…', 'Thinking hard over there!', 'Any day now, cuz', 'Did you fall asleep? 😴'],
  win: ['Good game, good game 😎', 'Run it back? I\'ll beat you again', 'That\'s how we do it!', 'Write that down!', 'Tell your friends 😂', 'Too easy, family', 'We the champs!'],
  lose: ['Okay, okay… y\'all got that one', 'Rematch. Right now.', 'I want a recount 😤', 'Lucky cards, that\'s all that was', 'Respect. Good game.', "I'll get you next time"],
  oops: ['Ooh, that hurt', 'Whew. Next hand.', 'My bad, partner 😬', "Don't look at me like that"],
  nice: ['Okay partner, I SEE you! 🙌🏾', 'That\'s my partner!', 'Yes ma\'am / yes sir!', 'We cooking now 🔥'],
};
const FLAVOR = {
  mouth: { start: ["I'mma talk trash the WHOLE game", 'Get your crying towels ready 😂'], win: ['Sit DOWN somewhere 😂', 'Put some respect on my name'] },
  sweet: { start: ['Have fun, babies 🥰', 'Good luck everybody!'], lose: ['Y\'all played so good! 🥰'], nudge: ['No rush, sugar ❤️'] },
  careful: { start: ['Slow and steady wins the race'] },
  wild: { start: ["I'm bidding big tonight, watch"], win: ['Go big or go home!'] },
};

const SAID_KEY = 'tbl-said';
function recent() { try { return JSON.parse(localStorage.getItem(SAID_KEY) || '[]'); } catch (e) { return []; } }
/** A line nobody has heard recently (remembered across games). */
export function lineFor(key, bot, gameLines = {}) {
  const pool = [...(gameLines[key] || []), ...(COMMON[key] || []), ...((FLAVOR[bot && bot.style] || {})[key] || [])];
  if (!pool.length) return null;
  const r = recent();
  const fresh = pool.filter((l) => !r.includes(l));
  const line = pick(fresh.length ? fresh : pool);
  r.push(line);
  try { localStorage.setItem(SAID_KEY, JSON.stringify(r.slice(-120))); } catch (e) { /* */ }
  return line;
}
export const chatty = (bot) => (STYLES[bot && bot.style] || STYLES.steady).chat;
export const speedOf = (bot) => (STYLES[bot && bot.style] || STYLES.steady).speed;
export const boldOf = (bot) => (STYLES[bot && bot.style] || STYLES.steady).bold;
