# ROADMAP — Estabilización + v3 + Formalización (2026 Q2-Q3)

> **Última actualización:** 2026-05-24
> **Owner:** Angel Suesca
> **Estado:** sprint original Q2 (LUN 4 → SÁB 9 may) **cerrado parcialmente**. M1-M3 completados con creces, **M4 (validación E2E) y M5 (deploy v3) diferidos**. La rama `chore/stabilization-sprint-2026-Q2` ya fue mergeada a `main` (commit `9cb0913`) pero el deploy a producción **no ocurrió**: prod sigue en v2.9.0 y el ámbito original se expandió a iniciativas paralelas (formalización 8-dim, Alegra DIAN, pnpm migration, mobile, equipo, bank reconciliation, catalog stabilization).
> Este doc reemplaza al roadmap de 6 días: arriba está la retrospectiva + el plan vivo; al final está el plan original archivado para contexto histórico.

---

## Retrospectiva del Sprint Q2 (LUN 4 → 2026-05-24)

### Cronograma planeado vs real

| | Planeado | Real | Estado |
|---|----------|------|--------|
| M1 — Dump prod → dev | LUN 4 may mañana (½ día) | LUN 4 may 02:00–02:15 | ✅ Completo |
| M2 — v3 sobre data real | LUN 4 may tarde (½ día) | LUN 4 may 02:55 (2 segundos) | ✅ Completo, sin pérdida de filas |
| M3 — Estabilizar data | MAR 5 → JUE 7 (3 días) | MAR 5 → ~VIE 16 may (~12 días) | ✅ 5 bugs + Gap A + permisos; ⏸️ reclasificación masiva y equity correctivo no ejecutados |
| M4 — Validación E2E | VIE 8 may (1 día) | — | ⏸️ Diferido |
| M5 — Deploy v3 prod | SÁB 9 may (1 día) | — | ⏸️ Diferido (prod sigue v2.9.0) |

**Compresión planeada (14 → 6 días) fue irreal.** Lo que efectivamente pasó fue **expansión** del scope con iniciativas paralelas valiosas que justificaron el atraso, pero a costa del deploy.

### Qué se cumplió del plan original

- **M1+M2** (entorno + v3 sobre data real): perfecto. Backup + 28 migraciones aplicadas sin pérdida en 2 segundos. Documentado en [sprint-log.md](sprint-log.md) M1/M2.
- **M3 — los 5 bugs catalogados:**
  - Bug 1: `set_balance` compensating entry (`443f4b7`).
  - Bug 2: `mark_debt_as_paid` atómico con split capital/interés (`4840784`).
  - Bug 3: archive guard de balance accounts con saldo > 0 (`153379f`).
  - Bug 4: AR `due_date` NOT NULL + backfill (`01d607b`).
  - Bug 5: FK `expenses.category → expense_categories.code` (`550e6a3`).
- **M3 — Gap A** (equity opening balance reconstruction): commits `4e549bb` + análisis en [estabilizacion_contable/patrimony-deep-analysis-2026.md](estabilizacion_contable/patrimony-deep-analysis-2026.md).
- **M3 — Permisos:** 5 codes faltantes seeded en migración `perm_audit_001` (`b69b187`).
- **Sprint branch mergeado** a `main` (`9cb0913` — "Ready for production deployment").

### Qué se desvió del plan original

| Pendiente original M3 | Razón del aplazamiento |
|-----------------------|-----------------------|
| Reclasificación masiva gastos `mercado`/`ocio` → `payroll_in_kind`/`owner_drawings` | Requiere decisiones contables del owner una a una. Se sustituyó por el track de **formalización 8-dimensiones** que aborda el problema más sistemáticamente. |
| Asientos equity refinanciamiento Cristina ($19M) | Sin doc/contrato formal. Esperando confirmación de Maria C / Grupo Corporativo. |
| Reconciliación Nequi $20M → $10 (5-ene-2026) | Pendiente owner: clarificar con Consuelo. |
| Asiento equity correctivo $21.6M (set_balance histórico sin trazabilidad) | Bloqueado por reconciliación bancaria — depende del track `bank_reconciliation`. |
| 4 audit scripts (balance, AR, expenses, data quality score) | No escritos. La auditoría se hace ad-hoc vía SQL contra `uniformes_db` o `uniformes_prod_snapshot`. |
| Capture costs de 608 productos sin `cost` | No iniciado. Tema separado para session dedicada con [`costs-importer-prompt.md`](prompts/costs-importer-prompt.md). |
| M4 — validación E2E + audit score 100/100 | No ejecutada. Hay smoke tests parciales pero no el barrido completo. |
| M5 — deploy coordinado v3 | **No ejecutado.** Causa principal: el scope se expandió a tracks paralelos que requirieron atención (ver siguiente sección). |

### Qué pasó fuera del scope original (y por eso justifica el atraso)

1. **pnpm 11 migration** completa de los 4 sub-repos (admin-portal, web-portal, frontend, mobile) con supply-chain hardening. 1237/1237 tests OK. Commits `8850474`, `e42ea52`, `9a54f69`, `d6a82b1`, `70807f8`.
2. **Electronic Invoicing DIAN** activado vía Alegra el 2026-05-16. Resolución 18764109873979, CUFE válido en primera emisión. Pendiente: integrar en backend UCR (hoy es API externa).
3. **Mobile app MVP** creada (Expo SDK 54, RN 0.81) con auth, ventas, clientes, inventario, órdenes. EAS workflows configurados.
4. **Bank reconciliation system v1**: parser Bancolombia XLSX + Nequi PDF password-protected. 1010 transacciones analizadas, 354 matched, 7 internal pairs, 203 manual review. 239 entries aplicadas a dev DB. Docs en [estabilizacion_contable/bank-*](estabilizacion_contable/).
5. **Permission system overhaul**: phases 0-3 + 1C completadas (registry endpoint, dedup frontend, shared cache, migración a granular `require_permission`, audit trail). Pendiente: phase 2B (version refresh) + phase 4 (frontend `ProtectedRoute`).
6. **Formalización 8 dimensiones** iniciada como auditoría integral (legal, tributario, contable, laboral, datos personales, comercial, operacional, tecnológico). Discovery activo. Critical gaps detectados: FE DIAN, declaraciones tributarias, PN ante expansión.
7. **Equipo y bitácoras**: 5 bitácoras de equipo (Owner/Cofounder/Joven tracks) + roadmap 2026 + seed idempotente de payroll con account links (`d0a897c`, `255f931`).
8. **Catalog stabilization** ejecutado HOY (2026-05-24) — sesión QA contra prod snapshot regenerado. Ver `docs/qa-briefs/catalog-stabilization-2026-05-24.md`.
9. **Financial model hardening**: validación KPIs, divide-by-zero, cash_runway consolidation, Pydantic v2 errors → español, escenarios multi-fase de payroll con `end_month_offset`.
10. **B2B contracts pillar** (tercer pilar v3): docs maestro + 8 docs actualizados. Doc-only, post-v3.0.0.
11. **v3 design cleanup migration** (`c537b09`): añade como head committed.

**Trade-off honesto:** el deploy v3 se sacrificó para construir formalización + mobile + Alegra. Esas tres palancas tienen más leverage estratégico que un deploy técnico (que se puede ejecutar en cualquier ventana). El sprint original era el camino corto; lo que efectivamente pasó es el camino largo pero más completo.

---

## Estado actual (2026-05-24)

```
✅ main local:            sincronizado con origin/main (incluye merge 9cb0913).
✅ Backend dev:           v3 schema (head v3_design_cleanup_001) sobre data prod fresca.
                          5 bugs cerrados, Gap A reconstruido, 14 migraciones aplicadas.
✅ Frontend dev:          v3 + FinancialModelTab + Proyecciones + tests Vitest verdes.
✅ Mobile app:            MVP funcional en mobile/ (no deployed).
✅ Alegra DIAN:           Activo end-to-end (2026-05-16). Externo, no integrado a UCR.
✅ Wompi:                 Live en prod desde 2026-03-18.
✅ pnpm 11:               4/4 sub-repos migrados con hardening.
✅ Bank reconciliation:   v1 análisis aplicado a dev DB (idempotente).
🟠 Permission overhaul:   Phases 0-3 + 1C done. Pendiente 2B + 4.
🟠 Catalog stab:          Sesión QA HOY contra prod snapshot.
🟠 Formalización 8-dim:   Discovery activo. 6 de 8 dimensiones documentadas.
⏸️ Q2 audit deep dive:    $7.7M divergencia Bancolombia. Sesión dedicada pendiente.
🔴 Producción:            v2.9.0. Data sucia. NO TOCADA desde el sprint.
🔴 Deploy v3 prod:        DIFERIDO. Sin ventana asignada.
🔴 Reclasificación masiva:Sin owner-driven decisions todavía.
```

---

## Nueva fase — Plan vivo (Q2-Q3 2026)

> El sprint Q2 demostró que la compresión 14 → 6 días no funciona. Esta fase opera con **prioridades sin deadlines arbitrarios**, y reagenda el deploy v3 cuando los pre-requisitos críticos estén verdes.

### Track A — Deploy v3 a producción (alta prioridad)

**Pre-requisitos antes de agendar ventana:**

- [ ] 🔴 **GATE 0 (BLOQUEANTE) — Consolidación de encargos obsoletos.** Iniciativa 11 del [`v3-release-scope.md`](../v3-branch-architecture/v3-release-scope.md). 25 casos, ~$2.56M huérfanos, JUCUM $848K + Cristina Giraldo $130K como casos Tipo F que exigen decisión del owner. Sesión interactiva con prompt restaurado en [`prompts/encargos-audit-session-prompt.md`](prompts/encargos-audit-session-prompt.md), seguida por sesión de implementación de `order_audit_overrides`. **Decisión del owner 2026-05-24: sin esta consolidación no se sube versión estable.**
- [ ] 🔴 **GATE 1 (BLOQUEANTE) — Runtime del VPS pnpm-ready.** Node 20 → 22 LTS + corepack `pnpm@11.1.2` activado + `pm2 restart` de los portales. Sin esto el workflow `cd.yml` revienta al ejecutar `pnpm install`. Runbook autoritativo: [`docs/deployment/pnpm-deploy-runbook.md`](../../deployment/pnpm-deploy-runbook.md) §"Paso 0 — Prerequisitos en el VPS (UNA SOLA VEZ)". Checklist completa centralizada en [`v3-release-scope.md` §GATE 1](../v3-branch-architecture/v3-release-scope.md).
- [ ] M4 original: correr suite de validación E2E contra dev (audit score, P&L mensual, Balance cuadrado, frontend smoke).
- [ ] Decidir si las reclasificaciones masivas (gastos personales/negocio, equity correctivo $21.6M, Nequi $20M, Cristina $19M) van **antes** del deploy o **después** con scripts post-deploy.
- [ ] Pre-deploy QA brief vivo: regenerar prod snapshot, correr `reset_dev_from_prod.sh`, validar que `alembic upgrade head` siga limpio sobre data del día.
- [ ] Plan de rollback documentado con paths/comandos exactos (existe en M5 archivado abajo, validar que sigue vigente con la branch actual).
- [ ] Confirmar con equipo: ventana sin operación crítica (sábado/domingo temprano).

**Cuando se ejecute, basarse en:** Milestone 5 archivado al final de este doc (sigue siendo el plan técnicamente correcto).

### Track B — Formalización 8-dimensiones (alta prioridad, paralelo a A)

Discovery activa en `docs/v3/formalization/`. 6 de 8 dimensiones tienen doc inicial. Critical gaps:

- **Tributario:** declaraciones pendientes. Sin RUT actualizado se pierde la ventaja del FE DIAN activado.
- **Legal corporativo:** PN ante expansión a nuevas sedes (jun-2026). Cambio de figura legal probablemente requerido.
- **Datos personales (Ley 1581):** sin política, sin habeas data.
- **Operacional:** runbook de restore no formal (implícito en scripts).

Siguiente acción: una sesión por dimensión faltante. Ver bitácoras del equipo en `equipo/bitacoras/`.

### Track C — Cierre de pendientes M3 (media prioridad)

Pendientes de M3 que sí deben cerrarse antes de deploy v3:

1. **Reclasificación masiva gastos personales/negocio** (4.9% de mezcla detectado). Requiere session con `cfo-strategist` + decisiones del owner sobre cada gasto histórico ambiguo.
2. **Equity correctivo $21.6M** por `set_balance` histórico sin trazabilidad. Bloqueado por bank reconciliation; arrancar cuando ese track esté completo.
3. **Refinanciamiento Cristina** ($19M residual). Esperando doc/contrato. Si no llega para fin de may, decisión: cataloga como `equity_capital` "Saldo de apertura no rastreado".
4. **Ajuste Nequi $20M → $10 del 5-ene-2026.** Pendiente owner.
5. **Audit scripts** (balance, AR, expenses, data quality score). Diseñar como cron diario en prod post-deploy.

### Track D — Iniciativas post-v3 (baja prioridad inmediata, planeación activa)

- **Integrar Alegra FE DIAN en UCR backend** (hoy es manual/externo). Ver [estabilizacion_financiera/](estabilizacion_financiera/) y memoria `alegra_api_integration_notes.md`.
- **Mobile app deploy**: pasar de MVP local a TestFlight + Play Store. Coordinar con `expo-deployment` skill.
- **Permission overhaul phases 2B + 4**: version refresh + `ProtectedRoute` en frontend.
- **B2B contracts pillar**: implementación post-v3.0.0 según [v3-branch-architecture/](../v3-branch-architecture/).
- **Q2 audit deep dive**: resolver divergencia Bancolombia $7.7M. Session dedicada con prompt nuevo.
- **608 productos sin `cost`**: capture session con [`costs-importer-prompt.md`](prompts/costs-importer-prompt.md).
- **Expansión a nuevas sedes** (junio 2026 estimado): multi-tenancy stress test, evaluar si el modelo "Caja única global" sigue válido o requiere `CashRegister` por sede.

---

## Pendientes del owner (no técnicos)

Mismos que el sprint original, ninguno resuelto todavía:

1. **Clarificar ajuste Nequi $20M → $10 del 5-ene-2026** con Consuelo. Sin esto, default: `equity_capital` "Saldo de apertura no rastreado".
2. **Confirmar refinanciamiento Cristina** con doc/contrato. Confirmación verbal ($39M deuda, $20M pagado en feb, $19M refinanciado) sigue vigente pero sin papel.
3. **Revisar 163 AR sin `due_date` originales** (ya backfilled a `created_at + 30 days`). Owner puede sobrescribir casos específicos.
4. **Decidir ventana de deploy v3.** Sin esto Track A no arranca.
5. **Decidir si reclasificación masiva va pre o post deploy v3.**

---

## Workflow de DB dev (actualizado)

Para sesiones que necesitan data real:

```bash
./backend/scripts/reset_dev_from_prod.sh
```

Reemplaza `uniformes_db` con dump fresco de prod y aplica `alembic upgrade head` para llevarla al estado actual de dev. Backup automático previo. Detalle en [db-snapshot-workflow.md](db-snapshot-workflow.md).

Para análisis read-only sin tocar dev (legacy):
```bash
./backend/scripts/refresh_prod_snapshot.sh
```

---

## Lecciones del Sprint Q2 (para la próxima vez)

1. **Compresión agresiva con paralelización vía agents no se materializó.** Los bugs M3 son secuenciales en la práctica porque tocan capas contables relacionadas. El plan tendría que haber sido 10-14 días desde el inicio.
2. **Background agents ayudaron, pero no compensaron decisiones humanas requeridas.** La reclasificación masiva y el ajuste Nequi quedaron bloqueados por falta de input del owner, no por capacidad de cómputo.
3. **El scope expandido fue justificado.** Alegra DIAN + pnpm + mobile + formalización tienen más leverage que cerrar el deploy v3 una semana antes. Pero hay que llamarlo así, no como "atraso".
4. **El deploy v3 sigue siendo importante.** Aplazar más sin agendar concreto deja prod en v2.9.0 con bugs conocidos en lógica contable. Track A es prioritario.
5. **Documentar el ROADMAP en vivo (cada milestone) tiene más valor que tener un plan inicial perfecto.** [sprint-log.md](sprint-log.md) fue el doc más útil del sprint.

---

---

# ANEXO — Plan original archivado (2026-05-04)

> Lo que sigue es el roadmap original del sprint 6-días. Conservado para contexto histórico. **No usar como guía actual** — la nueva fase está arriba.

---

## Diagrama del recorrido (original)

```
HOY (LUN 2026-05-04):                      OBJETIVO (SÁB 2026-05-09):
─────────────                              ─────────────
prod (v2.9, data sucia, 5 bugs lógica)  →  prod (v3, data limpia, bugs cerrados)
dev  (v3, data 3 sem vieja, snapshot ok)→  dev = staging para deploy

   ↓ MILESTONE 1                              ↑ MILESTONE 5
   dump prod fresh → dev                      deploy coordinado v3 + data
   ↓ MILESTONE 2                              ↑ MILESTONE 4
   aplicar v3 sobre data real                 validación end-to-end
   ↓ MILESTONE 3
   estabilizar (bugs + reclasificación)
```

---

# MILESTONE 1 — Dump prod → dev limpio ✅ DONE 2026-05-04

**Duración planeada:** ½ día. **Real:** 15 minutos.

Push del sprint local (~131 commits) a `origin/main`, branch `chore/stabilization-sprint-2026-Q2`, backup pre-sprint, drop+restore de `uniformes_db` con dump fresh de prod. Detalle en [sprint-log.md](sprint-log.md) M1.

---

# MILESTONE 2 — Aplicar v3 sobre data real fresh ✅ DONE 2026-05-04

**Duración planeada:** ½ día. **Real:** 2 segundos.

`alembic upgrade head` aplicó 28 migraciones en cadena lineal sin pérdida de filas. Detectó deuda de 5 permission codes faltantes en seed (resuelto en M3.deuda). Detalle en [sprint-log.md](sprint-log.md) M2.

---

# MILESTONE 3 — Estabilizar data en dev ✅ Parcial 2026-05-04 → ~2026-05-16

**Duración planeada:** 3 días (MAR 5 → JUE 7). **Real:** ~12 días.

**Hecho:**
- Bugs 1-5 corregidos con tests de regresión.
- Gap A (equity opening) reconstruido.
- 5 permission codes faltantes seedados.
- Stale tests alineados con Gap A fix.

**No hecho (movido a Track C de la nueva fase):**
- Reclasificación masiva gastos personales/negocio.
- Equity correctivo $21.6M.
- Cristina, Nequi, audit scripts, costs de 608 productos.

Detalle por bug en [sprint-log.md](sprint-log.md) M3.bug1 → M3.bug5.

---

# MILESTONE 4 — Validar end-to-end ⏸️ DIFERIDO

**Plan original:** 1 día (VIE 8 may). Audit score 100/100, P&L mensual, Balance cuadrado, frontend smoke.

**Estado:** parcialmente cubierto por smoke tests ad-hoc durante M3 (`/api/v1/openapi.json`, suite pytest 109+64 PASSED en módulos afectados), pero el barrido completo nunca se ejecutó.

**Cuando se retome:** ver Track A de la nueva fase. Es pre-requisito para M5.

---

# MILESTONE 5 — Deploy coordinado v3 + data limpia ⏸️ DIFERIDO

**Plan original:** SÁB 9 may 10am-11am.

**Estado:** **no ejecutado.** Producción sigue en v2.9.0 con la data sucia original. El branch del sprint fue mergeado a `main` (`9cb0913`) pero el deploy a VPS nunca se disparó.

**Razón:** el scope se expandió hacia formalización 8-dim, Alegra DIAN, mobile, pnpm, etc. (ver retrospectiva arriba). El owner priorizó construir esas palancas estratégicas sobre cerrar un deploy técnico.

**Plan técnico sigue válido** — preservado abajo para cuando se retome:

```bash
# === FASE A: Preparación (local)
git checkout main && git pull origin main && git log -1

# === FASE B: Servidor (SSH a prod)
ssh root@104.156.247.226 && cd /var/www/uniformes-system-v2
PGPASSWORD=$PROD_PW pg_dump -h localhost -U uniformes_user uniformes_db \
  > /opt/backups/pre_v3_deploy_$(date +%Y%m%d_%H%M).sql
git fetch origin && git checkout main && git pull origin main

# === FASE C: Deploy
cd backend && source venv/bin/activate
pip install -r requirements.txt --upgrade
alembic upgrade head --sql > /tmp/migration_preview.sql  # inspección
alembic upgrade head
python scripts/apply_stabilization_data_corrections.py --confirm  # si existen
systemctl restart uniformes-api && systemctl status uniformes-api
curl https://yourdomain.com/api/v1/health

# === FASE D: Validación
python scripts/audit_data_quality_score.py  # esperado: 100/100
# Login real + smoke /cfo /accounting + 1 venta de prueba

# === FASE F: Monitoreo post-deploy con /loop
```

**Rollback completo** (si los smoke fallan):

```bash
systemctl stop uniformes-api
PGPASSWORD=$PROD_PW dropdb -h localhost -U uniformes_user uniformes_db
PGPASSWORD=$PROD_PW createdb -h localhost -U uniformes_user uniformes_db
PGPASSWORD=$PROD_PW psql -h localhost -U uniformes_user uniformes_db \
  < /opt/backups/pre_v3_deploy_*.sql
git reset --hard <commit-hash-pre-v3>
cd backend && pip install -r requirements.txt
systemctl start uniformes-api
curl https://yourdomain.com/api/v1/health
```

---

## Prompts del sprint (vigentes)

| Prompt | Uso |
|--------|-----|
| [stabilization-session-prompt.md](prompts/stabilization-session-prompt.md) | M3 completo. Aún relevante para cerrar pendientes del Track C. |
| [financial-model-ui-prompt.md](prompts/financial-model-ui-prompt.md) | UI modelo financiero. Mayormente ejecutado. |
| [v3-migration-on-prod-data-prompt.md](prompts/v3-migration-on-prod-data-prompt.md) | M2. Histórico — ya ejecutado, queda como referencia para futuros restores. |
| [costs-importer-prompt.md](prompts/costs-importer-prompt.md) | 608 productos sin cost. Pendiente Track D. |
| [encargos-audit-session-prompt.md](prompts/encargos-audit-session-prompt.md) | Auditoría encargos (orders). |
