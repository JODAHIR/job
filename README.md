# Asistente operativo — GitHub Pages

Sitio listo para publicar en GitHub Pages. Firebase conserva los procedimientos existentes y el acceso de la cuenta administradora.

## 1. Subir a GitHub

1. Descomprimí `asistente-operativo-github-pages.zip` en tu equipo.
2. Creá un repositorio en GitHub, por ejemplo `asistente-operativo`, o abrí uno existente destinado a esta web.
3. En **Add file → Upload files**, subí el contenido descomprimido: las carpetas `docs` y `src`, y los archivos de la raíz. No subas únicamente el ZIP ni agregues una carpeta extra alrededor.
4. Guardá los cambios en la rama `main`.

GitHub Pages está disponible para repositorios públicos con GitHub Free; el uso desde repositorios privados depende del plan. La visibilidad del repositorio y la de la web no equivalen a las reglas de acceso de Firebase.

## 2. Activar GitHub Pages

En el repositorio, abrí **Settings → Pages**:

- **Source**: Deploy from a branch.
- **Branch**: main.
- **Folder**: /docs.
- Pulsá **Save**.

GitHub mostrará la dirección del sitio cuando termine de publicarlo. Habitualmente será `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`. Si usás otra rama, seleccioná esa rama en lugar de `main`.

La carpeta `docs` contiene la web ya compilada: no necesitás instalar programas ni crear un flujo de GitHub Actions para publicarla. Los enlaces funcionan también cuando la web está en una subcarpeta.

## 3. Permitir el inicio de sesión desde GitHub

Abrí https://console.firebase.google.com/project/asistente-operativo/authentication/settings

En **Dominios autorizados → Agregar un dominio**, agregá `TU_USUARIO.github.io` (tu usuario real de GitHub, sin `https://`, sin barra y sin el nombre del repositorio). Si configurás un dominio propio, agregá también ese dominio.

Este paso es necesario para que funcione **Ingresar con Google**. No reemplaces los dominios que ya están autorizados.

## 4. Usar el sitio

- Abrí la dirección que GitHub te muestre.
- Iniciá sesión con `...@gmail.com`.
- Entrá en **Administrar conocimientos**.
- Elegí **Nuevo procedimiento**, completá la información, marcá **Publicar** y guardá.

Los cambios de conocimientos se guardan directamente en Firebase; no requieren volver a subir archivos a GitHub. La base utilizada es `conocimientos`, en el proyecto `asistente-operativo-9ee58`, región `nam5`.

## Archivos incluidos

- `docs/`: página y panel listos para GitHub Pages.
- `src/`: código editable de la conexión a Firebase y del panel.
- `package.json` y `package-lock.json`: herramientas y versiones para recompilar.
- `firestore.rules`, `firebase.json` y `.firebaserc`: referencia de la configuración de Firebase. GitHub Pages no publica ni aplica estas reglas.

No se incluyen contraseñas, credenciales privadas, historial Git ni credenciales de Sites. La configuración web de Firebase y el correo de la cuenta autorizada forman parte del código del navegador; las reglas publicadas en Firebase son las que protegen los registros. La copia exportada obtiene los procedimientos de Firebase y no incluye los textos operativos iniciales como datos incrustados.

Esta exportación no cambia el sitio anterior de Sites. La página de GitHub no hereda la pantalla de acceso de Sites: el acceso a los procedimientos depende del inicio de sesión y las reglas de Firebase.

## Si modificás el código de la web

Con Node.js 22 o superior, ejecutá en la raíz del proyecto:

```sh
npm ci
npm run build
```

Subí a GitHub también los archivos actualizados de `docs/`. Para modificar únicamente textos de procedimientos, usá el panel de administración.

## Verificación al publicar

1. Abrí la web y el enlace **Administrar conocimientos**.
2. Iniciá sesión con la cuenta autorizada.
3. Comprobá que aparecen los dos procedimientos existentes.
4. Consultá por el cambio de auca.

Si aparece un error de dominio no autorizado, revisá el paso 3. Si aparece un error de permisos, comprobá que usás la cuenta indicada y que las reglas de Firebase siguen publicadas; no habilites acceso general para resolverlo.

## Documentación

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Seguridad de Firestore: https://firebase.google.com/docs/firestore/security/overview

## Autorización de personas

En `admin.html`, ingresar con la cuenta administradora y usar **Personas autorizadas**. Agregar el correo exacto utilizado para iniciar sesión con Google. Cada persona autorizada puede consultar únicamente procedimientos publicados; no puede editar conocimientos ni gestionar accesos. **Revocar acceso** impide nuevas consultas; **Autorizar nuevamente** lo restablece. La cuenta administradora conserva su acceso.

Las reglas de `firestore.rules` deben publicarse en la base `conocimientos` del proyecto Firebase antes de usar esta función. Subir archivos a GitHub Pages no despliega las reglas de Firebase. Los correos autorizados se guardan en Firestore, nunca en este repositorio.

### Verificación de permisos

Con las dependencias instaladas y Java 21 disponible:

```sh
npm run test:access
npx firebase-tools@latest emulators:exec --project demo-access --config firebase.test.json --only firestore 'npm run test:rules'
```

Las pruebas usan datos ficticios y comprueban autorización, revocación, reactivación, acceso a borradores, privacidad de la lista y bloqueo de escrituras no autorizadas.
