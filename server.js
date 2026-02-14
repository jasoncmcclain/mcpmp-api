// ============================================
// MCPMP API Server
// McClain Cellars Production Management Platform
// ============================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
    console.log('✅ Database connected:', res.rows[0].now);
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT NOW()');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            dbTime: dbCheck.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// ============================================
// GRAPE INVENTORY ENDPOINTS
// ============================================

// Get all available inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM v_available_inventory ORDER BY vintage, varietal');
        res.json({
            success: true,
            inventory: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get inventory by varietal
app.get('/api/inventory/varietal/:varietal', async (req, res) => {
    try {
        const { varietal } = req.params;
        const result = await pool.query(
            'SELECT * FROM grape_inventory WHERE varietal ILIKE $1 AND gallons_available > 0',
            [`%${varietal}%`]
        );
        res.json({
            success: true,
            lots: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// CORE BLEND ENDPOINTS
// ============================================

// Get all core blends
app.get('/api/blends', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM core_blends WHERE is_active = true ORDER BY name'
        );
        res.json({
            success: true,
            blends: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single blend
app.get('/api/blends/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM core_blends WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Blend not found' });
        }
        
        res.json({
            success: true,
            blend: result.rows[0]
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// BOTTLING RUN ENDPOINTS
// ============================================

// Get all bottling runs
app.get('/api/runs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM v_bottling_run_summary ORDER BY created_at DESC');
        res.json({
            success: true,
            runs: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single bottling run with lots
app.get('/api/runs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get run details
        const runResult = await pool.query(
            `SELECT br.*, cb.name as blend_name, cb.composition_profile
             FROM bottling_runs br
             LEFT JOIN core_blends cb ON br.core_blend_id = cb.id
             WHERE br.id = $1`,
            [id]
        );
        
        if (runResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Run not found' });
        }
        
        // Get lots in this run
        const lotsResult = await pool.query(
            'SELECT * FROM blend_lots WHERE bottling_run_id = $1 ORDER BY percentage_of_blend DESC',
            [id]
        );
        
        res.json({
            success: true,
            run: {
                ...runResult.rows[0],
                lots: lotsResult.rows
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new bottling run
app.post('/api/runs', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { run_name, core_blend_id, planned_cases, bottle_size, target_bottling_date, lots } = req.body;
        
        // Validate required fields
        if (!run_name || !planned_cases || !lots || lots.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: run_name, planned_cases, lots'
            });
        }
        
        await client.query('BEGIN');
        
        // Calculate planned gallons
        const gallonsPerCase = bottle_size === '750ml' ? 2.37753 : 2.37753; // Default
        const planned_gallons = planned_cases * gallonsPerCase;
        
        // Create bottling run
        const runResult = await client.query(
            `INSERT INTO bottling_runs (
                run_name, core_blend_id, planned_cases, planned_gallons,
                bottle_size, target_bottling_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [run_name, core_blend_id, planned_cases, planned_gallons, bottle_size, target_bottling_date, 'Planning']
        );
        
        const run_id = runResult.rows[0].id;
        
        // Create blend lots and reservations
        for (const lot of lots) {
            // Create blend lot
            await client.query(
                `INSERT INTO blend_lots (
                    bottling_run_id, grape_inventory_id, gallons_allocated,
                    percentage_of_blend, lot_code, varietal, vintage, appellation, vineyard
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    run_id,
                    lot.grape_inventory_id,
                    lot.gallons_allocated,
                    lot.percentage_of_blend,
                    lot.lot_code,
                    lot.varietal,
                    lot.vintage,
                    lot.appellation,
                    lot.vineyard
                ]
            );
            
            // Create reservation
            await client.query(
                `INSERT INTO reservations (grape_inventory_id, bottling_run_id, gallons_reserved, status)
                 VALUES ($1, $2, $3, $4)`,
                [lot.grape_inventory_id, run_id, lot.gallons_allocated, 'Active']
            );
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Bottling run created successfully',
            run_id: run_id
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating bottling run:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// ============================================
// LOT MATCHER ENDPOINT (Core Innovation)
// ============================================

app.post('/api/match-lots', async (req, res) => {
    try {
        const { composition_profile, target_gallons } = req.body;
        
        if (!composition_profile || !target_gallons) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: composition_profile, target_gallons'
            });
        }
        
        const matches = [];
        
        // For each component in the blend
        for (const component of composition_profile) {
            const { varietal, percentage, appellation, vineyard } = component;
            const gallons_needed = (target_gallons * percentage) / 100;
            
            // Find matching lots with FIFO (oldest first)
            const query = `
                SELECT *
                FROM grape_inventory
                WHERE varietal ILIKE $1
                  AND ($2::text IS NULL OR appellation ILIKE $2)
                  AND ($3::text IS NULL OR vineyard ILIKE $3)
                  AND gallons_available >= $4
                  AND status = 'Available'
                ORDER BY vintage ASC, created_at ASC
                LIMIT 5
            `;
            
            const result = await pool.query(query, [
                varietal,
                appellation || null,
                vineyard || null,
                gallons_needed
            ]);
            
            matches.push({
                component: {
                    varietal,
                    percentage,
                    appellation,
                    vineyard,
                    gallons_needed
                },
                matching_lots: result.rows
            });
        }
        
        res.json({
            success: true,
            target_gallons,
            matches
        });
        
    } catch (error) {
        console.error('Error matching lots:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// TTB COMPLIANCE CHECK
// ============================================

app.post('/api/ttb-check', async (req, res) => {
    try {
        const { lots } = req.body;
        
        if (!lots || lots.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No lots provided'
            });
        }
        
        // Group by vintage
        const vintageMap = {};
        lots.forEach(lot => {
            if (!vintageMap[lot.vintage]) {
                vintageMap[lot.vintage] = 0;
            }
            vintageMap[lot.vintage] += lot.percentage_of_blend;
        });
        
        // Check 15% rule
        const vintages = Object.keys(vintageMap);
        let compliant = true;
        let primaryVintage = null;
        let violations = [];
        
        if (vintages.length > 1) {
            // Find primary vintage (highest percentage)
            let maxPercentage = 0;
            vintages.forEach(v => {
                if (vintageMap[v] > maxPercentage) {
                    maxPercentage = vintageMap[v];
                    primaryVintage = v;
                }
            });
            
            // Check if primary is >= 85%
            if (maxPercentage < 85) {
                compliant = false;
                violations.push({
                    rule: 'TTB 15% Cross-Vintage Rule',
                    message: `Primary vintage ${primaryVintage} is only ${maxPercentage.toFixed(2)}% (requires >= 85%)`
                });
            }
            
            // Check if any secondary vintage exceeds 15%
            vintages.forEach(v => {
                if (v !== primaryVintage && vintageMap[v] > 15) {
                    compliant = false;
                    violations.push({
                        rule: 'TTB 15% Cross-Vintage Rule',
                        message: `Secondary vintage ${v} is ${vintageMap[v].toFixed(2)}% (max 15% allowed)`
                    });
                }
            });
        }
        
        res.json({
            success: true,
            compliant,
            primary_vintage: primaryVintage,
            vintage_breakdown: vintageMap,
            violations
        });
        
    } catch (error) {
        console.error('Error checking TTB compliance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('============================================');
    console.log(`🚀 MCPMP API Server`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('============================================');
});

module.exports = app;
