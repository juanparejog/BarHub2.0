package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.entity.Turno;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TurnoRepository extends JpaRepository<Turno, Long> {

    Optional<Turno> findFirstByUsuarioIdAndSalidaIsNullOrderByEntradaDesc(Long usuarioId);

    List<Turno> findBySalidaIsNull();

    List<Turno> findByEntradaGreaterThanEqualAndEntradaLessThanOrderByEntradaDesc(Instant desde, Instant hasta);

    /** Para que el empleado descargue su registro de jornada con el resto de sus datos. */
    List<Turno> findByUsuarioIdOrderByEntradaDesc(Long usuarioId);
}
