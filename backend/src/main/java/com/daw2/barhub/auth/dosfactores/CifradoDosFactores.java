package com.daw2.barhub.auth.dosfactores;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Protege en la base de datos lo que permite pasar el segundo paso:
 * <ul>
 *   <li>El secreto TOTP se guarda cifrado con AES-256-GCM. Hace falta descifrarlo para calcular los
 *       codigos, asi que no puede ser un hash. El id del usuario va como dato autenticado: un
 *       secreto copiado a la fila de otro usuario no se descifra.</li>
 *   <li>De los codigos de recuperacion solo se guarda su HMAC-SHA256. Con la clave del servidor
 *       como pimienta, una copia de la base de datos no permite probarlos por fuerza bruta.</li>
 * </ul>
 * Las dos claves se derivan de {@code app.dos-factores.clave} (variable APP_TOTP_CLAVE) o, si no
 * esta definida, de {@code JWT_SECRET}. Si la clave cambia, los usuarios con la verificacion en dos
 * pasos activada tendran que configurarla otra vez (ver README).
 */
@Slf4j
@Component
public class CifradoDosFactores {

    private static final String VERSION = "v1:";
    private static final int BYTES_IV = 12;
    private static final int BITS_ETIQUETA = 128;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final SecretKeySpec claveCifrado;
    private final byte[] clavePimienta;

    public CifradoDosFactores(DosFactoresProperties propiedades, @Value("${jwt.jwtSecret:}") String secretoJwt) {
        String maestra = propiedades.clave();
        if (maestra == null || maestra.isBlank()) {
            if (secretoJwt == null || secretoJwt.isBlank()) {
                throw new IllegalStateException("Falta APP_TOTP_CLAVE (o JWT_SECRET) para cifrar los secretos TOTP");
            }
            log.info("APP_TOTP_CLAVE no esta definida: la clave del 2FA se deriva de JWT_SECRET");
            maestra = secretoJwt;
        }
        byte[] bytesMaestra = maestra.getBytes(StandardCharsets.UTF_8);
        this.claveCifrado = new SecretKeySpec(derivar(bytesMaestra, "barhub-2fa-cifrado-v1"), "AES");
        this.clavePimienta = derivar(bytesMaestra, "barhub-2fa-codigos-v1");
    }

    public String cifrar(Long usuarioId, byte[] secreto) {
        try {
            byte[] iv = new byte[BYTES_IV];
            ALEATORIO.nextBytes(iv);
            Cipher cifrador = Cipher.getInstance("AES/GCM/NoPadding");
            cifrador.init(Cipher.ENCRYPT_MODE, claveCifrado, new GCMParameterSpec(BITS_ETIQUETA, iv));
            cifrador.updateAAD(datosAsociados(usuarioId));
            byte[] cifrado = cifrador.doFinal(secreto);
            byte[] resultado = ByteBuffer.allocate(iv.length + cifrado.length).put(iv).put(cifrado).array();
            return VERSION + Base64.getEncoder().encodeToString(resultado);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo cifrar el secreto TOTP", e);
        }
    }

    /** @throws IllegalStateException si no se puede descifrar (otra clave, otro usuario o datos alterados) */
    public byte[] descifrar(Long usuarioId, String guardado) {
        if (guardado == null || !guardado.startsWith(VERSION)) {
            throw new IllegalStateException("Formato de secreto TOTP desconocido");
        }
        try {
            byte[] datos = Base64.getDecoder().decode(guardado.substring(VERSION.length()));
            Cipher descifrador = Cipher.getInstance("AES/GCM/NoPadding");
            descifrador.init(Cipher.DECRYPT_MODE, claveCifrado, new GCMParameterSpec(BITS_ETIQUETA, datos, 0, BYTES_IV));
            descifrador.updateAAD(datosAsociados(usuarioId));
            return descifrador.doFinal(datos, BYTES_IV, datos.length - BYTES_IV);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("No se pudo descifrar el secreto TOTP del usuario " + usuarioId, e);
        }
    }

    /** Huella de un codigo de recuperacion ya normalizado (sin guion y en mayusculas), en hexadecimal. */
    public String huella(String codigo) {
        return HexFormat.of().formatHex(hmac(clavePimienta, codigo.getBytes(StandardCharsets.UTF_8)));
    }

    private static byte[] datosAsociados(Long usuarioId) {
        return ("barhub-2fa:" + usuarioId).getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] derivar(byte[] maestra, String proposito) {
        return hmac(maestra, proposito.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] hmac(byte[] clave, byte[] datos) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(clave, "HmacSHA256"));
            return mac.doFinal(datos);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 no disponible", e);
        }
    }
}
