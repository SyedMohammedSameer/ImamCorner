import { defineMiddleware } from 'astro:middleware';
import { loadCore } from './lib/data';

// Public pages are cached at Netlify's edge for a minute and refreshed in the background.
// Admin saves also purge the "content" tag (see /api/purge), so changes usually show immediately.
export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const isAdmin = path.startsWith('/admin');
  const isApi = path.startsWith('/api/');
  if (ctx.isPrerendered || isApi) return next();

  if (!isAdmin) {
    try {
      Object.assign(ctx.locals, await loadCore());
    } catch (err) {
      console.error(err);
      return new Response(errorPage(), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '30' } });
    }
  }

  const res = await next();
  if (isAdmin) {
    res.headers.set('Cache-Control', 'no-store');
  } else if (ctx.request.method === 'GET' && res.status === 200) {
    res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    res.headers.set('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=60, stale-while-revalidate=604800');
    res.headers.set('Netlify-Cache-Tag', 'content');
  }
  return res;
});

const errorPage = () => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Imam's Corner</title><body style="font-family:-apple-system,system-ui,sans-serif;background:#f7f2ea;color:#1c1915;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">
<div><h1 style="letter-spacing:-.03em">We'll be right back.</h1><p>The site couldn't load its content. Please try again in a moment.</p><p><a href="/prayer-times" style="color:#0e6b66">Prayer times</a></p></div>`;
