// Synchronisation avec le dépôt privé (§ 7). IndexedDB fait foi ; le dépôt
// est le point de rencontre. Chaque écriture distante est précédée d'une fusion.
import { ConflitDepot, JetonRefuse, HorsLigne } from './depot.js';
import { magasinsDuFichier } from './db.js';
import { lireEnvoi, integrerEnvoi } from '../core/inbox.js';

const ESSAIS = 3;
export const serialiser = contenu => JSON.stringify({ version: 1, ...contenu }, null, 1) + '\n';

export function creerSync({ base, depot, horloge = () => new Date().toISOString() }) {
  const etat = { enAttente: 0, derniereReception: null, dernierEnvoiOk: null, erreur: null, enCours: false, dernierEnvoi: null };
  const ecouteurs = new Set();
  const publier = () => ecouteurs.forEach(fn => { try { fn({ ...etat }); } catch (e) { console.error(e); } });
  let enCours = null;

  async function recevoir() {
    const arbre = await depot.arbre();
    let fichiers = 0;
    for (const [chemin, sha] of arbre) {
      if (!chemin.endsWith('.json') || chemin.startsWith('inbox/') || !magasinsDuFichier(chemin).length) continue;
      const e = await base.etat(chemin);
      if (e.sha === sha) continue;
      const f = await depot.lire(chemin);
      if (!f) continue;
      let obj;
      try { obj = JSON.parse(f.texte); } catch { console.warn(`Fichier illisible : ${chemin}`); continue; }
      const r = await base.fusionnerFichier(chemin, obj);
      await base.poserSha(chemin, f.sha);
      if (r.aRenvoyer) await base.marquer([chemin]);
      fichiers++;
    }
    etat.derniereReception = horloge();
    return { fichiers, arbre };
  }

  async function envoyerFichier(chemin) {
    for (let essai = 1; ; essai++) {
      const { version } = await base.etat(chemin);
      const distant = await depot.lire(chemin);
      if (distant) {
        let obj;
        try { obj = JSON.parse(distant.texte); } catch { throw new Error(`Fichier distant illisible : ${chemin}. Corrige-le sur GitHub ; rien n'a été écrasé.`); }
        await base.fusionnerFichier(chemin, obj);
      }
      const texte = serialiser(await base.contenuDuFichier(chemin));
      try {
        const sha = distant && distant.texte === texte ? distant.sha : await depot.ecrire(chemin, texte, distant?.sha);
        await base.envoye(chemin, sha, version);
        return;
      } catch (e) {
        if (e instanceof ConflitDepot && essai < ESSAIS) continue;
        throw e;
      }
    }
  }

  async function envoyer() {
    let envoyes = 0;
    for (const chemin of await base.aEnvoyer()) {
      await envoyerFichier(chemin);
      envoyes++;
    }
    etat.enAttente = (await base.aEnvoyer()).length;
    etat.dernierEnvoiOk = horloge();
    return { envoyes, enAttente: etat.enAttente };
  }

  async function integrerInbox(arbre) {
    const inbox = [...arbre].filter(([c]) => c.startsWith('inbox/') && c.endsWith('.json')).sort();
    if (!inbox.length) return null;
    const resume = { poids: 0, gras: 0, seances: 0, ignores: 0, fichiers: 0 };
    const integres = [];
    let erreur = null;
    const ignores = new Set((await base.cache('sync:inboxIgnores'))?.valeur || []);
    const aLire = inbox.filter(([, sha]) => !ignores.has(sha));
    if (!aLire.length) return null;
    for (const [chemin, shaArbre] of aLire) {
      const f = await depot.lire(chemin);
      if (!f) continue;
      let json;
      try { json = JSON.parse(f.texte); } catch {
        erreur = `Envoi illisible : ${chemin} (JSON invalide). Corrige-le ou supprime-le sur GitHub.`;
        ignores.add(shaArbre);
        continue;
      }
      const mesures = await base.tous('mesures', { avecSupprimes: true });
      const seances = await base.tous('seances', { avecSupprimes: true });
      const r = integrerEnvoi(lireEnvoi(json), mesures, seances, horloge());
      const avant = new Map([...mesures, ...seances].map(x => [x.id, JSON.stringify(x)]));
      const nouvellesM = r.mesures.filter(m => avant.get(m.id) !== JSON.stringify(m));
      const nouvellesS = r.seances.filter(s => avant.get(s.id) !== JSON.stringify(s));
      if (nouvellesM.length) await base.ecrirePlusieurs('mesures', nouvellesM);
      if (nouvellesS.length) await base.ecrirePlusieurs('seances', nouvellesS);
      for (const k of ['poids', 'gras', 'seances', 'ignores']) resume[k] += r.resume[k];
      resume.fichiers++;
      integres.push([chemin, f.sha]);
    }
    await envoyer(); // les mesures sont dans le dépôt avant de vider la boîte
    for (const [chemin, sha] of integres) await depot.supprimer(chemin, sha);
    await base.poserCache('sync:inboxIgnores', [...ignores], horloge());
    etat.dernierEnvoi = { le: horloge(), resume, erreur };
    await base.poserCache('sync:dernierEnvoi', etat.dernierEnvoi, etat.dernierEnvoi.le);
    return etat.dernierEnvoi;
  }

  async function executer() {
    etat.enCours = true; publier();
    try {
      const { arbre } = await recevoir();
      await integrerInbox(arbre);
      await envoyer();
      etat.erreur = null;
    } catch (e) {
      etat.erreur = e instanceof JetonRefuse ? 'jeton' : e instanceof HorsLigne ? 'reseau' : e instanceof ConflitDepot ? 'conflit' : 'autre';
      etat.message = e.message;
      if (etat.erreur === 'autre') console.error(e);
    } finally {
      etat.enAttente = (await base.aEnvoyer()).length;
      etat.enCours = false;
      publier();
    }
  }

  return {
    async charger() {
      etat.dernierEnvoi = (await base.cache('sync:dernierEnvoi'))?.valeur || null;
      etat.enAttente = (await base.aEnvoyer()).length;
      publier();
    },
    recevoir: async () => (await recevoir()).fichiers,
    envoyer,
    integrerInbox: async () => integrerInbox((await recevoir()).arbre),
    synchroniser() {
      if (!enCours) enCours = executer().finally(() => { enCours = null; });
      return enCours;
    },
    etat: () => ({ ...etat }),
    surEtat(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); },
  };
}
