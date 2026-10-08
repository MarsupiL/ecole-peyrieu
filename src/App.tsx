import { useEffect, useRef, useState } from 'react';
import {
  Home as HomeIcon,
  MessageCircle,
  CalendarDays,
  ClipboardList,
  Users,
  BookOpen,
  UtensilsCrossed,
  ChartNoAxesColumn,
  Handshake,
  Settings as SettingsIcon,
  HelpCircle,
  Bell,
  Menu,
  X,
  Newspaper,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { repository } from './data/repository';
import { type State, type Entry } from './domain/types';
import { RuleError } from './domain/engine';
import { authorisedNotices, canAdministrate } from './domain/policy';
import { Context, errors, roles } from './ui/context';
import { Home } from './ui/Home';
import { Forms } from './ui/Forms';
import { Children, Denied } from './ui/Children';
import { Entries, EntryDetail } from './ui/Entries';
import { Messages, Representatives, Requests } from './ui/Communication';
import { Polls } from './ui/Polls';
import { Calendar, Reservations } from './ui/Calendar';
import { Administration } from './ui/Admin';
import { Settings, Notifications, Help } from './ui/Settings';
import type { Kind } from './domain/types';
import { Card, Modal, FilePreview } from './ui/components';
import { useSelectFocus } from './ui/useSelectFocus';
import { ProfileAvatar } from './ui/ProfilePhoto';
import './style.css';
const nav = [
  ['home', 'Accueil', 'Home', HomeIcon],
  ['news', 'Actualités', 'News', Newspaper],
  ['messages', 'Messages', 'Messages', MessageCircle],
  ['calendar', 'Agenda', 'Calendar', CalendarDays],
  ['forms', 'Démarches', 'Forms & requests', ClipboardList],
  ['children', 'Les enfants', 'Children', Users],
  ['progress', 'Progrès', 'Progress', BookOpen],
  ['reservations', 'Périscolaire', 'Services & bookings', UtensilsCrossed],
  ['surveys', 'Consultations', 'Surveys', ChartNoAxesColumn],
  ['representatives', 'Parents délégués', 'Representatives', Handshake],
  ['administration', 'Administration', 'Administration', ShieldCheck],
] as const;
export default function App() {
  useSelectFocus();
  const [s, setS] = useState<State | null>(null);
  const ref = useRef<State | null>(null);
  const queue = useRef(Promise.resolve());
  const pending = useRef(0);
  const [saving, setSaving] = useState(false);
  const [actor, setActor] = useState(() => localStorage.getItem('peyrieu.actor') ?? 'alice');
  const [route, setRoute] = useState(location.hash.slice(2) || 'home');
  const [toast, setToast] = useState('');
  const [fatal, setFatal] = useState('');
  const [menu, setMenu] = useState(false);
  const [welcome, setWelcome] = useState(!localStorage.getItem('peyrieu.welcome'));
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorkerRegistration>();
  useEffect(() => {
    repository
      .load()
      .then((v) => {
        ref.current = v;
        setS(v);
      })
      .catch(() => setFatal('Impossible de lire les données locales.'));
    const hash = () => {
      setRoute(location.hash.slice(2) || 'home');
      setMenu(false);
    };
    window.addEventListener('hashchange', hash);
    const leave = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .then((r) => {
          if (r.waiting) setUpdate(r);
          r.addEventListener('updatefound', () => {
            r.installing?.addEventListener('statechange', () => {
              if (r.waiting && navigator.serviceWorker.controller) setUpdate(r);
            });
          });
        })
        .catch(() => {});
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
  }, []);
  const a = s?.adults.find((a) => a.id === actor) ?? s?.adults[0];
  // Keep existing stored translations/preferences compatible; the interface is French-only.
  const locale = 'fr';
  const t = (fr: string, _en: string) => fr;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('École de Peyrieu · Démo', 'Peyrieu School · Demo');
  }, [locale]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const run = async (fn: (s: State) => State, message?: string) => {
    let error: unknown;
    pending.current++;
    setSaving(true);
    queue.current = queue.current.then(async () => {
      try {
        if (!ref.current) return;
        const next = fn(ref.current);
        await repository.save(next);
        ref.current = next;
        setS(next);
        setToast(message ?? t('Enregistré dans ce navigateur.', 'Saved in this browser.'));
      } catch (e) {
        error = e;
        setToast(
          e instanceof RuleError
            ? errors[e.code]
              ? t(...errors[e.code])
              : e.code
            : t(
                'Enregistrement impossible. Votre saisie est conservée. Vérifiez le stockage disponible.',
                'Unable to save. Your input is preserved. Check available storage.',
              ),
        );
      }
    });
    await queue.current;
    pending.current--;
    setSaving(pending.current > 0);
    if (error) throw error;
  };
  const go = (r: string) => {
    location.hash = `/${r}`;
  };
  const open = (e: Entry) => go(`${e.kind}/${e.id}`);
  if (fatal)
    return (
      <main className="loading">
        <h1>{fatal}</h1>
        <button
          onClick={async () => {
            await repository.reset();
            location.reload();
          }}
        >
          Réinitialiser cette démo
        </button>
      </main>
    );
  if (!s || !a)
    return (
      <main className="loading">
        <img
          className="brand-mark loading-mark"
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt=""
          width="64"
          height="64"
        />
        <h1>Peyrieu</h1>
        <p>Chargement de la démonstration…</p>
      </main>
    );
  const notices = authorisedNotices(s, a).filter((n) => !n.read && !n.queued).length;
  return (
    <Context.Provider value={{ s, a, locale, t, run, go, open, toast: setToast }}>
      <a
        href="#main"
        className="skip-link"
        onClick={(ev) => {
          ev.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('Aller au contenu', 'Skip to content')}
      </a>
      <div className="demo-bar" role="region" aria-label="Mode démonstration">
        <span>
          <span className="demo-pill">DÉMO</span>
          {t(
            'Données fictives · sur ce navigateur uniquement',
            'Fictional data · only in this browser',
          )}
        </span>
        <button onClick={() => go('help')}>{t('À propos de la démo', 'About this demo')}</button>
      </div>
      <div className="app-layout">
        <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
          <a className="brand" href="#/home">
            <img
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="École de Peyrieu · Accueil"
              width="334"
              height="112"
            />
          </a>
          <div className="sidebar-label">{t('MON ESPACE', 'MY WORKSPACE')}</div>
          <nav aria-label={t('Navigation principale', 'Main navigation')}>
            {nav
              .filter(([id]) => id !== 'administration' || canAdministrate(s, a))
              .map(([id, fr, en, Icon]) => (
                <a key={id} href={`#/${id}`} className={route.split('/')[0] === id ? 'active' : ''}>
                  <Icon size={20} />
                  <span>{t(fr, en)}</span>
                  {id === 'messages' &&
                    authorisedNotices(s, a).filter((n) => !n.read && n.kind === 'conversation')
                      .length > 0 && (
                      <span className="nav-count">
                        {
                          authorisedNotices(s, a).filter(
                            (n) => !n.read && n.kind === 'conversation',
                          ).length
                        }
                      </span>
                    )}
                </a>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <a href="#/settings">
              <SettingsIcon size={19} />
              {t('Préférences', 'Preferences')}
            </a>
            <a href="#/help">
              <HelpCircle size={19} />
              {t('Guide de la démo', 'Demo guide')}
            </a>
            <div className="local-status">
              <span>◉</span>
              {offline
                ? t('Hors ligne · données locales', 'Offline · local data')
                : t('Enregistré sur cet appareil', 'Stored on this device')}
              <small>
                {t('Proposition indépendante', 'Independent proposal')} · {s.year}
              </small>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMenu(!menu)}
              aria-label={t('Menu', 'Menu')}
              aria-expanded={menu}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <div className="workspace-label">
              <img
                className="brand-mark"
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt=""
                width="28"
                height="28"
              />
              {t('École de Peyrieu', 'Peyrieu School')}
              <span>/</span>
              <strong>{t(...roles[a.roles.at(-1)!])}</strong>
            </div>
            <div className="topbar-actions">
              {saving && (
                <span className="saving-status" role="status">
                  {t('Enregistrement…', 'Saving…')}
                </span>
              )}
              <label className="persona-picker">
                <span className="sr-only">{t('Profil de démonstration', 'Demo persona')}</span>
                <ProfileAvatar target={{ kind: 'adult', id: a.id }} className="mini" />
                <select
                  aria-label={t('Profil de démonstration', 'Demo persona')}
                  value={a.id}
                  onChange={(e) => {
                    setActor(e.target.value);
                    localStorage.setItem('peyrieu.actor', e.target.value);
                    go('home');
                  }}
                >
                  {s.adults.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {t(...roles[p.roles.at(-1)!])}
                      {p.status !== 'active' ? ` (${p.status})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="notification-button icon-button"
                aria-label={t('Notifications', 'Notifications')}
                onClick={() => go('notifications')}
              >
                <Bell size={20} />
                {notices > 0 && <span>{notices}</span>}
              </button>
            </div>
          </header>
          {offline && (
            <div className="offline-banner">
              <WifiOff size={16} />
              {t(
                'Hors ligne. Les actions locales restent disponibles.',
                'Offline. Local actions remain available.',
              )}
            </div>
          )}
          {update && (
            <div className="update-banner">
              {t(
                'Une nouvelle version est prête. Enregistrez vos brouillons avant de recharger.',
                'An update is ready. Save your drafts before reloading.',
              )}
              <button
                disabled={saving}
                onClick={() => {
                  navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => location.reload(),
                    { once: true },
                  );
                  update.waiting?.postMessage('SKIP_WAITING');
                }}
              >
                {t('Mettre à jour', 'Update')}
              </button>
            </div>
          )}
          <main id="main" tabIndex={-1} key={a.id} className="main-content">
            {a.status === 'active' ? (
              <Routes route={route} />
            ) : (
              <Card>
                <h1>{t('Ce compte n’est pas actif', 'This account is not active')}</h1>
                <p>
                  {t(
                    'La direction peut gérer son statut. Choisissez un autre profil.',
                    'The director can manage its status. Choose another persona.',
                  )}
                </p>
              </Card>
            )}
          </main>
          <nav className="mobile-nav" aria-label={t('Navigation mobile', 'Mobile navigation')}>
            {nav
              .filter(([id]) => ['home', 'messages', 'calendar', 'forms'].includes(id))
              .map(([id, fr, en, Icon]) => (
                <a key={id} href={`#/${id}`} className={route === id ? 'active' : ''}>
                  <Icon size={20} />
                  <span>{t(fr, en)}</span>
                </a>
              ))}
            <button onClick={() => setMenu(!menu)}>
              <Menu size={20} />
              {t('Plus', 'More')}
            </button>
          </nav>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            aria-label={t('Fermer', 'Close')}
            onClick={() => setToast('')}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {welcome && (
        <Modal
          title="Bienvenue"
          onClose={() => {
            localStorage.setItem('peyrieu.welcome', 'yes');
            setWelcome(false);
          }}
        >
          <p>
            Explorez une école fictive. Les changements restent dans ce navigateur. Aucun message ni
            réservation réelle. Ne saisissez aucune donnée personnelle réelle.
          </p>
          <p className="muted">
            Proposition indépendante, sans accord ni participation de l’école.
          </p>
          <button
            className="primary full"
            onClick={() => {
              localStorage.setItem('peyrieu.welcome', 'yes');
              setWelcome(false);
            }}
          >
            Explorer la démo
          </button>
        </Modal>
      )}
    </Context.Provider>
  );
}
function Routes({ route }: { route: string }) {
  const [page, id] = route.split('/');
  if (
    id &&
    ['post', 'form', 'evaluation', 'poll', 'event', 'topic', 'conversation', 'request'].includes(
      page,
    )
  )
    return <EntryDetail key={route} kind={page as Kind} id={id} />;
  switch (page) {
    case 'file':
      return <FilePreview id={id ?? ''} />;
    case 'home':
      return <Home />;
    case 'news':
      return <Entries kind="post" />;
    case 'forms':
      return <Forms />;
    case 'messages':
      return <Messages />;
    case 'children':
      return <Children id={id} />;
    case 'progress':
      return <Entries kind="evaluation" />;
    case 'surveys':
      return <Polls />;
    case 'calendar':
      return <Calendar />;
    case 'reservations':
      return <Reservations />;
    case 'representatives':
      return <Representatives />;
    case 'requests':
      return <Requests />;
    case 'administration':
      return <Administration />;
    case 'settings':
      return <Settings />;
    case 'notifications':
      return <Notifications />;
    case 'help':
      return <Help />;
    default:
      return <Denied />;
  }
}
