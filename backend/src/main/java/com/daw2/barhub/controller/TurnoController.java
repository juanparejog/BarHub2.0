package com.daw2.barhub.controller;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.TurnoDto;
import com.daw2.barhub.service.TurnoService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/** Registro de jornada: el empleado ve y termina su turno; el administrador consulta todos. */
@RestController
@RequestMapping("/turnos")
public class TurnoController {

    /** Como mucho un ano por consulta. */
    static final long DIAS_MAXIMOS = 366;
    private static final ZoneId ZONA = ZoneId.of("Europe/Madrid");

    private final TurnoService turnoService;

    public TurnoController(TurnoService turnoService) {
        this.turnoService = turnoService;
    }

    @GetMapping("/actual")
    public ResponseEntity<TurnoDto> actual(Authentication authentication) {
        return turnoService.actual(usuarioId(authentication))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/terminar")
    public ResponseEntity<?> terminar(Authentication authentication) {
        try {
            return ResponseEntity.ok(turnoService.terminar(usuarioId(authentication)));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorDto.from(e.getMessage()));
        }
    }

    /** Solo administradores (ver SecurityConfig). Sin fechas, los ultimos 7 dias. */
    @GetMapping
    public ResponseEntity<?> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        LocalDate fin = hasta != null ? hasta : LocalDate.now(ZONA);
        LocalDate inicio = desde != null ? desde : fin.minusDays(6);
        if (inicio.isAfter(fin) || ChronoUnit.DAYS.between(inicio, fin) >= DIAS_MAXIMOS) {
            return ResponseEntity.badRequest()
                    .body(ErrorDto.from("Rango de fechas no válido: como mucho un año, y 'desde' no puede ser posterior a 'hasta'."));
        }
        return ResponseEntity.ok(turnoService.listar(inicio, fin));
    }

    private static Long usuarioId(Authentication authentication) {
        return ((UserDetailsImpl) authentication.getPrincipal()).getId();
    }
}
