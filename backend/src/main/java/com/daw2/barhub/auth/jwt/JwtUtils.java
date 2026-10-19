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

  public String generateJwtToken(Authentication authentication) {

    UserDetailsImpl userPrincipal = (UserDetailsImpl) authentication.getPrincipal();

    List<String> roles = userPrincipal.getAuthorities().stream()
            .map(item -> item.getAuthority())
            .collect(Collectors.toList());

    Instant now = Instant.now();
    Instant expiration = now.plusMillis(jwtExpirationMs);

    return Jwts.builder()
            .subject(userPrincipal.getUsername())
            .claim("id", userPrincipal.getId())
            .claim("roles", roles)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiration))
            .signWith(key())
            .compact();
  }

  private SecretKey key() {
    return Keys.hmacShaKeyFor(jwtSecret.getBytes());
  }

  public String getUserNameFromJwtToken(String token) {
    return Jwts.parser().verifyWith(key()).build()
            .parseSignedClaims(token).getPayload().getSubject();
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
    } catch (IllegalArgumentException e) {
      logger.error("JWT afirma que la cadena está vacía: {}", e.getMessage());
    }

    return false;
  }
}