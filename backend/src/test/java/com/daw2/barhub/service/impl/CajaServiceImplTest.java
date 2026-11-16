package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;
import com.daw2.barhub.model.entity.Caja;
import com.daw2.barhub.model.enums.EstadoCaja;
import com.daw2.barhub.model.repository.CajaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CajaServiceImplTest {

    @Mock
    private CajaRepository cajaRepository;
    @Mock
    private UserRepository usuarioRepository;
    @Mock
    private PedidoRepository pedidoRepository;

    @InjectMocks
    private CajaServiceImpl servicio;

    private static User usuario(String nombre) {
        User usuario = mock(User.class);
        lenient().when(usuario.getUsername()).thenReturn(nombre);
        return usuario;
    }

    private static Caja cajaAbierta(String montoInicial, String observaciones) {
        return Caja.builder()
                .fechaApertura(LocalDateTime.now().minusHours(5))
                .montoInicial(new BigDecimal(montoInicial))
                .estado(EstadoCaja.ABIERTA)
                .observaciones(observaciones)
                .build();
    }

    private static CierreCajaDto cierre(String efectivoReal, String observaciones) {
        CierreCajaDto dto = new CierreCajaDto();
        dto.setEfectivoReal(new BigDecimal(efectivoReal));
        dto.setObservaciones(observaciones);
        return dto;
    }

    private void ventas(String efectivo, String tarjeta) {
        when(pedidoRepository.sumVentasEfectivoEntreFechas(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(efectivo == null ? null : new BigDecimal(efectivo));
        when(pedidoRepository.sumVentasTarjetaEntreFechas(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(tarjeta == null ? null : new BigDecimal(tarjeta));
    }

    // ---------- obtener ----------

    @Test
    void cajaActualSinCajaAbiertaFalla() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> servicio.obtenerCajaActual());
    }

    @Test
    void cajaActualCalculaElEfectivoEsperado() {
        Caja caja = cajaAbierta("100.00", null);
        caja.setVentasEfectivo(new BigDecimal("40.00"));
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        CajaDto dto = servicio.obtenerCajaActual();

        assertEquals(0, new BigDecimal("140.00").compareTo(dto.getEfectivoEsperado()));
        assertEquals(EstadoCaja.ABIERTA, dto.getEstado());
    }

    @Test
    void historialDevuelveUnaFilaPorCaja() {
        when(cajaRepository.findAllByOrderByFechaAperturaDesc())
                .thenReturn(List.of(cajaAbierta("10.00", null), cajaAbierta("20.00", null)));

        assertEquals(2, servicio.obtenerHistorial().size());
    }

    // ---------- abrir ----------

    @Test
    void noSePuedeAbrirUnaCajaSiYaHayOtraAbierta() {
        when(cajaRepository.existsByEstado(EstadoCaja.ABIERTA)).thenReturn(true);
        AperturaCajaDto dto = new AperturaCajaDto();
        dto.setMontoInicial(new BigDecimal("50"));

        assertThrows(IllegalStateException.class, () -> servicio.abrirCaja(dto, "juan"));
        verify(cajaRepository, never()).save(any(Caja.class));
    }

    @Test
    void abrirCajaConUsuarioInexistenteFalla() {
        when(cajaRepository.existsByEstado(EstadoCaja.ABIERTA)).thenReturn(false);
        when(usuarioRepository.findByUsername("nadie")).thenReturn(Optional.empty());
        AperturaCajaDto dto = new AperturaCajaDto();
        dto.setMontoInicial(new BigDecimal("50"));

        assertThrows(RuntimeException.class, () -> servicio.abrirCaja(dto, "nadie"));
    }

    @Test
    void abrirCajaLaDejaAbiertaYSinVentas() {
        when(cajaRepository.existsByEstado(EstadoCaja.ABIERTA)).thenReturn(false);
        User juan = usuario("juan");
        when(usuarioRepository.findByUsername("juan")).thenReturn(Optional.of(juan));
        when(cajaRepository.save(any(Caja.class))).thenAnswer(i -> i.getArgument(0));
        AperturaCajaDto dto = new AperturaCajaDto();
        dto.setMontoInicial(new BigDecimal("50.00"));
        dto.setObservaciones("Turno de tarde");

        CajaDto resultado = servicio.abrirCaja(dto, "juan");

        assertEquals(EstadoCaja.ABIERTA, resultado.getEstado());
        assertEquals(0, new BigDecimal("50.00").compareTo(resultado.getMontoInicial()));
        assertEquals(0, BigDecimal.ZERO.compareTo(resultado.getVentasEfectivo()));
        assertEquals(0, BigDecimal.ZERO.compareTo(resultado.getVentasTarjeta()));
        assertEquals("juan", resultado.getNombreUsuarioApertura());
    }

    // ---------- cerrar ----------

    @Test
    void cerrarSinCajaAbiertaFalla() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> servicio.cerrarCaja(cierre("100", null), "juan"));
    }

    @Test
    void cerrarConUsuarioInexistenteFalla() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(cajaAbierta("100.00", null)));
        when(usuarioRepository.findByUsername("nadie")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> servicio.cerrarCaja(cierre("100", null), "nadie"));
    }

    @Test
    void cerrarCajaCalculaLaDiferenciaConElEfectivoContado() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(cajaAbierta("100.00", null)));
        User juan = usuario("juan");
        when(usuarioRepository.findByUsername("juan")).thenReturn(Optional.of(juan));
        ventas("50.00", "30.00");
        when(cajaRepository.save(any(Caja.class))).thenAnswer(i -> i.getArgument(0));

        CajaDto resultado = servicio.cerrarCaja(cierre("148.50", null), "juan");

        // esperado = 100 inicial + 50 de ventas en efectivo = 150; contado 148.50 -> diferencia -1.50
        assertEquals(EstadoCaja.CERRADA, resultado.getEstado());
        assertEquals(0, new BigDecimal("150.00").compareTo(resultado.getEfectivoEsperado()));
        assertEquals(0, new BigDecimal("-1.50").compareTo(resultado.getDiferencia()));
        assertEquals(0, new BigDecimal("30.00").compareTo(resultado.getVentasTarjeta()));
        assertEquals("juan", resultado.getNombreUsuarioCierre());
    }

    @Test
    void cerrarCajaSinVentasTrataLosNulosComoCero() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(cajaAbierta("100.00", null)));
        User juan = usuario("juan");
        when(usuarioRepository.findByUsername("juan")).thenReturn(Optional.of(juan));
        ventas(null, null);
        when(cajaRepository.save(any(Caja.class))).thenAnswer(i -> i.getArgument(0));

        CajaDto resultado = servicio.cerrarCaja(cierre("100.00", null), "juan");

        assertEquals(0, BigDecimal.ZERO.compareTo(resultado.getVentasEfectivo()));
        assertEquals(0, BigDecimal.ZERO.compareTo(resultado.getDiferencia()));
    }

    @Test
    void cerrarCajaAnadeLaObservacionDeCierre() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(cajaAbierta("100.00", "Apertura")));
        User juan = usuario("juan");
        when(usuarioRepository.findByUsername("juan")).thenReturn(Optional.of(juan));
        ventas("0", "0");
        when(cajaRepository.save(any(Caja.class))).thenAnswer(i -> i.getArgument(0));

        CajaDto resultado = servicio.cerrarCaja(cierre("100.00", "todo cuadra"), "juan");

        assertEquals("Apertura | Cierre: todo cuadra", resultado.getObservaciones());
    }

    @Test
    void cerrarCajaIgnoraLaObservacionEnBlanco() {
        when(cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(cajaAbierta("100.00", "Apertura")));
        User juan = usuario("juan");
        when(usuarioRepository.findByUsername("juan")).thenReturn(Optional.of(juan));
        ventas("0", "0");
        when(cajaRepository.save(any(Caja.class))).thenAnswer(i -> i.getArgument(0));

        CajaDto resultado = servicio.cerrarCaja(cierre("100.00", "   "), "juan");

        assertEquals("Apertura", resultado.getObservaciones());
    }
}
