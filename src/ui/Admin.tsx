import { useState } from 'react';
import { useApp, roles, services, formatDate } from './context';
import { PageTitle, Card, Field, Badge, Modal, AddButton } from './components';
import { Denied } from './Children';
import { director } from '../domain/policy';
import {
  adminAdult,
  invite,
  moveChild,
  createClass,
  rollover,
  auditView,
  importChildren,
} from '../domain/engine';
import type { Adult, Role, Service, MembershipStatus } from '../domain/types';
import { csv, download } from '../domain/exports';
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('invalidImport');
  row.push(cell.replace(/\r$/, ''));
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function Administration() {
  const { s, a, t, locale, run, toast } = useApp();
  const [tab, setTab] = useState('adults');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Adult>();
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('guardian');
  const [childId, setChild] = useState('');
  const [classId, setClass] = useState(s.classes[0].id);
  const [newClass, setNewClass] = useState('');
  const [roll, setRoll] = useState(false);
  const [invitation, setInvitation] = useState<Adult>();
  if (!director(s, a)) return <Denied />;
  const tabs = [
    ['adults', t('Adultes et accès', 'Adults & access')],
    ['children', t('Enfants et classes', 'Children & classes')],
    ['import', t('Import CSV', 'CSV import')],
    ['year', t('Année scolaire', 'School year')],
    ['audit', t('Journal des actions', 'Audit log')],
  ];
  return (
    <>
      <PageTitle
        title={t('L’école, bien organisée', 'Keeping school organised')}
        subtitle={t(
          'Vérifier les liens, attribuer les rôles, préparer la suite.',
          'Verify links, assign roles and prepare the next school year.',
        )}
        action={
          <AddButton onClick={() => setInviting(true)}>
            {t('Inviter un adulte', 'Invite an adult')}
          </AddButton>
        }
      />
      <div className="filters">
        {tabs.map(([id, label]) => (
          <button className={tab === id ? 'selected' : ''} key={id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ height: 20 }} />
      {tab === 'adults' && (
        <Card>
          <Field label={t('Rechercher un adulte', 'Search adults')}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Profil', 'Persona')}</th>
                  <th>{t('Rôles', 'Roles')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th>{t('Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {s.adults
                  .filter((p) => p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.roles.map((r) => t(...roles[r])).join(' · ')}</td>
                      <td>
                        <Badge value={p.status} />
                      </td>
                      <td>
                        <div className="row">
                          {p.id !== a.id && (
                            <button onClick={() => setEditing(p)}>{t('Gérer', 'Manage')}</button>
                          )}
                          {p.status === 'invited' && (
                            <button onClick={() => setInvitation(p)}>
                              {t('Voir l’invitation', 'View invitation')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === 'children' && (
        <div className="stack">
          <Card>
            <h2>{t('Classes fictives', 'Fictional classes')}</h2>
            <div className="row">
              {s.classes.map((c) => (
                <span key={c.id} className="scope-pill">
                  {c.name} · {s.children.filter((p) => p.classId === c.id).length}
                </span>
              ))}
            </div>
            <div className="toolbar padded">
              <input
                aria-label={t('Nouvelle classe', 'New class')}
                placeholder={t('Nom de la nouvelle classe', 'New class name')}
                value={newClass}
                onChange={(ev) => setNewClass(ev.target.value)}
              />
              <button
                onClick={async () => {
                  try {
                    await run((s) => createClass(s, a.id, newClass));
                    setNewClass('');
                  } catch {}
                }}
              >
                {t('Ajouter', 'Add')}
              </button>
            </div>
          </Card>
          <Card>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Enfant', 'Child')}</th>
                    <th>{t('Classe', 'Class')}</th>
                    <th>{t('Services', 'Services')}</th>
                    <th>{t('Responsables vérifiés', 'Verified guardians')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.children.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>
                        <select
                          aria-label={`${t('Classe de', 'Class for')} ${c.name}`}
                          value={c.classId}
                          onChange={(ev) => {
                            const value = ev.currentTarget.value;
                            void run((s) => moveChild(s, a.id, c.id, value, c.services)).catch(
                              () => {},
                            );
                          }}
                        >
                          {s.classes.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {(Object.keys(services) as Service[]).map((v) => (
                          <label className="check" key={v}>
                            <input
                              type="checkbox"
                              checked={c.services.includes(v)}
                              onChange={(ev) => {
                                const checked = ev.currentTarget.checked;
                                void run((s) =>
                                  moveChild(
                                    s,
                                    a.id,
                                    c.id,
                                    c.classId,
                                    checked
                                      ? [...c.services, v]
                                      : c.services.filter((x) => x !== v),
                                  ),
                                ).catch(() => {});
                              }}
                            />
                            {t(...services[v])}
                          </label>
                        ))}
                      </td>
                      <td>
                        {c.guardians
                          .map((id) => s.adults.find((p) => p.id === id)?.name)
                          .join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {tab === 'import' && <ImportPanel />}
      {tab === 'year' && (
        <Card>
          <h2>{s.year}</h2>
          <p>
            {t(
              'La transition archive les ressources de l’année, met fin aux mandats, retire les affectations enseignantes et remet les consentements à « sans réponse ». Les liens parent-enfant sont conservés.',
              'Rollover archives year resources, ends representative mandates, removes teacher assignments and resets consent to awaiting response. Guardian-child links are retained.',
            )}
          </p>
          <button className="primary" onClick={() => setRoll(true)}>
            {t('Prévisualiser la transition', 'Preview rollover')}
          </button>
          <h3 className="padded">{t('Archives en lecture seule', 'Read-only archives')}</h3>
          {s.archive.map((x) => (
            <p key={x.year}>
              {x.year} · {formatDate(x.at, locale)} · {x.classes.join(', ')}
            </p>
          ))}
        </Card>
      )}
      {tab === 'audit' && (
        <Card>
          <h2>
            {t('Actions administratives et publications', 'Administration and publication actions')}
          </h2>
          <p className="small-print">
            {t(
              'Le contenu privé des messages, les données de santé et les liens entre identité et réponses anonymes sont exclus.',
              'Private message content, health information and anonymous answer identity mappings are excluded.',
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Acteur', 'Actor')}</th>
                  <th>{t('Action', 'Action')}</th>
                  <th>{t('Ressource', 'Resource')}</th>
                </tr>
              </thead>
              <tbody>
                {auditView(s, a)
                  .slice()
                  .reverse()
                  .slice(0, 100)
                  .map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.at, locale, true)}</td>
                      <td>{s.adults.find((p) => p.id === log.actor)?.name}</td>
                      <td>{auditLabel(log.action, locale)}</td>
                      <td>
                        {typeof log.resource === 'string' ? log.resource : log.resource[locale]}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {editing && <AdultEditor target={editing} onClose={() => setEditing(undefined)} />}{' '}
      {inviting && (
        <Modal
          title={t('Préparer une invitation fictive', 'Prepare a fictional invitation')}
          onClose={() => setInviting(false)}
        >
          <Field label={t('Nom fictif', 'Fictional name')}>
            <input value={name} onChange={(ev) => setName(ev.target.value)} />
          </Field>
          <Field label={t('Rôle proposé', 'Proposed role')}>
            <select value={role} onChange={(ev) => setRole(ev.target.value as Role)}>
              {Object.entries(roles).map(([id, label]) => (
                <option key={id} value={id}>
                  {t(...label)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t(
              'Lien à un enfant (vérifié par la direction)',
              'Child link (verified by director)',
            )}
          >
            <select value={childId} onChange={(ev) => setChild(ev.target.value)}>
              <option value="">{t('Aucun', 'None')}</option>
              {s.children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Classe du rôle proposé', 'Class for the proposed role')}>
            <select value={classId} onChange={(ev) => setClass(ev.target.value)}>
              {s.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="notice-inline">
            {t(
              'Aucun e-mail ne sera envoyé. La validation du lien est simulée par votre action de direction.',
              'No email will be sent. Your director action simulates verification of the link.',
            )}
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) => invite(s, a.id, name, role, childId, classId));
                setInviting(false);
              } catch {}
            }}
          >
            {t('Créer l’invitation locale', 'Create local invitation')}
          </button>
        </Modal>
      )}
      {invitation && (
        <Modal
          title={t('Invitation fictive', 'Fictional invitation')}
          onClose={() => setInvitation(undefined)}
        >
          <pre>{`${t('Bienvenue', 'Welcome')} ${invitation.name}\n${t('Rôle', 'Role')}: ${invitation.roles.map((r) => t(...roles[r])).join(', ')}\n${t('Enfants', 'Children')}: ${invitation.children.map((id) => s.children.find((c) => c.id === id)?.name).join(', ')}\n${t('Identifiant fictif, non utilisable pour se connecter', 'Fictional identifier; cannot be used to log in')}: ${invitation.id}`}</pre>
          <div className="row">
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(`DEMO INVITATION\n${invitation.name}\n${invitation.id}`)
                  .then(() =>
                    toast(t('Invitation fictive copiée.', 'Fictional invitation copied.')),
                  )
              }
            >
              {t('Copier', 'Copy')}
            </button>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await run((s) => adminAdult(s, a.id, invitation.id, { status: 'active' }));
                  setInvitation(undefined);
                } catch {}
              }}
            >
              {t('Simuler l’acceptation', 'Simulate acceptance')}
            </button>
          </div>
        </Modal>
      )}
      {roll && (
        <Modal
          title={t('Vérifier la transition d’année', 'Review school-year rollover')}
          onClose={() => setRoll(false)}
        >
          <p>
            {s.classes.length} {t('classes archivées', 'classes archived')} · {s.children.length}{' '}
            {t('profils à revérifier', 'profiles to reconfirm')}
          </p>
          <ul>
            <li>
              {t(
                'Les anciens enseignants perdent leurs accès après retrait des affectations.',
                'Previous teachers lose access when assignments are removed.',
              )}
            </li>
            <li>
              {t(
                'Tous les mandats de représentants prennent fin.',
                'All representative mandates end.',
              )}
            </li>
            <li>
              {t('Les consentements doivent être redemandés.', 'Consent must be requested again.')}
            </li>
            <li>
              {t(
                'Les archives deviennent accessibles en lecture seule selon les droits.',
                'Archives become read-only under the applicable permissions.',
              )}
            </li>
          </ul>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) => rollover(s, a.id));
                setRoll(false);
              } catch {}
            }}
          >
            {t('Confirmer la transition fictive', 'Confirm fictional rollover')}
          </button>
        </Modal>
      )}
    </>
  );
}
function AdultEditor({ target, onClose }: { target: Adult; onClose: () => void }) {
  const { s, a, t, run } = useApp();
  const [p, setP] = useState(target);
  const toggle = (
    key: 'classes' | 'children' | 'representativeClasses' | 'reviewers' | 'services',
    value: string,
    checked: boolean,
  ) =>
    setP((x) => ({
      ...x,
      [key]: checked ? [...x[key], value] : x[key].filter((v) => v !== value),
    }));
  return (
    <Modal title={t('Gérer les accès', 'Manage access') + ` · ${p.name}`} onClose={onClose}>
      <Field label={t('Statut du compte', 'Account status')}>
        <select
          value={p.status}
          onChange={(ev) => setP({ ...p, status: ev.target.value as MembershipStatus })}
        >
          {(['invited', 'active', 'suspended', 'expired', 'revoked'] as MembershipStatus[]).map(
            (v) => (
              <option key={v} value={v}>
                {v === 'active'
                  ? t('Actif', 'Active')
                  : v === 'invited'
                    ? t('Invité', 'Invited')
                    : v === 'suspended'
                      ? t('Suspendu', 'Suspended')
                      : v === 'expired'
                        ? t('Expiré', 'Expired')
                        : t('Révoqué', 'Revoked')}
              </option>
            ),
          )}
        </select>
      </Field>
      {p.roles.includes('guardian') && (
        <Field label={t('Enfants vérifiés', 'Verified child links')}>
          <div className="checks">
            {s.children.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={p.children.includes(c.id)}
                  onChange={(ev) => toggle('children', c.id, ev.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      {p.roles.includes('teacher') && (
        <Field label={t('Classes attribuées', 'Assigned classes')}>
          <div className="checks">
            {s.classes.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={p.classes.includes(c.id)}
                  onChange={(ev) => toggle('classes', c.id, ev.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      {p.roles.includes('guardian') && (
        <>
          <Field label={t('Mandats de représentant', 'Representative mandates')}>
            <div className="checks">
              {s.classes.map((c) => (
                <label key={c.id} className="check">
                  <input
                    type="checkbox"
                    checked={p.representativeClasses.includes(c.id)}
                    onChange={(ev) => toggle('representativeClasses', c.id, ev.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label={t('Fin du mandat', 'Mandate end')}>
            <input
              type="date"
              value={p.mandateEnd}
              onChange={(ev) => setP({ ...p, mandateEnd: ev.target.value })}
            />
          </Field>
        </>
      )}
      {p.roles.includes('service') && (
        <Field label={t('Services attribués', 'Assigned services')}>
          <div className="checks">
            {Object.entries(services).map(([v, label]) => (
              <label key={v} className="check">
                <input
                  type="checkbox"
                  checked={p.services.includes(v as Service)}
                  onChange={(ev) => toggle('services', v, ev.target.checked)}
                />
                {t(...label)}
              </label>
            ))}
          </div>
        </Field>
      )}
      {!p.roles.includes('guardian') && (
        <Field
          label={t(
            'Vérification confidentielle, enfant par enfant',
            'Confidential reviewer, child by child',
          )}
        >
          <div className="checks">
            {s.children.map((c) => (
              <label className="check" key={c.id}>
                <input
                  type="checkbox"
                  checked={p.reviewers.includes(c.id)}
                  onChange={(ev) => toggle('reviewers', c.id, ev.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </Field>
      )}
      <button
        className="primary"
        onClick={async () => {
          try {
            await run((s) =>
              adminAdult(s, a.id, p.id, {
                status: p.status,
                children: p.children,
                classes: p.classes,
                services: p.services,
                reviewers: p.reviewers,
                representativeClasses: p.representativeClasses,
                mandateEnd: p.mandateEnd,
                roles: p.representativeClasses.length
                  ? [...new Set([...p.roles, 'representative' as Role])]
                  : p.roles.filter((r) => r !== 'representative'),
              }),
            );
            onClose();
          } catch {}
        }}
      >
        {t('Vérifier et appliquer', 'Verify and apply')}
      </button>
    </Modal>
  );
}
function ImportPanel() {
  const { s, a, t, run, toast } = useApp();
  const [text, setText] = useState(
    'name,classId,dob\nÉloi Exemple,ce,2019-04-12\nZoé Exemple,cp,2020-08-23',
  );
  const [mapping, setMapping] = useState({ name: 0, classId: 1, dob: 2 });
  const [preview, setPreview] = useState(false);
  let parsed: string[][] = [];
  let error = '';
  try {
    parsed = parseCsv(text);
  } catch {
    error = t('CSV non valide.', 'Invalid CSV.');
  }
  const rows = parsed.slice(1).map((r) => ({
    name: r[mapping.name] ?? '',
    classId: r[mapping.classId] ?? '',
    dob: r[mapping.dob] ?? '',
  }));
  const valid = (r: (typeof rows)[number]) =>
    r.name.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.dob) &&
    s.classes.some((c) => c.id === r.classId) &&
    !s.children.some((c) => c.name.toLocaleLowerCase() === r.name.toLocaleLowerCase()) &&
    rows.filter((x) => x.name.toLocaleLowerCase() === r.name.toLocaleLowerCase()).length === 1;
  return (
    <Card>
      <h2>{t('Importer des enfants fictifs', 'Import fictional children')}</h2>
      <button
        onClick={() =>
          download(
            'exemple-import.csv',
            csv([
              ['name', 'classId', 'dob'],
              ['Éloi Exemple', 'ce', '2019-04-12'],
            ]),
            'text/csv;charset=utf-8',
          )
        }
      >
        {t('Télécharger un exemple CSV', 'Download sample CSV')}
      </button>
      <Field label={t('Coller le CSV fictif', 'Paste fictional CSV')}>
        <textarea
          rows={6}
          value={text}
          onChange={(ev) => {
            setText(ev.target.value);
            setPreview(false);
          }}
        />
      </Field>
      <Field label={t('Ou ouvrir un CSV local', 'Or open a local CSV')}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            if (f && f.size < 1024 * 1024 && f.name.endsWith('.csv')) {
              setText(await f.text());
              setPreview(false);
            } else toast(t('CSV de moins de 1 Mo uniquement.', 'CSV smaller than 1 MB only.'));
          }}
        />
      </Field>
      <div className="form-grid">
        {(['name', 'classId', 'dob'] as const).map((key) => (
          <Field
            label={
              key === 'name'
                ? t('Colonne nom', 'Name column')
                : key === 'classId'
                  ? t('Colonne classe', 'Class column')
                  : t('Colonne date de naissance', 'Birth date column')
            }
            key={key}
          >
            <select
              value={mapping[key]}
              onChange={(ev) => {
                setMapping({ ...mapping, [key]: Number(ev.target.value) });
                setPreview(false);
              }}
            >
              {parsed[0]?.map((h, i) => (
                <option value={i} key={i}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setPreview(true)}>
        {t('Valider et prévisualiser', 'Validate and preview')}
      </button>
      {preview && (
        <>
          <div className="table-wrap padded">
            <table>
              <thead>
                <tr>
                  <th>{t('Nom', 'Name')}</th>
                  <th>{t('Classe', 'Class')}</th>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Validation', 'Validation')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.classId}</td>
                    <td>{r.dob}</td>
                    <td>
                      {valid(r)
                        ? t('Valide', 'Valid')
                        : t('Erreur ou doublon', 'Error or duplicate')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="primary"
            disabled={!rows.length || rows.some((r) => !valid(r)) || !!error}
            onClick={async () => {
              try {
                await run((s) => importChildren(s, a.id, rows));
                setPreview(false);
                setText('name,classId,dob');
              } catch {}
            }}
          >
            {t('Appliquer l’import local', 'Apply local import')}
          </button>
        </>
      )}
    </Card>
  );
}
function auditLabel(action: string, locale: string) {
  const map: Record<string, [string, string]> = {
    save: ['Enregistrement', 'Save'],
    submit: ['Transmission', 'Submission'],
    review: ['Vérification', 'Review'],
    membership: ['Accès modifiés', 'Access updated'],
    invite: ['Invitation', 'Invitation'],
    consent: ['Consentement modifié', 'Consent updated'],
    profile: ['Profil mis à jour', 'Profile updated'],
    rollover: ['Transition d’année', 'Year rollover'],
    import: ['Import CSV', 'CSV import'],
    class: ['Classe créée', 'Class created'],
    summary: ['Synthèse publiée', 'Summary published'],
    clock: ['Horloge avancée', 'Clock advanced'],
    preferences: ['Préférences modifiées', 'Preferences updated'],
    childMembership: ['Affectation enfant', 'Child assignment'],
    attachment: ['Fichier local', 'Local attachment'],
    reviewTask: ['Tâche vérifiée', 'Task reviewed'],
    request: ['Demande transmise', 'Request submitted'],
    requestStatus: ['Demande traitée', 'Request handled'],
    published: ['Publication', 'Publication'],
    closed: ['Clôture', 'Closed'],
    archived: ['Archivage', 'Archived'],
    opened: ['Consultation', 'Opened'],
    acknowledge: ['Accusé de lecture', 'Read acknowledgement'],
  };
  return (
    map[action]?.[locale === 'fr' ? 0 : 1] ?? (locale === 'fr' ? 'Action locale' : 'Local action')
  );
}
