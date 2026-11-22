package com.daw2.barhub.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
import com.daw2.barhub.service.PedidoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class PedidoServiceImpl implements PedidoService {

    private static final ZoneId ZONA_LOCAL = ZoneId.of("Europe/Madrid");
    private static final int CANTIDAD_MAXIMA_POR_LINEA = 50;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Override
    public Pedido save(Pedido entity) {
        return pedidoRepository.save(entity);
    }

    @Override
    public List<Pedido> findAll() {
        return pedidoRepository.findAll();
    }

    @Override
    public Pedido findById(long id) {
        return pedidoRepository.findById(id);
    }

    @Override
    public void delete(long id) {
        Pedido pedido = pedidoRepository.findById(id);
        if (pedido != null) {
            pedidoRepository.delete(pedido);
        }
    }

    @Override
    @Transactional
    public Pedido update(long id, Pedido entity) {
        Pedido pedidoExistente = pedidoRepository.findById(id);

        if (pedidoExistente != null) {
            if (entity.getUser() != null && entity.getUser().getId() != null) {
                User usuario = userRepository.findById(entity.getUser().getId())
                        .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Usuario no encontrado"));
                pedidoExistente.setUser(usuario);
            }

            if (entity.getMesa() != null && entity.getMesa().getId() != null) {
                Mesa mesa = mesaRepository.findById(entity.getMesa().getId())
                        .orElseThrow(() -> new RuntimeException("Mesa no encontrada"));
                pedidoExistente.setMesa(mesa);
            }

            pedidoExistente.setFecha(entity.getFecha());
            pedidoExistente.setEstado(entity.getEstado());
            if (entity.getEstadoPago() != null) {
                pedidoExistente.setEstadoPago(entity.getEstadoPago());
            }
            pedidoExistente.setPrecioTotal(entity.getPrecioTotal());

            return pedidoRepository.save(pedidoExistente);
        } else {
            return null;
        }
    }

    @Override
    public List<Pedido> findByUsername(String username) {
        User usuario = userRepository.findByUsername(username)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Usuario no encontrado: " + username));
        return pedidoRepository.findByUsuarioIdWithDetalles(usuario.getId());
    }

    @Override
    @Transactional
    public Pedido crearPedidoSeguro(PedidoDto pedidoDto, String username) {
        Pedido pedido = new Pedido();
        pedido.setUser(buscarUsuarioDelPedido(username));
        pedido.setFecha(LocalDateTime.now(ZONA_LOCAL));
        // El estado nunca lo decide el cliente
        pedido.setEstado(EstadoPedido.PENDIENTE);
        pedido.setMetodoPago(pedidoDto.getMetodoPago());

        // NOTA: el pago con tarjeta es SIMULADO (modo demo): Stripe todavia no cobra.
        // Antes de usarlo con dinero real hay que verificar en el servidor el
        // PaymentIntent (estado succeeded e importe igual al total calculado aqui).
        pedido.setEstadoPago("tarjeta".equalsIgnoreCase(pedidoDto.getMetodoPago())
                ? EstadoPago.COMPLETADO
                : EstadoPago.PENDIENTE);

        asignarTipoDePedido(pedido, pedidoDto);
        agregarLineas(pedido, pedidoDto);

        return pedidoRepository.save(pedido);
    }

    private User buscarUsuarioDelPedido(String username) {
        String nombre = username;
        if (nombre == null) {
            Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
            nombre = (autenticacion != null) ? autenticacion.getName() : null;
        }
        if (nombre == null || nombre.equals("anonymousUser")) {
            return null;
        }
        return userRepository.findByUsername(nombre).orElse(null);
    }

    private void asignarTipoDePedido(Pedido pedido, PedidoDto pedidoDto) {
        TipoPedido tipo = pedidoDto.getTipoPedido();

        if (tipo == TipoPedido.DOMICILIO) {
            pedido.setTipoPedido(TipoPedido.DOMICILIO);
            pedido.setDireccionEnvio(pedidoDto.getDireccionEnvio());
            pedido.setTelefonoContacto(pedidoDto.getTelefonoContacto());
            pedido.setMesa(null);
        } else if (tipo == TipoPedido.RECOGER) {
            pedido.setTipoPedido(TipoPedido.RECOGER);
            pedido.setTelefonoContacto(pedidoDto.getTelefonoContacto());
            pedido.setDireccionEnvio(null);
            pedido.setMesa(null);
        } else if (tipo == TipoPedido.MESA) {
            pedido.setTipoPedido(TipoPedido.MESA);
            pedido.setDireccionEnvio(null);
            pedido.setMesa(buscarMesaDelPedido(pedidoDto));
        } else {
            throw new IllegalArgumentException("Debes seleccionar un tipo de pedido valido (MESA, DOMICILIO o RECOGER).");
        }
    }

    private Mesa buscarMesaDelPedido(PedidoDto pedidoDto) {
        Long mesaId = (pedidoDto.getMesaId() != null) ? pedidoDto.getMesaId() : pedidoDto.getIdMesa();
        if (mesaId == null) {
            throw new IllegalArgumentException("Para pedidos en local es obligatorio seleccionar una mesa.");
        }
        return mesaRepository.findById(mesaId)
                .orElseThrow(() -> new IllegalArgumentException("La mesa especificada no existe"));
    }

    // Las lineas: el precio sale SIEMPRE de la base de datos
    private void agregarLineas(Pedido pedido, PedidoDto pedidoDto) {
        if (pedidoDto.getDetalles() == null || pedidoDto.getDetalles().isEmpty()) {
            throw new IllegalArgumentException("El pedido debe incluir al menos un producto.");
        }

        BigDecimal total = BigDecimal.ZERO;
        for (DetallePedidoDto detalleDto : pedidoDto.getDetalles()) {
            DetallePedido detalle = crearDetalle(pedido, detalleDto);
            pedido.getDetalles().add(detalle);
            total = total.add(detalle.getPrecioUnitario().multiply(BigDecimal.valueOf(detalle.getCantidad())));
        }
        pedido.setPrecioTotal(total.setScale(2, RoundingMode.HALF_UP));
    }

    private DetallePedido crearDetalle(Pedido pedido, DetallePedidoDto detalleDto) {
        Long prodId = detalleDto.getIdProducto();
        Integer cantidad = detalleDto.getCantidad();

        if (prodId == null || cantidad == null || cantidad < 1 || cantidad > CANTIDAD_MAXIMA_POR_LINEA) {
            throw new IllegalArgumentException("Linea de pedido no valida.");
        }

        Producto producto = productoRepository.findById(prodId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no valido."));

        DetallePedido detalle = new DetallePedido();
        detalle.setPedido(pedido);
        detalle.setProducto(producto);
        detalle.setCantidad(cantidad);
        detalle.setPrecioUnitario(new BigDecimal(String.valueOf(producto.getPrecio()))
                .setScale(2, RoundingMode.HALF_UP));
        return detalle;
    }

    @Override
    @Transactional
    public Pedido updateFromDto(long id, PedidoDto pedidoDto) {
        Pedido pedidoExistente = pedidoRepository.findById(id);

        if (pedidoExistente != null) {
            if (pedidoDto.getEstado() != null) {
                pedidoExistente.setEstado(pedidoDto.getEstado());
            }
            if (pedidoDto.getEstadoPago() != null) {
                pedidoExistente.setEstadoPago(pedidoDto.getEstadoPago());
            }
            if (pedidoDto.getPrecioTotal() != null) {
                pedidoExistente.setPrecioTotal(pedidoDto.getPrecioTotal());
            }
            if (pedidoDto.getDireccionEnvio() != null) {
                pedidoExistente.setDireccionEnvio(pedidoDto.getDireccionEnvio());
            }
            if (pedidoDto.getTelefonoContacto() != null) {
                pedidoExistente.setTelefonoContacto(pedidoDto.getTelefonoContacto());
            }
            return pedidoRepository.save(pedidoExistente);
        }
        return null;
    }

    public List<Pedido> findPedidosPendientesEfectivo() {
        return pedidoRepository.findByMetodoPagoIgnoreCaseAndEstadoPago("efectivo", EstadoPago.PENDIENTE);
    }

    public List<Pedido> findPedidosConDetallesByUsuarioId(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }

    public List<Pedido> findByUsuarioIdWithDetalles(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }
}