import { formAtVersion } from '../domain/formHistory';
import { parisInput, parisInstant } from '../domain/schoolTime';
import { useState } from 'react';
import { Download, History, Copy, Check, Send } from 'lucide-react';
import { useApp, formatDate } from './context';
import {
  Card,
  Field,
  Files,
  Upload,
  Badge,
  Empty,
  Modal,
  PageTitle,
  EntryCard,
  AddButton,
} from './components';
import {
  visibleEntries,
  canManage,
  canReadSubmission,
  responseChildren,
  canAuthor,
  guardian,
} from '../domain/policy';
import {
  submitForm,
  validateAnswers,
  flag,
  reviewSubmission,
  setEntryStatus,
  notify,
  change,
} from '../domain/engine';
import { download, makePdf, submissionPdf, csv } from '../domain/exports';
import { type Entry, type Answers, type Submission } from '../domain/types';
import { Editor, entryDefault } from './Editor';
import { RecipientProgress } from './RecipientProgress';
export function Forms() {
  const { s, a, t, locale, go } = useApp();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const list = visibleEntries(s, a, 'form').filter((e) =>
    `${e.title[locale]} ${e.body[locale]}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageTitle
        title={t('Les démarches, en un endroit', 'Paperwork, all in one place')}
        subtitle={t(
          'À compléter, à suivre, à retrouver.',
          'Complete, follow up and find your documents.',
        )}
        action={
          canAuthor(s, a, 'form', entryDefault(s, a, 'form').audience) && (
            <AddButton onClick={() => setEditing(true)}>
              {t('Créer une démarche', 'Create form')}
            </AddButton>
          )
        }
      />
      <div className="toolbar">
        <input
          aria-label={t('Rechercher une démarche', 'Search forms')}
          placeholder={t('Rechercher une démarche…', 'Search forms…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="secondary" onClick={() => go('requests')}>
          {t('Absences et départs', 'Absence & collection')}
        </button>
      </div>
      <div className="grid">
        {list.map((e) => (
          <EntryCard key={e.id} e={e} />
        ))}
      </div>
      {!list.length && <Empty />}
      {editing && <Editor kind="form" onClose={() => setEditing(false)} />}
    </>
  );
}
export function FormDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const children = [
    ...new Map(
      [
        ...responseChildren(s, a, e),
        ...s.submissions
          .filter((x) => x.formId === e.id && canReadSubmission(s, a, x))
          .flatMap((x) => s.children.filter((c) => c.id === x.childId && guardian(s, a, c))),
      ].map((c) => [c.id, c]),
    ).values(),
  ];
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const staff = canManage(s, a, e);
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(
    parisInput(new Date(Date.parse(s.clock) + 7 * 86400000).toISOString()),
  );
  const [duplicate, setDuplicate] = useState<Entry>();
  const responses = s.submissions.filter((x) => x.formId === e.id && canReadSubmission(s, a, x));
  const rows = responses.filter(
    (x) =>
      (statusFilter === 'all' || x.status === statusFilter) &&
      s.children
        .find((c) => c.id === x.childId)
        ?.name.toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="stack">
      <Card>
        <div className="row between">
          <div>
            <h2>
              {t('Échéance', 'Deadline')} · {formatDate(e.deadline, locale, true)}
            </h2>
            <p className="muted">
              {e.unit === 'adult'
                ? t('Une réponse privée par adulte.', 'One private response per adult.')
                : t(
                    'Une réponse partagée par enfant. Seul le premier répondant peut la modifier.',
                    'One shared response per child. Only the original respondent can edit it.',
                  )}
            </p>
          </div>
          <Badge value={e.status} />
        </div>
        <p>
          {t('Responsables :', 'Responsible team:')}{' '}
          {e.responsible.map((id) => s.adults.find((p) => p.id === id)?.name).join(', ')}
        </p>
        <button
          className="secondary"
          onClick={() =>
            download(
              'modele-fictif.pdf',
              makePdf(
                e.title[locale] || e.title.fr,
                [
                  e.body[locale] || e.body.fr,
                  ...e.fields.map(
                    (f) => `${f.label[locale] || f.label.fr}: __________________________________`,
                  ),
                  t(
                    'À compléter hors de l’application, avec des données fictives uniquement.',
                    'Complete outside the app, with fictional data only.',
                  ),
                ],
                locale,
              ),
            )
          }
        >
          <Download size={17} />
          {t('Télécharger le modèle PDF', 'Download PDF template')}
        </button>
      </Card>
      {staff ? (
        <>
          <Card>
            <h2>{t('Suivi des réponses', 'Response tracking')}</h2>
            <div className="toolbar">
              <input
                aria-label={t('Filtrer par enfant', 'Filter by child')}
                placeholder={t('Rechercher un enfant…', 'Search children…')}
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
              />
              <select
                aria-label={t('État de réponse', 'Response status')}
                value={statusFilter}
                onChange={(ev) => setStatusFilter(ev.target.value)}
              >
                <option value="all">{t('Tous les états', 'All statuses')}</option>
                {['submitted', 'needsCorrection', 'reviewed', 'completed'].map((v) => (
                  <option key={v} value={v}>
                    {v === 'submitted'
                      ? t('Transmis', 'Submitted')
                      : v === 'needsCorrection'
                        ? t('À corriger', 'Needs correction')
                        : v === 'reviewed'
                          ? t('Vérifié', 'Reviewed')
                          : t('Terminé', 'Completed')}
                  </option>
                ))}
              </select>
            </div>
            <div className="metrics-inline">
              <div>
                <strong>{responses.length}</strong>
                {t('réponses reçues', 'responses received')}
              </div>
              <div>
                <strong>
                  {s.adults.filter((p) => responseChildren(s, p, e).length > 0).length}
                </strong>
                {t('responsables éligibles', 'eligible guardians')}
              </div>
            </div>
            <div className="row padded">
              <button
                onClick={() =>
                  void run((s) =>
                    change(s, a.id, 'reminder', e.id, (n) => {
                      const ids = n.adults
                        .filter((p) =>
                          responseChildren(n, p, e).some(
                            (c) =>
                              !n.submissions.some(
                                (x) =>
                                  x.formId === e.id &&
                                  !x.draft &&
                                  (e.unit === 'adult' ? x.adultId === p.id : x.childId === c.id),
                              ),
                          ),
                        )
                        .map((p) => p.id);
                      notify(n, e, `manual:${n.clock}`, ids);
                    }),
                  ).catch(() => {})
                }
              >
                <Send size={16} />
                {t('Relancer les réponses manquantes', 'Remind outstanding respondents')}
              </button>
              <button onClick={() => setReopen(true)}>
                {t('Réouvrir avec un nouveau délai', 'Reopen with a new deadline')}
              </button>
              <button
                onClick={() =>
                  void run((s) => setEntryStatus(s, a.id, e.id, 'closed')).catch(() => {})
                }
              >
                {t('Clore', 'Close')}
              </button>
              <button
                onClick={() =>
                  setDuplicate({
                    ...e,
                    id: crypto.randomUUID(),
                    version: 1,
                    history: [],
                    status: 'draft',
                    title: { fr: `${e.title.fr} · copie`, en: `${e.title.en} · copy` },
                  })
                }
              >
                <Copy size={16} />
                {t('Dupliquer', 'Duplicate')}
              </button>
              <button
                onClick={() =>
                  download(
                    'reponses.csv',
                    csv([
                      [
                        t('Enfant', 'Child'),
                        t('Répondant', 'Respondent'),
                        t('État', 'Status'),
                        t('Date', 'Date'),
                      ],
                      ...responses.map((x) => [
                        x.snapshot.child,
                        s.adults.find((a) => a.id === x.author)?.name,
                        x.status,
                        x.at,
                      ]),
                    ]),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                CSV
              </button>
            </div>
          </Card>
          <RecipientProgress e={e} />
          {rows.map((x) => (
            <SubmissionCard key={x.id} e={e} x={x} staff />
          ))}
          {!rows.length && <Empty />}
        </>
      ) : children.length ? (
        <>
          <Field label={t('Pour quel enfant ?', 'Which child?')}>
            <select value={childId} onChange={(ev) => setChildId(ev.target.value)}>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <FormAnswers key={`${e.id}:${childId}`} e={e} childId={childId} />
        </>
      ) : (
        <Empty />
      )}
      {reopen && (
        <Modal title={t('Réouvrir la démarche', 'Reopen form')} onClose={() => setReopen(false)}>
          <Field label={t('Motif de réouverture', 'Reason for reopening')}>
            <textarea value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
          <Field label={t('Nouvelle échéance (heure de Paris)', 'New deadline (Paris time)')}>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(ev) => setDeadline(ev.target.value)}
            />
          </Field>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) =>
                  setEntryStatus(s, a.id, e.id, 'open', reason, parisInstant(deadline)),
                );
                setReopen(false);
              } catch {}
            }}
          >
            {t('Réouvrir', 'Reopen')}
          </button>
        </Modal>
      )}
      {duplicate && (
        <Editor
          kind="form"
          initial={duplicate}
          onClose={() => setDuplicate(undefined)}
          key={duplicate.id}
        />
      )}
    </div>
  );
}
function FormAnswers({ e, childId }: { e: Entry; childId: string }) {
  const { s, a, t, locale, run } = useApp();
  const c = s.children.find((c) => c.id === childId)!;
  const matching = s.submissions.filter(
    (x) =>
      x.formId === e.id &&
      (e.unit === 'adult' ? x.adultId === a.id : x.childId === childId) &&
      canReadSubmission(s, a, x),
  );
  const x = matching.find((x) => !x.draft) ?? matching.find((x) => x.author === a.id);
  const [answers, setAnswers] = useState<Answers>(
    () =>
      x?.answers ?? {
        child: c.name,
        contact: a.contact,
        emergency: c.emergency,
        collectors: c.collectors,
        care: c.care[locale],
      },
  );
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState<string[]>([]);
  const [editing, setEditing] = useState(!x || x.draft);
  const [correction, setCorrection] = useState(false);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState(false);
  const locked =
    e.status === 'closed' || e.status === 'archived' || (!!e.deadline && e.deadline < s.clock);
  const own = !x || x.author === a.id;
  const set = (id: string, value: string | string[]) => setAnswers((v) => ({ ...v, [id]: value }));
  return (
    <>
      {x && !x.draft && <SubmissionCard e={e} x={x} />}
      <Card>
        {x && !x.draft && (
          <div className="row padded">
            {own && !locked && (
              <button onClick={() => setEditing(!editing)}>
                {t('Modifier ma réponse', 'Edit my response')}
              </button>
            )}
            <button onClick={() => setHistory(!history)}>
              <History size={16} />
              {t('Historique', 'History')} ({x.history.length + 1})
            </button>
          </div>
        )}
        {history && x && (
          <div className="stack">
            {[
              ...x.history,
              {
                answers: x.answers,
                at: x.at,
                version: x.formVersion,
                formSnapshot: x.formSnapshot,
              },
            ].map((h, i) => (
              <div key={i} className="mini-card">
                <strong>
                  v{h.version} · {formatDate(h.at, locale, true)}
                </strong>
                <AnswerView e={formAtVersion(e, h.version, h.formSnapshot)} answers={h.answers} />
              </div>
            ))}
          </div>
        )}
        {editing && own && !locked && (
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              const issues = validateAnswers(e, answers);
              setValidation(issues);
              if (issues.length) return;
              try {
                await run((s) => submitForm(s, a.id, e.id, childId, answers, false, confirmed));
                setEditing(false);
              } catch {}
            }}
            noValidate
          >
            {e.fields
              .filter((f) => !f.condition || answers[f.condition.field] === f.condition.value)
              .map((f) => (
                <div key={f.id}>
                  <Field label={`${f.label[locale] || f.label.fr}${f.required ? ' *' : ''}`}>
                    {f.type === 'file' ? (
                      <>
                        <Upload
                          entry={e}
                          childId={f.restricted ? childId : undefined}
                          restricted={f.restricted}
                          label={t('Sélectionner le fichier', 'Choose file')}
                          onUpload={(id) => set(f.id, id)}
                        />
                        <Files ids={answers[f.id] ? [String(answers[f.id])] : []} />
                      </>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={String(answers[f.id] ?? '')}
                        aria-invalid={validation.includes(f.id)}
                        aria-describedby={validation.includes(f.id) ? `err-${f.id}` : undefined}
                        onChange={(ev) => set(f.id, ev.target.value)}
                      />
                    ) : f.type === 'select' || f.type === 'consent' ? (
                      <select
                        value={String(answers[f.id] ?? '')}
                        aria-invalid={validation.includes(f.id)}
                        onChange={(ev) => set(f.id, ev.target.value)}
                      >
                        <option value="">{t('Choisir…', 'Choose…')}</option>
                        {f.type === 'consent' ? (
                          <>
                            <option value="allowed">{t('Je donne mon accord', 'I approve')}</option>
                            <option value="refused">{t('Je refuse', 'I decline')}</option>
                          </>
                        ) : (
                          f.options?.map((o, i) => (
                            <option key={i} value={i}>
                              {o[locale] || o.fr}
                            </option>
                          ))
                        )}
                      </select>
                    ) : f.type === 'multi' ? (
                      <div>
                        {f.options?.map((o, i) => (
                          <label key={i} className="choice-row">
                            <input
                              type="checkbox"
                              checked={
                                Array.isArray(answers[f.id]) &&
                                (answers[f.id] as string[]).includes(String(i))
                              }
                              onChange={(ev) =>
                                set(
                                  f.id,
                                  ev.target.checked
                                    ? [
                                        ...(Array.isArray(answers[f.id])
                                          ? (answers[f.id] as string[])
                                          : []),
                                        String(i),
                                      ]
                                    : (answers[f.id] as string[]).filter((v) => v !== String(i)),
                                )
                              }
                            />
                            {o[locale] || o.fr}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        value={String(answers[f.id] ?? '')}
                        aria-invalid={validation.includes(f.id)}
                        aria-describedby={validation.includes(f.id) ? `err-${f.id}` : undefined}
                        onChange={(ev) => set(f.id, ev.target.value)}
                      />
                    )}
                  </Field>
                  {validation.includes(f.id) && (
                    <p id={`err-${f.id}`} className="error-text" role="alert">
                      {t('Une réponse valide est nécessaire.', 'A valid response is required.')}
                    </p>
                  )}
                </div>
              ))}
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(ev) => setConfirmed(ev.target.checked)}
              />
              {t(
                'J’ai vérifié ces réponses fictives et je confirme leur transmission.',
                'I have reviewed these fictional answers and confirm submission.',
              )}
            </label>
            <p className="small-print">
              {t(
                'L’action est attribuée au profil actuel, avec date et version. Aucune signature manuscrite ou certifiée.',
                'The action records the current persona, date and version. No handwritten or certified signature.',
              )}
            </p>
            <div className="row">
              <button
                type="button"
                disabled={!!x && !x.draft}
                onClick={() =>
                  void run((s) => submitForm(s, a.id, e.id, childId, answers, true, false)).catch(
                    () => {},
                  )
                }
              >
                {t('Enregistrer le brouillon', 'Save draft')}
              </button>
              <button className="primary" type="submit">
                <Check size={17} />
                {t('Confirmer et transmettre', 'Confirm & submit')}
              </button>
            </div>
          </form>
        )}
        {locked && (
          <p className="notice-inline warning">
            {t(
              'La démarche est fermée ou le délai dépassé. Vous pouvez demander sa réouverture.',
              'The form is closed or past its deadline. You can request reopening.',
            )}
          </p>
        )}
        {!own && (
          <p className="notice-inline">
            {t(
              'Cette réponse appartient à l’autre responsable. Signalez une correction sans la remplacer.',
              'This response belongs to the other guardian. Flag a correction without replacing it.',
            )}
          </p>
        )}
        <button className="text-button" onClick={() => setCorrection(true)}>
          {locked
            ? t('Demander la réouverture', 'Request reopening')
            : t('Signaler une correction ou un désaccord', 'Flag a correction or disagreement')}
        </button>
      </Card>
      {correction && (
        <Modal
          title={t('Demande de correction', 'Correction request')}
          onClose={() => setCorrection(false)}
        >
          <Field label={t('Expliquez votre demande', 'Explain your request')}>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} />
          </Field>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) => flag(s, a.id, e.id, childId, note));
                setCorrection(false);
              } catch {}
            }}
          >
            {t('Transmettre à l’équipe', 'Send to the team')}
          </button>
        </Modal>
      )}
    </>
  );
}
function AnswerView({ e, answers }: { e: Pick<Entry, 'fields'>; answers: Answers }) {
  const { locale, t } = useApp();
  return (
    <dl>
      {Object.entries(answers).map(([id, value]) => {
        const f = e.fields.find((f) => f.id === id);
        if (!f)
          return (
            <div key={id} className="padded">
              <dt className="muted">Libellé d’origine indisponible</dt>
              <dd>{Array.isArray(value) ? value.join(', ') : value}</dd>
            </div>
          );
        return (
          <div key={id} className="padded">
            <dt className="muted">{f.label[locale] || f.label.fr}</dt>
            <dd style={{ margin: 0 }}>
              {f.type === 'file' ? (
                <Files ids={[String(value)]} />
              ) : Array.isArray(value) ? (
                value.map((v) => f.options?.[Number(v)]?.[locale] ?? v).join(', ')
              ) : value === 'allowed' ? (
                t('Accord', 'Approved')
              ) : value === 'refused' ? (
                t('Refus', 'Declined')
              ) : (
                (f.options?.[Number(value)]?.[locale] ?? value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
function SubmissionCard({ e, x, staff = false }: { e: Entry; x: Submission; staff?: boolean }) {
  const { s, a, t, locale, run } = useApp();
  const [note, setNote] = useState('');
  return (
    <Card>
      <div className="row between">
        <h3>{x.snapshot.child}</h3>
        <Badge value={x.status} />
      </div>
      <p className="meta">
        {s.adults.find((p) => p.id === x.author)?.name} · {formatDate(x.at, locale, true)} · v
        {x.formVersion}
      </p>
      <AnswerView e={formAtVersion(e, x.formVersion, x.formSnapshot)} answers={x.answers} />
      {x.note && <p className="notice-inline">{x.note}</p>}
      <div className="row">
        <button onClick={() => download('recu-demarche-demo.pdf', submissionPdf(s, a, x, locale))}>
          <Download size={17} />
          {t('Reçu PDF', 'PDF receipt')}
        </button>
        {staff && (
          <>
            <button
              onClick={() =>
                void run((s) => reviewSubmission(s, a.id, x.id, 'reviewed', '')).catch(() => {})
              }
            >
              {t('Marquer vérifié', 'Mark reviewed')}
            </button>
            <button
              onClick={() =>
                void run((s) => reviewSubmission(s, a.id, x.id, 'completed', '')).catch(() => {})
              }
            >
              {t('Terminer', 'Complete')}
            </button>
          </>
        )}
      </div>
      {staff && (
        <div className="padded">
          <Field label={t('Demande de correction', 'Correction request')}>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} />
          </Field>
          <button
            onClick={() =>
              void run((s) => reviewSubmission(s, a.id, x.id, 'needsCorrection', note)).catch(
                () => {},
              )
            }
          >
            {t('Demander une correction', 'Request correction')}
          </button>
        </div>
      )}
    </Card>
  );
}
