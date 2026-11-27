package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.sesion.SesionService;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.enums.EstadoMesa;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import jakarta.persistence.EntityManager;
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
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/**
 * Avisos en tiempo real: quien puede abrir cada canal, que recibe cada uno, que la conexion se corta
 * al cerrar la sesion y que guardar un pedido o una mesa publica el aviso.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@RecordApplicationEvents
class EventosEnTiempoRealIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.70";

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
    private EventosEnTiempoReal eventos;
    @Autowired
    private SesionService sesiones;
    @Autowired
    private MesaRepository mesaRepository;
    @Autowired
    private PedidoRepository pedidoRepository;
    @Autowired
    private ApplicationEvents publicados;
    @Autowired
    private EntityManager entityManager;

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

    private MockHttpServletRequestBuilder con(String token, MockHttpServletRequestBuilder peticion) {
        return peticion.header("Authorization", "Bearer " + token).with(p -> {
            p.setRemoteAddr(IP);
            return p;
        });
    }

    private MvcResult abrir(String token, String canal) throws Exception {
        return mvc.perform(con(token, get("/eventos/" + canal).accept(MediaType.TEXT_EVENT_STREAM)))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    private static String recibido(MvcResult conexion) throws Exception {
        return conexion.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    /** Si llego el aviso; Spring escribe {@code data: } con espacio y el estandar admite las dos formas. */
    private static boolean llego(String cuerpo, String tipo, long id) {
        return Pattern.compile("event:" + tipo + "\\ndata: ?\\{\"id\":" + id + "\\}").matcher(cuerpo).find();
    }

    @Test
    void sinSesionNoSeAbreYUnClienteNoEscuchaLasComandas() throws Exception {
        assertEquals(401, mvc.perform(get("/eventos/personal")).andReturn().getResponse().getStatus());
        assertEquals(401, mvc.perform(get("/eventos/mis-pedidos")).andReturn().getResponse().getStatus());

        crear("tr_ana", RoleEnum.ROLE_CLIENTE);
        String token = login.token("tr_ana", CLAVE);
        MockHttpServletResponse personal = mvc.perform(con(token, get("/eventos/personal"))).andReturn().getResponse();
        assertEquals(403, personal.getStatus());
    }

    @Test
    void elPersonalRecibeLosCambiosDeCualquierPedidoYDeLasMesas() throws Exception {
        crear("tr_beto", RoleEnum.ROLE_EMPLEADO);
        MvcResult conexion = abrir(login.token("tr_beto", CLAVE), "personal");
        assertEquals(MediaType.TEXT_EVENT_STREAM_VALUE, conexion.getResponse().getContentType().split(";")[0]);
        assertTrue(recibido(conexion).contains("event:conectado"));

        eventos.alCambiar(new CambioEnTiempoReal(CambioEnTiempoReal.PEDIDO, 4201L, 99_999L));
        eventos.alCambiar(new CambioEnTiempoReal(CambioEnTiempoReal.MESA, 7L, null));

        String cuerpo = recibido(conexion);
        assertTrue(llego(cuerpo, CambioEnTiempoReal.PEDIDO, 4201), cuerpo);
        assertTrue(llego(cuerpo, CambioEnTiempoReal.MESA, 7), cuerpo);
    }

    @Test
    void cadaClienteSoloRecibeLosDeSusPedidos() throws Exception {
        User carla = crear("tr_carla", RoleEnum.ROLE_CLIENTE);
        MvcResult conexion = abrir(login.token("tr_carla", CLAVE), "mis-pedidos");

        eventos.alCambiar(new CambioEnTiempoReal(CambioEnTiempoReal.PEDIDO, 4301L, carla.getId()));
        eventos.alCambiar(new CambioEnTiempoReal(CambioEnTiempoReal.PEDIDO, 4302L, carla.getId() + 1000));
        eventos.alCambiar(new CambioEnTiempoReal(CambioEnTiempoReal.MESA, 8L, null));

        String cuerpo = recibido(conexion);
        assertTrue(llego(cuerpo, CambioEnTiempoReal.PEDIDO, 4301), cuerpo);
        assertFalse(cuerpo.contains("4302"), "el pedido de otro cliente no le llega");
        assertFalse(cuerpo.contains("event:mesa"), "las mesas son solo para el personal");
    }

    @Test
    void alCerrarLaSesionElLatidoCortaLaConexion() throws Exception {
        User dani = crear("tr_dani", RoleEnum.ROLE_CLIENTE);
        abrir(login.token("tr_dani", CLAVE), "mis-pedidos");
        assertTrue(eventos.abiertas() >= 1);

        sesiones.cerrarTodas(dani.getId());
        eventos.latido();

        assertEquals(0, eventos.abiertas(), "ninguna conexion sobrevive a su sesion");
    }

    @Test
    void elPersonalCambiaElEstadoDeUnaMesaYSeAvisa() throws Exception {
        Mesa mesa = new Mesa();
        mesa.setCodigoqr("TR-QR-1");
        mesa.setEstado(EstadoMesa.DISPONIBLE);
        mesa = mesaRepository.saveAndFlush(mesa);
        crear("tr_eva", RoleEnum.ROLE_EMPLEADO);
        crear("tr_fede", RoleEnum.ROLE_CLIENTE);
        String empleado = login.token("tr_eva", CLAVE);
        String cliente = login.token("tr_fede", CLAVE);

        MockHttpServletResponse cambiado = mvc.perform(con(empleado, patch("/mesas/" + mesa.getId() + "/estado")
                .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"OCUPADA\"}"))).andReturn().getResponse();
        assertEquals(200, cambiado.getStatus());
        // El aviso sale al escribir en la base de datos (en produccion, al confirmar la transaccion)
        entityManager.flush();
        assertEquals(EstadoMesa.OCUPADA, mesaRepository.findById(mesa.getId()).orElseThrow().getEstado());
        Long id = mesa.getId();
        assertTrue(publicados.stream(CambioEnTiempoReal.class)
                .anyMatch(c -> CambioEnTiempoReal.MESA.equals(c.tipo()) && id.equals(c.id())));

        assertEquals(403, mvc.perform(con(cliente, patch("/mesas/" + mesa.getId() + "/estado")
                .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"DISPONIBLE\"}"))).andReturn().getResponse().getStatus());
        assertEquals(400, mvc.perform(con(empleado, patch("/mesas/" + mesa.getId() + "/estado")
                .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"ROTA\"}"))).andReturn().getResponse().getStatus());
    }

    @Test
    void guardarUnPedidoPublicaElAvisoConSuDueno() {
        User gema = crear("tr_gema", RoleEnum.ROLE_CLIENTE);
        Pedido pedido = new Pedido();
        pedido.setUser(gema);
        pedido.setTipoPedido(TipoPedido.RECOGER);
        pedido.setTelefonoContacto("600000000");
        pedido.setFecha(LocalDateTime.now());
        pedido.setEstado(EstadoPedido.PENDIENTE);
        pedido.setMetodoPago("efectivo");
        pedido.setEstadoPago(EstadoPago.PENDIENTE);
        pedido.setPrecioTotal(new BigDecimal("3.00"));
        Long id = pedidoRepository.saveAndFlush(pedido).getId();

        assertTrue(publicados.stream(CambioEnTiempoReal.class).anyMatch(c ->
                CambioEnTiempoReal.PEDIDO.equals(c.tipo()) && id.equals(c.id()) && gema.getId().equals(c.usuarioId())));
    }
}
