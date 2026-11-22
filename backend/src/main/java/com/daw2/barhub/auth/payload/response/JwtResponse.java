package com.daw2.barhub.auth.payload.response;

import lombok.Data;

import java.util.List;

@Data
public class JwtResponse {
  private String token;
  private String type = "Bearer";
  private final Long id;
  private final String username;
  private final String email;
  private final List<String> roles;
  /** Final de la sesion por su duracion maxima (milisegundos desde 1970), para el aviso del frontend. */
  private Long sesionCaducaEn;
  /** Inactividad maxima de la sesion, en segundos. */
  private Long sesionInactividadSegundos;

  public JwtResponse(String accessToken, Long id, String username, String email, List<String> roles) {
    this.token = accessToken;
    this.id = id;
    this.username = username;
    this.email = email;
    this.roles = roles;
  }

  public String getAccessToken() {
    return token;
  }

  public void setAccessToken(String accessToken) {
    this.token = accessToken;
  }

  public String getTokenType() {
    return type;
  }

  public void setTokenType(String tokenType) {
    this.type = tokenType;
  }


}