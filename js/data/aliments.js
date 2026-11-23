// Aliments de l'utilisateur et entrées du journal (§ 6.1, § 10).
import { valeurs } from '../core/nutrition.js';

const nouvelId = prefixe => `${prefixe}:${crypto.randomUUID()}`;

/** Copie un aliment Ciqual, Open Food Facts, plat type ou IA dans « aliments » au premier usage. */
export async function adopter(base, aliment) {
  if (aliment.source === 'perso' || aliment.source === 'recette') {
    return (await base.lire('aliments', aliment.id)) || base.ecrire('aliments', aliment);
  }
  const existant = (await base.lire('aliments', aliment.id))
    || (aliment.ref ? (await base.tous('aliments')).find(a => a.source === aliment.source && a.ref === aliment.ref) : null);
  if (existant && !existant.supprime) return existant;
  const id = aliment.source === 'ia' || aliment.source === 'phrase' ? nouvelId('perso') : aliment.id;
  const { ...copie } = aliment;
  return base.ecrire('aliments', { ...copie, id, utilisations: 0, supprime: undefined });
}

export async function ajouterEntree(base, { aliment, qte, unite, jour, repas, heure, mode, grignotage = null }) {
  const a0 = await adopter(base, aliment);
  // Portions usuelles proposées (table) retenues sur l'aliment dès qu'elles servent.
  const manquantes = (aliment.portions || []).filter(p => !(a0.portions || []).some(x => x.id === p.id));
  const a = manquantes.length ? { ...a0, portions: [...(a0.portions || []), ...manquantes] } : a0;
  const v = valeurs(a, qte, unite);
  const entree = await base.ecrire('entrees', {
    id: nouvelId('e'), jour, repas, heure, alimentId: a.id, nom: a.nom, qte, unite, g: v.g,
    kcal: v.kcal, prot: v.prot, gluc: v.gluc, lip: v.lip, fib: v.fib, origineProt: a.origineProt || 'autres',
    mode, grignotage,
  });
  await base.ecrire('aliments', { ...a, derniere: { qte, unite }, utilisations: (a.utilisations || 0) + 1, dernierUsage: jour });
  return entree;
}

/** Modifie une entrée existante (quantité, repas, grignotage), valeurs recalculées. */
export async function modifierEntree(base, entree, { qte, unite, repas, grignotage }) {
  const a = await base.lire('aliments', entree.alimentId);
  const v = a ? valeurs(a, qte, unite) : null;
  const facteur = !a && entree.g ? (qte / entree.qte) : 1;
  return base.ecrire('entrees', {
    ...entree, qte, unite, repas, grignotage,
    ...(v ? { g: v.g, kcal: v.kcal, prot: v.prot, gluc: v.gluc, lip: v.lip, fib: v.fib }
      : { g: entree.g * facteur, kcal: entree.kcal * facteur, prot: entree.prot * facteur, gluc: entree.gluc * facteur, lip: entree.lip * facteur, fib: entree.fib == null ? null : entree.fib * facteur }),
  });
}

/** Modifie un aliment ; passees = true réapplique ses valeurs aux entrées passées. */
export async function modifierAliment(base, aliment, { passees = false } = {}) {
  const a = await base.ecrire('aliments', aliment);
  if (passees) {
    const liees = (await base.tous('entrees')).filter(e => e.alimentId === a.id);
    const maj = liees.map(e => {
      const v = valeurs(a, e.qte, a.portions?.some(p => p.id === e.unite) || e.unite === 'g' || e.unite === 'ml' ? e.unite : 'g');
      return { ...e, nom: a.nom, g: v.g, kcal: v.kcal, prot: v.prot, gluc: v.gluc, lip: v.lip, fib: v.fib, origineProt: a.origineProt };
    });
    if (maj.length) await base.ecrirePlusieurs('entrees', maj);
  }
  return a;
}

export async function ajouterRepasType(base, repasType, jour, repas, heure) {
  const res = [];
  for (const it of repasType.items) {
    const a = await base.lire('aliments', it.alimentId);
    if (!a || a.supprime) continue;
    res.push(await ajouterEntree(base, { aliment: a, qte: it.qte, unite: it.unite, jour, repas, heure, mode: 'repas' }));
  }
  return res;
}

/** Ajout rapide : kcal et macros saisies directement. */
export async function ajouterRapide(base, { nom, kcal, prot = 0, gluc = 0, lip = 0, jour, repas, heure, grignotage = null }) {
  return base.ecrire('entrees', {
    id: nouvelId('e'), jour, repas, heure, alimentId: null, nom: nom || 'Ajout rapide', qte: 1, unite: 'rapide', g: 0,
    kcal, prot, gluc, lip, fib: null, origineProt: 'autres', mode: 'rapide', grignotage,
  });
}

export async function annuler(base, ids) {
  for (const id of ids) await base.supprimer('entrees', id);
}

export async function creerAlimentPerso(base, { nom, p100, portions = [], origineProt = 'autres', ref, source = 'perso', recette }) {
  return base.ecrire('aliments', { id: nouvelId(source === 'recette' ? 'recette' : 'perso'), source, ref, nom, p100, portions, origineProt, recette, utilisations: 0 });
}
