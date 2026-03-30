'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GimnasioChart, RunningChart } from '@/components/ProgresoChart';

interface ProgresoData {
  gimnasio: Record<string, { semana: string; peso_kg: number }[]> | null;
  running: {
    semana: string;
    distancia_km: number;
    duracion_min: number;
    pace: number | null;
  }[] | null;
}

export default function ProgresoPage() {
  const router = useRouter();
  const [data, setData] = useState<ProgresoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEjercicio, setSelectedEjercicio] = useState<string>('');

  useEffect(() => {
    fetch('/api/progreso')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setData(d);
        if (d.gimnasio) {
          const exercises = Object.keys(d.gimnasio);
          if (exercises.length > 0) setSelectedEjercicio(exercises[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-800 rounded-lg animate-pulse w-40" />
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const hasGimnasio = data?.gimnasio && Object.keys(data.gimnasio).length > 0;
  const hasRunning = data?.running && data.running.length > 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-white pt-2">Progreso</h1>

      {!hasGimnasio && !hasRunning && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium text-gray-300">Sin datos de progreso</p>
          <p className="text-sm mt-1">Importa semanas para ver tus gráficas</p>
        </div>
      )}

      {/* Gimnasio */}
      {hasGimnasio && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Gimnasio — Peso por ejercicio</h2>

          <div className="mb-4">
            <select
              value={selectedEjercicio}
              onChange={(e) => setSelectedEjercicio(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.keys(data!.gimnasio!).map((ej) => (
                <option key={ej} value={ej}>{ej}</option>
              ))}
            </select>
          </div>

          {selectedEjercicio && data!.gimnasio![selectedEjercicio] && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
              <h3 className="font-semibold text-gray-200 mb-4">{selectedEjercicio}</h3>
              <GimnasioChart data={data!.gimnasio![selectedEjercicio]} ejercicio={selectedEjercicio} />
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(data!.gimnasio!).map(([ejercicio, d]) => {
              const maxWeight = Math.max(...d.map((x) => x.peso_kg));
              const last = d[d.length - 1];
              return (
                <button
                  key={ejercicio}
                  onClick={() => setSelectedEjercicio(ejercicio)}
                  className={`w-full text-left bg-gray-900 border rounded-xl p-3 transition-colors ${
                    selectedEjercicio === ejercicio ? 'border-indigo-600 bg-indigo-950/30' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-200 text-sm">{ejercicio}</span>
                    <span className="text-indigo-400 font-semibold text-sm">{last?.peso_kg ?? maxWeight} kg</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{d.length} semanas · Máx: {maxWeight} kg</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Running */}
      {hasRunning && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Running — Distancia y ritmo</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <RunningChart data={data!.running!} />
          </div>
        </div>
      )}
    </div>
  );
}
