package com.daw2.barhub.config;

import com.daw2.barhub.auth.jwt.AuthEntryPointJwt;
import com.daw2.barhub.auth.jwt.AuthTokenFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final AuthEntryPointJwt unauthorizedHandler;

    public SecurityConfig(AuthEntryPointJwt unauthorizedHandler) {
        this.unauthorizedHandler = unauthorizedHandler;
    }

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 1. Permisos pre-flight de CORS
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 2. Endpoints públicos (Auth, imágenes/archivos estáticos, SWAGGER si usas)
                        .requestMatchers("/api/auth/**", "/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/productos/**", "/productos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/mesas/**", "/mesas/**").permitAll()

                        // 3. Endpoints para Clientes, Empleados y Admin
                        .requestMatchers(HttpMethod.POST, "/api/pedidos/**", "/pedidos/**").hasAnyRole("CLIENTE", "EMPLEADO", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/pedidos/mis-pedidos", "/pedidos/mis-pedidos").hasAnyRole("CLIENTE", "EMPLEADO", "ADMIN")

                        // 4. Endpoints exclusivos para empleados y admin (Gestión)
                        .requestMatchers("/api/pagos/**", "/pagos/**").hasAnyRole("EMPLEADO", "ADMIN")
                        .requestMatchers("/api/detalles_pedidos/**", "/detalles_pedidos/**").hasAnyRole("EMPLEADO", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/pedidos/**", "/pedidos/**").hasAnyRole("EMPLEADO", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/mesas/**", "/mesas/**").hasAnyRole("EMPLEADO", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/mesas/**", "/mesas/**").hasAnyRole("EMPLEADO", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/mesas/**", "/mesas/**").hasAnyRole("EMPLEADO", "ADMIN")

                        // 5. Panel de Administración
                        .requestMatchers("/api/usuarios/**", "/usuarios/**", "/api/roles/**", "/roles/**").hasRole("ADMIN")

                        // CUALQUIER OTRA PETICIÓN REQUIERE AUTENTICACIÓN
                        .anyRequest().authenticated()
                );

        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("http://localhost:4200"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}