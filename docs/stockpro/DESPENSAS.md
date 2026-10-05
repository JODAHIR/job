# Despensas y usuarios

1. Entrá como Administrador y abrí **Usuarios y roles**.
2. En **Despensas**, escribí el nombre y pulsá **Crear despensa**. Demo contiene los datos existentes.
3. Creá o editá un usuario. Para Cajero o Encargado elegí una despensa. Para Dueño marcá una o varias (hasta 30). Guardá.
4. El usuario debe usar ese correo, verificarlo e ingresar. Arriba verá el selector con sus despensas activas.

Dueño consulta el panel y los cierres de caja de todo el personal de la despensa elegida. En Usuarios y roles puede deshabilitar a su personal; Administrador o Encargado autorizado debe reactivarlo. No puede cambiar roles ni editar operaciones.

## Actualización de instalaciones existentes

La primera entrada del Administrador registra Demo y vincula a Demo los Cajeros y Encargados anteriores que no tenían despensa. No mueve ni reemplaza ventas, productos, créditos o cajas. La ruta histórica sigue siendo `stockproStores/despensa`. La migración puede reintentarse si se corta la conexión.

Las nuevas despensas usan `stockproStores/{storeId}` y su registro está en `stockproDespensas/{storeId}`. Las asignaciones están en `stockproAccess/{correo}`: `storeId` para personal, `storeIds` para Dueño; Administrador tiene alcance global. Las reglas controlan el acceso por despensa y el rol. La configuración de módulos sigue siendo global.

Los usuarios existentes deben recargar la página para recibir esta versión. Ante cambios de rol o de despensas se exige volver a ingresar. No se permite cambiar de despensa con operaciones pendientes, carrito o formularios abiertos. El cierre por inactividad conserva pendientes para el siguiente ingreso del mismo usuario.
