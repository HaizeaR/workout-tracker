export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.reset_token, token),
    });

    if (!user) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
    }

    if (!user.reset_token_expires || user.reset_token_expires < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await db
      .update(users)
      .set({
        password_hash: hash,
        reset_token: null,
        reset_token_expires: null,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
