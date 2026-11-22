package com.daw2.barhub.auth.correo;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** Los correos se envian en segundo plano (CorreoService#enviar es @Async). */
@Configuration
@EnableAsync
public class CorreoConfig {
}
