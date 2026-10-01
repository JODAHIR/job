# StockPro 8 · usuarios y roles

HTML completo y adaptable en `index.html`, con Firebase del proyecto `despensa-5dd6d`. Conserva productos, POS, clientes, cuenta corriente, proveedores, compras, créditos/pagos, caja, movimientos, IVA 10/5/exento, facturación opcional, timbrados, backup y previsión de faltantes de V6.3/V7.

## Permisos

| Función | Administrador | Cajero | Encargado |
|---|---|---|---|
| Ventas, clientes y cobros | Sí | Sí | No |
| Abrir, operar y cerrar su caja | Sí | Sí | No |
| Supervisar las cajas | Sí | No | No |
| Productos, proveedores, compras y ajustes | Sí | No | Sí |
| Gestionar cajeros y encargados | Sí | No | Sí |
| Gestionar otros administradores | Sí | No | No |
| Timbrados, límites de crédito y restauración | Sí | No | No |

El superusuario inicial queda protegido. Nadie puede cambiar su propio rol desde la aplicación. El cajero consulta sus ventas y su caja; puede registrar clientes pero no aumentar sus límites de crédito. Las ventas a crédito del cajero respetan el límite autorizado. El encargado no recibe información de clientes, ventas ni créditos. Cada persona usa su propia cuenta.

## Activación (requiere acceso administrativo a Firebase)

El HTML y el backend se activan juntos. **No reemplazar el HTML publicado antes de desplegar las funciones y reglas.** Este repositorio no contiene credenciales privadas ni activa cuentas por sí solo.

1. Exportar backup de V7 y sincronizar todas las operaciones pendientes en cada dispositivo. La caché V7 se conserva, pero no se migra automáticamente a la cola V8.
2. En Firebase Authentication, habilitar correo/contraseña. Crear o identificar la cuenta del administrador inicial. Si ya hay datos V7, debe ser la misma cuenta propietaria de esos datos.
3. El proyecto necesita Cloud Firestore `(default)` y un plan que permita Cloud Functions (Blaze). Revisar facturación antes de desplegar. No usar la configuración Firebase de la raíz del repositorio: corresponde a otra aplicación.
4. Desde `stockpro-firebase/functions`, ejecutar `npm ci`. Con una sesión administrativa autorizada de Google Cloud, configurar credenciales predeterminadas mediante `gcloud auth application-default login` y ejecutar `node bootstrap.js CORREO_DEL_ADMINISTRADOR`. No descargar ni guardar claves de cuenta de servicio. El script obtiene el UID existente y preserva `stockproUsers/{UID}`.
5. Desde `stockpro-firebase`, con Firebase CLI autenticado: `firebase deploy --project despensa-5dd6d --only functions:stockpro,firestore:rules`. Si otras aplicaciones comparten esta base, integrar sus reglas antes: el archivo entregado deniega todas las rutas ajenas.
6. Publicar `docs/stockpro/index.html` por HTTPS (GitHub Pages `main:/docs`, ruta `/job/stockpro/`) o probar en localhost. Añadir el dominio a los autorizados de Authentication cuando corresponda.
7. Ingresar como administrador. En **Usuarios y roles**, crear los accesos. Cada persona usa **Establecer / recuperar contraseña** desde la pantalla de ingreso y recibe el enlace de Firebase en su correo. No se comparten contraseñas.

Desplegar estas reglas bloquea el acceso directo de los clientes V7. Planificar el cambio con las cajas cerradas. Para revertir, mantener una copia de HTML, reglas y datos previos; no restaurar reglas antiguas sin considerar que permiten el modelo de propietario de V7.

## Contingencia y límites

Las operaciones se guardan primero en el navegador y luego se envían como órdenes al servidor. Una revisión compartida evita sobrescribir cambios de otro usuario. El identificador de operación impide duplicar una venta si se pierde la respuesta. Firebase vuelve a comprobar el rol y el estado de la cuenta en cada operación.

Sin conexión se conserva la cola. Al reconectar, una cuenta desactivada no puede enviar sus operaciones. El navegador no puede borrar remotamente una copia que permanece offline; cerrar sesión en equipos compartidos. No borrar almacenamiento local ni usar modo privado para operar. La página alojada necesita red para descargarse nuevamente; el HTML descargado contiene los SDK y estilos, y no requiere red para la demo local.

Los estados visibles distinguen conectado, pendiente, sin conexión, error y conflicto. Ante conflicto, descargar **Mis operaciones pendientes** y usar **Guardar copia y cargar Firebase**; revisar y registrar únicamente operaciones que falten. Nunca se fusionan stock ni facturas automáticamente. Una factura pendiente no debe entregarse como emitida. Se conserva la restricción de impresión hasta confirmar la sincronización.

Solo el administrador restaura backups. Se rechazan cambios en ventas existentes y retrocesos de numeración. El backup de la interfaz contiene la caja propia del administrador; para un respaldo integral de todos los turnos y auditorías usar la exportación administrativa de Firestore. Máximo 450 documentos modificados por operación. El backend lee el conjunto completo para aplicar operaciones consistentes; para grandes volúmenes se debe paginar y separar agregados. La previsión usa el promedio diario configurado y un horizonte de 14 días.

Los comprobantes siguen siendo administrativos internos; no hay integración fiscal electrónica.

## Estructura y seguridad

- `stockproConfig/main`: UID del propietario original, establecido solo con acceso administrativo.
- `stockproMembers/{uid}`: rol y acceso activo. El navegador solo puede leer su propia membresía; ninguna escritura directa.
- `stockproUsers/{ownerUid}`: catálogos `products/clients/suppliers`, `sales`, `purchases`, `credits/payments`, `stamps`, `moves`, `cash/cashMoves/cashClosings`, revisión `meta/state` y auditorías `operations/accessAudit`.
- La caja original conserva `cash/current`; las demás usan `cash/{uid}`. Ventas y movimientos nuevos registran operador y turno.
- `stockproSnapshot`, `stockproOperate` y `stockproUsers`: funciones autenticadas que filtran lecturas y validan permisos/valores antes de escribir transaccionalmente. Modificar el HTML no concede permisos.

El archivo fuente de la capa de roles es `roles-client.js`; queda integrado en el HTML con `python3 stockpro-firebase/build-client.py`. No editar solamente la copia incrustada.

## Verificación

`cd stockpro-firebase/functions && npm test` ejecuta las pruebas de dominio. Se verificó además con emuladores aislados y Chrome: tres roles, cuenta no habilitada, alta de cajero por encargado, rechazo de ascenso a administrador, ventas/caja propia, supervisión, lectura directa denegada, cambio de rol directo denegado, cola offline, ajustes y revocación inmediata con conexión.

Estas pruebas no acreditan despliegue ni configuración del proyecto real. El informe `stockpro-firebase/security-audit.json` documenta alcance y límites. Referencias: [funciones callable](https://firebase.google.com/docs/functions/callable), [reglas y bibliotecas de servidor](https://firebase.google.com/docs/firestore/security/rules-conditions).
