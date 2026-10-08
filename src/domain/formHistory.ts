import type { Entry, FormSnapshot } from './types';

/** Prefer the submitted schema; never relabel old answers using today's questions. */
export function formAtVersion(e: Entry, version: number, snapshot?: FormSnapshot): FormSnapshot {
  if (snapshot) return snapshot;
  if (version === e.version) return { title: e.title, fields: e.fields };
  const historical =
    e.history.find((h) => h.version === version) ??
    (e.history.length === e.version - 1 && e.history.every((h) => h.version === undefined)
      ? e.history[version - 1]
      : undefined);
  if (historical?.fields) return { title: historical.title, fields: historical.fields };
  // Some legacy records lack a question snapshot. Keep their answers visible without guessing labels.
  return { title: { fr: 'Démarche archivée', en: 'Archived form' }, fields: [] };
}
