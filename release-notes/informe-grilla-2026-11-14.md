# Informe en encabezado de remisiones

Alcance autorizado: continuar el cambio de nombre por zona y agregar Informe junto a Período y Expediente. Publicación autorizada por el usuario: «publicalo».

El encabezado agrupa por gerencia, período y expediente. Informe usa una remisión de ese grupo y consulta el inventario completo del servidor, conservando la validación de conciliación y permisos existentes. Se muestra a responsables designados de esa gerencia, Director y Administrador. No modifica remisiones ni registra eventos de archivo. El nombre usa la gerencia devuelta por el servidor y el período de la remisión: Verificación_doc_GDSZ_Zona_Primera_quincena_10-2026.pdf.

Archivos: app.js, remision-management.js/css, remision-report-ui.js, dpo-build/providencia.js y tests/remision-report.test.mjs.

Comprobaciones: sintaxis JavaScript, pruebas de permisos y nombres para varias zonas/quincenas, suite de elegibilidad del PDF, esbuild, diff --check. Sin modificaciones Firebase ni cambios de reglas. La emisión real requiere sesión autorizada y conciliación vigente de todos los CAC. No se emitieron documentos reales para las pruebas.
