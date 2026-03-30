export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allSemanas = await db
      .select()
      .from(semanas)
      .where(eq(semanas.user_id, user.userId))
      .orderBy(desc(semanas.anio), desc(semanas.semana_numero));

    if (user.tipo === 'gimnasio') {
      // Return: per exercise, per week, max peso_kg
      const exerciseData: Record<string, { semana: string; peso_kg: number }[]> = {};

      for (const semana of allSemanas) {
        const exec = await db
          .select()
          .from(ejecuciones)
          .where(eq(ejecuciones.semana_id, semana.id));

        const semanaLabel = `S${semana.semana_numero}/${semana.anio}`;

        for (const e of exec) {
          if (!e.peso_kg || e.peso_kg <= 0) continue;
          if (!exerciseData[e.ejercicio]) {
            exerciseData[e.ejercicio] = [];
          }
          const existing = exerciseData[e.ejercicio].find(
            (d) => d.semana === semanaLabel
          );
          if (!existing || e.peso_kg > existing.peso_kg) {
            const idx = exerciseData[e.ejercicio].findIndex(
              (d) => d.semana === semanaLabel
            );
            if (idx >= 0) {
              exerciseData[e.ejercicio][idx].peso_kg = e.peso_kg;
            } else {
              exerciseData[e.ejercicio].push({
                semana: semanaLabel,
                peso_kg: e.peso_kg,
              });
            }
          }
        }
      }

      // Sort each exercise data by semana
      for (const key of Object.keys(exerciseData)) {
        exerciseData[key].sort((a, b) => a.semana.localeCompare(b.semana));
      }

      return NextResponse.json({ tipo: 'gimnasio', data: exerciseData });
    } else {
      // Running: per week, total distancia_km and avg pace
      const weeklyData: {
        semana: string;
        distancia_km: number;
        duracion_min: number;
        pace: number | null;
      }[] = [];

      for (const semana of allSemanas) {
        const exec = await db
          .select()
          .from(ejecuciones)
          .where(eq(ejecuciones.semana_id, semana.id));

        const semanaLabel = `S${semana.semana_numero}/${semana.anio}`;

        let totalDistancia = 0;
        let totalDuracion = 0;

        for (const e of exec) {
          if (e.distancia_km) totalDistancia += e.distancia_km;
          if (e.duracion_min) totalDuracion += e.duracion_min;
        }

        const pace =
          totalDistancia > 0 ? totalDuracion / totalDistancia : null;

        weeklyData.push({
          semana: semanaLabel,
          distancia_km: totalDistancia,
          duracion_min: totalDuracion,
          pace: pace ? Math.round(pace * 100) / 100 : null,
        });
      }

      weeklyData.sort((a, b) => a.semana.localeCompare(b.semana));

      return NextResponse.json({ tipo: 'running', data: weeklyData });
    }
  } catch (error) {
    console.error('Progreso error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
