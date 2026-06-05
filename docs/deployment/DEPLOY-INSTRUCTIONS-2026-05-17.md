# Production Deployment Instructions - v3 Final (2026-05-17)

**Status**: ✅ Ready  
**Main Commit**: 9cb0913  
**Target**: yourdomain.com (VPS: 104.156.247.226)  
**Deploy Window**: Saturday, May 17, 2026 — 10:00 AM Colombia (UTC-5)  
**Estimated Duration**: 15 minutes  

---

## Pre-Deployment Checklist (Complete Before 10:00 AM)

### 1. Database Backup

```bash
# SSH to VPS
ssh root@104.156.247.226

# Create backup directory with timestamp
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/uniformes_prod_$BACKUP_TIME.sql"

# Dump production database
pg_dump -U uniformes_user -d uniformes_prod -v > "$BACKUP_FILE" 2>&1

# Verify backup
ls -lh "$BACKUP_FILE"
# Should show ~500MB-1GB file

# Create backup verification query result
psql -U uniformes_user -d uniformes_prod -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public';" > /backups/table_count_$BACKUP_TIME.txt

echo "✅ Backup complete: $BACKUP_FILE"
```

### 2. Verify Current State

```bash
# Check current main branch
git log --oneline -3
# Should show commit e52d1c3 as current (will change after pull)

# Check Docker images
docker images | grep uniformes

# Verify pnpm lockfiles present (not npm package-lock.json)
find . -name "pnpm-lock.yaml" | wc -l  # Should be 4
find . -name "package-lock.json" | wc -l  # Should be 0

# Verify migration files
ls -la backend/alembic/versions/ | grep -E "(ar_due_date|exp_cat_fk|perm_audit)"
# Should see 3 new migration files

echo "✅ Pre-deployment validation complete"
```

### 3. Test Migrations on Staging (CRITICAL)

```bash
# Optional but highly recommended: test on staging first
# If you don't have staging, at minimum check migration syntax

cd /opt/uniformes/backend
alembic revision --sql -r HEAD  # Generate all SQL (don't apply)
# Review output for any syntax errors or constraint issues

# Check migration dependency chain
alembic history  # Should show clean linear chain

echo "✅ Migration validation complete"
```

---

## Deployment Execution (10:00-10:15 AM)

### Step 1: Pull Latest Code

```bash
cd /opt/uniformes

# Verify we're on main
git branch
# * main
#   develop

# Pull latest (commit 9cb0913 with all 25 commits)
git pull origin main

# Verify pull succeeded
git log --oneline -3
# Should show: 9cb0913 (Merge: stabilization sprint...)
```

### Step 2: Rebuild Docker Images (if needed)

```bash
# Only needed if code changed (it did - pnpm migration)
docker-compose build backend

# Verify image built successfully
docker images | grep uniformes-backend
```

### Step 3: Run Database Migrations

```bash
# Run alembic migrations (applies 14 migrations if first time)
docker-compose exec backend alembic upgrade head

# Check output for:
# - No FK constraint violations
# - AR backfill successful (163/190 due_dates populated)
# - Expense categories linked to FK
# - Permission codes added

# Verify migration state
docker-compose exec backend alembic current
# Should show latest migration hash
```

### Step 4: Restart Services

```bash
# Graceful restart
docker-compose down
sleep 2
docker-compose up -d backend

# Wait for service to be healthy
sleep 5

# Check health
curl -s http://localhost:8000/health | jq .
# Should return {"status": "ok", ...}

# Check logs for errors
docker-compose logs -f backend --tail 20
# Should NOT show 500 errors, KeyError, or IntegrityError
```

### Step 5: Verify API Responsiveness

```bash
# Test basic endpoints
curl -s http://localhost:8000/docs  # Swagger UI should load

# Test database connection
curl -s http://localhost:8000/health | jq '.db_status'
# Should be "ok"

# Test specific accounting endpoint
curl -s http://localhost:8000/api/v1/global/accounting/cash-balances \
  -H "Authorization: Bearer $TEST_TOKEN" | jq '.' | head -20

echo "✅ API is responsive"
```

---

## Post-Deployment Monitoring (First 30 Minutes)

### Critical Checks

1. **Logs**: No P0 errors
   ```bash
   docker-compose logs backend | grep -E "ERROR|CRITICAL|500" | head -10
   # Should be empty or only show pre-existing errors
   ```

2. **API Health**: Endpoints responding
   ```bash
   # Check multiple endpoints
   curl -s http://localhost:8000/health
   curl -s http://localhost:8000/api/v1/schools -H "Authorization: Bearer $TOKEN"
   curl -s http://localhost:8000/api/v1/global/accounting/expenses -H "Authorization: Bearer $TOKEN"
   ```

3. **Database**: No deadlocks
   ```bash
   psql -U uniformes_user -d uniformes_prod -c "SELECT count(*) FROM pg_stat_activity WHERE state='active';"
   # Should be low (< 5)
   ```

4. **Financial Data**: Can generate reports
   ```bash
   # In frontend, try to load:
   # - Financial Dashboard
   # - Accounting Reports
   # - AR/AP aging
   ```

5. **Telegram Alerts**: Bot responding
   ```bash
   # Send test alert via API or bot command
   curl -X POST http://localhost:8000/api/v1/telegram-alerts/test \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   # Should receive message in Telegram within 5 seconds
   ```

### Success Criteria

- ✅ All API endpoints returning 200-level responses (except 401/403 for auth)
- ✅ Zero P0 or P1 errors in logs
- ✅ Database performance normal (no locks, no slow queries)
- ✅ Financial statements generating without errors
- ✅ AR/AP operations working (create/update/delete)
- ✅ Integrations responding (Alegra, Wompi, Telegram)

---

## Rollback Plan (If Critical Issue Detected)

### Option 1: Revert Code (Keep DB)

```bash
# Rollback to previous main
git log --oneline origin/main | head -5
# Find commit e52d1c3

git checkout e52d1c3
docker-compose build backend
docker-compose restart backend

# Downgrade database to previous migration (optional, if DB change caused issue)
docker-compose exec backend alembic downgrade -1

echo "✅ Rolled back to previous version"
```

### Option 2: Restore from Backup (Full DB Rollback)

```bash
# ONLY if data corruption detected

# Stop services
docker-compose down

# Restore from backup
psql -U uniformes_user -d uniformes_prod < /backups/uniformes_prod_20260517_HHMMSS.sql

# Verify restoration
psql -U uniformes_user -d uniformes_prod -c "SELECT COUNT(*) FROM sales;"

# Downgrade alembic state to previous version
docker-compose exec backend alembic downgrade -1

# Restart
docker-compose up -d

echo "✅ Restored from backup"
```

---

## Deployment Log Template

```
DEPLOYMENT LOG - 2026-05-17
START TIME: 10:00 AM
MAIN COMMIT: 9cb0913

[ ] 10:00 - Database backup initiated
[ ] 10:02 - Backup verified (size: ___ MB)
[ ] 10:03 - Git pull completed
[ ] 10:04 - Docker build completed
[ ] 10:06 - Database migrations started
[ ] 10:08 - Migrations completed (count: ___)
[ ] 10:09 - Services restarted
[ ] 10:10 - Health check PASS
[ ] 10:10 - API smoke tests PASS
[ ] 10:11 - Telegram alert test PASS
[ ] 10:12 - Accounting endpoints verified
[ ] 10:13 - Financial dashboard loads

DEPLOYMENT STATUS: ✅ SUCCESS
END TIME: 10:13 AM
DURATION: 13 minutes

POST-DEPLOY MONITORING: ACTIVE
Issues detected: NONE
All critical checks: PASS
```

---

## Contact & Support

**Deployment Lead**: Angel Samuel Suesca  
**If issues**: Contact immediately (do not attempt multiple restarts)  
**Rollback Authority**: Same person who deployed  
**On-Call Support Window**: 30 minutes post-deploy (until 10:45 AM)

---

## Sign-Off

- **Prepared by**: Claude Code (Haiku 4.5)
- **Date**: 2026-05-17
- **Approved for deployment**: YES
- **Final commit**: 9cb0913 (27 commits, clean merge)

**Status**: ✅ Ready to deploy yourdomain.com
