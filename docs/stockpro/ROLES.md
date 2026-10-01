# Propuesta de roles de StockPro

Estado: propuesta para acordar antes de implementar. El HTML y las reglas actuales todavía trabajan con una cuenta propietaria; no aplican estos roles.

## Permisos propuestos

| Función | Administrador | Cajero | Encargado de stock |
|---|---|---|---|
| Productos, precios de venta y disponibilidad | Ver y administrar | Ver para vender | Ver y administrar |
| Costos, proveedores y compras | Administrar | Sin acceso | Administrar |
| Ajustes de stock | Administrar | Solo descuento automático por venta | Registrar con motivo |
| POS y comprobantes | Operar | Operar | Sin acceso |
| Clientes | Administrar | Buscar, crear y corregir datos de contacto | Sin acceso |
| Créditos y pagos | Administrar y fijar límites | Cobrar; vender a crédito dentro del límite autorizado | Sin acceso |
| Caja | Supervisar todos los turnos | Abrir, operar y cerrar su propio turno | Sin acceso |
| Timbrados | Configurar y desactivar | Usar numeración vigente al facturar | Sin acceso |
| Reportes | Todos | Sus ventas y su caja | Inventario, compras y faltantes |
| Usuarios y roles | Administrar | Sin acceso | Sin acceso |
| Backup completo y restauración | Administrar | Sin acceso | Sin acceso |

El costo del producto no debe descargarse al navegador del cajero: ocultar una columna no constituye control de acceso.

## Diseño necesario

1. Cada persona utiliza su propia cuenta de Firebase Authentication. No se comparten contraseñas.
2. Los datos pertenecen a una despensa común, con membresías por UID y campos `role` y `active`. Un administrador asigna el acceso; el usuario no puede asignarse o cambiar su propio rol.
3. El primer administrador se configura mediante una operación administrativa de confianza. No existe una pantalla pública para convertirse en administrador.
4. Los permisos se aplican tanto en la interfaz como en reglas y operaciones del servidor. Las membresías y la actividad se vuelven a verificar al sincronizar.
5. Productos se separan en información comercial y costos restringidos. Cada rol carga únicamente las colecciones autorizadas; el lector actual que descarga todas las colecciones requiere adaptación.
6. Cada caja tiene un turno y un responsable. Ventas, pagos y movimientos guardan el UID del operador y una fecha confirmada por el servidor. El cierre afecta al turno del cajero correspondiente.
7. Las operaciones financieras y de stock deben validarse de forma completa en un backend de confianza: totales, precios, límites de crédito, stock y secuencias. El cajero no debe poder modificar existencias mediante una escritura directa ajena a una venta válida.
8. Sin conexión, las operaciones se conservan como pendientes y se validan al reconectar. Los accesos revocados impiden confirmarlas. Una factura no se entrega con un número pendiente.
9. Se conserva un registro de auditoría de cambios de roles, ajustes, ventas, cobros, cierres y restauraciones. Las anulaciones se registran como operaciones de reversión, sin borrar el historial.
10. La migración de la cuenta propietaria actual a una despensa compartida requiere backup, comprobación de saldos y validación antes de habilitar a los demás usuarios.

## Pruebas de aceptación

- Un cajero no puede consultar costos, modificar timbrados, ajustar stock libremente ni aumentar su límite de crédito.
- Una cuenta sin membresía o inactiva no puede leer ni escribir datos de la despensa.
- Ningún usuario puede elevar sus privilegios modificando su membresía, petición HTTP o caché local.
- El encargado de stock no accede a saldos de clientes ni movimientos de caja.
- Cada cajero opera únicamente su turno; el administrador puede supervisarlos.
- Una venta reduce stock y registra los importes correctos de forma atómica; reintentos no duplican operaciones ni números.
- Cambios offline de una cuenta revocada quedan sin confirmar y se pueden recuperar para revisión administrativa.

## Decisiones a confirmar

- Si el cajero puede vender a crédito o solamente cobrar créditos existentes.
- Si el cajero puede conceder descuentos y con qué límite.
- Quién puede anular una venta y si requiere autorización de un administrador.
- Si habrá una caja por cajero o una sola caja compartida por turno.

Hasta acordar lo anterior, esta propuesta no concede acceso a usuarios ni modifica Firebase.
