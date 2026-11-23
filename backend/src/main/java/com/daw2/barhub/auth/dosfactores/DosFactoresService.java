package com.daw2.barhub.auth.dosfactores;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;

/**
 * Verificacion en dos pasos con una app de autenticacion (TOTP) y codigos de recuperacion.
 *
 * <ul>
 *   <li>Configurar: se genera un secreto de 160 bits que el usuario guarda en su app (codigo QR o
 *       clave escrita). No queda activo hasta que escribe el primer codigo correcto, que demuestra
 *       que la app lo tiene bien.</li>
 *   <li>Al activarla se entregan {@value #NUM_CODIGOS} codigos de recuperacion, de un solo uso, para
 *       entrar si pierde el movil. Solo se muestran esa vez.</li>
 *   <li>Verificar: vale el codigo de la app (sin repetir uno ya usado) o un codigo de recuperacion.</li>
 * </ul>
 */
@Slf4j
@Service
public class DosFactoresService {

    public static final int NUM_CODIGOS = 10;
    static final int BYTES_SECRETO = 20;
    /** Sin 0/O ni 1/I/L, que se confunden al copiarlos a mano. */
    private static final String ALFABETO_CODIGOS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int LONGITUD_CODIGO = 10;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final SegundoFactorRepository segundosFactores;
    private final CodigoRecuperacionRepository codigos;
    private final CifradoDosFactores cifrado;
    private final DosFactoresProperties propiedades;
    private final Clock reloj;

    public DosFactoresService(SegundoFactorRepository segundosFactores, CodigoRecuperacionRepository codigos,
                              CifradoDosFactores cifrado, DosFactoresProperties propiedades, Clock reloj) {
        this.segundosFactores = segundosFactores;
        this.codigos = codigos;
        this.cifrado = cifrado;
        this.propiedades = propiedades;
        this.reloj = reloj;
    }

    /** Clave para escribirla en la app (Base32) y la misma clave como URI otpauth:// para el QR. */
    public record Configuracion(String secreto, String uri) {
    }

    /** Resultado de comprobar un codigo. {@code codigosRestantes} solo tiene sentido con un codigo de recuperacion. */
    public record Verificacion(boolean valida, boolean conCodigoRecuperacion, int codigosRestantes) {
        static final Verificacion INCORRECTA = new Verificacion(false, false, 0);
    }

    @Transactional(readOnly = true)
    public boolean activo(Long usuarioId) {
        return segundosFactores.findByUsuarioId(usuarioId).map(SegundoFactor::isActivo).orElse(false);
    }

    public boolean obligatorio(Collection<String> roles) {
        return propiedades.obligatorioPara(roles);
    }

    /** Ids de los usuarios con la verificacion activada (para el listado del administrador). */
    @Transactional(readOnly = true)
    public Set<Long> usuariosConActiva() {
        return new HashSet<>(segundosFactores.usuariosConActiva());
    }

    /**
     * Quita la verificacion en dos pasos y los codigos de recuperacion de un usuario (el
     * administrador cuando alguien pierde el movil, o al borrar la cuenta). Si su rol la exige,
     * la configurara de nuevo en su siguiente inicio de sesion.
     *
     * @return true si la tenia activada
     */
    @Transactional
    public boolean desactivar(Long usuarioId) {
        boolean estabaActiva = activo(usuarioId);
        codigos.borrarDe(usuarioId);
        segundosFactores.borrarDe(usuarioId);
        return estabaActiva;
    }

    /**
     * Solo el codigo de la app, sin codigos de recuperacion: para reautenticarse ya dentro de la
     * sesion, donde no tiene sentido gastar uno de ellos.
     */
    @Transactional
    public boolean verificarCodigoApp(Long usuarioId, String codigo) {
        String limpio = limpiar(codigo);
        return limpio.matches("\\d{" + Totp.DIGITOS + "}")
                && segundosFactores.findByUsuarioId(usuarioId).filter(SegundoFactor::isActivo)
                        .map(activo -> verificarTotp(activo, limpio).valida())
                        .orElse(false);
    }

    /**
     * Empieza (o vuelve a empezar) la configuracion con un secreto nuevo.
     *
     * @param cuenta nombre con el que aparece en la app de autenticacion
     * @throws IllegalStateException si ya esta activa: no se puede cambiar el secreto sin desactivarla
     */
    @Transactional
    public Configuracion prepararConfiguracion(Long usuarioId, String cuenta) {
        SegundoFactor segundoFactor = segundosFactores.findByUsuarioId(usuarioId).orElseGet(() -> {
            SegundoFactor nuevo = new SegundoFactor();
            nuevo.setUsuarioId(usuarioId);
            return nuevo;
        });
        if (segundoFactor.isActivo()) {
            throw new IllegalStateException("La verificación en dos pasos ya está activada");
        }
        byte[] secreto = new byte[BYTES_SECRETO];
        ALEATORIO.nextBytes(secreto);
        segundoFactor.setSecretoCifrado(cifrado.cifrar(usuarioId, secreto));
        segundoFactor.setCreadoEn(reloj.instant());
        segundoFactor.setUltimoPaso(null);
        segundosFactores.save(segundoFactor);

        String base32 = Base32.codificar(secreto);
        return new Configuracion(base32, Totp.uri(propiedades.emisor(), cuenta, base32));
    }

    /**
     * Activa la configuracion pendiente si el codigo de la app es correcto.
     *
     * @return los codigos de recuperacion, que no se guardan en claro en ningun sitio; vacio si el
     * codigo no es correcto o no hay ninguna configuracion pendiente
     */
    @Transactional
    public Optional<List<String>> activar(Long usuarioId, String codigo) {
        Optional<SegundoFactor> pendiente = segundosFactores.findByUsuarioId(usuarioId).filter(s -> !s.isActivo());
        if (pendiente.isEmpty()) {
            return Optional.empty();
        }
        SegundoFactor segundoFactor = pendiente.get();
        Instant ahora = reloj.instant();
        OptionalLong paso = Totp.verificar(secreto(segundoFactor), limpiar(codigo), ahora, null);
        if (paso.isEmpty()) {
            return Optional.empty();
        }
        segundoFactor.setActivo(true);
        segundoFactor.setActivadoEn(ahora);
        segundoFactor.setUltimoPaso(paso.getAsLong());
        segundosFactores.save(segundoFactor);
        log.info("Verificación en dos pasos activada para el usuario {}", usuarioId);
        return Optional.of(generarCodigos(usuarioId, ahora));
    }

    /** Comprueba un codigo de la app (6 digitos) o un codigo de recuperacion (XXXXX-XXXXX). */
    @Transactional
    public Verificacion verificar(Long usuarioId, String codigo) {
        Optional<SegundoFactor> activo = segundosFactores.findByUsuarioId(usuarioId).filter(SegundoFactor::isActivo);
        String limpio = limpiar(codigo);
        if (activo.isEmpty() || limpio.isEmpty()) {
            return Verificacion.INCORRECTA;
        }
        if (limpio.matches("\\d{" + Totp.DIGITOS + "}")) {
            return verificarTotp(activo.get(), limpio);
        }
        if (limpio.length() == LONGITUD_CODIGO) {
            return usarCodigoRecuperacion(usuarioId, limpio);
        }
        return Verificacion.INCORRECTA;
    }

    private Verificacion verificarTotp(SegundoFactor segundoFactor, String codigo) {
        byte[] secreto;
        try {
            secreto = secreto(segundoFactor);
        } catch (IllegalStateException e) {
            // La clave ha cambiado: el usuario tendra que configurarlo de nuevo (ver README)
            log.error("No se puede descifrar el secreto TOTP del usuario {}: ¿ha cambiado APP_TOTP_CLAVE o JWT_SECRET?",
                    segundoFactor.getUsuarioId());
            return Verificacion.INCORRECTA;
        }
        OptionalLong paso = Totp.verificar(secreto, codigo, reloj.instant(), segundoFactor.getUltimoPaso());
        if (paso.isPresent() && segundosFactores.marcarPaso(segundoFactor.getId(), paso.getAsLong()) == 1) {
            return new Verificacion(true, false, 0);
        }
        return Verificacion.INCORRECTA;
    }

    private Verificacion usarCodigoRecuperacion(Long usuarioId, String codigo) {
        Optional<CodigoRecuperacion> encontrado =
                codigos.findFirstByUsuarioIdAndHuellaAndUsadoEnIsNull(usuarioId, cifrado.huella(codigo));
        if (encontrado.isEmpty() || codigos.marcarUsado(encontrado.get().getId(), reloj.instant()) != 1) {
            return Verificacion.INCORRECTA;
        }
        int restantes = (int) codigos.countByUsuarioIdAndUsadoEnIsNull(usuarioId);
        log.warn("El usuario {} ha entrado con un código de recuperación; le quedan {}", usuarioId, restantes);
        return new Verificacion(true, true, restantes);
    }

    /** Sustituye todos los codigos de recuperacion del usuario por {@value #NUM_CODIGOS} nuevos. */
    private List<String> generarCodigos(Long usuarioId, Instant ahora) {
        codigos.borrarDe(usuarioId);
        List<String> nuevos = new ArrayList<>(NUM_CODIGOS);
        while (nuevos.size() < NUM_CODIGOS) {
            String codigo = codigoAleatorio();
            String legible = codigo.substring(0, LONGITUD_CODIGO / 2) + "-" + codigo.substring(LONGITUD_CODIGO / 2);
            if (nuevos.contains(legible)) {
                continue;
            }
            CodigoRecuperacion guardado = new CodigoRecuperacion();
            guardado.setUsuarioId(usuarioId);
            guardado.setHuella(cifrado.huella(codigo));
            guardado.setCreadoEn(ahora);
            codigos.save(guardado);
            nuevos.add(legible);
        }
        return nuevos;
    }

    private static String codigoAleatorio() {
        StringBuilder codigo = new StringBuilder(LONGITUD_CODIGO);
        for (int i = 0; i < LONGITUD_CODIGO; i++) {
            codigo.append(ALFABETO_CODIGOS.charAt(ALEATORIO.nextInt(ALFABETO_CODIGOS.length())));
        }
        return codigo.toString();
    }

    private byte[] secreto(SegundoFactor segundoFactor) {
        return cifrado.descifrar(segundoFactor.getUsuarioId(), segundoFactor.getSecretoCifrado());
    }

    /** Sin espacios ni guiones y en mayusculas: "abcde-fghij" y "ABCDEFGHIJ" son el mismo codigo. */
    static String limpiar(String codigo) {
        return codigo == null ? "" : codigo.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }
}
