import type { APIRoute } from 'astro';
import { requireAdmin, serviceClient, json } from '../../../lib/server';

// Invites a new admin by email. They get a link to set a password, then land in the dashboard.
export const POST: APIRoute = async ({ request, url }) => {
  const me = await requireAdmin(request);
  if (!me) return json({ error: 'Not allowed' }, 401);
  const { email, name } = await request.json().catch(() => ({}));
  const clean = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return json({ error: 'Enter a valid email address' }, 400);

  const sb = serviceClient();
  const redirectTo = `${url.origin}/admin/welcome`;
  let userId: string | undefined;
  const invited = await sb.auth.admin.inviteUserByEmail(clean, { redirectTo, data: { name } });
  if (invited.error) {
    // Already has an account (e.g. was removed earlier): look them up and re-grant access.
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === clean)?.id;
    if (!userId) return json({ error: invited.error.message }, 400);
  } else userId = invited.data.user?.id;

  const { error } = await sb.from('admins').upsert({ user_id: userId, email: clean, name: String(name ?? '').slice(0, 80) || null });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, existing: !!invited.error });
};
