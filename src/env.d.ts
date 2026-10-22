/// <reference types="astro/client" />
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly SUPABASE_SECRET_KEY: string;
}
declare namespace App {
  interface Locals {
    settings: import('./lib/data').Settings;
    imams: import('./lib/data').Imam[];
  }
}
