package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.Enum.MetodoPago;
import com.daw2.barhub.model.entity.Pago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PagoRepository extends JpaRepository<Pago, Long> {
    Pago findById(long id);

    Pago findPagoById(long id);

    @Query("SELECT p FROM Pago p WHERE p.metodoPago = :metodo AND p.estadoPago = :estado")
    List<Pago> findByMetodoAndEstado(
            @Param("metodo") MetodoPago metodo,
            @Param("estado") EstadoPago estado
    );
}