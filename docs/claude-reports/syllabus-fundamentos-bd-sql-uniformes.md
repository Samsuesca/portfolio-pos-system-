# Syllabus: Fundamentos de BD & SQL → Verificación en Producción con Claude Code

**Curso base:** Platzi — Fundamentos de Bases de Datos y SQL (Walter Calcagno, 25 clases, 4h contenido)
**Proyecto de referencia:** Uniformes Consuelo Rios — Multi-Tenant POS & ERP (FastAPI + SQLAlchemy + PostgreSQL 15)

---

## Filosofía del Syllabus

Cada módulo del curso enseña un concepto fundamental. Este syllabus te dice **qué verificar en tu sistema real** después de aprender cada concepto, y **qué comando de `/deep-dive` usar** en Claude Code para llevarlo al nivel de industria. No se trata de repetir lo que dice el curso, sino de usarlo como disparador para auditar y mejorar tu producción.

---

## MÓDULO 1 — Fundamentos del Modelo Relacional (Clases 1–6)

### Lo que cubre el curso
Modelado de negocio, entidades, atributos, PKs, FKs, relaciones 1:1, 1:N, N:M, diagramas ER con crow’s foot, y normalización (1FN, 2FN, 3FN).

### Qué verificar en Uniformes Consuelo Rios

#### 1.1 — Modelo de dominio vs. modelo de datos
Tu sistema tiene entidades clave: escuelas (tenants), productos (uniformes), inventario por talla, pedidos, devoluciones, caja global, clientes. ¿Tu modelo SQLAlchemy refleja fielmente las reglas de negocio o tiene atajos que acumulan deuda técnica?

```
/deep-dive audit → Pídele que lea backend/app/models/ completo y te muestre:
  - Entidades que violan 2FN o 3FN (datos duplicados entre tablas)
  - Relaciones N:M que no tienen tabla intermedia explícita
  - Atributos que deberían ser entidades propias (ej: tallas hardcodeadas vs tabla de tallas)
```

#### 1.2 — Normalización en producción
El curso transforma un Excel plano a un modelo limpio. Tu sistema nació como código, pero ¿alguna tabla acumula columnas que deberían vivir en su propia entidad? ¿La tabla de inventario tiene datos de producto embebidos en lugar de referenciados?

```
/deep-dive concept "normalización" → Conecta 1FN/2FN/3FN con tus modelos reales.
  Que te muestre ejemplos concretos de dónde cumples y dónde no.
```

#### 1.3 — Diagrama ER de tu sistema
El curso usa crow’s foot para TiendaLatam. Tú deberías tener un diagrama actualizado de tu sistema. Si no lo tienes, este es el momento.

```
/deep-dive refactor → Pídele que genere un diagrama ER en Mermaid a partir de tus
  modelos SQLAlchemy y lo deje en docs/. Que señale relaciones faltantes o implícitas.
```

**Estándar de industria a alcanzar:** Todo modelo en producción debe tener documentación ER viva que se genere o valide desde el código. Las anomalías de actualización (el problema que resuelve la normalización) en un POS multi-tenant pueden causar que una escuela vea precios incorrectos o inventario fantasma.

---

## MÓDULO 2 — Construcción y Manipulación de Tablas con SQL (Clases 7–16)

### Lo que cubre el curso
Tipos de datos, CREATE TABLE con restricciones, claves foráneas, integridad referencial, ALTER TABLE, INSERT, SELECT con filtros, UPDATE, DELETE vs soft delete, ORDER BY + LIMIT, funciones de texto.

### Qué verificar en Uniformes Consuelo Rios

#### 2.1 — Tipos de datos y restricciones (Clases 7–8)
El curso enseña a elegir INT, VARCHAR, DECIMAL, DATE y a usar NOT NULL, UNIQUE, DEFAULT, CHECK. Tu sistema usa SQLAlchemy que abstrae esto, pero ¿tus modelos tienen las constraints correctas a nivel de BD o solo validan en Pydantic?

```
/deep-dive audit → Pídele que compare tus modelos SQLAlchemy con lo que realmente
  existe en PostgreSQL (via Alembic migrations). Buscar:
  - Campos que aceptan NULL pero no deberían (ej: precio, tenant_id)
  - Campos monetarios usando Float en vez de Numeric/Decimal
  - Falta de CHECK constraints (ej: cantidad >= 0, precio > 0)
  - Índices UNIQUE faltantes (ej: combinación producto+talla+escuela)
```

#### 2.2 — Integridad referencial (Clase 9)
El curso explica FKs y cascadas. En tu sistema multi-tenant, esto es crítico: si borras una escuela, ¿qué pasa con sus pedidos? Si borras un producto, ¿qué pasa con el inventario?

```
/deep-dive socratic → Deja que te pregunte:
  "¿Qué ON DELETE tienes configurado en tus FKs?"
  "¿Qué pasa si alguien elimina un registro de escuela en la BD directamente?"
  "¿Tienes constraints a nivel de BD o solo a nivel de aplicación?"
```

#### 2.3 — ALTER TABLE y migraciones (Clase 10)
El curso muestra ADD COLUMN, RENAME, ALTER TYPE. En tu producción, esto es Alembic. ¿Tus migraciones son seguras? ¿Podrías hacer rollback de cualquiera?

```
/deep-dive audit → Que revise alembic/versions/ y evalúe:
  - Migraciones que no tienen downgrade implementado
  - ALTER que podrían causar lock en tablas grandes
  - Migraciones que agregan NOT NULL sin DEFAULT (rompen producción)
  - Orden de dependencias entre migraciones
```

#### 2.4 — DELETE vs Soft Delete (Clase 14)
El curso explica por qué en producción nunca se usa DELETE físico. ¿Tu sistema usa soft delete? Para un POS, borrar un pedido o una devolución destruye la auditoría contable.

```
/deep-dive concept "soft delete" → Que analice tus modelos y te muestre:
  - Qué entidades tienen campo is_active/deleted_at y cuáles no
  - Qué pasa con la integridad al "borrar" un registro padre
  - Si tus queries de SQLAlchemy filtran automáticamente los borrados
  - Impacto en reportes: ¿los reportes incluyen registros soft-deleted?
```

#### 2.5 — Paginación (Clase 15)
ORDER BY + LIMIT. ¿Tus endpoints de API paginan correctamente o devuelven todo el dataset? Con 4+ escuelas y crecimiento, esto se vuelve crítico.

```
/deep-dive audit → Que revise tus routes/ y verifique:
  - Endpoints que hacen SELECT * sin LIMIT
  - Implementación de paginación (offset vs cursor-based)
  - Si el frontend maneja paginación o carga todo en memoria
```

**Estándar de industria:** Las constraints deben vivir en la BD, no solo en la app. Pydantic valida la entrada; PostgreSQL protege la integridad. Ambas capas son necesarias. Las migraciones deben ser reversibles y testeadas. Soft delete es obligatorio para cualquier entidad con implicaciones contables o legales.

---

## MÓDULO 3 — Configuración del Entorno PostgreSQL (Clases 17–19)

### Lo que cubre el curso
Instalación de PostgreSQL, navegación del entorno, estructura de instancias y bases de datos.

### Qué verificar en Uniformes Consuelo Rios

#### 3.1 — Configuración de PostgreSQL en producción
El curso enseña lo básico local. Tu sistema corre en un VPS Linux con Docker. ¿Tu PostgreSQL está optimizado para producción?

```
/deep-dive audit → Que revise tu docker-compose.yml y configuración de PostgreSQL:
  - ¿Tienes configurados work_mem, shared_buffers, effective_cache_size?
  - ¿Los backups son automáticos? ¿Cada cuánto? ¿Probaste restaurar uno?
  - ¿Connection pooling configurado? (PgBouncer o similar)
  - ¿Tienes monitoreo de queries lentas? (pg_stat_statements)
```

#### 3.2 — Row-Level Security y tu multi-tenancy
Tu README dice "row-level tenant filtering via SQLAlchemy scoped sessions." El curso no cubre RLS, pero este es EL punto donde tu sistema debe estar blindado.

```
/deep-dive concept "row-level security PostgreSQL" → Que analice:
  - ¿Usas RLS nativo de PostgreSQL o filtras solo en SQLAlchemy?
  - Si un bug en tu código salta el filtro de tenant, ¿la BD lo detiene?
  - ¿Tienes tests que verifican aislamiento entre tenants?
  - Evaluar migrar a RLS nativo como capa adicional de seguridad
```

**Estándar de industria:** Multi-tenancy con filtrado solo a nivel de aplicación es un riesgo conocido. Los sistemas de nivel enterprise implementan RLS a nivel de BD como segunda línea de defensa. Tu test suite (284 tests) debería incluir tests de "tenant leakage" — queries que intencionalmente intentan acceder datos de otro tenant.

---

## MÓDULO 4 — Consultas Avanzadas (Clases 20–25)

### Lo que cubre el curso
Creación de BD completa, GROUP BY, funciones de agregación (COUNT, SUM, AVG), HAVING, INNER JOIN, LEFT JOIN, y un proyecto integrador de reporte de ventas por país.

### Qué verificar en Uniformes Consuelo Rios

#### 4.1 — Agregaciones y reportes (Clases 21–22)
El curso construye reportes con GROUP BY y HAVING. Tu sistema tiene "Global Accounting" con reportes por escuela. ¿Tus queries de reportes son eficientes?

```
/deep-dive audit → Que revise tus services/ de reportes y contabilidad:
  - ¿Los reportes se calculan en SQL o en Python? (deben ser SQL)
  - ¿Usas HAVING para filtrar resultados agrupados o filtras en Python?
  - ¿Tienes índices para las columnas que más agrupas? (tenant_id, fecha, producto)
  - ¿Los reportes de caja/banco cruzan correctamente con todos los tenants?
```

#### 4.2 — JOINs en tu sistema (Clase 23)
Tu sistema conecta pedidos↔productos, inventario↔escuelas, ventas↔clientes. ¿Tus JOINs en SQLAlchemy son explícitos y eficientes?

```
/deep-dive concept "SQL JOINs vs SQLAlchemy relationships" → Que te muestre:
  - Diferencia entre lazy loading y eager loading en tus relationships
  - Queries N+1 escondidos (el problema #1 de performance en ORMs)
  - Dónde usar joinedload() vs selectinload() vs subqueryload()
  - Cómo EXPLAIN ANALYZE tus queries más críticas
```

#### 4.3 — Proyecto integrador: tu propio reporte de ventas
El curso termina construyendo un reporte que integra DDL, DML, JOINs, GROUP BY y HAVING. Tu equivalente es el reporte de ventas por escuela con reconciliación de caja.

```
/deep-dive refactor → Toma tu endpoint de reporte de ventas más complejo y:
  - Refactoriza la query para que sea una sola consulta SQL optimizada
  - Agrega EXPLAIN ANALYZE y documenta el plan de ejecución
  - Crea índices compuestos si faltan
  - Deja el query documentado con comentarios de negocio
```

**Estándar de industria:** Los reportes financieros de un POS deben ser auditables, reproducibles y rápidos. Nunca calcules totales en Python cuando SQL lo puede hacer — introduces riesgo de errores de redondeo y performance. Los índices para reportes deben diseñarse explícitamente.

---

## MÓDULO EXTRA — Más Allá del Curso (lo que Platzi no cubre pero tu producción necesita)

Estos temas no están en el curso de fundamentos, pero son el salto de "sé SQL" a "mi producción es de estándar industria":

### E.1 — Índices y Performance

```
/deep-dive concept "PostgreSQL indexes" → Que analice tu schema y sugiera:
  - Índices faltantes en columnas de WHERE y JOIN frecuentes
  - Índices parciales para soft-deleted records
  - Índices compuestos para queries multi-tenant (tenant_id, ...)
```

### E.2 — Transacciones y Concurrencia

```
/deep-dive socratic → Preguntas sobre:
  "¿Qué pasa si dos cajeras venden el último uniforme al mismo tiempo?"
  "¿Tus operaciones de inventario son atómicas?"
  "¿Usas SELECT FOR UPDATE en operaciones de stock?"
```

### E.3 — Seguridad de Datos

```
/deep-dive audit → Que verifique:
  - SQL injection: ¿todos los queries usan parámetros?
  - Exposición de datos: ¿tus schemas Pydantic filtran campos sensibles?
  - Logs: ¿estás logueando queries con datos de clientes?
```

### E.4 — Backups y Disaster Recovery

```
/deep-dive audit → Que revise tu infraestructura:
  - ¿pg_dump automatizado con cron?
  - ¿Has probado restaurar un backup en los últimos 30 días?
  - ¿Point-in-time recovery habilitado (WAL archiving)?
```

---

## Mapa de Prioridad de Ejecución

| Prioridad | Tema | Riesgo si no lo verificas | Deep-dive mode |
|-----------|------|--------------------------|----------------|
| 🔴 Crítica | Tenant isolation (RLS) | Fuga de datos entre escuelas | `audit` |
| 🔴 Crítica | Constraints en BD | Datos corruptos en producción | `audit` |
| 🔴 Crítica | Soft delete contable | Pérdida de auditoría fiscal | `concept` |
| 🟠 Alta | N+1 queries y JOINs | Performance degradada | `concept` |
| 🟠 Alta | Migraciones seguras | Downtime en deploys | `audit` |
| 🟠 Alta | Concurrencia de inventario | Venta de stock inexistente | `socratic` |
| 🟡 Media | Paginación de endpoints | Memoria y latencia | `audit` |
| 🟡 Media | Índices de reportes | Reportes lentos a escala | `refactor` |
| 🟡 Media | Backups verificados | Pérdida total de datos | `audit` |
| 🟢 Mejora | Diagrama ER documentado | Onboarding lento | `refactor` |
| 🟢 Mejora | Query documentation | Mantenibilidad | `refactor` |

---

## Flujo de Trabajo Recomendado

Para cada semana, toma un módulo del curso y sigue este ciclo:

1. **Aprende** — Ve las clases del módulo en Platzi
2. **Audita** — Usa `/deep-dive audit` para ver cómo está tu sistema en ese tema
3. **Profundiza** — Usa `/deep-dive socratic` para que Claude te cuestione sobre las decisiones de tu implementación
4. **Conecta** — Usa `/deep-dive concept` para vincular la teoría con tu código real
5. **Mejora** — Usa `/deep-dive refactor` para implementar los cambios con explicación de cada decisión

En 4-5 semanas habrás cruzado todo el curso contra tu producción y tendrás un sistema mediblemente más robusto, documentado y alineado con estándares de industria.

---

*Generado para el proyecto Uniformes Consuelo Rios — Multi-Tenant POS & ERP*
*Basado en: Curso de Fundamentos de Bases de Datos y SQL (Platzi, 2026)*
