-- Pivot: supabase_checks_schema_v2.sql
-- Create the new 'checks' table for robust on-demand Fact Check caching (V2 with Hashes & JSONB)

drop table if exists public.checks;

create table
  public.checks (
    id uuid not null default gen_random_uuid(),
    input_text text not null,
    input_hash character varying not null, -- Normalized hash for deduplication and O(1) lookups
    input_type character varying not null default 'headline'::character varying,
    verdict character varying not null,
    confidence smallint not null,
    summary text not null,
    why_reasoning jsonb null default '[]'::jsonb, -- Array of strings
    sources jsonb null default '[]'::jsonb, -- Array of objects: { title: string, url: string }
    model_used character varying not null default 'gemini-2.5-flash'::character varying,
    created_at timestamp with time zone not null default now(),
    constraint checks_pkey primary key (id),
    constraint checks_input_hash_key unique (input_hash)
  ) tablespace pg_default;

-- Row Level Security (RLS) policies
alter table public.checks enable row level security;

-- Allow public read access (so the frontend/API can quickly check if a cache exists)
create policy "Allow public read access to checks"
  on public.checks
  for select
  using (true);

-- Allow anonymous inserts (for the API to insert new cache results)
create policy "Allow anon insert to checks"
  on public.checks
  for insert
  with check (true);
