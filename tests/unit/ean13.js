// Encodeur EAN-13 minimal pour fabriquer des images de test.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = L.map(p => [...p].reverse().map(c => (c === '0' ? '1' : '0')).join(''));
const R = L.map(p => [...p].map(c => (c === '0' ? '1' : '0')).join(''));
const PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Modules (chaîne de 0 et 1) d'un code EAN-13 à 13 chiffres. */
export function modulesEan13(code) {
  const d = [...code].map(Number);
  let s = '101';
  for (let i = 1; i <= 6; i++) s += (PARITE[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  s += '01010';
  for (let i = 7; i <= 12; i++) s += R[d[i]];
  return s + '101';
}

/** Image RGBA (Uint8ClampedArray) du code, marges blanches comprises. */
export function imageEan13(code, { module = 3, hauteur = 120, marge = 30 } = {}) {
  const m = modulesEan13(code);
  const largeur = m.length * module + 2 * marge;
  const px = new Uint8ClampedArray(largeur * hauteur * 4).fill(255);
  for (let y = 0; y < hauteur; y++) for (let i = 0; i < m.length; i++) {
    if (m[i] !== '1') continue;
    for (let k = 0; k < module; k++) {
      const o = (y * largeur + marge + i * module + k) * 4;
      px[o] = px[o + 1] = px[o + 2] = 0;
    }
  }
  return { px, largeur, hauteur };
}
