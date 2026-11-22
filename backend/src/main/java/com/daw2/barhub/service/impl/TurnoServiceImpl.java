package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionRepository;
import com.daw2.barhub.model.dto.TurnoDto;
import com.daw2.barhub.model.entity.Turno;
import com.daw2.barhub.model.enums.CierreTurno;
import com.daw2.barhub.model.repository.TurnoRepository;
import com.daw2.barhub.service.TurnoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class TurnoServiceImpl implements TurnoService {

    static final String ROL_EMPLEADO = "ROLE_EMPLEADO";
    private static final ZoneId ZONA = ZoneId.of("Europe/Madrid");

    private final TurnoRepository turnoRepository;
    private final SesionRepository sesionRepository;
    private final Clock reloj;

    public TurnoServiceImpl(TurnoRepository turnoRepository, SesionRepository sesionRepository, Clock reloj) {
        this.turnoRepository = turnoRepository;
        this.sesionRepository = sesionRepository;
        this.reloj = reloj;
    }

    @Override
    @Transactional
    public void abrirSiCorresponde(Long usuarioId, String username, Collection<String> roles) {
        if (!roles.contains(ROL_EMPLEADO)) {
            return;
        }
        Instant ahora = reloj.instant();
        Optional<Turno> abierto = turnoRepository.findFirstByUsuarioIdAndSalidaIsNullOrderByEntradaDesc(usuarioId);
        if (abierto.isPresent()) {
            if (tieneSesionAbierta(abierto.get(), ahora)) {
                // sigue trabajando en otro dispositivo: es el mismo turno
                return;
            }
            cerrarAutomaticamente(abierto.get(), ahora);
        }
        Turno turno = new Turno();
        turno.setUsuarioId(usuarioId);
        turno.setUsername(username);
        turno.setEntrada(ahora);
        turnoRepository.save(turno);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TurnoDto> actual(Long usuarioId) {
        Instant ahora = reloj.instant();
        return turnoRepository.findFirstByUsuarioIdAndSalidaIsNullOrderByEntradaDesc(usuarioId)
                .map(t -> TurnoDto.from(t, ahora));
    }

    @Override
    @Transactional
    public TurnoDto terminar(Long usuarioId) {
        Turno turno = turnoRepository.findFirstByUsuarioIdAndSalidaIsNullOrderByEntradaDesc(usuarioId)
                .orElseThrow(() -> new IllegalStateException("No tienes ningún turno abierto."));
        Instant ahora = reloj.instant();
        turno.setSalida(ahora);
        turno.setCierre(CierreTurno.TERMINADO);
        return TurnoDto.from(turno, ahora);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TurnoDto> listar(LocalDate desde, LocalDate hasta) {
        Instant ahora = reloj.instant();
        return turnoRepository.findByEntradaGreaterThanEqualAndEntradaLessThanOrderByEntradaDesc(
                        desde.atStartOfDay(ZONA).toInstant(), hasta.plusDays(1).atStartOfDay(ZONA).toInstant())
                .stream()
                .map(t -> TurnoDto.from(t, ahora))
                .toList();
    }

    @Override
    @Scheduled(fixedDelayString = "${app.turnos.revision:PT5M}")
    @Transactional
    public void cerrarTurnosSinSesion() {
        Instant ahora = reloj.instant();
        for (Turno turno : turnoRepository.findBySalidaIsNull()) {
            if (!tieneSesionAbierta(turno, ahora)) {
                cerrarAutomaticamente(turno, ahora);
            }
        }
    }

    private List<Sesion> sesionesDelTurno(Turno turno) {
        return sesionRepository.findByUsuarioIdAndCreadaGreaterThanEqual(turno.getUsuarioId(), turno.getEntrada());
    }

    private boolean tieneSesionAbierta(Turno turno, Instant ahora) {
        return sesionesDelTurno(turno).stream().anyMatch(s -> s.vigente(ahora));
    }

    /**
     * La salida es el ultimo momento con actividad real: cuando cerro sesion o, si caduco, su ultima
     * actividad. No se cuenta el tiempo que la sesion estuvo abierta sin nadie delante.
     */
    private void cerrarAutomaticamente(Turno turno, Instant ahora) {
        Instant salida = sesionesDelTurno(turno).stream()
                .map(s -> s.getRevocadaEn() != null ? s.getRevocadaEn() : s.getUltimaActividad())
                .max(Comparator.naturalOrder())
                .filter(fin -> fin.isAfter(turno.getEntrada()))
                .orElse(turno.getEntrada());
        turno.setSalida(salida.isAfter(ahora) ? ahora : salida);
        turno.setCierre(CierreTurno.AUTOMATICO);
        log.info("Turno {} de {} cerrado automáticamente: ya no tenía ninguna sesión abierta",
                turno.getId(), turno.getUsername());
    }
}
