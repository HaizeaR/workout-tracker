import { db } from '@/db';
import { records } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ParsedSesion } from './csv';

export interface NewRecordResult {
  ejercicio: string;
  tipo: 'peso' | 'distancia';
  valor: number;
  fecha: string;
  isNew: boolean;
}

export async function checkAndUpdateRecords(
  userId: number,
  sesiones: ParsedSesion[]
): Promise<NewRecordResult[]> {
  const results: NewRecordResult[] = [];

  for (const sesion of sesiones) {
    // Check peso record
    if (sesion.peso_kg && sesion.peso_kg > 0) {
      const existing = await db.query.records.findFirst({
        where: and(
          eq(records.user_id, userId),
          eq(records.ejercicio, sesion.ejercicio),
          eq(records.tipo, 'peso')
        ),
      });

      if (!existing || sesion.peso_kg > existing.valor) {
        if (existing) {
          await db
            .update(records)
            .set({
              valor: sesion.peso_kg,
              fecha: sesion.fecha,
            })
            .where(eq(records.id, existing.id));
        } else {
          await db.insert(records).values({
            user_id: userId,
            ejercicio: sesion.ejercicio,
            tipo: 'peso',
            valor: sesion.peso_kg,
            fecha: sesion.fecha,
          });
        }

        results.push({
          ejercicio: sesion.ejercicio,
          tipo: 'peso',
          valor: sesion.peso_kg,
          fecha: sesion.fecha,
          isNew: !existing,
        });
      }
    }

    // Check distancia record
    if (sesion.distancia_km && sesion.distancia_km > 0) {
      const existing = await db.query.records.findFirst({
        where: and(
          eq(records.user_id, userId),
          eq(records.ejercicio, sesion.ejercicio),
          eq(records.tipo, 'distancia')
        ),
      });

      if (!existing || sesion.distancia_km > existing.valor) {
        if (existing) {
          await db
            .update(records)
            .set({
              valor: sesion.distancia_km,
              fecha: sesion.fecha,
            })
            .where(eq(records.id, existing.id));
        } else {
          await db.insert(records).values({
            user_id: userId,
            ejercicio: sesion.ejercicio,
            tipo: 'distancia',
            valor: sesion.distancia_km,
            fecha: sesion.fecha,
          });
        }

        results.push({
          ejercicio: sesion.ejercicio,
          tipo: 'distancia',
          valor: sesion.distancia_km,
          fecha: sesion.fecha,
          isNew: !existing,
        });
      }
    }
  }

  return results;
}
