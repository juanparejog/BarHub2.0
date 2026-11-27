package com.daw2.barhub.pago;

import com.daw2.barhub.auth.correo.CorreoService;
import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.enums.TipoProducto;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Pago con tarjeta de punta a punta, con Stripe sustituido por un doble: el importe lo calcula el
 * servidor, un pedido con tarjeta solo queda pagado si el pago esta cobrado y coincide, y un pago
 * vale para un solo pedido.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PagoIntegrationTest {

    private static final String CLAVE = "Secreto123";
    private static final String IP = "192.0.2.90";
    private static final String PAGO = "pi_3QpruebaABCDEFGH";

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
    private ProductoRepository productoRepository;
    @Autowired
    private PedidoRepository pedidoRepository;
    @MockitoBean
    private PasarelaPago pasarela;
    @MockitoBean
    private CorreoService correo;

    private Long idCliente;
    private Long idProducto;
    private String token;

    @BeforeEach
    void preparar() throws Exception {
        Role rol = roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(RoleEnum.ROLE_CLIENTE).build()));
        User cliente = userRepository.saveAndFlush(User.builder()
                .username("pago_ana")
                .email("pago_ana@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(rol)))
                .build());
        idCliente = cliente.getId();
        Producto producto = new Producto();
        producto.setNombre("Producto de pago");
        producto.setPrecio(2.5);
        producto.setTipoProducto(TipoProducto.TAPA);
        idProducto = productoRepository.saveAndFlush(producto).getId();
        token = new LoginDePrueba(mvc, mapper, IP).token("pago_ana", CLAVE);

        when(pasarela.disponible()).thenReturn(true);
        when(pasarela.enPruebas()).thenReturn(true);
        when(pasarela.clavePublica()).thenReturn("pk_test_publica");
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse enviar(MockHttpServletRequestBuilder peticion, String cuerpo, boolean conSesion) throws Exception {
        if (conSesion) {
            peticion.header("Authorization", "Bearer " + token);
        }
        if (cuerpo != null) {
            peticion.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
        }
        return mvc.perform(peticion.with(p -> {
            p.setRemoteAddr(IP);
            return p;
        })).andReturn().getResponse();
    }

    private Map<?, ?> json(MockHttpServletResponse respuesta) throws Exception {
        return mapper.readValue(respuesta.getContentAsString(StandardCharsets.UTF_8), Map.class);
    }

    /** Dos del producto; el precio que manda el cliente (0,01) no cuenta. */
    private String lineas() {
        return "[{\"id_producto\":" + idProducto + ",\"cantidad\":2,\"precio_unitario\":0.01}]";
    }

    private String pedidoConTarjeta(String pagoId) {
        return "{\"tipo_pedido\":\"RECOGER\",\"telefono_contacto\":\"600000000\",\"metodo_pago\":\"TARJETA\","
                + "\"estado_pago\":\"COMPLETADO\",\"precio_total\":0.02,"
                + (pagoId == null ? "" : "\"pago_id\":\"" + pagoId + "\",")
                + "\"detalles\":" + lineas() + "}";
    }

    private void enStripe(String estado, long centimos, Long usuario) {
        DetallePedidoDto linea = new DetallePedidoDto();
        linea.setIdProducto(idProducto);
        linea.setCantidad(2);
        when(pasarela.consultar(PAGO)).thenReturn(Optional.of(
                new PasarelaPago.Consulta(PAGO, estado, centimos, "eur", VerificacionPago.metadatos(List.of(linea), usuario))));
    }

    @Test
    void laConfiguracionEsPublicaYSoloLlevaLaClavePublicable() throws Exception {
        MockHttpServletResponse respuesta = enviar(get("/pagos/configuracion"), null, false);
        assertEquals(200, respuesta.getStatus());
        Map<?, ?> configuracion = json(respuesta);
        assertEquals(true, configuracion.get("tarjeta"));
        assertEquals("pk_test_publica", configuracion.get("clavePublica"));
        assertEquals(true, configuracion.get("pruebas"));
        assertFalse(respuesta.getContentAsString().contains("sk_"));
    }

    @Test
    void elIntentoDePagoEsPorElImporteDelServidorYQuedaAtadoAlUsuarioYAlCarrito() throws Exception {
        when(pasarela.crear(anyLong(), anyString(), anyMap(), anyString()))
                .thenReturn(new PasarelaPago.Intento(PAGO, PAGO + "_secret_abc"));

        MockHttpServletResponse respuesta = enviar(post("/pagos/intento"), "{\"detalles\":" + lineas() + "}", true);

        assertEquals(201, respuesta.getStatus(), respuesta.getContentAsString());
        Map<?, ?> intento = json(respuesta);
        assertEquals(PAGO, intento.get("id"));
        assertEquals(PAGO + "_secret_abc", intento.get("clientSecret"));
        assertEquals(5.0, ((Number) intento.get("importe")).doubleValue());
        verify(pasarela).crear(eq(500L), eq("eur"), eq(VerificacionPago.metadatos(List.of(linea()), idCliente)), anyString());
    }

    private DetallePedidoDto linea() {
        DetallePedidoDto linea = new DetallePedidoDto();
        linea.setIdProducto(idProducto);
        linea.setCantidad(2);
        return linea;
    }

    @Test
    void sinProductosOConUnProductoQueNoExisteNoHayIntento() throws Exception {
        assertEquals(400, enviar(post("/pagos/intento"), "{\"detalles\":[]}", true).getStatus());
        assertEquals(400, enviar(post("/pagos/intento"), "{\"detalles\":[{\"id_producto\":999999,\"cantidad\":1}]}", true).getStatus());
        verify(pasarela, never()).crear(anyLong(), anyString(), anyMap(), anyString());
    }

    @Test
    void conElPagoCobradoElPedidoQuedaPagadoYElMismoPagoNoSirveParaOtro() throws Exception {
        enStripe("succeeded", 500, idCliente);

        MockHttpServletResponse creado = enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true);
        assertEquals(201, creado.getStatus(), creado.getContentAsString());
        assertTrue(creado.getContentAsString().contains("\"estadoPago\":\"COMPLETADO\""));
        // El id del pago no se devuelve
        assertFalse(creado.getContentAsString().contains(PAGO));
        assertTrue(pedidoRepository.existsByPagoId(PAGO));

        MockHttpServletResponse otra = enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true);
        assertEquals(409, otra.getStatus());
    }

    @Test
    void sinPagoOConUnPagoSinCobrarNoSeCreaElPedido() throws Exception {
        long antes = pedidoRepository.count();
        assertEquals(400, enviar(post("/pedidos"), pedidoConTarjeta(null), true).getStatus());

        enStripe("requires_payment_method", 500, idCliente);
        assertEquals(402, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true).getStatus());

        when(pasarela.consultar(PAGO)).thenReturn(Optional.empty());
        assertEquals(400, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true).getStatus());
        assertEquals(antes, pedidoRepository.count());
    }

    @Test
    void unPagoDeOtroUsuarioOAnonimoNoValeYNoSeDevuelve() throws Exception {
        enStripe("succeeded", 500, null);
        assertEquals(403, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true).getStatus());
        // Y el pago de un usuario tampoco vale para un pedido sin sesion
        enStripe("succeeded", 500, idCliente);
        assertEquals(403, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), false).getStatus());
        verify(pasarela, never()).devolver(anyString());
    }

    @Test
    void unPagoPorOtroImporteSeDevuelveYNoHayPedido() throws Exception {
        long antes = pedidoRepository.count();
        enStripe("succeeded", 1, idCliente);

        assertEquals(409, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true).getStatus());

        verify(pasarela).devolver(PAGO);
        assertEquals(antes, pedidoRepository.count());
    }

    @Test
    void sinTarjetaDisponibleSeSiguePidiendoEnEfectivoYElClienteNoLoDaPorPagado() throws Exception {
        when(pasarela.disponible()).thenReturn(false);
        when(pasarela.clavePublica()).thenReturn(null);

        assertEquals(false, json(enviar(get("/pagos/configuracion"), null, false)).get("tarjeta"));
        assertEquals(503, enviar(post("/pagos/intento"), "{\"detalles\":" + lineas() + "}", true).getStatus());
        assertEquals(503, enviar(post("/pedidos"), pedidoConTarjeta(PAGO), true).getStatus());

        String enEfectivo = pedidoConTarjeta(PAGO).replace("TARJETA", "EFECTIVO");
        MockHttpServletResponse creado = enviar(post("/pedidos"), enEfectivo, true);
        assertEquals(201, creado.getStatus(), creado.getContentAsString());
        assertTrue(creado.getContentAsString().contains("\"estadoPago\":\"PENDIENTE\""));
        assertFalse(pedidoRepository.existsByPagoId(PAGO));
    }
}
