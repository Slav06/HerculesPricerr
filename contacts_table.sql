-- Create the contacts table for storing all GoHighLevel contacts
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
    
    -- Custom field mappings (based on the jbatz contact analysis)
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
    
    -- Metadata
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_by VARCHAR(255),
    last_sync_status VARCHAR(50) DEFAULT 'success',
    sync_error_message TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contacts_ghl_id ON contacts(ghl_id);
CREATE INDEX IF NOT EXISTS idx_contacts_location_id ON contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_contacts_date_added ON contacts(date_added);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_synced_at ON contacts(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- Create GIN index for JSONB custom_fields for efficient searching
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields_gin ON contacts USING GIN (custom_fields);

-- Create GIN index for tags array
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON contacts USING GIN (tags);

-- Add comments for documentation
COMMENT ON TABLE contacts IS 'Stores all GoHighLevel contacts with their custom fields and metadata';
COMMENT ON COLUMN contacts.custom_fields IS 'JSONB object containing all custom field IDs and values from GHL';
COMMENT ON COLUMN contacts.job_number IS 'Extracted job number from custom fields for easy querying';
COMMENT ON COLUMN contacts.cubes IS 'Extracted cubes value from custom fields for easy querying';
COMMENT ON COLUMN contacts.distance IS 'Extracted distance value from custom fields for easy querying';



