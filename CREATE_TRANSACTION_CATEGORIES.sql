-- Transaction categories table
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_txn_cat" ON transaction_categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_txn_cat" ON transaction_categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_txn_cat" ON transaction_categories FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_txn_cat" ON transaction_categories FOR DELETE TO anon USING (true);

-- Add category column to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL;
