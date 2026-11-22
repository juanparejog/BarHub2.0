package com.daw2.barhub.auth.controllers;

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
import com.daw2.barhub.auth.sesion.SesionInvalidaException;
import com.daw2.barhub.auth.sesion.SesionProperties;
import com.daw2.barhub.auth.sesion.SesionService;
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
import org.springframework.security.core.context.SecurityContextHolder;
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

  @PostMapping("/login")
  public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest, HttpServletRequest request) {

    String usuario = loginRequest.getUsername();
    long espera = loginAttemptService.segundosRestantes(usuario);
    if (espera > 0) {
      long minutos = (espera + 59) / 60;
      return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
              .header("Retry-After", String.valueOf(espera))
              .body(new MessageResponse("Demasiados intentos fallidos. Vuelve a intentarlo en "
                      + minutos + (minutos == 1 ? " minuto." : " minutos.")));
    }

    Authentication authentication;
    try {
      authentication = authenticationManager.authenticate(
              new UsernamePasswordAuthenticationToken(usuario, loginRequest.getPassword()));
    } catch (BadCredentialsException e) {
      // tambien se cuentan los usuarios que no existen: asi no se revela cuales existen
      loginAttemptService.registrarFallo(usuario);
      throw e;
    }
    loginAttemptService.registrarExito(usuario);

    SecurityContextHolder.getContext().setAuthentication(authentication);
    UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

    SesionService.NuevaSesion nueva = sesionService.abrir(userDetails.getId(), roles(userDetails),
            ipCliente(request), request.getHeader(HttpHeaders.USER_AGENT));
    String jwt = jwtUtils.generateJwtToken(authentication, nueva.sesion().getId());

    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookieRenovacion(nueva.tokenRenovacion(), nueva.sesion().getCaducaEn()).toString())
            .body(respuesta(jwt, userDetails));
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
      return ok.body(respuesta(jwt, userDetails));
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

  private static JwtResponse respuesta(String jwt, UserDetailsImpl userDetails) {
    return new JwtResponse(jwt, userDetails.getId(), userDetails.getUsername(), userDetails.getEmail(),
            roles(userDetails));
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

  /** Solo informativo (se guarda con la sesion). Detras de Caddy, la IP real llega en X-Forwarded-For. */
  private static String ipCliente(HttpServletRequest request) {
    String reenviada = request.getHeader("X-Forwarded-For");
    if (reenviada != null && !reenviada.isBlank()) {
      return reenviada.split(",")[0].trim();
    }
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

          userRepository.save(user);
          return ResponseEntity.ok(new MessageResponse("Usuario registrado correctamente."));
        }
}