# Cierre Diario

Aplicación estática de conciliación en [`../docs/cierre-diario/index.html`](../docs/cierre-diario/index.html). Conserva las diez secciones, la bandeja central de PDFs, el diseño responsive y los respaldos JSON.

## Ejecutar

Desde la raíz del repositorio:

```sh
python3 -m http.server 8000 --directory docs
```

Abra <http://localhost:8000/cierre-diario/>. No necesita compilación ni modificar las dependencias del asistente operativo.

La portada `docs/index.html` incluye un acceso a Cierre Diario. Si GitHub Pages sirve `main` desde `/docs`, la dirección prevista al incorporar los cambios es <https://jodahir.github.io/job/cierre-diario/>. Esta migración no habilita ni cambia la configuración de Pages.

## Firebase

El HTML incluye la configuración pública de la app Web del proyecto `cierre-9095e`. Los datos siguen en Firebase; GitHub guarda únicamente el código. No se incluyen contraseñas, cuentas de servicio, datos de cierre ni PDFs.

- Authentication: email/contraseña habilitado; cree su usuario en Firebase Console.
- Firestore: `(default)`, Standard, `nam5`, reglas publicadas por propietario.
- Storage: pendiente de activar Blaze, crear el bucket y publicar sus reglas. Los PDFs permanecen en caché local mientras no puedan subirse.
- El login de Cierre Diario es independiente del acceso con Google del asistente operativo.

Consulte [la guía](CONFIGURAR_FIREBASE.md) y [el estado verificado](ESTADO_FIREBASE.md). Para usar GitHub Pages agregue `jodahir.github.io` a Authentication → Configuración → Dominios autorizados. Cuando se habilite Storage, use `https://jodahir.github.io` como origen permitido en CORS.

## Reglas aisladas

Los archivos de esta carpeta pertenecen exclusivamente a `cierre-9095e`. No reemplace los archivos Firebase de la raíz del repositorio ni los de `pizarra-firebase`.

Para publicar cambios de reglas intencionadamente, ejecute desde esta carpeta:

```sh
npx -y firebase-tools@latest deploy --only firestore:rules --project cierre-9095e
```

Una vez creado el bucket:

```sh
npx -y firebase-tools@latest deploy --only storage --project cierre-9095e
```

Las reglas de esta entrega fueron comprobadas en el simulador para lectura propia, lectura ajena y lectura sin sesión. La prueba completa con una cuenta real y PDFs requiere completar los pasos pendientes. No se publican reglas automáticamente al subir código a GitHub.

## Datos locales existentes

El almacenamiento del navegador depende del origen. Un respaldo guardado al abrir el archivo local no aparecerá automáticamente en GitHub Pages: expórtelo en la versión anterior e impórtelo en la nueva, dentro de la cuenta correspondiente. Los archivos PDF se seleccionan nuevamente porque no están incluidos en el JSON.
