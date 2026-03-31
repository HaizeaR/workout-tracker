export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, sesiones, ejecuciones } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const semanaId = parseInt(id, 10);

  try {
    const semana = await db.query.semanas.findFirst({
      where: and(
        eq(semanas.id, semanaId),
        eq(semanas.user_id, user.userId)
      ),
    });

    if (!semana) {
      return NextResponse.json({ error: 'Semana not found' }, { status: 404 });
    }

    const plan = await db
      .select()
      .from(sesiones)
      .where(eq(sesiones.semana_id, semanaId));

    const exec = await db
      .select()
      .from(ejecuciones)
      .where(eq(ejecuciones.semana_id, semanaId));

    return NextResponse.json({ semana, plan, ejecuciones: exec });
  } catch (error) {
    console.error('Get semana error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const semanaId = parseInt(id, 10);

  try {
    const semana = await db.query.semanas.findFirst({
      where: and(
        eq(semanas.id, semanaId),
        eq(semanas.user_id, user.userId)
      ),
    });

    if (!semana) {
      return NextResponse.json({ error: 'Semana not found' }, { status: 404 });
    }

    const { foco } = await req.json();

    const [updated] = await db
      .update(semanas)
      .set({ foco: foco ?? null })
      .where(eq(semanas.id, semanaId))
      .returning();

    return NextResponse.json({ semana: updated });
  } catch (error) {
    console.error('Patch semana error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
