export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, ejecuciones, records } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Allow viewing any user's logros (authenticated)
  const userIdParam = req.nextUrl.searchParams.get('userId');
  const targetUserId = userIdParam ? parseInt(userIdParam, 10) : authUser.userId;

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // ISO week helper
    function getISOWeek(dateStr: string): { week: number; year: number } {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      const week1 = new Date(d.getFullYear(), 0, 4);
      return {
        week: 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
        year: d.getFullYear(),
      };
    }

    const { week: currentWeek, year: currentYear } = getISOWeek(todayStr);

    const allExecs = await db.select().from(ejecuciones).where(eq(ejecuciones.user_id, targetUserId));
    const completedExecs = allExecs.filter((e) => e.completado);

    const totalCompletadas = completedExecs.length;
    const totalDistanciaKm = completedExecs.reduce((sum, e) => sum + (e.distancia_km ?? 0), 0);
    const mejorCarreraKm = completedExecs.reduce((max, e) => Math.max(max, e.distancia_km ?? 0), 0);

    const allRecords = await db.select().from(records).where(eq(records.user_id, targetUserId));
    const totalPRs = allRecords.length;

    const allSemanas = await db.select().from(semanas).where(eq(semanas.user_id, targetUserId));
    const semanasConCompletado = new Set(completedExecs.map((e) => e.semana_id));
    const semanasActivas = semanasConCompletado.size;

    // Streak calculation
    const completedDates = [...new Set(completedExecs.map((e) => e.fecha))].sort();
    let mejorRacha = 0;
    let rachaActual = 0;

    if (completedDates.length > 0) {
      let currentStreak = 1;
      let bestStreak = 1;
      for (let i = 1; i < completedDates.length; i++) {
        const prev = new Date(completedDates[i - 1] + 'T12:00:00');
        const curr = new Date(completedDates[i] + 'T12:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }
      mejorRacha = bestStreak;

      // Current streak from most recent date
      const lastDate = completedDates[completedDates.length - 1];
      const lastDay = new Date(lastDate + 'T12:00:00');
      const todayMid = new Date(todayStr + 'T12:00:00');
      const diffFromToday = Math.round((todayMid.getTime() - lastDay.getTime()) / 86400000);
      if (diffFromToday <= 1) {
        rachaActual = 1;
        for (let i = completedDates.length - 2; i >= 0; i--) {
          const curr = new Date(completedDates[i + 1] + 'T12:00:00');
          const prev = new Date(completedDates[i] + 'T12:00:00');
          const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
          if (diff === 1) rachaActual++;
          else break;
        }
      }
    }

    // This week
    const thisWeekSemana = allSemanas.find((s) => s.semana_numero === currentWeek && s.anio === currentYear);
    const estaSemanaExecs = thisWeekSemana ? allExecs.filter((e) => e.semana_id === thisWeekSemana.id) : [];
    const estaSemanaTotal = estaSemanaExecs.length;
    const estaSemanaCompletadas = estaSemanaExecs.filter((e) => e.completado).length;
    const estaSemanaKm = estaSemanaExecs.filter((e) => e.completado).reduce((s, e) => s + (e.distancia_km ?? 0), 0);

    // Best week km
    const kmByWeek: Record<number, number> = {};
    for (const e of completedExecs) {
      if (e.distancia_km && e.semana_id) {
        kmByWeek[e.semana_id] = (kmByWeek[e.semana_id] ?? 0) + e.distancia_km;
      }
    }
    const mejorSemanaKm = Object.values(kmByWeek).reduce((m, v) => Math.max(m, v), 0);

    // Consecutive active weeks
    const activeWeekKeys = [...semanasConCompletado]
      .map((semId) => {
        const s = allSemanas.find((x) => x.id === semId);
        return s ? s.anio * 100 + s.semana_numero : null;
      })
      .filter(Boolean)
      .sort() as number[];

    let mejorRachaSemanasConsecutivas = activeWeekKeys.length > 0 ? 1 : 0;
    let weekStreak = 1;
    for (let i = 1; i < activeWeekKeys.length; i++) {
      if (activeWeekKeys[i] - activeWeekKeys[i - 1] === 1) {
        weekStreak++;
        mejorRachaSemanasConsecutivas = Math.max(mejorRachaSemanasConsecutivas, weekStreak);
      } else {
        weekStreak = 1;
      }
    }

    return NextResponse.json({
      stats: {
        totalCompletadas,
        totalDistanciaKm: Math.round(totalDistanciaKm * 10) / 10,
        mejorCarreraKm: Math.round(mejorCarreraKm * 10) / 10,
        totalPRs,
        semanasActivas,
        mejorRacha,
        rachaActual,
        mejorRachaSemanasConsecutivas,
        estaSemana: { total: estaSemanaTotal, completadas: estaSemanaCompletadas },
        estaSemanaKm: Math.round(estaSemanaKm * 10) / 10,
        mejorSemanaKm: Math.round(mejorSemanaKm * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Logros error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
