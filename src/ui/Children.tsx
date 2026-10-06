import { useState } from 'react';
import { HeartPulse, ShieldCheck, Lock } from 'lucide-react';
import { useApp, formatDate, services } from './context';
import { childrenFor, guardian, teaches, director } from '../domain/policy';
import { updateProfile, setConsent, reviewEvidence, reviewTask, change } from '../domain/engine';
import { type Child, type PhotoUse, type Choice, tr } from '../domain/types';
import { Card, PageTitle, Field, Modal, Files, Upload, Badge, Empty } from './components';
const uses: Record<PhotoUse, [string, string]> = {
  class: ['Fil privé de classe', 'Private class feed'],
  school: ['Fil privé de toute l’école', 'Private whole-school feed'],
  print: ['Supports scolaires imprimés', 'Printed school materials'],
  website: ['Site public de l’école', 'Public school website'],
  social: ['Réseaux sociaux', 'Social media'],
};
export function Children({ id }: { id?: string }) {
  const { s, a, t, go, run } = useApp();
  const list = childrenFor(s, a);
  const [query, setQuery] = useState('');
  const [linkNote, setLinkNote] = useState('');
  if (id) {
    const c = list.find((c) => c.id === id);
    if (!c) return <Denied />;
    return <ChildDetail key={id} c={c} />;
  }
  return (
    <>
      <PageTitle
        title={t('Chaque enfant, son espace', 'A space for every child')}
        subtitle={t(
          'Informations pratiques, contacts et autorisations.',
          'Practical information, contacts and permissions.',
        )}
      />
      <div className="toolbar">
        <input
          aria-label={t('Rechercher un enfant', 'Search children')}
          placeholder={t('Rechercher un enfant…', 'Search children…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid three">
        {list
          .filter((c) => c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
          .map((c, i) => (
            <Card key={c.id}>
              <div className="row">
                <span className={`avatar tint-${i % 4}`}>
                  {c.name
                    .split(' ')
                    .map((v) => v[0])
                    .join('')}
                </span>
                <div>
                  <h3 style={{ marginBottom: 0 }}>{c.name}</h3>
                  <small>
                    {s.classes.find((g) => g.id === c.classId)?.name} · {s.year}
                  </small>
                </div>
              </div>
              <div className="divider" />
              <p>
                <Badge value={c.careStatus} />
              </p>
              <button className="secondary full" onClick={() => go(`children/${c.id}`)}>
                {t('Ouvrir le profil', 'Open profile')}
              </button>
            </Card>
          ))}
      </div>
      {!list.length && <Empty />}
      {a.roles.includes('guardian') && (
        <Card className="child-followup-card family-link-card">
          <h2>{t('Une erreur dans les liens familiaux ?', 'An incorrect child link?')}</h2>
          <Field
            label={t(
              'Demander une vérification à la direction',
              'Request verification by the director',
            )}
          >
            <textarea value={linkNote} onChange={(ev) => setLinkNote(ev.target.value)} />
          </Field>
          <button
            onClick={() =>
              void run((s) =>
                change(s, a.id, 'linkCorrection', 'membership', (n) => {
                  if (!linkNote.trim()) throw new Error('required');
                  n.tasks.push({
                    id: crypto.randomUUID(),
                    type: 'correction',
                    author: a.id,
                    staff: n.adults.filter((p) => director(n, p)).map((p) => p.id),
                    at: n.clock,
                    status: 'pending',
                    note: linkNote,
                  });
                }),
              ).catch(() => {})
            }
          >
            {t('Demander la correction', 'Request correction')}
          </button>
          <p className="small-print">
            {t(
              'Seule la direction vérifie et modifie les liens.',
              'Only the director verifies and changes links.',
            )}
          </p>
        </Card>
      )}
    </>
  );
}
export function Denied() {
  const { t, go } = useApp();
  return (
    <Card>
      <Lock size={28} />
      <h1>{t('Accès indisponible', 'Access unavailable')}</h1>
      <p>
        {t(
          'Cet élément n’existe pas ou n’est pas autorisé pour ce profil.',
          'This item does not exist or is not authorised for this persona.',
        )}
      </p>
      <button onClick={() => go('home')}>{t('Retour à l’accueil', 'Back to home')}</button>
    </Card>
  );
}
function ChildDetail({ c }: { c: Child }) {
  const { s, a, t, locale, run } = useApp();
  const own = guardian(s, a, c);
  const [edit, setEdit] = useState(false);
  const [care, setCare] = useState(c.care[locale]);
  const [diet, setDiet] = useState(c.diet[locale]);
  const [familyDiet, setFamilyDiet] = useState(c.familyDiet[locale]);
  const [support, setSupport] = useState(c.support[locale]);
  const [emergency, setEmergency] = useState(c.emergency);
  const [collectors, setCollectors] = useState(c.collectors);
  const reviewer = a.reviewers.includes(c.id);
  return (
    <>
      <PageTitle
        title={c.name}
        subtitle={`${s.classes.find((g) => g.id === c.classId)?.name} · ${formatDate(c.dob, locale)} · ${t('Profil fictif', 'Fictional profile')}`}
        action={
          own && (
            <button className="primary" onClick={() => setEdit(true)}>
              {t('Mettre à jour', 'Update profile')}
            </button>
          )
        }
      />
      <div className="detail-layout">
        <div className="stack">
          <Card>
            <h2>
              <HeartPulse size={20} /> {t('Pour bien l’accompagner', 'Supporting this child')}
            </h2>
            <Badge value={c.careStatus} />
            <div className="divider" />
            <h3>{t('Informations signalées par le parent', 'Parent-reported information')}</h3>
            <p>{c.care[locale] || c.care.fr}</p>
            <h3>{t('Dernières consignes vérifiées', 'Last reviewed instructions')}</h3>
            <p className="notice-inline">{c.reviewedCare[locale] || c.reviewedCare.fr}</p>
            <h3>{t('Régime lié à la santé', 'Medically related diet')}</h3>
            <p>{c.diet[locale] || c.diet.fr}</p>
            <h3>{t('Préférences alimentaires familiales', 'Family dietary preferences')}</h3>
            <p>{c.familyDiet[locale] || c.familyDiet.fr}</p>
            <h3>{t('Besoins et aménagements', 'Needs and accommodations')}</h3>
            <p>{c.support[locale] || c.support.fr}</p>
            <small>
              {t(
                'Une modification du parent ne remplace pas un protocole de soins validé. Aucun conseil médical automatique.',
                'A parent update does not replace an approved care protocol. No automated medical advice.',
              )}
            </small>
            {s.tasks
              .filter(
                (task) =>
                  task.childId === c.id &&
                  task.type === 'care' &&
                  task.status === 'pending' &&
                  task.staff.includes(a.id),
              )
              .map((task) => (
                <button
                  key={task.id}
                  className="primary full"
                  onClick={() => void run((s) => reviewTask(s, a.id, task.id)).catch(() => {})}
                >
                  {t('Vérifier les nouvelles consignes', 'Review the updated instructions')}
                </button>
              ))}
          </Card>
          <Card>
            <h2>{t('Contacts utiles', 'Useful contacts')}</h2>
            <h3>{t('Contact d’urgence', 'Emergency contact')}</h3>
            <p>{c.emergency}</p>
            <h3>{t('Personnes autorisées au départ', 'Authorised collectors')}</h3>
            <p>{c.collectors}</p>
            <p className="small-print">
              {t(
                'Ces personnes ne reçoivent aucun accès à l’application.',
                'These people do not receive app access.',
              )}
            </p>
          </Card>
        </div>
        <aside className="stack">
          <Card>
            <h2>
              <Lock size={20} /> {t('Justificatifs confidentiels', 'Confidential evidence')}
            </h2>
            {own || reviewer ? (
              <>
                <Badge value={c.vaccination} />
                <p className="muted">
                  {t(
                    'État de vérification administrative. Aucun contrôle médical automatique.',
                    'Administrative review status. No automated medical validation.',
                  )}
                </p>
                <Files ids={c.evidence} />
                {own && (
                  <Upload
                    childId={c.id}
                    restricted
                    onUpload={() => {}}
                    label={t('Ajouter un justificatif fictif', 'Add fictional evidence')}
                  />
                )}{' '}
                {reviewer && (
                  <button
                    onClick={() => void run((s) => reviewEvidence(s, a.id, c.id)).catch(() => {})}
                  >
                    {t('Marquer vérifié', 'Mark reviewed')}
                  </button>
                )}
              </>
            ) : (
              <p>
                {t(
                  'Accès réservé au déposant et aux vérificateurs explicitement désignés.',
                  'Access is restricted to the uploader and explicitly designated reviewers.',
                )}
              </p>
            )}
          </Card>
          <Card>
            <h2>{t('Services fréquentés', 'Enrolled services')}</h2>
            {c.services.map((v) => (
              <p key={v}>{t(...services[v])}</p>
            ))}
          </Card>
        </aside>
      </div>
      {(own || teaches(s, a, c) || director(s, a)) && (
        <Card className="child-followup-card">
          <h2>
            <ShieldCheck size={20} />{' '}
            {t('Photos : un choix pour chaque usage', 'Photos: a choice for each use')}
          </h2>
          <p className="muted">
            {t('Valable pour l’année scolaire', 'Valid for school year')} {s.year} · v
            {c.consentVersion}
          </p>
          <p>
            {t(
              'Tous les responsables désignés doivent autoriser l’usage. Un refus ou une réponse manquante bloque la publication. Aucun accord n’est présélectionné pour un nouvel usage.',
              'All designated guardians must approve each use. A refusal or missing response blocks publication. Approval is never preselected for a new use.',
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Usage et finalité', 'Use and purpose')}</th>
                  {c.guardians.map((id) => (
                    <th key={id}>{s.adults.find((p) => p.id === id)?.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(uses) as PhotoUse[]).map((use) => (
                  <tr key={use}>
                    <td>{t(...uses[use])}</td>
                    {c.guardians.map((g) => (
                      <td key={g}>
                        {g === a.id && own ? (
                          <select
                            aria-label={`${t(...uses[use])} · ${a.name}`}
                            value={c.consents[use][g] ?? 'awaiting'}
                            onChange={(ev) => {
                              const value = ev.currentTarget.value;
                              void run((s) =>
                                setConsent(s, a.id, c.id, use, value as Choice),
                              ).catch(() => {});
                            }}
                          >
                            <option value="awaiting">
                              {t('Sans réponse', 'Awaiting response')}
                            </option>
                            <option value="allowed">{t('Autoriser', 'Allow')}</option>
                            <option value="refused">{t('Refuser', 'Refuse')}</option>
                            <option value="withdrawn">
                              {t('Retirer mon accord', 'Withdraw approval')}
                            </option>
                          </select>
                        ) : (
                          <Badge value={c.consents[use][g] ?? 'awaiting'} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small-print padded">
            {t(
              'Un retrait masque immédiatement les photos concernées dans l’application et crée une tâche de vérification. Les copies imprimées ou déjà téléchargées ne peuvent pas être rappelées. Les fichiers exemples publics de cette démo restent publics.',
              'Withdrawal immediately hides affected photos in the app and creates a review task. Printed or downloaded copies cannot be recalled. Public sample files in this demo remain public.',
            )}
          </p>
        </Card>
      )}
      {edit && (
        <Modal
          title={t('Mettre à jour les informations pratiques', 'Update practical information')}
          onClose={() => setEdit(false)}
        >
          {[
            [t('Consignes et allergies', 'Instructions and allergies'), care, setCare],
            [t('Régime médical', 'Medical diet'), diet, setDiet],
            [t('Préférences alimentaires', 'Dietary preferences'), familyDiet, setFamilyDiet],
            [t('Besoins et aménagements', 'Needs and accommodations'), support, setSupport],
            [t('Contacts d’urgence', 'Emergency contacts'), emergency, setEmergency],
            [
              t('Personnes autorisées au départ', 'Authorised collectors'),
              collectors,
              setCollectors,
            ],
          ].map(([label, value, setter]) => (
            <Field key={String(label)} label={String(label)}>
              <textarea
                value={String(value)}
                onChange={(ev) => (setter as (s: string) => void)(ev.target.value)}
              />
            </Field>
          ))}
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) =>
                  updateProfile(s, a.id, c.id, {
                    care: tr(care, care),
                    diet: tr(diet, diet),
                    familyDiet: tr(familyDiet, familyDiet),
                    support: tr(support, support),
                    emergency,
                    collectors,
                  }),
                );
                setEdit(false);
              } catch {}
            }}
          >
            {t('Signaler aux équipes responsables', 'Notify responsible teams')}
          </button>
        </Modal>
      )}
    </>
  );
}
