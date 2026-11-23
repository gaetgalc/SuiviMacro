import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const racine = new URL('../../', import.meta.url).pathname;
const fichiers = execFileSync('git', ['ls-files'], { cwd: racine, encoding: 'utf8' }).split('\n')
  .filter(f => f && !f.startsWith('vendor/') && f !== 'data/ciqual.json' && f !== 'package-lock.json' && !/\.(png|woff2)$/.test(f));

const MOTIFS = [
  ['jeton GitHub classique', /ghp_[A-Za-z0-9]{20,}/],
  ['jeton GitHub fine-grained', /github_pat_[A-Za-z0-9_]{20,}/],
  ['clé API Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['adresse e-mail', /[A-Za-z0-9._%+-]+@(?!anthropic\.com\b)[A-Za-z0-9-]+\.[A-Za-z]{2,}/],
];

test('aucun secret ni e-mail dans le dépôt public', () => {
  const trouves = [];
  for (const f of fichiers) {
    const texte = readFileSync(racine + f, 'utf8');
    for (const [nom, re] of MOTIFS) if (re.test(texte)) trouves.push(`${f} : ${nom}`);
  }
  assert.deepEqual(trouves, []);
});
