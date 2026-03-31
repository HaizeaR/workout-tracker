export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, sesiones, ejecuciones } from '@/db/schema';
import { parseCsv } from '@/lib/csv';
import { checkAndUpdateRecords } from '@/lib/records';
import { eq, and } from 'drizzle-orm';

function getISOWeekYear(dateStr: string): { week: number; year: number } {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { week, year: d.getFullYear() };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const content = await file.text();
    const parsedSesiones = parseCsv(content);

    if (parsedSesiones.length === 0) {
      return NextResponse.json({ error: 'CSV vacío o inválido' }, { status: 400 });
    }

    // Group sessions by ISO week
    const byWeek = new Map<string, typeof parsedSesiones>();
    for (const s of parsedSesiones) {
      if (!s.fecha) continue;
      const { week, year } = getISOWeekYear(s.fecha);
      const key = `${year}-W${week}`;
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key)!.push(s);
    }

    if (byWeek.size === 0) {
      return NextResponse.json({ error: 'No se encontraron fechas válidas en el CSV' }, { status: 400 });
    }

    let totalSesiones = 0;
    const createdSemanas: { id: number; semana_numero: number; anio: number; foco: string | null }[] = [];

    for (const [, weekSesiones] of [...byWeek.entries()].sort()) {
      const { week: semana_numero, year: anio } = getISOWeekYear(weekSesiones[0].fecha);

      // Reuse existing semana for this week if it exists
      const existing = await db
        .select()
        .from(semanas)
        .where(and(
          eq(semanas.user_id, user.userId),
          eq(semanas.anio, anio),
          eq(semanas.semana_numero, semana_numero),
        ))
        .limit(1);

      let semana = existing[0];
      if (!semana) {
        const [created] = await db
          .insert(semanas)
          .values({ user_id: user.userId, anio, semana_numero })
          .returning();
        semana = created;
      }

      // Insert sesiones for this week
      const insertedSesiones = await db
        .insert(sesiones)
        .values(
          weekSesiones.map((s) => ({
            semana_id: semana.id,
            user_id: user.userId,
            fecha: s.fecha,
            ejercicio: s.ejercicio,
            categoria: s.categoria,
            series: s.series,
            reps: s.reps,
            peso_kg: s.peso_kg,
            duracion_min: s.duracion_min,
            distancia_km: s.distancia_km,
            sensacion: s.sensacion,
            dolor: s.dolor,
            notas: s.notas,
          }))
        )
        .returning();

      // Auto-create ejecuciones as planned copies
      await db.insert(ejecuciones).values(
        insertedSesiones.map((s) => ({
          sesion_id: s.id,
          semana_id: semana.id,
          user_id: user.userId,
          fecha: s.fecha,
          ejercicio: s.ejercicio,
          categoria: s.categoria,
          series: s.series,
          reps: s.reps,
          peso_kg: s.peso_kg,
          duracion_min: s.duracion_min,
          distancia_km: s.distancia_km,
          sensacion: s.sensacion,
          dolor: s.dolor ?? false,
          notas: s.notas,
          completado: false,
        }))
      );

      // Auto-detect foco for this week
      const runningCount = insertedSesiones.filter((s) => s.distancia_km && s.distancia_km > 0).length;
      const gymCount = insertedSesiones.filter((s) => (s.series && s.series > 0) || (s.peso_kg && s.peso_kg > 0)).length;
      const total = insertedSesiones.length;
      let autoFoco: string | null = null;
      if (total > 0) {
        const runRatio = runningCount / total;
        const gymRatio = gymCount / total;
        if (runRatio > 0.7) autoFoco = 'Running';
        else if (gymRatio > 0.7) autoFoco = 'Fuerza';
        else if (runRatio > 0.2 && gymRatio > 0.2) autoFoco = 'Híbrido';
        else if (gymRatio > 0.5) autoFoco = 'Fuerza';
        else autoFoco = 'Running';
      }
      if (autoFoco && !semana.foco) {
        await db.update(semanas).set({ foco: autoFoco }).where(eq(semanas.id, semana.id));
      }

      createdSemanas.push({ ...semana, foco: autoFoco ?? semana.foco ?? null });
      totalSesiones += insertedSesiones.length;
    }

    // Check records across all imported sessions
    const newRecords = await checkAndUpdateRecords(user.userId, parsedSesiones);

    return NextResponse.json({
      semana: createdSemanas[createdSemanas.length - 1], // most recent week for compat
      semanas: createdSemanas,
      semanasCount: createdSemanas.length,
      sesionesCount: totalSesiones,
      newRecords,
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
