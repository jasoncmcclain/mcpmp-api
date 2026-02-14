# 🎉 MCPMP COMPLETE - READY TO DEPLOY!

## What You Have

### ✅ Backend API (Complete)
- **schema.sql** - PostgreSQL database (9 tables, views, functions)
- **server.js** - Express API with all endpoints
- **import_data.js** - CSV data importer
- **package.json** - All dependencies configured

### ✅ Frontend UI (Ready)
- **mcpmp-frontend/** - Complete React app from vintners-compass
- React 18 + Vite + Tailwind CSS
- Already configured, just needs API URL

### ✅ Your Data (Loaded)
- **CoreBlend_export.csv** - Your wine recipes ready to import
- GrapeInventory, Reservations, BottlingRuns (if available)

---

## 🚀 Quick Deploy (15 Minutes Total)

### Step 1: Deploy Database Schema (5 min)

**Option A: Railway Dashboard**
1. Go to https://railway.app
2. Click PostgreSQL service
3. Click "Data" > "Query"
4. Copy/paste `schema.sql` contents
5. Click "Run"

**Option B: Local Terminal**
```bash
export DATABASE_URL="postgresql://postgres:imwtVIzKSthdHOUloRYKuLSySobHpTQu@hopper.proxy.rlwy.net:37607/railway"
psql $DATABASE_URL < schema.sql
```

---

### Step 2: Deploy API Server (5 min)

```bash
# Extract files
tar -xzf mcpmp-complete.tar.gz
cd mcpmp-complete

# Install dependencies
npm install

# Set environment variable
export DATABASE_URL="postgresql://postgres:imwtVIzKSthdHOUloRYKuLSySobHpTQu@hopper.proxy.rlwy.net:37607/railway"

# Import data
npm run import

# Start server
npm start
```

**Or deploy to Railway:**
```bash
railway link
railway up
```

---

### Step 3: Deploy Frontend (5 min)

```bash
cd ../mcpmp-frontend

# Install dependencies
npm install

# Set API URL
echo "VITE_API_URL=http://localhost:3000" > .env

# Start dev server
npm run dev
```

**Or deploy to Vercel:**
```bash
vercel --prod
```

---

## 📡 API Endpoints

Once deployed, you'll have:

### Inventory Management
- `GET /api/inventory` - All available lots
- `GET /api/inventory/varietal/:varietal` - Search by varietal

### Core Blends
- `GET /api/blends` - All active wine recipes
- `GET /api/blends/:id` - Single blend details

### Bottling Runs
- `GET /api/runs` - All bottling runs
- `GET /api/runs/:id` - Run with lots
- `POST /api/runs` - Create new run

### Smart Features
- `POST /api/match-lots` - AI lot matcher
- `POST /api/ttb-check` - TTB 15% rule validator

---

## 🎯 What This Does

### The Bulk Blender (Core Innovation)
1. Select a CoreBlend recipe (e.g., "Pillars & Principles")
2. Specify target cases to produce
3. System automatically:
   - Calculates gallons needed
   - Finds matching GrapeInventory lots (FIFO)
   - Respects varietal, appellation, vineyard constraints
   - Validates TTB 15% cross-vintage rule
   - Creates reservations (non-destructive)
   - Generates BottlingRun

### Multi-Vintage Compliance
- Primary vintage must be ≥85%
- Secondary vintages each ≤15%
- Auto-validates before saving

### Real-Time Inventory Tracking
- Reservations system prevents double-allocation
- Available gallons update automatically
- Status tracking (Available → Reserved → Depleted)

---

## 📊 Your Core Blends (Ready to Use)

From your CSV data:
1. **Pillars & Principles** - 100% Chardonnay, Santa Ynez Valley
2. **Wisdom of Rey** - 90% Pinot Noir + 10% Tempranillo
3. **Five Hearts** - Multi-varietal red blend
4. **Unbreakable** - Complex blend with 5+ components
5. Plus 20+ more blends ready to bottle

---

## ✅ Success Checklist

After deployment, test:

```bash
# Health check
curl http://localhost:3000/health

# Get blends
curl http://localhost:3000/api/blends

# Get inventory
curl http://localhost:3000/api/inventory

# Match lots for "Pillars & Principles"
curl -X POST http://localhost:3000/api/match-lots \
  -H "Content-Type: application/json" \
  -d '{
    "composition_profile": [
      {"varietal": "Chardonnay", "percentage": 100, "appellation": "Santa Ynez Valley"}
    ],
    "target_gallons": 152.16
  }'
```

Expected: All return 200 status with JSON data

---

## 🆘 Troubleshooting

### Database Connection Error
**Problem**: Cannot connect to Railway
**Solution**: Check DATABASE_URL is correct, try from local terminal first

### Import Fails
**Problem**: CSV files not found
**Solution**: Ensure CoreBlend_export.csv is in same directory as import_data.js

### Frontend Can't Connect
**Problem**: API calls fail
**Solution**: Update VITE_API_URL in .env to match your API server URL

---

## 🎊 What's Next

Once deployed:
1. ✅ Plan your first bottling run in < 5 minutes
2. ✅ No more spreadsheets
3. ✅ TTB compliance automatic
4. ✅ Real-time inventory tracking
5. ✅ VintnerPro integration ready

---

## 📞 Need Help?

All files are ready in:
- **mcpmp-complete.tar.gz** - Backend API + data
- **mcpmp-frontend/** - React UI
- **schema.sql** - Database schema

**Your DATABASE_URL**:
```
postgresql://postgres:imwtVIzKSthdHOUloRYKuLSySobHpTQu@hopper.proxy.rlwy.net:37607/railway
```

**Ready to bottle wine!** 🍷🚀
