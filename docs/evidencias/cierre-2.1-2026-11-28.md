# Pasada final del cierre de la 2.1

Fecha: 2026-11-28 | Entorno: Kali Linux, instancia local con Docker Compose (MariaDB, backend, frontend, Caddy y Mailpit) | Versión: 2.1 (Spring Boot 4.2.0, Java 21, Angular 22)

Resultado: **todas las pruebas pasan, sin fallos ni pruebas omitidas**.

Se ejecutó sobre el código del commit `1f5fa2b` (correcciones de SonarCloud). Los tres commits posteriores del mismo día solo tocan colores de los iconos de acción del panel, un comentario de Java y la configuración del análisis de SonarCloud, y el CI de cada uno pasó en verde (build, tests del frontend y del backend, E2E y SOC).

## Resumen

| Prueba | Comando | Resultado |
| :--- | :--- | :--- |
| Tests del backend (JUnit, unitarios e integración) | `./gradlew test` | **373 OK**, 0 fallos, 0 errores, 0 omitidos |
| Tests del frontend (Vitest) | `npm test -- --watch=false` | **208 OK** en 38 archivos |
| Build de producción del frontend | `npm run build` | Correcto. Sin avisos de presupuesto ni de CSS; solo los avisos conocidos de dependencias CommonJS (`pdfmake`, `vfs_fonts` y `dijkstrajs`, que trae `qrcode`) |
| Imágenes Docker | `docker compose up -d --build` | Backend y frontend construidos y en marcha; backend `healthy` |
| E2E (Playwright, Chromium) | `npm test` en `e2e/` | **53 OK** en 15 archivos (7,4 min), con las claves de pruebas de Stripe |
| Pruebas dinámicas de seguridad | script propio contra `http://localhost/api` | **138 OK, 0 fallos** ([informe](seguridad-2026-11-28.md)) |
| Tests del SOC | `python3 -m unittest discover -s seguridad/soc -p "test_*.py"` | **29 OK** |

## E2E por archivo

| Archivo | Tests | Qué recorre |
| :--- | :---: | :--- |
| `01-publico` | 6 | Portada, carta sin sesión, pantallas cerradas, login incorrecto, CSP estricta y fuentes servidas desde la propia web |
| `02-pedido` | 5 | Registro con confirmación por correo, pedido para recoger con ticket, comanda del personal y gestión de pedidos |
| `03-caja` | 1 | Apertura y cierre de caja con arqueo |
| `04-admin` | 1 | Panel de administración, listados y métricas |
| `05-sesion` | 6 | Cookie de renovación, renovación automática, cierre de sesión en el servidor y aviso de inactividad |
| `06-turno` | 3 | Alta de un empleado, fin de turno y registro de jornada |
| `07-correo` | 3 | Recuperación de la contraseña por correo |
| `08-dos-factores` | 4 | Verificación en dos pasos obligatoria para el personal y códigos de recuperación |
| `09-perfil` | 5 | Perfil por pestañas, contraseña, sesiones y verificación en dos pasos del cliente |
| `10-privacidad` | 4 | Cambio de correo, descarga de datos y eliminación de la cuenta |
| `11-auditoria` | 1 | Registro de auditoría |
| `12-alergenos-qr` | 1 | Iconos y filtro de alérgenos, QR de la mesa |
| `13-tiempo-real` | 4 | Comandas, seguimiento y mesas sin recargar |
| `14-idiomas` | 5 | Español, portugués e inglés; primera visita en español y en modo claro |
| `15-pago-tarjeta` | 4 | Pago con la tarjeta de pruebas 4242, tarjeta rechazada y comprobación en el servidor |

El test de aviso de inactividad de `05-sesion` falló una vez en una ejecución anterior de la 2.1 por tiempos y pasó al repetirlo; en esta pasada pasó a la primera.

## Pruebas dinámicas por sección

| Sección | OK |
| :--- | :---: |
| 1. Registro y escalada de privilegios | 4 |
| 2. Control de acceso por rol | 37 |
| 3. Datos de otros usuarios (IDOR) y mass assignment | 6 |
| 4. Pedidos: precio manipulado y pedidos ajenos | 3 |
| 5. Tokens JWT | 2 (y la caducidad, informativa: 15 minutos) |
| 6. Fuerza bruta en el login | 4 |
| 7. Errores, cabeceras y CSP | 15 (y HSTS, informativa: solo tiene efecto con HTTPS) |
| 8. Correo: confirmación y recuperación de la contraseña | 9 |
| 9. Verificación en dos pasos | 10 |
| 10. Perfil: seguridad de la propia cuenta | 10 |
| 11. Perfil: correo, descarga de datos y eliminación de la cuenta | 19 |
| 12. Avisos en tiempo real | 11 |
| 13. Pago con tarjeta (Stripe en modo de pruebas) | 8 |
| **Total** | **138** |

Antes de lanzar el script se reinicia el backend, para que los bloqueos por IP de ejecuciones anteriores no den 429 donde no toca.

## Análisis estático en la misma fecha

| Herramienta | Resultado |
| :--- | :--- |
| SonarCloud | Quality Gate superado; 0 incidencias abiertas en el código nuevo ([detalle](../auditorias.md#revisión-del-28-de-noviembre-de-2026-cierre-de-la-21)) |
| Snyk | Backend: 2 avisos aceptados, ninguno explotable. Frontend y E2E: 0 |
| Trivy | 0 vulnerabilidades altas o críticas en el repositorio; 0 errores de configuración en los Dockerfile |
| Dependabot | 0 alertas abiertas |
