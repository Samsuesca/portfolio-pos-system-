# QA Brief — Uniformes Consuelo Ríos (post-stabilization sprint)

**Fecha:** 2026-05-04
**Branch:** `chore/stabilization-sprint-2026-Q2` (10 commits ahead de `main`)
**Para:** External tester / Claude Chrome Extension
**Lenguaje del producto:** Español

## Contexto

Sistema de gestión de uniformes escolares para una empresa colombiana. Acabamos de cerrar un sprint de estabilización contable: 5 bugs catalogados arreglados + 1 deuda de seed + 1 reclasificación de tests stale. Necesito que un tester externo valide que la app sigue funcionando bien para el usuario final, especialmente en los flujos donde tocamos código.

**Importante:** Estás testeando data REAL fresh de producción cargada en dev. Hay 1,537 ventas, 306 órdenes, 169 alterations, 464 expenses, 1,969 balance_entries, 190 receivables, 97 vendors, 11 colegios.

## Acceso

- URL: el tester debe levantar `npm run tauri:dev` (o equivalent del frontend) y `localhost:8001` ya está corriendo el backend
- **Credenciales (relleno manual del tester):** `Samuel` / `Samuel2741` (superuser)

## Áreas que tocamos en este sprint — focal points

### 1. Permisos (Bug C)

Antes faltaban 5 codes en la DB (`catalog.view`, `catalog.manage`, `costs.manage_templates`, `employees.manage`, `payroll.manage`).

**Verificar:**
- Login con Samuel funciona ✅
- Las pantallas de Catálogo, Gestión de empleados, Nómina, Costos abren sin errores 403/404
- En Settings → Roles, los 5 codes aparecen como asignables

### 2. Contabilidad — Cuentas y balances (Bug 1, Bug 3)

**Bug 1 fix:** Cualquier ajuste de balance (initialize-accounts, set-balance) ahora SIEMPRE genera una `BalanceEntry` compensatoria con el delta exacto. Antes mutaban silenciosamente.

**Bug 3 fix:** No se puede archivar una cuenta de balance con saldo != 0.

**Verificar:**
- Ir a Contabilidad → Cuentas de balance
- Listar cuentas: deben aparecer Caja Menor ($197K aprox), Caja Mayor ($8.9M), Nequi ($282K), Banco ($3M)
- Click en Caja Menor → ver entradas recientes. La más reciente del 2026-05-04 debe decir algo como "Ajuste de balance inicial (de $X a $Y)" con `amount` igual al delta
- Intentar archivar una cuenta con saldo != 0 → debe mostrar error 400 con mensaje en español: "No se puede archivar 'X' porque su saldo es $Y. Liquide la cuenta o reasigne..."
- Intentar archivar Caja (1101) → bloqueo previo "No se puede eliminar la cuenta de Caja o Banco"

### 3. Pago de deudas programadas (Bug 2)

**Bug 2 fix:** Cuando se marca una deuda como pagada, ahora:
1. Reduce caja/banco con BalanceEntry (-paid_amount)
2. Reduce el pasivo asociado con BalanceEntry (-capital_amount)
3. Crea un Expense con categoría `intereses_financieros` por el monto de interés (si se especifica)

**Verificar (NO ejecutar pago real, solo abrir la UI):**
- Ir a Contabilidad → Planificación → Calendario de deudas
- Abrir el modal de "Marcar como pagado"
- Verificar que existen los campos opcionales `capital_amount` e `interest_amount` (si la UI ya los expone — puede ser pendiente de UI work)
- Si los campos no están en UI todavía, el endpoint backend acepta `null` y trata todo como capital (compat). Reportar si la UI no expone los nuevos campos.

### 4. Cuentas por cobrar / due_date (Bug 4)

**Bug 4 fix:** Toda AR ahora tiene `due_date` NOT NULL. Backfill de 163 filas con fecha = `invoice_date + 30 días`.

**Verificar:**
- Ir a Contabilidad → Cuentas por cobrar
- Toda fila debe mostrar fecha de vencimiento
- Verificar que la columna no muestra "—" o vacío en ninguna fila
- Crear nueva CxC sin especificar fecha de vencimiento → backend la pondrá automáticamente en `invoice_date + 30 días`

### 5. Categorías de gastos (Bug 5)

**Bug 5 fix:** `expenses.category` ahora tiene FK a `expense_categories.code`. Imposible crear gastos con categorías inexistentes.

**Verificar:**
- Ir a Gastos → Crear gasto
- El selector de categorías debe mostrar 26 opciones, incluyendo las 3 nuevas: `payroll_in_kind`, `owner_drawings`, `intereses_financieros`
- Intentar crear un gasto via API con `category="categoria_inventada"` → debería fallar con 400/422 mencionando FK

## Smoke test general (15 min)

1. **Login** con Samuel/Samuel2741
2. **Dashboard** carga con stats reales
3. **Productos** lista paginada, total=60 para el primer colegio
4. **Inventario** lista, low-stock filter
5. **Ventas** lista paginada, total=836 ventas
6. **Pedidos** lista paginada, total=143
7. **Clientes** lista paginada
8. **Contabilidad → Estado de resultados** (P&L) con dates 2026-01-01 a 2026-05-04 → debe retornar 200 con keys `gross_revenue`, `net_revenue`, `cost_of_goods_sold`, etc.
9. **Notificaciones** badge funciona
10. **Logout**

## Things to stress (10 min)

- **Refresh mid-flow** en formularios: estado preservado o lost?
- **Doble click** en "Crear" / "Guardar": una operación o dos?
- **Tab switch** mid-form: estado conservado?
- **Window resize** a 375px (mobile): la app sigue usable o overflow?
- **Volver atrás** con browser después de un submit: re-submit o navegación limpia?

## Reportar issues con este formato

Para cada issue:
- **Where:** Página/módulo
- **What:** Pasos para reproducir
- **Expected:** Qué debería pasar
- **Actual:** Qué pasó
- **Severity:** Critical / Major / Minor / Cosmetic
- **Screenshot:** (opcional pero útil)

## Issues conocidos al iniciar el sprint (resueltos por mí, NO reportar como nuevos)

- ~~AR sin due_date (163 filas)~~ → backfilled
- ~~Pasivos archivados con saldo > 0 ($77.89M)~~ → política endpoint cerrada (data histórica pendiente reconciliación equity manual, separado)
- ~~mark_debt_as_paid sin asientos~~ → ahora postea entries
- ~~set_balance sin entry compensatoria~~ → ahora SIEMPRE genera entry
- ~~expenses.category sin FK~~ → FK + UNIQUE constraint
- ~~5 permission codes faltantes~~ → seeded vía migración

## Issues YA detectados internamente (referencia, NO duplicar)

- **P2 — AUTH-02 mensaje en inglés:** `POST /auth/login` con password incorrecto retorna `"Incorrect username or password"` en inglés. Per regla del proyecto debería estar en español.
- **P2 — AUTH-06 status code:** `GET /auth/me` sin token retorna 403 Forbidden. Debería ser 401 Unauthorized según semántica HTTP.
