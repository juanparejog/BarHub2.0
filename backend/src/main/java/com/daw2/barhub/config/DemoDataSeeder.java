package com.daw2.barhub.config;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashSet;
import java.util.Set;

/**
 * Datos de demostracion (productos, mesas y un administrador).
 * Solo se ejecuta con APP_SEED_DEMO=true. La contrasena del administrador sale de
 * APP_SEED_ADMIN_PASSWORD: no hay ninguna contrasena en el codigo ni en el repositorio.
 */
@Slf4j
@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed.demo", havingValue = "true")
public class DemoDataSeeder implements CommandLineRunner {

    private final JdbcTemplate jdbc;
    private final DataSource dataSource;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin-username:admin}")
    private String adminUsername;

    @Value("${app.seed.admin-email:admin@barhub.local}")
    private String adminEmail;

    @Value("${app.seed.admin-password:}")
    private String adminPassword;

    public DemoDataSeeder(JdbcTemplate jdbc, DataSource dataSource, UserRepository userRepository,
                          RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        cargarCatalogo();
        crearAdministrador();
    }

    private void cargarCatalogo() throws Exception {
        Integer productos = jdbc.queryForObject("SELECT COUNT(*) FROM productos", Integer.class);
        Integer mesas = jdbc.queryForObject("SELECT COUNT(*) FROM mesas", Integer.class);
        if (productos != null && productos > 0 || mesas != null && mesas > 0) {
            log.info("Datos de demostracion: ya hay productos o mesas, no se carga el catalogo.");
            return;
        }
        try (Connection conexion = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(conexion, new ClassPathResource("demo/demo-data.sql"));
        }
        log.info("Datos de demostracion: catalogo cargado (mesas y productos).");
    }

    private void crearAdministrador() {
        Integer admins = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'ROLE_ADMIN'",
                Integer.class);
        if (admins != null && admins > 0) {
            log.info("Datos de demostracion: ya existe un administrador.");
            return;
        }
        if (adminPassword == null || adminPassword.length() < 8) {
            log.warn("Datos de demostracion: no se crea el administrador. "
                    + "Define APP_SEED_ADMIN_PASSWORD (minimo 8 caracteres).");
            return;
        }
        Role rolAdmin = roleRepository.findByName(RoleEnum.ROLE_ADMIN)
                .orElseThrow(() -> new IllegalStateException("Rol ROLE_ADMIN no encontrado"));

        User admin = new User();
        admin.setUsername(adminUsername);
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setNombre("Admin");
        admin.setApellido1("Demo");
        admin.setRoles(new HashSet<>(Set.of(rolAdmin)));
        userRepository.save(admin);
        log.info("Datos de demostracion: administrador '{}' creado.", adminUsername);
    }
}
