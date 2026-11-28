"""Tests de soc.py y de la configuracion del SOC, sin Docker ni red.

    python3 -m unittest discover -s seguridad/soc -p "test_*.py" -v
"""

import importlib.util
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

_ruta = Path(__file__).with_name("soc.py")
_spec = importlib.util.spec_from_file_location("soc", _ruta)
soc = importlib.util.module_from_spec(_spec)
sys.modules["soc"] = soc
_spec.loader.exec_module(soc)

COMPOSE = soc.COMPOSE.read_text(encoding="utf-8")
REGLAS = soc.REGLAS.read_text(encoding="utf-8")


class LecturaDelEnv(unittest.TestCase):

    def test_lee_claves_comentarios_comillas_y_valores_con_igual(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = Path(carpeta) / ".env"
            ruta.write_text("# comentario\n\nSOC_SMTP_HOST=smtp.ejemplo.org\nexport SOC_SMTP_CLAVE='a=b c'\n"
                            'SOC_CORREO_DESTINO="yo@ejemplo.org"\nSIN_IGUAL\n', encoding="utf-8")
            env = soc.leer_env(ruta)
        self.assertEqual(env, {"SOC_SMTP_HOST": "smtp.ejemplo.org", "SOC_SMTP_CLAVE": "a=b c",
                               "SOC_CORREO_DESTINO": "yo@ejemplo.org"})

    def test_sin_env_no_falla(self):
        self.assertEqual(soc.leer_env(Path("/no/existe/.env")), {})

    def test_los_valores_vacios_toman_el_de_por_defecto(self):
        cfg = soc.Config.desde_env({"SOC_SMTP_HOST": "", "SOC_SMTP_TLS": "true"})
        self.assertEqual(cfg.smtp_host, "mailpit")
        self.assertTrue(cfg.usa_mailpit)
        self.assertTrue(cfg.smtp_tls)


class ValidacionDeLaConfiguracion(unittest.TestCase):

    def test_la_de_por_defecto_solo_pide_la_clave_de_grafana(self):
        self.assertEqual(soc.errores_config(soc.Config(), para_desplegar=False), [])
        errores = soc.errores_config(soc.Config())
        self.assertEqual(len(errores), 1)
        self.assertIn("SOC_GRAFANA_CLAVE", errores[0])
        self.assertEqual(soc.errores_config(soc.Config(grafana_clave="x" * 12)), [])

    def test_detecta_valores_incoherentes(self):
        cfg = soc.Config(smtp_puerto="smtp", destino="nadie", smtp_usuario="soc", telegram_token="1:x",
                         telegram_chat="@canal", grafana_clave="x" * 12)
        errores = " | ".join(soc.errores_config(cfg))
        for esperado in ("SOC_SMTP_PUERTO", "SOC_CORREO_DESTINO", "SOC_SMTP_USUARIO y SOC_SMTP_CLAVE",
                         "SOC_TELEGRAM_CHAT es el id"):
            self.assertIn(esperado, errores)

    def test_avisa_de_un_smtp_real_sin_tls(self):
        avisos = soc.avisos_config(soc.Config(smtp_host="smtp.ejemplo.org", smtp_tls=False))
        self.assertTrue(any("sin cifrar" in a for a in avisos))


class ConfiguracionDeAlertmanager(unittest.TestCase):

    def test_por_defecto_va_a_mailpit_sin_tls_ni_autenticacion_ni_telegram(self):
        texto = soc.render_alertmanager(soc.Config())
        self.assertIn('smtp_smarthost: "mailpit:1025"', texto)
        self.assertIn("smtp_require_tls: false", texto)
        self.assertIn('- to: "soc@barhub.local"', texto)
        self.assertNotIn("smtp_auth", texto)
        self.assertNotIn("telegram", texto)
        self.assertTrue(texto.endswith("\n") and not texto.endswith("\n\n"))

    def test_los_secretos_quedan_escapados_y_el_chat_es_un_numero(self):
        cfg = soc.Config(smtp_host="smtp.ejemplo.org", smtp_puerto="587", smtp_usuario="soc",
                         smtp_clave='cl"a:v#e', smtp_tls=True, telegram_token="123:abc", telegram_chat="-1001")
        texto = soc.render_alertmanager(cfg)
        self.assertIn('smtp_auth_password: "cl\\"a:v#e"', texto)
        self.assertIn("smtp_require_tls: true", texto)
        self.assertIn("chat_id: -1001", texto)
        self.assertIn('bot_token: "123:abc"', texto)

    def test_cada_valor_es_una_cadena_json_en_una_sola_linea(self):
        cfg = soc.Config(remitente="SOC <soc@x.org>\nbcc: otro@x.org")
        linea = next(l for l in soc.render_alertmanager(cfg).splitlines() if "smtp_from" in l)
        self.assertEqual(json.loads(linea.split(": ", 1)[1]), cfg.remitente)

    def test_la_simulacion_no_ensena_los_secretos(self):
        cfg = soc.Config(smtp_usuario="soc", smtp_clave="clave-smtp", telegram_token="999:token", telegram_chat="5",
                         grafana_clave="clave-grafana-larga")
        texto = soc.enmascarar(soc.render_alertmanager(cfg), cfg)
        for secreto in cfg.secretos():
            self.assertNotIn(secreto, texto)
        self.assertIn("********", texto)


class ReglasDeAlerta(unittest.TestCase):

    def bloques(self):
        return re.split(r"^\s*- alert:", REGLAS, flags=re.MULTILINE)[1:]

    def test_hay_reglas_con_nombre_unico_y_estan_las_de_la_prueba(self):
        nombres = soc.nombres_de_reglas()
        self.assertGreaterEqual(len(nombres), 8)
        self.assertEqual(len(nombres), len(set(nombres)))
        for esperada in soc.ALERTAS_DE_LA_PRUEBA:
            self.assertIn(esperada, nombres)

    def test_cada_regla_tiene_severidad_resumen_y_descripcion(self):
        for bloque in self.bloques():
            nombre = bloque.split()[0]
            self.assertRegex(bloque, r"severidad: (alta|media|baja|info)\b", nombre)
            self.assertIn("summary:", bloque, nombre)
            self.assertIn("description:", bloque, nombre)
            self.assertIn("expr:", bloque, nombre)

    def test_las_consultas_usan_las_etiquetas_que_pone_alloy(self):
        alloy = soc.ALLOY_CONFIG.read_text(encoding="utf-8")
        for servicio in re.findall(r'servicio="(\w+)"', REGLAS):
            self.assertIn(f'"servicio" = "{servicio}"', alloy)
        # La linea de auditoria del backend es la que escribe AuditoriaService.lineaDelSoc
        self.assertIn('|= "evento=auditoria" | logfmt', REGLAS)

    def test_la_prueba_supera_los_umbrales_de_sus_alertas(self):
        fuerza = re.search(r"FuerzaBrutaInicioSesion.*?>= (\d+)", REGLAS, re.DOTALL)
        escaneo = re.search(r"EscaneoOAbusoDesdeUnaIp.*?>= (\d+)\n", REGLAS, re.DOTALL)
        self.assertGreaterEqual(soc.INTENTOS_LOGIN, int(fuerza.group(1)))
        self.assertGreaterEqual(soc.SONDEOS, int(escaneo.group(1)))
        # Sin pasar del bloqueo por IP del backend (20 fallos en 15 minutos)
        self.assertLess(soc.INTENTOS_LOGIN, 20)


class PanelDeGrafana(unittest.TestCase):

    def test_es_json_y_todas_las_consultas_van_a_loki(self):
        panel = json.loads(soc.PANEL.read_text(encoding="utf-8"))
        fuentes = soc.DATASOURCES.read_text(encoding="utf-8")
        self.assertEqual(panel["uid"], "barhub-soc")
        for p in panel["panels"]:
            self.assertIn(f"uid: {p['datasource']['uid']}", fuentes, p["title"])
            for objetivo in p["targets"]:
                self.assertIn("servicio=", objetivo["expr"], p["title"])

    def test_los_paneles_no_se_solapan(self):
        ocupadas = set()
        for p in json.loads(soc.PANEL.read_text(encoding="utf-8"))["panels"]:
            g = p["gridPos"]
            self.assertLessEqual(g["x"] + g["w"], 24, p["title"])
            celdas = {(x, y) for x in range(g["x"], g["x"] + g["w"]) for y in range(g["y"], g["y"] + g["h"])}
            self.assertFalse(ocupadas & celdas, p["title"])
            ocupadas |= celdas


class DockerCompose(unittest.TestCase):

    def test_los_ficheros_y_los_servicios_del_soc_estan_bien(self):
        self.assertEqual(soc.problemas_estaticos(), [])

    def test_ningun_puerto_del_soc_sale_del_equipo(self):
        for servicio in soc.SERVICIOS:
            for puerto in soc.puertos_publicados(soc.bloque_de_servicio(COMPOSE, servicio)):
                self.assertTrue(puerto.startswith("127.0.0.1:"), f"{servicio}: {puerto}")

    def test_detecta_un_puerto_publicado_a_todos(self):
        bloque = '    image: x:1\n    ports:\n      - "3000:3000"\n      - "127.0.0.1:9093:9093"\n    volumes:\n'
        self.assertEqual(soc.puertos_publicados(bloque), ["3000:3000", "127.0.0.1:9093:9093"])

    def test_alloy_lee_los_logs_en_modo_lectura_sin_capacidades_ni_docker(self):
        alloy = soc.bloque_de_servicio(COMPOSE, "alloy")
        self.assertIn("caddy_logs:/var/log/caddy:ro", alloy)
        self.assertIn("backend_logs:/var/log/barhub:ro", alloy)
        self.assertIn('cap_drop: ["ALL"]', alloy)
        self.assertNotIn("ports:", alloy)
        self.assertNotIn("docker.sock", COMPOSE)

    def test_el_backend_escribe_el_log_que_lee_alloy(self):
        backend = soc.bloque_de_servicio(COMPOSE, "backend")
        self.assertIn("LOGGING_FILE_NAME=/var/log/barhub/backend.log", backend)
        self.assertIn("LOGGING_STRUCTURED_FORMAT_FILE=logstash", backend)
        self.assertIn("/var/log/barhub/backend.log", soc.ALLOY_CONFIG.read_text(encoding="utf-8"))

    def test_las_imagenes_del_soc_tienen_version(self):
        for servicio in soc.SERVICIOS:
            self.assertRegex(soc.imagen(servicio, COMPOSE), r":v?\d+\.\d+\.\d+$", servicio)

    def test_la_configuracion_generada_no_se_sube(self):
        ignorados = (soc.RAIZ / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("seguridad/soc/alertmanager/alertmanager.yml", ignorados)


class Utilidades(unittest.TestCase):

    def test_fecha_de_mailpit(self):
        self.assertEqual(soc._fecha_mailpit("2026-11-27T10:00:00.123456789Z"), 1795773600.123456)
        self.assertEqual(soc._fecha_mailpit("2026-11-27T11:00:00.5+01:00"), 1795773600.5)
        self.assertEqual(soc._fecha_mailpit("no es una fecha"), 0.0)

    def test_reconoce_los_asuntos_de_alertmanager(self):
        self.assertEqual(soc.tipo_de_aviso("[FIRING:1] InfraccionCSP ", "InfraccionCSP"), "FIRING")
        self.assertEqual(soc.tipo_de_aviso("[RESOLVED] EscaneoOAbusoDesdeUnaIp 172.18.0.1", "EscaneoOAbusoDesdeUnaIp"), "RESOLVED")
        self.assertIsNone(soc.tipo_de_aviso("[FIRING:1] InfraccionCSPx", "InfraccionCSP"))
        self.assertIsNone(soc.tipo_de_aviso("Confirma tu cuenta de BarHub", "InfraccionCSP"))

    def test_el_ultimo_aviso_de_una_alerta_es_el_mas_reciente(self):
        correos = [(30.0, "[RESOLVED] InfraccionCSP "), (10.0, "[FIRING:1] InfraccionCSP "),
                   (40.0, "[FIRING:1] EscaneoOAbusoDesdeUnaIp 172.18.0.1"), (50.0, "Otro correo")]
        self.assertEqual(soc.ultimo_aviso(correos, "InfraccionCSP"), "RESOLVED")
        self.assertEqual(soc.ultimo_aviso(correos, "EscaneoOAbusoDesdeUnaIp"), "FIRING")
        self.assertIsNone(soc.ultimo_aviso(correos, "FuerzaBrutaInicioSesion"))

    def test_las_ordenes_que_escriben_solo_simulan_sin_aplicar(self):
        llamadas = []
        originales = soc.ejecutar, soc.pedir
        soc.ejecutar = lambda *a, **k: llamadas.append(a)
        soc.pedir = lambda *a, **k: llamadas.append(a) or (0, "")
        try:
            self.assertEqual(soc.parar(aplicar=False), 0)
            self.assertEqual(soc.probar(soc.Config(), aplicar=False, base="http://localhost", espera=1), 0)
        finally:
            soc.ejecutar, soc.pedir = originales
        self.assertEqual(llamadas, [])



class SitioDeLaPrueba(unittest.TestCase):
    """probar solo ataca a este equipo o al dominio de BarHub, y con una URL rehecha."""

    def test_acepta_este_equipo_y_el_dominio_del_env(self):
        env = {"SITE_ADDRESS": "barhub2.duckdns.org"}
        self.assertEqual(soc.sitio_de_prueba("http://localhost", {}), "http://localhost")
        self.assertEqual(soc.sitio_de_prueba("http://127.0.0.1:8080/", {}), "http://127.0.0.1:8080")
        self.assertEqual(soc.sitio_de_prueba("http://[::1]", {}), "http://[::1]")
        self.assertEqual(soc.sitio_de_prueba("HTTPS://BarHub2.DuckDNS.org", env), "https://barhub2.duckdns.org")
        self.assertEqual(soc.sitio_de_prueba("https://barhub2.duckdns.org", {"SITE_ADDRESS": "https://barhub2.duckdns.org"}),
                         "https://barhub2.duckdns.org")

    def test_rechaza_otros_sitios_esquemas_rutas_y_credenciales(self):
        for base in ("http://ejemplo.com", "ftp://localhost", "file:///etc/passwd", "http://localhost/api",
                     "http://usuario:clave@localhost", "http://localhost?x=1", "http://localhost.ejemplo.com",
                     "http://169.254.169.254", "http://localhost:99999"):
            with self.subTest(base=base), self.assertRaises(soc.ErrorSoc):
                soc.sitio_de_prueba(base, {"SITE_ADDRESS": "barhub2.duckdns.org"})


if __name__ == "__main__":
    unittest.main()
