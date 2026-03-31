import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('Seeding users...');

  const haizeaHash = await bcrypt.hash('haizea2026', 12);
  const ederHash = await bcrypt.hash('eder2026', 12);

  await db
    .insert(schema.users)
    .values([
      {
        username: 'haizea',
        password_hash: haizeaHash,
        email: 'haizea@ejemplo.com',
        is_admin: true,
      },
      {
        username: 'eder',
        password_hash: ederHash,
        email: 'eder@ejemplo.com',
        is_admin: false,
      },
    ])
    .onConflictDoUpdate({
      target: schema.users.username,
      set: {
        password_hash: haizeaHash,
        email: 'haizea@ejemplo.com',
        is_admin: true,
      },
    });

  // Update eder separately since onConflictDoUpdate uses same set for all rows
  const ederUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.username, 'eder'),
  });
  if (ederUser) {
    const { eq } = await import('drizzle-orm');
    await db
      .update(schema.users)
      .set({
        password_hash: ederHash,
        email: 'eder@ejemplo.com',
        is_admin: false,
      })
      .where(eq(schema.users.username, 'eder'));
  }

  console.log('Users seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
