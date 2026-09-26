package com.daw2.barhub.service;

import com.daw2.barhub.model.entity.DetallePedido;

import java.util.List;

public interface DetallePedidoService {
    DetallePedido save(DetallePedido entity);

    List<DetallePedido> findAll();

    DetallePedido findById(long id);

    void delete(long id);

    DetallePedido update(long id, DetallePedido entity);
}