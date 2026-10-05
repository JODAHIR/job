# Roles activos en StockPro 8.1

Ver la matriz, primer ingreso y condiciones de uso en [README.md](README.md). El acceso es exclusivamente por correo y contraseña, con verificación del correo e invitación previa. Esta versión se diseñó para el plan gratuito Spark.


## Permisos editables por módulo

El superadministrador protegido puede marcar Cajero y Encargado en Datos y sincronización → Módulos del sistema. Cada casilla se guarda automáticamente en `stockproConfig/modules.roles`. Sin configuración se conservan los permisos predeterminados. Administrador y Datos y sincronización permanecen disponibles. Las reglas de Firestore y el dominio de operaciones validan la asignación, no solo el menú. Los usuarios afectados deben volver a iniciar sesión; las operaciones pendientes se conservan y pueden quedar bloqueadas si se retiró su permiso.

Las ventas y cajas operativas se limitan al usuario. Productos de referencia, clientes, timbrados y otros datos necesarios para operar pueden estar disponibles como dependencia de otro módulo, aunque no tengan menú propio. Panel general muestra los datos que el rol puede consultar. Para habilitar ventas se necesita también Caja. La creación manual de créditos, la eliminación de clientes, el backup/restore y la administración de administradores conservan sus restricciones de administrador. Un usuario operativo con Usuarios y roles puede gestionar cuentas operativas, no promover a Administrador o Dueño ni modificar su propia cuenta o al propietario.

Las líneas de crédito y los vencimientos tienen una excepción expresa: solo Encargado con Clientes habilitado puede modificarlos, incluso frente al rol Administrador. Ver [Clientes y crédito](CLIENTES_CREDITO.md).

## Despensas y Dueño

Administrador crea despensas y asigna sus usuarios desde Usuarios y roles. Cajero y Encargado pertenecen a una única despensa; Dueño tiene una o varias. La despensa existente se llama Demo y conserva sus datos.

Dueño es independiente: puede consultar Panel general, el histórico completo de Caja y la lista de Cajeros y Encargados de la despensa seleccionada. Solo puede deshabilitarlos: no crear usuarios, reactivarlos, cambiar roles ni registrar operaciones. Sus permisos no se amplían mediante las casillas de módulos.

El selector superior permite cambiar entre despensas asignadas. Primero hay que cerrar formularios, vaciar el carrito y sincronizar los cambios pendientes. Cada despensa conserva una caché separada. Los cambios de asignación o deshabilitación bloquean la sesión afectada.

Tras cinco minutos sin actividad se vuelve al login; las operaciones pendientes se conservan. Ver [guía de despensas](DESPENSAS.md).
