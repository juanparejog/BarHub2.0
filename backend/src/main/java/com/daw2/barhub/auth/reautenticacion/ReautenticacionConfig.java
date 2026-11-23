package com.daw2.barhub.auth.reautenticacion;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ReautenticacionConfig implements WebMvcConfigurer {

    private final ReautenticacionInterceptor interceptor;

    public ReautenticacionConfig(ReautenticacionInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
