export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { sesiones, ejecuciones } from '@/db/schema';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { semana_id, fecha, ejercicio, categoria, series, reps, peso_kg, duracion_min, distancia_km } = body;

    if (!semana_id || !fecha || !ejercicio) {
      return NextResponse.json({ error: 'semana_id, fecha y ejercicio son obligatorios' }, { status: 400 });
    }

    const [sesion] = await db.insert(sesiones).values({
      semana_id,
      user_id: user.userId,
      fecha,
      ejercicio,
      categoria: categoria || null,
      series: series || null,
      reps: reps || null,
      peso_kg: peso_kg || null,
      duracion_min: duracion_min || null,
      distancia_km: distancia_km || null,
    }).returning();

    // Auto-create ejecucion as copy of plan
    const [ejecucion] = await db.insert(ejecuciones).values({
      sesion_id: sesion.id,
      semana_id,
      user_id: user.userId,
      fecha,
      ejercicio,
      categoria: categoria || null,
      series: series || null,
      reps: reps || null,
      peso_kg: peso_kg || null,
      duracion_min: duracion_min || null,
      distancia_km: distancia_km || null,
      completado: false,
    }).returning();

    return NextResponse.json({ sesion, ejecucion });
  } catch (error) {
    console.error('Create sesion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
