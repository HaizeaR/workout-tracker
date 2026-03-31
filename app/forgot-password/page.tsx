'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
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
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#c4f135' }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#0f1117" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f0' }}>Recuperar contraseña</h1>
          <p className="mt-1 text-sm" style={{ color: '#888' }}>
            Introduce tu email y te enviaremos un enlace
          </p>
        </div>

        {submitted ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: '#1e2d0e', border: '1px solid #3a5a1a' }}
          >
            <div className="flex items-center justify-center mb-3">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#8ab030" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: '#8ab030' }}>
              Si el email existe, recibirás un enlace
            </p>
            <p className="text-sm mt-2" style={{ color: '#ccc' }}>
              Revisa tu bandeja de entrada en los próximos minutos.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 text-sm font-medium"
              style={{ color: '#c4f135' }}
            >
              Volver al inicio
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl p-6 space-y-4"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
          >
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#ccc' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base focus:outline-none transition-all"
                style={{
                  background: '#111',
                  border: '1px solid #2a2d36',
                  color: '#f0f0f0',
                }}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
              />
            </div>

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
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>

            <div className="text-center pt-1">
              <Link href="/login" className="text-sm" style={{ color: '#888' }}>
                Volver al inicio
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
