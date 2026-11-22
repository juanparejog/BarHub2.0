package com.daw2.barhub.auth.sesion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SesionRepository extends JpaRepository<Sesion, String> {

    Optional<Sesion> findByTokenHash(String tokenHash);

    Optional<Sesion> findByTokenAnteriorHash(String tokenAnteriorHash);

    List<Sesion> findByUsuarioIdAndCreadaGreaterThanEqual(Long usuarioId, Instant desde);

    @Modifying
    @Query("delete from Sesion s where s.caducaEn < :limite or s.revocadaEn < :limite")
    int borrarAnterioresA(@Param("limite") Instant limite);
}
