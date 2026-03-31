export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

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

    // Gimnasio: max peso_kg per exercise per week
    const exerciseData: Record<string, { semana: string; peso_kg: number }[]> = {};

    // Running: distance + pace per week
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
        .where(and(eq(ejecuciones.semana_id, semana.id), eq(ejecuciones.completado, true)));

      const semanaLabel = `S${semana.semana_numero}/${semana.anio}`;

      let totalDistancia = 0;
      let totalDuracion = 0;

      for (const e of exec) {
        // Gym data
        if (e.peso_kg && e.peso_kg > 0) {
          if (!exerciseData[e.ejercicio]) exerciseData[e.ejercicio] = [];
          const idx = exerciseData[e.ejercicio].findIndex((d) => d.semana === semanaLabel);
          if (idx >= 0) {
            if (e.peso_kg > exerciseData[e.ejercicio][idx].peso_kg) {
              exerciseData[e.ejercicio][idx].peso_kg = e.peso_kg;
            }
          } else {
            exerciseData[e.ejercicio].push({ semana: semanaLabel, peso_kg: e.peso_kg });
          }
        }

        // Running data
        if (e.distancia_km) totalDistancia += e.distancia_km;
        if (e.duracion_min) totalDuracion += e.duracion_min;
      }

      if (totalDistancia > 0) {
        weeklyData.push({
          semana: semanaLabel,
          distancia_km: totalDistancia,
          duracion_min: totalDuracion,
          pace: totalDistancia > 0 ? Math.round((totalDuracion / totalDistancia) * 100) / 100 : null,
        });
      }
    }

    for (const key of Object.keys(exerciseData)) {
      exerciseData[key].sort((a, b) => a.semana.localeCompare(b.semana));
    }
    weeklyData.sort((a, b) => a.semana.localeCompare(b.semana));

    return NextResponse.json({
      gimnasio: Object.keys(exerciseData).length > 0 ? exerciseData : null,
      running: weeklyData.length > 0 ? weeklyData : null,
    });
  } catch (error) {
    console.error('Progreso error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
