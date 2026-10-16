package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.entity.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Pedido findById(long pedidoId);

    @Query("SELECT DISTINCT p FROM Pedido p " +
            "LEFT JOIN FETCH p.detalles d " +
            "LEFT JOIN FETCH d.producto " +
            "WHERE p.user.id = :usuarioId")
    List<Pedido> findByUsuarioIdWithDetalles(@Param("usuarioId") Long usuarioId);

    @Query("SELECT p FROM Pedido p LEFT JOIN FETCH p.detalles")
    List<Pedido> findAllWithDetalles();

    @Query("SELECT p FROM Pedido p WHERE LOWER(p.metodoPago) = 'efectivo' AND p.estadoPago = 'PENDIENTE'")
    List<Pedido> findPedidosPendientesEfectivo();

    // Consulta para la vista de cobro en caja en efectivo
    List<Pedido> findByMetodoPagoIgnoreCaseAndEstadoPago(String metodoPago, EstadoPago estadoPago);

    @Query("SELECT COALESCE(SUM(p.precioTotal), 0) FROM Pedido p " +
            "WHERE p.fecha BETWEEN :desde AND :hasta " +
            "AND LOWER(p.metodoPago) = 'efectivo' " +
            "AND p.estadoPago = com.daw2.barhub.model.Enum.EstadoPago.COMPLETADO")
    BigDecimal sumVentasEfectivoEntreFechas(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);

    @Query("SELECT COALESCE(SUM(p.precioTotal), 0) FROM Pedido p " +
            "WHERE p.fecha BETWEEN :desde AND :hasta " +
            "AND LOWER(p.metodoPago) = 'tarjeta' " +
            "AND p.estadoPago = com.daw2.barhub.model.Enum.EstadoPago.COMPLETADO")
    BigDecimal sumVentasTarjetaEntreFechas(@Param("desde") LocalDateTime desde, @Param("hasta") LocalDateTime hasta);
}