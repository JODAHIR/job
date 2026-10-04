# Migrar productos desde CSV

En **Productos y Stock → Importar productos desde CSV**, descargá la plantilla, reemplazá las filas de ejemplo por tus productos, elegí el archivo, revisá la vista previa y pulsá **Importar productos validados**.

Columnas (obligatorias en el encabezado):

| Columna | Contenido |
|---|---|
| sku | Opcional por fila. Vacío asigna un código numérico; un código existente se rechaza. |
| descripcion | Nombre obligatorio, hasta 300 caracteres. |
| categoria | Categoría obligatoria, hasta 100 caracteres. |
| costo | Costo unitario, cero o mayor. |
| precio | Precio de venta obligatorio, mayor que cero. |
| iva | Obligatorio: 10, 5, 0 o exento. |
| stock | Stock inicial, cero o mayor. |
| stock_minimo | Stock mínimo, cero o mayor. |
| promedio_diario | Unidades promedio vendidas por día, cero o mayor. |

Formato UTF-8, separado por punto y coma o coma. Usá punto decimal (`0.5`) y no uses separadores de miles (`8500`, no `8.500`). Las celdas con separadores o saltos de línea deben estar entre comillas dobles. Máximo 200 productos y 2 MB por archivo. Los campos numéricos opcionales vacíos se consideran cero.

La importación agrega productos: no modifica ni reemplaza los existentes. Requiere permisos de productos y conexión. Se valida todo el archivo antes de empezar. Cada producto se confirma por separado; no es una operación de todo o nada. Ante un error, revisá los estados de las filas: los importados permanecen guardados y las operaciones pendientes se conservan en la cuenta del navegador. Sincronizá antes de continuar y no vuelvas a importar las filas ya guardadas.

Los productos nuevos reciben códigos como `000001`, `000002`, etc., tomando el mayor SKU numérico existente. Los códigos anteriores alfanuméricos se conservan. La vista previa reserva también los SKU escritos en el mismo archivo para evitar colisiones con los automáticos. Si otra persona modifica el catálogo al mismo tiempo, la sincronización puede detenerse para resolver el conflicto.
