# Presentación al equipo — Lanzamiento v3 + Roadmap + Requerimientos

> **Estado:** PENDIENTE DE DISEÑAR.
> **Trigger:** deploy completo de v3 en producción, estable (~1 semana sin issues mayores).
> **Audiencia:** Consuelo (Owner), Felipe (Líder operativo + Documentador), Salomé (Marketing + CX), Santiago (Analista financiero, ½ tiempo). Angel facilita.
> **Owner del diseño:** Angel.
> **Última actualización:** 2026-05-24.

---

## 1. Por qué esta presentación existe

El roadmap del equipo (nueva nómina formalizada, bitácoras individuales, ruta Platzi específica, camino a equity, pattern Consuelo↔Felipe para documentación) y el release v3 son **cambios estructurales que afectan directamente a cada persona del equipo**. Hasta hoy se han discutido informalmente y en sesiones 1-1 parciales; falta una **comunicación formal grupal** que alinee a los 5 sobre:

1. Qué cambia en el sistema técnico (v3) y cómo afecta su operación diaria.
2. Cuál es el plan para cada uno como persona dentro de la empresa (rol, formación, compensación, camino a equity).
3. Qué se espera de cada uno desde el día 1 post-presentación (compromisos firmados, primeros entregables, ritmo de seguimiento).

Sin esta presentación, el riesgo es que el equipo perciba los cambios como improvisaciones top-down en lugar de un plan integral. Con ella, **todos firman desde un mismo entendimiento**.

---

## 2. Cuándo — Trigger y anti-trigger

**Trigger (dispara la presentación):**
- Deploy completo de v3 confirmado en producción.
- Al menos 1 semana de operación estable post-deploy (sin issues mayores que distraigan).
- Disponibilidad simultánea de los 5 miembros del equipo.

**Anti-trigger (NO presentar todavía si):**
- v3 no está en producción → genera expectativa sin sustancia técnica.
- v3 recién deployeada con bugs → la conversación se contamina con ruido operativo.
- Algún miembro del equipo está en proceso de salida o conflicto abierto → resolver antes.

---

## 3. Contenido a cubrir (3 bloques)

### Bloque 1 — v3 en producción (qué cambió en el sistema)

`[A llenar cuando v3 esté lista para deploy]`. Posibles temas según lo que efectivamente entre en producción:
- Cambios en flujo de venta / inventario / accounting que afectan operación diaria.
- Nuevos permisos / roles del sistema.
- Nuevas tabs / reportes / módulos que el equipo va a usar (incluido el módulo de nómina poblado y el MF de escenarios de nómina).
- Lo que se rompe del workflow anterior y cómo se reemplaza.
- Quién es power-user de cada módulo (Felipe → operación + nómina; Salomé → catálogo + marketing; Santiago → MF + reportes financieros).

### Bloque 2 — Roadmap del equipo

Referencia base: [`equipo-roadmap-2026.md`](equipo-roadmap-2026.md) + [`bitacoras/`](bitacoras/).

Temas:
- **Estructura de tracks**: Owner (Consuelo), Cofundador tech (Angel), Joven (Felipe / Salomé / Santiago).
- **Cap table indicativo post-SAS** y por qué tiene esa forma (sin números cerrados aún, framework).
- **3 fases de compensación**: Fase 1 intermedia (auxilios + SS independiente) → Fase 2 contrato formal SAS (cost-to-company ~$3.09M/joven) → Fase 3 activación de equity (cliff 12m + vesting 4 años, condicionado a estabilidad financiera).
- **Modelo 40h operación + 8h estudio** con bono condicionado a evidencia mensual.
- **Ruta Platzi personalizada** por persona (mostrar las 7 cursos de Felipe y los 11 de Salomé como cosas ya activas).
- **Pattern Consuelo ↔ Felipe**: ella transfiere, él documenta estructuradamente en `estabilizacion_*`.
- **Bitácoras vivas** entregadas a cada persona en la reunión (impresas o link).

### Bloque 3 — Requerimientos y compromisos

Cada persona se lleva un set explícito de compromisos:

**Consuelo:**
- Sesiones mensuales de transferencia de conocimiento con Felipe.
- Validar SOPs producidos por Felipe antes de marcarlos como activos.
- Mantener su rol operativo + mentoría al equipo joven.

**Felipe:**
- Firmar carta de intención Fase 1.
- Afiliarse a EPS/AFP/ARL como independiente (UCR transfiere mensualmente $499k).
- Compromiso con backlog D1-D7 (documentación) + O1-O3 (operativo) de su bitácora.
- Avanzar 1 curso Platzi por mes según orden propuesto.
- Mantener inventario maestro de procedimientos actualizado.

**Salomé:**
- Firmar carta de intención Fase 1.
- Afiliarse a EPS/AFP/ARL como independiente.
- Compromiso con backlog P1-P7 de su bitácora.
- Avanzar 1-2 cursos Platzi por mes según orden propuesto.

**Santiago (medio tiempo):**
- Firmar carta de intención Fase 1 con condiciones de medio tiempo.
- Afiliarse a EPS/AFP/ARL como independiente.
- Compromiso con backlog de analista financiero (medio tiempo, todo a la mitad).
- Avanzar cursos Platzi de su ruta (a confirmar).

**Angel:**
- Mentoría 1-1 mensual con cada uno.
- Constitución SAS según roadmap (target ~jul-sep 2026).
- Configuración Google OAuth en prod + replicación de emails (ver [`docs/deployment/google-oauth-prod-runbook.md`](../../../deployment/google-oauth-prod-runbook.md)).
- Validación trimestral del cumplimiento de compromisos.

---

## 4. Lo que debe quedar diseñado ANTES de la presentación

Sin estos artefactos, la presentación se siente improvisada:

- [ ] **Slides / agenda concreta** del orden de los 3 bloques (~60-90 min total).
- [ ] **Bitácora impresa o digital** por persona, entregada al inicio de la reunión.
- [ ] **Plantilla de carta de intención Fase 1** (redactada, idealmente revisada por asesor laboral). Cada persona la firma al cierre de la presentación o en los siguientes 7 días.
- [ ] **Cronograma de afiliación SS** (EPS/AFP/ARL): lista de oficinas, instructivo paso a paso, ventana de 14 días.
- [ ] **Calendario de mentorías** mensual para los próximos 3 meses (Angel con cada uno + Consuelo con Felipe).
- [ ] **Definición del primer entregable** de cada persona en los 30 días siguientes (anclado en su bitácora).

---

## 5. Formato — A decidir

Opciones para evaluar:

| Formato | Tiempo | Pros | Contras |
|---------|--------|------|---------|
| Reunión presencial 90 min | 1.5h | Energía, firma física en sitio, sensación de hito | Coordinación de agenda de 5 personas |
| Reunión presencial + cena al final | 3h | Memorable, refuerza vínculo familiar/empresa | Más costo logístico |
| Sesión Zoom + doc compartido | 1h | Más fácil de agendar | Menos peso simbólico para un cambio estructural |
| Pre-lectura + reunión corta | 1h reunión + lectura previa | Equipo llega informado, reunión enfocada en preguntas | Riesgo que no lean |

Recomendación tentativa: **presencial 90 min** porque marca el hito.

---

## 6. Pasos previos al disparo

- [ ] Confirmar fecha de deploy completo de v3.
- [ ] Esperar 1 semana de operación estable post-deploy.
- [ ] Diseñar contenido del Bloque 1 con base en lo que efectivamente cambió en v3.
- [ ] Tener el módulo de nómina poblado en prod (script `seed_team.py` ya corrido contra prod).
- [ ] Tener Google OAuth ya activo en prod (runbook completo ejecutado).
- [ ] Agendar fecha + lugar.
- [ ] Pre-conversar 1-1 con Consuelo para asegurar alineación antes del grupal (ella es la pieza emocionalmente más sensible al cambio).

---

## 7. Referencias

- [equipo-roadmap-2026.md](equipo-roadmap-2026.md) — Master roadmap del equipo.
- [bitacoras/](bitacoras/) — Bitácora individual de cada persona.
- [../estabilizacion_operacional/procedimientos-inventario-maestro.md](../estabilizacion_operacional/procedimientos-inventario-maestro.md) — Inventario de SOPs (Felipe lo mantiene).
- [../../../deployment/google-oauth-prod-runbook.md](../../../deployment/google-oauth-prod-runbook.md) — Runbook OAuth (paso previo).
