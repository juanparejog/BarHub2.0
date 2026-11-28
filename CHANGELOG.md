# Changelog

Todos los cambios relevantes de BarHub se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Paginación (`shared/paginador`): «1–25 de 340», botones de página con huecos (1 … 7 8 9 … 20), elementos por página y vuelta al principio del listado al cambiar. En la carta (24 por página), en los listados del panel (productos, usuarios, mesas, pedidos y detalles de pedido, 25 por página), en el historial de caja, en el registro de jornada y en la auditoría (que ya paginaba el servidor). Buscar, filtrar o cambiar el tamaño vuelve a la primera página.
- Buscador en la carta, sin distinguir tildes, por el nombre y la descripción en el idioma elegido y en español; mensaje cuando nada coincide con los filtros. Textos en español, portugués e inglés.
- Historial de caja por semana (de lunes a domingo), mes, año o todo, con flechas para ir a los periodos anteriores, y los totales del periodo: cajas, efectivo, tarjeta y descuadre.
- Registro de jornada: rangos rápidos (hoy, 7 y 30 días), total del periodo y una tarjeta por empleado con sus horas y una barra; al pulsarla, la tabla enseña solo sus turnos. La auditoría también tiene los rangos rápidos.
- Tests de la paginación (cortes, huecos, tamaño y páginas fuera de rango), de los periodos de caja (semana de lunes a domingo, meses sin saltos, final sin incluir), de los rangos rápidos de la auditoría y del registro de jornada y de su filtro por empleado. Los E2E buscan lo que necesitan en los listados (`buscarEnListado`) y en la carta, que ahora van por páginas.
- Avisos propios (`shared/avisos`): un diálogo para lo que cierra un proceso (pedido hecho, con su número y el total, y botones para seguirlo o volver a la carta; cobro en efectivo registrado, con lo entregado y el cambio; cancelar el pedido) y avisos flotantes que no bloquean la pantalla para el trabajo del personal (pedido servido o listo para recoger, mesa ocupada o libre, caja abierta o cerrada). El icono se dibuja al aparecer; el diálogo atrapa el foco, se cierra con Escape y lo devuelve donde estaba; los flotantes se anuncian a los lectores de pantalla (`role="status"`) y se van solos a los 3,5 s.
- Transiciones entre páginas con la View Transitions API (`enableViewTransitions` en el router): la página sale con un fundido corto y la nueva entra subiendo, mientras la barra y el pie se quedan quietos. Con «reducir movimiento» del sistema no hay animación, y los navegadores sin la API cambian de página como antes.
- Barra superior que se compacta y gana sombra al desplazar la página, y pie con degradado del mismo azul. Foco visible común para enlaces y elementos con `tabindex`.
- Tests de los avisos (Vitest: acción por defecto, foco y Escape, flotantes limitados a 3 y que se van solos), de la confirmación (diálogo con número y total) y E2E: el diálogo del pedido hecho lleva al seguimiento, el aviso flotante del personal al cambiar una comanda y las fuentes se sirven desde la propia web.
- Pago con tarjeta con Stripe en modo de pruebas, comprobado en el servidor. El navegador pide un intento de pago (`POST /pagos/intento`), que el servidor crea por el total que calcula con los precios de la carta y ata al usuario y a los productos; Stripe.js lo cobra con la tarjeta (sus datos van directos a Stripe) y el pedido se crea con el id del pago. Antes de darlo por pagado, el servidor pregunta a Stripe si el pago existe, está cobrado, es de ese usuario, por ese importe, en euros y para esos productos, y si no lo usa ya otro pedido (`pedidos.pago_id`, único); si el importe o los productos no cuadran, lo devuelve. `GET /pagos/configuracion` dice si hay tarjeta y da la clave publicable, que ya no está escrita en el frontend. Claves nuevas `STRIPE_SECRET_KEY` y `STRIPE_PUBLISHABLE_KEY`; solo se aceptan las de pruebas (`app.pagos.solo-pruebas`) y, sin ellas, la tarjeta aparece desactivada y se paga en efectivo. Si el pedido no llega a crearse tras cobrar, el reintento usa el mismo pago en lugar de cobrar otra vez. Aviso con la tarjeta de prueba 4242, mensajes de Stripe en el idioma elegido y botón desactivado mientras se cobra.
- Tests del pago con tarjeta: unitarios de las claves y de cada motivo de rechazo (sin pago, inventado, ya usado, sin cobrar, de otro usuario, otro importe, otra moneda u otros productos, con devolución), integración con Stripe sustituido por un doble, Vitest de la confirmación (sin tarjeta, cobro, tarjeta rechazada, reintento sin cobrar dos veces) y un E2E nuevo, `15-pago-tarjeta` (lo que no depende de Stripe siempre; el pago con las tarjetas de prueba 4242 y 0002, solo con las claves). `pruebas_seguridad.py` añade la sección 13.
- SOC automático (perfil `soc` de Docker Compose): Grafana Alloy lee el log de acceso de Caddy y un log nuevo del backend en JSON (volumen `backend_logs`, rotado a los 10 MB, 7 días), Loki los guarda 30 días y evalúa cada minuto 8 reglas de alerta (fuerza bruta en el login, el segundo paso y la reautenticación; fallos repartidos entre muchas IP; accesos denegados; cambios de privilegios; escaneo con muchas 4xx; 5xx; avisos de la CSP; errores del backend), Alertmanager avisa por correo (Mailpit en local, SMTP real en producción) y opcionalmente por Telegram, también al resolverse, y Grafana trae el panel *BarHub - SOC*. Cada entrada del registro de auditoría deja en el log `evento=auditoria accion=... resultado=... ip=...`, sin usuario ni detalle. Ningún puerto sale de `127.0.0.1` y el recolector no tiene acceso a Docker ni capacidades. Variables `SOC_*` en `.env.example`.
- `seguridad/soc/soc.py` (Python, solo biblioteca estándar) para validar, comprobar, desplegar, probar, ver el estado y parar el SOC; lo que cambia algo solo se hace con `--aplicar`. `probar` lanza un ataque simulado (logins fallidos, rutas inexistentes y un aviso de la CSP) y comprueba que las alertas llegan a Alertmanager y los correos a Mailpit.
- Tests del SOC: `unittest` de `soc.py` (lectura del `.env`, validación, configuración generada con los secretos escapados y ocultos en la simulación, reglas, panel, puertos solo locales, volúmenes en solo lectura), job nuevo `soc` en CI que valida la configuración con las imágenes fijadas y carga y evalúa las reglas en un Loki real, y tests del backend de la línea del SOC (unitario y de integración: login fallido sin el usuario en el log).
- Idiomas en las pantallas del cliente: menú, pie, portada, carta, confirmación del pedido, seguimiento, inicio de sesión, registro, verificación en dos pasos, recuperación de la contraseña, enlaces del correo, perfil con sus cinco pestañas, contacto y textos legales (traducidos enteros) en español, portugués de Portugal e inglés británico, con un selector en el menú. Los mensajes que manda la API se ven tal cual en español y, en los otros idiomas, con un texto equivalente. Selector con las banderas de España, Portugal y Reino Unido en botones redondos, como el interruptor del modo oscuro. Nombre y descripción de cada producto en portugués e inglés (`nombrePt`, `nombreEn`, `descripcionPt`, `descripcionEn`), que el administrador escribe al editar el producto; si faltan, la carta usa el español. Los productos de demostración vienen traducidos (`demo/demo-traducciones.sql`, que solo rellena los que no tienen ninguna traducción). Cambia al momento, se recuerda en el navegador y la primera vez se toma el del navegador. Precios con el formato de cada idioma, alérgenos con su nombre oficial en cada uno, `lang` de la página y formulario de Stripe en el idioma elegido. Sin librerías nuevas: textos en `shared/i18n`, tuberías `t` y `precio`. Tests de Vitest (claves y datos iguales en los tres idiomas, detección, guardado, formato de precios y fechas, mensajes de la API, alérgenos, sesiones) y E2E `14-idiomas`.
- Tiempo real con Server-Sent Events: las comandas, el estado de las mesas, los pagos en efectivo y el seguimiento del cliente se actualizan al momento, en lugar de preguntar cada 5 s. Endpoints `GET /eventos/personal` (empleados y administradores) y `GET /eventos/mis-pedidos` (solo los pedidos propios). Los avisos se envían tras el commit y solo dicen qué ha cambiado; la pantalla vuelve a pedir los datos. El frontend lee el flujo con `fetch` (el token va en la cabecera, no en la URL), agrupa los avisos que llegan juntos, se reconecta solo y, sin conexión, vuelve a preguntar cada 5 s. Las listas se pintan con `track` por id, así que una recarga ya no cierra lo que estaba abierto.
- Aviso sonoro opcional en la pantalla de comandas (Web Audio, sin ficheros), que cada persona activa en su navegador.
- Imprimir comanda: ticket para impresora térmica de 80 mm con número, modalidad y ubicación, horas del pedido y de impresión, productos con cantidad, notas y alérgenos por nombre («sin indicar, consultar» si faltan).
- `PATCH /mesas/{id}/estado` para que los empleados cambien el estado de una mesa sin poder editar el resto.
- Tests del tiempo real: integración (401 sin sesión, cliente fuera del canal del personal, cada cliente solo sus pedidos, aviso al guardar, cierre al cerrar la sesión, `PATCH` de mesas por rol), Vitest del servicio (lectura del flujo, agrupación, reconexión, respaldo), del aviso sonoro, de la impresión y de las mesas, y un E2E nuevo, `13-tiempo-real`. `pruebas_seguridad.py` añade la sección 12.
- Alérgenos: los 14 de declaración obligatoria (Reglamento (UE) 1169/2011) en cada producto, indicados desde el formulario del administrador con la casilla «Información de alérgenos revisada». La carta los muestra con iconos propios en SVG (círculo de color y pictograma blanco, con el nombre como texto alternativo), dice «Sin alérgenos de declaración obligatoria» o, si aún no se han indicado, «Alérgenos: pregunta al personal», y tiene un filtro **Alergias e intolerancias** con los 14 iconos que esconde lo que lleva el alérgeno elegido y lo que no tiene la información (recordado en el navegador). La ficha del producto y el formulario también usan los iconos.
- QR de las mesas propio: se dibuja en el navegador con `qrcode` (como el de la verificación en dos pasos) con la dirección de la web en la que se abre y el id de la mesa, y se puede descargar como PNG. `api.qrserver.com` sale de la CSP.
- Tests de alérgenos y QR: integración (alta, carta ordenada, `null` frente a `[]`, edición, valor desconocido), Vitest del filtro de la carta, de los iconos, del formulario y del QR, y un E2E nuevo, `12-alergenos-qr`.
- Registro de auditoría: inicios de sesión (también los fallidos, con el nombre escrito), segundo paso, reautenticación, cierre de sesión, registro, cambios de contraseña y de correo, verificación en dos pasos, sesiones cerradas, datos descargados, cuentas eliminadas, altas, ediciones (con los roles antes y después) y bajas de usuarios, apertura y cierre de caja, y accesos denegados por rol. Cada entrada guarda usuario, acción, resultado (correcto, rechazado, bloqueado o error), IP, petición y detalle, nunca contraseñas, códigos ni tokens. Pantalla nueva *Admin → Auditoría* con filtros por fechas, usuario, acción y resultado (`GET /auditoria`, solo administradores). Se borra al año (`app.auditoria.dias`), al eliminar una cuenta sus entradas se quedan sin nombre ni IP, y la descarga de los datos incluye las últimas 100 del usuario.
- Tests del registro de auditoría: integración (login fallido y correcto con IP, usuario inexistente, contraseña actual incorrecta, acceso denegado, filtros del administrador, anonimización), unitarios del resultado y del recorte de textos, Vitest de la pantalla y un E2E nuevo, `11-auditoria`. `pruebas_seguridad.py` comprueba que un cliente no lee la auditoría y avisa si un 429 viene de un bloqueo por IP de ejecuciones anteriores.
- Política de seguridad de contenido (CSP) estricta en Caddy: scripts solo de la propia web y de Stripe, sin `unsafe-inline` ni `unsafe-eval`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y `frame-ancestors 'none'`, más `Permissions-Policy`. Las infracciones llegan al log del backend por `POST /api/csp-informe`. `CSP_CABECERA=Content-Security-Policy-Report-Only` la deja solo en modo aviso. La build de producción deja de usar `inlineCritical`, que cargaba los estilos con un `onload` en línea.
- Tests de la CSP: unitarios y de integración del endpoint de avisos (dos formatos, campos recortados, cupo por minuto, cuerpos enormes), y los E2E fallan si algo infringe la política; uno nuevo en `01-publico` comprueba la cabecera y que un `<script>` inyectado no se ejecuta. `pruebas_seguridad.py` comprueba las directivas y el endpoint.
- Pestaña Cuenta y correo en el perfil: cambiar el correo con enlace de confirmación. El enlace llega al correo nuevo y un aviso al actual; la cuenta no cambia hasta abrirlo (24 h, un solo uso) y el cambio pendiente se puede cancelar. Endpoints `POST`/`DELETE /perfil/correo` y `POST /auth/confirmar-cambio-correo`, página nueva `/auth/confirmar-cambio-correo` y enlace «Cambiar» en Datos personales. La columna `tokens_correo.tipo` pasa a `VARCHAR(20)`: en las bases creadas antes era un `ENUM` de MariaDB con solo los dos tipos anteriores, y al arrancar se convierte sola.
- Pestaña Privacidad en el perfil: descargar mis datos (`GET /perfil/mis-datos`, un JSON con la cuenta, la dirección, los pedidos, las sesiones y el registro de jornada) y eliminar la cuenta (`DELETE /perfil`, solo clientes, confirmando con el nombre de usuario). Eliminar anonimiza: borra los datos personales, la foto, la verificación en dos pasos y los enlaces pendientes, cierra todas las sesiones y conserva los pedidos sin dirección ni teléfono; llega un aviso al correo.
- Tests del cambio de correo y de la privacidad: integración (enlace al correo nuevo, aviso al anterior, correo ocupado, límite de un enlace por minuto, cancelar, descarga sin secretos, anonimización, personal rechazado), Vitest de las dos pestañas y de la página del enlace, y un E2E nuevo, `10-privacidad`. `pruebas_seguridad.py` añade la sección 11.
- Perfil con pestañas (`/perfil/datos`, `/perfil/direccion`, `/perfil/seguridad`), cada una con su propio guardado, y una cabecera con la foto, el rol, la fecha de alta y el estado de la cuenta (correo verificado, verificación en dos pasos). La foto se guarda al momento desde la cabecera. Sustituye a la página única, donde datos, dirección y contraseña compartían un solo botón y un error en una parte impedía guardar las demás.
- Pestaña Seguridad: cambiar la contraseña con la actual (`PUT /perfil/password`, cierra las demás sesiones); activar la verificación en dos pasos desde el perfil (también los clientes), generar códigos de recuperación nuevos y desactivarla si el rol no la exige; y la lista de sesiones abiertas (navegador, IP, última actividad) con Cerrar y Cerrar todas las demás (`/perfil/sesiones`). La lista de códigos de recuperación es un componente compartido con la pantalla del segundo paso del login, que ahora enlaza a esta pestaña para generar códigos nuevos.
- Tests del perfil: unitarios de las sesiones y de los códigos, integración de `/perfil/**` con sesiones reales, Vitest de la cabecera y de cada pestaña, y un E2E nuevo, `09-perfil` (pestañas con URL, guardado por separado, contraseña, sesiones y verificación en dos pasos de un cliente). `pruebas_seguridad.py` prueba `/perfil/**` sin sesión y con sesiones ajenas.
- Reautenticación para las acciones críticas del administrador: alta, edición de otro usuario, borrado y restablecer la verificación en dos pasos. Si hace más de 5 minutos que no ha demostrado quién es (al iniciar sesión cuenta), el backend responde `403 REAUTENTICACION_REQUERIDA` sin ejecutar nada; una ventana pide el código de la app (o la contraseña, si no usa la verificación en dos pasos) y la acción se repite sola. Endpoint `POST /auth/reautenticar` y anotación `@RequiereReautenticacion` para marcar más acciones.
- El administrador puede restablecer la verificación en dos pasos de un empleado que ha perdido el móvil y sus códigos (`DELETE /usuarios/{id}/dos-factores`): se borran su secreto y sus códigos, se cierran sus sesiones y la configura de nuevo en su siguiente login. El listado de usuarios muestra quién la tiene activada. Al borrar un usuario se borra también su verificación.
- Tests de la reautenticación y del restablecimiento: unitarios de las sesiones y del servicio, integración con sesiones reales (ventana tras el login, código incorrecto o de recuperación rechazados, editar el propio perfil sin pedirla, control de que con ella el administrador sí cambia roles), Vitest de la ventana, del servicio y del interceptor, y un E2E nuevo en `08-dos-factores`. Los E2E comprueban al empezar que `E2E_ADMIN_TOTP_SECRET` es una clave TOTP y avisan si es un código de 6 dígitos o uno de recuperación. `pruebas_seguridad.py` prueba también `/auth/reautenticar` y el restablecimiento con token de cliente.
- Verificación en dos pasos con una app de autenticación (TOTP), obligatoria para el administrador y los empleados (configurable por rol en `app.dos-factores.obligatorio`). Con la contraseña correcta, el login responde un desafío en lugar del token y la pantalla nueva `/auth/2fa` pide el código de 6 dígitos. Quien aún no la tiene la configura ahí: escanea un código QR (o escribe la clave), confirma con el primer código y recibe 10 códigos de recuperación de un solo uso, que solo se muestran esa vez y se pueden descargar o copiar. Endpoints `/auth/2fa/verificar`, `/auth/2fa/configurar` y `/auth/2fa/activar`. Implementación propia del RFC 6238 en el backend, sin dependencias nuevas; en el frontend, `qrcode` dibuja el QR y se carga solo en esa pantalla.
- Tests de la verificación en dos pasos: vectores de las RFC 6238 y 4648, cifrado del secreto, reglas del servicio (margen de un paso, código no repetible, códigos de recuperación), desafíos, integración de punta a punta (sin token hasta el segundo paso, bloqueo por códigos incorrectos), Vitest de la pantalla nueva y del servicio, y E2E (`08-dos-factores`: configuración del empleado y entrada con un código de recuperación). Los E2E calculan los códigos TOTP como la app del móvil, y los de sesión pasan a usar un cliente.
- Correo con Mailpit en local (`http://localhost:8025`): confirmación de la cuenta al registrarse y recuperación de la contraseña. El cliente no puede iniciar sesión hasta abrir el enlace (el login responde `403 EMAIL_NO_VERIFICADO` y ofrece reenviarlo). Páginas nuevas de confirmar correo, recuperar contraseña y elegir una nueva, enlace «¿Has olvidado tu contraseña?» en el login, y endpoints `/auth/verificar`, `/auth/reenviar-verificacion`, `/auth/recuperar` y `/auth/restablecer`. En producción basta con apuntar `MAIL_HOST` y compañía a un SMTP real.
- Tests del correo: integración (confirmación, enlace de un solo uso, respuesta genérica, reenvío limitado, restablecer cierra las sesiones), Vitest de las tres páginas nuevas y E2E que leen el correo de Mailpit (registro con confirmación y recuperación de la contraseña). `pruebas_seguridad.py` confirma sus usuarios por Mailpit y comprueba también el correo.
- Registro de jornada: el turno de un empleado empieza al iniciar sesión y termina con «Terminar turno» en su menú, que pide confirmación con la hora de entrada, registra la salida y cierra la sesión. Si no lo pulsa, el turno se cierra solo con la hora de su última actividad cuando ya no le queda ninguna sesión abierta. El administrador lo consulta en *Admin → Registro de jornada*, con filtro por fechas y horas por empleado. Endpoints `/turnos/actual`, `/turnos/terminar` y `/turnos`.
- Tests E2E: preparación global que espera a que la API responda antes de empezar, y 3 tests nuevos del registro de jornada (alta de un empleado desde el panel, fin de turno desde el menú y consulta del registro).
- Avisos de cierre de sesión: dos minutos antes del cierre por inactividad aparece "¿Sigues ahí?" con cuenta atrás ("Seguir conectado" renueva; sin respuesta, la sesión se cierra también en el servidor) y cinco minutos antes de la duración máxima se avisa de la hora de cierre. La inactividad se mide por la interacción y se comparte entre pestañas; si el usuario está activo en una pantalla sin peticiones, la sesión se renueva en segundo plano. El login y `/auth/refresh` devuelven los límites de la sesión (`sesionCaducaEn`, `sesionInactividadSegundos`). Con tests de Vitest y 2 E2E nuevos.
- `POST /auth/refresh` y `POST /auth/logout`. El interceptor del frontend renueva el token de acceso al recibir un 401 y repite la petición sin que el usuario lo note (varias peticiones caducadas comparten una renovación); si la sesión ya no se puede renovar, el login muestra el aviso de sesión caducada. Cerrar sesión la revoca también en el servidor.
- Tests de las sesiones: unitarios del servicio (rotación, inactividad, duración máxima, reutilización, margen entre pestañas, límites por rol), de integración (cookie, renovación, cierre de sesión, token sin sesión) y 4 E2E nuevos (cookie no legible desde JavaScript, renovación transparente, aviso de sesión caducada y revocación al cerrar sesión).
- Tests E2E con Playwright (`e2e/`): 11 tests que recorren la aplicación completa en Chromium. Cubren la portada y la carta, el acceso denegado a visitantes y clientes, el login incorrecto, el registro, un pedido para recoger con su ticket en PDF y su seguimiento, la comanda y su cambio de estado, la caja con su arqueo y el panel de administración. Fallan también si la página lanza un error de JavaScript, y no dependen de servicios de terceros.
- CI: job `e2e` que levanta MariaDB, backend, frontend y Caddy con Docker Compose y claves aleatorias, y ejecuta los tests E2E. La imagen solo se publica en Docker Hub si pasan; si fallan, el informe de Playwright queda como artefacto. Dependabot vigila también las dependencias de `e2e/`.
- Tests unitarios del frontend con Vitest: 22 tests de `ThemeService`, `RoleGuard`, `AuthInterceptor`, `DialogService` y `AppComponent`, incluido uno que comprueba que el toast no interpreta HTML y otro de regresión para la confirmación cancelada.
- CI: el pipeline ejecuta los tests del frontend con cobertura (si uno falla, el CI falla) y SonarCloud mide la cobertura del frontend además de la del backend. El análisis pasa a la versión `2.1.0`.

### Seguridad
- Sin Google Fonts: Inter, Merriweather y los iconos de Material se sirven desde la propia web (`@fontsource-variable/inter`, `@fontsource-variable/merriweather` y `material-icons`, empaquetados en la build). La CSP queda en `font-src 'self'` y sin `fonts.googleapis.com` en `style-src`, y el navegador de quien visita la web ya no manda su IP a Google al cargarla (RGPD). `pruebas_seguridad.py` comprueba la directiva.
- Un pedido con tarjeta ya no queda pagado por decirlo el navegador: antes bastaba con `metodo_pago: TARJETA` para que el servidor lo marcara `COMPLETADO` sin cobrar nada.
- Los avisos en tiempo real no abren una vía nueva a los datos: el canal del personal es solo para empleados y administradores, cada cliente recibe solo los de sus pedidos, los avisos no llevan datos personales y la conexión se corta en cuanto la sesión se cierra o caduca. Conexiones limitadas por usuario y en total.
- Cambiar el correo, descargar los datos y eliminar la cuenta exigen reautenticación. El correo nuevo no entra en la cuenta hasta abrir el enlace enviado a él, y al actual se le avisa: con una sesión robada ya no se puede poner un correo ajeno para pedir después la recuperación de la contraseña.
- Cambiar la contraseña cierra las sesiones abiertas con la anterior: las demás del usuario si la cambia él, y todas si se la cambia el administrador (antes seguían abiertas hasta caducar). Los fallos con la contraseña actual cuentan para el bloqueo del login.
- Activar, quitar o regenerar la verificación en dos pasos desde el perfil exige reautenticación a cualquier usuario: con una sesión robada no se puede desactivar ni activar con un móvil ajeno.
- Un usuario ya no puede cambiar su propio correo con `PUT /usuarios/{id}`: el backend lo ignora (solo el administrador cambia el de otro). Antes bastaba una sesión robada para poner un correo ajeno y pedir la recuperación de la contraseña. El cambio con enlace de confirmación está en la pestaña Cuenta y correo.
- Un token de acceso de administrador robado ya no basta para crear cuentas, cambiar roles ni borrar usuarios: hace falta además el código de su app en los últimos 5 minutos, comprobado en el servidor con la sesión. Un administrador simulado sin sesión real (como en los tests) tampoco pasa.
- Verificación en dos pasos: el secreto TOTP se guarda cifrado con AES-256-GCM, con el id del usuario como dato autenticado, y de los códigos de recuperación solo su HMAC-SHA256 con la clave del servidor (`APP_TOTP_CLAVE`, o derivada de `JWT_SECRET`). Un código ya usado no se acepta otra vez, también con dos peticiones simultáneas. El desafío del login caduca a los 5 minutos y admite 5 códigos; los códigos incorrectos cuentan para el bloqueo del login, y repetir la contraseña no da intentos nuevos.
- Enlaces de correo seguros: de un solo uso, con caducidad (24 h y 30 min), guardados solo como SHA-256 y con el token en el fragmento de la URL, que no llega al servidor ni a los logs. Recuperar la contraseña no revela qué cuentas existen (misma respuesta y envío asíncrono) y restablecerla cierra todas las sesiones abiertas.
- Bloqueo del login también por IP: 20 fallos desde una misma IP, aunque sean contra cuentas distintas, la bloquean 15 minutos (*password spraying*). Un login correcto no limpia el contador de la IP. La IP real se toma de `X-Forwarded-For` solo si la petición viene de la red interna de Docker (`server.forward-headers-strategy: native`), así que no se puede falsificar desde fuera.
- Alta de usuarios desde el panel de administración: `crearUsuario()` guardaba la contraseña **en texto plano**, sin pasar por BCrypt (y ese usuario no podía iniciar sesión). Ahora se cifra como en el registro, y un `id` en la petición ya no puede sobrescribir otra cuenta.
- Sesiones: el token de acceso JWT pasa de 4 horas a 15 minutos y la sesión continúa con un token de renovación aleatorio en una cookie `HttpOnly`, `Secure` y `SameSite=Strict`, limitada a `/api/auth`. El token de renovación rota en cada uso; si se presenta uno ya rotado, se revoca la sesión entera (detección de robo). En la base de datos solo se guarda su SHA-256.
- Sesiones en el servidor (tabla `sesiones`): el token de acceso lleva el id de su sesión y el filtro comprueba en cada petición que sigue abierta, así que cerrar sesión lo invalida al momento. Límites por rol configurables en `application.yml`: administrador 15 min de inactividad y 8 h de sesión, empleado 30 min y 10 h, cliente 1 h y 12 h. Las sesiones caducadas se borran a la semana.
- `AuthController` deja de aceptar peticiones CORS de cualquier origen (`@CrossOrigin("*")`); se aplica la configuración global con orígenes concretos.
- CI: los tests del frontend se lanzan con `npm test` en lugar de `npx ng test`, que podía descargar un paquete sin versión fijada. Era la causa de la nota C de seguridad en SonarCloud, que vuelve a A con el Quality Gate superado.
- La conexión entre el backend y MariaDB va cifrada con TLS y con el certificado del servidor verificado: el driver MariaDB Connector/J 4 lo hace por defecto (`sslMode=verify-full`) y MariaDB 13 genera y valida su certificado sin configuración.
- Pruebas dinámicas con la versión nueva, a través de Caddy: 53 OK y 0 fallos. Quedan comprobados el bloqueo del login (antes pendiente), que un cliente no puede leer, modificar ni borrar el pedido de otro, el recálculo del precio en el servidor, el actuator cerrado desde fuera y las cabeceras de seguridad ([evidencia](docs/evidencias/seguridad-2026-11-22.md)).
- Reanálisis de Snyk con las versiones nuevas: backend de 29 incidencias a 2 (ninguna crítica ni explotable, sin parche publicado) y frontend de 25 a 0. ASM, que solo usa JaCoCo para el informe de cobertura, pasa de la 9.8 a la 9.11.1 (cinco avisos medios), y `objenesis`, que solo usan los tests, de la 3.3 a la 3.6. El aviso XXE de `jaxb-core` se acepta con su justificación en `SECURITY.md`.
- El usuario de la aplicación queda obligado a usar TLS (`REQUIRE SSL`): una conexión sin cifrar se rechaza. En instalaciones nuevas lo aplica `infra/docker/initdb/10-tls-obligatorio.sh`; en las existentes se aplica una vez a mano.

### Cambiado
- Móvil, primera parte: el carrusel de la portada ya no queda dentro de un marco (un estilo global le ponía relleno y fondo blanco), no lleva flechas (se pasa deslizando y cambia solo) y su texto cabe sobre la foto; el selector de modalidad de la carta pone el icono encima del texto; el desplegable «Admin» del menú se alinea como los demás enlaces y su triángulo va a la derecha y gira al abrirse (en escritorio estaba debajo del texto, pisado por la línea animada).
- Móvil, segunda parte: el cobro en efectivo sale como una hoja que sube desde abajo sobre la lista de cuentas (antes aparecía al final, después de todas) y se cierra tocando fuera; en escritorio el terminal se queda bajo la barra fija. Indicadores de mesas y cifras de la caja en dos columnas. Las pestañas del perfil se desplazan dentro de su franja sin ensanchar la página. Inicio de sesión y registro con los colores de la marca (título en Merriweather y botón azul marino) y el botón «Entrar» en lugar de «Login».
- El CSS de la carta se reparte en cuatro hojas (`carta.component.css`, `carta-productos.css`, `carta-movil-oscuro.css` y `carta-alergenos.css`) y el del seguimiento en dos (`seguimiento-pasos.css`), en el mismo orden de antes: cada una queda por debajo del límite de aviso de 10 kB por hoja de componente, sin cambiar nada de lo que se ve.
- La primera visita sale siempre en español y en modo claro, sin mirar el idioma del navegador ni el tema del sistema. Si el visitante cambia el idioma o pasa al modo oscuro, se le recuerda en su navegador como antes.
- Portada y carta a todo el ancho de la pantalla en escritorio: el carrusel va de lado a lado y las secciones tienen un margen que crece con la pantalla.
- La barra superior se queda arriba al bajar (el `sticky` pasa a `<app-menu>`, porque dentro de él el `<nav>` no tenía sitio para moverse). Las barras pegajosas de la carta, la confirmación y el perfil se colocan debajo de ella (`--alto-barra`).
- Seguimiento del pedido: cada paso con su color (recibido en azul, en cocina en ámbar, listo en índigo y entregado en verde), etiqueta con el estado actual, franja de color en la tarjeta, onda en el paso actual, pedidos en curso separados de los ya entregados y dos columnas en pantallas anchas.
- Caja, auditoría y registro de jornada rediseñados. La auditoría explica qué guarda y para qué sirve, y cada entrada lleva el icono de su acción y el resultado con color e icono.
- Listados del panel: más anchos, cabecera más limpia, filas que se marcan al pasar el ratón, botones de ver, editar y borrar con su color, y la gestión de pedidos con el mismo buscador que las demás (también por número de pedido).
- Perfil: la foto, su borde y la capa de «cambiar foto» ocupan el mismo círculo.
- Documentación: la sección de CI/CD de `infraestructura.md` describe el pipeline actual (estaba desfasada), y el README incluye los tests E2E.
- SonarCloud: revisión tras las migraciones ([auditorias.md](docs/auditorias.md)). `main.ts` arranca con `platformBrowser` en lugar de `platformBrowserDynamic`, obsoleto en Angular 22, y se usa `replaceAll` en el seguimiento de pedidos. Los 60 avisos de movimiento reducido (`css:S9440`) se excluyen del análisis porque la regla global de `styles.css` ya cubre todos los componentes; los dos avisos que no se pueden corregir quedan aceptados con su motivo.
- Backend: `spring.jpa.open-in-view` desactivado. La sesión de Hibernate ya no queda abierta hasta que se escribe la respuesta: los detalles de los pedidos (con su producto) y los roles de los usuarios se cargan en la misma consulta con `@EntityGraph`, en lugar de con una consulta extra por pedido o usuario al convertir a DTO. La actualización de un pedido lee y guarda en la misma transacción, y `PUT /seguimientos/{id}` devuelve el pedido como DTO en lugar de la entidad. Un test de integración sin transacción recorre los nueve endpoints afectados.
- Frontend: Angular 14 a **22**, versión a versión con `ng update` y sus migraciones oficiales (control flow `@if`/`@for`, `standalone: false` en los componentes de módulos, `ChangeDetectionStrategy.Eager` para conservar la detección de cambios anterior, `withXhr` en el cliente HTTP). TypeScript 4.8 a 6.0, zone.js 0.11 a 0.16 y Node 18 a 24 en Docker y en el CI. Cada salto se verificó con el build de producción y con capturas automáticas de las 36 pantallas en los dos temas.
- Frontend: el build pasa del builder `browser` (Webpack) al builder `application` (esbuild): compila en unos 15 segundos en lugar de 30 a 55. La salida pasa a `dist/barhub/browser`, y el Dockerfile copia desde ahí.
- Frontend: `pdfmake` y sus fuentes (cerca de 2 MB) se cargan solo al generar el ticket, con `import()` dinámico, en lugar de en el arranque. El bundle inicial baja de 2,80 MB a 1,13 MB (de 795 kB a 218 kB comprimido) y ya cumple el presupuesto de 2 MB.
- Frontend: los tests pasan de Karma y Jasmine (con Chrome) a Vitest con jsdom (sin navegador), con la migración oficial de Angular. Se retiran 166 paquetes, entre ellos la cadena `socket.io`/`ws` de Karma, y `npm audit` queda sin vulnerabilidades. `src/test.ts`, `karma.conf.js` y `src/polyfills.ts` sobran (los polyfills se declaran directamente como `zone.js`).
- Frontend: `tsconfig.json` sin las opciones que TypeScript 6 declara obsoletas: `baseUrl` pasa a `paths` (los imports `src/...` siguen igual), fuera `downlevelIteration` y `moduleResolution` pasa a `bundler`.
- Frontend: se quitan los `overrides` de `package.json`, que parcheaban las herramientas de Angular 14; con las versiones nuevas sobran. Dependabot pasa de 53 alertas abiertas a 1.
- Caddy: la regla que cachea un año los JS y CSS con hash reconoce los nombres de esbuild (`main-VMWQ63FG.js`).
- `DialogService` usa la API nativa de Bootstrap 5 (`Modal` y `Toast`) en lugar de jQuery. Los textos se insertan con `textContent`, sin interpretar HTML.
- Dependabot: comentarios de las reglas del frontend actualizados a Angular 22; deja de ignorar las versiones mayores de `@stripe/stripe-js`.
- Documentación: Angular 22 en el README, `docs/frontend.md`, `docs/README.md`, `docs/auditorias.md`, `docs/seguridad.md`, `SECURITY.md` y el README del frontend.
- Backend: Java 17 a 21 (toolchain de Gradle, imágenes `eclipse-temurin:21` y CI).
- Backend: driver `mariadb-java-client` 3.5.11 a 4.0.0, y Dependabot deja de ignorar sus versiones mayores.
- Documentación: versiones nuevas en el README, `docs/backend.md`, `docs/seguridad.md`, `docs/auditorias.md` e `infraestructura.md`; evidencia de la conexión cifrada con MariaDB; en `docs/seguridad.md` se corrigen datos desfasados (caducidad del JWT de 4 horas, bloqueo del login y contraseña actual, ya implementados en la 2.0.1).
- Backend: JJWT 0.12.5 a 0.13.0 en sus tres módulos a la vez; Dependabot los agrupa para que no vuelvan a separarse de versión.
- Backend: Spring Boot 3.5.16 a 4.2.0 (Spring Framework 7, Spring Security 7, Hibernate 7, Tomcat 11 y Jackson 3). Se mantiene Gradle 8.14.
- Backend: `spring-boot-starter-web` pasa a `spring-boot-starter-webmvc`, y los tests de MockMvc usan `spring-boot-starter-webmvc-test` con el nuevo paquete de `@AutoConfigureMockMvc`.
- Backend: Jackson 3 con `spring.jackson.use-jackson2-defaults`, para que la API siga respondiendo y aceptando el mismo JSON.
- Backend: JJWT serializa con Gson (`jjwt-gson`) en lugar de Jackson 2, que deja de estar en el classpath.
- Tests: `spring-security-test` pasa a `spring-boot-starter-security-test`, que en Spring Boot 4 es el que integra `@WithMockUser` con MockMvc.
- Backend: se quita `database-platform` de `application.yml`; Hibernate 7 detecta el dialecto de MariaDB solo.
- Backend: se quitan las versiones forzadas de Tomcat, Jackson, Logback e Hibernate Validator, que Spring Boot 4 ya trae corregidas.
- Dependabot: deja de ignorar las versiones mayores de Spring Boot.

### Eliminado
- Frontend: `@angular/platform-browser-dynamic`, que solo usaba `main.ts` y sobra con el build AOT.
- Frontend: dependencias que no se usaban o estaban duplicadas, como paso previo a la migración de Angular: `@angular/material` y `@angular/cdk` (solo se cargaba su CSS `indigo-pink`), `@angular/animations` y `BrowserAnimationsModule` (no había animaciones), `@zxing/ngx-scanner` (sin uso), jQuery y el Popper suelto (ya va dentro de `bootstrap.bundle`).


### Corregido
- Los avisos en tiempo real que salen de JPA (`AvisoDeCambios`) usan el publicador del contexto de Spring que guarda el cambio, en lugar de uno estático: con varios contextos a la vez, como en los tests, el último en arrancar se quedaba con los avisos de todos.
- Al parar el backend (y al terminar los tests) el latido del tiempo real ya no consulta las sesiones mientras la base de datos se cierra: se cierran antes las conexiones abiertas, que los navegadores vuelven a abrir solos. En los tests dejaba una traza de error larga, sin hacer fallar nada.
- Las peticiones sin sesión (`401`) y los tokens caducados ya no se anotan como `ERROR` en el log del backend, sino en `DEBUG`; los tokens mal formados o con otra firma, en `WARN`. Con el SOC, cada `401` hacía saltar la alerta de errores del backend.
- La política de privacidad mostraba los asteriscos de «**acceder, rectificar...**» en lugar de la negrita.
- La confirmación de un pedido para recoger mostraba «Servicio en Local» y una mesa vacía; ahora muestra el lugar de recogida y el teléfono.
- Los precios del cliente salían con el formato inglés (€12.50) aunque la web estuviera en español; ahora 12,50 €.
- Los empleados no podían cambiar el estado de una mesa: la pantalla usaba `PUT /mesas/{id}`, que es solo del administrador, y mostraba un error. Ahora usa `PATCH /mesas/{id}/estado`.
- La pantalla de comandas no encontraba el nombre de los productos (`producto_nombre`) y pedía las líneas de cada pedido otra vez en cada recarga.
- El seguimiento del cliente vaciaba la lista si una recarga fallaba; ahora se queda la última cargada.
- El QR de las mesas llevaba a `https://barhub.duckdns.org/carta?mesa=QR001`: un dominio fijo y la etiqueta de la mesa en lugar de su id, que la carta no sabía leer. Ahora lleva a la propia web con el id, y la carta avisa si un QR no es válido.
- Al editar un producto no se guardaba el cambio de tipo (bebida, tapa...), y el formulario de alta enviaba el tipo en minúsculas, que la API no acepta.
- `GET /productos/{id}` devolvía la entidad en lugar del DTO.
- Un producto sin imagen dejaba la carta pidiendo imágenes sin parar: la imagen por defecto (`assets/images/default-food.jpg`) y la de reserva (`assets/images/default.jpg`) no existen, y el `(error)` del `<img>` volvía a poner la misma ruta en cada fallo. La página nunca terminaba de cargar y no dejaba de gastar red. Ahora se usa `assets/images/productos/default.jpg`, que sí existe, y `ponerImagenPorDefecto()` cambia la imagen una sola vez (carta, ficha y listado de productos, listado de usuarios, menú y perfil). Lo destapó el E2E nuevo, que crea productos sin imagen.
- Alta de usuarios desde el panel de administración: el formulario envía `multipart/form-data` (datos y foto) y `POST /usuarios/` solo aceptaba JSON, así que el alta fallaba. Ahora acepta el formulario como la edición, guarda la foto, comprueba que el usuario y el email no existan (400 con el motivo) y, sin roles, crea un cliente.
- Login: con credenciales incorrectas no se veía ningún aviso. `AuthService.login()` navegaba a la portada antes de enviar la petición y, al llegar el 401, el interceptor volvía a abrir un login nuevo y vacío, así que el mensaje se quedaba en el formulario anterior. Pasaba lo mismo con el aviso del bloqueo por intentos fallidos (429). Ahora el login limpia la sesión sin navegar y el interceptor no trata el 401 de `/auth/login` como una sesión caducada. Lo detectaron los tests E2E.
- Caja: no tener una caja abierta devolvía un 500 con la traza en el log cada vez que un empleado entraba en la pantalla; ahora `GET /caja/actual` responde 204 sin contenido. Abrir con otra caja abierta o cerrar sin ninguna respondía 500 y el empleado veía un mensaje genérico; ahora responde 409 con el motivo. Con tests del controlador y del servicio del frontend.
- `AuthInterceptor`: ante un 401 (sesión caducada) redirigía a `/login`, una ruta que no existe, en lugar de a `/auth/login`, y no borraba `user` del almacenamiento, de modo que `isLoggedIn()` seguía devolviendo `true`.
- `index.html`: el idioma del documento pasa de `en` a `es`, para que los lectores de pantalla lean el contenido en español, y se cierra la etiqueta `</html>`, que estaba incompleta.
- `solicitarConfirmacion`: si se cancelaba una confirmación, su acción quedaba enganchada al botón Aceptar y se ejecutaba también en la siguiente.

## [2.0.3] - 2026-11-20

### Cambiado
- Tema oscuro rehecho sobre el modo de color nativo de Bootstrap 5.3 (`data-bs-theme`) con la paleta de BarHub en variables: las reglas que pisaban a Bootstrap con `!important` se sustituyen por sus variables (tarjetas, modales, tablas, formularios, botones, utilidades e insignias). El tema claro queda idéntico, comprobado con capturas automáticas de 36 pantallas en los dos temas.
- HTML: `text-dark`, `bg-light` y `bg-white` pasan a `text-body`, `bg-body-tertiary` y `bg-body`, que dan el mismo color en tema claro y se adaptan al oscuro (salvo `text-dark` sobre fondos de color, que se mantiene).
- Estilos: las 43 `transition: all` se sustituyen por las propiedades que realmente se animan.
- Accesibilidad: los anuncios para lectores de pantalla, el contador del carrito y los avisos usan `<output>`; las insignias del modo oscuro tienen fondo opaco con contraste AA.
- Backend: campos `final` en los DTO de respuesta y en `UserDetailsImpl`; test de la limpieza de registros de `LoginAttemptService`.
- Dependencias del build: overrides con versiones parcheadas de la misma rama para `@babel/core`, `@babel/runtime`, `postcss`, `minimatch` y `ajv` (este último solo en `@angular-devkit/core`).
- Hoja de ruta: la migración a Spring Boot 4 y a Angular 22 se adelanta de la 2.2 a la 2.1, antes de las funcionalidades nuevas. README actualizado con el stack real del frontend, el estado del pipeline, la cobertura y el bloqueo del login.
- SonarCloud: la cobertura se mide solo en el backend, que es el único con informe; el análisis lleva la versión real y excluye los datos SQL de demostración.

### Corregido
- Reglas oscuras del perfil que nunca se aplicaban (`body.dark-theme` dentro de un componente encapsulado por Angular); tarjetas de tipo de vivienda en modo oscuro.
- Secciones de formularios y barras del buscador del panel de administración, que salían grises en modo oscuro.
- Dos errores de CSS en el seguimiento de pedidos (`background` anulaba a `background-color`) y selectores duplicados.
- La lupa del buscador del panel ya usa el color de contraste revisado, que antes anulaba un `!important`.

### Notas
- Quedan 129 `!important` en el código (bloque de móvil, buscador y campo de archivo del panel, comandas, entre otros). SonarCloud dejó de contarlos al retirar esa regla de su perfil; se revisarán con la migración de Angular (2.1).
- El movimiento reducido se resuelve con una regla global; los avisos por componente de SonarCloud se aceptan con ese motivo.
- El frontend no tiene cobertura de tests medida en el CI; se incorporará en la 2.1, con la migración de Angular.
- La etiqueta `v2.0.2` incluye dos actualizaciones de Dependabot fusionadas después de su cierre (`@stripe/stripe-js` menor y jQuery 4.0.0); se ha comprobado que los diálogos que usan jQuery funcionan.
- Las alertas de dependencias que quedan son de Angular 14, sin soporte, y de herramientas de compilación que exigen un salto de versión mayor (ver `SECURITY.md`). Se dejan abiertas a propósito: se cierran con la migración de la 2.1.

## [2.0.2] - 2026-11-19

### Cambiado
- Dependencias: Gradle 8.14.7, las acciones de GitHub del pipeline (checkout, setup-java, setup-node, setup-buildx, login y build-push) y el grupo de actualizaciones menores del frontend (Bootstrap, Chart.js y pdfmake, entre otras).
- El dominio de producción ya no está escrito en el código: Caddy lo lee de `SITE_ADDRESS` (por defecto `http://localhost`, sin errores de certificado en local) y el backend toma los orígenes permitidos de `CORS_ALLOWED_ORIGINS`. En producción hay que definir ambas en el `.env`.
- `.gitignore`: los `.jar` compilados de `backend/` no se versionan.
- `SECURITY.md`: nueva sección de limitaciones conocidas con el análisis de las alertas de Angular 14 (sin soporte) y su exposición real. La migración está prevista en la 2.2.
- Dependabot: se ignoran las versiones mayores de las herramientas ligadas a Angular 14 (devkit, Karma, Jasmine, RxJS, zone.js y TypeScript) hasta la migración, y se elimina una regla duplicada.
- Carta: comentario que explica por qué el mapa incrustado usa `bypassSecurityTrustResourceUrl` (origen fijo y dirección codificada).
- Backend: JaCoCo se fija en la 0.8.13 para que el wrapper de Gradle 8.14 resuelva el agente de cobertura.
- Dependabot: se ignora el salto mayor del driver `mariadb-java-client` (4.x) hasta la migración prevista en la 2.2.
- Backend: `gradle.lockfile` regenerado (JaCoCo 0.8.13 y ASM 9.8), porque el bloqueo de dependencias estaba desfasado respecto a Spring Boot.
- Frontend: `zone.js` vuelve a la 0.11.8, la rama que admite Angular 14 (una actualización automática lo había subido a la 0.16, que `npm ci` rechaza sin `--legacy-peer-deps`).
- Dependabot: se ignoran los menores de `zone.js` y los mayores de `@zxing/ngx-scanner` y `@stripe/stripe-js`.
- Documentación: el ejemplo de Caddy de `docs/infraestructura.md` refleja las cabeceras y la variable `SITE_ADDRESS` reales, y `SECURITY.md` aclara que las alertas de solo desarrollo no afectan a lo que se sirve.

## [2.0.1] - 2026-11-18

### Añadido
- Tests del backend: servicios de pedidos, caja y mesas, utilidades JWT, registro e inicio de sesión, y matriz de permisos por rol (un cliente o un empleado no accede a las rutas de administración).
- Medición de cobertura con JaCoCo y envío del informe a SonarCloud desde la pipeline.
- Ejecución de los tests del backend en la pipeline de GitHub Actions.
- Bloqueo temporal del inicio de sesión: tras 5 intentos fallidos de un mismo usuario, el acceso se bloquea 15 minutos y la API responde 429 con la cabecera `Retry-After`.
- Para cambiar la propia contraseña ahora hay que indicar la actual. Un administrador puede restablecer la de otra persona sin conocerla.
- Sección "Cambiar contraseña" en el perfil del usuario.
- `infra/docker/.env.example` con las variables necesarias para el despliegue.

### Corregido
- La validación del token JWT devuelve "no válido" ante un token con firma falsa, en lugar de propagar la excepción.
- La fecha de los pedidos se guarda en la zona horaria de Madrid, igual que la caja. Con el servidor en UTC, el cierre de caja podía sumar mal las ventas recientes.
- Formato erróneo (`&s` en lugar de `%s`) en la dirección de casa del usuario.
- El inicio de sesión distingue credenciales incorrectas, bloqueo temporal y error del servidor, en lugar de mostrar siempre el mismo mensaje.
- Se eliminan los `console.log` del login que mostraban roles e identificador en la consola del navegador.
- El estado de las mesas en administración salía vacío en modo claro y el panel mostraba 0 mesas disponibles, porque la base de datos guarda el estado en mayúsculas.
- Los botones de iniciar sesión y registrarse de la home ya no aparecen con la sesión iniciada.
- `package-lock.json` del frontend regenerado (faltaban las dependencias de zxing, y la pipeline fallaba con `npm ci`) y correcciones automáticas de `npm audit fix`.

### Cambiado
- Accesibilidad: los iconos decorativos se ocultan a los lectores de pantalla y los botones de mostrar y ocultar la contraseña tienen nombre accesible.
- Accesibilidad: los avisos emergentes, el contador del carrito, los errores del formulario de registro y los cambios de estado en seguimiento de pedidos y comandas se anuncian a los lectores de pantalla.
- Accesibilidad: los mensajes de error del perfil se asocian a su campo para que los lea el lector de pantalla, y se respeta la preferencia de movimiento reducido del sistema (se apagan animaciones y transiciones).
- Modo oscuro: contraste revisado según WCAG AA en 12 pantallas (Mis pedidos, comandas, pagos en efectivo, mesas, carta, confirmación de pedido, perfil, registro, bienvenida de administración, tablas de administración, cabecera y home). Se corrigen textos casi ilegibles, como el icono de ordenar de las tablas y el botón de contorno de la home. El marco del código QR sigue en blanco para que se pueda escanear.
- Hojas de estilo sin selectores duplicados en los estilos del modo oscuro.
- Revisión visual en claro y oscuro de las pantallas públicas y de administración: colores unificados por tipo de pedido (mesa azul, recoger ámbar, domicilio morado) y por estado de mesa (disponible verde, ocupada roja, reservada azul); insignias de administración legibles en modo oscuro y sin la losa clara en las pantallas de gestión.
- `crearPedidoSeguro` dividido en métodos más pequeños, con el mismo comportamiento.
- Llamadas `subscribe` de Angular actualizadas al formato de objeto que recomienda RxJS.
- El token de sesión caduca a las 4 horas en lugar de a las 24.
- Al caducar la sesión se borran todos los datos guardados en el navegador (token, roles y usuario), no solo el token.
- `UsuarioController.update` dividido en métodos más pequeños, con el mismo comportamiento.
- Base de datos: un único conector (MariaDB) con su URL, driver y dialecto, y se elimina el de MySQL. Las fechas con hora se interpretan en UTC.
- Compose local de la base de datos: versión de la imagen fijada, puerto solo accesible desde el propio equipo y comprobación de estado.
- Variable del usuario de la base de datos unificada como `DB_USERNAME` (antes el backend leía `DB_USER` y la documentación y Docker usaban `DB_USERNAME`). Quien arranque el backend en local debe definir `DB_USERNAME`.
- `application.yml`: el bloque de actuator estaba mal sangrado dentro de `spring`. Se mueve al nivel superior; el comportamiento no cambia (solo `health`, sin detalles).
- Se elimina `infra/mysql/import.sql`, que no usaba nada, y la mención a un `import.sql` inexistente en `infra/README.md`.

## [2.0.0] - 2026-11-15

### Añadido
- Módulo de caja: apertura y cierre de turno con arqueo y control de descuadres.
- Confirmación de pagos en efectivo en barra y mesa.
- Panel de métricas: ingresos, productos más vendidos y horas pico.
- Páginas de política de privacidad y términos y condiciones.
- Datos de demostración opcionales (`APP_SEED_DEMO`): 19 productos, 10 mesas y un administrador inicial cuya contraseña se define por variable de entorno.
- Aviso de modo demostración en el pago con tarjeta.
- Pruebas de seguridad dinámicas de la API, con sus resultados en `docs/evidencias/`.
- `Caddyfile` propio del frontend con política de caché para los bundles y reescritura de rutas de la SPA.
- Pipeline de CI/CD del frontend con GitHub Actions, SonarCloud y publicación de la imagen en Docker Hub.
- Primer análisis en SonarCloud: seguridad A, fiabilidad A y mantenibilidad A, con el Quality Gate superado sobre el código posterior a la versión 2.0.0 (`sonar.projectVersion`).
- Script de bastionado del sistema Linux (`seguridad/`).
- Documentación técnica con el modelo de datos, las auditorías y las guías de uso.

### Cambiado
- Rediseño completo de la interfaz de cliente, personal y administración.
- Contrastes de color revisados para cumplir los mínimos de WCAG.
- Backend actualizado a Spring Boot 3.5.16, con Tomcat, Jackson, Logback, Hibernate Validator y el conector de MariaDB fijados por encima del BOM por avisos de seguridad.
- Endurecimiento del pipeline y de los contenedores: acciones de GitHub fijadas por SHA, permisos mínimos del workflow, `npm ci --ignore-scripts`, `gradle.lockfile` para bloquear versiones y contenedor del frontend sin usuario root.
- Expresiones regulares de validación de correo y de nombre de imagen reescritas sin retrocesos excesivos, y navegaciones del editor de mesas marcadas como no esperadas.
- Librería JWT actualizada a jjwt 0.12.5 y adaptada a su API actual.
- Conectores de base de datos actualizados.
- Refactorización de servicios con alta complejidad (por ejemplo `PedidoServiceImpl`).
- Docker Compose: versiones de imagen fijadas, DuckDNS solo con el perfil `prod` y Stripe opcional, de modo que el proyecto arranca en local sin credenciales externas.
- El perfil valida los campos y muestra qué falta por rellenar.
- Política de privacidad y README ajustados a las funcionalidades reales.

### Seguridad
- Denegación por defecto en Spring Security (`anyRequest().denyAll()`) y `@PreAuthorize` por rol en las operaciones de escritura.
- Subida de imágenes endurecida en productos y perfiles: lista blanca de extensiones, tipo declarado, firma real del archivo, límites de tamaño, nombre aleatorio, ruta normalizada y borrado seguro.
- Respuestas de error genéricas: el detalle queda solo en el log del servidor.
- Validación de entrada con Bean Validation en los DTO.
- Acceso a datos ajenos (IDOR) con respuesta `404` uniforme y precios recalculados en el servidor.
- CORS limitado a los orígenes del frontend.
- Auditoría de dependencias con Snyk (backend y frontend) y versiones parcheadas forzadas con `overrides`.
- Auditoría de calidad con SonarQube y resolución de las incidencias de seguridad y fiabilidad.
- Dockerfiles bastionados con Trivy: ejecución con usuario no root y `HEALTHCHECK`.
- Eliminadas las trazas por consola (`printStackTrace`) y centralizado el manejo de excepciones.

### Eliminado
- Dependencia `spring-boot-starter-mail`, sin uso.
- Controlador de pruebas `TestController` y la ruta `/api/auth/**` redundante en la configuración de seguridad.
- Método sin uso de borrado automático de pedidos en el seguimiento del cliente.
- Referencias a puntos de fidelización en la política de privacidad.
- Componente de verificación de correo del frontend, sin backend que lo respalde.

### Pendiente
- Verificación de correo electrónico en el registro (hoy no se envía ni se exige).
- Verificación en servidor del pago con Stripe (hoy simulado en modo demostración).
- Límite de intentos en el login, caducidad más corta del JWT y contraseña actual al cambiarla.
- Pipeline del backend (compilación, tests y cobertura) y envío de informes de cobertura a SonarCloud.
- Avisos de accesibilidad de SonarCloud (imágenes sin texto alternativo) y revisión de la duplicación.
- Despliegue en VPS con HTTPS y SOC automático.
- Migración a Spring Boot 4 y a una versión de Angular con soporte, para corregir los avisos de dependencias que no tienen parche compatible.
