package com.daw2.barhub.auditoria;

import com.daw2.barhub.auth.correo.CorreoService;
import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Registro de auditoria con peticiones reales: que se anota, con que usuario, IP y resultado, que
 * solo el administrador lo consulta y que al eliminar una cuenta sus entradas se anonimizan.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuditoriaIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.50";

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
    private AuditoriaService auditoria;
    @MockitoBean
    private CorreoService correo;

    private LoginDePrueba login;

    @BeforeEach
    void preparar() {
        login = new LoginDePrueba(mvc, mapper, IP);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private User crear(String username, RoleEnum rol) {
        Role role = roleRepository.findByName(rol)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(rol).build()));
        return userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(role)))
                .build());
    }

    private MockHttpServletResponse con(String token, MockHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(p -> {
            p.setRemoteAddr(IP);
            return p;
        })).andReturn().getResponse();
    }

    /** Entradas de hoy de ese usuario, la mas reciente primero. */
    private List<EventoAuditoria> de(String usuario) {
        Instant ahora = Instant.now();
        return auditoria.buscar(new AuditoriaService.Filtro(ahora.minus(1, ChronoUnit.HOURS), ahora.plus(1, ChronoUnit.HOURS),
                usuario, null, null), 0, 100).getContent();
    }

    private EventoAuditoria ultima(String usuario, AccionAuditoria accion) {
        return de(usuario).stream().filter(e -> e.getAccion() == accion).findFirst().orElseThrow(
                () -> new AssertionError("sin entrada " + accion + " de " + usuario));
    }

    @Test
    void anotaElLoginFallidoYElCorrectoConLaIp() throws Exception {
        User ana = crear("au_ana", RoleEnum.ROLE_CLIENTE);

        assertEquals(401, login.post("/auth/login", Map.of("username", "au_ana", "password", "no-es-esta")).getStatus());
        EventoAuditoria fallido = ultima("au_ana", AccionAuditoria.INICIO_SESION);
        assertEquals(ResultadoAuditoria.RECHAZADO, fallido.getResultado());
        assertEquals(IP, fallido.getIp());
        assertEquals("POST /auth/login", fallido.getPeticion());

        login.token("au_ana", CLAVE);
        EventoAuditoria correcto = ultima("au_ana", AccionAuditoria.INICIO_SESION);
        assertEquals(ResultadoAuditoria.CORRECTO, correcto.getResultado());
        assertEquals(ana.getId(), correcto.getUsuarioId());
    }

    @Test
    void unUsuarioQueNoExisteQuedaConElNombreEscritoYSinId() throws Exception {
        login.post("/auth/login", Map.of("username", "au_nadie", "password", "x"));

        EventoAuditoria evento = ultima("au_nadie", AccionAuditoria.INICIO_SESION);
        assertEquals(ResultadoAuditoria.RECHAZADO, evento.getResultado());
        assertNull(evento.getUsuarioId());
    }

    @Test
    void laContrasenaActualMalQuedaRechazadaConElMotivoYSinLaContrasena() throws Exception {
        crear("au_carla", RoleEnum.ROLE_CLIENTE);
        String token = login.token("au_carla", CLAVE);

        con(token, put("/perfil/password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"actual\":\"SecretoMalo1\",\"nueva\":\"OtraClave123\"}"));

        EventoAuditoria evento = ultima("au_carla", AccionAuditoria.CONTRASENA_CAMBIADA);
        assertEquals(ResultadoAuditoria.RECHAZADO, evento.getResultado());
        assertEquals("Contraseña actual incorrecta", evento.getDetalle());
        assertTrue(de("au_carla").stream().noneMatch(e -> String.valueOf(e.getDetalle()).contains("SecretoMalo1")
                || String.valueOf(e.getDetalle()).contains("OtraClave123")));
    }

    @Test
    void unClienteNoLeeLaAuditoriaYElIntentoQuedaAnotado() throws Exception {
        crear("au_dani", RoleEnum.ROLE_CLIENTE);
        String token = login.token("au_dani", CLAVE);

        assertEquals(403, con(token, get("/auditoria")).getStatus());

        EventoAuditoria evento = ultima("au_dani", AccionAuditoria.ACCESO_DENEGADO);
        assertEquals(ResultadoAuditoria.RECHAZADO, evento.getResultado());
        assertEquals("GET /auditoria", evento.getPeticion());
    }

    @Test
    void elAdministradorFiltraPorUsuarioYAccion() throws Exception {
        crear("au_eva", RoleEnum.ROLE_CLIENTE);
        login.post("/auth/login", Map.of("username", "au_eva", "password", "no-es-esta"));
        crear("au_admin", RoleEnum.ROLE_ADMIN);
        String token = login.token("au_admin", CLAVE);

        MockHttpServletResponse respuesta = con(token, get("/auditoria")
                .param("usuario", "AU_EVA").param("accion", "INICIO_SESION"));
        assertEquals(200, respuesta.getStatus());
        Map<?, ?> pagina = mapper.readValue(respuesta.getContentAsString(StandardCharsets.UTF_8), Map.class);
        List<?> eventos = (List<?>) pagina.get("eventos");
        assertEquals(1, eventos.size());
        Map<?, ?> evento = (Map<?, ?>) eventos.get(0);
        assertEquals("au_eva", evento.get("usuario"));
        assertEquals("RECHAZADO", evento.get("resultado"));

        assertEquals(400, con(token, get("/auditoria").param("accion", "INVENTADA")).getStatus());
        assertEquals(400, con(token, get("/auditoria").param("desde", "2026-12-31").param("hasta", "2026-01-01")).getStatus());
    }

    @Test
    void alEliminarLaCuentaSusEntradasQuedanSinNombreNiIp() throws Exception {
        User fede = crear("au_fede", RoleEnum.ROLE_CLIENTE);
        Long id = fede.getId();
        String token = login.token("au_fede", CLAVE);

        assertEquals(204, con(token, delete("/perfil")).getStatus());

        assertTrue(de("au_fede").isEmpty(), "ya no queda ninguna con su nombre");
        List<EventoAuditoria> anonimas = de("eliminado-" + id);
        assertTrue(anonimas.stream().anyMatch(e -> e.getAccion() == AccionAuditoria.INICIO_SESION));
        EventoAuditoria eliminada = ultima("eliminado-" + id, AccionAuditoria.CUENTA_ELIMINADA);
        assertEquals(ResultadoAuditoria.CORRECTO, eliminada.getResultado());
        assertTrue(anonimas.stream().allMatch(e -> e.getIp() == null));
    }
}
