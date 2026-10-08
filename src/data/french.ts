import type { State } from '../domain/types';

// Only exact text shipped by the bilingual demo is replaced. Never split on “/”:
// locally edited names, messages, drafts and imported content must remain intact.
const originalText = new Map([
  ['Responsables légaux / Legal guardians', 'Responsables légaux'],
  ['Un temps pour parler des livres / Time to talk about books', 'Un temps pour parler des livres'],
  [
    'Le départ est prévu après l’accueil. / We will leave after morning registration.',
    'Le départ est prévu après l’accueil.',
  ],
  [
    'Une question sur l’accueil du soir. / A question about after-school care.',
    'Une question sur l’accueil du soir.',
  ],
  ['Tante fictive / Fictional aunt', 'Tante fictive'],
  ['Parc fictif / Fictional park', 'Parc fictif'],
  ['École · Démo / School · Demo', 'École · Démo'],
  [
    'Photo : accord à revérifier / Photo: permission must be reviewed',
    'Photo : accord à revérifier',
  ],
]);

export function upgradeDemoFrench(s: State): State {
  const n = structuredClone(s);
  let changed = false;
  // Include copies in prefilled answers and their history, without losing any record.
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string' && originalText.has(value)) {
      changed = true;
      return originalText.get(value);
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        (value as Record<string, unknown>)[key] = visit(child);
      }
    }
    return value;
  };
  visit(n);
  const illustration = n.attachments.find((f) => f.id === 'sample-photo');
  if (illustration?.name === 'sample-image.png') {
    illustration.name = 'illustration-fictive.png';
    changed = true;
  }
  if (!changed) return s;
  n.revision++;
  return n;
}

export const sampleFiles = [
  {
    id: 'sample-photo',
    path: 'sample-image.png',
    previousHash: 'b7786f14cb5981e373b83828d341c5ac7ef14e8fc1be95016b52ff1a972f5f63',
  },
  {
    id: 'sample-evidence',
    path: 'sample-evidence.pdf',
    previousHash: '72bfa186af488ddc131ffc58bd669c52e592b386ab86a729aaf604f653e64eb5',
  },
  {
    id: 'sample-work',
    path: 'sample-worksheet.pdf',
    previousHash: 'edac4e3d1953fd5b0548ac060b9dd4e92d4d2052a1f4fce6f642737354433979',
  },
];

export async function fileHash(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, '0')).join('');
}
