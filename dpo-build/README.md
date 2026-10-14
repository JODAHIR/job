# Publicación de Control Documental

GitHub Pages sirve `docs/dpo/index.html`. La aplicación anterior se conserva en `docs/dpo/asistente.html` y sus recursos originales permanecen intactos.

El flujo `.github/workflows/pages.yml` instala las versiones del archivo de bloqueo y compila `exporters.js` y `firebase-client.js` dentro de `docs/dpo/cdq-v3/src/` antes de publicar. Para reproducir: `cd dpo-build`, `npm ci --ignore-scripts` y `npm run build`.

Esta publicación permite demostración y almacenamiento local del navegador. No incluye configuración Firebase, credenciales, datos institucionales ni servidores. Firebase institucional permanece pendiente de configuración y despliegue del backend.

Validación previa: 28 pruebas unitarias aprobadas; dashboard y reportes cargan desde subcarpeta; exportación PDF descargada; enlace al asistente anterior verificado. Estas comprobaciones no certifican preparación para producción ni autenticación institucional.

Para revertir esta publicación, revertir su commit y esperar el despliegue de Pages. Los datos locales permanecen en el navegador y no se trasladan automáticamente desde localhost al dominio público.
