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
      },
      {
        username: 'eder',
        password_hash: ederHash,
      },
    ])
    .onConflictDoNothing();

  console.log('Users seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
