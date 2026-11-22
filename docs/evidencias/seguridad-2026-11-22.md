# Resultados de las pruebas de seguridad

Fecha: 2026-11-22 | Objetivo: `http://localhost/api`, a través de Caddy, como en producción | Versión: 2.1 en desarrollo (Spring Boot 4.2.0, Angular 22)

Resultado: **53 OK, 0 fallos**.

El script crea sus propios usuarios de prueba (clientes con nombre `prueba_*`) y no usa la cuenta de administrador. Respecto a la ejecución del [15 de noviembre](seguridad-2026-11-15.md), se ataca a través de Caddy en lugar de directamente al backend, y se añaden la fuerza bruta (entonces pendiente), el borrado de pedidos ajenos (entonces sin probar), la manipulación de precios, el actuator desde fuera y las cabeceras de seguridad.

## 1. Registro y escalada de privilegios

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Registro pidiendo rol admin | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |
| Registro pidiendo rol empleado | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |
| Registro sin pedir rol | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |

## 2. Control de acceso por rol (sin token y con token de cliente)

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /usuarios/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /usuarios/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /usuarios/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /roles/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /productos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /productos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /productos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /mesas/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /mesas/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /mesas/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /pedidos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /pedidos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /pedidos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /pedidos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /pedidos/pendientes-efectivo | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /detalles_pedidos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /detalles_pedidos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /detalles_pedidos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /detalles_pedidos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /seguimientos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /seguimientos/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /seguimientos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /seguimientos/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /caja/actual | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /caja/historial | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /caja/abrir | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /caja/cerrar | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /ruta-no-declarada | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /productos/ | público 200 | sin token 200 | OK |
| GET /mesas/ | público 200 | sin token 200 | OK |
| GET /pedidos/mis-pedidos | sin token 401, cliente 200 | sin token 401, cliente 200 | OK |
| GET /api/actuator/health desde fuera | 404 (solo accesible dentro de Docker) | 404 | OK |

## 3. Datos de otros usuarios (IDOR) y mass assignment

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Cliente A lee su propio perfil | 200 | 200 | OK |
| El perfil no devuelve la contraseña | sin valor en password | no la devuelve | OK |
| Cliente A lee el perfil de B | 404 | 404 | OK |
| Cliente A modifica el perfil de B | 404 | 404 | OK |
| Cliente A se asigna roles de admin en su perfil (PUT, respuesta 200) | roles sin cambios | ["ROLE_CLIENTE"] | OK |

## 4. Pedidos: precio manipulado y pedidos ajenos

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Pedido con precio manipulado (0,01 € por 2 × 1,00 €) | el servidor recalcula: 2,00 € | creado (201), total 2,00 € | OK |
| Cliente B lee, modifica y borra el pedido de A | 403 en los tres | 403, 403, 403 | OK |
| El pedido de A no aparece en los pedidos de B | no aparece | no aparece | OK |

## 5. Tokens JWT

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Token con la firma alterada | 401 | 401 | OK |
| Token con alg=none | 401 | 401 | OK |
| Caducidad del token (horas) | lo más corta posible | 4 (antes 24) | INFO |

## 6. Fuerza bruta en el login

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| 7 logins fallidos seguidos | 401 los 5 primeros y 429 después | 401, 401, 401, 401, 401, 429, 429 | OK |
| Cabecera Retry-After en el bloqueo | presente | 900 s | OK |
| Contraseña correcta durante el bloqueo | 429 (el bloqueo se mantiene) | 429 | OK |
| Otro usuario durante el bloqueo | 200 (el bloqueo es por usuario) | 200 | OK |

## 7. Errores y cabeceras

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| JSON malformado en el login | 400 sin traza interna | 400, sin traza | OK |
| Cabecera X-Content-Type-Options | nosniff | nosniff | OK |
| Cabecera X-Frame-Options | DENY | DENY | OK |
| Cabecera Referrer-Policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | OK |
| Cabecera Strict-Transport-Security | presente (solo tiene efecto con HTTPS) | max-age=31536000 | INFO |
| Cabecera Content-Security-Policy | pendiente (tarea 10 de la 2.1) | ausente | INFO |

## Limitaciones conocidas que muestra la prueba

- El bloqueo del login es por usuario: alguien puede bloquear 15 minutos la cuenta de otra persona fallando a propósito. Pasa a bloqueo por usuario e IP en la tarea de sesiones de la 2.1.
- Falta la cabecera `Content-Security-Policy` (tarea 10 de la 2.1).
- La subida de archivos requiere un administrador y no se repitió en esta ejecución; su última prueba está en [subidas-y-errores](subidas-y-errores.md).
