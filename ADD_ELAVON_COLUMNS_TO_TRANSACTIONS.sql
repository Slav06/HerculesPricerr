-- Add Elavon-specific columns to existing transactions table
-- Run this in Supabase SQL Editor

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS card_number TEXT,
  ADD COLUMN IF NOT EXISTS exp_date TEXT,
  ADD COLUMN IF NOT EXISTS trans_status TEXT,
  ADD COLUMN IF NOT EXISTS settle_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_batch TEXT,
  ADD COLUMN IF NOT EXISTS entry_mode TEXT,
  ADD COLUMN IF NOT EXISTS avs_response TEXT,
  ADD COLUMN IF NOT EXISTS cvv2_response TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- Allow anon to read/write (same as other tables)
CREATE POLICY IF NOT EXISTS "anon_select_transactions" ON transactions FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_insert_transactions" ON transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_update_transactions" ON transactions FOR UPDATE TO anon USING (true);
