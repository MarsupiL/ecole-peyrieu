export type Locale = 'fr' | 'en';
export type Text = { fr: string; en: string };
export type Role = 'guardian' | 'teacher' | 'director' | 'service' | 'representative';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'expired' | 'revoked';
export type Service = 'canteen' | 'care' | 'transport';
export type PhotoUse = 'class' | 'school' | 'print' | 'website' | 'social';
export type Choice = 'allowed' | 'refused' | 'awaiting' | 'withdrawn';
export interface Adult {
  id: string;
  name: string;
  roles: Role[];
  classes: string[];
  children: string[];
  services: Service[];
  status: MembershipStatus;
  representativeClasses: string[];
  mandateEnd: string;
  reviewers: string[];
  locale: Locale;
  contact: string;
  quietStart: number;
  quietEnd: number;
  eventReminder: number;
  taskReminders: boolean;
  notificationCategories: Kind[];
  availableStart: number;
  availableEnd: number;
  verifiedBy?: string;
  year: string;
}
export interface Child {
  id: string;
  name: string;
  dob: string;
  classId: string;
  guardians: string[];
  services: Service[];
  year: string;
  emergency: string;
  collectors: string;
  care: Text;
  reviewedCare: Text;
  careStatus: 'reported' | 'reviewed';
  diet: Text;
  familyDiet: Text;
  support: Text;
  vaccination: 'awaiting' | 'reviewed';
  evidence: string[];
  consents: Record<PhotoUse, Record<string, Choice>>;
  consentVersion: number;
}
export interface ClassGroup {
  id: string;
  name: string;
  year: string;
  archived: boolean;
}
export type Audience = { type: 'school' | 'class' | 'service' | 'individual'; ids: string[] };
export type Kind =
  'post' | 'form' | 'evaluation' | 'poll' | 'event' | 'topic' | 'conversation' | 'request';
export type Status =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'open'
  | 'closed'
  | 'archived'
  | 'cancelled'
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'completed'
  | 'resolved';
export interface Field {
  id: string;
  label: Text;
  type: 'text' | 'textarea' | 'date' | 'select' | 'multi' | 'consent' | 'file';
  required: boolean;
  options?: Text[];
  condition?: { field: string; value: string };
  restricted?: boolean;
}
export interface Entry {
  id: string;
  kind: Kind;
  title: Text;
  body: Text;
  author: string;
  audience: Audience;
  status: Status;
  created: string;
  updated: string;
  year: string;
  version: number;
  history: { at: string; title: Text; body: Text; fields?: Field[] }[];
  attachments: string[];
  pinned?: boolean;
  expires?: string;
  scheduled?: string;
  link?: string;
  childId?: string;
  responsible: string[];
  participants: string[];
  team?: Service;
  handler?: string;
  messages: {
    id: string;
    author: string;
    text: string;
    at: string;
    files: string[];
    removed?: boolean;
    reason?: string;
  }[];
  reads: Record<string, string>;
  acknowledgements: Record<string, string>;
  photoChildren: string[];
  photoUse?: PhotoUse;
  photoFile?: string;
  fields: Field[];
  deadline?: string;
  unit?: 'adult' | 'child';
  responders: string[];
  review?: 'none' | 'requested' | 'returned' | 'approved';
  reviewNote?: string;
  requireAck?: boolean;
  subject?: string;
  anonymous?: boolean;
  pollType?: 'single' | 'multi' | 'rating';
  options: Text[];
  summary?: string;
  summaryPlanned?: boolean;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  recurrence?: 'none' | 'weekly';
  sequence: number;
  capacity: number;
  volunteers: string[];
  rsvps: Record<string, string>;
  requestType?: 'absence' | 'collection' | 'correction';
  teams: string[];
  teamAcks: Record<string, { actor: string; at: string }>;
  requestDetails?: string;
}
export type Answers = Record<string, string | string[]>;
export interface Submission {
  id: string;
  formId: string;
  childId: string;
  adultId?: string;
  author: string;
  draft: boolean;
  answers: Answers;
  at: string;
  formVersion: number;
  history: { answers: Answers; at: string; version: number }[];
  status: 'draft' | 'submitted' | 'needsCorrection' | 'reviewed' | 'completed';
  note?: string;
  snapshot: { child: string; contact: string; emergency: string };
  confirmation: boolean;
}
export interface Vote {
  id: string;
  pollId: string;
  answers: string[];
  comment: string;
}
// Eligibility receipts are intentionally separate from organiser-visible vote content.
export interface VoteReceipt {
  pollId: string;
  unitId: string;
  owner: string;
  capability: string;
}
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  owner: string;
  entryId?: string;
  childId?: string;
  restricted: boolean;
  at: string;
}
export interface Booking {
  id: string;
  childId: string;
  service: Service;
  date: string;
  session: string;
  status: 'requested' | 'confirmed' | 'cancellationRequested' | 'cancelled';
  author: string;
  at: string;
  history: string[];
}
export interface Notice {
  id: string;
  actor: string;
  kind: Kind;
  resourceId: string;
  at: string;
  key: string;
  read: boolean;
  queued: boolean;
}
export interface ReviewTask {
  id: string;
  childId?: string;
  entryId?: string;
  type: 'care' | 'photo' | 'correction' | 'report';
  author: string;
  staff: string[];
  at: string;
  status: 'pending' | 'completed';
  note: string;
}
export interface Audit {
  id: string;
  actor: string;
  action: string;
  resource: string;
  at: string;
}
export interface State {
  schema: 1;
  seedVersion: 1;
  revision: number;
  clock: string;
  year: string;
  adults: Adult[];
  children: Child[];
  classes: ClassGroup[];
  entries: Entry[];
  submissions: Submission[];
  votes: Vote[];
  voteReceipts: VoteReceipt[];
  attachments: Attachment[];
  bookings: Booking[];
  notices: Notice[];
  tasks: ReviewTask[];
  audit: Audit[];
  feedback: { id: string; actor: string; at: string; area: string; text: string }[];
  drafts: Record<string, string>;
  feedTokens: Record<string, string>;
  archive: { year: string; at: string; classes: string[] }[];
}
export const tr = (fr: string, en: string): Text => ({ fr, en });
export const uid = () => crypto.randomUUID();
export const newEntry = (kind: Kind, author: string, year: string, now: string): Entry => ({
  id: uid(),
  kind,
  title: tr('', ''),
  body: tr('', ''),
  author,
  year,
  audience: { type: 'school', ids: [] },
  status: 'draft',
  created: now,
  updated: now,
  version: 1,
  history: [],
  attachments: [],
  responsible: [author],
  participants: [],
  messages: [],
  reads: {},
  acknowledgements: {},
  photoChildren: [],
  fields: [],
  responders: [],
  options: [],
  sequence: 0,
  capacity: 3,
  volunteers: [],
  rsvps: {},
  teams: [],
  teamAcks: {},
});
