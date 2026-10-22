import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import preact from '@astrojs/preact';

// Pages render on request from Supabase and are cached at Netlify's edge (see src/middleware.ts),
// so changes made in the admin dashboard go live without a rebuild.
export default defineConfig({
  site: process.env.SITE_URL || process.env.URL || 'https://imamcorner.netlify.app',
  output: 'server',
  adapter: netlify(),
  integrations: [preact()],
  trailingSlash: 'ignore',
  build: { format: 'file' },
  vite: {
    optimizeDeps: { exclude: ['pdfjs-dist'] },
    build: { target: 'es2022' },
  },
});
