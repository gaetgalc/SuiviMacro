import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jourLogique, ajouterJours, ecartJours, joursEntre, semaineIso, lundiDe, repasSelonHeure, age } from '../../js/core/dates.js';

test('jourLogique coupe à 4 h', () => {
  assert.equal(jourLogique(new Date(2026, 10, 24, 3, 59)), '2026-11-23');
  assert.equal(jourLogique(new Date(2026, 10, 24, 4, 0)), '2026-11-24');
});
test('ecartJours insensible au changement d\'heure', () => {
  assert.equal(ecartJours('2026-10-24', '2026-10-27'), 3);
  assert.equal(ecartJours('2027-03-27', '2027-03-29'), 2);
  assert.equal(ecartJours('2026-11-23', '2026-11-20'), -3);
});
test('ajouterJours et joursEntre', () => {
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
  assert.equal(ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(joursEntre('2026-10-24', '2026-10-26'), ['2026-10-24', '2026-10-25', '2026-10-26']);
});
test('semaineIso et lundiDe', () => {
  assert.equal(semaineIso('2026-11-23'), '2026-W48');
  assert.equal(semaineIso('2027-01-01'), '2026-W53');
  assert.equal(semaineIso('2026-01-05'), '2026-W02');
  assert.equal(lundiDe('2026-11-29'), '2026-11-23');
  assert.equal(lundiDe('2026-11-23'), '2026-11-23');
});
test('repasSelonHeure', () => {
  const h = (hh, mm) => repasSelonHeure(new Date(2026, 10, 23, hh, mm));
  assert.equal(h(10, 29), 'petitdej');
  assert.equal(h(10, 30), 'dejeuner');
  assert.equal(h(14, 30), 'collation');
  assert.equal(h(18, 30), 'diner');
  assert.equal(h(2, 0), 'diner');
  assert.equal(h(5, 0), 'petitdej');
});
test('age', () => {
  assert.equal(age('1997-06-15', '2026-11-23'), 29);
  assert.equal(age('1997-11-23', '2026-11-23'), 29);
  assert.equal(age('1997-11-24', '2026-11-23'), 28);
});
