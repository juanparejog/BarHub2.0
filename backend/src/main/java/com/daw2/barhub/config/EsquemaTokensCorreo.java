package com.daw2.barhub.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;

/**
 * Las instalaciones creadas antes de la 2.1 tienen {@code tokens_correo.tipo} como ENUM nativo de
 * MariaDB con solo VERIFICACION y RECUPERACION, y ddl-auto: update no cambia columnas existentes:
 * guardar un enlace de CAMBIO_CORREO fallaba con un 500. Al arrancar, si la columna sigue siendo
 * ENUM, se pasa a VARCHAR(20) (los valores guardados se conservan). En H2 y en bases ya
 * actualizadas no hace nada.
 */
@Slf4j
@Component
@Order(0)
public class EsquemaTokensCorreo implements CommandLineRunner {

    private static final String CONSULTA = "SELECT DATA_TYPE FROM information_schema.COLUMNS "
            + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tokens_correo' AND COLUMN_NAME = 'tipo'";
    private static final String CAMBIO = "ALTER TABLE tokens_correo MODIFY tipo VARCHAR(20) NOT NULL";

    private final DataSource dataSource;

    public EsquemaTokensCorreo(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) throws SQLException {
        try (Connection conexion = dataSource.getConnection()) {
            String producto = conexion.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
            if (!producto.contains("mariadb") && !producto.contains("mysql")) {
                return;
            }
            if (!esEnum(conexion)) {
                return;
            }
            try (Statement sentencia = conexion.createStatement()) {
                sentencia.execute(CAMBIO);
            }
            log.info("Columna tokens_correo.tipo convertida de ENUM a VARCHAR(20)");
        }
    }

    private static boolean esEnum(Connection conexion) throws SQLException {
        try (PreparedStatement consulta = conexion.prepareStatement(CONSULTA);
             ResultSet fila = consulta.executeQuery()) {
            return fila.next() && "enum".equalsIgnoreCase(fila.getString(1));
        }
    }
}
