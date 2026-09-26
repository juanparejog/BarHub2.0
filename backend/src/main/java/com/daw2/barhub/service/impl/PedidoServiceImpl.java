package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.service.PedidoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PedidoServiceImpl implements PedidoService {

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public Pedido save(Pedido entity) {
        return pedidoRepository.save(entity);
    }

    @Override
    public List<Pedido> findAll() {
        List<Pedido> pedidos = pedidoRepository.findAll();

        return pedidos;
    }

    @Override
    public Pedido findById(long id) {
        Pedido pedido = pedidoRepository.findById(id);

        return pedido;
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
                pedidoExistente.setUser(null);
                //pedidoExistente.setUserId(getUserId());

                //PedidoDto pedidoDto = new PedidoDto();

                //pedidoDto.setId(id);
                //Long idUser = pedidoDto.setIdUser(pedidoExistente.getUser().getId());

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

    public List<Pedido> findPedidosConDetallesByUsuarioId(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }

    public List<Pedido> findByUsuarioIdWithDetalles(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdWithDetalles(usuarioId);
    }
}