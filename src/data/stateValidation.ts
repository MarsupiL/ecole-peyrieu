import { z } from 'zod';
import type { State } from '../domain/types';

export class StorageError extends Error {
  constructor(public readonly code: 'storageVersion' | 'storageInvalid' | 'storageConflict') {
    super(code);
    this.name = 'StorageError';
  }
}

const text = z.object({ fr: z.string(), en: z.string() });
const id = z.string().min(1);
const ids = z.array(id);
const strings = z.array(z.string());
const integer = z.number().int().nonnegative();
const date = z.iso.date();
const instant = z.iso.datetime({ offset: true });
const year = z.string().regex(/^\d{4}[–-]\d{4}$/);
const service = z.enum(['canteen', 'care', 'transport']);
const role = z.enum(['guardian', 'teacher', 'director', 'service', 'representative']);
const kind = z.enum([
  'post',
  'form',
  'evaluation',
  'poll',
  'event',
  'topic',
  'conversation',
  'request',
]);
const status = z.enum([
  'draft',
  'scheduled',
  'published',
  'open',
  'closed',
  'archived',
  'cancelled',
  'pending',
  'confirmed',
  'declined',
  'completed',
  'resolved',
]);
const profile = z.object({ kind: z.enum(['child', 'adult']), id });
const choices = z.record(id, z.enum(['allowed', 'refused', 'awaiting', 'withdrawn']));
const stringMap = z.record(z.string(), z.string());
const answers = z.record(z.string(), z.union([z.string(), strings]));
const field = z.object({
  id,
  label: text,
  type: z.enum(['text', 'textarea', 'date', 'select', 'multi', 'consent', 'file']),
  required: z.boolean(),
  options: z.array(text).optional(),
  condition: z.object({ field: id, value: z.string() }).optional(),
  restricted: z.boolean().optional(),
});
const adult = z.object({
  id,
  name: z.string(),
  roles: z.array(role).min(1),
  classes: ids,
  children: ids,
  services: z.array(service),
  status: z.enum(['invited', 'active', 'suspended', 'expired', 'revoked']),
  representativeClasses: ids,
  mandateEnd: z.string(),
  mandateEnds: stringMap.optional(),
  removalReason: z.string().optional(),
  removedAt: instant.optional(),
  reviewers: ids,
  locale: z.enum(['fr', 'en']),
  contact: z.string(),
  quietStart: integer.max(23),
  quietEnd: integer.max(23),
  eventReminder: integer,
  taskReminders: z.boolean(),
  notificationCategories: z.array(kind),
  availableStart: integer.max(23),
  availableEnd: integer.max(24),
  verifiedBy: id.optional(),
  year,
  photoId: id.optional(),
  demoPhotoHidden: z.boolean().optional(),
});
const child = z.object({
  id,
  name: z.string(),
  dob: date,
  classId: z.string(),
  guardians: ids,
  services: z.array(service),
  year,
  emergency: z.string(),
  collectors: z.string(),
  care: text,
  reviewedCare: text,
  careStatus: z.enum(['reported', 'reviewed']),
  diet: text,
  familyDiet: text,
  support: text,
  vaccination: z.enum(['awaiting', 'reviewed']),
  evidence: ids,
  consents: z.object({
    class: choices,
    school: choices,
    print: choices,
    website: choices,
    social: choices,
  }),
  consentVersion: integer,
  archived: z.boolean().optional(),
  archivedAt: instant.optional(),
  removalReason: z.string().optional(),
  unassignedAt: instant.optional(),
  photoId: id.optional(),
  demoPhotoHidden: z.boolean().optional(),
});
const entry = z.object({
  id,
  kind,
  title: text,
  body: text,
  author: id,
  audience: z.object({ type: z.enum(['school', 'class', 'service', 'individual']), ids }),
  status,
  created: instant,
  updated: instant,
  year,
  version: integer.min(1),
  history: z.array(
    z.object({
      at: instant,
      title: text,
      body: text,
      fields: z.array(field).optional(),
      version: integer.min(1).optional(),
    }),
  ),
  attachments: ids,
  pinned: z.boolean().optional(),
  expires: instant.optional(),
  scheduled: instant.optional(),
  link: z.string().optional(),
  childId: id.optional(),
  responsible: ids,
  participants: ids,
  team: service.optional(),
  handler: z.string().optional(),
  messages: z.array(
    z.object({
      id,
      author: id,
      text: z.string(),
      at: instant,
      files: ids,
      removed: z.boolean().optional(),
      reason: z.string().optional(),
    }),
  ),
  reads: stringMap,
  acknowledgements: stringMap,
  photoChildren: ids,
  photoUse: z.enum(['class', 'school', 'print', 'website', 'social']).optional(),
  photoFile: id.optional(),
  fields: z.array(field),
  deadline: instant.optional(),
  unit: z.enum(['adult', 'child']).optional(),
  responders: ids,
  review: z.enum(['none', 'requested', 'returned', 'approved']).optional(),
  reviewNote: z.string().optional(),
  requireAck: z.boolean().optional(),
  subject: z.string().optional(),
  anonymous: z.boolean().optional(),
  pollType: z.enum(['single', 'multi', 'rating']).optional(),
  options: z.array(text),
  summary: z.string().optional(),
  summaryPlanned: z.boolean().optional(),
  start: z.union([date, instant]).optional(),
  end: z.union([date, instant]).optional(),
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  recurrence: z.enum(['none', 'weekly']).optional(),
  sequence: integer,
  capacity: integer,
  volunteers: ids,
  rsvps: stringMap,
  requestType: z.enum(['absence', 'collection', 'correction']).optional(),
  teams: strings,
  teamAcks: z.record(z.string(), z.object({ actor: id, at: instant })),
  requestDetails: z.string().optional(),
});

// Compile-time agreement with the existing schema-1 contract; no data is coerced or stripped.
const stateSchema = z.object({
  schema: z.literal(1),
  seedVersion: z.union([z.literal(1), z.literal(2)]),
  revision: integer,
  clock: instant,
  year,
  adults: z.array(adult).min(1),
  children: z.array(child),
  classes: z.array(z.object({ id, name: z.string(), year, archived: z.boolean() })),
  entries: z.array(entry),
  submissions: z.array(
    z.object({
      id,
      formId: id,
      childId: id,
      adultId: id.optional(),
      author: id,
      draft: z.boolean(),
      answers,
      at: instant,
      formVersion: integer.min(1),
      formSnapshot: z.object({ title: text, fields: z.array(field) }).optional(),
      history: z.array(
        z.object({
          answers,
          at: instant,
          version: integer.min(1),
          formSnapshot: z.object({ title: text, fields: z.array(field) }).optional(),
        }),
      ),
      status: z.enum(['draft', 'submitted', 'needsCorrection', 'reviewed', 'completed']),
      note: z.string().optional(),
      snapshot: z.object({ child: z.string(), contact: z.string(), emergency: z.string() }),
      confirmation: z.boolean(),
    }),
  ),
  votes: z.array(z.object({ id, pollId: id, answers: strings, comment: z.string() })),
  voteReceipts: z.array(z.object({ pollId: id, unitId: id, owner: id, capability: id })),
  attachments: z.array(
    z.object({
      id,
      name: z.string(),
      type: z.string(),
      size: integer,
      owner: id,
      entryId: id.optional(),
      childId: id.optional(),
      restricted: z.boolean(),
      at: instant,
      profile: profile.optional(),
    }),
  ),
  bookings: z.array(
    z.object({
      id,
      childId: id,
      service,
      date,
      session: z.string(),
      status: z.enum(['requested', 'confirmed', 'cancellationRequested', 'cancelled']),
      author: id,
      at: instant,
      history: strings,
    }),
  ),
  notices: z.array(
    z.object({
      id,
      actor: id,
      kind,
      resourceId: id,
      at: instant,
      key: z.string(),
      read: z.boolean(),
      queued: z.boolean(),
    }),
  ),
  tasks: z.array(
    z.object({
      id,
      childId: id.optional(),
      entryId: id.optional(),
      type: z.enum(['care', 'photo', 'correction', 'report']),
      author: id,
      staff: ids,
      at: instant,
      status: z.enum(['pending', 'completed']),
      note: z.string(),
    }),
  ),
  audit: z.array(
    z.object({ id, actor: id, action: z.string(), resource: z.string(), at: instant }),
  ),
  feedback: z.array(z.object({ id, actor: id, at: instant, area: z.string(), text: z.string() })),
  drafts: stringMap,
  feedTokens: stringMap,
  archive: z.array(z.object({ year, at: instant, classes: strings })),
}) satisfies z.ZodType<State>;

export function assertStoredState(value: unknown): asserts value is State {
  if (value && typeof value === 'object' && 'schema' in value && value.schema !== 1)
    throw new StorageError('storageVersion');
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) throw new StorageError('storageInvalid');
  const s = parsed.data;
  const check = (ok: boolean) => {
    if (!ok) throw new StorageError('storageInvalid');
  };
  const unique = (values: string[]) => new Set(values).size === values.length;
  for (const rows of [
    s.adults,
    s.children,
    s.classes,
    s.entries,
    s.submissions,
    s.votes,
    s.attachments,
    s.bookings,
    s.notices,
    s.tasks,
    s.audit,
    s.feedback,
  ])
    check(unique(rows.map((row) => row.id)));
  const adults = new Map(s.adults.map((a) => [a.id, a]));
  const children = new Map(s.children.map((c) => [c.id, c]));
  const classes = new Set(s.classes.map((c) => c.id));
  const entries = new Map(s.entries.map((e) => [e.id, e]));
  const files = new Map(s.attachments.map((f) => [f.id, f]));
  const refs = (values: string[], table: { has(id: string): boolean }) =>
    unique(values) && values.every((id) => table.has(id));
  for (const a of s.adults) {
    check(
      refs(a.children, children) &&
        refs(a.classes, classes) &&
        refs(a.reviewers, children) &&
        refs(a.representativeClasses, classes),
    );
    check(a.children.every((id) => children.get(id)!.guardians.includes(a.id)));
    if (a.photoId)
      check(
        files.get(a.photoId)?.profile?.id === a.id &&
          files.get(a.photoId)?.profile?.kind === 'adult',
      );
  }
  for (const c of s.children) {
    check(
      (!c.classId || classes.has(c.classId)) &&
        refs(c.guardians, adults) &&
        refs(c.evidence, files),
    );
    check(c.guardians.every((id) => adults.get(id)!.children.includes(c.id)));
    if (c.photoId)
      check(
        files.get(c.photoId)?.profile?.id === c.id &&
          files.get(c.photoId)?.profile?.kind === 'child',
      );
  }
  for (const e of s.entries) {
    check(adults.has(e.author) && (!e.childId || children.has(e.childId)));
    check(
      refs(e.participants, adults) &&
        refs(e.responsible, adults) &&
        refs(e.responders, adults) &&
        refs(e.photoChildren, children),
    );
    check(refs(e.attachments, files) && (!e.photoFile || files.has(e.photoFile)));
    check(unique(e.messages.map((m) => m.id)) && unique(e.fields.map((f) => f.id)));
    for (const m of e.messages) check(adults.has(m.author) && refs(m.files, files));
  }
  for (const x of s.submissions)
    check(
      entries.get(x.formId)?.kind === 'form' &&
        children.has(x.childId) &&
        adults.has(x.author) &&
        (!x.adultId || adults.has(x.adultId)),
    );
  check(
    unique(
      s.submissions.filter((x) => !x.draft).map((x) => `${x.formId}:${x.adultId ?? x.childId}`),
    ),
  );
  check(
    unique(s.voteReceipts.map((r) => `${r.pollId}:${r.unitId}`)) &&
      unique(s.voteReceipts.map((r) => r.capability)),
  );
  for (const r of s.voteReceipts)
    check(
      adults.has(r.owner) &&
        entries.get(r.pollId)?.kind === 'poll' &&
        s.votes.some((v) => v.id === r.capability && v.pollId === r.pollId),
    );
  for (const v of s.votes)
    check(s.voteReceipts.some((r) => r.capability === v.id && r.pollId === v.pollId));
  for (const f of s.attachments) {
    // Uploads for an unsaved editor intentionally precede the entry record.
    check(adults.has(f.owner) && (!f.childId || children.has(f.childId)));
    if (f.profile)
      check((f.profile.kind === 'adult' ? adults : children).get(f.profile.id)?.photoId === f.id);
  }
  for (const b of s.bookings) check(adults.has(b.author) && children.has(b.childId));
  for (const n of s.notices) check(adults.has(n.actor) && entries.has(n.resourceId));
}
