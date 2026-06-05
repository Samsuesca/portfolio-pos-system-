# Modelo de Negocio B2B — Contratos y Cotizaciones

> **Version:** 1.0
> **Fecha:** 2026-05-22
> **Estado:** Documentado para scope. Implementacion **post-estabilizacion v3.0.0 en prod**.
> **Naturaleza:** Documento estrategico + diseno tecnico. NO es trabajo de codigo en curso — es la formalizacion del tercer pilar de negocio de UCR para anclarlo en el Modelo Financiero (MF) y el roadmap v3.
> **Prerequisito de negocio:** Facturacion Electronica DIAN operativa (ver `formalization/02-tributario.md` Gap 2.0). Sin FE, el B2B esta bloqueado comercialmente.

---

## Por que este documento existe

La narrativa de v3 hasta ahora trataba el crecimiento de UCR en dos pilares:

1. **Sucursales nuevas** (expansion fisica — v3.1, ~jun 2026).
2. **Comercializacion del software** (SaaS/self-hosted — v3.2, ~oct 2026).

Falta el pilar que, en la lectura del owner, **generara el flujo real de caja mes a mes**: la venta **B2B por contratos y cotizaciones** a otros negocios — uniformes empresariales, dotacion de equipos, ropa para eventos, y similares. Hoy aparece disperso y subvalorado:

- En `formalization/06-comercial.md` figura como **Gap 6.6 / 6.7** (un "pendiente contractual"), no como linea de negocio.
- En `formalization/financial-impact.md` aparece solo como "Cotizacion B2B en curso: Restaurante, ~$9.000.000 (un solo contrato)".
- En el modelo financiero (`financial-model-design.md`) **no existe** como stream de ingresos: el motor de proyeccion solo modela retail escolar (estudiantes x penetracion x ticket) + SaaS.

Este documento corrige eso. Eleva el B2B a **canal de primera clase** con su propio modelo de negocio, modelo de datos, flujo operativo, tratamiento contable/tributario, y entrada explicita en el motor de proyecciones financieras.

---

## Tesis estrategica: por que el B2B es el flujo real

El negocio escolar de UCR tiene un problema estructural de **estacionalidad extrema**:

| Temporada | Meses | Multiplicador de demanda (escolar) |
|-----------|-------|-------------------------------------|
| Alta | Enero–Febrero (vuelta a clases) | 2.5x – 1.8x |
| Media | Julio–Agosto (reposicion mitad de ano) | 1.2x – 0.8x |
| Baja | Abril–Junio, Sept–Nov | 0.3x – 0.5x |

Esto significa que **6–7 meses del ano** el negocio escolar opera muy por debajo de su capacidad instalada (taller, maquinas, equipo de costura, vendedoras). Los costos fijos (arriendo, nomina, servicios) corren los 12 meses; los ingresos escolares se concentran en 4.

El **B2B contractual rompe esa estacionalidad**:

- Los contratos empresariales/eventos **no siguen el calendario escolar**. Un restaurante renueva dotacion cuando rota personal; una empresa cumple la dotacion legal del Art. 230 CST cada 4 meses (abr 30, ago 31, dic 20); un evento ocurre cuando ocurre.
- Permite **cargar el taller en los valles** de la temporada escolar — uso eficiente de capacidad ociosa.
- El **ticket es mucho mayor** (un contrato = $5M–$30M+) con costo de adquisicion bajo (relacion directa, no marketing masivo).
- Genera **recurrencia contractual** (dotacion periodica, renovaciones), que es justamente lo que da predictibilidad al flujo de caja — el santo grial del Modelo Financiero.

> **Lectura del owner (formalizada aqui):** el retail escolar es el **piso** del negocio (volumen, marca, relacion con colegios). El B2B contractual es el **motor de crecimiento y de caja estable**. La SaaS (v3.2) es la **apuesta de escala** de mayor plazo y riesgo. Los tres conviven; el B2B es el que paga las cuentas entre temporadas escolares.

---

## Segmentos B2B

UCR ya tiene la capacidad productiva (corte, confeccion, bordado, estampado, reventa de mercancia). El B2B reempaqueta esa capacidad para clientes-empresa. Segmentos objetivo:

| Segmento | Producto tipico | Disparador de compra | Recurrencia | Ticket referencia |
|----------|-----------------|----------------------|-------------|-------------------|
| **Restaurantes / hoteleria** | Delantales, filipinas (chef), camisas de mesero, gorros, polos | Apertura, rotacion de personal, renovacion de imagen | Media (renovacion 1–2x/ano) | $3M–$12M |
| **Empresas (dotacion legal)** | Camibusos/polos corporativos, camisas oxford, overoles, batas | Dotacion Art. 230 CST (3 entregas/ano para empleados ≤ 2 SMMLV) | **Alta — legalmente obligatoria 3x/ano** | $5M–$30M |
| **Equipos deportivos** | Camisetas de juego, pantalonetas, sudaderas, medias, calentadores | Inicio de torneo, patrocinios, escuelas de formacion | Media-estacional (por torneo) | $2M–$10M |
| **Eventos / activaciones** | Camisetas de carrera/maraton, polos de staff, ropa de marca para activacion BTL, conferencias | Fecha del evento (one-shot) | Baja (one-shot, pero alto volumen puntual) | $3M–$25M |
| **Instituciones / programas sociales** | Uniformes y kits para fundaciones, alcaldias, cajas de compensacion | Licitacion / convenio / orden de compra publica | Media (anual por convenio) | $10M–$100M+ |

> **Nota sobre el segmento institucional/publico:** las licitaciones publicas exigen requisitos adicionales (RUP, paz y salvo parafiscales, EEFF firmados, polizas de cumplimiento). Esto **depende de la SAS y de la formalizacion completa** (ver `formalization/01-legal-corporativo.md` y `03-contable.md`). Es el segmento de mayor ticket pero mayor barrera de entrada — apuntar a el solo despues de constituir la SAS.

### Diferencias estructurales B2C escolar vs B2B contractual

| Dimension | B2C escolar (retail) | B2B contractual |
|-----------|----------------------|-----------------|
| Volumen por transaccion | Bajo (1 estudiante, 2-4 prendas) | Alto (decenas a cientos de prendas) |
| Ticket | $80k–$120k | $2M–$100M+ |
| Modelo de produccion | Stock + encargo puntual | **Made-to-order** (lote completo bajo pedido) |
| Personalizacion | Talla, color de colegio | **Logo bordado/estampado, telas, colores corporativos, tallajes mixtos** |
| Lead time | 1–10 dias | 2–8 semanas (diseno + muestra + produccion en lote) |
| Pago | Contado / contraentrega | **Anticipo (30–50%) + saldo contra entrega**, a veces credito 30–60 dias |
| Soporte documental | Factura/recibo | **Cotizacion formal + contrato/orden de compra + FE** |
| IVA | Uniforme escolar **excluido** (Art. 424 ET) | **Generalmente gravado** — dotacion corporativa no es uniforme escolar |
| Estacionalidad | Calendario escolar (extrema) | **Contracalendario** (suaviza el flujo) |
| Riesgo | Bajo (volumen distribuido) | Concentrado (pocos clientes grandes — riesgo de cartera) |

> **Implicacion tributaria critica:** el uniforme escolar esta **excluido de IVA** (Art. 424 ET), pero la **dotacion corporativa y la ropa de eventos NO lo estan**. Al entrar al B2B, UCR muy probablemente **cruza el umbral de responsable de IVA** (Art. 437 par. 3 ET: ingresos o contratos ≥ 3.500 UVT). Esto debe validarse con el contador **antes** de cerrar contratos grandes. Ver `formalization/02-tributario.md` Resp. 49.

---

## Flujo operativo del contrato B2B

El ciclo de vida de una operacion B2B es fundamentalmente distinto al de una venta de mostrador. Tiene **estados** que hoy el sistema no modela:

```
  LEAD                COTIZACION              CONTRATO              PRODUCCION            ENTREGA            COBRO
  ────                ──────────              ────────              ──────────            ───────            ─────
  Contacto    →    Cotizacion formal    →   Aceptacion +     →   Diseno + muestra  →   Entrega por   →   Anticipo +
  inicial          (numero, vigencia,       anticipo             aprobada +            hitos o            saldo +
  (whatsapp,       items, condiciones)      (contrato/OC         lote en             entrega total       FE emitida
  referido,                                  firmada)            produccion
  licitacion)
```

### Estados de la cotizacion

| Estado | Significado |
|--------|-------------|
| `draft` | En elaboracion interna |
| `sent` | Enviada al cliente, con numero y fecha de vigencia |
| `negotiation` | Cliente pidio ajustes (precio, cantidades, plazos) |
| `accepted` | Cliente acepto — se convierte en contrato/orden |
| `rejected` | Cliente declino |
| `expired` | Vencio la vigencia sin respuesta |

### Estados del contrato

| Estado | Significado | Asiento contable asociado |
|--------|-------------|---------------------------|
| `pending_deposit` | Aceptado, esperando anticipo | — |
| `in_production` | Anticipo recibido, en produccion | Anticipo → ingreso diferido (pasivo) + entrada de caja |
| `partial_delivery` | Entrega parcial por hitos | Reconocimiento parcial de ingreso + COGS del lote |
| `delivered` | Entregado completo | Reconocimiento total ingreso + COGS + FE |
| `closed` | Saldo cobrado, cerrado | Cancelacion de CxC, cierre |
| `cancelled` | Cancelado (con politica de retencion de anticipo segun contrato) | Reversa segun clausula |

> **Diferencia contable clave vs retail:** en retail el ingreso se reconoce al instante (venta = entrega = pago). En B2B con anticipo, el **anticipo es un pasivo (ingreso diferido)** hasta que se entrega el producto. El reconocimiento de ingreso ocurre **contra entrega** (o por hitos en contratos grandes). Esto importa para que el P&L no infle ingresos por anticipos de contratos aun no ejecutados. Ver tratamiento en seccion "Integracion con el Modelo Financiero".

---

## Modelo de datos propuesto (diseno, NO implementar aun)

> **Importante:** este es un **diseno para scope**. No se implementa hasta despues de estabilizar v3.0.0. El objetivo es que el modelo este pensado para que, cuando se construya, encaje limpio con `branches` (v3.1) y el modelo financiero (v3.2).

### Nuevas tablas

```sql
-- Cliente B2B (empresa, no consumidor final)
-- Distinto de `clients` (B2C). Un B2B client tiene NIT, contacto comercial, condiciones de credito.
CREATE TABLE b2b_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),        -- sucursal que atiende (NULL = central/corporativo)
    legal_name VARCHAR(250) NOT NULL,              -- razon social
    trade_name VARCHAR(250),                       -- nombre comercial
    tax_id VARCHAR(50) NOT NULL,                   -- NIT (para FE)
    segment VARCHAR(50) NOT NULL,                  -- restaurant | corporate | sports | event | institutional
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    billing_address TEXT,
    credit_limit NUMERIC(14,2) DEFAULT 0,          -- 0 = solo contado/anticipo
    payment_terms_days INT DEFAULT 0,              -- 0 = contraentrega; 30/60 = credito
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Cotizacion formal (numerada, con vigencia)
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    b2b_client_id UUID NOT NULL REFERENCES b2b_clients(id),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,  -- COT-2026-0001 (consecutivo, requisito comercial)
    status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft|sent|negotiation|accepted|rejected|expired
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,                      -- vigencia (ej. 15-30 dias)
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,    -- IVA si aplica (dotacion corporativa SI grava)
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    deposit_pct NUMERIC(5,2) DEFAULT 50,            -- % anticipo requerido
    estimated_delivery_days INT,                    -- lead time prometido
    terms TEXT,                                     -- condiciones (anticipo, saldo, garantia)
    created_by UUID REFERENCES users(id),
    converted_contract_id UUID,                     -- FK a contracts cuando se acepta
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Lineas de la cotizacion (items, pueden ser productos existentes o ad-hoc)
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),        -- NULL si es item ad-hoc (diseno custom)
    description VARCHAR(300) NOT NULL,              -- "Camisa oxford bordada logo Restaurante X, talla M"
    quantity INT NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    unit_cost_estimate NUMERIC(14,2),               -- costo estimado para margen de la cotizacion
    customization TEXT,                            -- bordado, estampado, color, tela
    line_total NUMERIC(14,2) NOT NULL
);

-- Contrato / orden de compra (cotizacion aceptada)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    b2b_client_id UUID NOT NULL REFERENCES b2b_clients(id),
    quotation_id UUID REFERENCES quotations(id),
    contract_number VARCHAR(50) UNIQUE NOT NULL,    -- CTR-2026-0001
    status VARCHAR(20) NOT NULL DEFAULT 'pending_deposit',
    total NUMERIC(14,2) NOT NULL,
    deposit_amount NUMERIC(14,2) NOT NULL,
    deposit_received_at TIMESTAMP,
    balance_amount NUMERIC(14,2) NOT NULL,
    delivery_date DATE,                            -- fecha objetivo de entrega
    has_milestones BOOLEAN DEFAULT FALSE,           -- contratos grandes con entregas parciales
    signed_document_url VARCHAR(500),               -- contrato firmado escaneado
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Hitos de entrega (para contratos grandes: institucional, eventos por fases)
CREATE TABLE contract_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    description VARCHAR(300) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    due_date DATE,
    delivered_at TIMESTAMP,
    invoiced_at TIMESTAMP,                          -- cuando se emitio FE de este hito
    status VARCHAR(20) DEFAULT 'pending'            -- pending|delivered|invoiced|paid
);
```

### Relacion con tablas existentes

| Tabla existente | Rol en el B2B |
|-----------------|---------------|
| `products` | Items de cotizacion que ya estan en catalogo (referenciados por `product_id`) |
| `inventory` | Reserva de stock para items que salen de inventario (no made-to-order) |
| `vendors` | Proveedores de telas/insumos para producir el lote (ya normalizado en v3.0.0) |
| `accounts_receivable` | El **saldo a credito** del contrato genera CxC (con `due_date` segun `payment_terms_days`) |
| `balance_entries` / `balance_accounts` | Anticipo y saldo entran a caja/banco |
| `expenses` | Costos de produccion del lote (telas, insumos, mano de obra externa) |
| `payment_transactions` | Si el cliente paga por Wompi/transferencia |
| `branches` (v3.1) | Cada contrato pertenece a una sucursal (o central para corporativos) |

> **Decision de diseno:** los `b2b_clients` se modelan **separados** de `clients` (B2C) porque tienen atributos legales (NIT, credito, terminos de pago) y un ciclo comercial distinto. Mezclarlos en una sola tabla generaria campos nullable confusos y validaciones condicionales por todos lados — el mismo anti-patron que v3.0.0 acaba de eliminar con la unificacion de productos. Mantenerlos separados es deliberado.

### Permisos nuevos (cuando se implemente)

```
b2b.view             VIEWER+   — ver clientes B2B, cotizaciones, contratos
b2b.manage_quotations SALES+   — crear/editar cotizaciones
b2b.manage_contracts  ADMIN+   — convertir cotizacion en contrato, registrar anticipos
b2b.manage_clients    ADMIN+   — alta/baja de clientes B2B y limites de credito
```

---

## Integracion con el Modelo Financiero (MF)

Esta es la razon principal de documentar el B2B ahora: **el motor de proyecciones (`ProjectionService`) debe modelar el B2B como stream separado**, porque su comportamiento es contracalendario y de alto ticket. Si se proyecta solo con el modelo escolar (estudiantes x penetracion x ticket), el MF subestima sistematicamente el flujo real y exagera la estacionalidad.

### Nuevo bloque de assumptions para `ProjectionService`

Agregar al schema de `assumptions` (ver `financial-model-design.md` "Assumptions Schema"):

```json
{
  "b2b_pipeline": {
    "recurring_contracts": [
      {
        "client_name": "Restaurante X",
        "segment": "restaurant",
        "amount_per_cycle": 9000000,
        "cycles_per_year": 2,
        "first_cycle_month": 6,
        "gross_margin_pct": 0.42,
        "deposit_pct": 0.50,
        "payment_terms_days": 0
      },
      {
        "client_name": "Empresa Y (dotacion legal)",
        "segment": "corporate",
        "amount_per_cycle": 6000000,
        "cycles_per_year": 3,
        "first_cycle_month": 4,
        "gross_margin_pct": 0.38,
        "deposit_pct": 0.40,
        "payment_terms_days": 30
      }
    ],
    "one_shot_pipeline": [
      {
        "client_name": "Evento maraton ciudad",
        "segment": "event",
        "amount": 18000000,
        "probability": 0.6,
        "expected_month": 9,
        "gross_margin_pct": 0.35
      }
    ],
    "new_client_acquisition": {
      "contracts_per_quarter": 1,
      "avg_contract_value": 7000000,
      "avg_gross_margin_pct": 0.40,
      "ramp_start_month": 7
    }
  }
}
```

### Reglas de calculo que debe aplicar el motor

1. **Reconocimiento de ingreso por entrega, no por anticipo.** El anticipo entra a **caja** (cash inflow) en el mes del deposito, pero el **ingreso (revenue)** del P&L se reconoce en el mes de entrega. Modelar ambos timings por separado (cash flow != P&L).
2. **COGS del contrato** = `amount * (1 - gross_margin_pct)`, reconocido junto al ingreso (matching).
3. **Saldo a credito** (`payment_terms_days > 0`) genera CxC: el cash inflow del saldo ocurre `payment_terms_days` despues de la entrega. Impacta DSO.
4. **Probabilidad en pipeline one-shot:** ponderar `amount * probability` para el escenario base; ofrecer escenario optimista (probability=1) y pesimista (probability=0) en sensitivity.
5. **Contracalendario:** el B2B **no** se multiplica por la `seasonality` escolar. Tiene su propio timing por `first_cycle_month` + `cycles_per_year`.

### Nueva tabla de sensitivity

Agregar a las 6 tablas existentes de `calculate_sensitivity()`:

| Tabla | Eje X | Eje Y | Metrica |
|-------|-------|-------|---------|
| 7 (B2B) | Num contratos B2B/trimestre | Ticket promedio contrato | Revenue B2B anual + suavizado de estacionalidad (coef. variacion mensual) |

### KPIs B2B nuevos para el dashboard

- **Revenue B2B vs B2C** (% de mezcla — meta: subir B2B de ~5% a ~30%).
- **Pipeline ponderado** (suma de `amount * probability` de cotizaciones en estado `sent`/`negotiation`).
- **Tasa de conversion de cotizaciones** (accepted / sent).
- **Ticket promedio B2B** y **margen promedio B2B**.
- **Concentracion de cartera** (% del revenue B2B en el top-3 clientes — alerta de riesgo si > 60%).
- **Coeficiente de variacion mensual del revenue total** — mide cuanto el B2B aplana la estacionalidad (objetivo del pilar).

### Alerta financiera nueva (rule-based)

Agregar a `FinancialAlertService` (ver `financial-model-design.md`):

- `_b2b_quotation_expiring` — cotizaciones en `sent` proximas a `valid_until` sin respuesta (oportunidad de seguimiento comercial).
- `_b2b_client_concentration` — si un cliente B2B supera X% del revenue total (riesgo de dependencia).
- `_b2b_overdue_balance` — saldo de contrato vencido (`payment_terms_days` excedido) — riesgo de cartera concentrada.

---

## Tratamiento legal, contable y tributario

> Esta seccion conecta con `formalization/`. El B2B no es solo codigo — toca las 8 dimensiones de formalizacion. Resumen de implicaciones:

| Dimension | Implicacion del B2B |
|-----------|---------------------|
| **Tributario** (`02`) | Probable cruce a **responsable de IVA** (dotacion corporativa grava). FE DIAN es **bloqueante** — el cliente B2B necesita la factura para deducir el costo. Retencion en la fuente aplicable si el cliente es agente retenedor. |
| **Contable** (`03`) | Ingreso diferido por anticipos (pasivo), reconocimiento contra entrega, CxC por saldos a credito. Costeo por lote/contrato (no por unidad de stock). |
| **Comercial** (`06`) | Contrato marco de suministro + orden de compra + politica de credito B2B (Gap 6.6). Cotizacion formal numerada con vigencia (Gap 6.7). |
| **Legal/corporativo** (`01`) | Para licitaciones publicas: SAS, RUP, polizas de cumplimiento, paz y salvo parafiscales. |
| **Datos personales** (`05`) | Datos de contacto de empresas — menor sensibilidad que B2C, pero el contrato debe deslindar tratamiento. |
| **Operacional** (`07`) | Capacidad de produccion en lote, gestion de muestras, control de calidad por contrato, SLA de entrega contractual. |

### Anticipo: tratamiento contable correcto

```
Al recibir anticipo (ej. $4.5M de un contrato de $9M):
  DEBE   Caja/Banco               $4.500.000
  HABER  Anticipos de clientes    $4.500.000   (PASIVO — ingreso diferido)

Al entregar el producto y emitir FE:
  DEBE   Anticipos de clientes    $4.500.000
  DEBE   Cuentas por cobrar       $4.500.000   (el saldo, si es a credito)
  HABER  Ingresos por ventas      $9.000.000   (+ IVA si grava)
  Y simultaneamente:
  DEBE   Costo de ventas (COGS)   $X
  HABER  Inventario / Produccion  $X
```

> El sistema actual (v2.9.0) **no modela "Anticipos de clientes" como pasivo**. Si se registra el anticipo como ingreso directo, el P&L del mes infla revenue por producto no entregado. Este es un gap a resolver cuando se implemente el B2B — documentado aqui para que no se pase por alto.

---

## Roadmap de implementacion (post-estabilizacion v3.0.0)

> **No arranca hasta que v3.0.0 este estable en prod.** Se entrelaza con v3.1 (branches) porque cada contrato es por sucursal, y con v3.2 (modelo financiero) porque el B2B es un stream del MF.

| Fase | Entregable | Depende de | Prioridad |
|------|-----------|------------|-----------|
| **B0 — Soporte documental (manual)** | Plantilla de cotizacion numerada + contrato marco + politica de credito. **Sin codigo** — usar docs/plantillas mientras tanto. FE DIAN integrada. | FE DIAN (`02` T7) | 🔴 (habilita el restaurante ya) |
| **B1 — Modelo de datos** | Tablas `b2b_clients`, `quotations`, `quotation_items`, `contracts`, `contract_milestones` + migraciones | v3.0.0 estable | 🟠 |
| **B2 — Cotizaciones** | CRUD cotizaciones, generacion de PDF numerado, conversion a contrato | B1 | 🟠 |
| **B3 — Contratos + anticipos** | Registro de anticipo (como pasivo), saldo a credito (CxC), entrega, FE | B2, modelo de ingreso diferido | 🟠 |
| **B4 — Integracion MF** | `ProjectionService` modela `b2b_pipeline`, KPIs B2B, alertas B2B, sensitivity tabla 7 | v3.2 modelo financiero | 🟠 |
| **B5 — Hitos + institucional** | `contract_milestones`, soporte licitaciones (polizas, RUP) | B3 + SAS | 🟡 |

> **Atajo pragmatico:** B0 se puede ejecutar **ya, sin codigo**, con plantillas de documento + FE del contador o FE propia. Eso desbloquea el contrato del restaurante (~$9M en curso) sin esperar a v3.1. El codigo (B1–B5) viene despues de estabilizar v3.0.0.

---

## Conexion con los otros pilares

```
                          UCR — Tres pilares de crecimiento v3
   ┌──────────────────────┬──────────────────────┬──────────────────────┐
   │  PILAR 1: SUCURSALES   │  PILAR 2: B2B          │  PILAR 3: SaaS         │
   │  (v3.1, ~jun 2026)     │  CONTRATOS             │  (v3.2, ~oct 2026)     │
   │                        │  (post-v3.0.0 estable) │                        │
   ├──────────────────────┼──────────────────────┼──────────────────────┤
   │ Expansion fisica       │ Flujo real mes a mes   │ Apuesta de escala      │
   │ Mas colegios, mas      │ Rompe estacionalidad   │ Vender el software a    │
   │ inventario, mas equipo │ Alto ticket, recurrente│ otros negocios          │
   │                        │ Carga el taller en     │                        │
   │ branch_id en el modelo │ valles escolares       │ organization_id +       │
   │                        │                        │ multi-tenant            │
   └──────────────────────┴──────────────────────┴──────────────────────┘
              │                       │                        │
              └───────────────────────┴────────────────────────┘
                                      │
                          MODELO FINANCIERO (MF)
              Proyecta los 3 streams con su timing propio:
              - Escolar: estacional (calendario escolar)
              - B2B: contracalendario (contratos/dotacion legal)
              - SaaS: recurrente lineal (subscripcion)
```

El B2B es el pilar **menos dependiente de codigo nuevo para arrancar** (B0 es manual) y el de **mayor impacto inmediato en caja**. Por eso se documenta como prioridad de scope aunque su implementacion tecnica completa venga despues de v3.0.0.

---

## Pendientes de discovery (input del owner)

1. **Pipeline B2B real:** ademas del restaurante (~$9M), ¿que leads concretos hay? (empresas, equipos, eventos). Cuantificar para calibrar `b2b_pipeline` en el MF.
2. **Capacidad de produccion en lote:** ¿cuantas prendas/mes puede producir el taller sin afectar la operacion escolar? Esto define el techo del B2B.
3. **Politica de anticipo:** ¿% estandar (30/50%)? ¿Se da credito a algun cliente? ¿A cuales y a cuantos dias?
4. **Capacidad de bordado/estampado:** ¿se hace in-house o se terceriza? Impacta COGS y lead time del B2B.
5. **Decision IVA:** validar con el contador si el B2B cruza a responsable de IVA y como facturar (¿uniformes escolares siguen excluidos, dotacion corporativa grava — manejo mixto?).
6. **Segmento prioritario:** ¿restaurantes/empresas (ticket medio, alta recurrencia) o ir tambien por institucional/licitaciones (ticket alto, barrera SAS)?

---

## Decisiones pendientes del owner

- [ ] Confirmar el B2B como **tercer pilar formal** de la estrategia v3 (no canal secundario).
- [ ] Aprobar ejecutar **B0 (soporte documental + FE) de inmediato** para el restaurante, sin esperar codigo.
- [ ] Definir si los `b2b_clients` se atienden desde la central o se asignan por sucursal (impacta el diseno con `branches`).
- [ ] Validar con el contador el tratamiento de IVA y de anticipos como pasivo.
- [ ] Priorizar segmentos objetivo para enfocar el esfuerzo comercial.

---

[← Volver al indice](./README.md)
