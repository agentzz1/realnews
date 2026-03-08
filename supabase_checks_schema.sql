-- Pivot: supabase_checks_schema.sql
-- Create the new 'checks' table for on-demand Fact Check caching

create table
  public.checks (
    id character varying not null, -- Since we use a hash of the input text as ID for deduplication
    input_text text not null,
    input_type character varying not null default 'headline'::character varying,
    verdict character varying not null,
    confidence smallint not null,
    summary text not null,
    why_reasoning text[] null, -- Array of bullet points
    sources text[] null, -- Array of source URLs or names
    created_at timestamp with time zone not null default now(),
    constraint checks_pkey primary key (id)
  ) tablespace pg_default;

-- Row Level Security (RLS) policies
alter table public.checks enable row level security;

-- Allow public read access (so the frontend can quickly check if a cache exists)
create policy "Allow public read access to checks"
  on public.checks
  for select
  using (true);

-- Allow anonymous inserts (for the frontend/API to insert new cache results)
create policy "Allow anon insert to checks"
  on public.checks
  for insert
  with check (true);
