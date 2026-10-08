import { ProfilePhotoEditor } from './ProfilePhoto';
import { useState } from 'react';
import { Bell, Clock, Download, RefreshCw, Smartphone } from 'lucide-react';
import { useApp, formatDate, kindNames } from './context';
import { Card, PageTitle, Field, Modal, Empty, Badge } from './components';
import {
  authorisedNotices,
  canRead,
  childrenFor,
  canReadSubmission,
  canReadFile,
  guardian,
} from '../domain/policy';
import { setPreferences, reviewTask, change, feedback } from '../domain/engine';
import { download, csv } from '../domain/exports';
import { localNotifications } from '../domain/adapters';
import { repository } from '../data/repository';
import { type Kind } from '../domain/types';
export function Notifications() {
  const { s, a, t, locale, run, open, go } = useApp();
  const [filter, setFilter] = useState('all');
  const notices = authorisedNotices(s, a)
    .filter((n) => filter === 'all' || n.kind === filter)
    .sort((a, b) => b.at.localeCompare(a.at));
  const tasks = s.tasks.filter(
    (task) =>
      task.staff.includes(a.id) &&
      task.status === 'pending' &&
      (!task.childId || childrenFor(s, a).some((c) => c.id === task.childId)) &&
      (!task.entryId || s.entries.some((e) => e.id === task.entryId && canRead(s, a, e))),
  );
  return (
    <>
      <PageTitle
        title={t('Votre centre de notifications', 'Your notification centre')}
        subtitle={t(
          'Ce qui mérite votre attention, au bon moment.',
          'What needs your attention, at the right time.',
        )}
        action={<button onClick={() => go('settings')}>{t('Préférences', 'Preferences')}</button>}
      />
      <div className="toolbar">
        <select
          aria-label={t('Catégorie', 'Category')}
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
        >
          <option value="all">{t('Toutes les catégories', 'All categories')}</option>
          {Object.entries(kindNames).map(([id, label]) => (
            <option key={id} value={id}>
              {t(...label)}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            void run((s) =>
              change(s, a.id, 'readNotices', 'self', (n) => {
                authorisedNotices(n, a).forEach((v) => (v.read = true));
              }),
            ).catch(() => {})
          }
        >
          {t('Tout marquer comme lu', 'Mark all read')}
        </button>
      </div>
      {tasks.length > 0 && (
        <Card>
          <h2>{t('Vérifications à effectuer', 'Reviews to complete')}</h2>
          {tasks.map((task) => (
            <div className="mini-card" key={task.id}>
              <div className="row between">
                <strong>
                  {task.type === 'care'
                    ? t('Informations pratiques modifiées', 'Care information updated')
                    : task.type === 'photo'
                      ? t('Vérifier l’usage des photos', 'Review photo usage')
                      : task.type === 'report'
                        ? t('Contenu signalé', 'Reported content')
                        : t('Demande de correction', 'Correction request')}
                </strong>
                <Badge value={task.status} />
              </div>
              {task.childId && <p>{s.children.find((c) => c.id === task.childId)?.name}</p>}
              {!['care', 'photo'].includes(task.type) && <p className="detail-body">{task.note}</p>}
              <div className="row">
                <button
                  onClick={() =>
                    task.entryId
                      ? go(`${s.entries.find((e) => e.id === task.entryId)?.kind}/${task.entryId}`)
                      : task.childId
                        ? go(`children/${task.childId}`)
                        : go('administration')
                  }
                >
                  {t('Examiner', 'Review')}
                </button>
                <button
                  className="primary"
                  onClick={() => void run((s) => reviewTask(s, a.id, task.id)).catch(() => {})}
                >
                  {t('Marquer traité', 'Mark handled')}
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <div className="stack">
        {notices.map((n) => {
          const e = s.entries.find((e) => e.id === n.resourceId)!;
          return (
            <Card key={n.id}>
              <div className="row between">
                <span className="eyebrow">{t(...kindNames[n.kind])}</span>
                <span className="badge">
                  {n.queued
                    ? t('En attente des heures autorisées', 'Queued for allowed hours')
                    : n.read
                      ? t('Ouverte', 'Opened')
                      : t('Nouvelle', 'New')}
                </span>
              </div>
              <h3 className="padded">
                {t('Une mise à jour vous attend', 'An update is waiting for you')}
              </h3>
              <small>{formatDate(n.at, locale, true)}</small>
              <button
                className="secondary full"
                onClick={async () => {
                  try {
                    await run((s) =>
                      change(s, a.id, 'readNotice', n.id, (next) => {
                        const target = next.notices.find((v) => v.id === n.id && v.actor === a.id);
                        if (target) target.read = true;
                      }),
                    );
                    open(e);
                  } catch {}
                }}
              >
                {t('Ouvrir dans mon espace', 'Open in my workspace')}
              </button>
            </Card>
          );
        })}
      </div>
      {!notices.length && !tasks.length && <Empty />}
    </>
  );
}
export function Settings() {
  const { s, a, t, locale, run, toast } = useApp();
  const [reset, setReset] = useState(false);
  const [test, setTest] = useState('');
  return (
    <>
      <PageTitle
        title={t('Un espace à votre rythme', 'A workspace at your pace')}
        subtitle={t(
          'Préférences propres à ce profil de démonstration.',
          'Preferences for this demo persona.',
        )}
      />
      <Card>
        <ProfilePhotoEditor target={{ kind: 'adult', id: a.id }} />
        <h2>{t('Mes coordonnées personnelles', 'My personal contact details')}</h2>
        <Field
          label={t('Contact fictif de ce profil', 'Fictional contact for this persona')}
          hint={t(
            'Ces coordonnées ne sont pas partagées automatiquement avec un autre responsable.',
            'These details are not automatically shared with another guardian.',
          )}
        >
          <input
            type="email"
            defaultValue={a.contact}
            onBlur={(ev) => {
              const contact = ev.target.value;
              if (contact !== a.contact)
                void run((s) => setPreferences(s, a.id, { contact })).catch(() => {});
            }}
          />
        </Field>
      </Card>
      <div style={{ height: 22 }} />
      <div className="grid">
        <Card>
          <h2>
            <Bell size={20} /> {t('Notifications et tranquillité', 'Notifications & quiet hours')}
          </h2>
          <div className="form-grid quiet-hours-grid">
            <Field label={t('Début du silence (heure de Paris)', 'Quiet hours start (Paris time)')}>
              <input
                type="number"
                min="0"
                max="23"
                value={a.quietStart}
                onChange={(ev) => {
                  const value = ev.currentTarget.value;
                  void run((s) =>
                    setPreferences(s, a.id, {
                      quietStart: Math.max(0, Math.min(23, Number(value))),
                    }),
                  ).catch(() => {});
                }}
              />
            </Field>
            <Field label={t('Fin du silence', 'Quiet hours end')}>
              <input
                type="number"
                min="0"
                max="23"
                value={a.quietEnd}
                onChange={(ev) => {
                  const value = ev.currentTarget.value;
                  void run((s) =>
                    setPreferences(s, a.id, {
                      quietEnd: Math.max(0, Math.min(23, Number(value))),
                    }),
                  ).catch(() => {});
                }}
              />
            </Field>
            <Field className="wide" label={t('Rappel des événements', 'Event reminders')}>
              <select
                value={a.eventReminder}
                onChange={(ev) => {
                  const value = ev.currentTarget.value;
                  void run((s) => setPreferences(s, a.id, { eventReminder: Number(value) })).catch(
                    () => {},
                  );
                }}
              >
                <option value={24}>{t('24 heures avant', '24 hours before')}</option>
                <option value={1}>{t('1 heure avant', '1 hour before')}</option>
                <option value={0}>{t('Aucun', 'None')}</option>
              </select>
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={a.taskReminders}
              onChange={(ev) => {
                const checked = ev.currentTarget.checked;
                void run((s) => setPreferences(s, a.id, { taskReminders: checked })).catch(
                  () => {},
                );
              }}
            />
            {t(
              'Rappels de démarches et consultations à J−3 et J−1',
              'Form and survey reminders 3 and 1 days before',
            )}
          </label>
          <h3>{t('Catégories', 'Categories')}</h3>
          <div className="checks">
            {Object.entries(kindNames).map(([id, label]) => (
              <label className="check" key={id}>
                <input
                  type="checkbox"
                  checked={a.notificationCategories.includes(id as Kind)}
                  onChange={(ev) => {
                    const checked = ev.currentTarget.checked;
                    void run((s) =>
                      setPreferences(s, a.id, {
                        notificationCategories: checked
                          ? [...a.notificationCategories, id as Kind]
                          : a.notificationCategories.filter((v) => v !== id),
                      }),
                    ).catch(() => {});
                  }}
                />
                {t(...label)}
              </label>
            ))}
          </div>
          {a.roles.some((r) => ['teacher', 'director', 'service'].includes(r)) && (
            <>
              <h3 className="padded">
                {t('Disponibilité fictive en semaine', 'Sample weekday availability')}
              </h3>
              <div className="form-grid">
                <Field label={t('De (heure de Paris)', 'From (Paris time)')}>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={a.availableStart}
                    onChange={(ev) => {
                      const value = ev.currentTarget.value;
                      void run((s) =>
                        setPreferences(s, a.id, { availableStart: Number(value) }),
                      ).catch(() => {});
                    }}
                  />
                </Field>
                <Field label={t('À', 'Until')}>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={a.availableEnd}
                    onChange={(ev) => {
                      const value = ev.currentTarget.value;
                      void run((s) =>
                        setPreferences(s, a.id, { availableEnd: Number(value) }),
                      ).catch(() => {});
                    }}
                  />
                </Field>
              </div>
            </>
          )}
          <p className="small-print">
            {t(
              'Les messages arrivent dans la boîte même pendant le silence. Les notifications sont mises en attente. Aucun envoi push ou e-mail distant.',
              'Messages appear in the inbox during quiet hours. Notifications are queued. No remote push or email is sent.',
            )}
          </p>
        </Card>
        <div className="stack">
          <Card>
            <h2>
              <Clock size={20} /> {t('Horloge de démonstration', 'Demo clock')}
            </h2>
            <p>{formatDate(s.clock, locale, true)} · Europe/Paris</p>
            <div className="row">
              {[1, 24, 72].map((h) => (
                <button
                  key={h}
                  onClick={() =>
                    void run((s) => localNotifications.tick(s, a.id, h)).catch(() => {})
                  }
                >
                  +{h} h
                </button>
              ))}
              <button
                onClick={() => void run((s) => localNotifications.tick(s, a.id, 0)).catch(() => {})}
              >
                {t('Simuler les rappels maintenant', 'Simulate reminders now')}
              </button>
            </div>
            <p className="small-print padded">
              {t(
                'Aucune tâche ne s’exécute de façon fiable quand l’application est fermée. L’horloge est conservée au rechargement.',
                'No task runs reliably while the app is closed. The clock persists across reloads.',
              )}
            </p>
          </Card>
          <Card>
            <h2>
              <Smartphone size={20} />{' '}
              {t('Installation et test local', 'Installation & local test')}
            </h2>
            <p>
              {t(
                'Sur iPhone : Partager → Sur l’écran d’accueil. Sur Android ou ordinateur : utilisez « Installer » dans le menu du navigateur, si disponible. Ouvrez une première fois en ligne.',
                'On iPhone: Share → Add to Home Screen. On Android or desktop: use “Install” in the browser menu, if available. Open once while online.',
              )}
            </p>
            <button
              onClick={async () => {
                if (!('Notification' in window)) {
                  setTest(
                    t('Notifications non prises en charge.', 'Notifications are not supported.'),
                  );
                  return;
                }
                try {
                  const permission = await Notification.requestPermission();
                  if (permission !== 'granted') {
                    setTest(
                      t(
                        'Autorisation refusée ou non accordée. L’application reste utilisable.',
                        'Permission denied or not granted. The app remains usable.',
                      ),
                    );
                    return;
                  }
                  const reg = await navigator.serviceWorker.ready;
                  await reg.showNotification(t('Peyrieu · Test local', 'Peyrieu · Local test'), {
                    body: t(
                      'Une mise à jour fictive vous attend.',
                      'A fictional update is waiting for you.',
                    ),
                    icon: `${import.meta.env.BASE_URL}icon-crayon-192.png`,
                    tag: 'peyrieu-local-test',
                  });
                  setTest(
                    t(
                      'Test local demandé. Aucun service push distant.',
                      'Local test requested. No remote push service.',
                    ),
                  );
                } catch {
                  setTest(
                    t(
                      'Ce navigateur ne permet pas ce test.',
                      'This browser cannot perform this test.',
                    ),
                  );
                }
              }}
            >
              {t('Tester une notification locale', 'Test a local notification')}
            </button>
            {test && <p role="status">{test}</p>}
          </Card>
        </div>
      </div>
      <div style={{ height: 22 }} />
      <Card>
        <h2>{t('Données de démonstration', 'Demonstration data')}</h2>
        <p>
          {t(
            'Les données et pièces jointes sont dans IndexedDB. Ce stockage n’est ni chiffré par l’application ni garanti permanent. Les règles d’accès illustrent le futur produit ; elles ne sécurisent pas les données fictives embarquées.',
            'Data and attachments are stored in IndexedDB. App storage is not encrypted or guaranteed permanent. Access rules illustrate future product behaviour; they do not secure the bundled fictional data.',
          )}
        </p>
        <div className="row">
          <button
            onClick={() => {
              const entries = s.entries
                .filter((e) => canRead(s, a, e))
                .map((e) => ({
                  ...e,
                  messages: e.messages.filter((m) => !m.removed),
                  volunteers: canManageExport(s, a, e) ? e.volunteers : [],
                  rsvps: canManageExport(s, a, e)
                    ? e.rsvps
                    : Object.fromEntries(
                        Object.entries(e.rsvps).filter(([id]) =>
                          s.children.some((c) => c.id === id && guardian(s, a, c)),
                        ),
                      ),
                }));
              const exportData = {
                demo: true,
                actor: a.name,
                at: s.clock,
                entries,
                children: childrenFor(s, a).map((c) => ({
                  id: c.id,
                  name: c.name,
                  classId: c.classId,
                  care: c.care,
                  reviewedCare: c.reviewedCare,
                })),
                submissions: s.submissions.filter((x) => canReadSubmission(s, a, x)),
                attachments: s.attachments.filter((f) => canReadFile(s, a, f)),
              };
              download(
                'peyrieu-profil-demo.json',
                JSON.stringify(exportData, null, 2),
                'application/json',
              );
            }}
          >
            <Download size={17} />
            {t('Exporter les données de ce profil', 'Export this persona’s data')}
          </button>
          <button className="danger" onClick={() => setReset(true)}>
            <RefreshCw size={17} />
            {t('Réinitialiser cette démo', 'Reset this demo')}
          </button>
        </div>
      </Card>
      {reset && (
        <Modal
          title={t('Réinitialiser les données fictives ?', 'Reset fictional data?')}
          onClose={() => setReset(false)}
        >
          <p>
            {t(
              'Toutes les modifications et pièces jointes de cette application seront supprimées sur ce navigateur. Les autres sites restent intacts. Les exemples seront recréés avec une nouvelle horloge.',
              'All changes and attachments in this app will be removed from this browser. Other sites are unaffected. The examples will be reseeded with a new clock.',
            )}
          </p>
          <div className="modal-actions">
            <button onClick={() => setReset(false)}>
              {t('Conserver mes changements', 'Keep my changes')}
            </button>
            <button
              className="danger"
              onClick={async () => {
                try {
                  await repository.reset();
                  localStorage.removeItem('peyrieu.actor');
                  localStorage.removeItem('peyrieu.welcome');
                  location.hash = '/home';
                  location.reload();
                } catch {
                  toast(
                    t('Réinitialisation impossible. Réessayez.', 'Reset failed. Please try again.'),
                  );
                }
              }}
            >
              {t('Confirmer la réinitialisation', 'Confirm reset')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
import { canManage as canManageExport } from '../domain/policy';
export function Help() {
  const { s, a, t, run, go } = useApp();
  const [area, setArea] = useState('general');
  const [text, setText] = useState('');
  const observations = s.feedback.filter((f) => f.actor === a.id);
  const steps = [
    [
      'forms',
      t('1. Un dossier de rentrée complet', '1. A complete annual dossier'),
      t(
        'Avec Alice, complétez une démarche pour Louise. Passez à Thomas pour lire la réponse partagée, puis à Camille pour la vérifier. Essayez une correction après l’échéance.',
        'As Alice, complete a form for Louise. Switch to Thomas to read the shared response, then Camille to review it. Try a correction after the deadline.',
      ),
    ],
    [
      'messages',
      t('2. Les bons destinataires', '2. The right participants'),
      t(
        'Répondez à Emma en privé. Thomas ne voit pas cet échange. Avec Nora puis Sam, affectez et traitez la conversation de garderie.',
        'Reply privately to Emma. Thomas cannot see that conversation. As Nora and then Sam, assign and answer the childcare conversation.',
      ),
    ],
    [
      'children',
      t('3. Des photos sous contrôle', '3. Photo permissions in action'),
      t(
        'Avec Emma, ajoutez une image fictive à une publication et identifiez Louise. Avec Alice, retirez le droit au fil de classe. La photo disparaît et une vérification est créée.',
        'As Emma, add a fictional image to an announcement and identify Louise. As Alice, withdraw class-feed permission. The photo disappears and a review task is created.',
      ),
    ],
    [
      'progress',
      t('4. Suivre les progrès', '4. Follow progress'),
      t(
        'Avec Emma, publiez une observation. Alice et Thomas peuvent l’ouvrir et en accuser lecture séparément. Nora et Inès n’y ont aucun accès.',
        'As Emma, publish an observation. Alice and Thomas can open and acknowledge it separately. Nora and Inès have no access.',
      ),
    ],
    [
      'representatives',
      t('5. Donner la parole aux parents', '5. Hear from parents'),
      t(
        'Avec Inès, ouvrez un sujet et partagez une synthèse relue avec Emma. Emma lit uniquement la nouvelle discussion. Répondez à la consultation anonyme avec Alice.',
        'As Inès, start a topic and share a reviewed summary with Emma. Emma can only read the new discussion. Answer the anonymous survey as Alice.',
      ),
    ],
    [
      'calendar',
      t('6. Organiser la semaine', '6. Organise the week'),
      t(
        'Inscrivez un enfant à un événement, proposez votre aide et exportez l’agenda. Déplacez ou annulez l’événement avec l’équipe et exportez sa mise à jour.',
        'RSVP for a child, volunteer and export the calendar. Reschedule or cancel the event as staff and export its update.',
      ),
    ],
    [
      'reservations',
      t('7. Réserver sans action réelle', '7. Book without real-world actions'),
      t(
        'Demandez plusieurs séances, simulez leur confirmation et leur annulation. Les exemples de capacité et de délai sont consultables.',
        'Request several sessions, simulate confirmation and cancellation. Sample capacity and deadline rules are visible.',
      ),
    ],
    [
      'administration',
      t('8. Administrer les accès', '8. Administer access'),
      t(
        'Avec Camille, créez une invitation, simulez son acceptation, importez un CSV et retirez un mandat. Prévisualisez la transition d’année.',
        'As Camille, create and accept an invitation, import a CSV and revoke a mandate. Preview the school-year rollover.',
      ),
    ],
  ];
  return (
    <>
      <PageTitle
        title={t('Bienvenue dans la démo', 'Welcome to the demo')}
        subtitle={t(
          'Une proposition indépendante, à explorer ensemble.',
          'An independent proposal, ready to explore together.',
        )}
      />
      <div className="detail-layout">
        <div className="stack">
          <Card>
            <h2>
              {t(
                'Tout est fictif, les parcours sont interactifs',
                'Fictional data, interactive workflows',
              )}
            </h2>
            <p>
              {t(
                'Aucune adoption, validation ou participation de l’école n’est annoncée. Les adultes, enfants, classes et messages sont fictifs. Aucun compte réel ni signature personnelle n’est utilisé.',
                'No school adoption, endorsement or participation is claimed. Adults, children, classes and messages are fictional. No real accounts or personal signatures are used.',
              )}
            </p>
            <p>
              {t(
                'Les changements restent dans ce navigateur. Les appareils ne communiquent pas entre eux. Les fichiers restent locaux. Aucun paiement, e-mail, réservation réelle, publicité ni suivi analytique.',
                'Changes stay in this browser. Devices do not communicate with each other. Files remain local. No payment, email, real booking, advertising or analytics.',
              )}
            </p>
            <p className="small-print">
              {t(
                'Les informations publiques disponibles sur le personnel sont historiques. Le groupe de démonstration ne prétend pas décrire l’organisation réelle de 2026–2027.',
                'Publicly available staff information is historical. The demonstration does not claim to describe the real 2026–2027 organisation.',
              )}
            </p>
          </Card>
          <Card>
            <h2>{t('Huit parcours à essayer', 'Eight journeys to try')}</h2>
            {steps.map(([route, title, body]) => (
              <div className="help-step" key={route}>
                <strong>{title}</strong>
                <p>{body}</p>
                <button className="text-button" onClick={() => go(route)}>
                  {t('Ouvrir ce module', 'Open this module')}
                </button>
              </div>
            ))}
          </Card>
        </div>
        <aside className="stack">
          <Card>
            <h2>{t('Partagez votre retour', 'Share your feedback')}</h2>
            <p className="small-print">
              {t(
                'Votre retour reste local. Exportez-le pour le partager vous-même. Aucun destinataire caché.',
                'Your feedback stays local. Export it to share it yourself. No hidden recipient.',
              )}
            </p>
            <Field label={t('Module', 'Module')}>
              <select value={area} onChange={(ev) => setArea(ev.target.value)}>
                <option value="general">{t('Ensemble de l’application', 'Whole app')}</option>
                {Object.entries(kindNames).map(([id, label]) => (
                  <option value={id} key={id}>
                    {t(...label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Ce qui aide, ce qui manque', 'What helps, what is missing')}>
              <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={5} />
            </Field>
            <button
              className="primary full"
              onClick={async () => {
                try {
                  await run((s) => feedback(s, a.id, area, text));
                  setText('');
                } catch {}
              }}
            >
              {t('Enregistrer mon retour ici', 'Save my feedback here')}
            </button>
            <button
              className="secondary full"
              onClick={() =>
                download(
                  'retours-peyrieu-demo.csv',
                  csv([
                    [
                      t('Profil', 'Persona'),
                      t('Date', 'Date'),
                      t('Module', 'Module'),
                      t('Retour', 'Feedback'),
                    ],
                    ...observations.map((f) => [a.name, f.at, f.area, f.text]),
                  ]),
                  'text/csv;charset=utf-8',
                )
              }
            >
              {t('Exporter mes retours', 'Export my feedback')} ({observations.length})
            </button>
          </Card>
          <Card>
            <h2>{t('Avant un usage réel', 'Before real operation')}</h2>
            <p>
              {t(
                'L’école et les opérateurs devront convenir des responsabilités, données autorisées, règles de conservation, comptes vérifiés, hébergement approprié, accès serveur, prestataires et support.',
                'The school and operators must agree responsibilities, permitted data, retention rules, verified accounts, appropriate hosting, server permissions, providers and support.',
              )}
            </p>
            <p>
              {t(
                'Ce prototype ne revendique aucune certification juridique, médicale ou de sécurité.',
                'This prototype makes no legal, medical or security certification claim.',
              )}
            </p>
            <button onClick={() => go('settings')}>
              {t('Installation et réglages', 'Installation & settings')}
            </button>
          </Card>
        </aside>
      </div>
    </>
  );
}
