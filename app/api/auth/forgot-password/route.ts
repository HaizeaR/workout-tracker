export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Si el email existe, recibirás un enlace' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      const token = generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db
        .update(users)
        .set({
          reset_token: token,
          reset_token_expires: expires,
        })
        .where(eq(users.id, user.id));

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Entrena <noreply@entrena.app>',
            to: email,
            subject: 'Restablecer contraseña',
            html: `
              <p>Hola ${user.username},</p>
              <p>Haz clic en el enlace para restablecer tu contraseña:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
              <p>Este enlace expira en 1 hora.</p>
            `,
          });
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      } else {
        console.log(`[DEV] Reset link for ${email}: ${resetLink}`);
      }
    }

    return NextResponse.json({ message: 'Si el email existe, recibirás un enlace' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Si el email existe, recibirás un enlace' });
  }
}
