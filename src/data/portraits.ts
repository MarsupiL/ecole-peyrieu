import type { Adult, ProfileTarget, State } from '../domain/types';
import { canReadProfilePhoto, profileRecord } from '../domain/policy';

// Public, AI-generated fictional fixtures. User uploads remain in IndexedDB.
const portraits: Record<ProfileTarget['kind'], ReadonlySet<string>> = {
  child: new Set(Array.from({ length: 12 }, (_, i) => `c${i + 1}`)),
  adult: new Set(['emma', 'hugo', 'leonie', 'director', 'nora', 'sam', 'bus']),
};

export function demoPortrait(s: State, viewer: Adult, target: ProfileTarget): string | undefined {
  const record = profileRecord(s, target);
  if (
    !record ||
    record.photoId ||
    record.demoPhotoHidden ||
    !portraits[target.kind].has(target.id) ||
    !canReadProfilePhoto(s, viewer, target)
  )
    return;
  // Earlier releases recorded removal in the audit without a dedicated flag.
  if (s.audit.some((event) => event.action === 'profilePhoto' && event.resource === target.id))
    return;
  return `${import.meta.env.BASE_URL}portraits/${target.id}.webp`;
}
