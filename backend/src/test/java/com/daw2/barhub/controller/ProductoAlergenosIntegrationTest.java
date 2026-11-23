package com.daw2.barhub.controller;

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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * Alergenos de los productos: el administrador los indica al crear o editar; la carta (publica) los
 * recibe ordenados, o null si aun no se han indicado, que no es lo mismo que "no lleva ninguno".
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProductoAlergenosIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.60";

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

    private String token;

    @BeforeEach
    void preparar() throws Exception {
        Role admin = roleRepository.findByName(RoleEnum.ROLE_ADMIN)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(RoleEnum.ROLE_ADMIN).build()));
        userRepository.saveAndFlush(User.builder()
                .username("al_admin")
                .email("al_admin@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(admin)))
                .build());
        token = new LoginDePrueba(mvc, mapper, IP).token("al_admin", CLAVE);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse guardar(HttpMethod metodo, String ruta, Map<String, Object> producto) throws Exception {
        MockMultipartFile parte = new MockMultipartFile("producto", "", MediaType.APPLICATION_JSON_VALUE,
                mapper.writeValueAsBytes(producto));
        return mvc.perform(multipart(metodo, ruta).file(parte)
                        .header("Authorization", "Bearer " + token)
                        .with(p -> {
                            p.setRemoteAddr(IP);
                            return p;
                        }))
                .andReturn().getResponse();
    }

    private Map<?, ?> json(MockHttpServletResponse respuesta) throws Exception {
        return mapper.readValue(respuesta.getContentAsString(StandardCharsets.UTF_8), Map.class);
    }

    private Map<String, Object> producto(String nombre, String tipo, List<String> alergenos) {
        Map<String, Object> datos = new java.util.HashMap<>();
        datos.put("nombre", nombre);
        datos.put("descripcion", "De prueba");
        datos.put("precio", 3.5);
        datos.put("tipoProducto", tipo);
        datos.put("alergenos", alergenos);
        return datos;
    }

    private Map<?, ?> publico(Object id) throws Exception {
        return json(mvc.perform(get("/productos/" + id)).andReturn().getResponse());
    }

    @Test
    void losAlergenosIndicadosSeGuardanYLaCartaLosRecibeOrdenados() throws Exception {
        MockHttpServletResponse creado = guardar(HttpMethod.POST, "/productos/",
                producto("Croquetas al", "TAPA", List.of("LACTEOS", "GLUTEN", "HUEVOS", "GLUTEN")));
        assertEquals(200, creado.getStatus());

        Map<?, ?> visto = publico(json(creado).get("id"));
        assertEquals(List.of("GLUTEN", "HUEVOS", "LACTEOS"), visto.get("alergenos"));
    }

    @Test
    void sinIndicarNoEsLoMismoQueSinAlergenos() throws Exception {
        Object sinIndicar = json(guardar(HttpMethod.POST, "/productos/", producto("Pincho al", "TAPA", null))).get("id");
        Object ninguno = json(guardar(HttpMethod.POST, "/productos/", producto("Agua al", "BEBIDA", List.of()))).get("id");

        assertNull(publico(sinIndicar).get("alergenos"));
        assertEquals(List.of(), publico(ninguno).get("alergenos"));
        // En el listado de la carta, igual
        List<?> carta = mapper.readValue(mvc.perform(get("/productos/")).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8), List.class);
        Map<?, ?> enCarta = carta.stream().map(p -> (Map<?, ?>) p)
                .filter(p -> "Agua al".equals(p.get("nombre"))).findFirst().orElseThrow();
        assertEquals(List.of(), enCarta.get("alergenos"));
    }

    @Test
    void alEditarCambianLosAlergenosYTambienElTipo() throws Exception {
        Object id = json(guardar(HttpMethod.POST, "/productos/",
                producto("Tosta al", "TAPA", List.of("GLUTEN", "PESCADO")))).get("id");

        MockHttpServletResponse editado = guardar(HttpMethod.PUT, "/productos/" + id,
                producto("Tosta al", "ENTRANTE", List.of("SESAMO")));
        assertEquals(200, editado.getStatus());

        Map<?, ?> visto = publico(id);
        assertEquals(List.of("SESAMO"), visto.get("alergenos"));
        assertEquals("ENTRANTE", visto.get("tipoProducto"));

        guardar(HttpMethod.PUT, "/productos/" + id, producto("Tosta al", "ENTRANTE", null));
        assertNull(publico(id).get("alergenos"), "se puede volver a dejar sin indicar");
    }

    @Test
    void unAlergenoQueNoExisteSeRechaza() throws Exception {
        assertEquals(400, guardar(HttpMethod.POST, "/productos/",
                producto("Raro al", "TAPA", List.of("CHOCOLATE"))).getStatus());
    }
}
