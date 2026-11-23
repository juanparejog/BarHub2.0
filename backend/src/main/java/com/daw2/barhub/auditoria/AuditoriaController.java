package com.daw2.barhub.auditoria;

import com.daw2.barhub.model.dto.ErrorDto;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/** Consulta del registro de auditoria. Solo administradores, y solo lectura. */
@RestController
@RequestMapping("/auditoria")
@PreAuthorize("hasRole('ADMIN')")
public class AuditoriaController {

    private static final ZoneId ZONA = ZoneId.of("Europe/Madrid");

    private final AuditoriaService auditoria;

    public AuditoriaController(AuditoriaService auditoria) {
        this.auditoria = auditoria;
    }

    public record EventoDto(long fecha, String usuario, AccionAuditoria accion, ResultadoAuditoria resultado,
                            String ip, String objetivo, String detalle, String peticion) {
        static EventoDto from(EventoAuditoria e) {
            return new EventoDto(e.getFecha().toEpochMilli(), e.getUsuario(), e.getAccion(), e.getResultado(),
                    e.getIp(), e.getObjetivo(), e.getDetalle(), e.getPeticion());
        }
    }

    public record PaginaEventos(List<EventoDto> eventos, long total, int pagina, int paginas) {
    }

    /** Sin fechas, los ultimos 7 dias. Las fechas son dias completos en hora de Madrid. */
    @GetMapping
    public ResponseEntity<?> buscar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) String usuario,
            @RequestParam(required = false) AccionAuditoria accion,
            @RequestParam(required = false) ResultadoAuditoria resultado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        LocalDate fin = hasta != null ? hasta : LocalDate.now(ZONA);
        LocalDate inicio = desde != null ? desde : fin.minusDays(6);
        if (inicio.isAfter(fin)) {
            return ResponseEntity.badRequest().body(ErrorDto.from("'desde' no puede ser posterior a 'hasta'."));
        }
        if (usuario != null && usuario.length() > EventoAuditoria.LARGO_USUARIO) {
            return ResponseEntity.badRequest().body(ErrorDto.from("El usuario a buscar es demasiado largo."));
        }
        AuditoriaService.Filtro filtro = new AuditoriaService.Filtro(
                inicio.atStartOfDay(ZONA).toInstant(), fin.plusDays(1).atStartOfDay(ZONA).toInstant(),
                usuario, accion, resultado);
        Page<EventoAuditoria> encontrados = auditoria.buscar(filtro, pagina, tamano);
        return ResponseEntity.ok(new PaginaEventos(encontrados.getContent().stream().map(EventoDto::from).toList(),
                encontrados.getTotalElements(), encontrados.getNumber(), encontrados.getTotalPages()));
    }
}
