export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const allUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .orderBy(asc(users.id));

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
