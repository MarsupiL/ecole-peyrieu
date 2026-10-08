import { describe, expect, it } from 'vitest';
import { seed } from '../src/data/seed';
import { newEntry, tr } from '../src/domain/types';
import {
  active,
  canAuthor,
  canRead,
  canReadFile,
  canReadSubmission,
  authorisedNotices,
} from '../src/domain/policy';
import {
  archiveChild,
  rollover,
  bookingAvailability,
  reviewSubmission,
  message,
  saveEntry,
  setPreferences,
  submitForm,
  updateProfile,
} from '../src/domain/engine';

const setup = () => seed('2026-10-05T08:00:00.000Z');
describe('runtime command boundaries', () => {
  it('cannot inject roles or family links through personal preferences and profile updates', () => {
    const s = setup();
    expect(() =>
      setPreferences(s, 'alice', {
        contact: 'new@example.invalid',
        roles: ['director'],
      } as Parameters<typeof setPreferences>[2]),
    ).toThrow('denied');
    const c = s.children[0];
    expect(() =>
      updateProfile(s, 'alice', c.id, {
        care: c.care,
        diet: c.diet,
        familyDiet: c.familyDiet,
        support: c.support,
        emergency: c.emergency,
        collectors: c.collectors,
        guardians: ['luc'],
      } as Parameters<typeof updateProfile>[3]),
    ).toThrow('denied');
    expect(s.adults.find((a) => a.id === 'alice')!.roles).toEqual(['guardian']);
  });
  it('rejects invalid notification hours and impossible booking dates', () => {
    const s = setup();
    expect(() => setPreferences(s, 'alice', { quietStart: 100 })).toThrow('invalidPreferences');
    expect(() => setPreferences(s, 'alice', { eventReminder: -1 })).toThrow('invalidPreferences');
    expect(bookingAvailability(s, 'c1', 'care', '2027-02-31')).toBe('deadline');
    expect(bookingAvailability(s, 'c1', 'care', '2027-99-01')).toBe('deadline');
  });
  it('does not allow staff to process a parent private draft', () => {
    let s = setup();
    s = submitForm(s, 'alice', 'annual', 'c1', {}, true, false);
    const draft = s.submissions.find((x) => x.formId === 'annual' && x.draft)!;
    expect(() => reviewSubmission(s, 'director', draft.id, 'reviewed', '')).toThrow('denied');
  });
  it('keeps topic drafts and scheduled evaluations private', () => {
    const s = setup();
    const topic = s.entries.find((e) => e.kind === 'topic')!;
    const alice = s.adults.find((a) => a.id === 'alice')!;
    const author = s.adults.find((a) => a.id === topic.author)!;
    expect(canRead(s, alice, { ...topic, status: 'draft' })).toBe(false);
    expect(canRead(s, author, { ...topic, status: 'draft' })).toBe(true);
    const report = s.entries.find((e) => e.kind === 'evaluation' && e.childId === 'c1')!;
    expect(canRead(s, alice, { ...report, status: 'scheduled' })).toBe(false);
  });
  it('rejects a stale editor instead of overwriting a newer version', () => {
    let s = setup();
    const e = structuredClone(s.entries.find((e) => e.kind === 'post' && e.author === 'director')!);
    s = saveEntry(s, 'director', { ...e, title: tr('First edit', '') });
    expect(() => saveEntry(s, 'director', { ...e, title: tr('Stale edit', '') })).toThrow(
      'staleEntry',
    );
    expect(s.entries.find((x) => x.id === e.id)!.title.fr).toBe('First edit');
  });
  it('rejects malformed dates even when their strings sort in the expected order', () => {
    const s = setup();
    const e = {
      ...newEntry('event', 'director', s.year, s.clock),
      title: tr('Event', ''),
      body: tr('Body', ''),
      start: 'a',
      end: 'z',
    };
    expect(() => saveEntry(s, 'director', e)).toThrow('invalidDate');
  });
});

describe('preserved history and permission matrix', () => {
  it('keeps previous classes and departed pupils intact during year rollover', () => {
    const s = archiveChild(setup(), 'director', 'c3', 'Departure');
    const departed = structuredClone(s.children.find((c) => c.id === 'c3'));
    const before = structuredClone(s);
    const next = rollover(s, 'director');
    expect(s).toEqual(before);
    expect(next.children.find((c) => c.id === 'c3')).toEqual(departed);
    for (const group of s.classes) {
      expect(next.classes.find((c) => c.id === group.id)).toEqual({ ...group, archived: true });
      expect(
        next.classes.some((c) => c.name === group.name && c.year === next.year && !c.archived),
      ).toBe(true);
    }
    const pupil = next.children.find((c) => c.id === 'c1')!;
    expect(pupil.classId).not.toBe(s.children.find((c) => c.id === 'c1')!.classId);
    expect(pupil.guardians).toEqual(s.children.find((c) => c.id === 'c1')!.guardians);
  });
  it('captures the exact form title and questions with a submission, unaffected by later edits', () => {
    let s = setup();
    const form = s.entries.find((e) => e.id === 'outing')!;
    const answers = { participation: 'allowed', emergency: '0123456789', collector: 'Aunt' };
    // A draft also captures the authoring version; submission validation is independently covered.
    s = submitForm(s, 'alice', form.id, 'c1', answers, true, false);
    const snapshot = structuredClone(s.submissions.at(-1)!.formSnapshot);
    s = saveEntry(s, form.author, {
      ...form,
      title: tr('Changed title', ''),
      fields: form.fields.map((f) => ({ ...f, label: tr('Changed question', '') })),
    });
    expect(s.submissions.at(-1)!.formSnapshot).toEqual(snapshot);
    expect(snapshot).toEqual({ title: form.title, fields: form.fields });
  });
  it('denies inactive personas every entry, file, submission and notification', () => {
    const s = setup();
    for (const person of s.adults) {
      for (const status of ['invited', 'suspended', 'expired', 'revoked'] as const) {
        const a = { ...person, status };
        expect(active(s, a)).toBe(false);
        expect(s.entries.filter((e) => canRead(s, a, e))).toEqual([]);
        expect(s.attachments.filter((f) => canReadFile(s, a, f))).toEqual([]);
        expect(s.submissions.filter((x) => canReadSubmission(s, a, x))).toEqual([]);
        expect(authorisedNotices(s, a)).toEqual([]);
      }
    }
  });
  it('rejects authoring against unknown and archived class IDs', () => {
    const s = setup();
    const director = s.adults.find((a) => a.id === 'director')!;
    expect(canAuthor(s, director, 'post', { type: 'class', ids: ['missing'] })).toBe(false);
    s.classes[0].archived = true;
    expect(canAuthor(s, director, 'post', { type: 'class', ids: [s.classes[0].id] })).toBe(false);
  });
});

it('keeps archived discussions and submitted forms read-only', () => {
  const s = setup();
  const conversation = s.entries.find(
    (e) => e.kind === 'conversation' && e.participants.includes('alice'),
  )!;
  conversation.status = 'archived';
  expect(() => message(s, 'alice', conversation.id, 'Cannot append')).toThrow('denied');
  const x = s.submissions.find((x) => !x.draft)!;
  const e = s.entries.find((e) => e.id === x.formId)!;
  e.status = 'archived';
  expect(() => reviewSubmission(s, 'director', x.id, 'reviewed', '')).toThrow('denied');
});
