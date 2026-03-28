-- Add 3-step agreement flow: Moving Estimate (1), Bill of Lading (2), Credit Card Authorization (3)
-- Run in Supabase SQL editor

alter table public.agreements
  add column if not exists document_type text default 'moving_estimate',
  add column if not exists step_order int default 1;

comment on column public.agreements.document_type is 'moving_estimate | bill_of_lading | credit_card_authorization';
comment on column public.agreements.step_order is '1, 2, or 3 for 3-step flow';

create index if not exists agreements_step_lookup_idx
  on public.agreements (job_submission_id, step_order);

-- Backfill: existing rows stay as single-step (step_order 1, document_type moving_estimate)
update public.agreements
  set document_type = coalesce(document_type, 'moving_estimate'),
      step_order = coalesce(step_order, 1)
  where document_type is null or step_order is null;
