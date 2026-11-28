# Resultados de las pruebas de seguridad

Fecha: 2026-11-28 00:50 | Objetivo: http://localhost/api (a través de Caddy)

Resultado: **138 OK, 0 fallos**. Usuarios de prueba creados por el script: `prueba_*_e5c1e7` (clientes).


## 1. Registro y escalada de privilegios

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Login antes de confirmar el correo | 403 EMAIL_NO_VERIFICADO | 403 EMAIL_NO_VERIFICADO | OK |
| Registro pidiendo rol admin | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |
| Registro pidiendo rol empleado | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |
| Registro pidiendo rol sin rol | solo ROLE_CLIENTE | ["ROLE_CLIENTE"] | OK |

## 2. Control de acceso por rol (sin token y con token de cliente)

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /usuarios/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /usuarios/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /usuarios/999999 | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /roles/ | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| DELETE /usuarios/999999/dos-factores | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /auditoria | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
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
| GET /turnos | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /turnos/actual | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| POST /turnos/terminar | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /ruta-no-declarada | sin token 401, cliente 403 | sin token 401, cliente 403 | OK |
| GET /productos/ | publico 200 | sin token 200 | OK |
| GET /mesas/ | publico 200 | sin token 200 | OK |
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
| Cliente A cambia su correo sin confirmarlo (PUT, respuesta 200) | correo sin cambios | prueba_sinr_e5c1e7@ejemplo.test | OK |

## 4. Pedidos: precio manipulado y pedidos ajenos

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Pedido con precio manipulado (0,01 € por 2 x 1.0 €) | el servidor recalcula: 2.0 | estado 201, total 2.0 | OK |
| Cliente B lee, modifica y borra el pedido de A | 403 en los tres | 403, 403, 403 | OK |
| El pedido de A no aparece en los pedidos de B | no aparece | no aparece | OK |

## 5. Tokens JWT

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Token con la firma alterada | 401 | 401 | OK |
| Token con alg=none | 401 | 401 | OK |
| Caducidad del token (horas) | lo más corta posible | 0.25 | INFO |

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
| Cabecera Content-Security-Policy | presente (no solo en modo aviso) | presente | OK |
| CSP: scripts solo de orígenes concretos | script-src 'self' sin 'unsafe-inline', 'unsafe-eval' ni * | script-src 'self' https://js.stripe.com https://*.js.stripe.com | OK |
| CSP: imágenes sin servicios de QR de fuera | img-src sin api.qrserver.com | img-src 'self' data: blob: https://*.stripe.com | OK |
| CSP: fuentes solo de la propia web (sin Google Fonts) | font-src 'self' | font-src 'self' | OK |
| CSP: object-src | object-src 'none' | object-src 'none' | OK |
| CSP: base-uri | base-uri 'self' | base-uri 'self' | OK |
| CSP: frame-ancestors | frame-ancestors 'none' | frame-ancestors 'none' | OK |
| CSP: form-action | form-action 'self' | form-action 'self' | OK |
| Aviso de la CSP sin sesión (lo envía el navegador) | 204 | 204 | OK |
| Aviso de la CSP de 200 KB | 204 sin procesarlo (no 500) | 204 | OK |
| GET al endpoint de avisos de la CSP | 401 (solo admite POST) | 401 | OK |

## 8. Correo: confirmación y recuperación de la contraseña

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| POST /auth/verificar con un token inventado | 400 | 400 | OK |
| POST /auth/restablecer con un token inventado | 400 | 400 | OK |
| Recuperar con un correo que existe y con uno que no | misma respuesta (no revela cuentas) | 200 / 200 | OK |
| Reenviar confirmación a una cuenta que no existe | 200 genérico | 200 | OK |
| El enlace de recuperación llega con el token en el fragmento (#token=) | presente en Mailpit | presente | OK |
| Restablecer con una contraseña demasiado corta | 400 (el enlace sigue valiendo) | 400 | OK |
| Restablecer con el enlace | 200 | 200 | OK |
| El token de acceso anterior al cambio de contraseña | 401 (sesiones cerradas) | 401 | OK |
| El mismo enlace por segunda vez | 400 (un solo uso) | 400 | OK |

## 9. Verificación en dos pasos

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| Login de un cliente (para él es opcional y no la tiene) | 200 con token, sin segundo paso | 200 | OK |
| POST /auth/2fa/verificar con un desafío inventado | 401 DESAFIO_CADUCADO | 401 DESAFIO_CADUCADO | OK |
| Ese 401 no abre sesión | sin Set-Cookie | sin Set-Cookie | OK |
| POST /auth/2fa/configurar con un desafío inventado | 401 DESAFIO_CADUCADO | 401 DESAFIO_CADUCADO | OK |
| POST /auth/2fa/activar con un desafío inventado | 401 DESAFIO_CADUCADO | 401 DESAFIO_CADUCADO | OK |
| Código de 500 caracteres | 400 (validación) | 400 | OK |
| Segundo paso sin código | 400 (validación) | 400 | OK |
| Reautenticarse sin sesión | 401 | 401 | OK |
| Reautenticarse con una contraseña incorrecta (cliente, sin 2FA) | 400 CODIGO_INCORRECTO | 400 CODIGO_INCORRECTO | OK |
| Reautenticarse con la contraseña correcta | 200 con la hora de fin de la ventana | 200 | OK |

## 10. Perfil: seguridad de la propia cuenta

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /perfil/seguridad sin sesión | 401 | 401 | OK |
| GET /perfil/sesiones sin sesión | 401 | 401 | OK |
| PUT /perfil/password sin sesión | 401 | 401 | OK |
| POST /perfil/dos-factores/configurar sin sesión | 401 | 401 | OK |
| DELETE /perfil/dos-factores sin sesión | 401 | 401 | OK |
| DELETE /perfil/sesiones sin sesión | 401 | 401 | OK |
| El cliente ve sus sesiones (sin tokens ni hashes) | 200, una marcada como actual | 200, 2 sesiones | OK |
| Cerrar una sesión que no es suya | 404 | 404 | OK |
| Cambiar la contraseña sin la actual correcta | 400 | 400 | OK |
| Cambiar la contraseña por una demasiado corta | 400 | 400 | OK |

## 11. Perfil: correo, descarga de datos y eliminación de la cuenta

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| POST /perfil/correo sin sesión | 401 | 401 | OK |
| DELETE /perfil/correo sin sesión | 401 | 401 | OK |
| GET /perfil/mis-datos sin sesión | 401 | 401 | OK |
| DELETE /perfil sin sesión | 401 | 401 | OK |
| Confirmar un cambio de correo con un token inventado | 400 | 400 | OK |
| Cambiar el correo por el de otra cuenta | 409 | 409 | OK |
| Cambiar el correo por uno no válido | 400 | 400 | OK |
| Pedir el cambio de correo | 202 | 202 | OK |
| Pedir otro enlace en menos de un minuto | 429 | 429 | OK |
| Hasta abrir el enlace la cuenta sigue con el correo anterior | prueba_admi_e5c1e7@ejemplo.test | prueba_admi_e5c1e7@ejemplo.test | OK |
| El enlace llega al correo nuevo con el token en el fragmento (#token=) | presente en Mailpit | presente | OK |
| Confirmar el cambio con el enlace | 200 | 200 | OK |
| El mismo enlace por segunda vez | 400 (un solo uso) | 400 | OK |
| Descargar mis datos | 200, como adjunto y sin caché | 200 attachment; filename="barhub-mis-datos.json" | OK |
| La descarga no lleva la contraseña ni el token | sin «password», sin hash y sin el token | limpia | OK |
| El cliente elimina su cuenta | 204 | 204 | OK |
| Su token después de eliminarla | 401 (sesiones cerradas) | 401 | OK |
| Login con el usuario y la contraseña de la cuenta eliminada | 401 | 401 | OK |
| Recuperar la contraseña con el correo de la cuenta eliminada | 200 genérico (sin enlace) | 200 | OK |

## 12. Avisos en tiempo real (comandas, mesas y seguimiento)

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /eventos/personal sin sesión | 401 | 401 | OK |
| GET /eventos/mis-pedidos sin sesión | 401 | 401 | OK |
| Un cliente abre el canal del personal (todas las comandas y mesas) | 403 | 403 | OK |
| Canal del cliente con un token inventado | 401 | 401 | OK |
| Token en la URL en vez de en la cabecera | 401 (no se acepta: acabaría en los logs) | 401 | OK |
| PATCH /mesas/{id}/estado sin sesión | 401 | 401 | OK |
| Un cliente cambia el estado de una mesa | 403 (solo personal) | 403 | OK |
| El cliente abre su canal | 200, text/event-stream sin comprimir y aviso «conectado» | 200, text/event-stream, sin comprimir, ['conectado'] | OK |
| A no recibe avisos de los pedidos de B | ningún aviso | pedido de B 139: ningún aviso | OK |
| A recibe el aviso de su propio pedido (solo el id) | event pedido, data {"id":140} | [["pedido", "{\"id\":140}"], ["pedido", "{\"id\":140}"]] | OK |
| Al cerrar esa sesión desde otra, el servidor corta su canal | cortado en menos de 30 s | cierre de sesiones 200; cortado a los 24 s | OK |

## 13. Pago con tarjeta (Stripe en modo de pruebas)

| Prueba | Esperado | Obtenido | Resultado |
| :--- | :--- | :--- | :---: |
| GET /pagos/configuracion sin sesión | 200 sin la clave secreta | 200, tarjeta True | OK |
| La clave publicable es de pruebas (o no hay) | pk_test_... o ninguna | pk_test_... | OK |
| Pedido con tarjeta sin pago | 400 (no se crea) | 400 | OK |
| Pedido con tarjeta y un id de pago inventado | 400 (no se crea) | 400 | OK |
| Pedido con tarjeta y un id de pago con inyección | 400 o 503 (no se crea) | 400 | OK |
| Pedido en efectivo que dice estar pagado | 201 y PENDIENTE | 201, PENDIENTE | OK |
| Intento de pago con el precio manipulado (0,01 €) | 201 por 2.0 € (precio de la carta) | 201, 2.0 | OK |
| Intento de pago sin productos | 400 | 400 | OK |
