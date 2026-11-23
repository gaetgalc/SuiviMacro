// Estimations par Claude avec la clé API de l'appareil (§ 10.5).
// Seule la phrase ou la photo est envoyée : ni poids, ni cibles, ni historique.
import { lignesDepuisJson } from '../core/phrase.js';
import { ORIGINES } from '../core/proteines.js';

export class IaRefus extends Error {}
export class IaCle extends Error {}
export class IaReseau extends Error {}

export const MODELE = 'claude-opus-5-5';

export const SCHEMA_ESTIMATION = {
  type: 'object', additionalProperties: false, required: ['aliments'],
  properties: {
    aliments: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['nom', 'g', 'kcal', 'prot', 'gluc', 'lip', 'fib', 'origineProt'],
        properties: {
          nom: { type: 'string' }, g: { type: 'number' }, kcal: { type: 'number' }, prot: { type: 'number' },
          gluc: { type: 'number' }, lip: { type: 'number' }, fib: { type: 'number' }, origineProt: { type: 'string', enum: ORIGINES },
        },
      },
    },
  },
};

const CONSIGNE = 'Tu estimes les valeurs nutritionnelles d\'un repas pour un journal alimentaire français. '
  + 'Une ligne par aliment ou plat, quantité en grammes, valeurs pour cette quantité (kcal, protéines, glucides, lipides, fibres en g) '
  + 'et origine principale des protéines. Portions standard françaises en cas de doute. Noms en français.';

export async function chargerAnthropic() {
  return (await import('../../vendor/anthropic.js')).default;
}

export function creerIa({ cle, Anthropic }) {
  const client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true, maxRetries: 1 });

  async function estimer(contenu) {
    let r;
    try {
      r = await client.beta.messages.create({
        model: MODELE, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA_ESTIMATION } },
        system: CONSIGNE,
        messages: [{ role: 'user', content: contenu }],
      });
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) throw new IaCle('Clé API refusée.');
      if (e?.status) throw new IaReseau(`Claude a répondu avec une erreur (HTTP ${e.status}).`);
      throw new IaReseau('Pas de connexion à Claude.');
    }
    if (r.stop_reason === 'refusal') throw new IaRefus('Claude a refusé cette demande.');
    const texte = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let obj;
    try { obj = JSON.parse(texte); } catch { throw new IaReseau('Réponse de Claude illisible.'); }
    return lignesDepuisJson(obj, 'ia');
  }

  return {
    estimerPhrase: texte => estimer([{ type: 'text', text: `Ce que j'ai mangé : « ${texte} »` }]),
    estimerPhoto: (base64, type) => estimer([
      { type: 'image', source: { type: 'base64', media_type: type, data: base64 } },
      { type: 'text', text: 'Estime chaque élément visible sur cette photo de repas.' },
    ]),
    async tester() {
      try { await client.models.retrieve(MODELE); return { ok: true, message: 'Clé valide.' }; } catch (e) {
        return { ok: false, message: e?.status === 401 ? 'Clé refusée.' : 'Impossible de joindre Claude.' };
      }
    },
  };
}

/** Réduit une photo (navigateur) : 1 568 px de côté au plus, JPEG. */
export async function reduireImage(fichier, max = 1568) {
  const img = await createImageBitmap(fichier);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  return { base64: url.split(',')[1], type: 'image/jpeg' };
}
