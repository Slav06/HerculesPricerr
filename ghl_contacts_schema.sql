-- Comprehensive GoHighLevel Contacts Table Schema
-- Generated from API response analysis
-- Contains all standard fields + custom fields with proper PostgreSQL types

CREATE TABLE IF NOT EXISTS ghl_contacts_all_fields (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Standard GHL contact fields
    ghl_contact_id VARCHAR(255) UNIQUE NOT NULL,
    location_id VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    first_name_raw VARCHAR(255),
    last_name_raw VARCHAR(255),
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    dnd BOOLEAN DEFAULT FALSE,
    dnd_settings JSONB,
    contact_type VARCHAR(50), -- 'lead', 'customer', etc.
    source VARCHAR(255),
    assigned_to VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(10),
    postal_code VARCHAR(20),
    address1 TEXT,
    date_added TIMESTAMP,
    date_updated TIMESTAMP,
    date_of_birth DATE,
    business_id VARCHAR(255),
    tags JSONB,
    followers JSONB,
    country VARCHAR(10),
    website VARCHAR(255),
    timezone VARCHAR(100),
    additional_emails JSONB,
    attributions JSONB,
    custom_fields JSONB,
    
    -- Custom field mappings (discovered from your data)
    -- Call tracking/lead management fields
    custom_0ut79hdnlmrlpdun7wl5 BIGINT, -- Call count/attempts
    custom_1ogyfec2ghbhp4i1ub7s VARCHAR(255), -- N/A field
    custom_34rbf50hnwou0tinfcit VARCHAR(255), -- Receiver at Delivery
    custom_6e1pkdwfs97x1lywl4ly BIGINT, -- Numeric field
    custom_6guwzesVax64x7ebaenv BIGINT, -- Date field (timestamp)
    custom_6fe5bdiviatgbwdew3fp JSONB, -- Array field (services)
    custom_6kkc9d2kwbgnrvraiprd BIGINT, -- Numeric field
    custom_6mpzgknl1sthdqsrvbb4 JSONB, -- Array field (Long carry)
    custom_6q7skzed90cgvd2rrjzy BIGINT, -- Distance/weight field
    custom_9nyj7lz817kssjxju7jn VARCHAR(255), -- Secondary Lead Source
    custom_aa8o4x7vpwsdqfgl3lwk VARCHAR(255), -- Yes/No field
    custom_b5mocjbkxactp6hvkkdd TEXT, -- Situation notes
    custom_bomhd6kwbf7wlk4wpkyy BIGINT, -- Numeric field
    custom_dl5dciym8giqlpkouavm VARCHAR(255), -- Yes/No field
    custom_dt3wiszkszdsnywO0ac8 VARCHAR(255), -- Address field
    custom_evs64drvwnarf84zhcz TEXT, -- Question field
    custom_f9phwnwb0lsi1ruptcm BIGINT, -- Date field (timestamp)
    custom_fwyzqowilc2xgb0olrd JSONB, -- Array field
    custom_hcygrpos5zs9ncixf VARCHAR(255), -- Yes/No field
    custom_hbui24dv7xm3srexbeqa BIGINT, -- Numeric field
    custom_ifdusvoHVKkLgTUuvcqx TEXT, -- Release Notes
    custom_mt5xss4lnbibzni9pfcn VARCHAR(255), -- Yes/No field
    custom_mazb7lfplbkw9g60tzs2 TEXT, -- Additional notes
    custom_mco7fwq1gi20sefiv4h BIGINT, -- Numeric field
    custom_nfnpbkawuo2xtdqkbaxm VARCHAR(255), -- Delivery timing
    custom_o4ufiijf49yg7zsq9qwp VARCHAR(255), -- Form Source
    custom_qsg9rn9qeceaq3jglo7r VARCHAR(255), -- Lead Status (main status field)
    custom_rgbwq4eaz0s4oj3xy1zw VARCHAR(255), -- Yes/No field
    custom_rgstffgsotqop9fhfvfb VARCHAR(255), -- Yes/No field
    custom_u89v3ch1ondHpnQ43t3H TEXT, -- Packing help details
    custom_uzim1ck8jzvoepzegppk BIGINT, -- Date field (timestamp)
    custom_xs06ol2gnemvpxfrkjo6 VARCHAR(255), -- Job Number
    custom_yi68e686fynxdkyod4kt JSONB, -- Array field
    custom_zh1ayjcbwox9csd0tdfu TEXT, -- Move Date Notes
    custom_gpakaxi2n8h9aaufshc VARCHAR(255), -- No field
    custom_gusmlju1txdbqaua43 TEXT, -- Situation notes
    custom_guzftkO7s1gszv2s23xu VARCHAR(255), -- Bot control
    custom_izl4ghyaxlzqohj7uhmy BIGINT, -- Numeric field
    custom_iu8ah6zygb3gfkxc4hrq VARCHAR(255), -- Yes/No field
    custom_owk89cldtepmpmivsoVl VARCHAR(255), -- Contact name
    custom_pjkvu5312vaud5hpesck VARCHAR(255), -- Yes/No field
    custom_rgfvmid1nyrguycdfclt VARCHAR(255), -- SOP Updates
    custom_r70nydqvrkbfy7hsix2j BIGINT, -- Numeric field
    custom_qykhjiucd5utl0mm9u BIGINT, -- Numeric field
    custom_thgk0yswam6tsgf5jlnc BIGINT, -- Numeric field
    custom_vgq312p76ske1sopp5ev TEXT, -- Outside dwelling notes
    custom_v6yf3vdbrxg6cntfodyw9 VARCHAR(255), -- Contact name
    custom_xxks2xmazhtsEs7rgjua VARCHAR(255), -- Zip code field
    custom_xsgchtsqnrjrcntnqp BIGINT, -- Numeric field
    custom_os5ef4ajtgxxgytjjucb VARCHAR(255), -- Yes/No field
    custom_qcfet9cvmpezttgyjs9 BIGINT, -- Date field (timestamp)
    custom_watlrmpisl6zdin0bzVx BIGINT, -- Date field (timestamp)
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT unique_ghl_contact UNIQUE(ghl_contact_id, location_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_location_id ON ghl_contacts_all_fields(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_email ON ghl_contacts_all_fields(email);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_phone ON ghl_contacts_all_fields(phone);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_first_name ON ghl_contacts_all_fields(first_name);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_last_name ON ghl_contacts_all_fields(last_name);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_lead_status ON ghl_contacts_all_fields(custom_qsg9rn9qeceaq3jglo7r);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_job_number ON ghl_contacts_all_fields(custom_xs06ol2gnemvpxfrkjo6);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_date_added ON ghl_contacts_all_fields(date_added);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_source ON ghl_contacts_all_fields(source);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ghl_contacts_updated_at 
    BEFORE UPDATE ON ghl_contacts_all_fields 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for key fields
COMMENT ON COLUMN ghl_contacts_all_fields.custom_qsg9rn9qeceaq3jglo7r IS 'Lead Status (main status tracking field)';
COMMENT ON COLUMN ghl_contacts_all_fields.custom_xs06ol2gnemvpxfrkjo6 IS 'Job Number field';
COMMENT ON COLUMN ghl_contacts_all_fields.custom_6q7skzed90cgvd2rrjzy IS 'Distance or weight field';
COMMENT ON COLUMN ghl_contacts_all_fields.custom_uzim1ck8jzvoepzegppk IS 'Date field (timestamp)';
COMMENT ON COLUMN ghl_contacts_all_fields.custom_xxks2xmazhtsEs7rgjua IS 'Zip code field';
