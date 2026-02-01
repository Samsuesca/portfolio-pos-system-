# Modulo de Contabilidad

Guia para el uso del modulo de contabilidad global.

---

## Concepto Importante

La contabilidad en Uniformes System es **GLOBAL del negocio**, no por colegio.

- **Una sola caja** (efectivo fisico)
- **Una sola cuenta bancaria**
- **Un solo balance general**
- Los colegios son **fuentes de ingreso**, no entidades contables separadas

---

## Secciones del Modulo

### 1. Saldos (Caja y Banco)

Muestra los saldos actuales de:
- **Caja**: Efectivo disponible
- **Banco**: Saldo en cuenta bancaria

### 2. Gastos

Registro de gastos del negocio:
- Servicios (luz, agua, internet)
- Salarios
- Insumos
- Alquiler
- Otros gastos operativos

### 3. Cuentas por Cobrar (CxC)

Dinero que clientes deben al negocio:
- Ventas a credito
- Pagos parciales pendientes

### 4. Cuentas por Pagar (CxP)

Dinero que el negocio debe a proveedores:
- Facturas de proveedores
- Compromisos pendientes

### 5. Balance de Cuentas

Vision completa del patrimonio:
- **Activos Corrientes**: Caja, Banco
- **Activos Fijos**: Equipos, Maquinaria
- **Pasivos**: Deudas, CxP
- **Patrimonio**: Capital del negocio

---

## Registrar un Gasto

1. Ir a **Contabilidad** > **Gastos**
2. Click en "Nuevo Gasto"
3. Completar formulario:
   - Descripcion del gasto
   - Monto
   - Categoria
   - Metodo de pago (Caja o Banco)
   - Fecha
4. Click en "Guardar"

El sistema automaticamente:
- Reduce el saldo de Caja o Banco
- Registra el movimiento contable

---

## Registrar Cuenta por Cobrar

1. Ir a **Contabilidad** > **CxC**
2. Click en "Nueva CxC"
3. Completar:
   - Cliente
   - Monto
   - Concepto
   - Fecha de vencimiento (opcional)
4. Click en "Guardar"

### Registrar Pago de CxC

1. Buscar la cuenta pendiente
2. Click en "Registrar Pago"
3. Ingresar monto recibido
4. Seleccionar donde ingresa (Caja o Banco)
5. Confirmar

---

## Integracion Automatica

Las ventas se integran automaticamente con contabilidad:

| Metodo de Pago | Accion Contable |
|----------------|-----------------|
| Efectivo | Aumenta saldo de Caja |
| Nequi/Transfer | Aumenta saldo de Banco |
| Tarjeta | Aumenta saldo de Banco |
| Credito | Crea Cuenta por Cobrar |

---

## Reportes Contables

- Balance general
- Estado de resultados
- Flujo de caja
- Movimientos por periodo

---

[← Volver al indice](./README.md)
