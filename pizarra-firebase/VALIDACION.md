# Validación realizada

## Resultados

- Sintaxis JavaScript: validada con Node.js, tanto función servidor como módulo web.
- **12 pruebas de la función callable: aprobadas.** Ejecutan el código real del manejador con adaptadores de Firestore/Storage en memoria. Comprueban autorización, propietarios, perfil pendiente, control de versión, papelera, restauración, purga, auditoría, reemplazo de adjuntos y límites. No simulan contención distribuida.
- **25 comprobaciones de reglas: aprobadas en Firebase Emulator.** Firestore y Storage compilaron las reglas y ejecutaron lecturas, consultas, escrituras y operaciones de archivos reales contra los emuladores. Incluyen acceso ajeno, escalamiento de privilegios, cuentas pendientes/bloqueadas, carga reservada, sobrescritura, descarga autenticada, eliminación directa y bloqueo de perfil en vivo.
- **Integración del SDK Admin real con los emuladores: aprobada.** Ejecutó registro de perfiles, creación, reserva/carga de archivo, asociación, comentario, retiro/restauración de adjunto, papelera, restauración de tarjeta y borrado definitivo en Firestore y Storage. Se invocó el manejador callable directamente; no se simuló el transporte HTTPS de Functions.
- Navegador Chromium: pantalla de configuración incompleta; interfaz con datos de muestra a 1365×900 y 390×844; acordeón, búsqueda por comentarios, formularios de edición/comentarios, arrastre y envío de autorización administrativa. Sin errores de ejecución. Estas pruebas visuales usan respuestas simuladas de la función; no constituyen una prueba end-to-end contra producción.

Las pruebas detectaron y permitieron corregir el filtro `ownerUid` de la consulta Firestore y la restricción explícita de sobrescritura `resource == null` de Storage.

## Reproducir

Desde la carpeta del paquete:

```sh
node --test tests/functions.test.cjs
npm --prefix tests install
firebase emulators:start --only firestore,storage --project demo-pizarra
```

En otra terminal:

```sh
node tests/rules.test.cjs
node tests/integration.cjs
```

La suite borra únicamente datos de los emuladores locales configurados en 127.0.0.1:8080 y 127.0.0.1:9199, usando el proyecto ficticio demo-pizarra. No ejecutarla apuntando a otro servicio. Firebase CLI actual puede requerir Java 21; en esta sesión se usó CLI 14.12.0 con Java 11 para los emuladores.

## Pendiente del entorno real

No se autenticó, consultó ni desplegó en pizarradig-10acf. No se verificaron su edición/región, IAM, bucket, facturación, dominios autorizados, CORS ni configuración web. El archivo firebase-config.js está deliberadamente incompleto.

Antes de habilitar el servicio, probar en el proyecto con dos usuarios y un admin: registro → pendiente → autorización → cargas/descargas → edición concurrente → bloqueo → restauración → eliminación permanente. Verificar que un UID no admin no lea otra pizarra ni sus archivos. Importar una copia del respaldo y reintentar para comprobar que no duplica datos. Las reglas son una propuesta validada localmente que debe revisarse junto con las reglas existentes del proyecto antes de su uso general.

## Dependencias

Servidor fijado mediante package-lock.json: firebase-admin 14.4.0 y firebase-functions 7.4.0. La carga real del módulo callable fue verificada. La revisión npm audit informa dos avisos moderados transitivos en gaxios/uuid (GHSA-w5hq-g745-h8pq), incluso después de npm audit fix. No se forzaron sustituciones de dependencias fuera de sus rangos compatibles. Revisar actualizaciones del SDK antes del despliegue general.
