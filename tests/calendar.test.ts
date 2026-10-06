import { describe, it, expect } from 'vitest';
import { seed } from '../src/data/seed';
import {
  calendarOccurrences,
  indexCalendarDays,
  monthDays,
  schoolYearStart,
} from '../src/domain/calendarView';
import { visibleEntries } from '../src/domain/policy';

const event = () => seed('2026-10-06T08:00:00Z').entries.find((e) => e.id === 'meeting')!;

describe('school calendar dates and occurrences', () => {
  it('uses September–August years and Monday-first months including leap days', () => {
    expect(schoolYearStart('2026-08-31')).toBe(2025);
    expect(schoolYearStart('2026-09-01')).toBe(2026);
    expect(monthDays('2026-09')[0]).toEqual([
      null,
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
    expect(monthDays('2028-02').flat().filter(Boolean)).toHaveLength(29);
    expect(monthDays('2027-02').flat().filter(Boolean)).toHaveLength(28);
    expect(monthDays('2026-11')).toHaveLength(6);
  });
  it('marks every all-day date while excluding the end date and clipping the displayed year', () => {
    const e = { ...event(), start: '2026-08-31', end: '2026-09-03', allDay: true };
    const occurrences = calendarOccurrences([e]);
    expect([...indexCalendarDays(occurrences, '2026-09-01', '2027-09-01').keys()]).toEqual([
      '2026-09-01',
      '2026-09-02',
    ]);
    const crossing = { ...e, start: '2027-08-31', end: '2027-09-02' };
    expect([
      ...indexCalendarDays(calendarOccurrences([crossing]), '2026-09-01', '2027-09-01').keys(),
    ]).toEqual(['2027-08-31']);
  });
  it('uses Paris dates for timed events and excludes a midnight end', () => {
    const e = { ...event(), start: '2026-10-31T23:30:00.000Z', end: '2026-11-01T23:00:00.000Z' };
    expect(calendarOccurrences([e])[0]).toMatchObject({
      firstDay: '2026-11-01',
      lastDay: '2026-11-01',
    });
    e.end = '2026-11-02T00:00:00.000Z';
    expect([
      ...indexCalendarDays(calendarOccurrences([e]), '2026-09-01', '2027-09-01').keys(),
    ]).toEqual(['2026-11-01', '2026-11-02']);
  });
  it('expands four weekly sessions at the same Paris time across both DST changes', () => {
    const e = {
      ...event(),
      start: '2026-10-19T08:00:00.000Z',
      end: '2026-10-19T09:00:00.000Z',
      recurrence: 'weekly' as const,
    };
    expect(calendarOccurrences([e]).map((item) => item.start)).toEqual([
      '2026-10-19T08:00:00.000Z',
      '2026-10-26T09:00:00.000Z',
      '2026-11-02T09:00:00.000Z',
      '2026-11-09T09:00:00.000Z',
    ]);
    e.start = '2027-03-22T09:00:00.000Z';
    e.end = '2027-03-22T10:00:00.000Z';
    expect(calendarOccurrences([e])[1]).toMatchObject({
      start: '2027-03-29T08:00:00.000Z',
      end: '2027-03-29T09:00:00.000Z',
    });
  });
  it('expands all-day recurrences, retains cancellations and skips missing or invalid ranges', () => {
    const e = {
      ...event(),
      start: '2026-12-28',
      end: '2026-12-30',
      allDay: true,
      recurrence: 'weekly' as const,
      status: 'cancelled' as const,
    };
    const occurrences = calendarOccurrences([e]);
    expect(occurrences).toHaveLength(4);
    expect(occurrences[1]).toMatchObject({
      start: '2027-01-04',
      lastDay: '2027-01-05',
      entry: { status: 'cancelled' },
    });
    expect(
      calendarOccurrences([
        { ...e, start: undefined },
        { ...e, end: '2026-12-27' },
      ]),
    ).toEqual([]);
  });
  it('indexes multiple events per date without leaking inaccessible class events', () => {
    const s = seed('2026-10-06T08:00:00Z');
    const base = event();
    s.entries = [
      base,
      { ...base, id: 'second' },
      { ...base, id: 'private', audience: { type: 'class', ids: ['cm'] } },
    ];
    const visible = visibleEntries(
      s,
      s.adults.find((a) => a.id === 'alice')!,
      'event',
    );
    const days = indexCalendarDays(calendarOccurrences(visible), '2026-09-01', '2027-09-01');
    expect(days.get('2026-10-12')?.map((item) => item.entry.id)).toEqual(['meeting', 'second']);
  });
});
