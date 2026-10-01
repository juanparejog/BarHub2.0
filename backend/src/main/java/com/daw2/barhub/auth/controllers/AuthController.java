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
import com.daw2.barhub.auth.services.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/auth")
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

  @PostMapping("/login")
  public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

    Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

    SecurityContextHolder.getContext().setAuthentication(authentication);
    String jwt = jwtUtils.generateJwtToken(authentication);

    UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
    List<String> roles = userDetails.getAuthorities().stream()
            .map(item -> item.getAuthority())
            .collect(Collectors.toList());

    return ResponseEntity.ok(new JwtResponse(jwt,
            userDetails.getId(),
            userDetails.getUsername(),
            userDetails.getEmail(),
            roles));
  }

  @PostMapping("/signup")
  public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {

    if (userRepository.existsByUsername(signUpRequest.getUsername())) {
      return ResponseEntity
              .badRequest()
              .body(new MessageResponse("Error: ¡El nombre de usuario ya está en uso!"));
    }

    if (userRepository.existsByEmail(signUpRequest.getEmail())) {
      return ResponseEntity
              .badRequest()
              .body(new MessageResponse("Error: ¡El email de usuario ya está en uso!"));
    }

    // Crear nuevo usuario
    User user = new User(
            signUpRequest.getUsername(),
            signUpRequest.getEmail(),
            encoder.encode(signUpRequest.getPassword())
    );

    Set<String> strRoles = signUpRequest.getRole();
    Set<Role> roles = new HashSet<>();

    if (strRoles == null || strRoles.isEmpty()) {
      Role userRole = roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
              .orElseThrow(() -> new RuntimeException("Error: Rol ROLE_CLIENTE no encontrado en la BD."));
      roles.add(userRole);
    } else {
      strRoles.forEach(role -> {
        switch (role.toUpperCase()) {
          case "ADMIN":
          case "ROLE_ADMIN":
            Role adminRole = roleRepository.findByName(RoleEnum.ROLE_ADMIN)
                    .orElseThrow(() -> new RuntimeException("Error: Rol ROLE_ADMIN no encontrado en la BD."));
            roles.add(adminRole);
            break;

          case "EMPLE":
          case "EMPLEADO":
          case "ROLE_EMPLEADO":
            Role modRole = roleRepository.findByName(RoleEnum.ROLE_EMPLEADO)
                    .orElseThrow(() -> new RuntimeException("Error: Rol ROLE_EMPLEADO no encontrado en la BD."));
            roles.add(modRole);
            break;

          case "CLIENTE":
          case "ROLE_CLIENTE":
          default:
            Role userRole = roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
                    .orElseThrow(() -> new RuntimeException("Error: Rol ROLE_CLIENTE no encontrado en la BD."));
            roles.add(userRole);
            break;
        }
      });
    }

    user.setRoles(roles);
    userRepository.save(user);

    return ResponseEntity.ok(new MessageResponse("Usuario registrado correctamente."));
  }
}