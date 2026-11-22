package com.daw2.barhub.auth.dosfactores;

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
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verificacion en dos pasos de punta a punta: el personal no recibe ningun token hasta pasar el
 * segundo paso, los codigos no se repiten y los fallos cuentan para el bloqueo del login.
 * Cada prueba usa sus propios usuarios (el bloqueo vive en memoria y no se deshace con la transaccion).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DosFactoresIntegrationTest {

    private static final String CLAVE = "Secreto123";

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
    private SegundoFactorRepository segundosFactores;

    private LoginDePrueba login;

    @BeforeEach
    void preparar() {
        // IP propia: los codigos incorrectos de estas pruebas no suman al bloqueo por IP de las demas
        login = new LoginDePrueba(mvc, mapper, "192.0.2.10");
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

    private MockHttpServletResponse loginConClave(String usuario, String clave) throws Exception {
        return login.post("/auth/login", Map.of("username", usuario, "password", clave));
    }

    private Map<?, ?> cuerpo(MockHttpServletResponse respuesta) throws Exception {
        return mapper.readValue(respuesta.getContentAsString(), Map.class);
    }

    private static String otroCodigo(String codigo) {
        return String.format("%06d", (Integer.parseInt(codigo) + 500_000) % 1_000_000);
    }

    @Test
    void elEmpleadoNoRecibeNingunTokenHastaConfigurarLaApp() throws Exception {
        crear("dosf_emp", RoleEnum.ROLE_EMPLEADO);

        MockHttpServletResponse respuesta = loginConClave("dosf_emp", CLAVE);
        assertEquals(200, respuesta.getStatus());
        Map<?, ?> json = cuerpo(respuesta);
        assertEquals(true, json.get("requiere2fa"));
        assertEquals(true, json.get("configurar"));
        assertFalse(json.containsKey("token"));
        assertNull(respuesta.getHeader(HttpHeaders.SET_COOKIE));
        String desafio = String.valueOf(json.get("desafio"));

        Map<?, ?> configuracion = login.json(login.post("/auth/2fa/configurar", Map.of("desafio", desafio)));
        String secreto = String.valueOf(configuracion.get("secreto"));
        assertTrue(String.valueOf(configuracion.get("uri")).startsWith("otpauth://totp/BarHub:dosf_emp?secret=" + secreto));
        String codigo = Totp.codigo(Base32.decodificar(secreto), Totp.paso(Instant.now()));

        MockHttpServletResponse incorrecto = login.post("/auth/2fa/activar", Map.of("desafio", desafio, "codigo", otroCodigo(codigo)));
        assertEquals(401, incorrecto.getStatus());
        assertEquals("CODIGO_INCORRECTO", cuerpo(incorrecto).get("code"));
        assertFalse(segundosFactores.findByUsuarioId(userRepository.findByUsername("dosf_emp").orElseThrow().getId())
                .orElseThrow().isActivo());

        MockHttpServletResponse activado = login.post("/auth/2fa/activar", Map.of("desafio", desafio, "codigo", codigo));
        assertEquals(200, activado.getStatus());
        Map<?, ?> sesion = cuerpo(activado);
        assertEquals(DosFactoresService.NUM_CODIGOS, ((List<?>) sesion.get("codigosRecuperacion")).size());
        assertTrue(activado.getHeader(HttpHeaders.SET_COOKIE).startsWith("barhub_refresh="));
        mvc.perform(get("/turnos/actual").header("Authorization", "Bearer " + sesion.get("token")))
                .andExpect(status().isOk());

        // el desafio ya se ha usado
        MockHttpServletResponse otraVez = login.post("/auth/2fa/activar", Map.of("desafio", desafio, "codigo", codigo));
        assertEquals(401, otraVez.getStatus());
        assertEquals("DESAFIO_CADUCADO", cuerpo(otraVez).get("code"));
    }

    @Test
    void conLaAppConfiguradaElLoginPideElCodigoYNoAceptaUnoRepetido() throws Exception {
        crear("dosf_admin", RoleEnum.ROLE_ADMIN);
        login.iniciarSesion("dosf_admin", CLAVE);
        String usado = Totp.codigo(login.secreto("dosf_admin"), login.ultimoPaso("dosf_admin"));

        Map<?, ?> json = cuerpo(loginConClave("dosf_admin", CLAVE));
        assertEquals(true, json.get("requiere2fa"));
        assertEquals(false, json.get("configurar"));
        String desafio = String.valueOf(json.get("desafio"));

        // el codigo con el que se activo (o uno del mismo paso) no sirve dos veces
        MockHttpServletResponse repetido = login.post("/auth/2fa/verificar", Map.of("desafio", desafio, "codigo", usado));
        assertEquals(401, repetido.getStatus());

        Map<?, ?> sesion = login.json(login.post("/auth/2fa/verificar",
                Map.of("desafio", desafio, "codigo", login.codigoSiguiente("dosf_admin"))));
        assertNotNull(sesion.get("token"));
        assertNull(sesion.get("codigosRecuperacionRestantes"));
        mvc.perform(get("/usuarios/").header("Authorization", "Bearer " + sesion.get("token")))
                .andExpect(status().isOk());
    }

    @Test
    void unCodigoDeRecuperacionSirveUnaSolaVez() throws Exception {
        crear("dosf_recup", RoleEnum.ROLE_EMPLEADO);
        login.iniciarSesion("dosf_recup", CLAVE);
        String codigo = login.codigosRecuperacion("dosf_recup").get(0);

        String desafio = String.valueOf(cuerpo(loginConClave("dosf_recup", CLAVE)).get("desafio"));
        Map<?, ?> sesion = login.json(login.post("/auth/2fa/verificar", Map.of("desafio", desafio, "codigo", codigo)));
        assertNotNull(sesion.get("token"));
        assertEquals(9, sesion.get("codigosRecuperacionRestantes"));

        String otroDesafio = String.valueOf(cuerpo(loginConClave("dosf_recup", CLAVE)).get("desafio"));
        assertEquals(401, login.post("/auth/2fa/verificar", Map.of("desafio", otroDesafio, "codigo", codigo)).getStatus());
    }

    @Test
    void losCodigosIncorrectosCuentanParaElBloqueoDelLogin() throws Exception {
        crear("dosf_fuerza", RoleEnum.ROLE_EMPLEADO);
        login.iniciarSesion("dosf_fuerza", CLAVE);
        String bueno = login.codigoSiguiente("dosf_fuerza");
        String desafio = String.valueOf(cuerpo(loginConClave("dosf_fuerza", CLAVE)).get("desafio"));

        for (int i = 1; i < DesafioService.MAX_INTENTOS; i++) {
            MockHttpServletResponse fallo = login.post("/auth/2fa/verificar", Map.of("desafio", desafio, "codigo", otroCodigo(bueno)));
            assertEquals("CODIGO_INCORRECTO", cuerpo(fallo).get("code"), "intento " + i);
        }
        MockHttpServletResponse ultimo = login.post("/auth/2fa/verificar", Map.of("desafio", desafio, "codigo", otroCodigo(bueno)));
        assertEquals("DESAFIO_CADUCADO", cuerpo(ultimo).get("code"));

        // repetir la contrasena no da intentos nuevos: la cuenta queda bloqueada, como con 5 claves malas
        assertEquals(429, loginConClave("dosf_fuerza", CLAVE).getStatus());
    }

    @Test
    void elClienteEntraSinSegundoPasoYLosDesafiosNoSeIntercambian() throws Exception {
        crear("dosf_cli", RoleEnum.ROLE_CLIENTE);
        crear("dosf_emp2", RoleEnum.ROLE_EMPLEADO);

        Map<?, ?> cliente = login.json(loginConClave("dosf_cli", CLAVE));
        assertNotNull(cliente.get("token"));
        assertFalse(cliente.containsKey("requiere2fa"));

        String desafioConfigurar = String.valueOf(cuerpo(loginConClave("dosf_emp2", CLAVE)).get("desafio"));
        assertEquals(401, login.post("/auth/2fa/verificar", Map.of("desafio", desafioConfigurar, "codigo", "123456")).getStatus());
        assertEquals(401, login.post("/auth/2fa/configurar", Map.of("desafio", "inventado")).getStatus());
        assertEquals(400, login.post("/auth/2fa/activar", Map.of("desafio", desafioConfigurar)).getStatus());
    }
}
