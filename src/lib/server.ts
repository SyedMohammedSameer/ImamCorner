// Server-only Supabase access with the secret key. Never import this from browser code.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;
export function serviceClient() {
  admin ??= createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Returns the signed-in admin's user for a request carrying `Authorization: Bearer <access token>`, or null. */
export async function requireAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const sb = serviceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return row ? data.user : null;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
