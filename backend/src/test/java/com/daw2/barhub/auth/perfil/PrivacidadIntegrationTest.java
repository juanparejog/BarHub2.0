package com.daw2.barhub.auth.perfil;

import com.daw2.barhub.auth.correo.CorreoService;
import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.enums.TipoProducto;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Pestaña Privacidad: descargar los datos de la cuenta y eliminarla. La eliminacion anonimiza: los
 * pedidos se quedan como registro de venta, pero sin nada que identifique a la persona, y la cuenta
 * no vuelve a abrirse.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PrivacidadIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.41";
    private static final String DIRECCION = "Calle Mayor 7, 2º B";
    private static final String TELEFONO = "600111222";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ProductoRepository productoRepository;
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

    private User crear(String username, RoleEnum rol) {
        Role role = roleRepository.findByName(rol)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(rol).build()));
        return userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .telefono(TELEFONO)
                .calle("Calle Mayor 7")
                .roles(new HashSet<>(Set.of(role)))
                .build());
    }

    private Long pedidoADomicilio(User cliente) {
        Producto producto = new Producto();
        producto.setNombre("Producto privacidad");
        producto.setPrecio(2.5);
        producto.setTipoProducto(TipoProducto.TAPA);
        productoRepository.saveAndFlush(producto);

        Pedido pedido = new Pedido();
        pedido.setUser(cliente);
        pedido.setTipoPedido(TipoPedido.DOMICILIO);
        pedido.setDireccionEnvio(DIRECCION);
        pedido.setTelefonoContacto(TELEFONO);
        pedido.setFecha(LocalDateTime.now());
        pedido.setEstado(EstadoPedido.PENDIENTE);
        pedido.setMetodoPago("efectivo");
        pedido.setEstadoPago(EstadoPago.PENDIENTE);
        pedido.setPrecioTotal(new BigDecimal("5.00"));
        DetallePedido detalle = new DetallePedido();
        detalle.setPedido(pedido);
        detalle.setProducto(producto);
        detalle.setCantidad(2);
        detalle.setPrecioUnitario(new BigDecimal("2.50"));
        pedido.getDetalles().add(detalle);
        return pedidoRepository.saveAndFlush(pedido).getId();
    }

    private MockHttpServletResponse con(String token, MockHttpServletRequestBuilder peticion) throws Exception {
        return mvc.perform(peticion.header("Authorization", "Bearer " + token).with(p -> {
            p.setRemoteAddr(IP);
            return p;
        })).andReturn().getResponse();
    }

    @Test
    void laDescargaLlevaLaCuentaLosPedidosYLasSesionesPeroNingunSecreto() throws Exception {
        User cliente = crear("pv_ana", RoleEnum.ROLE_CLIENTE);
        pedidoADomicilio(cliente);
        String token = login.token("pv_ana", CLAVE);

        MockHttpServletResponse respuesta = con(token, get("/perfil/mis-datos"));
        assertEquals(200, respuesta.getStatus());
        assertTrue(respuesta.getHeader("Content-Disposition").startsWith("attachment"));
        assertEquals("no-store", respuesta.getHeader("Cache-Control"));

        String cuerpo = respuesta.getContentAsString(StandardCharsets.UTF_8);
        Map<?, ?> datos = mapper.readValue(cuerpo, Map.class);
        Map<?, ?> cuenta = (Map<?, ?>) datos.get("cuenta");
        assertEquals("pv_ana", cuenta.get("usuario"));
        assertEquals("pv_ana@test.local", cuenta.get("correo"));
        assertEquals(List.of("ROLE_CLIENTE"), cuenta.get("roles"));
        assertEquals(TELEFONO, ((Map<?, ?>) datos.get("direccionEntrega")).get("telefono"));

        List<?> pedidos = (List<?>) datos.get("pedidos");
        assertEquals(1, pedidos.size());
        Map<?, ?> pedido = (Map<?, ?>) pedidos.get(0);
        assertEquals("DOMICILIO", pedido.get("tipo"));
        assertEquals(DIRECCION, pedido.get("direccionEnvio"));
        Map<?, ?> linea = (Map<?, ?>) ((List<?>) pedido.get("productos")).get(0);
        assertEquals("Producto privacidad", linea.get("producto"));
        assertEquals(2, linea.get("cantidad"));

        assertFalse(((List<?>) datos.get("sesiones")).isEmpty(), "incluye la sesion con la que se descarga");
        String hash = userRepository.findByUsername("pv_ana").orElseThrow().getPassword();
        assertFalse(cuerpo.contains(hash), "nunca la huella de la contrasena");
        assertFalse(cuerpo.toLowerCase().contains("password"));
        assertFalse(cuerpo.contains(token), "ni el token de la sesion");
    }

    @Test
    void eliminarLaCuentaLaAnonimizaConservaLosPedidosSinDatosYCierraLasSesiones() throws Exception {
        User cliente = crear("pv_beto", RoleEnum.ROLE_CLIENTE);
        Long id = cliente.getId();
        Long idPedido = pedidoADomicilio(cliente);
        String token = login.token("pv_beto", CLAVE);
        String otraSesion = login.token("pv_beto", CLAVE);

        assertEquals(204, con(token, delete("/perfil")).getStatus());

        User anonima = userRepository.findById(id).orElseThrow();
        assertEquals("eliminado-" + id, anonima.getUsername());
        assertEquals("eliminado-" + id + "@barhub.invalid", anonima.getEmail());
        assertEquals("Usuario", anonima.getNombre());
        assertNull(anonima.getTelefono());
        assertNull(anonima.getCalle());
        assertTrue(anonima.getRoles().isEmpty());
        assertNotNull(anonima.getEliminadoEn());
        assertFalse(passwordEncoder.matches(CLAVE, anonima.getPassword()));

        Pedido pedido = pedidoRepository.findById(idPedido).orElseThrow();
        assertEquals(id, pedido.getUser().getId(), "el pedido se queda como registro de venta");
        assertNull(pedido.getDireccionEnvio());
        assertNull(pedido.getTelefonoContacto());

        verify(correo).enviar(eq("pv_beto@test.local"), eq("Tu cuenta de BarHub se ha eliminado"), anyString());

        assertEquals(401, con(token, get("/perfil/seguridad")).getStatus());
        assertEquals(401, con(otraSesion, get("/perfil/seguridad")).getStatus());
        assertEquals(401, login.post("/auth/login", Map.of("username", "pv_beto", "password", CLAVE)).getStatus());
        assertTrue(userRepository.findByUsername("pv_beto").isEmpty(), "el nombre de usuario queda libre");
    }

    @Test
    void elPersonalNoPuedeEliminarSuCuentaDesdeElPerfil() throws Exception {
        crear("pv_carla", RoleEnum.ROLE_EMPLEADO);
        String token = login.token("pv_carla", CLAVE);

        assertEquals(400, con(token, delete("/perfil")).getStatus());
        User sigue = userRepository.findByUsername("pv_carla").orElseThrow();
        assertNull(sigue.getEliminadoEn());
        assertEquals(200, con(token, get("/perfil/seguridad")).getStatus());
    }

    @Test
    void sinSesionNoSeDescargaNiSeElimina() throws Exception {
        assertEquals(401, mvc.perform(get("/perfil/mis-datos")).andReturn().getResponse().getStatus());
        assertEquals(401, mvc.perform(delete("/perfil")).andReturn().getResponse().getStatus());
    }
}
