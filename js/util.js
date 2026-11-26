// Shared constants & helpers

export const GENERATIONS = {
  elders:     { key: 'elders',     label: 'The Elders',     sub: 'Silent & Boomers', nick: 'The OGs',            color: '#F2B632', icon: '👑', range: 'before 1965' },
  genx:       { key: 'genx',       label: 'Gen X',          sub: '1965–1980',        nick: 'The Golden Era',     color: '#C8102E', icon: '📻', range: '1965–1980' },
  millennial: { key: 'millennial', label: 'Millennials',    sub: '1981–1996',        nick: 'The 90s/2000s Crew', color: '#5B3FA0', icon: '📱', range: '1981–1996' },
  genz:       { key: 'genz',       label: 'Gen Z',          sub: '1997–2012',        nick: 'The Next Wave',      color: '#12A4A4', icon: '⚡', range: '1997–2012' },
  alpha:      { key: 'alpha',      label: 'Gen Alpha',      sub: '2013+',            nick: 'The Little Ones',    color: '#12A4A4', icon: '⭐', range: '2013+' },
};
export const GEN_ORDER = ['elders', 'genx', 'millennial', 'genz', 'alpha'];

export function genFromYear(y) {
  y = +y;
  if (!y) return 'millennial';
  if (y < 1965) return 'elders';
  if (y <= 1980) return 'genx';
  if (y <= 1996) return 'millennial';
  if (y <= 2012) return 'genz';
  return 'alpha';
}

export const TEAM_COLORS = ['#F2B632', '#C8102E', '#1E9E5A', '#12A4A4', '#5B3FA0'];
export const TEAM_NAMES = [
  'The Cookout Kings', '90s Sitcom Royalty', 'Harlem Renaissance', 'Sunday Dinner Squad',
  'The Spades Table', 'Front Porch Legends', 'Electric Slide Crew', 'Kitchen Table Council',
];

export function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
export function uid(n = 10) {
  const A = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function money(n) {
  const neg = n < 0;
  return (neg ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const LETTERS = ['A', 'B', 'C', 'D'];
