package com.daw2.barhub.tiemporeal;

/**
 * Algo ha cambiado y las pantallas que lo muestran deben recargarlo. Solo lleva el tipo y el id: el
 * navegador vuelve a pedir los datos por los endpoints de siempre, con sus permisos.
 *
 * @param tipo      "pedido" o "mesa"
 * @param id        id del pedido o de la mesa
 * @param usuarioId dueno del pedido (para avisarle en su seguimiento), o null
 */
public record CambioEnTiempoReal(String tipo, Long id, Long usuarioId) {

    public static final String PEDIDO = "pedido";
    public static final String MESA = "mesa";
}
