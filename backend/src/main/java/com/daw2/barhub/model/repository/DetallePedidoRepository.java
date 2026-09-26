package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.entity.DetallePedido;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DetallePedidoRepository extends JpaRepository<DetallePedido, Long> {
    DetallePedido findById(long id);

    DetallePedido findDetallePedidoById(long id);

    List<DetallePedido> findByPedidoId(Long pedidoId);
}