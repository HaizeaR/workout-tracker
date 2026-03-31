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

// Categorías con su tipo asociado (para colorear automáticamente)
export const CATEGORIAS: { label: string; tipo: string }[] = [
  { label: 'Carrera',      tipo: 'Running'   },
  { label: 'Trail',        tipo: 'Running'   },
  { label: 'Cardio',       tipo: 'Running'   },
  { label: 'Ciclismo',     tipo: 'Running'   },
  { label: 'Fuerza',       tipo: 'Fuerza'    },
  { label: 'Gimnasio',     tipo: 'Fuerza'    },
  { label: 'Powerlifting', tipo: 'Fuerza'    },
  { label: 'Crossfit',     tipo: 'Fuerza'    },
  { label: 'Natación',     tipo: 'Natación'  },
  { label: 'Movilidad',    tipo: 'Movilidad' },
  { label: 'Yoga',         tipo: 'Movilidad' },
  { label: 'Stretching',   tipo: 'Movilidad' },
  { label: 'HYROX',        tipo: 'Híbrido'   },
  { label: 'Funcional',    tipo: 'Híbrido'   },
  { label: 'Otro',         tipo: ''          },
];

export function categoriaToTipo(categoria: string | null | undefined): string | null {
  if (!categoria) return null;
  return CATEGORIAS.find((c) => c.label.toLowerCase() === categoria.toLowerCase())?.tipo || null;
}

/** Devuelve el color del tipo, o lo deriva de la categoría si no hay tipo explícito */
export function getDayColor(tipo: string | null | undefined, categorias: (string | null | undefined)[]): { bg: string; color: string } | null {
  if (tipo && TIPO_COLORS[tipo]) return TIPO_COLORS[tipo];
  // Derive from categories — take majority or first match
  for (const cat of categorias) {
    const t = categoriaToTipo(cat);
    if (t && TIPO_COLORS[t]) return TIPO_COLORS[t];
  }
  return null;
}
