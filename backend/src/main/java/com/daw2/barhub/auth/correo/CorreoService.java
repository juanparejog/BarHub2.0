package com.daw2.barhub.auth.correo;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Envio de correos de texto. En local van a Mailpit (que los captura y no los entrega); en
 * produccion, al SMTP configurado con SPRING_MAIL_HOST y compania.
 *
 * <p>Es asincrono: la respuesta de la API no espera al SMTP, y asi "recuperar contrasena" tarda
 * lo mismo exista o no la cuenta (no se puede averiguar por el tiempo de respuesta).
 */
@Slf4j
@Service
public class CorreoService {

    private final ObjectProvider<JavaMailSender> remitente;
    private final String desde;

    public CorreoService(ObjectProvider<JavaMailSender> remitente,
                         @Value("${app.correo.remitente:BarHub <no-responder@barhub.local>}") String desde) {
        this.remitente = remitente;
        this.desde = desde;
    }

    @Async
    public void enviar(String para, String asunto, String texto) {
        JavaMailSender servidor = remitente.getIfAvailable();
        if (servidor == null) {
            log.warn("Sin servidor de correo (spring.mail.host): no se envía «{}»", asunto);
            return;
        }
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(desde);
        mensaje.setTo(para);
        mensaje.setSubject(asunto);
        mensaje.setText(texto);
        try {
            servidor.send(mensaje);
        } catch (MailException e) {
            // El destinatario no se escribe en el log: es un dato personal
            log.error("No se pudo enviar el correo «{}»: {}", asunto, e.getMessage());
        }
    }
}
