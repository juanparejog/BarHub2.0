# Seguridad

Herramientas de seguridad de BarHub 2.0 que no forman parte de la aplicación. La documentación de conjunto (prácticas, modelo de amenazas, pruebas y limitaciones) está en [`docs/seguridad.md`](../docs/seguridad.md).

| Carpeta | Qué es |
| :--- | :--- |
| [`hardening/`](hardening) | Bastionado del servidor Linux (`hardening-linux.py`): SSH, contraseñas, servicios, `auditd`, `aide` y cortafuegos |
| [`soc/`](soc) | SOC de la aplicación: Alloy recoge los logs de Caddy y del backend, Loki los guarda y evalúa las reglas de alerta, Alertmanager avisa por correo o Telegram y Grafana los muestra. `soc.py` lo valida, despliega y prueba |
