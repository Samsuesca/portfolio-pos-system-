# Configuracion de Impresoras

Guia completa para configurar impresoras termicas y de red.

---

## Requisitos

### Hardware Soportado

| Tipo | Ancho | Ejemplos |
|------|-------|----------|
| Termica USB | 80mm | Epson TM-T20, XPrinter XP-80 |
| Termica USB | 58mm | POS-58 (con limitaciones) |
| Termica Bluetooth | 80mm | Mini impresoras portatiles |
| Red (LAN) | 80mm | Impresoras con puerto Ethernet |

### Sistema Operativo

- **Windows:** 10/11 (recomendado)
- **macOS:** Con drivers apropiados
- **Linux:** Soporte limitado

---

## Metodos de Impresion

El sistema soporta dos metodos:

### 1. Impresion Directa (Tauri/Rust)

Comunicacion directa con la impresora via puerto serial.

**Ventajas:**
- No requiere drivers
- Mas rapido
- Control total del formato

**Requisitos:**
- Impresora conectada por USB
- Puerto COM/serial disponible

### 2. Impresion via Windows (Spooler)

Usa el sistema de impresion de Windows.

**Ventajas:**
- Compatible con mas impresoras
- Funciona con impresoras de red
- Usa drivers del fabricante

**Requisitos:**
- Impresora instalada en Windows
- Driver del fabricante instalado

---

## Configurar Impresora Directa (USB)

### Paso 1: Conectar Impresora

1. Conectar impresora al puerto USB
2. Encender la impresora
3. Esperar que Windows la reconozca

### Paso 2: Identificar Puerto

1. Abrir **Administrador de Dispositivos**
2. Expandir "Puertos (COM y LPT)"
3. Buscar la impresora (ej: "USB Serial Device (COM3)")
4. Anotar el puerto (COM3, COM4, etc.)

### Paso 3: Configurar en App

1. Ir a **Configuracion**
2. Seccion **Impresora Termica**
3. Click en **"Configurar Impresora"**
4. En "Puerto", ingresar el puerto identificado (ej: COM3)
5. Seleccionar ancho del papel (80mm o 58mm)
6. Click en **"Guardar"**

### Paso 4: Probar

1. Click en **"Prueba de Impresion"**
2. Verificar que imprime correctamente
3. Ajustar configuracion si es necesario

---

## Configurar Impresora Windows (Spooler)

### Paso 1: Instalar Driver

1. Descargar driver del fabricante
2. Ejecutar instalador
3. Seguir instrucciones del wizard
4. Reiniciar si se solicita

### Paso 2: Agregar Impresora en Windows

1. Ir a **Configuracion > Dispositivos > Impresoras**
2. Click en "Agregar impresora"
3. Seleccionar la impresora de la lista
4. Completar configuracion

### Paso 3: Configurar en App

1. Ir a **Configuracion**
2. Seccion **Impresora Termica**
3. Click en **"Configurar Impresora"**
4. Cambiar a modo **"Windows Printer"**
5. Seleccionar impresora de la lista
6. Click en **"Guardar"**

### Paso 4: Probar

1. Click en **"Prueba de Impresion"**
2. Verificar que imprime via Windows

---

## Configurar Impresora de Red

### Requisitos

- Impresora con puerto Ethernet o WiFi
- Conectada a la misma red que la PC
- IP estatica configurada (recomendado)

### Paso 1: Conectar a Red

1. Conectar cable Ethernet a la impresora
2. Conectar al router/switch
3. Encender impresora
4. La impresora obtiene IP (o configurar manualmente)

### Paso 2: Verificar IP

Desde la impresora:
1. Imprimir pagina de configuracion (boton de test)
2. Anotar la direccion IP

### Paso 3: Agregar en Windows

1. Ir a **Configuracion > Dispositivos > Impresoras**
2. Click en "Agregar impresora"
3. Seleccionar "La impresora no esta en la lista"
4. Elegir "Agregar usando direccion TCP/IP"
5. Ingresar la IP de la impresora
6. Completar configuracion

### Paso 4: Configurar en App

Usar metodo "Windows Printer" descrito arriba.

---

## Cajon de Dinero

### Requisitos

- Cajon conectado a la impresora (puerto RJ11)
- Impresora con soporte para abrir cajon

### Configuracion

1. En configuracion de impresora
2. Activar **"Abrir cajon automaticamente"**
3. El cajon se abre con cada impresion

### Abrir Manualmente

Desde cualquier venta:
- Click en icono de cajon
- O usar atajo de teclado (si configurado)

---

## Configuracion Avanzada

### Ancho del Papel

| Ancho | Caracteres por linea | Uso |
|-------|---------------------|-----|
| 80mm | 48 | Estandar POS |
| 58mm | 32 | Compacto |

### Codificacion

Por defecto: CP437 (compatible con acentos)

Si hay problemas con caracteres:
1. Verificar codificacion de la impresora
2. Ajustar en configuracion avanzada

### Densidad de Impresion

Algunas impresoras permiten ajustar densidad.
Util para:
- Extender vida de la cabeza termica
- Ajustar contraste

---

## Formato del Recibo

### Contenido Estandar

```
================================
     UNIFORMES CONSUELO RIOS
         Cra 7 #15-30
       Tel: 311-234-5678
================================
Venta: VNT-2026-0001
Fecha: 22/01/2026 14:30
Vendedor: Juan Perez
Cliente: Maria Garcia
--------------------------------
PRODUCTOS:
1x Camisa Polo Azul (M)    $45,000
2x Pantalon Gris (12)      $90,000
--------------------------------
Subtotal:                 $135,000
Descuento (10%):          -$13,500
--------------------------------
TOTAL:                    $121,500
--------------------------------
Metodo: Efectivo
Recibido:                 $150,000
Vuelto:                    $28,500
================================
Gracias por su compra!
================================
```

### Personalizacion

Desde **Configuracion > Info del Negocio**:
- Nombre del negocio
- Direccion
- Telefono
- Mensaje de pie

---

## Sincronizacion Multi-dispositivo

### Concepto

Permite que ventas hechas en otros dispositivos se impriman en la caja principal.

### Configurar

1. En PC principal (con impresora):
   - Ir a **Configuracion > Sincronizacion de Caja**
   - Activar "Modo Automatico"

2. En otros dispositivos:
   - Las ventas en efectivo se envian automaticamente a la cola

### Panel de Cola

Ver ventas pendientes de imprimir:
1. Click en icono de impresora (barra superior)
2. Ver lista de ventas en cola
3. Imprimir individual o todas

---

## Troubleshooting

### Impresora No Detectada

**Posibles causas:**
- Cable USB suelto
- Puerto incorrecto
- Driver no instalado

**Solucion:**
1. Reconectar cable USB
2. Verificar puerto en Administrador de Dispositivos
3. Reinstalar driver

### No Imprime

**Posibles causas:**
- Impresora apagada
- Sin papel
- Puerto incorrecto en app

**Solucion:**
1. Verificar encendido
2. Verificar papel
3. Verificar configuracion de puerto

### Caracteres Raros

**Posibles causas:**
- Codificacion incorrecta
- Driver generico

**Solucion:**
1. Instalar driver del fabricante
2. Ajustar codificacion en configuracion

### Impresion Lenta

**Posibles causas:**
- Conexion inestable
- Spooler de Windows congestionado

**Solucion:**
1. Usar modo directo (no Windows)
2. Reiniciar servicio de impresion

### Cajon No Abre

**Posibles causas:**
- Cajon no conectado
- Impresora no soporta cajon
- Opcion desactivada

**Solucion:**
1. Verificar conexion RJ11
2. Consultar manual de impresora
3. Activar opcion en configuracion

---

## Mantenimiento

### Limpieza

1. Apagar impresora
2. Abrir tapa
3. Limpiar cabeza termica con alcohol isopropilico
4. Dejar secar antes de usar

### Cambio de Papel

1. Abrir tapa
2. Retirar rollo vacio
3. Insertar nuevo rollo (lado termico hacia abajo)
4. Cerrar tapa

### Vida Util

- Cabeza termica: ~50km de impresion
- Cortador: ~1 millon de cortes

---

## Impresoras Recomendadas

### Economicas

| Modelo | Precio | Caracteristicas |
|--------|--------|-----------------|
| XPrinter XP-80 | ~$200,000 | USB, 80mm, cortador |
| POS-80 | ~$180,000 | USB, 80mm, basica |

### Profesionales

| Modelo | Precio | Caracteristicas |
|--------|--------|-----------------|
| Epson TM-T20III | ~$600,000 | USB, 80mm, alta velocidad |
| Star TSP143 | ~$700,000 | USB/LAN, 80mm, muy confiable |

### Red/WiFi

| Modelo | Precio | Caracteristicas |
|--------|--------|-----------------|
| Epson TM-T82X | ~$800,000 | Ethernet, 80mm |
| Star TSP650II | ~$900,000 | WiFi/LAN, 80mm |

---

## FAQ

### ¿Puedo usar cualquier impresora?

Las termicas POS de 80mm son las mas compatibles. Las de 58mm funcionan con limitaciones.

### ¿Necesito instalar drivers?

Para modo directo (USB), no. Para modo Windows, si recomendado.

### ¿Puedo imprimir por WiFi?

Si, si la impresora tiene WiFi y esta agregada en Windows.

### ¿El cajon funciona con todas las impresoras?

Solo con impresoras que tienen puerto para cajon (RJ11/RJ12).

### ¿Puedo tener multiples impresoras?

Actualmente una por dispositivo. Para multiples puntos de venta, usar sincronizacion.

---

[← Volver al indice](./README.md)
