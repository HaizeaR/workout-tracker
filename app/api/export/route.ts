export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nWeeks = parseInt(searchParams.get('weeks') || '4', 10);

  try {
    const allSemanas = await db
      .select()
      .from(semanas)
      .where(eq(semanas.user_id, user.userId))
      .orderBy(desc(semanas.anio), desc(semanas.semana_numero))
      .limit(nWeeks);

    if (allSemanas.length === 0) {
      return NextResponse.json({ text: 'No hay semanas registradas.' });
    }

    const lines: string[] = [];

    // Header
    const firstSemana = allSemanas[allSemanas.length - 1];
    const lastSemana = allSemanas[0];
    lines.push(
      `RESUMEN ENTRENAMIENTO - ${user.username} - Semanas ${firstSemana.semana_numero} a ${lastSemana.semana_numero} (${firstSemana.anio})`
    );
    lines.push('========================================');
    lines.push('');

    // Calculate streak
    let streak = 0;
    for (const semana of allSemanas) {
      const exec = await db
        .select()
        .from(ejecuciones)
        .where(eq(ejecuciones.semana_id, semana.id));

      if (exec.length === 0) break;

      const completadas = exec.filter((e) => e.completado).length;
      const ratio = completadas / exec.length;

      if (ratio >= 0.5) {
        streak++;
      } else {
        break;
      }
    }

    // Each week
    for (const semana of [...allSemanas].reverse()) {
      const exec = await db
        .select()
        .from(ejecuciones)
        .where(eq(ejecuciones.semana_id, semana.id));

      if (exec.length === 0) continue;

      const fechaMin = exec.reduce((min, e) => (e.fecha < min ? e.fecha : min), exec[0].fecha);
      let fechaDisplay = fechaMin;
      try {
        fechaDisplay = format(new Date(fechaMin), 'dd/MM/yyyy');
      } catch {
        fechaDisplay = fechaMin;
      }

      lines.push(`SEMANA ${semana.semana_numero} (${fechaDisplay}):`);

      for (const e of exec) {
        const parts: string[] = [`- ${e.ejercicio}`];
        if (e.categoria) parts[0] += ` (${e.categoria})`;
        parts[0] += ':';

        const details: string[] = [];
        if (e.series && e.reps) {
          details.push(`${e.series}x${e.reps}`);
        }
        if (e.peso_kg) {
          details.push(`@ ${e.peso_kg}kg`);
        }
        if (e.distancia_km) {
          details.push(`${e.distancia_km}km`);
        }
        if (e.duracion_min) {
          details.push(`${e.duracion_min}min`);
        }
        if (e.sensacion) {
          details.push(`Sensación: ${e.sensacion}/5`);
        }
        if (e.dolor !== null && e.dolor !== undefined) {
          details.push(`Dolor: ${e.dolor ? 'sí' : 'no'}`);
        }
        if (e.notas) {
          details.push(`Notas: ${e.notas}`);
        }
        if (e.completado !== null) {
          details.push(e.completado ? '[COMPLETADO]' : '[PENDIENTE]');
        }

        lines.push(`  ${parts[0]} ${details.join(' | ')}`);
      }

      lines.push('');
    }

    lines.push(`Racha actual: ${streak} semanas consecutivas completadas`);

    const text = lines.join('\n');
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
