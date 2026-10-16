package com.daw2.barhub.service;

import com.daw2.barhub.model.dto.AperturaCajaDto;
import com.daw2.barhub.model.dto.CajaDto;
import com.daw2.barhub.model.dto.CierreCajaDto;

import java.util.List;

public interface CajaService {
    CajaDto obtenerCajaActual();
    CajaDto abrirCaja(AperturaCajaDto dto, String username);
    CajaDto cerrarCaja(CierreCajaDto dto, String username);
    List<CajaDto> obtenerHistorial();
}
