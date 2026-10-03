# Actualizaciones de StockPro

Publicación: https://jodahir.github.io/job/stockpro/

## Proceso breve

1. Revisar los cambios recientes y solamente los archivos de la función solicitada. No volver a leer el HTML completo para cada ajuste.
2. Editar los fragmentos de `docs/stockpro/`: `login-screen.html`, `login-client.js`, `roles-client.js`, `spark-client.js` o `modules-client.js`. Las operaciones de negocio están en `stockpro-firebase/functions/domain.js`.
3. Ejecutar las pruebas relacionadas con el cambio. Para login y operaciones: `node --test stockpro-spark/tests/login.test.cjs stockpro-firebase/tests/domain.test.js`. Los cambios de permisos también requieren pruebas de reglas en los emuladores; los flujos visuales requieren comprobar la pantalla afectada.
4. Agrupar los cambios relacionados en una sola publicación. No repetir pruebas ya aprobadas si nada relevante cambió.
5. Publicar los archivos fuente pequeños. GitHub Actions ejecuta las pruebas básicas, reconstruye StockPro y publica todo `docs/` conservando las demás páginas. No subir manualmente el HTML generado por navegador.
6. Comprobar una vez el resultado de la ejecución y la página afectada. `stockpro/version.json` identifica el commit publicado. Si falla, leer el paso fallido antes de reintentar.

`python3 stockpro-spark/build.py` permite generar el HTML local para pruebas. El HTML contiene también la base de la aplicación; los bloques marcados STOCKPRO_* se regeneran desde sus fuentes.

Las reglas de Firebase se publican por separado: fuente `stockpro-spark/firestore.rules`, copia `docs/stockpro/firestore.rules`. La publicación de Pages no despliega reglas ni cambia cuentas. Nunca agregar credenciales privadas al repositorio.

Para revertir una versión, revertir su commit y dejar que la misma publicación automática reconstruya la página. La reversión de código no revierte operaciones comerciales ni datos guardados.

Este proceso reduce tareas repetidas; no garantiza una cantidad fija de créditos o consumo del plan.
