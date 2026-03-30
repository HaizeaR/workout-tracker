'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GimnasioChart, RunningChart } from '@/components/ProgresoChart';

interface GimnasioData {
  tipo: 'gimnasio';
  data: Record<string, { semana: string; peso_kg: number }[]>;
}

interface RunningDataPoint {
  semana: string;
  distancia_km: number;
  duracion_min: number;
  pace: number | null;
}

interface RunningData {
  tipo: 'running';
  data: RunningDataPoint[];
}

type ProgresoData = GimnasioData | RunningData;

export default function ProgresoPage() {
  const router = useRouter();
  const [progresoData, setProgresoData] = useState<ProgresoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEjercicio, setSelectedEjercicio] = useState<string>('');

  useEffect(() => {
    fetch('/api/progreso')
      .then((r) => {
        if (!r.ok) {
          router.push('/login');
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setProgresoData(d);
        if (d.tipo === 'gimnasio') {
          const exercises = Object.keys(d.data);
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

  if (!progresoData) return null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6 pt-2">Progreso</h1>

      {progresoData.tipo === 'gimnasio' ? (
        <div>
          {Object.keys(progresoData.data).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">📈</p>
              <p className="font-medium text-gray-300">Sin datos de progreso</p>
              <p className="text-sm mt-1">Importa semanas con datos de peso</p>
            </div>
          ) : (
            <>
              {/* Exercise selector */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Ejercicio</label>
                <select
                  value={selectedEjercicio}
                  onChange={(e) => setSelectedEjercicio(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.keys(progresoData.data).map((ej) => (
                    <option key={ej} value={ej}>{ej}</option>
                  ))}
                </select>
              </div>

              {/* Chart */}
              {selectedEjercicio && progresoData.data[selectedEjercicio] && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="font-semibold text-gray-200 mb-4">{selectedEjercicio}</h3>
                  <GimnasioChart
                    data={progresoData.data[selectedEjercicio]}
                    ejercicio={selectedEjercicio}
                  />
                </div>
              )}

              {/* All exercises summary */}
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Todos los ejercicios
                </h2>
                {Object.entries(progresoData.data).map(([ejercicio, data]) => {
                  const maxWeight = Math.max(...data.map((d) => d.peso_kg));
                  const lastEntry = data[data.length - 1];
                  return (
                    <button
                      key={ejercicio}
                      onClick={() => setSelectedEjercicio(ejercicio)}
                      className={`w-full text-left bg-gray-900 border rounded-xl p-3 transition-colors ${
                        selectedEjercicio === ejercicio
                          ? 'border-indigo-600 bg-indigo-950/30'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-200 text-sm">{ejercicio}</span>
                        <span className="text-indigo-400 font-semibold text-sm">
                          {lastEntry?.peso_kg ?? maxWeight} kg
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {data.length} semanas · Máx: {maxWeight} kg
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          {progresoData.data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">🏃</p>
              <p className="font-medium text-gray-300">Sin datos de running</p>
              <p className="text-sm mt-1">Importa semanas con datos de distancia</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <RunningChart data={progresoData.data} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
