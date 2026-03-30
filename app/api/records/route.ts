export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { records } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allRecords = await db
      .select()
      .from(records)
      .where(eq(records.user_id, user.userId))
      .orderBy(desc(records.created_at));

    return NextResponse.json({ records: allRecords });
  } catch (error) {
    console.error('Get records error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
