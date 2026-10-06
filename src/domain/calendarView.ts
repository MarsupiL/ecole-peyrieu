import type { Entry } from './types';
import { parisInput, parisInstant } from './schoolTime';

export interface CalendarOccurrence {
  entry: Entry;
  start: string;
  end: string;
  firstDay: string;
  lastDay: string;
}

/** Date-only arithmetic deliberately avoids the viewer's timezone and DST. */
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function schoolYearStart(day: string): number {
  return Number(day.slice(0, 4)) - (Number(day.slice(5, 7)) < 9 ? 1 : 0);
}

export function monthDays(month: string): (string | null)[][] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + count
      ? `${month}-${String(i - offset + 1).padStart(2, '0')}`
      : null,
  );
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** Mirror the demo's four-week recurrence in Paris wall time, including DST. */
export function calendarOccurrences(events: Entry[]): CalendarOccurrence[] {
  return events
    .flatMap((entry) => {
      if (
        !entry.start ||
        !entry.end ||
        !Number.isFinite(Date.parse(entry.start)) ||
        !Number.isFinite(Date.parse(entry.end))
      )
        return [];
      const occurrences: CalendarOccurrence[] = [];
      for (let week = 0; week < (entry.recurrence === 'weekly' ? 4 : 1); week++) {
        const shift = (value: string) => {
          if (entry.allDay) return shiftDay(value.slice(0, 10), week * 7);
          if (!week) return value;
          const local = parisInput(value);
          return parisInstant(`${shiftDay(local.slice(0, 10), week * 7)}${local.slice(10)}`);
        };
        const start = shift(entry.start);
        const end = shift(entry.end);
        if (!start || !end || Date.parse(end) <= Date.parse(start)) continue;
        occurrences.push({
          entry,
          start,
          end,
          firstDay: entry.allDay ? start : parisInput(start).slice(0, 10),
          // Midnight and all-day end dates are exclusive, as in the ICS export.
          lastDay: entry.allDay
            ? shiftDay(end, -1)
            : parisInput(new Date(Date.parse(end) - 1).toISOString()).slice(0, 10),
        });
      }
      return occurrences;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** Only authorised occurrences belong here; clamp long spans to the visible period. */
export function indexCalendarDays(occurrences: CalendarOccurrence[], from: string, until: string) {
  const days = new Map<string, CalendarOccurrence[]>();
  for (const occurrence of occurrences) {
    for (
      let day = occurrence.firstDay < from ? from : occurrence.firstDay;
      day <= occurrence.lastDay && day < until;
      day = shiftDay(day, 1)
    ) {
      days.set(day, [...(days.get(day) ?? []), occurrence]);
    }
  }
  return days;
}
