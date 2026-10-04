# StockPro 8.1 · Plan gratuito

Página: https://jodahir.github.io/job/stockpro/
Proyecto Firebase: `despensa-5dd6d`. Firestore Standard `(default)` en `us-central1`, plan Spark. No requiere Cloud Functions ni activar facturación. El HTML incluye estilos y SDK para uso local; Firebase necesita conexión para confirmar las operaciones.

## Primer ingreso

1. Abrir la página: se muestra la pantalla de ingreso.
2. Escribir el correo autorizado y una contraseña propia de al menos 8 caracteres. Pulsar **Crear mi cuenta**.
3. Revisar el correo (también spam), abrir el enlace de verificación y regresar a **Iniciar sesión**.
4. Para una cuenta existente usar **Iniciar sesión** o **Recuperar contraseña**.

Crear una cuenta no concede acceso. Su correo verificado debe estar autorizado en `stockproAccess`. Los administradores y encargados agregan correos desde **Usuarios y roles**. No se crean contraseñas de otras personas ni se comparten credenciales.

## Roles

- **Administrador:** todos los módulos, gestión de usuarios y administradores, timbrados, consulta de límites de crédito, backup/restauración y supervisión de cajas.
- **Cajero:** ventas, clientes, cobros y su propio turno de caja. Consulta sus ventas y no recibe costos de productos, proveedores ni compras. No modifica límites de crédito.
- **Encargado:** productos, proveedores, compras, ajustes y gestión de cajeros/encargados. No administra cuentas de administrador.

Nadie cambia su propio rol. El administrador inicial está protegido por una configuración que el cliente no puede modificar. Desactivar el correo bloquea las operaciones en Firebase; las copias ya descargadas sin conexión no se pueden borrar remotamente.

## Operación y contingencia

Se mantienen los módulos de V6.3/V7: stock, POS y búsqueda, clientes/cuenta corriente, proveedores, compras, créditos y pagos, caja, movimientos, IVA 10/5/exento, facturación opcional, ABM de timbrados y numeración, backup/restore y previsión de faltantes.

Abrir caja antes de vender. Los cobros en efectivo aumentan la caja del operador. Las facturas se imprimen después de confirmar venta, stock y numeración. Los comprobantes son administrativos internos: no hay integración fiscal electrónica.

En esta implementación sin servidor, cada venta admite **hasta 10 productos distintos** para mantenerse dentro de los límites de validación de Firestore. Dividir carritos mayores en tickets separados. La previsión usa el promedio diario configurado y un horizonte de 14 días.

Cada orden se conserva primero en el navegador. Ante una desconexión, las ventas sin factura quedan pendientes y se reintentan cuando vuelve la red. Las altas de registros y créditos deben sincronizarse antes de usarlos en otra operación. No borrar el almacenamiento del navegador ni utilizar modo privado para operar.

Una revisión compartida impide sobrescribir cambios de otra persona. Ante conflicto, descargar **Mis operaciones pendientes** y elegir **Guardar copia y cargar Firebase**. Revisar y volver a registrar únicamente las operaciones que falten. No se fusiona stock ni numeración automáticamente. Las operaciones rechazadas permanecen en la copia local.

Solo el administrador restaura backups; no puede alterar ventas ya guardadas ni retroceder numeración. El backup de la interfaz contiene su propia caja. Para respaldar otros turnos y auditorías se necesita una exportación administrativa por lotes; las exportaciones administradas y backups programados de Firebase pueden requerir facturación. Lotes grandes pueden superar límites de reglas o escrituras: no se aplican parcialmente y se conserva la copia para dividir la migración.

La caché 8.1 está separada de V7/V8. Antes de cambiar de versión, exportar cualquier dato local pendiente de la anterior y restaurarlo con el administrador. La página alojada no tiene service worker: una nueva descarga del HTML requiere conexión. El archivo descargado permite usar la demo local sin red.

## Estructura y mantenimiento

- `stockproAccess/{correo}`: invitaciones con `email`, `name`, `role`, `active`, `updatedBy`, `updatedAt`. Lectura propia y de los gestores según jerarquía. Autoridad basada en correo verificado de Firebase Auth.
- `stockproConfig/main`: `ownerEmail`, creado administrativamente; sin escritura desde el cliente.
- `stockproStores/despensa`: `products`, `productCosts` privados, `clients`, `suppliers`, `sales`, `purchases`, `credits`, `payments`, `stamps`, `moves`, `cash/{uid}`, `cashMoves`, `cashClosings`, `meta/state`, `operations`, `saleChecks`.
- Las ventas/pagos/cierres y comprobantes de operación son inmutables. Las reglas verifican identidad, rol, revisión, vínculos de venta/stock/crédito/pago/caja y avance de timbrado. No se confía en el rol de la caché ni en los botones ocultos.
- `roles-client.js` controla interfaz/cola; `spark-client.js` usa el SDK de Firestore directamente. `stockpro-spark/build.py` integra ambos y el dominio compartido en el HTML autónomo.
- `stockpro-firebase/` conserva la implementación previa de Cloud Functions como referencia; **no se despliega para esta versión Spark**.

Para reconstruir: `python3 stockpro-spark/build.py`. Para publicar reglas desde una sesión Firebase autorizada: `npx -y firebase-tools@latest deploy --project despensa-5dd6d --config stockpro-spark/firebase.json --only firestore:rules`. No usar la configuración Firebase de la raíz: pertenece a otro sistema. Integrar otras rutas si en el futuro esta base se comparte con otra aplicación.

El plan Spark tiene cuotas. Al agotarse, la aplicación conserva pendientes y muestra error; no promete sincronización ilimitada. Las lecturas completas se hacen al entrar/sincronizar, con revisión para consistencia. Para grandes volúmenes se debe incorporar paginación y revisar el modelo.

## Validación

Pruebas de reglas en emulador: anónimo, correo no verificado, no invitado, desactivado, lectura de costos/caja/ventas ajenas, autoascenso, edición del superusuario, invitación de cajero, filtros de gestores, escritura directa y rol falsificado dentro de una transacción completa.

Pruebas en Chrome con emuladores aislados: tres roles, stock, venta, caja propia/supervisión, cola sin conexión, factura a crédito con 10 productos, cobro en efectivo, cierre, revocación y vista móvil de 390 px. El informe de pruebas no sustituye la verificación del despliegue real.

Reglas diseñadas como prototipo revisable: denegación por defecto, invitaciones verificadas y validación de operaciones acopladas. Revisar antes de ampliar el acceso a muchos usuarios. Los SDK y las pruebas no constituyen una auditoría independiente.

## Pantalla de ingreso

El sistema permanece oculto hasta verificar la cuenta y cargar el rol desde Firebase. El cajero inicia en Punto de venta; administrador y encargado en su panel. Cada menú muestra únicamente los módulos de su rol. Salir devuelve al login. Los errores de credenciales aparecen en la misma pantalla. Una sesión ya verificada conserva su contingencia offline; al recargar se requiere validar el acceso antes de abrir los módulos.

## Módulos y correos en español

El propietario definido en stockproConfig/main.ownerEmail, con rol ADMIN y correo verificado, dispone de Datos y sincronización → Módulos del sistema. Los interruptores se guardan en stockproConfig/modules y se aplican globalmente, intersectados con los permisos del rol. No eliminan registros: otros módulos pueden seguir usándolos como referencias y los backups conservan los datos. Datos y sincronización siempre permanece accesible. La venta necesita Caja; facturas, crédito y cliente identificado necesitan sus módulos. Los cambios requieren conexión; los pendientes rechazados se conservan hasta reactivar el módulo y reintentar. La restauración exige todos los módulos activos.

Solo el propietario puede cambiar interruptores, incluso frente a otros ADMIN. Las reglas validan identidad, mapa booleano completo y marcas de auditoría; las operaciones atómicas verifican el estado de los módulos. No son una auditoría independiente.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for verified invited users, protected-owner module settings, validated configuration, and atomic operation checks. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Firebase Authentication usa idioma español en la plantilla predeterminada y auth.languageCode='es' en el cliente. Afecta nuevos correos de verificación y recuperación; no modifica mensajes ya enviados.

## Líneas de crédito de clientes

Solo Encargado con Clientes habilitado puede modificar categorías, límites y vencimientos. Los nuevos clientes inician como Nuevo con ₲300.000. Ver [categorías, topes y uso](CLIENTES_CREDITO.md).

## Cierre por inactividad

Tras 5 minutos sin interacción se cierra la sesión de Firebase y aparece el login. La actividad se comparte entre pestañas del mismo navegador. Las actualizaciones de datos no extienden la sesión; la suspensión o recarga de una pestaña no reinicia el plazo. Las operaciones ya guardadas localmente y pendientes se conservan para la misma cuenta al volver a ingresar. Los formularios sin guardar y el carrito sin confirmar no se guardan como operaciones.
