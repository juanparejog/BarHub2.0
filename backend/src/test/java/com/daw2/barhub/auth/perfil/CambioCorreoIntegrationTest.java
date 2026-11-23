package com.daw2.barhub.auth.perfil;

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
import org.mockito.ArgumentCaptor;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Cambio de correo desde el perfil: el correo nuevo no entra en la cuenta hasta abrir el enlace que
 * llega a él, y al anterior se le avisa al pedirlo y al confirmarlo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CambioCorreoIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.40";
    private static final Pattern ENLACE = Pattern.compile("/auth/confirmar-cambio-correo#token=([\\w-]+)");
    private static final String ASUNTO_ENLACE = "Confirma tu nuevo correo en BarHub";

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

    private void crear(String username) {
        Role cliente = roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(RoleEnum.ROLE_CLIENTE).build()));
        userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(cliente)))
                .build());
    }

    private MockHttpServletResponse con(String token, MockHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(p -> {
            p.setRemoteAddr(IP);
            return p;
        })).andReturn().getResponse();
    }

    private MockHttpServletResponse pedirCambio(String token, String nuevo) throws Exception {
        return con(token, post("/perfil/correo").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("nuevo", nuevo))));
    }

    private MockHttpServletResponse confirmar(String token) throws Exception {
        return mvc.perform(post("/auth/confirmar-cambio-correo").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("token", token)))).andReturn().getResponse();
    }

    private Object pendiente(String token) throws Exception {
        return mapper.readValue(con(token, get("/perfil/seguridad")).getContentAsString(StandardCharsets.UTF_8), Map.class)
                .get("cambioCorreoPendiente");
    }

    /** Token del ultimo enlace enviado a {@code para}. */
    private String enlaceEnviadoA(String para) {
        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(correo, org.mockito.Mockito.atLeastOnce()).enviar(eq(para), eq(ASUNTO_ENLACE), texto.capture());
        List<String> textos = texto.getAllValues();
        Matcher enlace = ENLACE.matcher(textos.get(textos.size() - 1));
        assertTrue(enlace.find(), "el correo lleva el enlace");
        return enlace.group(1);
    }

    private String correoDe(String username) {
        return userRepository.findByUsername(username).orElseThrow().getEmail();
    }

    @Test
    void elCorreoNuevoNoEntraHastaAbrirElEnlaceYAlAnteriorSeLeAvisa() throws Exception {
        crear("cc_ana");
        String token = login.token("cc_ana", CLAVE);

        assertEquals(202, pedirCambio(token, "  ana.nueva@test.local ").getStatus());
        assertEquals("cc_ana@test.local", correoDe("cc_ana"), "hasta abrir el enlace no cambia");
        assertEquals("ana.nueva@test.local", pendiente(token));
        verify(correo).enviar(eq("cc_ana@test.local"), eq("Se ha pedido cambiar el correo de tu cuenta de BarHub"),
                contains("a***@test.local"));

        String enlace = enlaceEnviadoA("ana.nueva@test.local");
        MockHttpServletResponse confirmado = confirmar(enlace);
        assertEquals(200, confirmado.getStatus());
        assertEquals("ana.nueva@test.local", correoDe("cc_ana"));
        assertTrue(userRepository.findByUsername("cc_ana").orElseThrow().correoVerificado());
        assertNull(pendiente(token));
        verify(correo).enviar(eq("cc_ana@test.local"), eq("El correo de tu cuenta de BarHub ha cambiado"), anyString());

        assertEquals(400, confirmar(enlace).getStatus(), "el enlace no sirve dos veces");
    }

    @Test
    void noSeAceptaUnCorreoNoValidoElPropioNiElDeOtraCuenta() throws Exception {
        crear("cc_beto");
        crear("cc_carla");
        String token = login.token("cc_beto", CLAVE);

        assertEquals(400, pedirCambio(token, "no-es-un-correo").getStatus());
        assertEquals(400, pedirCambio(token, "CC_BETO@test.local").getStatus());
        assertEquals(409, pedirCambio(token, "cc_carla@test.local").getStatus());
        verify(correo, never()).enviar(anyString(), eq(ASUNTO_ENLACE), anyString());
    }

    @Test
    void comoMuchoUnEnlacePorMinutoYCancelarloLoAnula() throws Exception {
        crear("cc_dani");
        String token = login.token("cc_dani", CLAVE);

        assertEquals(202, pedirCambio(token, "dani.1@test.local").getStatus());
        assertEquals(429, pedirCambio(token, "dani.2@test.local").getStatus());
        String enlace = enlaceEnviadoA("dani.1@test.local");

        assertEquals(204, con(token, delete("/perfil/correo")).getStatus());
        assertNull(pendiente(token));
        assertEquals(400, confirmar(enlace).getStatus());
        assertEquals("cc_dani@test.local", correoDe("cc_dani"));
    }

    @Test
    void siOtraCuentaSeQuedaElCorreoAntesDeConfirmarNoSeCambia() throws Exception {
        crear("cc_eva");
        crear("cc_fede");
        String token = login.token("cc_eva", CLAVE);
        pedirCambio(token, "compartido@test.local");
        String enlace = enlaceEnviadoA("compartido@test.local");

        User fede = userRepository.findByUsername("cc_fede").orElseThrow();
        fede.setEmail("compartido@test.local");
        userRepository.saveAndFlush(fede);

        assertEquals(409, confirmar(enlace).getStatus());
        assertEquals("cc_eva@test.local", correoDe("cc_eva"));
        assertFalse(correoDe("cc_eva").equals(correoDe("cc_fede")));
    }

    @Test
    void sinSesionNoSePuedePedirNiCancelar() throws Exception {
        assertEquals(401, mvc.perform(post("/perfil/correo").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nuevo\":\"x@test.local\"}")).andReturn().getResponse().getStatus());
        assertEquals(401, mvc.perform(delete("/perfil/correo")).andReturn().getResponse().getStatus());
        assertEquals(400, confirmar("inventado").getStatus());
    }
}
