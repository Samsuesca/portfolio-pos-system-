---
title: Roadmap de Mejora - Modulo RRHH / Nomina
date: 2026-06-07
source: workflow multi-agente (6 dimensiones + verificacion + critica adversarial)
hallazgos: 63
estado: propuesta (no implementado salvo los 3 P0 del code-review previo)
---

# Roadmap de Mejora — Módulo RRHH / Nómina (Uniformes Consuelo Rios) — **versión FINAL**

> Síntesis de 6 dimensiones de auditoría (Performance, Escalabilidad/Datos, UX/Frontend, Arquitectura/Dominio, Seguridad, Testing/Observabilidad) **+ crítica de completitud de revisor independiente** (verificada en vivo). Todos los hallazgos están **grounded=true** y **already_done=false**. Los 3 fixes ya cerrados en la sesión (stack-trace leak en `create_payroll_run`, `_calculate_overall_score` sin `WEIGHT_SALES`, off-by-one de timezone en `formatPeriodRange`) NO se recuentan como pendientes.
>
> **Cambio estructural respecto a v1:** la crítica detectó un punto ciego grave y verificado — **el pago de nómina nunca mueve Caja/Banco** — que v1 daba por correcto. Esto promueve un nuevo item **P0 (F1.0)** al frente de la Fase 1, reescribe el test contable (F-T.5), y reabre la concurrencia de pago (F1.3b), el self-service del empleado (nuevo epic F5), los parámetros legales fundacionales (F4.0) y el finiquito (F4.8). Las recalibraciones de severidad de la crítica se incorporan.

---

## Resumen ejecutivo

- **El módulo backend tiene una base sólida** pero arrastra deuda real: autorización con `require_global_permission` en todos los endpoints, Decimal para dinero, guards de transición de estado en `payroll_service`, e índices compuestos en los caminos calientes. El `PayrollService` está bien testeado a nivel unit.
- **🔴 DEFECTO P0 NUEVO Y VERIFICADO — el pago de nómina no descuenta Caja/Banco.** `mark_payroll_paid` (`payroll_service.py:422-455`) y `pay_payroll_item` (`payroll_service.py:547-580`) **solo flipan `is_paid=True`**; NUNCA invocan `transaction_service.record`, a diferencia del patrón canónico `ExpenseService.pay_expense` (`accounting/expenses.py:104-114`). Consecuencia: aprobar+pagar la nómina crea el `Expense` pero **el desembolso jamás aparece en el flujo de caja, ni en el cuadre diario (`daily_cash_registers`), ni descuenta el saldo de Caja/Banco**. El `payment_method` ('cash'/'transfer') capturado en `pay_payroll_item` se guarda en el item pero **no enruta a ninguna cuenta**. Esto **descuadra la contabilidad GLOBAL** — la regla cardinal del proyecto (una sola Caja/Banco). Es el bug financiero más grave del módulo y v1 lo trataba como "no tocar".
- **El defecto P0 de UX de v1 sigue vigente**: el admin-portal NO desempaqueta `PaginatedResponse` en 5 servicios (nómina, asistencia, faltas, turnos, rendimiento), dejando esas 5 vistas rotas o con datos truncados HOY. Bajo esfuerzo (S), va primero junto al fix de caja.
- **Dos bugs de correctitud monetaria** (P1): doble deducción de faltas para empleados de pago diario, y re-conteo de faltas entre nóminas con periodos solapados (`get_deductible_absences` no filtra por aprobación ni por liquidación previa).
- **Falta idempotencia financiera en dos planos**: (a) nada impide crear dos `PayrollRun` del mismo periodo y aprobar ambos (sin `UniqueConstraint` ni guard de solapamiento); (b) **doble-pago concurrente** — `pay_payroll_item` hace read-then-write sobre `is_paid` sin lock (mismo patrón de carrera que la crítica señala, pero en el endpoint que mueve dinero).
- **N+1 sistemático** en los 3 flujos de agregación (3N–6N round-trips) y **paginación falsa** en ~8 endpoints workforce.
- **CORRECCIÓN al contexto previo (verificada):** la nota de memoria "workforce_shifts.py ya tiene el mejor patrón (paginación real)" es **FALSA** — `shifts` también pagina en Python. Patrón de referencia correcto: `payroll.py:68-76`.
- **Escalada lateral de autorización verificada en vivo** (recalibrada P2→**P1**): `require_global_permission` concede si el permiso existe en CUALQUIER colegio (OR), así que un ADMIN de sede menor controla la nómina GLOBAL — ve/edita salarios de todos, aprueba y paga (= crea gasto y, tras F1.0, mueve caja).
- **La nómina NO es una nómina colombiana real** (Fase 4, alcance de producto): faltan prestaciones sociales (~21-22% del costo laboral), seguridad social sobre IBC, auxilio de transporte legal, horas extra/recargos, retención en la fuente, **liquidación definitiva/finiquito**, y **parámetros legales por año (SMMLV/UVT/IBC/festivos)** que bloquean todo lo anterior. **Matiz de la crítica incorporado:** el sesgo del ~20% en costo laboral contamina el P&L vivo HOY (negocio en producción que ya toma decisiones financieras), por lo que la **provisión mensual** se trata como deuda que afecta decisiones presentes, no puro "futuro".
- **El usuario primario más numeroso — la vendedora — no tiene flujo propio** (nuevo epic F5 self-service): no puede ver su ficha (`/me` exige `employees.manage`), ni sus faltas/deducciones antes de liquidar, ni completar su checklist (`workforce.self_checklist` es permiso muerto + IDOR potencial).
- **Agujeros de testing/observabilidad**: la capa de autorización por permiso nunca se ejercita, `PerformanceService` tiene cero cobertura, `approve/pay/cancel` no emiten log estructurado de actor+monto, **ningún test verifica la Transaction de caja** (F-T.5 reescrito), y el harness de CI no corre `pytest tests/` limpio por colisión de event loop (agravada por drift verificado: requirements pinea pytest-asyncio 0.23.8 pero el venv tiene 1.3.0).

---

## Mapa de calor (dimensión × salud)

> **Nota de conteo:** se usa el `severity_verdict` ajustado. **No se cuenta dos veces** el hallazgo de confirmación approve/pay: UX lo registra como P1 (su severidad real), Security NO lo recuenta (era el mismo hallazgo inflando el heatmap). El nuevo P0 de caja (F1.0) se asigna a Arquitectura/Dominio.

| Dimensión | Salud | P0 | P1 | P2 | P3 | Comentario |
|---|---|---|---|---|---|---|
| Performance & Queries | 🟠 Media | 0 | 3 | 1 | 4 | N+1 en todos los agregados; paginación falsa. Degrada con headcount. |
| Escalabilidad & Datos | 🟡 Media-alta | 0 | 2 | 4 | 3 | Bien indexado en caliente; faltan constraints + drift modelo/DB. |
| UX & Frontend | 🟠 Media | 1 | 4 | 4 | 2 | Tauri bien arquitecturado; admin-portal es un fork roto y divergente. |
| Arquitectura & Dominio | 🔴 Baja | **1** | 3 | 6 | 3 | **+P0 caja-pago no integra Transaction.** Nómina CO incompleta (producto). |
| Seguridad & Authz | 🟡 Base buena, escalada real | 0 | **3** | 2 | 5 | +F1.6 sube a P1 (escalada lateral verificada). Granularidad gruesa + PII. |
| Testing/CI/Observabilidad | 🟠 Media | 0 | 5 | 4 | 2 | F-T.5 reescrito (P1) para cazar el descuadre de caja; CI no corre limpio. |

---

## Estado honesto del módulo

**Lo que está bien (no tocar / usar como referencia):**
- `payroll_service` tiene guards de transición correctos (no edita runs approved/paid, no cancela paid) y `approve` crea un `Expense` PAYROLL real **(pero ese Expense queda como pasivo/gasto sin desembolso de caja hasta que F1.0 lo conecte).**
- El Tauri (`frontend/`) está bien descompuesto: `Payroll.tsx` orquestador de 265 líneas + 8 sub-componentes `React.memo`, con loading/error/empty explícitos, `formatCurrency` centralizado, `unwrapPaginated` aplicado, y patrón de banner+Reintentar (`Payroll.tsx:188-204`) reutilizable.
- Timezone usa correctamente `app.utils.timezone`.
- Índices compuestos `(employee_id, fecha)` con unique en attendance/schedules/checklists existen.
- `test_payroll_service_deep.py` es sólido (AAA, edge cases, prorrateo, fixed-expense upsert).
- Patrón de paginación real correcto YA existe en `payroll.py:68-76` y `employees.py:44-52`.
- **Patrón canónico de integración de caja YA existe** en `ExpenseService.pay_expense` (`accounting/expenses.py:81-130`): es exactamente lo que F1.0 debe replicar.

**Deuda real (lo que cubre este roadmap):**
- **El pago de nómina no mueve caja (descuadre contable global).** ← nuevo, P0.
- El admin-portal es un fork divergente y deteriorado del Tauri.
- N+1, paginación falsa, doble deducción de faltas, idempotencia de periodo **y de pago concurrente**.
- Escalada lateral de permisos globales vía rol de sede.
- Nómina colombiana incompleta (producto) — incluyendo finiquito y parámetros legales.
- Self-service del empleado inexistente.
- Cobertura de authz/performance, observabilidad de operaciones financieras, y **test de la Transaction de caja**.

---

## FASE 1 — Correctitud contable & Seguridad core

> Reordenada: la integración de caja (F1.0) encabeza todo porque es el descuadre directo de la regla cardinal del proyecto. Le siguen los quick-wins de estabilización (ex-Fase 0), luego correctitud monetaria y autorización.

### F1.0 · `bug-payroll-pay-no-cash-transaction` — **🔴 P0 · M** *(NUEVO — de la crítica, verificado en vivo)*
**El pago de nómina no debita Caja/Banco ni registra `Transaction` → descuadre de la contabilidad GLOBAL.**
- **Evidencia:** `mark_payroll_paid` (`payroll_service.py:422-455`) y `pay_payroll_item` (`payroll_service.py:547-580`) solo ponen `item.is_paid=True` / `expense.is_paid=True`; `grep transaction_service payroll_service.py` = vacío. Contraste canónico: `ExpenseService.pay_expense` (`accounting/expenses.py:104-114`) llama `transaction_service.record(type=EXPENSE, amount, payment_method, school_id, category, expense_id, created_by)` y dispara alerta Telegram. El `payment_method` que `pay_payroll_item` captura se guarda en el item pero no enruta a ninguna cuenta.
- **Acción:**
  - En `mark_payroll_paid` y `pay_payroll_item`, tras marcar pagado, invocar `transaction_service.record(type=EXPENSE, amount=<neto pagado>, payment_method=<del request>, description=f"Pago nómina {periodo}", category="payroll", expense_id=payroll.expense_id, transaction_date=get_colombia_date(), created_by=current_user.id)`. Para pago total: una Transaction por el `total_net`; para pago por item: una Transaction por el neto del item (idempotente con F1.3b).
  - `mark_payroll_paid` debe recibir `payment_method` (hoy no lo recibe) — propagar desde la ruta (`payroll.py:222-241`).
  - Disparar alerta Telegram de "nómina pagada" reusando el patrón de `expense_paid`.
  - Decisión de contabilidad GLOBAL: una sola Caja/Banco; `school_id` es opcional/solo-reporte — confirmar que la Transaction de nómina **no** se ate a un colegio (es gasto global de la empresa empleadora).
- **Impacto:** el desembolso de nómina aparece en flujo de caja, cuadre diario y saldo Caja/Banco. Cierra el descuadre contable más grave del módulo.
- **Dependencias:** ninguna para el fix base. **Bloquea:** F-T.5 (test de Transaction de caja), F1.3b (idempotencia de pago debe envolver el `record`), F2.8 (no cachear summaries hasta que reflejen el cash real).

### F1.1q · `bug-admin-payroll-workforce-pagination-unwrap` — **P0 · S** *(ex-F0.1)*
**Admin-portal: 5 servicios no desempaquetan `PaginatedResponse` → 5 vistas rotas en prod.**
- **Evidencia:** `admin-portal/lib/services/payrollService.ts:130-138` (`list` retorna `response.data` como array); `workforceService.ts:374-377` (getSchedules), `:401-410` (getAttendanceRecords), `:430-439` (getAbsences), `:517-520` (getPerformanceSummary). Backend ya devuelve `PaginatedResponse`. Helper `unwrapPaginated` YA existe (`admin-portal/lib/utils/pagination.ts:3-16`); `employeeService.ts:156` ya lo usa.
- **Acción:** aplicar `unwrapPaginated(response.data).items` en los 5 métodos. Para `payrollService.list` y `getPerformanceSummary`, devolver el wrapper completo para exponer `total/has_more` (habilita paginación UI, F3.6).
- **Impacto:** restaura 5 vistas hoy rotas/degradadas.
- **Dependencias:** ninguna. **Bloquea:** F3.1, F3.4, F3.6, F-T.7.

### F1.2q · `perf-n1-approve-payroll` — **P1 · S** *(ex-F0.2)*
**`approve_payroll_run` re-consulta cada empleado teniendo los objetos ya cargados (2N → 0).**
- **Evidencia:** `payroll_service.py:296-304` hace `for emp_id in employee_ids: emp = await employee_service.get_employee(...)` aunque `get_payroll_run` (`:84-92`) ya hizo `selectinload(items).selectinload(employee)`. Solo se usa `payment_frequency`.
- **Acción:** `employees_list = [item.employee for item in payroll.items if item.employee]`. Eliminar el loop.
- **Dependencias:** ninguna.

### F1.3q · `obs-no-audit-log-approve-pay` — **P1 · S** *(ex-F0.3)*
**`approve/pay/cancel` no emiten log estructurado (actor, monto, run_id).**
- **Evidencia:** `payroll.py:198-219/222-241/244-263/294-317` sin `logger`. `mark_payroll_paid`/`cancel_payroll_run` ni reciben `current_user`.
- **Acción:** propagar `current_user.id` al service y emitir `logger.info` con `{action, payroll_run_id, item_id, amount: str(total_net), payment_method, actor_user_id, status_from, status_to}`. Alimenta el Log Explorer de VultrUI (structlog ya está). **Sinergia directa con F1.0** (el `current_user`/`payment_method` que F1.0 ya propaga).
- **Dependencias:** se hace junto a F1.0 (comparten la propagación de `current_user`). Sinergia con F1.7 (audit trail en DB).

### F1.4q · `riesgo-approve-pay-payroll-sin-confirmacion` — **P1 · S** *(ex-F0.4; fusiona `authz-no-confirmation-approve-pay-tauri`)*
**Aprobar/Pagar (crean gasto irreversible + ahora mueven caja) sin confirmación; Cancelar SÍ confirma — fricción invertida.**
- **Evidencia:** Tauri `PayrollDetailModal.tsx:76-89/91-104/121-131` sin `confirm()`; `:106-119` cancel SÍ. Admin `payroll/page.tsx:344-358/360-374/391-401` sin confirm; `:377` cancel SÍ. (El título original "Tauri" del hallazgo de seguridad estaba mal etiquetado: aplica a ambas apps; **no se recuenta** en el heatmap de Security.)
- **Acción:** confirmación explícita (modal, no `window.confirm`) mostrando `formatCurrency(total_net)`, `employee_count` y **el método de pago / cuenta afectada** (relevante ahora que mueve caja). Ambas apps.
- **Dependencias:** ninguna.

### F1.5 · Doble deducción de faltas (FUSIÓN de `bug-daily-absence-double-deduction` + `perf-double-deduction-absences` + `data-double-deduction-absences` + `bug-overlap-absence-double-count`) — **P1 · L**
**Tres sub-defectos distintos sobre el mismo concepto (deducción de faltas), con fixes separados:**
1. **Doble castigo diario:** `payroll_service.py:159-165` (DAILY: `daily_rate * worked_days`) ya excluye el día ausente vía `_get_worked_days` (`:608-614`), y además `:184-205` resta `absence.deduction_amount` de la misma falta.
2. **Re-conteo entre nóminas solapadas:** `get_deductible_absences` (`attendance.py:314-329`) solo filtra `is_deductible` + rango. No existe `payroll_item_id` en `AbsenceRecord` (`workforce.py:205-256`).
3. **Deduce faltas sin aprobar:** `approved_at`/`approved_by` existen (`workforce.py:235-240`) pero NUNCA se usan.
- **Acción (separar nítidamente los 3 fixes):**
  - *(sub-bug 2)* Migración Alembic: `payroll_item_id` (FK nullable, `ondelete='SET NULL'`) en `absence_records`; marcar la falta consumida al crear el `PayrollItem`.
  - *(sub-bug 3)* `get_deductible_absences`: filtrar `payroll_item_id IS NULL` AND `approved_at.isnot(None)`.
  - *(sub-bug 1)* Para DAILY, NO sumar `deduction_amount` cuando el día ya bajó `worked_days` (separar conceptos: `deduction_amount` solo para salario fijo no prorrateado por asistencia).
- **Impacto:** cada falta se descuenta exactamente una vez y solo tras aprobación. Cierra riesgo laboral CO.
- **Dependencias:** migración antes del filtro/marca. **Bloquea:** F-T.4. Sinergia con F1.6.

### F1.6 · Idempotencia de periodo de nómina (FUSIÓN de `riesgo-no-idempotency-payroll-period` + `data-no-unique-payroll-period` + `validation-payroll-period-bounds` + `mejora-payroll-create-modal-sin-validacion-fechas`) — **P1 · M**
**Nada impide crear N `PayrollRun` del mismo periodo y aprobar cada uno → gasto contable (y ahora caja) duplicado.**
- **Evidencia:** `create_payroll_run` (`payroll_service.py:94-128`) solo valida `period_end>=period_start`. `PayrollRun` (`models/payroll.py:180-256`) sin `UniqueConstraint`. `approve_payroll_run` (`:259-314`) crea un `Expense` por run sin verificar previo. `PayrollRunCreate` (`schemas/payroll.py:208-214`) sin `model_validator`. Frontend `PayrollCreateModal.tsx:138-141` sin clamp.
- **Acción (backend):** guard EXISTS de solapamiento (`status != cancelled` AND `period_start<=:end AND period_end>=:start`) → 409; migración `UniqueConstraint('payroll_run_id','employee_id')` + índice único parcial `WHERE status != 'cancelled'` sobre `(period_start, period_end)`; `model_validator` en `PayrollRunCreate`.
- **Acción (frontend):** validar `period_end >= period_start` (deshabilitar Crear + hint), clampar `periodDays` a ≥0, advertir solapamiento. Tauri y admin.
- **Dependencias:** ninguna (lógica); migración opcional.

### F1.3b · `guard-concurrencia-doble-pago-nomina` — **P1 · M** *(NUEVO — de la crítica; F1.3 NO cubría los endpoints de pago)*
**Doble-pago concurrente: dos requests a `pay_payroll_item`/`mark_payroll_paid` flipan `is_paid` sin lock → doble Transaction de caja (tras F1.0).**
- **Evidencia:** `pay_payroll_item` (`payroll_service.py:565-567`) hace `if item.is_paid: raise` y luego `item.is_paid = True` — read-then-write sin `with_for_update`. Es el mismo patrón de carrera que F1.7q marca para attendance, **pero aquí mueve dinero**, por eso es P1 y va en correctitud, no en P2.
- **Acción:** `SELECT ... FOR UPDATE` sobre el `PayrollItem`/`PayrollRun` al inicio de la transacción de pago (o índice único + manejo de `IntegrityError`), de forma que la Transaction de caja de F1.0 se emita exactamente una vez. Test de concurrencia en F-T.4b.
- **Impacto:** evita doble desembolso de caja por doble clic / requests concurrentes.
- **Dependencias:** **debe envolver el `transaction_service.record` de F1.0** (hacer juntos F1.0 + F1.3b).

### F1.7 · `authz-coarse-employees-payroll-permission` — **P1 · M**
**Lectura y escritura colapsadas en `employees.manage`/`payroll.manage` → quien ve salarios puede aprobar/pagar.**
- **Evidencia:** los 11 endpoints de `employees.py` y los 10 de `payroll.py` usan un único permiso de gestión. `permission.py:98-99` solo define `employees.manage`/`payroll.manage`. `accounting.*`/`workforce.*` SÍ separan view/manage.
- **Acción:** dividir en `employees.view`/`manage` y `payroll.view`/`manage` (+ `payroll.approve` y `payroll.pay` como sensibles separados). GET→`*.view`, mutaciones→`*.manage`. Registrar en `SYSTEM_ROLE_PERMISSIONS`.
- **Dependencias:** se resuelve junto a F1.8+F1.9 dentro del **epic de permisos** (ver nota de esfuerzo abajo). **Bloquea:** F-T.2.

### F1.8 · `authz-divergence-adminportal-payroll` — **P1 · M**
**Admin-portal gatea con `school_roles` (admin/owner) en cliente; Tauri/backend usan `payroll.manage` granular.**
- **Evidencia:** `admin-portal/payroll/page.tsx:112-114` gate 100% client-side.
- **Acción:** el admin-portal gatea con `hasPermission('payroll.manage')`; exponer permissions efectivas en el payload de auth. El gate de servidor sigue siendo la autoridad.
- **Dependencias:** requiere que login/me del admin-portal devuelva permissions efectivas. Parte del epic de permisos.

### F1.9 · `authz-any-school-grants-global` — **🟠 P1 · L** *(RECALIBRADO de la crítica: P2→P1)*
**`require_global_permission` concede si el permiso existe en CUALQUIER colegio (OR) → un ADMIN de sede menor controla la nómina GLOBAL.**
- **Evidencia (verificada en vivo):** `dependencies.py:401-417` "Check if user has the permission in ANY school"; OWNER retorna inmediato (`:406`). Aplica a `payroll.*`/`employees.*` que son datos GLOBALES y (tras F1.0) mueven caja.
- **Justificación de severidad:** escalada lateral **real y explotable** con un grant que el negocio reparte normalmente (admin de sede). No es teórica.
- **Acción:** introducir `is_global` en el catálogo de permisos; para permisos globales, exigir que provengan de un rol marcado global, no de cualquier `school_role` ADMIN.
- **Dependencias:** parte del epic de permisos.

> **🧩 EPIC DE PERMISOS (F1.7+F1.8+F1.9) — esfuerzo agregado XL, NO 3 ítems sueltos** *(misprioritización corregida de la crítica).*
> Rediseñar el catálogo (view/manage + `is_global` + separar approve/pay) toca `SYSTEM_ROLE_PERMISSIONS`, requiere **migración de roles existentes en prod** (mapear los grants actuales a los nuevos códigos sin romper acceso a usuarios vivos), y debe replicarse en **dos clientes**. Requiere su propio mini-plan: (1) definir matriz código-viejo→código-nuevo; (2) migración Alembic idempotente de `system_role_permissions` con backfill; (3) verificación de que ningún usuario actual pierde acceso legítimo; (4) actualizar gating en Tauri y admin-portal. **Criterio de cierre:** un rol "contador" puede ver nómina pero no aprobar/pagar; un ADMIN de sede ya NO puede tocar nómina global; ningún usuario existente queda bloqueado.

### F1.10 · `data-concurrency-integrityerror-500` — **P2 · M** *(ex-F1.3; alcance corregido — los endpoints de pago migran a F1.3b)*
**Carreras de unicidad en `log_attendance`/`generate_daily_checklists`/`create_schedule` → HTTP 500 crudo en vez de 409.**
- **Evidencia:** read-then-write sin lock en `attendance.py:84-89`→`:106-120`; `checklists.py:262-271`; `shifts.py:191-201`. `grep IntegrityError` workforce = vacío.
- **Acción:** envolver INSERT en `try/except IntegrityError` → rollback → 409 en español. `generate_daily_checklists` con `INSERT ... ON CONFLICT DO NOTHING`. **Los endpoints de pago de nómina NO se tratan aquí — van en F1.3b** (mueven dinero, son P1).
- **Dependencias:** ninguna.

### F1.11 · `audit-no-updated-by-salary` — **P2 · L** *(ex-F1.7)*
**Sin audit trail de cambios de salario/deducciones ni de quién pagó/canceló.**
- **Evidencia:** `Employee` tiene `created_by`+`updated_at` pero NO `updated_by`; `update_employee` (`employees.py:120-140`) muta `base_salary` sin firma. `PayrollRun` sin `paid_by`. Existe `cost_change_log` como patrón.
- **Acción:** migración: `updated_by` en `Employee`, `paid_by` en `PayrollRun`, tabla `employee_change_log`. Poblar en `update_employee`/`update_bonus`/`mark_payroll_paid`.
- **Dependencias:** migración. Sinergia con F1.3q y F1.0 (mismo `current_user`).

### F1.12 · `pii-salary-exposure-no-sensitive-gate` — **P2 · M** *(ex-F1.8)*
**PII/salarios expuestos sin permiso sensible; un empleado no puede ver su propia ficha sin `employees.manage`.**
- **Evidencia (verificada):** `/me` (`employees.py:55`) exige `employees.manage`. El listado SÍ usa `EmployeeListResponse` (sin banco) pero expone `document_id` y `base_salary`.
- **Acción:** (1) permiso `employees.view_sensitive` para banco/documento, masking por defecto en roles view; (2) **mover `/me` al epic self-service F5** (con `employees.self`); (3) confirmar `EmployeeListResponse` como default.
- **Dependencias:** depende del epic de permisos. El sub-punto `/me` se ejecuta en F5.

### F1.13 · `data-payroll-items-cascade-vs-restrict` + `data-cascade-delete-employee-history` (FUSIÓN, **sub-dividida** por la crítica) — **P2 · S→M**
**Drift de política de borrado modelo↔DB + CASCADE que destruiría historia laboral.**
- **Evidencia:** `payroll_items.employee_id` es RESTRICT en DB (migración `x8y9z0a1b2c3:244`) pero CASCADE en el modelo (`payroll.py:274`) → `autogenerate` lo "corregiría" a CASCADE. CASCADE hacia `employees` en attendance/absence/checklists/performance (`workforce.py:168,216,344,436`). Hoy solo soft-delete.
- **Acción (dos esfuerzos separados, como pide la crítica):**
  - **(S — quick-fix)** corregir `payroll.py:274` a `ondelete='RESTRICT'` (alinear modelo con DB; trivial, deja `autogenerate` confiable).
  - **(M — migración real con decisión de política)** migrar los CASCADE de attendance/absence/checklist/performance a RESTRICT o SET NULL; documentar que `employees` NUNCA se hace hard-delete.
- **Dependencias:** ninguna.

---

## FASE 2 — Performance & Escalabilidad

### F2.1 · `perf-n1-create-payroll-run` — **P1 · M**
**N+1 masivo: ~5-6 queries por empleado en la operación más pesada.**
- **Evidencia:** `payroll_service.py:141-189` loop que por iteración llama `calculate_employee_totals` (`employee_service.py:281/286`) + `get_deductible_absences` + (DAILY) `_get_worked_days`. La lista `employees` YA viene con bonuses cargados (`employee_service.py:37`) pero se descarta.
- **Acción:** (1) refactor de `calculate_employee_totals` para aceptar un `Employee` precargado (separar I/O de cálculo, filtrar `employee.bonuses` en memoria); (2) pre-cargar ausencias deducibles del periodo en UNA query agrupada por `employee_id`; (3) pre-cargar attendance del periodo en UNA query para daily. ~6N → 3-4 queries.
- **Dependencias:** el refactor de `calculate_employee_totals` es compartido por F2.2. **Coordinar con F1.5** (la pre-carga de ausencias debe respetar el filtro aprobadas/no-liquidadas).

### F2.2 · `perf-n1-payroll-summary` — **P2 · S**
**`get_payroll_summary`: 1+3N queries en un dashboard frecuente.**
- **Evidencia:** `payroll_service.py:655-708`, loop `:665-666` re-hace `calculate_employee_totals` sobre la lista ya cargada.
- **Acción:** reusar los `Employee` cargados y calcular en memoria; `func.count` para activos. 1+3N → 1-2 queries.
- **Dependencias:** comparte el refactor con F2.1.

### F2.3 · `perf-n1-performance-summary` — **P1 · L**
**`get_all_employees_summary`: 3N queries con la query de asistencia DUPLICADA, ejecutado 2× por `/stats`+`/summary`.**
- **Evidencia:** `performance.py:95-140`; `get_attendance_rate` (`attendance.py:335`) y `get_punctuality_rate` (`:355`) ejecutan la misma query por separado. `workforce_performance.py:108`(stats) y `:78`(summary) invocan el summary entero → 6N. `/stats` recomputa fila-por-fila.
- **Acción:** (1) fusionar attendance_rate+punctuality_rate; (2) summary con `func.count`/`func.sum`+`case-when GROUP BY employee_id`; (3) `/stats` con agregados en DB. 3N-6N → ~3 queries.
- **Dependencias:** ninguna. **Habilita:** F-T.3.

### F2.4 · Paginación SQL real en workforce (FUSIÓN de `perf-fake-pagination-workforce` + `perf-bonuses-fake-pagination`) — **P1 · L**
**~8 endpoints cargan toda la tabla + serializan todo, luego `[skip:skip+limit]` en Python.**
- **Evidencia:** `workforce_attendance.py:62-64,178-180,289-291`; `workforce_checklists.py:244-246`; `workforce_performance.py:81-83,156-157`; `workforce_shifts.py:153-155,287-289`; `employees.py:189-192`. Services `get_attendance_records` (`attendance.py:32-60`), `get_absences` (`:215-243`), `get_schedules` (`shifts.py:104-130`), `get_employee_bonuses` (`employee_service.py:165-180`) sin `offset/limit`.
- **⚠️ CORRECCIÓN (verificada):** la nota de memoria "workforce_shifts.py ya tiene paginación real" es **FALSA**. **Patrón de referencia correcto: `payroll.py:68-76`** o `employees.py:44-52`.
- **Acción:** empujar `skip/limit` + `func.count` a cada `get_*`; serializar solo la página. attendance/checklists crecen ~1 fila/empleado/día sin techo.
- **Dependencias:** ninguna. **Bloquea:** F-T.6, F3.6.

### F2.5 · `perf-daily-summary-python-count` + `data-missing-secondary-indexes-reporting` (FUSIÓN parcial) — **P3 · S→M**
**`get_daily_summary` cuenta por status en Python; falta índice en `daily_checklist_items.checklist_id`.**
- **Evidencia:** `attendance.py:179-209` con `selectinload(employee)` innecesario y `sum(1 for r ...)`. `daily_checklist_items.checklist_id` (`workforce.py:398`) sin índice (Postgres no indexa FKs).
- **Acción:** `SELECT status, func.count() GROUP BY status` sin selectinload. Migración: índice en `daily_checklist_items(checklist_id)` + índice por fecha sola. **Descartar** el resto de índices propuestos (especulativos a ~5k filas/año — confirmar con EXPLAIN antes).
- **Dependencias:** ninguna.

### F2.6 · `data-numeric-width-drift` — **P2 · M**
**Modelo declara `Numeric(15,2)` pero la DB creó `Numeric(12,2)`/`(14,2)` → `autogenerate` ruidoso.**
- **Evidencia:** modelo `payroll.py:71,92,96,100,158,206-221,279-282` (15,2); migración `x8y9z0a1b2c3` creó 12,2/14,2.
- **Acción:** migración `alter_column` a `Numeric(15,2)` canónico. Verificar `alembic check`.
- **Dependencias:** ninguna.

### F2.7 · `data-enum-as-string-no-db-constraint` — **P2 · M**
**Enums de workforce persistidos como `String(n)` sin CHECK → valores inválidos rompen conteos por igualdad exacta.**
- **Evidencia:** `workforce.py:82,172,224,406,439,278,502,497` String sin constraint; `get_daily_summary` compara `r.status == AttendanceStatus.PRESENT.value`.
- **Acción:** `CheckConstraint` (o `SAEnum` nativo), priorizando `attendance.status` y `absence_records.absence_type`.
- **Dependencias:** ninguna.

> **🧩 EPIC OPCIONAL "modelo↔DB limpio" (F1.13-quickfix + F2.6 + F2.7)** *(redundancia agrupada de la crítica):* las tres son manifestaciones del mismo meta-problema (drift modelo-SQLAlchemy vs DDL-real que ensucia `autogenerate`). Pueden ejecutarse como un solo epic con **criterio de cierre único: `alembic check` limpio**, en lugar de tres migraciones que cada una deja el autogenerate a medias.

### F2.8 · `perf-missing-cache-dashboards` — **P3 · M**
**Dashboards summary/stats sin caching pese a ser lecturas frecuentes y caras.**
- **Acción:** tras F2.2 y F2.3 **y F1.0**, cache Redis TTL corto (60-300s) key-ed por `(endpoint, period_start, period_end)`, invalidando al crear nómina / registrar asistencia / **pagar nómina**.
- **Dependencias:** **DESPUÉS de F2.2, F2.3 y F1.0** — cachear un summary que aún omite el cash real (o el N+1) es esconder doble problema.

> **Descartado de Fase 2 (over-engineering verificado):** `data-attendance-checklist-retention` (particionado/archival) — a ~5k filas/año Postgres barre en ms; reducido al único sub-punto accionable (índice por fecha sola, ya en F2.5).

---

## FASE 3 — UX & Arquitectura frontend

### F3.0 · `arch-extract-shared-payroll-client` — **P1 · L** *(NUEVO — de la crítica: la causa raíz del fork, no solo el síntoma)*
**Tauri y admin-portal reimplementan el MISMO dominio de nómina (servicios, tipos, cliente API) → cada bug se arregla dos veces (ya pasó con `formatPeriodRange` y el unwrap de paginación).**
- **Evidencia:** `payrollService.ts`/`workforceService.ts` existen duplicados en `frontend/src/services/` y `admin-portal/lib/services/` con divergencias (unwrap, `fixed_expense_integration`, schemas).
- **Acción:** extraer un paquete compartido `@ucr/payroll-client` (tipos + servicios + `unwrapPaginated`) consumido por ambas apps. Mínimo viable: tipos + cliente; ideal: + componentes presentacionales puros. **Esto convierte F3.1/F3.5/F-T.7 de "arreglar el fork dos veces" en "arreglar una vez".**
- **Impacto:** elimina la divergencia estructural de raíz; un solo lugar para la lógica de nómina.
- **Dependencias:** depende de F1.1q (servicios sanos primero). **Habilita y reduce esfuerzo de** F3.1, F3.5, F-T.7.

### F3.1 · `techdebt-admin-payroll-mega-componente` — **P1 · L**
**`admin-portal/payroll/page.tsx`: mega-componente de 1307 líneas (fork divergente del Tauri ya descompuesto).**
- **Evidencia:** 4 modales inline (`:762-942,945-1051,1053-1135,1137-1304`) + tabs + handlers. Tauri en 9 archivos `React.memo`.
- **Acción:** descomponer replicando la estructura del Tauri, **consumiendo el paquete compartido de F3.0**.
- **Dependencias:** depende de F1.1q y F3.0.

### F3.2 · `mejora-silent-failures-loads-workforce` — **P1 · M**
**Errores de carga workforce solo van a `console.error`; el usuario ve tabla vacía indistinguible de "sin datos".**
- **Evidencia:** Tauri `WorkforcePage.tsx:38-40`, `AttendanceTab.tsx:63-65`, `ChecklistsTab.tsx:49-51`, `ShiftsTab.tsx:53-55`, `PerformanceTab.tsx:47-49`, `ResponsibilitiesTab.tsx:37-39`. Admin `workforce/page.tsx:20-22`, `performance/page.tsx:51`. (Admin `attendance/page.tsx` y `shifts/page.tsx` SÍ tienen banner.)
- **Acción:** `setError` por sección + banner rojo con Reintentar (patrón Tauri `Payroll.tsx:188-204`). Distinguir 200-vacío de catch.
- **Dependencias:** ninguna.

### F3.4 · `bug-admin-perf-n-plus-1-reviews-loop-cliente` — **P1 · M**
**Admin Performance genera evaluaciones en bucle por empleado desde el navegador + feedback falso.**
- **Evidencia:** `admin-portal/performance/page.tsx:72-83` `for (emp of summary) await generate(...)` con catch vacío (`:80-82`) y `alert('...exitosamente')` (`:84`). Backend sin endpoint bulk.
- **Acción:** crear `POST /performance/reviews/generate-bulk` (N en transacción server-side); mientras tanto `Promise.allSettled` + conteo veraz. Unificar con Tauri.
- **Dependencias:** opcional endpoint bulk. (Hoy ni corre por F1.1q.)

### F3.3 · `bug-deduction-input-number-sin-formato` — **P2 · S**
**Input de monto de deducción usa `<input type=number>` crudo.**
- **Evidencia:** Tauri `AttendanceTab.tsx:573-585`; admin `attendance/page.tsx:508-515`. `CurrencyInput` existe (`PayrollEmployeeModal.tsx:417-435`).
- **Acción:** reemplazar por `CurrencyInput`; validar `> 0`; preview del salario resultante.
- **Dependencias:** ninguna.

### F3.5 · `mejora-empleado-selector-ausente-admin-payroll` — **P2 · M**
**Admin crea liquidación "a ciegas": sin selector de empleados ni preview (diverge del Tauri).**
- **Evidencia:** admin `payroll/page.tsx:1053-1135` solo fechas+notas; `handleCreatePayroll:316-321` sin `employee_ids`. Tauri `PayrollCreateModal.tsx:223-320` tiene checkboxes, "seleccionar todos", warning de cap, preview.
- **Acción:** portar selector + preview + warning cap (limit=500); enviar `employee_ids`. **Reusa el paquete compartido (F3.0).**
- **Dependencias:** F3.1 y F3.0.

### F3.6 · `mejora-paginacion-ui-virtualizacion` — **P2 · L** *(SUBE de P3 — crítica: las tablas de asistencia crecen sin techo y hoy ya renderizan cientos de filas)*
**Listas renderizan todo sin paginación UI ni virtualización.**
- **Evidencia:** `PayrollCreateModal.tsx:66` carga limit=500 y mapea los 500; ninguna tabla expone controles de página. Las vistas de asistencia de varias semanas ya son grandes (1 fila/empleado/día).
- **Acción:** exponer paginación UI con `total/has_more` del `PaginatedResponse` **priorizando la vista de asistencia**; virtualizar selector de empleados y tablas largas; buscador por nombre.
- **Dependencias:** depende de F1.1q (metadata) y se beneficia de F2.4.

### F3.7 · `mejora-alert-nativo-en-acciones-workforce` — **P2 · M**
**Acciones workforce usan `window.alert`/`confirm` nativo en vez de error inline en español.**
- **Evidencia:** Tauri `AttendanceTab.tsx:187`, `ChecklistsTab.tsx:81,90,100,174,184,198`, `ShiftsTab.tsx:149,214`, `PerformanceTab.tsx:91,106,123`.
- **Acción:** toasts + modal de confirmación reutilizable.
- **Dependencias:** ninguna.

### F3.8 · `mejora-employee-modal-no-memoiza-listas` — **P3 · M**
**Formularios grandes usan `setForm({...form})` → re-render completo por tecla.**
- **Evidencia:** `PayrollEmployeeModal.tsx:284-435`; admin `payroll/page.tsx:793-916`.
- **Acción:** `setForm(p => ({...p, campo}))` + sub-componente memoizado para bonos. **Medir con React Profiler antes.**
- **Dependencias:** ninguna.

---

## FASE 4 — Dominio de nómina colombiana (ALCANCE DE PRODUCTO)

> ⚠️ **No son defectos del código actual** sino features faltantes para una nómina colombiana formal y vendible. El módulo hoy modela un "payroll" básico que **funciona** para el caso actual (pocos empleados, salarios estables). **Matiz incorporado de la crítica:** la provisión de prestaciones (F4.1) afecta el P&L vivo HOY (~20% de subestimación del costo laboral), así que su componente de *provisión mensual* se trata como deuda que contamina decisiones presentes, no puro futuro.

### F4.0 · `feature-parametros-legales-por-anio` — **P1 (fundacional) · L** *(NUEVO — de la crítica: precondición que nadie poseía)*
**No existe una tabla de parámetros legales versionada por año; F4.1/F4.2/F4.3 dependen todos de ella y estaban bloqueados sin dueño.**
- **Acción:** modelar `legal_parameters` (por año): SMMLV, auxilio de transporte, UVT, % aportes (salud/pensión/parafiscales), topes IBC (1–25 SMMLV), y **calendario de festivos CO**. CRUD admin + lectura por servicio de nómina. Seed 2026.
- **Impacto:** desbloquea las 3 features XL de Fase 4; fuente única de verdad de parámetros legales.
- **Dependencias:** ninguna. **Bloquea:** F4.1, F4.2, F4.3, F4.5 (festivos), F4.6.

### F4.1 · `feature-prestaciones-sociales-faltantes` — **P1 (producto; provisión afecta P&L hoy) · XL**
**Faltan cesantías (8.33%), prima (8.33%), vacaciones (4.17%), intereses sobre cesantías (12% anual).**
- **Evidencia:** `models/payroll.py:70-102,278-296` — ningún campo/cálculo. ~21-22% del costo laboral; P&L subestima personal en ~20%.
- **Acción:** tabla `payroll_provisions` o campos calculados por `PayrollItem` con bases legales (auxilio de transporte en base de cesantías/prima). **Adelantar la PROVISIÓN MENSUAL** (afecta reportes vivos) y dejar la liquidación definitiva para F4.8. Módulo separado para no romper el flujo actual.
- **Dependencias:** **F4.0**.

### F4.2 · `feature-seguridad-social-manual` — **P2 (producto) · L**
**Salud/pensión son montos manuales fijos, no 4%+4% sobre IBC; sin aportes patronales/parafiscales.**
- **Evidencia:** `models/payroll.py:91-102`; `calculate_employee_totals:289-307`.
- **Acción:** salud/pensión = 4% del IBC (piso 1 SMMLV, techo 25 SMMLV desde F4.0); `other_deductions` como override. Aportes patronales en el módulo de provisiones.
- **Dependencias:** **F4.0**; mismo epic que F4.1.

### F4.3 · `feature-horas-extra-recargos-retefuente` — **P2 (producto) · XL**
**Sin horas extra, recargos (nocturno 35%, dominical/festivo 75%/100%) ni retención en la fuente.**
- **Evidencia:** único mecanismo es `EmployeeBonus` (`models/payroll.py:133-177`); attendance captura `minutes_late` pero no horas extra.
- **Acción:** modelar "novedades de nómina" tipadas con horas + factor de recargo sobre `hourly_rate` derivado del base; retención por procedimiento 1 (tabla UVT de F4.0).
- **Dependencias:** **F4.0**; `hourly_rate`/base de F4.1.

### F4.8 · `feature-liquidacion-definitiva-finiquito` — **P1 (producto) · L** *(NUEVO — de la crítica: el momento de mayor riesgo legal/monetario en RRHH CO)*
**No hay flujo de finiquito al terminar contrato (cesantías + prima + vacaciones proporcionales + indemnización), con su impacto de caja inmediato.**
- **Evidencia:** `termination_date` existe (`models/payroll.py:66`) y `delete_employee` lo setea (`employee_service.py:157`), pero ningún flujo calcula la liquidación de salida. F4.1 solo lo menciona de pasada.
- **Acción:** flujo "liquidación definitiva" que al setear `termination_date` calcule prestaciones proporcionales + indemnización según causal, genere el `Expense` + **Transaction de caja inmediata (reusa F1.0)**, y produzca el documento de finiquito (ver F4.9 / reporte).
- **Dependencias:** **F4.0** + F4.1 (bases) + **F1.0** (caja). Es un flujo de producto distinto de la provisión mensual.

### F4.4 · `tech-debt-no-reversibilidad-approved-pago-parcial` — **P2 · M**
**Sin reversa APPROVED→DRAFT; PAID prematuro al pagar el último item; `cancel` no revierte el `FixedExpense.amount` que `approve` infló (ni, tras F1.0, la Transaction de caja).**
- **Evidencia:** solo `cancel_payroll_run` (`:457-485`); `pay_payroll_item` marca PAID al `all(is_paid)` (`:573-576`); `cancel` desactiva Expense (`:477-481`) pero NO restaura `FixedExpense.amount` (`:384-387`).
- **Acción:** transición `reopen`/`unapprove` (elimina Expense, restaura FixedExpense, **revierte la Transaction de caja de F1.0**); recalcular `FixedExpense.amount` desde runs activos en `cancel`.
- **Dependencias:** **F1.0** (debe revertir también la caja).

### F4.5 · `bug-worked-days-estimate-silencioso` + `validacion-worked-days-vs-schedule` (FUSIÓN, **+gap de la crítica**) — **P2 · M** *(sube de P3 por el cruce con schedule)*
**Sin asistencia, `worked_days` para diarios se ESTIMA (6/7) sin marcar la estimación, ignora festivos, y NUNCA se contrasta contra el turno PROGRAMADO.**
- **Evidencia:** `payroll_service.py:615-620,165,217` (estimación silenciosa). `EmployeeSchedule` existe (`workforce.py:107`) pero `worked_days` nunca se valida contra el schedule esperado → empleado sin schedule o desfasado se paga sin alerta.
- **Acción:** flag de estimación en `notes`/`deduction_breakdown`; cruce `worked_days` vs `employee_schedules` con alerta si difieren; festivos desde F4.0.
- **Dependencias:** F4.0 (festivos). El cruce con schedule no depende de F4.0.

### F4.6 · `bug-monthly-prorate-30-vs-actual-days` — **P3 · S**
**Prorrateo mensual con umbral arbitrario `<28` crea salto no-monotónico.**
- **Evidencia:** `payroll_service.py:166-181`.
- **Acción:** política explícita base-30-días-fija: `base/30 * días_del_periodo` sin umbral. Tests febrero/31/parciales.
- **Dependencias:** ninguna.

### F4.7 · `data-employee-document-unique-no-active-scope` — **P3 · M**
**`document_id` unique global impide re-contratar a un retirado con la misma cédula.**
- **Evidencia:** `payroll.py:58`; soft-delete (`employee_service.py:156`).
- **Acción mínima (80%):** endpoint "reactivar empleado" (limpia `termination_date`, `is_active=true`). Completa: unique parcial `WHERE is_active=true` o `employment_periods`.
- **Dependencias:** ninguna.

### F4.9 · `feature-desprendible-export-nomina` — **P3 (producto, obligatorio legal) · M** *(NUEVO — de la crítica)*
**No hay desprendible de pago (colilla por empleado) — obligatorio entregárselo al trabajador en CO — ni export contable de la nómina.**
- **Acción:** endpoint que genere el desprendible por `PayrollItem` (PDF o estructura exportable: devengados, deducciones, neto, periodo) + export contable agregado de la nómina. Relevante para la meta de comercialización (memoria `business_expansion_plan`).
- **Dependencias:** se beneficia de F4.1/F4.2/F4.3 (para que el desprendible muestre conceptos completos) pero un MVP funciona con los conceptos actuales.

---

## FASE 5 — Self-service del empleado (vendedora) *(NUEVO EPIC — de la crítica)*

> El usuario primario más numeroso del sistema no tenía flujo propio; v1 lo trataba como notas P3 sueltas. Esta fase lo agrupa.

### F5.1 · `feature-me-self-permission` — **P1 · M**
**La vendedora no puede ver su propia ficha: `/me` exige `employees.manage`.**
- **Evidencia (verificada):** `employees.py:55` `GET /me` con `require_global_permission("employees.manage")`; `get_by_user_id` resuelve por `current_user.id`.
- **Acción:** cambiar `/me` a permiso `employees.self` (o auth simple del propio user, sin permiso de gestión), devolviendo una vista de ficha **sin PII de terceros** y con masking según F1.12. Coordinar con el epic de permisos (F1.7-1.9).
- **Dependencias:** epic de permisos.

### F5.2 · `feature-self-checklist-idor` — **P2 · M** *(absorbe `feature-self-checklist-not-enforced` de la tabla de limpieza)*
**`workforce.self_checklist` es permiso muerto; completar checklist exige `manage_checklists` (que SELLER no tiene) y NO valida ownership → IDOR potencial.**
- **Evidencia:** el permiso nunca se enforce; `manage_checklists` no valida `item→checklist.employee_id→employee.user_id`.
- **Acción:** endpoint self que valide ownership (`item.checklist.employee.user_id == current_user.id`) bajo `workforce.self_checklist`; o eliminar el permiso si se decide centralizar. Cierra el IDOR.
- **Dependencias:** epic de permisos.

### F5.3 · `feature-mis-deducciones-pre-liquidacion` — **P2 · M**
**La vendedora no puede ver sus faltas/deducciones antes de que se liquiden.**
- **Acción:** vista self "mis faltas/deducciones del periodo en curso" (read-only, scope propio), para transparencia previa a la nómina.
- **Dependencias:** F5.1 (auth self), F1.5 (faltas deducibles bien filtradas).

---

## FASE TRANSVERSAL — Testing / CI / Observabilidad

### F-T.1 · `ci-event-loop-fixture-conflict` — **P1 · M**
**`event_loop` fixture session-scoped colisiona con pytest-asyncio moderno → `pytest tests/` no corre limpio.**
- **Evidencia (verificada):** `conftest.py:39-44` define `event_loop` manual; `pytest.ini:6` `asyncio_mode=auto`. **Drift confirmado: `requirements*.txt` pinea `pytest-asyncio==0.23.8` pero el venv tiene `1.3.0`.** En 1.x el mecanismo es `asyncio_default_fixture_loop_scope`, ausente.
- **Acción:** agregar `asyncio_default_fixture_loop_scope = session` a `pytest.ini` y ELIMINAR el `event_loop` manual. **Decidir el drift** (sincronizar el pin a 1.3.0 o reinstalar 0.23.8). Validar `pytest tests/` completo en CI.
- **Dependencias:** ninguna. **Habilita** correr todo RRHH en un solo job.

### F-T.5 · `test-pay-route-cash-transaction-assert` — **🔴 P1 · M** *(REESCRITO de la crítica — antes solo verificaba `is_paid`, lo que blindaría el bug F1.0)*
**El único test del lado contable debe assertar que el pago crea la Transaction de caja, no solo `is_paid`.**
- **Evidencia:** v1 (`test-pay-route-no-side-effect-assert`) proponía assertar solo `expense.is_paid==True` — pasaría verde aunque la caja nunca se debite (institucionalizaría F1.0).
- **Acción:** tras `pay`, assertar que existe una **`Transaction` tipo EXPENSE por el monto neto con el `payment_method` correcto** ligada a `expense_id`, que el saldo de Caja/Banco bajó, y que el cuadre diario la refleja. Cubrir pago total y pago por item. `EXPENSE_CATEGORY_SEED` ya sembrado en conftest.
- **Dependencias:** **depende de F1.0**. Es la red que caza el descuadre contable.

### F-T.2 · `test-permission-gating-untested` — **P1 · M**
**La autorización por permiso está 100% sin probar (todo corre como superuser).**
- **Acción:** fixtures `user_with_permission`/`user_without_permission` (reusar `qa_user`); por endpoint financiero crítico, test parametrizado con permiso→200/201, sin permiso→403. Mínimo approve y pay. **Incluir test de la escalada lateral (F1.9):** ADMIN de sede menor → 403 en nómina global.
- **Dependencias:** se beneficia del epic de permisos.

### F-T.3 · `test-performance-service-zero-coverage` — **P1 · M**
**`PerformanceService` (donde se corrigió el bug de score) sin NI un test.**
- **Acción:** unit: empleado con asistencia/puntualidad/checklist=100 y SIN ventas → `overall_score==100` (no 80); Decimal puro. Ruta mockeando el service (patrón `test_workforce_shifts_routes.py`) + 403.
- **Dependencias:** se beneficia de F2.3.

### F-T.4 · `test-double-liquidacion-guard-missing` — **P1 · M**
**No hay test del guard de doble deducción entre nóminas solapadas (el método se mockea).**
- **Evidencia:** `test_payroll_service_deep.py:295,320` mockean `get_deductible_absences`.
- **Acción:** integración (db real): falta deducible en run A, run B solapado verifica deducción única.
- **Dependencias:** **depende de F1.5**.

### F-T.4b · `test-doble-pago-concurrente-nomina` — **P1 · M** *(NUEVO — par de F1.3b)*
**No hay test de doble-pago concurrente.**
- **Acción:** integración: dos `pay_payroll_item` concurrentes/secuenciales sobre el mismo item → una sola Transaction de caja, segundo intento → 409/`ValueError`.
- **Dependencias:** **depende de F1.3b + F1.0**.

### F-T.6 · `test-attendance-pagination-real` — **P2 · M**
**Tests de paginación workforce mockean el service y no ejercen la paginación falsa.**
- **Evidencia:** `test_workforce_attendance_routes.py:73-88` (mock 3 records → total==3). **CORRECCIÓN OBLIGATORIA:** la referencia `workforce_shifts.py` es FALSA (también fake). Referencia real: `payroll.py:68-76`.
- **Acción:** integración (db real): sembrar N>limit; verificar `items==limit`, `total==N`, `skip` avanza.
- **Dependencias:** acompaña F2.4.

### F-T.7 · `test-admin-portal-no-service-tests` — **P2 · M**
**Admin-portal sin tests de servicios.** **CORRECCIÓN:** vitest YA está configurado (`vitest.config.ts`).
- **Acción:** `payrollService.test.ts` (+ employee/workforce): test de que `list()` desempaqueta `PaginatedResponse` (regresión de F1.1q) y de `fixed_expense_integration`. **Si F3.0 ya extrajo el cliente compartido, el test va sobre el paquete (una vez), no por cliente.**
- **Dependencias:** F1.1q; se simplifica con F3.0.

### F-T.8 · `test-false-positive-status-filters` — **P2 · S**
**Tests de filtros con vacuous-truth + paginación sin validar metadata.**
- **Acción:** sembrar un incluido + un excluido, assertar ambos + `len(items)>=1`; assertar `total/skip/limit`.
- **Dependencias:** ninguna.

### F-T.9 · `test-formatperiodrange-tz-regression-weak` + `test-create-payroll-route-no-employee-seed-flake` (FUSIÓN) — **P3 · S**
**Tests débiles: `formatPeriodRange` no ancla el día; create no ancla employee_count.**
- **Acción:** assertar `'1 abr'`/`'15 abr'` exactos + borde `'2026-03-31'..'2026-04-01'` (Tauri y admin). En create: GET `/{id}`, assertar `employee_count==1` + item de `test_employee.id`.
- **Dependencias:** ninguna.

> **🧩 INFRA COMPARTIDA DE FIXTURES DE AUTHZ** *(redundancia agrupada de la crítica):* **F-T.2 y F-T.3** (y F-T.4b/F-T.5 en parte) requieren los mismos fixtures `user_with_permission`/`user_without_permission`. Crear ese fixture **una sola vez** (reusar `qa_user`) en un PR de infraestructura, no reconstruirlo por test.

---

## Items de menor prioridad (limpieza, agrupados)

| ID | Severidad | Esfuerzo | Acción |
|---|---|---|---|
| `tech-debt-manual-dict-response-get-run` | P2 · S | Devolver el ORM en `get_payroll_run` (ya tiene selectinload, `routes/payroll.py:98-138`) y exponer `employee_payment_frequency` (hoy siempre null, bug latente de contrato) vía property/validator. |
| `tech-debt-summary-schema-divergente` | P3 · S | `get_payroll_summary` computa `fixed_expense_integration` (`:707`) que `PayrollSummary` (`schemas/payroll.py:394-400`) descarta. Agregar al schema (lo espera el Tauri) o eliminar el cómputo muerto. |
| `bug-float-en-breakdown-decimal` | P3 · S | Persistir amounts del breakdown como string/centavos en vez de `float()` (`payroll_service.py:200-202`, `employee_service.py:296-307`). Viola Decimal-para-dinero; los totales ya son Decimal. |
| `authz-responsibilities-wrong-permission` | P3 · S | Introducir `workforce.view_responsibilities`/`manage_responsibilities` y reemplazar los 6 usos de `view_shifts`/`manage_shifts` en `workforce_responsibilities.py`. |
| `ratelimit-payroll-pii-endpoints` | P3 · M | Rate limiting (infra slowapi YA existe: `core/limiter.py`, usada en `payments.py`/`auth.py`) a GET de PII/salarios para mitigar scraping por insiders. |

> **Nota:** `feature-self-checklist-not-enforced` (antes en esta tabla como P3) fue **promovido a F5.2** (con su IDOR) dentro del epic self-service.

---

## Sobre los gaps de la crítica — qué se incorporó y qué no

**Incorporados como items nuevos:** F1.0 (caja-pago, P0), F1.3b + F-T.4b (concurrencia de pago), F-T.5 reescrito (Transaction de caja), F3.0 (paquete compartido), F4.0 (parámetros legales), F4.8 (finiquito), F4.9 (desprendible/export), F4.5 ampliado (cruce worked_days↔schedule), Fase 5 completa (self-service vendedora). Recalibraciones: F1.9 P2→P1, F3.6 P3→P2, F4.5 P3→P2, F-T.5 P2→P1. Esfuerzo agregado del epic de permisos marcado XL con plan de migración de roles en prod.

**No aplica / matizado:** ninguno de los gaps resultó inválido — todos los verificables se confirmaron en código (caja, concurrencia, `/me`, `EmployeeSchedule`, drift de pytest-asyncio). El único matiz: el "doble conteo en el heatmap" de la confirmación approve/pay se resolvió **no recontándolo** en la fila de Security (se cuenta solo en UX como P1), y se anotó explícitamente.

---

## Secuencia recomendada (orden por dependencias)

```
SPRINT A — Estabilización contable inmediata (Fase 1, núcleo P0)
  1. F1.0   integración de caja en pago de nómina (+payment_method, +Transaction, +Telegram)  [P0·M] ← descuadre contable global
  2. F1.3b  guard de concurrencia en pago (FOR UPDATE) envolviendo F1.0                        [P1·M]
  3. F1.1q  unwrap paginación admin-portal                                                      [P0·S] ← desbloquea F3.x, F-T.7
  4. F1.2q  approve N+1 → 0                                                                     [P1·S]
  5. F1.3q  logging estructurado approve/pay/cancel (comparte current_user con F1.0)           [P1·S]
  6. F1.4q  confirmación approve/pay mostrando monto+cuenta (ambas apps)                        [P1·S]
  7. F-T.1  arreglar event loop CI + decidir drift pytest-asyncio                               [P1·M] ← CI single-pass
  8. F-T.5  test de Transaction de caja (depende de F1.0) + F-T.4b doble-pago (dep. F1.3b)      [P1·M]

SPRINT B — Correctitud monetaria & autorización (Fase 1)
  9. F1.5   migración payroll_item_id + filtro doble-deducción + DAILY (3 sub-fixes)            [P1·L]
 10. F1.6   idempotencia de periodo (guard + unique) + validación UI                            [P1·M]
 11. F-T.4  test doble-liquidación (depende de F1.5)                                            [P1·M]
 12. EPIC PERMISOS (F1.7+F1.8+F1.9)  view/manage + is_global + approve/pay + plan migración prod [XL]
 13. F-T.2  test de gating + escalada lateral (depende del epic permisos)                       [P1·M]
 14. F1.10  IntegrityError → 409 (attendance/checklists/schedules; pagos ya en F1.3b)           [P2·M]
 15. F1.11  audit trail (updated_by/paid_by/employee_change_log)                                [P2·L]
 16. F1.13  alinear modelo→DB RESTRICT (quick-fix S) + migración hermanos (M)                   [P2·S→M]

SPRINT C — Self-service del empleado (Fase 5) + Performance (Fase 2)
 17. F5.1   /me con employees.self (depende epic permisos) + F1.12 masking PII                  [P1·M]
 18. F5.2   self-checklist + cierre IDOR                                                        [P2·M]
 19. F5.3   mis deducciones pre-liquidación (dep. F5.1 + F1.5)                                  [P2·M]
 20. F2.1   refactor calculate_employee_totals + N+1 create_payroll (coord. F1.5)              [P1·M] ← compartido con F2.2
 21. F2.2   N+1 payroll_summary (reusa refactor)                                               [P2·S]
 22. F2.3   N+1 performance_summary + dedup query attendance                                    [P1·L]
 23. F-T.3  test PerformanceService (se beneficia de F2.3)                                      [P1·M]
 24. F2.4   paginación SQL real workforce (ref: payroll.py:68-76)                               [P1·L]
 25. F-T.6  test paginación real (acompaña F2.4)                                                [P2·M]
 26. EPIC modelo↔DB: F1.13-quickfix + F2.6 + F2.7 + F2.5 → criterio: alembic check limpio       [P2/P3]
 27. F2.8   cache Redis dashboards (DESPUÉS de F1.0, F2.2, F2.3)                                [P3·M]

SPRINT D — UX & frontend (Fase 3)
 28. F3.0   extraer paquete compartido @ucr/payroll-client (dep. F1.1q)                         [P1·L] ← arregla el fork de raíz
 29. F3.1   descomponer mega-componente admin (dep. F1.1q + F3.0)                               [P1·L]
 30. F3.2   banners de error + reintentar workforce                                             [P1·M]
 31. F3.4   bulk reviews + feedback veraz                                                       [P1·M]
 32. F3.6   paginación UI (priorizar asistencia) + virtualización (dep. F1.1q/F2.4)             [P2·L]
 33. F3.3   CurrencyInput en deducción                                                          [P2·S]
 34. F3.5   selector empleados + preview admin (dep. F3.1 + F3.0)                               [P2·M]
 35. F3.7   toasts/modal vs alert nativo                                                        [P2·M]
 36. F3.8   memoizar formularios (medir antes)                                                  [P3·M]

SPRINT E — Limpieza + tests pendientes (transversal)
 37. F-T.7 (sobre el paquete F3.0), F-T.8, F-T.9 — endurecer la suite
 38. Items de menor prioridad (tabla): dict-response, summary-schema, float-breakdown,
     responsibilities-permission, rate-limit

FASE 4 — Producto (planificación separada; F4.0 desbloquea el resto)
 39. F4.0  parámetros legales por año (SMMLV/UVT/IBC/festivos) [L]  ← PRECONDICIÓN de todo Fase 4
 40. F4.1  prestaciones (adelantar provisión mensual: afecta P&L hoy) [XL]
       → F4.2 seguridad social IBC [L]  → F4.3 horas extra/recargos/retefuente [XL]
 41. F4.8  liquidación definitiva/finiquito (dep. F4.0+F4.1+F1.0) [L]
 42. F4.9  desprendible de pago + export contable [M]
 43. F4.4 reversibilidad (revierte caja de F1.0) [M], F4.5 worked_days+schedule [M],
     F4.6 prorrateo base-30 [S], F4.7 re-contratación [M]
```

**Hitos de cierre verificables:**
- **Fin Sprint A:** pagar la nómina **debita Caja/Banco y crea una `Transaction` EXPENSE** (test verde); el cuadre diario refleja el desembolso; las 5 vistas del admin-portal cargan datos reales; `pytest tests/` corre verde en un solo job.
- **Fin Sprint B:** una falta se descuenta exactamente una vez (test de integración verde); imposible crear dos runs del mismo periodo; **un ADMIN de sede ya no controla la nómina global** y existe rol "solo-consulta"; ningún usuario en prod pierde acceso legítimo tras la migración de roles.
- **Fin Sprint C:** la vendedora puede ver su ficha, su checklist (sin IDOR) y sus deducciones; crear nómina a 100 empleados ejecuta ≤4 queries (no ~600); ningún endpoint workforce carga la tabla completa.
- **Fin Sprint D:** la lógica de nómina vive en **un solo paquete compartido**; paridad funcional Tauri↔admin-portal; sin `console.error` silenciosos ni `window.alert` nativos.
- **Fin Fase 4:** existe la tabla de parámetros legales por año; la provisión de prestaciones corrige el sesgo del ~20% en el P&L; hay flujo de finiquito y desprendible de pago.