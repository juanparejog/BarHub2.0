package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.entity.Caja;
import com.daw2.barhub.model.Enum.EstadoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CajaRepository extends JpaRepository<Caja, Long> {

    Optional<Caja> findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja estado);

    boolean existsByEstado(EstadoCaja estado);

    List<Caja> findAllByOrderByFechaAperturaDesc();
}