# Resultados de las pruebas de seguridad

Fecha: 2026-11-13 22:06 | Objetivo: http://localhost:8080

## 1. Registro y escalada de privilegios

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Registro con role=[admin] | solo cliente | ["ROLE_CLIENTE"] | OK |
| Registro con role=[empleado] | solo cliente | ["ROLE_CLIENTE"] | OK |
| Registro sin role | cliente | ["ROLE_CLIENTE"] | INFO |

## 2. Control de acceso por rol (token de cliente)

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /usuarios/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /usuarios/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /usuarios/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /roles/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /productos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /productos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /productos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /mesas/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /mesas/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /mesas/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /pedidos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /pedidos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /detalles_pedidos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /detalles_pedidos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /detalles_pedidos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /detalles_pedidos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /seguimientos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /seguimientos/ | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /seguimientos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /seguimientos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /caja/actual | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /caja/historial | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| POST /caja/abrir | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| PUT /caja/cerrar | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /api/test/admin | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /pedidos/mis-pedidos | sin token 401/403, cliente 2xx | sin token 401, cliente 200 | OK |
| DELETE /pedidos/999999 | sin token 401/403, cliente 403 | sin token 401, cliente 403 | OK |
| GET /productos/ | publico (2xx) | sin token 200, cliente 200 | OK |
| GET /mesas/ | publico (2xx) | sin token 200, cliente 200 | OK |
| GET /actuator/health | publico (2xx) | sin token 200, cliente 200 | OK |

## 3. Un cliente no accede a los datos de otro

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Cliente A lee su propio perfil | 200 | 200 | OK |
| El perfil no devuelve la contrasena | sin campo password | no la devuelve | OK |
| Cliente A lee el perfil de B | 403/404 | 404 | OK |
| Cliente A modifica el perfil de B | 403/404 | 404 | OK |
| Cliente A se asigna roles en su propio perfil (PUT, respuesta 200) | roles sin cambios (solo cliente) | ["ROLE_CLIENTE"] | OK |
| Borrar el pedido de otro usuario | 403/404 | no probado (usa PEDIDO_ID=<id>) | PENDIENTE |

## 4. Tokens JWT

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Token con la firma alterada | 401 | 401 | OK |
| Token con alg=none | 401 | 401 | OK |
| Caducidad del token (horas) | lo mas corta posible | 24 | INFO |

## 5. Fuerza bruta en el login

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| 30 logins fallidos seguidos | bloqueo o 429 |      30 401  | PENDIENTE |

Fallos: 0. Informe guardado en resultados-seguridad-20261113-2206.md
