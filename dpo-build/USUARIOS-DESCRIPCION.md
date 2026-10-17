# Descripción de usuarios

Campo opcional description, texto de hasta 500 caracteres, mostrado en Usuarios y permisos. Editar perfil precarga descripción y los permisos actuales; administrador puede modificar otros perfiles mediante el flujo existente, sin permitir autoedición. El cambio incrementa revisión y se audita en la misma transacción. Asignar gerencias conserva la descripción. Omitir el campo en clientes antiguos conserva su valor; enviar vacío lo borra explícitamente.

Compatibilidad con perfiles anteriores sin descripción y sin solicitud de acceso original. Las altas siguen requiriendo solicitud. Reglas de creación/actualización validan el tipo y tamaño; los directores no pueden modificar descripción ni permisos del perfil.

Archivos: src/cloud-ui.js, src/spark-api.js, firestore.spark.rules, functions/lib/operations.js (compatibilidad del adaptador alternativo), tests/spark/records.test.js y compilación Firebase. Publicación incluye la navegación CAH previamente autorizada y sus módulos.

Pruebas: 40 casos unitarios aprobados y nueve escenarios Spark, incluyendo guardado, auditoría, conservación, borrado explícito, tipo/tamaño inválidos, acceso no autorizado y perfil anterior. Adaptador alternativo Functions no desplegado; sistema activo usa Spark.

Uso: Usuarios y permisos → Editar perfil → Descripción del usuario → indicar motivo → Guardar perfil. Campo opcional al crear un perfil.
