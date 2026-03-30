export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function DELETE() {
  const cookie = clearAuthCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2]);
  return response;
}
