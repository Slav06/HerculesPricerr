-- Create transactions table for storing payment records
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    card_type VARCHAR(50),
    card_last_four VARCHAR(4),
    transaction_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    response_code VARCHAR(10),
    response_message TEXT,
    auth_code VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(255),
    raw_request JSONB,
    raw_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_at ON transactions(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_success ON transactions(success);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (adjust based on your user management)
-- CREATE POLICY "Users can view their own transactions" ON transactions
--     FOR SELECT USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can insert their own transactions" ON transactions
--     FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Grant permissions (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE ON transactions TO authenticated;
-- GRANT USAGE ON SEQUENCE transactions_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE transactions IS 'Stores payment transaction records from Elavon XML API';
COMMENT ON COLUMN transactions.transaction_id IS 'Elavon transaction ID';
COMMENT ON COLUMN transactions.amount IS 'Transaction amount in dollars';
COMMENT ON COLUMN transactions.card_type IS 'Detected card type (visa, mastercard, etc.)';
COMMENT ON COLUMN transactions.card_last_four IS 'Last four digits of card number';
COMMENT ON COLUMN transactions.transaction_type IS 'Elavon transaction type (ccsale, ccauthonly, etc.)';
COMMENT ON COLUMN transactions.success IS 'Whether transaction was successful';
COMMENT ON COLUMN transactions.response_code IS 'Elavon response code';
COMMENT ON COLUMN transactions.response_message IS 'Elavon response message';
COMMENT ON COLUMN transactions.auth_code IS 'Authorization code from processor';
COMMENT ON COLUMN transactions.processed_at IS 'When transaction was processed';
COMMENT ON COLUMN transactions.user_id IS 'User who initiated the transaction';
COMMENT ON COLUMN transactions.raw_request IS 'Original payment request data (JSON)';
COMMENT ON COLUMN transactions.raw_response IS 'Raw XML response from Elavon';

