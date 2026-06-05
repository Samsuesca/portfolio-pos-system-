# Prompt — Sesión: Estabilización forense del sistema contable UCR

> **Para usar en sesión nueva** de Claude Code.
> **Modo SPRINT ACELERADO:** Milestone 3 comprimido a 3 días (MAR 5, MIE 6, JUE 7) con paralelización de background agents.
> **Working dir:** `/Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2`
> **Branch:** `chore/stabilization-sprint-2026-Q2` (rama autorizada del sprint, creada en Milestone 1).
> **NO crear nuevas ramas.** Si necesitas aislar un experimento, usar worktree: `git worktree add /tmp/wt-uniformes-m3-<scope> chore/stabilization-sprint-2026-Q2`.

---

## Contexto de partida

UCR es un sistema multi-tenant en producción (yourdomain.com) para retail de uniformes escolares. Lleva ~5 meses con captura digital activa (desde 14-ene-2026). El sistema tiene contabilidad operativa funcional pero acumuló **deuda de calidad de datos y bugs de lógica** que distorsionan los EEFF y la trazabilidad. El owner (Angel) y su madre (Consuelo Ríos, fundadora) ya confirmaron que la realidad de prod NO refleja la realidad económica del negocio: hay errores humanos (días sin cerrar caja, categorías mal usadas, ajustes manuales) y bugs de lógica que documentaré abajo.

**Tu misión:** estabilizar la contabilidad del sistema para que cualquier reporte (P&L, Balance General, Patrimonio) sea **defensible, trazable y reconciliable** contra realidad económica.

## Pre-requisitos antes de empezar

Lee primero **en este orden** (todos en `docs/formalization/`):

1. `README.md` — índice maestro de las 8 dimensiones de formalización.
2. `patrimony-deep-analysis-2026.md` — análisis forense del patrimonio ene-may 2026 con todas las anomalías detectadas. **Este es el documento más importante para esta sesión.**
3. `financial-model-current-state.md` — estado actual de servicios financieros, gaps de configuración, bugs detectados.
4. `migration-plan-hybrid.md` — plan de reclasificación de gastos históricos.
5. `db-snapshot-workflow.md` — cómo trabajar contra `uniformes_prod_snapshot` sin tocar dev.
6. `03-contable.md` — dimensión contable con findings.

Comandos útiles:
```bash
# Refrescar snapshot de prod (~30 segundos, no toca prod)
./backend/scripts/refresh_prod_snapshot.sh

# Conectar al snapshot
docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_prod_snapshot

# Ejecutar servicios financieros via Python
docker exec uniformes-backend python scripts/run_financial_model.py
```

## Lo que ya está hecho (NO repetir)

- **Fix Gap A** aplicado en `financial_statements.py`: nuevas constantes `FINANCIAL_EXPENSE_CODES`, `EXCLUDED_EXPENSE_CODES` ampliado. Resultado: P&L pasó de -$29M (falso) a +$9.4M (real).
- **Fix bug cartesian product** en `_get_other_expenses_details` (Vendor relationship).
- **Migración `exp_cat_002`** aplicada: agrega `payroll_in_kind`, `owner_drawings`, `intereses_financieros` a `expense_categories`.
- **`ProjectionService` MVP** implementado: `backend/app/services/accounting/financial_model/projection.py` + schemas + endpoints + tabla `financial_projections`.
- **3 escenarios A/B/C corridos** y documentados en `projection-scenarios-results.md`.

---

## Objetivos de esta sesión

### Objetivo 1 — Reconciliación forense completa

Producir un **mapa exhaustivo** de qué hay en la DB y qué debería haber. Cada movimiento >$500k del período enero-mayo 2026 debe estar clasificado en una de 4 categorías:

- ✅ **CORRECTO**: el dato refleja la realidad económica.
- 🟠 **ERROR HUMANO**: dato mal capturado pero corregible (categoría incorrecta, fecha errada, monto desviado).
- 🔴 **BUG DE LÓGICA**: el sistema procesó mal (set_balance sin entry, mark_debt_as_paid silent, archivado de pasivos con balance > 0).
- ❓ **AMBIGUO**: requiere clarificación con owner.

Entregable: tabla SQL `accounting_audit_log_2026` con todos los issues + script reproducible.

### Objetivo 2 — Catalogar bugs de lógica

Documentar y reproducir cada bug detectado en docs:

#### Bug 1 — `set_balance` no genera entry compensatoria
**Ubicación:** endpoint `/global/accounting/set-balance` (buscar en `routes/global_accounting.py`).
**Síntoma:** ajusta `balance_accounts.balance` directamente sin INSERT en `balance_entries`. Por eso hay $20.5M de discrepancia entre `SUM(balance_entries)` y `balance_accounts.balance`.
**Reproducir:** llamar el endpoint y verificar que NO aparece nuevo entry en balance_entries.

#### Bug 2 — `mark_debt_as_paid` no genera asiento contable
**Ubicación:** `app/services/planning.py::mark_debt_as_paid` (línea ~172).
**Síntoma:** solo cambia `payment.status = PAID`. No reduce caja, no crea expense de intereses, no reduce el pasivo.
**Reproducir:** marcar una cuota como pagada y verificar que ni caja ni pasivo se mueven en DB.

#### Bug 3 — Archivado de pasivos con balance > 0
**Síntoma:** las 9 deudas viejas tienen `is_active=false` pero su `balance` sigue $77.9M intacto. El "archivado" no resetea el saldo, dejando un fantasma contable.
**Esperado:** o forzar balance=0 antes de archivar, o crear asiento contra cuenta de equity ("Condonación de deuda" / "Refinanciamiento").

#### Bug 4 — `due_date` opcional en `accounts_receivable`
**Síntoma:** 57 AR sin `due_date` ($6.8M pendiente). No se puede calcular DSO ni hacer aging.
**Esperado:** hacer NOT NULL con default `created_date + 30 days`.

#### Bug 5 — Categorías de expense permite valores arbitrarios
**Síntoma:** `expenses.category` es VARCHAR sin validación contra tabla `expense_categories` ni enum. Por eso hay duplicados y typos (`mercado` vs `prestamos` mezclados).
**Esperado:** FK constraint `expenses.category -> expense_categories.code`.

### Objetivo 3 — Identificar errores humanos

Buscar patrones de **omisiones** y **errores de captura**:

1. **Días sin movimientos en Caja Menor** durante días laborables (lunes-sábado, excluyendo festivos colombianos). Hipótesis: días donde no se cerró caja correctamente.

2. **Días con movimientos extraordinarios sin descripción clara** (ej. ajustes >$1M con descripción genérica como "Prueba", "Ajuste").

3. **Expenses con descripción vacía o `null`** en categorías financieras críticas (deuda, prestamos, payroll).

4. **AR creadas sin cliente identificado** (FK roto o cliente_id de prueba).

5. **Sales con `total = 0` o status pendiente** que distorsionan revenue.

6. **Productos con cost = NULL pero is_active = true** (40% del inventario). Cada uno requiere captura.

Entregable: lista priorizada de "issues humanos" en CSV para que el owner los revise uno por uno.

### Objetivo 4 — Fixes de código (orden estricto)

**4.1.** Fix Bug 1 — `set_balance` debe crear entry compensatoria con descripción "Ajuste manual: $previous → $new".

**4.2.** Fix Bug 2 — `mark_debt_as_paid` debe:
   - Crear `BalanceEntry` negativa en `payment_account_id`.
   - Si `payment.category == "interest"`: crear `Expense` con categoría `intereses_financieros`.
   - Si `payment.category == "capital"`: reducir `liability.balance` por el monto.
   - Si `payment.category == "mixed"`: bifurcar según porciones (requiere campos adicionales en `DebtPaymentSchedule`).
   - Si `liability.balance <= 0`: marcar `liability.is_active = false`.

**4.3.** Fix Bug 3 — endpoint para archivar pasivo: validar `balance == 0` o exigir `equity_offset_account_id` para crear asiento de condonación.

**4.4.** Fix Bug 4 — migración Alembic + endpoint update: hacer `accounts_receivable.due_date NOT NULL` con backfill `created_at + 30 days` para los 57 sin fecha.

**4.5.** Fix Bug 5 — migración Alembic + validación Pydantic: FK de `expenses.category` a `expense_categories.code`.

### Objetivo 5 — Reclasificaciones de datos históricos

Después de los fixes de código, ejecutar el plan de migración híbrida del documento `migration-plan-hybrid.md`:

1. Crear tabla `expense_reclassification_log`.
2. Script automático: clasificar por keywords (mercado/ocio/comida descripción "casa"/"perro"/"D1" → owner_drawings; descripción "almuerzo trabajadores" → payroll_in_kind).
3. Owner revisa los ambiguos (~30%).
4. Aplicar reclasificación batch con log.
5. Re-correr P&L y validar antes vs después.

### Objetivo 6 — Reconciliación de pasivos refinanciados

**Confirmado por owner:** Los 9 préstamos viejos ($77.9M) se refinanciaron parcialmente. $20M se pagaron al contado y los $19M restantes se transformaron en los 2 préstamos vigentes ($12M + $7M).

**Asiento contable correcto que falta:**
```
Al 24-mar-2026 (cuando se archivaron los pasivos):
  Débito  LIABILITY_LONG (cuentas viejas)        $77,900,000  (cierra los pasivos)
  Crédito Caja/Banco                              $20,050,000  (lo que se pagó)
  Crédito LIABILITY_LONG (Préstamo 1)             $12,000,000  (deuda refinanciada)
  Crédito LIABILITY_LONG (Préstamo 2)             $7,000,000   (deuda refinanciada)
  Crédito EQUITY (perdón de deuda / ajuste)       $38,850,000  (la diferencia)
```

Implementar este asiento o equivalente en el sistema. La cuenta `EQUITY` no existe aún — crear `EQUITY_CAPITAL` "Capital aportado / Ajustes históricos" antes.

### Objetivo 7 — Asiento de balance de apertura formal

El "balance de apertura" del 14-ene-2026 nunca se registró formalmente. Crear:

```
14-ene-2026: Balance de apertura - sistema digitalizado UCR
  Débito  ASSET_FIXED ($14,500,000) ← 13 máquinas
  Débito  ASSET_CURRENT (caja inicial 14-ene)
  Débito  ASSET_CURRENT (inventario inicial 14-ene si se puede reconstruir)
  Crédito LIABILITY_LONG ($38,000,000) ← 8 préstamos
  Crédito LIABILITY_CURRENT ($890,000) ← tarjeta
  Crédito LIABILITY_LONG ($39,000,000) ← Cristina
  Crédito EQUITY_CAPITAL (la cuadradera)
```

La cuadradera puede ser positiva (capital aportado por Consuelo) o negativa (deudas asumidas que exceden activos del momento). Documentar formalmente.

### Objetivo 8 — Herramientas de auditoría continua

Crear scripts reusables para que la auditoría no sea de una sola vez:

1. `backend/scripts/audit_balance_reconciliation.py` — corre reconciliación balance vs entries y reporta discrepancias. Programar como cron mensual.
2. `backend/scripts/audit_overdue_ar.py` — lista AR vencidas, sugiere provisión.
3. `backend/scripts/audit_uncategorized_expenses.py` — lista expenses con categoría `other` o sin descripción.
4. `backend/scripts/audit_data_quality_score.py` — score 0-100 de calidad del dato contable. Mide: % productos con cost real, % AR con due_date, % expenses categorizados, % balance reconciliado.

Frontend: agregar tab "Auditoría" en `Accounting.tsx` que muestre estos scores en tiempo real.

---

## Restricciones y reglas

### NO hacer

- ❌ NO modificar la DB de **producción** (104.156.247.226). Toda exploración va contra `uniformes_prod_snapshot` (local).
- ❌ NO ejecutar reclasificaciones de datos en lote sin dry-run + log + aprobación del owner.
- ❌ NO eliminar datos. Cualquier "corrección" es vía nuevos asientos contables, no DELETE.
- ❌ NO cambiar el modelo de `BalanceAccount` o `BalanceEntry` salvo agregar campos nuevos opcionales.
- ❌ NO inventar montos que faltan. Si hay $19M sin rastrear y el owner ya confirmó que fueron refinanciados, registrar contra cuenta de ajuste pero documentar la fuente.

### SÍ hacer

- ✅ Trabajar **únicamente** en `chore/stabilization-sprint-2026-Q2`. NO crear nuevas ramas.
- ✅ Cada fix de bug + cada migración: commit pequeño con tests, todos en la misma rama del sprint.
- ✅ Tests pytest para los fixes de mark_debt_as_paid y set_balance (críticos).
- ✅ Documentar cada decisión en commits descriptivos (Conventional Commits, sin emojis, sin Co-Author).
- ✅ Backup snapshot antes de cualquier cambio en dev DB.
- ✅ Validar visualmente el P&L y Balance Sheet antes/después de cada cambio.
- ✅ Usar background agents (`run_in_background: true`) para tareas paralelizables: silent-failure-hunter sobre auth+payments, code-reviewer sobre fixes integrados, audit scripts en paralelo.

---

## Criterios de "estabilizado"

Al final de la sesión, el sistema debe cumplir:

1. **Trazabilidad 100%:** `SUM(balance_entries)` por cuenta = `balance_accounts.balance`. Cero discrepancias.
2. **Pasivos coherentes:** todo `LIABILITY` con `balance > 0` está `is_active = true`. Todo archivado tiene `balance == 0`.
3. **AR completos:** todos tienen `due_date`. Aging report funciona.
4. **Categorías limpias:** cero expenses con categoría `mercado`/`ocio`/`comida`/`viaticos`/`deuda` post-fecha-de-corte. Histórico reclasificado.
5. **Inventario al 100% con cost real:** los 608 productos con `cost=NULL` deben tener cost capturado o estar `is_active=false`.
6. **Balance cuadra:** `Activos = Pasivos + Patrimonio`. La cuenta `EQUITY` existe y absorbe los ajustes históricos documentados.
7. **P&L defensible:** el income statement de cada mes 2026 puede explicarse con los datos del sistema sin notas externas.
8. **Bugs cerrados:** los 5 bugs documentados arriba tienen fix con test que pasa.
9. **Audit scripts:** los 4 scripts de auditoría continua existen y corren contra prod_snapshot sin error.
10. **Documentación:** `docs/formalization/03-contable.md` actualizado con el estado final.

---

## Salida esperada de la sesión

1. Branch con todos los fixes y migraciones (mergeable a develop tras revisión).
2. Tabla `accounting_audit_log_2026` con cada movimiento auditado.
3. CSV de issues humanos para que el owner revise.
4. Reporte ejecutivo `docs/formalization/stabilization-report-2026-XX-XX.md` con:
   - Antes vs después en P&L y Balance.
   - Lista de cambios aplicados.
   - Issues abiertos pendientes de decisión del owner.
   - Recomendaciones para evitar regresión.
5. PR con todos los cambios, descripción que enlace a este prompt.

---

## Cómo arrancar (modo sprint acelerado)

```bash
# 1. Verificar que estás en la rama del sprint
cd /Users/angelsamuelsuescarios/Documents/03_Proyectos/Codigo/uniformes-system-v2
git branch --show-current  # debe ser chore/stabilization-sprint-2026-Q2

# 2. Confirmar que M2 cerró exitosamente (alembic en head merge_stab_001)
docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db \
  -c "SELECT version_num FROM alembic_version;"

# 3. Refrescar snapshot por si las moscas
./backend/scripts/refresh_prod_snapshot.sh

# 4. Leer docs en orden indicado en "Pre-requisitos"

# 5. Empezar por Objetivo 1 — reconciliación forense
mkdir -p /tmp/ucr-stabilization
# Construir queries de auditoría iterativamente.

# 6. PARALELIZACIÓN agresiva (modo sprint):
#    - Lanzar silent-failure-hunter en background sobre auth + payments
#    - Lanzar code-reviewer en background sobre cada fix al integrarse
#    - Lanzar Explore en background para mapear referencias a categorías viejas
```

Reportar avance al final del día con: cuántos movimientos auditados, cuántos bugs reproducidos, cuántas categorías reclasificadas, score de calidad del dato.
