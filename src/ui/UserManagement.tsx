import { ProfileAvatar, ProfilePhotoEditor } from './ProfilePhoto';
import { useState, type ReactNode } from 'react';
import { useApp, roles, services, formatDate } from './context';
import { Card, Field, Badge, Modal, AddButton } from './components';
import {
  active,
  director,
  currentChild,
  currentClass,
  teaches,
  managedClasses,
  guardianChildren,
  mandateEndFor,
} from '../domain/policy';
import {
  adminAdult,
  removeAdult,
  createChild,
  editChild,
  moveChild,
  removeFromClass,
  archiveChild,
  restoreChild,
  createClass,
  setRepresentative,
} from '../domain/engine';
import type { Adult, Child, Role, Service, MembershipStatus } from '../domain/types';

function SaveButton({
  children,
  onSave,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onSave: () => Promise<void>;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <button
      className={danger ? 'danger' : 'primary'}
      disabled={saving || disabled}
      onClick={async () => {
        if (saving) return;
        setSaving(true);
        try {
          await onSave();
        } catch {
        } finally {
          setSaving(false);
        }
      }}
    >
      {saving ? 'Enregistrement…' : children}
    </button>
  );
}
function Checks({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="admin-checks">
      <legend>{label}</legend>
      <div className="checks">
        {options.map((item) => (
          <label className="check" key={item.id}>
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(ev) =>
                onChange(
                  ev.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id),
                )
              }
            />
            {item.name}
          </label>
        ))}
        {!options.length && <p className="small-print">Aucun choix disponible.</p>}
      </div>
    </fieldset>
  );
}
const serviceOptions = Object.entries(services).map(([id, label]) => ({ id, name: label[0] }));
const roleOptions = Object.entries(roles)
  .filter(([id]) => id !== 'representative')
  .map(([id, label]) => ({ id, name: label[0] }));

export function AdultsPanel({
  onEdit,
  onInvitation,
}: {
  onEdit: (p: Adult) => void;
  onInvitation: (p: Adult) => void;
}) {
  const { s, a, run } = useApp();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [removing, setRemoving] = useState<Adult>();
  const [reason, setReason] = useState('');
  const list = s.adults.filter(
    (p) =>
      `${p.name} ${p.contact}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (role === 'all' || p.roles.includes(role as Role)) &&
      (status === 'all' || p.status === status),
  );
  return (
    <Card>
      <div className="admin-filters">
        <Field label="Rechercher un adulte">
          <input
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Nom ou contact"
          />
        </Field>
        <Field label="Filtrer par rôle">
          <select value={role} onChange={(ev) => setRole(ev.target.value)}>
            <option value="all">Tous les rôles</option>
            {Object.entries(roles).map(([id, label]) => (
              <option key={id} value={id}>
                {label[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filtrer par statut">
          <select value={status} onChange={(ev) => setStatus(ev.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="invited">Invités</option>
            <option value="suspended">Suspendus</option>
            <option value="expired">Expirés</option>
            <option value="revoked">Retirés / révoqués</option>
          </select>
        </Field>
      </div>
      <p className="small-print">
        {list.length} compte(s) · Retirer un compte révoque ses accès et conserve les messages et
        documents existants.
      </p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Profil</th>
              <th>Rôles et affectations</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td data-label="Profil">
                  <div className="profile-name">
                    <ProfileAvatar target={{ kind: 'adult', id: p.id }} className="mini" />
                    <strong>{p.name}</strong>
                  </div>
                  <small className="admin-subline">{p.contact}</small>
                </td>
                <td data-label="Rôles et affectations">
                  {p.roles.map((r) => roles[r][0]).join(' · ')}
                  <small className="admin-subline">
                    {[
                      ...p.classes.map((id) => s.classes.find((c) => c.id === id)?.name),
                      ...p.services.map((id) => services[id][0]),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </td>
                <td data-label="Statut">
                  <Badge value={p.status} />
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    {p.id === a.id ? (
                      <small>Votre compte · accès protégé</small>
                    ) : (
                      <>
                        <button onClick={() => onEdit(p)}>Gérer</button>
                        {p.status !== 'revoked' && (
                          <button
                            className="danger"
                            onClick={() => {
                              setRemoving(p);
                              setReason('');
                            }}
                          >
                            Retirer
                          </button>
                        )}
                      </>
                    )}
                    {p.status === 'invited' && (
                      <button onClick={() => onInvitation(p)}>Voir l’invitation</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="empty">Aucun compte ne correspond aux filtres.</p>}
      {removing && (
        <Modal
          title={`Retirer le compte · ${removing.name}`}
          onClose={() => setRemoving(undefined)}
        >
          <p>
            Les accès seront révoqués immédiatement. Les dossiers liés, contributions et historiques
            seront conservés. La direction pourra réactiver le compte avec « Gérer ».
          </p>
          <Field label="Motif du retrait">
            <textarea
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              maxLength={500}
            />
          </Field>
          <SaveButton
            danger
            disabled={!reason.trim()}
            onSave={async () => {
              await run((s) => removeAdult(s, a.id, removing.id, reason));
              setRemoving(undefined);
            }}
          >
            Confirmer le retrait du compte
          </SaveButton>
        </Modal>
      )}
    </Card>
  );
}
export function AdultEditor({ target, onClose }: { target: Adult; onClose: () => void }) {
  const { s, a, run } = useApp();
  const [p, setP] = useState(() => structuredClone(target));
  const staff = p.roles.some((r) => ['director', 'teacher', 'service'].includes(r));
  const classes = s.classes.filter((c) => currentClass(s, c.id));
  return (
    <Modal title={`Gérer les accès · ${target.name}`} onClose={onClose}>
      <ProfilePhotoEditor target={{ kind: 'adult', id: target.id }} />
      <div className="form-grid">
        <Field label="Nom de l’adulte">
          <input
            value={p.name}
            maxLength={160}
            onChange={(ev) => setP({ ...p, name: ev.target.value })}
          />
        </Field>
        <Field label="Contact (courriel ou téléphone)">
          <input
            value={p.contact}
            maxLength={250}
            onChange={(ev) => setP({ ...p, contact: ev.target.value })}
          />
        </Field>
      </div>
      <Field label="Statut du compte">
        <select
          value={p.status}
          onChange={(ev) => setP({ ...p, status: ev.target.value as MembershipStatus })}
        >
          <option value="invited">Invité</option>
          <option value="active">Actif</option>
          <option value="suspended">Suspendu</option>
          <option value="expired">Expiré</option>
          <option value="revoked">Révoqué</option>
        </select>
      </Field>
      {target.removalReason && (
        <p className="notice-inline">Motif du retrait : {target.removalReason}</p>
      )}
      <Checks
        label="Rôles du compte"
        options={roleOptions}
        value={p.roles}
        onChange={(ids) =>
          setP({
            ...p,
            roles: ids as Role[],
            reviewers: ids.some((r) => ['director', 'teacher', 'service'].includes(r))
              ? p.reviewers
              : [],
          })
        }
      />
      {p.roles.includes('guardian') && (
        <Checks
          label="Enfants vérifiés"
          options={s.children
            .filter((c) => currentChild(s, c) || p.children.includes(c.id))
            .map((c) => ({ id: c.id, name: c.name + (c.archived ? ' · archivé' : '') }))}
          value={p.children}
          onChange={(children) => setP({ ...p, children })}
        />
      )}
      {p.roles.includes('teacher') && (
        <Checks
          label="Classes attribuées"
          options={classes}
          value={p.classes}
          onChange={(classes) => setP({ ...p, classes })}
        />
      )}
      {p.roles.includes('service') && (
        <Checks
          label="Services attribués"
          options={serviceOptions}
          value={p.services}
          onChange={(services) => setP({ ...p, services: services as Service[] })}
        />
      )}
      {staff && (
        <Checks
          label="Vérification confidentielle, enfant par enfant"
          options={s.children.filter((c) => currentChild(s, c))}
          value={p.reviewers}
          onChange={(reviewers) => setP({ ...p, reviewers })}
        />
      )}
      <p className="small-print">
        Les mandats de parents délégués se gèrent dans leur onglet. Un nouveau lien parent-enfant
        nécessite une vérification par la direction ; aucune autorisation photo n’est accordée
        automatiquement.
      </p>
      <SaveButton
        disabled={!p.name.trim() || !p.roles.length}
        onSave={async () => {
          await run((s) =>
            adminAdult(s, a.id, target.id, {
              name: p.name,
              contact: p.contact,
              status: p.status,
              roles: p.roles,
              children: p.roles.includes('guardian') ? p.children : [],
              classes: p.roles.includes('teacher') ? p.classes : [],
              services: p.roles.includes('service') ? p.services : [],
              reviewers: staff ? p.reviewers : [],
              representativeClasses: p.roles.includes('guardian')
                ? target.representativeClasses.filter((id) =>
                    s.children.some(
                      (c) => currentChild(s, c) && c.classId === id && p.children.includes(c.id),
                    ),
                  )
                : [],
            }),
          );
          onClose();
        }}
      >
        Vérifier et appliquer
      </SaveButton>
    </Modal>
  );
}

type PupilAction = {
  child: Child;
  kind: 'transfer' | 'unassign' | 'archive' | 'restore';
  destination: string;
};
export function PupilsPanel() {
  const { s, a, run, go } = useApp();
  const isDirector = director(s, a);
  const groups = s.classes.filter((c) => currentClass(s, c.id));
  const ownGroups = managedClasses(s, a);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState('active');
  const [newClassName, setNewClassName] = useState('');
  const [editing, setEditing] = useState<Child | 'new'>();
  const [action, setAction] = useState<PupilAction>();
  const [reason, setReason] = useState('');
  const list = s.children.filter(
    (c) =>
      (isDirector || teaches(s, a, c)) &&
      c.year === s.year &&
      (status === 'all' ||
        (status === 'archived'
          ? c.archived
          : status === 'unassigned'
            ? !c.archived && !c.classId
            : !c.archived)) &&
      (group === 'all' || c.classId === group) &&
      c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const unassigned = s.children.filter((c) => currentChild(s, c) && !c.classId).length;
  const ask = (child: Child, kind: PupilAction['kind'], destination = '') => {
    setAction({ child, kind, destination });
    setReason('');
  };
  return (
    <div className="stack">
      {isDirector && (
        <Card>
          <details className="admin-class-tools">
            <summary>Gérer les classes · {groups.length} classes</summary>
            <div className="row padded">
              {groups.map((g) => (
                <span key={g.id} className="scope-pill">
                  {g.name} ·{' '}
                  {s.children.filter((c) => currentChild(s, c) && c.classId === g.id).length} élèves
                </span>
              ))}
            </div>
            <div className="toolbar">
              <input
                aria-label="Nouvelle classe"
                placeholder="Nom de la nouvelle classe"
                value={newClassName}
                onChange={(ev) => setNewClassName(ev.target.value)}
              />
              <SaveButton
                disabled={!newClassName.trim()}
                onSave={async () => {
                  await run((s) => createClass(s, a.id, newClassName));
                  setNewClassName('');
                }}
              >
                Ajouter la classe
              </SaveButton>
            </div>
          </details>
        </Card>
      )}
      <Card>
        <div className="section-title">
          <h2>{isDirector ? 'Élèves de l’école' : 'Élèves de mes classes'}</h2>
          <AddButton onClick={() => setEditing('new')} disabled={!ownGroups.length}>
            Ajouter un élève
          </AddButton>
        </div>
        <p className="small-print padded">
          {isDirector
            ? `${unassigned} élève(s) à réaffecter. Les archives restent consultables dans le filtre de statut.`
            : 'Vous pouvez modifier ou transférer les élèves de vos classes. Un retrait de classe laisse le dossier à la direction pour réaffectation.'}
        </p>
        <div className="admin-filters">
          <Field label="Rechercher un élève">
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Nom de l’élève"
            />
          </Field>
          <Field label="Filtrer par classe">
            <select value={group} onChange={(ev) => setGroup(ev.target.value)}>
              <option value="all">Toutes mes classes</option>
              {ownGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          {isDirector && (
            <Field label="Statut des élèves">
              <select value={status} onChange={(ev) => setStatus(ev.target.value)}>
                <option value="active">Inscrits</option>
                <option value="unassigned">À réaffecter</option>
                <option value="archived">Archivés / départs</option>
                <option value="all">Tous les dossiers</option>
              </select>
            </Field>
          )}
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Enfant</th>
                <th>Classe</th>
                <th>Responsables et services</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td data-label="Enfant">
                    <div className="profile-name">
                      <ProfileAvatar target={{ kind: 'child', id: c.id }} className="mini" />
                      <strong>{c.name}</strong>
                    </div>
                    <small className="admin-subline">
                      {formatDate(c.dob, 'fr')} · {c.year}
                    </small>
                    {c.archived && <Badge value="archived" />}
                    {!c.classId && !c.archived && (
                      <span className="badge badge-pending">À réaffecter</span>
                    )}
                  </td>
                  <td data-label="Classe">
                    {c.archived ? (
                      s.classes.find((g) => g.id === c.classId)?.name || 'Sans classe'
                    ) : (
                      <select
                        aria-label={`Classe de ${c.name}`}
                        value={c.classId}
                        onChange={(ev) => ask(c, 'transfer', ev.target.value)}
                      >
                        <option value="" disabled>
                          Sans classe
                        </option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td data-label="Responsables et services">
                    {c.guardians.map((id) => s.adults.find((p) => p.id === id)?.name).join(', ') ||
                      'Liens à vérifier par la direction'}
                    <small className="admin-subline">
                      {c.services.map((id) => services[id][0]).join(' · ') ||
                        'Aucun service attribué'}
                    </small>
                  </td>
                  <td data-label="Actions">
                    <div className="admin-actions">
                      {c.archived ? (
                        <button
                          onClick={() =>
                            ask(
                              c,
                              'restore',
                              currentClass(s, c.classId) ? c.classId : (groups[0]?.id ?? ''),
                            )
                          }
                        >
                          Réinscrire
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setEditing(c)}>Modifier</button>
                          <button onClick={() => go(`children/${c.id}`)}>Dossier</button>
                          {c.classId && (
                            <button onClick={() => ask(c, 'unassign')}>Retirer de la classe</button>
                          )}
                          {isDirector && (
                            <button className="danger" onClick={() => ask(c, 'archive')}>
                              Archiver
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {c.removalReason && <small className="admin-subline">{c.removalReason}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <p className="empty">Aucun élève ne correspond aux filtres.</p>}
      </Card>
      {editing && (
        <PupilEditor
          child={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {action && (
        <Modal
          title={`${action.kind === 'transfer' ? 'Transférer' : action.kind === 'unassign' ? 'Retirer de la classe' : action.kind === 'archive' ? 'Archiver le dossier' : 'Réinscrire'} · ${action.child.name}`}
          onClose={() => setAction(undefined)}
        >
          {action.kind === 'transfer' || action.kind === 'restore' ? (
            <>
              <Field label="Classe de destination">
                <select
                  value={action.destination}
                  onChange={(ev) => setAction({ ...action, destination: ev.target.value })}
                >
                  <option value="" disabled>
                    Choisir une classe
                  </option>
                  {groups
                    .filter((g) => action.kind === 'restore' || g.id !== action.child.classId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </Field>
              <p>
                Le même dossier est conservé : responsables, documents, évaluations, réponses et
                historique.
              </p>
              <p className="notice-inline">
                {action.kind === 'restore'
                  ? 'Les autorisations photo seront redemandées. Aucun ancien mandat de représentant ne sera réactivé.'
                  : 'Les accès des enseignants changent immédiatement. Un mandat de parent délégué prend fin dans l’ancienne classe si le parent n’y a plus d’enfant.'}
              </p>
            </>
          ) : (
            <>
              <p>
                {action.kind === 'unassign'
                  ? 'Le dossier reste inscrit à l’école, sans classe, et apparaît dans la liste « À réaffecter » de la direction. Les liens familiaux et les services sont conservés.'
                  : 'Le dossier quitte les listes actives et les nouvelles actions liées à cet élève sont bloquées. Les documents, contributions et réservations existantes sont conservés ; les réservations ne sont pas annulées automatiquement.'}
              </p>
              <Field label="Motif du retrait">
                <textarea
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  maxLength={500}
                />
              </Field>
            </>
          )}
          <SaveButton
            danger={action.kind === 'archive'}
            disabled={
              ['transfer', 'restore'].includes(action.kind)
                ? !action.destination ||
                  (action.kind === 'transfer' && action.destination === action.child.classId)
                : !reason.trim()
            }
            onSave={async () => {
              await run((s) =>
                action.kind === 'transfer'
                  ? moveChild(
                      s,
                      a.id,
                      action.child.id,
                      action.destination,
                      s.children.find((c) => c.id === action.child.id)!.services,
                    )
                  : action.kind === 'restore'
                    ? restoreChild(s, a.id, action.child.id, action.destination)
                    : action.kind === 'archive'
                      ? archiveChild(s, a.id, action.child.id, reason)
                      : removeFromClass(s, a.id, action.child.id, reason),
              );
              setAction(undefined);
            }}
          >
            {action.kind === 'transfer'
              ? 'Confirmer le transfert'
              : action.kind === 'restore'
                ? 'Confirmer la réinscription'
                : action.kind === 'archive'
                  ? 'Confirmer le départ et archiver'
                  : 'Confirmer le retrait de la classe'}
          </SaveButton>
        </Modal>
      )}
    </div>
  );
}
function PupilEditor({ child, onClose }: { child?: Child; onClose: () => void }) {
  const { s, a, run } = useApp();
  const isDirector = director(s, a);
  const [name, setName] = useState(child?.name ?? '');
  const [dob, setDob] = useState(child?.dob ?? '');
  const [classId, setClass] = useState(child?.classId ?? managedClasses(s, a)[0]?.id ?? '');
  const [guardians, setGuardians] = useState(child?.guardians ?? []);
  const [selectedServices, setServices] = useState<Service[]>(child?.services ?? []);
  return (
    <Modal
      title={child ? `Modifier l’élève · ${child.name}` : 'Ajouter un élève'}
      onClose={onClose}
    >
      {child && <ProfilePhotoEditor target={{ kind: 'child', id: child.id }} />}
      {!child && (
        <p className="small-print">
          Créez le dossier, puis ouvrez « Modifier » pour ajouter une photo de profil.
        </p>
      )}
      <div className="form-grid">
        <Field label="Nom de l’élève">
          <input
            autoComplete="off"
            maxLength={160}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
          />
        </Field>
        <Field label="Date de naissance">
          <input
            type="date"
            max={s.clock.slice(0, 10)}
            value={dob}
            onChange={(ev) => setDob(ev.target.value)}
          />
        </Field>
      </div>
      {!child && (
        <Field label="Classe d’inscription">
          <select value={classId} onChange={(ev) => setClass(ev.target.value)}>
            {managedClasses(s, a).map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {isDirector ? (
        <>
          <Checks
            label="Responsables légaux vérifiés"
            options={s.adults.filter((p) => p.roles.includes('guardian') && p.year === s.year)}
            value={guardians}
            onChange={setGuardians}
          />
          <Checks
            label="Services fréquentés"
            options={serviceOptions}
            value={selectedServices}
            onChange={(ids) => setServices(ids as Service[])}
          />
        </>
      ) : (
        <p className="notice-inline">
          La direction vérifiera les liens avec les parents et les services fréquentés. Vous ne
          pouvez pas attribuer d’accès à un adulte.
        </p>
      )}
      <p className="small-print">
        Données fictives uniquement. Un nouvel élève commence sans données de santé ni autorisations
        photo préremplies.
      </p>
      <SaveButton
        disabled={!name.trim() || !dob || (!child && !classId)}
        onSave={async () => {
          const input = {
            name,
            dob,
            ...(isDirector ? { guardians, services: selectedServices } : {}),
          };
          await run((s) =>
            child
              ? editChild(s, a.id, child.id, input)
              : createChild(s, a.id, { ...input, classId }),
          );
          onClose();
        }}
      >
        {child ? 'Enregistrer le dossier' : 'Créer le dossier élève'}
      </SaveButton>
    </Modal>
  );
}

export function RepresentativesPanel() {
  const { s, a, run } = useApp();
  const groups = managedClasses(s, a);
  const [classId, setClass] = useState(groups[0]?.id ?? '');
  const [parentId, setParent] = useState('');
  const [end, setEnd] = useState(`${Number(s.year.slice(0, 4)) + 1}-08-31`);
  const [removing, setRemoving] = useState<Adult>();
  const parents = s.adults.filter(
    (p) => active(s, p) && guardianChildren(s, p).some((c) => c.classId === classId),
  );
  const representatives = s.adults.filter((p) => p.representativeClasses.includes(classId));
  return (
    <Card>
      <h2>Parents délégués · mandats par classe</h2>
      <p>
        La désignation ajoute uniquement les droits de représentant. Elle ne donne aucun accès aux
        dossiers des autres élèves, aux données de santé ou aux échanges privés.
      </p>
      <Field label="Classe du mandat">
        <select
          value={classId}
          onChange={(ev) => {
            setClass(ev.target.value);
            setParent('');
          }}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>
      {!groups.length ? (
        <p className="empty">Aucune classe ne vous est attribuée.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Parent délégué</th>
                  <th>Fin du mandat</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {representatives.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Parent délégué">{p.name}</td>
                    <td data-label="Fin du mandat">
                      {formatDate(mandateEndFor(p, classId), 'fr')}
                    </td>
                    <td data-label="Statut">
                      <Badge
                        value={
                          !active(s, p)
                            ? p.status
                            : mandateEndFor(p, classId) < s.clock.slice(0, 10)
                              ? 'expired'
                              : 'active'
                        }
                      />
                    </td>
                    <td data-label="Actions">
                      <div className="admin-actions">
                        <button
                          onClick={() => {
                            setParent(p.id);
                            setEnd(mandateEndFor(p, classId));
                          }}
                        >
                          Modifier le mandat
                        </button>
                        <button className="danger" onClick={() => setRemoving(p)}>
                          Retirer le mandat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!representatives.length && (
            <p className="small-print padded">Aucun mandat dans cette classe.</p>
          )}
          <div className="divider" />
          <h3>Attribuer ou renouveler un mandat</h3>
          <div className="form-grid">
            <Field label="Parent de cette classe">
              <select value={parentId} onChange={(ev) => setParent(ev.target.value)}>
                <option value="">Choisir un parent vérifié</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fin du mandat">
              <input
                type="date"
                value={end}
                min={s.clock.slice(0, 10)}
                max={`${Number(s.year.slice(0, 4)) + 1}-08-31`}
                onChange={(ev) => setEnd(ev.target.value)}
              />
            </Field>
          </div>
          <p className="small-print">
            Seuls les parents actifs liés à un élève de cette classe peuvent être désignés. Le
            mandat ne dépasse pas l’année scolaire.
          </p>
          <SaveButton
            disabled={!parentId || !end}
            onSave={async () => {
              await run((s) => setRepresentative(s, a.id, parentId, classId, true, end));
              setParent('');
            }}
          >
            Enregistrer le mandat
          </SaveButton>
        </>
      )}
      {removing && (
        <Modal
          title={`Retirer le mandat · ${removing.name}`}
          onClose={() => setRemoving(undefined)}
        >
          <p>
            Les droits de représentant prennent fin dans cette classe. Le compte parent, ses autres
            mandats et ses liens avec ses enfants sont conservés.
          </p>
          <SaveButton
            danger
            onSave={async () => {
              await run((s) => setRepresentative(s, a.id, removing.id, classId, false, ''));
              setRemoving(undefined);
            }}
          >
            Confirmer le retrait du mandat
          </SaveButton>
        </Modal>
      )}
    </Card>
  );
}
export function AdminRightsPanel() {
  return (
    <div className="stack">
      <Card>
        <h2>Qui peut administrer quoi ?</h2>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Profil</th>
                <th>Droits d’administration</th>
                <th>Limites</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Profil">Direction</td>
                <td data-label="Droits">
                  Inviter, modifier et révoquer les adultes ; gérer les photos des élèves et du
                  personnel ; gérer tous les élèves, classes, services, liens familiaux et mandats ;
                  archiver ou réinscrire les élèves.
                </td>
                <td data-label="Limites">
                  Pas de retrait de son propre compte. Aucun droit automatique sur les messages
                  privés ou les justificatifs confidentiels.
                </td>
              </tr>
              <tr>
                <td data-label="Profil">Enseignant</td>
                <td data-label="Droits">
                  Créer ou modifier un élève et sa photo dans ses classes, le transférer, le retirer
                  de sa classe ; gérer les mandats de parents délégués de ses classes.
                </td>
                <td data-label="Limites">
                  Ne peut pas récupérer un élève d’une autre classe, attribuer un rôle adulte,
                  vérifier un lien familial ni archiver un départ d’école.
                </td>
              </tr>
              <tr>
                <td data-label="Profil">Périscolaire</td>
                <td data-label="Droits">
                  Activité et dossiers utiles aux services attribués ; modification de sa propre
                  photo.
                </td>
                <td data-label="Limites">Pas d’administration des comptes, classes ou mandats.</td>
              </tr>
              <tr>
                <td data-label="Profil">Parent / parent délégué</td>
                <td data-label="Droits">
                  Dossiers de ses enfants vérifiés ; pour un délégué, activités de représentation
                  dans les classes et dates de son mandat.
                </td>
                <td data-label="Limites">
                  Pas de modification des liens familiaux ou des accès d’autres personnes.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2>Champs utiles à compléter</h2>
        <p>
          Contact de l’adulte, rôles cumulables, statut du compte, classes et services attribués ;
          nom et date de naissance de l’élève, responsables légaux vérifiés, services fréquentés ;
          classe et date de fin de chaque mandat.
        </p>
        <p>
          Les retraits demandent un motif. Les changements sont inscrits au journal de la direction
          ; les dossiers existants sont conservés.
        </p>
        <h3>À prévoir avant une utilisation réelle</h3>
        <ul className="list-clean">
          <li>
            Dates de début et de fin des affectations, avec droits temporaires pour les remplaçants.
          </li>
          <li>
            Invitation avec courriel vérifié, récupération de compte et authentification renforcée
            pour les administrateurs.
          </li>
          <li>
            Double validation des changements sensibles de responsables légaux et contrôle des
            demandes en cours avant un départ.
          </li>
          <li>
            Politique de conservation et d’effacement approuvée par l’école, et journal des accès
            aux justificatifs confidentiels.
          </li>
        </ul>
        <p className="small-print">
          Ces derniers points sont des recommandations. Cette démo utilise des données fictives et
          des règles locales ; une application réelle nécessite une authentification et des
          permissions côté serveur.
        </p>
      </Card>
    </div>
  );
}
