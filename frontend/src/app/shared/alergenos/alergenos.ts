/**
 * Los 14 alérgenos de declaración obligatoria (anexo II del Reglamento (UE) 1169/2011), en el
 * mismo orden que el backend (enum Alergeno). El código es lo que viaja en la API.
 */
export const ALERGENOS = [
  { codigo: 'GLUTEN', nombre: 'Gluten' },
  { codigo: 'CRUSTACEOS', nombre: 'Crustáceos' },
  { codigo: 'HUEVOS', nombre: 'Huevos' },
  { codigo: 'PESCADO', nombre: 'Pescado' },
  { codigo: 'CACAHUETES', nombre: 'Cacahuetes' },
  { codigo: 'SOJA', nombre: 'Soja' },
  { codigo: 'LACTEOS', nombre: 'Lácteos' },
  { codigo: 'FRUTOS_DE_CASCARA', nombre: 'Frutos de cáscara' },
  { codigo: 'APIO', nombre: 'Apio' },
  { codigo: 'MOSTAZA', nombre: 'Mostaza' },
  { codigo: 'SESAMO', nombre: 'Sésamo' },
  { codigo: 'SULFITOS', nombre: 'Sulfitos' },
  { codigo: 'ALTRAMUCES', nombre: 'Altramuces' },
  { codigo: 'MOLUSCOS', nombre: 'Moluscos' }
] as const;

export type CodigoAlergeno = typeof ALERGENOS[number]['codigo'];

const NOMBRES = new Map<string, string>(ALERGENOS.map(a => [a.codigo, a.nombre]));

export function nombreAlergeno(codigo: string): string {
  return NOMBRES.get(codigo) ?? codigo;
}

/**
 * Texto de la carta para los alérgenos de un producto. {@code null} significa que el bar aún no
 * los ha indicado, que no es lo mismo que una lista vacía (indicados: no lleva ninguno).
 */
export function textoAlergenos(alergenos: readonly string[] | null | undefined): string {
  if (alergenos == null) {
    return 'Alérgenos: pregunta al personal';
  }
  if (alergenos.length === 0) {
    return 'Sin alérgenos de declaración obligatoria';
  }
  return `Contiene: ${alergenos.map(nombreAlergeno).join(', ')}`;
}

/**
 * Si un producto se puede mostrar a quien quiere evitar {@code excluidos}. Sin alérgenos indicados
 * no se puede saber, así que con cualquier filtro activo no se muestra.
 */
export function aptoSin(alergenos: readonly string[] | null | undefined, excluidos: ReadonlySet<string>): boolean {
  if (excluidos.size === 0) {
    return true;
  }
  return alergenos != null && !alergenos.some(a => excluidos.has(a));
}
