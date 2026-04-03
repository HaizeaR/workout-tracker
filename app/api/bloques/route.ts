import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { sesiones, ejecuciones } from '@/db/schema';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { semana_id, fecha, bloque, tipo_bloque, rounds, duracion_min, tipo, ejercicios } = body;

  if (!semana_id || !fecha || !bloque || !Array.isArray(ejercicios) || ejercicios.length === 0) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
  }

  const created: number[] = [];

  for (let i = 0; i < ejercicios.length; i++) {
    const ej = ejercicios[i];
    if (!ej.ejercicio?.trim()) continue;

    const [sesion] = await db
      .insert(sesiones)
      .values({
        semana_id,
        user_id: user.userId,
        fecha,
        ejercicio: ej.ejercicio.trim(),
        categoria: ej.categoria ?? null,
        tipo: tipo ?? null,
        bloque,
        tipo_bloque,
        series: rounds ?? null,
        reps: ej.reps ?? null,
        peso_kg: ej.peso_kg ?? null,
        distancia_km: ej.distancia_km ?? null,
        duracion_min: duracion_min ?? null,
        notas: ej.notas ?? null,
        orden: i,
      })
      .returning({ id: sesiones.id });

    await db.insert(ejecuciones).values({
      sesion_id: sesion.id,
      semana_id,
      user_id: user.userId,
      fecha,
      ejercicio: ej.ejercicio.trim(),
      categoria: ej.categoria ?? null,
      tipo: tipo ?? null,
      bloque,
      tipo_bloque,
      series: rounds ?? null,
      reps: ej.reps ?? null,
      peso_kg: ej.peso_kg ?? null,
      distancia_km: ej.distancia_km ?? null,
      duracion_min: duracion_min ?? null,
      notas: ej.notas ?? null,
      completado: false,
      orden: i,
    });

    created.push(sesion.id);
  }

  return NextResponse.json({ ok: true, count: created.length, semana_id });
}
