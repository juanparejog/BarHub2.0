# Evidencia: pruebas de escalada de privilegios

Resultado de las pruebas automáticas de `EscaladaPrivilegiosTest` (backend, base de datos H2 en memoria, seguridad de Spring real).
Cada caso comprueba la respuesta HTTP y, además, lo que queda guardado en la base de datos tras la petición.

| Caso | Quién | Petición | Respuesta esperada | Estado guardado |
|---|---|---|---|---|
| Darse el rol de administrador | Cliente | `PUT /usuarios/{su id}` con el rol ADMIN en el cuerpo | 200 (se ignora el campo) | Sigue con el rol de cliente, sin ADMIN |
| Cambiar su nombre de usuario | Cliente | `PUT /usuarios/{su id}` con otro `username` | 200 (se ignora el campo) | El `username` no cambia |
| Cambiar datos personales | Cliente | `PUT /usuarios/{su id}` con otro nombre | 200 | El nombre sí cambia (la prueba confirma que la edición normal funciona) |
| Editar a otra persona | Cliente | `PUT /usuarios/{id ajeno}` con el rol ADMIN | 404 | Nombre y roles del otro usuario intactos |
| Listar o borrar usuarios | Cliente | `GET /usuarios` y `DELETE /usuarios/{id}` | 403 en ambos | El usuario sigue existiendo |
| Control positivo | Administrador | `PUT /usuarios/{id}` con el rol ADMIN | 200 | El rol sí se asigna |

El caso de control demuestra que los rechazos anteriores se deben a la comprobación de permisos y no a que la petición estuviera mal formada.

## Cómo reproducirlo

```bash
cd backend
./gradlew test --tests '*EscaladaPrivilegiosTest'
```

El informe queda en `backend/build/reports/tests/test/index.html`.

## Dónde se aplica cada regla

- Rutas de administración (`GET`, `DELETE`): `@PreAuthorize("hasRole('ADMIN')")` y reglas de `SecurityConfig` (también cubiertas en `SeguridadRutasTest`).
- Editar un usuario ajeno: `puedeAccederA` en `UsuarioController` (solo un administrador o el propio usuario).
- Cambiar `username` y roles: solo se aplican si `esAdmin(auth)`; si no, se ignoran.

## Límites de esta evidencia

- La sesión se simula con Spring Security Test; el flujo real con token JWT está cubierto aparte en `AuthIntegrationTest`.
- Los tokens no se pueden revocar antes de que caduquen (4 horas). Es una limitación conocida y documentada.
