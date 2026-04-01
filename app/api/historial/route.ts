export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { ejecuciones } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all ejecuciones for this user
  const rows = await db
    .select({
      fecha: ejecuciones.fecha,
      tipo: ejecuciones.tipo,
      categoria: ejecuciones.categoria,
      completado: ejecuciones.completado,
    })
    .from(ejecuciones)
    .where(eq(ejecuciones.user_id, user.userId));

  // Group by date: collect tipos and categorias, note if any completado
  const byDate = new Map<string, { tipos: Set<string>; categorias: Set<string>; hasCompleted: boolean; total: number }>();

  for (const row of rows) {
    const fecha = row.fecha;
    if (!fecha) continue;
    if (!byDate.has(fecha)) {
      byDate.set(fecha, { tipos: new Set(), categorias: new Set(), hasCompleted: false, total: 0 });
    }
    const entry = byDate.get(fecha)!;
    entry.total++;
    if (row.tipo) entry.tipos.add(row.tipo);
    if (row.categoria) entry.categorias.add(row.categoria);
    if (row.completado) entry.hasCompleted = true;
  }

  // Convert to array of day summaries
  const days = [...byDate.entries()].map(([fecha, v]) => ({
    fecha,
    tipos: [...v.tipos],
    categorias: [...v.categorias],
    hasCompleted: v.hasCompleted,
    total: v.total,
  }));

  return NextResponse.json({ days });
}
