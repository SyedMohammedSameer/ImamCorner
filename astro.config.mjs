import { defineConfig } from 'astro/config';

// Set SITE_URL in Netlify (Site settings → Environment variables) once a domain is chosen.
export default defineConfig({
  site: process.env.SITE_URL || process.env.URL || 'https://imams-corner.netlify.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'file' },
  vite: {
    optimizeDeps: { exclude: ['pdfjs-dist'] },
    build: { target: 'es2022' },
  },
});
