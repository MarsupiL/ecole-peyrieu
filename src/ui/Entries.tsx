import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Edit, MessageCircle } from 'lucide-react';
import { useApp, formatDate, kindNames } from './context';
import {
  PageTitle,
  Card,
  EntryCard,
  AddButton,
  Empty,
  Files,
  Photo,
  Badge,
  AudienceLabel,
  Field,
} from './components';
import { canRead, visibleEntries, canManage, canAuthor, guardian } from '../domain/policy';
import { markRead, evaluateReview, setEntryStatus } from '../domain/engine';
import { download, makePdf } from '../domain/exports';
import { type Kind, type Entry } from '../domain/types';
import { Editor, entryDefault } from './Editor';
import { Denied } from './Children';
import { FormDetail } from './Forms';
import { Compose, ConversationDetail, RequestDetail } from './Communication';
import { PollDetail } from './Polls';
import { EventDetail } from './Calendar';
export function Entries({ kind }: { kind: 'post' | 'evaluation' }) {
  const { s, a, t, locale } = useApp();
  const [edit, setEdit] = useState(false);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');
  const [child, setChild] = useState('all');
  const entries = visibleEntries(s, a, kind)
    .filter(
      (e) =>
        e.title[locale].toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
        (subject === 'all' || e.subject === subject) &&
        (child === 'all' || e.childId === child),
    )
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const kids = s.children.filter((c) =>
    visibleEntries(s, a, 'evaluation').some((e) => e.childId === c.id),
  );
  return (
    <>
      <PageTitle
        title={
          kind === 'post'
            ? t('La vie de l’école', 'School life')
            : t('Les petits pas, les grands progrès', 'Small steps, growing confidence')
        }
        subtitle={
          kind === 'post'
            ? t('Les nouvelles de vos classes et de l’école.', 'News from your classes and school.')
            : t(
                'Un carnet personnel, partagé avec les responsables autorisés.',
                'A personal timeline, shared with authorised guardians.',
              )
        }
        action={
          canAuthor(
            s,
            a,
            kind,
            entryDefault(s, a, kind).audience,
            entryDefault(s, a, kind).childId,
          ) && (
            <AddButton onClick={() => setEdit(true)}>
              {kind === 'post'
                ? t('Nouvelle publication', 'New announcement')
                : t('Ajouter une observation', 'Add progress update')}
            </AddButton>
          )
        }
      />
      <div className="toolbar">
        <input
          aria-label={t('Rechercher', 'Search')}
          placeholder={t('Rechercher…', 'Search…')}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
        />
        {kind === 'evaluation' && (
          <>
            <select
              aria-label={t('Filtrer par enfant', 'Filter by child')}
              value={child}
              onChange={(ev) => setChild(ev.target.value)}
            >
              <option value="all">
                {t('Tous les enfants autorisés', 'All authorised children')}
              </option>
              {kids.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Domaine', 'Subject')}
              value={subject}
              onChange={(ev) => setSubject(ev.target.value)}
            >
              <option value="all">{t('Tous les domaines', 'All subjects')}</option>
              <option value="reading">{t('Lecture', 'Reading')}</option>
              <option value="maths">{t('Mathématiques', 'Mathematics')}</option>
              <option value="science">{t('Sciences', 'Science')}</option>
              <option value="classwork">{t('Travail de classe', 'Classwork')}</option>
            </select>
          </>
        )}
      </div>
      <div className="grid">
        {entries.map((e) => (
          <EntryCard e={e} key={e.id} />
        ))}
      </div>
      {!entries.length && <Empty />}
      {edit && <Editor kind={kind} onClose={() => setEdit(false)} />}
    </>
  );
}
export function EntryDetail({ id, kind }: { id: string; kind: Kind }) {
  const { s, a, t, locale, run, go, open } = useApp();
  const e = s.entries.find((e) => e.id === id && e.kind === kind);
  const [edit, setEdit] = useState(false);
  const [compose, setCompose] = useState(false);
  const allowed = e && canRead(s, a, e);
  useEffect(() => {
    if (
      allowed &&
      e &&
      ['evaluation', 'conversation'].includes(e.kind) &&
      (!e.reads[a.id] ||
        s.notices.some((n) => n.resourceId === e.id && n.actor === a.id && !n.read))
    )
      void run((s) => markRead(s, a.id, id)).catch(() => {});
  }, [id, a.id, allowed]);
  if (!allowed || !e) return <Denied />;
  const canEdit =
    canManage(s, a, e) &&
    canAuthor(s, a, e.kind, e.audience, e.childId) &&
    !['conversation', 'request'].includes(kind);
  const linked = e.link ? s.entries.find((x) => x.id === e.link && canRead(s, a, x)) : undefined;
  const back: Record<Kind, string> = {
    post: 'news',
    form: 'forms',
    evaluation: 'progress',
    poll: 'surveys',
    event: 'calendar',
    topic: 'representatives',
    conversation: 'messages',
    request: 'requests',
  };
  return (
    <>
      <button className="text-button back-button" onClick={() => go(back[kind])}>
        <ArrowLeft size={16} />
        {t(...kindNames[kind])}
      </button>
      <PageTitle
        title={e.title[locale] || e.title.fr}
        subtitle={`${s.adults.find((p) => p.id === e.author)?.name} · ${formatDate(e.updated, locale, true)} · v${e.version}`}
        action={
          canEdit && (
            <button className="secondary" onClick={() => setEdit(true)}>
              <Edit size={17} />
              {t('Modifier', 'Edit')}
            </button>
          )
        }
      />
      <Card>
        <div className="row between">
          <span className="scope-pill">
            <AudienceLabel e={e} />
          </span>
          <Badge value={e.status} />
        </div>
        <p className="detail-body padded">{e.body[locale] || e.body.fr}</p>
        {!e.body[locale] && (
          <small>
            {t(
              'Texte original, traduction non fournie.',
              'Original text; no translation supplied.',
            )}
          </small>
        )}
        <Photo e={e} />
        {kind === 'event' && canManage(s, a, e) && e.status !== 'cancelled' && (
          <button
            className="danger"
            onClick={() =>
              void run((s) => setEntryStatus(s, a.id, e.id, 'cancelled')).catch(() => {})
            }
          >
            {t('Annuler cet événement', 'Cancel this event')}
          </button>
        )}
        <Files ids={e.attachments} />
        {linked && (
          <button className="secondary" onClick={() => open(linked)}>
            {linked.title[locale] || linked.title.fr}
          </button>
        )}
        {canEdit && (
          <button
            className="text-button"
            onClick={() =>
              void run((s) => setEntryStatus(s, a.id, e.id, 'archived')).catch(() => {})
            }
          >
            {t('Archiver en lecture seule', 'Archive read-only')}
          </button>
        )}
        {['post', 'evaluation'].includes(kind) && a.id !== e.author && (
          <button className="text-button" onClick={() => setCompose(true)}>
            <MessageCircle size={17} />
            {t('Répondre en privé', 'Reply privately')}
          </button>
        )}
      </Card>
      <div style={{ height: 22 }} />
      {kind === 'form' && <FormDetail e={e} />}{' '}
      {kind === 'conversation' || kind === 'topic' ? <ConversationDetail e={e} /> : null}
      {kind === 'request' && <RequestDetail e={e} />} {kind === 'poll' && <PollDetail e={e} />}{' '}
      {kind === 'event' && <EventDetail e={e} />}{' '}
      {kind === 'evaluation' && <EvaluationDetail e={e} />}{' '}
      {edit && <Editor kind={kind} initial={e} onClose={() => setEdit(false)} />}{' '}
      {compose && <Compose linked={e} onClose={() => setCompose(false)} />}
    </>
  );
}
function EvaluationDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const c = s.children.find((c) => c.id === e.childId)!;
  const own = guardian(s, a, c);
  const [note, setNote] = useState('');
  return (
    <Card>
      <h2>
        {c.name} · {t('Carnet de progrès', 'Progress timeline')}
      </h2>
      {own && e.requireAck && e.status === 'published' && (
        <>
          <p>
            {t(
              'L’ouverture et l’accusé de lecture sont suivis séparément. Accuser lecture ne signifie pas approuver l’évaluation.',
              'Opening and acknowledging are tracked separately. Acknowledging does not mean agreeing with the evaluation.',
            )}
          </p>
          <p>
            <Badge value={e.acknowledgements[a.id] ? 'completed' : 'pending'} />
          </p>
          <button
            className="primary"
            onClick={() => void run((s) => markRead(s, a.id, e.id, true)).catch(() => {})}
          >
            {t('Je confirme avoir pris connaissance', 'I acknowledge reading this')}
          </button>
        </>
      )}
      {canManage(s, a, e) && (
        <>
          <h3>{t('Suivi individuel', 'Individual reading status')}</h3>
          {c.guardians.map((g) => (
            <p key={g}>
              {s.adults.find((p) => p.id === g)?.name} ·{' '}
              {e.reads[g] ? t('Ouvert', 'Opened') : t('Non ouvert', 'Not opened')} ·{' '}
              {e.acknowledgements[g]
                ? t('Lecture confirmée', 'Acknowledged')
                : t('Sans confirmation', 'Not acknowledged')}
            </p>
          ))}
          <div className="divider" />
          <h3>{t('Revue facultative de la direction', 'Optional director review')}</h3>
          <Badge value={e.review ?? 'none'} />
          {e.reviewNote && <p>{e.reviewNote}</p>}
          <Field label={t('Note de revue', 'Review note')}>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} />
          </Field>
          <div className="row">
            {e.author === a.id && (
              <button
                onClick={() =>
                  void run((s) => evaluateReview(s, a.id, e.id, 'requested', note)).catch(() => {})
                }
              >
                {t('Demander une revue', 'Request review')}
              </button>
            )}
            {a.roles.includes('director') && (
              <>
                <button
                  onClick={() =>
                    void run((s) => evaluateReview(s, a.id, e.id, 'approved', note)).catch(() => {})
                  }
                >
                  {t('Approuver', 'Approve')}
                </button>
                <button
                  onClick={() =>
                    void run((s) => evaluateReview(s, a.id, e.id, 'returned', note)).catch(() => {})
                  }
                >
                  {t('Retourner à l’auteur', 'Return to author')}
                </button>
              </>
            )}
            {e.status === 'draft' && (
              <button
                className="primary"
                onClick={() =>
                  void run((s) => setEntryStatus(s, a.id, e.id, 'published')).catch(() => {})
                }
              >
                {t('Publier directement', 'Publish directly')}
              </button>
            )}
          </div>
        </>
      )}
      <div className="divider" />
      <button
        onClick={() =>
          download(
            'observation-demo.pdf',
            makePdf(
              e.title[locale] || e.title.fr,
              [
                c.name,
                e.body[locale] || e.body.fr,
                `${formatDate(e.updated, locale, true)} · v${e.version}`,
              ],
              locale,
            ),
          )
        }
      >
        <Download size={17} />
        {t('Copie PDF', 'PDF copy')}
      </button>
      {e.history.length > 0 && (
        <details>
          <summary>{t('Versions précédentes', 'Previous versions')}</summary>
          {e.history.map((h, i) => (
            <div className="mini-card" key={i}>
              <strong>
                v{i + 1} · {formatDate(h.at, locale, true)}
              </strong>
              <p>{h.body[locale] || h.body.fr}</p>
            </div>
          ))}
        </details>
      )}
    </Card>
  );
}
