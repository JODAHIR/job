# Clientes y líneas de crédito

- **Saldo crédito** = límite autorizado − deuda pendiente. Un saldo negativo se muestra en rojo; no se oculta la deuda existente al reducir el límite.
- Cada alta inicia como **Nuevo**, con **₲300.000**, independientemente del rol que crea el cliente.
- Topes: Nuevo y Excelente **₲300.000**, Bueno **₲150.000**, Malo **₲0**. El límite controla deuda pendiente, no la suma de compras del mes. Los pagos liberan saldo; el cambio de mes no borra deudas.
- Los clientes anteriores conservan su límite y aparecen **Sin clasificar** hasta que Encargado los clasifique.
- Solo **Encargado** puede cambiar categoría y monto desde **Clientes → Editar**. Seleccionar una categoría propone su tope; puede autorizar un monto menor. Necesita tener Clientes habilitado en Módulos del sistema. Administrador y Cajero mantienen esos campos bloqueados.
- En **Clientes → Cuenta**, Encargado puede cambiar el vencimiento de cada crédito pendiente. No cambia el monto adeudado ni los pagos. No puede modificar créditos cancelados.
- Los nuevos créditos vencen por defecto el último lunes a viernes del mes, sin calendario de feriados. Si ese día ya pasó, se usa el último lunes a viernes del mes siguiente para evitar crear un crédito vencido. Encargado puede elegir otra fecha al vender si tiene Punto de venta y Caja habilitados.
- Los vencimientos existentes se conservan. Los backups no pueden cambiar límites/categorías o vencimientos de registros existentes.
- Se mantiene la cola local: los cambios sin conexión se validan nuevamente al sincronizar. No se necesitan Cloud Functions ni otro plan de Firebase.

## Ventas y vencimientos

Un cliente está en mora cuando tiene algún crédito con saldo mayor que cero y vencimiento anterior al día actual. StockPro bloquea sus ventas con cualquier medio de pago y muestra EN MORA en Clientes. El crédito que vence hoy aún está vigente. Al registrar la cancelación de los saldos vencidos podrá volver a comprar. El control también se repite al procesar una venta pendiente de sincronización.

Panel general incluye Clientes con vencimiento en fecha: muestra por defecto hoy y permite elegir otra fecha. Agrupa por cliente sus créditos pendientes y suma el saldo a cancelar; los créditos ya pagados no aparecen. El listado respeta los datos que puede consultar cada rol en la despensa seleccionada.

Ventas recientes muestra hasta 20 ventas del día y se actualiza al cambiar de fecha. Las ventas anteriores permanecen guardadas.
