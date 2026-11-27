package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Escucha en JPA las altas, cambios y bajas de pedidos, de sus lineas y de mesas, y publica un
 * {@link CambioEnTiempoReal}. Asi da igual que endpoint haga el cambio: no se puede olvidar avisar.
 * {@link EventosEnTiempoReal} lo envia a los navegadores cuando la transaccion se confirma.
 *
 * <p>Hibernate crea los listeners de JPA por su cuenta, sin inyeccion; por eso el publicador se
 * guarda al arrancar en un campo estatico ({@link Instalador}). Sin publicador (tests unitarios de
 * entidades) no hace nada.
 */
public class AvisoDeCambios {

    private static volatile ApplicationEventPublisher publicador;

    static void instalar(ApplicationEventPublisher nuevo) {
        publicador = nuevo;
    }

    @PostPersist
    @PostUpdate
    @PostRemove
    public void cambio(Object entidad) {
        ApplicationEventPublisher actual = publicador;
        CambioEnTiempoReal cambio = describir(entidad);
        if (actual != null && cambio != null) {
            actual.publishEvent(cambio);
        }
    }

    static CambioEnTiempoReal describir(Object entidad) {
        if (entidad instanceof Pedido pedido) {
            return dePedido(pedido);
        }
        if (entidad instanceof DetallePedido detalle && detalle.getPedido() != null) {
            return dePedido(detalle.getPedido());
        }
        if (entidad instanceof Mesa mesa) {
            return new CambioEnTiempoReal(CambioEnTiempoReal.MESA, mesa.getId(), null);
        }
        return null;
    }

    private static CambioEnTiempoReal dePedido(Pedido pedido) {
        Long usuarioId = pedido.getUser() != null ? pedido.getUser().getId() : null;
        return new CambioEnTiempoReal(CambioEnTiempoReal.PEDIDO, pedido.getId(), usuarioId);
    }

    /** Deja el publicador de Spring a mano de los listeners al arrancar. */
    @Component
    static class Instalador {
        Instalador(ApplicationEventPublisher publicador) {
            instalar(publicador);
        }
    }
}
