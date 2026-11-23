// Fusion d'enregistrements synchronisés : union par id, le plus récent gagne.
// Commutative et idempotente ; une suppression est une pierre tombale.

const cle = r => `${r.majLe || ''}\u0000${r.appareil || ''}\u0000${JSON.stringify(r)}`;

export function gagnant(x, y) {
  return cle(y) > cle(x) ? y : x;
}

export function fusionner(a, b) {
  const parId = new Map();
  for (const r of [...a, ...b]) {
    const deja = parId.get(r.id);
    parId.set(r.id, deja ? gagnant(deja, r) : r);
  }
  return [...parId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
