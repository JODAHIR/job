# Archivo operativo

Autorizado: pase a producción solicitado el 09/11/2026.

Consulta de arquipeles existentes agrupados por gerencia, año, mes y número; reúne ambas quincenas. Ubicación compartida E01–E10, F1–F5, D/A con historial inmutable. Escaneo se confirma desde Remisiones > Archivo > Escanear.

Archivos: operational-archive.js, operational-archive-ui.js, spark-api.js, firestore.spark.rules, navigation.js, navigation-ui.js, permissions.js, app.js, remision-management.css, index.html.

Validación: esbuild correcto; 34 comprobaciones locales de permisos/integridad incluyendo rechazo de modificación/borrado de historial; interfaz con remisiones de ambas quincenas y guardado de ubicación; revisión visual móvil. Reglas compiladas y publicadas en controldoc-385bd (default). No se insertaron datos de prueba en producción.

Limitaciones: consulta del historial de custodia de remisiones autorizadas al abrir Archivo; historial de ubicaciones muestra las últimas 100. Estado de escaneo corresponde a la revisión vigente de cada remisión. El PDF de cierre no forma parte de este cambio.
