# Roles activos en StockPro 8.1

Ver la matriz, primer ingreso y condiciones de uso en [README.md](README.md). El acceso es exclusivamente por correo y contraseña, con verificación del correo e invitación previa. Esta versión se diseñó para el plan gratuito Spark.


## Permisos editables por módulo

El superadministrador protegido puede marcar Cajero y Encargado en Datos y sincronización → Módulos del sistema. Cada casilla se guarda automáticamente en `stockproConfig/modules.roles`. Sin configuración se conservan los permisos predeterminados. Administrador y Datos y sincronización permanecen disponibles. Las reglas de Firestore y el dominio de operaciones validan la asignación, no solo el menú. Los usuarios afectados deben volver a iniciar sesión; las operaciones pendientes se conservan y pueden quedar bloqueadas si se retiró su permiso.

Las ventas y cajas operativas se limitan al usuario. Productos de referencia, clientes, timbrados y otros datos necesarios para operar pueden estar disponibles como dependencia de otro módulo, aunque no tengan menú propio. Panel general muestra los datos que el rol puede consultar. Para habilitar ventas se necesita también Caja. La creación manual de créditos, la eliminación de clientes, el backup/restore y la administración de administradores conservan sus restricciones de administrador. Un usuario operativo con Usuarios y roles puede gestionar cuentas operativas, no promover a administrador ni modificar su propia cuenta o al propietario.
