package com.daw2.barhub.auth.perfil;

import com.daw2.barhub.auditoria.AccionAuditoria;
import com.daw2.barhub.auditoria.Auditar;
import com.daw2.barhub.auditoria.Auditoria;
import com.daw2.barhub.auth.correo.CorreoEnUsoException;
import com.daw2.barhub.auth.correo.CuentaCorreoService;
import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.reautenticacion.RequiereReautenticacion;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.services.LoginAttemptService;
import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionService;
import com.daw2.barhub.model.dto.ErrorDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * La propia cuenta, para cualquier usuario con sesion (pestanas Cuenta, Seguridad y Privacidad del
 * perfil): correo, contrasena, verificacion en dos pasos, sesiones abiertas, descarga de los datos y
 * eliminacion de la cuenta. Siempre sobre el usuario del token,
 * nunca sobre un id de la URL, asi que no hay forma de tocar la cuenta de otro.
 *
 * <p>Cambiar el correo, descargar los datos, eliminar la cuenta y activar, quitar o regenerar la
 * verificacion en dos pasos exigen haberse reautenticado hace poco
 * (codigo de la app o, si aun no la tiene, contrasena): con una sesion robada no se puede ni
 * quitarla ni activarla con un movil ajeno para dejar fuera al dueno de la cuenta.
 */
@Slf4j
@RestController
@RequestMapping("/perfil")
public class PerfilController {

    private final DosFactoresService dosFactores;
    private final SesionService sesiones;
    private final UserRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService intentos;
    private final CuentaCorreoService cuentaCorreo;
    private final PrivacidadService privacidad;

    public PerfilController(DosFactoresService dosFactores, SesionService sesiones, UserRepository usuarios,
                            PasswordEncoder passwordEncoder, LoginAttemptService intentos,
                            CuentaCorreoService cuentaCorreo, PrivacidadService privacidad) {
        this.dosFactores = dosFactores;
        this.sesiones = sesiones;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.intentos = intentos;
        this.cuentaCorreo = cuentaCorreo;
        this.privacidad = privacidad;
    }

    /** {@code cambioCorreoPendiente}: el correo nuevo que espera a que se abra el enlace, o null. */
    public record EstadoSeguridad(boolean correoVerificado, boolean dosFactoresActiva, boolean dosFactoresObligatoria,
                                  int codigosRecuperacionRestantes, Long cuentaCreada, String cambioCorreoPendiente) {
    }

    public record CambioCorreo(@NotBlank @Size(max = 150) String nuevo) {
    }

    public record CambioPassword(@NotBlank @Size(max = 100) String actual, @NotBlank @Size(max = 100) String nueva) {
    }

    public record CodigoRequest(@NotBlank @Size(max = 20) String codigo) {
    }

    /** Sesion abierta, con las fechas en milisegundos desde 1970. {@code actual}: la de esta peticion. */
    public record SesionDto(String id, long creada, long ultimaActividad, String ip, String agente, boolean actual) {
    }

    // ---------- estado ----------

    @GetMapping("/seguridad")
    public ResponseEntity<?> estado(@AuthenticationPrincipal UserDetailsImpl yo) {
        User usuario = usuarios.findById(yo.getId()).orElse(null);
        if (usuario == null) {
            return noEncontrado();
        }
        boolean activa = dosFactores.activo(yo.getId());
        return ResponseEntity.ok(new EstadoSeguridad(
                usuario.correoVerificado(),
                activa,
                dosFactores.obligatorio(roles(yo)),
                activa ? dosFactores.codigosRestantes(yo.getId()) : 0,
                usuario.getCreatedAt() == null ? null : usuario.getCreatedAt().toEpochMilli(),
                cuentaCorreo.cambioPendiente(yo.getId()).orElse(null)));
    }

    // ---------- correo ----------

    /** Envia el enlace al correo nuevo; la cuenta no cambia de correo hasta que se abre. */
    @PostMapping("/correo")
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.CORREO_CAMBIO_PEDIDO)
    public ResponseEntity<?> cambiarCorreo(@AuthenticationPrincipal UserDetailsImpl yo, @Valid @RequestBody CambioCorreo cambio) {
        User usuario = usuarios.findById(yo.getId()).orElse(null);
        if (usuario == null) {
            return noEncontrado();
        }
        try {
            cuentaCorreo.solicitarCambio(usuario, cambio.nuevo());
            return ResponseEntity.accepted().body(Map.of("pendiente", cambio.nuevo().trim()));
        } catch (CorreoEnUsoException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorDto.from(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(ErrorDto.from(e.getMessage()));
        }
    }

    /** Anula el cambio de correo pendiente. */
    @DeleteMapping("/correo")
    @Auditar(AccionAuditoria.CORREO_CAMBIO_CANCELADO)
    public ResponseEntity<?> cancelarCambioCorreo(@AuthenticationPrincipal UserDetailsImpl yo) {
        cuentaCorreo.cancelarCambio(yo.getId());
        return ResponseEntity.noContent().build();
    }

    // ---------- privacidad ----------

    /** Todos los datos de la cuenta en JSON, como archivo para descargar. */
    @GetMapping("/mis-datos")
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.DATOS_DESCARGADOS)
    public ResponseEntity<Map<String, Object>> misDatos(@AuthenticationPrincipal UserDetailsImpl yo) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"barhub-mis-datos.json\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(privacidad.exportar(yo.getId()));
    }

    /** Elimina (anonimiza) la cuenta de un cliente y cierra todas sus sesiones. */
    @DeleteMapping
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.CUENTA_ELIMINADA)
    public ResponseEntity<?> eliminarCuenta(@AuthenticationPrincipal UserDetailsImpl yo) {
        try {
            privacidad.eliminarCuenta(yo.getId());
            // La entrada se guarda ya anonimizada, como las anteriores de esta cuenta
            Auditoria.cuentaEliminada(yo.getId());
            return ResponseEntity.noContent().build();
        } catch (PrivacidadService.EliminacionNoPermitidaException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        }
    }

    // ---------- contrasena ----------

    /**
     * Cambia la contrasena con la actual y cierra las demas sesiones abiertas (esta sigue). Un fallo
     * con la actual cuenta para el bloqueo del login, como un login fallido.
     */
    @PutMapping("/password")
    @Transactional
    @Auditar(AccionAuditoria.CONTRASENA_CAMBIADA)
    public ResponseEntity<?> cambiarPassword(@AuthenticationPrincipal UserDetailsImpl yo,
                                             @Valid @RequestBody CambioPassword cambio, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        long espera = intentos.segundosRestantes(yo.getUsername(), ip);
        if (espera > 0) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(espera))
                    .body(ErrorDto.from("Demasiados intentos fallidos. Vuelve a intentarlo más tarde."));
        }
        User usuario = usuarios.findById(yo.getId()).orElse(null);
        if (usuario == null) {
            return noEncontrado();
        }
        if (!passwordEncoder.matches(cambio.actual(), usuario.getPassword())) {
            Auditoria.detalle("Contraseña actual incorrecta");
            intentos.registrarFallo(yo.getUsername(), ip);
            return ResponseEntity.badRequest().body(ErrorDto.from("La contraseña actual no es correcta."));
        }
        if (cambio.nueva().length() < 6 || cambio.nueva().length() > 40) {
            return ResponseEntity.badRequest().body(ErrorDto.from("La nueva contraseña debe tener entre 6 y 40 caracteres."));
        }
        if (passwordEncoder.matches(cambio.nueva(), usuario.getPassword())) {
            return ResponseEntity.badRequest().body(ErrorDto.from("La nueva contraseña tiene que ser distinta de la actual."));
        }
        intentos.registrarExito(yo.getUsername());
        usuario.setPassword(passwordEncoder.encode(cambio.nueva()));
        Auditoria.detalle("Desde el perfil");
        usuarios.save(usuario);
        int cerradas = sesiones.cerrarOtras(yo.getId(), sesionActual(request), SesionService.MOTIVO_CAMBIO_CLAVE);
        log.info("El usuario {} ha cambiado su contraseña; {} sesiones cerradas", yo.getUsername(), cerradas);
        return ResponseEntity.ok(Map.of("sesionesCerradas", cerradas));
    }

    // ---------- verificacion en dos pasos ----------

    /** Secreto nuevo para dar de alta la cuenta en la app. No se activa hasta /activar. */
    @PostMapping("/dos-factores/configurar")
    public ResponseEntity<?> configurarDosFactores(@AuthenticationPrincipal UserDetailsImpl yo) {
        if (dosFactores.activo(yo.getId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ErrorDto.from("La verificación en dos pasos ya está activada."));
        }
        DosFactoresService.Configuracion configuracion = dosFactores.prepararConfiguracion(yo.getId(), yo.getUsername());
        return ResponseEntity.ok(Map.of("secreto", configuracion.secreto(), "uri", configuracion.uri()));
    }

    @PostMapping("/dos-factores/activar")
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.DOS_FACTORES_ACTIVADA)
    public ResponseEntity<?> activarDosFactores(@AuthenticationPrincipal UserDetailsImpl yo,
                                                @Valid @RequestBody CodigoRequest peticion) {
        Optional<List<String>> codigos = dosFactores.activar(yo.getId(), peticion.codigo());
        if (codigos.isEmpty()) {
            return ResponseEntity.badRequest().body(ErrorDto.from(
                    "Código incorrecto. Comprueba que la hora del móvil es la correcta y vuelve a intentarlo."));
        }
        return ResponseEntity.ok(Map.of("codigosRecuperacion", codigos.get()));
    }

    /** Solo si su rol no la exige (el personal no puede quitarsela). */
    @DeleteMapping("/dos-factores")
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.DOS_FACTORES_DESACTIVADA)
    public ResponseEntity<?> desactivarDosFactores(@AuthenticationPrincipal UserDetailsImpl yo) {
        if (dosFactores.obligatorio(roles(yo))) {
            return ResponseEntity.badRequest().body(ErrorDto.from(
                    "Tu cuenta tiene que usar la verificación en dos pasos: no se puede desactivar."));
        }
        dosFactores.desactivar(yo.getId());
        log.info("El usuario {} ha desactivado la verificación en dos pasos", yo.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/dos-factores/codigos")
    @RequiereReautenticacion(paraTodos = true)
    @Auditar(AccionAuditoria.CODIGOS_RECUPERACION_NUEVOS)
    public ResponseEntity<?> regenerarCodigos(@AuthenticationPrincipal UserDetailsImpl yo) {
        return dosFactores.regenerarCodigos(yo.getId())
                .<ResponseEntity<?>>map(codigos -> ResponseEntity.ok(Map.of("codigosRecuperacion", codigos)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ErrorDto.from("No tienes la verificación en dos pasos activada.")));
    }

    // ---------- sesiones ----------

    @GetMapping("/sesiones")
    public List<SesionDto> sesiones(@AuthenticationPrincipal UserDetailsImpl yo, HttpServletRequest request) {
        String actual = sesionActual(request);
        return sesiones.abiertas(yo.getId()).stream()
                .map(s -> aDto(s, actual))
                .toList();
    }

    /** Cierra una de sus sesiones (si es la actual, equivale a cerrar sesion). */
    @DeleteMapping("/sesiones/{id}")
    @Auditar(AccionAuditoria.SESIONES_CERRADAS)
    public ResponseEntity<?> cerrarSesion(@AuthenticationPrincipal UserDetailsImpl yo, @PathVariable String id) {
        // El id de la sesion no se guarda en el registro
        Auditoria.objetivo("Una sesión");
        return sesiones.cerrarDe(id, yo.getId())
                ? ResponseEntity.noContent().build()
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Sesión no encontrada"));
    }

    /** Cierra todas sus sesiones menos la de esta peticion. */
    @DeleteMapping("/sesiones")
    @Auditar(AccionAuditoria.SESIONES_CERRADAS)
    public ResponseEntity<?> cerrarLasDemas(@AuthenticationPrincipal UserDetailsImpl yo, HttpServletRequest request) {
        int cerradas = sesiones.cerrarOtras(yo.getId(), sesionActual(request), SesionService.MOTIVO_USUARIO);
        Auditoria.objetivo("Todas las demás (" + cerradas + ")");
        return ResponseEntity.ok(Map.of("sesionesCerradas", cerradas));
    }

    // ---------- auxiliares ----------

    private static SesionDto aDto(Sesion s, String actual) {
        return new SesionDto(s.getId(), s.getCreada().toEpochMilli(), s.getUltimaActividad().toEpochMilli(),
                s.getIp(), s.getAgente(), s.getId().equals(actual));
    }

    private static String sesionActual(HttpServletRequest request) {
        return (String) request.getAttribute(SesionService.ATRIBUTO_SESION);
    }

    private static List<String> roles(UserDetailsImpl yo) {
        return yo.getAuthorities().stream().map(a -> a.getAuthority()).toList();
    }

    private static ResponseEntity<?> noEncontrado() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Usuario no encontrado"));
    }
}
