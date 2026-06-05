# UCR — Business Facts (fuente única para diseño y copy)

> **Origen:** DB de desarrollo `uniformes_db` (dump reciente de producción).
> **Fecha extracción:** 2026-05-04
> **Tablas consultadas:** `schools`, `business_settings`, `delivery_zones`, `garment_types`.
>
> **Regla:** todo dato visible al cliente en `web-portal/` debe venir de aquí o de la API. Nada inventado por mockup.

---

## 1. Identidad del negocio

> **No se documenta aquí.** La identidad operativa (dirección, teléfonos, emails, WhatsApp, horarios, maps URL, redes sociales) vive en la tabla `business_settings` (clave-valor) — esa es la fuente única. Documentar los valores en este archivo crearía drift si cambian.
>
> **Para consumir desde el portal V3:** crear un endpoint `GET /api/v1/public/business-info` que devuelva los campos relevantes de `business_settings` filtrados (solo los públicos), o leerlos en server components vía un service layer.
>
> **Para inspeccionar localmente:** `docker exec uniformes-postgres psql -U uniformes_user -d uniformes_db -c "SELECT key, value FROM business_settings ORDER BY key;"`
>
> **Lo que sí queda registrado aquí (interpretación, no datos):**
> - El campo `tagline` actual contiene `"Sistema de Gestión"` — eso es del software ERP interno, **NO sirve como tagline de marketing** del portal de clientes. Pendiente definir tagline público con Consuelo.
> - Los campos de `social_facebook` y `social_instagram` están vacíos. Confirmar si UCR no usa redes sociales o si falta poblar.
> - Los keys disponibles cubren: dirección (`address_line1`/`line2`/`city`/`state`/`country`), contacto (`phone_main`/`phone_support`/`email_contact`/`email_noreply`/`whatsapp_number`), horarios (`hours_weekday`/`hours_saturday`/`hours_sunday`), branding (`business_name`/`business_name_short`/`tagline`), web (`website_url`/`maps_url`), redes (`social_facebook`/`social_instagram`).

### **Pendientes** (no están en DB, hay que conseguirlos antes de Fase 1 del rediseño)

- [ ] **NIT** del negocio (necesario para footer legal). Nuevo key sugerido: `nit` o `tax_id` en `business_settings`
- [ ] **Año de fundación** (necesario si el copy del hero menciona tradición/años). Nuevo key sugerido: `founded_year`
- [ ] **Política de garantía** (días para cambio, condiciones). Nuevo key sugerido: `policy_warranty`
- [ ] **Tagline público** del portal de clientes (no usar el actual `"Sistema de Gestión"`). Nuevo key sugerido: `tagline_public` o sobrescribir `tagline` existente
- [ ] **Redes sociales activas** (Facebook/Instagram aparecen vacías — ¿no usan o falta agregar?)

---

## 2. Colegios aliados (catálogo real)

10 colegios activos + 1 inactivo + 1 temporal. Datos de `schools` ordenados por `display_order`:

| # | Code | Nombre | Slug | Color primario | Ciudad | Estado |
|---|---|---|---|---|---|---|
| # | Code | Nombre | Slug | Color primario | Estado |
|---|---|---|---|---|---|
| 1 | `CARACAS-001` | Institución Educativa Caracas | `institucion-educativa-caracas` | `#1E3A8A` (azul) | Activo |
| 2 | `PUMAREJO-001` | Institución Educativa Alfonso López Pumarejo | `institucion-educativa-alfonso-lopez-pumarejo` | *(sin color)* | Activo |
| 3 | `PINAL-001` | Institución Educativa El Pinal | `institucion-educativa-el-pinal` | *(sin color)* | Activo |
| 4 | `CONFAMA-001` | Comfama | `comfama` | *(sin color)* | Activo |
| 5 | `BUEN-002` | Buen Comienzo | `buen-comienzo` | *(sin color)* | Activo |
| 6 | `FELIX-001` | Institución Educativa Felix Henao Botero | `institucion-educativa-felix-henao-botero` | *(sin color)* | Activo |
| 7 | `HECTOR-001` | Institución Educativa Héctor Abad Gómez | `institucion-educativa-hector-abad-gomez` | *(sin color)* | Activo |
| 8 | `CRUZPOSADA-001` | Institución Educativa Juan De La Cruz Posada | `institucion-educativa-juan-de-la-cruz-posada` | *(sin color)* | Activo |
| 9 | `CAICEDO-001` | Institución Educativa Manuel José Caycedo | `institucion-educativa-manuel-jose-caicedo` | *(sin color)* | Activo |
| 10 | `ALEGRIA-001` | Jardín Infantil Fe y Alegría | `jardin-infantil-fe-y-alegria` | *(sin color)* | Activo |
| 11 | `GOTA-001` | Jardín Gota De Leche | `jardin-gota-de-leche` | *(sin color)* | Activo |
| — | `TEMP-1E18F1F7` | +caicedo | `caicedo` | — | **Inactivo** (no mostrar) |

**Todos los colegios atendidos están en Medellín.** Confirmado verbalmente con el dueño 2026-05-04.

### Composición del portafolio

- **7 instituciones educativas públicas** (CARACAS, PUMAREJO, PINAL, FELIX, HECTOR, CRUZPOSADA, CAICEDO)
- **1 caja de compensación** (CONFAMA — Comfama)
- **1 programa público de primera infancia** (BUEN-002 — Buen Comienzo)
- **2 jardines infantiles** (ALEGRIA-001 — Fe y Alegría, GOTA-001 — Gota de Leche)

**Implicación de marketing:** El target es **mercado popular de uniformes para colegios públicos y programas sociales**, NO colegios élite privados. Cualquier copy que sugiera lo contrario (ej. "los mejores colegios de Medellín", "exclusivo", "premium") es **falso al target**.

### Cobertura geográfica

**Todos los colegios atendidos están en Medellín.** El copy del tipo *"vistiendo a Medellín"* o *"colegios de Medellín"* es **correcto al hecho** y se puede usar sin invención.

> **Hallazgo de data sucia (importante):** La columna `schools.address` contiene **seed data placeholder convincente pero falsa** (`"Bogotá, Colombia"`, `"Cali, Colombia"` para algunos registros). Esto **no refleja la realidad operativa** y debe limpiarse en una migración o ignorarse al renderizar el portal. Riesgo: si Claude Design (o cualquier agente) consulta `schools.address` directamente sin contexto, va a deducir cobertura nacional falsa, como pasó en la primera versión de este documento. **No usar `schools.address` como fuente de verdad para ciudad/región.**

### **Pendientes**

- [ ] **Colores de marca** para 9 de 11 colegios (`primary_color`, `secondary_color` están NULL). Sin esto, el "color bar de identidad por colegio" del SchoolPicker v3 no funciona — todos serían iguales.
- [ ] **Logos oficiales** (`logo_url` no consultado, asumido sin valor para la mayoría). Sin logos, el grid de colegios usa solo texto + color.
- [ ] **Direcciones y contacto** de la mayoría de colegios (campos vacíos en `address`, `phone`, `email`).
- [ ] **Limpiar seed data sucia en `schools.address`** — actualmente 3 colegios tienen placeholder falso (`Bogotá, Colombia`, `Cali, Colombia`). O se borra a NULL o se rellena con la dirección real del colegio en Medellín.

---

## 3. Logística de entrega

`delivery_zones` activas. Todas son zonas de **Medellín**, lo cual es coherente con que toda la operación (negocio físico + colegios atendidos) está concentrada en la ciudad:

| Zona | Tarifa | Días estimados |
|---|---:|---:|
| Buenos Aires | $10.000 | 1 día |
| La Candelaria | $10.000 | 1 día |
| Villahermosa | $10.000 | 1 día |
| Milagrosa, Loreto | $13.000 | 1 día |
| Manrique | $12.000 | 2 días |
| Otras zonas | *consultar* | *(inactivo, $0)* |

**Hechos de envío:**
- **NO hay envío gratis.** El mockup v2 de Claude Design ("Envío gratis sobre $200.000") es **inventado**.
- **Tarifas planas $10K–$13K** según zona.
- **Entrega en 1–2 días hábiles** según zona.
- **Recogida en taller** (sede en Medellín — barrio según `business_settings.address_line2`) presumiblemente disponible (no está en `delivery_zones` pero sí en copy actual del portal).
- **Cobertura: solo Medellín** — sin envío nacional confirmado.

### Copy correcto para Hero/PDP/Cart

✓ "Envío en Medellín desde $10.000 · 1–2 días hábiles"
✓ "Recogida gratis en taller (Medellín)" — barrio leído de `business_settings`
✗ "Envío gratis" (no aplica)
✗ "Domicilio en 24h" (no es lo que dice la DB)

### **Pendientes**

- [ ] Confirmar si **recogida en taller** es opción real para clientes (no está modelada en `delivery_zones` con $0).

---

## 4. Catálogo: tipos de prenda canónicos

`garment_types` (80 registros). Hallazgos:

### Categorías reales en uso (NO son las del mockup)

El mockup v3 asumió `Diario / Educación Física / Gala`. Las categorías reales en `garment_types.category`:

| Categoría real | Conteo aprox |
|---|---|
| `uniforme_diario` | ~12 |
| `uniforme_deportivo` | ~6 |
| `tops` | ~3 |
| `bottoms` | ~1 |
| `accesorios` | ~6 |
| `accessories` | ~1 (sic, duplicado por casing) |
| `Superior` | ~3 (sic, mayúscula inconsistente) |
| `Conjunto` | ~1 |
| `footwear` | ~1 |
| *(NULL)* | ~50 |

**Hallazgo crítico:** La taxonomía está **inconsistente** (`accesorios` vs `accessories`, `Superior` vs `tops`). Es deuda técnica. Antes de exponer "filtros por categoría" en el portal V3, hay que **normalizar la taxonomía**.

### Productos globales (sin `school_id`)

Productos transversales que no son específicos de un colegio:

```
Bicicleteros, Blusa, Boxer, Camisa basica, Camisillas,
Correa, Delantal para niña, Jean, Medias, Medias Tobilleras,
Tennis Nike Blanco, Tennis Nike Negro, Top, Zapatos Goma
```

Mezcla de prendas "blancas" propias (manufactured) y mercancía revendida (purchased: Tennis Nike, Jean, etc.).

### Prendas específicas por colegio (muestra)

| Colegio | Prendas |
|---|---|
| CARACAS-001 | Camiseta, Chompa Azul, Chompa Gris, Sudadera, Yomber, Bicicletero negro talla 6, Interiores, Moño Gala, Moño Gris |
| CONFAMA-001 (más extenso, 17 variantes) | Camiseta {Amarillo/Azul/Fucsia/Morado}, Chompa {Amarillo/Azul/Fucsia/Morado}, Sudadera {Amarillo/Azul/Fucsia/Morado}, Delantal, camiseta de algodón {colores}, Moño {colores} |
| PINAL-001 | Camiseta, Chompa, Delantal {De Niña/De Niño}, Interios, Moño, Sudadera, Yomber |
| FELIX-001 | CAMISETA, CAMISETA FISICA, CHOMPA, Sudadera |
| HECTOR-001 | CHOMPA, SUDADERA, camisa |
| BUEN-002 | Camiseta, Sudadera |
| ALEGRIA-001, CAICEDO-001, CRUZPOSADA-001 | CAMISA, CAMISETA, CHOMPA, SUDADERA |
| GOTA-001 | CHOMPA, SUDADERA, camisa |
| PUMAREJO-001 | Camiseta (solo 1 visible en muestra) |

**Hallazgos de UX:**
- Casing inconsistente: `CAMISETA` vs `Camiseta` vs `camiseta`. **Normalizar al exponer.**
- Algunos colegios tienen 3-4 prendas, otros 17. **El catálogo es asimétrico.** El SchoolPicker v3 que muestra "24 prendas en catálogo" como número fijo (línea 358 de `StorefrontV3.jsx`) está inventado — hay que mostrar el conteo real por colegio.
- Comfama tiene productos por color (Amarillo/Azul/Fucsia/Morado) — eso es **modalidad de uniforme por color**, no son "variantes" en el sentido de talla. La UI debe respetar esto.

### **Pendientes** (deuda técnica + diseño)

- [ ] **Normalizar `garment_types.category`** (eliminar duplicados de casing, decidir taxonomía canónica).
- [ ] **Decidir** si las "categorías" en el filtro del catálogo del portal V3 son las de la DB normalizadas, o un mapeo más amigable (ej. `uniforme_diario → "Diario"`, `uniforme_deportivo → "Deporte"`, `accesorios → "Accesorios"`).
- [ ] **Especificaciones de producto** (tela, gramaje, costuras, bordado, cuidado, origen) **no están en DB**. El v3 inventa estas en `PDP::specs` líneas 552-557. Antes de exponer specs, **agregar campos al modelo `Product` o `GarmentType`** o decidir que las specs no se muestran en V3.

---

## 5. Resumen de invenciones a eliminar

Recapitulando lo que hay que **borrar** del bundle de Claude Design al portar:

| Pieza | Donde está | Reemplazo |
|---|---|---|
| Lista `SCHOOLS` v2 (San José Vegas, Marymount, Calasanz, Colombo, Columbus, San Ignacio) | `Home.jsx` líneas 7-14 | API `GET /api/v1/schools` (10 reales) |
| Lista `SCHOOLS_V3` v3 (placeholders `[Colegio aliado 0X]`) | `StorefrontV3.jsx` líneas 14-21 | API real |
| `PRODUCTS` v3 (8 productos inventados) | `StorefrontV3.jsx` líneas 23-32 | API `GET /api/v1/schools/{slug}/products` |
| Categorías `Diario / Educación física / Gala` | `StorefrontV3.jsx` línea 338 | Categorías reales normalizadas |
| Specs PDP (poliéster/algodón/180g/Madeira) | `StorefrontV3.jsx` líneas 552-557 | Pendiente — modelar en DB primero |
| "+40 años cosiendo", "98% satisfacción", "28 colegios", "Tradición desde 1985" | `Home.jsx` líneas 27, 44 | Solo usar lo confirmado: 10–11 colegios reales. Año fundación: pendiente. |
| "Cra. 50 #45-23, Medellín" | `Home.jsx` línea 199 | Leer dirección real desde `business_settings` (`address_line1`, `address_line2`, `city`) — no inventar |
| "NIT 8001234567-1" | `Home.jsx` línea 199 | Pendiente real |
| "Lun–Sáb · 8am–6pm" | `Home.jsx` línea 85 | "L-V 8AM-6PM · Sáb 9AM-2PM · Dom cerrado" |
| "Envío gratis sobre $200.000" | `Home.jsx` línea 82, `StorefrontV3.jsx` línea 576 | "Envío Medellín desde $10.000 · 1–2 días" |
| "Calidad que se nota, precios que convienen" | Copy actual de portal | Confirmar — sí es el real, viene del README del bundle |
| Emojis 👕👗🩳 | `Home.jsx` líneas 56-58 | **Eliminar** |
| Emblemas Unicode `⚜ ✿ ☩ ★ ⚓ ✚` | `Home.jsx` línea 8-13 | Reemplazar por color bar (color real del colegio) o logo PNG |

---

## 6. Implicación estratégica para el rediseño V3

### Tone shift detectado

El v3 de Claude Design proyecta **"premium editorial"** (dark hero, Fraunces italic, "El uniforme que los niños no quieren quitarse", manifesto Calidad/Servicio/Innovación). Esto **funciona conceptualmente** para colegios élite privados — y **es exactamente lo que asumió el v2 con su lista inventada de Marymount/Colombo Británico/Columbus**.

Pero el target real son **padres de instituciones públicas y programas sociales** (Buen Comienzo, Fe y Alegría, IE Caracas/Pumarejo/Pinal/Félix/Héctor/Cruz Posada/Caycedo). **El editorial-premium puede sentirse aspiracional-falso o incluso intimidante** para ese público.

### Preguntas a resolver antes de Fase 2

1. **¿El target real (mercado popular público) responde al lenguaje editorial del v3, o se siente excluido?** Esto se valida con Consuelo y, idealmente, con 3-5 padres reales antes de invertir en el rediseño.
2. **¿La aspiración es "subir el nivel" del portal para atraer también colegios privados** (estrategia de expansión, ver `business_expansion_plan.md`)? Si sí, el v3 editorial es coherente con la estrategia futura, no con el target actual. Defendible pero hay que ser explícito.
3. **¿O el v3 se atempera** para que sea "calidad sin hacer sentir caro" (que es exactamente el copy del README "calidad que se nota, precios que convienen")?

Mi lectura: **opción 3** es la que mejor encaja con el copy ya existente en producción. Un v3 con la **estructura editorial** (layout limpio, tipografía cuidada, ProcessBand, SchoolPicker grid) pero sin el **dark-luxury hero**, sin el "italic en gold" excesivo, y con copy plainspoken como ya tienen.

---

## 7. Acciones recomendadas (orden)

1. **Conseguir pendientes externos** (de Consuelo): NIT, año fundación, política de garantía, tagline público, especificaciones de tela/costura por línea de producto, colores de marca de los 9 colegios sin color asignado.
2. **Normalizar taxonomía** de `garment_types.category` en una migración Alembic — es deuda técnica que de todas formas hay que pagar antes de exponer filtros públicos.
3. **Validar tone** con Consuelo: ¿v3 editorial-premium sí o no, dada la composición real del portafolio?
4. **Recién entonces**, escribir el re-brief para Claude Design con esta data y arrancar V2 del rediseño visual.

---

*Generado por consulta directa a `uniformes_db` (dump fresco de prod) el 2026-05-04. Si la composición de colegios o las zonas de entrega cambian, regenerar este documento.*
