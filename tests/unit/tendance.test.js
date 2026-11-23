import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serieTendance, tendanceAu, pente } from '../../js/core/tendance.js';
import { seriePoids } from './series.js';

const proche = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test('poids constant', () => {
  const s = serieTendance(seriePoids({ debut: '2026-10-01', jours: 30, depart: 80 }), '2026-10-30');
  assert.ok(s.every(x => x.tendance === 80));
  proche(pente(s, '2026-10-30').kgSemaine, 0);
});
test('lissage 0,1', () => {
  const s = serieTendance([{ id: '2026-11-01', poids: 80 }, { id: '2026-11-02', poids: 81 }], '2026-11-02');
  proche(s[1].tendance, 80.1);
});
test('jour sans pesée reporté, jusqu\'à la date demandée', () => {
  const s = serieTendance([{ id: '2026-11-01', poids: 80 }, { id: '2026-11-03', poids: 81 }], '2026-11-05');
  assert.equal(s.length, 5);
  assert.equal(s[1].poids, null);
  proche(s[1].tendance, 80);
  proche(tendanceAu(s, '2026-11-05'), 80.1);
  assert.equal(tendanceAu(s, '2026-10-01'), null);
});
test('pesée aberrante à confirmer', () => {
  const s = serieTendance([{ id: '2026-11-01', poids: 80 }, { id: '2026-11-02', poids: 84 }], '2026-11-02');
  assert.equal(s[1].aConfirmer, true);
  proche(s[1].tendance, 80);
  const c = serieTendance([{ id: '2026-11-01', poids: 80 }, { id: '2026-11-02', poids: 84, poidsConfirme: true }], '2026-11-02');
  assert.equal(c[1].aConfirmer, false);
  proche(c[1].tendance, 80.4);
});
test('pente d\'une perte de 0,5 kg/semaine bruitée', () => {
  const s = serieTendance(seriePoids({ debut: '2026-09-01', jours: 60, depart: 82, kgParSemaine: -0.5, bruit: 0.4, graine: 7 }), '2026-10-30');
  const p = pente(s, '2026-10-30');
  assert.ok(p.kgSemaine > -0.6 && p.kgSemaine < -0.4, String(p.kgSemaine));
  proche(p.pctSemaine, (p.kgSemaine / tendanceAu(s, '2026-10-30')) * 100);
});
test('pente nulle si moins de 7 jours', () => {
  const s = serieTendance(seriePoids({ debut: '2026-11-01', jours: 5, depart: 80 }), '2026-11-05');
  assert.equal(pente(s, '2026-11-05'), null);
});
test('passage à l\'heure d\'hiver : un élément par jour', () => {
  const s = serieTendance(seriePoids({ debut: '2026-10-20', jours: 12, depart: 80 }), '2026-10-31');
  assert.equal(s.length, 12);
  assert.equal(new Set(s.map(x => x.jour)).size, 12);
});
