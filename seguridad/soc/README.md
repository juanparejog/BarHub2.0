# SOC de BarHub

Detección y alertas de la aplicación, sobre el perfil `soc` de Docker Compose ([`infra/docker/docker-compose.yml`](../../infra/docker/docker-compose.yml)). Qué detecta, cómo se despliega y qué datos guarda: [`docs/seguridad.md`](../../docs/seguridad.md#5-soc-detección-y-alertas).

| Ruta | Contenido |
| :--- | :--- |
| `soc.py` | Valida, comprueba, despliega, prueba, muestra el estado y para el SOC. Lo que cambia algo solo se hace con `--aplicar` |
| `test_soc.py` | Tests de `soc.py` y de la configuración, sin Docker ni red |
| `loki/loki.yml` | Loki de un solo nodo: 30 días de logs y evaluación de las reglas cada minuto |
| `loki/reglas/barhub.yml` | Las 8 reglas de alerta (LogQL) |
| `alloy/config.alloy` | Recogida del log de acceso de Caddy y del log en JSON del backend |
| `grafana/` | Fuentes de datos y panel *BarHub - SOC* |
| `alertmanager/` | `alertmanager.yml`, que genera `soc.py` desde el `.env` (no se versiona: lleva claves) |

```bash
python3 seguridad/soc/soc.py validar
python3 seguridad/soc/soc.py comprobar
python3 seguridad/soc/soc.py desplegar --aplicar
python3 seguridad/soc/soc.py probar --aplicar
python3 seguridad/soc/soc.py estado
python3 -m unittest discover -s seguridad/soc -p "test_*.py" -v
```
