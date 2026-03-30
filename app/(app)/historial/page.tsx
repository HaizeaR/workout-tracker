'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Ejecucion } from '@/db/schema';

interface SemanaInfo {
  id: number;
  semana_numero: number;
  anio: number;
  totalSesiones: number;
  completadas: number;
}

interface SemanaDetail {
  semana: { id: number; semana_numero: number; anio: number };
  plan: unknown[];
  ejecuciones: Ejecucion[];
}

export default function HistorialPage() {
  const router = useRouter();
  const [semanas, setSemanas] = useState<SemanaInfo[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<Map<number, SemanaDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/semanas')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => d && setSemanas(d.semanas || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  async function toggleExpand(semanaId: number) {
    const newExpanded = new Set(expanded);

    if (expanded.has(semanaId)) {
      newExpanded.delete(semanaId);
      setExpanded(newExpanded);
      return;
    }

    newExpanded.add(semanaId);
    setExpanded(newExpanded);

    if (details.has(semanaId)) return;

    setLoadingIds((prev) => new Set(prev).add(semanaId));
    try {
      const res = await fetch(`/api/semanas/${semanaId}`);
      const data = await res.json();
      setDetails((prev) => new Map(prev).set(semanaId, data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(semanaId);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-800 rounded-lg animate-pulse w-40" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-900 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6 pt-2">Historial</h1>

      {semanas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium text-gray-300">Sin historial</p>
          <p className="text-sm mt-1">Importa CSVs para ver el historial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {semanas.map((semana) => {
            const isExpanded = expanded.has(semana.id);
            const isLoading = loadingIds.has(semana.id);
            const detail = details.get(semana.id);
            const completionPct = semana.totalSesiones
              ? Math.round((semana.completadas / semana.totalSesiones) * 100)
              : 0;

            return (
              <div
                key={semana.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(semana.id)}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-semibold text-white">
                        Semana {semana.semana_numero}
                      </p>
                      <p className="text-xs text-gray-500">{semana.anio}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-gray-300">
                        {semana.completadas}/{semana.totalSesiones}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              completionPct >= 50 ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{completionPct}%</span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-800">
                    {isLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : detail ? (
                      <div className="p-4 space-y-2">
                        {detail.ejecuciones.length === 0 ? (
                          <p className="text-gray-500 text-sm">Sin ejercicios</p>
                        ) : (
                          detail.ejecuciones.map((ejec) => (
                            <div
                              key={ejec.id}
                              className={`flex items-start justify-between p-3 rounded-xl ${
                                ejec.completado ? 'bg-green-950/20 border border-green-900/30' : 'bg-gray-800/50'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-200 text-sm truncate">
                                    {ejec.ejercicio}
                                  </p>
                                  {ejec.completado && (
                                    <span className="text-green-400 text-xs">✓</span>
                                  )}
                                  {ejec.dolor && (
                                    <span className="text-red-400 text-xs">⚠ dolor</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {ejec.fecha}
                                  {ejec.categoria && ` · ${ejec.categoria}`}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {ejec.series && ejec.reps && (
                                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">
                                      {ejec.series}×{ejec.reps}
                                    </span>
                                  )}
                                  {ejec.peso_kg && (
                                    <span className="text-xs bg-indigo-900/50 px-2 py-0.5 rounded-full text-indigo-300">
                                      {ejec.peso_kg} kg
                                    </span>
                                  )}
                                  {ejec.distancia_km && (
                                    <span className="text-xs bg-green-900/50 px-2 py-0.5 rounded-full text-green-300">
                                      {ejec.distancia_km} km
                                    </span>
                                  )}
                                  {ejec.duracion_min && (
                                    <span className="text-xs bg-yellow-900/50 px-2 py-0.5 rounded-full text-yellow-300">
                                      {ejec.duracion_min} min
                                    </span>
                                  )}
                                  {ejec.sensacion && (
                                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">
                                      Sens: {ejec.sensacion}/5
                                    </span>
                                  )}
                                </div>
                                {ejec.notas && (
                                  <p className="text-xs text-gray-500 mt-1 italic">{ejec.notas}</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
