# Providencia al registrar Archivo
Autorización: solicitud explícita del usuario «quiero que lo publiques».

Al guardar Arquipel se consulta el inventario de la gerencia desde Firestore. Se exige remisión recibida vigente y lotes conciliados para cada CAC activo del período. Revisiones obsoletas, diferencias, lotes eliminados o inventario incompleto bloquean la emisión. El PDF incorpora expediente, gerencia, quincena, mes, año y usuario emisor; utiliza el membrete del modelo entregado. No representa firma digital.

Se mantiene el registro de archivo aunque falle el PDF. El reintento consulta nuevamente los datos sin escribir otro evento. Escanear mantiene su comportamiento.

Archivos: remision-custody-ui.js, remision-custody.js, spark-api.js, providencia-domain.js, providencia.js, build.mjs y tests/providencia.test.mjs. Bundles generados por CI; no versionados. Sin cambios de reglas ni de estructura Firebase.

Validación: pruebas automatizadas de elegibilidad, conciliaciones obsoletas, datos incompletos, anulación, recepción, período, eliminación y PDF; compilación esbuild y git diff --check. No se crearon registros reales para probar en producción.

Riesgos/límites: consultas de hasta 3000 registros por colección; si se excede, no se emite. Se comprueban versiones de controles y lotManagement antes/después de la lectura. La comprobación refleja el momento de generación, no bloquea futuras modificaciones. Requiere descripción del usuario emisor.
