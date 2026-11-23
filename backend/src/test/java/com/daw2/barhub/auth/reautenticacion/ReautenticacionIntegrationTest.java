package com.daw2.barhub.auth.reautenticacion;

import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.dosfactores.SegundoFactorRepository;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Acciones criticas del administrador con sesiones reales: el inicio de sesion abre la ventana de
 * reautenticacion; pasada la ventana, la accion no se ejecuta hasta confirmar el codigo de la app.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReautenticacionIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.20";

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
    private SegundoFactorRepository segundosFactores;
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

    private Long crear(String username, RoleEnum rol) {
        Role role = roleRepository.findByName(rol)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(rol).build()));
        return userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(role)))
                .build()).getId();
    }

    /** Con el token de acceso y desde la IP de estas pruebas. */
    private static RequestPostProcessor desdeLaIp() {
        return p -> {
            p.setRemoteAddr(IP);
            return p;
        };
    }

    private MockHttpServletResponse con(String token, MockHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(desdeLaIp())).andReturn().getResponse();
    }

    // El de multipart no hereda de MockHttpServletRequestBuilder: hace falta su propia version
    private MockHttpServletResponse con(String token, MockMultipartHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(desdeLaIp())).andReturn().getResponse();
    }

    private MockHttpServletResponse reautenticar(String token, Map<String, String> cuerpo) throws Exception {
        return con(token, post("/auth/reautenticar").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(cuerpo)));
    }

    private Map<?, ?> json(MockHttpServletResponse respuesta) throws Exception {
        return mapper.readValue(respuesta.getContentAsString(StandardCharsets.UTF_8), Map.class);
    }

    /** Como si la sesion se hubiera abierto (o reautenticado) hace 10 minutos: fuera de la ventana. */
    private void sacarDeLaVentana(String token) {
        Sesion sesion = sesionRepository.findById(jwtUtils.getSesionIdFromJwtToken(token)).orElseThrow();
        sesion.setReautenticadaEn(Instant.now().minus(Duration.ofMinutes(10)));
        sesionRepository.saveAndFlush(sesion);
    }

    private static MockMultipartHttpServletRequestBuilder editarPerfil(Long id, String username, String rolesJson) {
        String perfil = "{\"username\":\"" + username + "\",\"email\":\"" + username + "@test.local\","
                + "\"nombre\":\"Cambiado\",\"apellido1\":\"Tests\"" + rolesJson + "}";
        MockMultipartFile parte = new MockMultipartFile("usuario", "", MediaType.APPLICATION_JSON_VALUE,
                perfil.getBytes(StandardCharsets.UTF_8));
        return multipart(HttpMethod.PUT, "/usuarios/{id}", id).file(parte);
    }

    @Test
    void recienIniciadaLaSesionElAdministradorNoTieneQueRepetirElCodigo() throws Exception {
        crear("reaut_admin1", RoleEnum.ROLE_ADMIN);
        Long cliente = crear("reaut_cli1", RoleEnum.ROLE_CLIENTE);
        String admin = login.token("reaut_admin1", CLAVE);

        assertEquals(204, con(admin, delete("/usuarios/{id}", cliente)).getStatus());
        assertFalse(userRepository.existsById(cliente));
    }

    @Test
    void pasadaLaVentanaLaAccionNoSeEjecutaHastaConfirmarElCodigoDeLaApp() throws Exception {
        crear("reaut_admin2", RoleEnum.ROLE_ADMIN);
        Long cliente = crear("reaut_cli2", RoleEnum.ROLE_CLIENTE);
        String admin = login.token("reaut_admin2", CLAVE);
        sacarDeLaVentana(admin);

        MockHttpServletResponse pedida = con(admin, delete("/usuarios/{id}", cliente));
        assertEquals(403, pedida.getStatus());
        assertEquals("REAUTENTICACION_REQUERIDA", json(pedida).get("code"));
        assertEquals("codigo", json(pedida).get("metodo"));
        assertTrue(userRepository.existsById(cliente), "sin reautenticar no se borra nada");

        // ni un codigo incorrecto ni un codigo de recuperacion sirven aqui
        MockHttpServletResponse incorrecto = reautenticar(admin, Map.of("codigo", "000000"));
        assertEquals(400, incorrecto.getStatus());
        assertEquals("CODIGO_INCORRECTO", json(incorrecto).get("code"));
        assertEquals(400, reautenticar(admin, Map.of("codigo", login.codigosRecuperacion("reaut_admin2").get(0))).getStatus());
        assertEquals(403, con(admin, delete("/usuarios/{id}", cliente)).getStatus());

        MockHttpServletResponse confirmada = reautenticar(admin, Map.of("codigo", login.codigoSiguiente("reaut_admin2")));
        assertEquals(200, confirmada.getStatus());
        assertTrue(((Number) json(confirmada).get("reautenticadaHasta")).longValue() > System.currentTimeMillis());

        assertEquals(204, con(admin, delete("/usuarios/{id}", cliente)).getStatus());
        assertFalse(userRepository.existsById(cliente));
    }

    @Test
    void editarSuPropioPerfilNoLaPideYCambiarLosRolesDeOtroSi() throws Exception {
        Long idAdmin = crear("reaut_admin3", RoleEnum.ROLE_ADMIN);
        Long cliente = crear("reaut_cli3", RoleEnum.ROLE_CLIENTE);
        Long rolAdmin = roleRepository.findByName(RoleEnum.ROLE_ADMIN).orElseThrow().getId();
        String admin = login.token("reaut_admin3", CLAVE);
        sacarDeLaVentana(admin);

        assertNotEquals(403, con(admin, editarPerfil(idAdmin, "reaut_admin3", "")).getStatus());
        String ascenso = ",\"roles\":[{\"id\":" + rolAdmin + "}]";
        assertEquals(403, con(admin, editarPerfil(cliente, "reaut_cli3", ascenso)).getStatus());

        // caso de control: reautenticado, el administrador si puede cambiar roles
        reautenticar(admin, Map.of("codigo", login.codigoSiguiente("reaut_admin3")));
        assertEquals(200, con(admin, editarPerfil(cliente, "reaut_cli3", ascenso)).getStatus());
        assertTrue(userRepository.findById(cliente).orElseThrow().getRoles().stream()
                .anyMatch(r -> r.getName() == RoleEnum.ROLE_ADMIN));
    }

    @Test
    void restablecerLaVerificacionDeUnEmpleadoCierraSusSesionesYLeHaceConfigurarlaOtraVez() throws Exception {
        Long idAdmin = crear("reaut_admin4", RoleEnum.ROLE_ADMIN);
        Long empleado = crear("reaut_emp4", RoleEnum.ROLE_EMPLEADO);
        String tokenEmpleado = login.token("reaut_emp4", CLAVE);
        String admin = login.token("reaut_admin4", CLAVE);

        Map<?, ?> listado = Map.of();
        for (Object fila : mapper.readValue(con(admin, get("/usuarios/")).getContentAsString(StandardCharsets.UTF_8), java.util.List.class)) {
            if ("reaut_emp4".equals(((Map<?, ?>) fila).get("username"))) {
                listado = (Map<?, ?>) fila;
            }
        }
        assertEquals(true, listado.get("dosFactores"));

        assertEquals(204, con(admin, delete("/usuarios/{id}/dos-factores", empleado)).getStatus());
        assertTrue(segundosFactores.findByUsuarioId(empleado).isEmpty());
        assertEquals(401, con(tokenEmpleado, get("/turnos/actual")).getStatus());
        Map<?, ?> nuevoLogin = json(login.post("/auth/login", Map.of("username", "reaut_emp4", "password", CLAVE)));
        assertEquals(true, nuevoLogin.get("configurar"));

        // la suya no se la puede quitar desde aqui
        assertEquals(400, con(admin, delete("/usuarios/{id}/dos-factores", idAdmin)).getStatus());
    }

    @Test
    void elClienteSeReautenticaConSuContrasenaYNoPasaPorLaReautenticacionSinoPorLosPermisos() throws Exception {
        crear("reaut_cli5", RoleEnum.ROLE_CLIENTE);
        Long otro = crear("reaut_cli6", RoleEnum.ROLE_CLIENTE);
        String cliente = login.token("reaut_cli5", CLAVE);

        MockHttpServletResponse denegada = con(cliente, delete("/usuarios/{id}", otro));
        assertEquals(403, denegada.getStatus());
        assertFalse(denegada.getContentAsString().contains("REAUTENTICACION"));

        assertEquals(400, reautenticar(cliente, Map.of("password", "otra-cosa")).getStatus());
        assertEquals(200, reautenticar(cliente, Map.of("password", CLAVE)).getStatus());
    }

    @Test
    void sinSesionNoHayNadaQueReautenticar() throws Exception {
        MockHttpServletResponse respuesta = mvc.perform(post("/auth/reautenticar")
                .contentType(MediaType.APPLICATION_JSON).content("{\"codigo\":\"123456\"}")).andReturn().getResponse();
        assertEquals(401, respuesta.getStatus());
    }
}
