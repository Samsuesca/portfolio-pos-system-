# Pre-Deploy Checklist v3 → Production (2026-05-17)

## ✅ Code Consolidation
- [x] Stabilization sprint branch merged to main
- [x] All 25 commits integrated cleanly  
- [x] Pushed to origin/main (commit 9cb0913)
- [x] No merge conflicts

## 🔍 Critical Components Status

### Accounting Fixes (5 bugs + Gap A)
- [x] Bug 2: mark_debt_as_paid atomicity (commit 4840784)
- [x] Bug 3: Archive guard (commit 153379f)
- [x] Bug 4: AR due_date NOT NULL (commit 01d607b)
- [x] Bug 5: Expense category FK (commit 550e6a3)
- [x] Gap A: Equity reconstruction (commit 4e549bb)

### Package Manager Migration  
- [x] admin-portal → pnpm 11.1.2 with lockfile
- [x] web-portal → pnpm 11.1.2 with lockfile
- [x] frontend → pnpm 11.1.2 with lockfile
- [x] mobile → pnpm 11.1.2 with lockfile
- [x] Node engines pinned >=22 across repos

### Database Migrations (14 total)
- [x] 3 new migrations in alembic/versions/
  - ar_due_date_001_backfill_and_notnull.py (60 lines)
  - exp_cat_fk_001_add_expense_category_fk.py (97 lines)
  - perm_audit_001_add_missing_route_permissions.py (169 lines)
- [x] Previous 11 migrations from v3 branch tested on fresh prod data

### API & Services Updates
- [x] Financial model KPIs hardening (safe_ratio, edge cases)
- [x] Pydantic v2 error translation to Spanish (all user-facing)
- [x] Permission system fixes (5 missing route permissions)
- [x] Accounting routes validated
- [x] Balance integration service refactored

### Testing Status
- [x] 8 new unit/integration tests added
- [x] 5 existing tests updated for schema changes
- [x] Financial statements assertions aligned with Gap A fix

## 📋 Pre-Deploy Actions Required

1. [ ] **Backup production database**
   - Location: `/backups/uniformes_prod_$(date +%Y%m%d_%H%M%S).sql`
   - Command: `pg_dump -U uniformes_user -d uniformes_prod > /backups/...`

2. [ ] **Verify Docker images built with pnpm**
   - Check no npm lock files in published images
   - Verify pnpm-lock.yaml checksums match main

3. [ ] **Run alembic migrate on staging environment**
   - `alembic upgrade head` (should apply 3 new migrations)
   - Verify no FK constraint violations
   - Check AR backfill successful (due_date populated)

4. [ ] **Smoke test critical flows**
   - Create sale + verify inventory updates
   - Create payment transaction  
   - Check P&L monthly report generates
   - Verify AR/AP operations (create receivable, mark paid)

5. [ ] **Verify integrations**
   - [ ] Alegra FE API connection (if active)
   - [ ] Wompi webhook responsive  
   - [ ] Telegram alerting functional

## 🚀 Deploy Window

- **Date**: Saturday, May 17, 2026
- **Time**: 10:00 AM Colombia (UTC-5)
- **Duration**: ~15 minutes
  - 1. Database backup
  - 2. Git pull origin/main  
  - 3. alembic upgrade head
  - 4. docker-compose restart backend
  - 5. Smoke tests

## 📊 Rollback Plan

If critical issue detected within 30 minutes:

```bash
# Revert to previous main
git checkout e52d1c3  # Previous main HEAD
docker-compose down && docker-compose up -d

# If data corruption, restore from backup
pg_restore -U uniformes_user -d uniformes_prod /backups/uniformes_prod_20260517_HHMMSS.sql

# Run downgrade if needed
alembic downgrade -1
```

## 📍 Post-Deploy Validation (First 30 min)

- [ ] `/health` endpoint responding
- [ ] WebSocket connections stable (Telegram test alert)
- [ ] Financial statements generating (P&L, balance sheet)
- [ ] AR/AP operations functional
- [ ] No P0 errors in logs

**Success criteria**: All checks pass, no 500 errors in first 30 min

## 📋 Sign-off

- **Code Reviewer**: Claude Code
- **Main Commits**: 9cb0913 (merge of 27 commits)
- **Status**: ✅ Ready for production deployment
- **Locked for changes**: Yes — only `hotfix/*` branches allowed post-deploy until monitoring window complete

---

**Generated**: 2026-05-17  
**Target**: yourdomain.com (VPS 104.156.247.226)
