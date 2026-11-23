import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as zxing from '../../vendor/zxing.js';
import { decoderPixels, codeValide } from '../../js/data/codebarre.js';
import { imageEan13 } from './ean13.js';

test('décode un EAN-13', () => {
  const { px, largeur, hauteur } = imageEan13('3017620422003');
  assert.equal(decoderPixels(px, largeur, hauteur, zxing), '3017620422003');
});
test('image sans code → null', () => {
  const px = new Uint8ClampedArray(100 * 50 * 4).fill(255);
  assert.equal(decoderPixels(px, 100, 50, zxing), null);
});
test('codeValide', () => {
  assert.equal(codeValide(' 3017620422003 '), '3017620422003');
  assert.equal(codeValide('12345678'), '12345678');
  assert.equal(codeValide('abc'), null);
  assert.equal(codeValide('123'), null);
});
