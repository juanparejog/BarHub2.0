# Evidencias: subida de imagenes y manejo de errores

Fecha: 2026-11-14. Entorno: instancia local con Docker Compose. Metodo: peticiones
manuales con curl y comprobacion del contenido del volumen de subidas.

## Imagenes de producto (solo ADMIN)

| Prueba | Esperado | Obtenido |
| :--- | :--- | :--- |
| PNG valido | 200 | 200 (nombre con sufijo aleatorio) |
| Sin tipoProducto | 400 | 400 |
| Precio negativo | 400 | 400 |
| Fichero de 7 MB | 413 o 400 | 413 |
| PHP con Content-Type de imagen | 400 | 400 |
| Ruta hostil en el campo imagen (../../app/app.jar) | 400 | 400 |
| Editar con imagen nueva | la anterior se borra | correcto |
| Borrar el producto | el fichero se borra | correcto |

## Imagenes de perfil

| Prueba | Esperado | Obtenido |
| :--- | :--- | :--- |
| Foto valida en el perfil propio | 200 | 200 |
| Foto nueva: la anterior se borra | un solo fichero | correcto |
| PHP disfrazado, PNG falso, SVG | 400 | 400 |
| Foto en el perfil de otro usuario | 404 | 404 |
| Nombre de 21 caracteres, email mal formado | 400 | 400 |

## Errores y recursos inexistentes

| Prueba | Esperado | Obtenido |
| :--- | :--- | :--- |
| Pedido inexistente (admin) | 404 con mensaje generico | 404 |
| Mesa inexistente | 404 | 404 |
| Producto inexistente | 404 | 404 |
| Pedido con producto inexistente | 400 "Producto no valido." | 400 |
| Ruta inexistente sin token / con token | 401 / 403 | 401 / 403 |

Ninguna respuesta de error incluye nombres de clase ni SQL: el detalle queda en el log del servidor.
