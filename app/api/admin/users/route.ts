export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser || !authUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        is_admin: users.is_admin,
        created_at: users.created_at,
      })
      .from(users);

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Admin get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser || !authUser.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { username, password, email, is_admin } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        username,
        password_hash: hash,
        email: email || null,
        is_admin: is_admin ?? false,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        is_admin: users.is_admin,
        created_at: users.created_at,
      });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
