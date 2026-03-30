'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecordBadge from '@/components/RecordBadge';
import CsvUpload from '@/components/CsvUpload';

interface DashboardData {
  weeklyStats: {
    totalEjercicios: number;
    completados: number;
    totalPeso: number;
    totalDistancia: number;
  };
  streak: number;
  recentRecords: {
    id: number;
    ejercicio: string;
    tipo: 'peso' | 'distancia';
    valor: number;
    fecha: string;
  }[];
  currentSemana: { id: number; semana_numero: number; anio: number } | null;
}

interface User {
  userId: number;
  username: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, userRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/auth/me'),
        ]);

        if (!dashRes.ok || !userRes.ok) {
          router.push('/login');
          return;
        }

        const [dashData, userData] = await Promise.all([
          dashRes.json(),
          userRes.json(),
        ]);

        setData(dashData);
        setUser(userData.user);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'DELETE' });
    router.push('/login');
  }

  function handleUploadSuccess() {
    setShowUpload(false);
    setLoading(true);
    // Reload dashboard data
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const completionRate = data?.weeklyStats.totalEjercicios
    ? Math.round((data.weeklyStats.completados / data.weeklyStats.totalEjercicios) * 100)
    : 0;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-white">
            Hola, {user?.username} 👋
          </h1>
          <p className="text-gray-400 text-sm">Entrenamiento</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-gray-300 transition-colors p-2"
          title="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Upload CSV button */}
      <button
        onClick={() => setShowUpload(!showUpload)}
        className="w-full mb-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Importar CSV
      </button>

      {showUpload && (
        <div className="mb-6">
          <CsvUpload onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Semana actual info */}
      {data?.currentSemana && (
        <div className="mb-4 text-xs text-gray-500 text-center">
          Semana {data.currentSemana.semana_numero} — {data.currentSemana.anio}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Streak */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Racha actual</p>
              <p className="text-3xl font-bold text-white mt-1">
                {data?.streak || 0}
                <span className="text-base font-normal text-gray-400 ml-1">semanas</span>
              </p>
            </div>
            <div className="text-4xl">🔥</div>
          </div>
        </div>

        {/* Ejercicios */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">Ejercicios</p>
          <p className="text-2xl font-bold text-white">
            {data?.weeklyStats.completados ?? 0}
            <span className="text-sm font-normal text-gray-500">/{data?.weeklyStats.totalEjercicios ?? 0}</span>
          </p>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{completionRate}% completado</p>
        </div>

        {/* Peso total */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">Peso total</p>
          <p className="text-2xl font-bold text-white">
            {data?.weeklyStats.totalPeso
              ? `${Math.round(data.weeklyStats.totalPeso).toLocaleString()}`
              : '0'}
          </p>
          <p className="text-xs text-gray-500">kg levantados</p>
        </div>

        {/* Distancia */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-xs mb-1">Distancia</p>
          <p className="text-2xl font-bold text-white">
            {data?.weeklyStats.totalDistancia
              ? data.weeklyStats.totalDistancia.toFixed(1)
              : '0'}
          </p>
          <p className="text-xs text-gray-500">km esta semana</p>
        </div>
      </div>

      {/* Recent PRs */}
      {data?.recentRecords && data.recentRecords.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Records personales recientes
          </h2>
          <div className="space-y-2">
            {data.recentRecords.map((record) => (
              <RecordBadge
                key={record.id}
                ejercicio={record.ejercicio}
                tipo={record.tipo}
                valor={record.valor}
                fecha={record.fecha}
                size="md"
              />
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!data?.currentSemana && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-300">Sin datos aún</p>
          <p className="text-sm mt-1">Importa un CSV para empezar</p>
        </div>
      )}
    </div>
  );
}
