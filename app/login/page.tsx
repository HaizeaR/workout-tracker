'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0f1117' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#c4f135' }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#0f1117" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-widest" style={{ color: '#f0f0f0' }}>
            ENTRENA
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>Inicia sesión para continuar</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-6 space-y-4"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#ccc' }}
            >
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
              style={{
                background: '#111',
                border: '1px solid #2a2d36',
                color: '#f0f0f0',
              }}
              placeholder="haizea"
              required
              autoComplete="username"
              onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#ccc' }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base focus:outline-none transition-all"
              style={{
                background: '#111',
                border: '1px solid #2a2d36',
                color: '#f0f0f0',
              }}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
            className="w-full py-3 px-4 font-semibold rounded-xl transition-all text-base mt-2"
            style={{
              background: loading ? '#8ab030' : '#c4f135',
              color: '#0f1117',
              opacity: loading ? 0.8 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>

          <div className="text-center pt-1">
            <Link
              href="/forgot-password"
              className="text-sm transition-colors"
              style={{ color: '#888' }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#c4f135')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#888')}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
