package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.Enum.EstadoPedido;
import com.daw2.barhub.model.Enum.TipoPedido;
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

import java.util.Date;
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
                        .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
                pedidoExistente.setUser(usuario);
            }

            if (entity.getMesa() != null && entity.getMesa().getId() != null) {
                Mesa mesa = mesaRepository.findById(entity.getMesa().getId())
                        .orElseThrow(() -> new RuntimeException("Mesa no encontrada"));
                pedidoExistente.setMesa(mesa);
            }

            pedidoExistente.setFecha(entity.getFecha());
            pedidoExistente.setEstado(entity.getEstado());
            pedidoExistente.setPrecioTotal(entity.getPrecioTotal());

            return pedidoRepository.save(pedidoExistente);
        } else {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // MÉTODOS AÑADIDOS PARA SOPORTE DE CONTROLADOR, QR Y PEDIDOS A DOMICILIO
    // -------------------------------------------------------------------------

    @Override
    public List<Pedido> findByUsername(String username) {
        User usuario = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));
        return pedidoRepository.findByUsuarioIdWithDetalles(usuario.getId());
    }

    @Override
    @Transactional
    public Pedido crearPedidoSeguro(PedidoDto pedidoDto, String username) {
        Pedido pedido = new Pedido();

        // LÓGICA DE USUARIO / INVITADO (DENTRO DEL MÉTODO)
        String userAuth = (username != null) ? username :
                (SecurityContextHolder.getContext().getAuthentication() != null
                        ? SecurityContextHolder.getContext().getAuthentication().getName()
                        : null);

        if (userAuth != null && !userAuth.equals("anonymousUser")) {
            User usuario = userRepository.findByUsername(userAuth).orElse(null);
            pedido.setUser(usuario);
        } else {
            pedido.setUser(null); // Pedido de usuario anónimo/invitado
        }

        pedido.setFecha(new Date());
        pedido.setEstado(pedidoDto.getEstado() != null ? pedidoDto.getEstado() : EstadoPedido.pendiente);
        pedido.setPrecioTotal(pedidoDto.getPrecioTotal());
        pedido.setPaymentMethodId(pedidoDto.getPaymentMethodId());

        // Distinción entre pedido en MESA y DOMICILIO
        if (pedidoDto.getTipoPedido() == TipoPedido.DOMICILIO) {
            pedido.setTipoPedido(TipoPedido.DOMICILIO);
            pedido.setDireccionEnvio(pedidoDto.getDireccionEnvio());
            pedido.setTelefonoContacto(pedidoDto.getTelefonoContacto());
            pedido.setMesa(null);
        } else {
            pedido.setTipoPedido(TipoPedido.MESA);
            if (pedidoDto.getMesaId() != null) {
                Mesa mesa = mesaRepository.findById(pedidoDto.getMesaId()).orElse(null);
                if (mesa == null) {
                    throw new IllegalArgumentException("La mesa especificada no existe");
                }
                pedido.setMesa(mesa);
            } else {
                throw new IllegalArgumentException("Para pedidos en local es obligatorio seleccionar una mesa.");
            }
        }

        // Mapeo de detalles del pedido
        if (pedidoDto.getDetalles() != null && !pedidoDto.getDetalles().isEmpty()) {
            pedidoDto.getDetalles().forEach(detalleDto -> {
                DetallePedido detalle = new DetallePedido();
                detalle.setCantidad(detalleDto.getCantidad());
                detalle.setPrecioUnitario(detalleDto.getPrecioUnitario());
                detalle.setPedido(pedido);

                if (detalleDto.getProductoId() != null) {
                    Producto producto = productoRepository.findById(detalleDto.getProductoId()).orElse(null);
                    if (producto == null) {
                        throw new RuntimeException("Producto no encontrado id: " + detalleDto.getProductoId());
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

    public List<Pedido> findPedidosConDetallesByUsuarioId(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }

    public List<Pedido> findByUsuarioIdWithDetalles(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }
}