# Revisión de compras a proveedores

1. En **Compras**, registrá la recepción como siempre. Las compras nuevas y anteriores quedan **Pendientes**.
2. Entrá con un usuario **Encargado**, con acceso a Compras, y elegí **Revisar**. También podés abrir la revisión desde el Histórico de un proveedor.
3. Corregí fecha, proveedor, producto, cantidad, costo o comprobante. Indicá un motivo y pulsá **Guardar corrección**.
4. Revisá los datos y pulsá **Verificar y bloquear**. Confirmá el aviso. Una compra verificada no se puede editar, borrar ni alterar restaurando un backup, tampoco por Administrador.

El historial muestra responsable, fecha/hora, motivo y valores anteriores/nuevos. Los demás roles con acceso pueden consultarlo; solo Encargado corrige y verifica. Se conserva el usuario que registró originalmente la compra.

Cambiar cantidad o producto corrige el stock por la diferencia, con movimientos de entrada/salida. Se rechaza si deja stock negativo. Corregir el costo histórico **no actualiza** el costo actual del catálogo.

Sin conexión, los cambios quedan pendientes en el dispositivo. El bloqueo se confirma para los demás dispositivos al sincronizar. Si otra persona cambió la compra, revisá el conflicto en **Datos y sincronización** antes de reintentar. No borres los datos del navegador con operaciones pendientes.

Las compras incluyen su historial en el backup. La restauración preserva las compras existentes exactamente; las nuevas importaciones ingresan pendientes y sin historial de verificación externo. Se admiten hasta 99 correcciones por compra, reservando una entrada adicional para la verificación definitiva.

La fecha/hora del historial corresponde al dispositivo (se acepta una diferencia máxima de cinco minutos frente al servidor al sincronizar). El recibo inmutable de cada operación registra además la hora del servidor en Firebase. No se requiere Blaze ni Cloud Functions.
