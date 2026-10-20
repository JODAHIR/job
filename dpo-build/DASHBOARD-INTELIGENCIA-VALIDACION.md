# Inteligencia Documental CAH — validación de la vista de consulta

Fecha: 20/10/2026. Publicación autorizada por el usuario. Esta entrega conecta una vista de consulta; no declara terminado el modelo operativo por excepción.

## Implementado
- Niveles Ejecutivo, Gerencial y Operativo. Navegación por gerencia, CAC y detalle de remisión → lote → documento → observación.
- Filtros de año, mes, quincena, gerencia, CAC, recepción/cierre y rango de fechas, control y observación. Los filtros de control y observación seleccionan remisiones completas; conservan todos sus documentos para no alterar denominadores.
- Indicadores con fórmula y registros relacionados; observados únicos y regularizados sin borrar historial. La conformidad requiere evidencia explícita de cierre.
- Anillos, barras navegables, línea quincenal y tablas accesibles, ordenables y paginadas. Gráficos SVG locales, sin servicios externos ni dependencias de red.
- Ranking de volumen y cantidades/tasas separadas; Pareto según clasificación disponible; alertas con umbrales explícitos; comparación descriptiva del período anterior.
- Exportación Excel/PDF de resumen, rankings, evolución, observaciones y plazos. En Firebase vuelve a leer con permisos actuales antes de exportar y cancela si cambia la sesión.
- Lectura deduplicada de calendarios históricos referenciados por las remisiones autorizadas; no sustituye versiones ausentes por la actual.
- La vista anterior permanece en “Consultar indicadores del modelo histórico”. No se modifican registros ni reglas de producción.

## Cinco grupos de validación
1. Funcionalidad: KPI, combinación de filtros, tres niveles, navegación de barras, fórmulas, rankings, archivos Excel leídos nuevamente y cabecera PDF. Exportación Excel desde el navegador comprobada.
2. Casos límite: duplicados rechazados, cero sin 100 %, fechas inexistentes/rangos invertidos, cantidades inconsistentes, cierres insuficientes, calendarios ausentes y aislamiento de ámbitos.
3. Integración: emulador real Firestore con reglas actuales. Gerente y Asistente consultan solo su gerencia; Director y Administrador acceden al ámbito institucional; anónimo/inactivo denegados; edición del rol propio y escritura de indicadores falsos denegadas. Lectura de calendario congelado verificada.
4. Interfaz: navegador local con fixture explícitamente ficticio; escritorio, tablet 768 px y móvil 390 px, detalle gerencial/operativo, tablas y exportación; sin errores de consola observados. No se certifica auditoría WCAG integral ni todos los navegadores.
5. Regresión: suite existente de dominio, contactos, permisos, navegación, repositorio y lotes; pruebas Spark de catálogo, transacciones, concurrencia, anulaciones y auditoría.

Resultados: `npm test` 15 archivos aprobados, 0 fallos. Suite `tests/spark/*.test.js` 22 pruebas aprobadas, 0 fallos. `npm run build:firebase` correcto. Los datos de prueba se usan solo localmente/emulador; no se escribieron documentos de prueba en producción.

## Limitaciones expresas
- Aún no están conectadas a Firestore las operaciones de inicio/cierre/reapertura del control por excepción ni sus reglas/conteos concurrentes. `exception-control.js` es un contrato puro, no una validación de servidor desplegada. `lotChecks` no se consulta en producción ni puede escribirse con las reglas actuales.
- No existe un registro operativo aprobado de obligaciones de entrega. Mapa de entrega gris/no evaluable; no confundir con el plazo de control desde la recepción.
- Regularizaciones históricas sin fecha propia no generan duración. No se han añadido escrituras de fecha de regularización ni categoría. Pareto las agrupa como “Sin clasificar”.
- No hay cierres de período que prueben comparabilidad: variaciones porcentuales, anomalías de volumen e IGD permanecen sin activar. IGD requiere aprobación institucional independiente de la autorización de publicar.
- Evolución: seis quincenas de cohortes de remisión hasta la selección, conserva ámbito/estados/rango de fechas. No representa fechas de eventos de regularización ni constituye una serie mensual/anual completa.
- Los nuevos datos propuestos y las métricas que dependen de ellos están probados con contratos ficticios, pero su persistencia requiere una entrega posterior. No se atribuye esa disponibilidad a producción.
- Se conserva el límite de 3000 registros por entidad/gerencia: las cargas incompletas fallan explícitamente. No se introducen agregados modificables desde el navegador ni índices nuevos. La carga global de datos sigue siendo una limitación de escala.

## Cómo probar
1. Entrar con una cuenta autorizada y abrir Inicio/Dashboard.
2. Seleccionar gerencia y CAC. Verificar que cambien tarjetas, gráficos y tablas. Una barra de gerencia abre Gerencial; una de CAC abre Operativo.
3. Abrir “Fórmula y detalle” y consultar los registros. Recorrer remisión/lote/documento/observación.
4. Cambiar fechas/estado, limpiar filtros y exportar. El archivo debe contener el ámbito seleccionado y sus fórmulas/disponibilidad.
5. Para métricas de individualización anteriores, usar “Consultar indicadores del modelo histórico”.
6. Sin sesión no debe aparecer información institucional. No probar escrituras destructivas sobre datos reales.

## Archivos
Nuevos: `src/intelligence.js`, `src/intelligence-ui.js`, `src/intelligence-charts.js`, `src/intelligence-report.js`; pruebas `tests/intelligence*.js/html`, `tests/spark/intelligence-access.test.js`.
Modificados puntualmente: `src/app.js`, `src/styles.css`, `src/firebase-client.js`. Publicación: equivalentes en `docs/dpo/cdq-v3/src`, versión de recursos en `docs/dpo/index.html`, fuente `dpo-build/firebase-client.js`.

## Recuperación
La entrega no migra datos y no modifica reglas. Para retirar la nueva vista, revertir el commit de esta publicación y volver a ejecutar Pages; los documentos y su auditoría permanecen intactos. También está disponible la vista histórica en la propia aplicación.
