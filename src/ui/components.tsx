import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type InputHTMLAttributes,
  type RefAttributes,
} from 'react';
import { X, Download, Paperclip, ArrowUpRight, Lock, Plus } from 'lucide-react';
import { useApp, statusNames, services, formatDate, errors } from './context';
import { type Entry, type Attachment, uid } from '../domain/types';
import { canReadFile, canRead, canAuthor, guardian } from '../domain/policy';
import { change, requireRule } from '../domain/engine';
import { validateFile, download } from '../domain/exports';
import { repository } from '../data/repository';
export function DateBadge({ value }: { value: string }) {
  const { locale } = useApp();
  const parts = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Europe/Paris',
  }).formatToParts(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
  return (
    <time className="calendar-date" dateTime={value} aria-label={formatDate(value, locale)}>
      <span className="calendar-month">
        {parts.find((part) => part.type === 'month')?.value.replace(/\.$/, '')}
      </span>
      <span className="calendar-day">{parts.find((part) => part.type === 'day')?.value}</span>
    </time>
  );
}
export function Badge({ value }: { value: string }) {
  const { t } = useApp();
  return (
    <span className={`badge badge-${value}`}>
      {statusNames[value] ? t(...statusNames[value]) : value}
    </span>
  );
}
export function Empty({ text }: { text?: string }) {
  const { t } = useApp();
  return (
    <div className="empty">
      <span>○</span>
      <p>{text ?? t('Rien à afficher pour le moment.', 'Nothing to show yet.')}</p>
    </div>
  );
}
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function FormSelect({
  control,
  id,
}: {
  control: ReactElement<SelectHTMLAttributes<HTMLSelectElement> & RefAttributes<HTMLSelectElement>>;
  id: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const [text, setText] = useState('');
  // The real select retains native focus, keyboard navigation and mobile pickers.
  // Its visible value can wrap, including after a controlled value/locale change.
  useLayoutEffect(() => {
    setText(ref.current?.selectedOptions[0]?.textContent ?? '');
  });
  return (
    <div className="select-control">
      {cloneElement(control, {
        id,
        ref,
        onChange: (event) => {
          setText(event.currentTarget.selectedOptions[0]?.textContent ?? '');
          control.props.onChange?.(event);
        },
      })}
      <span className="select-value" aria-hidden="true">
        {text}
      </span>
    </div>
  );
}
function FormFile({
  control,
  id,
}: {
  control: ReactElement<InputHTMLAttributes<HTMLInputElement>>;
  id: string;
}) {
  const [name, setName] = useState('');
  return (
    <div className="file-select">
      <span className="file-select-label" aria-hidden="true">
        Choisir un fichier
      </span>
      <span className="file-select-name" aria-hidden="true">
        {name || 'Aucun fichier sélectionné'}
      </span>
      {cloneElement(control, {
        id,
        onChange: async (event) => {
          const input = event.currentTarget;
          setName(input.files?.[0]?.name ?? '');
          await control.props.onChange?.(event);
          setName(input.files?.[0]?.name ?? '');
        },
      })}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  const nodes = Children.toArray(children);
  const index = nodes.findIndex(
    (c) =>
      isValidElement(c) &&
      typeof c.type === 'string' &&
      ['input', 'textarea', 'select'].includes(c.type),
  );
  return (
    <div className={`field ${className}`}>
      {index >= 0 ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
      {nodes.map((c, i) => {
        if (i !== index) return c;
        if (
          isValidElement<InputHTMLAttributes<HTMLInputElement>>(c) &&
          c.type === 'input' &&
          c.props.type === 'file'
        )
          return <FormFile key={i} id={id} control={c} />;
        if (isValidElement(c) && c.type === 'select')
          return (
            <FormSelect
              key={i}
              id={id}
              control={c as ReactElement<SelectHTMLAttributes<HTMLSelectElement>>}
            />
          );
        return cloneElement(c as ReactElement<{ id?: string }>, { id });
      })}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    d?.showModal();
    return () => {
      d?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label={useApp().t('Fermer', 'Close')}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function AudienceLabel({ e }: { e: Entry }) {
  const { s, t } = useApp();
  return (
    <span>
      {e.audience.type === 'school'
        ? t('Toute l’école', 'Whole school')
        : e.audience.type === 'class'
          ? e.audience.ids.map((id) => s.classes.find((c) => c.id === id)?.name).join(' · ')
          : e.audience.type === 'service'
            ? e.audience.ids.map((id) => (services[id] ? t(...services[id]) : id)).join(' · ')
            : t('Destinataires nommés', 'Named recipients')}
    </span>
  );
}
export function EntryCard({ e, onClick }: { e: Entry; onClick?: () => void }) {
  const { s, locale, t, open } = useApp();
  return (
    <article className="card entry-card">
      <div className="row between">
        <span className="eyebrow">
          <AudienceLabel e={e} />
        </span>
        <Badge value={e.status} />
      </div>
      <button className="title-button" onClick={onClick ?? (() => open(e))}>
        <h3>{e.title[locale] || e.title.fr}</h3>
      </button>
      <p className="clamp">{e.body[locale] || e.body.fr}</p>
      <div className="row between meta">
        <span>{s.adults.find((a) => a.id === e.author)?.name}</span>
        <span>
          {formatDate(e.deadline ?? e.start ?? e.updated, locale)}
          {e.version > 1 && ` · ${t('Modifié', 'Edited')}`}
        </span>
      </div>
    </article>
  );
}
export function FileButton({ file }: { file: Attachment }) {
  const { s, a, t, toast } = useApp();
  const allowed = canReadFile(s, a, file);
  return allowed ? (
    <button
      className="file-button"
      onClick={async () => {
        const blob = await repository.blob(file.id);
        if (blob) download(file.name, blob);
        else toast(t('Fichier indisponible.', 'File unavailable.'));
      }}
    >
      <Paperclip size={17} />
      <span>
        {file.name}
        <small>{Math.ceil(file.size / 1024)} Ko</small>
      </span>
      <Download size={16} />
    </button>
  ) : null;
}
export function Files({ ids }: { ids: string[] }) {
  const { s } = useApp();
  return (
    <div className="file-list">
      {ids.map((id) => {
        const f = s.attachments.find((f) => f.id === id);
        return f ? <FileButton key={id} file={f} /> : null;
      })}
    </div>
  );
}
export function Upload({
  entry,
  childId,
  restricted = false,
  onUpload,
  label,
}: {
  entry?: Entry;
  childId?: string;
  restricted?: boolean;
  onUpload: (id: string) => void;
  label?: string;
}) {
  const { a, t, run, toast } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Field
      label={label ?? t('Joindre un fichier fictif', 'Attach a fictional file')}
      hint={t(
        'PDF, JPEG, PNG, WebP · 10 Mo maximum · conservé ici',
        'PDF, JPEG, PNG, WebP · maximum 10 MB · stored here',
      )}
    >
      <input
        type="file"
        disabled={busy}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={async (ev) => {
          const f = ev.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const type = await validateFile(f);
            const id = uid();
            await repository.putBlob(id, f);
            await run((s) =>
              change(s, a.id, 'attachment', entry?.id ?? childId ?? '', (n, actor) => {
                if (entry)
                  requireRule(
                    n.entries.some((e) => e.id === entry.id && canRead(n, actor, e)) ||
                      canAuthor(n, actor, entry.kind, entry.audience, entry.childId),
                  );
                if (childId)
                  requireRule(n.children.some((c) => c.id === childId && guardian(n, actor, c)));
                n.attachments.push({
                  id,
                  name: f.name,
                  type,
                  size: f.size,
                  owner: a.id,
                  entryId: entry?.id,
                  childId,
                  restricted,
                  at: n.clock,
                });
                if (childId && restricted)
                  n.children.find((c) => c.id === childId)!.evidence.push(id);
              }),
            );
            onUpload(id);
          } catch (e) {
            const code = e instanceof Error ? e.message : '';
            toast(
              errors[code]
                ? t(...errors[code])
                : t('Impossible de conserver le fichier.', 'Unable to save the file.'),
            );
          } finally {
            setBusy(false);
            ev.target.value = '';
          }
        }}
      />
    </Field>
  );
}
export function Photo({ e }: { e: Entry }) {
  const { s, a, t } = useApp();
  const [url, setUrl] = useState('');
  const file = s.attachments.find((f) => f.id === e.photoFile);
  const allowed = file && canReadFile(s, a, file);
  useEffect(() => {
    let disposed = false,
      objectUrl = '';
    setUrl('');
    if (allowed && file)
      repository.blob(file.id).then((blob) => {
        if (blob && !disposed) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [allowed, file?.id]);
  return url ? (
    <img
      className="post-photo"
      src={url}
      alt={t('Illustration fictive de la publication', 'Fictional publication illustration')}
    />
  ) : e.photoFile ? (
    <p className="notice-inline">
      <Lock size={16} />
      {t(
        'Photo masquée selon les autorisations actuelles.',
        'Photo hidden under current permissions.',
      )}
    </p>
  ) : null;
}
export const AddButton = ({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button className="primary" onClick={onClick} disabled={disabled}>
    <Plus size={18} />
    {children}
  </button>
);
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="button secondary" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function FilePreview({ id }: { id: string }) {
  const { s, a, t } = useApp();
  const f = s.attachments.find((f) => f.id === id);
  const allowed = f && canReadFile(s, a, f);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    if (f && allowed)
      repository.blob(f.id).then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, allowed]);
  if (!allowed || !f)
    return (
      <Card>
        <h1>{t('Accès indisponible', 'Access unavailable')}</h1>
        <p>
          {t(
            'Ce fichier n’est pas autorisé pour ce profil.',
            'This file is not authorised for this persona.',
          )}
        </p>
      </Card>
    );
  return (
    <Card>
      <h1>{f.name}</h1>
      {url && f.type.startsWith('image/') ? (
        <img
          className="post-photo"
          src={url}
          alt={t('Aperçu du fichier fictif', 'Fictional file preview')}
        />
      ) : (
        <p>
          {t(
            'Le PDF se télécharge pour consultation dans votre lecteur.',
            'Download the PDF to view it in your reader.',
          )}
        </p>
      )}
      <FileButton file={f} />
    </Card>
  );
}
