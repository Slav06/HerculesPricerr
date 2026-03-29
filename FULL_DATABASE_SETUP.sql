-- ============================================================
-- HERCULES MOVING SOLUTIONS - COMPLETE DATABASE SETUP
-- Run this entire file in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- 1a. job_submissions (main table - all leads/jobs)
CREATE TABLE IF NOT EXISTS job_submissions (
    id BIGSERIAL PRIMARY KEY,
    job_number VARCHAR(255) NOT NULL,
    page_url TEXT,
    source VARCHAR(255) DEFAULT 'Page Price Analyzer Extension',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- User/profile info
    user_name VARCHAR(100),
    chrome_profile_id VARCHAR(255),
    chrome_profile_name VARCHAR(255),
    user_identifier VARCHAR(255),
    chrome_email VARCHAR(255),
    is_managed_profile BOOLEAN DEFAULT FALSE,
    -- Customer info
    customer_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    -- Moving details
    moving_from VARCHAR(255),
    moving_to VARCHAR(255),
    cubes VARCHAR(50),
    pickup_date VARCHAR(50),
    distance VARCHAR(100),
    -- Status & assignment
    status VARCHAR(255) DEFAULT 'pending',
    assigned_to VARCHAR(100),
    transferred_to VARCHAR(100),
    -- Booking
    booked_by VARCHAR(255),
    total_deposit DECIMAL(10,2),
    total_collected DECIMAL(10,2),
    total_binder DECIMAL(10,2),
    booked_at TIMESTAMP WITH TIME ZONE,
    -- Cancellation
    cancelled_by VARCHAR(255),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    -- Payment
    payment_amount DECIMAL(10,2),
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    payment_notes TEXT,
    deposit_amount DECIMAL(10,2),
    -- Card on file
    card_number TEXT,
    expiry_date TEXT,
    cvv TEXT,
    cardholder_name VARCHAR(255),
    card_last_four VARCHAR(4),
    card_type VARCHAR(50),
    billing_address TEXT,
    -- Follow-up
    closer_notes TEXT,
    callback_date DATE,
    callback_time TIME,
    callback_datetime TIMESTAMP WITH TIME ZONE,
    callback_attempt INTEGER DEFAULT 0,
    follow_up_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    follow_up_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Outcome
    lead_outcome VARCHAR(50),
    outcome_notes TEXT,
    outcome_date TIMESTAMP WITH TIME ZONE,
    outcome_by VARCHAR(255),
    next_followup_date TIMESTAMP WITH TIME ZONE,
    priority_level INTEGER DEFAULT 0,
    success_chance INTEGER DEFAULT NULL CHECK (success_chance IS NULL OR (success_chance >= 0 AND success_chance <= 100)),
    -- Pricing
    per_cf NUMERIC DEFAULT NULL,
    fuel_surcharge_pct NUMERIC DEFAULT 15,
    discount_amount NUMERIC DEFAULT 0,
    total_estimate NUMERIC DEFAULT NULL,
    priced_by_admin BOOLEAN DEFAULT FALSE
);

-- Indexes for job_submissions
CREATE INDEX IF NOT EXISTS idx_job_submissions_job_number ON job_submissions(job_number);
CREATE INDEX IF NOT EXISTS idx_customer_name ON job_submissions(customer_name);
CREATE INDEX IF NOT EXISTS idx_moving_from ON job_submissions(moving_from);
CREATE INDEX IF NOT EXISTS idx_moving_to ON job_submissions(moving_to);
CREATE INDEX IF NOT EXISTS idx_cubes ON job_submissions(cubes);
CREATE INDEX IF NOT EXISTS idx_pickup_date ON job_submissions(pickup_date);
CREATE INDEX IF NOT EXISTS idx_user_name ON job_submissions(user_name);
CREATE INDEX IF NOT EXISTS idx_job_submissions_email ON job_submissions(email);
CREATE INDEX IF NOT EXISTS idx_job_submissions_phone ON job_submissions(phone);
CREATE INDEX IF NOT EXISTS idx_job_submissions_assigned_to ON job_submissions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_submissions_booked_by ON job_submissions(booked_by);
CREATE INDEX IF NOT EXISTS idx_job_submissions_booked_at ON job_submissions(booked_at);
CREATE INDEX IF NOT EXISTS idx_job_submissions_cancelled_at ON job_submissions(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_job_submissions_payment_status ON job_submissions(payment_status);
CREATE INDEX IF NOT EXISTS idx_job_submissions_callback_datetime ON job_submissions(callback_datetime) WHERE callback_datetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_submissions_transferred_to ON job_submissions(transferred_to) WHERE transferred_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_submissions_priority_level ON job_submissions(priority_level DESC);
CREATE INDEX IF NOT EXISTS idx_job_submissions_outcome_date ON job_submissions(outcome_date);

-- Triggers for job_submissions
CREATE OR REPLACE FUNCTION update_follow_up_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.follow_up_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follow_up_timestamp ON job_submissions;
CREATE TRIGGER trigger_update_follow_up_timestamp
    BEFORE UPDATE ON job_submissions
    FOR EACH ROW
    WHEN (OLD.closer_notes IS DISTINCT FROM NEW.closer_notes
       OR OLD.callback_date IS DISTINCT FROM NEW.callback_date
       OR OLD.callback_time IS DISTINCT FROM NEW.callback_time
       OR OLD.callback_datetime IS DISTINCT FROM NEW.callback_datetime)
    EXECUTE FUNCTION update_follow_up_timestamp();

CREATE OR REPLACE FUNCTION set_callback_datetime()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.callback_date IS NOT NULL AND NEW.callback_time IS NOT NULL THEN
        NEW.callback_datetime = (NEW.callback_date::text || ' ' || NEW.callback_time::text)::timestamp with time zone;
    ELSIF NEW.callback_datetime IS NOT NULL THEN
        NEW.callback_date = NEW.callback_datetime::date;
        NEW.callback_time = NEW.callback_datetime::time;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_callback_datetime ON job_submissions;
CREATE TRIGGER trigger_set_callback_datetime
    BEFORE INSERT OR UPDATE ON job_submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_callback_datetime();

CREATE OR REPLACE FUNCTION update_job_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_submissions_updated_at ON job_submissions;
CREATE TRIGGER trigger_update_job_submissions_updated_at
    BEFORE UPDATE ON job_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_submissions_updated_at();


-- 1b. dashboard_users (staff login)
CREATE TABLE IF NOT EXISTS dashboard_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent',
    secret_key TEXT,
    secretkey TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    isactive BOOLEAN DEFAULT TRUE,
    dashboard_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 1c. client_users (client portal login)
CREATE TABLE IF NOT EXISTS public.client_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);


-- ============================================================
-- 2. AGREEMENTS, EMAIL, INVENTORY
-- ============================================================

-- 2a. agreements
CREATE TABLE IF NOT EXISTS public.agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    job_submission_id UUID NOT NULL,
    job_number TEXT,
    customer_name TEXT,
    customer_email TEXT,
    agreement_title TEXT DEFAULT 'Moving Agreement',
    agreement_body JSONB,
    inventory_snapshot JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    signer_name TEXT,
    signature_data_url TEXT,
    signed_at TIMESTAMPTZ,
    signer_ip TEXT,
    signer_user_agent TEXT,
    document_type TEXT DEFAULT 'moving_estimate',
    step_order INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agreements_step_lookup_idx ON public.agreements (job_submission_id, step_order);

-- 2b. email_logs
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    to_email TEXT,
    subject TEXT,
    from_email TEXT,
    template_id TEXT,
    resend_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error TEXT,
    job_submission_id UUID,
    agreement_id UUID,
    agreement_token TEXT
);

-- 2c. inventory_submissions
CREATE TABLE IF NOT EXISTS public.inventory_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_number TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_volume NUMERIC,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2d. inventory_photos
CREATE TABLE IF NOT EXISTS inventory_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_number TEXT NOT NULL,
    item_name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. TRANSACTIONS & PAYMENTS
-- ============================================================

-- 3a. transactions
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Elavon columns
    first_name TEXT,
    last_name TEXT,
    card_number TEXT,
    exp_date TEXT,
    trans_status TEXT,
    settle_time TIMESTAMPTZ,
    settlement_batch TEXT,
    entry_mode TEXT,
    avs_response TEXT,
    cvv2_response TEXT,
    refunded_amount NUMERIC(10,2),
    note TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    -- Job linkage
    job_submission_id BIGINT,
    job_number TEXT
);

-- 3b. transaction_categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3c. payment_captures
CREATE TABLE IF NOT EXISTS payment_captures (
    id BIGSERIAL PRIMARY KEY,
    job_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    job_id VARCHAR(255),
    url TEXT,
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    billing_address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    card_number_encrypted TEXT,
    card_number_iv TEXT,
    card_last_four VARCHAR(4),
    card_type VARCHAR(50),
    security_code_encrypted TEXT,
    security_code_iv TEXT,
    exp_month VARCHAR(2),
    exp_year VARCHAR(4),
    exp_date VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    payment_method VARCHAR(50),
    payment_amount DECIMAL(10,2),
    confirmation_number VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'captured',
    captured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Plaintext columns for add-card flow
    card_number_plain TEXT,
    security_code_plain VARCHAR(10)
);


-- ============================================================
-- 4. SCHEDULE & EMPLOYEES
-- ============================================================

-- 4a. employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'staff',
    slack_user_id TEXT,
    default_shift_start TIME,
    default_shift_end TIME,
    default_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4b. schedule_entries
CREATE TABLE IF NOT EXISTS schedule_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    schedule_date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    confirmed_at TIMESTAMPTZ,
    callout_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_name, schedule_date)
);

-- 4c. schedule_swaps
CREATE TABLE IF NOT EXISTS schedule_swaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    swap_date DATE NOT NULL,
    requester_shift_start TIME,
    requester_shift_end TIME,
    target_shift_start TIME,
    target_shift_end TIME,
    status TEXT DEFAULT 'pending',
    requester_message TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 5. DISPOSITIONS & STATUS TIERS
-- ============================================================

-- 5a. job_status_tiers
CREATE TABLE IF NOT EXISTS public.job_status_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    tier INT NOT NULL DEFAULT 4,
    category TEXT DEFAULT 'maybe' CHECK (category IN ('good', 'maybe', 'dead')),
    callback_mode TEXT DEFAULT 'user_select',
    callback_cadence_days INTEGER DEFAULT NULL,
    max_attempts INTEGER DEFAULT 0,
    wait_times_json TEXT DEFAULT '[]',
    priority_score INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default status tiers
INSERT INTO job_status_tiers (status_key, display_name, tier, category, priority_score, max_attempts, wait_times_json) VALUES
    ('pending', 'New Lead', 1, 'maybe', 100, 0, '[]'),
    ('inv_done', 'Inventory Done', 2, 'good', 95, 0, '[]'),
    ('cb_scheduled', 'Callback Scheduled', 2, 'maybe', 90, 0, '[1440]'),
    ('transferred', 'Transferred', 2, 'maybe', 85, 0, '[]'),
    ('quoted', 'Quoted', 3, 'maybe', 70, 0, '[60]'),
    ('no_answer', 'No Answer', 3, 'maybe', 60, 5, '[5, 15, 30, 60, 1440]'),
    ('voicemail', 'Voicemail', 3, 'maybe', 55, 3, '[15, 60, 1440]'),
    ('booked', 'Booked', 4, 'good', 5, 0, '[]'),
    ('payment_captured', 'Payment Captured', 4, 'good', 5, 0, '[]'),
    ('completed', 'Completed', 5, 'good', 10, 0, '[]'),
    ('dropped', 'Dropped', 5, 'dead', 20, 0, '[]'),
    ('disqualified', 'Disqualified', 5, 'dead', 15, 0, '[]'),
    ('hung_up', 'Hung Up', 5, 'dead', 15, 0, '[]'),
    ('cancelled', 'Cancelled', 5, 'dead', 15, 0, '[]')
ON CONFLICT (status_key) DO NOTHING;

-- 5b. dispositions
CREATE TABLE IF NOT EXISTS dispositions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'system' CHECK (category IN ('positive', 'negative', 'system')),
    color TEXT DEFAULT '#94a3b8',
    is_final BOOLEAN DEFAULT false,
    dialerr_id INTEGER,
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5c. disposition_wait_times
CREATE TABLE IF NOT EXISTS disposition_wait_times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    disposition_id UUID REFERENCES dispositions(id) ON DELETE CASCADE,
    wait_minutes INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 6. JOB NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS job_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_submission_id UUID,
    job_number TEXT,
    author_name TEXT NOT NULL DEFAULT 'Unknown',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 7. SANDY (SLACK BOT) TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS sandy_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_channel TEXT DEFAULT 'sales-floor',
    confidence NUMERIC DEFAULT 0.8,
    times_seen INTEGER DEFAULT 1,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sandy_processed_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_ts TEXT NOT NULL UNIQUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sandy_sent_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_hash TEXT NOT NULL,
    message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sandy_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    targets TEXT NOT NULL,
    reminder_text TEXT NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_time TEXT DEFAULT '09:00',
    job_number TEXT,
    customer_name TEXT,
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sandy_custom_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_type TEXT NOT NULL DEFAULT 'track_keyword',
    keyword TEXT NOT NULL,
    action TEXT DEFAULT 'note',
    intel_text TEXT,
    suggestion_text TEXT,
    created_by TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 8. PAYROLL & COMMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_hours_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    worksnap_id INTEGER,
    date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT,
    requested_via TEXT DEFAULT 'slack',
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    rejected_by TEXT,
    reject_reason TEXT,
    worksnap_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_hours_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    worksnap_id INTEGER,
    date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT,
    approved_by TEXT,
    worksnap_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_confirmations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    week_start DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    hourly_pay NUMERIC(10,2),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    week_start DATE NOT NULL,
    role TEXT,
    transaction_id VARCHAR(255),
    customer_name TEXT,
    amount DECIMAL(10,2),
    commission_pct DECIMAL(5,2),
    commission_amount DECIMAL(10,2),
    job_number VARCHAR(255),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    week_start DATE NOT NULL,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    week_start DATE NOT NULL,
    hourly_pay NUMERIC(10,2),
    commission_pay NUMERIC(10,2),
    bonus NUMERIC(10,2),
    deductions NUMERIC(10,2),
    total_paid NUMERIC(10,2),
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL,
    backup_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT,
    week_start DATE,
    action TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. AGENT DISPATCH
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_job_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_user_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    job_submission_id BIGINT NOT NULL,
    job_number TEXT NOT NULL,
    assigned_by TEXT,
    status TEXT DEFAULT 'assigned',
    notes TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);


-- ============================================================
-- 10. LSA (LOCAL SERVICES ADS)
-- ============================================================

CREATE TABLE IF NOT EXISTS chatbot_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    profile_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lsa_lead_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id TEXT NOT NULL,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lsa_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lsa_scraped_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id TEXT,
    message_text TEXT,
    sender TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 11. GHL & CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ghl_analytics (
    id BIGSERIAL PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_contacts INTEGER DEFAULT 0,
    total_opportunities INTEGER DEFAULT 0,
    total_pipelines INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    data_snapshot JSONB,
    synced_by TEXT,
    sync_status TEXT DEFAULT 'completed',
    api_response_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    ghl_id VARCHAR(255) UNIQUE NOT NULL,
    location_id VARCHAR(255),
    contact_name VARCHAR(500),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    first_name_raw VARCHAR(255),
    last_name_raw VARCHAR(255),
    company_name VARCHAR(500),
    email VARCHAR(500),
    phone VARCHAR(100),
    dnd BOOLEAN DEFAULT FALSE,
    dnd_settings JSONB,
    type VARCHAR(100),
    source VARCHAR(255),
    assigned_to VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    address1 TEXT,
    date_added TIMESTAMP WITH TIME ZONE,
    date_updated TIMESTAMP WITH TIME ZONE,
    date_of_birth DATE,
    business_id VARCHAR(255),
    tags TEXT[],
    followers TEXT[],
    country VARCHAR(10),
    website VARCHAR(500),
    timezone VARCHAR(100),
    additional_emails JSONB,
    attributions JSONB,
    custom_fields JSONB,
    job_number VARCHAR(255),
    cubes INTEGER,
    distance INTEGER,
    pickup_address TEXT,
    delivery_address TEXT,
    pickup_date TIMESTAMP WITH TIME ZONE,
    delivery_date TIMESTAMP WITH TIME ZONE,
    packing_help_needed BOOLEAN,
    packing_help_details TEXT,
    levels_home INTEGER,
    outside_dwelling BOOLEAN,
    long_carry BOOLEAN,
    shuttle BOOLEAN,
    other_services TEXT[],
    situation_pickup TEXT,
    situation_delivery TEXT,
    receiver_delivery VARCHAR(255),
    secondary_lead_source VARCHAR(255),
    form_source VARCHAR(255),
    move_date_notes TEXT,
    additional_notes TEXT,
    immediately_delivery BOOLEAN,
    updates_sop BOOLEAN,
    release_notes TEXT,
    wrong_number BOOLEAN,
    turn_off_contact BOOLEAN,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_by VARCHAR(255),
    last_sync_status VARCHAR(50) DEFAULT 'success',
    sync_error_message TEXT
);

CREATE TABLE IF NOT EXISTS dialerr_webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT,
    disposition_name TEXT,
    match_status TEXT,
    raw_payload JSONB,
    job_number TEXT,
    job_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 12. PRICING & APP SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_matrix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    min_miles INT NOT NULL,
    max_miles INT NOT NULL,
    min_cubes INT NOT NULL,
    max_cubes INT NOT NULL,
    per_cf_rate NUMERIC(8,2) NOT NULL,
    fuel_surcharge_pct NUMERIC(5,2) DEFAULT 15,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables, allow anon access for app to work
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE job_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposition_wait_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_processed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_custom_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_hours_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_hours_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsa_lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsa_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsa_scraped_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialerr_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for anon access (app uses anon key with secret-key auth)
-- Full CRUD for all tables via anon role
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'job_submissions', 'dashboard_users', 'client_users', 'agreements',
            'email_logs', 'inventory_submissions', 'inventory_photos',
            'transactions', 'transaction_categories', 'payment_captures',
            'employees', 'schedule_entries', 'schedule_swaps',
            'job_status_tiers', 'dispositions', 'disposition_wait_times',
            'job_notes', 'sandy_knowledge', 'sandy_processed_messages',
            'sandy_sent_messages', 'sandy_reminders', 'sandy_custom_rules',
            'manual_hours_requests', 'manual_hours_log',
            'payroll_confirmations', 'commission_snapshots', 'commission_tokens',
            'payment_ledger', 'payroll_backups', 'payroll_audit_log',
            'agent_job_assignments', 'chatbot_profile', 'lsa_lead_notes',
            'lsa_replies', 'lsa_scraped_messages', 'ghl_analytics',
            'contacts', 'dialerr_webhook_logs', 'pricing_matrix', 'app_settings'
        ])
    LOOP
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_select_%s" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_insert_%s" ON %I FOR INSERT TO anon WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_update_%s" ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_delete_%s" ON %I FOR DELETE TO anon USING (true)', tbl, tbl);
    END LOOP;
END $$;


-- ============================================================
-- 14. INSERT YOUR ADMIN ACCOUNT
-- Change the secret_key to whatever you want to use to login
-- ============================================================

INSERT INTO dashboard_users (name, role, secret_key, secretkey, is_active, isactive)
VALUES ('Admin', 'admin', 'hercules-admin-2024', 'hercules-admin-2024', true, true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- DONE! You can now log into the dashboard with: hercules-admin-2024
-- ============================================================
