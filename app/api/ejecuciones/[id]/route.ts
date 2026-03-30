export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { ejecuciones } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const ejecucionId = parseInt(id, 10);

  try {
    const body = await req.json();
    const {
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

    const [updated] = await db
      .update(ejecuciones)
      .set({
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
        updated_at: new Date(),
      })
      .where(
        and(
          eq(ejecuciones.id, ejecucionId),
          eq(ejecuciones.user_id, user.userId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Ejecucion not found' }, { status: 404 });
    }

    return NextResponse.json({ ejecucion: updated });
  } catch (error) {
    console.error('Update ejecucion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const ejecucionId = parseInt(id, 10);

  try {
    await db
      .delete(ejecuciones)
      .where(
        and(
          eq(ejecuciones.id, ejecucionId),
          eq(ejecuciones.user_id, user.userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete ejecucion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
