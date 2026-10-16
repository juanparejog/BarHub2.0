package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
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
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;

    @GetMapping("/actual")
    public ResponseEntity<CajaDto> obtenerCajaActual() {
        return ResponseEntity.ok(cajaService.obtenerCajaActual());
    }

    @PostMapping("/abrir")
    public ResponseEntity<CajaDto> abrirCaja(@Valid @RequestBody AperturaCajaDto dto,
                                                     Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(cajaService.abrirCaja(dto, username));
    }

    @PutMapping("/cerrar")
    public ResponseEntity<CajaDto> cerrarCaja(@Valid @RequestBody CierreCajaDto dto,
                                                      Authentication authentication) {
        String username = authentication.getName();
        return ResponseEntity.ok(cajaService.cerrarCaja(dto, username));
    }

    @GetMapping("/historial")
    public ResponseEntity<List<CajaDto>> obtenerHistorial() {
        return ResponseEntity.ok(cajaService.obtenerHistorial());
    }
}