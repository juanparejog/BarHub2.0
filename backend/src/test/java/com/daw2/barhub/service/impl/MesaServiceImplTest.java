package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.enums.EstadoMesa;
import com.daw2.barhub.model.repository.MesaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MesaServiceImplTest {

    @Mock
    private MesaRepository mesaRepository;

    @InjectMocks
    private MesaServiceImpl servicio;

    private static Mesa mesa(String codigo) {
        Mesa mesa = new Mesa();
        mesa.setCodigoqr(codigo);
        mesa.setEstado(EstadoMesa.values()[0]);
        return mesa;
    }

    @Test
    void guardarDevuelveLaMesaGuardada() {
        Mesa mesa = mesa("QR-1");
        when(mesaRepository.save(mesa)).thenReturn(mesa);

        assertSame(mesa, servicio.save(mesa));
    }

    @Test
    void listarDevuelveTodasLasMesas() {
        List<Mesa> mesas = List.of(mesa("QR-1"), mesa("QR-2"));
        when(mesaRepository.findAll()).thenReturn(mesas);

        assertEquals(2, servicio.findAll().size());
    }

    @Test
    void buscarPorIdDevuelveLaMesa() {
        Mesa mesa = mesa("QR-1");
        when(mesaRepository.findById(1L)).thenReturn(mesa);

        assertSame(mesa, servicio.findById(1L));
    }

    @Test
    void borrarMesaExistenteLaElimina() {
        Mesa mesa = mesa("QR-1");
        when(mesaRepository.findById(1L)).thenReturn(mesa);

        servicio.delete(1L);

        verify(mesaRepository).delete(mesa);
    }

    @Test
    void borrarMesaInexistenteNoHaceNada() {
        when(mesaRepository.findById(1L)).thenReturn(null);

        servicio.delete(1L);

        verify(mesaRepository, never()).delete(any(Mesa.class));
    }

    @Test
    void actualizarCambiaCodigoYEstado() {
        Mesa existente = mesa("QR-VIEJO");
        Mesa nueva = mesa("QR-NUEVO");
        when(mesaRepository.findById(1L)).thenReturn(existente);
        when(mesaRepository.save(existente)).thenReturn(existente);

        Mesa resultado = servicio.update(1L, nueva);

        assertEquals("QR-NUEVO", resultado.getCodigoqr());
    }

    @Test
    void actualizarMesaInexistenteDevuelveNulo() {
        when(mesaRepository.findById(1L)).thenReturn(null);

        assertNull(servicio.update(1L, mesa("QR-NUEVO")));
        verify(mesaRepository, never()).save(any(Mesa.class));
    }
}
