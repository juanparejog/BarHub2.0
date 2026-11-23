package com.daw2.barhub.auth.dosfactores;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SegundoFactorRepository extends JpaRepository<SegundoFactor, Long> {

    Optional<SegundoFactor> findByUsuarioId(Long usuarioId);

    @Query("select s.usuarioId from SegundoFactor s where s.activo = true")
    List<Long> usuariosConActiva();

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from SegundoFactor s where s.usuarioId = :usuarioId")
    int borrarDe(@Param("usuarioId") Long usuarioId);

    /**
     * Apunta el paso del codigo aceptado solo si es posterior al ultimo: devuelve 0 si otra peticion
     * ya ha usado ese codigo (o uno mas nuevo), asi que dos peticiones simultaneas no pasan las dos.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update SegundoFactor s set s.ultimoPaso = :paso "
            + "where s.id = :id and (s.ultimoPaso is null or s.ultimoPaso < :paso)")
    int marcarPaso(@Param("id") Long id, @Param("paso") long paso);
}
