package com.daw2.barhub.config;

import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Conversion de tokens_correo.tipo de ENUM a VARCHAR en las bases creadas antes de la 2.1. */
class EsquemaTokensCorreoTest {

    private final DataSource dataSource = mock(DataSource.class);
    private final Connection conexion = mock(Connection.class);
    private final Statement sentencia = mock(Statement.class);

    private void base(String producto, String tipoColumna) throws Exception {
        DatabaseMetaData metadatos = mock(DatabaseMetaData.class);
        PreparedStatement consulta = mock(PreparedStatement.class);
        ResultSet fila = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(conexion);
        when(conexion.getMetaData()).thenReturn(metadatos);
        when(metadatos.getDatabaseProductName()).thenReturn(producto);
        when(conexion.prepareStatement(anyString())).thenReturn(consulta);
        when(consulta.executeQuery()).thenReturn(fila);
        when(fila.next()).thenReturn(tipoColumna != null);
        when(fila.getString(1)).thenReturn(tipoColumna);
        when(conexion.createStatement()).thenReturn(sentencia);
    }

    @Test
    void enMariaDbConvierteLaColumnaSiAunEsEnum() throws Exception {
        base("MariaDB", "enum");
        new EsquemaTokensCorreo(dataSource).run();
        verify(sentencia).execute("ALTER TABLE tokens_correo MODIFY tipo VARCHAR(20) NOT NULL");
    }

    @Test
    void siYaEsVarcharNoLaToca() throws Exception {
        base("MariaDB", "varchar");
        new EsquemaTokensCorreo(dataSource).run();
        verify(sentencia, never()).execute(anyString());
    }

    @Test
    void siLaTablaAunNoExisteNoHaceNada() throws Exception {
        base("MySQL", null);
        new EsquemaTokensCorreo(dataSource).run();
        verify(sentencia, never()).execute(anyString());
    }

    @Test
    void enH2NoConsultaNada() throws Exception {
        base("H2", "enum");
        new EsquemaTokensCorreo(dataSource).run();
        verify(conexion, never()).prepareStatement(anyString());
        verify(sentencia, never()).execute(anyString());
    }
}
