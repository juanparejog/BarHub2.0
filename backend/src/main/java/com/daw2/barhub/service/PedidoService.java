package com.daw2.barhub.service;

import com.daw2.barhub.model.entity.Pedido;

import java.util.List;

public interface PedidoService {
    Pedido save(Pedido entity);

    List<Pedido> findAll();

    Pedido findById(long id);

    void delete(long id);

    Pedido update(long id, Pedido entity);

    List<Pedido> findByUsuarioIdWithDetalles(Long usuarioId);
}