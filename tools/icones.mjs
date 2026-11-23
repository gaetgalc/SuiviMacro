// Génère les icônes PNG de l'app à partir d'un SVG (Chromium préinstallé).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = taille => `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 100 100">
<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(19% 0.03 258)"/><stop offset="1" stop-color="oklch(11% 0.022 258)"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#n)"/>
<path d="M18 30 C 34 34, 44 46, 56 48 S 76 58, 84 62" fill="none" stroke="oklch(82% 0.095 68)" stroke-width="5" stroke-linecap="round"/>
<path d="M18 74 H 84" stroke="oklch(40% 0.02 258)" stroke-width="2" stroke-linecap="round"/>
<circle cx="56" cy="48" r="5.5" fill="oklch(93% 0.012 85)"/></svg>`;

const nav = await chromium.launch();
const page = await nav.newPage();
for (const t of [180, 192, 512]) {
  await page.setViewportSize({ width: t, height: t });
  await page.setContent(`<style>html,body{margin:0}</style>${svg(t)}`);
  writeFileSync(new URL(`../icons/icone-${t}.png`, import.meta.url), await page.screenshot());
}
writeFileSync(new URL('../icons/icone.svg', import.meta.url), svg(100));
await nav.close();
console.log('icônes écrites');
