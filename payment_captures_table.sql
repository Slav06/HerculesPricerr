-- Create payment_captures table in Supabase
CREATE TABLE IF NOT EXISTS payment_captures (
    id BIGSERIAL PRIMARY KEY,
    
    -- Job Information
    job_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    job_id VARCHAR(255),
    url TEXT,
    
    -- Personal Information
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Address Information
    billing_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    
    -- Card Information (encrypted for security)
    card_number_encrypted TEXT,
    card_number_iv TEXT,
    card_last_four VARCHAR(4),
    card_type VARCHAR(50),
    security_code_encrypted TEXT,
    security_code_iv TEXT,
    exp_month VARCHAR(2),
    exp_year VARCHAR(4),
    exp_date VARCHAR(10),
    
    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    
    -- Payment Information
    payment_method VARCHAR(50),
    payment_amount DECIMAL(10,2),
    confirmation_number VARCHAR(100),
    notes TEXT,
    
    -- Metadata
    status VARCHAR(50) DEFAULT 'captured',
    captured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_captures_job_number ON payment_captures(job_number);
CREATE INDEX IF NOT EXISTS idx_payment_captures_customer_name ON payment_captures(customer_name);
CREATE INDEX IF NOT EXISTS idx_payment_captures_created_at ON payment_captures(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_captures_status ON payment_captures(status);

-- Enable Row Level Security (RLS)
ALTER TABLE payment_captures ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (adjust based on your security needs)
CREATE POLICY "Allow all operations for authenticated users" ON payment_captures
    FOR ALL USING (auth.role() = 'authenticated');

-- Create RLS policy for anonymous access (for testing)
CREATE POLICY "Allow anonymous inserts for payment captures" ON payment_captures
    FOR INSERT WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_captures_updated_at 
    BEFORE UPDATE ON payment_captures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data for testing (optional)
INSERT INTO payment_captures (
    job_number, customer_name, full_name, billing_address, city, state, zip_code,
    card_number_masked, card_last_four, status, captured_at
) VALUES (
    'TEST001', 'Test Customer', 'John Doe', '123 Test St', 'Test City', 'TX', '12345',
    '****1234', '1234', 'captured', NOW()
) ON CONFLICT DO NOTHING;
