import { useState } from 'react';
import { Download, CalendarDays, Users, Link2 } from 'lucide-react';
import { useApp, formatDate, services, statusNames } from './context';
import { Card, PageTitle, Field, Badge, AddButton, Empty, Modal, ExternalLink } from './components';
import {
  visibleEntries,
  canAuthor,
  canManage,
  responseChildren,
  guardianChildren,
  serves,
  guardian,
} from '../domain/policy';
import { rsvp, volunteer, change, bookingAvailability } from '../domain/engine';
import { type Entry, type Service } from '../domain/types';
import { calendar, download, makePdf } from '../domain/exports';
import { localReservations } from '../domain/adapters';
import { Editor, entryDefault } from './Editor';
export function Calendar() {
  const { s, a, t, locale, open } = useApp();
  const [edit, setEdit] = useState(false);
  const [subscribe, setSubscribe] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const events = visibleEntries(s, a, 'event')
    .filter(
      (e) =>
        (filter === 'all' ||
          (filter === 'cancelled' && e.status === 'cancelled') ||
          (filter === 'upcoming' && e.status !== 'cancelled' && (e.end ?? '') > s.clock)) &&
        e.title[locale].toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(s.clock) + i * 86400000));
  return (
    <>
      <PageTitle
        title={t('L’agenda de votre école', 'Your school calendar')}
        subtitle={t(
          'Les dates utiles, pour toute la famille.',
          'Useful dates for the whole family.',
        )}
        action={
          canAuthor(s, a, 'event', entryDefault(s, a, 'event').audience) && (
            <AddButton onClick={() => setEdit(true)}>
              {t('Créer un événement', 'Create event')}
            </AddButton>
          )
        }
      />
      <div className="week-strip">
        {days.map((d, i) => (
          <div key={i} className={`week-day ${i === 0 ? 'today' : ''}`}>
            <span>
              {new Intl.DateTimeFormat(locale, {
                weekday: 'short',
                timeZone: 'Europe/Paris',
              }).format(d)}
            </span>
            <strong>{d.getUTCDate()}</strong>
            {new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'Europe/Paris' }).format(
              d,
            )}
          </div>
        ))}
      </div>
      <div className="toolbar">
        <input
          aria-label={t('Rechercher dans l’agenda', 'Search calendar')}
          placeholder={t('Rechercher un événement…', 'Search events…')}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
        />
        <select
          aria-label={t('Filtrer les événements', 'Filter events')}
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
        >
          <option value="all">{t('Tous les événements', 'All events')}</option>
          <option value="upcoming">{t('À venir', 'Upcoming')}</option>
          <option value="cancelled">{t('Annulés', 'Cancelled')}</option>
        </select>
        <button
          onClick={() =>
            download(
              'agenda-peyrieu-demo.ics',
              calendar(s, a, events, locale, location.href.split('#')[0]),
              'text/calendar;charset=utf-8',
            )
          }
        >
          <Download size={17} />
          {t('Exporter', 'Export')}
        </button>
        <button onClick={() => setSubscribe(true)}>
          <Link2 size={17} />
          {t('S’abonner', 'Subscribe')}
        </button>
      </div>
      <div className="stack">
        {events.map((e) => (
          <Card key={e.id}>
            <div className="row between">
              <div className="row">
                <span className="calendar-date">
                  <small>
                    {e.start &&
                      new Intl.DateTimeFormat(locale, {
                        month: 'short',
                        timeZone: 'Europe/Paris',
                      }).format(new Date(e.start))}
                  </small>
                  <strong>{e.start && new Date(e.start).getUTCDate()}</strong>
                </span>
                <div>
                  <button className="title-button" onClick={() => open(e)}>
                    <h3>{e.title[locale] || e.title.fr}</h3>
                  </button>
                  <small>
                    {formatDate(e.start, locale, !e.allDay)} ·{' '}
                    {e.allDay ? t('Toute la journée', 'All day') : 'Europe/Paris'}
                    {e.recurrence === 'weekly' && ` · ${t('4 semaines', '4 weeks')}`}
                  </small>
                </div>
              </div>
              <Badge value={e.status} />
            </div>
          </Card>
        ))}
      </div>
      {!events.length && <Empty />}
      {edit && <Editor kind="event" onClose={() => setEdit(false)} />}{' '}
      {subscribe && <Subscription onClose={() => setSubscribe(false)} />}
    </>
  );
}
export function EventDetail({ e }: { e: Entry }) {
  const { s, a, t, locale, run } = useApp();
  const kids = responseChildren(s, a, e);
  const manager = canManage(s, a, e);
  return (
    <Card>
      <h2>
        <CalendarDays size={20} /> {formatDate(e.start, locale, !e.allDay)} –{' '}
        {formatDate(e.end, locale, !e.allDay)}
      </h2>
      <p>
        {e.allDay
          ? t(
              'Journée entière ; la date de fin est exclusive.',
              'All-day event; the end date is exclusive.',
            )
          : 'Europe/Paris'}{' '}
        · {e.location}
      </p>
      {e.recurrence === 'weekly' && (
        <p>{t('Chaque semaine pendant quatre semaines.', 'Every week for four weeks.')}</p>
      )}
      {e.status === 'cancelled' && (
        <p className="notice-inline warning">
          {t(
            'Événement annulé. L’export conserve son identité et indique l’annulation.',
            'Event cancelled. The export retains its identity and cancellation status.',
          )}
        </p>
      )}
      <button
        onClick={() =>
          download(
            'evenement-demo.ics',
            calendar(s, a, [e], locale, location.href.split('#')[0]),
            'text/calendar;charset=utf-8',
          )
        }
      >
        <Download size={17} />
        {t('Ajouter à mon calendrier', 'Add to my calendar')}
      </button>
      <p className="small-print padded">
        {t(
          'L’import est un instantané. Les prochaines modifications nécessitent un nouvel export.',
          'An import is a snapshot. Later changes require a new export.',
        )}
      </p>
      {e.status === 'published' && kids.length > 0 && (
        <>
          <div className="divider" />
          <h3>{t('Participation de mes enfants', 'My children’s attendance')}</h3>
          {kids.map((c) => (
            <Field key={c.id} label={c.name}>
              <select
                value={e.rsvps[c.id] ?? ''}
                onChange={(ev) => {
                  const value = ev.currentTarget.value;
                  void run((s) => rsvp(s, a.id, e.id, c.id, value)).catch(() => {});
                }}
              >
                <option value="">{t('Sans réponse', 'No response')}</option>
                <option value="yes">{t('Oui', 'Yes')}</option>
                <option value="no">{t('Non', 'No')}</option>
                <option value="maybe">{t('À confirmer', 'To be confirmed')}</option>
              </select>
            </Field>
          ))}
          <h3>
            <Users size={18} /> {t('Donner un coup de main', 'Lend a hand')}
          </h3>
          <p>
            {Math.max(0, e.capacity - e.volunteers.length)} / {e.capacity}{' '}
            {t('places disponibles', 'places available')}
          </p>
          <button onClick={() => void run((s) => volunteer(s, a.id, e.id)).catch(() => {})}>
            {e.volunteers.includes(a.id)
              ? t('Retirer mon inscription', 'Withdraw my offer')
              : t('Je propose mon aide', 'I can help')}
          </button>
        </>
      )}
      {manager && (
        <>
          <div className="divider" />
          <h3>
            {t('Participants (équipe organisatrice uniquement)', 'Participants (organisers only)')}
          </h3>
          {Object.entries(e.rsvps).map(([id, v]) => (
            <p key={id}>
              {s.children.find((c) => c.id === id)?.name} ·{' '}
              {v === 'yes'
                ? t('Oui', 'Yes')
                : v === 'no'
                  ? t('Non', 'No')
                  : t('À confirmer', 'To confirm')}
            </p>
          ))}
          <h3>{t('Bénévoles', 'Volunteers')}</h3>
          {e.volunteers.map((id) => (
            <p key={id}>{s.adults.find((p) => p.id === id)?.name}</p>
          ))}
        </>
      )}
    </Card>
  );
}
export function Subscription({ onClose }: { onClose: () => void }) {
  const { s, a, t, run, toast } = useApp();
  const token = s.feedTokens[a.id];
  const sample = new URL(`${import.meta.env.BASE_URL}sample-calendar.ics`, location.origin).href;
  return (
    <Modal
      title={t('Votre agenda, où vous voulez', 'Your calendar, where you need it')}
      onClose={onClose}
    >
      <h3>{t('1. Flux public d’exemple', '1. Public sample feed')}</h3>
      <p>
        {t(
          'Ce flux contient un planning fictif fixe. Il ne reflète pas vos modifications dans ce navigateur. Aucun nom d’enfant ni donnée privée.',
          'This feed contains a fixed fictional schedule. It does not reflect changes in this browser. No child names or private data.',
        )}
      </p>
      <a className="button secondary" href={sample}>
        {t('Télécharger le flux exemple', 'Download sample feed')}
      </a>
      <button
        onClick={() =>
          void navigator.clipboard
            .writeText(sample)
            .then(() => toast(t('Adresse d’exemple copiée.', 'Sample address copied.')))
        }
      >
        {t('Copier l’adresse du flux exemple', 'Copy sample feed address')}
      </button>
      {location.hostname === '127.0.0.1' && (
        <p className="notice-inline warning">
          {t(
            'Sur cette prévisualisation locale, l’adresse n’est pas accessible aux services de calendrier distants. Utilisez l’adresse HTTPS après publication.',
            'On this local preview, the address is not accessible to external calendar services. Use its HTTPS address after deployment.',
          )}
        </p>
      )}
      <h3 className="padded">
        {t('2. Abonnement personnel · simulation', '2. Personal subscription · simulation')}
      </h3>
      <p>
        {t(
          'Une future version connectée fournira une adresse privée, révocable et limitée à vos accès. Le jeton ci-dessous est un exemple sans service distant.',
          'A connected version would provide a private, revocable URL limited to your access. The token below is an example with no remote service.',
        )}
      </p>
      <pre>{token ? `DEMO-ONLY:${token}` : t('Aucun jeton actif', 'No active token')}</pre>
      <div className="row">
        <button
          onClick={() =>
            void run((s) =>
              change(s, a.id, 'feedToken', 'self', (n) => {
                n.feedTokens[a.id] = crypto.randomUUID();
              }),
            ).catch(() => {})
          }
        >
          {token
            ? t('Régénérer le jeton fictif', 'Regenerate demo token')
            : t('Créer un jeton fictif', 'Create demo token')}
        </button>
        {token && (
          <>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(`DEMO-ONLY:${token}`)
                  .then(() => toast(t('Jeton fictif copié.', 'Demo token copied.')))
              }
            >
              {t('Copier', 'Copy')}
            </button>
            <button
              className="danger"
              onClick={() =>
                void run((s) =>
                  change(s, a.id, 'revokeFeed', 'self', (n) => {
                    delete n.feedTokens[a.id];
                  }),
                ).catch(() => {})
              }
            >
              {t('Révoquer', 'Revoke')}
            </button>
          </>
        )}
      </div>
      <p className="small-print padded">
        {t(
          'Dans votre calendrier, choisissez « Ajouter par URL » pour le flux public hébergé. Les rafraîchissements dépendent du fournisseur et ne sont pas instantanés. Ne partagez jamais l’adresse personnelle d’un futur service connecté.',
          'In your calendar, choose “Add by URL” for the hosted public feed. Refresh timing depends on the provider and is not instant. Never share a personal feed URL from a future connected service.',
        )}
      </p>
    </Modal>
  );
}
export function Reservations() {
  const { s, a, t, locale, run } = useApp();
  const kids = guardianChildren(s, a);
  const [childId, setChild] = useState(kids[0]?.id ?? '');
  const [service, setService] = useState<Service>('canteen');
  const [session, setSession] = useState('midday');
  const [date, setDate] = useState(
    new Date(Date.parse(s.clock) + 2 * 86400000).toISOString().slice(0, 10),
  );
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 4, 5]);
  const [review, setReview] = useState(false);
  const dates = repeat
    ? Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${date}T12:00:00Z`) + i * 86400000))
        .filter((d) => weekdays.includes(d.getUTCDay()))
        .map((d) => d.toISOString().slice(0, 10))
    : [date];
  const bookings = s.bookings
    .filter((b) =>
      s.children.some(
        (c) =>
          c.id === b.childId &&
          (guardian(s, a, c) || (serves(s, a, c) && a.services.includes(b.service))),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageTitle
        title={t('Les temps autour de l’école', 'Before, during and after school')}
        subtitle={t(
          'Cantine, garderie et transport · réservations fictives.',
          'School meals, childcare and transport · fictional bookings.',
        )}
        action={
          <ExternalLink href="https://app.monespacefamille.fr/family/reservations">
            {t('Ouvrir Mon Espace Famille', 'Open Mon Espace Famille')}
          </ExternalLink>
        }
      />
      <p className="notice-inline warning">
        {t(
          'Simulation locale uniquement. Mon Espace Famille reste la référence pour toute réservation, annulation et facturation réelles.',
          'Local simulation only. Mon Espace Famille remains the system of record for real bookings, cancellations and billing.',
        )}
      </p>
      <div className="detail-layout">
        <div className="stack">
          {kids.length > 0 && (
            <Card>
              <h2>{t('Préparer une réservation', 'Plan a booking')}</h2>
              <div className="form-grid">
                <Field label={t('Enfant', 'Child')}>
                  <select value={childId} onChange={(ev) => setChild(ev.target.value)}>
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('Service', 'Service')}>
                  <select
                    value={service}
                    onChange={(ev) => {
                      setService(ev.target.value as Service);
                      setSession(ev.target.value === 'canteen' ? 'midday' : 'morning');
                    }}
                  >
                    {(Object.keys(services) as Service[]).map((v) => (
                      <option key={v} value={v}>
                        {t(...services[v])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('Date de début', 'Start date')}>
                  <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
                </Field>
                <Field label={t('Séance', 'Session')}>
                  <select value={session} onChange={(ev) => setSession(ev.target.value)}>
                    {service === 'canteen' ? (
                      <option value="midday">{t('Midi', 'Lunchtime')}</option>
                    ) : (
                      <>
                        <option value="morning">{t('Matin', 'Morning')}</option>
                        <option value="evening">{t('Soir', 'Evening')}</option>
                      </>
                    )}
                  </select>
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(ev) => setRepeat(ev.target.checked)}
                />
                {t('Répéter sur deux semaines', 'Repeat over two weeks')}
              </label>
              {repeat && (
                <div className="checks">
                  {[1, 2, 3, 4, 5].map((d, i) => (
                    <label className="check" key={d}>
                      <input
                        type="checkbox"
                        checked={weekdays.includes(d)}
                        onChange={(ev) =>
                          setWeekdays(
                            ev.target.checked ? [...weekdays, d] : weekdays.filter((v) => v !== d),
                          )
                        }
                      />
                      {locale === 'fr'
                        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'][i]
                        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i]}
                    </label>
                  ))}
                </div>
              )}
              <button className="primary full" onClick={() => setReview(true)}>
                {t('Vérifier les disponibilités', 'Review availability')}
              </button>
            </Card>
          )}
          <Card>
            <h2>{t('Réservations de la démo', 'Demo bookings')}</h2>
            {bookings.map((b) => (
              <div className="mini-card" key={b.id}>
                <div className="row between">
                  <strong>
                    {s.children.find((c) => c.id === b.childId)?.name} · {t(...services[b.service])}
                  </strong>
                  <Badge value={b.status} />
                </div>
                <p>
                  {formatDate(b.date, locale)} ·{' '}
                  {b.session === 'midday'
                    ? t('Midi', 'Lunchtime')
                    : b.session === 'morning'
                      ? t('Matin', 'Morning')
                      : t('Soir', 'Evening')}
                </p>
                <div className="row">
                  {b.status === 'requested' && (
                    <button
                      className="primary"
                      onClick={() =>
                        void run((s) => localReservations.confirm(s, a.id, b.id)).catch(() => {})
                      }
                    >
                      {t(
                        'Simuler la confirmation du prestataire',
                        'Simulate provider confirmation',
                      )}
                    </button>
                  )}
                  {b.status === 'confirmed' && (
                    <button
                      onClick={() =>
                        void run((s) => localReservations.requestCancellation(s, a.id, b.id)).catch(
                          () => {},
                        )
                      }
                    >
                      {t('Demander l’annulation', 'Request cancellation')}
                    </button>
                  )}
                  {b.status === 'cancellationRequested' && (
                    <button
                      onClick={() =>
                        void run((s) => localReservations.confirmCancellation(s, a.id, b.id)).catch(
                          () => {},
                        )
                      }
                    >
                      {t('Simuler l’annulation confirmée', 'Simulate confirmed cancellation')}
                    </button>
                  )}
                  {b.status === 'requested' && (
                    <button
                      onClick={() =>
                        void run((s) => localReservations.confirmCancellation(s, a.id, b.id)).catch(
                          () => {},
                        )
                      }
                    >
                      {t('Retirer', 'Withdraw')}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      download(
                        'recu-reservation-fictive.pdf',
                        makePdf(
                          t('Réservation fictive', 'Fictional booking'),
                          [
                            s.children.find((c) => c.id === b.childId)!.name,
                            t(...services[b.service]),
                            formatDate(b.date, locale),
                            t(...statusNames[b.status]),
                            t(
                              'Aucune réservation réelle, aucun paiement.',
                              'No real booking or payment.',
                            ),
                          ],
                          locale,
                        ),
                      )
                    }
                  >
                    {t('Reçu PDF', 'PDF receipt')}
                  </button>
                </div>
                {b.history.length > 0 && (
                  <small>
                    {t('Historique', 'History')}:{' '}
                    {b.history
                      .map((line) => {
                        const [status, at] = line.split(' · ');
                        return `${statusNames[status] ? t(...statusNames[status]) : status} · ${formatDate(at, locale, true)}`;
                      })
                      .join(' / ')}
                  </small>
                )}
              </div>
            ))}
            {!bookings.length && <Empty />}
          </Card>
        </div>
        <aside>
          <Card>
            <h2>{t('Règles d’exemple', 'Illustrative rules')}</h2>
            <p>
              {t(
                'Demandes et annulations : au moins 24 h avant 8 h environ le jour du service. Capacité fictive : 12 places. Cantine complète le mercredi dans cet exemple.',
                'Requests and cancellations: at least 24 hours before approximately 8 am on the service day. Fictional capacity: 12 places. Wednesday lunches are full in this example.',
              )}
            </p>
            <p className="small-print">
              {t(
                'Ces règles ne sont pas celles de Peyrieu. Une modification se démontre en demandant l’annulation puis une nouvelle réservation. Aucun tarif réel n’est affiché.',
                'These are not Peyrieu’s actual rules. Demonstrate a change by requesting cancellation and making a new booking. No real prices are shown.',
              )}
            </p>
          </Card>
        </aside>
      </div>
      {review && (
        <Modal
          title={t('Vérifier avant de demander', 'Review before requesting')}
          onClose={() => setReview(false)}
        >
          <h3>
            {kids.find((c) => c.id === childId)?.name} · {t(...services[service])}
          </h3>
          {dates.map((d) => (
            <div className="row between padded" key={d}>
              <span>{formatDate(d, locale)}</span>
              <Badge value={bookingAvailability(s, childId, service, d)} />
            </div>
          ))}
          <p>
            {t(
              'Seules les dates disponibles seront demandées. La confirmation du prestataire restera à simuler.',
              'Only available dates will be requested. Provider confirmation must then be simulated.',
            )}
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await run((s) =>
                  localReservations.request(
                    s,
                    a.id,
                    childId,
                    service,
                    dates.filter(
                      (d) => bookingAvailability(s, childId, service, d) === 'available',
                    ),
                    session,
                  ),
                );
                setReview(false);
              } catch {}
            }}
          >
            {t('Confirmer la demande fictive', 'Confirm fictional request')}
          </button>
        </Modal>
      )}
    </>
  );
}
