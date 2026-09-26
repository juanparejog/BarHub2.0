package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.service.MesaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class MesaServiceImpl implements MesaService {

    @Autowired
    private MesaRepository mesaRepository;

    @Override
    public Mesa save(Mesa entity) {
        return mesaRepository.save(entity);
    }

    @Override
    public List<Mesa> findAll() {
        List<Mesa> mesas = mesaRepository.findAll();

        return mesas;
    }

    @Override
    public Mesa findById(long id) {
        Mesa mesa = mesaRepository.findById(id);

        return mesa;
    }

    @Override
    public void delete(long id) {
        Mesa mesa = mesaRepository.findById(id);
        if(mesa != null) {
            mesaRepository.delete(mesa);
        }
    }

    @Override
    public Mesa update(long id, Mesa entity) {
        Mesa mesaExistente = mesaRepository.findById(id);

        if(mesaExistente!= null) {
            mesaExistente.setCodigoqr(entity.getCodigoqr());
            mesaExistente.setEstado(entity.getEstado());
            return mesaRepository.save(mesaExistente);
        } else {
            return null;
        }
    }
}