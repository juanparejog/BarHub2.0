package com.daw2.barhub.controller;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Escalada de privilegios: un cliente no puede darse permisos de administrador,
 * cambiar su nombre de usuario, tocar a otra persona ni usar las rutas de administracion.
 * Cada caso comprueba la respuesta HTTP y, en especial, lo que queda guardado en la base de datos.
 * Se deshace al terminar (@Transactional). La evidencia resumida esta en docs/evidencias/.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EscaladaPrivilegiosTest {

    private static final String CLIENTE = "esc_cli";
    private static final String OTRO = "esc_otro";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private EntityManager em;

    private Role rolAdmin;
    private Long idCliente;
    private Long idOtro;

    @BeforeEach
    void preparar() {
        rolAdmin = rol(RoleEnum.ROLE_ADMIN);
        Role rolCliente = rol(RoleEnum.ROLE_CLIENTE);
        idCliente = crearUsuario(CLIENTE, rolCliente).getId();
        idOtro = crearUsuario(OTRO, rolCliente).getId();
    }

    // ---------- utilidades ----------

    private Role rol(RoleEnum nombre) {
        return roleRepository.findAll().stream()
                .filter(r -> r.getName() == nombre)
                .findFirst()
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(nombre).build()));
    }

    private User crearUsuario(String username, Role rol) {
        return userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password("no-se-usa-en-estas-pruebas")
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(rol)))
                .build());
    }

    /** Fuerza la escritura y vuelve a leer de la base de datos, no de la memoria. */
    private User deLaBaseDeDatos(Long id) {
        em.flush();
        em.clear();
        return userRepository.findById(id).orElseThrow();
    }

    private static Set<RoleEnum> roles(User u) {
        return u.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
    }

    private static String perfil(String username, String nombre, String rolesJson) {
        return "{\"username\":\"" + username + "\",\"email\":\"" + username + "@test.local\","
                + "\"nombre\":\"" + nombre + "\",\"apellido1\":\"Tests\"" + rolesJson + "}";
    }

    private static String conRol(Long idRol) {
        return ",\"roles\":[{\"id\":" + idRol + "}]";
    }

    private ResultActions actualiza(Long id, String json, RequestPostProcessor sesion) throws Exception {
        MockMultipartFile parte = new MockMultipartFile(
                "usuario", "", MediaType.APPLICATION_JSON_VALUE, json.getBytes(StandardCharsets.UTF_8));
        return mvc.perform(multipart(HttpMethod.PUT, "/usuarios/{id}", id).file(parte).with(sesion));
    }

    private static RequestPostProcessor comoCliente() {
        return user(CLIENTE).roles("CLIENTE");
    }

    // ---------- casos ----------

    @Test
    void unClienteNoPuedePonerseElRolDeAdministrador() throws Exception {
        actualiza(idCliente, perfil(CLIENTE, "Prueba", conRol(rolAdmin.getId())), comoCliente())
                .andExpect(status().isOk());

        Set<RoleEnum> guardados = roles(deLaBaseDeDatos(idCliente));
        assertFalse(guardados.contains(RoleEnum.ROLE_ADMIN), "El cliente no debe tener el rol ADMIN");
        assertEquals(Set.of(RoleEnum.ROLE_CLIENTE), guardados);
    }

    @Test
    void unClienteNoPuedeCambiarSuNombreDeUsuario() throws Exception {
        actualiza(idCliente, perfil("esc_hacker", "Prueba", ""), comoCliente())
                .andExpect(status().isOk());

        assertEquals(CLIENTE, deLaBaseDeDatos(idCliente).getUsername());
    }

    @Test
    void unClienteSiPuedeCambiarSusDatosPersonales() throws Exception {
        actualiza(idCliente, perfil(CLIENTE, "Nombre nuevo", ""), comoCliente())
                .andExpect(status().isOk());

        assertEquals("Nombre nuevo", deLaBaseDeDatos(idCliente).getNombre());
    }

    @Test
    void unClienteNoPuedeEditarAOtroUsuario() throws Exception {
        actualiza(idOtro, perfil(OTRO, "Cambiado", conRol(rolAdmin.getId())), comoCliente())
                .andExpect(status().isNotFound());

        User otro = deLaBaseDeDatos(idOtro);
        assertEquals("Prueba", otro.getNombre());
        assertFalse(roles(otro).contains(RoleEnum.ROLE_ADMIN));
    }

    @Test
    void unClienteNoPuedeListarNiBorrarUsuarios() throws Exception {
        mvc.perform(get("/usuarios").with(comoCliente())).andExpect(status().isForbidden());
        mvc.perform(delete("/usuarios/{id}", idOtro).with(comoCliente())).andExpect(status().isForbidden());

        assertTrue(userRepository.existsById(idOtro), "El usuario no debe haberse borrado");
    }

    @Test
    void controlUnAdministradorSiPuedeAsignarRoles() throws Exception {
        actualiza(idCliente, perfil(CLIENTE, "Prueba", conRol(rolAdmin.getId())), user("esc_admin").roles("ADMIN"))
                .andExpect(status().isOk());

        assertTrue(roles(deLaBaseDeDatos(idCliente)).contains(RoleEnum.ROLE_ADMIN),
                "Caso de control: el administrador si puede cambiar roles");
    }
}
