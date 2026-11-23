import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statsGrignotage, phraseGrignotage } from '../../js/core/grignotage.js';

const e = (jour, heure, kcal, raison, nom = 'Biscuits') => ({ jour, heure, kcal, nom, grignotage: raison ? { raison } : null });
const entrees = [
  e('2026-11-20', '16:10', 200, 'faim'), e('2026-11-21', '17:30', 150, 'faim'), e('2026-11-22', '16:45', 100, 'ennui', 'Chocolat'),
  e('2026-11-22', '22:15', 300, 'faim'), e('2026-11-22', '12:00', 1250, null), e('2026-11-10', '16:00', 500, 'stress'),
];
test('statistiques sur 7 jours', () => {
  const s = statsGrignotage(entrees, '2026-11-23', 7);
  assert.equal(s.nombre, 4);
  assert.equal(s.kcal, 750);
  assert.equal(s.part, 750 / 2000);
  assert.equal(s.parCreneau['16-18'], 3);
  assert.equal(s.parCreneau['22-24'], 1);
  assert.equal(s.parRaison.faim, 3);
  assert.deepEqual(s.topAliments[0], { nom: 'Biscuits', n: 3 });
  assert.deepEqual(s.semainePrecedente, { nombre: 1, kcal: 500 });
});
test('phrase neutre', () => {
  const p = phraseGrignotage(statsGrignotage(entrees, '2026-11-23', 7));
  assert.match(p, /4 grignotages/);
  assert.match(p, /16 h et 18 h/);
  assert.match(p, /faim/);
  assert.equal(phraseGrignotage(statsGrignotage([], '2026-11-23', 7)), 'Aucun grignotage noté sur la période');
});
