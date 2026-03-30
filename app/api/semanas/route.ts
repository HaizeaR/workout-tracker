export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, sesiones, ejecuciones } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allSemanas = await db.query.semanas.findMany({
      where: eq(semanas.user_id, user.userId),
      orderBy: [desc(semanas.anio), desc(semanas.semana_numero)],
    });

    // For each semana, get counts
    const semanasWithCounts = await Promise.all(
      allSemanas.map(async (semana) => {
        const totalSesiones = await db
          .select()
          .from(sesiones)
          .where(eq(sesiones.semana_id, semana.id));

        const totalEjecuciones = await db
          .select()
          .from(ejecuciones)
          .where(eq(ejecuciones.semana_id, semana.id));

        const completadas = totalEjecuciones.filter((e) => e.completado).length;

        return {
          ...semana,
          totalSesiones: totalSesiones.length,
          completadas,
        };
      })
    );

    return NextResponse.json({ semanas: semanasWithCounts });
  } catch (error) {
    console.error('Get semanas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
