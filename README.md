# Imam's Corner, Islamic Center of Tucson

A rebuild of the ICT Imam's Corner (previously on Google Sites) as a fast, mobile-first static site with a built-in PDF reader, a staff editor and offline support. Built with [Astro](https://astro.build) and deployed on Netlify.

## What's inside

| Page | What it does |
| --- | --- |
| `/` | Live prayer times, Hijri date, this Friday's khateeb, today's programs, ayah of the day, upcoming Islamic dates |
| `/jummah` | Next khutbah, 12-week rotation, khutbah archive, subscribable calendar feed (`/jummah.ics`) |
| `/classes` | Weekly timetable by day (or full week), with today highlighted, plus office hours |
| `/library` | Searchable library of khutbah notes, books, handouts and guides |
| `/library/<doc>` | **Built-in PDF reader**: search inside the PDF, pinch/button zoom, fit to page, night mode, focus mode, share a link to a page, download, save offline, remembers your last page |
| `/books` | Recommended reading by category, with a four-book starter path |
| `/imams` | Bios, focus areas and what each imam teaches |
| `/prayer-times` | Today's times, a printable monthly table, and a qibla compass that uses the phone's sensors |
| `/office-hours` | Weekly hours and a link to Google appointment booking |
| `/ask` | Ask the Imam form (anonymous allowed) |
| `/services` | Nikah, janazah, counseling, visits, shahadah and outreach, with a request form |
| `/new-muslims` | Shahadah, first steps and a contact form |
| `/admin` | Staff editor (Decap CMS) |

The site can also be installed as an app: add it to the home screen (PWA), and saved PDFs open without internet.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321.

## Deploy to Netlify

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml` (`npm run build` → `dist`).
3. **Forms:** go to Site configuration → Forms and enable form detection. Submissions from *Ask the Imam*, *Service request* and *New Muslim* appear there. Add an email notification to `bhamdan@ictucson.org` under Forms → Form notifications.
4. **Custom domain (optional):** for example `imam.ictucson.org`. Set the `SITE_URL` environment variable to it so links and the calendar feed use the right address.

Old Google Sites paths (`/welcome-page`, `/jummah-khutbah-schedule`, …) redirect to the new pages.

## Editing content (no code needed)

### Staff editor at `/admin`

1. In Netlify: **Project configuration → Identity → Enable Identity**. Set registration to *Invite only*, then turn on **Git Gateway** under Identity → Services.
2. Invite the Imam and staff by email. They accept the invite, set a password, and land in the editor.
3. In the editor they can:
   - **Library (PDFs):** upload a PDF, choose the type (khutbah / book / notes / guide), pick the khateeb, and publish.
   - **Jummah schedule:** change the rotation, or override a single Friday with a different khateeb or a topic.
   - **Classes & office hours**, **Recommended books**, **Imams** (bios and photos), **Announcements** (with an optional expiry date), **Daily reminders**.

Netlify rebuilds the site about a minute after each save.

> If Netlify Identity isn't available on the account, switch the `backend` in `public/admin/config.yml` to the commented-out `github` option. Editors then log in with GitHub accounts that have access to the repo.

> Keep PDFs under ~20 MB for upload through the editor. Larger books can be added to `public/files/` with git directly.

### Editing files directly

- `src/data/site.json`: contact details, address, booking link, Jummah time, prayer calculation settings
- `src/data/schedule.json`: khutbah rotation and per-Friday overrides
- `src/data/classes.json`: weekly programs and office hours
- `src/content/resources/*.md`: library entries (each points at a PDF in `public/files/`)
- `src/content/books/*.md`, `src/content/imams/*.md`, `src/content/announcements/*.md`

### Keeping dates current

Pages are static and rebuild whenever content changes. Date-based parts (next khutbah, today's classes, prayer times) are recalculated in the visitor's browser, so they stay correct between rebuilds. To refresh the `.ics` calendar feed weekly, create a **Build hook** in Netlify and call it on a schedule (for example, a free cron service hitting the hook every Friday).

## Before launch: please review

- **Bios:** the old site had only titles. The current bios are short drafts based on the timetable. Replace them with real biographies and photos.
- **Khutbah rotation:** inferred from the old 2023–24 schedule (Sh. Amir Koshin every 4th Friday from 15 Dec 2023). Confirm it, or add overrides.
- **Office hours on Fri and Sun:** the old timetable said "10:00 pm to 10:00 pm" for those days, which looks like a typo. They're shown as *By appointment* until confirmed.
- **Address:** `901 E 1st St, Tucson, AZ 85719`. Confirm it, and add a phone number for urgent janazah calls in `site.json` and the Services page.
- **Prayer times:** calculated with ISNA angles (15°/15°) and standard Asr. Adjust them in `site.json` to match the masjid's timetable, and add iqama times if wanted.
- **Sample PDFs:** the four PDFs in `public/files/` are placeholders made by `npm run samples`. Delete them, and their entries in `src/content/resources/`, once real documents are uploaded.
- **Book list:** a starter selection. The Imam should curate it.

## Tech notes

- Astro 7 (static output), pdf.js 6 (`PDFViewer` + find controller), Decap CMS 3.16, plain CSS with light and dark themes.
- Prayer times, Hijri dates (Umm al-Qura via `Intl`) and qibla are all calculated on-device. No API keys or third-party calls, apart from Google Fonts.
- `scripts/copy-pdfjs.mjs` copies pdf.js fonts, cmaps and wasm decoders to `public/pdfjs/` before each build.
- `public/sw.js`: network-first pages, cache-first assets, offline library.
