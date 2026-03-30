'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SemanaTable from '@/components/SemanaTable';
import type { Sesion, Ejecucion } from '@/db/schema';

interface SemanaInfo {
  id: number;
  semana_numero: number;
  anio: number;
  totalSesiones: number;
  completadas: number;
}

interface SemanaDetail {
  semana: { id: number; semana_numero: number; anio: number };
  plan: Sesion[];
  ejecuciones: Ejecucion[];
}

interface User {
  userId: number;
  username: string;
  tipo: 'gimnasio' | 'running';
}

export default function SemanaPage() {
  const router = useRouter();
  const [semanas, setSemanas] = useState<SemanaInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SemanaDetail | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [semanasRes, userRes] = await Promise.all([
          fetch('/api/semanas'),
          fetch('/api/auth/me'),
        ]);

        if (!semanasRes.ok) {
          router.push('/login');
          return;
        }

        const [semanasData, userData] = await Promise.all([
          semanasRes.json(),
          userRes.json(),
        ]);

        setSemanas(semanasData.semanas || []);
        setUser(userData.user);

        if (semanasData.semanas?.length > 0) {
          setSelectedId(semanasData.semanas[0].id);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  useEffect(() => {
    if (!selectedId) return;

    setLoadingDetail(true);
    fetch(`/api/semanas/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const handleUpdate = useCallback(async (ejecucionId: number, updates: Partial<Ejecucion>) => {
    const res = await fetch(`/api/ejecuciones/${ejecucionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar');
    }

    const { ejecucion: updated } = await res.json();

    // Update local state
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ejecuciones: prev.ejecuciones.map((e) =>
          e.id === ejecucionId ? { ...e, ...updated } : e
        ),
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="h-12 bg-gray-900 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (semanas.length === 0) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white mb-6 pt-2">Semana</h1>
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-gray-300">Sin semanas importadas</p>
          <p className="text-sm mt-1">Ve al Dashboard e importa un CSV</p>
        </div>
      </div>
    );
  }

  const currentSemana = semanas.find((s) => s.id === selectedId);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-4 pt-2">Semana</h1>

      {/* Semana selector */}
      <div className="mb-4">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(parseInt(e.target.value))}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {semanas.map((s) => (
            <option key={s.id} value={s.id}>
              Semana {s.semana_numero} — {s.anio} ({s.completadas}/{s.totalSesiones} completadas)
            </option>
          ))}
        </select>
      </div>

      {/* Progress bar for current semana */}
      {currentSemana && currentSemana.totalSesiones > 0 && (
        <div className="mb-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progreso</span>
            <span className="text-gray-300 font-medium">
              {currentSemana.completadas}/{currentSemana.totalSesiones}
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{
                width: `${(currentSemana.completadas / currentSemana.totalSesiones) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      {loadingDetail ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : detail ? (
        <SemanaTable
          sesiones={detail.plan}
          ejecuciones={detail.ejecuciones}
          tipo={user?.tipo || 'gimnasio'}
          onUpdate={handleUpdate}
        />
      ) : null}
    </div>
  );
}
