export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { sesiones, ejecuciones } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sesionId = parseInt(id, 10);

  try {
    const body = await req.json();
    const { ejercicio, categoria, series, reps, peso_kg, duracion_min, distancia_km, fecha } = body;

    const [updated] = await db
      .update(sesiones)
      .set({ ejercicio, categoria, series, reps, peso_kg, duracion_min, distancia_km, ...(fecha ? { fecha } : {}) })
      .where(and(eq(sesiones.id, sesionId), eq(sesiones.user_id, user.userId)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // If fecha changed, update the ejecucion too
    if (fecha) {
      await db
        .update(ejecuciones)
        .set({ fecha })
        .where(eq(ejecuciones.sesion_id, sesionId));
    }

    return NextResponse.json({ sesion: updated });
  } catch (error) {
    console.error('Update sesion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sesionId = parseInt(id, 10);

  try {
    // Delete ejecucion first (FK constraint)
    await db.delete(ejecuciones).where(eq(ejecuciones.sesion_id, sesionId));
    await db.delete(sesiones).where(and(eq(sesiones.id, sesionId), eq(sesiones.user_id, user.userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sesion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
