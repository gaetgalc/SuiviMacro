// Normalisation de texte partagée (recherche, classements, phrases).
export const sansAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
export const simplifier = s => sansAccents(String(s || '').toLowerCase()).replace(/[’']/g, ' ').replace(/[^a-z0-9%.,/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
