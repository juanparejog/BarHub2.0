package com.daw2.barhub.controller;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.enums.EstadoMesa;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.enums.TipoProducto;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Con {@code spring.jpa.open-in-view: false} no hay sesion de Hibernate al convertir a DTO en el
 * controlador: si una relacion perezosa (detalles del pedido, roles del usuario) no se ha cargado
 * antes, la respuesta fallaria con LazyInitializationException. Cada endpoint que la recorre se
 * prueba aqui de punta a punta.
 *
 * <p>La clase no es {@code @Transactional} a proposito: una transaccion en el test mantendria la
 * sesion abierta durante la peticion y ocultaria el fallo. Los datos se borran en {@code @AfterEach}.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CargaPerezosaIntegrationTest {

    private static final String CLIENTE = "perezosa_cli";
    private static final String PRODUCTO = "Producto carga perezosa";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private ProductoRepository productoRepository;
    @Autowired
    private MesaRepository mesaRepository;
    @Autowired
    private PedidoRepository pedidoRepository;

    private Long idCliente;
    private Long idProducto;
    private Long idMesa;
    private Long idPedido;

    @BeforeEach
    void preparar() {
        Role rolCliente = roleRepository.findAll().stream()
                .filter(r -> r.getName() == RoleEnum.ROLE_CLIENTE)
                .findFirst()
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(RoleEnum.ROLE_CLIENTE).build()));

        User cliente = userRepository.saveAndFlush(User.builder()
                .username(CLIENTE)
                .email(CLIENTE + "@test.local")
                .password("no-se-usa-en-estas-pruebas")
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(rolCliente)))
                .build());
        idCliente = cliente.getId();

        Producto producto = new Producto();
        producto.setNombre(PRODUCTO);
        producto.setPrecio(2.5);
        producto.setTipoProducto(TipoProducto.TAPA);
        idProducto = productoRepository.saveAndFlush(producto).getId();

        Mesa mesa = new Mesa();
        mesa.setCodigoqr("perezosa-mesa");
        mesa.setEstado(EstadoMesa.DISPONIBLE);
        idMesa = mesaRepository.saveAndFlush(mesa).getId();

        Pedido pedido = new Pedido();
        pedido.setUser(cliente);
        pedido.setMesa(mesa);
        pedido.setTipoPedido(TipoPedido.MESA);
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
        idPedido = pedidoRepository.saveAndFlush(pedido).getId();
    }

    @AfterEach
    void limpiar() {
        // en orden inverso al de creacion; los null cubren un fallo a medias en preparar()
        if (idPedido != null) {
            pedidoRepository.deleteById(idPedido);
        }
        if (idMesa != null) {
            mesaRepository.deleteById(idMesa);
        }
        if (idProducto != null) {
            productoRepository.deleteById(idProducto);
        }
        if (idCliente != null) {
            userRepository.deleteById(idCliente);
        }
    }

    private static RequestPostProcessor comoEmpleado() {
        return user("perezosa_emp").roles("EMPLEADO");
    }

    private static RequestPostProcessor comoAdmin() {
        return user("perezosa_admin").roles("ADMIN");
    }

    // ---------- pedidos (detalles perezosos) ----------

    @Test
    void listadoDePedidosIncluyeLosDetalles() throws Exception {
        mvc.perform(get("/pedidos").with(comoEmpleado()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + idPedido + ")].detalles[*].producto_nombre", hasItem(PRODUCTO)));
    }

    @Test
    void pedidoPorIdIncluyeDetallesMesaYUsuario() throws Exception {
        mvc.perform(get("/pedidos/{id}", idPedido).with(comoEmpleado()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.detalles.length()").value(1))
                .andExpect(jsonPath("$.detalles[0].producto_nombre").value(PRODUCTO))
                .andExpect(jsonPath("$.id_mesa").value(idMesa))
                .andExpect(jsonPath("$.id_user").value(idCliente));
    }

    @Test
    void pendientesEnEfectivoIncluyenLosDetalles() throws Exception {
        mvc.perform(get("/pedidos/pendientes-efectivo").with(comoEmpleado()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + idPedido + ")].detalles[*].cantidad", hasItem(2)));
    }

    @Test
    void misPedidosIncluyeLosDetalles() throws Exception {
        mvc.perform(get("/pedidos/mis-pedidos").with(user(CLIENTE).roles("CLIENTE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].detalles[0].producto_nombre").value(PRODUCTO));
    }

    @Test
    void actualizarPedidoDevuelveLosDetalles() throws Exception {
        mvc.perform(put("/pedidos/{id}", idPedido).with(comoEmpleado())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\":\"PREPARADO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("PREPARADO"))
                .andExpect(jsonPath("$.detalles.length()").value(1));
    }

    @Test
    void seguimientoPorIdIncluyeLosDetalles() throws Exception {
        mvc.perform(get("/seguimientos/{id}", idPedido).with(comoEmpleado()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.detalles.length()").value(1));
    }

    @Test
    void actualizarSeguimientoDevuelveElPedidoComoDto() throws Exception {
        mvc.perform(put("/seguimientos/{id}", idPedido).with(comoEmpleado())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\":\"PREPARADO\",\"precioTotal\":5.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("PREPARADO"))
                .andExpect(jsonPath("$.detalles[0].producto_nombre").value(PRODUCTO));
    }

    // ---------- usuarios (roles perezosos) ----------

    @Test
    void listadoDeUsuariosIncluyeLosRoles() throws Exception {
        mvc.perform(get("/usuarios/").with(comoAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == '" + CLIENTE + "')].roles[*].nombre", hasItem("ROLE_CLIENTE")));
    }

    @Test
    void usuarioPorIdIncluyeLosRoles() throws Exception {
        mvc.perform(get("/usuarios/{id}", idCliente).with(comoAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles.length()").value(1));
    }
}
