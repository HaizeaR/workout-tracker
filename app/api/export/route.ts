export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nWeeks = parseInt(searchParams.get('weeks') || '4', 10);
  const format = searchParams.get('format') || 'csv'; // 'csv' | 'text'

  try {
    const allSemanas = await db
      .select()
      .from(semanas)
      .where(eq(semanas.user_id, user.userId))
      .orderBy(desc(semanas.anio), desc(semanas.semana_numero))
      .limit(nWeeks);

    if (allSemanas.length === 0) {
      if (format === 'csv') {
        return NextResponse.json({ text: 'fecha,semana,ejercicio,categoria,tipo,series,reps,peso_kg,distancia_km,ritmo_min_km,duracion_min,sensacion,dolor,notas,completado\n', filename: 'entrena-export.csv' });
      }
      return NextResponse.json({ text: 'No hay semanas registradas.', filename: 'entrena-export.txt' });
    }

    const semanaIds = allSemanas.map((s) => s.id);
    const allExecs = await db
      .select()
      .from(ejecuciones)
      .where(eq(ejecuciones.user_id, user.userId))
      .orderBy(ejecuciones.fecha, ejecuciones.semana_id, ejecuciones.orden);

    const filteredExecs = allExecs.filter((e) => semanaIds.includes(e.semana_id));

    if (format === 'text') {
      const semanaMap = Object.fromEntries(allSemanas.map((s) => [s.id, s]));
      const lines: string[] = [];

      const firstSemana = allSemanas[allSemanas.length - 1];
      const lastSemana = allSemanas[0];
      lines.push(`RESUMEN ENTRENAMIENTO — ${user.username}`);
      lines.push(`Semanas ${firstSemana.semana_numero}–${lastSemana.semana_numero} (${firstSemana.anio})`);
      lines.push('═'.repeat(48));
      lines.push('');

      const byWeek = new Map<number, typeof filteredExecs>();
      for (const e of filteredExecs) {
        if (!byWeek.has(e.semana_id)) byWeek.set(e.semana_id, []);
        byWeek.get(e.semana_id)!.push(e);
      }

      for (const semana of [...allSemanas].reverse()) {
        const execs = byWeek.get(semana.id) || [];
        if (execs.length === 0) continue;

        const completadas = execs.filter((e) => e.completado).length;
        lines.push(`SEMANA ${semana.semana_numero} — ${semanaMap[semana.id]?.foco || ''} (${completadas}/${execs.length} completadas)`);

        const byDate = new Map<string, typeof execs>();
        for (const e of execs) {
          if (!byDate.has(e.fecha)) byDate.set(e.fecha, []);
          byDate.get(e.fecha)!.push(e);
        }

        for (const [fecha, dayExecs] of [...byDate.entries()].sort()) {
          lines.push(`  ${fecha}:`);
          for (const e of dayExecs) {
            const parts: string[] = [];
            if (e.series && e.reps) parts.push(`${e.series}×${e.reps}`);
            if (e.peso_kg) parts.push(`${e.peso_kg}kg`);
            if (e.distancia_km) {
              parts.push(`${e.distancia_km}km`);
              if (e.duracion_min && e.distancia_km > 0) {
                const ritmo = e.duracion_min / e.distancia_km;
                const mins = Math.floor(ritmo);
                const secs = Math.round((ritmo - mins) * 60).toString().padStart(2, '0');
                parts.push(`${mins}:${secs}/km`);
              }
            } else if (e.duracion_min) {
              parts.push(`${e.duracion_min}min`);
            }
            if (e.sensacion) parts.push(`★${e.sensacion}/5`);
            const status = e.completado ? '✓' : '○';
            const detail = parts.length ? ` — ${parts.join(', ')}` : '';
            lines.push(`    ${status} ${e.ejercicio}${e.categoria ? ` (${e.categoria})` : ''}${detail}`);
            if (e.notas) lines.push(`      Notas: ${e.notas}`);
          }
        }
        lines.push('');
      }

      return NextResponse.json({ text: lines.join('\n'), filename: `entrena-${new Date().toISOString().slice(0, 10)}.txt` });
    }

    // CSV format
    const header = ['fecha', 'semana', 'ejercicio', 'categoria', 'tipo', 'series', 'reps', 'peso_kg', 'distancia_km', 'ritmo_min_km', 'duracion_min', 'sensacion', 'dolor', 'notas', 'completado'];
    const rows = [header.join(',')];

    const semanaMap = Object.fromEntries(allSemanas.map((s) => [s.id, s]));

    for (const e of filteredExecs) {
      const semana = semanaMap[e.semana_id];
      const ritmo = (e.duracion_min && e.distancia_km && e.distancia_km > 0)
        ? Math.round((e.duracion_min / e.distancia_km) * 100) / 100
        : null;

      const row = [
        escapeCsv(e.fecha),
        escapeCsv(semana ? `${semana.anio}-W${String(semana.semana_numero).padStart(2, '0')}` : ''),
        escapeCsv(e.ejercicio),
        escapeCsv(e.categoria),
        escapeCsv(e.tipo),
        escapeCsv(e.series),
        escapeCsv(e.reps),
        escapeCsv(e.peso_kg),
        escapeCsv(e.distancia_km),
        escapeCsv(ritmo),
        escapeCsv(e.duracion_min),
        escapeCsv(e.sensacion),
        escapeCsv(e.dolor ? 'sí' : e.dolor === false ? 'no' : ''),
        escapeCsv(e.notas),
        escapeCsv(e.completado ? 'sí' : 'no'),
      ];
      rows.push(row.join(','));
    }

    return NextResponse.json({
      text: rows.join('\n'),
      filename: `entrena-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
