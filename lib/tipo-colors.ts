export const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  Running:   { bg: '#2d1a0a', color: '#fb923c' }, // naranja
  Cardio:    { bg: '#2d1a0a', color: '#fb923c' }, // naranja (alias)
  Fuerza:    { bg: '#0f2419', color: '#4ade80' }, // verde
  Natación:  { bg: '#0a1a2d', color: '#60a5fa' }, // azul
  Movilidad: { bg: '#2d1a3a', color: '#c084fc' }, // morado
  Híbrido:   { bg: '#2d2a0e', color: '#fbbf24' }, // amarillo
};

export const TIPOS = ['Running', 'Fuerza', 'Natación', 'Movilidad', 'Híbrido'] as const;
export type Tipo = typeof TIPOS[number];
