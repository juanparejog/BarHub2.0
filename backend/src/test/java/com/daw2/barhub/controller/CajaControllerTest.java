package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.enums.EstadoCaja;
import com.daw2.barhub.service.CajaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CajaControllerTest {

    @Mock
    private CajaService cajaService;

    @InjectMocks
    private CajaController controller;

    private final Authentication empleado = new UsernamePasswordAuthenticationToken("juan", null, List.of());

    @Test
    void sinCajaAbiertaRespondeSinContenidoEnLugarDeError() {
        when(cajaService.obtenerCajaActual()).thenReturn(Optional.empty());

        ResponseEntity<CajaDto> respuesta = controller.obtenerCajaActual();

        assertEquals(HttpStatus.NO_CONTENT, respuesta.getStatusCode());
        assertNull(respuesta.getBody());
    }

    @Test
    void conCajaAbiertaLaDevuelve() {
        CajaDto caja = CajaDto.builder().id(7L).estado(EstadoCaja.ABIERTA).build();
        when(cajaService.obtenerCajaActual()).thenReturn(Optional.of(caja));

        ResponseEntity<CajaDto> respuesta = controller.obtenerCajaActual();

        assertEquals(HttpStatus.OK, respuesta.getStatusCode());
        assertSame(caja, respuesta.getBody());
    }

    @Test
    void abrirCajaDevuelve201() {
        CajaDto caja = CajaDto.builder().id(8L).estado(EstadoCaja.ABIERTA).build();
        when(cajaService.abrirCaja(any(AperturaCajaDto.class), eq("juan"))).thenReturn(caja);

        ResponseEntity<?> respuesta = controller.abrirCaja(new AperturaCajaDto(), empleado);

        assertEquals(HttpStatus.CREATED, respuesta.getStatusCode());
        assertSame(caja, respuesta.getBody());
    }

    @Test
    void abrirConOtraCajaAbiertaDevuelve409ConElMotivo() {
        when(cajaService.abrirCaja(any(AperturaCajaDto.class), eq("juan")))
                .thenThrow(new IllegalStateException("Ya existe una caja abierta."));

        ResponseEntity<?> respuesta = controller.abrirCaja(new AperturaCajaDto(), empleado);

        assertEquals(HttpStatus.CONFLICT, respuesta.getStatusCode());
        assertEquals("Ya existe una caja abierta.", ((ErrorDto) respuesta.getBody()).getMessage());
    }

    @Test
    void cerrarCajaDevuelve200() {
        CajaDto caja = CajaDto.builder().id(9L).estado(EstadoCaja.CERRADA).build();
        when(cajaService.cerrarCaja(any(CierreCajaDto.class), eq("juan"))).thenReturn(caja);

        ResponseEntity<?> respuesta = controller.cerrarCaja(new CierreCajaDto(), empleado);

        assertEquals(HttpStatus.OK, respuesta.getStatusCode());
        assertSame(caja, respuesta.getBody());
    }

    @Test
    void cerrarSinCajaAbiertaDevuelve409ConElMotivo() {
        when(cajaService.cerrarCaja(any(CierreCajaDto.class), eq("juan")))
                .thenThrow(new IllegalStateException("No hay ninguna caja abierta para cerrar"));

        ResponseEntity<?> respuesta = controller.cerrarCaja(new CierreCajaDto(), empleado);

        assertEquals(HttpStatus.CONFLICT, respuesta.getStatusCode());
        assertEquals("No hay ninguna caja abierta para cerrar", ((ErrorDto) respuesta.getBody()).getMessage());
    }
}
