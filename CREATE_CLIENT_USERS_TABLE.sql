-- Create client_users table for client portal login
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.client_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, -- bcrypt hash
    full_name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Add user_id to agreements table to link agreements to client accounts
ALTER TABLE public.agreements 
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES public.client_users(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_users_email ON public.client_users(email);
CREATE INDEX IF NOT EXISTS idx_agreements_client_user_id ON public.agreements(client_user_id);
CREATE INDEX IF NOT EXISTS idx_agreements_customer_email ON public.agreements(customer_email);

-- Add comments
COMMENT ON TABLE public.client_users IS 'Client portal user accounts';
COMMENT ON COLUMN public.client_users.password_hash IS 'bcrypt hashed password';
COMMENT ON COLUMN public.agreements.client_user_id IS 'Links agreement to client user account (optional)';

-- Enable RLS (Row Level Security) - clients can only see their own agreements
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can only view their own user record
CREATE POLICY "Clients can view own profile" ON public.client_users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Policy: Clients can update their own profile
CREATE POLICY "Clients can update own profile" ON public.client_users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Policy: Clients can view their own agreements
CREATE POLICY "Clients can view own agreements" ON public.agreements
    FOR SELECT USING (
        client_user_id::text = auth.uid()::text OR
        customer_email = (SELECT email FROM public.client_users WHERE id::text = auth.uid()::text)
    );

-- Note: For this implementation, we'll use a simpler approach with session tokens
-- stored in localStorage, so RLS policies above are optional.
-- The API endpoints will handle authentication and authorization.
