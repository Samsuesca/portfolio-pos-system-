# Configuracion y Administracion

Guia completa del panel de configuracion del sistema.

---

## Acceso

- **Ruta:** Menu lateral > Configuracion
- **Permisos:** Todos los usuarios (algunas secciones solo para Admin/Superusuario)
- **Tipo:** Modulo mixto (algunas configuraciones globales, otras por usuario)

---

## Vista General

El panel de Configuracion permite gestionar:
- Conexion al servidor
- Perfil de usuario
- Seguridad (contrasena, email)
- Colegios (solo superusuarios)
- Usuarios y permisos (solo superusuarios)
- Zonas de envio (solo superusuarios)
- Informacion del negocio (solo superusuarios)
- Impresora termica
- Sincronizacion de caja
- Notificaciones

---

## Configuracion del Servidor

### Selector de Entorno

Tres opciones predefinidas:

| Entorno | Descripcion | URL |
|---------|-------------|-----|
| **Produccion** | Servidor oficial en vivo | https://yourdomain.com |
| **Desarrollo** | Servidor de pruebas | http://localhost:8000 |
| **Local Docker** | Contenedor local | http://localhost:8000 |

### URL Personalizada

Para conectar a otro servidor:
1. Ingresar la URL en el campo "URL Personalizada"
2. Click en **"Aplicar"**

### Estado de Conexion

- **Verde (Conectado):** El servidor responde correctamente
- **Rojo (Desconectado):** Sin conexion al servidor

---

## Perfil de Usuario

### Ver Informacion

Muestra:
- Nombre de usuario (no editable)
- Nombre completo
- Email
- Rol (Superusuario, Admin, Vendedor, etc.)

### Editar Perfil

1. Click en **"Editar Perfil"**
2. Modificar:
   - Nombre completo
   - Email
3. Click en **"Guardar"**

---

## Seguridad

### Cambiar Contrasena

1. Click en **"Cambiar Contrasena"**
2. Ingresar:
   - Contrasena actual
   - Nueva contrasena (minimo 6 caracteres)
   - Confirmar nueva contrasena
3. Click en **"Cambiar Contrasena"**

### Cambiar Correo Electronico

1. Click en **"Cambiar Correo"**
2. Ingresar el nuevo correo
3. Click en **"Enviar Verificacion"**
4. Revisar bandeja de entrada del nuevo correo
5. Click en el enlace de verificacion (expira en 24 horas)

> **Nota:** El cambio no es efectivo hasta verificar el nuevo correo.

---

## Administrar Colegios

**Acceso:** Solo Superusuarios

### Ver Colegios

Lista de todos los colegios con:
- Logo
- Nombre
- Codigo
- Color primario
- Email y telefono
- Estado (Activo/Inactivo)

### Crear Colegio

1. Click en **"Nuevo"**
2. Completar:
   - Nombre del colegio
   - Codigo (ej: COL001)
   - Email (opcional)
   - Telefono (opcional)
   - Color primario
   - Logo (imagen)
3. Click en **"Guardar"**

### Editar Colegio

1. Click en el icono de lapiz del colegio
2. Modificar campos necesarios
3. Click en **"Guardar"**

### Activar/Desactivar Colegio

1. Click en el icono de check/X del colegio
2. Los colegios inactivos no aparecen en el selector

---

## Administrar Usuarios

**Acceso:** Solo Superusuarios

### Panel de Usuarios

Abre un panel lateral con gestion completa de usuarios.

### Crear Usuario

1. Click en **"Nuevo Usuario"**
2. Completar:
   - Nombre de usuario (unico)
   - Nombre completo
   - Email
   - Contrasena temporal
   - Es superusuario (checkbox)
3. Click en **"Crear"**

### Asignar Roles por Colegio

Cada usuario puede tener diferentes roles en diferentes colegios:

| Rol | Descripcion |
|-----|-------------|
| admin | Acceso completo al colegio |
| seller | Puede vender y ver inventario |
| viewer | Solo lectura |

Para asignar:
1. Click en el usuario
2. En la seccion de colegios, seleccionar colegio y rol
3. Click en **"Agregar"**

### Desactivar Usuario

1. Click en el icono de papelera
2. Confirmar desactivacion

---

## Zonas de Envio

**Acceso:** Solo Superusuarios

### Ver Zonas

Lista de zonas con:
- Nombre
- Descripcion
- Costo de envio
- Dias estimados
- Estado

### Crear Zona

1. Click en **"Nueva Zona"**
2. Completar:
   - Nombre (ej: "Zona Norte")
   - Descripcion (barrios incluidos)
   - Costo de envio ($)
   - Dias estimados de entrega
3. Click en **"Guardar"**

### Editar/Desactivar Zona

Similar a la gestion de colegios.

---

## Informacion del Negocio

**Acceso:** Solo Superusuarios

### Secciones

#### General

| Campo | Descripcion |
|-------|-------------|
| Nombre del Negocio | Nombre oficial |
| Nombre Corto | Abreviatura (ej: UCR) |
| Eslogan | Frase comercial |

#### Contacto

| Campo | Descripcion |
|-------|-------------|
| Telefono Principal | Linea principal |
| Telefono Soporte | Linea de ayuda |
| WhatsApp | Numero sin espacios ni + |
| Email Contacto | Email publico |
| Email Envio | Para notificaciones (noreply) |

#### Ubicacion

| Campo | Descripcion |
|-------|-------------|
| Direccion Linea 1 | Direccion principal |
| Direccion Linea 2 | Barrio, sector |
| Ciudad | Ciudad |
| Departamento | Estado/Provincia |
| Pais | Pais |
| URL Google Maps | Link para abrir en mapas |

#### Horarios

| Campo | Descripcion |
|-------|-------------|
| Lunes a Viernes | Horario de semana |
| Sabados | Horario sabado |
| Domingos | Horario domingo (o "Cerrado") |

#### Web y Redes

| Campo | Descripcion |
|-------|-------------|
| Sitio Web | URL del sitio |
| Facebook | URL de pagina |
| Instagram | URL de perfil |

### Guardar Cambios

Click en **"Guardar"** cuando termines de editar.

---

## Impresora Termica

### Estado Actual

Muestra:
- **Configurada:** Puerto activo
- **No configurada:** Sin impresora

### Configurar Impresora

1. Click en **"Configurar Impresora"**
2. Ver guia completa en [printer-setup.md](./printer-setup.md)

---

## Sincronizacion de Caja

**Disponible:** Solo cuando hay impresora configurada

### Que Es

Permite recibir e imprimir automaticamente ventas en efectivo realizadas desde otros dispositivos (admin portal, celulares, otras PCs).

### Estado de Conexion

- **Conectado (SSE):** Recibiendo eventos en tiempo real
- **Desconectado:** Sin conexion activa

### Modo Automatico

| Opcion | Descripcion |
|--------|-------------|
| **Automatico** | Imprime automaticamente cada venta |
| **Manual** | Muestra notificacion para imprimir |

### Abrir Cajon Automaticamente

Solo visible en modo automatico. Abre el cajon de dinero con cada impresion.

### Sonido de Notificacion

Reproduce sonido al recibir nueva venta.

---

## Notificaciones

### Configuracion Disponible

| Notificacion | Descripcion |
|--------------|-------------|
| Stock bajo | Alerta cuando inventario es bajo |
| Nuevas ventas | Notificacion de ventas completadas |
| Encargos listos | Pedidos listos para entregar |

---

## Informacion del Sistema

Al final de la pagina se muestra:

| Info | Descripcion |
|------|-------------|
| Logo | Logo de la aplicacion |
| Nombre | Nombre del sistema |
| Version | Version del sistema |
| Servidor | URL actual de conexion |
| Estado | Conectado/Desconectado |
| Usuario | Usuario actual |
| Rol | Rol del usuario |
| Version App | Version de la app Tauri |

---

## Permisos por Seccion

| Seccion | Vendedor | Admin | Superusuario |
|---------|----------|-------|--------------|
| Servidor | Si | Si | Si |
| Perfil | Si | Si | Si |
| Seguridad | Si | Si | Si |
| Colegios | No | No | Si |
| Usuarios | No | No | Si |
| Zonas Envio | No | No | Si |
| Info Negocio | No | No | Si |
| Impresora | Si | Si | Si |
| Sincronizacion | Si | Si | Si |
| Notificaciones | Si | Si | Si |

---

## Buenas Practicas

### Seguridad

1. Cambiar contrasena cada 3 meses
2. Usar contrasenas fuertes (8+ caracteres, numeros, simbolos)
3. No compartir credenciales entre usuarios

### Colegios

1. Usar codigos consistentes (COL001, COL002)
2. Subir logos de buena calidad
3. Mantener informacion de contacto actualizada

### Usuarios

1. Crear usuario individual para cada persona
2. Asignar rol minimo necesario
3. Desactivar usuarios que ya no usan el sistema

### Impresora

1. Probar impresion despues de configurar
2. Verificar conexion antes de horas pico
3. Tener rollo de papel de respaldo

---

## FAQ

### ¿Como cambio de servidor?

En la seccion "Configuracion del Servidor", selecciona el entorno o ingresa URL personalizada.

### ¿Por que no veo la seccion de Colegios?

Solo superusuarios tienen acceso. Contacta al administrador.

### ¿Puedo tener multiples impresoras?

Actualmente el sistema soporta una impresora por dispositivo.

### ¿Que pasa si olvido mi contrasena?

Contacta al superusuario para que la restablezca.

---

[← Volver al indice](./README.md)
