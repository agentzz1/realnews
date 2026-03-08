-- Run this in the Supabase UI -> SQL Editor -> New Query

CREATE TABLE IF NOT EXISTS public.news (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  summary text NOT NULL,
  source text NOT NULL,
  "sourceUrl" text NOT NULL,
  category text NOT NULL,
  "publishedAt" timestamp with time zone NOT NULL,
  "factStatus" text NOT NULL,
  confidence numeric NOT NULL,
  "factCheckSummary" text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Basic Row Level Security (RLS) policies 
-- Everyone can read the news, but only authenticated users (or service role) can insert
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON public.news
  FOR SELECT
  USING (true);

-- For prototype/demo purposes, allowing insert from anon (since we use anon key in cron).
-- In production, the cron should use the SERVICE_ROLE key to bypass RLS.
CREATE POLICY "Allow anon insert for cron prototype"
  ON public.news
  FOR INSERT
  WITH CHECK (true);
