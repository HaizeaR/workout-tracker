export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { semanas, sesiones, ejecuciones } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

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

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { anio, semana_numero } = await req.json();
    if (!anio || !semana_numero) {
      return NextResponse.json({ error: 'anio y semana_numero son obligatorios' }, { status: 400 });
    }

    // Check if week already exists for this user
    const existing = await db.query.semanas.findFirst({
      where: and(
        eq(semanas.user_id, user.userId),
        eq(semanas.anio, anio),
        eq(semanas.semana_numero, semana_numero)
      ),
    });

    if (existing) return NextResponse.json({ semana: existing });

    const [semana] = await db.insert(semanas).values({
      user_id: user.userId,
      anio,
      semana_numero,
    }).returning();

    return NextResponse.json({ semana }, { status: 201 });
  } catch (error) {
    console.error('Create semana error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
