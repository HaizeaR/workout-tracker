'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProgresoData {
  gimnasio: Record<string, { semana: string; peso_kg: number }[]> | null;
  running: {
    semana: string;
    distancia_km: number;
    duracion_min: number;
    pace: number | null;
  }[] | null;
}

function BarChart({
  data,
  valueKey,
  labelKey,
  unit,
  color,
}: {
  data: Record<string, number | null>[];
  valueKey: string;
  labelKey: string;
  unit: string;
  color: string;
}) {
  const values = data.map((d) => (d[valueKey] as number) ?? 0);
  const maxVal = Math.max(...values, 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, paddingBottom: 24, position: 'relative' }}>
      {data.map((d, i) => {
        const val = (d[valueKey] as number) ?? 0;
        const heightPx = Math.max((val / maxVal) * 60, 4);
        const isMax = val === maxVal;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
            <span style={{ fontSize: 9, color: isMax ? '#c4f135' : '#888', fontWeight: isMax ? 700 : 400 }}>
              {val}{unit}
            </span>
            <div
              style={{
                width: '100%',
                height: heightPx,
                borderRadius: 4,
                background: isMax ? '#c4f135' : color,
                transition: 'height 0.3s',
              }}
            />
            <span style={{ fontSize: 9, color: '#555', marginTop: 2, textAlign: 'center', lineHeight: 1.2 }}>
              {String(d[labelKey]).replace(/^\d{4}-S/, 'S')}
            </span>
          </div>
        );
      })}
    </div>
  );
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
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: 160 }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: '#1a1d24' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: '#1a1d24' }} />
      </div>
    );
  }

  const hasGimnasio = data?.gimnasio && Object.keys(data.gimnasio).length > 0;
  const hasRunning = data?.running && data.running.length > 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold pt-2" style={{ color: '#f0f0f0' }}>Progreso</h1>

      {!hasGimnasio && !hasRunning && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          <svg className="w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="#555" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p className="font-medium" style={{ color: '#ccc' }}>Sin datos de progreso</p>
          <p className="text-sm mt-1" style={{ color: '#555' }}>Importa semanas para ver tus gráficas</p>
        </div>
      )}

      {/* Gimnasio section */}
      {hasGimnasio && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#888' }}>
            Gimnasio — Peso por ejercicio
          </p>

          {/* Exercise selector */}
          <div className="mb-4">
            <select
              value={selectedEjercicio}
              onChange={(e) => setSelectedEjercicio(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
              style={{
                background: '#111',
                border: '1px solid #2a2d36',
                color: '#f0f0f0',
              }}
            >
              {Object.keys(data!.gimnasio!).map((ej) => (
                <option key={ej} value={ej}>{ej}</option>
              ))}
            </select>
          </div>

          {/* Chart card for selected exercise */}
          {selectedEjercicio && data!.gimnasio![selectedEjercicio] && (() => {
            const ejData = data!.gimnasio![selectedEjercicio];
            const maxWeight = Math.max(...ejData.map((x) => x.peso_kg));
            const last = ejData[ejData.length - 1];
            const barData = ejData.map((d) => ({ semana: d.semana, peso_kg: d.peso_kg }));
            return (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>{selectedEjercicio}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#1e2d0e', color: '#c4f135' }}
                    >
                      Máx {maxWeight} kg
                    </span>
                  </div>
                </div>
                <BarChart
                  data={barData}
                  valueKey="peso_kg"
                  labelKey="semana"
                  unit=" kg"
                  color="#2a3a1a"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: '#555' }}>{ejData.length} semanas</span>
                  <span className="text-xs" style={{ color: '#888' }}>Último: {last?.peso_kg} kg</span>
                </div>
              </div>
            );
          })()}

          {/* All exercises list */}
          <div className="space-y-2">
            {Object.entries(data!.gimnasio!).map(([ejercicio, d]) => {
              const maxWeight = Math.max(...d.map((x) => x.peso_kg));
              const last = d[d.length - 1];
              const isSelected = selectedEjercicio === ejercicio;
              return (
                <button
                  key={ejercicio}
                  onClick={() => setSelectedEjercicio(ejercicio)}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: isSelected ? '#1e2a10' : '#1a1d24',
                    border: `1px solid ${isSelected ? '#c4f135' : '#2a2d36'}`,
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm" style={{ color: '#f0f0f0' }}>{ejercicio}</span>
                    <span className="text-sm font-semibold" style={{ color: '#c4f135' }}>
                      {last?.peso_kg ?? maxWeight} kg
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                    {d.length} semanas · Máx: {maxWeight} kg
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Running section */}
      {hasRunning && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#888' }}>
            Running — Distancia y ritmo
          </p>

          {/* Distance chart */}
          <div
            className="rounded-2xl p-4 mb-3"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: '#ccc' }}>Distancia (km)</p>
            <BarChart
              data={data!.running!.map((r) => ({ semana: r.semana, distancia_km: r.distancia_km }))}
              valueKey="distancia_km"
              labelKey="semana"
              unit=" km"
              color="#1a2a3a"
            />
          </div>

          {/* Pace chart if available */}
          {data!.running!.some((r) => r.pace !== null) && (
            <div
              className="rounded-2xl p-4 mb-3"
              style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: '#ccc' }}>Ritmo (min/km)</p>
              <BarChart
                data={data!.running!.filter((r) => r.pace !== null).map((r) => ({
                  semana: r.semana,
                  pace: r.pace ?? 0,
                }))}
                valueKey="pace"
                labelKey="semana"
                unit=" min"
                color="#2a1a3a"
              />
            </div>
          )}

          {/* Running stats */}
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const maxDist = Math.max(...data!.running!.map((r) => r.distancia_km));
              const totalDist = data!.running!.reduce((a, r) => a + r.distancia_km, 0);
              const paces = data!.running!.filter((r) => r.pace !== null).map((r) => r.pace as number);
              const bestPace = paces.length > 0 ? Math.min(...paces) : null;
              return (
                <>
                  <div
                    className="rounded-xl p-3"
                    style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
                  >
                    <p className="text-xs" style={{ color: '#555' }}>Total km</p>
                    <p className="text-xl font-bold" style={{ color: '#c4f135' }}>{totalDist.toFixed(1)}</p>
                    <p className="text-xs" style={{ color: '#888' }}>en {data!.running!.length} semanas</p>
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
                  >
                    <p className="text-xs" style={{ color: '#555' }}>Mejor semana</p>
                    <p className="text-xl font-bold" style={{ color: '#c4f135' }}>{maxDist}</p>
                    <p className="text-xs" style={{ color: '#888' }}>km</p>
                  </div>
                  {bestPace !== null && (
                    <div
                      className="rounded-xl p-3 col-span-2"
                      style={{ background: '#2d2a0e', border: '1px solid #5a4a1a' }}
                    >
                      <p className="text-xs" style={{ color: '#888' }}>Mejor ritmo</p>
                      <p className="text-xl font-bold" style={{ color: '#c4a030' }}>{bestPace.toFixed(2)} <span className="text-sm font-normal">min/km</span></p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
