package com.daw2.barhub.auth.controllers;

import com.daw2.barhub.auth.correo.CuentaCorreoService;
import com.daw2.barhub.auth.correo.CorreoEnUsoException;
import com.daw2.barhub.auth.correo.TokenCorreoInvalidoException;
import com.daw2.barhub.auth.dosfactores.DesafioService;
import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.reautenticacion.ReautenticacionService;
import com.daw2.barhub.auth.jwt.JwtUtils;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.payload.request.LoginRequest;
import com.daw2.barhub.auth.payload.request.SignupRequest;
import com.daw2.barhub.auth.payload.response.JwtResponse;
import com.daw2.barhub.auth.payload.response.MessageResponse;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.services.LoginAttemptService;
import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.auth.sesion.Sesion;
import com.daw2.barhub.auth.sesion.SesionInvalidaException;
import com.daw2.barhub.auth.sesion.SesionProperties;
import com.daw2.barhub.auth.sesion.SesionService;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.service.TurnoService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.WebUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
public class AuthController {
  @Autowired
  AuthenticationManager authenticationManager;

  @Autowired
  UserRepository userRepository;

  @Autowired
  RoleRepository roleRepository;

  @Autowired
  PasswordEncoder encoder;

  @Autowired
  JwtUtils jwtUtils;

  @Autowired
  LoginAttemptService loginAttemptService;

  @Autowired
  SesionService sesionService;

  @Autowired
  SesionProperties sesionProperties;

  @Autowired
  Clock reloj;

  @Autowired
  TurnoService turnoService;

  @Autowired
  CuentaCorreoService cuentaCorreoService;

  @Autowired
  DosFactoresService dosFactores;

  @Autowired
  DesafioService desafios;

  @Autowired
  ReautenticacionService reautenticacion;

  /** Codigo del 403 de un login correcto con el correo sin confirmar (el frontend ofrece reenviarlo). */
  public static final String CODIGO_CORREO_SIN_CONFIRMAR = "EMAIL_NO_VERIFICADO";
  /** Codigo del 401 del segundo paso con un codigo que no es correcto. */
  public static final String CODIGO_INCORRECTO = "CODIGO_INCORRECTO";
  /** Codigo del 401 del segundo paso cuando el desafio ya no vale: hay que volver a escribir la contrasena. */
  public static final String CODIGO_DESAFIO_CADUCADO = "DESAFIO_CADUCADO";

  public record TokenRequest(@NotBlank String token) {
  }

  public record ReenvioRequest(@NotBlank String usuario) {
  }

  public record RecuperacionRequest(@NotBlank @Email String email) {
  }

  public record RestablecerRequest(@NotBlank String token, @NotBlank String password) {
  }

  public record DesafioRequest(@NotBlank String desafio) {
  }

  public record CodigoRequest(@NotBlank String desafio, @NotBlank @Size(max = 20) String codigo) {
  }

  /**
   * Respuesta de un login con la contrasena correcta al que le falta el segundo paso. Con
   * {@code configurar} el rol del usuario la exige y aun no la ha activado.
   */
  public record DesafioResponse(boolean requiere2fa, boolean configurar, String desafio, long caducaEnSegundos) {
  }

  public record ConfiguracionResponse(String secreto, String uri) {
  }

  /** Codigo de la app o, si no tiene la verificacion en dos pasos, la contrasena. */
  public record ReautenticacionRequest(@Size(max = 20) String codigo, @Size(max = 100) String password) {
  }

  public record ReautenticacionResponse(long reautenticadaHasta) {
  }

  @PostMapping("/login")
  public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request) {

    String usuario = loginRequest.getUsername();
    String ip = ipCliente(request);
    long espera = loginAttemptService.segundosRestantes(usuario, ip);
    if (espera > 0) {
      return demasiadosIntentos(espera);
    }

    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(
              new UsernamePasswordAuthenticationToken(usuario, loginRequest.getPassword()));
    } catch (BadCredentialsException e) {
      // tambien se cuentan los usuarios que no existen: asi no se revela cuales existen
      loginAttemptService.registrarFallo(usuario, ip);
      throw e;
    }

    UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
    // La clave es correcta, pero la cuenta no se puede usar hasta confirmar el correo
    boolean sinConfirmar = userRepository.findById(userDetails.getId())
            .map(cuenta -> !cuenta.correoVerificado())
            .orElse(false);
    if (sinConfirmar) {
      loginAttemptService.registrarExito(usuario);
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorDto(CODIGO_CORREO_SIN_CONFIRMAR,
              "Confirma tu correo antes de iniciar sesión: te enviamos un enlace al registrarte."));
    }

    boolean conDosFactores = dosFactores.activo(userDetails.getId());
    if (conDosFactores || dosFactores.obligatorio(roles(userDetails))) {
      // Falta el segundo paso. El contador de fallos no se limpia hasta terminarlo: asi los codigos
      // incorrectos suman para el bloqueo y repetir la contrasena no da intentos nuevos
      DesafioService.Proposito proposito = conDosFactores
              ? DesafioService.Proposito.VERIFICAR : DesafioService.Proposito.CONFIGURAR;
      String desafio = desafios.crear(userDetails.getId(), usuario, proposito);
      return ResponseEntity.ok(new DesafioResponse(true, !conDosFactores, desafio, DesafioService.DURACION.toSeconds()));
    }

    loginAttemptService.registrarExito(usuario);
    return completarLogin(userDetails, request);
  }

  /** Segundo paso con el codigo de la app de autenticacion o un codigo de recuperacion. */
  @PostMapping("/2fa/verificar")
  public ResponseEntity<?> verificarDosFactores(@Valid @RequestBody CodigoRequest peticion, HttpServletRequest request) {
    DesafioService.Desafio desafio = desafios.consultar(peticion.desafio(), DesafioService.Proposito.VERIFICAR).orElse(null);
    if (desafio == null) {
      return desafioCaducado();
    }
    String ip = ipCliente(request);
    long espera = loginAttemptService.segundosRestantes(desafio.usuario(), ip);
    if (espera > 0) {
      desafios.consumir(peticion.desafio());
      return demasiadosIntentos(espera);
    }

    DosFactoresService.Verificacion verificacion = dosFactores.verificar(desafio.usuarioId(), peticion.codigo());
    if (!verificacion.valida()) {
      return codigoIncorrecto(peticion.desafio(), desafio, ip);
    }
    desafios.consumir(peticion.desafio());
    loginAttemptService.registrarExito(desafio.usuario());
    ResponseEntity<?> respuesta = completarLogin(desafio.usuarioId(), request);
    if (verificacion.conCodigoRecuperacion() && respuesta.getBody() instanceof JwtResponse sesion) {
      sesion.setCodigosRecuperacionRestantes(verificacion.codigosRestantes());
    }
    return respuesta;
  }

  /** Primer paso de la configuracion obligatoria: secreto nuevo para la app (clave y URI del QR). */
  @PostMapping("/2fa/configurar")
  public ResponseEntity<?> configurarDosFactores(@Valid @RequestBody DesafioRequest peticion) {
    DesafioService.Desafio desafio = desafios.consultar(peticion.desafio(), DesafioService.Proposito.CONFIGURAR).orElse(null);
    User usuario = desafio == null ? null : userRepository.findById(desafio.usuarioId()).orElse(null);
    if (usuario == null) {
      return desafioCaducado();
    }
    DosFactoresService.Configuracion configuracion = dosFactores.prepararConfiguracion(usuario.getId(), usuario.getUsername());
    return ResponseEntity.ok(new ConfiguracionResponse(configuracion.secreto(), configuracion.uri()));
  }

  /** Activa la configuracion con el primer codigo de la app y termina el login con los codigos de recuperacion. */
  @PostMapping("/2fa/activar")
  public ResponseEntity<?> activarDosFactores(@Valid @RequestBody CodigoRequest peticion, HttpServletRequest request) {
    DesafioService.Desafio desafio = desafios.consultar(peticion.desafio(), DesafioService.Proposito.CONFIGURAR).orElse(null);
    if (desafio == null) {
      return desafioCaducado();
    }
    String ip = ipCliente(request);
    long espera = loginAttemptService.segundosRestantes(desafio.usuario(), ip);
    if (espera > 0) {
      desafios.consumir(peticion.desafio());
      return demasiadosIntentos(espera);
    }

    Optional<List<String>> codigos = dosFactores.activar(desafio.usuarioId(), peticion.codigo());
    if (codigos.isEmpty()) {
      return codigoIncorrecto(peticion.desafio(), desafio, ip);
    }
    desafios.consumir(peticion.desafio());
    loginAttemptService.registrarExito(desafio.usuario());
    ResponseEntity<?> respuesta = completarLogin(desafio.usuarioId(), request);
    if (respuesta.getBody() instanceof JwtResponse sesion) {
      sesion.setCodigosRecuperacion(codigos.get());
    }
    return respuesta;
  }

  /**
   * Confirma de nuevo la identidad dentro de una sesion abierta, antes de una accion critica (ver
   * RequiereReautenticacion). Con la verificacion en dos pasos vale solo el codigo de la app; si no
   * la tiene, la contrasena. Los fallos cuentan para el bloqueo del login, como en el segundo paso.
   * Un codigo incorrecto responde 400 (no 401): la sesion sigue siendo valida.
   */
  @PostMapping("/reautenticar")
  public ResponseEntity<?> reautenticar(@Valid @RequestBody ReautenticacionRequest peticion,
                                        HttpServletRequest request, Authentication autenticacion) {
    String sesion = (String) request.getAttribute(SesionService.ATRIBUTO_SESION);
    if (sesion == null || autenticacion == null || !(autenticacion.getPrincipal() instanceof UserDetailsImpl usuario)) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(new MessageResponse("Tu sesión ha caducado. Vuelve a iniciar sesión."));
    }
    String ip = ipCliente(request);
    long espera = loginAttemptService.segundosRestantes(usuario.getUsername(), ip);
    if (espera > 0) {
      return demasiadosIntentos(espera);
    }

    boolean conCodigo = reautenticacion.metodo(usuario.getId()) == ReautenticacionService.Metodo.CODIGO;
    boolean correcto = conCodigo
            ? dosFactores.verificarCodigoApp(usuario.getId(), peticion.codigo())
            : peticion.password() != null && encoder.matches(peticion.password(), usuario.getPassword());
    if (!correcto) {
      loginAttemptService.registrarFallo(usuario.getUsername(), ip);
      return ResponseEntity.badRequest().body(new ErrorDto(CODIGO_INCORRECTO, conCodigo
              ? "Código incorrecto. Comprueba que la hora del móvil es la correcta y vuelve a intentarlo."
              : "Contraseña incorrecta."));
    }
    loginAttemptService.registrarExito(usuario.getUsername());
    Instant hasta = reautenticacion.confirmar(sesion, usuario.getId());
    if (hasta == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(new MessageResponse("Tu sesión ha caducado. Vuelve a iniciar sesión."));
    }
    return ResponseEntity.ok(new ReautenticacionResponse(hasta.toEpochMilli()));
  }

  /** Abre la sesion: turno del empleado, sesion en el servidor, token de acceso y cookie de renovacion. */
  private ResponseEntity<?> completarLogin(UserDetailsImpl userDetails, HttpServletRequest request) {
    // El turno va antes que la sesion nueva: asi un turno viejo sin sesiones abiertas se cierra primero
    turnoService.abrirSiCorresponde(userDetails.getId(), userDetails.getUsername(), roles(userDetails));
    SesionService.NuevaSesion nueva = sesionService.abrir(userDetails.getId(), roles(userDetails),
            ipCliente(request), request.getHeader(HttpHeaders.USER_AGENT));
    String jwt = jwtUtils.generarTokenAcceso(userDetails, nueva.sesion().getId());

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookieRenovacion(nueva.tokenRenovacion(), nueva.sesion().getCaducaEn()).toString())
            .body(respuesta(jwt, userDetails, nueva.sesion()));
  }

  private ResponseEntity<?> completarLogin(Long usuarioId, HttpServletRequest request) {
    return userRepository.findById(usuarioId)
            .<ResponseEntity<?>>map(usuario -> completarLogin(UserDetailsImpl.build(usuario), request))
            .orElseGet(AuthController::desafioCaducado);
  }

  private ResponseEntity<?> codigoIncorrecto(String token, DesafioService.Desafio desafio, String ip) {
    loginAttemptService.registrarFallo(desafio.usuario(), ip);
    if (!desafios.registrarFallo(token)) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorDto(CODIGO_DESAFIO_CADUCADO,
              "Demasiados códigos incorrectos. Vuelve a iniciar sesión."));
    }
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorDto(CODIGO_INCORRECTO,
            "Código incorrecto. Comprueba que la hora del móvil es la correcta y vuelve a intentarlo."));
  }

  private static ResponseEntity<?> desafioCaducado() {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorDto(CODIGO_DESAFIO_CADUCADO,
            "Ha pasado demasiado tiempo. Vuelve a iniciar sesión."));
  }

  private static ResponseEntity<?> demasiadosIntentos(long espera) {
    long minutos = (espera + 59) / 60;
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .header("Retry-After", String.valueOf(espera))
            .body(new MessageResponse("Demasiados intentos fallidos. Vuelve a intentarlo en "
                    + minutos + (minutos == 1 ? " minuto." : " minutos.")));
  }

  /**
   * Entrega un token de acceso nuevo a partir de la cookie de renovacion, que se rota.
   * Responde 401 y borra la cookie si la sesion no existe, esta cerrada o ha caducado.
   */
  @PostMapping("/refresh")
  public ResponseEntity<?> renovar(HttpServletRequest request) {
    try {
      SesionService.Renovacion renovacion = sesionService.renovar(leerCookie(request));
      User usuario = userRepository.findById(renovacion.sesion().getUsuarioId())
              .orElseThrow(() -> new SesionInvalidaException("El usuario ya no existe"));
      UserDetailsImpl userDetails = UserDetailsImpl.build(usuario);
      String jwt = jwtUtils.generarTokenAcceso(userDetails, renovacion.sesion().getId());

      ResponseEntity.BodyBuilder ok = ResponseEntity.ok();
      if (renovacion.tokenRenovacion() != null) {
        ok.header(HttpHeaders.SET_COOKIE,
                cookieRenovacion(renovacion.tokenRenovacion(), renovacion.sesion().getCaducaEn()).toString());
      }
      return ok.body(respuesta(jwt, userDetails, renovacion.sesion()));
    } catch (SesionInvalidaException e) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .header(HttpHeaders.SET_COOKIE, cookieBorrada().toString())
              .body(new MessageResponse("Tu sesión ha caducado. Vuelve a iniciar sesión."));
    }
  }

  /** Cierra la sesion en el servidor: dejan de valer su token de renovacion y sus tokens de acceso. */
  @PostMapping("/logout")
  public ResponseEntity<Void> cerrarSesion(HttpServletRequest request) {
    sesionService.cerrar(leerCookie(request));
    return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, cookieBorrada().toString())
            .build();
  }

  private static List<String> roles(UserDetailsImpl userDetails) {
    return userDetails.getAuthorities().stream()
            .map(item -> item.getAuthority())
            .collect(Collectors.toList());
  }

  private static JwtResponse respuesta(String jwt, UserDetailsImpl userDetails, Sesion sesion) {
    JwtResponse respuesta = new JwtResponse(jwt, userDetails.getId(), userDetails.getUsername(),
            userDetails.getEmail(), roles(userDetails));
    respuesta.setSesionCaducaEn(sesion.getCaducaEn().toEpochMilli());
    respuesta.setSesionInactividadSegundos(sesion.getInactividadSegundos());
    return respuesta;
  }

  private String leerCookie(HttpServletRequest request) {
    Cookie cookie = WebUtils.getCookie(request, sesionProperties.cookie().nombre());
    return cookie != null ? cookie.getValue() : null;
  }

  /** HttpOnly (JavaScript no la lee), SameSite=Strict (no viaja desde otros sitios) y solo para /api/auth. */
  private ResponseCookie cookieRenovacion(String valor, Instant caducaEn) {
    Duration vida = Duration.between(reloj.instant(), caducaEn);
    return baseCookie(valor).maxAge(vida.isNegative() ? Duration.ZERO : vida).build();
  }

  private ResponseCookie cookieBorrada() {
    return baseCookie("").maxAge(Duration.ZERO).build();
  }

  private ResponseCookie.ResponseCookieBuilder baseCookie(String valor) {
    SesionProperties.Cookie config = sesionProperties.cookie();
    return ResponseCookie.from(config.nombre(), valor)
            .httpOnly(true)
            .secure(config.segura())
            .sameSite("Strict")
            .path(config.ruta());
  }

  /**
   * IP del cliente. Detras de Caddy la resuelve Tomcat a partir de X-Forwarded-For
   * (server.forward-headers-strategy: native), y solo si la peticion llega desde un proxy de la red
   * interna: desde fuera no se puede falsificar la cabecera para esquivar el bloqueo por IP.
   */
  private static String ipCliente(HttpServletRequest request) {
    return request.getRemoteAddr();
  }

        @PostMapping("/signup")
        public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
          if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity.badRequest()
                .body(new MessageResponse("Error: ¡El nombre de usuario ya está en uso!"));
          }
          if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest()
                .body(new MessageResponse("Error: ¡El email de usuario ya está en uso!"));
          }

          User user = new User();
          user.setUsername(signUpRequest.getUsername());
          user.setEmail(signUpRequest.getEmail());
          user.setPassword(encoder.encode(signUpRequest.getPassword()));
          user.setNombre(signUpRequest.getNombre());
          user.setApellido1(signUpRequest.getApellido1());
          user.setApellido2(signUpRequest.getApellido2());

          Role clienteRole = roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
              .orElseThrow(() -> new IllegalStateException("Rol ROLE_CLIENTE no encontrado en la BD."));
          user.setRoles(new HashSet<>(List.of(clienteRole)));

          user.setEmailVerificado(false);
          userRepository.save(user);
          cuentaCorreoService.enviarConfirmacion(user);
          return ResponseEntity.ok(new MessageResponse(
                  "Te hemos enviado un correo para confirmar tu cuenta. Ábrelo para poder iniciar sesión."));
        }

  /** Confirma el correo con el enlace recibido al registrarse. */
  @PostMapping("/verificar")
  public ResponseEntity<MessageResponse> confirmarCorreo(@Valid @RequestBody TokenRequest peticion) {
    try {
      cuentaCorreoService.confirmar(peticion.token());
      return ResponseEntity.ok(new MessageResponse("Correo confirmado. Ya puedes iniciar sesión."));
    } catch (TokenCorreoInvalidoException e) {
      return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
    }
  }

  /** Abre el enlace enviado al correo nuevo: desde ahora la cuenta usa ese correo. */
  @PostMapping("/confirmar-cambio-correo")
  public ResponseEntity<?> confirmarCambioCorreo(@Valid @RequestBody TokenRequest peticion) {
    try {
      String nuevo = cuentaCorreoService.confirmarCambio(peticion.token());
      return ResponseEntity.ok(Map.of("email", nuevo,
              "message", "Listo: tu cuenta usa ahora " + nuevo + "."));
    } catch (TokenCorreoInvalidoException e) {
      return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
    } catch (CorreoEnUsoException e) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(new MessageResponse(e.getMessage()));
    }
  }

  /** Vuelve a enviar el correo de confirmacion. Responde lo mismo exista o no la cuenta. */
  @PostMapping("/reenviar-verificacion")
  public ResponseEntity<MessageResponse> reenviarConfirmacion(@Valid @RequestBody ReenvioRequest peticion) {
    cuentaCorreoService.reenviarConfirmacion(peticion.usuario());
    return ResponseEntity.ok(new MessageResponse(
            "Si la cuenta existe y falta confirmarla, te hemos enviado un correo nuevo."));
  }

  /** "He olvidado mi contrasena". Responde lo mismo exista o no una cuenta con ese correo. */
  @PostMapping("/recuperar")
  public ResponseEntity<MessageResponse> recuperar(@Valid @RequestBody RecuperacionRequest peticion) {
    cuentaCorreoService.solicitarRecuperacion(peticion.email());
    return ResponseEntity.ok(new MessageResponse(
            "Si hay una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña nueva."));
  }

  /** Nueva contrasena con el enlace del correo; cierra todas las sesiones abiertas de la cuenta. */
  @PostMapping("/restablecer")
  public ResponseEntity<MessageResponse> restablecer(@Valid @RequestBody RestablecerRequest peticion) {
    try {
      cuentaCorreoService.restablecer(peticion.token(), peticion.password());
      return ResponseEntity.ok(new MessageResponse("Contraseña cambiada. Ya puedes iniciar sesión."));
    } catch (TokenCorreoInvalidoException | IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
    }
  }
}