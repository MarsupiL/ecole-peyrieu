import { useState } from 'react';
import { useApp } from './context';
import { Card, Field, Badge } from './components';
import { eligible, responseChildren, canProcessForm } from '../domain/policy';
import type { Entry } from '../domain/types';
/** Staff-facing completion tracking uses response units, not the number of notifications. */
export function RecipientProgress({ e }: { e: Entry }) {
  const { s, a, t } = useApp();
  const [classId, setClass] = useState('all');
  const [missing, setMissing] = useState(false);
  const [responder, setResponder] = useState('all');
  const recipients = eligible(s, e);
  const units =
    e.unit === 'adult'
      ? recipients.map((p) => ({
          id: p.id,
          name: p.name,
          child: responseChildren(s, p, e)[0],
          people: [p],
        }))
      : [...new Set(recipients.flatMap((p) => responseChildren(s, p, e).map((c) => c.id)))].map(
          (id) => ({
            id,
            name: s.children.find((c) => c.id === id)!.name,
            child: s.children.find((c) => c.id === id),
            people: recipients.filter((p) => responseChildren(s, p, e).some((c) => c.id === id)),
          }),
        );
  const rows = units
    .filter((unit) => unit.child && canProcessForm(s, a, e, unit.child.id))
    .map((unit) => {
      const x = s.submissions.find(
        (x) =>
          x.formId === e.id &&
          !x.draft &&
          (e.unit === 'adult' ? x.adultId === unit.id : x.childId === unit.id),
      );
      const drafted = s.submissions.some(
        (x) =>
          x.formId === e.id &&
          x.draft &&
          (e.unit === 'adult' ? x.adultId === unit.id : x.childId === unit.id),
      );
      const missingFile = e.fields.some(
        (f) =>
          f.type === 'file' &&
          f.required &&
          (!f.condition || x?.answers[f.condition.field] === f.condition.value) &&
          !x?.answers[f.id],
      );
      const status =
        x?.status ??
        (drafted ? 'draft' : e.deadline && e.deadline < s.clock ? 'overdue' : 'notStarted');
      return { unit, x, status, missingFile };
    })
    .filter(
      (row) =>
        (classId === 'all' || row.unit.child?.classId === classId) &&
        (!missing || row.missingFile) &&
        (responder === 'all' || row.unit.people.some((p) => p.id === responder)),
    );
  return (
    <Card>
      <h2>{t('Qui doit répondre ?', 'Who needs to respond?')}</h2>
      <div className="form-grid">
        <Field label={t('Filtrer par classe', 'Filter by class')}>
          <select value={classId} onChange={(ev) => setClass(ev.target.value)}>
            <option value="all">
              {t('Toutes les classes autorisées', 'All authorised classes')}
            </option>
            {s.classes
              .filter((c) => units.some((u) => u.child?.classId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t('Responsable attendu', 'Expected guardian')}>
          <select value={responder} onChange={(ev) => setResponder(ev.target.value)}>
            <option value="all">{t('Tous les destinataires', 'All recipients')}</option>
            {recipients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={missing} onChange={(ev) => setMissing(ev.target.checked)} />
        {t('Pièce jointe obligatoire manquante', 'Missing required attachment')}
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{e.unit === 'adult' ? t('Adulte', 'Adult') : t('Enfant', 'Child')}</th>
              <th>{t('Responsables attendus', 'Expected guardians')}</th>
              <th>{t('État', 'Status')}</th>
              <th>{t('Pièces', 'Attachments')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.unit.id}>
                <td>{row.unit.name}</td>
                <td>{row.unit.people.map((p) => p.name).join(', ')}</td>
                <td>
                  <Badge value={row.status} />
                </td>
                <td>
                  {row.missingFile
                    ? t('Manquante', 'Missing')
                    : t('À jour / non requise', 'Complete / not required')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small-print">
        {t(
          'Les réponses manquantes et l’état des brouillons ne sont visibles que par l’équipe responsable. Le contenu d’un brouillon reste privé.',
          'Only the responsible team sees outstanding responses and draft status. Draft contents remain private.',
        )}
      </p>
    </Card>
  );
}
