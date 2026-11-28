#!/usr/bin/env python3
"""SOC de BarHub: valida, despliega, prueba y para el perfil "soc" de Docker Compose.

    python3 seguridad/soc/soc.py validar              # configuracion con las imagenes fijadas (contenedores de usar y tirar)
    python3 seguridad/soc/soc.py comprobar            # .env, Docker y estado de la aplicacion
    python3 seguridad/soc/soc.py desplegar --aplicar  # genera alertmanager.yml y arranca Loki, Alloy, Alertmanager y Grafana
    python3 seguridad/soc/soc.py probar --aplicar     # ataque simulado y comprobacion de que llegan las alertas
    python3 seguridad/soc/soc.py estado               # contenedores, reglas cargadas y alertas activas
    python3 seguridad/soc/soc.py parar --aplicar      # para los cuatro contenedores (los datos se quedan)

Sin --aplicar, desplegar, probar y parar solo dicen lo que harian. Solo usa la biblioteca estandar.
La configuracion sale de infra/docker/.env (variables SOC_*, ver .env.example).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SOC = Path(__file__).resolve().parent
COMPOSE = RAIZ / "infra" / "docker" / "docker-compose.yml"
ENV = RAIZ / "infra" / "docker" / ".env"
LOKI_CONFIG = SOC / "loki" / "loki.yml"
REGLAS = SOC / "loki" / "reglas" / "barhub.yml"
ALLOY_CONFIG = SOC / "alloy" / "config.alloy"
ALERTMANAGER_CONFIG = SOC / "alertmanager" / "alertmanager.yml"
DATASOURCES = SOC / "grafana" / "provisioning" / "datasources" / "barhub.yml"
PANEL = SOC / "grafana" / "paneles" / "soc.json"

SERVICIOS = ("loki", "alloy", "alertmanager", "grafana")
LOKI = "http://127.0.0.1:3100"
ALERTMANAGER = "http://127.0.0.1:9093"
GRAFANA = "http://127.0.0.1:3000"
MAILPIT = "http://127.0.0.1:8025"

# Lo que provoca "probar" y las alertas que tienen que saltar
INTENTOS_LOGIN = 8
SONDEOS = 45
ALERTAS_DE_LA_PRUEBA = ("FuerzaBrutaInicioSesion", "EscaneoOAbusoDesdeUnaIp", "InfraccionCSP")


class ErrorSoc(Exception):
    """Fallo que se explica al usuario sin traza."""


# Sitios contra los que "probar" puede lanzar el ataque simulado: el propio equipo y, si esta
# definido, el dominio de BarHub del .env (SITE_ADDRESS). Nunca un sitio de otro.
SITIOS_LOCALES = ("localhost", "127.0.0.1", "::1")


def sitio_de_prueba(base: str, env: dict[str, str]) -> str:
    """La URL de --base, rehecha con piezas conocidas, o ErrorSoc si no es de BarHub.

    El esquema sale de una lista fija, el nombre del equipo de la lista de sitios permitidos (no
    de lo escrito) y el puerto es un numero: lo que se usa despues no es el texto de la linea de
    ordenes, y no se puede apuntar a otro servidor, a una ruta ni a credenciales."""
    partes = urllib.parse.urlsplit(base.strip())
    esquema = {"http": "http", "https": "https"}.get(partes.scheme.lower())
    if esquema is None:
        raise ErrorSoc(f"--base tiene que empezar por http:// o https://: {base!r}")
    if partes.username or partes.password or partes.query or partes.fragment or partes.path not in ("", "/"):
        raise ErrorSoc(f"--base es solo el sitio, sin usuario, ruta ni parametros: {base!r}")
    dominio = urllib.parse.urlsplit(env.get("SITE_ADDRESS", "") if "://" in env.get("SITE_ADDRESS", "")
                                    else "//" + env.get("SITE_ADDRESS", "")).hostname
    permitidos = SITIOS_LOCALES + ((dominio,) if dominio else ())
    equipo = next((sitio for sitio in permitidos if sitio == (partes.hostname or "").lower()), None)
    if equipo is None:
        raise ErrorSoc(f"--base solo puede ser este equipo o el dominio de SITE_ADDRESS: {partes.hostname!r}")
    try:
        puerto = partes.port
    except ValueError as e:
        raise ErrorSoc(f"--base lleva un puerto que no vale: {base!r}") from e
    nombre = f"[{equipo}]" if ":" in equipo else equipo
    return f"{esquema}://{nombre}" + (f":{int(puerto)}" if puerto else "")


# ---------------------------------------------------------------- configuracion

def leer_env(ruta: Path) -> dict[str, str]:
    """Lee un .env de Docker Compose: KEY=VALUE, comentarios con #, comillas opcionales."""
    valores: dict[str, str] = {}
    if not ruta.is_file():
        return valores
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        clave = clave.removeprefix("export ").strip()
        valor = valor.strip()
        if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "\"'":
            valor = valor[1:-1]
        valores[clave] = valor
    return valores


@dataclass(frozen=True)
class Config:
    smtp_host: str = "mailpit"
    smtp_puerto: str = "1025"
    smtp_usuario: str = ""
    smtp_clave: str = ""
    smtp_tls: bool = False
    destino: str = "soc@barhub.local"
    remitente: str = "BarHub SOC <soc@barhub.local>"
    telegram_token: str = ""
    telegram_chat: str = ""
    grafana_clave: str = ""

    @classmethod
    def desde_env(cls, env: dict[str, str]) -> Config:
        def valor(clave: str, defecto: str) -> str:
            return env.get(clave, "").strip() or defecto

        return cls(
            smtp_host=valor("SOC_SMTP_HOST", cls.smtp_host),
            smtp_puerto=valor("SOC_SMTP_PUERTO", cls.smtp_puerto),
            smtp_usuario=valor("SOC_SMTP_USUARIO", ""),
            smtp_clave=valor("SOC_SMTP_CLAVE", ""),
            smtp_tls=valor("SOC_SMTP_TLS", "false").lower() in ("1", "true", "si", "yes"),
            destino=valor("SOC_CORREO_DESTINO", cls.destino),
            remitente=valor("SOC_CORREO_REMITENTE", cls.remitente),
            telegram_token=valor("SOC_TELEGRAM_TOKEN", ""),
            telegram_chat=valor("SOC_TELEGRAM_CHAT", ""),
            grafana_clave=valor("SOC_GRAFANA_CLAVE", ""),
        )

    @property
    def usa_mailpit(self) -> bool:
        return self.smtp_host == "mailpit"

    def secretos(self) -> list[str]:
        return [s for s in (self.smtp_clave, self.telegram_token, self.grafana_clave) if s]


def errores_config(cfg: Config, para_desplegar: bool = True) -> list[str]:
    """Lo que impide desplegar con esta configuracion."""
    errores = []
    if not cfg.smtp_puerto.isdigit() or not 0 < int(cfg.smtp_puerto) < 65536:
        errores.append(f"SOC_SMTP_PUERTO no es un puerto: {cfg.smtp_puerto!r}")
    if "@" not in cfg.destino:
        errores.append(f"SOC_CORREO_DESTINO no es un correo: {cfg.destino!r}")
    if "@" not in cfg.remitente:
        errores.append(f"SOC_CORREO_REMITENTE no lleva correo: {cfg.remitente!r}")
    if bool(cfg.smtp_usuario) != bool(cfg.smtp_clave):
        errores.append("SOC_SMTP_USUARIO y SOC_SMTP_CLAVE van juntos")
    if bool(cfg.telegram_token) != bool(cfg.telegram_chat):
        errores.append("SOC_TELEGRAM_TOKEN y SOC_TELEGRAM_CHAT van juntos")
    if cfg.telegram_chat and not re.fullmatch(r"-?\d+", cfg.telegram_chat):
        errores.append("SOC_TELEGRAM_CHAT es el id numerico del chat (los grupos empiezan por -)")
    if para_desplegar and len(cfg.grafana_clave) < 12:
        errores.append("SOC_GRAFANA_CLAVE: hace falta una contrasena de al menos 12 caracteres para Grafana "
                       "(por ejemplo, openssl rand -base64 18)")
    return errores


def avisos_config(cfg: Config) -> list[str]:
    avisos = []
    if not cfg.usa_mailpit and not cfg.smtp_tls:
        avisos.append("SOC_SMTP_TLS=false con un SMTP real: la contrasena y las alertas irian sin cifrar")
    if cfg.usa_mailpit and not cfg.telegram_token:
        avisos.append("Las alertas solo llegan a Mailpit (http://localhost:8025): en produccion, SMTP real o Telegram")
    return avisos


def _y(valor: str) -> str:
    """Escalar YAML seguro: una cadena JSON es YAML valido y escapa comillas, # y dos puntos."""
    return json.dumps(valor, ensure_ascii=False)


def render_alertmanager(cfg: Config) -> str:
    """alertmanager.yml a partir de la configuracion. Lleva secretos: no se sube al repositorio."""
    lineas = [
        "# Generado por seguridad/soc/soc.py a partir de infra/docker/.env. No editar ni subir al repositorio.",
        "global:",
        f"  smtp_smarthost: {_y(cfg.smtp_host + ':' + cfg.smtp_puerto)}",
        f"  smtp_from: {_y(cfg.remitente)}",
        f"  smtp_require_tls: {'true' if cfg.smtp_tls else 'false'}",
    ]
    if cfg.smtp_usuario:
        lineas += [f"  smtp_auth_username: {_y(cfg.smtp_usuario)}",
                   f"  smtp_auth_password: {_y(cfg.smtp_clave)}"]
    lineas += [
        "",
        "route:",
        "  receiver: soc",
        "  group_by: [\"alertname\", \"ip\"]",
        "  group_wait: 30s",
        "  group_interval: 5m",
        "  repeat_interval: 4h",
        "  routes:",
        "    # Las informativas (cambios de privilegios) se repiten como mucho una vez al dia",
        "    - matchers: ['severidad=\"info\"']",
        "      repeat_interval: 24h",
        "",
        "receivers:",
        "  - name: soc",
        "    email_configs:",
        f"      - to: {_y(cfg.destino)}",
        "        send_resolved: true",
    ]
    if cfg.telegram_token:
        lineas += [
            "    telegram_configs:",
            f"      - bot_token: {_y(cfg.telegram_token)}",
            f"        chat_id: {int(cfg.telegram_chat)}",
            "        send_resolved: true",
        ]
    return "\n".join(lineas) + "\n"


def enmascarar(texto: str, cfg: Config) -> str:
    for secreto in cfg.secretos():
        texto = texto.replace(secreto, "********")
    return texto


# ---------------------------------------------------------------- ficheros del repositorio

def nombres_de_reglas(texto: str | None = None) -> list[str]:
    texto = REGLAS.read_text(encoding="utf-8") if texto is None else texto
    return re.findall(r"^\s*- alert:\s*(\S+)\s*$", texto, flags=re.MULTILINE)


def bloque_de_servicio(compose: str, servicio: str) -> str:
    """Las lineas de un servicio del docker-compose.yml (hasta el siguiente de su nivel)."""
    m = re.search(rf"^  {re.escape(servicio)}:\n(.*?)(?=^  [a-z][\w-]*:\n|^\S|\Z)", compose, flags=re.MULTILINE | re.DOTALL)
    if not m:
        raise ErrorSoc(f"El servicio {servicio} no esta en {COMPOSE.name}")
    return m.group(1)


def puertos_publicados(bloque: str) -> list[str]:
    """Los "host:contenedor" de la seccion ports de un servicio."""
    m = re.search(r"^ {4}ports:\n((?: {6}- .*\n?)+)", bloque, flags=re.MULTILINE)
    return re.findall(r'-\s*"?([^"\s]+)"?', m.group(1)) if m else []


def imagen(servicio: str, compose: str | None = None) -> str:
    compose = COMPOSE.read_text(encoding="utf-8") if compose is None else compose
    m = re.search(r"^\s+image:\s*(\S+)", bloque_de_servicio(compose, servicio), flags=re.MULTILINE)
    if not m:
        raise ErrorSoc(f"El servicio {servicio} no tiene imagen")
    return m.group(1)


def problemas_estaticos() -> list[str]:
    """Comprobaciones sin Docker: ficheros, reglas, panel y exposicion de puertos."""
    problemas = []
    for ruta in (COMPOSE, LOKI_CONFIG, REGLAS, ALLOY_CONFIG, DATASOURCES, PANEL):
        if not ruta.is_file():
            problemas.append(f"Falta {ruta.relative_to(RAIZ)}")
    if problemas:
        return problemas
    problemas += _problemas_de_reglas_y_panel()
    compose = COMPOSE.read_text(encoding="utf-8")
    for servicio in SERVICIOS:
        problemas += _problemas_del_servicio(servicio, compose)
    return problemas


def _problemas_de_reglas_y_panel() -> list[str]:
    problemas = []
    nombres = nombres_de_reglas()
    if len(nombres) != len(set(nombres)):
        problemas.append("Hay reglas de alerta con el mismo nombre")
    problemas += [f"La prueba espera la alerta {esperada}, que no esta en las reglas"
                  for esperada in ALERTAS_DE_LA_PRUEBA if esperada not in nombres]
    try:
        json.loads(PANEL.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        problemas.append(f"El panel de Grafana no es JSON valido: {e}")
    return problemas


def _problemas_del_servicio(servicio: str, compose: str) -> list[str]:
    """Perfil soc, puertos solo en 127.0.0.1, sin el socket de Docker y con la version fijada."""
    bloque = bloque_de_servicio(compose, servicio)
    problemas = []
    if 'profiles: ["soc"]' not in bloque:
        problemas.append(f"{servicio} tiene que estar solo en el perfil soc")
    problemas += [f"{servicio} publica {puerto} fuera del equipo"
                  for puerto in puertos_publicados(bloque) if not puerto.startswith("127.0.0.1:")]
    if "docker.sock" in bloque:
        problemas.append(f"{servicio} monta el socket de Docker")
    version = imagen(servicio, compose)
    if version.endswith(":latest") or ":" not in version:
        problemas.append(f"{servicio} no tiene la version de la imagen fijada")
    return problemas


# ---------------------------------------------------------------- Docker y HTTP

def ejecutar(orden: list[str], capturar: bool = True, timeout: int = 600) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(orden, capture_output=capturar, text=True, timeout=timeout, check=False)
    except FileNotFoundError as e:
        raise ErrorSoc(f"No se encuentra {orden[0]}: hace falta Docker con el plugin compose") from e
    except subprocess.TimeoutExpired as e:
        raise ErrorSoc(f"{' '.join(orden[:3])} tarda demasiado") from e


def compose(*args: str, capturar: bool = True) -> subprocess.CompletedProcess:
    return ejecutar(["docker", "compose", "-f", str(COMPOSE), "--profile", "soc", *args], capturar=capturar)


def hay_docker() -> bool:
    return shutil.which("docker") is not None and ejecutar(["docker", "info"], timeout=30).returncode == 0


def pedir(url: str, metodo: str = "GET", datos: bytes | None = None, cabeceras: dict | None = None,
          timeout: float = 10) -> tuple[int, str]:
    """(estado, cuerpo); estado 0 si no se pudo conectar."""
    peticion = urllib.request.Request(url, data=datos, method=metodo, headers=cabeceras or {})
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except OSError as e:  # URLError es un OSError: sin conexion, nombre que no existe, tiempo agotado...
        return 0, str(e)


def esperar(descripcion: str, condicion, segundos: int, cada: float = 3) -> bool:
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        if condicion():
            print(f"  [OK] {descripcion}")
            return True
        time.sleep(cada)
    print(f"  [FALLO] {descripcion} (tras {segundos} s)")
    return False


def reglas_cargadas(base: str = LOKI) -> dict[str, dict]:
    """Las reglas que Loki tiene cargadas, por nombre, con su estado de evaluacion."""
    estado, cuerpo = pedir(f"{base}/prometheus/api/v1/rules")
    if estado != 200:
        return {}
    try:
        grupos = json.loads(cuerpo)["data"]["groups"]
    except (ValueError, KeyError, TypeError):
        return {}
    return {r["name"]: r for g in grupos for r in g.get("rules", [])}


def alertas_activas() -> list[dict]:
    estado, cuerpo = pedir(f"{ALERTMANAGER}/api/v2/alerts?active=true&silenced=false&inhibited=false")
    if estado != 200:
        return []
    try:
        return json.loads(cuerpo)
    except ValueError:
        return []


def contenedor(nombre: str) -> str:
    """Estado del contenedor (running, exited...) o "no existe"."""
    r = ejecutar(["docker", "inspect", "-f", "{{.State.Status}}", nombre], timeout=30)
    return r.stdout.strip() if r.returncode == 0 else "no existe"


# ---------------------------------------------------------------- subcomandos

def validar(con_docker: bool) -> int:
    print("Comprobaciones de los ficheros")
    problemas = problemas_estaticos()
    for p in problemas:
        print(f"  [FALLO] {p}")
    if not problemas:
        print(f"  [OK] ficheros, {len(nombres_de_reglas())} reglas, panel y puertos solo en 127.0.0.1")
    if not con_docker:
        return 1 if problemas else 0
    if not hay_docker():
        raise ErrorSoc("Docker no responde (o usa --sin-docker para solo los ficheros)")

    print("Configuracion leida por las propias imagenes")
    fallos = len(problemas)
    fallos += not _validar_loki_config()
    fallos += not _validar_alertmanager()
    fallos += not _validar_alloy()
    fallos += not _validar_reglas_en_loki()
    print("Resultado:", "todo correcto" if fallos == 0 else f"{fallos} comprobaciones con fallos")
    return 1 if fallos else 0


def _informar(descripcion: str, r: subprocess.CompletedProcess) -> bool:
    if r.returncode == 0:
        print(f"  [OK] {descripcion}")
        return True
    print(f"  [FALLO] {descripcion}\n{(r.stdout + r.stderr).strip()[-2000:]}")
    return False


def _validar_loki_config() -> bool:
    r = ejecutar(["docker", "run", "--rm", "-v", f"{LOKI_CONFIG}:/etc/loki/barhub/loki.yml:ro", imagen("loki"),
                  "-config.file=/etc/loki/barhub/loki.yml", "-verify-config"])
    return _informar("loki.yml", r)


def _validar_alertmanager() -> bool:
    ok = True
    ejemplos = {
        "por defecto (Mailpit)": Config(),
        "SMTP con usuario y Telegram": Config(smtp_host="smtp.ejemplo.org", smtp_puerto="587", smtp_usuario="soc",
                                              smtp_clave='cl"a:v#e', smtp_tls=True, telegram_token="123:abc",
                                              telegram_chat="-1001"),
    }
    for nombre, cfg in ejemplos.items():
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / "alertmanager.yml"
            ruta.write_text(render_alertmanager(cfg), encoding="utf-8")
            ruta.chmod(0o644)
            Path(carpeta).chmod(0o755)
            r = ejecutar(["docker", "run", "--rm", "--entrypoint", "amtool", "-v", f"{carpeta}:/cfg:ro",
                          imagen("alertmanager"), "check-config", "/cfg/alertmanager.yml"])
            ok &= _informar(f"alertmanager.yml generado, {nombre}", r)
    return ok


def _validar_alloy() -> bool:
    r = ejecutar(["docker", "run", "--rm", "-v", f"{ALLOY_CONFIG}:/cfg/config.alloy:ro", imagen("alloy"),
                  "fmt", "/cfg/config.alloy"])
    return _informar("config.alloy", r)


def _validar_reglas_en_loki() -> bool:
    """Arranca un Loki aparte con las reglas y comprueba que las carga todas y las evalua sin error."""
    nombre = f"barhub-soc-validar-{secrets.token_hex(3)}"
    r = ejecutar(["docker", "run", "-d", "--name", nombre, "-p", "127.0.0.1::3100",
                  "-v", f"{LOKI_CONFIG}:/etc/loki/barhub/loki.yml:ro",
                  "-v", f"{REGLAS.parent}:/etc/loki/reglas/fake:ro",
                  imagen("loki"), "-config.file=/etc/loki/barhub/loki.yml"])
    if not _informar("Loki de prueba arrancado", r):
        return False
    try:
        puerto = ejecutar(["docker", "port", nombre, "3100/tcp"]).stdout.strip().splitlines()[0].rsplit(":", 1)[1]
        base = f"http://127.0.0.1:{puerto}"
        esperadas = set(nombres_de_reglas())
        if not esperar("Loki listo", lambda: pedir(f"{base}/ready")[0] == 200, 120):
            return False
        if not esperar(f"las {len(esperadas)} reglas cargadas", lambda: set(reglas_cargadas(base)) == esperadas, 150):
            print(f"    cargadas: {sorted(reglas_cargadas(base))}")
            print(ejecutar(["docker", "logs", "--tail", "40", nombre]).stderr[-3000:])
            return False

        def evaluadas() -> bool:
            return all(r.get("health") in ("ok", "err") for r in reglas_cargadas(base).values())

        esperar("todas evaluadas al menos una vez", evaluadas, 150, cada=5)
        con_error = {n: r.get("lastError") for n, r in reglas_cargadas(base).items() if r.get("health") == "err"}
        for n, error in con_error.items():
            print(f"  [FALLO] la regla {n} no se puede evaluar: {error}")
        if not con_error:
            print("  [OK] ninguna regla da error al evaluarse")
        return not con_error
    finally:
        ejecutar(["docker", "rm", "-f", nombre], timeout=60)


def comprobar(cfg: Config, para_desplegar: bool = True) -> int:
    print("Ficheros del SOC")
    problemas = problemas_estaticos()
    for p in problemas:
        print(f"  [FALLO] {p}")
    if not problemas:
        print(f"  [OK] {len(nombres_de_reglas())} reglas, panel y puertos solo en 127.0.0.1")
    print(f"Configuracion ({ENV.relative_to(RAIZ)})")
    if not ENV.is_file():
        problemas.append("falta el .env")
        print(f"  [FALLO] no existe {ENV.relative_to(RAIZ)} (copia .env.example)")
    errores = errores_config(cfg, para_desplegar)
    for e in errores:
        print(f"  [FALLO] {e}")
    for a in avisos_config(cfg):
        print(f"  [AVISO] {a}")
    canales = ["correo a " + cfg.destino + (" (Mailpit)" if cfg.usa_mailpit else f" por {cfg.smtp_host}")]
    if cfg.telegram_token:
        canales.append("Telegram")
    print(f"  Alertas por: {', '.join(canales)}")
    print("Docker y aplicacion")
    if not hay_docker():
        print("  [FALLO] Docker no responde")
        return 1
    for nombre in ("barhub-backend", "barhub-caddy"):
        estado = contenedor(nombre)
        print(f"  [{'OK' if estado == 'running' else 'AVISO'}] {nombre}: {estado}")
    montajes = ejecutar(["docker", "inspect", "-f", "{{range .Mounts}}{{.Destination}} {{end}}", "barhub-backend"]).stdout
    if contenedor("barhub-backend") != "no existe" and "/var/log/barhub" not in montajes:
        print("  [AVISO] el backend no escribe aun el log del SOC: cd ~/BarHub2.0/infra/docker && docker compose up -d --build")
    return 1 if problemas or errores else 0


def desplegar(cfg: Config, aplicar: bool) -> int:
    if comprobar(cfg) != 0:
        raise ErrorSoc("Corrige lo marcado como FALLO antes de desplegar")
    contenido = render_alertmanager(cfg)
    print(f"\nalertmanager.yml ({ALERTMANAGER_CONFIG.relative_to(RAIZ)}):")
    print("    " + enmascarar(contenido, cfg).replace("\n", "\n    ").rstrip())
    if not aplicar:
        print("[simulacion] escribiria alertmanager.yml y arrancaria:", ", ".join(SERVICIOS))
        print("Repite con --aplicar para hacerlo.")
        return 0
    ALERTMANAGER_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    ALERTMANAGER_CONFIG.write_text(contenido, encoding="utf-8")
    ALERTMANAGER_CONFIG.chmod(0o644)  # el contenedor lee como "nobody"; el fichero no sale del servidor
    print("Arrancando el SOC")
    r = compose("up", "-d", *SERVICIOS, capturar=False)
    if r.returncode != 0:
        raise ErrorSoc("docker compose no ha podido arrancar el SOC")
    # Si ya estaba arrancado, Alertmanager relee la configuracion nueva
    pedir(f"{ALERTMANAGER}/-/reload", metodo="POST", datos=b"")
    ok = all([
        esperar("Loki listo", lambda: pedir(f"{LOKI}/ready")[0] == 200, 180),
        esperar("Alertmanager listo", lambda: pedir(f"{ALERTMANAGER}/-/ready")[0] == 200, 90),
        esperar("Grafana listo", lambda: pedir(f"{GRAFANA}/api/health")[0] == 200, 120),
        esperar("Alloy en marcha", lambda: contenedor("barhub-alloy") == "running", 60),
        esperar(f"{len(nombres_de_reglas())} reglas de alerta cargadas",
                lambda: set(reglas_cargadas()) == set(nombres_de_reglas()), 150, cada=5),
    ])
    print("\nPanel del SOC: http://127.0.0.1:3000 (usuario SOC_GRAFANA_USUARIO, admin por defecto)")
    print("Alertas: http://127.0.0.1:9093   Correos de prueba: http://127.0.0.1:8025")
    print("En el servidor, desde tu equipo: ssh -p 22022 -L 3000:127.0.0.1:3000 -L 9093:127.0.0.1:9093 usuario@servidor")
    return 0 if ok else 1


def probar(cfg: Config, aplicar: bool, base: str, espera: int, espera_previa: int = 900) -> int:
    api = base.rstrip("/") + "/api"
    usuario = f"soc_prueba_{secrets.token_hex(3)}"
    print("Ataque simulado contra", base)
    print(f"  1. {INTENTOS_LOGIN} inicios de sesion fallidos de {usuario} (no existe) -> FuerzaBrutaInicioSesion")
    print(f"  2. {SONDEOS} peticiones a rutas que no existen (/api/soc-sondeo/...) -> EscaneoOAbusoDesdeUnaIp")
    print("  3. un aviso de la CSP inventado -> InfraccionCSP")
    print(f"  Suma {INTENTOS_LOGIN} fallos al contador de tu IP en el backend (la bloquea 15 min a los 20).")
    if not aplicar:
        print("[simulacion] no se ha enviado nada. Repite con --aplicar.")
        return 0
    if pedir(f"{LOKI}/ready")[0] != 200 or pedir(f"{ALERTMANAGER}/-/ready")[0] != 200:
        raise ErrorSoc("El SOC no esta arrancado: python3 seguridad/soc/soc.py desplegar --aplicar")
    _esperar_a_que_se_resuelvan(cfg, espera_previa)
    inicio = time.time()
    _lanzar_ataque(api, usuario)
    print(f"Esperando las alertas (Loki evalua cada minuto; hasta {espera} s)")
    ok = _esperar_alertas(espera, inicio)
    if cfg.usa_mailpit:
        ok &= _esperar_correos(inicio)
    else:
        print("  Las alertas van a un SMTP real: mira el buzon de", cfg.destino)
    print("Las alertas se resuelven solas cuando pasa su ventana (5-10 min) y llega el correo de resueltas.")
    return 0 if ok else 1


def activas_de_la_prueba() -> set[str]:
    return {a.get("labels", {}).get("alertname") for a in alertas_activas()} & set(ALERTAS_DE_LA_PRUEBA)


def _esperar_a_que_se_resuelvan(cfg: Config, maximo: int) -> None:
    """Si siguen activas las alertas de una prueba anterior, la nueva no demostraria nada: ya estarian
    en Alertmanager, y este no repite el correo de una alerta de la que ya aviso hasta que se resuelve
    (o pasa repeat_interval, 4 h). Se espera a que se resuelvan y, con Mailpit, al correo de resueltas."""
    previas = activas_de_la_prueba()
    if not previas:
        return
    print(f"Siguen activas las alertas de una prueba anterior: {', '.join(sorted(previas))}")
    print("  Se espera a que se resuelvan (5-10 min desde esa prueba) para que esta compruebe alertas y correos nuevos.")
    if not esperar("alertas anteriores resueltas", lambda: not activas_de_la_prueba(), maximo, cada=15):
        raise ErrorSoc("Siguen activas. Repite cuando python3 seguridad/soc/soc.py estado ya no las muestre")
    if cfg.usa_mailpit:
        # Alertmanager envia el correo de resueltas en su siguiente vuelta (group_interval, 5 min)
        esperar("correos de resueltas en Mailpit",
                lambda: all(ultimo_aviso(correos_mailpit(), n) != "FIRING" for n in previas), 330, cada=15)


def tipo_de_aviso(asunto: str, alerta: str) -> str | None:
    """FIRING o RESOLVED si el asunto es el que pone Alertmanager para esa alerta; None si no lo es."""
    m = re.match(r"\[(FIRING|RESOLVED)(?::\d+)?\]\s+(\S+)", asunto)
    return m.group(1) if m and m.group(2) == alerta else None


def correos_mailpit() -> list[tuple[float, str]]:
    """(fecha, asunto) de los ultimos correos de Mailpit."""
    estado, cuerpo = pedir(f"{MAILPIT}/api/v1/messages?limit=200")
    if estado != 200:
        return []
    try:
        return [(_fecha_mailpit(m.get("Created", "")), m.get("Subject", "")) for m in json.loads(cuerpo).get("messages", [])]
    except (ValueError, AttributeError):
        return []


def ultimo_aviso(correos: list[tuple[float, str]], alerta: str) -> str | None:
    """El tipo del correo mas reciente de esa alerta (FIRING, RESOLVED o None si no hay)."""
    avisos = sorted((fecha, tipo) for fecha, asunto in correos if (tipo := tipo_de_aviso(asunto, alerta)))
    return avisos[-1][1] if avisos else None


def _lanzar_ataque(api: str, usuario: str) -> None:
    estados = []
    for _ in range(INTENTOS_LOGIN):
        cuerpo = json.dumps({"username": usuario, "password": secrets.token_urlsafe(12)}).encode()
        estados.append(pedir(f"{api}/auth/login", "POST", cuerpo, {"Content-Type": "application/json"})[0])
    print(f"  [{'OK' if all(e in (401, 429) for e in estados) else 'AVISO'}] logins: {sorted(set(estados))}")
    sondeos = [pedir(f"{api}/soc-sondeo/{n}")[0] for n in range(SONDEOS)]
    print(f"  [{'OK' if all(400 <= e < 500 for e in sondeos) else 'AVISO'}] sondeos: {sorted(set(sondeos))}")
    informe = {"csp-report": {"document-uri": api.removesuffix("/api") + "/soc-prueba",
                              "effective-directive": "script-src-elem",
                              "blocked-uri": "https://soc-prueba.invalid/x.js", "disposition": "report"}}
    estado = pedir(f"{api}/csp-informe", "POST", json.dumps(informe).encode(), {"Content-Type": "application/csp-report"})[0]
    print(f"  [{'OK' if estado == 204 else 'AVISO'}] aviso de la CSP: {estado}")


def _lineas_en_loki(consulta: str, desde: float) -> int:
    parametros = urllib.parse.urlencode({"query": consulta, "start": str(int(desde * 1e9)), "limit": "500"})
    estado, cuerpo = pedir(f"{LOKI}/loki/api/v1/query_range?{parametros}")
    if estado != 200:
        return 0
    try:
        return sum(len(s["values"]) for s in json.loads(cuerpo)["data"]["result"])
    except (ValueError, KeyError, TypeError):
        return 0


def _esperar_alertas(espera: int, inicio: float) -> bool:
    pendientes = set(ALERTAS_DE_LA_PRUEBA)
    limite = time.monotonic() + espera
    while pendientes and time.monotonic() < limite:
        activas = {a.get("labels", {}).get("alertname") for a in alertas_activas()}
        for nombre in sorted(pendientes & activas):
            print(f"  [OK] alerta {nombre} activa en Alertmanager ({int(time.time() - inicio)} s)")
        pendientes -= activas
        if pendientes:
            time.sleep(10)
    if not pendientes:
        return True
    for nombre in sorted(pendientes):
        print(f"  [FALLO] la alerta {nombre} no ha llegado a Alertmanager")
    # Para saber si falla la recogida de logs o la regla
    backend = _lineas_en_loki('{servicio="backend"} |= "evento=auditoria"', inicio)
    caddy = _lineas_en_loki('{servicio="caddy"}', inicio)
    print(f"  Lineas recibidas en Loki desde el inicio: backend (auditoria) {backend}, caddy {caddy}")
    if backend == 0 or caddy == 0:
        print("  Sin lineas: revisa docker logs barhub-alloy y que el backend se haya reconstruido con el log del SOC")
    return False


def _esperar_correos(inicio: float) -> bool:
    def llego(alerta: str) -> bool:
        return any(fecha >= inicio - 5 and tipo_de_aviso(asunto, alerta) == "FIRING" for fecha, asunto in correos_mailpit())

    llegados = []
    for nombre in ALERTAS_DE_LA_PRUEBA:
        if esperar(f"correo de {nombre} en Mailpit", lambda n=nombre: llego(n), 120, cada=5):
            llegados.append(True)
        elif ultimo_aviso(correos_mailpit(), nombre) == "FIRING":
            # Ya aviso antes y no llego a mandar el de resueltas (por ejemplo, si se reinicio a la vez que
            # Loki): Alertmanager no repite el correo hasta repeat_interval. La alerta si esta activa.
            print(f"  [AVISO] Alertmanager ya habia avisado de {nombre} y no la ha dado por resuelta: no repite el "
                  "correo hasta que se resuelva o pasen 4 h. Repite la prueba cuando llegue el de resueltas")
            llegados.append(True)
        else:
            llegados.append(False)
    return all(llegados)


def _fecha_mailpit(texto: str) -> float:
    """Mailpit da la fecha en RFC 3339 con fracciones de segundo; 0 si no se entiende."""
    texto = re.sub(r"\.(\d+)", lambda m: "." + (m.group(1) + "000000")[:6], texto.replace("Z", "+00:00"), count=1)
    try:
        return datetime.fromisoformat(texto).timestamp()
    except ValueError:
        return 0.0


def estado() -> int:
    print("Contenedores")
    for servicio in SERVICIOS:
        print(f"  barhub-{servicio}: {contenedor('barhub-' + servicio)}")
    reglas = reglas_cargadas()
    print(f"Reglas cargadas en Loki: {len(reglas)} de {len(nombres_de_reglas())}")
    for nombre, regla in sorted(reglas.items()):
        error = f" ({regla.get('lastError')})" if regla.get("health") == "err" else ""
        print(f"  {nombre}: {regla.get('state', '?')}, {regla.get('health', '?')}{error}")
    activas = alertas_activas()
    print(f"Alertas activas: {len(activas)}")
    for a in activas:
        etiquetas = a.get("labels", {})
        print(f"  {etiquetas.get('alertname')} [{etiquetas.get('severidad', '-')}] {a.get('annotations', {}).get('summary', '')}")
    return 0


def parar(aplicar: bool) -> int:
    if not aplicar:
        print("[simulacion] pararia:", ", ".join(SERVICIOS), "(los datos de Loki y Grafana se quedan). Repite con --aplicar.")
        return 0
    return compose("stop", *SERVICIOS, capturar=False).returncode


# ---------------------------------------------------------------- entrada

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="SOC de BarHub (perfil soc de Docker Compose)",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    sub = ap.add_subparsers(dest="orden", required=True)
    v = sub.add_parser("validar", help="configuracion con las imagenes fijadas")
    v.add_argument("--sin-docker", action="store_true", help="solo los ficheros")
    sub.add_parser("comprobar", help=".env, Docker y aplicacion")
    for nombre, ayuda in (("desplegar", "genera la configuracion y arranca el SOC"),
                          ("probar", "ataque simulado y comprobacion de las alertas"),
                          ("parar", "para el SOC")):
        p = sub.add_parser(nombre, help=ayuda)
        p.add_argument("--aplicar", action="store_true", help="hacerlo de verdad (sin esto, solo lo cuenta)")
        if nombre == "probar":
            p.add_argument("--base", default="http://localhost", help="URL del sitio (Caddy)")
            p.add_argument("--espera", type=int, default=300, help="segundos maximos esperando las alertas")
            p.add_argument("--espera-previa", type=int, default=900,
                           help="segundos maximos esperando a que se resuelvan las de una prueba anterior")
    sub.add_parser("estado", help="contenedores, reglas y alertas activas")
    args = ap.parse_args(argv)

    cfg = Config.desde_env({**leer_env(ENV), **{k: v for k, v in os.environ.items() if k.startswith("SOC_")}})
    try:
        if args.orden == "validar":
            return validar(not args.sin_docker)
        if args.orden == "comprobar":
            return comprobar(cfg)
        if args.orden == "desplegar":
            return desplegar(cfg, args.aplicar)
        if args.orden == "probar":
            base = sitio_de_prueba(args.base, leer_env(ENV))
            return probar(cfg, args.aplicar, base, args.espera, args.espera_previa)
        if args.orden == "estado":
            return estado()
        return parar(args.aplicar)
    except ErrorSoc as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
