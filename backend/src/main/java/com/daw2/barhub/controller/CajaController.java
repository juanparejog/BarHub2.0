package com.daw2.barhub.controller;

import com.daw2.barhub.auditoria.AccionAuditoria;
import com.daw2.barhub.auditoria.Auditar;
import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.service.CajaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/caja")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    /** 200 con la caja abierta, o 204 sin cuerpo si no hay ninguna: es un estado normal, no un error. */
    @GetMapping("/actual")
    public ResponseEntity<CajaDto> obtenerCajaActual() {
        return cajaService.obtenerCajaActual()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** 409 si ya hay una caja abierta, con el motivo para mostrarlo al empleado. */
    @PostMapping("/abrir")
    @Auditar(AccionAuditoria.CAJA_ABIERTA)
    public ResponseEntity<?> abrirCaja(@Valid @RequestBody AperturaCajaDto dto,
                                       Authentication authentication) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.abrirCaja(dto, authentication.getName()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorDto.from(e.getMessage()));
        }
    }

    /** 409 si no hay ninguna caja abierta que cerrar. */
    @PutMapping("/cerrar")
    @Auditar(AccionAuditoria.CAJA_CERRADA)
    public ResponseEntity<?> cerrarCaja(@Valid @RequestBody CierreCajaDto dto,
                                        Authentication authentication) {
        try {
            return ResponseEntity.ok(cajaService.cerrarCaja(dto, authentication.getName()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorDto.from(e.getMessage()));
        }
    }

    @GetMapping("/historial")
    public ResponseEntity<List<CajaDto>> obtenerHistorial() {
        return ResponseEntity.ok(cajaService.obtenerHistorial());
    }
}