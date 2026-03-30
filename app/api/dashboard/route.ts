export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones, records } from '@/db/schema';
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

    // Current week stats (most recent)
    let weeklyStats = {
      totalEjercicios: 0,
      completados: 0,
      totalPeso: 0,
      totalDistancia: 0,
    };

    if (allSemanas.length > 0) {
      const currentSemana = allSemanas[0];
      const exec = await db
        .select()
        .from(ejecuciones)
        .where(eq(ejecuciones.semana_id, currentSemana.id));

      weeklyStats = {
        totalEjercicios: exec.length,
        completados: exec.filter((e) => e.completado).length,
        totalPeso: exec.reduce((sum, e) => {
          if (e.peso_kg && e.series && e.reps) {
            return sum + e.peso_kg * e.series * e.reps;
          }
          return sum;
        }, 0),
        totalDistancia: exec.reduce(
          (sum, e) => sum + (e.distancia_km || 0),
          0
        ),
      };
    }

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

    // Recent records (last 5)
    const recentRecords = await db
      .select()
      .from(records)
      .where(eq(records.user_id, user.userId))
      .orderBy(desc(records.created_at))
      .limit(5);

    return NextResponse.json({
      weeklyStats,
      streak,
      recentRecords,
      currentSemana: allSemanas[0] || null,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
