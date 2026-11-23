// Base locale IndexedDB : fait foi sur l'appareil (§ 6, § 7).
import { fusionner } from '../core/fusion.js';

export const MAGASINS_SYNC = ['aliments', 'entrees', 'repasTypes', 'jours', 'mesures', 'seances', 'reglages', 'bilans'];
export const MAGASINS_LOCAUX = ['secrets', 'cacheOff', 'etatSync', 'appareil'];
const VERSION = 1;

const jourDe = (magasin, r) => (magasin === 'jours' ? r.id : r.jour) || '';

export function fichierDe(magasin, rec) {
  if (magasin === 'entrees' || magasin === 'jours') return `journal/${jourDe(magasin, rec).slice(0, 7)}.json`;
  if (magasin === 'seances') return `seances/${(rec.jour || '').slice(0, 4)}.json`;
  if (magasin === 'repasTypes') return 'repas-types.json';
  return `${magasin}.json`;
}

export function magasinsDuFichier(chemin) {
  if (chemin.startsWith('journal/')) return ['entrees', 'jours'];
  if (chemin.startsWith('seances/')) return ['seances'];
  if (chemin === 'repas-types.json') return ['repasTypes'];
  const m = chemin.replace(/\.json$/, '');
  return MAGASINS_SYNC.includes(m) ? [m] : [];
}

const req = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const fin = tx => new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); });

export async function ouvrirBase({ nom = 'suivimacro', idb = globalThis.indexedDB, horloge = () => new Date().toISOString() } = {}) {
  const ouverture = idb.open(nom, VERSION);
  ouverture.onupgradeneeded = () => {
    const db = ouverture.result;
    for (const m of [...MAGASINS_SYNC, ...MAGASINS_LOCAUX]) {
      if (db.objectStoreNames.contains(m)) continue;
      const s = db.createObjectStore(m, { keyPath: 'id' });
      if (m === 'entrees') s.createIndex('jour', 'jour');
    }
  };
  const db = await req(ouverture);
  const ecouteurs = new Set();
  const signaler = m => ecouteurs.forEach(fn => { try { fn(m); } catch (e) { console.error(e); } });

  const lire = async (m, id) => req(db.transaction(m).objectStore(m).get(id));
  const tousBruts = async m => req(db.transaction(m).objectStore(m).getAll());
  const ecrireBrut = async (m, recs) => {
    const tx = db.transaction(m, 'readwrite');
    for (const r of recs) tx.objectStore(m).put(r);
    await fin(tx);
  };

  let appareil = (await lire('appareil', 'appareil'))?.valeur;
  if (!appareil) {
    appareil = globalThis.crypto.randomUUID();
    await ecrireBrut('appareil', [{ id: 'appareil', valeur: appareil }]);
  }

  async function marquer(chemins) {
    const tx = db.transaction('etatSync', 'readwrite');
    const s = tx.objectStore('etatSync');
    for (const c of chemins) {
      const e = (await req(s.get(c))) || { id: c, sha: null, version: 0 };
      s.put({ ...e, aEnvoyer: true, version: (e.version || 0) + 1 });
    }
    await fin(tx);
  }

  const base = {
    appareil,
    lire,
    async tous(m, { avecSupprimes = false } = {}) {
      const r = await tousBruts(m);
      return avecSupprimes ? r : r.filter(x => !x.supprime);
    },
    async parIndex(m, index, valeur) {
      const r = await req(db.transaction(m).objectStore(m).index(index).getAll(valeur));
      return r.filter(x => !x.supprime);
    },
    async ecrire(m, rec) {
      const r = { ...rec, majLe: horloge(), appareil };
      await ecrireBrut(m, [r]);
      if (MAGASINS_SYNC.includes(m)) await marquer([fichierDe(m, r)]);
      signaler(m);
      return r;
    },
    async ecrirePlusieurs(m, recs) {
      const rs = recs.map(rec => ({ ...rec, majLe: horloge(), appareil }));
      await ecrireBrut(m, rs);
      if (MAGASINS_SYNC.includes(m)) await marquer([...new Set(rs.map(r => fichierDe(m, r)))]);
      signaler(m);
      return rs;
    },
    async supprimer(m, id) {
      const r = await lire(m, id);
      if (!r) return null;
      return base.ecrire(m, { ...r, supprime: true });
    },
    /** Enregistrements locaux (pierres tombales comprises) appartenant à un fichier. */
    async contenuDuFichier(chemin) {
      const res = {};
      for (const m of magasinsDuFichier(chemin)) {
        res[m] = (await tousBruts(m)).filter(r => fichierDe(m, r) === chemin).sort((a, b) => (a.id < b.id ? -1 : 1));
      }
      return res;
    },
    /** Fusionne le contenu distant d'un fichier. aRenvoyer = le local avait du plus récent. */
    async fusionnerFichier(chemin, distant) {
      const local = await base.contenuDuFichier(chemin);
      let aRenvoyer = false, change = false;
      for (const m of magasinsDuFichier(chemin)) {
        const d = distant?.[m] || [];
        const f = fusionner(local[m], d);
        const parIdLocal = new Map(local[m].map(r => [r.id, JSON.stringify(r)]));
        const parIdDistant = new Map(d.map(r => [r.id, JSON.stringify(r)]));
        const nouveaux = f.filter(r => parIdLocal.get(r.id) !== JSON.stringify(r));
        if (nouveaux.length) { await ecrireBrut(m, nouveaux); change = true; signaler(m); }
        if (f.some(r => parIdDistant.get(r.id) !== JSON.stringify(r))) aRenvoyer = true;
      }
      return { change, aRenvoyer };
    },
    async etat(chemin) { return (await lire('etatSync', chemin)) || { id: chemin, sha: null, version: 0, aEnvoyer: false }; },
    async etats() { return tousBruts('etatSync'); },
    async marquer(chemins) { await marquer(chemins); },
    async aEnvoyer() { return (await tousBruts('etatSync')).filter(e => e.aEnvoyer).map(e => e.id).sort(); },
    async envoye(chemin, sha, version) {
      const e = await base.etat(chemin);
      await ecrireBrut('etatSync', [{ ...e, sha, aEnvoyer: e.version === version ? false : e.aEnvoyer }]);
    },
    async poserSha(chemin, sha) {
      const e = await base.etat(chemin);
      await ecrireBrut('etatSync', [{ ...e, sha }]);
    },
    async secret(cle) { return (await lire('secrets', cle))?.valeur ?? null; },
    async poserSecret(cle, valeur) {
      if (valeur == null || valeur === '') {
        const tx = db.transaction('secrets', 'readwrite'); tx.objectStore('secrets').delete(cle); await fin(tx);
      } else await ecrireBrut('secrets', [{ id: cle, valeur }]);
    },
    async cache(cle) { return lire('cacheOff', cle); },
    async poserCache(cle, valeur, le) { await ecrireBrut('cacheOff', [{ id: cle, valeur, le }]); },
    async exporter() {
      const magasins = {};
      for (const m of MAGASINS_SYNC) magasins[m] = await tousBruts(m);
      return { application: 'SuiviMacro', version: 1, exporteLe: horloge(), magasins };
    },
    async importer(obj) {
      const chemins = new Set();
      for (const m of MAGASINS_SYNC) {
        const recs = obj?.magasins?.[m] || [];
        if (!recs.length) continue;
        const f = fusionner(await tousBruts(m), recs);
        await ecrireBrut(m, f);
        f.forEach(r => chemins.add(fichierDe(m, r)));
        signaler(m);
      }
      await marquer([...chemins]);
      return chemins.size;
    },
    surChangement(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); },
    fermer() { db.close(); },
  };
  return base;
}
