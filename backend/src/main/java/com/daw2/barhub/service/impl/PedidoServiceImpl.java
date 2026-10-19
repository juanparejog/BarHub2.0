package com.daw2.barhub.service.impl;

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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PedidoServiceImpl implements PedidoService {

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

        String userAuth = (username != null) ? username :
                (SecurityContextHolder.getContext().getAuthentication() != null
                        ? SecurityContextHolder.getContext().getAuthentication().getName()
                        : null);

        if (userAuth != null && !userAuth.equals("anonymousUser")) {
            User usuario = userRepository.findByUsername(userAuth).orElse(null);
            pedido.setUser(usuario);
        } else {
            pedido.setUser(null);
        }

        pedido.setFecha(LocalDateTime.now());
        pedido.setEstado(pedidoDto.getEstado() != null ? pedidoDto.getEstado() : EstadoPedido.PENDIENTE);
        pedido.setPrecioTotal(pedidoDto.getPrecioTotal());
        pedido.setMetodoPago(pedidoDto.getMetodoPago());

        if (pedidoDto.getMetodoPago() != null && pedidoDto.getMetodoPago().equalsIgnoreCase("tarjeta")) {
            pedido.setEstadoPago(EstadoPago.COMPLETADO);
        } else if (pedidoDto.getEstadoPago() != null) {
            pedido.setEstadoPago(pedidoDto.getEstadoPago());
        } else {
            pedido.setEstadoPago(EstadoPago.PENDIENTE);
        }

        // --- GESTIÓN CORRECTA DE LOS TRES TIPOS DE PEDIDO ---
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

            // Obtener idMesa soporta tanto getMesaId() como getIdMesa()
            Long mesaId = (pedidoDto.getMesaId() != null) ? pedidoDto.getMesaId() : pedidoDto.getIdMesa();

            if (mesaId != null) {
                Mesa mesa = mesaRepository.findById(mesaId).orElse(null);
                if (mesa == null) {
                    throw new IllegalArgumentException("La mesa especificada no existe");
                }
                pedido.setMesa(mesa);
            } else {
                throw new IllegalArgumentException("Para pedidos en local es obligatorio seleccionar una mesa.");
            }

        } else {
            throw new IllegalArgumentException("Debes seleccionar un tipo de pedido válido (MESA, DOMICILIO o RECOGER).");
        }

        if (pedidoDto.getDetalles() != null && !pedidoDto.getDetalles().isEmpty()) {
            pedidoDto.getDetalles().forEach(detalleDto -> {
                DetallePedido detalle = new DetallePedido();
                detalle.setCantidad(detalleDto.getCantidad());
                detalle.setPrecioUnitario(detalleDto.getPrecioUnitario());
                detalle.setPedido(pedido);

                Long prodId = (detalleDto.getProductoId() != null) ? detalleDto.getProductoId() : detalleDto.getIdProducto();

                if (prodId != null) {
                    Producto producto = productoRepository.findById(prodId).orElse(null);
                    if (producto == null) {
                        throw new jakarta.persistence.EntityNotFoundException("Producto no encontrado id: " + prodId);
                    }
                    detalle.setProducto(producto);
                }
                pedido.getDetalles().add(detalle);
            });
        }

        return pedidoRepository.save(pedido);
    }

    @Override
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