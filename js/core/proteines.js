// Origine des protéines (§ 8.4).
import { simplifier } from './texte.js';

export const ORIGINES = ['legumineuses', 'soja', 'cereales', 'laitiers', 'oleagineux', 'autres'];
export const LIBELLES = {
  legumineuses: 'Légumineuses', soja: 'Soja', cereales: 'Céréales',
  laitiers: 'Laitiers et œufs', oleagineux: 'Oléagineux et graines', autres: 'Autres',
};

// Mots-clés prioritaires, dans l'ordre (le premier trouvé l'emporte).
const MOTS = [
  ['soja', ['tofu', 'tempeh', 'edamame', 'soja', 'tonyu', 'miso', 'natto', 'soy']],
  ['cereales', ['seitan', 'gluten']],
  ['oleagineux', ['amande', 'noix', 'noisette', 'cajou', 'cacahuete', 'arachide', 'pistache', 'sesame', 'tahin', 'chia', 'lin', 'chanvre', 'tournesol', 'courge', 'pecan', 'macadamia', 'graine']],
  ['legumineuses', ['pois chiche', 'lentille', 'haricot', 'feve', 'pois casse', 'houmous', 'hummus', 'falafel', 'flageolet', 'lupin', 'dahl', 'dal']],
  ['laitiers', ['whey', 'lactoserum', 'skyr', 'fromage', 'yaourt', 'yogourt', 'lait', 'oeuf', 'emmental', 'comte', 'mozzarella', 'feta', 'ricotta', 'kefir', 'petit suisse', 'faisselle', 'caseine', 'parmesan', 'creme']],
  ['cereales', ['avoine', 'riz', 'pate', 'pates', 'pain', 'ble', 'quinoa', 'semoule', 'boulgour', 'sarrasin', 'epeautre', 'cereale', 'muesli', 'granola', 'orge', 'millet', 'mais', 'couscous', 'tortilla', 'galette']],
];
const SSGRP = {
  '0203': 'legumineuses', '0205': 'oleagineux',
  '0301': 'cereales', '0302': 'cereales', '0303': 'cereales', '0304': 'cereales', '0305': 'cereales', '0707': 'cereales', '0708': 'cereales',
  '0410': 'laitiers', '0501': 'laitiers', '0502': 'laitiers', '0503': 'laitiers', '0504': 'laitiers',
};
const OFF = [
  ['soja', ['soy', 'tofu', 'tempeh']],
  ['legumineuses', ['legume', 'pulses', 'chickpea', 'lentil', 'bean', 'hummus']],
  ['oleagineux', ['nut', 'seed', 'peanut', 'almond']],
  ['laitiers', ['dair', 'milk', 'cheese', 'yogurt', 'egg', 'whey']],
  ['cereales', ['cereal', 'bread', 'pasta', 'rice', 'oat', 'flake']],
];

function parMots(nom) {
  const t = ' ' + simplifier(nom).replace(/[.,/]/g, ' ') + ' ';
  for (const [origine, mots] of MOTS) {
    if (mots.some(m => new RegExp(`(^| )${m}(s|x)?( |$)`).test(t))) return origine;
  }
  return null;
}

export function classerCiqual(nom, ssgrp) {
  return parMots(nom) || SSGRP[ssgrp] || 'autres';
}

export function classerOff(nom, tags = []) {
  const m = parMots(nom);
  if (m) return m;
  for (const [origine, cles] of OFF) {
    if (tags.some(t => cles.some(c => t.includes(c)))) return origine;
  }
  return 'autres';
}

export function repartition(entrees) {
  const r = Object.fromEntries(ORIGINES.map(o => [o, 0]));
  for (const e of entrees) {
    if (e.supprime) continue;
    r[ORIGINES.includes(e.origineProt) ? e.origineProt : 'autres'] += e.prot || 0;
  }
  return r;
}
