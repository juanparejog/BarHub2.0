package com.daw2.barhub.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Comprueba la matriz de permisos de SecurityConfig: quien no debe entrar, no entra.
 * Las respuestas 401 y 403 las decide la seguridad antes de llegar a ningun controlador.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadRutasTest {

    @Autowired
    private MockMvc mvc;

    /** Pasa si la seguridad deja llegar la peticion al controlador (aunque este responda un error). */
    private void assertPermitido(MockHttpServletRequestBuilder peticion) {
        try {
            int estado = mvc.perform(peticion).andReturn().getResponse().getStatus();
            assertNotEquals(401, estado);
            assertNotEquals(403, estado);
        } catch (Exception e) {
            // La excepcion procede del controlador: la peticion paso el filtro de seguridad.
        }
    }

    // ---------- sin sesion ----------

    @Test
    void sinSesionLasRutasDeAdministracionDan401() throws Exception {
        mvc.perform(get("/usuarios")).andExpect(status().isUnauthorized());
        mvc.perform(get("/roles")).andExpect(status().isUnauthorized());
        mvc.perform(get("/caja/actual")).andExpect(status().isUnauthorized());
        mvc.perform(get("/pedidos")).andExpect(status().isUnauthorized());
        mvc.perform(get("/pedidos/mis-pedidos")).andExpect(status().isUnauthorized());
        mvc.perform(post("/productos").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sinSesionSePuedenVerLaCartaYLasMesasYCrearPedidos() {
        assertPermitido(get("/productos"));
        assertPermitido(get("/mesas"));
        assertPermitido(get("/actuator/health"));
        assertPermitido(post("/pedidos").contentType(MediaType.APPLICATION_JSON).content("{}"));
    }

    // ---------- cliente: no puede escalar privilegios ----------

    @Test
    @WithMockUser(roles = "CLIENTE")
    void unClienteNoAccedeALaAdministracion() throws Exception {
        mvc.perform(get("/usuarios")).andExpect(status().isForbidden());
        mvc.perform(get("/roles")).andExpect(status().isForbidden());
        mvc.perform(post("/productos").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/mesas/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "CLIENTE")
    void unClienteNoAccedeALaGestionDelPersonal() throws Exception {
        mvc.perform(get("/caja/actual")).andExpect(status().isForbidden());
        mvc.perform(get("/pedidos")).andExpect(status().isForbidden());
        mvc.perform(get("/detalles_pedidos/1")).andExpect(status().isForbidden());
        mvc.perform(get("/seguimientos/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "CLIENTE")
    void unClientePuedeVerSusPropiosPedidos() {
        assertPermitido(get("/pedidos/mis-pedidos"));
    }

    // ---------- empleado ----------

    @Test
    @WithMockUser(roles = "EMPLEADO")
    void unEmpleadoNoAccedeALaAdministracion() throws Exception {
        mvc.perform(get("/usuarios")).andExpect(status().isForbidden());
        mvc.perform(get("/roles")).andExpect(status().isForbidden());
        mvc.perform(post("/productos").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/mesas/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "EMPLEADO")
    void unEmpleadoPuedeGestionarPedidosYCaja() {
        assertPermitido(get("/pedidos"));
        assertPermitido(get("/caja/actual"));
    }

    // ---------- administrador ----------

    @Test
    @WithMockUser(roles = "ADMIN")
    void unAdministradorPuedeEntrarEnLaAdministracion() {
        assertPermitido(get("/usuarios"));
        assertPermitido(get("/roles"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void cualquierRutaNoPrevistaQuedaDenegadaIncluidoParaElAdministrador() throws Exception {
        mvc.perform(get("/ruta-que-no-existe")).andExpect(status().isForbidden());
    }
}
