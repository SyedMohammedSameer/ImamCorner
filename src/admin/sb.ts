// Browser Supabase client for the admin dashboard. Row level security limits writes to admins.
import { createClient } from '@supabase/supabase-js';

export const sb = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});

export const publicUrl = (bucket: 'library' | 'media', path: string) => sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? '';
}

/** Calls one of our own /api endpoints as the signed-in admin. */
export async function api<T = any>(path: string, body?: unknown, timeoutMs = 20000): Promise<T> {
  const res = await fetch(path, {
    signal: AbortSignal.timeout(timeoutMs),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Tells Netlify to refresh cached public pages after a change. Never blocks the save. */
export const publish = () => api('/api/purge', {}, 5000).catch(() => {});

/** Throws a readable error if a Supabase call failed, otherwise returns its data. */
export function check<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<R['data']>;
}

/** Uploads a file to a public bucket with real progress events (supabase-js has none). */
export async function uploadWithProgress(bucket: 'library' | 'media', path: string, file: Blob, onProgress: (p: number) => void) {
  const url = `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  const access = await token();
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${access}`);
    xhr.setRequestHeader('apikey', import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try { msg = JSON.parse(xhr.responseText).message || msg; } catch {}
      if (xhr.status === 413) msg = 'This file is larger than the storage limit. Choose a smaller compression setting.';
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.send(file);
  });
}

export function slugify(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'document';
}

export const mb = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
