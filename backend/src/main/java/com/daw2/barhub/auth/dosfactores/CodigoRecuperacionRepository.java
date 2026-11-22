package com.daw2.barhub.auth.dosfactores;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface CodigoRecuperacionRepository extends JpaRepository<CodigoRecuperacion, Long> {

    Optional<CodigoRecuperacion> findFirstByUsuarioIdAndHuellaAndUsadoEnIsNull(Long usuarioId, String huella);

    long countByUsuarioIdAndUsadoEnIsNull(Long usuarioId);

    /** Marca el codigo como usado si nadie lo ha usado antes; devuelve 0 si ya estaba usado. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CodigoRecuperacion c set c.usadoEn = :ahora where c.id = :id and c.usadoEn is null")
    int marcarUsado(@Param("id") Long id, @Param("ahora") Instant ahora);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from CodigoRecuperacion c where c.usuarioId = :usuarioId")
    int borrarDe(@Param("usuarioId") Long usuarioId);
}
