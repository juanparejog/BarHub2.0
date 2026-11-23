package com.daw2.barhub.auditoria;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface EventoAuditoriaRepository extends JpaRepository<EventoAuditoria, Long>, JpaSpecificationExecutor<EventoAuditoria> {

    List<EventoAuditoria> findTop100ByUsuarioIdOrderByFechaDescIdDesc(Long usuarioId);

    /** Al eliminar una cuenta: sus entradas se quedan, pero sin su nombre de usuario ni sus IP. */
    @Modifying
    @Query("update EventoAuditoria e set e.usuario = :nuevo, e.ip = null where e.usuarioId = :usuarioId or e.usuario = :anterior")
    int anonimizar(Long usuarioId, String anterior, String nuevo);

    @Modifying
    @Query("delete from EventoAuditoria e where e.fecha < :limite")
    int borrarAnterioresA(Instant limite);
}
