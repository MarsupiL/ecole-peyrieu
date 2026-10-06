import { parisInput, parisInstant } from '../domain/schoolTime';
import { useState } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { useApp, services, kindNames, formatDate } from './context';
import { Modal, Field, Upload, Files, Badge, AudienceLabel } from './components';
import {
  newEntry,
  tr,
  uid,
  type Entry,
  type Kind,
  type Field as FormField,
  type Audience,
} from '../domain/types';
import { saveEntry } from '../domain/engine';
import {
  canAuthor,
  eligible,
  childrenFor,
  photoAllowed,
  director,
  formDuty,
} from '../domain/policy';
import { templates } from '../data/templates';
export function entryDefault(
  s: ReturnType<typeof useApp>['s'],
  a: ReturnType<typeof useApp>['a'],
  kind: Kind,
) {
  const e = newEntry(kind, a.id, s.year, s.clock);
  e.audience = director(s, a)
    ? { type: 'school', ids: [] }
    : a.roles.includes('service')
      ? { type: 'service', ids: [a.services[0]] }
      : {
          type: 'class',
          ids:
            kind === 'topic' || (a.roles.includes('representative') && !a.roles.includes('teacher'))
              ? [a.representativeClasses[0]]
              : [a.classes[0]],
        };
  e.status = 'draft';
  e.deadline = new Date(Date.parse(s.clock) + 7 * 86400000).toISOString();
  e.unit = 'child';
  e.anonymous = false;
  e.pollType = 'single';
  e.summaryPlanned = true;
  e.options = [tr('Oui', 'Yes'), tr('Non', 'No')];
  e.start = new Date(Date.parse(s.clock) + 7 * 86400000).toISOString();
  e.end = new Date(Date.parse(s.clock) + 7 * 86400000 + 3600000).toISOString();
  e.allDay = false;
  e.recurrence = 'none';
  if (kind === 'form') Object.assign(e, structuredClone(templates[0]));
  e.id = uid();
  if (kind === 'evaluation') {
    e.childId = childrenFor(s, a).find((c) => canAuthor(s, a, 'evaluation', e.audience, c.id))?.id;
    e.subject = 'reading';
    e.requireAck = true;
  }
  return e;
}
const fieldTypes: Record<FormField['type'], [string, string]> = {
  text: ['Texte court', 'Short text'],
  textarea: ['Texte long', 'Long text'],
  date: ['Date', 'Date'],
  select: ['Choix unique', 'Single choice'],
  multi: ['Choix multiples', 'Multiple choice'],
  consent: ['Accord / refus', 'Approve / decline'],
  file: ['Fichier', 'File attachment'],
};
export function Editor({
  kind,
  initial,
  onClose,
}: {
  kind: Kind;
  initial?: Entry;
  onClose: () => void;
}) {
  const { s, a, t, locale, run, open } = useApp();
  const [e, setE] = useState<Entry>(() => structuredClone(initial ?? entryDefault(s, a, kind)));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const put = (patch: Partial<Entry>) => setE((x) => ({ ...x, ...patch }));
  const patchField = (id: string, patch: Partial<FormField>) =>
    put({ fields: e.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const staff = s.adults.filter((p) =>
    kind === 'form' ? formDuty(s, p, e) : canAuthor(s, p, kind, e.audience, e.childId),
  );
  const recipientCount = eligible(s, {
    ...e,
    status: kind === 'poll' ? 'open' : 'published',
  }).length;
  const save = async (status: Entry['status']) => {
    setSaving(true);
    try {
      await run((s) => saveEntry(s, a.id, { ...e, status }));
      onClose();
      open(e);
    } catch {
    } finally {
      setSaving(false);
    }
  };
  const allScopes: Audience[] = [
    { type: 'school', ids: [] },
    ...s.classes.filter((c) => !c.archived).map((c) => ({ type: 'class' as const, ids: [c.id] })),
    ...Object.keys(services).map((id) => ({ type: 'service' as const, ids: [id] })),
  ];
  return (
    <Modal
      title={initial ? t('Modifier', 'Edit') : t('Créer', 'Create') + ` · ${t(...kindNames[kind])}`}
      onClose={onClose}
    >
      <div className="toolbar">
        <button className={preview ? 'primary' : 'secondary'} onClick={() => setPreview(!preview)}>
          <Eye size={16} />
          {preview ? t('Revenir à l’éditeur', 'Back to editor') : t('Prévisualiser', 'Preview')}
        </button>
        {initial && <Badge value={initial.status} />}
      </div>
      {preview ? (
        <>
          <h2>{e.title[locale] || e.title.fr}</h2>
          <p className="detail-body">{e.body[locale] || e.body.fr}</p>
          <p>
            <AudienceLabel e={e} /> · {recipientCount}{' '}
            {t('adultes destinataires', 'adult recipients')}
          </p>
          {e.fields.map((f) => (
            <div className="mini-card" key={f.id}>
              <strong>
                {f.label[locale] || f.label.fr}
                {f.required ? ' *' : ''}
              </strong>
              <p>
                {t(...fieldTypes[f.type])}
                {f.condition &&
                  ` · ${t('Condition', 'Condition')}: ${f.condition.field} = ${f.condition.value}`}
              </p>
            </div>
          ))}
        </>
      ) : (
        <>
          {kind === 'form' && (
            <Field label={t('Modèle réutilisable', 'Reusable template')}>
              <select
                defaultValue=""
                onChange={(ev) => {
                  const template = templates.find((x) => x.id === ev.target.value);
                  if (template)
                    put({
                      title: template.title,
                      body: template.body,
                      fields: structuredClone(template.fields),
                    });
                }}
              >
                <option value="">{t('Choisir un modèle', 'Choose a template')}</option>
                {templates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title[locale]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="form-grid">
            <Field label={t('Titre en français *', 'French title *')}>
              <input
                required
                value={e.title.fr}
                onChange={(ev) => put({ title: { ...e.title, fr: ev.target.value } })}
              />
            </Field>
            <Field label={t('Titre en anglais', 'English title')}>
              <input
                value={e.title.en}
                onChange={(ev) => put({ title: { ...e.title, en: ev.target.value } })}
              />
            </Field>
          </div>
          <Field label={t('Texte en français *', 'French description *')}>
            <textarea
              required
              value={e.body.fr}
              onChange={(ev) => put({ body: { ...e.body, fr: ev.target.value } })}
            />
          </Field>
          <Field
            label={t('Texte en anglais', 'English description')}
            hint={t(
              'Sans traduction, le texte original est affiché.',
              'When no translation is supplied, the original is shown.',
            )}
          >
            <textarea
              value={e.body.en}
              onChange={(ev) => put({ body: { ...e.body, en: ev.target.value } })}
            />
          </Field>
          {kind !== 'evaluation' && (
            <>
              <Field label={t('Public', 'Audience')}>
                <select
                  value={`${e.audience.type}:${e.audience.ids.join(',')}`}
                  onChange={(ev) => {
                    const [type, ids] = ev.target.value.split(':');
                    put({
                      audience: { type: type as Audience['type'], ids: ids ? ids.split(',') : [] },
                      responsible: [a.id],
                    });
                  }}
                >
                  {allScopes
                    .filter((scope) => canAuthor(s, a, kind, scope))
                    .map((scope) => (
                      <option
                        key={`${scope.type}:${scope.ids}`}
                        value={`${scope.type}:${scope.ids.join(',')}`}
                      >
                        {scope.type === 'school'
                          ? t('Toute l’école', 'Whole school')
                          : scope.type === 'class'
                            ? s.classes.find((c) => c.id === scope.ids[0])?.name
                            : t(...services[scope.ids[0]])}
                      </option>
                    ))}
                  {['form', 'post', 'poll', 'event'].includes(kind) && (
                    <option value="individual:">
                      {t('Destinataires individuels', 'Individual recipients')}
                    </option>
                  )}
                </select>
              </Field>
              {e.audience.type === 'individual' && (
                <Field label={t('Adultes destinataires', 'Recipient adults')}>
                  <div className="checks">
                    {s.adults
                      .filter(
                        (p) =>
                          p.roles.includes('guardian') &&
                          canAuthor(s, a, kind, { type: 'individual', ids: [p.id] }),
                      )
                      .map((p) => (
                        <label className="check" key={p.id}>
                          <input
                            type="checkbox"
                            checked={e.audience.ids.includes(p.id)}
                            onChange={(ev) =>
                              put({
                                audience: {
                                  type: 'individual',
                                  ids: ev.target.checked
                                    ? [...e.audience.ids, p.id]
                                    : e.audience.ids.filter((id) => id !== p.id),
                                },
                              })
                            }
                          />
                          {p.name}
                        </label>
                      ))}
                  </div>
                </Field>
              )}
              <p className="notice-inline">
                {recipientCount}{' '}
                {t('adultes éligibles, sans doublon', 'eligible adults, without duplicates')}
              </p>
            </>
          )}
          {['form', 'evaluation'].includes(kind) && (
            <Field
              label={t(
                'Équipe responsable (accès explicite)',
                'Responsible team (explicit access)',
              )}
            >
              <div className="checks">
                {staff.map((p) => (
                  <label className="check" key={p.id}>
                    <input
                      type="checkbox"
                      disabled={p.id === a.id}
                      checked={e.responsible.includes(p.id)}
                      onChange={(ev) =>
                        put({
                          responsible: ev.target.checked
                            ? [...e.responsible, p.id]
                            : e.responsible.filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {['form', 'poll'].includes(kind) && (
            <div className="form-grid">
              <Field label={t('Échéance (heure de Paris)', 'Deadline (Paris time)')}>
                <input
                  type="datetime-local"
                  value={parisInput(e.deadline)}
                  onChange={(ev) =>
                    put({ deadline: ev.target.value ? parisInstant(ev.target.value) : undefined })
                  }
                />
                <small>{formatDate(e.deadline, locale, true)} · Europe/Paris</small>
              </Field>
              <Field label={t('Réponse attendue', 'Response unit')}>
                <select
                  value={e.unit}
                  onChange={(ev) => put({ unit: ev.target.value as 'adult' | 'child' })}
                >
                  <option value="child">
                    {t('Une par enfant, partagée', 'One per child, shared')}
                  </option>
                  <option value="adult">
                    {t('Une par adulte, privée', 'One per adult, private')}
                  </option>
                </select>
              </Field>
            </div>
          )}
          {kind === 'form' && (
            <>
              <Field
                label={t(
                  'Responsables requis (tous si aucun choix)',
                  'Required guardians (all if none selected)',
                )}
              >
                <div className="checks">
                  {eligible(s, { ...e, responders: [], status: 'published' }).map((p) => (
                    <label className="check" key={p.id}>
                      <input
                        type="checkbox"
                        checked={e.responders.includes(p.id)}
                        onChange={(ev) =>
                          put({
                            responders: ev.target.checked
                              ? [...e.responders, p.id]
                              : e.responders.filter((id) => id !== p.id),
                          })
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </Field>
              <h3>{t('Questions', 'Questions')}</h3>
              {e.fields.map((f, index) => (
                <div key={f.id} className="question-editor">
                  <div className="row between">
                    <strong>
                      {t('Question', 'Question')} {index + 1}
                    </strong>
                    <button
                      className="icon-button danger"
                      aria-label={t('Supprimer la question', 'Delete question')}
                      onClick={() => put({ fields: e.fields.filter((x) => x.id !== f.id) })}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label={t('Libellé français', 'French label')}>
                      <input
                        value={f.label.fr}
                        onChange={(ev) =>
                          patchField(f.id, { label: { ...f.label, fr: ev.target.value } })
                        }
                      />
                    </Field>
                    <Field label={t('Libellé anglais', 'English label')}>
                      <input
                        value={f.label.en}
                        onChange={(ev) =>
                          patchField(f.id, { label: { ...f.label, en: ev.target.value } })
                        }
                      />
                    </Field>
                    <Field label={t('Type de réponse', 'Answer type')}>
                      <select
                        value={f.type}
                        onChange={(ev) =>
                          patchField(f.id, {
                            type: ev.target.value as FormField['type'],
                            options: ['select', 'multi'].includes(ev.target.value)
                              ? [tr('Oui', 'Yes'), tr('Non', 'No')]
                              : undefined,
                          })
                        }
                      >
                        {Object.entries(fieldTypes).map(([id, label]) => (
                          <option value={id} key={id}>
                            {t(...label)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('Afficher si', 'Show when')}>
                      <select
                        value={f.condition?.field ?? ''}
                        onChange={(ev) =>
                          patchField(f.id, {
                            condition: ev.target.value
                              ? { field: ev.target.value, value: '1' }
                              : undefined,
                          })
                        }
                      >
                        <option value="">{t('Toujours', 'Always')}</option>
                        {e.fields
                          .filter((x) => x.id !== f.id && ['select', 'consent'].includes(x.type))
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label[locale]}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                  {f.condition && (
                    <Field
                      label={t(
                        'Valeur déclenchante (index du choix : 0, 1… ; allowed/refused)',
                        'Trigger value (choice index: 0, 1…; allowed/refused)',
                      )}
                    >
                      <input
                        value={f.condition.value}
                        onChange={(ev) =>
                          patchField(f.id, {
                            condition: { ...f.condition!, value: ev.target.value },
                          })
                        }
                      />
                    </Field>
                  )}
                  {f.options && (
                    <Field
                      label={t(
                        'Options : français | anglais, une par ligne',
                        'Options: French | English, one per line',
                      )}
                    >
                      <textarea
                        value={f.options.map((o) => `${o.fr} | ${o.en}`).join('\n')}
                        onChange={(ev) =>
                          patchField(f.id, {
                            options: ev.target.value.split('\n').map((line) => {
                              const [fr, en] = line.split('|');
                              return tr(fr.trim(), en?.trim() ?? '');
                            }),
                          })
                        }
                      />
                    </Field>
                  )}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(ev) => patchField(f.id, { required: ev.target.checked })}
                    />
                    {t('Obligatoire', 'Required')}
                  </label>
                  {f.type === 'file' && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={f.restricted ?? false}
                        onChange={(ev) => patchField(f.id, { restricted: ev.target.checked })}
                      />
                      {t(
                        'Justificatif réservé au vérificateur',
                        'Evidence restricted to the reviewer',
                      )}
                    </label>
                  )}
                </div>
              ))}
              <button
                className="secondary"
                onClick={() =>
                  put({
                    fields: [
                      ...e.fields,
                      {
                        id: uid(),
                        label: tr('Nouvelle question', 'New question'),
                        type: 'text',
                        required: false,
                      },
                    ],
                  })
                }
              >
                <Plus size={17} />
                {t('Ajouter une question', 'Add question')}
              </button>
              {initial && (
                <p className="small-print">
                  {t(
                    'Chaque modification conserve la version précédente. Les anciennes réponses restent des instantanés. Pour demander une nouvelle réponse à tous, dupliquez cette démarche.',
                    'Each edit preserves the previous version. Existing answers remain snapshots. Duplicate this form to request a fresh response from everyone.',
                  )}
                </p>
              )}
            </>
          )}
          {kind === 'evaluation' && (
            <>
              <div className="form-grid">
                <Field label={t('Enfant', 'Child')}>
                  <select value={e.childId} onChange={(ev) => put({ childId: ev.target.value })}>
                    {childrenFor(s, a)
                      .filter((c) => canAuthor(s, a, kind, e.audience, c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={t('Domaine', 'Subject')}>
                  <select
                    value={e.subject ?? 'reading'}
                    onChange={(ev) => put({ subject: ev.target.value })}
                  >
                    <option value="reading">{t('Lecture', 'Reading')}</option>
                    <option value="maths">{t('Mathématiques', 'Mathematics')}</option>
                    <option value="science">{t('Sciences', 'Science')}</option>
                    <option value="classwork">{t('Travail de classe', 'Classwork')}</option>
                  </select>
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.requireAck}
                  onChange={(ev) => put({ requireAck: ev.target.checked })}
                />
                {t(
                  'Demander un accusé de lecture à chaque responsable',
                  'Request a read acknowledgement from every guardian',
                )}
              </label>
            </>
          )}
          {kind === 'poll' && (
            <>
              <Field
                label={t(
                  'Ouverture programmée (heure de Paris, facultative)',
                  'Scheduled opening (Paris time, optional)',
                )}
              >
                <input
                  type="datetime-local"
                  value={parisInput(e.scheduled)}
                  onChange={(ev) =>
                    put({ scheduled: ev.target.value ? parisInstant(ev.target.value) : undefined })
                  }
                />
              </Field>
              <Field label={t('Visibilité des réponses', 'Answer identity')}>
                <select
                  value={e.anonymous ? 'anonymous' : 'identified'}
                  onChange={(ev) => put({ anonymous: ev.target.value === 'anonymous' })}
                >
                  <option value="identified">{t('Identifiées', 'Identified')}</option>
                  <option value="anonymous">
                    {t('Anonymes pour l’organisateur', 'Anonymous to the organiser')}
                  </option>
                </select>
              </Field>
              <Field label={t('Type', 'Type')}>
                <select
                  value={e.pollType}
                  onChange={(ev) =>
                    put({
                      pollType: ev.target.value as Entry['pollType'],
                      options:
                        ev.target.value === 'rating'
                          ? [1, 2, 3, 4, 5].map((v) => tr(`${v} / 5`, `${v} / 5`))
                          : e.options,
                    })
                  }
                >
                  <option value="single">{t('Choix unique', 'Single choice')}</option>
                  <option value="multi">{t('Choix multiples', 'Multiple choice')}</option>
                  <option value="rating">{t('Échelle de 1 à 5', 'Rating from 1 to 5')}</option>
                </select>
              </Field>
              <Field
                label={t(
                  'Choix : français | anglais, un par ligne',
                  'Choices: French | English, one per line',
                )}
              >
                <textarea
                  value={e.options.map((o) => `${o.fr} | ${o.en}`).join('\n')}
                  onChange={(ev) =>
                    put({
                      options: ev.target.value.split('\n').map((line) => {
                        const [fr, en] = line.split('|');
                        return tr(fr.trim(), en?.trim() ?? '');
                      }),
                    })
                  }
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.summaryPlanned}
                  onChange={(ev) => put({ summaryPlanned: ev.target.checked })}
                />
                {t('Une synthèse sera publiée', 'A summary will be published')}
              </label>
            </>
          )}
          {kind === 'event' && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.allDay}
                  onChange={(ev) =>
                    put({
                      allDay: ev.target.checked,
                      start: e.start?.slice(0, 10) + (ev.target.checked ? '' : 'T08:00:00.000Z'),
                      end: e.end?.slice(0, 10) + (ev.target.checked ? '' : 'T09:00:00.000Z'),
                    })
                  }
                />
                {t('Toute la journée', 'All day')}
              </label>
              <div className="form-grid">
                <Field label={t('Début (heure de Paris)', 'Start (Paris time)')}>
                  <input
                    type={e.allDay ? 'date' : 'datetime-local'}
                    value={e.allDay ? (e.start?.slice(0, 10) ?? '') : parisInput(e.start)}
                    onChange={(ev) =>
                      put({ start: e.allDay ? ev.target.value : parisInstant(ev.target.value) })
                    }
                  />
                </Field>
                <Field
                  label={
                    e.allDay
                      ? t('Fin exclusive (jour suivant)', 'Exclusive end (next day)')
                      : t('Fin (heure de Paris)', 'End (Paris time)')
                  }
                >
                  <input
                    type={e.allDay ? 'date' : 'datetime-local'}
                    value={e.allDay ? (e.end?.slice(0, 10) ?? '') : parisInput(e.end)}
                    onChange={(ev) =>
                      put({ end: e.allDay ? ev.target.value : parisInstant(ev.target.value) })
                    }
                  />
                </Field>
                <Field label={t('Lieu', 'Location')}>
                  <input
                    value={e.location ?? ''}
                    onChange={(ev) => put({ location: ev.target.value })}
                  />
                </Field>
                <Field label={t('Places bénévoles', 'Volunteer capacity')}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={e.capacity}
                    onChange={(ev) => put({ capacity: Number(ev.target.value) })}
                  />
                </Field>
                <Field label={t('Récurrence', 'Recurrence')}>
                  <select
                    value={e.recurrence ?? 'none'}
                    onChange={(ev) => put({ recurrence: ev.target.value as Entry['recurrence'] })}
                  >
                    <option value="none">{t('Aucune', 'None')}</option>
                    <option value="weekly">
                      {t('Hebdomadaire · 4 séances', 'Weekly · 4 sessions')}
                    </option>
                  </select>
                </Field>
              </div>
            </>
          )}
          {['post', 'form', 'event', 'topic'].includes(kind) && (
            <Field
              label={t(
                'Lier une démarche, un sondage ou un événement',
                'Link a form, poll or event',
              )}
            >
              <select
                value={e.link ?? ''}
                onChange={(ev) => put({ link: ev.target.value || undefined })}
              >
                <option value="">{t('Aucun', 'None')}</option>
                {s.entries
                  .filter(
                    (x) =>
                      ['form', 'poll', 'event'].includes(x.kind) &&
                      canAuthor(s, a, x.kind, x.audience) &&
                      x.id !== e.id,
                  )
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title[locale]}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {kind === 'post' && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.pinned ?? false}
                  onChange={(ev) => put({ pinned: ev.target.checked })}
                />
                {t('Épingler', 'Pin')}
              </label>
              <div className="form-grid">
                <Field
                  label={t(
                    'Publication programmée (heure de Paris)',
                    'Scheduled publication (Paris time)',
                  )}
                >
                  <input
                    type="datetime-local"
                    value={parisInput(e.scheduled)}
                    onChange={(ev) =>
                      put({
                        scheduled: ev.target.value ? parisInstant(ev.target.value) : undefined,
                      })
                    }
                  />
                </Field>
                <Field
                  label={t(
                    'Expiration (heure de Paris, facultative)',
                    'Expiry (Paris time, optional)',
                  )}
                >
                  <input
                    type="datetime-local"
                    value={parisInput(e.expires)}
                    onChange={(ev) =>
                      put({ expires: ev.target.value ? parisInstant(ev.target.value) : undefined })
                    }
                  />
                </Field>
              </div>
              <div className="mini-card">
                <h3>{t('Photo et consentement', 'Photo & consent')}</h3>
                <Upload
                  entry={e}
                  onUpload={(id) =>
                    put({
                      photoFile: id,
                      photoUse: e.audience.type === 'school' ? 'school' : 'class',
                    })
                  }
                />
                <Field label={t('Usage de la photo', 'Photo use')}>
                  <select
                    value={e.photoUse ?? 'class'}
                    onChange={(ev) => put({ photoUse: ev.target.value as 'class' | 'school' })}
                  >
                    <option value="class">{t('Fil privé de classe', 'Private class feed')}</option>
                    <option value="school">
                      {t('Fil privé de l’école', 'Private school feed')}
                    </option>
                  </select>
                </Field>
                <Field
                  label={t(
                    'Enfants identifiables (déclaration manuelle)',
                    'Identifiable children (manual declaration)',
                  )}
                >
                  <div className="checks">
                    {childrenFor(s, a).map((c) => (
                      <label key={c.id} className="check">
                        <input
                          type="checkbox"
                          checked={e.photoChildren.includes(c.id)}
                          onChange={(ev) =>
                            put({
                              photoChildren: ev.target.checked
                                ? [...e.photoChildren, c.id]
                                : e.photoChildren.filter((id) => id !== c.id),
                            })
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </Field>
                {e.photoFile && (
                  <p className="notice-inline">
                    {photoAllowed(s, e.photoChildren, e.photoUse ?? 'class')
                      ? t('Les autorisations permettent cet usage.', 'Permissions allow this use.')
                      : t(
                          'Publication bloquée : accord manquant ou refus.',
                          'Publication blocked: missing approval or refusal.',
                        )}
                  </p>
                )}
                <small>
                  {t(
                    'Aucune reconnaissance faciale. Choisissez une autre image ou une version modifiée manuellement si nécessaire.',
                    'No facial recognition. Choose another image or a manually edited replacement when needed.',
                  )}
                </small>
              </div>
            </>
          )}
          {kind !== 'poll' && (
            <>
              <Upload entry={e} onUpload={(id) => put({ attachments: [...e.attachments, id] })} />
              <Files ids={e.attachments} />
            </>
          )}
        </>
      )}
      <div className="modal-actions">
        <button onClick={onClose}>{t('Fermer', 'Close')}</button>
        <button disabled={saving} onClick={() => void save('draft')}>
          {t('Enregistrer le brouillon', 'Save draft')}
        </button>
        {e.scheduled && ['post', 'poll'].includes(kind) && (
          <button disabled={saving} onClick={() => void save('scheduled')}>
            {t('Programmer', 'Schedule')}
          </button>
        )}
        <button
          className="primary"
          disabled={saving}
          onClick={() => void save(['poll', 'topic'].includes(kind) ? 'open' : 'published')}
        >
          {t('Publier', 'Publish')}
        </button>
      </div>
    </Modal>
  );
}
