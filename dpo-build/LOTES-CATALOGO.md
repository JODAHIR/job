# Catálogo y generación de lotes — entrega local 19/10/2026

Estado: implementado y probado localmente. No publicado; no se modificaron datos de producción.

## Uso
1. Director o Administrador: abrir Administración → catálogo de tipos documentales y completar el catálogo inicial CAH. La inicialización es explícita, reanudable y no sobrescribe tipos existentes.
2. En Lotes documentales, abrir Generar lotes. Seleccionar gerencia, CAC, año, mes y quincena; preparar los tipos.
3. Completar cantidades: vacío no equivale a cero. SCA, RES, CON y REC66 son obligatorios; los demás se seleccionan individualmente.
4. Actualizar resumen, revisar cantidades por tipo y CAC y confirmar generación.
5. Revisar resultados creados, existentes, omitidos y errores. Un CAC sin remisión registrada se omite; no se crea una remisión implícitamente.

El catálogo inicial incluye SCA, RES, CON, REC66, SCA-EVAL, CI, RUC, CIPYNES, CRC, F120, EQUI, ACP-FPY, DCOMP y adhe. Los códigos distinguen mayúsculas y minúsculas. El código no puede cambiar. Los cuatro tipos básicos permanecen obligatorios y habilitados.

## Modelo y garantías
Se mantiene Firebase Spark sin servidor externo. Las transacciones del SDK se validan mediante reglas de Firestore.

- `documentCatalog/current`: revisión vigente y tipos; cada modificación afecta un solo tipo.
- `documentCatalogVersions/{revision}` y `catalogAudit/{revision}`: versiones y auditoría inmutables, con autor, rol, fecha, motivo y valores anteriores/posteriores.
- `gerencias/{g}/lotRequirements/{remisionId}`: versión congelada al iniciar una carga tipificada.
- `gerencias/{g}/lotSequences/{cacId}_{year}_{half}`: consecutivo compartido entre tipos y meses, porque el identificador visible no incluye mes.
- Lotes existentes incorporan metadatos de tipo, versión y secuencia. Código visible: `LOT_NN_TIPO_CAC_YEAR_HALF`.
- Reservas únicas por gerencia/CAC/año/mes/quincena/tipo y por identidad. La transacción crea lote, reservas, consecutivo, control de dependencias y auditoría conjuntamente.

Cada lote es atómico. La operación masiva es una secuencia de transacciones, con resultado explícito por elemento; no se presenta como una única transacción global. Reintentar no sobrescribe lotes existentes. Los documentos de un lote tipificado deben coincidir con su tipo también en las reglas del servidor.

## Permisos
Director y Administrador (`technical`) gestionan catálogo. Administrador, Director, Gerente dentro de su gerencia y Asistente dentro de sus asignaciones pueden gestionar lotes conforme a las reglas. No se amplían los permisos del Gerente para crear documentos. Los metadatos de tipificación son inmutables; las cantidades se actualizan con auditoría.

## Historia y límites
- Las cargas iniciadas conservan su versión de requisitos. Los tipos añadidos después se aplican a nuevas cargas, no retroactivamente a las ya iniciadas.
- Los lotes históricos sin clasificación permanecen consultables/editables. Una remisión que los contiene no puede iniciar generación tipificada hasta una revisión administrativa. El procedimiento de clasificación/migración histórica está pendiente; no se deduce el tipo desde el código.
- Si falta el control de dependencias de una remisión histórica, debe utilizarse el procedimiento existente de inicialización administrativa.
- Exclusiones: sin deducciones automáticas; el procedimiento de autorización permanece pendiente.
- Máximos: 100 tipos; 200 lotes seleccionados por ejecución; cantidad entera entre 0 y 1.000.000. Se mantiene el límite de carga de entidades de la aplicación (3.000).
- Las versiones son acumulativas; requieren seguimiento del uso de almacenamiento. No se habilita eliminación de auditoría.
- No se necesitan índices compuestos nuevos: el historial usa orden por revisión y las versiones se recuperan por identificador.

## Verificación
Evidencias en `test-results/lotes-2026-10-19/`.

1. Funcionalidad: catálogo inicial, lotes con cantidad cero, generación individual/múltiple, omisiones y duplicados: aprobada.
2. Validaciones y concurrencia: cantidades inválidas, reserva única concurrente y tipos básicos protegidos: aprobada.
3. Integración y seguridad: acceso de otra gerencia, escalamiento de rol, escrituras falsificadas, auditoría/versiones inmutables y tipo documental: aprobada.
4. Interfaz: formulario, resumen, bloqueo de cantidades vacías y resultados con datos ficticios; revisión visual en anchos 390, 768 y 1280: completada. La prueba visual usa el componente real con respuesta simulada explícita, no escribe en Firebase.
5. Regresión e historia: versión congelada, deshabilitación de tipos, edición histórica y suites previas: aprobada.

Resultado automático: 20 pruebas del emulador aprobadas; 11 archivos de pruebas unitarias aprobados; compilación Firebase correcta. Los rechazos PERMISSION_DENIED del registro corresponden a pruebas negativas; el resultado final es 20/20.

No se verificó este nuevo flujo con usuarios reales en producción. Las pruebas locales no equivalen a una certificación de producción; las reglas y el flujo autenticado requieren revisión y comprobación tras un despliegue autorizado.

## Archivos
Nuevos: `src/lot-catalog.js`, `src/spark-catalog.js`, `src/spark-lots.js`, `src/lot-ui.js`, `tests/lot-catalog.test.js`, `tests/spark/lot-catalog.test.js`, `tests/lot-preview.html`, `tests/lot-responsive.html`.
Modificados: `firestore.spark.rules`, `src/spark-records.js`, `src/spark-api.js`, `src/firebase-client.js`, `src/permissions.js`, `src/navigation.js`, `src/app.js`, `src/styles.css`, `src/domain.js`, `src/reports.js`, pruebas de permisos y navegación. Bundle Firebase regenerado.

## Publicación pendiente
Publicar solamente con autorización específica. Coordinar reglas Spark, fuentes y bundles; preservar cambios existentes del repositorio de publicación. No publicar fixtures ni evidencias de pruebas. Tras publicar, verificar inicio de sesión, ámbitos y creación controlada; inicializar el catálogo desde el perfil autorizado. No ejecutar migraciones históricas implícitas.
