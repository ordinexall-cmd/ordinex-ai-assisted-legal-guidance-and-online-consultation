-- ============================================================
-- Ordinex Phase 2: corpus freshness + superseded/amended tracking
-- Run after 001_legal_corpus.sql (and optionally 003_pgvector.sql)
--
-- Adds:
--   - content_hash: SHA-256 of the canonical content so we can
--     detect amendments (same source_url, different content)
--   - status: 'ACTIVE' | 'SUPERSEDED' | 'AMENDED' | 'REPEALED'
--   - superseded_by: FK to the legal_source that replaced this one
--   - last_checked_at, last_changed_at: freshness metadata
--   - priority: 'high' | 'medium' | 'low' (curated highlight tier)
-- ============================================================

alter table public.legal_sources
  add column if not exists content_hash text,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists superseded_by uuid references public.legal_sources(id),
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_changed_at timestamptz,
  add column if not exists priority text not null default 'medium';

create index if not exists idx_legal_sources_status
  on public.legal_sources(status);
create index if not exists idx_legal_sources_priority
  on public.legal_sources(priority);
create index if not exists idx_legal_sources_last_changed
  on public.legal_sources(last_changed_at);

-- Update the semantic-search RPC so callers receive freshness/status
-- alongside each chunk. Existing callers are forward-compatible
-- because columns are appended.
create or replace function match_legal_chunks(
  query_embedding vector(768),
  match_count int default 8
)
returns table (
  id uuid,
  content text,
  keywords text,
  region text,
  source_id uuid,
  name text,
  citation text,
  category text,
  source_url text,
  status text,
  priority text,
  last_changed_at timestamptz,
  superseded_by uuid,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.content,
    c.keywords,
    c.region,
    s.id as source_id,
    s.name,
    s.citation,
    s.category,
    s.source_url,
    s.status,
    s.priority,
    s.last_changed_at,
    s.superseded_by,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.legal_chunks c
  join public.legal_sources s on s.id = c.source_id
  where c.embedding is not null
    and s.status in ('ACTIVE', 'AMENDED')  -- exclude REPEALED / SUPERSEDED from retrieval by default
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
