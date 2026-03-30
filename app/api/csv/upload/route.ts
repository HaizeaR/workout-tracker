export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, sesiones, ejecuciones } from '@/db/schema';
import { parseCsv } from '@/lib/csv';
import { checkAndUpdateRecords } from '@/lib/records';
import { getISOWeek, getYear } from 'date-fns';

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
      return NextResponse.json({ error: 'CSV is empty or invalid' }, { status: 400 });
    }

    // Determine week from first date in CSV
    const firstFecha = parsedSesiones[0].fecha;
    const firstDate = new Date(firstFecha);
    const anio = getYear(firstDate);
    const semana_numero = getISOWeek(firstDate);

    // Create semana
    const [newSemana] = await db
      .insert(semanas)
      .values({
        user_id: user.userId,
        anio,
        semana_numero,
      })
      .returning();

    // Insert sesiones
    const insertedSesiones = await db
      .insert(sesiones)
      .values(
        parsedSesiones.map((s) => ({
          semana_id: newSemana.id,
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

    // Auto-create ejecuciones as copies
    await db.insert(ejecuciones).values(
      insertedSesiones.map((s) => ({
        sesion_id: s.id,
        semana_id: newSemana.id,
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

    // Check and update records
    const newRecords = await checkAndUpdateRecords(user.userId, parsedSesiones);

    return NextResponse.json({
      semana: newSemana,
      sesionesCount: insertedSesiones.length,
      newRecords,
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
