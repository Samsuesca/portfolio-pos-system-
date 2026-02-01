# Modulo de Nomina

Guia completa para la gestion de empleados y liquidaciones de nomina.

---

## Acceso

- **Ruta:** Menu lateral > Nomina
- **Permisos:** Superusuario o usuarios con acceso a contabilidad
- **Tipo:** Modulo global (no depende del colegio seleccionado)

---

## Vista General

El modulo de Nomina tiene dos pestanas principales:

1. **Empleados:** Gestion del personal
2. **Liquidaciones:** Periodos de pago

---

## Pestana de Empleados

### Lista de Empleados

Muestra todos los empleados con:
- Nombre completo
- Documento de identidad
- Cargo
- Salario base
- Frecuencia de pago
- Estado (Activo/Inactivo)

### Filtros

| Filtro | Descripcion |
|--------|-------------|
| Activos | Solo empleados activos |
| Inactivos | Solo empleados dados de baja |
| Todos | Todos los empleados |

---

## Crear Empleado

1. Click en **"Nuevo Empleado"**
2. Completar el formulario:

### Datos Personales

| Campo | Descripcion | Requerido |
|-------|-------------|-----------|
| Nombre Completo | Nombre del empleado | Si |
| Tipo Documento | CC, CE, NIT | Si |
| Numero Documento | Numero de identificacion | Si |
| Email | Correo electronico | No |
| Telefono | Numero de contacto | No |

### Datos Laborales

| Campo | Descripcion | Requerido |
|-------|-------------|-----------|
| Cargo | Posicion en la empresa | Si |
| Fecha Contratacion | Inicio de la relacion laboral | Si |
| Salario Base | Salario mensual/quincenal | Si |
| Frecuencia de Pago | Semanal, Quincenal, Mensual | Si |
| Metodo de Pago | Efectivo, Transferencia, Nequi | Si |

### Deducciones

| Campo | Descripcion |
|-------|-------------|
| Salud | Deduccion por salud |
| Pension | Deduccion por pension |
| Otras | Otras deducciones fijas |

3. Click en **"Crear Empleado"**

---

## Editar Empleado

1. Click en el icono de editar (lapiz) en la fila del empleado
2. Modificar los campos necesarios
3. Click en **"Guardar Cambios"**

---

## Desactivar Empleado

1. Click en el icono de eliminar (papelera) en la fila
2. Confirmar la desactivacion
3. El empleado pasa a estado "Inactivo"

> **Nota:** Los empleados no se eliminan permanentemente, solo se desactivan para mantener historial.

---

## Gestionar Bonos

### Ver Bonos de un Empleado

1. Click en el icono de dolar ($) en la fila del empleado
2. Se abre el modal de bonos

### Tipos de Bono

| Tipo | Descripcion |
|------|-------------|
| **Fijo** | Monto fijo cada periodo |
| **Variable** | Monto que puede cambiar |
| **Unico** | Solo se paga una vez |

### Agregar Bono

1. En el modal de bonos, llenar:
   - Nombre del bono
   - Tipo (Fijo, Variable, Unico)
   - Monto
2. Click en **"Agregar Bono"**

### Eliminar Bono

Click en el icono de papelera junto al bono.

---

## Pestana de Liquidaciones

### Panel de Resumen

Cuatro tarjetas con metricas:

| Tarjeta | Descripcion |
|---------|-------------|
| Empleados Activos | Total de empleados activos |
| Nomina Mensual Est. | Estimacion de nomina mensual |
| Liquidaciones Pendientes | Liquidaciones sin pagar |
| Ultima Nomina | Fecha de ultimo pago |

### Integracion con Gastos Fijos

Un banner muestra el estado de sincronizacion:
- **Verde:** Nomina sincronizada con gastos fijos
- **Amarillo:** Requiere actualizacion
- **Azul:** Aun no integrada

Link directo a Contabilidad para ver el gasto fijo.

---

## Crear Liquidacion

1. Click en **"Nueva Liquidacion"**
2. Definir el periodo:

| Campo | Descripcion |
|-------|-------------|
| Fecha Inicio | Inicio del periodo |
| Fecha Fin | Fin del periodo |
| Fecha de Pago | Cuando se pagara |
| Notas | Comentarios opcionales |

3. Click en **"Crear Liquidacion"**

El sistema automaticamente:
- Incluye todos los empleados activos
- Calcula salarios proporcionales al periodo
- Aplica bonos recurrentes
- Aplica deducciones

---

## Estados de Liquidacion

| Estado | Color | Descripcion | Acciones |
|--------|-------|-------------|----------|
| `draft` | Gris | Borrador, editable | Aprobar, Cancelar |
| `approved` | Azul | Aprobada, lista para pagar | Pagar individual, Pagar todo |
| `paid` | Verde | Pagada completamente | - |
| `cancelled` | Rojo | Cancelada | - |

---

## Ver Detalle de Liquidacion

Click en cualquier liquidacion para ver:

### Resumen

| Metrica | Descripcion |
|---------|-------------|
| Salario Base | Total de salarios base |
| Bonificaciones | Total de bonos aplicados |
| Deducciones | Total de deducciones |
| Total Neto | Monto a pagar |

### Detalle por Empleado

Tabla con:
- Nombre del empleado
- Salario base del periodo
- Bonos aplicados
- Deducciones aplicadas
- Neto a pagar
- Estado de pago

---

## Aprobar Liquidacion

1. Abrir detalle de la liquidacion (estado: Borrador)
2. Verificar montos y empleados
3. Click en **"Aprobar"**

La liquidacion pasa a estado "Aprobada".

---

## Pagar Liquidacion

### Pagar Todo

1. Abrir liquidacion aprobada
2. Click en **"Pagar Todo"**
3. Todos los empleados se marcan como pagados
4. Se genera movimiento contable

### Pagar Individual

1. Abrir liquidacion aprobada
2. En la fila del empleado, click en "Pagar"
3. El empleado se marca como pagado

---

## Cancelar Liquidacion

1. Abrir liquidacion en borrador
2. Click en **"Cancelar"**
3. Confirmar la cancelacion

> **Nota:** Solo se pueden cancelar liquidaciones en estado "Borrador".

---

## Integracion Contable

### Al Aprobar Liquidacion

- Se crea/actualiza el gasto fijo de nomina
- El monto se sincroniza con la estimacion mensual

### Al Pagar Liquidacion

- Se genera egreso contable
- Se reduce saldo de caja o banco segun metodo de pago
- El gasto aparece en reportes

---

## Frecuencias de Pago

| Frecuencia | Descripcion | Calculo |
|------------|-------------|---------|
| Semanal | Pago cada semana | Salario / 4 |
| Quincenal | Pago cada 15 dias | Salario / 2 |
| Mensual | Pago cada mes | Salario completo |

---

## Flujo de Trabajo Recomendado

```
1. Fin de periodo
   └── Crear nueva liquidacion
   └── Verificar empleados incluidos

2. Revision
   └── Verificar montos calculados
   └── Ajustar si es necesario

3. Aprobacion
   └── Aprobar la liquidacion
   └── Se crea gasto fijo automatico

4. Pago
   └── Pagar todo o por empleado
   └── Se registra en contabilidad
```

---

## Buenas Practicas

### Configuracion Inicial

1. Registrar todos los empleados activos
2. Configurar salarios y deducciones correctamente
3. Agregar bonos recurrentes

### Cada Periodo

1. Crear liquidacion al inicio del periodo
2. Aprobar al menos 2 dias antes del pago
3. Pagar en la fecha establecida

### Mantenimiento

1. Actualizar salarios cuando cambien
2. Agregar/remover bonos segun necesidad
3. Desactivar empleados que se retiren

---

## Relacion con CFO Dashboard

Los datos de nomina alimentan el Panel CFO:
- Nomina mensual estimada
- Capacidad de cobertura
- Impacto en burn rate
- Alertas si no hay liquidez suficiente

---

## FAQ

### ¿Como agrego un aumento de salario?

1. Ir a Empleados
2. Editar el empleado
3. Modificar el salario base
4. Guardar

Las proximas liquidaciones usaran el nuevo salario.

### ¿Puedo pagar a un empleado antes que otros?

Si, usa "Pagar Individual" en el detalle de la liquidacion.

### ¿Que pasa si me equivoque en una liquidacion?

- Si esta en borrador: Cancelar y crear nueva
- Si esta aprobada: Contactar al administrador
- Si esta pagada: Se requiere ajuste contable manual

### ¿Los bonos unicos se aplican automaticamente?

Los bonos marcados como "recurrentes" se aplican automaticamente.
Los bonos "unicos" se aplican una sola vez cuando se crean.

---

[← Volver al indice](./README.md)
