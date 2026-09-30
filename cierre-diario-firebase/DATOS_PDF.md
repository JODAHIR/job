# Importar el informe de cartera en DATOS

En **Importar PDFs**, seleccione el PDF original y pulse **Leer para DATOS**. Revise las diez tablas de la vista previa y pulse **Aplicar a DATOS**. Se reconoce el informe BIRT A4 «Informe de saldos de la cartera de préstamos» con texto seleccionable, incluso cuando se llama `report.pdf`.

La fecha se toma de «Información referida al», no del pie de generación. Si difiere del cierre seleccionado, se abre el cierre correspondiente al aplicar y se guarda allí una copia del PDF; el archivo de la bandeja original se conserva. Si ya existe un informe en esa fecha, se solicita confirmar su reemplazo.

DATOS presenta saldos, intereses devengados, desembolsos por tipo, intereses desafectados, recuperaciones por estado/tipo, recuperaciones por estado, resumen de capital/intereses, recuperaciones desafectadas (resumen y medios de pago) y cartera desafectada. Las celdas vacías se muestran como `—`; no se convierten en ceros. Los controles manuales anteriores siguen disponibles al final de DATOS.

La lectura ocurre en el navegador. PDF.js 5.6.205 se carga desde jsDelivr al leer el primer archivo, por lo que esa lectura requiere conexión. No hay OCR para documentos escaneados. Cambios de columnas o de formato requieren adaptar el lector; los informes no reconocidos muestran un error. Los importes son datos fuente y no completan automáticamente los cálculos de las otras conciliaciones.

El informe se conserva en `data.datosReport` del cierre, en la caché local, los respaldos JSON y Firestore al iniciar sesión. No requiere cambiar las reglas existentes. La subida del archivo sigue usando Storage, que debe estar habilitado. El repositorio público contiene el lector y pruebas con datos ficticios, sin PDFs ni valores privados.

Prueba del lector con datos sintéticos: `node tests/cierre-datos-parser.cjs`.
