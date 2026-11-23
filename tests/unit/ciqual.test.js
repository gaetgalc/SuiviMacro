import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireTeneur } from '../../tools/ciqual.mjs';

test('lireTeneur', () => {
  assert.equal(lireTeneur(' 12,5 '), 12.5);
  assert.equal(lireTeneur('traces'), 0);
  assert.equal(lireTeneur('< 0,5'), 0.25);
  assert.equal(lireTeneur('&lt; 0,1'), 0.05);
  assert.equal(lireTeneur('-'), null);
  assert.equal(lireTeneur(''), null);
});
test('data/ciqual.json', () => {
  const t = JSON.parse(readFileSync(new URL('../../data/ciqual.json', import.meta.url)));
  assert.equal(t.licence, 'CC-BY 4.0');
  assert.ok(t.lignes.length > 3000, String(t.lignes.length));
  assert.ok(t.lignes.every(l => Number.isFinite(l[3])));
  for (const mot of ['Tofu', 'Pois chiche', 'Lentille', 'Seitan', 'Tempeh', 'avoine']) {
    assert.ok(t.lignes.some(l => l[1].includes(mot)), mot);
  }
  assert.ok(t.lignes.some(l => /cacahu|arachide/i.test(l[1]) && /beurre|pâte/i.test(l[1])), 'beurre de cacahuète');
});
