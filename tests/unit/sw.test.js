import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = new URL('../../', import.meta.url).pathname;
const sw = readFileSync(join(racine, 'sw.js'), 'utf8');
const liste = JSON.parse(`[${sw.match(/const FICHIERS = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/,\s*$/, '')}]`);

function fichiers(dossier) {
  return readdirSync(join(racine, dossier)).flatMap(n => {
    const c = `${dossier}/${n}`;
    return statSync(join(racine, c)).isDirectory() ? fichiers(c) : [c];
  });
}

test('le service worker met en cache tous les fichiers du site', () => {
  const attendus = ['css', 'js', 'data', 'icons', 'vendor'].flatMap(fichiers).filter(f => !f.endsWith('.md'));
  const manquants = attendus.filter(f => !liste.includes(f));
  assert.deepEqual(manquants, []);
});
test('chaque fichier listé existe', () => {
  const absents = liste.filter(f => f !== './' && !existsSync(join(racine, f)));
  assert.deepEqual(absents, []);
});
