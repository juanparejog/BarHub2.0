package com.daw2.barhub.service;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.Pedido;

import java.math.BigDecimal;
import java.util.List;

public interface PedidoService {
    Pedido save(Pedido entity);

    List<Pedido> findAll();

    Pedido findById(long id);

    void delete(long id);

    Pedido update(long id, Pedido entity);

    List<Pedido> findByUsuarioIdWithDetalles(Long usuarioId);

    List<Pedido> findByUsername(String username);
    Pedido crearPedidoSeguro(PedidoDto pedidoDto, String username);

    /** Total de esas lineas con los precios de la carta; valida las lineas igual que al crear el pedido. */
    BigDecimal totalDe(List<DetallePedidoDto> detalles);
    Pedido updateFromDto(long id, PedidoDto pedidoDto);

    List<Pedido> findPedidosPendientesEfectivo();
}