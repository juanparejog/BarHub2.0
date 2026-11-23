package com.daw2.barhub.auth.correo;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.services.LoginAttemptService;
import com.daw2.barhub.auth.sesion.SesionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Confirmacion del correo al registrarse, recuperacion de la contrasena y cambio de correo.
 *
 * <ul>
 *   <li>Los enlaces son de un solo uso, caducan (24 h la confirmacion, 30 min la recuperacion) y
 *       pedir uno nuevo anula el anterior.</li>
 *   <li>El token va en el fragmento de la URL ({@code #token=...}): el navegador no lo envia al
 *       servidor, asi que no queda en los logs de Caddy ni en la cabecera Referer.</li>
 *   <li>Pedir otro correo o recuperar la contrasena responde siempre lo mismo, exista o no la
 *       cuenta, y como mucho envia un correo por minuto a cada cuenta.</li>
 *   <li>Restablecer la contrasena cierra todas las sesiones abiertas de la cuenta.</li>
 *   <li>Un correo nuevo no se pone en la cuenta hasta abrir el enlace que llega a el; al correo
 *       anterior se le avisa al pedirlo y al confirmarlo. Asi una sesion robada no basta para
 *       quedarse con la cuenta pidiendo la recuperacion de la contrasena a un correo ajeno.</li>
 * </ul>
 */
@Slf4j
@Service
public class CuentaCorreoService {

    static final Duration ESPERA_ENTRE_CORREOS = Duration.ofMinutes(1);
    static final int CLAVE_MINIMA = 6;
    static final int CLAVE_MAXIMA = 40;
    static final int EMAIL_MAXIMO = 100;
    private static final Pattern EMAIL_VALIDO = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final TokenCorreoRepository tokens;
    private final UserRepository usuarios;
    private final CorreoService correo;
    private final SesionService sesiones;
    private final LoginAttemptService intentos;
    private final PasswordEncoder encoder;
    private final Clock reloj;
    private final String urlPublica;

    public CuentaCorreoService(TokenCorreoRepository tokens, UserRepository usuarios, CorreoService correo,
                               SesionService sesiones, LoginAttemptService intentos, PasswordEncoder encoder,
                               Clock reloj, @Value("${app.url-publica:http://localhost}") String urlPublica) {
        this.tokens = tokens;
        this.usuarios = usuarios;
        this.correo = correo;
        this.sesiones = sesiones;
        this.intentos = intentos;
        this.encoder = encoder;
        this.reloj = reloj;
        this.urlPublica = urlPublica.replaceAll("/+$", "");
    }

    /** Tras el registro: envia el enlace para confirmar el correo. */
    @Transactional
    public void enviarConfirmacion(User usuario) {
        String token = emitir(usuario.getId(), TipoTokenCorreo.VERIFICACION);
        correo.enviar(usuario.getEmail(), "Confirma tu correo en BarHub", """
                Hola %s:

                Gracias por registrarte en BarHub. Para activar tu cuenta, abre este enlace:

                %s/auth/verificar#token=%s

                El enlace caduca en 24 horas y solo se puede usar una vez.
                Si no has creado tú esta cuenta, ignora este correo.
                """.formatted(nombre(usuario), urlPublica, token));
    }

    /** "Reenviar correo": por nombre de usuario o email. No dice si la cuenta existe. */
    @Transactional
    public void reenviarConfirmacion(String usuarioOEmail) {
        buscar(usuarioOEmail)
                .filter(u -> !u.correoVerificado())
                .filter(u -> puedeEnviar(u.getId(), TipoTokenCorreo.VERIFICACION))
                .ifPresent(this::enviarConfirmacion);
    }

    @Transactional
    public void confirmar(String token) {
        TokenCorreo usado = consumir(token, TipoTokenCorreo.VERIFICACION);
        usuarios.findById(usado.getUsuarioId())
                .orElseThrow(TokenCorreoInvalidoException::new)
                .setEmailVerificado(true);
    }

    /** "He olvidado mi contrasena". No dice si hay una cuenta con ese email. */
    @Transactional
    public void solicitarRecuperacion(String email) {
        Optional<User> cuenta = usuarios.findByEmailIgnoreCase(email == null ? "" : email.trim());
        if (cuenta.isEmpty() || !puedeEnviar(cuenta.get().getId(), TipoTokenCorreo.RECUPERACION)) {
            return;
        }
        User usuario = cuenta.get();
        String token = emitir(usuario.getId(), TipoTokenCorreo.RECUPERACION);
        correo.enviar(usuario.getEmail(), "Restablece tu contraseña de BarHub", """
                Hola %s:

                Alguien ha pedido restablecer la contraseña de tu cuenta de BarHub (%s).
                Si has sido tú, abre este enlace y elige una contraseña nueva:

                %s/auth/restablecer#token=%s

                El enlace caduca en 30 minutos y solo se puede usar una vez. Al cambiar la
                contraseña se cerrarán todas tus sesiones abiertas.
                Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.
                """.formatted(nombre(usuario), usuario.getUsername(), urlPublica, token));
    }

    /** Cambia la contrasena con el enlace del correo y cierra todas las sesiones de la cuenta. */
    @Transactional
    public void restablecer(String token, String nuevaClave) {
        if (nuevaClave == null || nuevaClave.length() < CLAVE_MINIMA || nuevaClave.length() > CLAVE_MAXIMA) {
            throw new IllegalArgumentException(
                    "La contraseña debe tener entre " + CLAVE_MINIMA + " y " + CLAVE_MAXIMA + " caracteres");
        }
        TokenCorreo usado = consumir(token, TipoTokenCorreo.RECUPERACION);
        User usuario = usuarios.findById(usado.getUsuarioId()).orElseThrow(TokenCorreoInvalidoException::new);
        usuario.setPassword(encoder.encode(nuevaClave));
        // Quien recibe el correo demuestra que el email es suyo
        usuario.setEmailVerificado(true);
        int cerradas = sesiones.cerrarTodas(usuario.getId());
        intentos.registrarExito(usuario.getUsername());
        log.info("Contraseña restablecida por correo para el usuario {}; sesiones cerradas: {}", usuario.getId(), cerradas);
    }

    // ---------- cambio de correo ----------

    /**
     * Envia al correo nuevo el enlace para confirmarlo y avisa al actual. La cuenta sigue con el
     * correo actual hasta que se abre el enlace.
     *
     * @throws IllegalArgumentException si el correo no es valido o ya es el suyo
     * @throws CorreoEnUsoException     si otra cuenta lo usa
     * @throws IllegalStateException    si ya pidio otro hace menos de un minuto
     */
    @Transactional
    public void solicitarCambio(User usuario, String nuevo) {
        String email = nuevo == null ? "" : nuevo.trim();
        if (email.length() > EMAIL_MAXIMO || !EMAIL_VALIDO.matcher(email).matches()) {
            throw new IllegalArgumentException("Escribe un correo válido.");
        }
        if (email.equalsIgnoreCase(usuario.getEmail())) {
            throw new IllegalArgumentException("Ese ya es el correo de tu cuenta.");
        }
        if (usuarios.findByEmailIgnoreCase(email).isPresent()) {
            throw new CorreoEnUsoException();
        }
        if (!puedeEnviar(usuario.getId(), TipoTokenCorreo.CAMBIO_CORREO)) {
            throw new IllegalStateException("Espera un minuto antes de pedir otro enlace.");
        }
        String token = emitir(usuario.getId(), TipoTokenCorreo.CAMBIO_CORREO, email);
        correo.enviar(email, "Confirma tu nuevo correo en BarHub", """
                Hola %s:

                Has pedido usar este correo en tu cuenta de BarHub (%s). Para confirmarlo, abre
                este enlace:

                %s/auth/confirmar-cambio-correo#token=%s

                El enlace caduca en 24 horas y solo se puede usar una vez. Hasta que lo abras, tu
                cuenta sigue con el correo anterior.
                Si no lo has pedido tú, ignora este correo.
                """.formatted(nombre(usuario), usuario.getUsername(), urlPublica, token));
        correo.enviar(usuario.getEmail(), "Se ha pedido cambiar el correo de tu cuenta de BarHub", """
                Hola %s:

                Se ha pedido cambiar el correo de tu cuenta de BarHub (%s) a %s.
                El cambio no se hará hasta que se abra el enlace que hemos enviado a esa dirección.

                Si no has sido tú, entra en BarHub, cancela el cambio en Mi perfil > Cuenta y correo
                y cambia tu contraseña en Mi perfil > Seguridad.
                """.formatted(nombre(usuario), usuario.getUsername(), enmascarar(email)));
        log.info("El usuario {} ha pedido cambiar su correo", usuario.getId());
    }

    /** El correo nuevo que espera confirmacion, si hay un enlace vigente. */
    @Transactional(readOnly = true)
    public Optional<String> cambioPendiente(Long usuarioId) {
        Instant ahora = reloj.instant();
        return tokens.findByUsuarioIdAndTipoAndUsadoEnIsNull(usuarioId, TipoTokenCorreo.CAMBIO_CORREO).stream()
                .filter(t -> t.valido(ahora))
                .map(TokenCorreo::getNuevoEmail)
                .findFirst();
    }

    /** Anula el enlace pendiente: el correo nuevo ya no se podra confirmar con el. */
    @Transactional
    public void cancelarCambio(Long usuarioId) {
        Instant ahora = reloj.instant();
        tokens.findByUsuarioIdAndTipoAndUsadoEnIsNull(usuarioId, TipoTokenCorreo.CAMBIO_CORREO)
                .forEach(t -> t.setUsadoEn(ahora));
    }

    /**
     * Pone en la cuenta el correo del enlace (ya verificado: quien lo abre lo recibe) y avisa al
     * anterior. Devuelve el correo nuevo.
     */
    @Transactional
    public String confirmarCambio(String token) {
        TokenCorreo usado = consumir(token, TipoTokenCorreo.CAMBIO_CORREO);
        User usuario = usuarios.findById(usado.getUsuarioId()).orElseThrow(TokenCorreoInvalidoException::new);
        String nuevo = usado.getNuevoEmail();
        boolean ocupado = usuarios.findByEmailIgnoreCase(nuevo)
                .filter(otro -> !otro.getId().equals(usuario.getId()))
                .isPresent();
        if (ocupado) {
            throw new CorreoEnUsoException();
        }
        String anterior = usuario.getEmail();
        usuario.setEmail(nuevo);
        usuario.setEmailVerificado(true);
        if (anterior != null && !anterior.isBlank()) {
            correo.enviar(anterior, "El correo de tu cuenta de BarHub ha cambiado", """
                    Hola %s:

                    Desde ahora tu cuenta de BarHub (%s) usa el correo %s. A esta dirección ya no
                    llegarán más avisos.

                    Si no has sido tú, responde a este correo o contacta con el bar cuanto antes.
                    """.formatted(nombre(usuario), usuario.getUsername(), enmascarar(nuevo)));
        }
        log.info("El usuario {} ha confirmado su correo nuevo", usuario.getId());
        return nuevo;
    }

    /** «ana.lopez@gmail.com» -> «a***@gmail.com»: suficiente para reconocerlo sin escribirlo entero. */
    static String enmascarar(String email) {
        int arroba = email.indexOf('@');
        return arroba <= 0 ? "***" : email.charAt(0) + "***" + email.substring(arroba);
    }

    @Scheduled(cron = "${app.correo.limpieza-cron:0 30 4 * * *}")
    @Transactional
    public void borrarCaducados() {
        tokens.borrarCaducadosAntesDe(reloj.instant().minus(Duration.ofDays(7)));
    }

    private Optional<User> buscar(String usuarioOEmail) {
        if (usuarioOEmail == null || usuarioOEmail.isBlank()) {
            return Optional.empty();
        }
        String valor = usuarioOEmail.trim();
        return usuarios.findByUsername(valor).or(() -> usuarios.findByEmailIgnoreCase(valor));
    }

    private boolean puedeEnviar(Long usuarioId, TipoTokenCorreo tipo) {
        Instant ahora = reloj.instant();
        return tokens.findFirstByUsuarioIdAndTipoOrderByCreadoDesc(usuarioId, tipo)
                .map(ultimo -> !ahora.isBefore(ultimo.getCreado().plus(ESPERA_ENTRE_CORREOS)))
                .orElse(true);
    }

    private String emitir(Long usuarioId, TipoTokenCorreo tipo) {
        return emitir(usuarioId, tipo, null);
    }

    /** Crea un token nuevo y anula los anteriores del mismo tipo que no se hayan usado. */
    private String emitir(Long usuarioId, TipoTokenCorreo tipo, String nuevoEmail) {
        Instant ahora = reloj.instant();
        tokens.findByUsuarioIdAndTipoAndUsadoEnIsNull(usuarioId, tipo).forEach(t -> t.setUsadoEn(ahora));

        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        TokenCorreo nuevo = new TokenCorreo();
        nuevo.setUsuarioId(usuarioId);
        nuevo.setTipo(tipo);
        nuevo.setTokenHash(hash(token));
        nuevo.setCreado(ahora);
        nuevo.setCaducaEn(ahora.plus(tipo.vigencia()));
        nuevo.setNuevoEmail(nuevoEmail);
        tokens.save(nuevo);
        return token;
    }

    private TokenCorreo consumir(String token, TipoTokenCorreo tipo) {
        if (token == null || token.isBlank()) {
            throw new TokenCorreoInvalidoException();
        }
        Instant ahora = reloj.instant();
        TokenCorreo encontrado = tokens.findByTokenHash(hash(token.trim()))
                .filter(t -> t.getTipo() == tipo && t.valido(ahora))
                .orElseThrow(TokenCorreoInvalidoException::new);
        encontrado.setUsadoEn(ahora);
        return encontrado;
    }

    private static String nombre(User usuario) {
        return usuario.getNombre() != null && !usuario.getNombre().isBlank() ? usuario.getNombre() : usuario.getUsername();
    }

    static String hash(String token) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
