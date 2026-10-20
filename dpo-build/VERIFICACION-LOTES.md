# Conciliación y verificación de lotes

Implementación local, 20/10/2026. No desplegada. Proyecto existente: controldoc-385bd, instancia Standard (default), plan Spark. No requiere servidor externo.

## Flujo
Cada lote ofrece «Conciliar y verificar lote». Se consultan documentos registrados y observaciones, se calculan faltantes/excedentes y se exige confirmación manual para marcar Verificado. Un lote vacío o con observaciones no regularizadas no se considera completo. La igualdad de cantidades no verifica por sí sola el contenido: el responsable confirma la revisión documental. No se infieren documentos presentados que todavía no estén registrados, ni la identidad de un documento faltante sin un padrón nominal.

Es posible guardar comentarios sin verificar aunque las cantidades coincidan. Al verificar, se agrega exactamente «Presentación sin inconvenientes, lote completo»; los comentarios particulares quedan preservados en reviewerComments. No cambia automáticamente los estados individuales de los documentos.

## Historial y estado
Colección hermana gerencias/{gerenciaId}/lotVerifications/{operationId}. Registro inmutable con lote/código, remisión, revisiones, cantidades, confirmación, comentario, responsable, rol y fecha del servidor. Sin permisos de actualización o eliminación, ni siquiera para technical. Mismo identificador de operación para reintento sin duplicar escrituras. Historial consultable aun cuando la remisión sea anulada.

El estado visible del lote se deriva del último registro vigente. No se sobrescribe el lote ni una verificación anterior. Un cambio en el lote o en el control documental de su remisión invalida la vigencia y exige volver a revisar. La invalidación es conservadora: también puede producirse por cambios en otro lote de la misma remisión.

## Autorización y límites
Mismos permisos que el registro de lotes: technical/director globales, gerente en su gerencia, asistente en sus gerencias asignadas. Validación en reglas de autor/rol, fecha, padre vigente, revisión, campos permitidos, aritmética, confirmación y comentario obligatorio. No se amplían permisos de usuarios.

El adaptador recalcula las cantidades mediante lecturas al servidor, no acepta cantidades enviadas por el formulario y comprueba un control de versión antes/después del inventario y dentro de la transacción. Lecturas incompletas superiores a 3000 se bloquean.

Límite explícito de confianza: las reglas de Spark no ejecutan una consulta agregada a todos los documentos para recomputar las cantidades. La verificación es una constancia firmada por un responsable autorizado, no una certificación independiente del cliente. Un responsable autorizado que construya peticiones fuera del adaptador podría declarar cantidades falsas que satisfagan la aritmética. Antes de exigir resistencia a ese escenario se necesita un contador por lote mantenido en todas las escrituras y una inicialización auditada del histórico, o un procedimiento privilegiado. No se presenta esta implementación como garantía de conciliación independiente del cliente.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for scoped access, immutable review history, actor identity, server timestamps and revision checks. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Validación
- 18 archivos de pruebas unitarias: aprobados.
- Emulador Standard: 11 pruebas aprobadas (6 existentes de anulación y 5 nuevas de verificación).
- Nuevas pruebas: roles/confirmación/historial/reintento; rechazo de autor, rol, fecha, declaración, confirmación y campos alterados; revisión obsoleta; faltantes; remisión anulada.
- Construcción del cliente Firebase correcta.
- Navegador con datos ficticios: se bloqueó Guardar sin confirmar y se completó correctamente al marcar la casilla; comentario automático visible.
- No se modificaron datos ni reglas de producción.

## Publicación
Requiere desplegar firestore.spark.rules antes del cliente que consulta lotVerifications, reconstruir Firebase y publicar los módulos nuevos y cambios de app.js. No copiar app.js local completo sobre la versión pública: preservar los ajustes previos de login, navegación y versiones de recursos.
