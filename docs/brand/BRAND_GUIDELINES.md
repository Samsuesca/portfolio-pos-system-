# UCR Brand Guidelines

**Uniformes Consuelo Rios** — Sistema de identidad visual  
Version 1.0.0 | Abril 2026

---

## 1. Identidad de Marca

| Atributo | Valor |
|----------|-------|
| Nombre completo | Uniformes Consuelo Rios |
| Nombre corto | UCR |
| Tagline | Calidad que se nota, precios que convienen |
| Dominio | yourdomain.com |
| Ubicacion | Medellin, Antioquia, Colombia |

### Personalidad de Marca

UCR es **calida, confiable y eficiente**. No es una marca de lujo ni una marca barata — es la opcion inteligente para familias que valoran calidad a precio justo.

| Atributo | UCR es | UCR no es |
|----------|--------|-----------|
| Tono | Cercano, profesional | Frio, corporativo |
| Visual | Calido, dorado, limpio | Azul tech, neon, recargado |
| Velocidad | Rapida, sin friccion | Lenta, con pasos innecesarios |
| Confianza | Transparente en precios | Ambigua, con costos ocultos |

---

## 2. Paleta de Colores

### 2.1 Brand Gold (Primaria)

Derivada del logo original. El dorado transmite calidad, confianza y calidez.

| Token | Hex | Uso |
|-------|-----|-----|
| `brand-50` | `#FBF6EA` | Fondos tintados, estados hover |
| `brand-100` | `#F5ECD4` | Estados seleccionados, badges activos |
| `brand-200` | `#EBDAAB` | Acentos decorativos, progress bars |
| `brand-300` | `#DFC67E` | Elementos decorativos |
| `brand-400` | `#D4AF37` | Logo gold, indicador sidebar activo, focus ring |
| `brand-500` | `#B8860B` | CTA primario, botones principales |
| `brand-600` | `#9A7209` | Hover de botones, links |
| `brand-700` | `#7C5B07` | Estados pressed, acentos oscuros |
| `brand-800` | `#5E4505` | Enfasis fuerte |
| `brand-900` | `#3D2D03` | Tono brand mas oscuro |

### 2.2 Warm Stone (Neutrales)

Neutrales con subtono calido (base warm, no cool gray).

| Token | Hex | Uso |
|-------|-----|-----|
| `stone-50` | `#FAFAF9` | Fondo mas claro |
| `stone-100` | `#F5F5F4` | Fondos secundarios |
| `stone-200` | `#E7E5E4` | Bordes sutiles, divisores |
| `stone-300` | `#D6D3D1` | Bordes visibles, disabled |
| `stone-400` | `#A8A29E` | Texto placeholder, hints |
| `stone-500` | `#78716C` | Texto terciario |
| `stone-600` | `#57534E` | Texto secundario |
| `stone-700` | `#44403C` | Texto enfatizado |
| `stone-800` | `#292524` | Superficies oscuras |
| `stone-900` | `#1C1917` | Texto primario, fondos dark |

### 2.3 Surface (Fondos)

| Token | Hex | Uso |
|-------|-----|-----|
| `surface-50` | `#FFFFFF` | Cards, paneles |
| `surface-100` | `#F8F7F4` | Fondo de pagina |
| `surface-200` | `#F1EFE9` | Hover de superficie |

### 2.4 Semanticos

| Token | Hex | Uso |
|-------|-----|-----|
| `success` | `#16A34A` | Confirmaciones, pagos exitosos |
| `warning` | `#D97706` | Alertas, stock bajo |
| `error` | `#DC2626` | Errores, acciones destructivas |
| `info` | `#2563EB` | Informacion, tips |

### 2.5 Reglas de Color

**HACER:**
- Usar brand-500 para CTAs primarios
- Usar brand-400 para acentos, focus rings, indicadores activos
- Usar stone-900 (#1C1917) para texto principal (no negro puro)
- Usar surface-100 (#F8F7F4) como fondo de pagina (no blanco puro)

**NO HACER:**
- Nunca usar azul (#1e3a5f) o morado (#8b5cf6) como color de marca
- Nunca usar negro puro (#000000) para texto
- Nunca usar blanco puro (#FFFFFF) como fondo de pagina
- Nunca usar brand-500 sobre fondos oscuros sin verificar contraste

---

## 3. Tokens Semanticos

### 3.1 Surface Tokens

```css
--ucr-surface-base:      #F8F7F4;                  /* Fondo de pagina */
--ucr-surface-card:      #FFFFFF;                   /* Cards, paneles */
--ucr-surface-elevated:  #FFFFFF;                   /* Modales, popovers */
--ucr-surface-hover:     #F1EFE9;                   /* Estados hover */
--ucr-surface-active:    rgba(212,175,55, 0.08);    /* Brand-tinted active */
--ucr-surface-overlay:   rgba(28,25,23, 0.6);       /* Backdrop modales */
```

### 3.2 Text Tokens

```css
--ucr-text-primary:      #1C1917;   /* Titulos, cuerpo */
--ucr-text-secondary:    #57534E;   /* Descripciones */
--ucr-text-tertiary:     #A8A29E;   /* Placeholders, hints */
--ucr-text-muted:        #D6D3D1;   /* Texto deshabilitado */
--ucr-text-on-brand:     #FFFFFF;   /* Texto sobre botones dorados */
```

### 3.3 Border Tokens

```css
--ucr-border-subtle:     rgba(28,25,23, 0.06);  /* Separadores ligeros */
--ucr-border-default:    rgba(28,25,23, 0.10);  /* Bordes de inputs */
--ucr-border-strong:     rgba(28,25,23, 0.16);  /* Bordes enfatizados */
--ucr-border-focus:      #D4AF37;               /* Focus ring (brand-400) */
```

---

## 4. Tipografia

### 4.1 Font Stack

| Rol | Fuente | Fallback |
|-----|--------|----------|
| Display (titulos) | Outfit | system-ui, sans-serif |
| Body (cuerpo) | Inter | system-ui, sans-serif |
| Mono (codigo, versiones) | JetBrains Mono | ui-monospace, monospace |

### 4.2 Escala Tipografica

| Rol | Tamano | Weight | Tracking | Font | Uso |
|-----|--------|--------|----------|------|-----|
| Display | 28px | 700 | -0.025em | Outfit | Titulos de pagina, numeros hero |
| Title 1 | 22px | 700 | -0.02em | Outfit | Secciones principales |
| Title 2 | 18px | 600 | -0.01em | Outfit | Titulos de card |
| Title 3 | 15px | 600 | -0.01em | Outfit | Subsecciones |
| Body | 14px | 400 | 0 | Inter | Texto default |
| Body SM | 13px | 400/500 | 0 | Inter | Celdas de tabla, texto secundario |
| Caption | 11px | 600 | 0.06em | Inter | Labels, badges (uppercase) |
| Mono | varies | 500 | 0 | JetBrains Mono | Versiones, codigos |

### 4.3 Font Features

```css
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
font-optical-sizing: auto;
-webkit-font-smoothing: antialiased;
```

Para datos numericos (precios, inventario):
```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum", "cv02";
```

---

## 5. Motion System

### 5.1 Duration Tokens

| Token | Valor | Uso |
|-------|-------|-----|
| `--ucr-duration-instant` | 80ms | Micro-interacciones, focus |
| `--ucr-duration-fast` | 150ms | Hover, toggles |
| `--ucr-duration-base` | 200ms | Transiciones standard |
| `--ucr-duration-moderate` | 300ms | Modales, page transitions |
| `--ucr-duration-slow` | 400ms | Animaciones complejas |

### 5.2 Easing Functions

| Token | Valor | Uso |
|-------|-------|-----|
| `--ucr-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas (snappy) |
| `--ucr-ease-in` | `cubic-bezier(0.55, 0, 1, 0.45)` | Salidas (smooth) |
| `--ucr-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Transiciones simetricas |
| `--ucr-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Elementos interactivos (bouncy) |

### 5.3 Patrones de Animacion

**Page entrance:**
```css
from { opacity: 0; transform: translateY(8px); }
to   { opacity: 1; transform: translateY(0); }
duration: var(--ucr-duration-moderate);
easing: var(--ucr-ease-out);
```

**Stagger children:** 40ms delay entre items

**Card hover:** `translateY(-1px)` + shadow elevation

**Modal entrance:** `scale(0.96) → scale(1)` + fade + `y(8px) → y(0)`

**Spring physics (Framer Motion, solo desktop):**
```ts
{ type: "spring", stiffness: 500, damping: 35 }
```

### 5.4 Accesibilidad

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Shadow System

Sombras multi-capa con tono calido `rgba(28,25,23,...)`.

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-xs` | `0 1px 2px rgba(28,25,23, 0.04)` | Inputs, badges |
| `shadow-sm` | `0 1px 3px rgba(28,25,23, 0.06), 0 1px 2px rgba(28,25,23, 0.04)` | Cards en reposo |
| `shadow-md` | `0 4px 12px rgba(28,25,23, 0.07), 0 1px 3px rgba(28,25,23, 0.05)` | Cards hover, dropdowns |
| `shadow-lg` | `0 12px 40px rgba(28,25,23, 0.08), 0 4px 12px rgba(28,25,23, 0.04)` | Popovers, toasts |
| `shadow-xl` | `0 24px 64px rgba(28,25,23, 0.12), 0 8px 24px rgba(28,25,23, 0.06)` | Modales |

---

## 7. Utility Classes

### .card
```css
.card {
  background-color: var(--ucr-surface-card);
  border: 1px solid var(--ucr-border-subtle);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}
```

### .card-hover
```css
.card-hover {
  transition: box-shadow var(--ucr-duration-fast) var(--ucr-ease-out),
              transform var(--ucr-duration-fast) var(--ucr-ease-out),
              border-color var(--ucr-duration-fast) var(--ucr-ease-out);
}
.card-hover:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--ucr-border-default);
  transform: translateY(-1px);
}
```

### .input-base
```css
.input-base {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--ucr-text-primary);
  background: var(--ucr-surface-card);
  border: 1px solid var(--ucr-border-default);
  border-radius: 8px;
  transition: border-color var(--ucr-duration-fast) var(--ucr-ease-out),
              box-shadow var(--ucr-duration-fast) var(--ucr-ease-out);
}
.input-base:hover {
  border-color: var(--ucr-border-strong);
}
.input-base:focus {
  outline: none;
  border-color: var(--ucr-border-focus);
  box-shadow: 0 0 0 3px rgba(212,175,55, 0.12);
}
```

### .focus-ring
```css
.focus-ring:focus-visible {
  outline: 2px solid var(--ucr-border-focus);
  outline-offset: 2px;
}
```

---

## 8. Plataformas

### Implementacion por plataforma

| Aspecto | Desktop (Tauri) | Web Portal | Admin Portal | Mobile (Expo) |
|---------|----------------|------------|-------------|---------------|
| Tailwind | v3 config JS | v4 inline @theme | v4 inline @theme | NativeWind v4 |
| Tokens | CSS :root | CSS :root + @theme | CSS :root + @theme | tailwind.config.js |
| Animaciones | Framer Motion + CSS | CSS keyframes | CSS keyframes | react-native-reanimated |
| Dark mode | class-based | class-based | class-based | useColorScheme |
| Fonts | Google Fonts CDN | next/font/google | next/font/google | System (default) |

### Mobile: Brand Constants

NativeWind no soporta CSS custom properties. Usar constantes TypeScript:

```ts
// mobile/src/constants/brand.ts
export const BRAND = {
  primary: '#B8860B',
  primaryLight: '#D4AF37',
  primaryDark: '#7C5B07',
  surface: '#F8F7F4',
  text: '#1C1917',
} as const;
```

---

## 9. Contacto y Activos

| Recurso | Ubicacion |
|---------|-----------|
| Logo principal | `frontend/public/logo.png` |
| Icono app | `frontend/public/icon.png` |
| Favicon | `web-portal/public/favicon-32.png` |
| Design tokens (codigo) | `shared/design-tokens.ts` |
| Este documento | `docs/brand/BRAND_GUIDELINES.md` |

---

*Ultima actualizacion: 2026-04-10 | Version: 1.0.0*
