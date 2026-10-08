import {
  uid,
  tr,
  type State,
  type Adult,
  type Child,
  type Service,
  type ProfileTarget,
  type Attachment,
  type PhotoUse,
} from './types';
import {
  active,
  director,
  currentChild,
  currentClass,
  canManageClass,
  canManageProfilePhoto,
  profileRecord,
  guardianChildren,
  teaches,
  canRead,
} from './policy';
import { change, requireRule } from './commands';
import { validDate } from './validation';

const membershipRoles = ['guardian', 'teacher', 'director', 'service', 'representative'] as const;
const membershipStatuses = ['invited', 'active', 'suspended', 'expired', 'revoked'] as const;
const serviceIds = ['canteen', 'care', 'transport'] as const;
const photoUses: PhotoUse[] = ['class', 'school', 'print', 'website', 'social'];
const unique = <T>(values: T[]) => [...new Set(values)];
const schoolEnd = (s: State) => `${Number(s.year.slice(0, 4)) + 1}-08-31`;
function validateMandate(s: State, end: string) {
  requireRule(
    validDate(end) && end >= s.clock.slice(0, 10) && end <= schoolEnd(s),
    'invalidMandate',
  );
}
function pruneMandates(s: State) {
  for (const p of s.adults) {
    p.representativeClasses = p.representativeClasses.filter(
      (id) =>
        p.roles.includes('guardian') &&
        currentClass(s, id) &&
        s.children.some(
          (c) =>
            currentChild(s, c) &&
            c.classId === id &&
            p.children.includes(c.id) &&
            c.guardians.includes(p.id),
        ),
    );
    if (!p.representativeClasses.length) p.roles = p.roles.filter((r) => r !== 'representative');
    if (p.mandateEnds)
      p.mandateEnds = Object.fromEntries(
        Object.entries(p.mandateEnds).filter(([id]) => p.representativeClasses.includes(id)),
      );
  }
}
function setGuardianLinks(s: State, p: Adult, ids: string[]) {
  for (const c of s.children) {
    const wasLinked = c.guardians.includes(p.id);
    const linked = p.roles.includes('guardian') && ids.includes(c.id);
    c.guardians = c.guardians.filter((id) => id !== p.id);
    if (linked) c.guardians.push(p.id);
    if (linked && !wasLinked)
      photoUses.forEach((use) => {
        c.consents[use][p.id] = 'awaiting';
      });
    if (wasLinked !== linked) c.consentVersion++;
  }
  p.children = p.roles.includes('guardian') ? unique(ids) : [];
}
export function setProfilePhoto(
  s: State,
  actor: string,
  target: ProfileTarget,
  file: Pick<Attachment, 'id' | 'name' | 'type' | 'size'> | null,
) {
  return change(s, actor, 'profilePhoto', target.id, (n, a) => {
    requireRule(canManageProfilePhoto(n, a, target));
    const record = profileRecord(n, target)!;
    if (file) {
      requireRule(
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
        'profilePhotoType',
      );
      requireRule(file.size > 0 && file.size <= 5 * 1024 * 1024, 'profilePhotoSize');
      requireRule(file.id && !n.attachments.some((f) => f.id === file.id), 'invalidFile');
    }
    record.demoPhotoHidden = true;
    if (record.photoId) n.attachments = n.attachments.filter((f) => f.id !== record.photoId);
    if (file) {
      n.attachments.push({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        profile: { ...target },
        owner: actor,
        at: n.clock,
        restricted: false,
      });
      record.photoId = file.id;
    } else delete record.photoId;
  });
}
export function adminAdult(
  s: State,
  actor: string,
  id: string,
  patch: Partial<
    Pick<
      Adult,
      | 'name'
      | 'contact'
      | 'status'
      | 'classes'
      | 'children'
      | 'services'
      | 'representativeClasses'
      | 'reviewers'
      | 'mandateEnd'
      | 'roles'
      | 'removalReason'
    >
  >,
) {
  return change(s, actor, 'membership', id, (n, a) => {
    requireRule(director(n, a));
    const target = n.adults.find((x) => x.id === id);
    requireRule(target && target.id !== a.id, 'protectedAccount');
    const keys = [
      'name',
      'contact',
      'status',
      'classes',
      'children',
      'services',
      'representativeClasses',
      'reviewers',
      'mandateEnd',
      'roles',
      'removalReason',
    ];
    requireRule(Object.keys(patch).every((key) => keys.includes(key)));
    const next = { ...target, ...patch };
    requireRule(
      next.name.trim() && next.name.length <= 160 && next.contact.length <= 250,
      'required',
    );
    requireRule(
      next.roles.length &&
        next.roles.every((r) => membershipRoles.includes(r)) &&
        membershipStatuses.includes(next.status),
      'invalidMembership',
    );
    next.roles = unique(next.roles);
    if (!next.roles.includes('guardian')) {
      next.children = [];
      next.representativeClasses = [];
      next.roles = next.roles.filter((r) => r !== 'representative');
    }
    requireRule(next.roles.length, 'invalidMembership');
    if (!next.roles.includes('teacher')) next.classes = [];
    if (!next.roles.includes('service')) next.services = [];
    requireRule(
      next.children.every((id) => n.children.some((c) => c.id === id)) &&
        next.reviewers.every((id) => n.children.some((c) => c.id === id)) &&
        next.classes.every((id) => currentClass(n, id)) &&
        next.services.every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    requireRule(
      !next.reviewers.length ||
        next.roles.some((r) => ['director', 'teacher', 'service'].includes(r)),
      'invalidMembership',
    );
    requireRule(
      next.representativeClasses.every(
        (id) =>
          currentClass(n, id) &&
          next.roles.includes('guardian') &&
          n.children.some(
            (c) => currentChild(n, c) && c.classId === id && next.children.includes(c.id),
          ),
      ),
      'invalidRepresentative',
    );
    const newMandates = next.representativeClasses.filter(
      (id) => !target.representativeClasses.includes(id),
    );
    if (
      newMandates.length ||
      (patch.mandateEnd !== undefined && next.representativeClasses.length)
    ) {
      validateMandate(n, next.mandateEnd);
      const affected = patch.mandateEnd !== undefined ? next.representativeClasses : newMandates;
      next.mandateEnds = {
        ...next.mandateEnds,
        ...Object.fromEntries(affected.map((id) => [id, next.mandateEnd])),
      };
    }
    next.roles = next.representativeClasses.length
      ? unique([...next.roles, 'representative'])
      : next.roles.filter((r) => r !== 'representative');
    requireRule(
      n.adults.some((p) => p.id !== id && director(n, p)) ||
        (next.status === 'active' && next.roles.includes('director')),
      'protectedAccount',
    );
    Object.assign(target, next, {
      name: next.name.trim(),
      contact: next.contact.trim(),
      verifiedBy: a.id,
    });
    setGuardianLinks(n, target, next.children);
    if (target.status === 'revoked') target.removedAt = n.clock;
    else {
      delete target.removedAt;
      delete target.removalReason;
    }
    pruneMandates(n);
  });
}
export function removeAdult(s: State, actor: string, id: string, reason: string) {
  requireRule(reason.trim(), 'required');
  return adminAdult(s, actor, id, { status: 'revoked', removalReason: reason.trim() });
}
export function invite(
  s: State,
  actor: string,
  name: string,
  role: Adult['roles'][number],
  childId: string,
  classId: string,
  options: { contact?: string; services?: Service[] } = {},
) {
  return change(s, actor, 'invite', 'adult', (n, a) => {
    requireRule(director(n, a));
    requireRule(name.trim() && name.length <= 160, 'required');
    requireRule(membershipRoles.includes(role), 'invalidMembership');
    const isGuardian = role === 'guardian' || role === 'representative';
    requireRule(
      !childId || (isGuardian && n.children.some((c) => c.id === childId && currentChild(n, c))),
      'invalidMembership',
    );
    if (role === 'teacher' || role === 'representative')
      requireRule(currentClass(n, classId), 'invalidMembership');
    if (role === 'representative')
      requireRule(
        n.children.some((c) => c.id === childId && c.classId === classId),
        'invalidRepresentative',
      );
    const selectedServices: Service[] =
      role === 'service' ? unique<Service>(options.services ?? ['care']) : [];
    requireRule(
      selectedServices.every((v) => serviceIds.includes(v)) &&
        (role !== 'service' || selectedServices.length),
      'invalidMembership',
    );
    const id = uid();
    const b: Adult = {
      id,
      name: name.trim(),
      roles: role === 'representative' ? ['guardian', 'representative'] : [role],
      status: 'invited',
      children: [],
      classes: role === 'teacher' ? [classId] : [],
      services: selectedServices,
      reviewers: [],
      representativeClasses: role === 'representative' ? [classId] : [],
      mandateEnd: schoolEnd(n),
      locale: 'fr',
      contact: options.contact?.trim() || `${id}@example.invalid`,
      quietStart: 20,
      quietEnd: 7,
      eventReminder: 24,
      taskReminders: true,
      notificationCategories: [
        'post',
        'form',
        'evaluation',
        'poll',
        'event',
        'topic',
        'conversation',
        'request',
      ],
      availableStart: 8,
      availableEnd: 18,
      verifiedBy: a.id,
      year: n.year,
    };
    requireRule(b.contact.length <= 250, 'invalidMembership');
    n.adults.push(b);
    setGuardianLinks(n, b, childId ? [childId] : []);
  });
}
export interface PupilInput {
  name: string;
  dob: string;
  classId: string;
  guardians?: string[];
  services?: Service[];
}
function freshChild(s: State, input: PupilInput): Child {
  requireRule(input.name.trim() && input.name.length <= 160, 'required');
  requireRule(validDate(input.dob) && input.dob <= s.clock.slice(0, 10), 'invalidBirthDate');
  requireRule(currentClass(s, input.classId), 'invalidMembership');
  requireRule(
    !s.children.some(
      (c) =>
        c.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase() &&
        c.dob === input.dob,
    ),
    'duplicate',
  );
  return {
    id: uid(),
    name: input.name.trim(),
    dob: input.dob,
    classId: input.classId,
    year: s.year,
    guardians: [],
    services: [],
    emergency: '',
    collectors: '',
    care: tr('', ''),
    reviewedCare: tr('', ''),
    careStatus: 'reported',
    diet: tr('', ''),
    familyDiet: tr('', ''),
    support: tr('', ''),
    vaccination: 'awaiting',
    evidence: [],
    consents: { class: {}, school: {}, print: {}, website: {}, social: {} },
    consentVersion: 1,
  };
}
function setChildLinks(s: State, c: Child, ids: string[]) {
  requireRule(
    ids.every((id) =>
      s.adults.some((p) => p.id === id && p.roles.includes('guardian') && p.year === s.year),
    ),
    'invalidMembership',
  );
  const before = [...c.guardians];
  c.guardians = unique(ids);
  for (const p of s.adults) {
    p.children = p.children.filter((id) => id !== c.id);
    if (c.guardians.includes(p.id)) p.children.push(c.id);
  }
  for (const id of c.guardians.filter((id) => !before.includes(id)))
    photoUses.forEach((use) => {
      c.consents[use][id] = 'awaiting';
    });
  if (before.slice().sort().join() !== c.guardians.slice().sort().join()) c.consentVersion++;
}
export function createChild(s: State, actor: string, input: PupilInput) {
  return change(s, actor, 'pupilCreated', input.classId, (n, a) => {
    requireRule(canManageClass(n, a, input.classId));
    requireRule(director(n, a) || (!input.guardians?.length && !input.services?.length));
    const c = freshChild(n, input);
    requireRule(
      (input.services ?? []).every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    c.services = unique(input.services ?? []);
    n.children.push(c);
    if (director(n, a)) setChildLinks(n, c, input.guardians ?? []);
    else
      n.tasks.push({
        id: uid(),
        childId: c.id,
        type: 'correction',
        author: a.id,
        staff: n.adults.filter((p) => director(n, p)).map((p) => p.id),
        at: n.clock,
        status: 'pending',
        note: 'Nouveau dossier élève : vérifier les liens familiaux et les services.',
      });
  });
}
export function editChild(s: State, actor: string, id: string, input: Omit<PupilInput, 'classId'>) {
  return change(s, actor, 'pupilUpdated', id, (n, a) => {
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c) && (director(n, a) || teaches(n, a, c)));
    requireRule(director(n, a) || (input.guardians === undefined && input.services === undefined));
    requireRule(input.name.trim() && input.name.length <= 160, 'required');
    requireRule(validDate(input.dob) && input.dob <= n.clock.slice(0, 10), 'invalidBirthDate');
    requireRule(
      !n.children.some(
        (p) =>
          p.id !== id &&
          p.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase() &&
          p.dob === input.dob,
      ),
      'duplicate',
    );
    c.name = input.name.trim();
    c.dob = input.dob;
    if (input.guardians) setChildLinks(n, c, input.guardians);
    if (input.services) {
      requireRule(
        input.services.every((v) => serviceIds.includes(v)),
        'invalidMembership',
      );
      c.services = unique(input.services);
    }
    pruneMandates(n);
  });
}
export function moveChild(
  s: State,
  actor: string,
  id: string,
  classId: string,
  services: Service[],
) {
  return change(s, actor, 'childMembership', id, (n, a) => {
    const c = n.children.find((c) => c.id === id);
    requireRule(c && currentChild(n, c) && (director(n, a) || teaches(n, a, c)));
    requireRule(
      currentClass(n, classId) && services.every((v) => serviceIds.includes(v)),
      'invalidMembership',
    );
    requireRule(
      director(n, a) || services.slice().sort().join() === c.services.slice().sort().join(),
    );
    c.classId = classId;
    c.services = unique(services);
    delete c.unassignedAt;
    delete c.removalReason;
    pruneMandates(n);
  });
}
export function removeFromClass(s: State, actor: string, id: string, reason: string) {
  return change(s, actor, 'pupilUnassigned', id, (n, a) => {
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c) && c.classId && (director(n, a) || teaches(n, a, c)));
    requireRule(reason.trim(), 'required');
    c.classId = '';
    c.unassignedAt = n.clock;
    c.removalReason = reason.trim();
    pruneMandates(n);
    n.tasks.push({
      id: uid(),
      childId: c.id,
      type: 'correction',
      author: a.id,
      staff: n.adults.filter((p) => director(n, p)).map((p) => p.id),
      at: n.clock,
      status: 'pending',
      note: 'Élève retiré de sa classe : une réaffectation est à vérifier.',
    });
  });
}
export function archiveChild(s: State, actor: string, id: string, reason: string) {
  return change(s, actor, 'pupilArchived', id, (n, a) => {
    requireRule(director(n, a));
    const c = n.children.find((p) => p.id === id);
    requireRule(c && currentChild(n, c));
    requireRule(reason.trim(), 'required');
    c.archived = true;
    c.archivedAt = n.clock;
    c.removalReason = reason.trim();
    pruneMandates(n);
  });
}
export function restoreChild(s: State, actor: string, id: string, classId: string) {
  return change(s, actor, 'pupilRestored', id, (n, a) => {
    requireRule(director(n, a));
    const c = n.children.find((p) => p.id === id);
    requireRule(c?.archived && currentClass(n, classId));
    c.archived = false;
    c.year = n.year;
    c.classId = classId;
    delete c.archivedAt;
    delete c.unassignedAt;
    delete c.removalReason;
    photoUses.forEach((use) =>
      c.guardians.forEach((id) => {
        c.consents[use][id] = 'awaiting';
      }),
    );
    c.consentVersion++;
  });
}
export function setRepresentative(
  s: State,
  actor: string,
  id: string,
  classId: string,
  enabled: boolean,
  end: string,
) {
  return change(s, actor, 'representativeMandate', classId, (n, a) => {
    requireRule(canManageClass(n, a, classId));
    const p = n.adults.find((p) => p.id === id);
    requireRule(p);
    if (enabled) {
      requireRule(
        active(n, p) && guardianChildren(n, p).some((c) => c.classId === classId),
        'invalidRepresentative',
      );
      validateMandate(n, end);
      p.representativeClasses = unique([...p.representativeClasses, classId]);
      p.mandateEnds = { ...p.mandateEnds, [classId]: end };
      p.roles = unique([...p.roles, 'representative']);
    } else {
      requireRule(p.representativeClasses.includes(classId), 'invalidRepresentative');
      p.representativeClasses = p.representativeClasses.filter((id) => id !== classId);
      if (p.mandateEnds) delete p.mandateEnds[classId];
      if (!p.representativeClasses.length) p.roles = p.roles.filter((r) => r !== 'representative');
    }
    p.verifiedBy = a.id;
  });
}
export function rollover(s: State, actor: string) {
  return change(s, actor, 'rollover', 'year', (n, a) => {
    requireRule(director(n, a));
    const year = Number(n.year.slice(0, 4)) + 1;
    const previousClasses = n.classes.filter((c) => currentClass(n, c.id));
    n.archive.push({ year: n.year, at: n.clock, classes: previousClasses.map((c) => c.name) });
    const nextIds = new Map(previousClasses.map((c) => [c.id, uid()]));
    n.year = `${year}–${year + 1}`;
    previousClasses.forEach((c) => {
      c.archived = true;
      n.classes.push({ id: nextIds.get(c.id)!, name: c.name, year: n.year, archived: false });
    });
    n.adults.forEach((p) => {
      p.year = n.year;
      p.representativeClasses = [];
      p.mandateEnds = {};
      p.roles = p.roles.filter((r) => r !== 'representative');
      p.classes = [];
    });
    n.children
      .filter((c) => !c.archived)
      .forEach((c) => {
        c.year = n.year;
        c.classId = nextIds.get(c.classId) ?? '';
        c.careStatus = 'reported';
        (Object.keys(c.consents) as PhotoUse[]).forEach((use) => {
          Object.keys(c.consents[use]).forEach((g) => (c.consents[use][g] = 'awaiting'));
        });
        c.consentVersion++;
      });
    n.entries
      .filter((e) => !['evaluation', 'conversation', 'request'].includes(e.kind))
      .forEach((e) => (e.status = 'archived'));
  });
}
export function createClass(s: State, actor: string, name: string) {
  return change(s, actor, 'class', 'new', (n, a) => {
    requireRule(director(n, a) && name.trim(), 'required');
    n.classes.push({ id: uid(), name, year: n.year, archived: false });
  });
}
export function reviewEvidence(s: State, actor: string, childId: string) {
  return change(s, actor, 'evidenceReview', childId, (n, a) => {
    requireRule(a.reviewers.includes(childId));
    const c = n.children.find((c) => c.id === childId);
    requireRule(c);
    c.vaccination = 'reviewed';
  });
}
export function importChildren(
  s: State,
  actor: string,
  rows: { name: string; classId: string; dob: string }[],
) {
  return change(s, actor, 'import', 'children', (n, a) => {
    requireRule(director(n, a));
    requireRule(
      rows.length > 0 &&
        rows.every(
          (r) =>
            r.name.trim() &&
            /^\d{4}-\d{2}-\d{2}$/.test(r.dob) &&
            n.classes.some((c) => c.id === r.classId && !c.archived),
        ),
      'invalidImport',
    );
    requireRule(
      new Set(rows.map((r) => r.name.toLocaleLowerCase())).size === rows.length &&
        !rows.some((r) =>
          n.children.some((c) => c.name.toLocaleLowerCase() === r.name.toLocaleLowerCase()),
        ),
      'duplicate',
    );
    rows.forEach((r) => n.children.push(freshChild(n, r)));
  });
}
// This UI audit projection excludes respondent identities for anonymous-answer operations.
export function auditView(s: State, a: Adult) {
  requireRule(director(s, a));
  return s.audit
    .filter((x) => x.action !== 'pollResponse' && x.action !== 'message' && x.action !== 'draft')
    .map((x) => ({
      ...x,
      resource:
        s.entries.find((e) => e.id === x.resource && canRead(s, a, e))?.title ??
        s.children.find((c) => c.id === x.resource)?.name ??
        s.adults.find((p) => p.id === x.resource)?.name ??
        s.classes.find((c) => c.id === x.resource)?.name ??
        '—',
    }));
}
