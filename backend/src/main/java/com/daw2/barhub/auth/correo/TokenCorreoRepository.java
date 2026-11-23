package com.daw2.barhub.auth.correo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TokenCorreoRepository extends JpaRepository<TokenCorreo, Long> {

    Optional<TokenCorreo> findByTokenHash(String tokenHash);

    List<TokenCorreo> findByUsuarioIdAndTipoAndUsadoEnIsNull(Long usuarioId, TipoTokenCorreo tipo);

    Optional<TokenCorreo> findFirstByUsuarioIdAndTipoOrderByCreadoDesc(Long usuarioId, TipoTokenCorreo tipo);

    /** Anula todos los enlaces pendientes de un usuario (al eliminar su cuenta). */
    @Modifying
    @Query("update TokenCorreo t set t.usadoEn = :ahora where t.usuarioId = :usuarioId and t.usadoEn is null")
    int anularDe(@Param("usuarioId") Long usuarioId, @Param("ahora") Instant ahora);

    @Modifying
    @Query("delete from TokenCorreo t where t.caducaEn < :limite")
    int borrarCaducadosAntesDe(@Param("limite") Instant limite);
}
