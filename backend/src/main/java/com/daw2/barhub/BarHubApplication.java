package com.daw2.barhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
public class BarHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(BarHubApplication.class, args);

        // Hashear una contraseña al iniciar la app
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        //System.out.println("HASH REAL juan: " + encoder.encode("juan1234*%"));
        //System.out.println("HASH REAL BCrypt: " + encoder.encode("123456"));
    }
}