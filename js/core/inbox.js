// Envois du raccourci iPhone (§ 7.1) : lecture tolérante et intégration.

/** « 80,2 kg », « 18,4 % », « 1 234,5 », 80.2 → nombre ; sinon null. */
export function lireNombre(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  const t = String(v).replace(/[\s  ]/g, '').replace(/(kg|%|kcal|cal|min)$/i, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

const ISO = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/;

function lireDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const m = s.match(ISO);
  // Avec un décalage explicite (+01:00), la date est déjà l'heure du téléphone ;
  // en UTC (Z), on la ramène à l'heure locale.
  if (m && !/Z$/i.test(s)) return { jour: m[1], heure: m[2] ? `${m[2]}:${m[3]}` : null, iso: s };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const p = n => String(n).padStart(2, '0');
  return { jour: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, heure: `${p(d.getHours())}:${p(d.getMinutes())}`, iso: d.toISOString() };
}

/** Jour civil de l'horodatage, dans le fuseau où il a été écrit. */
export const jourCivil = v => lireDate(v)?.jour ?? null;

const liste = v => (Array.isArray(v) ? v : []);

export function lireEnvoi(json) {
  const res = { poids: [], gras: [], seances: [], ignores: 0 };
  if (!json || typeof json !== 'object') return res;
  for (const p of liste(json.poids)) {
    const d = lireDate(p?.date), kg = lireNombre(p?.kg ?? p?.valeur);
    if (d && kg != null && kg > 20 && kg < 400) res.poids.push({ jour: d.jour, heure: d.heure || '00:00', kg });
    else res.ignores++;
  }
  for (const p of liste(json.gras)) {
    const d = lireDate(p?.date);
    let pct = lireNombre(p?.pct ?? p?.valeur);
    if (pct != null && pct > 0 && pct < 1) pct *= 100; // Santé exporte parfois 0,184
    if (d && pct != null && pct > 0 && pct < 80) res.gras.push({ jour: d.jour, heure: d.heure || '00:00', pct: Math.round(pct * 10) / 10 });
    else res.ignores++;
  }
  for (const s of liste(json.seances)) {
    const d = lireDate(s?.debut);
    if (!d) { res.ignores++; continue; }
    const fin = lireDate(s?.fin);
    let duree = lireNombre(s?.dureeMin);
    if (duree == null && fin) duree = Math.round((new Date(fin.iso) - new Date(d.iso)) / 60000);
    res.seances.push({
      id: `${d.iso}|${s.type || 'Séance'}`, jour: d.jour, type: String(s.type || 'Séance'), debut: d.iso,
      dureeMin: Number.isFinite(duree) ? duree : null, kcalActives: lireNombre(s?.kcal), source: 'raccourci',
    });
  }
  return res;
}

export function integrerEnvoi(envoi, mesures, seances, maintenant) {
  const parJour = new Map(mesures.map(m => [m.id, m]));
  const modifier = (jour, fn) => {
    const avant = parJour.get(jour) || { id: jour, sources: {} };
    const apres = fn({ ...avant, sources: { ...(avant.sources || {}) } });
    if (apres && JSON.stringify(apres) !== JSON.stringify(avant)) parJour.set(jour, { ...apres, majLe: maintenant });
  };
  const resume = { poids: 0, gras: 0, seances: 0, ignores: envoi.ignores };
  const jp = new Set(), jg = new Set();
  for (const p of envoi.poids) {
    modifier(p.jour, m => {
      if (m.sources.poids === 'manuel') return m;
      if (m.poids != null && m.heurePoids && m.heurePoids <= p.heure) return m;
      jp.add(p.jour);
      return { ...m, poids: p.kg, heurePoids: p.heure, sources: { ...m.sources, poids: 'raccourci' } };
    });
  }
  for (const g of envoi.gras) {
    modifier(g.jour, m => {
      if (m.sources.gras === 'manuel') return m;
      if (m.grasPct != null && m.heureGras && m.heureGras <= g.heure) return m;
      jg.add(g.jour);
      return { ...m, grasPct: g.pct, heureGras: g.heure, sources: { ...m.sources, gras: 'raccourci' } };
    });
  }
  const parId = new Map(seances.map(s => [s.id, s]));
  for (const s of envoi.seances) {
    if (parId.has(s.id)) continue;
    parId.set(s.id, { ...s, majLe: maintenant });
    resume.seances++;
  }
  resume.poids = jp.size; resume.gras = jg.size;
  return { mesures: [...parJour.values()], seances: [...parId.values()], resume };
}
