// Lecture de codes-barres (EAN-13, EAN-8, UPC) avec ZXing, à partir de pixels RGBA.

export function codeValide(texte) {
  const c = String(texte || '').replace(/\s/g, '');
  return /^\d{8,14}$/.test(c) ? c : null;
}

/** Décode des pixels RGBA ; renvoie le code ou null. zxing = module vendor/zxing.js. */
export function decoderPixels(rgba, largeur, hauteur, zxing) {
  const lum = new Uint8ClampedArray(largeur * hauteur);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  const indices = new Map([
    [zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8, zxing.BarcodeFormat.UPC_A, zxing.BarcodeFormat.UPC_E]],
    [zxing.DecodeHintType.TRY_HARDER, true],
  ]);
  const lecteur = new zxing.MultiFormatReader();
  lecteur.setHints(indices);
  try {
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(lum, largeur, hauteur)));
    return lecteur.decode(bitmap).getText();
  } catch {
    return null;
  }
}

/** Décode une image (navigateur) : fichier ou élément vidéo. */
export function decoderSource(source, zxing, max = 1280) {
  const l = source.videoWidth || source.width, h = source.videoHeight || source.height;
  if (!l || !h) return null;
  const k = Math.min(1, max / Math.max(l, h));
  const c = document.createElement('canvas');
  c.width = Math.round(l * k); c.height = Math.round(h * k);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, c.width, c.height);
  return decoderPixels(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, zxing);
}
