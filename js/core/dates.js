// Dates de jour 'AAAA-MM-JJ'. Les calculs de jours passent par l'UTC pour
// rester insensibles aux changements d'heure.

const JOUR_MS = 86400000;
const deux = n => String(n).padStart(2, '0');

export const formatJour = (a, m, j) => `${a}-${deux(m)}-${deux(j)}`;

/** Jour local d'une date, sans coupure. */
export function jourLocal(date) {
  return formatJour(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Jour logique : avant 4 h, on est encore la veille. */
export function jourLogique(date) {
  const d = new Date(date.getTime());
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return jourLocal(d);
}

const versUtc = jour => {
  const [a, m, j] = jour.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
};
const depuisUtc = ms => {
  const d = new Date(ms);
  return formatJour(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

export const ajouterJours = (jour, n) => depuisUtc(versUtc(jour) + n * JOUR_MS);
export const ecartJours = (de, a) => Math.round((versUtc(a) - versUtc(de)) / JOUR_MS);

export function joursEntre(de, a) {
  const n = ecartJours(de, a);
  const res = [];
  for (let i = 0; i <= n; i++) res.push(ajouterJours(de, i));
  return res;
}

/** 0 = lundi … 6 = dimanche */
export const jourSemaine = jour => (new Date(versUtc(jour)).getUTCDay() + 6) % 7;
export const lundiDe = jour => ajouterJours(jour, -jourSemaine(jour));

export function semaineIso(jour) {
  const jeudi = ajouterJours(jour, 3 - jourSemaine(jour));
  const annee = Number(jeudi.slice(0, 4));
  const num = Math.floor(ecartJours(`${annee}-01-01`, jeudi) / 7) + 1;
  return `${annee}-W${deux(num)}`;
}

export function repasSelonHeure(date) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m < 4 * 60) return 'diner';
  if (m < 10 * 60 + 30) return 'petitdej';
  if (m < 14 * 60 + 30) return 'dejeuner';
  if (m < 18 * 60 + 30) return 'collation';
  return 'diner';
}

export function age(naissance, jour) {
  const [an, mn, jn] = naissance.split('-').map(Number);
  const [a, m, j] = jour.split('-').map(Number);
  let ans = a - an;
  if (m < mn || (m === mn && j < jn)) ans--;
  return ans;
}

export const heureLocale = date => `${deux(date.getHours())}:${deux(date.getMinutes())}`;
