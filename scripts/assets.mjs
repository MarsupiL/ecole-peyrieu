import sharp from 'sharp';
import fs from 'node:fs';
await import('./icons.mjs');
// Safe non-identifying photo-permission test image: coloured cards with a DEMO label.
await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#e8f2f7"/><rect x="120" y="120" width="720" height="300" rx="24" fill="#153f56"/><text x="480" y="260" text-anchor="middle" font-family="sans-serif" font-size="64" fill="white">PEYRIEU · DÉMO</text><text x="480" y="335" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#ffd276">FICHIER FICTIF</text></svg>`,
  ),
)
  .png()
  .toFile('public/sample-image.png');
fs.writeFileSync(
  'public/sample-calendar.ics',
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peyrieu Demo//Agenda public fictif//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Peyrieu DÉMO - agenda fictif',
    'BEGIN:VEVENT',
    'UID:public-book-day@peyrieu-school-demo.invalid',
    'DTSTAMP:20261006T080000Z',
    'SEQUENCE:0',
    'DTSTART;VALUE=DATE:20261015',
    'DTEND;VALUE=DATE:20261016',
    'SUMMARY:DÉMO - Journée du livre',
    'DESCRIPTION:Agenda fictif fixe. Les modifications locales ne sont pas',
    '  synchronisées avec ce flux.',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n'),
);
const { jsPDF } = await import('jspdf');
for (const [name, title] of [
  ['sample-evidence.pdf', 'Justificatif fictif de vaccination'],
  ['sample-worksheet.pdf', 'Travail de classe fictif'],
]) {
  const pdf = new jsPDF();
  pdf.setFontSize(20);
  pdf.text('PEYRIEU - DÉMO', 20, 25);
  pdf.setFontSize(12);
  pdf.text(title, 20, 50);
  pdf.text('Aucune information personnelle ou médicale réelle.', 20, 70);
  pdf.text('Pièce jointe fictive pour tester les droits d’accès.', 20, 93);
  fs.writeFileSync(`public/${name}`, Buffer.from(pdf.output('arraybuffer')));
}
