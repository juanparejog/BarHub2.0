package com.daw2.barhub.auth.perfil;

import com.daw2.barhub.auditoria.AuditoriaService;
import com.daw2.barhub.auditoria.EventoAuditoria;
import com.daw2.barhub.auth.correo.CorreoService;
import com.daw2.barhub.auth.correo.TokenCorreoRepository;
import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionRepository;
import com.daw2.barhub.auth.sesion.SesionService;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Turno;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.TurnoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Derechos sobre los propios datos (pestaña Privacidad del perfil).
 *
 * <ul>
 *   <li>Descargar mis datos: lo que BarHub guarda de la cuenta, completo y en JSON. Sin contraseña, sin
 *       secretos de la verificación en dos pasos y sin tokens.</li>
 *   <li>Eliminar mi cuenta: se anonimiza en lugar de borrarse. Los pedidos son registros de venta
 *       que el bar tiene que conservar, así que se quedan, pero sin nada que identifique a la
 *       persona: nombre, correo, teléfono, dirección, foto, verificación en dos pasos, sesiones y
 *       enlaces pendientes se borran, y la cuenta no puede volver a usarse. Solo para clientes: el
 *       personal lo da de baja el administrador.</li>
 * </ul>
 */
@Slf4j
@Service
public class PrivacidadService {

    public static final String MOTIVO_CUENTA_ELIMINADA = "CUENTA_ELIMINADA";
    private static final Pattern NOMBRE_IMAGEN_VALIDO = Pattern.compile("^[a-z0-9][a-z0-9._-]{0,100}$", Pattern.CASE_INSENSITIVE);
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final UserRepository usuarios;
    private final PedidoRepository pedidos;
    private final TurnoRepository turnos;
    private final SesionRepository sesionesGuardadas;
    private final SesionService sesiones;
    private final DosFactoresService dosFactores;
    private final TokenCorreoRepository tokens;
    private final CorreoService correo;
    private final PasswordEncoder encoder;
    private final Clock reloj;
    private final String carpetaFotos;
    private final AuditoriaService auditoria;

    public PrivacidadService(UserRepository usuarios, PedidoRepository pedidos, TurnoRepository turnos,
                             SesionRepository sesionesGuardadas, SesionService sesiones, DosFactoresService dosFactores,
                             TokenCorreoRepository tokens, CorreoService correo, PasswordEncoder encoder, Clock reloj,
                             @Value("${app.upload.usuarios:../frontend/src/assets/images/usuarios/}") String carpetaFotos,
                             AuditoriaService auditoria) {
        this.usuarios = usuarios;
        this.pedidos = pedidos;
        this.turnos = turnos;
        this.sesionesGuardadas = sesionesGuardadas;
        this.sesiones = sesiones;
        this.dosFactores = dosFactores;
        this.tokens = tokens;
        this.correo = correo;
        this.encoder = encoder;
        this.reloj = reloj;
        this.carpetaFotos = carpetaFotos;
        this.auditoria = auditoria;
    }

    /** No se puede eliminar la cuenta (personal o ya eliminada). */
    public static class EliminacionNoPermitidaException extends RuntimeException {
        public EliminacionNoPermitidaException(String mensaje) {
            super(mensaje);
        }
    }

    // ---------- descargar mis datos ----------

    @Transactional(readOnly = true)
    public Map<String, Object> exportar(Long usuarioId) {
        User u = usuarios.findById(usuarioId).orElseThrow();
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("generado", reloj.instant().toString());
        datos.put("aviso", "Datos que BarHub guarda de tu cuenta. No incluye tu contraseña ni los secretos "
                + "de la verificación en dos pasos, que solo se guardan cifrados o como huella.");

        Map<String, Object> cuenta = new LinkedHashMap<>();
        cuenta.put("id", u.getId());
        cuenta.put("usuario", u.getUsername());
        cuenta.put("correo", u.getEmail());
        cuenta.put("correoVerificado", u.correoVerificado());
        cuenta.put("nombre", u.getNombre());
        cuenta.put("apellido1", u.getApellido1());
        cuenta.put("apellido2", u.getApellido2());
        cuenta.put("roles", u.getRoles().stream().map(r -> r.getName().name()).sorted().toList());
        cuenta.put("creada", texto(u.getCreatedAt()));
        cuenta.put("foto", u.getImagen());
        datos.put("cuenta", cuenta);

        Map<String, Object> direccion = new LinkedHashMap<>();
        direccion.put("telefono", u.getTelefono());
        direccion.put("calle", u.getCalle());
        direccion.put("tipoVivienda", u.getTipoVivienda() == null ? null : u.getTipoVivienda().name());
        direccion.put("portal", u.getPortalNum());
        direccion.put("piso", u.getPisoNum());
        direccion.put("puerta", u.getPuerta());
        direccion.put("urbanizacion", u.getUrbanizacionNombre());
        direccion.put("numeroCasa", u.getCasaNum());
        direccion.put("codigoPostal", u.getCodigoPostal());
        direccion.put("instruccionesEntrega", u.getInstruccionesEntrega());
        datos.put("direccionEntrega", direccion);

        boolean conDosFactores = dosFactores.activo(usuarioId);
        datos.put("verificacionEnDosPasos", Map.of(
                "activa", conDosFactores,
                "codigosRecuperacionSinUsar", conDosFactores ? dosFactores.codigosRestantes(usuarioId) : 0));

        datos.put("sesiones", sesionesGuardadas.findByUsuarioIdAndCreadaGreaterThanEqual(usuarioId, Instant.EPOCH)
                .stream().map(PrivacidadService::sesion).toList());
        datos.put("pedidos", pedidos.findByUsuarioIdWithDetalles(usuarioId).stream()
                .distinct().map(PrivacidadService::pedido).toList());
        datos.put("registroDeJornada", turnos.findByUsuarioIdOrderByEntradaDesc(usuarioId).stream()
                .map(PrivacidadService::turno).toList());
        datos.put("registroDeSeguridad", auditoria.ultimasDe(usuarioId).stream()
                .map(PrivacidadService::eventoAuditoria).toList());
        return datos;
    }

    private static Map<String, Object> sesion(Sesion s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("iniciada", texto(s.getCreada()));
        m.put("ultimaActividad", texto(s.getUltimaActividad()));
        m.put("cerrada", texto(s.getRevocadaEn()));
        m.put("motivoCierre", s.getMotivoRevocacion());
        m.put("ip", s.getIp());
        m.put("navegador", s.getAgente());
        return m;
    }

    private static Map<String, Object> pedido(Pedido p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("fecha", p.getFecha() == null ? null : p.getFecha().toString());
        m.put("tipo", p.getTipoPedido() == null ? null : p.getTipoPedido().name());
        m.put("estado", p.getEstado() == null ? null : p.getEstado().name());
        m.put("total", p.getPrecioTotal());
        m.put("metodoPago", p.getMetodoPago());
        m.put("estadoPago", p.getEstadoPago() == null ? null : p.getEstadoPago().name());
        m.put("direccionEnvio", p.getDireccionEnvio());
        m.put("telefonoContacto", p.getTelefonoContacto());
        m.put("productos", p.getDetalles().stream().map(PrivacidadService::linea).toList());
        return m;
    }

    private static Map<String, Object> linea(DetallePedido d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("producto", d.getProducto() == null ? null : d.getProducto().getNombre());
        m.put("cantidad", d.getCantidad());
        m.put("precioUnitario", d.getPrecioUnitario());
        return m;
    }

    private static Map<String, Object> turno(Turno t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entrada", texto(t.getEntrada()));
        m.put("salida", texto(t.getSalida()));
        m.put("cierre", t.getCierre() == null ? null : t.getCierre().name());
        return m;
    }

    private static Map<String, Object> eventoAuditoria(EventoAuditoria e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fecha", texto(e.getFecha()));
        m.put("accion", e.getAccion().name());
        m.put("resultado", e.getResultado().name());
        m.put("ip", e.getIp());
        m.put("detalle", e.getDetalle());
        return m;
    }

    private static String texto(Instant instante) {
        return instante == null ? null : instante.toString();
    }

    // ---------- eliminar mi cuenta ----------

    /**
     * Anonimiza la cuenta de un cliente. Antes de borrar el correo le envía un aviso a esa dirección.
     *
     * @throws EliminacionNoPermitidaException si es del personal o ya estaba eliminada
     */
    @Transactional
    public void eliminarCuenta(Long usuarioId) {
        User u = usuarios.findById(usuarioId).orElseThrow();
        if (u.getEliminadoEn() != null) {
            throw new EliminacionNoPermitidaException("Esta cuenta ya está eliminada.");
        }
        boolean personal = u.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleEnum.ROLE_ADMIN || r.getName() == RoleEnum.ROLE_EMPLEADO);
        if (personal) {
            throw new EliminacionNoPermitidaException(
                    "Las cuentas del personal las da de baja el administrador desde Gestionar Usuarios.");
        }
        Instant ahora = reloj.instant();
        String correoAnterior = u.getEmail();
        String usuarioAnterior = u.getUsername();
        String nombre = u.getNombre() != null && !u.getNombre().isBlank() ? u.getNombre() : u.getUsername();
        String foto = u.getImagen();

        u.setUsername("eliminado-" + u.getId());
        u.setEmail("eliminado-" + u.getId() + "@barhub.invalid");
        u.setEmailVerificado(false);
        // Contrasena aleatoria que nadie conoce: la cuenta no vuelve a abrirse
        byte[] aleatorio = new byte[32];
        ALEATORIO.nextBytes(aleatorio);
        u.setPassword(encoder.encode(Base64.getEncoder().encodeToString(aleatorio)));
        u.setNombre("Usuario");
        u.setApellido1("eliminado");
        u.setApellido2(null);
        u.setTelefono(null);
        u.setCalle(null);
        u.setTipoVivienda(null);
        u.setPortalNum(null);
        u.setPisoNum(null);
        u.setPuerta(null);
        u.setUrbanizacionNombre(null);
        u.setCasaNum(null);
        u.setCodigoPostal(null);
        u.setInstruccionesEntrega(null);
        u.setImagen(null);
        u.getRoles().clear();
        u.setEliminadoEn(ahora);
        usuarios.save(u);

        // Los pedidos se conservan como registro de venta, sin la direccion ni el telefono
        pedidos.findByUsuarioIdWithDetalles(usuarioId).stream().distinct().forEach(p -> {
            p.setDireccionEnvio(null);
            p.setTelefonoContacto(null);
        });
        dosFactores.desactivar(usuarioId);
        tokens.anularDe(usuarioId, ahora);
        sesionesGuardadas.findByUsuarioIdAndCreadaGreaterThanEqual(usuarioId, Instant.EPOCH)
                .forEach(s -> {
                    s.setIp(null);
                    s.setAgente(null);
                });
        sesiones.cerrarTodas(usuarioId, MOTIVO_CUENTA_ELIMINADA);
        // El registro de auditoria se queda (seguridad del sistema), pero sin su nombre ni sus IP
        auditoria.anonimizar(usuarioId, usuarioAnterior);
        borrarFoto(foto);

        if (correoAnterior != null && !correoAnterior.isBlank()) {
            correo.enviar(correoAnterior, "Tu cuenta de BarHub se ha eliminado", """
                    Hola %s:

                    Tal como pediste, hemos eliminado tu cuenta de BarHub y borrado tus datos
                    personales. Tus pedidos se conservan como registro de venta del bar, sin nada que
                    te identifique.

                    Si no has sido tú, contacta con el bar cuanto antes.
                    """.formatted(nombre));
        }
        log.info("Cuenta {} eliminada por su titular (anonimizada)", usuarioId);
    }

    private void borrarFoto(String nombre) {
        if (nombre == null || !NOMBRE_IMAGEN_VALIDO.matcher(nombre).matches()) {
            return;
        }
        Path carpeta = Paths.get(carpetaFotos).toAbsolutePath().normalize();
        Path ruta = carpeta.resolve(nombre).normalize();
        if (!ruta.startsWith(carpeta) || Objects.equals(ruta, carpeta)) {
            return;
        }
        try {
            Files.deleteIfExists(ruta);
        } catch (IOException e) {
            log.warn("No se pudo borrar la foto de la cuenta eliminada", e);
        }
    }
}
