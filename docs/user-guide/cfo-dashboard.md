# Panel CFO - Dashboard Ejecutivo

Vista ejecutiva de salud financiera del negocio para toma de decisiones estrategicas.

---

## Acceso

- **Ruta:** Menu lateral > CFO Dashboard
- **Permisos:** Superusuario o usuarios con acceso a contabilidad
- **Tipo:** Modulo global (no depende del colegio seleccionado)

---

## Vista General

El Panel CFO proporciona una vision consolidada de la salud financiera del negocio en una sola pantalla, incluyendo:

- Score de salud financiera
- Liquidez disponible
- Deuda total y vencimientos
- Nomina mensual
- Cash runway (dias de operacion)
- Alertas urgentes

---

## Estado de Salud Financiera

### Banner Principal

El banner superior muestra el estado general del negocio:

| Color | Estado | Score | Significado |
|-------|--------|-------|-------------|
| Verde | Excelente | 80-100 | Finanzas saludables |
| Amarillo | Bueno | 60-79 | Atencion a algunos indicadores |
| Naranja | Precaucion | 40-59 | Requiere accion |
| Rojo | Critico | 0-39 | Accion inmediata necesaria |

### Componentes del Score

El score se calcula a partir de 4 factores:

1. **Deuda (25%)**: Ratio de cobertura de servicio de deuda
2. **Nomina (25%)**: Capacidad para cubrir nomina mensual
3. **Runway (25%)**: Dias de operacion con liquidez actual
4. **Calidad de Datos (25%)**: Productos con costo real asignado

---

## Metricas Principales

### Liquidez Disponible

Muestra el total de efectivo disponible:
- Caja Menor
- Caja Mayor
- Nequi
- Banco

Link directo a **Contabilidad** para ver detalle.

### Deuda Total

Resumen de obligaciones financieras:
- **Total**: Suma de todas las deudas activas
- **Vencida**: Deuda que ya paso su fecha de pago
- **Proximos 30 dias**: Deuda por vencer pronto

Indicadores de alerta si hay deuda vencida.

### Nomina Mensual

Estimacion del costo mensual de nomina:
- Monto estimado mensual
- Numero de empleados activos
- Indicador de cobertura (si hay liquidez suficiente)

Link directo a **Nomina** para gestion.

### Cash Runway

Dias de operacion que puede sostener el negocio:
- Calculado como: Liquidez / Burn Rate Mensual
- "+1 ano" si supera 365 dias

| Estado | Dias | Color |
|--------|------|-------|
| Excelente | +90 | Verde |
| Bueno | 60-90 | Amarillo |
| Precaucion | 30-59 | Naranja |
| Critico | <30 | Rojo |

---

## Metricas Secundarias

### DSCR (Debt Service Coverage Ratio)

Ratio de cobertura de servicio de deuda:
- Calculo: Liquidez / Deuda a 30 dias
- Indica capacidad para pagar deuda proxima

| DSCR | Estado |
|------|--------|
| >2x | Saludable |
| 1-2x | Aceptable |
| <1x | En riesgo |

### Burn Rate Mensual

Gastos fijos mensuales del negocio:
- Gastos fijos operativos
- Nomina mensual
- Total combinado

### Calidad de Datos

Porcentaje de productos con costo real asignado:
- Productos con costo definido
- Productos usando costo estimado

Link para asignar costos a productos faltantes.

---

## Alertas Urgentes

La seccion de alertas muestra situaciones que requieren atencion:

### Tipos de Alerta

| Tipo | Icono | Descripcion |
|------|-------|-------------|
| **Critica** | Rojo | Requiere accion inmediata |
| **Advertencia** | Amarillo | Situacion a monitorear |

### Alertas Comunes

- Deuda vencida pendiente
- Cash runway menor a 30 dias
- Nomina no cubierta con liquidez actual
- Alto porcentaje de productos sin costo

---

## Accesos Rapidos

El panel incluye links directos a:

| Destino | Funcion |
|---------|---------|
| Contabilidad | Gestion de gastos y balances |
| Nomina | Gestion de empleados y liquidaciones |
| Reportes | Estadisticas detalladas |
| Configuracion | Ajustes del sistema |

---

## Actualizacion de Datos

- Los datos se cargan automaticamente al entrar
- Boton "Actualizar" para refrescar manualmente
- Se muestra la hora de ultima actualizacion

---

## Interpretacion de Indicadores

### Liquidez vs Deuda

| Situacion | Liquidez | Deuda 30d | Accion |
|-----------|----------|-----------|--------|
| Saludable | Alta | Baja | Mantener |
| Ajustada | Media | Media | Monitorear |
| Riesgo | Baja | Alta | Priorizar pagos |

### Runway vs Burn Rate

- Si el runway es bajo, evaluar reduccion de gastos fijos
- Si el burn rate es alto vs ingresos, revisar estructura de costos
- Proyectar flujo de caja para anticipar problemas

---

## Casos de Uso

### Revision Semanal

1. Verificar score de salud general
2. Revisar alertas urgentes
3. Validar liquidez disponible
4. Confirmar que nomina esta cubierta

### Antes de Compromisos Financieros

1. Verificar DSCR actual
2. Revisar deuda proxima a vencer
3. Calcular impacto en runway
4. Evaluar si la liquidez permite el compromiso

### Fin de Mes

1. Revisar burn rate del periodo
2. Comparar con proyecciones
3. Identificar desviaciones
4. Ajustar presupuesto si es necesario

---

## Relacion con Otros Modulos

| Modulo | Relacion |
|--------|----------|
| **Contabilidad** | Fuente de datos de liquidez y gastos |
| **Nomina** | Fuente de datos de empleados y salarios |
| **Ventas** | Fuente de ingresos del negocio |
| **Arreglos** | Fuente adicional de ingresos |

---

## FAQ

### ¿Por que mi score es bajo?

Revisa cada componente del breakdown:
- Deuda alta o vencida
- Nomina mayor que liquidez
- Runway corto (pocos dias de operacion)
- Muchos productos sin costo asignado

### ¿Como mejoro el DSCR?

- Incrementar liquidez (mas ventas, cobrar CxC)
- Reducir deuda a corto plazo
- Negociar plazos mas largos con proveedores

### ¿Como asigno costos a productos?

Click en el link "Asignar costos a productos" o ir a:
Contabilidad > Resumen > Gestionar Costos de Productos

---

[← Volver al indice](./README.md)
