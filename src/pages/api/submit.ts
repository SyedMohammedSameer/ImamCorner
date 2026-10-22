import type { APIRoute } from 'astro';
import { serviceClient, json } from '../../lib/server';

// Receives the public forms (Ask the Imam, service requests, New to Islam) and stores them for the admin inbox.
const KINDS: Record<string, 'ask' | 'service' | 'new-muslim'> = { 'ask-the-imam': 'ask', 'service-request': 'service', 'new-muslim': 'new-muslim' };
const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? '').trim().slice(0, n);

export const POST: APIRoute = async ({ request, redirect }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const fail = (msg: string, status = 400) => (wantsJson ? json({ error: msg }, status) : new Response(msg, { status }));

  let form: FormData;
  try { form = await request.formData(); } catch { return fail('Invalid form'); }
  if (clip(form.get('bot-field'), 100)) return wantsJson ? json({ ok: true }) : redirect('/thanks', 303); // honeypot
  const kind = KINDS[clip(form.get('form-name'), 40)];
  if (!kind) return fail('Unknown form');

  const row = { kind, topic: '', name: clip(form.get('name'), 120), email: clip(form.get('email'), 200), phone: clip(form.get('phone'), 40), body: '', details: {} as Record<string, string> };
  if (kind === 'ask') {
    row.topic = clip(form.get('topic'), 80);
    row.body = clip(form.get('question'), 5000);
    row.details = { mayShare: form.get('may-share-anonymously') ? 'yes' : 'no' };
  } else if (kind === 'service') {
    row.topic = clip(form.get('service'), 40);
    row.body = clip(form.get('details'), 5000);
    row.details = { preferredDate: clip(form.get('date'), 20) };
  } else {
    row.topic = clip(form.get('interest'), 80);
    row.body = clip(form.get('message'), 5000);
    const contact = clip(form.get('contact'), 200);
    if (contact.includes('@')) row.email = contact; else row.phone = contact;
  }
  if (kind === 'ask' && row.body.length < 5) return fail('Please write your question.');
  if (kind !== 'ask' && !row.name) return fail('Please add your name.');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return fail('Please check your email address.');

  const { error } = await serviceClient().from('messages').insert(row);
  if (error) { console.error('submit failed', error); return fail('Could not save your message', 500); }
  return wantsJson ? json({ ok: true }) : redirect('/thanks', 303);
};
