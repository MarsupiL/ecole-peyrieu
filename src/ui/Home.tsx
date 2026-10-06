import { useState } from 'react';
import type { Entry } from '../domain/types';
import {
  ArrowUpRight,
  ClipboardCheck,
  CalendarDays,
  MessageCircle,
  BookOpen,
  Sun,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useApp, formatDate } from './context';
import {
  visibleEntries,
  guardianChildren,
  canReadSubmission,
  authorisedNotices,
  canManage,
  childrenFor,
  responseChildren,
} from '../domain/policy';
import { Card, PageTitle, EntryCard, AudienceLabel, Empty } from './components';
export function Home() {
  const { s, a, t, locale, go, open } = useApp();
  const kids = guardianChildren(s, a);
  const [selected, setSelected] = useState('all');
  const selectedChild = kids.find((c) => c.id === selected);
  const matches = (e: Entry) =>
    !selectedChild ||
    e.childId === selected ||
    e.audience.type === 'school' ||
    (e.audience.type === 'class' && e.audience.ids.includes(selectedChild.classId)) ||
    (e.audience.type === 'service' &&
      selectedChild.services.some((v) => e.audience.ids.includes(v))) ||
    (e.audience.type === 'individual' && e.audience.ids.includes(a.id));
  const forms = visibleEntries(s, a, 'form').filter(
    (e) => ['published', 'open'].includes(e.status) && matches(e),
  );
  const events = visibleEntries(s, a, 'event')
    .filter((e) => e.status === 'published' && (e.end ?? '') >= s.clock && matches(e))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const reports = visibleEntries(s, a, 'evaluation').filter(
    (e) => selected === 'all' || e.childId === selected,
  );
  const tasks = s.tasks.filter((x) => x.staff.includes(a.id) && x.status === 'pending');
  const notices = authorisedNotices(s, a).filter((n) => !n.read);
  const work = kids.length
    ? forms.filter((f) =>
        responseChildren(s, a, f).some(
          (c) =>
            (selected === 'all' || selected === c.id) &&
            !s.submissions.some(
              (x) =>
                x.formId === f.id &&
                (f.unit === 'adult' ? x.adultId === a.id : x.childId === c.id) &&
                !x.draft &&
                canReadSubmission(s, a, x),
            ),
        ),
      )
    : forms.filter((e) => canManage(s, a, e));
  const posts = visibleEntries(s, a, 'post')
    .filter((e) => e.status === 'published' && matches(e))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  return (
    <>
      <PageTitle
        title={t(`Bonjour ${a.name.split(' ')[0]},`, `Hello ${a.name.split(' ')[0]},`)}
        subtitle={t('Voici les nouvelles de votre école.', 'Here is the latest from your school.')}
        action={
          <span className="date-chip">
            <Sun size={19} />
            {formatDate(s.clock, locale)}
          </span>
        }
      />
      <div className="child-tabs">
        <button
          className={`child-chip ${selected === 'all' ? 'selected' : ''}`}
          aria-pressed={selected === 'all'}
          onClick={() => setSelected('all')}
        >
          {t('Vue d’ensemble', 'Overview')}
        </button>
        {kids.map((c, i) => (
          <button
            key={c.id}
            className={`child-chip ${selected === c.id ? 'selected' : ''}`}
            aria-pressed={selected === c.id}
            onClick={() => setSelected(c.id)}
          >
            <span className={`avatar mini tint-${i}`}>{c.name[0]}</span>
            {c.name.split(' ')[0]}
            <small>{s.classes.find((g) => g.id === c.classId)?.name}</small>
          </button>
        ))}
        <span className="year-label">{s.year}</span>
      </div>
      <div className="stats">
        <button className="stat" onClick={() => go('forms')}>
          <span className="stat-icon amber">
            <ClipboardCheck size={22} />
          </span>
          <span>
            <strong>{work.length}</strong>
            <span>{t('Démarches à suivre', 'Forms to follow up')}</span>
          </span>
        </button>
        <button className="stat" onClick={() => go('messages')}>
          <span className="stat-icon blue">
            <MessageCircle size={22} />
          </span>
          <span>
            <strong>{notices.filter((n) => n.kind === 'conversation').length}</strong>
            <span>{t('Messages non lus', 'Unread messages')}</span>
          </span>
        </button>
        <button className="stat" onClick={() => go('calendar')}>
          <span className="stat-icon green">
            <CalendarDays size={22} />
          </span>
          <span>
            <strong>{events.length}</strong>
            <span>{t('Rendez-vous à venir', 'Upcoming events')}</span>
          </span>
        </button>
        <button className="stat" onClick={() => go(kids.length ? 'progress' : 'children')}>
          <span className="stat-icon purple">
            <BookOpen size={22} />
          </span>
          <span>
            <strong>
              {kids.length
                ? reports.filter((e) => e.status === 'published' && matches(e)).length
                : childrenFor(s, a).length}
            </strong>
            <span>
              {kids.length
                ? t('Nouvelles des progrès', 'Progress updates')
                : t('Enfants accompagnés', 'Children in your care')}
            </span>
          </span>
        </button>
      </div>
      <div className="home-grid">
        <div className="stack">
          <Card className="action-card">
            <div className="section-title">
              <h2>{t('À ne pas oublier', 'On your to-do list')}</h2>
              <span className="counter">{work.length + tasks.length}</span>
            </div>
            {work.slice(0, 3).map((e) => (
              <button className="action-row" key={e.id} onClick={() => open(e)}>
                <span className="document-icon">
                  <FileText size={21} />
                </span>
                <span>
                  <strong>{e.title[locale] || e.title.fr}</strong>
                  <small>
                    {t('Avant le', 'Due')} {formatDate(e.deadline, locale)} ·{' '}
                    <AudienceLabel e={e} />
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </button>
            ))}
            {tasks.map((task) => (
              <button key={task.id} className="action-row" onClick={() => go('notifications')}>
                <ClipboardCheck />
                <span>
                  {t('Une vérification vous attend', 'A review needs your attention')}
                  <small>
                    {task.type === 'care'
                      ? t('Informations pratiques', 'Care information')
                      : task.type === 'photo'
                        ? t('Autorisations photo', 'Photo permissions')
                        : task.type === 'report'
                          ? t('Signalement', 'Report')
                          : t('Correction', 'Correction')}
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </button>
            ))}
            {!work.length && !tasks.length && (
              <p className="notice-inline">
                <CheckCircle2 size={18} />
                {t('Tout est à jour.', 'You’re all caught up.')}
              </p>
            )}
          </Card>
          <div className="section-title">
            <h2>{t('Le fil de l’école', 'School news')}</h2>
            <button className="text-button" onClick={() => go('news')}>
              {t('Tout voir', 'View all')}
            </button>
          </div>
          {posts.slice(0, 3).map((e) => (
            <EntryCard key={e.id} e={e} />
          ))}
        </div>
        <aside className="stack">
          <Card className="agenda-card">
            <div className="section-title">
              <h2>{t('Les prochains jours', 'Coming up')}</h2>
              <CalendarDays size={20} />
            </div>
            {events.slice(0, 3).map((e) => (
              <button className="agenda-row" key={e.id} onClick={() => open(e)}>
                <span className="calendar-date">
                  <small>
                    {new Intl.DateTimeFormat(locale, {
                      month: 'short',
                      timeZone: 'Europe/Paris',
                    }).format(new Date(e.start!))}
                  </small>
                  <strong>{new Date(e.start!).getUTCDate()}</strong>
                </span>
                <span>
                  <strong>{e.title[locale] || e.title.fr}</strong>
                  <small>
                    <AudienceLabel e={e} />
                  </small>
                </span>
              </button>
            ))}
            {!events.length && <Empty />}
            <button className="secondary full" onClick={() => go('calendar')}>
              {t('Ouvrir l’agenda', 'Open calendar')}
            </button>
          </Card>
          <Card className="demo-card">
            <span className="eyebrow">
              {t('PRENEZ UN AUTRE POINT DE VUE', 'TRY ANOTHER PERSPECTIVE')}
            </span>
            <h2>{t('Une école, plusieurs regards.', 'One school, many perspectives.')}</h2>
            <p>
              {t(
                'Passez du parent à l’équipe pour découvrir la suite de chaque démarche.',
                'Switch from parent to staff to see the other side of every workflow.',
              )}
            </p>
            <div className="avatar-group">
              {s.adults
                .filter((x) => x.status === 'active')
                .slice(0, 5)
                .map((p, i) => (
                  <span className={`avatar tint-${i % 4}`} key={p.id}>
                    {p.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                ))}
            </div>
            <button className="text-button" onClick={() => go('help')}>
              {t('Explorer les scénarios', 'Explore the scenarios')}
              <ArrowUpRight size={16} />
            </button>
          </Card>
        </aside>
      </div>
    </>
  );
}
