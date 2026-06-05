# 📋 Plan para la Próxima Sesión - Configuración de Datos Reales

**Fecha Estimada:** Próxima sesión con Claude Code
**Duración Estimada:** 1-2 horas
**Prerequisitos:** Fase 1 completada ✅

---

## 🎯 Objetivo Principal

Configurar la estructura de datos reales para "Uniformes Consuelo Rios" antes de migrar a la nube, usando un enfoque híbrido que permite validar el sistema con datos reales pero permite carga masiva posterior.

---

## 📊 Enfoque Híbrido Seleccionado

### Estrategia
1. **AHORA (Antes de Cloud):** Crear estructura básica y validar
2. **MIGRAR A CLOUD:** Con estructura lista y datos de prueba
3. **DESPUÉS (En Producción):** Carga masiva de productos/clientes reales

### Ventajas
- ✅ Validamos sistema con casos de uso reales
- ✅ Identificamos ajustes necesarios antes de cloud
- ✅ No perdemos tiempo en carga masiva local que luego se migra
- ✅ Estructura lista para producción desde día 1
- ✅ Flexibilidad para cargar datos gradualmente

---

## 📝 Tareas para la Próxima Sesión

### 1. Crear Colegio Real (15 min)

**Script SQL o Python:**
```sql
-- Crear colegio "Uniformes Consuelo Rios"
INSERT INTO schools (
  code,
  name,
  phone,
  email,
  address,
  primary_color,
  secondary_color
) VALUES (
  'UCR-001',
  'Uniformes Consuelo Rios',
  '+57 XXX XXX XXXX',  -- Teléfono real
  'contacto@uniformesconsuelo.com',
  'Dirección real del negocio',
  '#1E40AF',  -- Azul (personalizable)
  '#FFFFFF'   -- Blanco
);
```

**Asignar Consuelo como Administradora:**
```sql
-- Crear usuario si no existe
INSERT INTO users (username, email, full_name, hashed_password)
VALUES ('consuelo', 'consuelo@uniformes.com', 'Consuelo Rios', ...);

-- Asignar rol ADMIN al colegio
INSERT INTO user_school_roles (user_id, school_id, role)
VALUES (user_id, school_id, 'ADMIN');
```

**Decisiones Necesarias:**
- [ ] Nombre oficial del negocio
- [ ] Teléfono de contacto
- [ ] Email del negocio
- [ ] Dirección física
- [ ] Colores de marca (logo)
- [ ] Logo del negocio (opcional, puede subirse después)

---

### 2. Definir Tipos de Prendas (10 min)

**Estructura de Catálogo:**

```typescript
// Tipos de prendas que maneja el negocio
interface GarmentType {
  code: string;      // Ej: "CAM", "PAN", "ZAP"
  name: string;      // Ej: "Camisa", "Pantalón", "Zapatos"
  category: string;  // Ej: "SUPERIOR", "INFERIOR", "CALZADO"
}
```

**Ejemplos Comunes:**
- Camisas (manga corta, manga larga)
- Pantalones (niño, niña)
- Faldas (diferentes largos)
- Chaquetas / Buzos
- Zapatos (diferentes estilos)
- Medias
- Corbatas / Moños
- Suéteres

**Preguntas para Consuelo:**
1. ¿Qué tipos de prendas vende?
2. ¿Hay categorías especiales? (deportivo, gala, diario)
3. ¿Maneja tallas estándar o personalizadas?

---

### 3. Cargar 10-20 Productos Principales (20 min)

**Productos Más Vendidos:**

Para cada producto necesitamos:
```typescript
interface Product {
  code: string;         // Código interno (Ej: "CAM-001-B-M")
  name: string;         // Nombre descriptivo
  garment_type_id: UUID; // Tipo de prenda
  size: string;         // Talla (XS, S, M, L, XL, 4, 6, 8, etc)
  color: string;        // Color
  gender: string;       // MALE, FEMALE, UNISEX
  price: number;        // Precio venta al público
  cost: number;         // Costo (opcional)
  description: string;  // Descripción detallada
}
```

**Enfoque Recomendado:**
- Identificar los 10-20 productos más vendidos
- Cargar solo esos inicialmente
- Validar que la estructura funciona
- En producción, cargar el resto masivamente

**Métodos de Carga:**

**Opción A: Manual en UI** (si son pocos)
- Consuelo entra al sistema
- Usa formulario de productos
- Agrega uno por uno

**Opción B: Script Python** (si hay muchos)
```python
# Script de carga masiva
products = [
    {
        "code": "CAM-001-B-M",
        "name": "Camisa Blanca Manga Corta Talla M",
        "type": "CAMISA",
        "size": "M",
        "color": "Blanco",
        "gender": "MALE",
        "price": 35000,
        "cost": 20000,
        "stock": 50
    },
    # ... más productos
]

# Insertar en BD
for product in products:
    create_product(product)
```

**Opción C: Excel/CSV Import** (más flexible)
- Crear plantilla Excel
- Consuelo llena la plantilla
- Script lee Excel e inserta en BD

---

### 4. Configurar Inventario Inicial (10 min)

**Para cada producto cargado:**
```sql
-- Establecer stock inicial
INSERT INTO inventory (
  school_id,
  product_id,
  quantity,
  min_stock_alert
) VALUES (
  school_id,
  product_id,
  50,  -- Stock inicial (a definir por producto)
  10   -- Alerta cuando queden menos de 10
);
```

**Decisiones:**
- ¿Hacer inventario físico ahora o usar datos aproximados?
- ¿Establecer alertas de stock mínimo?
- ¿Cargar costos reales o solo precios de venta?

---

### 5. Cargar Clientes Frecuentes (10 min)

**Clientes a Cargar:**
- 5-10 clientes más frecuentes
- Permite probar flujo completo de ventas
- Resto se pueden agregar gradualmente

**Información Mínima:**
```typescript
interface Client {
  name: string;          // Nombre del cliente/padre
  phone: string;         // Teléfono de contacto
  email?: string;        // Email (opcional)
  student_name: string;  // Nombre del estudiante
  student_grade: string; // Grado escolar (1°, 2°, etc)
}
```

**Opciones:**
1. Migrar desde sistema antiguo (si hay backup)
2. Cargar manualmente los más frecuentes
3. Crear solo placeholders para testing

---

### 6. Hacer Ventas de Prueba Reales (15 min)

**Testing con Datos Reales:**

1. Crear 2-3 ventas típicas del negocio
2. Validar precios reales
3. Verificar flujo completo:
   - Selección de cliente
   - Agregar productos
   - Calcular total
   - Procesar pago
   - Imprimir recibo
   - Verificar stock actualizado

**Objetivo:**
- Confirmar que el sistema funciona con casos reales
- Identificar ajustes necesarios antes de cloud
- Familiarizar a Consuelo con el flujo

---

### 7. Backup Completo (5 min)

**Exportar Base de Datos:**
```bash
# Backup completo
docker exec docker-postgres-1 pg_dump \
  -U uniformes_user \
  -d uniformes_db \
  -F c \
  -f /backup/uniformes_$(date +%Y%m%d).dump

# Copiar backup a seguro
docker cp docker-postgres-1:/backup/uniformes_*.dump ~/Desktop/
```

**Incluye:**
- Colegio DEMO (para testing)
- Colegio REAL (Uniformes Consuelo Rios)
- Usuarios y permisos
- Productos iniciales
- Clientes frecuentes
- Ventas de prueba

---

## 🤔 Decisiones Previas Necesarias

Antes de la próxima sesión, Consuelo debería tener claro:

### Información del Negocio
- [ ] Nombre oficial del negocio
- [ ] Teléfono y email de contacto
- [ ] Dirección física
- [ ] Colores de marca (opcional)

### Catálogo de Productos
- [ ] Lista de tipos de prendas que vende
- [ ] 10-20 productos más vendidos con:
  - Nombre descriptivo
  - Tallas disponibles
  - Colores
  - Precios actuales
  - Stock aproximado

### Clientes
- [ ] ¿Tiene lista de clientes del sistema antiguo?
- [ ] ¿Quiere migrar datos o empezar desde cero?
- [ ] Identificar 5-10 clientes más frecuentes

### Sistema Antiguo
- [ ] ¿Existe backup del sistema antiguo?
- [ ] ¿Formato: SQL, Excel, CSV, otro?
- [ ] ¿Quiere migrar datos históricos o solo estructura?

---

## 📊 Alternativas de Carga de Datos

### Opción 1: Migración desde Sistema Antiguo (Ideal si existe)

**Si hay backup del sistema viejo:**
```python
# Script de migración
# 1. Leer backup antiguo (SQL/Excel)
# 2. Mapear estructura vieja → nueva
# 3. Insertar en BD nueva
# 4. Validar integridad
```

**Ventajas:**
- Conserva datos históricos
- Clientes existentes migrados
- Productos con precios históricos

**Tiempo:** 1-2 horas (dependiendo del volumen)

---

### Opción 2: Carga Manual Selectiva (Recomendada)

**Cargar solo lo esencial:**
- 10-20 productos top
- 5-10 clientes frecuentes
- Estructura de categorías

**Ventajas:**
- Rápido (30-60 min)
- Validación inmediata
- Resto se carga en producción

**Tiempo:** 30-60 minutos

---

### Opción 3: Plantilla Excel (Flexible)

**Crear plantilla para Consuelo:**
```
productos.xlsx:
| Código | Nombre | Tipo | Talla | Color | Género | Precio | Stock |
|--------|--------|------|-------|-------|--------|--------|-------|
| ...    | ...    | ...  | ...   | ...   | ...    | ...    | ...   |

clientes.xlsx:
| Nombre | Teléfono | Email | Estudiante | Grado |
|--------|----------|-------|------------|-------|
| ...    | ...      | ...   | ...        | ...   |
```

**Consuelo llena offline y enviamos:**
- Script Python lee Excel
- Valida datos
- Inserta en BD

**Ventajas:**
- Consuelo trabaja offline
- Puede revisar y corregir
- Fácil de modificar

**Tiempo:** 30 min (crear plantilla) + tiempo de Consuelo

---

## 🚀 Después de Esta Sesión

### Estado Esperado
- ✅ Colegio real creado y configurado
- ✅ Estructura de productos definida
- ✅ 10-20 productos principales cargados
- ✅ 5-10 clientes frecuentes cargados
- ✅ 2-3 ventas reales de prueba
- ✅ Backup completo de BD
- ✅ Sistema validado con datos reales

### Preparados Para
- 🚀 Migrar a la nube con confianza
- 🚀 Empezar operaciones en producción
- 🚀 Cargar resto de productos gradualmente
- 🚀 Capacitar a Consuelo en el sistema

---

## 📅 Siguiente Fase: Cloud Deployment

**Una vez validado con datos reales:**
1. Contratar servidor VPS
2. Configurar infraestructura
3. Migrar BD completa (demo + real)
4. Configurar dominio y SSL
5. ¡Sistema en producción!

**Tiempo estimado Fase 2:** 4-6 horas

---

## 💡 Recomendaciones

### Para Aprovechar la Próxima Sesión
1. **Tener lista información del negocio**
2. **Identificar productos principales** (top 20)
3. **Decidir método de carga** (manual, script, Excel)
4. **Si existe sistema antiguo:** Tener backup disponible

### Para Consuelo
1. Hacer inventario de productos más vendidos
2. Revisar precios actuales
3. Identificar clientes frecuentes
4. Pensar en estructura de categorías

---

## 📞 Soporte

**Documentación disponible:**
- [PHASE1_RESULTS.md](PHASE1_RESULTS.md) - Resultados Fase 1
- [deployment/infrastructure-architecture.md](../deployment/infrastructure-architecture.md) - Roadmap completo
- [DATABASE.md](DATABASE.md) - Estructura de base de datos
- [CLAUDE.md](../CLAUDE.md) - Contexto del proyecto

**GitHub:** https://github.com/Samsuesca/uniformes-system-v2

---

**Plan creado:** 2025-11-12
**Próxima revisión:** Cuando iniciemos la siguiente sesión
**Estado:** Pendiente de ejecución
