package com.daw2.barhub.model.enums;

/**
 * Los 14 alergenos de declaracion obligatoria del anexo II del Reglamento (UE) 1169/2011.
 * Se guardan por su nombre: no cambiar los existentes.
 */
public enum Alergeno {
    /** Cereales que contengan gluten. */
    GLUTEN,
    CRUSTACEOS,
    HUEVOS,
    PESCADO,
    CACAHUETES,
    SOJA,
    /** Leche y sus derivados (incluida la lactosa). */
    LACTEOS,
    /** Almendras, avellanas, nueces, anacardos, pacanas, nueces de Brasil, pistachos y macadamias. */
    FRUTOS_DE_CASCARA,
    APIO,
    MOSTAZA,
    SESAMO,
    /** Dioxido de azufre y sulfitos (mas de 10 mg/kg o 10 mg/l). */
    SULFITOS,
    ALTRAMUCES,
    MOLUSCOS
}
