// ============================================
// MCPMP Data Import Script
// Imports CSV data from Base44 export
// ============================================

const fs = require('fs');
const { Pool } = require('pg');
const csv = require('csv-parser');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:imwtVIzKSthdHOUloRYKuLSySobHpTQu@hopper.proxy.rlwy.net:37607/railway',
    ssl: { rejectUnauthorized: false }
});

async function importCSV(filename, tableName, mapper) {
    return new Promise((resolve, reject) => {
        const rows = [];
        
        fs.createReadStream(filename)
            .pipe(csv())
            .on('data', (row) => {
                const mapped = mapper(row);
                if (mapped) rows.push(mapped);
            })
            .on('end', async () => {
                console.log(`📄 ${filename}: ${rows.length} rows parsed`);
                
                try {
                    let imported = 0;
                    for (const row of rows) {
                        try {
                            await pool.query(row.query, row.values);
                            imported++;
                        } catch (err) {
                            console.error(`  ❌ Error importing row:`, err.message);
                        }
                    }
                    console.log(`  ✅ ${imported}/${rows.length} rows imported to ${tableName}`);
                    resolve(imported);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

// ============================================
// IMPORT CORE BLENDS
// ============================================

async function importCoreBlends() {
    console.log('\n📦 Importing Core Blends...');
    
    return importCSV('CoreBlend_export.csv', 'core_blends', (row) => {
        return {
            query: `
                INSERT INTO core_blends (
                    name, bond, wine_type, product_category, core_appellation, vintage,
                    alcohol_target, target_cases_annual, target_cost_per_case,
                    default_bottle_size, composition_profile, notes, bottle_image,
                    label_image, is_active, base44_id, created_at, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                ON CONFLICT (base44_id) DO NOTHING
            `,
            values: [
                row.name,
                row.bond,
                row.wine_type,
                row.product_category,
                row.core_appellation,
                row.vintage,
                row.alcohol_target ? parseFloat(row.alcohol_target) : null,
                row.target_cases_annual ? parseInt(row.target_cases_annual) : null,
                row.target_cost_per_case ? parseFloat(row.target_cost_per_case) : null,
                row.default_bottle_size || '750ml',
                row.composition_profile, // Already JSON string
                row.notes,
                row.bottle_image,
                row.label_image,
                row.is_active === 'true',
                row.id, // base44_id
                row.created_date,
                row.created_by
            ]
        };
    });
}

// ============================================
// IMPORT GRAPE INVENTORY
// ============================================

async function importGrapeInventory() {
    console.log('\n📦 Importing Grape Inventory...');
    
    // First check if file exists
    if (!fs.existsSync('GrapeInventory_export.csv')) {
        console.log('  ⚠️  GrapeInventory_export.csv not found, skipping');
        return 0;
    }
    
    return importCSV('GrapeInventory_export.csv', 'grape_inventory', (row) => {
        const gallons_total = parseFloat(row.gallons_total || row.gallons || 0);
        const gallons_reserved = parseFloat(row.gallons_reserved || 0);
        
        return {
            query: `
                INSERT INTO grape_inventory (
                    lot_code, varietal, appellation, vineyard, vintage,
                    gallons_total, gallons_available, gallons_reserved,
                    alcohol_by_volume, ph, ta, bond, tank_location, status,
                    innovint_lot_id, innovint_vendor_id, innovint_vineyard_id,
                    base44_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                ON CONFLICT (lot_code) DO UPDATE SET
                    gallons_total = EXCLUDED.gallons_total,
                    gallons_available = EXCLUDED.gallons_available,
                    gallons_reserved = EXCLUDED.gallons_reserved,
                    updated_at = CURRENT_TIMESTAMP
            `,
            values: [
                row.lot_code || row.id,
                row.varietal,
                row.appellation,
                row.vineyard,
                row.vintage,
                gallons_total,
                gallons_total - gallons_reserved,
                gallons_reserved,
                row.alcohol_by_volume ? parseFloat(row.alcohol_by_volume) : null,
                row.ph ? parseFloat(row.ph) : null,
                row.ta ? parseFloat(row.ta) : null,
                row.bond,
                row.tank_location,
                row.status || 'Available',
                row.innovint_lot_id,
                row.innovint_vendor_id,
                row.innovint_vineyard_id,
                row.id,
                row.created_date || new Date().toISOString()
            ]
        };
    });
}

// ============================================
// IMPORT BOTTLING RUNS
// ============================================

async function importBottlingRuns() {
    console.log('\n📦 Importing Bottling Runs...');
    
    if (!fs.existsSync('BottlingRun_export.csv')) {
        console.log('  ⚠️  BottlingRun_export.csv not found, skipping');
        return 0;
    }
    
    return importCSV('BottlingRun_export.csv', 'bottling_runs', (row) => {
        return {
            query: `
                INSERT INTO bottling_runs (
                    run_name, planned_cases, planned_gallons, bottle_size,
                    target_bottling_date, actual_bottling_date, status,
                    ttb_compliant, ttb_notes, base44_id, created_at, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (base44_id) DO NOTHING
            `,
            values: [
                row.run_name || row.name,
                row.planned_cases ? parseInt(row.planned_cases) : null,
                row.planned_gallons ? parseFloat(row.planned_gallons) : null,
                row.bottle_size || '750ml',
                row.target_bottling_date,
                row.actual_bottling_date,
                row.status || 'Planning',
                row.ttb_compliant === 'true',
                row.ttb_notes,
                row.id,
                row.created_date,
                row.created_by
            ]
        };
    });
}

// ============================================
// IMPORT RESERVATIONS
// ============================================

async function importReservations() {
    console.log('\n📦 Importing Reservations...');
    
    if (!fs.existsSync('Reservation_export.csv')) {
        console.log('  ⚠️  Reservation_export.csv not found, skipping');
        return 0;
    }
    
    return importCSV('Reservation_export.csv', 'reservations', (row) => {
        return {
            query: `
                INSERT INTO reservations (
                    gallons_reserved, status, created_at, expires_at
                ) VALUES ($1, $2, $3, $4)
            `,
            values: [
                parseFloat(row.gallons_reserved || 0),
                row.status || 'Active',
                row.created_date || new Date().toISOString(),
                row.expires_at
            ]
        };
    });
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================

async function main() {
    console.log('============================================');
    console.log('🚀 MCPMP Data Import');
    console.log('============================================');
    
    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected\n');
        
        // Import in order (respecting foreign keys)
        const blends = await importCoreBlends();
        const inventory = await importGrapeInventory();
        const runs = await importBottlingRuns();
        const reservations = await importReservations();
        
        console.log('\n============================================');
        console.log('✅ Import Complete!');
        console.log('============================================');
        console.log(`Core Blends: ${blends}`);
        console.log(`Grape Inventory: ${inventory}`);
        console.log(`Bottling Runs: ${runs}`);
        console.log(`Reservations: ${reservations}`);
        console.log('============================================\n');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
