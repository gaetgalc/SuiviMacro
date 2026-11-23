import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerIa, SCHEMA_ESTIMATION, IaRefus, IaCle } from '../../js/data/ia.js';

function fauxAnthropic(reponse) {
  const vus = [];
  class F {
    constructor(opts) { this.opts = opts; vus.push({ opts }); }
    beta = { messages: { create: async req => { vus.push({ req }); if (reponse instanceof Error) throw reponse; return reponse; } } };
    models = { retrieve: async id => ({ id }) };
  }
  return { F, vus };
}
const ok = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ aliments: [{ nom: 'Poké tofu', g: 450, kcal: 675, prot: 31, gluc: 90, lip: 20, fib: 11, origineProt: 'soja' }] }) }] };

test('requête : modèle, effort, schéma, repli', async () => {
  const { F, vus } = fauxAnthropic(ok);
  const ia = creerIa({ cle: 'cle-fictive', Anthropic: F });
  const l = await ia.estimerPhrase('poké bowl tofu');
  assert.equal(l.length, 1);
  assert.equal(l[0].qte, 450);
  assert.equal(vus[0].opts.apiKey, 'cle-fictive');
  assert.equal(vus[0].opts.dangerouslyAllowBrowser, true);
  const req = vus[1].req;
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.output_config.effort, 'low');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.deepEqual(req.output_config.format.schema, SCHEMA_ESTIMATION);
  assert.equal(req.fallbacks, 'default');
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  const texte = JSON.stringify(req.messages);
  assert.match(texte, /poké bowl tofu/);
  assert.doesNotMatch(texte, /poids|cible|kg/i);
});
test('refus', async () => {
  const { F } = fauxAnthropic({ stop_reason: 'refusal', content: [] });
  await assert.rejects(creerIa({ cle: 'x', Anthropic: F }).estimerPhrase('x'), IaRefus);
});
test('clé invalide', async () => {
  const e = Object.assign(new Error('invalid x-api-key'), { status: 401 });
  const { F } = fauxAnthropic(e);
  await assert.rejects(creerIa({ cle: 'x', Anthropic: F }).estimerPhrase('x'), IaCle);
});
test('photo envoyée en base64', async () => {
  const { F, vus } = fauxAnthropic(ok);
  await creerIa({ cle: 'x', Anthropic: F }).estimerPhoto('QUJD', 'image/jpeg');
  const bloc = vus[1].req.messages[0].content[0];
  assert.deepEqual(bloc, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } });
});
