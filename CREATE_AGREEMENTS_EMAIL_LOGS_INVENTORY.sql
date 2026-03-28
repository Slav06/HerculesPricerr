-- Create tables for inventory persistence, agreements, signatures, and email logs
-- Run this in Supabase SQL editor

-- Inventory saved per job submission
-- job_number is the primary lookup key (text, always safe to query)
create table if not exists public.inventory_submissions (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  customer_name text,
  items jsonb not null default '[]'::jsonb, -- array of {name, volume, qty, custom}
  total_volume numeric,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- If the table already exists with the old uuid job_submission_id column, run:
-- alter table public.inventory_submissions drop column if exists job_submission_id;
-- alter table public.inventory_submissions alter column job_number set not null;
-- alter table public.inventory_submissions add constraint inventory_submissions_job_number_key unique (job_number);

create index if not exists inventory_submissions_job_number_idx
  on public.inventory_submissions (job_number);

-- Agreement + e-signature capture
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  job_submission_id uuid not null,
  job_number text,
  customer_name text,
  customer_email text,
  agreement_title text default 'Moving Agreement',
  agreement_body jsonb, -- optional: store structured agreement sections (future)
  inventory_snapshot jsonb, -- snapshot of inventory items at time of create
  status text not null default 'pending', -- pending | signed | void

  signer_name text,
  signature_data_url text, -- base64 image from canvas
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agreements_job_submission_id_idx
  on public.agreements (job_submission_id);

create index if not exists agreements_status_idx
  on public.agreements (status);

-- Email logs (sent emails + optional agreement linkage)
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  to_email text,
  subject text,
  from_email text,
  template_id text,
  resend_id text,

  status text not null default 'sent', -- sent | failed
  error text,

  job_submission_id uuid,
  agreement_id uuid,
  agreement_token text
);

create index if not exists email_logs_created_at_idx
  on public.email_logs (created_at desc);

create index if not exists email_logs_agreement_id_idx
  on public.email_logs (agreement_id);

-- Notes:
-- - If you have RLS enabled, add appropriate policies for these tables.
-- - This project currently uses the anon key directly in the browser, so you may have RLS disabled.

