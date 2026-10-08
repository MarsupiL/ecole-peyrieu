import { describe, expect, it } from 'vitest';
import { seed } from '../src/data/seed';
import { formAtVersion } from '../src/domain/formHistory';
import { saveEntry, setEntryStatus, submitForm } from '../src/domain/engine';
import { submissionPdf } from '../src/domain/exports';
import { localNotifications, localReservations } from '../src/domain/adapters';
import { tr } from '../src/domain/types';

describe('immutable form schemas', () => {
  it('keeps original questions in receipts after status changes and field edits', async () => {
    let s = seed('2026-10-05T08:00:00.000Z');
    const original = s.entries.find((e) => e.id === 'annual')!;
    const form = {
      ...original,
      title: tr('Original title', ''),
      fields: [
        {
          id: 'original',
          label: tr('Original question', ''),
          type: 'text' as const,
          required: true,
        },
      ],
    };
    s = saveEntry(s, 'director', form);
    s = submitForm(s, 'alice', form.id, 'c1', { original: 'Original answer' }, false, true);
    const x = s.submissions.at(-1)!;
    s = setEntryStatus(s, 'director', form.id, 'closed');
    const current = s.entries.find((e) => e.id === form.id)!;
    s = saveEntry(s, 'director', {
      ...current,
      fields: [{ ...form.fields[0], label: tr('New question', '') }],
    });
    expect(
      formAtVersion(
        s.entries.find((e) => e.id === form.id)!,
        x.formVersion,
        x.formSnapshot,
      ).fields[0].label.fr,
    ).toBe('Original question');
    const pdf = submissionPdf(
      s,
      s.adults.find((a) => a.id === 'alice')!,
      x,
      'fr',
    );
    const bytes = await pdf.text();
    expect(bytes).toContain('Original question');
    expect(bytes).not.toContain('New question');
  });
  it('resolves known legacy versions but never guesses after a version gap', () => {
    const e = seed().entries.find((e) => e.id === 'annual')!;
    const history = [{ at: e.updated, title: tr('Old title', ''), body: e.body, fields: e.fields }];
    expect(formAtVersion({ ...e, version: 2, history }, 1).title.fr).toBe('Old title');
    expect(formAtVersion({ ...e, version: 3, history }, 1).fields).toEqual([]);
    expect(
      formAtVersion({ ...e, version: 4, history: [{ ...history[0], version: 2 }] }, 2).title.fr,
    ).toBe('Old title');
  });
});

describe('local integration contracts', () => {
  it('exposes the reservation lifecycle and notification clock through the local adapters', () => {
    let s = seed('2026-10-05T08:00:00.000Z');
    s = localReservations.request(s, 'alice', 'c1', 'care', ['2026-10-12'], 'evening');
    const booking = s.bookings.at(-1)!;
    expect(booking.status).toBe('requested');
    s = localReservations.confirm(s, 'alice', booking.id);
    s = localReservations.requestCancellation(s, 'alice', booking.id);
    s = localReservations.confirmCancellation(s, 'alice', booking.id);
    expect(s.bookings.at(-1)!.status).toBe('cancelled');
    expect(localNotifications.tick(s, 'alice', 1).clock).toBe('2026-10-05T09:00:00.000Z');
    expect(localReservations.mode).toBe('local-simulation');
  });
});
