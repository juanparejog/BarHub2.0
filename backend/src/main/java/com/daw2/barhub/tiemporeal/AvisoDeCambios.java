package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Escucha en JPA las altas, cambios y bajas de pedidos, de sus lineas y de mesas, y publica un
 * {@link CambioEnTiempoReal}. Asi da igual que endpoint haga el cambio: no se puede olvidar avisar.
 * {@link EventosEnTiempoReal} lo envia a los navegadores cuando la transaccion se confirma.
 *
 * <p>Con Spring Boot, Hibernate pide el listener a Spring (SpringBeanContainer), que lo crea con el
 * publicador de su propio contexto: con varios contextos a la vez (los tests) cada uno avisa en el
 * suyo. Si Hibernate lo creara por su cuenta, sin inyeccion, se usa el que guarda al arrancar
 * {@link Instalador} en un campo estatico. Sin ninguno (tests unitarios de entidades) no hace nada.
 */
public class AvisoDeCambios {

    private static volatile ApplicationEventPublisher publicador;

    private final ApplicationEventPublisher propio;

    /** Para Hibernate sin Spring: usa el publicador estatico. */
    public AvisoDeCambios() {
        this(null);
    }

    @Autowired
    public AvisoDeCambios(ApplicationEventPublisher propio) {
        this.propio = propio;
    }

    static void instalar(ApplicationEventPublisher nuevo) {
        publicador = nuevo;
    }

    @PostPersist
    @PostUpdate
    @PostRemove
    public void cambio(Object entidad) {
        ApplicationEventPublisher actual = propio != null ? propio : publicador;
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
