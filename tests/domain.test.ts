import { describe, it, expect } from 'vitest';
import ICAL from 'ical.js';
import { seed } from '../src/data/seed';
import { tr, type State } from '../src/domain/types';
import {
  canRead,
  canReadFile,
  canReadSubmission,
  visibleEntries,
  eligible,
  photoAllowed,
  guardianChildren,
  authorisedNotices,
} from '../src/domain/policy';
import {
  submitForm,
  updateProfile,
  reviewTask,
  setEntryStatus,
  saveEntry,
  answerPoll,
  pollResults,
  ownVote,
  adminAdult,
  setConsent,
  advanceClock,
  message,
  createConversation,
  saveDraft,
  handleRequest,
  reserve,
  bookingStatus,
  bookingAvailability,
  rollover,
  auditView,
} from '../src/domain/engine';
import { calendar, csv, validateFile, makePdf } from '../src/domain/exports';
const setup = () => seed('2026-10-05T08:00:00.000Z');
const actor = (s: State, id: string) => s.adults.find((a) => a.id === id)!;
const entry = (s: State, id: string) => s.entries.find((e) => e.id === id)!;
describe('conversation drafts', () => {
  it('clears only the matching sender draft after a successful send', () => {
    let s = saveDraft(setup(), 'alice', 'compose:new', 'My draft');
    s = saveDraft(s, 'alice', 'compose:welcome', 'Linked draft');
    s = saveDraft(s, 'thomas', 'compose:new', 'Other guardian draft');
    const sent = createConversation(s, 'alice', 'Subject', 'My draft', ['emma']);
    expect(sent.drafts['alice:compose:new']).toBeUndefined();
    expect(sent.drafts['alice:compose:welcome']).toBe('Linked draft');
    expect(sent.drafts['thomas:compose:new']).toBe('Other guardian draft');
    expect(s.drafts['alice:compose:new']).toBe('My draft');
    const linked = createConversation(
      sent,
      'alice',
      'Reply',
      'Linked draft',
      ['emma'],
      undefined,
      'welcome',
    );
    expect(linked.drafts['alice:compose:welcome']).toBeUndefined();
  });
  it('preserves the saved draft when validation or authorisation fails', () => {
    const s = saveDraft(setup(), 'alice', 'compose:new', 'Keep this draft');
    expect(() => createConversation(s, 'alice', '', 'Keep this draft', ['emma'])).toThrow(
      'required',
    );
    expect(() => createConversation(s, 'alice', 'Subject', 'Keep this draft', ['luc'])).toThrow(
      'denied',
    );
    expect(s.drafts['alice:compose:new']).toBe('Keep this draft');
  });
});
describe('central policy and mutable memberships', () => {
  it('deduplicates siblings, denies other classes and named private conversations', () => {
    const s = setup();
    const a = actor(s, 'alice');
    expect(guardianChildren(s, a)).toHaveLength(2);
    expect(visibleEntries(s, a, 'event').filter((e) => e.id === 'meeting')).toHaveLength(1);
    expect(canRead(s, a, entry(s, 'other-report'))).toBe(false);
    expect(canRead(s, a, entry(s, 'private-cm'))).toBe(false);
    expect(canRead(s, actor(s, 'thomas'), entry(s, 'teacher-chat'))).toBe(false);
    expect(canRead(s, actor(s, 'director'), entry(s, 'teacher-chat'))).toBe(false);
  });
  it('restricts report drafts, health evidence and team scopes', () => {
    const s = setup();
    expect(canRead(s, actor(s, 'alice'), entry(s, 'draft-report'))).toBe(false);
    expect(canRead(s, actor(s, 'nora'), entry(s, 'report'))).toBe(false);
    expect(canRead(s, actor(s, 'ines'), entry(s, 'report'))).toBe(false);
    expect(canRead(s, actor(s, 'nora'), entry(s, 'team-chat'))).toBe(true);
    expect(canRead(s, actor(s, 'bus'), entry(s, 'team-chat'))).toBe(false);
    const file = {
      id: 'f',
      name: 'v.pdf',
      type: 'application/pdf',
      size: 10,
      owner: 'alice',
      childId: 'c1',
      restricted: true,
      at: s.clock,
    };
    expect(canReadFile(s, actor(s, 'emma'), file)).toBe(false);
    expect(canReadFile(s, actor(s, 'director'), file)).toBe(true);
    expect(canReadFile(s, actor(s, 'thomas'), file)).toBe(false);
  });
  it('removes access from lists, direct routes, exports and notices after revocation', () => {
    let s = setup();
    s = adminAdult(s, 'director', 'alice', { status: 'revoked' });
    expect(visibleEntries(s, actor(s, 'alice'))).toEqual([]);
    expect(authorisedNotices(s, actor(s, 'alice'))).toEqual([]);
    expect(() =>
      calendar(s, actor(s, 'alice'), [entry(s, 'meeting')], 'fr', 'https://example.invalid/'),
    ).toThrow('denied');
  });
  it('does not grant directors parent-only history; expires representative powers', () => {
    let s = setup();
    expect(canRead(s, actor(s, 'director'), entry(s, 'topic'))).toBe(false);
    expect(canRead(s, actor(s, 'emma'), entry(s, 'topic'))).toBe(false);
    expect(canRead(s, actor(s, 'emma'), entry(s, 'escalation'))).toBe(true);
    s = adminAdult(s, 'director', 'ines', { representativeClasses: [] });
    expect(canRead(s, actor(s, 'ines'), entry(s, 'topic'))).toBe(true);
    expect(() => saveEntry(s, 'ines', { ...entry(s, 'topic'), title: tr('New', 'New') })).toThrow(
      'denied',
    );
  });
  it('rollover removes old teacher access and resets photo permissions', () => {
    const s = rollover(setup(), 'director');
    expect(canRead(s, actor(s, 'emma'), entry(s, 'report'))).toBe(false);
    expect(canRead(s, actor(s, 'alice'), entry(s, 'report'))).toBe(true);
    expect(photoAllowed(s, ['c1'], 'class')).toBe(false);
    expect(actor(s, 'ines').representativeClasses).toEqual([]);
  });
});
describe('forms and attribution', () => {
  it('validates conditional answers and requires explicit confirmation', () => {
    const s = setup();
    expect(() =>
      submitForm(
        s,
        'alice',
        'annual',
        'c1',
        { contact: 'x', emergency: 'y', needs: '1' },
        false,
        true,
      ),
    ).toThrow('required');
    expect(() =>
      submitForm(s, 'alice', 'outing', 'c1', { permission: 'allowed' }, false, false),
    ).toThrow('confirmRequired');
  });
  it('preserves snapshots and history, prevents co-guardian overwrite', () => {
    let s = submitForm(setup(), 'alice', 'outing', 'c1', { permission: 'allowed' }, false, true);
    const first = structuredClone(s.submissions.at(-1)!);
    s = updateProfile(s, 'alice', 'c1', {
      care: tr('Changed', 'Changed'),
      diet: tr('', ''),
      familyDiet: tr('', ''),
      support: tr('', ''),
      emergency: 'NEW',
      collectors: 'NEW',
    });
    expect(s.submissions.at(-1)!.snapshot).toEqual(first.snapshot);
    const child = s.children.find((c) => c.id === 'c1')!;
    expect(child.careStatus).toBe('reported');
    expect(child.reviewedCare.fr).not.toBe('Changed');
    const task = s.tasks.at(-1)!;
    expect(task.staff).toContain('nora');
    expect(() => reviewTask(s, 'ines', task.id)).toThrow('denied');
    s = reviewTask(s, 'emma', task.id);
    expect(s.children.find((c) => c.id === 'c1')!.reviewedCare.fr).toBe('Changed');
    expect(canReadSubmission(s, actor(s, 'thomas'), s.submissions.at(-1)!)).toBe(true);
    expect(() =>
      submitForm(s, 'thomas', 'outing', 'c1', { permission: 'refused' }, false, true),
    ).toThrow('owner');
    s = submitForm(s, 'alice', 'outing', 'c1', { permission: 'refused' }, false, true);
    expect(s.submissions.at(-1)!.history[0].answers.permission).toBe('allowed');
  });
  it('protects individual responses from the other guardian', () => {
    const s = submitForm(
      setup(),
      'alice',
      'individual',
      'c1',
      { contact: 'private@example.invalid' },
      false,
      true,
    );
    expect(canReadSubmission(s, actor(s, 'thomas'), s.submissions.at(-1)!)).toBe(false);
  });
  it('requires a reason and future deadline to reopen overdue forms', () => {
    let s = setup();
    expect(() => submitForm(s, 'alice', 'insurance', 'c1', {}, false, true)).toThrow('deadline');
    expect(() => setEntryStatus(s, 'director', 'insurance', 'open')).toThrow('reopenReason');
    s = setEntryStatus(
      s,
      'director',
      'insurance',
      'open',
      'Correction allowed',
      '2026-10-20T12:00:00Z',
    );
    expect(entry(s, 'insurance').deadline).toBe('2026-10-20T12:00:00Z');
  });
});
describe('consent and media access', () => {
  it('requires every guardian for the exact audience and hides withdrawn files', () => {
    let s = setup();
    expect(photoAllowed(s, ['c1'], 'class')).toBe(true);
    expect(photoAllowed(s, ['c1'], 'school')).toBe(false);
    expect(photoAllowed(s, ['c1'], 'website')).toBe(false);
    const e = entry(s, 'welcome');
    e.photoFile = 'photo';
    e.photoChildren = ['c1'];
    e.photoUse = 'class';
    const f = {
      id: 'photo',
      name: 'x.png',
      type: 'image/png',
      size: 1,
      owner: 'emma',
      entryId: e.id,
      restricted: false,
      at: s.clock,
    };
    s.attachments.push(f);
    expect(canReadFile(s, actor(s, 'alice'), f)).toBe(true);
    s = setConsent(s, 'alice', 'c1', 'class', 'withdrawn');
    expect(canReadFile(s, actor(s, 'alice'), f)).toBe(false);
    expect(canRead(s, actor(s, 'alice'), entry(s, 'welcome'))).toBe(true);
    expect(s.tasks.some((t) => t.type === 'photo')).toBe(true);
    expect(() => saveEntry(s, 'emma', { ...entry(s, 'welcome'), status: 'published' })).toThrow(
      'photoBlocked',
    );
  });
  it('validates MIME, magic bytes and size instead of filenames alone', async () => {
    await expect(
      validateFile(new File(['<script>bad()</script>'], 'safe.png', { type: 'image/png' })),
    ).rejects.toThrow('fileType');
    await expect(
      validateFile(new File(['%PDF-1.7\nFictional'], 'sample.pdf', { type: 'application/pdf' })),
    ).resolves.toBe('application/pdf');
    await expect(
      validateFile(new File([], 'empty.pdf', { type: 'application/pdf' })),
    ).rejects.toThrow('fileSize');
  });
});
describe('surveys and identity separation', () => {
  it('deduplicates an adult with siblings and updates their existing answer', () => {
    let s = setup();
    expect(eligible(s, entry(s, 'survey')).filter((p) => p.id === 'alice')).toHaveLength(1);
    s = answerPoll(s, 'alice', 'survey', 'c1', ['0'], 'Comment');
    s = answerPoll(s, 'alice', 'survey', 'c2', ['1'], 'Updated');
    expect(s.votes).toHaveLength(1);
    expect(s.voteReceipts).toHaveLength(1);
    expect(ownVote(s, actor(s, 'alice'), entry(s, 'survey'), 'c1')?.vote?.answers).toEqual(['1']);
  });
  it('redacts identity and capabilities in organiser results and audit', () => {
    const s = answerPoll(setup(), 'alice', 'survey', 'c1', ['0'], 'A sample comment');
    const result = pollResults(s, actor(s, 'director'), 'survey');
    expect(JSON.stringify(result)).not.toMatch(/alice|capability|owner|respondent|pollId/);
    expect(JSON.stringify(auditView(s, actor(s, 'director')))).not.toMatch(/alice|pollResponse/);
    expect(() => saveEntry(s, 'director', { ...entry(s, 'survey'), anonymous: false })).toThrow(
      'pollLocked',
    );
  });
  it('enforces shared-child ownership for a poll', () => {
    let s = setup();
    s = answerPoll(s, 'alice', 'snack', 'c1', ['0'], '');
    expect(() => answerPoll(s, 'thomas', 'snack', 'c1', ['1'], '')).toThrow('owner');
    expect(ownVote(s, actor(s, 'thomas'), entry(s, 'snack'), 'c1')?.vote?.answers).toEqual(['0']);
  });
});
describe('requests, notifications and calendar', () => {
  it('keeps separate team acknowledgement and leaves bookings untouched', () => {
    const before = setup();
    const s = handleRequest(before, 'nora', 'absence', 'canteen', 'completed');
    expect(entry(s, 'absence').teamAcks.school.actor).toBe('emma');
    expect(entry(s, 'absence').teamAcks.canteen.actor).toBe('nora');
    expect(s.bookings).toEqual(before.bookings);
    expect(entry(s, 'collection').status).toBe('pending');
  });
  it('queues staff notifications out of hours while messages remain visible', () => {
    let s = setup();
    s.clock = '2026-10-05T20:00:00.000Z';
    s = message(s, 'alice', 'teacher-chat', 'Evening message');
    expect(entry(s, 'teacher-chat').messages.at(-1)?.text).toBe('Evening message');
    expect(s.notices.find((n) => n.actor === 'emma')?.queued).toBe(true);
    s = advanceClock(s, 'alice', 12);
    expect(s.notices.find((n) => n.actor === 'emma')?.queued).toBe(false);
  });
  it('deduplicates reminders and excludes completed forms', () => {
    let s = setup();
    s = advanceClock(s, 'alice', 48);
    const count = s.notices.length;
    s = advanceClock(s, 'alice', 0);
    expect(s.notices).toHaveLength(count);
    expect(new Set(s.notices.map((n) => n.key)).size).toBe(s.notices.length);
  });
  it('exports valid ICS with stable identities, cancellation and exclusive all-day dates', () => {
    const s = setup();
    const events = visibleEntries(s, actor(s, 'alice'), 'event');
    const text = calendar(
      s,
      actor(s, 'alice'),
      [...events, events[0]],
      'fr',
      'https://example.invalid/ecole-peyrieu/',
    );
    const root = new ICAL.Component(ICAL.parse(text));
    expect(root.getAllSubcomponents('vevent')).toHaveLength(events.length);
    const allDay = root
      .getAllSubcomponents('vevent')
      .find((e) => e.getFirstPropertyValue('uid') === 'book-day@peyrieu-school-demo.invalid')!;
    expect(allDay.getFirstPropertyValue('dtstart').isDate).toBe(true);
    expect(
      root
        .getAllSubcomponents('vevent')
        .find(
          (e) => e.getFirstPropertyValue('uid') === 'cancelled-event@peyrieu-school-demo.invalid',
        )!
        .getFirstPropertyValue('status'),
    ).toBe('CANCELLED');
    expect(text).toContain('DTSTART:20261009T080000Z');
  });
  it('escapes and folds multibyte calendar text within 75 octets', () => {
    const s = setup();
    const e = entry(s, 'meeting');
    e.title.fr = 'Été, école; \\ ' + 'é'.repeat(150) + '\nBonjour';
    const text = calendar(s, actor(s, 'alice'), [e], 'fr', 'https://example.invalid/');
    expect(text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    expect(
      new ICAL.Component(ICAL.parse(text))
        .getFirstSubcomponent('vevent')!
        .getFirstPropertyValue('summary'),
    ).toBe('[DÉMO] ' + e.title.fr);
  });
  it('uses UTC instants correctly through Paris daylight-saving changes', () => {
    const s = setup();
    const e = entry(s, 'meeting');
    e.start = '2026-10-25T08:00:00.000Z';
    e.end = '2026-10-25T09:00:00.000Z';
    const text = calendar(s, actor(s, 'alice'), [e], 'en', 'https://example.invalid/');
    expect(text).toContain('DTSTART:20261025T080000Z');
  });
  it('enforces capacity and booking confirmation transitions', () => {
    let s = setup();
    expect(bookingAvailability(s, 'c1', 'canteen', '2026-10-07')).toBe('full');
    expect(() => reserve(s, 'alice', 'c1', 'canteen', ['2026-10-05'], 'midday')).toThrow(
      'deadline',
    );
    s = reserve(s, 'alice', 'c1', 'care', ['2026-10-08'], 'evening');
    const b = s.bookings.at(-1)!;
    expect(b.status).toBe('requested');
    s = bookingStatus(s, 'alice', b.id, 'confirmed');
    s = bookingStatus(s, 'alice', b.id, 'cancellationRequested');
    s = bookingStatus(s, 'alice', b.id, 'cancelled');
    expect(s.bookings.at(-1)!.status).toBe('cancelled');
  });
  it('protects exports from spreadsheet formula injection and produces a real PDF', async () => {
    expect(csv([['=1+1', '+SUM(A1)', '@bad', ' normal', 'a"b']])).toContain("'=");
    const blob = makePdf('École · Démo', ['Prénom : Zoé', 'Une page fictive.'], 'fr');
    expect(new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer())).toContain('%PDF');
  });
});
describe('notification attribution and explicit cross-team forms', () => {
  it('notifies the original conversation author about a staff reply', () => {
    const s = message(setup(), 'emma', 'teacher-chat', 'A reply');
    expect(s.notices.some((n) => n.actor === 'alice' && n.key.startsWith('message:'))).toBe(true);
  });
  it('notifies the responsible author when a guardian submits', () => {
    const s = submitForm(setup(), 'alice', 'outing', 'c1', { permission: 'allowed' }, false, true);
    expect(s.notices.some((n) => n.actor === 'emma' && n.key.startsWith('submit:'))).toBe(true);
  });
  it('allows explicitly shared care-form processing without granting confidential evidence', () => {
    let s = setup();
    const e = { ...entry(s, 'outing'), responsible: ['emma', 'nora'] };
    s = saveEntry(s, 'emma', e);
    s = submitForm(s, 'alice', 'outing', 'c1', { permission: 'allowed' }, false, true);
    expect(canRead(s, actor(s, 'nora'), entry(s, 'outing'))).toBe(true);
    expect(canReadSubmission(s, actor(s, 'nora'), s.submissions.at(-1)!)).toBe(true);
    expect(canRead(s, actor(s, 'sam'), entry(s, 'outing'))).toBe(false);
    expect(
      canReadFile(
        s,
        actor(s, 'nora'),
        s.attachments.find((f) => f.id === 'sample-evidence')!,
      ),
    ).toBe(false);
  });
  it('does not allow narrow photo permission for a wider school audience', () => {
    const s = setup();
    const e = {
      ...entry(s, 'welcome'),
      audience: { type: 'school' as const, ids: [] },
      responsible: ['director'],
      author: 'director',
    };
    s.entries.push({ ...e, id: 'school-photo' });
    expect(() => saveEntry(s, 'director', { ...e, id: 'school-photo' })).toThrow('photoBlocked');
  });
  it('preserves shared response ownership when both adults have private drafts', () => {
    let s = submitForm(setup(), 'thomas', 'outing', 'c1', {}, true, false);
    s = submitForm(s, 'alice', 'outing', 'c1', { permission: 'allowed' }, false, true);
    expect(() =>
      submitForm(s, 'thomas', 'outing', 'c1', { permission: 'refused' }, false, true),
    ).toThrow('owner');
    expect(() => submitForm(s, 'alice', 'outing', 'c1', {}, true, false)).toThrow('useRevision');
  });
});
import { parisInput, parisInstant } from '../src/domain/schoolTime';
describe('Europe/Paris input conversion', () => {
  it('roundtrips summer and winter instants, rejects the spring gap and chooses later repeated time', () => {
    expect(parisInstant('2026-10-05T10:00')).toBe('2026-10-05T08:00:00.000Z');
    expect(parisInstant('2026-12-05T10:00')).toBe('2026-12-05T09:00:00.000Z');
    expect(parisInstant('2026-03-29T02:30')).toBe('');
    expect(parisInstant('2026-10-25T02:30')).toBe('2026-10-25T01:30:00.000Z');
    expect(parisInput('2026-10-25T01:30:00Z')).toBe('2026-10-25T02:30');
  });
});

describe('recurring calendars and scheduled consent', () => {
  it('retains Paris wall time for weekly events over the autumn clock change', () => {
    const s = setup();
    const e = entry(s, 'meeting');
    e.start = '2026-10-19T08:00:00.000Z';
    e.end = '2026-10-19T09:00:00.000Z';
    e.recurrence = 'weekly';
    const root = new ICAL.Component(
      ICAL.parse(calendar(s, actor(s, 'alice'), [e], 'fr', 'https://example.invalid/')),
    );
    const event = new ICAL.Event(root.getFirstSubcomponent('vevent')!);
    const iter = event.iterator();
    expect(iter.next()!.toJSDate().toISOString()).toBe('2026-10-19T08:00:00.000Z');
    expect(iter.next()!.toJSDate().toISOString()).toBe('2026-10-26T09:00:00.000Z');
    expect(iter.next()!.hour).toBe(10);
    expect(iter.next()!.hour).toBe(10);
    expect(iter.next()).toBeUndefined();
  });
  it('rechecks photo permission when a scheduled post becomes due', () => {
    let s = setup();
    const e = entry(s, 'welcome');
    e.status = 'scheduled';
    e.scheduled = '2026-10-05T09:00:00.000Z';
    s = setConsent(s, 'alice', 'c1', 'class', 'withdrawn');
    s = advanceClock(s, 'alice', 2);
    expect(entry(s, 'welcome').status).toBe('draft');
    expect(
      s.notices.some((n) => n.actor === e.author && n.key.includes('photo-schedule-blocked')),
    ).toBe(true);
  });
});
