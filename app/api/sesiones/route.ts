export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { sesiones, ejecuciones, semanas } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { semana_id, fecha, ejercicio, categoria, tipo, series, reps, peso_kg, duracion_min, distancia_km, orden } = body;

    if (!semana_id || !fecha || !ejercicio) {
      return NextResponse.json({ error: 'semana_id, fecha y ejercicio son obligatorios' }, { status: 400 });
    }

    const [sesion] = await db.insert(sesiones).values({
      semana_id,
      user_id: user.userId,
      fecha,
      ejercicio,
      categoria: categoria || null,
      tipo: tipo || null,
      series: series || null,
      reps: reps || null,
      peso_kg: peso_kg || null,
      duracion_min: duracion_min || null,
      distancia_km: distancia_km || null,
      orden: orden ?? 0,
    }).returning();

    // Auto-create ejecucion as copy of plan
    const [ejecucion] = await db.insert(ejecuciones).values({
      sesion_id: sesion.id,
      semana_id,
      user_id: user.userId,
      fecha,
      ejercicio,
      categoria: categoria || null,
      tipo: tipo || null,
      series: series || null,
      reps: reps || null,
      peso_kg: peso_kg || null,
      duracion_min: duracion_min || null,
      distancia_km: distancia_km || null,
      completado: false,
      orden: orden ?? 0,
    }).returning();

    // Auto-detect foco if semana has no foco set yet
    const parentSemana = await db.query.semanas.findFirst({
      where: eq(semanas.id, semana_id),
    });
    if (parentSemana && !parentSemana.foco) {
      const allSesiones = await db.select().from(sesiones).where(eq(sesiones.semana_id, semana_id));
      const runningCount = allSesiones.filter(s => s.distancia_km && s.distancia_km > 0).length;
      const gymCount = allSesiones.filter(s => (s.series && s.series > 0) || (s.peso_kg && s.peso_kg > 0)).length;
      const total = allSesiones.length;
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
      if (autoFoco) {
        await db.update(semanas).set({ foco: autoFoco }).where(eq(semanas.id, semana_id));
      }
    }

    return NextResponse.json({ sesion, ejecucion });
  } catch (error) {
    console.error('Create sesion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
