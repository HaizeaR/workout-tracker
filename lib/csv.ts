import Papa from 'papaparse';

export interface CsvRow {
  fecha: string;
  ejercicio: string;
  categoria?: string;
  series?: string;
  reps?: string;
  peso_kg?: string;
  duracion_min?: string;
  distancia_km?: string;
  sensacion?: string;
  dolor?: string;
  notas?: string;
  bloque?: string;
  tipo_bloque?: string;
}

export interface ParsedSesion {
  fecha: string;
  ejercicio: string;
  categoria: string | null;
  series: number | null;
  reps: number | null;
  peso_kg: number | null;
  duracion_min: number | null;
  distancia_km: number | null;
  sensacion: number | null;
  dolor: boolean;
  notas: string | null;
  bloque: string | null;
  tipo_bloque: string | null;
}

export function parseCsv(content: string): ParsedSesion[] {
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join(', ');
    throw new Error(`CSV parse errors: ${errorMessages}`);
  }

  return result.data.map((row) => ({
    fecha: row.fecha?.trim() || '',
    ejercicio: row.ejercicio?.trim() || '',
    categoria: row.categoria?.trim() || null,
    series: row.series ? parseInt(row.series, 10) || null : null,
    reps: row.reps ? parseInt(row.reps, 10) || null : null,
    peso_kg: row.peso_kg ? parseFloat(row.peso_kg) || null : null,
    duracion_min: row.duracion_min ? parseFloat(row.duracion_min) || null : null,
    distancia_km: row.distancia_km ? parseFloat(row.distancia_km) || null : null,
    sensacion: row.sensacion ? parseInt(row.sensacion, 10) || null : null,
    dolor: (() => {
      const d = row.dolor?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
      return d === 'si' || d === 'true' || d === '1' || d === 'yes';
    })(),
    notas: row.notas?.trim() || null,
    bloque: row.bloque?.trim() || null,
    tipo_bloque: row.tipo_bloque?.trim() || null,
  }));
}
