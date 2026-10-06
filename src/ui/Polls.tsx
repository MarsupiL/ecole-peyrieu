import { parisInput, parisInstant } from '../domain/schoolTime';
import { useState } from 'react';
import { useApp, formatDate } from './context';
import { PageTitle, Card, Field, EntryCard, AddButton, Empty, Modal, Badge } from './components';
import { visibleEntries, canAuthor, canManage, responseChildren, eligible } from '../domain/policy';
import {
  answerPoll,
  pollResults,
  ownVote,
  publishSummary,
  setEntryStatus,
  flag,
} from '../domain/engine';
import { download, csv } from '../domain/exports';
import type { Entry } from '../domain/types';
import { Editor, entryDefault } from './Editor';
export function Polls() {
  const { s, a, t } = useApp();
  const [edit, setEdit] = useState(false);
  const list = visibleEntries(s, a, 'poll');
  return (
    <>
      <PageTitle
        title={t('Votre avis fait avancer les choses', 'Your voice helps shape school life')}
        subtitle={t('Consultations et votes informels.', 'Surveys and informal votes.')}
        action={
          canAuthor(s, a, 'poll', entryDefault(s, a, 'poll').audience) && (
            <AddButton onClick={() => setEdit(true)}>
              {t('Créer une consultation', 'Create survey')}
            </AddButton>
          )
        }
      />
      <div className="grid">
        {list.map((e) => (
          <EntryCard e={e} key={e.id} />
        ))}
      </div>
      {!list.length && <Empty />}
      {edit && <Editor kind="poll" onClose={() => setEdit(false)} />}
    </>
  );
}
export function PollDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const kids = responseChildren(s, a, e);
  const [childId, setChild] = useState(kids[0]?.id ?? '');
  const manager = canManage(s, a, e);
  const [summary, setSummary] = useState(e.summary ?? '');
  const [preview, setPreview] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(
    parisInput(new Date(Date.parse(s.clock) + 7 * 86400000).toISOString()),
  );
  const results = manager ? pollResults(s, a, e.id) : [];
  return (
    <div className="stack">
      <Card>
        <div className="row">
          <Badge value={e.status} />
          <span>{formatDate(e.deadline, locale, true)}</span>
        </div>
        <p className="padded">
          {e.anonymous
            ? t(
                'Réponses anonymes pour l’organisateur. Les commentaires peuvent vous identifier, surtout dans un petit groupe.',
                'Answers are anonymous to the organiser. Comments can identify you, especially in a small group.',
              )
            : t(
                'Réponses identifiées, visibles par l’organisateur.',
                'Identified responses, visible to the organiser.',
              )}
        </p>
        <p>
          {e.unit === 'adult'
            ? t(
                'Une réponse par adulte, même avec plusieurs enfants.',
                'One response per adult, even with several children.',
              )
            : t(
                'Une réponse par enfant, partagée entre ses responsables. L’autre responsable peut voir la réponse, même en mode anonyme pour l’organisateur.',
                'One shared response per child. The other guardian can see it, even when anonymous to the organiser.',
              )}
        </p>
        <small>
          {e.summaryPlanned
            ? t('Une synthèse relue sera publiée.', 'A reviewed summary will be published.')
            : t('Aucune synthèse prévue.', 'No summary is planned.')}{' '}
          {t('Il ne s’agit pas d’une élection officielle.', 'This is not an official election.')}
        </small>
      </Card>
      {eligible(s, e).some((p) => p.id === a.id) && (
        <>
          <Field label={t('Enfant concerné', 'Child')}>
            <select value={childId} onChange={(ev) => setChild(ev.target.value)}>
              {kids.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <PollAnswer
            key={e.unit === 'adult' ? e.id : `${e.id}:${childId}`}
            e={e}
            childId={childId}
          />
        </>
      )}
      {e.summary && (
        <Card>
          <h2>{t('Synthèse publiée', 'Published summary')}</h2>
          <p className="detail-body">{e.summary}</p>
        </Card>
      )}
      {manager && (
        <Card>
          <h2>{t('Résultats de la consultation', 'Survey results')}</h2>
          <p>
            {results.length} {t('réponses', 'responses')}
          </p>
          {e.options.map((o, i) => {
            const count = results.filter((v) => v.answers.includes(String(i))).length;
            return (
              <div key={i}>
                <div className="row between">
                  <span>{o[locale] || o.fr}</span>
                  <strong>{count}</strong>
                </div>
                <div className="progress-bar">
                  <span
                    style={{ width: `${results.length ? (count / results.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
          <h3>{t('Commentaires réservés à l’organisateur', 'Comments for the organiser only')}</h3>
          {results
            .filter((v) => v.comment)
            .map((v, i) => (
              <p key={i} className="notice-inline">
                {v.comment}
              </p>
            ))}
          <div className="row">
            <button
              onClick={() =>
                download(
                  'resultats-consultation.csv',
                  csv([
                    [
                      t('Réponses', 'Answers'),
                      t('Commentaire', 'Comment'),
                      ...(e.anonymous ? [] : [t('Répondant', 'Respondent')]),
                    ],
                    ...results.map((v) => [
                      v.answers.map((i) => e.options[Number(i)]?.[locale]).join(' / '),
                      v.comment,
                      ...(e.anonymous ? [] : [v.respondent ?? '']),
                    ]),
                  ]),
                  'text/csv;charset=utf-8',
                )
              }
            >
              {t('Exporter les résultats', 'Export results')}
            </button>
            <button
              onClick={() =>
                e.status === 'closed'
                  ? setReopen(true)
                  : void run((s) => setEntryStatus(s, a.id, e.id, 'closed')).catch(() => {})
              }
            >
              {e.status === 'closed' ? t('Réouvrir', 'Reopen') : t('Clore', 'Close')}
            </button>
          </div>
          <div className="divider" />
          <Field
            label={t('Synthèse à publier', 'Summary to publish')}
            hint={t(
              'Les commentaires ne sont pas publiés automatiquement. Évitez toute citation permettant d’identifier quelqu’un.',
              'Comments are not published automatically. Avoid quotations that could identify someone.',
            )}
          >
            <textarea value={summary} onChange={(ev) => setSummary(ev.target.value)} rows={5} />
          </Field>
          <button className="primary" onClick={() => setPreview(true)}>
            {t('Relire avant publication', 'Review before publishing')}
          </button>
        </Card>
      )}
      {preview && (
        <Modal
          title={t('Voici ce qui sera publié', 'This is what will be published')}
          onClose={() => setPreview(false)}
        >
          <p className="detail-body">{summary}</p>
          <p className="notice-inline warning">
            {t(
              'Vérifiez qu’aucune citation ne révèle d’information personnelle.',
              'Check that no quotation reveals personal information.',
            )}
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) => publishSummary(s, a.id, e.id, summary));
                setPreview(false);
              } catch {}
            }}
          >
            {t('Publier la synthèse', 'Publish summary')}
          </button>
        </Modal>
      )}
      {reopen && (
        <Modal title={t('Réouvrir', 'Reopen')} onClose={() => setReopen(false)}>
          <Field label={t('Motif', 'Reason')}>
            <textarea value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
          <Field label={t('Échéance (heure de Paris)', 'Deadline (Paris time)')}>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(ev) => setDeadline(ev.target.value)}
            />
          </Field>
          <button
            onClick={async () => {
              try {
                await run((s) =>
                  setEntryStatus(s, a.id, e.id, 'open', reason, parisInstant(deadline)),
                );
                setReopen(false);
              } catch {}
            }}
          >
            {t('Confirmer', 'Confirm')}
          </button>
        </Modal>
      )}
    </div>
  );
}
function PollAnswer({ e, childId }: { e: Entry; childId: string }) {
  const { s, a, t, locale, run } = useApp();
  const existing = ownVote(s, a, e, childId);
  const [answers, setAnswers] = useState<string[]>(existing?.vote?.answers ?? []);
  const [comment, setComment] = useState(existing?.vote?.comment ?? '');
  const [note, setNote] = useState('');
  const locked =
    e.status !== 'open' ||
    (!!e.deadline && e.deadline < s.clock) ||
    (!!existing && existing.owner !== a.id);
  return (
    <Card>
      <h2>
        {existing
          ? t('Votre réponse', 'Your response')
          : t('À vous de choisir', 'Make your choice')}
      </h2>
      {e.options.map((o, i) => (
        <label key={i} className="choice-row">
          <input
            type={e.pollType === 'multi' ? 'checkbox' : 'radio'}
            name={`poll-${e.id}`}
            checked={answers.includes(String(i))}
            disabled={locked}
            onChange={(ev) =>
              setAnswers(
                e.pollType === 'multi'
                  ? ev.target.checked
                    ? [...answers, String(i)]
                    : answers.filter((v) => v !== String(i))
                  : [String(i)],
              )
            }
          />
          {o[locale] || o.fr}
        </label>
      ))}
      <Field label={t('Commentaire facultatif', 'Optional comment')}>
        <textarea
          value={comment}
          disabled={locked}
          onChange={(ev) => setComment(ev.target.value)}
        />
      </Field>
      {!locked && (
        <button
          className="primary"
          onClick={() =>
            void run((s) => answerPoll(s, a.id, e.id, childId, answers, comment)).catch(() => {})
          }
        >
          {existing
            ? t('Modifier ma réponse', 'Update my response')
            : t('Envoyer ma réponse', 'Submit my response')}
        </button>
      )}
      {locked && (
        <p className="notice-inline">
          {t(
            'Réponse non modifiable : consultation fermée ou réponse d’un autre responsable.',
            'Editing unavailable: the survey is closed or another guardian owns the response.',
          )}
        </p>
      )}
      <div className="divider" />
      <Field
        label={t('Demander une correction ou une réouverture', 'Request a correction or reopening')}
      >
        <textarea value={note} onChange={(ev) => setNote(ev.target.value)} />
      </Field>
      <button onClick={() => void run((s) => flag(s, a.id, e.id, childId, note)).catch(() => {})}>
        {t('Signaler à l’organisateur', 'Flag for the organiser')}
      </button>
    </Card>
  );
}
