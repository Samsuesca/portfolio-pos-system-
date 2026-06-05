# Plan de Migración Híbrida — Reclasificación de gastos históricos

> **Última actualización:** 2026-05-02
> **Objetivo:** reclasificar correctamente los gastos históricos (categorías `mercado`, `ocio`, `comida`, `viaticos`, `prestamos`, `deuda`) según naturaleza real, manteniendo trazabilidad completa.

---

Documento de reclasificacion de gastos historicos.


## Lógica de reclasificación

| Categoría origen | Reclasificación destino | Criterio |
|------------------|------------------------|----------|
| `mercado` (alimentos para empleados como compensación) | `payroll_in_kind` | Si era para Felipe, Salomé, Santiago como pago de trabajo |
| `mercado` (alimentos para hogar de Consuelo) | `owner_drawings` | Si era para uso personal del propietario |
| `ocio` (entretenimiento empleados) | `payroll_in_kind` | Idem |
| `ocio` (uso personal del propietario) | `owner_drawings` | Idem |
| `comida` (todos los casos típicos) | `payroll_in_kind` o `owner_drawings` | Revisar caso a caso |
| `viaticos` (viajes laborales) | `transport` | Si fue para gestiones del negocio |
| `viaticos` (uso personal) | `owner_drawings` | Idem |
| `deuda` (pago de capital) | NO es expense, es asiento de balance | Reducir pasivo, eliminar el expense |
| `deuda` (pago de intereses) | `intereses_financieros` (categoría nueva) | Va al P&L |
| `prestamos` (tarjetas personales) | `owner_drawings` | No es del negocio |
| `prestamos` (adelantos a empleados) | `accounts_receivable` (cuenta por cobrar a empleado) | NO es expense |
| `prestamos` (compras varias del negocio) | reclasificar al destino correcto | `supplies`, `transport`, etc. |

---

## Categorías nuevas a agregar

```python
# backend/app/models/accounting.py - ExpenseCategory enum
class ExpenseCategory(str, enum.Enum):
    # ... existing
    PAYROLL_IN_KIND = "payroll_in_kind"           # Compensación en especie (histórico pre-formalización)
    OWNER_DRAWINGS = "owner_drawings"              # Retiros del propietario para uso personal
    INTERESES_FINANCIEROS = "intereses_financieros"  # Intereses sobre préstamos
```

---

## Tabla de mapping (auditoría completa)

```sql
CREATE TABLE expense_reclassification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id),
    old_category VARCHAR(50) NOT NULL,
    old_amount NUMERIC(14,2) NOT NULL,
    new_category VARCHAR(50) NOT NULL,
    new_amount NUMERIC(14,2),                     -- puede dividirse en split
    action VARCHAR(20) NOT NULL,                  -- 'reclassify', 'delete_to_balance', 'split'
    reason TEXT,
    reclassified_by UUID REFERENCES users(id),
    reclassified_at TIMESTAMP NOT NULL,
    -- Si action = 'delete_to_balance' (caso pago de capital):
    affected_liability_id UUID REFERENCES balance_accounts(id),
    capital_amount NUMERIC(14,2),
    interest_amount NUMERIC(14,2)
);
```

---

## Proceso por fases

### Fase 1 — Categorías nuevas + migración de DB (1 día dev)

1. Migración Alembic: agregar 3 valores al enum `ExpenseCategory`.
2. Crear tabla `expense_reclassification_log`.
3. Crear endpoint admin: `POST /global/accounting/expenses/{id}/reclassify` que:
   - Crea entry en `expense_reclassification_log`.
   - Actualiza `expenses.category`.
   - Si action == `delete_to_balance`: borra el expense + crea asiento de reducción de pasivo.
4. Endpoint de undo: `POST /global/accounting/expenses/reclassification-log/{id}/revert`.

### Fase 2 — Reclasificación batch (1-2 semanas owner + asesor)

Pre-procesamiento automático (lo que el script puede inferir):

```sql
-- Cualquier `mercado`, `ocio`, `comida` con descripción claramente personal
-- (palabras clave: "casa", "perro", "queso", "carne", "pan", etc.)
-- → marcar como sugerencia owner_drawings

-- Cualquier `prestamos` con descripción "pago tarjeta", "tarjeta de samuel"
-- → marcar como sugerencia owner_drawings

-- Cualquier `deuda` con descripción "intereses"
-- → marcar como sugerencia intereses_financieros + valor sale del P&L OK

-- Resto: requieren revisión manual
```

UI de revisión (frontend opcional, o usar SQL directo): vista de todos los expenses con candidatos pre-clasificados, owner aprueba/cambia, click "aplicar".

### Fase 3 — Reclasificación manual de casos ambiguos (~1 semana)

Owner revisa expense por expense los casos sin sugerencia automática. Decide:
- ¿Es `payroll_in_kind` o `owner_drawings`?
- ¿Es `deuda` capital o interés? ¿Cuánto de cada uno?

Cada decisión queda registrada con su `reason` en el log.

### Fase 4 — Generar reportes "antes vs después" (1 día)

Script que:
- Genera P&L pre-migración (estado actual).
- Genera P&L post-migración (con reclasificaciones).
- Comparativo lado a lado con explicación de cada cambio.
- Genera el balance final que será el "balance de apertura formal" para el contador eventual.

---

## Implicaciones para el modelo financiero

**Pre-v3 (histórico 2023-2026):**
- `payroll` agregado: incluye `payroll` formal + `payroll_in_kind` reclasificado.
- `owner_drawings`: NO va al P&L. Va contra patrimonio (cuenta de equity "Retiros propietario").
- `intereses_financieros`: va al P&L bajo "Gastos financieros".
- Pagos de capital de préstamos: NO van al P&L. Reducen pasivo en balance.

**Post-v3 (mayo 2026 en adelante):**
- Cero `mercado`, `ocio`, `comida`, `viaticos` en gastos del negocio.
- Personal recibe salario formal + auxilios contractuales.
- Cada quien gestiona sus gastos personales con su salario.
- Préstamos se registran correctamente vía `mark_debt_as_paid` (tras fix del bug).

---

## Implicación para el ProjectionService

El service debe:
- **Para período histórico:** usar EEFF reclasificados (post-migración).
- **Para proyección futura:** usar el modelo limpio (sin `mercado`/`ocio` en negocio, todo `payroll` formal).
- Las assumptions de `payroll_monthly` deben reflejar la realidad post-formalización (5-7 personas × SMMLV × 1.30 aportes = ~$10M-$15M/mes).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Owner clasifica mal por subjetividad | Cada decisión queda en log con razón; si después se corrige, se hace undo y nuevo asiento. |
| DIAN cuestiona la reclasificación | El log es evidencia de proceso. Acompañado de contratos de empleados post-formalización, defendible. |
| Sanción por gastos personales reclasificados como `payroll_in_kind` sin aportes | Solución: cuando se haga el plan de regularización UGPP, declarar la base de cotización histórica = SMMLV × meses × empleados sin afiliar. Pago retroactivo + sanción reducida. |
| Complejidad de reclasificar caso a caso | Procesamiento automático cubre ~70% (palabras clave). Solo el 30% restante requiere revisión manual. |
