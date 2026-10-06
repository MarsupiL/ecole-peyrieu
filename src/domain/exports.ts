import { jsPDF } from 'jspdf';
import { parisInput } from './schoolTime';
import type { State, Adult, Entry, Locale, Submission } from './types';
import { canRead, canReadSubmission, canReadFile } from './policy';
import { requireRule } from './engine';
export const escapeIcs = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
function fold(line: string) {
  let result = '',
    length = 0;
  for (const c of line) {
    const bytes = new TextEncoder().encode(c).length;
    if (length + bytes > 75) {
      result += '\r\n ';
      length = 1;
    }
    result += c;
    length += bytes;
  }
  return result;
}
export function calendar(
  s: State,
  a: Adult,
  events: Entry[],
  locale: Locale,
  appUrl: string,
): string {
  requireRule(events.every((e) => e.kind === 'event' && canRead(s, a, e)));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peyrieu Demo//Fictional school//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Peyrieu · DEMO',
  ];
  if (events.some((e) => e.recurrence === 'weekly' && !e.allDay)) {
    // Contemporary Europe/Paris rules, embedded so subscribers need no external timezone service.
    lines.push(
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT',
      'DTSTART:19960331T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'DTSTART:19961027T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'END:STANDARD',
      'END:VTIMEZONE',
    );
  }
  [...new Map(events.map((e) => [e.id, e])).values()].forEach((e) => {
    requireRule(e.start && e.end, 'invalidDate');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@peyrieu-school-demo.invalid`,
      `DTSTAMP:${stamp(s.clock)}`,
      `LAST-MODIFIED:${stamp(e.updated)}`,
      `SEQUENCE:${e.sequence}`,
      `SUMMARY:${escapeIcs(`[DÉMO] ${e.title[locale] || e.title.fr}`)}`,
      `DESCRIPTION:${escapeIcs(e.body[locale] || e.body.fr)}`,
      `LOCATION:${escapeIcs(e.location ?? '')}`,
      `URL:${appUrl}#/event/${encodeURIComponent(e.id)}`,
      `STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    );
    if (e.allDay)
      lines.push(
        `DTSTART;VALUE=DATE:${e.start.slice(0, 10).replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${e.end.slice(0, 10).replace(/-/g, '')}`,
      );
    else if (e.recurrence === 'weekly')
      lines.push(
        `DTSTART;TZID=Europe/Paris:${parisInput(e.start).replace(/[-:]/g, '')}00`,
        `DTEND;TZID=Europe/Paris:${parisInput(e.end).replace(/[-:]/g, '')}00`,
      );
    else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`);
    if (e.recurrence === 'weekly') lines.push('RRULE:FREQ=WEEKLY;COUNT=4');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function csv(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((v) => {
            let text = typeof v === 'string' ? v : JSON.stringify(v ?? '');
            if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export function makePdf(title: string, lines: string[], locale: Locale): Blob {
  const pdf = new jsPDF();
  const heading =
    locale === 'fr' ? 'DÉMONSTRATION · DONNÉES FICTIVES' : 'DEMONSTRATION · FICTIONAL DATA';
  let y = 42;
  const header = () => {
    pdf.setFillColor(21, 63, 86);
    pdf.rect(0, 0, 210, 29, 'F');
    pdf.setTextColor(255);
    pdf.setFontSize(13);
    pdf.text('PEYRIEU · DÉMO', 16, 13);
    pdf.setFontSize(9);
    pdf.text(heading, 16, 22);
    pdf.setTextColor(25, 42, 60);
  };
  header();
  pdf.setFontSize(18);
  pdf.splitTextToSize(title, 177).forEach((line: string) => {
    pdf.text(line, 16, y);
    y += 8;
  });
  y += 5;
  pdf.setFontSize(11);
  for (const line of lines) {
    for (const wrapped of pdf.splitTextToSize(line.replace(/[\u2028\u2029]/g, ' '), 177)) {
      if (y > 274) {
        pdf.addPage();
        header();
        y = 42;
      }
      pdf.text(wrapped, 16, y);
      y += 6;
    }
    y += 4;
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text(
      `${i} / ${pdf.getNumberOfPages()} · ${locale === 'fr' ? 'Copie locale · aucune signature' : 'Local copy · no signature'}`,
      16,
      288,
    );
  }
  return pdf.output('blob');
}
export function submissionPdf(s: State, a: Adult, x: Submission, locale: Locale) {
  requireRule(canReadSubmission(s, a, x));
  const e = s.entries.find((e) => e.id === x.formId)!;
  const fields =
    x.formVersion === e.version ? e.fields : (e.history[x.formVersion - 1]?.fields ?? e.fields);
  const lines = [
    `${x.snapshot.child} · ${s.adults.find((a) => a.id === x.author)?.name}`,
    `${locale === 'fr' ? 'Déposé le' : 'Submitted'} ${x.at} · v${x.formVersion}`,
    locale === 'fr' ? 'Confirmation explicite enregistrée.' : 'Explicit confirmation recorded.',
    ...fields.map((f) => {
      const v = x.answers[f.id];
      const values = Array.isArray(v) ? v : [v ?? ''];
      return `${f.label[locale] || f.label.fr}: ${values.map((z) => (f.type === 'file' ? (s.attachments.find((file) => file.id === z && canReadFile(s, a, file))?.name ?? (locale === 'fr' ? 'Fichier à accès restreint' : 'Restricted file')) : (f.options?.[Number(z)]?.[locale] ?? (z === 'allowed' ? (locale === 'fr' ? 'Accord' : 'Approved') : z === 'refused' ? (locale === 'fr' ? 'Refus' : 'Declined') : z)))).join(', ')}`;
    }),
  ];
  return makePdf(e.title[locale] || e.title.fr, lines, locale);
}
export function download(name: string, content: Blob | string, type = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function validateFile(file: File, maxMB = 10) {
  requireRule(file.size > 0 && file.size <= maxMB * 1024 * 1024, 'fileSize');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const b = (...v: number[]) => v.every((x, i) => bytes[i] === x);
  const signatures = {
    pdf: b(37, 80, 68, 70, 45),
    png: b(137, 80, 78, 71, 13, 10, 26, 10),
    jpg: b(255, 216, 255),
    jpeg: b(255, 216, 255),
    webp: b(82, 73, 70, 70) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
  };
  const mimes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  requireRule(
    ext && signatures[ext as keyof typeof signatures] && (!file.type || file.type === mimes[ext]),
    'fileType',
  );
  return mimes[ext!];
}
