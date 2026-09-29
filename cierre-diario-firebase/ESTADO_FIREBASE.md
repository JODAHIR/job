# Estado de configuración de cierre-9095e

- App Web: Cierre Diario Web, registrada y configurada en el HTML.
- Authentication: proveedor Correo electrónico/contraseña habilitado.
- Usuarios: no existen todavía. El usuario debe definir su correo y contraseña en Authentication → Usuarios → Agregar usuario.
- Firestore: base (default), edición Standard, ubicación nam5 (Estados Unidos), elegida por el usuario.
- Reglas Firestore: versión publicada visible en Firebase Console a las 11:30, con acceso por UID a cierres y metadatos PDF. Coincide con firestore.rules de esta entrega.
- Pruebas en el simulador oficial de reglas: lectura sin autenticación rechazada; lectura por el UID propietario autorizada; lectura desde otro UID rechazada. No se crearon documentos ni usuarios de prueba.
- Plan: Spark. No se vinculó facturación.
- Storage: Firebase indica que requiere Blaze. Bucket, reglas de Storage y CORS pendientes.
- Prueba completa de inicio de sesión y guardado real: pendiente de crear el usuario. Prueba de PDFs: pendiente también de Storage.

Las reglas son una base de seguridad por propietario; las tres pruebas realizadas no constituyen una auditoría exhaustiva. Revisarlas antes de compartir ampliamente la aplicación.

## Próximas acciones

1. En Firebase Console, complete Agregar usuario con un correo y una contraseña elegidos por usted. No comparta la contraseña por el chat.
2. Sirva el HTML por HTTP local o HTTPS, inicie sesión y guarde un cierre para validar la conexión real.
3. Si desea almacenar los PDFs en la nube, active Blaze mediante su cuenta de facturación. Después se puede crear el bucket, publicar storage.rules y configurar CORS.

Mientras Storage no esté activo, la bandeja conserva los PDFs en la caché local. Los cierres pueden sincronizarse en Firestore con una cuenta válida; no se considera finalizada la configuración de archivos.
