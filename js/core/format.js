// Mise en forme des nombres à la française.
const fr = (n, dec) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n).replace(/ /g, ' ');

export const kcal = n => fr(Math.round(n), 0);
export const g = n => fr(Math.round(n), 0);
export const kg = n => fr(n, 1);
export const signe = (n, f = kcal) => (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n));
export const nombre = fr;
