# Modulo de Ventas

Guia completa para el uso del modulo de ventas.

---

## Vista General

El modulo de ventas es el punto de venta (POS) principal del sistema. Permite:

- Registrar ventas de productos
- Gestionar multiples metodos de pago
- Aplicar descuentos
- Imprimir recibos
- Gestionar cambios y devoluciones

---

## Crear una Venta

### Paso 1: Seleccionar Productos

1. Buscar productos por nombre o codigo
2. Click en el producto para agregarlo
3. Seleccionar talla disponible
4. Ajustar cantidad

### Paso 2: Revisar Carrito

- Ver productos agregados en el carrito lateral
- Modificar cantidades si es necesario
- Eliminar productos si es necesario

### Paso 3: Seleccionar Cliente

- Buscar cliente existente por nombre o telefono
- O crear nuevo cliente con:
  - Nombre completo
  - Telefono
  - Direccion (opcional)

### Paso 4: Metodo de Pago

| Metodo | Descripcion |
|--------|-------------|
| **Efectivo** | Pago en caja, calcula vuelto |
| **Nequi** | Billetera digital |
| **Transferencia** | Bancaria |
| **Tarjeta** | Debito/Credito |
| **Credito** | Genera cuenta por cobrar |

### Paso 5: Completar Venta

1. Verificar total
2. Click en "Completar Venta"
3. La venta genera:
   - Numero de venta (VNT-YYYY-XXXX)
   - Actualizacion de inventario
   - Registro contable automatico

---

## Cambios y Devoluciones

### Tipos de Cambio

| Tipo | Descripcion |
|------|-------------|
| **Cambio de Talla** | Mismo producto, diferente talla |
| **Cambio de Producto** | Diferente producto |
| **Devolucion** | Reembolso total o parcial |
| **Defecto** | Por producto defectuoso |

### Proceso de Cambio

1. Buscar la venta original
2. Click en "Ver Detalle"
3. Seleccionar "Solicitar Cambio"
4. Elegir tipo de cambio
5. Especificar producto(s) afectado(s)
6. Agregar motivo
7. Enviar solicitud

### Aprobacion (Administrador)

1. Ir a **Cambios** en el menu
2. Ver solicitudes pendientes
3. Revisar detalles
4. Aprobar o rechazar

---

## Impresion de Recibos

Despues de completar una venta:
1. Click en "Imprimir Recibo"
2. Seleccionar impresora
3. El recibo incluye:
   - Datos del negocio
   - Numero de venta
   - Productos y cantidades
   - Total y metodo de pago
   - Fecha y hora

---

## Busqueda de Ventas

### Filtros Disponibles

- Por fecha (rango)
- Por cliente
- Por numero de venta
- Por estado

### Exportar

- Exportar a Excel
- Exportar a PDF

---

[← Volver al indice](./README.md)
