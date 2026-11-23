// Bibliothèques tierces → vendor/ (un fichier ESM par bibliothèque).
// Le site n'est jamais compilé : seul ce script utilise esbuild.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const version = p => JSON.parse(readFileSync(new URL(`../node_modules/${p}/package.json`, import.meta.url))).version;
mkdirSync(new URL('../vendor/', import.meta.url), { recursive: true });

const libs = [
  { sortie: 'zxing.js', code: "export { BrowserMultiFormatReader, MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource, DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library';", paquet: '@zxing/library', licence: 'Apache-2.0' },
  { sortie: 'anthropic.js', code: "export { default } from '@anthropic-ai/sdk';", paquet: '@anthropic-ai/sdk', licence: 'MIT' },
];
for (const l of libs) {
  await build({
    stdin: { contents: l.code, resolveDir: new URL('..', import.meta.url).pathname, loader: 'js' },
    bundle: true, format: 'esm', platform: 'browser', minify: true, target: 'es2020', legalComments: 'eof',
    outfile: new URL(`../vendor/${l.sortie}`, import.meta.url).pathname,
  });
}
mkdirSync(new URL('../vendor/fonts/', import.meta.url), { recursive: true });
const polices = [
  ['@fontsource/instrument-sans', 'instrument-sans', 'OFL-1.1'],
  ['@fontsource/figtree', 'figtree', 'OFL-1.1'],
];
for (const [paquet, nom] of polices) for (const poids of [400, 500]) {
  copyFileSync(new URL(`../node_modules/${paquet}/files/${nom}-latin-${poids}-normal.woff2`, import.meta.url), new URL(`../vendor/fonts/${nom}-${poids}.woff2`, import.meta.url));
}
libs.push(...polices.map(([paquet, nom, licence]) => ({ sortie: `fonts/${nom}-*.woff2`, paquet, licence })));
writeFileSync(new URL('../vendor/LICENCES.md', import.meta.url),
  `# Bibliothèques embarquées\n\nGénérées par \`npm run vendor\` (tools/vendor.mjs).\n\n| Fichier | Paquet | Version | Licence |\n|---|---|---|---|\n${libs.map(l => `| ${l.sortie} | ${l.paquet} | ${version(l.paquet)} | ${l.licence} |`).join('\n')}\n`);
console.log('vendor/ à jour');
