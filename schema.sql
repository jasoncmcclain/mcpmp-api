-- ============================================
-- MCPMP Database Schema
-- McClain Cellars Production Management Platform
-- ============================================

-- Core Blend (Wine Recipes)
CREATE TABLE IF NOT EXISTS core_blends (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bond VARCHAR(255),
    wine_type VARCHAR(50), -- Red, White, Rosé
    product_category VARCHAR(100),
    core_appellation VARCHAR(255),
    vintage VARCHAR(10),
    alcohol_target DECIMAL(4,2),
    target_cases_annual INTEGER,
    target_tons_annual DECIMAL(10,2),
    target_cost_per_case DECIMAL(10,2),
    default_bottle_size VARCHAR(50) DEFAULT '750ml',
    composition_profile JSONB, -- Array of {varietal, percentage, appellation, vineyard}
    notes TEXT,
    bottle_image TEXT,
    label_image TEXT,
    glass_item_id VARCHAR(255),
    cork_item_id VARCHAR(255),
    capsule_item_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    collection_id VARCHAR(255),
    parent_core_blend_id INTEGER REFERENCES core_blends(id),
    is_primary_version BOOLEAN DEFAULT true,
    
    -- Base44 migration
    base44_id VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Grape Inventory (Lots from InnoVint)
CREATE TABLE IF NOT EXISTS grape_inventory (
    id SERIAL PRIMARY KEY,
    lot_code VARCHAR(100) UNIQUE NOT NULL,
    varietal VARCHAR(255) NOT NULL,
    appellation VARCHAR(255),
    vineyard VARCHAR(255),
    vintage VARCHAR(10),
    
    -- Volume tracking
    gallons_total DECIMAL(10,2) NOT NULL,
    gallons_available DECIMAL(10,2) NOT NULL,
    gallons_reserved DECIMAL(10,2) DEFAULT 0,
    
    -- Quality metrics
    alcohol_by_volume DECIMAL(4,2),
    ph DECIMAL(3,2),
    ta DECIMAL(5,2), -- Titratable acidity
    
    -- Metadata
    bond VARCHAR(255),
    tank_location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Available', -- Available, Reserved, Depleted
    
    -- InnoVint integration
    innovint_lot_id VARCHAR(255),
    innovint_vendor_id VARCHAR(255),
    innovint_vineyard_id VARCHAR(255),
    innovint_bond_id VARCHAR(255),
    last_synced_at TIMESTAMP,
    
    -- Base44 migration
    base44_id VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bottling Runs
CREATE TABLE IF NOT EXISTS bottling_runs (
    id SERIAL PRIMARY KEY,
    run_name VARCHAR(255) NOT NULL,
    core_blend_id INTEGER REFERENCES core_blends(id),
    
    -- Run details
    planned_cases INTEGER NOT NULL,
    planned_gallons DECIMAL(10,2) NOT NULL,
    bottle_size VARCHAR(50) DEFAULT '750ml',
    
    -- Dates
    target_bottling_date DATE,
    actual_bottling_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Planning', -- Planning, Approved, InProgress, Completed
    
    -- TTB Compliance
    ttb_compliant BOOLEAN DEFAULT false,
    ttb_notes TEXT,
    
    -- Base44 migration
    base44_id VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Blend Lots (Individual lots in a bottling run)
CREATE TABLE IF NOT EXISTS blend_lots (
    id SERIAL PRIMARY KEY,
    bottling_run_id INTEGER NOT NULL REFERENCES bottling_runs(id) ON DELETE CASCADE,
    grape_inventory_id INTEGER NOT NULL REFERENCES grape_inventory(id),
    
    -- Allocation
    gallons_allocated DECIMAL(10,2) NOT NULL,
    percentage_of_blend DECIMAL(5,2) NOT NULL,
    
    -- Lot details (denormalized for performance)
    lot_code VARCHAR(100) NOT NULL,
    varietal VARCHAR(255) NOT NULL,
    vintage VARCHAR(10),
    appellation VARCHAR(255),
    vineyard VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservations (Temporary holds on inventory)
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    grape_inventory_id INTEGER NOT NULL REFERENCES grape_inventory(id),
    bottling_run_id INTEGER REFERENCES bottling_runs(id),
    
    gallons_reserved DECIMAL(10,2) NOT NULL,
    
    status VARCHAR(50) DEFAULT 'Active', -- Active, Committed, Released
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    released_at TIMESTAMP
);

-- Production Batches (Actual production records)
CREATE TABLE IF NOT EXISTS production_batches (
    id SERIAL PRIMARY KEY,
    bottling_run_id INTEGER REFERENCES bottling_runs(id),
    
    batch_number VARCHAR(100),
    
    -- Actual production numbers
    cases_produced INTEGER,
    bottles_produced INTEGER,
    gallons_used DECIMAL(10,2),
    
    -- Quality control
    lab_approved BOOLEAN DEFAULT false,
    lab_notes TEXT,
    
    -- Dates
    production_date DATE,
    
    -- Base44 migration
    base44_id VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- InnoVint Integration Tables
CREATE TABLE IF NOT EXISTS innovint_vendors (
    id SERIAL PRIMARY KEY,
    innovint_vendor_id VARCHAR(255) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(100),
    base44_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS innovint_vineyards (
    id SERIAL PRIMARY KEY,
    innovint_vineyard_id VARCHAR(255) UNIQUE NOT NULL,
    vineyard_name VARCHAR(255) NOT NULL,
    appellation VARCHAR(255),
    base44_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS innovint_bonds (
    id SERIAL PRIMARY KEY,
    innovint_bond_id VARCHAR(255) UNIQUE NOT NULL,
    bond_name VARCHAR(255) NOT NULL,
    base44_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_grape_inventory_status ON grape_inventory(status);
CREATE INDEX idx_grape_inventory_varietal ON grape_inventory(varietal);
CREATE INDEX idx_grape_inventory_vintage ON grape_inventory(vintage);
CREATE INDEX idx_grape_inventory_available ON grape_inventory(gallons_available) WHERE gallons_available > 0;

CREATE INDEX idx_core_blends_active ON core_blends(is_active) WHERE is_active = true;
CREATE INDEX idx_core_blends_vintage ON core_blends(vintage);

CREATE INDEX idx_bottling_runs_status ON bottling_runs(status);
CREATE INDEX idx_bottling_runs_date ON bottling_runs(target_bottling_date);

CREATE INDEX idx_blend_lots_run ON blend_lots(bottling_run_id);
CREATE INDEX idx_blend_lots_inventory ON blend_lots(grape_inventory_id);

CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_expires ON reservations(expires_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate gallons per case based on bottle size
CREATE OR REPLACE FUNCTION gallons_per_case(bottle_size VARCHAR)
RETURNS DECIMAL AS $$
BEGIN
    CASE bottle_size
        WHEN '750ml' THEN RETURN 2.37753; -- Standard case (12 bottles)
        WHEN '1.5L' THEN RETURN 4.75506;   -- Magnum case (6 bottles)
        WHEN '375ml' THEN RETURN 1.18877;  -- Half bottle case (24 bottles)
        ELSE RETURN 2.37753; -- Default to standard
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update grape inventory available gallons
CREATE OR REPLACE FUNCTION update_grape_inventory_available()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate reserved gallons for this inventory
    UPDATE grape_inventory
    SET gallons_reserved = (
        SELECT COALESCE(SUM(gallons_reserved), 0)
        FROM reservations
        WHERE grape_inventory_id = NEW.grape_inventory_id
          AND status = 'Active'
    ),
    gallons_available = gallons_total - (
        SELECT COALESCE(SUM(gallons_reserved), 0)
        FROM reservations
        WHERE grape_inventory_id = NEW.grape_inventory_id
          AND status = 'Active'
    )
    WHERE id = NEW.grape_inventory_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_inventory_on_reservation
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_grape_inventory_available();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Available inventory view
CREATE OR REPLACE VIEW v_available_inventory AS
SELECT 
    gi.id,
    gi.lot_code,
    gi.varietal,
    gi.appellation,
    gi.vineyard,
    gi.vintage,
    gi.gallons_total,
    gi.gallons_available,
    gi.gallons_reserved,
    gi.alcohol_by_volume,
    gi.bond,
    gi.tank_location,
    gi.status
FROM grape_inventory gi
WHERE gi.gallons_available > 0
  AND gi.status = 'Available'
ORDER BY gi.vintage, gi.varietal;

-- Bottling run summary view
CREATE OR REPLACE VIEW v_bottling_run_summary AS
SELECT 
    br.id,
    br.run_name,
    br.status,
    cb.name as blend_name,
    cb.wine_type,
    br.planned_cases,
    br.planned_gallons,
    br.target_bottling_date,
    COUNT(bl.id) as lot_count,
    SUM(bl.gallons_allocated) as total_gallons_allocated,
    br.ttb_compliant,
    br.created_at
FROM bottling_runs br
LEFT JOIN core_blends cb ON br.core_blend_id = cb.id
LEFT JOIN blend_lots bl ON br.id = bl.bottling_run_id
GROUP BY br.id, cb.name, cb.wine_type
ORDER BY br.target_bottling_date DESC NULLS LAST;

-- Core blend composition view
CREATE OR REPLACE VIEW v_core_blend_composition AS
SELECT 
    cb.id as core_blend_id,
    cb.name as blend_name,
    cb.vintage,
    cb.wine_type,
    cb.target_cases_annual,
    jsonb_array_elements(cb.composition_profile) as component,
    cb.is_active
FROM core_blends cb
WHERE cb.is_active = true;

-- ============================================
-- INITIAL DATA / SEED
-- ============================================

-- Add any default packaging rules or configurations here if needed

