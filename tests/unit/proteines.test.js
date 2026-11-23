import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classerCiqual, classerOff, repartition, ORIGINES } from '../../js/core/proteines.js';

test('six origines', () => assert.equal(ORIGINES.length, 6));
test('classement Ciqual', () => {
  assert.equal(classerCiqual('Tofu nature', '0411'), 'soja');
  assert.equal(classerCiqual('Seitan', '1009'), 'cereales');
  assert.equal(classerCiqual('Lentille corail, cuite', '0203'), 'legumineuses');
  assert.equal(classerCiqual('Whey (protéine de lactosérum)', '1008'), 'laitiers');
  assert.equal(classerCiqual('Skyr nature', '0502'), 'laitiers');
  assert.equal(classerCiqual('Amande, grillée', '0205'), 'oleagineux');
  assert.equal(classerCiqual('Beurre de cacahuète', '1010'), 'oleagineux');
  assert.equal(classerCiqual('Boisson au soja, nature', '0502'), 'soja');
  assert.equal(classerCiqual('Flocons d\'avoine', '0301'), 'cereales');
  assert.equal(classerCiqual('Oeuf, dur', '0410'), 'laitiers');
  assert.equal(classerCiqual('Pomme, crue', '0204'), 'autres');
  assert.equal(classerCiqual('Quinoa, cuit', '0301'), 'cereales');
});
test('classement Open Food Facts', () => {
  assert.equal(classerOff('Yaourt nature', ['en:dairies']), 'laitiers');
  assert.equal(classerOff('Mystère', ['en:legumes']), 'legumineuses');
  assert.equal(classerOff('Steaks végétaux', ['en:soy-based-foods']), 'soja');
  assert.equal(classerOff('Chips', []), 'autres');
});
test('répartition en grammes de protéines', () => {
  const r = repartition([{ prot: 20, origineProt: 'soja' }, { prot: 5, origineProt: 'soja' }, { prot: 10, origineProt: 'laitiers' }, { prot: 99, origineProt: 'soja', supprime: true }, { prot: 3 }]);
  assert.equal(r.soja, 25); assert.equal(r.laitiers, 10); assert.equal(r.autres, 3); assert.equal(r.legumineuses, 0);
});
