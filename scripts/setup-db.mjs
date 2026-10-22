// Sets up a fresh Supabase project for Imam's Corner:
//   1. creates tables, security rules and storage buckets (supabase/migrations)
//   2. loads the starting content (supabase/seed.sql), only if the database is empty
//   3. uploads the sample PDFs into the library
//   4. optionally invites the first admin:  npm run db:setup -- --admin you@example.com
//
// Needs SUPABASE_DB_URL, PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { readFile, readdir } from 'node:fs/promises';

const env = process.env;
for (const k of ['SUPABASE_DB_URL', 'PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
  if (!env[k] || /YOUR|xxx/.test(env[k])) { console.error(`Missing ${k} in .env`); process.exit(1); }
}
const root = new URL('../', import.meta.url);
const sql = postgres(env.SUPABASE_DB_URL, { ssl: 'require', max: 1, onnotice: () => {} });
const sb = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const step = (msg) => console.log(`\n▸ ${msg}`);

try {
  step('Schema');
  const [{ exists }] = await sql`select to_regclass('public.settings') is not null as exists`;
  if (exists) console.log('  already set up, skipping');
  else {
    for (const f of (await readdir(new URL('supabase/migrations/', root))).sort()) {
      await sql.unsafe(await readFile(new URL(`supabase/migrations/${f}`, root), 'utf8'));
      console.log(`  applied ${f}`);
    }
  }

  step('Starting content');
  const [{ n }] = await sql`select count(*)::int as n from public.imams`;
  if (n > 0) console.log('  content already present, skipping');
  else { await sql.unsafe(await readFile(new URL('supabase/seed.sql', root), 'utf8')); console.log('  loaded seed.sql'); }

  step('Sample PDFs');
  const samples = [
    { file: 'library-guide.pdf', title: "How to use the Imam's Corner library", type: 'guide', author: "Imam's Corner", summary: 'How to search, save offline and share pages in the reader.', tags: ['Start here', 'Help'], featured: true },
    { file: 'jumuah-virtues-etiquette.pdf', title: "The Day of Jumu'ah: Virtues & Etiquette", type: 'khutbah', author: '', summary: 'Sample notes on the sunnahs and etiquette of Friday.', tags: ["Jumu'ah", 'Sunnah', 'Sample'] },
    { file: 'hadith-jibreel-outline.pdf', title: 'Hadith Jibreel Class Outline', type: 'notes', author: "Imam's Corner", summary: 'Sample handout on Islam, Iman and Ihsan.', tags: ['Hadith', 'Youth', 'Sample'] },
  ];
  const [{ docs }] = await sql`select count(*)::int as docs from public.resources`;
  if (docs > 0) console.log('  library already has documents, skipping');
  else {
    for (const s of samples) {
      const bytes = await readFile(new URL(`supabase/sample-files/${s.file}`, root));
      const path = `samples/${s.file}`;
      const up = await sb.storage.from('library').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (up.error) throw up.error;
      const pages = (await PDFDocument.load(bytes)).getPageCount();
      const slug = s.file.replace(/\.pdf$/, '');
      const { error } = await sb.from('resources').insert({ slug, title: s.title, type: s.type, author: s.author, summary: s.summary, tags: s.tags, featured: !!s.featured, file_path: path, file_size: bytes.length, original_size: bytes.length, pages });
      if (error) throw error;
      console.log(`  uploaded ${s.file}`);
    }
  }

  const i = process.argv.indexOf('--admin');
  if (i > 0) {
    const email = process.argv[i + 1]?.toLowerCase();
    if (!email) throw new Error('Usage: npm run db:setup -- --admin you@example.com');
    step(`Admin: ${email}`);
    const site = env.SITE_URL || 'http://localhost:4321';
    let id;
    const inv = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/admin/welcome` });
    if (inv.error) {
      const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
      id = data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!id) throw inv.error;
      console.log('  account already exists; granting admin access');
    } else { id = inv.data.user.id; console.log(`  invite email sent (link opens ${site}/admin/welcome)`); }
    await sql`insert into public.admins (user_id, email) values (${id}, ${email}) on conflict (user_id) do nothing`;
  }
  console.log('\nDone.');
} catch (err) {
  console.error('\nSetup failed:', err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
