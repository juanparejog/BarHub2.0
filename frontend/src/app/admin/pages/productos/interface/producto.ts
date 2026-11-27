export interface Producto {
    id?:                    number,
    nombre:                 string,
    descripcion:            string,
    /** Traducciones para la carta en portugués e inglés; sin ellas, la carta usa el español. */
    nombrePt?:              string | null,
    nombreEn?:              string | null,
    descripcionPt?:         string | null,
    descripcionEn?:         string | null,
    precio:                 number,
    imagen:                 string,
    tipoProducto:          string,
    /** Alérgenos que contiene; null si el bar aún no los ha indicado. */
    alergenos?:             string[] | null,
    created_at?:            string,
    updated_at?:            string,
}