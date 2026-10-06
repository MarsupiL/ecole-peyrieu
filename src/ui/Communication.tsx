import { parisInput, parisInstant } from '../domain/schoolTime';
import { useState } from 'react';
import { Send, Shield, Flag } from 'lucide-react';
import { useApp, formatDate, services, roles } from './context';
import {
  Card,
  PageTitle,
  EntryCard,
  Field,
  Empty,
  Modal,
  Files,
  Upload,
  Badge,
  AddButton,
} from './components';
import {
  visibleEntries,
  canContact,
  guardianChildren,
  represents,
  canManage,
  active,
  teaches,
  director,
} from '../domain/policy';
import {
  createConversation,
  message,
  assign,
  saveDraft,
  moderate,
  reportMessage,
  setEntryStatus,
  createRequest,
  handleRequest,
} from '../domain/engine';
import { newEntry, tr, type Entry, type Service } from '../domain/types';
import { Editor } from './Editor';
export function Messages() {
  const { s, a, t, locale } = useApp();
  const [compose, setCompose] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const list = visibleEntries(s, a, 'conversation').filter(
    (e) =>
      (filter === 'all' ||
        (filter === 'unassigned' && !e.handler) ||
        (filter === 'mine' && e.handler === a.id) ||
        (filter === 'resolved' && e.status === 'resolved')) &&
      [e.title[locale], e.body[locale], ...e.messages.map((m) => m.text)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageTitle
        title={t('Gardons le contact', 'Let’s stay in touch')}
        subtitle={t(
          'Des échanges privés avec les bonnes personnes.',
          'Private conversations with the right people.',
        )}
        action={
          <AddButton onClick={() => setCompose(true)}>
            {t('Nouveau message', 'New message')}
          </AddButton>
        }
      />
      <div className="toolbar">
        <input
          aria-label={t('Rechercher dans mes messages', 'Search my messages')}
          placeholder={t('Rechercher dans mes messages…', 'Search my messages…')}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
        />
        {a.roles.includes('service') && (
          <select
            aria-label={t('Affectation', 'Assignment')}
            value={filter}
            onChange={(ev) => setFilter(ev.target.value)}
          >
            <option value="all">{t('Toute la boîte', 'All inbox')}</option>
            <option value="unassigned">{t('Non affectés', 'Unassigned')}</option>
            <option value="mine">{t('Mes dossiers', 'Assigned to me')}</option>
            <option value="resolved">{t('Résolus', 'Resolved')}</option>
          </select>
        )}
      </div>
      <p className="notice-inline">
        <Shield size={17} />
        {t(
          'Un autre responsable n’est jamais ajouté automatiquement. Les messages restent dans ce navigateur.',
          'Another guardian is never added automatically. Messages stay in this browser.',
        )}
      </p>
      <div className="grid">
        {list.map((e) => (
          <EntryCard key={e.id} e={e} />
        ))}
      </div>
      {!list.length && <Empty />}
      {compose && <Compose onClose={() => setCompose(false)} />}
    </>
  );
}
export function Compose({
  onClose,
  linked,
  summary = false,
}: {
  onClose: () => void;
  linked?: Entry;
  summary?: boolean;
}) {
  const { s, a, t, locale, run, go } = useApp();
  const contacts = s.adults.filter(
    (p) => canContact(s, a, p) || (linked?.author === p.id && p.id !== a.id && active(s, p)),
  );
  const linkedAuthor = s.adults.find((p) => p.id === linked?.author);
  const [target, setTarget] = useState(
    linkedAuthor?.roles.includes('service')
      ? `team:${linkedAuthor.services[0]}`
      : linked && linked.author !== a.id
        ? linked.author
        : (contacts[0]?.id ?? ''),
  );
  const [joint, setJoint] = useState<string[]>([]);
  const [title, setTitle] = useState(
    linked ? `${t('À propos de', 'About')} ${linked.title[locale] || linked.title.fr}` : '',
  );
  const [text, setText] = useState(s.drafts[`${a.id}:compose:${linked?.id ?? 'new'}`] ?? '');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const teams = [...new Set(guardianChildren(s, a).flatMap((c) => c.services))];
  const others = s.adults.filter(
    (p) => p.id !== a.id && guardianChildren(s, a).some((c) => c.guardians.includes(p.id)),
  );
  return (
    <Modal
      title={
        summary
          ? t('Partager une synthèse relue', 'Share a reviewed summary')
          : t('Nouveau message privé', 'New private message')
      }
      onClose={onClose}
    >
      <Field label={t('Destinataire', 'Recipient')}>
        <select value={target} onChange={(ev) => setTarget(ev.target.value)}>
          {contacts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {t(...roles[p.roles.at(-1)!])}
            </option>
          ))}
          {teams.map((team) => (
            <option key={team} value={`team:${team}`}>
              {t('Équipe', 'Team')} · {t(...services[team])}
            </option>
          ))}
        </select>
      </Field>
      {target.startsWith('team:') && (
        <p className="notice-inline">
          {t('Boîte partagée, visible par :', 'Shared inbox, visible to:')}{' '}
          {s.adults
            .filter(
              (p) =>
                active(s, p) &&
                p.roles.includes('service') &&
                p.services.includes(target.slice(5) as Service),
            )
            .map((p) => p.name)
            .join(', ')}
        </p>
      )}
      {!summary && others.length > 0 && (
        <Field
          label={t(
            'Inclure explicitement un autre responsable',
            'Explicitly include another guardian',
          )}
        >
          <div className="checks">
            {others.map((p) => (
              <label key={p.id} className="check">
                <input
                  type="checkbox"
                  checked={joint.includes(p.id)}
                  onChange={(ev) =>
                    setJoint(
                      ev.target.checked ? [...joint, p.id] : joint.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      <Field label={t('Objet', 'Subject')}>
        <input value={title} onChange={(ev) => setTitle(ev.target.value)} />
      </Field>
      <Field
        label={
          summary
            ? t(
                'Synthèse à partager, sans historique privé',
                'Summary to share, without private history',
              )
            : t('Message', 'Message')
        }
      >
        <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={6} />
      </Field>
      {summary && (
        <>
          <p className="notice-inline">
            {t(
              'Seul ce texte sera partagé avec les participants choisis. Le canal d’origine et ses pièces jointes restent privés.',
              'Only this text will be shared with the selected participants. The original channel and its attachments stay private.',
            )}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(ev) => setReviewed(ev.target.checked)}
            />
            {t(
              'J’ai relu exactement ce qui sera partagé.',
              'I have reviewed exactly what will be shared.',
            )}
          </label>
        </>
      )}
      <p className="small-print">
        {t(
          'Disponibilité d’exemple : semaine, 8 h–18 h. Réponse attendue sous deux jours ouvrés. Aucun suivi d’urgence : utilisez le contact direct habituel de l’école.',
          'Sample availability: weekdays, 8 am–6 pm. Expected reply within two working days. No emergency monitoring: use the school’s usual direct contact.',
        )}
      </p>
      <div className="modal-actions">
        <button
          onClick={() =>
            void run((s) => saveDraft(s, a.id, `compose:${linked?.id ?? 'new'}`, text)).catch(
              () => {},
            )
          }
        >
          {t('Enregistrer le brouillon', 'Save draft')}
        </button>
        <button
          className="primary"
          disabled={busy || (summary && !reviewed)}
          onClick={async () => {
            setBusy(true);
            try {
              await run((s) =>
                createConversation(
                  s,
                  a.id,
                  title,
                  text,
                  target.startsWith('team:') ? joint : [target, ...joint],
                  target.startsWith('team:') ? (target.slice(5) as Service) : undefined,
                  linked?.id,
                ),
              );
              onClose();
              go('messages');
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={16} />
          {t('Envoyer dans la démo', 'Send in demo')}
        </button>
      </div>
    </Modal>
  );
}
export function ConversationDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const [text, setText] = useState(s.drafts[`${a.id}:${e.id}`] ?? '');
  const [files, setFiles] = useState<string[]>([]);
  const [escalate, setEscalate] = useState(false);
  const [report, setReport] = useState<string>();
  const [reason, setReason] = useState('');
  const [remove, setRemove] = useState(false);
  const [joint, setJoint] = useState(false);
  const team = s.adults.filter(
    (p) => active(s, p) && p.roles.includes('service') && !!e.team && p.services.includes(e.team),
  );
  const isRep = e.kind === 'topic' && e.audience.ids.some((c) => represents(s, a, c));
  const members = s.adults.filter(
    (p) => e.participants.includes(p.id) || team.some((x) => x.id === p.id),
  );
  return (
    <div className="stack">
      <Card>
        <p className="notice-inline">
          <Shield size={17} />
          {e.kind === 'topic'
            ? t(
                'Canal des parents de la classe. Aucun accès automatique du personnel.',
                'Class parents’ channel. Staff have no automatic access.',
              )
            : t('Participants :', 'Participants:') + ' ' + members.map((p) => p.name).join(', ')}
        </p>
        {e.team && (
          <>
            <p>
              {t('Équipe partagée', 'Shared team')} · {t(...services[e.team])}
            </p>
            {a.roles.includes('service') && (
              <Field label={t('Personne en charge', 'Assigned handler')}>
                <select
                  value={e.handler ?? ''}
                  onChange={(ev) => {
                    const value = ev.currentTarget.value;
                    void run((s) => assign(s, a.id, e.id, value)).catch(() => {});
                  }}
                >
                  <option value="">{t('Non affecté', 'Unassigned')}</option>
                  {team.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        {e.kind === 'conversation' && (
          <div className="row">
            <button onClick={() => setJoint(true)}>
              {t('Nouvel échange avec une synthèse', 'New conversation with summary')}
            </button>
            {canManage(s, a, e) && (
              <button
                onClick={() =>
                  void run((s) =>
                    setEntryStatus(s, a.id, e.id, e.status === 'resolved' ? 'open' : 'resolved'),
                  ).catch(() => {})
                }
              >
                {e.status === 'resolved'
                  ? t('Réouvrir', 'Reopen')
                  : t('Marquer résolu', 'Mark resolved')}
              </button>
            )}
          </div>
        )}
        {isRep && (
          <div className="row">
            <button className="secondary" onClick={() => setEscalate(true)}>
              {t('Partager une synthèse avec l’équipe', 'Share a summary with staff')}
            </button>
            <button
              onClick={() =>
                void run((s) =>
                  setEntryStatus(s, a.id, e.id, e.status === 'closed' ? 'open' : 'closed'),
                ).catch(() => {})
              }
            >
              {e.status === 'closed'
                ? t('Réouvrir le sujet', 'Reopen topic')
                : t('Clore le sujet', 'Close topic')}
            </button>
          </div>
        )}
      </Card>
      <Card>
        <h2>{t('Échanges', 'Conversation')}</h2>
        {e.messages.map((m) => (
          <div className={`conversation-message ${m.author === a.id ? 'mine' : ''}`} key={m.id}>
            <small>
              {s.adults.find((a) => a.id === m.author)?.name} · {formatDate(m.at, locale, true)}
            </small>
            {m.removed ? (
              <p className="muted">
                {t('Message modéré', 'Moderated message')} · {m.reason}
              </p>
            ) : (
              <>
                <p>{m.text}</p>
                <Files ids={m.files} />
                {e.kind === 'topic' && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setReport(m.id);
                      setRemove(false);
                    }}
                  >
                    <Flag size={13} />
                    {t('Signaler', 'Report')}
                  </button>
                )}
                {isRep && (
                  <button
                    className="text-button danger"
                    onClick={() => {
                      setReport(m.id);
                      setRemove(true);
                    }}
                  >
                    {t('Modérer', 'Moderate')}
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {!e.messages.length && (
          <Empty
            text={t(
              'Ouvrez la conversation avec votre premier message.',
              'Start the conversation with your first message.',
            )}
          />
        )}
        <div className="divider" />
        {!['closed', 'resolved', 'archived'].includes(e.status) && (
          <>
            <Field label={t('Votre message', 'Your message')}>
              <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={3} />
            </Field>
            <Upload entry={e} onUpload={(id) => setFiles([...files, id])} />
            <Files ids={files} />
            <div className="row">
              <button
                onClick={() => void run((s) => saveDraft(s, a.id, e.id, text)).catch(() => {})}
              >
                {t('Enregistrer le brouillon', 'Save draft')}
              </button>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await run((s) => message(s, a.id, e.id, text, files));
                    setText('');
                    setFiles([]);
                  } catch {}
                }}
              >
                <Send size={17} />
                {t('Envoyer', 'Send')}
              </button>
            </div>
            <p className="small-print padded">
              {t(
                'Un message peut être lu sans que la demande soit confirmée. Les notifications attendent les heures de disponibilité.',
                'A message can be read without confirming a request. Notifications wait for availability hours.',
              )}
            </p>
          </>
        )}
      </Card>
      {escalate && <Compose linked={e} summary onClose={() => setEscalate(false)} />}{' '}
      {joint && <Compose linked={e} summary onClose={() => setJoint(false)} />}{' '}
      {report && (
        <Modal
          title={
            remove
              ? t('Modérer un message', 'Moderate message')
              : t('Signaler ce contenu', 'Report this content')
          }
          onClose={() => setReport(undefined)}
        >
          <Field label={t('Motif', 'Reason')}>
            <textarea value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) =>
                  remove
                    ? moderate(s, a.id, e.id, report, reason)
                    : reportMessage(s, a.id, e.id, report, reason),
                );
                setReport(undefined);
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
export function Representatives() {
  const { s, a, t } = useApp();
  const [edit, setEdit] = useState(false);
  const list = visibleEntries(s, a, 'topic');
  return (
    <>
      <PageTitle
        title={t('Entre parents, pour la classe', 'Parents, together for the class')}
        subtitle={t(
          'Un canal animé par les délégués de votre classe.',
          'A channel hosted by your class representatives.',
        )}
        action={
          a.representativeClasses.some((id) => represents(s, a, id)) && (
            <AddButton onClick={() => setEdit(true)}>
              {t('Ouvrir un sujet', 'Start a topic')}
            </AddButton>
          )
        }
      />
      <div className="grid">
        {list.map((e) => (
          <EntryCard key={e.id} e={e} />
        ))}
      </div>
      {!list.length && (
        <Empty
          text={t(
            'Aucun canal autorisé pour ce profil. Les équipes n’accèdent pas automatiquement aux discussions entre parents.',
            'No authorised channel for this persona. Staff do not automatically access parent discussions.',
          )}
        />
      )}{' '}
      {edit && <Editor kind="topic" onClose={() => setEdit(false)} />}
    </>
  );
}
export function Requests() {
  const { s, a, t } = useApp();
  const [create, setCreate] = useState(false);
  const list = visibleEntries(s, a, 'request');
  return (
    <>
      <PageTitle
        title={t('Absences et départs', 'Absence & collection')}
        subtitle={t(
          'Une demande transmise n’est pas encore confirmée.',
          'A submitted request is not yet confirmed.',
        )}
        action={
          guardianChildren(s, a).length > 0 && (
            <AddButton onClick={() => setCreate(true)}>
              {t('Nouvelle demande', 'New request')}
            </AddButton>
          )
        }
      />
      <p className="notice-inline warning">
        {t(
          'Un signalement d’absence ne modifie ni les réservations ni les frais. Pour une urgence, contactez directement l’équipe par votre canal habituel.',
          'Reporting an absence does not change bookings or charges. For urgent matters, contact staff through your usual direct channel.',
        )}
      </p>
      <div className="grid">
        {list.map((e) => (
          <EntryCard key={e.id} e={e} />
        ))}
      </div>
      {!list.length && <Empty />}
      {create && <RequestEditor onClose={() => setCreate(false)} />}
    </>
  );
}
function RequestEditor({ onClose }: { onClose: () => void }) {
  const { s, a, t, run } = useApp();
  const kids = guardianChildren(s, a);
  const [childId, setChild] = useState(kids[0]?.id ?? '');
  const [type, setType] = useState<'absence' | 'collection'>('absence');
  const [teams, setTeams] = useState<string[]>(['school']);
  const [start, setStart] = useState(parisInput(s.clock));
  const [end, setEnd] = useState(
    parisInput(new Date(Date.parse(s.clock) + 7 * 3600000).toISOString()),
  );
  const [note, setNote] = useState('');
  const [collector, setCollector] = useState('');
  const c = kids.find((c) => c.id === childId);
  return (
    <Modal title={t('Nouvelle demande', 'New request')} onClose={onClose}>
      <div className="form-grid">
        <Field label={t('Enfant', 'Child')}>
          <select
            value={childId}
            onChange={(ev) => {
              setChild(ev.target.value);
              setTeams(['school']);
            }}
          >
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('Type de demande', 'Request type')}>
          <select value={type} onChange={(ev) => setType(ev.target.value as typeof type)}>
            <option value="absence">{t('Absence', 'Absence')}</option>
            <option value="collection">{t('Départ exceptionnel', 'Collection change')}</option>
          </select>
        </Field>
        <Field label={t('Début (heure de Paris)', 'Start (Paris time)')}>
          <input type="datetime-local" value={start} onChange={(ev) => setStart(ev.target.value)} />
        </Field>
        <Field label={t('Fin (heure de Paris)', 'End (Paris time)')}>
          <input type="datetime-local" value={end} onChange={(ev) => setEnd(ev.target.value)} />
        </Field>
      </div>
      <Field label={t('Équipes destinataires', 'Recipient teams')}>
        <div className="checks">
          {['school', ...(c?.services ?? [])].map((v) => (
            <label className="check" key={v}>
              <input
                type="checkbox"
                checked={teams.includes(v)}
                onChange={(ev) =>
                  setTeams(ev.target.checked ? [...teams, v] : teams.filter((x) => x !== v))
                }
              />
              {v === 'school' ? t('École', 'School') : t(...services[v])}
            </label>
          ))}
        </div>
      </Field>
      {type === 'collection' && (
        <Field label={t('Personne et modalités proposées', 'Proposed collector and arrangements')}>
          <textarea value={collector} onChange={(ev) => setCollector(ev.target.value)} />
        </Field>
      )}
      <Field
        label={t(
          'Note facultative (aucun diagnostic demandé)',
          'Optional note (no diagnosis required)',
        )}
      >
        <textarea value={note} onChange={(ev) => setNote(ev.target.value)} />
      </Field>
      <button
        className="primary"
        onClick={async () => {
          const e = newEntry('request', a.id, s.year, s.clock);
          Object.assign(e, {
            childId,
            requestType: type,
            teams,
            start: parisInstant(start),
            end: parisInstant(end),
            requestDetails: collector,
            title: tr(
              `${type === 'absence' ? 'Absence' : 'Départ exceptionnel'} · ${c?.name}`,
              `${type === 'absence' ? 'Absence' : 'Collection change'} · ${c?.name}`,
            ),
            body: tr(note, note),
          });
          try {
            await run((s) => createRequest(s, a.id, e));
            onClose();
          } catch {}
        }}
      >
        {t('Transmettre la demande', 'Submit request')}
      </button>
    </Modal>
  );
}
export function RequestDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const c = s.children.find((c) => c.id === e.childId);
  return (
    <Card>
      <h2>{c?.name}</h2>
      <p>
        {formatDate(e.start, locale, true)} – {formatDate(e.end, locale, true)} · Europe/Paris
      </p>
      {e.requestDetails && <p>{e.requestDetails}</p>}
      <Badge value={e.status} />
      <div className="divider" />
      {e.teams.map((team) => {
        const authorised =
          c &&
          (team === 'school'
            ? teaches(s, a, c) || director(s, a)
            : a.roles.includes('service') && a.services.includes(team as Service));
        return (
          <div className="mini-card" key={team}>
            <div className="row between">
              <strong>{team === 'school' ? t('École', 'School') : t(...services[team])}</strong>
              <Badge value={e.teamAcks[team] ? 'reviewed' : 'pending'} />
            </div>
            {e.teamAcks[team] && (
              <p className="meta">
                {s.adults.find((p) => p.id === e.teamAcks[team].actor)?.name} ·{' '}
                {formatDate(e.teamAcks[team].at, locale, true)}
              </p>
            )}
            {authorised && (
              <div className="row padded">
                <button
                  className="primary"
                  onClick={() =>
                    void run((s) =>
                      handleRequest(
                        s,
                        a.id,
                        e.id,
                        team,
                        e.requestType === 'absence' ? 'completed' : 'confirmed',
                      ),
                    ).catch(() => {})
                  }
                >
                  {e.requestType === 'absence'
                    ? t('Accuser réception pour cette équipe', 'Acknowledge for this team')
                    : t('Confirmer le départ', 'Confirm collection')}
                </button>
                {e.requestType === 'collection' && (
                  <>
                    <button
                      onClick={() =>
                        void run((s) => handleRequest(s, a.id, e.id, team, 'declined')).catch(
                          () => {},
                        )
                      }
                    >
                      {t('Refuser', 'Decline')}
                    </button>
                    <button
                      onClick={() =>
                        void run((s) => handleRequest(s, a.id, e.id, team, 'completed')).catch(
                          () => {},
                        )
                      }
                    >
                      {t('Marquer effectué', 'Mark completed')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {e.author === a.id && (
        <div className="row">
          <button
            onClick={() =>
              void run((s) => handleRequest(s, a.id, e.id, '', 'cancelled')).catch(() => {})
            }
          >
            {t('Retirer la demande', 'Withdraw request')}
          </button>
          <button
            onClick={() =>
              void run((s) => handleRequest(s, a.id, e.id, '', 'pending')).catch(() => {})
            }
          >
            {t('Demander une nouvelle vérification', 'Request a new review')}
          </button>
        </div>
      )}
      <p className="small-print padded">
        {t(
          'La lecture seule ne confirme pas un départ. Les réservations de services restent inchangées.',
          'Reading alone does not confirm collection. Service bookings remain unchanged.',
        )}
      </p>
    </Card>
  );
}
