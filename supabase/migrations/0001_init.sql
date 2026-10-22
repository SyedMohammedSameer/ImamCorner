-- Imam's Corner schema. Public visitors can read published content; only admins can write.
-- Messages from the public forms are inserted by the server (secret key) and readable only by admins.

create extension if not exists pgcrypto;

-- ───────── Admins ─────────
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ───────── Settings (single row) ─────────
create table public.settings (
  id int primary key default 1 check (id = 1),
  center_name text not null default 'Islamic Center of Tucson',
  tagline text not null default 'Guidance, learning and care for the Muslim community of Tucson.',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  maps_url text not null default '',
  website_url text not null default '',
  booking_url text not null default '',
  office_location text not null default 'ICT Office',
  jummah_time time not null default '12:25',
  jummah_end time not null default '12:50',
  jummah_note text not null default '',
  rotation_anchor date not null default '2023-12-15',
  rotation_every int not null default 4 check (rotation_every >= 1),
  rotation_imam uuid,
  default_imam uuid,
  lat double precision not null default 32.2296,
  lng double precision not null default -110.9592,
  utc_offset int not null default -7,
  fajr_angle double precision not null default 15,
  isha_angle double precision not null default 15,
  asr_factor int not null default 1 check (asr_factor in (1, 2)),
  updated_at timestamptz not null default now()
);

-- ───────── Imams ─────────
create table public.imams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  role text not null default '',
  email text not null default '',
  photo_url text not null default '',
  bio text not null default '',
  focus text[] not null default '{}',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.settings
  add constraint settings_rotation_imam_fk foreign key (rotation_imam) references public.imams (id) on delete set null,
  add constraint settings_default_imam_fk foreign key (default_imam) references public.imams (id) on delete set null;

-- ───────── Jummah overrides (one row per changed Friday) ─────────
create table public.khutbah_overrides (
  date date primary key check (extract(isodow from date) = 5),
  imam_id uuid references public.imams (id) on delete set null,
  guest_name text not null default '',
  topic text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now()
);

-- ───────── Classes & office hours ─────────
create type public.program_kind as enum ('reminder', 'class', 'youth', 'quran');
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  arabic text not null default '',
  subtitle text not null default '',
  kind public.program_kind not null default 'class',
  days text[] not null default '{}' check (days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']),
  time_label text not null default '',
  sort_minutes int not null default 1200,
  presenter uuid references public.imams (id) on delete set null,
  audience text not null default 'Everyone',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.office_hours (
  day text primary key check (day in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  time_label text not null default '',   -- empty = closed
  sort int not null
);

-- ───────── Library ─────────
create type public.resource_type as enum ('khutbah', 'book', 'notes', 'guide');
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type public.resource_type not null default 'khutbah',
  date date not null default current_date,
  file_path text not null,             -- path inside the "library" storage bucket
  file_size bigint not null default 0,
  original_size bigint not null default 0,
  pages int not null default 0,
  author text not null default '',
  imam_id uuid references public.imams (id) on delete set null,
  summary text not null default '',
  tags text[] not null default '{}',
  audio_url text not null default '',
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resources_published_date on public.resources (published, date desc);

-- ───────── Recommended books ─────────
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  category text not null default 'Start here',
  level text not null default 'Beginner' check (level in ('Beginner','Intermediate','Advanced')),
  why text not null default '',
  resource_id uuid references public.resources (id) on delete set null,
  link text not null default '',
  starter boolean not null default false,
  sort int not null default 100,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────── Announcements & reminders ─────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  link text not null default '',
  link_label text not null default '',
  starts_on date not null default current_date,
  expires_on date,
  created_at timestamptz not null default now()
);

create table public.ayat (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  ar text not null,
  en text not null,
  sort int not null default 0
);

-- ───────── Messages from the public forms ─────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ask', 'service', 'new-muslim')),
  topic text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  body text not null default '',
  details jsonb not null default '{}',
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);
create index messages_status_created on public.messages (status, created_at desc);

-- ───────── updated_at triggers ─────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger resources_touch before update on public.resources for each row execute function public.touch_updated_at();
create trigger overrides_touch before update on public.khutbah_overrides for each row execute function public.touch_updated_at();

-- ───────── Row level security ─────────
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.imams enable row level security;
alter table public.khutbah_overrides enable row level security;
alter table public.programs enable row level security;
alter table public.office_hours enable row level security;
alter table public.resources enable row level security;
alter table public.books enable row level security;
alter table public.announcements enable row level security;
alter table public.ayat enable row level security;
alter table public.messages enable row level security;

-- Public read
create policy "public read" on public.settings for select using (true);
create policy "public read" on public.imams for select using (true);
create policy "public read" on public.khutbah_overrides for select using (true);
create policy "public read" on public.programs for select using (active or public.is_admin());
create policy "public read" on public.office_hours for select using (true);
create policy "public read" on public.resources for select using (published or public.is_admin());
create policy "public read" on public.books for select using (published or public.is_admin());
create policy "public read" on public.announcements for select using (true);
create policy "public read" on public.ayat for select using (true);

-- Admin write (and admin-only tables)
create policy "admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.imams for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.khutbah_overrides for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.programs for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.office_hours for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.resources for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.books for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.ayat for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.messages for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read" on public.admins for select using (public.is_admin());
create policy "admins remove" on public.admins for delete using (public.is_admin() and user_id <> auth.uid());

-- ───────── Storage: public "library" (PDFs) and "media" (photos) buckets ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('library', 'library', true, 52428800, array['application/pdf']),
  ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admin upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('library', 'media') and public.is_admin());
create policy "admin update" on storage.objects for update to authenticated
  using (bucket_id in ('library', 'media') and public.is_admin());
create policy "admin delete" on storage.objects for delete to authenticated
  using (bucket_id in ('library', 'media') and public.is_admin());
create policy "admin read" on storage.objects for select to authenticated
  using (bucket_id in ('library', 'media') and public.is_admin());
