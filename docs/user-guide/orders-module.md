# Modulo de Pedidos

Guia para la gestion de pedidos en Uniformes System.

---

## Tipos de Pedidos

### 1. Pedidos Internos

Pedidos creados directamente en la aplicacion por vendedores.

### 2. Pedidos Web

Pedidos realizados por padres a traves del portal web.

---

## Estados de Pedido

| Estado | Descripcion |
|--------|-------------|
| **Pendiente** | Recien creado, sin procesar |
| **Confirmado** | Validado, en preparacion |
| **En Proceso** | Productos siendo preparados |
| **Listo** | Preparado para entrega/recogida |
| **Entregado** | Completado y entregado |
| **Cancelado** | Anulado |

---

## Crear un Pedido

1. Ir a **Pedidos**
2. Click en "Nuevo Pedido"
3. Seleccionar cliente (o crear nuevo)
4. Agregar productos:
   - Buscar producto
   - Seleccionar talla
   - Definir cantidad
5. Revisar resumen
6. Definir fecha estimada de entrega
7. Click en "Crear Pedido"

---

## Gestionar Pedido

### Ver Detalle

1. Click en el pedido de la lista
2. Ver informacion completa:
   - Productos solicitados
   - Estado actual
   - Historial de cambios

### Cambiar Estado

1. Abrir detalle del pedido
2. Click en "Cambiar Estado"
3. Seleccionar nuevo estado
4. Agregar nota (opcional)
5. Confirmar

### Editar Pedido

Solo disponible en estado "Pendiente":
1. Click en "Editar"
2. Modificar productos o cantidades
3. Guardar cambios

---

## Pedidos Web

### Flujo del Pedido Web

1. Padre realiza pedido en portal web
2. Pedido aparece en "Pedidos Web"
3. Vendedor revisa y confirma
4. Se procesa normalmente

### Verificacion

Los pedidos web incluyen:
- Datos del padre
- Telefono verificado
- Direccion de entrega (si aplica)

---

## Convertir Pedido a Venta

Cuando el pedido esta listo:

1. Abrir detalle del pedido
2. Click en "Convertir a Venta"
3. Confirmar productos y cantidades
4. Seleccionar metodo de pago
5. Completar venta

El pedido cambia a estado "Entregado" automaticamente.

---

## Encargos Personalizados

Para uniformes con personalizacion especial:

1. Crear pedido normal
2. Marcar como "Encargo Personalizado"
3. Agregar especificaciones:
   - Talla especial
   - Bordados
   - Modificaciones
4. El sistema marca los productos como "Por Confeccionar"

---

## Filtros y Busqueda

### Filtrar Por

- Estado del pedido
- Fecha de creacion
- Cliente
- Colegio

### Ordenar Por

- Fecha (mas reciente primero)
- Estado
- Cliente

---

[← Volver al indice](./README.md)
