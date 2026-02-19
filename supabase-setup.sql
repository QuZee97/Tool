-- ── VISO MEDIA TOOL – Supabase Setup ────────────────────────
-- Im Supabase Dashboard unter SQL Editor ausführen

-- 1. Tabellen erstellen
create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  firma text not null,
  ansp text,
  str text,
  ort text,
  land text,
  email text,
  created_at timestamptz default now()
);

create table if not exists library (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  desc text not null,
  details text,
  menge text default '1',
  einheit text default 'pauschal',
  preis text,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  typ text not null,
  nr text not null,
  datum text,
  gueltig text,
  von text,
  bis text,
  betreff text,
  zahlung text default 'voll',
  hinweise text,
  firma text,
  ansp text,
  str text,
  ort text,
  land text,
  uid text,
  lang text default 'de',
  tax text default 'de',
  positionen jsonb default '[]',
  status jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(nr, user_id)
);

create table if not exists email_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  subject text,
  body text,
  created_at timestamptz default now(),
  unique(key, user_id)
);

-- 2. Row Level Security aktivieren (nur der eigene User sieht seine Daten)
alter table customers enable row level security;
alter table library enable row level security;
alter table documents enable row level security;
alter table email_templates enable row level security;

-- 3. Policies: jeder User sieht/ändert nur seine eigenen Zeilen
create policy "own data" on customers for all using (auth.uid() = user_id);
create policy "own data" on library for all using (auth.uid() = user_id);
create policy "own data" on documents for all using (auth.uid() = user_id);
create policy "own data" on email_templates for all using (auth.uid() = user_id);

-- Fertig! Jetzt im Supabase Dashboard unter Authentication → Users
-- deinen Account anlegen (E-Mail + Passwort).
