# Dashboard y consulta institucional — 17/10/2026

Se agregaron cinco filtros avanzados compartidos por dashboard, listados y reportes; limpieza al período actual de Paraguay y ámbito autorizado; veinte indicadores con detalle; fichas de Gerencia/CAC; tablas ordenables con páginas de 10, 25 o 50 filas. Las exportaciones conservan el conjunto completo de resultados.

Reglas: conciliación y faltantes usan todos los documentos del lote seleccionado, nunca una selección parcial de documentos. Los filtros de documento/observación seleccionan sus lotes y remisiones relacionados. Las remisiones pendientes son ausencias reales, no filas excluidas por un filtro. Las esperadas son la base del período y ámbito (no varían por estado). Los CAC inactivos solo se incluyen en las expectativas cuando tienen registros históricos. No hay historial de activación para reconstruir expectativas históricas exactas. El avance cuenta revisados incluyendo observados; correctos se cuentan aparte. Sin documentos no hay porcentaje.

Próximo significa hoy a cinco días calendario; vencido significa fecha anterior a hoy en Paraguay. No implica cierre administrativo. Observaciones admiten Pendiente, En proceso y Regularizada; el documento conserva la condición observado. No se modifican plazos ni calendarios existentes.

Prueba manual: en Dashboard seleccionar estados, abrir Ver detalle y comparar cantidades; abrir ficha desde Gerencias/CAC involucrados; ordenar encabezados, cambiar tamaño y página en Documentos; limpiar filtros; repetir con gerente y asistente. Los datos ya cargados están limitados por las reglas y el perfil; las fichas son de consulta y no conceden permisos.

Validación: pruebas unitarias y compilación del cliente satisfactorias; emulador Spark con escenarios de permisos, persistencia, calendario, auditoría y nuevo estado de observación. Consulta visual local con datos ficticios: dashboard y ficha consolidados operativos.

Archivos: src/app.js, domain.js, reports.js, bulk.js, tables.js (nuevo), styles.css; firestore.spark.rules; tests/dashboard.test.js (nuevo), tests/spark/records.test.js; copias generadas de Functions y compilación Firebase. Publicación replica los módulos en docs/dpo/cdq-v3/src.

Limitaciones: paginación en navegador, no por cursor Firestore; se mantiene límite existente de consulta por gerencia. No se certifica todavía cobertura completa del prompt maestro ni preparación para producción. Sigue pendiente corregir mediante versión aprobada el calendario real sin feriados y completar importación masiva, migración y excepciones en Spark.
