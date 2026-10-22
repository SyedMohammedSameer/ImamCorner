# Imam's Corner, Islamic Center of Tucson

The website for the Imam's office: khutbahs, classes, a PDF library with a built-in reader, prayer times, and an admin dashboard so the Imam can update everything from a phone.

- **Site:** Astro, server-rendered on Netlify. Pages are cached at the edge for a minute, and admin saves refresh the cache, so changes show almost immediately.
- **Data:** Supabase (Postgres, file storage and admin logins).
- **Admin:** `/admin`, a dashboard that works on a phone.

## The admin dashboard

| Screen | What the Imam can do |
| --- | --- |
| Home | Quick actions, this Friday's khateeb, new messages, recent uploads, storage used |
| Library | Upload PDFs (compressed first), edit details, hide/show, replace the file, delete |
| Jummah | Change the khateeb or topic for any Friday, add a guest speaker, set the rotation and times |
| Classes | Add/edit classes and daily reminders, and office hours |
| Messages | Questions from Ask the Imam and service requests; reply by email or phone, mark done |
| Books | Recommended reading; attach a PDF or upload one directly for a book |
| Announcements | Banner on the home page with start and end dates |
| Imams | Bios, roles, photos, order |
| Settings | Masjid details, booking link, prayer calculation, ayah of the day, and the admin team (invite/remove) |

Signed-in admins also see an **Edit** button on public pages that opens the matching admin screen.

### PDF compression

Uploads are compressed in the browser before they're sent:

- The uploader checks whether a PDF is **scanned** (photographed pages) or **digital** (real text).
- **Scanned PDFs** are re-rendered at a sensible resolution. *Clean document* also removes shadows, yellow tint and uneven lighting from phone photos, turning pages into crisp black text on white. A 14 MB, 5-page phone capture comes down to about 1 MB.
- **Digital PDFs** are kept as they are by default, so their text stays searchable.
- **Photos to PDF:** pick photos of pages on a phone; they can be reordered, rotated and removed before being combined.
- You see the before and after sizes and a preview of the first page before uploading. The limit is 50 MB per file.

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill it in from the project dashboard.
3. In **Authentication → URL Configuration**, set **Site URL** to the live site (e.g. `https://imamcorner.netlify.app`). Under **Redirect URLs**, add `https://imamcorner.netlify.app/admin/welcome` and `http://localhost:4321/admin/welcome`.
4. Create the tables, load the starting content, and invite yourself as the first admin:

```bash
npm run db:setup -- --admin you@example.com
```

The invite email links to `/admin/welcome`, where you choose a password. Invite others from **Settings → Admin team**.

### 2. Netlify

In **Project configuration → Environment variables**, add:

| Variable | Value |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Project URL |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key (keep private) |
| `SITE_URL` | `https://imamcorner.netlify.app` (or your domain) |

Then redeploy. The build settings come from `netlify.toml`.

### 3. Run locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321, and http://localhost:4321/admin for the dashboard.

## Limits on the free plans

- **Supabase:** 1 GB of file storage, 500 MB database, and 50 MB per file. The dashboard home shows storage used. Free projects pause after a week with no visits; any page visit wakes them.
- **Supabase emails:** the built-in email sender is rate-limited (a few per hour). That's fine for occasional invites; for more, add custom SMTP under Authentication → Emails.

## Project layout

- `src/pages/`: public pages and `/api` endpoints (form submissions, cache refresh, admin invites)
- `src/admin/`: the dashboard (Preact), including `compress.ts`, the PDF compressor
- `src/lib/data.ts`: server-side reads; `src/lib/schedule.ts`: shared Jummah rotation logic
- `supabase/migrations/`: database schema and security rules; `supabase/seed.sql`: starting content
- `scripts/setup-db.mjs`: one-time project setup
