import type {
  ProfileTarget,
  State,
  Adult,
  Child,
  Entry,
  Audience,
  Attachment,
  Submission,
  PhotoUse,
  Kind,
} from './types';
export const active = (s: State, a: Adult) => a.status === 'active' && a.year === s.year;
export const currentChild = (s: State, c: Child) => !c.archived && c.year === s.year;
export const currentClass = (s: State, id: string) =>
  s.classes.some((c) => c.id === id && c.year === s.year && !c.archived);
export const canAdministrate = (s: State, a: Adult) =>
  active(s, a) && (a.roles.includes('director') || a.roles.includes('teacher'));
export const canManageClass = (s: State, a: Adult, id: string) =>
  currentClass(s, id) &&
  active(s, a) &&
  (a.roles.includes('director') || (a.roles.includes('teacher') && a.classes.includes(id)));
export const managedClasses = (s: State, a: Adult) =>
  s.classes.filter((c) => canManageClass(s, a, c.id));
export const mandateEndFor = (a: Adult, id: string) => a.mandateEnds?.[id] ?? a.mandateEnd;
export const guardian = (s: State, a: Adult, c: Child) =>
  active(s, a) &&
  currentChild(s, c) &&
  a.roles.includes('guardian') &&
  a.children.includes(c.id) &&
  c.guardians.includes(a.id);
export const teaches = (s: State, a: Adult, c: Child) =>
  active(s, a) &&
  currentChild(s, c) &&
  currentClass(s, c.classId) &&
  a.roles.includes('teacher') &&
  a.classes.includes(c.classId);
export const director = (s: State, a: Adult) => active(s, a) && a.roles.includes('director');
export const serves = (s: State, a: Adult, c: Child) =>
  active(s, a) &&
  currentChild(s, c) &&
  a.roles.includes('service') &&
  a.services.some((v) => c.services.includes(v));
export const childrenFor = (s: State, a: Adult) =>
  s.children.filter(
    (c) =>
      currentChild(s, c) &&
      (guardian(s, a, c) || teaches(s, a, c) || director(s, a) || serves(s, a, c)),
  );
export const guardianChildren = (s: State, a: Adult) => s.children.filter((c) => guardian(s, a, c));
export const represents = (s: State, a: Adult, id: string) =>
  active(s, a) &&
  a.roles.includes('representative') &&
  currentClass(s, id) &&
  guardianChildren(s, a).some((c) => c.classId === id) &&
  a.representativeClasses.includes(id) &&
  mandateEndFor(a, id) >= s.clock.slice(0, 10);
export const classesFor = (s: State, a: Adult) => [
  ...new Set([
    ...(a.roles.includes('teacher') ? a.classes.filter((id) => currentClass(s, id)) : []),
    ...guardianChildren(s, a)
      .map((c) => c.classId)
      .filter((id) => currentClass(s, id)),
  ]),
];
export function audienceAllows(s: State, a: Adult, scope: Audience): boolean {
  if (!active(s, a)) return false;
  if (scope.type === 'individual') return scope.ids.includes(a.id);
  if (scope.type === 'school')
    return (
      director(s, a) ||
      a.roles.some((r) => r === 'teacher' || r === 'service') ||
      guardianChildren(s, a).length > 0
    );
  if (scope.type === 'class')
    return director(s, a) || classesFor(s, a).some((c) => scope.ids.includes(c));
  return (
    (a.roles.includes('service') && a.services.some((v) => scope.ids.includes(v))) ||
    guardianChildren(s, a).some((c) => c.services.some((v) => scope.ids.includes(v)))
  );
}
export function canAuthor(
  s: State,
  a: Adult,
  kind: Kind,
  scope: Audience,
  childId?: string,
): boolean {
  if (!active(s, a)) return false;
  if (kind === 'evaluation') {
    const c = s.children.find((c) => c.id === childId);
    return !!c && currentChild(s, c) && (teaches(s, a, c) || director(s, a));
  }
  if (kind === 'topic')
    return (
      scope.type === 'class' &&
      scope.ids.length > 0 &&
      scope.ids.every((id) => represents(s, a, id))
    );
  if (kind === 'conversation' || kind === 'request') return false;
  if (scope.type === 'individual')
    return (
      scope.ids.length > 0 &&
      scope.ids.every((id) => {
        const target = s.adults.find((x) => x.id === id);
        return (
          !!target &&
          active(s, target) &&
          guardianChildren(s, target).some(
            (c) => teaches(s, a, c) || director(s, a) || serves(s, a, c),
          )
        );
      })
    );
  if (director(s, a)) return scope.type !== 'service';
  if (a.roles.includes('teacher') && scope.type === 'class')
    return scope.ids.length > 0 && scope.ids.every((c) => a.classes.includes(c));
  if (a.roles.includes('service') && scope.type === 'service')
    return scope.ids.length > 0 && scope.ids.every((v) => a.services.includes(v as never));
  return (
    ['poll', 'event'].includes(kind) &&
    scope.type === 'class' &&
    scope.ids.length > 0 &&
    scope.ids.every((c) => represents(s, a, c))
  );
}
export function audienceChildren(s: State, scope: Audience): Child[] {
  return s.children.filter(
    (c) =>
      currentChild(s, c) &&
      (scope.type === 'school' ||
        (scope.type === 'class' && scope.ids.includes(c.classId)) ||
        (scope.type === 'service' && c.services.some((v) => scope.ids.includes(v))) ||
        (scope.type === 'individual' &&
          s.adults.some((a) => scope.ids.includes(a.id) && guardian(s, a, c)))),
  );
}
export function formDuty(s: State, a: Adult, e: Entry, childId?: string): boolean {
  return (
    active(s, a) &&
    audienceChildren(s, e.audience).some(
      (c) =>
        (!childId || c.id === childId) && (teaches(s, a, c) || director(s, a) || serves(s, a, c)),
    )
  );
}
export function canProcessForm(s: State, a: Adult, e: Entry, childId?: string): boolean {
  return e.kind === 'form' && e.responsible.includes(a.id) && formDuty(s, a, e, childId);
}
export function canManage(s: State, a: Adult, e: Entry): boolean {
  if (e.year !== s.year || e.status === 'archived') return false;
  if (e.kind === 'form') return canProcessForm(s, a, e);
  if (e.kind === 'conversation')
    return canRead(s, a, e) && (e.author === a.id || (!!e.team && a.roles.includes('service')));
  if (e.kind === 'request') return canRead(s, a, e) && e.author !== a.id;
  return (
    canAuthor(s, a, e.kind, e.audience, e.childId) &&
    (e.author === a.id || e.responsible.includes(a.id) || director(s, a))
  );
}
export function canRead(s: State, a: Adult, e: Entry): boolean {
  if (!active(s, a)) return false;
  const c = s.children.find((c) => c.id === e.childId);
  if (e.kind === 'conversation')
    return (
      e.participants.includes(a.id) ||
      (!!e.team && a.roles.includes('service') && a.services.includes(e.team))
    );
  if (e.kind === 'topic')
    return (
      e.year === s.year &&
      e.audience.type === 'class' &&
      e.audience.ids.some(
        (id) => guardianChildren(s, a).some((c) => c.classId === id) || represents(s, a, id),
      )
    );
  if (e.kind === 'request')
    return (
      !!c &&
      (e.author === a.id ||
        (e.teams.includes('school') && (teaches(s, a, c) || director(s, a))) ||
        (a.roles.includes('service') &&
          a.services.some((v) => e.teams.includes(v) && c.services.includes(v))))
    );
  if (e.kind === 'evaluation')
    return (
      !!c &&
      (e.status === 'draft'
        ? (e.author === a.id && teaches(s, a, c)) ||
          (e.responsible.includes(a.id) && (teaches(s, a, c) || director(s, a)))
        : guardian(s, a, c) || teaches(s, a, c) || director(s, a))
    );
  if (e.year !== s.year)
    return (
      e.kind === 'form' &&
      s.submissions.some((x) => x.formId === e.id && canReadSubmission(s, a, x))
    );
  if (e.kind === 'form')
    return (
      canProcessForm(s, a, e) ||
      s.submissions.some((x) => x.formId === e.id && !x.draft && canReadSubmission(s, a, x)) ||
      (e.status !== 'draft' &&
        e.status !== 'scheduled' &&
        a.roles.includes('guardian') &&
        audienceAllows(s, a, e.audience) &&
        (!e.responders.length || e.responders.includes(a.id)))
    );
  if (e.status === 'draft' || e.status === 'scheduled') return canManage(s, a, e);
  return (
    audienceAllows(s, a, e.audience) && (!e.expires || e.expires > s.clock || canManage(s, a, e))
  );
}
export const visibleEntries = (s: State, a: Adult, kind?: Kind) =>
  s.entries.filter((e) => (!kind || e.kind === kind) && canRead(s, a, e));
export const eligible = (s: State, e: Entry) =>
  s.adults.filter((a) => a.roles.includes('guardian') && canRead(s, a, e));
export function responseChildren(s: State, a: Adult, e: Entry): Child[] {
  return guardianChildren(s, a).filter((c) =>
    e.audience.type === 'class'
      ? e.audience.ids.includes(c.classId)
      : e.audience.type === 'service'
        ? c.services.some((v) => e.audience.ids.includes(v))
        : audienceAllows(s, a, e.audience),
  );
}
export function canReadSubmission(s: State, a: Adult, x: Submission): boolean {
  const f = s.entries.find((e) => e.id === x.formId);
  const c = s.children.find((c) => c.id === x.childId);
  if (!f || !active(s, a)) return false;
  if (x.draft) return x.author === a.id;
  if (canProcessForm(s, a, f, x.childId)) return true;
  if (f.unit === 'adult') return x.adultId === a.id;
  return !!c && guardian(s, a, c) && (!f.responders.length || f.responders.includes(a.id));
}
export function photoAllowed(s: State, ids: string[], use: PhotoUse): boolean {
  return (
    ids.length > 0 &&
    ids.every((id) => {
      const c = s.children.find((c) => c.id === id);
      if (!c || !currentChild(s, c) || !c.guardians.length) return false;
      return c.guardians.every((g) => c.consents[use][g] === 'allowed');
    })
  );
}
export const staffPhotoEligible = (p: Adult) =>
  !p.roles.includes('guardian') &&
  p.roles.some((r) => ['director', 'teacher', 'service'].includes(r));
export function profileRecord(s: State, target: ProfileTarget) {
  return target.kind === 'child'
    ? s.children.find((c) => c.id === target.id)
    : s.adults.find((p) => p.id === target.id);
}
export function canManageProfilePhoto(s: State, a: Adult, target: ProfileTarget): boolean {
  if (!active(s, a)) return false;
  if (target.kind === 'child') {
    const c = s.children.find((c) => c.id === target.id);
    return !!c && currentChild(s, c) && (director(s, a) || teaches(s, a, c));
  }
  const p = s.adults.find((p) => p.id === target.id);
  return !!p && p.year === s.year && (director(s, a) || p.id === a.id);
}
export function canReadProfilePhoto(s: State, a: Adult, target: ProfileTarget): boolean {
  if (!active(s, a)) return false;
  if (target.kind === 'child') return childrenFor(s, a).some((c) => c.id === target.id);
  const p = s.adults.find((p) => p.id === target.id);
  return (
    !!p &&
    (canManageProfilePhoto(s, a, target) ||
      (staffPhotoEligible(p) && active(s, p) && audienceAllows(s, a, { type: 'school', ids: [] })))
  );
}
export function canReadFile(s: State, a: Adult, f: Attachment): boolean {
  if (!active(s, a)) return false;
  if (f.profile)
    return profileRecord(s, f.profile)?.photoId === f.id && canReadProfilePhoto(s, a, f.profile);
  if (f.restricted)
    return (
      !!f.childId &&
      (a.reviewers.includes(f.childId) ||
        (a.id === f.owner && s.children.some((c) => c.id === f.childId && guardian(s, a, c))))
    );
  if (f.entryId) {
    const e = s.entries.find((e) => e.id === f.entryId);
    if (!e || !canRead(s, a, e)) return false;
    if (e.photoFile === f.id)
      return (
        !!e.photoUse &&
        e.photoUse === (e.audience.type === 'school' ? 'school' : 'class') &&
        photoAllowed(s, e.photoChildren, e.photoUse)
      );
    if (e.kind === 'form')
      return (
        s.submissions.some(
          (x) =>
            x.formId === e.id &&
            canReadSubmission(s, a, x) &&
            [x.answers, ...x.history.map((h) => h.answers)].some((answers) =>
              Object.values(answers).some((v) =>
                Array.isArray(v) ? v.includes(f.id) : v === f.id,
              ),
            ),
        ) ||
        f.owner === a.id ||
        e.attachments.includes(f.id)
      );
    return (
      f.owner === a.id ||
      e.attachments.includes(f.id) ||
      e.messages.some((m) => !m.removed && m.files.includes(f.id))
    );
  }
  return !!f.childId && s.children.some((c) => c.id === f.childId && guardian(s, a, c));
}
export function canContact(s: State, a: Adult, b: Adult): boolean {
  if (!active(s, a) || !active(s, b) || a.id === b.id) return false;
  return (
    guardianChildren(s, a).some(
      (c) => teaches(s, b, c) || director(s, b) || represents(s, b, c.classId),
    ) ||
    guardianChildren(s, b).some(
      (c) => teaches(s, a, c) || director(s, a) || represents(s, a, c.classId),
    )
  );
}
export function authorisedNotices(s: State, a: Adult) {
  return s.notices.filter(
    (n) => n.actor === a.id && s.entries.some((e) => e.id === n.resourceId && canRead(s, a, e)),
  );
}
