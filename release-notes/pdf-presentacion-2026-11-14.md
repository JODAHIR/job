# Presentación del Informe PDF

Autorización explícita del usuario: publicar los ajustes de presentación.

Se justifica el cuerpo de cada párrafo, dejando la última línea alineada a la izquierda. Se elimina Responsable de la emisión y se conserva el nombre. El rol del perfil leído desde Firestore se entrega al generador: technical (Administrador) muestra Dirección de Operaciones; los demás roles mantienen Unidad de Operaciones. No hay cambios de permisos, reglas ni escrituras de datos.

Archivos: dpo-build/providencia.js y dpo-build/remision-custody.js. Compilación automática de bundles mediante el flujo existente.

Validación: dos PDF con datos ficticios (Administrador y asistente), renderizados con Poppler e inspeccionados visualmente, una página sin recortes; comprobación de leyendas y nombre del emisor; pruebas de nombres/permisos de Informe; compilación esbuild y diff --check correctos.
