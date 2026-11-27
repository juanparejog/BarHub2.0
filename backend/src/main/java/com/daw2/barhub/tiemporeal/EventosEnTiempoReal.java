package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.auth.sesion.SesionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Conexiones abiertas de Server-Sent Events y envio de avisos. Dos canales:
 * <ul>
 *   <li>{@link Canal#PERSONAL}: empleados y administradores; reciben cualquier cambio de pedidos y mesas;</li>
 *   <li>{@link Canal#CLIENTE}: cada cliente, solo los cambios de sus propios pedidos.</li>
 * </ul>
 * Los avisos solo dicen que ha cambiado (tipo e id); los datos se vuelven a pedir por los endpoints
 * de siempre, que comprueban los permisos. Cada {@value #LATIDO_SEGUNDOS} s se manda un latido y se
 * comprueba que la sesion sigue abierta: al cerrar sesion, cambiar la contrasena o caducar, la
 * conexion se corta. Cada conexion dura como mucho {@code app.tiempo-real.duracion} (el navegador
 * se vuelve a conectar con su token del momento) y hay un limite por usuario y otro total.
 */
@Slf4j
@Service
public class EventosEnTiempoReal {

    static final long LATIDO_SEGUNDOS = 25;
    static final int MAXIMO_POR_USUARIO = 5;

    public enum Canal { PERSONAL, CLIENTE }

    record Suscripcion(String clave, SseEmitter emisor, Canal canal, Long usuarioId, String sesionId, long orden) {
    }

    private final Map<String, Suscripcion> abiertas = new ConcurrentHashMap<>();
    private final AtomicLong contador = new AtomicLong();
    private final SesionService sesiones;
    private final Duration duracion;
    private final int maximoTotal;

    public EventosEnTiempoReal(SesionService sesiones,
                               @Value("${app.tiempo-real.duracion:5m}") Duration duracion,
                               @Value("${app.tiempo-real.maximo-conexiones:500}") int maximoTotal) {
        this.sesiones = sesiones;
        this.duracion = duracion;
        this.maximoTotal = maximoTotal;
    }

    /** Abre una conexion. Si el usuario ya tiene demasiadas, cierra la mas antigua. */
    public SseEmitter suscribir(Canal canal, Long usuarioId, String sesionId) {
        if (abiertas.size() >= maximoTotal) {
            throw new IllegalStateException("Demasiadas conexiones en tiempo real abiertas");
        }
        List<Suscripcion> delUsuario = abiertas.values().stream()
                .filter(s -> s.usuarioId().equals(usuarioId))
                .sorted(Comparator.comparingLong(Suscripcion::orden))
                .toList();
        for (int i = 0; i <= delUsuario.size() - MAXIMO_POR_USUARIO; i++) {
            cerrar(delUsuario.get(i));
        }

        SseEmitter emisor = new SseEmitter(duracion.toMillis());
        Suscripcion suscripcion = new Suscripcion(UUID.randomUUID().toString(), emisor, canal, usuarioId, sesionId,
                contador.incrementAndGet());
        abiertas.put(suscripcion.clave(), suscripcion);
        emisor.onCompletion(() -> abiertas.remove(suscripcion.clave()));
        emisor.onTimeout(() -> cerrar(suscripcion));
        emisor.onError(e -> abiertas.remove(suscripcion.clave()));
        enviar(suscripcion, SseEmitter.event().name("conectado").data("{}")
                .reconnectTime(Duration.ofSeconds(3).toMillis()));
        return emisor;
    }

    /** Tras confirmarse la transaccion (o al momento, si no la hay), avisa a quien corresponda. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void alCambiar(CambioEnTiempoReal cambio) {
        String datos = "{\"id\":" + cambio.id() + "}";
        for (Suscripcion suscripcion : abiertas.values()) {
            if (leInteresa(suscripcion, cambio)) {
                enviar(suscripcion, SseEmitter.event().name(cambio.tipo()).data(datos));
            }
        }
    }

    static boolean leInteresa(Suscripcion suscripcion, CambioEnTiempoReal cambio) {
        if (suscripcion.canal() == Canal.PERSONAL) {
            return true;
        }
        return CambioEnTiempoReal.PEDIDO.equals(cambio.tipo()) && suscripcion.usuarioId().equals(cambio.usuarioId());
    }

    /** Latido: mantiene viva la conexion a traves de proxies y corta la de una sesion que ya no vale. */
    @Scheduled(fixedDelayString = "PT" + LATIDO_SEGUNDOS + "S")
    public void latido() {
        for (Suscripcion suscripcion : abiertas.values()) {
            if (!sesiones.sigueAbierta(suscripcion.sesionId(), suscripcion.usuarioId())) {
                cerrar(suscripcion);
            } else {
                enviar(suscripcion, SseEmitter.event().comment("latido"));
            }
        }
    }

    int abiertas() {
        return abiertas.size();
    }

    private void enviar(Suscripcion suscripcion, SseEmitter.SseEventBuilder evento) {
        try {
            suscripcion.emisor().send(evento);
        } catch (IOException | IllegalStateException e) {
            // El navegador se ha ido: se libera sin mas
            log.debug("Conexion en tiempo real cerrada al enviar: {}", e.getMessage());
            abiertas.remove(suscripcion.clave());
        }
    }

    private void cerrar(Suscripcion suscripcion) {
        abiertas.remove(suscripcion.clave());
        try {
            suscripcion.emisor().complete();
        } catch (IllegalStateException e) {
            log.debug("La conexion ya estaba cerrada: {}", e.getMessage());
        }
    }
}
