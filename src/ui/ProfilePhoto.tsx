import { useEffect, useState } from 'react';
import { useApp } from './context';
import { Field } from './components';
import type { ProfileTarget } from '../domain/types';
import { uid } from '../domain/types';
import { canReadFile, canManageProfilePhoto, profileRecord } from '../domain/policy';
import { setProfilePhoto, requireRule } from '../domain/engine';
import { validateFile } from '../domain/exports';
import { repository } from '../data/repository';

export function ProfileAvatar({
  target,
  className = '',
}: {
  target: ProfileTarget;
  className?: string;
}) {
  const { s, a } = useApp();
  const record = profileRecord(s, target);
  const file = s.attachments.find(
    (f) =>
      f.id === record?.photoId && f.profile?.kind === target.kind && f.profile.id === target.id,
  );
  const photoId = file && canReadFile(s, a, file) ? file.id : undefined;
  const [image, setImage] = useState<{ id: string; url: string }>();
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    if (photoId)
      void repository
        .blob(photoId)
        .then((blob) => {
          if (!blob || cancelled) return;
          url = URL.createObjectURL(blob);
          setImage({ id: photoId, url });
        })
        .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);
  const name = record?.name ?? '';
  return (
    <span className={`avatar profile-avatar ${className}`}>
      {photoId && image?.id === photoId ? (
        <img src={image.url} alt={`Photo de ${name}`} />
      ) : (
        <span aria-hidden="true">
          {name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((v) => v[0])
            .join('')}
        </span>
      )}
    </span>
  );
}

// Re-encoding keeps the local portrait small and drops source-file metadata.
async function portrait(file: File): Promise<Blob> {
  requireRule(file.size > 0 && file.size <= 5 * 1024 * 1024, 'profilePhotoSize');
  const type = await validateFile(file, 5);
  requireRule(type.startsWith('image/'), 'profilePhotoType');
  const source = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = source;
    try {
      await img.decode();
    } catch {
      requireRule(false, 'profilePhotoType');
    }
    requireRule(img.naturalWidth && img.naturalHeight, 'profilePhotoType');
    const canvas = document.createElement('canvas');
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    canvas.width = canvas.height = Math.min(side, 512);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('profilePhotoType'))),
        'image/jpeg',
        0.88,
      ),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function ProfilePhotoEditor({ target }: { target: ProfileTarget }) {
  const { s, a, run, toast } = useApp();
  const [busy, setBusy] = useState(false);
  if (!canManageProfilePhoto(s, a, target)) return null;
  const record = profileRecord(s, target)!;
  const cleanup = (id?: string) => {
    if (id) void repository.deleteBlob(id).catch(() => {});
  };
  return (
    <section className="profile-photo-editor" aria-label={`Photo de profil de ${record.name}`}>
      <ProfileAvatar target={target} className="portrait" />
      <div className="profile-photo-fields">
        <Field
          label="Photo de profil"
          hint="JPEG, PNG ou WebP · 5 Mo maximum. Enregistrement immédiat et recadrage carré centré. Données fictives uniquement, conservées dans ce navigateur."
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (ev) => {
              const input = ev.currentTarget;
              const file = input.files?.[0];
              if (!file || busy) return;
              setBusy(true);
              const id = uid();
              let saved = false;
              try {
                const blob = await portrait(file);
                await repository.putBlob(id, blob);
                await run((s) =>
                  setProfilePhoto(s, a.id, target, {
                    id,
                    name: 'photo-profil.jpg',
                    type: blob.type,
                    size: blob.size,
                  }),
                );
                saved = true;
                cleanup(record.photoId);
                toast('Photo de profil enregistrée.');
              } catch (error) {
                if (!saved) cleanup(id);
                const code = error instanceof Error ? error.message : '';
                toast(
                  code === 'profilePhotoSize'
                    ? 'Choisissez une photo non vide de 5 Mo maximum.'
                    : code === 'denied'
                      ? 'Vous ne pouvez plus modifier ce profil.'
                      : 'La photo n’a pas été enregistrée. Choisissez une image JPEG, PNG ou WebP valide et vérifiez l’espace de stockage.',
                );
              } finally {
                input.value = '';
                setBusy(false);
              }
            }}
          />
        </Field>
        {target.kind === 'child' && (
          <p className="small-print">
            Cette photo privée de profil ne modifie pas les autorisations de publication.
          </p>
        )}
        {record.photoId && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await run((s) => setProfilePhoto(s, a.id, target, null));
                cleanup(record.photoId);
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            Retirer la photo
          </button>
        )}
        {busy && <p role="status">Enregistrement de la photo…</p>}
      </div>
    </section>
  );
}
