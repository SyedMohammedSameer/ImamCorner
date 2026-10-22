// Generates the sample PDFs in public/files so the library has something to show.
// Replace them with real khutbah notes, books and handouts at any time.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../supabase/sample-files/', import.meta.url);
const TEAL = rgb(0.06, 0.37, 0.36);
const CLAY = rgb(0.76, 0.36, 0.2);
const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.42, 0.38, 0.35);
const SAND = rgb(0.97, 0.94, 0.9);

async function makeDoc({ file, title, kicker, sections }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Imam's Corner, Islamic Center of Tucson");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 64;
  let page, y;

  const newPage = (first = false) => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
    if (first) {
      page.drawRectangle({ x: 0, y: H - 220, width: W, height: 220, color: TEAL });
      // eight-point star motif
      for (let i = 0; i < 2; i++) {
        page.drawSquare({ x: W - 150, y: H - 170, size: 90, borderColor: rgb(1, 1, 1), borderWidth: 1, opacity: 0, borderOpacity: 0.35, rotate: { type: 'degrees', angle: i * 45 } });
      }
      page.drawText(kicker.toUpperCase(), { x: M, y: H - 92, size: 10, font: bold, color: rgb(0.85, 0.95, 0.93) });
      const lines = wrap(title, bold, 28, W - M * 2 - 80);
      lines.forEach((l, i) => page.drawText(l, { x: M, y: H - 130 - i * 34, size: 28, font: bold, color: rgb(1, 1, 1) }));
      y = H - 270;
    } else {
      page.drawText(title, { x: M, y: H - 40, size: 8, font: regular, color: MUTED });
      y = H - 80;
    }
  };
  const footer = () => {
    pdf.getPages().forEach((p, i, all) => {
      p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.5, color: SAND });
      p.drawText("Imam's Corner · Islamic Center of Tucson", { x: M, y: 32, size: 8, font: regular, color: MUTED });
      const n = `${i + 1} / ${all.length}`;
      p.drawText(n, { x: W - M - regular.widthOfTextAtSize(n, 8), y: 32, size: 8, font: regular, color: MUTED });
    });
  };
  const ensure = (h) => { if (y - h < 72) newPage(); };

  newPage(true);
  for (const s of sections) {
    if (s.h) {
      ensure(60);
      y -= 12;
      page.drawRectangle({ x: M, y: y - 4, width: 3, height: 18, color: CLAY });
      page.drawText(s.h, { x: M + 12, y, size: 15, font: bold, color: INK });
      y -= 26;
    }
    for (const p of s.p || []) {
      const lines = wrap(p, regular, 11, W - M * 2);
      ensure(lines.length * 16);
      lines.forEach((l) => { page.drawText(l, { x: M, y, size: 11, font: regular, color: INK, lineHeight: 16 }); y -= 16; });
      y -= 8;
    }
    for (const li of s.list || []) {
      const lines = wrap(li, regular, 11, W - M * 2 - 18);
      ensure(lines.length * 16 + 4);
      page.drawCircle({ x: M + 4, y: y + 4, size: 2.2, color: TEAL });
      lines.forEach((l) => { page.drawText(l, { x: M + 18, y, size: 11, font: regular, color: INK }); y -= 16; });
      y -= 6;
    }
    if (s.table) {
      for (const [a, b, c] of s.table) {
        ensure(40);
        const bl = wrap(b, regular, 10, 250);
        page.drawText(clean(a), { x: M, y, size: 10, font: bold, color: TEAL });
        bl.forEach((l, i) => page.drawText(l, { x: M + 70, y: y - i * 13, size: 10, font: regular, color: INK }));
        page.drawText(clean(c), { x: M + 340, y, size: 10, font: regular, color: MUTED });
        y -= Math.max(1, bl.length) * 13 + 9;
      }
    }
  }
  footer();
  await writeFile(new URL(file, OUT), await pdf.save());
  console.log('wrote', file, pdf.getPageCount(), 'pages');
}

const clean = (t) => t.replace(/ﷺ/g, '(peace be upon him)').replace(/\u2212/g, '-').replace(/[^\x00-\xff\u2014\u2013\u2018\u2019\u201c\u201d\u2022]/g, '');

function wrap(text, font, size, max) {
  const words = clean(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

await mkdir(OUT, { recursive: true });

await makeDoc({
  file: 'library-guide.pdf',
  kicker: 'Start here',
  title: "How to use the Imam's Corner library",
  sections: [
    { h: 'Welcome', p: ["Assalamu alaikum. The library collects khutbah notes, recommended books, class handouts and guides from the Imams of the Islamic Center of Tucson. Every document opens right on this website. Nothing to download or install."] },
    { h: 'Reading', list: [
      'Scroll to move between pages. The counter at the top shows where you are; tap it to jump to any page.',
      'Use the + and − buttons, or pinch with two fingers on a phone, to zoom. "Fit" sizes the page to your screen.',
      'Night mode dims the page for comfortable reading after Isha.',
      'Your place is remembered. Come back later and the reader opens where you left off.',
    ] },
    { h: 'Searching', p: ['Tap the search icon and type a word, for example "patience". Every match is highlighted and you can step through them with the arrows.'] },
    { h: 'Sharing and saving', list: [
      'Share sends a link to the exact page you are on.',
      'Save offline keeps a copy on your device, so you can read in the masjid or while travelling without signal.',
      'Download gives you the original PDF file.',
    ] },
    { h: 'For the Imam and staff', p: ['New documents are added from the admin page at /admin. Upload the PDF, give it a title, choose the type (khutbah, book, notes or guide) and publish. The site rebuilds itself within a minute or two.'] },
    { h: 'Questions?', p: ['Use the Ask the Imam page, or write to Sheikh Burhan Hamdan at bhamdan@ictucson.org.'] },
  ],
});

await makeDoc({
  file: 'jumuah-virtues-etiquette.pdf',
  kicker: 'Khutbah notes · Sample',
  title: "The Day of Jumu'ah: Virtues & Etiquette",
  sections: [
    { p: ['These are sample notes to demonstrate the khutbah archive. Replace this file with the Imam\'s own notes from the admin page.'] },
    { h: 'The best day of the week', p: ["Friday holds a special place in the life of a Muslim. Allah calls the believers to it directly in Surah al-Jumu'ah (62:9): when the call to prayer is made on Friday, hasten to the remembrance of Allah and leave off trade. It is a weekly gathering of the community, a reminder, and a renewal of faith."] },
    { h: 'Preparing for Jumu\'ah', list: [
      'Taking a bath (ghusl) before coming to the prayer.',
      'Wearing one\'s best and cleanest clothes, and for men, using perfume.',
      'Using the siwak or brushing the teeth.',
      'Coming early. The earlier one arrives, the greater the reward.',
      'Walking to the masjid with calm and dignity where possible.',
    ] },
    { h: 'Sunnahs of the day', list: [
      "Reciting Surah al-Kahf during the day of Friday.",
      'Sending abundant salawat (blessings) upon the Prophet ﷺ.'.replace('ﷺ', '(peace be upon him)'),
      'Making much du\'a, seeking the hour on Friday in which supplications are answered.',
    ] },
    { h: 'Etiquette during the khutbah', list: [
      'Listening attentively and remaining silent during the khutbah.',
      'Not stepping over the shoulders of people; filling the front rows first.',
      'Praying two short units (tahiyyat al-masjid) on arrival, even if the khutbah has begun.',
      'Keeping phones silent and out of sight.',
    ] },
    { h: 'Reflection', p: ['Take one lesson home from every khutbah. Write it down, share it with your family over dinner, and try to act on it before the next Friday. Small, consistent steps are beloved to Allah.'] },
    { h: 'At the Islamic Center of Tucson', p: ['The khutbah begins at 12:25 PM. Please arrive early to find parking and a place in the prayer hall. Sisters\' entrance and childcare details are posted at the masjid.'] },
  ],
});

await makeDoc({
  file: 'hadith-jibreel-outline.pdf',
  kicker: 'Class handout · Sample',
  title: 'Hadith Jibreel Class Outline',
  sections: [
    { p: ['Sample outline for the Saturday youth class. Hadith Jibreel, reported by Imam Muslim from \'Umar ibn al-Khattab, is called "the mother of the Sunnah" because it summarises the whole religion.'] },
    { h: '1. The scene', p: ['A man with very white clothes and very black hair, showing no signs of travel and known to no one, sits before the Prophet (peace be upon him) and asks him a series of questions. At the end, the Prophet tells the companions: that was Jibreel, who came to teach you your religion.'] },
    { h: '2. Islam: outward submission', list: ['The testimony of faith (shahadah)', 'Establishing the prayer (salah)', 'Giving zakah', 'Fasting Ramadan', 'Hajj for those who are able'] },
    { h: '3. Iman: inward belief', list: ['Belief in Allah', 'His angels', 'His books', 'His messengers', 'The Last Day', 'Divine decree (qadar), its good and its bad'] },
    { h: '4. Ihsan: excellence', p: ['To worship Allah as though you see Him; and though you do not see Him, He surely sees you. Ihsan is the highest level and touches every action.'] },
    { h: '5. The Hour and its signs', p: ['The questioner asks about the Hour. The answer teaches humility: the one asked knows no more than the one asking. Some of its signs are then mentioned.'] },
    { h: 'Discussion questions', list: ['Why did Jibreel come in the form of a man?', 'What is the difference between Islam and Iman?', 'Pick one action this week and try to do it with ihsan. What changed?'] },
  ],
});
