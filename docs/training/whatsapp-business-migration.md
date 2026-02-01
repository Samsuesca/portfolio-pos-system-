# Guia de Migracion: WhatsApp Personal a WhatsApp Business

> **Estado**: Pendiente de ejecutar
> **Numero del negocio**: 300-123-4567
> **Fecha de creacion**: 2026-01-31

---

## Contexto

El negocio Uniformes Consuelo Rios usa actualmente un numero personal de WhatsApp para atencion al cliente. El objetivo es migrar a WhatsApp Business (app gratuita) para aprovechar:

- Perfil de negocio profesional
- Respuestas rapidas predefinidas
- Mensaje de bienvenida automatico
- Mensaje de ausencia fuera de horario
- Etiquetas para organizar chats
- Catalogo de productos

---

## Situacion Especial: WhatsApp con 26GB de datos

El WhatsApp actual pesa 26GB (principalmente multimedia) en un Android antiguo,
lo que hace imposible hacer backup/transferencia normal.

### Solucion: Limpieza de almacenamiento + Backup selectivo

Antes de migrar, hay que reducir el peso eliminando multimedia innecesaria.

---

## CHECKLIST DE MIGRACION

### FASE -1: Limpieza de Almacenamiento (CRITICO - Hacer primero)

```
OBJETIVO: Reducir los 26GB a un tamano manejable (<5GB ideal)

PASO 1: Abrir administrador de almacenamiento
   WhatsApp > Ajustes (3 puntos) > Almacenamiento y datos > Administrar almacenamiento

PASO 2: Revisar que ocupa mas espacio
   - Veras lista de chats ordenados por tamano
   - Identifica cuales son del NEGOCIO vs PERSONALES

PASO 3: Limpiar archivos grandes (mas de 5MB)
   - En "Administrar almacenamiento" hay filtro "Mas de 5 MB"
   - Seleccionar y eliminar videos/fotos grandes que no necesites
   - CUIDADO: No borrar fotos de medidas de clientes o pedidos pendientes

PASO 4: Limpiar archivos reenviados
   - Filtro "Reenviados frecuentemente"
   - Estos son memes, cadenas, etc. - se pueden borrar

PASO 5: Limpiar por tipo de archivo
   - Videos: Suelen ser los mas pesados, eliminar los innecesarios
   - GIFs: Generalmente no importantes, eliminar
   - Fotos: Revisar antes de eliminar (pueden ser de pedidos)
   - Audios: Revisar si hay audios de clientes con instrucciones

PASO 6: Limpiar chats antiguos completos
   - Chats personales muy viejos que no necesitas
   - Grupos inactivos
   - NO eliminar chats de clientes recientes

PASO 7: Verificar nuevo tamano
   - Ajustes del telefono > Apps > WhatsApp > Almacenamiento
   - Meta: Bajar de 26GB a menos de 5GB

TIPS PARA TELEFONO LENTO:
- Hacer la limpieza en varias sesiones (no todo de una vez)
- Reiniciar el telefono entre sesiones
- Conectar a WiFi y cargador mientras limpias
- Tener paciencia, puede tardar en procesar cada eliminacion
```

### FASE 0: Backup Selectivo (ANTES de tocar nada)

```
DIA -3 a -1 (dias antes de migrar)

CONVERSACIONES PERSONALES DE TU MADRE:
[ ] Identificar los chats personales importantes (familia, amigos)
[ ] Exportar cada chat importante individualmente:
    - Abrir chat > Menu (3 puntos) > Mas > Exportar chat
    - Elegir "Sin archivos multimedia" (solo texto) o "Con multimedia" si cabe
    - Enviar a email o guardar en Drive
[ ] Anotar los numeros de contactos personales importantes

CONVERSACIONES DEL NEGOCIO:
[ ] Exportar chats de clientes con pedidos pendientes
[ ] Tomar screenshots de:
    - Pedidos en proceso
    - Medidas de clientes
    - Acuerdos de precio
    - Cualquier info que necesites conservar
[ ] Crear documento con resumen de pedidos pendientes

GRUPOS:
[ ] Anotar en que grupos personales esta tu madre
    (Tendra que volver a unirse desde el numero nuevo)
[ ] Los grupos del negocio se mantendran en el mismo numero
```

### FASE 1: Preparar Perfil de Negocio

```
[ ] Preparar logo cuadrado (minimo 640x640px)
[ ] Tener lista la informacion:
    - Nombre: Uniformes Consuelo Rios
    - Categoria: Tienda de ropa
    - Descripcion: "Uniformes escolares de calidad. Confeccion a medida,
      bordados personalizados. Pedidos en linea: yourdomain.com"
    - Direccion: Calle 56 D #26 BE 04, Villas de San Jose, Boston
    - Horario: Lun-Vie 8:00-18:00, Sab 8:00-13:00
    - Email: contact@example.com
    - Web: yourdomain.com
```

### FASE 2: Dia de Migracion

```
IMPORTANTE: Hacer en dia tranquilo, NO en temporada de uniformes

[ ] 1. Verificar que todos los backups estan hechos
[ ] 2. Desinstalar WhatsApp normal del telefono
[ ] 3. Instalar WhatsApp Business desde Play Store/App Store
[ ] 4. Abrir WhatsApp Business
[ ] 5. Aceptar terminos
[ ] 6. Ingresar numero: 300-123-4567
[ ] 7. Verificar con codigo SMS
[ ] 8. Cuando pregunte si restaurar backup: SI (restaurara los chats)
[ ] 9. Configurar perfil de empresa con la info preparada
[ ] 10. Subir logo
```

### FASE 3: Configuracion de Herramientas

```
Ajustes > Herramientas para la empresa

MENSAJE DE BIENVENIDA:
[ ] Activar
[ ] Pegar texto:
---
Hola! Bienvenido a Uniformes Consuelo Rios

Confeccionamos uniformes escolares de calidad con:
- Medidas personalizadas
- Bordado incluido
- Seguimiento de tu pedido

Haz tu pedido en linea: yourdomain.com

O escribenos aqui y te atendemos con gusto.

Horario: Lun-Vie 8am-6pm | Sab 8am-1pm
---

MENSAJE DE AUSENCIA:
[ ] Activar
[ ] Programar: Fuera del horario de atencion
[ ] Pegar texto:
---
Gracias por escribirnos!

En este momento estamos fuera de horario.
Te responderemos en cuanto abramos.

Horario de atencion:
Lunes a Viernes: 8:00am - 6:00pm
Sabados: 8:00am - 1:00pm

Mientras tanto, puedes ver el catalogo en:
yourdomain.com
---

RESPUESTAS RAPIDAS:
[ ] Crear cada una:

/hola
Hola! Gracias por contactarnos. En que podemos ayudarte hoy?

/horario
Nuestro horario de atencion es:
Lunes a Viernes: 8:00am - 6:00pm
Sabados: 8:00am - 1:00pm

/web
Puedes ver el catalogo completo de uniformes de tu colegio y hacer tu pedido en:
yourdomain.com

/ubicacion
Estamos ubicados en: Calle 56 D #26 BE 04, Villas de San Jose, Boston - Medellin

/pago
Aceptamos los siguientes metodos de pago:
- Efectivo
- Nequi: [NUMERO]
- Transferencia: [CUENTA]

/listo
Tu pedido esta listo!
Puedes recogerlo en nuestra direccion.
Horario: Lun-Vie 8am-6pm | Sab 8am-1pm
Te esperamos!

/medidas
Para tomar las medidas necesitamos:
- Contorno de pecho
- Contorno de cintura
- Largo de camisa/falda
Puedes enviarnos las medidas o traerlo para tomarlas aqui.

/demora
Tu pedido esta en proceso de confeccion. Te avisaremos apenas este listo.
Gracias por tu paciencia!

/gracias
Gracias por tu compra!
Fue un placer atenderte. Si tienes alguna duda, escribenos.

ETIQUETAS:
[ ] Crear etiquetas:
    - Consulta (amarillo)
    - Cotizacion enviada (naranja)
    - Pedido confirmado (azul)
    - En produccion (morado)
    - Listo para entrega (verde)
    - Entregado (gris)
```

### FASE 4: Nuevo Numero para Tu Madre

```
[ ] Comprar SIM nueva para tu madre
[ ] Instalar WhatsApp normal en su telefono con el numero nuevo
[ ] Agregar contactos personales importantes manualmente
[ ] Unirse de nuevo a grupos personales (pedir que la agreguen)
```

### FASE 5: Comunicacion a Clientes

```
BROADCAST A CLIENTES (enviar desde WhatsApp Business):
---
Uniformes Consuelo Rios - Novedad

Hola! Te escribimos para contarte que hemos mejorado nuestra atencion.

Ahora tenemos WhatsApp Empresarial para atenderte mejor:
- Respuestas mas rapidas
- Horario de atencion claro
- Catalogo de productos

El numero sigue siendo el mismo: 300-123-4567

Y recuerda que tambien puedes hacer tu pedido en linea:
yourdomain.com

Gracias por preferirnos!
---

ESTADO DE WHATSAPP (poner durante 1 semana):
- Imagen con logo + texto: "Ahora con WhatsApp Business! Mejor atencion, misma calidad."

ACTUALIZAR EN OTROS LUGARES:
[ ] Google My Business (si tienen)
[ ] Facebook/Instagram
[ ] Tarjetas de presentacion
[ ] Volantes
[ ] Pagina web (ver seccion de codigo abajo)
```

---

## ACTUALIZACIONES EN EL CODIGO

### Archivos a modificar cuando cambie el numero

Si el numero cambia, actualizar en:

| Archivo | Linea | Descripcion |
|---------|-------|-------------|
| `web-portal/lib/businessInfo.ts` | 51 | `whatsapp_number` default |
| `web-portal/app/pago/page.tsx` | 245 | Numero hardcodeado |
| `web-portal/app/soporte/page.tsx` | 312-354 | Varios numeros |
| `web-portal/app/[school_slug]/not-found.tsx` | 125 | Link wa.me |
| `web-portal/app/page.tsx` | 372-404 | Links wa.me |
| `web-portal/app/[school_slug]/page.tsx` | 893 | Link yomber |

### Comando para buscar todos los lugares

```bash
grep -r "573001234567\|310.599.7451\|3001234567" --include="*.tsx" --include="*.ts" .
```

---

## FUTURO: WhatsApp Business API

Cuando el negocio crezca, se puede migrar a WhatsApp Business API (Meta Cloud API) para:
- Notificaciones automaticas (pedido listo, confirmacion de compra)
- Integracion directa con el sistema
- Mensajes masivos programados

El backend ya tiene la infraestructura preparada en:
- `backend/app/services/whatsapp.py`
- `backend/app/core/config.py` (variables WHATSAPP_*)

Costo: ~$0.0008 USD por mensaje despues de 1,000 gratis/mes.

---

## CONTACTO SOPORTE TECNICO

Para actualizar el codigo despues de la migracion:
- Desarrollador: Angel Samuel
- Archivo principal: `web-portal/lib/businessInfo.ts`

---

*Documento creado: 2026-01-31*
