# Dimensión 8 — Tecnológico (Propiedad Intelectual del Software)

> **Última actualización:** 2026-05-04
> **Owner:** Angel Suesca (autor del software, titular del copyright actual) + Carmen Consuelo Ríos (titular del negocio que lo opera) + (pendiente) Asesor PI / mercantil
> **Criticidad global:** 🟠 ALTA (🔴 si se confirma v3.2)
> **% Formalización estimado:** 20%
> **Fuentes documentales:** auditoría de código sobre branch `main` (2026-05-04) + LICENSE + `docs/architecture/`.

---

## Resumen ejecutivo

Esta es la dimensión que **más diverge del estado del resto del negocio**: el código fuente es robusto y profesionalmente estructurado, pero el marco de propiedad intelectual y comercialización tiene **tres problemas estructurales** que invalidan el plan de v3.2 (comercializar SaaS) tal como está hoy:

1. **Licencia MIT en el repo raíz** ([`LICENSE`](../../../LICENSE)) — confirmada por el owner como **resultado del template inicial, no decisión intencional**. Bajo MIT, cualquiera puede tomar el código, modificarlo, **re-licenciarlo y revenderlo como SaaS competidor** sin pagar regalías a UCR. Esto es incompatible con v3.2.

2. **Desacople de propiedad intelectual entre el autor del software y la dueña del negocio.** El header de `LICENSE` declara: `Copyright (c) 2025 Angel Samuel Suesca Rios`. El RUT del negocio operativo está a nombre de **Carmen Consuelo Ríos Cartagena** (NIT 42779422-1, ver `01-legal-corporativo.md`). UCR opera un software cuya titularidad es de un tercero, **sin contrato escrito** que regule esa relación.

3. **La arquitectura multi-tenant actual no soporta SaaS.** Según [`docs/architecture/multi-tenant-design.md`](../../../docs/architecture/multi-tenant-design.md), la multi-tenancy actual es **a nivel de colegio dentro del mismo negocio**. No existe el concepto de `business_id` / `tenant_id` que aísle clientes SaaS distintos. La contabilidad es **global y compartida** por diseño. Para v3.2 hace falta una refactorización mayor.

A esto se suma: marca no registrada, dominio sin claridad sobre titular, sin política de control de repos, sin acuerdos con dependencias externas, y el repositorio público en GitHub bajo MIT.

---

## Marco normativo aplicable

| Norma | Aplicación a UCR |
|-------|------------------|
| **Decisión 351 de 1993 (CAN)** | Régimen común sobre derecho de autor — software es **obra protegida** desde su creación, sin necesidad de registro |
| **Ley 23 de 1982** + **Ley 44 de 1993** + **Ley 1915 de 2018** | Derecho de autor colombiano — completa Decisión 351, regula registros DNDA |
| Decisión 486 de 2000 (CAN), Art. 15 lit. e | **Software no es patentable** en Colombia. Protección únicamente vía derecho de autor + secreto empresarial |
| **Ley 256 de 1996** | Competencia desleal — secretos empresariales (Art. 16) protegen lógica de negocio, algoritmos, base de clientes |
| Decreto 1066 de 2015 | Reglamenta DNDA y registro voluntario |
| Ley 527 de 1999 | Mensaje de datos, firma electrónica, validez del contrato de licencia digital |
| Ley 1581 de 2012 (cruzado con dim. 5) | Datos personales — UCR como encargado del tratamiento de datos de clientes SaaS |
| Ley 1480 de 2011 (cruzado con dim. 6) | Estatuto del Consumidor — aplica a relación con clientes SaaS si son consumidores |
| Convenio de Berna + Tratado OMPI | Reciprocidad internacional de protección |

> **Nota PI:** los derechos morales del autor (Art. 11 Ley 23/1982) son **irrenunciables y perpetuos** — Angel mantiene el derecho a ser reconocido como autor incluso si cede los patrimoniales a UCR/S.A.S. Solo los derechos patrimoniales (reproducción, distribución, comunicación pública, transformación) se ceden.

---

## Estado actual

### Repositorio y licencia

| Aspecto | Valor |
|---------|-------|
| Repo principal | `uniformes-system-v2` |
| Visibilidad | Por confirmar (verificar en GitHub: ¿público o privado?) |
| Licencia raíz | **MIT** (`LICENSE` con copyright `2025 Angel Samuel Suesca Rios`) |
| Sublicencias por subproyecto | Ninguna distinta declarada (heredan MIT) |
| Cláusula de patentes | No (MIT no incluye protección de patentes) |
| Cláusula de marcas | No |
| Atribución requerida | Solo aviso de copyright en copias |
| **Riesgo si v3.2 procede** | Cualquier tercero (incluido un competidor) puede clonar el repo, hostear el SaaS bajo otra marca, y vendérselo a la misma audiencia objetivo de UCR |

### Propiedad intelectual del software

| Aspecto | Estado | Riesgo |
|---------|--------|--------|
| Autor declarado | Angel Samuel Suesca Rios | — |
| Año de creación declarado | 2025 | UCR opera desde 2016 (operación informal) — el **software** es nuevo, el negocio no. Coherente |
| Cesión de derechos patrimoniales del autor a UCR / Carmen Consuelo | **No existe** documento escrito | Si Angel se ausenta del proyecto, no hay base contractual para que UCR siga usando, modificando, o explotando el software |
| Registro en DNDA | No registrado (verificar) | Sin registro: la protección legal **existe igual** (Art. 9 Ley 23/1982), pero registrado da fecha cierta de creación y facilita litigios |
| Acuerdo de confidencialidad / no competencia con el autor | **No existe** | Nada impide que Angel desarrolle un competidor o licencie el código a otra empresa |
| Trade secrets identificados | No documentados | El cost breakdown system, el modelo financiero, las reglas de descuento, el flujo de garantías son ventajas competitivas potenciales sin protección explícita |

### Arquitectura multi-tenant — gap para SaaS

> Auditoría sobre [`docs/architecture/multi-tenant-design.md`](../../../docs/architecture/multi-tenant-design.md).

**Estado actual: multi-tenancy a nivel de COLEGIO dentro de UN negocio (UCR).**

```
┌──────────────────────────────────────┐
│   UCR (un solo negocio)              │
│  ┌────────────┐  ┌────────────┐     │
│  │ Colegio A  │  │ Colegio B  │     │
│  │ (school_id)│  │ (school_id)│     │
│  └────────────┘  └────────────┘     │
│   Comparten: caja, banco, EEFF       │
│              users, accounting       │
└──────────────────────────────────────┘
```

**Estado requerido para v3.2 SaaS:**

```
┌──────────────────────────────────────────────┐
│ UCR Platform (proveedor SaaS)               │
│ ┌─────────────────┐  ┌─────────────────┐   │
│ │ Cliente UCR     │  │ Cliente "X"     │   │
│ │ (tenant_id)     │  │ (tenant_id)     │   │
│ │ ├ Colegio A     │  │ ├ Colegio M     │   │
│ │ ├ Colegio B     │  │ ├ Colegio N     │   │
│ │ └ contabilidad  │  │ └ contabilidad  │   │
│ │   propia        │  │   propia        │   │
│ └─────────────────┘  └─────────────────┘   │
│   AISLADOS: cajas, EEFF, users, FE DIAN     │
└──────────────────────────────────────────────┘
```

**Cambios requeridos** (alto nivel):
- Nueva tabla raíz `tenants` (o `businesses`) con su propio NIT, RUT, configuración fiscal.
- Todas las tablas hoy "globales" (`balance_accounts`, `expenses`, `users`, `cash_drawer`, `payment_transactions`) deben pasar a tener `tenant_id`.
- `schools` queda como hijo de `tenants` (`tenants.id` → `schools.tenant_id`).
- Sistema de permisos debe respetar la jerarquía `tenant → school → user`.
- Configuración por tenant: resolución DIAN, proveedor FE, política de privacidad, T&C, branding.
- Aislamiento de datos: middleware que inyecte `tenant_id` en todas las queries (PostgreSQL Row-Level Security es una opción).
- FE multi-tenant (cruzado con `02-tributario.md`): cada tenant tiene su propia resolución y proveedor.

**Esfuerzo estimado:** 4-8 semanas de desarrollo intenso + migración de datos productivos. Cruzado con la planeación de [docs/v3-branch-architecture/](../../../docs/v3-branch-architecture/).

### Stack tecnológico — licencias de dependencias

| Capa | Tecnología | Licencia | Compatible con uso comercial |
|------|------------|----------|------------------------------|
| Backend | FastAPI | MIT | ✅ |
| Backend | SQLAlchemy 2.0 | MIT | ✅ |
| Backend | Pydantic v2 | MIT | ✅ |
| Backend | structlog | Apache 2.0 / MIT | ✅ |
| DB | PostgreSQL 15 | PostgreSQL License (similar a BSD) | ✅ |
| DB | Redis | RSALv2 + SSPLv1 (Redis 7.4+) | ⚠️ **Verificar versión**. Redis 7.4+ ya no es OSS estricto — restringe a competidores ofrecer Redis-as-a-Service. UCR usa Redis local, sin riesgo, pero documentar |
| Frontend desktop | Tauri 2.x | MIT / Apache 2.0 | ✅ |
| Frontend desktop | Rust | MIT / Apache 2.0 | ✅ |
| Frontend web | Next.js | MIT | ✅ |
| Frontend web | React 18-19 | MIT | ✅ |
| Frontend mobile | Expo SDK 54 | MIT | ✅ |
| Frontend mobile | React Native | MIT | ✅ |
| Estilos | Tailwind CSS | MIT | ✅ |
| Estado | Zustand | MIT | ✅ |
| Animación | Framer Motion | MIT | ✅ |
| Pagos | Wompi SDK | Propietaria de Bancolombia / Wompi | ✅ con T&C |
| Hosting | Vultr | Comercial | ✅ con T&C |

> **Hallazgo:** stack mayoritariamente **OSS permisivo (MIT/Apache)** — sin riesgo de copyleft (no hay GPL/AGPL contaminantes). Esto **permite** licenciar UCR como propietario sin obligación de abrir código. Sin embargo, los términos de Redis 7.4+ deben revisarse si UCR planea ofrecerse como servicio gestionado a clientes (no es el caso hoy con `redis local`).

### Repositorio y control de acceso

| Aspecto | Estado |
|---------|--------|
| Plataforma | GitHub (repo `uniformes-system-v2`, owner GitHub: `Samsuesca`) |
| Visibilidad | Verificar (público vs. privado) |
| Branch protection en `main` | Documentado en CLAUDE.md como deseable, **no verificado en config real** |
| Código firmado (GPG) | No documentado |
| 2FA en cuentas con acceso | Desconocido |
| Lista de personas con acceso al repo | No documentada formalmente |
| Backup del código fuera de GitHub | No documentado |

### Dominio y activos digitales

| Activo | Titular registrado | Vencimiento | Riesgo |
|--------|-------------------|-------------|--------|
| `yourdomain.com` | **Por confirmar** (whois) | Por confirmar | Si está a nombre personal y no de UCR/S.A.S, riesgo de pérdida ante cambio de relación |
| Cuenta Vultr (VPS) | **Por confirmar** | — | Mismo riesgo |
| Cuenta Wompi | A nombre del comerciante (Carmen Consuelo, vinculada al NIT) | — | OK si está a nombre del titular del RUT |
| Bot Telegram (token) | Vinculado a una cuenta personal | — | Si la cuenta personal cambia, el bot se pierde |
| Cuenta Resend / SMTP (verificar proveedor) | Por confirmar | — | Mismo riesgo |
| Repo GitHub | Cuenta personal `Samsuesca` | — | El día que el repo se mueva a una org de UCR/S.A.S, hay que mover history y secrets |

---

## Gaps identificados

### Gap 8.1 — Licencia MIT incompatible con plan SaaS v3.2 🔴

**Problema:** MIT permite a cualquiera tomar el código y revenderlo como competidor. Para v3.2 (comercialización del software como SaaS) la licencia debe ser **propietaria** o al menos con cláusulas de no comercialización si quieres mantener apertura.

**Acción:**
1. **Decisión estratégica del owner**:
   - **Opción A: Propietaria pura.** Cambiar `LICENSE` a `LICENSE-COMMERCIAL.md` con derechos reservados. Repo en GitHub debe pasar a privado.
   - **Opción B: Open-core (código base abierto + features comerciales privadas).** Mantener parte del código bajo licencia permisiva (ej. MIT) y mover features de v3.2 SaaS (multi-tenant, FE multi-tenant, billing) a un repo privado bajo licencia propietaria.
   - **Opción C: Source-available.** Licencia tipo BSL (Business Source License) — código visible, no comercializable por terceros durante N años, después libera.
2. Una vez decidida, redactar la nueva licencia con apoyo de asesor (cláusulas de patentes, marcas, terminación, foro).
3. Reemplazar `LICENSE` y agregar headers en archivos clave (`backend/app/main.py`, `frontend/src-tauri/src/main.rs`, etc.).
4. Notificar a contribuidores externos (si los hay) — verificar git history.
5. Eliminar el archivo MIT del git history **NO** es necesario y de hecho complica más; basta con cambiar la licencia hacia adelante. Cualquier copia del código bajo MIT antes del cambio sigue válida bajo MIT — **éste es el riesgo concreto**, y sólo se mitiga si el repo nunca fue público.

> **Pregunta de discovery dependiente:** ¿el repo `uniformes-system-v2` ha sido alguna vez público en GitHub? Si sí, técnicamente cualquier copia bajo MIT existente sigue siendo válida. Si siempre fue privado, el cambio de licencia es directo.

---

### Gap 8.2 — Desacople de PI entre autor del software y dueña del negocio 🔴

**Problema:** Angel es autor del software y titular del copyright. Carmen Consuelo es la dueña del negocio que lo opera. **No hay contrato** que documente la relación. Riesgos materiales:
- Si Angel se ausenta del proyecto, UCR pierde derecho de uso, modificación y explotación.
- Si UCR es vendida o constituida como S.A.S, Angel no es socio salvo aporte explícito.
- Si Angel desarrolla un producto similar, no hay no-competencia.
- Para v3.2, la persona que vende el SaaS debe ser titular del software, o tener licencia del titular.

**Acción (urgente, antes de cualquier paso de v3.2):**

1. **Decisión estructural** entre dos modelos:
   - **Modelo A: Cesión.** Angel cede los derechos patrimoniales del software a Carmen Consuelo / futura S.A.S, a cambio de remuneración (acciones de la S.A.S, regalías, salario, mix).
   - **Modelo B: Licencia.** Angel mantiene la titularidad y le otorga a UCR/S.A.S una **licencia exclusiva** o no-exclusiva con condiciones (regalías, plazo, territorio, etc.).
   - **Modelo C: Co-titularidad.** Constituir desde el inicio una S.A.S con Angel y Carmen Consuelo como socios (o equivalente) y aportar el software al patrimonio de la sociedad.
2. **Cualquiera de los tres** debe quedar por **escrito y firmado** antes de v3.2 (oct 2026). Decisión recomendable: **Modelo C** si la relación es de socios, **Modelo A** si la relación es netamente laboral/comercial.
3. Costo estimado de redacción + revisión: $2M–$5M COP con abogado especializado.
4. Cruzado con `01-legal-corporativo.md` Gap 1.1 (constitución S.A.S): la decisión sobre IP debe tomarse **al mismo tiempo** que la decisión de constituir S.A.S.

---

### Gap 8.3 — Arquitectura no SaaS-ready 🔴

**Problema:** sin `tenant_id` no se pueden tener clientes SaaS aislados. La contabilidad global compartida es por diseño actual.

**Acción:**
1. Plan técnico detallado en [docs/v3-branch-architecture/](../../../docs/v3-branch-architecture/) (ya iniciado por el owner según el README).
2. Migración por fases:
   - Fase 1: agregar `tenant_id` opcional a tablas globales (NULL para UCR).
   - Fase 2: backfillar `tenant_id` para UCR existente.
   - Fase 3: hacer `tenant_id` NOT NULL.
   - Fase 4: middleware de aislamiento con PostgreSQL RLS o aplicación.
   - Fase 5: configuración por tenant (FE, branding, T&C, política privacidad).
3. Esfuerzo: 4-8 semanas dev + 1-2 semanas QA + migración productiva con ventana de mantenimiento.
4. Costo: trabajo de Angel + posibles refuerzos.

---

### Gap 8.4 — Dominio y activos digitales sin claridad de titularidad 🟠

**Problema:** dominio `yourdomain.com`, cuenta Vultr, repo GitHub probablemente están a nombre personal. En el momento que se constituya S.A.S o si la relación cambia, hay que migrar — y eso siempre tiene fricción.

**Acción:**
1. Hacer **whois** sobre el dominio: `whois yourdomain.com`.
2. Inventariar todos los activos digitales y su titular: Vultr, GitHub, Wompi, Resend, Telegram, Cloudflare (si aplica), Google Analytics (si aplica), redes sociales (Facebook/Instagram), Mercado Libre o canales de venta secundarios.
3. Plan de migración a futura S.A.S (cuando se constituya): pasar dominio, transferir cuenta Vultr o aceptar facturas en otro nombre, mover repo a una org de GitHub, actualizar API keys de Wompi al NIT de la S.A.S.
4. Documentar todo en [docs/operations/digital-assets-inventory.md](../../../docs/operations/digital-assets-inventory.md).

---

### Gap 8.5 — Sin registro DNDA del software 🟡

**Problema:** la protección de derecho de autor existe **desde la creación** sin necesidad de registro (Decisión 351). Pero el registro voluntario en la **Dirección Nacional de Derecho de Autor** da fecha cierta, presunción de titularidad y facilita litigios.

**Acción:**
1. Registrar el software como **obra inédita** en la DNDA (https://derechodeautor.gov.co).
2. Costo: ~$50.000 COP por registro + tiempo de tramitación 30-60 días.
3. Acompañar con depósito legal del código fuente (CD/USB con copia firmada).
4. Renovar el registro al cambiar de licencia o al hacer modificaciones sustanciales.

---

### Gap 8.6 — Sin acuerdos de confidencialidad y no competencia 🟠

**Problema:** Angel hoy tiene acceso completo al código, datos, contabilidad, secretos productivos. Sin NDA / acuerdo de no-competencia, no hay barrera legal para usar ese conocimiento en otro proyecto.

**Acción:**
1. **NDA** estándar + cláusula de propiedad de obra derivada por servicios (work for hire).
2. **Acuerdo de no-competencia** con duración razonable (12-24 meses post-relación, sector específico, ámbito geográfico Colombia).
3. Aplicar también a futuros desarrolladores o contractors que se sumen.
4. Cruzado con dim. 4 si Angel queda formalmente vinculado como empleado o contratista.

---

### Gap 8.7 — Sin política de control de acceso al repo 🟡

**Problema:** GitHub es la fuente única del código. Sin branch protection, 2FA, code review obligatorio, el repo es vulnerable a cambios accidentales o malintencionados.

**Acción:**
1. Activar **branch protection** en `main`: requerir PR, requerir 1+ aprobación (cuando haya >1 contributor), requerir status checks pasando.
2. Activar **2FA obligatorio** para todos los miembros con acceso al repo.
3. Habilitar **Dependabot** (alerts + security updates) — gratis para repos públicos y privados.
4. Code scanning con CodeQL (gratis, integración nativa GitHub).
5. Inventariar usuarios con acceso y aplicar principio de mínimo privilegio.

---

### Gap 8.8 — Sin estrategia de protección de trade secrets 🟡

**Problema:** la ventaja competitiva de UCR no está en el código (que es replicable) sino en la **lógica de negocio**: cost breakdown system, modelo financiero, reglas de descuento, flujo de garantías, integración Wompi+Telegram, sistema de permisos endurecido. Estos elementos son trade secrets bajo Ley 256/1996 si:
- Tienen valor comercial por ser secretos.
- Se han tomado medidas razonables para mantenerlos en secreto.
- No son conocidos por personas del medio.

**Acción:**
1. Identificar y listar los trade secrets (hacer `docs/operations/trade-secrets.md` privado).
2. Marcar los archivos del código que los implementan con header `Confidential — Trade Secret of UCR`.
3. Acceso restringido en repo (ramas privadas si aplica, o módulo separado).
4. NDA + cláusula específica de trade secrets para todo personal y contratista.
5. En contratos B2B y SaaS (cruzado con dim. 6), incluir cláusula de **prohibición de ingeniería inversa**.

---

### Gap 8.9 — Compatibilidad de licencias de dependencias para SaaS 🟡

**Problema:** auditoría general OK, pero hay que **documentar** y vigilar Redis (cambió a RSALv2/SSPLv1 en 7.4+).

**Acción:**
1. Generar SBOM (Software Bill of Materials) en cada release: `pip-licenses` para Python, `license-checker` para JS.
2. Revisar nuevas dependencias antes de añadir.
3. Documentar en [docs/architecture/licenses-audit.md](../../../docs/architecture/licenses-audit.md).
4. Si Redis se vuelve incompatible: alternativas son ValKey (fork OSS) o KeyDB.

---

## Roadmap de cierre

> **Lógica de priorización:** los gaps 🔴 (8.1 Licencia, 8.2 PI desacoplada, 8.3 SaaS-ready) son **bloqueantes absolutos** de v3.2. Sin ellos resueltos, no hay producto vendible. Los 🟠 (8.4 activos, 8.6 NDA) protegen el negocio frente a contingencias. Los 🟡 son higiene técnica.

| ID | Acción | Prioridad | Driver | Plazo | Costo estimado | Dependencia |
|----|--------|-----------|--------|-------|----------------|-------------|
| T1 | Decisión estratégica modelo de licencia (propietaria / open-core / BSL) y redacción de nueva LICENSE | 🔴 | Bloqueante v3.2 | <60 días | $1M–$3M asesor PI | Decisión owner |
| T2 | Verificar visibilidad histórica del repo + cambiar a privado si está público | 🔴 | Mitigación riesgo MIT | <14 días | $0 | T1 (opcional) |
| T3 | Contrato escrito autor↔negocio (cesión / licencia / co-titularidad). Cruzado con S.A.S | 🔴 | Bloqueante v3.2 + protección operación | <90 días | $2M–$5M asesor | Cruzado L1 (`01-legal-corporativo.md`) |
| T4 | Plan técnico v3.2 SaaS-ready (tenant_id, RLS, FE multi-tenant, billing) ejecutado | 🔴 | Bloqueante v3.2 | abr–oct 2026 | 4-8 semanas dev | T3, dim. 5 (privacidad multi-tenant), dim. 6 (T&C SaaS) |
| T5 | Inventario de activos digitales + plan de migración a S.A.S | 🟠 | Continuidad ante cambio de figura legal | <60 días | 1 día owner | L1 (S.A.S) |
| T6 | NDA + no competencia + IP assignment con Angel y futuros contractors | 🟠 | Protección conocimiento operativo | <60 días | $500k–$1M plantillas | T1, T3 |
| T7 | Registro DNDA del software | 🟡 | Fecha cierta de creación + facilita litigio | <120 días | ~$50k | T1 |
| T8 | Branch protection + 2FA + Dependabot + code scanning + acceso mínimo privilegio en GitHub | 🟡 | Higiene de seguridad | <30 días | $0 | — |
| T9 | Documentar trade secrets + headers en archivos sensibles + cláusulas anti-ingeniería inversa en contratos SaaS | 🟡 | Protección competitiva | <90 días | 1-2 días + plantillas | T6, T1 |
| T10 | Auditoría de licencias de dependencias + SBOM por release | 🟡 | Cumplimiento + monitoreo Redis y otras | <60 días | 1-2 días setup | — |

---

## Conexión con releases técnicos

| Release | Requisito tecnológico-PI | Driver |
|---------|--------------------------|--------|
| v3.0 (abr 2026) | T8 (higiene GitHub), T2 (visibilidad repo) | Cumplimiento mínimo + decisión sobre exposición pública |
| v3.1 (jun 2026) | T5 (activos digitales si S.A.S), T6 (NDA con personal nuevo del segundo local) | Multi-branch + nuevos vínculos laborales |
| v3.2 (oct 2026) | **T1 + T3 + T4 son requisitos obligatorios** | Sin licencia propietaria, contrato de cesión y arquitectura SaaS-ready, **NO hay v3.2** |

> **Nota crítica de planeación v3.2:** los hitos T1, T3 y T4 deben **comenzar en mayo-junio 2026** para tener margen de finalizar antes de octubre. Si no, v3.2 se traslada a 2027.

---

## Pendientes de discovery (necesitan input del owner)

1. **Visibilidad histórica del repo `uniformes-system-v2`**: ¿alguna vez fue público en GitHub? ¿Algún fork? Verificar en GitHub: `https://github.com/Samsuesca/uniformes-system-v2/forks` y `https://github.com/Samsuesca/uniformes-system-v2/network/members`.

2. **Modelo de licencia preferido para v3.2**: ¿propietaria pura, open-core (parte abierta + parte cerrada), o source-available (BSL)? Cada una tiene tradeoffs. Recomendación inicial: propietaria pura para v3.2 + considerar open-core a futuro si crece comunidad.

3. **Modelo de relación Angel↔UCR↔S.A.S futura**: cesión de IP, licencia con regalías, o co-titularidad como socio. Necesita decisión antes de constituir S.A.S.

4. **Dominio y cuentas de terceros — titular real**: ¿`yourdomain.com` está registrado a nombre personal de Angel, de Carmen Consuelo, o de alguna otra figura? Lo mismo para Vultr, Wompi, Telegram bot, redes sociales.

5. **Repos secundarios**: ¿hay forks privados, repos asociados (`finance-manager`, `wristband`, `in-flow`, `portfolio-pos-system` mencionados en CLAUDE.md global) que compartan código con UCR? ¿Riesgo de copia inadvertida?

6. **Contractors externos**: ¿alguien además de Angel ha contribuido al código? Si sí, hay que verificar que no haya derechos pendientes de cesión.

7. **Trade secrets — qué quieres proteger**: cuáles componentes son los "joyas de la corona" que justifican defenderse en juicio. Recomendación: cost breakdown system, modelo financiero, sistema de permisos endurecido, integración Wompi+Telegram.

8. **Mercado objetivo del SaaS**: ¿otros uniformes escolares, retail similar (calzado, papelería), comercio formal en general? Esto define el tamaño del mercado y la urgencia/inversión en T4 y dim. 6 C9.

9. **Política sobre apertura del código**: ¿hay valor estratégico en mantener parte del código abierto (atraer talento, branding técnico, comunidad)? Open-core podría servir.

10. **Registro de marca + dominio + repo + S.A.S — orden de operaciones**: para optimizar costos y reducir migraciones, podría tener sentido (a) decidir nombre comercial definitivo, (b) constituir S.A.S, (c) registrar marca a nombre de S.A.S, (d) transferir activos digitales a S.A.S, (e) registrar software en DNDA a nombre de S.A.S. Confirmar si este orden funciona para tu calendario.

---

## Decisiones pendientes del owner

- [ ] **Modelo de licencia para v3.2** (propietaria / open-core / BSL).
- [ ] **Modelo de IP entre Angel y UCR** (cesión / licencia / co-titularidad).
- [ ] **Visibilidad del repo principal** (público / privado) tras decisión de licencia.
- [ ] **Plan de constitución de S.A.S** acoplado a transferencia de activos digitales y software.
- [ ] **Inversión en asesor PI** ($2M–$8M COP combinado entre licencia, contrato de cesión y NDA).
- [ ] **Registro DNDA** sí o no (recomendación: sí, costo bajo, beneficio probatorio alto).
- [ ] **Decisión open-core** si aplica — cuáles módulos quedan abiertos vs cerrados.
