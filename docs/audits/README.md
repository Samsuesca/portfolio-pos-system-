# Sistema de Tracking de Auditorias de Calidad

Sistema de seguimiento iterativo para evaluaciones de calidad del proyecto Uniformes System v2. Cada area del sistema es evaluada por inspectores especializados (Claude Chrome Extension) que califican 10 categorias con nota 1-10 y dan una nota global /100.

## Workflow

```
1. Ejecutar prompt de inspeccion en Claude Chrome Extension
2. El inspector evalua 10 categorias + nota global
3. Registrar resultados: ./docs/audits/scripts/audit-tracker.sh add
4. Corregir los problemas identificados en el reporte
5. Re-evaluar con el mismo prompt
6. Repetir hasta alcanzar el target
```

## Estructura

```
docs/audits/
├── README.md                 # Este archivo
├── scores.csv                # CSV con todas las notas (fuente de verdad)
├── history/                  # Reportes completos por iteracion
│   └── {area}_{fecha}_{version}.md
└── scripts/
    └── audit-tracker.sh      # CLI para registrar evaluaciones
```

## Uso del CLI

```bash
# Ver estado general de todas las areas
./docs/audits/scripts/audit-tracker.sh status

# Registrar una nueva evaluacion (interactivo)
./docs/audits/scripts/audit-tracker.sh add

# Ver historial de un area especifica
./docs/audits/scripts/audit-tracker.sh report api-rest

# Vista ejecutiva con recomendaciones
./docs/audits/scripts/audit-tracker.sh dashboard
```

## Areas de Auditoria

| Area | Descripcion | Donde evaluar | Prompt / Rol |
|------|-------------|---------------|--------------|
| api-rest | Diseno REST de la API | Swagger /docs | Senior API Architect |
| portal-web-conversion | Funnel de conversion del portal | yourdomain.com | CRO Specialist |
| portal-web-mobile | Experiencia mobile del portal | Portal en movil / 375px | Mobile UX Expert |
| portal-web-seo | SEO y discoverability | Portal + DevTools | SEO Specialist |
| app-desktop-pos | Eficiencia del punto de venta | App Tauri - ventas | POS Efficiency Auditor |
| app-desktop-orders | Gestion de pedidos | App Tauri - pedidos | Operations Manager |
| app-desktop-ui | Consistencia visual y componentes | App Tauri - todas las pantallas | React Architect |
| security-owasp | Seguridad OWASP API Top 10 | Swagger /docs | Security Engineer |
| performance | Performance y escalabilidad | Swagger /docs + profiling | Performance Engineer |
| accessibility-wcag | Accesibilidad WCAG 2.2 AA | Portal web | Accessibility Auditor |
| product-market-fit | Product-market fit y estrategia | Todo el sistema | Product Manager |
| compliance-colombia | Cumplimiento normativo colombiano | Swagger - Accounting | Asesor Empresarial CO |
| data-model | Modelo de datos y BD | Swagger schemas | Database Architect |

## Status

| Status | Significado |
|--------|-------------|
| `pending` | Area no evaluada aun |
| `in-progress` | Evaluada pero no alcanza el target |
| `achieved` | Nota >= target en la ultima iteracion |
| `regressed` | Nota bajo el target despues de haberlo alcanzado |

## Convenciones

- **Archivos en history/**: `{area}_{fecha-ISO}_{version}.md` (ej: `api-rest_2026-04-10_v1.md`)
- **Notas**: decimales con un decimal (7.0, 8.5)
- **Fechas**: formato ISO YYYY-MM-DD
- **CSV**: campos vacios = sin evaluar (no "N/A")
- **Maximo**: 10 iteraciones por area

## Historial de Evaluaciones

### api-rest (API REST Design)

| Iter | Fecha | Global | Delta |
|------|-------|--------|-------|
| v1 | 2026-04-10 | 58.5 | - |
| v2 | 2026-04-11 | 67.0 | +8.5 |
| v3 | 2026-04-12 | 78.0 | +11.0 |

Reportes: [v1](history/api-rest_2026-04-10_v1.md) | [v2](history/api-rest_2026-04-11_v2.md) | [v3](history/api-rest_2026-04-12_v3.md)

### security-owasp (OWASP API Security Top 10)

| Iter | Fecha | Global | Delta |
|------|-------|--------|-------|
| v1 | 2026-04-12 | 35.0 | - |

Reportes: [v1](history/security-owasp_2026-04-12_v1.md)
