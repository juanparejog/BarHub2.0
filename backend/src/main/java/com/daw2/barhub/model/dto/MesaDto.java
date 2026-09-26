package com.daw2.barhub.model.dto;

import com.daw2.barhub.model.Enum.EstadoMesa;
import com.daw2.barhub.model.entity.Mesa;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class MesaDto {
    private Long id;
    private String codigoqr;
    private EstadoMesa estado;

    public static MesaDto from(Mesa mesa) {
        MesaDto dto = null;

        if (mesa != null) {
            dto = new MesaDto();
            dto.setId(mesa.getId());
            dto.setCodigoqr(mesa.getCodigoqr());
            dto.setEstado(mesa.getEstado());
        }

        return dto;
    }

    public static List<MesaDto> from(List<Mesa> mesas) {
        List<MesaDto> dtos = new ArrayList<>();

        if (mesas != null) {
            dtos = new ArrayList<MesaDto>();
            for(Mesa mesa : mesas) {
                dtos.add(from(mesa));
            }
        }

        return dtos;
    }

    public Mesa to() {
        Mesa mesa = new Mesa();

        mesa.setId(this.id);
        mesa.setCodigoqr(this.codigoqr);
        mesa.setEstado(this.estado);

        return mesa;
    }
}