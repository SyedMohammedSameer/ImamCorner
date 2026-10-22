import type { APIRoute } from 'astro';
import { purgeCache } from '@netlify/functions';
import { requireAdmin, json } from '../../lib/server';

// Called by the admin dashboard after a save, so the public site shows the change right away.
export const POST: APIRoute = async ({ request }) => {
  if (!(await requireAdmin(request))) return json({ error: 'Not allowed' }, 401);
  // Only on Netlify; locally there is no edge cache (and purgeCache would wait on a missing API).
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  if (!env.SITE_ID && !env.NETLIFY) return json({ ok: true, purged: false });
  try {
    await purgeCache({ tags: ['content'] });
    return json({ ok: true });
  } catch (err) {
    // Locally (no Netlify) there is nothing to purge; pages refresh within a minute anyway.
    return json({ ok: true, purged: false });
  }
};
