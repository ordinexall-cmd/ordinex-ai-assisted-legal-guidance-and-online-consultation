-- Ordinex legal knowledge base (run in Supabase SQL Editor)
-- Project: tuvrxpvoaymvdacosalz

-- Optional Phase 2: semantic search
-- create extension if not exists vector;

create table if not exists public.legal_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  citation text not null,
  category text not null,
  region text not null default 'National',
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.legal_sources(id) on delete cascade,
  content text not null,
  keywords text not null default '',
  region text not null default 'National',
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_chunks_region on public.legal_chunks(region);
create index if not exists idx_legal_sources_category on public.legal_sources(category);

-- Allow API access (service_role key bypasses RLS; anon not needed for server seed)
alter table public.legal_sources enable row level security;
alter table public.legal_chunks enable row level security;
create policy "service_role_all_sources" on public.legal_sources for all to service_role using (true) with check (true);
create policy "service_role_all_chunks" on public.legal_chunks for all to service_role using (true) with check (true);

-- alter table public.legal_chunks add column if not exists embedding vector(768);
