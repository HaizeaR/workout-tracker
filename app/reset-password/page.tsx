'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al restablecer contraseña');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: '#2d1010', border: '1px solid #4a1a1a' }}
      >
        <p style={{ color: '#e05050' }}>Token inválido o faltante</p>
        <Link href="/forgot-password" className="inline-block mt-3 text-sm" style={{ color: '#c4f135' }}>
          Solicitar nuevo enlace
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: '#1e2d0e', border: '1px solid #3a5a1a' }}
      >
        <div className="flex items-center justify-center mb-3">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#8ab030" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-medium" style={{ color: '#8ab030' }}>Contraseña actualizada</p>
        <p className="text-sm mt-1" style={{ color: '#ccc' }}>Redirigiendo al inicio...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-6 space-y-4"
      style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
    >
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#ccc' }}>
          Nueva contraseña
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base focus:outline-none transition-all"
          style={{
            background: '#111',
            border: '1px solid #2a2d36',
            color: '#f0f0f0',
          }}
          placeholder="••••••••"
          required
          minLength={6}
          onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
          onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#ccc' }}>
          Confirmar contraseña
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base focus:outline-none transition-all"
          style={{
            background: '#111',
            border: '1px solid #2a2d36',
            color: '#f0f0f0',
          }}
          placeholder="••••••••"
          required
          onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
          onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
        />
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: '#2d1010', color: '#e05050', border: '1px solid #4a1a1a' }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 font-semibold rounded-xl transition-all text-base"
        style={{
          background: '#c4f135',
          color: '#0f1117',
          opacity: loading ? 0.8 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Guardando...' : 'Cambiar contraseña'}
      </button>

      <div className="text-center pt-1">
        <Link href="/login" className="text-sm" style={{ color: '#888' }}>
          Volver al inicio
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0f1117' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#c4f135' }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#0f1117" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f0' }}>Nueva contraseña</h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>Elige una contraseña segura</p>
        </div>

        <Suspense fallback={
          <div
            className="rounded-xl p-6 space-y-4"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
          >
            <div className="h-12 rounded-xl animate-pulse" style={{ background: '#2a2d36' }} />
            <div className="h-12 rounded-xl animate-pulse" style={{ background: '#2a2d36' }} />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
