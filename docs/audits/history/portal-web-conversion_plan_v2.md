# Plan de Mejora: portal-web-conversion v2

**Score actual:** 48.5 / 100 · **Target:** 80.0 · **Gap:** 31.5 pts
**Base:** auditoría v1 (2026-05-29), hallazgos verificados contra código.

> Criterio de ejecución en esta sesión: **solo fixes de código puro, bajo riesgo y
> autocontenidos**. Se difieren los que requieren datos de dominio que no tengo
> (medidas reales de tallas, fotos, email corporativo). NO se toca `app/registro/page.tsx`.

> **Corrección de hecho:** el login NO vive en `/registro` (esa página es solo
> registro: email→verify→details). El login real es `/mi-cuenta?login=required`,
> que renderiza `LoginRequiredDialog` (modal con login + "Crear cuenta nueva").
> La propia página de registro enlaza ahí su "Inicia sesión".

---

## ✅ Ya hecho en sesión previa (commit 80f8a77)
- **cart-checkout #1:** ícono del carrito → `/[slug]/cart` (era `/`). HeaderV3.
- **Feedback al agregar:** `toast.cart()` en quick-add del catálogo. ProductCardV3.

---

## P0 — Quick wins (bajo riesgo, alto impacto)

1. **`/login` y `/iniciar-sesion` dan 404** (registration −2.0)
   → Crear `app/login/page.tsx` y `app/iniciar-sesion/page.tsx` que hacen
     `redirect("/mi-cuenta?login=required")`. Elimina los 404 de URL escrita a mano.

2. **"Iniciar sesión" del header lleva a registro, no a login** (registration −2.0)
   → En `HeaderV3.tsx`, el botón "Iniciar sesión" y el ícono de usuario (no-auth)
     apuntan a `/registro` → cambiar a `/mi-cuenta?login=required` (modal de login
     con escape "Crear cuenta nueva", así no perdemos al usuario nuevo).

## P1 — Mejoras medianas

3. **Sin menú hamburguesa móvil** (mobile-ux −3.0)
   → `HeaderV3.tsx`: nav es `hidden md:flex` sin alternativa. Agregar botón
     hamburguesa + panel desplegable con NAV_LINKS + cuenta/login.

4. **Sin sello de seguridad al pagar** (trust-credibility −2.0, payment-flow −2.0)
   → `CartPageV3.tsx`: línea "Pago seguro · SSL · Wompi" bajo el botón de pago.

---

## P2 — Diferido (datos de dominio o invasivo) — NO ejecutado

- **Guía de tallas** (product-detail −4.0): requiere medidas reales por prenda
  (edad/cm). Inventarlas → devoluciones. Necesita input del owner / tabla oficial.
- **Filtro por género** (catalog-ux −1.5): `gender` vive en `Product`, no en
  `ProductGroup`. Exige plumbing hasta el agrupador + verificar dato poblado.
- **Fotos múltiples** (product-detail): la galería YA existe (`ProductDetailV3:124`).
  Gap de datos (subir fotos), no de código.
- **Email corporativo** (trust): footer lee `info.email_contact` del backend.
  Cambio de dato/ops, no de código.
- **Mini-cart drawer** (cart-checkout): cambio estructural. Mitigado por el toast +
  el fix de routing del ícono. Planear como mejora dedicada.

---

## Impacto estimado
P0+P1 de esta sesión cierran los gaps por bugs de routing/UX en registration,
mobile-ux, trust-credibility y payment-flow. El gap grande restante
(product-detail −4.0 / guía de tallas) queda bloqueado por datos de dominio.
