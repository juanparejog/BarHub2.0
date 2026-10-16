package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
import com.daw2.barhub.model.entity.Caja;
import com.daw2.barhub.model.Enum.EstadoCaja;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.repository.CajaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.service.CajaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CajaServiceImpl implements CajaService {

    private final CajaRepository cajaRepository;
    private final UserRepository usuarioRepository;
    private final PedidoRepository pedidoRepository;

    @Override
    @Transactional(readOnly = true)
    public CajaDto obtenerCajaActual() {
        Caja caja = cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new RuntimeException("No hay ninguna caja abierta actualmente"));

        return mapToDTO(caja);
    }

    @Override
    @Transactional
    public CajaDto abrirCaja(AperturaCajaDto dto, String username) {
        if (cajaRepository.existsByEstado(EstadoCaja.ABIERTA)) {
            throw new IllegalStateException("Ya existe una caja abierta. Debe cerrarla antes de abrir una nueva.");
        }

        User usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));

        Caja caja = Caja.builder()
                .fechaApertura(LocalDateTime.now())
                .montoInicial(dto.getMontoInicial())
                .ventasEfectivo(BigDecimal.ZERO)
                .ventasTarjeta(BigDecimal.ZERO)
                .estado(EstadoCaja.ABIERTA)
                .observaciones(dto.getObservaciones())
                .usuarioApertura(usuario)
                .build();

        caja = cajaRepository.save(caja);
        return mapToDTO(caja);
    }

    @Override
    @Transactional
    public CajaDto cerrarCaja(CierreCajaDto dto, String username) {
        Caja caja = cajaRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new IllegalStateException("No hay ninguna caja abierta para cerrar"));

        User usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + username));

        LocalDateTime ahora = LocalDateTime.now();

        // 1. Calcular total acumulado de ventas desde fechaApertura hasta ahora
        BigDecimal ventasEfectivo = pedidoRepository.sumVentasEfectivoEntreFechas(caja.getFechaApertura(), ahora);
        BigDecimal ventasTarjeta = pedidoRepository.sumVentasTarjetaEntreFechas(caja.getFechaApertura(), ahora);

        if (ventasEfectivo == null) ventasEfectivo = BigDecimal.ZERO;
        if (ventasTarjeta == null) ventasTarjeta = BigDecimal.ZERO;

        // 2. Efectivo Esperado = Monto Inicial + Ventas Efectivo
        BigDecimal efectivoEsperado = caja.getMontoInicial().add(ventasEfectivo);

        // 3. Diferencia = Efectivo Real Contado - Efectivo Esperado
        BigDecimal diferencia = dto.getEfectivoReal().subtract(efectivoEsperado);

        // 4. Actualizar estado de la caja
        caja.setFechaCierre(ahora);
        caja.setVentasEfectivo(ventasEfectivo);
        caja.setVentasTarjeta(ventasTarjeta);
        caja.setEfectivoReal(dto.getEfectivoReal());
        caja.setDiferencia(diferencia);
        caja.setEstado(EstadoCaja.CERRADA);
        caja.setUsuarioCierre(usuario);

        if (dto.getObservaciones() != null && !dto.getObservaciones().isBlank()) {
            String obsAnterior = caja.getObservaciones() != null ? caja.getObservaciones() + " | " : "";
            caja.setObservaciones(obsAnterior + "Cierre: " + dto.getObservaciones());
        }

        caja = cajaRepository.save(caja);
        return mapToDTO(caja);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CajaDto> obtenerHistorial() {
        return cajaRepository.findAllByOrderByFechaAperturaDesc().stream()
                .map(this::mapToDTO)
                .toList();
    }

    private CajaDto mapToDTO(Caja caja) {
        BigDecimal vEfectivo = caja.getVentasEfectivo() != null ? caja.getVentasEfectivo() : BigDecimal.ZERO;
        BigDecimal mInicial = caja.getMontoInicial() != null ? caja.getMontoInicial() : BigDecimal.ZERO;
        BigDecimal efectivoEsperado = mInicial.add(vEfectivo);

        return CajaDto.builder()
                .id(caja.getId())
                .fechaApertura(caja.getFechaApertura())
                .fechaCierre(caja.getFechaCierre())
                .montoInicial(caja.getMontoInicial())
                .ventasEfectivo(caja.getVentasEfectivo())
                .ventasTarjeta(caja.getVentasTarjeta())
                .efectivoReal(caja.getEfectivoReal())
                .efectivoEsperado(efectivoEsperado)
                .diferencia(caja.getDiferencia())
                .estado(caja.getEstado())
                .observaciones(caja.getObservaciones())
                .nombreUsuarioApertura(caja.getUsuarioApertura() != null ? caja.getUsuarioApertura().getUsername() : null)
                .nombreUsuarioCierre(caja.getUsuarioCierre() != null ? caja.getUsuarioCierre().getUsername() : null)
                .build();
    }
}