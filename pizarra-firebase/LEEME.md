# Mi Pizarra Digital — Firebase multiusuario

Versión adaptada del `c2.html` adjunto a «Generar pizarra digital». Conserva la estética verde/azul, tarjetas, edición de notas, comentarios en acordeón, búsqueda, arrastre por cabecera, imágenes ampliables, adjuntos y descarga. Los datos se sincronizan entre sesiones mediante Firestore. Requiere conexión.

## Configuración que necesitás de Firebase Console

1. Abrí el proyecto **pizarradig-10acf**, Configuración del proyecto → General → Tus apps. Registrá una app **Web**, si todavía no existe. Copiá su objeto `firebaseConfig` en **../docs/pizarra/firebase-config.js**: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` y `appId`. No hay API key ni appId inventados. No hace falta Analytics.
2. En Authentication → Métodos de acceso, habilitá **Correo electrónico/contraseña**. En Configuración → Dominios autorizados, agregá el dominio donde se publique y `localhost` si lo usás en desarrollo. Las contraseñas las gestiona Firebase Authentication.
3. Confirmá que exista **Cloud Firestore `(default)` con API nativa / Standard**. Este paquete usa operaciones Core del SDK web. No está preparado para una base con compatibilidad MongoDB. No fue posible consultar la edición del proyecto desde esta sesión: verificá la base existente antes de desplegar y no la reemplaces. Las consultas cruzadas de Storage apuntan a `(default)`.
4. Habilitá **Cloud Storage**, copiá el nombre exacto del bucket en el config. Puede terminar en `.firebasestorage.app` o `.appspot.com`: no lo deduzcas del projectId. El paquete usa el bucket predeterminado del proyecto. Confirmá **plan Blaze y facturación habilitada**, necesarios para desplegar Functions y utilizar Storage según los requisitos actuales de Firebase.
5. Elegí región para Functions: está configurada en `us-central1`, tanto en `functions/index.js` como en `../docs/pizarra/firebase-config.js`. Si la cambiás, actualizá ambos antes del primer despliegue.
6. Después del primer registro, obtené el **UID de la persona administradora** en Authentication. En Firestore, abrí `users/UID` y, desde Console con una cuenta de operador del proyecto, cambiá `role` a `admin` y `status` a `authorized`. El primer registro crea ese documento con `role: user`, `status: pending`. La aplicación no permite que una persona se asigne el rol admin. No se utiliza una lista de correos administradores incrustada en el navegador.

## Archivos

- `../docs/pizarra/index.html`: interfaz original adaptada.
- `../docs/pizarra/app.js`: autenticación, suscripciones, interfaz admin, cargas e importación.
- `../docs/pizarra/firebase-config.js`: única configuración web que tenés que completar.
- `functions/index.js`: operaciones autorizadas, validación, auditoría y eliminación.
- `firestore.rules` y `storage.rules`: acceso por propietario y rol en perfil.
- `firebase.json`, `.firebaserc`, `firestore.indexes.json`: configuración de despliegue.
- `cors.json`: orígenes permitidos para descargar archivos con autenticación.
- `tests/`: pruebas de la función y reglas.

## Instalación y despliegue

Necesitás Node.js 22, Firebase CLI y acceso de operador al proyecto. Ejecutá desde la carpeta `pizarra-firebase` del repositorio (no desde su raíz):

```sh
npm --prefix functions ci
firebase login
firebase deploy --project pizarradig-10acf --only firestore:rules,firestore:indexes,storage,functions:pizarra
```

Revisá las reglas existentes del proyecto antes de publicar: las incluidas deniegan colecciones y rutas ajenas a esta aplicación. Si el proyecto tiene otras apps, integrá los bloques en sus reglas en lugar de sustituirlos sin revisión. La interfaz se publica con GitHub Pages desde `main` → `/docs`; este archivo firebase.json no configura Firebase Hosting.

Cuando Firebase solicite habilitar permisos para que Storage consulte Firestore, aceptalos. La cuenta de servicio de Functions necesita acceso a Firestore y al bucket del proyecto; no incluyas sus credenciales en los archivos públicos. Desplegá también Functions: publicar solo el HTML y las reglas no alcanza.

En Cloud Shell, ajustá `cors.json` a tus dominios reales y ejecutá (reemplazando BUCKET_REAL):

```sh
gcloud storage buckets update gs://BUCKET_REAL --cors-file=cors.json
```

La app descarga mediante `getBlob` con sesión y crea URLs temporales `blob:`. No guarda `getDownloadURL` ni enlaces públicos con token en Firestore. No vuelvas público el bucket. Si compartiste enlaces de descarga con token desde otras herramientas, revocalos en Storage: los enlaces externos existentes no se invalidan solo al bloquear una cuenta en esta app.

Abrí **https://jodahir.github.io/job/pizarra/**. En Authentication del proyecto **pizarradig-10acf**, agregá el dominio `jodahir.github.io` (sin esquema ni `/job/`). `cors.json` incluye `https://jodahir.github.io`, porque CORS usa el origen completo sin la ruta del repositorio.

GitHub Pages publica únicamente la interfaz de `docs/pizarra/`. Las funciones, reglas y el bucket se despliegan en Firebase con el comando anterior; subirlos al repositorio no los activa. La portada tiene un enlace a la pizarra y esta permite volver al asistente.

Los archivos `docs/pizarra/index.html`, `app.js` y `firebase-config.js` deben permanecer juntos. Para una vista local desde la raíz del repositorio: `python3 -m http.server 5000 --directory docs`, luego abrir `http://localhost:5000/pizarra/`. No usar `file://`.

El asistente operativo sigue usando su proyecto `asistente-operativo-9ee58` y la base `conocimientos`. La pizarra usa `pizarradig-10acf`; su acceso y autorización son independientes. No copiar el config del asistente a la pizarra ni ejecutar su despliegue desde la raíz del repositorio.


## Funcionamiento

- Usuarios nuevos: quedan pendientes y ven una pantalla de espera.
- Usuarios autorizados: pueden leer y modificar su propia pizarra. El propietario se valida en el servidor; no se confía en `ownerUid` enviado por el navegador.
- Usuarios bloqueados: no pueden seguir leyendo ni escribiendo en Firebase. La interfaz se limpia al recibir el cambio de perfil. Los archivos que ya descargaron antes de bloquearlos no se pueden retirar de sus dispositivos.
- Administradores autorizados: ven usuarios, autorizan/bloquean cuentas normales, inspeccionan y editan cualquier pizarra, restauran papelera y eliminan definitivamente. Las cuentas admin se gestionan desde Console para evitar bloquear accidentalmente al último administrador.
- Papelera: la eliminación normal conserva texto, comentarios y archivos. La restauración corresponde al administrador.
- Adjuntos reemplazados o quitados: permanecen en **Papelera → Adjuntos retirados / cargas pendientes**. Restaurar un adjunto lo vuelve a asociar a su nota y manda el adjunto actual a archivos retirados.
- Eliminación definitiva de una tarjeta: borra todos sus archivos y registros de carga; conserva el evento de auditoría. El estado `purging` bloquea modificaciones y permite reintentar si falla Storage. No se ejecuta por antigüedad ni de forma automática.
- Cargas interrumpidas: quedan como reservas pendientes en el panel de archivos para limpieza administrativa. Una nota puede haberse guardado aunque falle su adjunto; se informa el error. Se puede reemplazar el adjunto desde Editar.
- Las notas tienen control de versión para evitar sobrescribir una edición más reciente. Los comentarios se agregan en transacciones. Las posiciones se guardan al soltar la tarjeta, sin escrituras continuas durante el movimiento. El ajuste visual al redimensionar no modifica posiciones guardadas.

## Migración de los datos anteriores

El botón **Importar datos anteriores** solo importa a la pizarra de la persona conectada, con confirmación del correo de destino.

1. Si el sitio nuevo tiene el mismo origen que el anterior, lee la clave `pizarra-digital-v1` de localStorage.
2. Si no encuentra esa clave, pide un archivo JSON con el arreglo de elementos del c2 original. Para exportarlo desde la página antigua, la consola del navegador puede usar:

```js
const respaldo = localStorage.getItem('pizarra-digital-v1');
if (!respaldo) throw new Error('No hay una pizarra guardada en este origen');
const url = URL.createObjectURL(new Blob([respaldo], {type:'application/json'}));
const a = document.createElement('a'); a.href = url; a.download = 'pizarra-respaldo.json';
a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
```

3. Se importan notas, comentarios, colores, posiciones y archivos `dataUrl`. Los binarios van a Storage; Firestore guarda referencias y metadatos. Las fechas originales de las tarjetas se conservan en legacyCreatedAt/legacyUpdatedAt y las de comentarios como etiquetas históricas; las fechas de auditoría nuevas corresponden al servidor.
4. El original local no se borra. IDs derivados del contenido permiten reintentar el mismo respaldo sin duplicar tarjetas y continuar cargas faltantes. Un respaldo modificado se trata como contenido distinto; no lo uses como sincronización periódica.

La migración corresponde al c2 adjunto, que usa data URLs. No importa blobs de variantes anteriores que usaban IndexedDB; informa el caso cuando encuentra esas referencias. Nunca pegues un respaldo personal en herramientas públicas.

## Límites y operación

25 MB por archivo; título 240 caracteres; texto de nota 60.000 caracteres; 200 comentarios por nota de 2.000 caracteres cada uno. Se conservan formatos de archivo arbitrarios. Solo las imágenes se previsualizan; los documentos se descargan como en el c2 original.

No se habilita persistencia offline de Firestore. Authentication usa sesión del navegador. El panel carga los usuarios y los elementos de la pizarra seleccionada; para volúmenes muy grandes, conviene incorporar paginación antes de ampliar el servicio. La auditoría queda en `audit` y se puede consultar desde Console o como administrador con el SDK; el cliente no puede editarla. No incluye contraseñas ni contenido de comentarios en los eventos.

La autorización se basa exclusivamente en `users/{uid}.role` y `status`, consultados en vivo; no depende de esperar a que caduquen custom claims. Las escrituras de Firestore están cerradas a todos los clientes y pasan por la función callable. Esta decisión mantiene la auditoría ligada a operaciones verificadas en el servidor.

## Validación y seguridad

Ver `VALIDACION.md` para los resultados obtenidos. Antes de habilitar usuarios reales, completar la prueba de integración en el proyecto con dos cuentas normales y una admin: cargas/descargas, cambio de estado, comentarios, migración, restauración y eliminación.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for owner-only access, live authorization checks and administrator-only recovery and deletion. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Referencias oficiales: [configuración web](https://firebase.google.com/docs/web/setup), [descarga autenticada y CORS](https://firebase.google.com/docs/storage/web/download-files), [reglas de Storage con consultas Firestore](https://firebase.google.com/docs/storage/security/rules-conditions), [requisitos de Storage y facturación](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
