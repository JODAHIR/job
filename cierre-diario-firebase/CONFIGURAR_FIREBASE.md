# Configuración de Cierre Diario

La app Web **Cierre Diario Web** ya está registrada en **cierre-9095e**. El HTML incluye el firebaseConfig real obtenido de Firebase Console como configuración predeterminada. No necesita pegarlo en un navegador nuevo. Si ya había guardado otra configuración o elegido modo local, puede pegar el contenido de `firebaseConfig.json` en **Firebase y cuenta**.

Estado verificado: **Authentication con Email/Password habilitado** y **Firestore Standard (default) creado en nam5, Estados Unidos**, según la ubicación elegida. El proyecto sigue en **Spark**. Storage está bloqueado por Firebase hasta activar Blaze; no se modificó la facturación. Las reglas privadas por usuario ya están publicadas. El simulador de Firebase confirmó que el propietario puede leer su cierre y que las lecturas sin sesión o con otro UID se rechazan.

1. En [Firebase Console](https://console.firebase.google.com/), cree o elija su proyecto y registre una app Web en **Configuración del proyecto → Sus apps**. Copie el objeto `firebaseConfig`, sin el resto del ejemplo.
2. En **Authentication → Sign-in method**, habilite **Email/Password**. Cree las cuentas autorizadas en **Users → Add user**. La app incluye inicio/cierre de sesión, no registro público. [Documentación](https://firebase.google.com/docs/auth/web/password-auth).
3. En **Firestore Database**, cree una base **Standard**, ID **(default)**. Esta entrega usa el SDK web modular y las operaciones Core. Publique el contenido de `firestore.rules` en la pestaña **Rules**. Los permisos restringen cada ruta al UID autenticado; no utilice reglas de prueba abiertas.
4. En **Storage**, cree el bucket y publique `storage.rules` en **Rules**. Copie el nombre exacto del bucket en `firebaseConfig.storageBucket`. Storage requiere el **plan Blaze** y una cuenta de facturación. [Requisito oficial](https://firebase.google.com/docs/storage/web/start).
5. Sirva `docs/cierre-diario/index.html` mediante **HTTPS** o un servidor local **HTTP**. Para probar con Python, desde la raíz del repositorio: `python3 -m http.server 8000 --directory docs`; abra `http://localhost:8000/cierre-diario/`. En **Authentication → Settings → Authorized domains**, agregue su dominio, y `localhost` si lo utiliza.
6. En la app, abra **Firebase y cuenta**, pegue el objeto `firebaseConfig` y pulse **Guardar y conectar**. Se recarga la página. Inicie sesión con una cuenta creada en el paso 2.
7. Para descargar PDFs desde un segundo equipo, configure **CORS** en el bucket. Las descargas usan `getBlob` con autenticación, sin enlaces públicos con token. En Google Cloud Shell cree un archivo `cors.json` con el siguiente contenido, reemplazando el origen por el de su app:

```json
[
  {
    "origin": ["https://SU-DOMINIO", "http://localhost:8000"],
    "method": ["GET"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

Luego ejecute, reemplazando el bucket real:

```sh
gcloud storage buckets update gs://SU-BUCKET --cors-file=cors.json
```

Quite el origen local cuando no lo necesite. La configuración CORS se hace desde Cloud Shell/Google Cloud, no desde el formulario de Firebase de la app. [Descargas y CORS](https://firebase.google.com/docs/storage/web/download-files).

## Uso y organización

- Elija la fecha en **Panel general**. Cada fecha tiene su configuración, estado, notas y las diez conciliaciones. Los cambios se guardan automáticamente en la caché; **Guardar** solicita además una sincronización inmediata. La app reintenta cada 15 segundos y al recuperar conexión.
- Firestore: `users/{uid}/closures/{AAAA-MM-DD}` contiene `data.meta`, `data.modules`, `revision` y `updatedAt`. Los metadatos de PDF están en `users/{uid}/closures/{fecha}/pdfs/{id}`.
- Storage: `users/{uid}/closures/{fecha}/pdfs/{id}.pdf`. Firestore guarda nombre, tamaño, tipo, fecha detectada, módulo, ruta y URL `gs://`. La URL identifica el objeto; la app lo descarga con la sesión autorizada.
- La bandeja **Importar PDFs** acepta varios archivos, por selección o arrastre. Reconoce `datoAAAAMMDD.pdf` como DATOS. Los demás requieren elegir un módulo. Un PDF con fecha diferente queda bloqueado para subir: seleccione el cierre correcto y vuelva a cargarlo allí. No modifica importes automáticamente: sigue pendiente el mapeo del contenido de los reportes.
- Abra la misma fecha en otro equipo con la misma cuenta para recuperar el cierre y sus PDFs. Si ambos equipos editan el cierre, se muestra un conflicto en **Firebase y cuenta**. Exporte un respaldo si desea conservar ambas versiones y elija la versión a usar. La decisión se aplica al cierre completo.

## Caché, cuentas y respaldo

La configuración pública de Firebase se guarda en `localStorage`, nunca la contraseña. El SDK administra la sesión con persistencia por pestaña. El espacio sin sesión y las cachés de cada proyecto/UID son independientes. Iniciar sesión no sube automáticamente datos de un espacio local ni de otra cuenta.

Los datos de cierre se guardan en `localStorage`; los PDFs binarios en IndexedDB. Si no hay conexión, siguen disponibles los datos ya almacenados y las subidas pendientes se reintentan al reconectar con la misma cuenta. Para cargar por primera vez el SDK de Firebase o iniciar sesión hace falta conexión. Si el SDK no puede cargarse, la app abre el espacio local independiente.

**Exportar respaldo** conserva datos y metadatos en JSON; no incluye los binarios PDF. **Importar respaldo** valida los datos y pide confirmar el reemplazo del cierre local; los PDFs deben seleccionarse nuevamente. Esta separación evita reutilizar rutas de otra cuenta. Se conserva la clave del respaldo antiguo `cierre-diario-web-v1` y se migra al espacio local al primer uso.

Cerrar sesión oculta los datos de la cuenta, pero conserva su caché para recuperar pendientes al volver a ingresar. Esa caché no está cifrada: utilícela en equipos de confianza. Borrar los datos del navegador elimina los pendientes que todavía no llegaron a Firebase. Un error de cuota local o permisos se muestra en pantalla; exporte los datos antes de salir si no pueden guardarse.

La app detecta cambios de caché desde otra pestaña y pide recargar para evitar que dos pestañas escriban la misma copia local. Las operaciones de Firestore y Storage no forman una única transacción: si se interrumpe el registro de metadatos después de subir un PDF, se reintenta la misma ruta, sin crear otro archivo.

## Verificación con su proyecto

El HTML incluye la configuración pública real de la app Web, sin contraseñas ni claves privadas. Se habilitó Authentication y se creó Firestore en el proyecto real. Después de crear su usuario y completar los servicios pendientes, compruebe: iniciar sesión, editar un cierre, subir un PDF, ver **Sincronizado con Firebase**, abrir la misma fecha desde otro navegador, y probar que una segunda cuenta no accede a la primera. Compruebe también guardar sin conexión y reconectar. Las reglas de Firestore incluidas ya están publicadas. Las de Storage siguen pendientes de activar Blaze y crear el bucket.

Verificaciones realizadas sobre la entrega: comprobación de sintaxis y carga en Chrome, persistencia local tras recarga, almacenamiento binario de PDFs, cambio de fecha sin arrastrar valores, fecha de PDF incompatible, cálculos de diferencia, ancho móvil de 390 px y carga de los módulos oficiales Firebase 12.19.0. Se probaron guardado remoto, metadatos, conflictos y aislamiento de cuentas con un adaptador simulado. No se ejecutaron pruebas con un proyecto real ni con el emulador de reglas.
