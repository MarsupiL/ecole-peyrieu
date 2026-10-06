import sharp from 'sharp';
import fs from 'node:fs';
for (const size of [192, 512])
  await sharp('public/favicon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
// Safe non-identifying photo-permission test image: coloured cards with a DEMO label.
await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#e8f2f7"/><rect x="120" y="120" width="720" height="300" rx="24" fill="#153f56"/><text x="480" y="260" text-anchor="middle" font-family="sans-serif" font-size="64" fill="white">PEYRIEU · DÉMO</text><text x="480" y="335" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#ffd276">FICHIER FICTIF / FICTIONAL FILE</text></svg>`,
  ),
)
  .png()
  .toFile('public/sample-image.png');
fs.writeFileSync(
  'public/sample-calendar.ics',
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peyrieu Demo//Public fictional schedule//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Peyrieu DEMO - fixed fictional feed',
    'BEGIN:VEVENT',
    'UID:public-book-day@peyrieu-school-demo.invalid',
    'DTSTAMP:20261006T080000Z',
    'SEQUENCE:0',
    'DTSTART;VALUE=DATE:20261015',
    'DTEND;VALUE=DATE:20261016',
    'SUMMARY:DEMO - Journée du livre / Book day',
    'DESCRIPTION:Fixed fictional schedule. Local browser edits do not update this feed.',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n'),
);
const { jsPDF } = await import('jspdf');
for (const [name, title] of [
  ['sample-evidence.pdf', 'Fictional vaccination evidence / Justificatif fictif'],
  ['sample-worksheet.pdf', 'Classwork example / Travail de classe fictif'],
]) {
  const pdf = new jsPDF();
  pdf.setFontSize(20);
  pdf.text('PEYRIEU - DEMO', 20, 25);
  pdf.setFontSize(12);
  pdf.text(title, 20, 50);
  pdf.text('No real personal or medical information.', 20, 70);
  pdf.text('Aucune information personnelle ou médicale réelle.', 20, 82);
  pdf.text('Sample attachment for testing access policies.', 20, 105);
  fs.writeFileSync(`public/${name}`, Buffer.from(pdf.output('arraybuffer')));
}
