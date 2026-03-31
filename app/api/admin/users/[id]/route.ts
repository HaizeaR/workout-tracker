export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser || !authUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const targetId = parseInt(id, 10);

  if (targetId === authUser.userId) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
  }

  try {
    await db.delete(users).where(eq(users.id, targetId));
    return NextResponse.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser || !authUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const targetId = parseInt(id, 10);

  try {
    const { email, is_admin } = await req.json();

    const updates: Partial<{ email: string; is_admin: boolean }> = {};
    if (email !== undefined) updates.email = email;
    if (is_admin !== undefined) updates.is_admin = is_admin;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, targetId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        is_admin: users.is_admin,
      });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
