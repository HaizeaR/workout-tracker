export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones, records } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

function getISOWeek(d: Date): { week: number; year: number } {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return {
    week: 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
    year: date.getFullYear(),
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const today = new Date();
    const { week: currentWeek, year: currentYear } = getISOWeek(today);

    const allSemanas = await db
      .select()
      .from(semanas)
      .where(eq(semanas.user_id, user.userId))
      .orderBy(desc(semanas.anio), desc(semanas.semana_numero));

    // Find current ISO week semana
    const currentSemana = allSemanas.find(
      (s) => s.semana_numero === currentWeek && s.anio === currentYear
    ) ?? allSemanas[0] ?? null;

    let weeklyStats = {
      totalEjercicios: 0,
      completados: 0,
      totalDistancia: 0,
      tipoBreakdown: {} as Record<string, number>, // tipo → count of completed sessions
    };

    if (currentSemana) {
      const exec = await db
        .select()
        .from(ejecuciones)
        .where(eq(ejecuciones.semana_id, currentSemana.id));

      const completed = exec.filter((e) => e.completado);
      const tipoBreakdown: Record<string, number> = {};
      // Group by day tipo (use sesion.tipo stored on execution)
      // We count unique (fecha) days per tipo from completed executions
      const dayTipos: Record<string, string> = {};
      for (const e of completed) {
        if (e.tipo) dayTipos[e.fecha] = e.tipo;
      }
      for (const tipo of Object.values(dayTipos)) {
        tipoBreakdown[tipo] = (tipoBreakdown[tipo] ?? 0) + 1;
      }

      // Count unique training days (not individual exercises)
      const totalDays = new Set(exec.map((e) => e.fecha)).size;
      const completedDays = new Set(completed.map((e) => e.fecha)).size;

      weeklyStats = {
        totalEjercicios: totalDays,
        completados: completedDays,
        totalDistancia: completed.reduce((sum, e) => sum + (e.distancia_km ?? 0), 0),
        tipoBreakdown,
      };
    }

    // Streak (consecutive weeks with ≥50% completion)
    let streak = 0;
    for (const semana of allSemanas) {
      const exec = await db.select().from(ejecuciones).where(eq(ejecuciones.semana_id, semana.id));
      if (exec.length === 0) break;
      const ratio = exec.filter((e) => e.completado).length / exec.length;
      if (ratio >= 0.5) streak++;
      else break;
    }

    // Monthly breakdown (last 4 weeks) — tipo count by week
    const monthlyBreakdown: { semana: string; tipos: Record<string, number> }[] = [];
    for (const sem of allSemanas.slice(0, 4)) {
      const exec = await db.select().from(ejecuciones).where(eq(ejecuciones.semana_id, sem.id));
      const completed = exec.filter((e) => e.completado);
      const dayTipos: Record<string, string> = {};
      for (const e of completed) {
        if (e.tipo) dayTipos[e.fecha] = e.tipo;
      }
      const tipos: Record<string, number> = {};
      for (const tipo of Object.values(dayTipos)) {
        tipos[tipo] = (tipos[tipo] ?? 0) + 1;
      }
      monthlyBreakdown.push({ semana: `S${sem.semana_numero}`, tipos });
    }

    const recentRecords = await db
      .select()
      .from(records)
      .where(eq(records.user_id, user.userId))
      .orderBy(desc(records.created_at))
      .limit(3);

    return NextResponse.json({
      weeklyStats,
      streak,
      recentRecords,
      currentSemana,
      monthlyBreakdown: monthlyBreakdown.reverse(),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
