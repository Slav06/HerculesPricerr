-- GoHighLevel Contacts Table Schema for jbatz contact
-- Generated from API response analysis of contact: jbatz last name
-- Contains all standard fields + 43 custom fields with proper PostgreSQL types

CREATE TABLE IF NOT EXISTS ghl_contacts_jbatz_fields (
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
    
    -- Custom field mappings from jbatz contact (43 fields)
    -- Basic info fields
    custom_1ogyfec2ghbhp4i1ub7s VARCHAR(255), -- N/A field
    custom_6e1pkdwfs97x1lywl4ly BIGINT, -- Numeric field (value: 0)
    custom_6mpzgknl1sthdqsrvbb4 JSONB, -- Array field (value: ["Long carry"])
    custom_6fe5bdiviatgbwdew3fp JSONB, -- Array field (value: ["Long Carry","Other","Shuttle"])
    custom_6q7skzed90cgvd2rrjzy BIGINT, -- Distance/weight field (value: 12)
    custom_6kkc9d2kwbgnrvraiprd BIGINT, -- Numeric field (value: 0)
    custom_aa8o4x7vpwsdqfgl3lwk VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_b5mocjbkxactp6hvkkdd TEXT, -- Situation notes (value: "Situation at pick up point is other")
    custom_bomhd6kwbf7wlk4wpkyy BIGINT, -- Numeric field (value: 0)
    custom_dl5dciym8giqlpkouavm VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_dt3wiszkszdsnywO0ac8 VARCHAR(255), -- Address field (value: "3080 E Derbyshire Rd, Cleveland, OH 44118")
    custom_evs64drvwnarf84zhcz TEXT, -- Question field (value: "How many levels does your home have?")
    custom_hcygrpos5zs9ncixf VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_hbui24dv7xm3srexbeqa BIGINT, -- Numeric field (value: 121211)
    custom_ifdusvoHVKkLgTUuvcqx TEXT, -- Release Notes (value: "Release Notes")
    custom_mt5xss4lnbibzni9pfcn VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_mazb7lfplbkw9g60tzs2 TEXT, -- Additional notes (value: "Additional notes")
    custom_mco7fwq1gi20sefiv4h BIGINT, -- Numeric field (value: 2222)
    custom_nfnpbkawuo2xtdqkbaxm VARCHAR(255), -- Delivery timing (value: "Immediately Delivery")
    custom_o4ufiijf49yg7zsq9qwp VARCHAR(255), -- Form Source (value: "Form Source")
    custom_qsg9rn9qeceaq3jglo7r VARCHAR(255), -- Lead Status (main status field) (value: "Wrong Number/Bad Number/Fax Tone")
    custom_rgbwq4eaz0s4oj3xy1zw VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_rgstffgsotqop9fhfvfb VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_u89v3ch1ondHpnQ43t3H TEXT, -- Packing help details (value: "Provide details for packing help that you need:")
    custom_xs06ol2gnemvpxfrkjo6 VARCHAR(255), -- Job Number (value: "Job Number")
    custom_gpakaxi2n8h9aaufshc VARCHAR(255), -- No field (value: "No")
    custom_gusmlju1txdbqaua43 TEXT, -- Situation notes (value: "Situation at drop off point is other")
    custom_guzftkO7s1gszv2s23xu VARCHAR(255), -- Bot control (value: "Turn off for this contact")
    custom_izl4ghyaxlzqohj7uhmy BIGINT, -- Numeric field (value: 2)
    custom_iu8ah6zygb3gfkxc4hrq VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_owk89cldtepmpmivsoVl VARCHAR(255), -- Contact name (value: "Molly Moran")
    custom_pjkvu5312vaud5hpesck VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_rgfvmid1nyrguycdfclt VARCHAR(255), -- SOP Updates (value: "Updates to SOP")
    custom_r70nydqvrkbfy7hsix2j BIGINT, -- Numeric field (value: 0)
    custom_qykhjiucd5utl0mm9u BIGINT, -- Numeric field (value: 222)
    custom_thgk0yswam6tsgf5jlnc BIGINT, -- Numeric field (value: 0)
    custom_vgq312p76ske1sopp5ev TEXT, -- Outside dwelling notes (value: "Outside of the dwelling exists?")
    custom_v6yf3vdbrxg6cntfodyw9 VARCHAR(255), -- Contact name (value: "Jessa P")
    custom_xxks2xmazhtsEs7rgjua VARCHAR(255), -- Zip code field (value: "77027")
    custom_xsgchtsqnrjrcntnqp BIGINT, -- Numeric field (value: 0)
    custom_os5ef4ajtgxxgytjjucb VARCHAR(255), -- Yes/No field (value: "Yes")
    custom_qcfet9cvmpezttgyjs9 BIGINT, -- Date field (timestamp) (value: 1754524800000)
    custom_watlrmpisl6zdin0bzVx BIGINT, -- Date field (timestamp) (value: 1755734400000)
    custom_34rbf50hnwou0tinfcit VARCHAR(255), -- Receiver at Delivery (value: "Receiver at Delivery")
    custom_9nyj7lz817kssjxju7jn VARCHAR(255), -- Secondary Lead Source (value: "Secondary Lead Source")
    custom_6guwzesVax64x7ebaenv BIGINT, -- Date field (timestamp) (value: 1755043200000)
    custom_f9phwnwb0lsi1ruptcm BIGINT, -- Date field (timestamp) (value: 1755129600000)
    custom_fwyzqowilc2xgb0olrd JSONB, -- Array field (value: ["Yes"])
    custom_yi68e686fynxdkyod4kt JSONB, -- Array field (value: ["Yes"])
    custom_uzim1ck8jzvoepzegppk BIGINT, -- Date field (timestamp) (value: 1755820800000)
    custom_zh1ayjcbwox9csd0tdfu TEXT, -- Move Date Notes (value: "Move Date Notes")
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT unique_ghl_contact UNIQUE(ghl_contact_id, location_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_location_id ON ghl_contacts_jbatz_fields(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_email ON ghl_contacts_jbatz_fields(email);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_phone ON ghl_contacts_jbatz_fields(phone);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_first_name ON ghl_contacts_jbatz_fields(first_name);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_last_name ON ghl_contacts_jbatz_fields(last_name);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_lead_status ON ghl_contacts_jbatz_fields(custom_qsg9rn9qeceaq3jglo7r);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_job_number ON ghl_contacts_jbatz_fields(custom_xs06ol2gnemvpxfrkjo6);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_date_added ON ghl_contacts_jbatz_fields(date_added);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_source ON ghl_contacts_jbatz_fields(source);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_zip_code ON ghl_contacts_jbatz_fields(custom_xxks2xmazhtsEs7rgjua);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_jbatz_distance ON ghl_contacts_jbatz_fields(custom_6q7skzed90cgvd2rrjzy);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ghl_contacts_jbatz_updated_at 
    BEFORE UPDATE ON ghl_contacts_jbatz_fields 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for key fields based on jbatz contact data
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_qsg9rn9qeceaq3jglo7r IS 'Lead Status (Wrong Number/Bad Number/Fax Tone)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_xs06ol2gnemvpxfrkjo6 IS 'Job Number field';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_6q7skzed90cgvd2rrjzy IS 'Distance or weight field (value: 12)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_xxks2xmazhtsEs7rgjua IS 'Zip code field (value: 77027)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_dt3wiszkszdsnywO0ac8 IS 'Pickup address (3080 E Derbyshire Rd, Cleveland, OH 44118)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_6mpzgknl1sthdqsrvbb4 IS 'Services needed (Long carry)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_6fe5bdiviatgbwdew3fp IS 'Additional services (Long Carry, Other, Shuttle)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_uzim1ck8jzvoepzegppk IS 'Move date (timestamp: 1755820800000)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_6guwzesVax64x7ebaenv IS 'Date field (timestamp: 1755043200000)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_f9phwnwb0lsi1ruptcm IS 'Date field (timestamp: 1755129600000)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_qcfet9cvmpezttgyjs9 IS 'Date field (timestamp: 1754524800000)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_watlrmpisl6zdin0bzVx IS 'Date field (timestamp: 1755734400000)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_owk89cldtepmpmivsoVl IS 'Contact name (Molly Moran)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_v6yf3vdbrxg6cntfodyw9 IS 'Contact name (Jessa P)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_hbui24dv7xm3srexbeqa IS 'Numeric field (value: 121211)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_mco7fwq1gi20sefiv4h IS 'Numeric field (value: 2222)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_qykhjiucd5utl0mm9u IS 'Numeric field (value: 222)';
COMMENT ON COLUMN ghl_contacts_jbatz_fields.custom_izl4ghyaxlzqohj7uhmy IS 'Numeric field (value: 2)';
