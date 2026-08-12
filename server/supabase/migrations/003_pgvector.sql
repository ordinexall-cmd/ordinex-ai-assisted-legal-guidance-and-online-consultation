-- Phase 2: semantic legal search (optional)
-- Run after 001_legal_corpus.sql

create extension if not exists vector;

alter table public.legal_chunks
  add column if not exists embedding vector(768);

create index if not exists idx_legal_chunks_embedding
  on public.legal_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic search RPC (used when embeddings are populated)
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
    1 - (c.embedding <=> query_embedding) as similarity
  from public.legal_chunks c
  join public.legal_sources s on s.id = c.source_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Populate embeddings via: npm run embed:legal
