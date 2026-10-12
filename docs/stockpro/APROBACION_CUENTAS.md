# Solicitudes de acceso

En Usuarios y roles, el superadministrador protegido verá Usuarios pendientes de aprobación.

1. La persona crea su cuenta en StockPro, verifica su correo y vuelve a iniciar sesión.
2. El superadministrador pulsa Asignar rol y aprobar. Confirma el nombre y elige Cajero, Encargado, Dueño o Administrador.
3. Cajero y Encargado requieren una despensa; Dueño, una o varias. Administrador accede a todas, pero solo el superadministrador protegido puede aprobar solicitudes.
4. Al aprobar, el usuario pasa a la lista de accesos y puede volver a ingresar o reintentar el acceso.

Las cuentas anteriores aparecen cuando vuelven a iniciar sesión. Las cuentas ya autorizadas o desactivadas no generan nuevas solicitudes. La tabla se actualiza en vivo mientras está abierta. Solo se pueden aprobar correos verificados y se requiere conexión.

Se conserva quién aprobó y cuándo. Otros administradores y encargados no pueden saltarse una solicitud pendiente mediante el alta manual. Las invitaciones sin solicitud y la gestión de accesos existentes conservan sus permisos anteriores.

Compatible con Spark: stockproRequests y stockproAccess se actualizan en una transacción protegida por reglas. Sin Cloud Functions ni credenciales privadas.
