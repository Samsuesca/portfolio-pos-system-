# Auditoría CRO — portal-web-conversion v1

- **Área:** portal-web-conversion
- **Iteración:** 1
- **Fecha:** 2026-05-29
- **Auditor:** Claude Chrome Extension (sin acceso al repo; testeo de producción yourdomain.com)
- **Perspectiva:** Padre colombiano comprando uniformes por primera vez
- **Benchmark:** 2–4% CR para tiendas de uniformes
- **Nota global:** 48.5 / 100 (target 80.0, delta −31.5)

---

## ⚠️ Addendum de verificación contra código (2026-05-29)

El auditor **no tenía acceso al repositorio**. Verifiqué cada hallazgo crítico contra el
código real (`web-portal/components/v3/*`, `web-portal/app/[school_slug]/checkout/page.tsx`).
Resultado: los hallazgos críticos son **reales**, con tres imprecisiones menores que no
cambian el panorama. La nota 48.5/100 está justificada.

| Hallazgo del auditor | Nota | Veredicto verificado | Evidencia |
|---|---|---|---|
| #1 Carrito redirige al homepage | 1/10 | ✅ **REAL** | `HeaderV3.tsx:92` — el ícono del carrito es `<Link href="/">`. Click → homepage. |
| `/carrito` 404 | — | ✅ Real, pero por diseño de ruta (`/[colegio]/cart`). Irrelevante: el ícono ni apunta ahí. |
| Sin feedback al "+ Agregar" (catálogo) | — | ✅ **REAL** | `ProductCardV3.tsx:40-58` — quick-add solo hace `addItem`, sin toast/drawer/nav. |
| "No se puede cambiar cantidad sin volver" | — | ⚠️ **IMPRECISO** | `CartPageV3.tsx:144-167` sí tiene +/− y eliminar. El problema es *llegar* a la página. |
| #2 Sin guía de tallas | 4/10 | ✅ **REAL** | grep en `components/`: ninguna referencia. Solo chips de talla, sin tabla edad/cm. |
| "Una sola foto por producto" | — | ⚠️ **IMPRECISO** | `ProductDetailV3.tsx:124-149` la galería multi-foto existe. Gap = datos (productos con 1 imagen), no código. |
| Sin descripción/material/cuidado | — | ✅ **REAL** | `ProductDetailV3.tsx` no renderiza descripción ni ficha técnica. |
| #3 Registro obligatorio, sin guest checkout | 5/10 | ✅ **REAL** | `checkout/page.tsx` exige email + OTP + contraseña (crea cuenta inline). No hay path de invitado. |
| `/login` 404; "Iniciar sesión" → `/registro` | — | ✅ **REAL** | `HeaderV3.tsx:82,114` enlazan a `/registro`. No existe ruta `/login`. |
| Sin menú hamburguesa móvil | 5/10 | ✅ **REAL** | `HeaderV3.tsx:57` nav es `hidden md:flex` sin toggle; en móvil los links desaparecen. |
| "No hay Mi cuenta / Mis pedidos" | — | ⚠️ **FALSO** | `/mi-cuenta` existe; `HeaderV3.tsx:82` enlaza ahí cuando hay sesión. |

### Fix aplicado en esta sesión
- **P0 carrito (#1):** `HeaderV3.tsx` — el ícono del carrito ahora deriva el slug del primer
  item del carrito y enlaza a `/[slug]/cart` (mismo patrón que `CartPageV3.handleCheckout`).
  Con carrito vacío mantiene `/` como fallback. Cambio mínimo, alto impacto.

---

## Tabla de scores registrada (CSV)

| Categoría | Nota /10 | Target |
|---|---|---|
| landing-clarity | 7.0 | 8.0 |
| school-selection | 7.0 | 8.0 |
| catalog-ux | 6.5 | 8.0 |
| product-detail | 4.0 | 8.0 |
| cart-checkout | 1.0 | 8.0 |
| registration | 5.0 | 7.0 |
| payment-flow | 6.0 | 8.0 |
| confirmation | 2.0 | 8.0 |
| mobile-ux | 5.0 | 8.0 |
| trust-credibility | 5.0 | 7.0 |
| **GLOBAL** | **48.5 / 100** | **80.0** |

---

## Reporte original del auditor

### 1. LANDING — Primeros 5 segundos
Hero contundente, propuesta de valor clara ("Uniformes escolares, por colegio"), 11 colegios visibles
sin scroll, dos CTAs ("Ver colegios", "Escribir por WhatsApp"). Problemas: sin foto de producto real en
hero, sin social proof, sin diferenciador vs MercadoLibre, sin hamburguesa móvil.
**Fricción 2/10 · Claridad 8/10 · Confianza 5/10 · Score 7/10**

### 2. SELECCIÓN DE COLEGIO
2 clicks a catálogo, logos reconocibles, códigos abreviados. Problemas: sin buscador de colegio, sin
mensaje "¿y si mi colegio no está?", logos de calidad dispar, nombres largos se cortan en móvil.
**Score 7/10**

### 3. CATÁLOGO (Caracas — 19 prendas)
Filtros por categoría (pills), filtro por talla, buscador por texto, precios en tarjeta, disponibilidad
visible, "+ Agregar" directo, fotos limpias. Problemas: sin filtro por género, sin filtro por grado,
rango de precio confuso, foto de moño con 2 unidades engaña, 1 sola foto por prenda.
**Score 6.5/10**

### 4. DETALLE DE PRODUCTO
Selector de talla en chips, stock visible, precio dinámico en botón, contador +/−, WhatsApp prominente,
breadcrumb. CRÍTICOS: sin guía de tallas, sin descripción/material/cuidado, sin fotos múltiples, rango
de precio confuso, sin tiempo de entrega, sin reseñas.
**Score 4/10 ⚠️ Momento de muerte #1**

### 5. CARRITO
CRÍTICO/BUG: sin feedback visual al agregar (no drawer, no toast), badge pequeño, **click en ícono del
carrito redirige al homepage**, `/carrito` da 404, sin mini-cart lateral.
**Score 1/10 ⚠️ Momento de muerte #2 — BUG BLOQUEANTE**

### 6. REGISTRO / LOGIN
Flow 3 pasos con stepper, Google Login, OTP por email, link a iniciar sesión, baja fricción inicial.
Problemas: `/login` e `/iniciar-sesion` dan 404 (solo `/registro`), sin guest checkout, sin explicar
beneficios de la cuenta, botón "Iniciar sesión" lleva a `/registro`.
**Score 5/10 ⚠️ Momento de muerte #3**

### 7. CHECKOUT
Bloqueado por el bug del carrito. El checkout de "Encargos personalizados" sí funciona aparte. No se
detectaron campos de estudiante ni opción de recogida en tienda.
**Score 2/10 (por imposibilidad de completarlo)**

### 8. PAGO
Wompi (Visa/Mastercard, PSE, Nequi, DaviPlata, Bancolombia), SSL mencionado, logos en homepage.
Problemas: sin sello de seguridad en producto/checkout, sin opción efectivo en tienda, sin política de
cambios/devoluciones en el flujo.
**Score 6/10**

### 9. CONFIRMACIÓN
No evaluable por el bug del carrito. **Score N/E** (registrado 2.0 como proxy del flujo bloqueado).

### 10. POST-COMPRA
Centro de soporte PQRS, WhatsApp visible, horarios claros, botón flotante de soporte. Problemas: email
@gmail.com en vez de corporativo, sin seguimiento de pedido online.
**Score 6/10**

---

## TOP 3 momentos de muerte
1. **Carrito redirige al homepage** (bug bloqueante). Impacto: −70% de intenciones de compra. → **FIX APLICADO**
2. **Ausencia de guía de tallas**. Impacto: −25% en product detail.
3. **Registro obligatorio sin guest checkout**. Impacto: −40% en la puerta del checkout.

## TOP 5 quick wins
1. Corregir bug del carrito (P0, 24h). → **HECHO**
2. Toast/drawer de confirmación al agregar.
3. Guía de tallas en product detail.
4. Filtro por género en catálogo.
5. Email corporativo en vez de @gmail.com.

## TOP 3 cambios estructurales
1. Guest checkout (compra sin registro).
2. Rediseñar product detail con contenido de confianza (galería, ficha técnica, guía de tallas, FAQ, sellos).
3. Buscador de colegio con autocompletado como entrada principal.

## Prioridad de acción inmediata
- 🔴 P0 — Bug del carrito (bloquea todas las ventas) → **HECHO**
- 🔴 P1 — Guía de tallas
- 🟡 P1 — Guest checkout
- 🟡 P2 — Fotos múltiples por producto
- 🟢 P2 — Filtro por género + buscador de colegio
