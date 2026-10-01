# StockPro 7 · activación y uso

Ubicación en el repositorio `JODAHIR/job`: `docs/stockpro/`. La entrada es `index.html`. Con GitHub Pages configurado para publicar `main:/docs`, quedará disponible en `/job/stockpro/` después de subir estos archivos. Las reglas de esta carpeta corresponden exclusivamente al proyecto Firebase `despensa-5dd6d`; no se despliegan mediante la configuración Firebase de la raíz del repositorio, que pertenece a otra aplicación.

La nueva versión parte del archivo original `stockpro_consolidado_v6_3.html`. Incluye todos sus módulos, el rediseño adaptable y el mismo firebaseConfig solicitado, sin credenciales privadas.

## Activar Firebase

1. Abrí [Firebase Console — despensa-5dd6d](https://console.firebase.google.com/project/despensa-5dd6d/overview).
2. En **Firestore Database**, verificá o creá la base **(default)** en modo nativo compatible con los SDK de Firebase. Esta entrega fue probada con el emulador **Standard**. No usa la API MongoDB. No se pudo consultar la edición ni configuración de tu proyecto porque no había una sesión administrativa disponible.
3. En **Authentication → Sign-in method**, habilitá **Correo electrónico/contraseña**. En **Users**, creá la cuenta con la que administrarás la despensa. La aplicación permite iniciar sesión; no crea usuarios públicos.
4. En **Firestore → Rules**, publicá el contenido de `firestore.rules`. Si el proyecto tiene otras aplicaciones, integrá el bloque `stockproUsers` con sus reglas actuales: el archivo completo entregado deniega todas las demás rutas.
5. Abrí `index.html`. En **Datos y sincronización**, iniciá sesión. La primera cuenta empieza vacía; esperá el indicador **Firebase conectado**.
6. Para usarlo desde varios dispositivos, alojá el mismo HTML en HTTPS y entrá con **la misma cuenta**. Cada cuenta tiene datos separados. Para probar en un servidor local, podés servir la carpeta con `python3 -m http.server 8080` y abrir `http://localhost:8080/index.html`. Agregá el dominio de prueba o alojamiento en Authentication → Settings → Authorized domains si Firebase lo requiere.

No se publicaron reglas ni se modificaron datos en tu proyecto durante la entrega. La conexión real depende de completar esos pasos. El mensaje de error de Firebase se muestra en la pantalla de sincronización.

## Primera prueba y migración

- **Sin sesión:** usá *Cargar demo local*. Los productos, clientes, créditos y timbrado ficticios quedan solo en modo local. No se cargan automáticamente en tu cuenta.
- **Datos existentes:** exportá un backup desde V6.3. Iniciá sesión en V7 y usá *Restaurar backup*. También podés usar *Importar V6 de este navegador* si ambas versiones comparten el mismo origen y la clave `stockpro-v6` está disponible. Esa clave original no se modifica.
- Cada restauración pide confirmación y descarga antes una copia del estado actual. Se aceptan backups V6.3 y V7. En una cuenta con ventas existentes se rechaza un backup que altere esas ventas o retroceda los timbrados; revisalo en modo local.
- Una operación atómica admite hasta **450 documentos modificados** en esta entrega. Un backup o un conjunto de cambios offline mayor se conserva localmente, pero no se envía parcialmente: mostrará error y requerirá migración por lotes con asistencia técnica. Exportá la copia antes de intervenir.

## Uso y contingencia

- Abrí caja antes de vender. Buscá productos por nombre, SKU o categoría. Podés ajustar cantidades en el carrito, vender al contado o a crédito y registrar pagos desde Créditos.
- Los pagos de crédito en efectivo requieren caja abierta y suman al arqueo. Dos aperturas el mismo día tienen turnos independientes.
- Para facturar, configurá un timbrado vigente. La venta, el stock y el incremento del número se confirman juntos. Mientras la factura esté pendiente no se habilita su impresión ni se admiten nuevas operaciones; usá *Sincronizar ahora*. Sin red podés guardar ventas sin factura.
- Los comprobantes son **administrativos internos**, como en V6.3. No hay integración fiscal electrónica.
- El indicador distingue modo local, conectado, pendiente, sin conexión, error y conflicto. “Conectado” se muestra después de una lectura o escritura confirmada por el servidor; los errores no se presentan como guardados en la nube.
- Cada operación se guarda primero en una caché durable de este navegador. Si Firestore falla, se conserva y se reintenta al volver la conexión, manualmente o cada 30 segundos. Si la caché está llena o no permite escribir, se detiene la operación y se informa el problema.
- El **HTML descargado** contiene los estilos, controles y SDK necesarios: puede abrirse y recargarse localmente sin internet. Una página alojada que se cierre mientras está offline necesita volver a descargar el HTML al abrirse; esta entrega no incluye un service worker. Para usar Firebase con la mayor compatibilidad, usá HTTPS o localhost.
- La caché se separa por cuenta y por origen del navegador. No cambia de dispositivo por sí sola. No borres datos del navegador ni uses modo privado como almacenamiento permanente. Cerrá sesión en equipos compartidos y conservá backups externos; cerrar sesión mantiene la caché pendiente de esa cuenta en el equipo.
- Evitá editar la misma cuenta en dos pestañas del mismo navegador. Si otra pestaña modifica su caché, la aplicación bloquea cambios y pide recargar.

## Si aparece un conflicto

Cuando otro dispositivo cambia la misma revisión, **no se sobrescribe la nube ni se descarta la copia local**. La conciliación es manual; no se fusionan importes, stock o facturas automáticamente.

En Datos y sincronización, elegí *Guardar copia y cargar Firebase*. Se descarga tu backup pendiente y se conserva además una copia de recuperación en el navegador. Después se carga la versión del servidor. Revisá el backup y registrá solo las operaciones que falten. Una factura pendiente de la copia en conflicto no está emitida y su número no debe entregarse al cliente.

## Estructura para mantenimiento

Todos los documentos están bajo `stockproUsers/{uid}`:

| Colección | Contenido |
|---|---|
| `products`, `clients`, `suppliers` | Catálogos y existencias |
| `sales` | Venta con líneas, precios/IVA históricos y factura opcional |
| `purchases` | Recepciones con proveedor, producto y costo |
| `credits`, `payments` | Crédito y pagos separados, vinculados por `creditId` |
| `cash/current` | Estado y turno de la caja |
| `cashMoves`, `cashClosings` | Ingresos/egresos y arqueos |
| `stamps` | Vigencia, rango y próximo número |
| `moves` | Historial de inventario |
| `meta/state` | Versión del esquema, revisión y token de operación |

Las transacciones verifican una revisión común antes de escribir solo los documentos cambiados. El token permite reconocer una operación ya confirmada si se perdió la respuesta. Los lectores verifican la revisión antes y después de cargar las colecciones. No se necesitan índices compuestos; para inventarios grandes conviene incorporar consultas paginadas y un backend de operaciones.

Las reglas aíslan cuentas, validan campos básicos y exigen que cada escritura avance la revisión en la misma operación. La cuenta es **propietaria/administradora de sus datos**. No se implementan roles de cajero ni garantías contra un propietario que modifique deliberadamente el cliente. Esos requisitos necesitan reglas y un backend específicos.

La previsión mantiene el criterio de V6.3: stock dividido por venta promedio diaria configurada por producto, con sugerencia de reposición a 14 días. No es un modelo de aprendizaje automático.

## Verificación realizada

- Navegador real: desktop y móvil, carga inicial sin datos ficticios, búsqueda POS, venta, stock, compra, crédito, pago, IVA y caja por turno.
- Apertura y recarga del HTML local sin conexión, conservación de cambios, backups inválidos rechazados.
- Emuladores aislados de Firebase Authentication y Firestore Standard: inicio de sesión, transacción de factura, segundo dispositivo, actualización en vivo, recuperación offline, conflictos y aislamiento entre usuarios.
- Reglas: acceso anónimo y entre cuentas rechazado; escritura sin actualizar revisión rechazada.

La validación con emuladores no acredita la configuración del proyecto real.

Referencias: [transacciones de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [configuración web de Firebase](https://firebase.google.com/docs/web/alt-setup).
