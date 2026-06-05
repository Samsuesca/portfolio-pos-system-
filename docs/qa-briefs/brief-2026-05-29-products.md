# QA Brief — Módulo Productos (Uniformes Consuelo Rios)
Generado: 2026-05-29 · Para: Claude Chrome Extension (referee externo, sin contexto del repo)

## Contexto
App de gestión de uniformes escolares (Colombia, COP, español). Estás probando el **tab
de Productos** de la app interna (vendedoras/admin). Todo el texto debe estar en español.
La moneda es peso colombiano (sin decimales en la práctica).

## Acceso
- URL: http://localhost:5171  (ruta del módulo: `/products`)
- Login: __completa usuario y contraseña aquí__ (un usuario con permiso `products.view`,
  idealmente con `products.edit`, `inventory.adjust` y permisos de costos para ver todo).

## Por qué este brief
El QA interno validó la API sin credenciales (gate de auth OK, sin errores 500, validación
en español). Lo que NO se pudo probar sin sesión —y que tú debes verificar— son los flujos
autenticados y estos **edge cases concretos** detectados por análisis de código:

### Tareas dirigidas (prioritarias)

**1. Ordenamiento sobre catálogo grande (BUG sospechado — alta prioridad)**
- Entra a Productos › "Productos por Colegio". Si hay >100 productos, baja y pulsa
  **"Cargar más productos"** hasta cargar varias páginas.
- Ahora ordena por **Precio** (clic en el encabezado) ascendente. Anota el primer producto.
- Pregunta clave: ¿el producto mostrado arriba es realmente el de menor precio de **TODO**
  el catálogo, o solo de lo que está cargado en pantalla? (Sospecha: solo ordena lo cargado).
- Repite ordenando por **Stock** y por **Encargos**. Reporta si el orden parece "parcial".

**2. Costos y margen con precio 0**
- Edita o crea un producto con **precio = 0** y un costo > 0 (tab/modal de costos).
- Observa la celda **Margen** y el modal de desglose de costos. ¿Muestra `0%`, `-Infinity%`,
  `NaN%`, o un estado claro de "sin precio"? (Debe ser claro, no `Infinity`/`NaN`).
- En "Productos Compartidos", abre el modal de producto global y pon precio "0" con costo:
  revisa el bloque de margen del formulario.

**3. Ajuste de inventario con entradas raras**
- Abre "Ajustar inventario" de cualquier producto.
- Escribe en cantidad: (a) solo espacios `"   "`, (b) letras `"abc"`, (c) `"08"`, (d) vacío.
- Observa el **preview de "nuevo stock"**: ¿muestra `NaN unidades` o algo roto? ¿El botón
  Guardar queda habilitado con espacios? ¿Hay mensaje de error claro en español?
- Ajusta producto A, cierra, abre producto B: ¿el campo quedó con el valor del ajuste anterior?

**4. Galería de imágenes (lo que ve el cliente)**
- En "Tipos de Prenda", abre un tipo con imágenes. Sube/elimina/reordena/marca principal.
- ¿Se refleja de inmediato? ¿Hay límite claro (máx 10, 2MB)? ¿Mensajes en español?
- ¿Hay forma de saber, desde el tab de Productos, cuáles productos **no tienen foto**? (hoy no).

**5. Publicación web**
- Busca cualquier control para decir "este producto NO sale en la web" a nivel de producto
  de colegio. (Sospecha: no existe; solo `is_active` todo-o-nada). Reporta qué encontraste.

**6. Stats / contadores**
- Compara el número del tab ("Productos por Colegio (N)") con el total real. Cambia filtros
  de colegio y verifica que las tarjetas de stats (Total, Stock bajo, Agotados) cuadren.

### Recorrido general (5 min)
- ¿La tabla de productos muestra imágenes? (hoy no — repórtalo como fricción).
- ¿Buscar/filtrar funciona y es claro? ¿Estados de carga visibles (no pantalla en blanco)?
- ¿Algún texto en inglés filtrado? (sospecha conocida: mensaje de login "Incorrect username
  or password" en inglés).
- Redimensiona la ventana a ~1024px y ~1366px: ¿la tabla densa se mantiene usable?

### Formato de reporte (por hallazgo)
- **Dónde** · **Qué hiciste** · **Esperado** · **Actual** · **Severidad** (Crítico/Mayor/Menor/Cosmético) · **Screenshot**.
