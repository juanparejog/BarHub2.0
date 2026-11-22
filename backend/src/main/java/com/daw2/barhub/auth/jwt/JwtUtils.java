package com.daw2.barhub.auth.jwt;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtUtils {
  private static final Logger logger = LoggerFactory.getLogger(JwtUtils.class);

  @Value("${jwt.jwtSecret}")
  private String jwtSecret;

  @Value("${jwt.jwtExpirationMs}")
  private int jwtExpirationMs;

  /** Claim con el id de la sesion del servidor a la que pertenece el token. */
  public static final String CLAIM_SESION = "sid";

  public String generateJwtToken(Authentication authentication, String sesionId) {
    return generarTokenAcceso((UserDetailsImpl) authentication.getPrincipal(), sesionId);
  }

  /** Token de acceso de corta duracion (jwt.jwtExpirationMs), ligado a una sesion abierta. */
  public String generarTokenAcceso(UserDetailsImpl userPrincipal, String sesionId) {
    List<String> roles = userPrincipal.getAuthorities().stream()
            .map(item -> item.getAuthority())
            .collect(Collectors.toList());

    Instant now = Instant.now();
    Instant expiration = now.plusMillis(jwtExpirationMs);

    return Jwts.builder()
            .subject(userPrincipal.getUsername())
            .claim("id", userPrincipal.getId())
            .claim("roles", roles)
            .claim(CLAIM_SESION, sesionId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiration))
            .signWith(key())
            .compact();
  }

  private SecretKey key() {
    return Keys.hmacShaKeyFor(jwtSecret.getBytes());
  }

  public String getUserNameFromJwtToken(String token) {
    return leer(token).getSubject();
  }

  public String getSesionIdFromJwtToken(String token) {
    return leer(token).get(CLAIM_SESION, String.class);
  }

  private Claims leer(String token) {
    return Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
  }

  public boolean validateJwtToken(String authToken) {
    try {
      Jwts.parser().verifyWith(key()).build().parseSignedClaims(authToken);
      return true;
    } catch (MalformedJwtException e) {
      logger.error("Token JWT no válido: {}", e.getMessage());
    } catch (ExpiredJwtException e) {
      logger.error("El token JWT ha expirado: {}", e.getMessage());
    } catch (UnsupportedJwtException e) {
      logger.error("El token JWT no es compatible: {}", e.getMessage());
    } catch (JwtException e) {
      logger.error("Firma del token JWT no válida: {}", e.getMessage());
    } catch (IllegalArgumentException e) {
      logger.error("JWT afirma que la cadena está vacía: {}", e.getMessage());
    }

    return false;
  }
}