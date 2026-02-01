# Modulo de Arreglos

Guia completa para la gestion de arreglos, reparaciones y confecciones personalizadas.

---

## Acceso

- **Ruta:** Menu lateral > Arreglos
- **Permisos:** Vendedor o superior
- **Tipo:** Modulo por colegio (usa el colegio seleccionado para clientes)

---

## Vista General

El modulo de Arreglos permite gestionar servicios de:
- Arreglos de prendas (dobladillos, ajustes, etc.)
- Reparaciones
- Confecciones personalizadas
- Bordados y personalizaciones

---

## Panel de Estadisticas

La vista principal muestra 8 tarjetas con metricas en tiempo real:

### Tarjetas de Estado (Fila 1)

| Tarjeta | Color | Descripcion | Accion |
|---------|-------|-------------|--------|
| **Pendientes** | Amarillo | Arreglos por iniciar | Click para filtrar |
| **En Proceso** | Azul | Arreglos en trabajo | Click para filtrar |
| **Listos** | Verde | Preparados para entrega | Click para filtrar |
| **Entregados** | Gris | Completados | Click para filtrar |

### Tarjetas Financieras (Fila 2)

| Tarjeta | Color | Descripcion |
|---------|-------|-------------|
| **Hoy** | Morado | Recibidos y entregados hoy |
| **Ingresos** | Esmeralda | Total pagado (ingresos reales) |
| **Por Cobrar** | Rojo | Saldo pendiente de pago |
| **Total** | Blanco | Total de arreglos (limpiar filtros) |

---

## Alertas de Urgencia

El sistema genera alertas automaticas para:

| Alerta | Icono | Descripcion |
|--------|-------|-------------|
| **Entrega Vencida** | Rojo | Paso la fecha de entrega |
| **Listos para Entregar** | Verde | Preparados y no entregados |
| **Saldo Pendiente** | Amarillo | Entregados pero con saldo |

Click en cualquier alerta para filtrar la tabla.

---

## Estados de Arreglo

| Estado | Descripcion | Siguiente |
|--------|-------------|-----------|
| `pending` | Recibido, sin iniciar | En proceso |
| `in_progress` | En trabajo | Listo |
| `ready` | Preparado para entrega | Entregado |
| `delivered` | Entregado al cliente | - |
| `cancelled` | Cancelado | - |

---

## Tipos de Arreglo

| Tipo | Descripcion |
|------|-------------|
| `hem` | Dobladillo |
| `adjustment` | Ajuste de talla |
| `repair` | Reparacion |
| `custom` | Confeccion personalizada |
| `embroidery` | Bordado |
| `other` | Otro servicio |

---

## Crear un Arreglo

1. Click en **"Nuevo Arreglo"**
2. Completar el formulario:

### Datos del Cliente

- **Cliente registrado:** Buscar en la base de datos
- **Cliente externo:** Nombre libre (para clientes no registrados)

### Datos del Trabajo

| Campo | Descripcion | Requerido |
|-------|-------------|-----------|
| Prenda | Descripcion de la prenda | Si |
| Tipo | Tipo de arreglo (dobladillo, etc.) | Si |
| Descripcion | Detalle del trabajo | No |
| Costo | Precio del servicio | Si |
| Fecha entrega | Fecha estimada | No |

### Pago Inicial

- **Abono:** Pago parcial al recibir
- **Metodo:** Efectivo, Nequi, Transferencia, etc.

3. Click en **"Guardar"**

---

## Gestion de Arreglos

### Ver Detalle

Click en cualquier fila de la tabla para ver el detalle completo.

### Cambiar Estado

1. Abrir detalle del arreglo
2. Click en el boton de cambio de estado
3. El arreglo avanza al siguiente estado

### Registrar Pago

1. Abrir detalle del arreglo
2. Click en "Registrar Pago"
3. Ingresar monto y metodo
4. Confirmar

### Indicadores en la Tabla

| Indicador | Significado |
|-----------|-------------|
| Fecha en rojo | Entrega vencida |
| Fecha en naranja | Entrega hoy |
| Fecha en amarillo | Entrega manana |
| Fecha en azul | Proximos 3 dias |
| Icono $ verde | Pagado completo |
| Icono $ amarillo | Abono parcial |
| Icono $ rojo | Sin pago |

---

## Filtros Disponibles

### Barra de Busqueda

Busca por:
- Codigo del arreglo (ARR-XXXX)
- Nombre del cliente
- Nombre de la prenda

### Filtros por Dropdown

| Filtro | Opciones |
|--------|----------|
| Estado | Todos, Pendiente, En Proceso, Listo, Entregado, Cancelado |
| Tipo | Todos, Dobladillo, Ajuste, Reparacion, Personalizado, Bordado, Otro |
| Pago | Todos, Pagados, Con saldo |

### Limpiar Filtros

Click en el boton "Limpiar" o en la tarjeta "Total" para ver todos.

---

## Flujo de Trabajo Tipico

```
1. Recibir prenda del cliente
   └── Crear arreglo (estado: Pendiente)
   └── Registrar abono inicial (opcional)

2. Iniciar trabajo
   └── Cambiar estado a "En Proceso"

3. Completar trabajo
   └── Cambiar estado a "Listo"
   └── El cliente es notificado (si tiene contacto)

4. Entregar al cliente
   └── Cambiar estado a "Entregado"
   └── Registrar pago pendiente (si aplica)
```

---

## Clientes Externos

Los arreglos permiten clientes externos (no registrados):

- Util para trabajos puntuales
- No requiere crear ficha de cliente
- Solo se guarda el nombre
- Icono diferente en la tabla

---

## Integracion Contable

Los pagos de arreglos se integran automaticamente:

| Metodo de Pago | Destino |
|----------------|---------|
| Efectivo | Caja |
| Nequi | Banco |
| Transferencia | Banco |
| Tarjeta | Banco |

Los ingresos aparecen en los reportes contables.

---

## Reportes de Arreglos

### Metricas Disponibles

- Total de arreglos por periodo
- Ingresos por arreglos
- Tiempo promedio de entrega
- Arreglos por tipo

### Acceso

Ir a **Reportes** y filtrar por "Arreglos".

---

## Buenas Practicas

### Al Recibir

- Describir claramente el trabajo requerido
- Establecer fecha de entrega realista
- Cobrar abono (30-50% recomendado)
- Verificar datos de contacto del cliente

### Durante el Proceso

- Actualizar estado cuando inicie el trabajo
- Notificar si hay demoras
- Marcar como listo apenas termine

### Al Entregar

- Verificar satisfaccion del cliente
- Cobrar saldo pendiente
- Marcar como entregado inmediatamente

---

## Casos Especiales

### Arreglo Cancelado

1. Abrir detalle del arreglo
2. Cambiar estado a "Cancelado"
3. Si hay abono, evaluar devolucion

### Arreglo Sin Recoger

- Los arreglos "Listos" generan alerta
- Contactar al cliente despues de 7 dias
- Considerar politica de almacenamiento

### Trabajos Multiples

- Crear un arreglo por cada prenda
- Agrupar en el mismo cliente
- Pueden tener diferentes fechas

---

## FAQ

### ¿Puedo editar un arreglo ya creado?

Si, desde el detalle puedes editar:
- Descripcion
- Costo
- Fecha de entrega

### ¿Como veo los arreglos de un cliente especifico?

Usa la barra de busqueda y escribe el nombre del cliente.

### ¿Los arreglos afectan el inventario?

No, los arreglos son servicios y no modifican el inventario de productos.

### ¿Puedo crear arreglos sin cliente?

Si, usa la opcion de "Cliente externo" e ingresa solo el nombre.

---

[← Volver al indice](./README.md)
