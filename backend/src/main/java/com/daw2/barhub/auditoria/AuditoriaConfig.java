package com.daw2.barhub.auditoria;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AuditoriaConfig implements WebMvcConfigurer {

    private final AuditoriaInterceptor interceptor;

    public AuditoriaConfig(AuditoriaInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // El primero: asi tambien anota las acciones que la reautenticacion para con un 403
        registry.addInterceptor(interceptor).order(Ordered.HIGHEST_PRECEDENCE);
    }
}
