export interface Producto {
    id?:                    number,
    nombre:                 string,
    descripcion:            string,
    precio:                 number,
    imagen:                 string,
    tipoProducto:          string,
    /** Alérgenos que contiene; null si el bar aún no los ha indicado. */
    alergenos?:             string[] | null,
    created_at?:            string,
    updated_at?:            string,
}