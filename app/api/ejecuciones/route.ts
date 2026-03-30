export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { ejecuciones } from '@/db/schema';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      sesion_id,
      semana_id,
      fecha,
      ejercicio,
      categoria,
      series,
      reps,
      peso_kg,
      duracion_min,
      distancia_km,
      sensacion,
      dolor,
      notas,
      completado,
    } = body;

    const [newEjecucion] = await db
      .insert(ejecuciones)
      .values({
        sesion_id,
        semana_id,
        user_id: user.userId,
        fecha,
        ejercicio,
        categoria,
        series,
        reps,
        peso_kg,
        duracion_min,
        distancia_km,
        sensacion,
        dolor: dolor ?? false,
        notas,
        completado: completado ?? false,
      })
      .returning();

    return NextResponse.json({ ejecucion: newEjecucion });
  } catch (error) {
    console.error('Create ejecucion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
