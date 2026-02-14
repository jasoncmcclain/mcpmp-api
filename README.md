# MCPMP Quick Deploy Guide

## Step 1: Deploy Database Schema (5 minutes)

### Option A: Railway Dashboard (Easiest)
1. Go to https://railway.app
2. Click your project
3. Click "PostgreSQL" service
4. Click "Data" tab
5. Click "Query" button
6. Copy/paste contents of `mcpmp_schema.sql`
7. Click "Run"

### Option B: Local Terminal
```bash
export DATABASE_URL="postgresql://postgres:imwtVIzKSthdHOUloRYKuLSySobHpTQu@hopper.proxy.rlwy.net:37607/railway"
psql $DATABASE_URL < mcpmp_schema.sql
```

## Step 2: Import Your Data (5 minutes)

Run the Node.js import script:
```bash
cd mcpmp-api
npm install
node import_data.js
```

This will import:
- Core Blends (your wine recipes)
- Grape Inventory (lots from InnoVint)
- Bottling Runs
- Reservations

## Step 3: Start API Server (2 minutes)

```bash
npm start
```

Or deploy to Railway:
```bash
railway up
```

## Step 4: Test (1 minute)

```bash
# Health check
curl http://localhost:3000/health

# Get available inventory
curl http://localhost:3000/api/inventory

# Get core blends
curl http://localhost:3000/api/blends
```

## You're Done!

Access the UI at: http://localhost:3000

Or Railway URL: https://your-project.up.railway.app
