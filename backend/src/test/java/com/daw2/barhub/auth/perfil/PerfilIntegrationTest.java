package com.daw2.barhub.auth.perfil;

import com.daw2.barhub.auth.dosfactores.Base32;
import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.dosfactores.Totp;
import com.daw2.barhub.auth.jwt.JwtUtils;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Pestana Seguridad del perfil con sesiones reales: contrasena, verificacion en dos pasos y sesiones. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PerfilIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.30";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private SesionRepository sesionRepository;
    @Autowired
    private JwtUtils jwtUtils;

    private LoginDePrueba login;

    @BeforeEach
    void preparar() {
        login = new LoginDePrueba(mvc, mapper, IP);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private void crear(String username, RoleEnum rol) {
        Role role = roleRepository.findByName(rol)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(rol).build()));
        userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(role)))
                .build());
    }

    private static RequestPostProcessor desdeLaIp() {
        return p -> {
            p.setRemoteAddr(IP);
            return p;
        };
    }

    private MockHttpServletResponse con(String token, MockHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(desdeLaIp())).andReturn().getResponse();
    }

    private MockHttpServletResponse conJson(String token, MockHttpServletRequestBuilder peticion, Map<String, String> cuerpo)
            throws Exception {
        return con(token, peticion.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(cuerpo)));
    }

    private Map<?, ?> json(MockHttpServletResponse respuesta) throws Exception {
        return mapper.readValue(respuesta.getContentAsString(StandardCharsets.UTF_8), Map.class);
    }

    private Map<?, ?> estado(String token) throws Exception {
        MockHttpServletResponse respuesta = con(token, get("/perfil/seguridad"));
        assertEquals(200, respuesta.getStatus());
        return json(respuesta);
    }

    private String sesionDe(String token) {
        return jwtUtils.getSesionIdFromJwtToken(token);
    }

    @Test
    void elEstadoDeSeguridadDependeDelRol() throws Exception {
        crear("perf_cli1", RoleEnum.ROLE_CLIENTE);
        crear("perf_emp1", RoleEnum.ROLE_EMPLEADO);

        Map<?, ?> cliente = estado(login.token("perf_cli1", CLAVE));
        assertEquals(true, cliente.get("correoVerificado"));
        assertEquals(false, cliente.get("dosFactoresActiva"));
        assertEquals(false, cliente.get("dosFactoresObligatoria"));
        assertNotNull(cliente.get("cuentaCreada"));

        Map<?, ?> empleado = estado(login.token("perf_emp1", CLAVE));
        assertEquals(true, empleado.get("dosFactoresActiva"));
        assertEquals(true, empleado.get("dosFactoresObligatoria"));
        assertEquals(10, empleado.get("codigosRecuperacionRestantes"));
    }

    @Test
    void sinSesionNoHayPerfil() throws Exception {
        assertEquals(401, mvc.perform(get("/perfil/seguridad")).andReturn().getResponse().getStatus());
        assertEquals(401, mvc.perform(get("/perfil/sesiones")).andReturn().getResponse().getStatus());
    }

    @Test
    void cambiarLaContrasenaPideLaActualYCierraLasDemasSesiones() throws Exception {
        crear("perf_cli2", RoleEnum.ROLE_CLIENTE);
        String esta = login.token("perf_cli2", CLAVE);
        String otra = login.token("perf_cli2", CLAVE);

        assertEquals(400, conJson(esta, put("/perfil/password"), Map.of("actual", "no-es", "nueva", "NuevaClave1")).getStatus());
        assertEquals(400, conJson(esta, put("/perfil/password"), Map.of("actual", CLAVE, "nueva", "corta")).getStatus());
        assertEquals(400, conJson(esta, put("/perfil/password"), Map.of("actual", CLAVE, "nueva", CLAVE)).getStatus());

        MockHttpServletResponse cambio = conJson(esta, put("/perfil/password"), Map.of("actual", CLAVE, "nueva", "NuevaClave1"));
        assertEquals(200, cambio.getStatus());
        assertEquals(1, json(cambio).get("sesionesCerradas"));
        assertEquals(401, con(otra, get("/perfil/seguridad")).getStatus(), "la otra sesion se ha cerrado");
        assertEquals(200, con(esta, get("/perfil/seguridad")).getStatus(), "esta sigue abierta");

        assertEquals(401, login.post("/auth/login", Map.of("username", "perf_cli2", "password", CLAVE)).getStatus());
        assertEquals(200, login.post("/auth/login", Map.of("username", "perf_cli2", "password", "NuevaClave1")).getStatus());
    }

    @Test
    void elClienteActivaRegeneraYQuitaLaVerificacionEnDosPasos() throws Exception {
        crear("perf_cli3", RoleEnum.ROLE_CLIENTE);
        String token = login.token("perf_cli3", CLAVE);

        MockHttpServletResponse configuracion = con(token, post("/perfil/dos-factores/configurar"));
        assertEquals(200, configuracion.getStatus());
        byte[] secreto = Base32.decodificar(String.valueOf(json(configuracion).get("secreto")));
        long paso = Totp.paso(Instant.now());

        assertEquals(400, conJson(token, post("/perfil/dos-factores/activar"),
                Map.of("codigo", String.format("%06d", (Integer.parseInt(Totp.codigo(secreto, paso)) + 500_000) % 1_000_000)))
                .getStatus());
        MockHttpServletResponse activada = conJson(token, post("/perfil/dos-factores/activar"),
                Map.of("codigo", Totp.codigo(secreto, paso)));
        assertEquals(200, activada.getStatus());
        List<?> codigos = (List<?>) json(activada).get("codigosRecuperacion");
        assertEquals(10, codigos.size());
        assertEquals(true, estado(token).get("dosFactoresActiva"));
        assertEquals(409, con(token, post("/perfil/dos-factores/configurar")).getStatus());

        // desde ahora su login pide el codigo
        Map<?, ?> nuevoLogin = json(login.post("/auth/login", Map.of("username", "perf_cli3", "password", CLAVE)));
        assertEquals(true, nuevoLogin.get("requiere2fa"));
        assertEquals(false, nuevoLogin.get("configurar"));

        MockHttpServletResponse regenerados = con(token, post("/perfil/dos-factores/codigos"));
        assertEquals(200, regenerados.getStatus());
        assertTrue(((List<?>) json(regenerados).get("codigosRecuperacion")).stream().noneMatch(codigos::contains));

        assertEquals(204, con(token, delete("/perfil/dos-factores")).getStatus());
        assertEquals(false, estado(token).get("dosFactoresActiva"));
    }

    @Test
    void pasadaLaVentanaQuitarlaPideElCodigoYElPersonalNoPuedeQuitarsela() throws Exception {
        crear("perf_cli4", RoleEnum.ROLE_CLIENTE);
        crear("perf_emp4", RoleEnum.ROLE_EMPLEADO);
        String cliente = login.token("perf_cli4", CLAVE);
        String configuracion = String.valueOf(json(con(cliente, post("/perfil/dos-factores/configurar"))).get("secreto"));
        conJson(cliente, post("/perfil/dos-factores/activar"),
                Map.of("codigo", Totp.codigo(Base32.decodificar(configuracion), Totp.paso(Instant.now()))));

        Sesion sesion = sesionRepository.findById(sesionDe(cliente)).orElseThrow();
        sesion.setReautenticadaEn(Instant.now().minus(Duration.ofMinutes(10)));
        sesionRepository.saveAndFlush(sesion);
        MockHttpServletResponse pedida = con(cliente, delete("/perfil/dos-factores"));
        assertEquals(403, pedida.getStatus());
        assertEquals("REAUTENTICACION_REQUERIDA", json(pedida).get("code"));
        assertEquals("codigo", json(pedida).get("metodo"));
        assertEquals(true, estado(cliente).get("dosFactoresActiva"));

        String empleado = login.token("perf_emp4", CLAVE);
        assertEquals(400, con(empleado, delete("/perfil/dos-factores")).getStatus());
        assertEquals(true, estado(empleado).get("dosFactoresActiva"));
    }

    @Test
    void cadaUnoVeYCierraSoloSusSesiones() throws Exception {
        crear("perf_cli5", RoleEnum.ROLE_CLIENTE);
        crear("perf_cli6", RoleEnum.ROLE_CLIENTE);
        String esta = login.token("perf_cli5", CLAVE);
        String otra = login.token("perf_cli5", CLAVE);
        String tercera = login.token("perf_cli5", CLAVE);
        String ajena = login.token("perf_cli6", CLAVE);

        List<?> lista = mapper.readValue(con(esta, get("/perfil/sesiones")).getContentAsString(StandardCharsets.UTF_8), List.class);
        assertEquals(3, lista.size());
        assertEquals(1, lista.stream().filter(s -> Boolean.TRUE.equals(((Map<?, ?>) s).get("actual"))).count());
        assertTrue(lista.stream().anyMatch(s -> sesionDe(esta).equals(((Map<?, ?>) s).get("id"))
                && Boolean.TRUE.equals(((Map<?, ?>) s).get("actual"))));
        assertEquals(IP, ((Map<?, ?>) lista.get(0)).get("ip"));

        assertEquals(404, con(esta, delete("/perfil/sesiones/{id}", sesionDe(ajena))).getStatus());
        assertEquals(200, con(ajena, get("/perfil/seguridad")).getStatus(), "la sesion ajena sigue abierta");

        assertEquals(204, con(esta, delete("/perfil/sesiones/{id}", sesionDe(otra))).getStatus());
        assertEquals(401, con(otra, get("/perfil/seguridad")).getStatus());

        MockHttpServletResponse demas = con(esta, delete("/perfil/sesiones"));
        assertEquals(1, json(demas).get("sesionesCerradas"));
        assertEquals(401, con(tercera, get("/perfil/seguridad")).getStatus());
        assertEquals(200, con(esta, get("/perfil/seguridad")).getStatus());
    }
}
