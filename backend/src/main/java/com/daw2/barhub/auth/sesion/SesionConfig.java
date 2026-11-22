package com.daw2.barhub.auth.sesion;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(SesionProperties.class)
public class SesionConfig {

    /** Reloj de las sesiones; los tests lo sustituyen para simular el paso del tiempo. */
    @Bean
    public Clock reloj() {
        return Clock.systemUTC();
    }
}
