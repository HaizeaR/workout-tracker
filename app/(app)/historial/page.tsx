'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDayColor } from '@/lib/tipo-colors';

interface DaySummary {
  fecha: string;
  tipos: string[];
  categorias: string[];
  hasCompleted: boolean;
  total: number;
}

interface MonthData {
  year: number;
  month: number; // 0-based
  days: Map<string, DaySummary>;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function buildMonths(days: DaySummary[]): MonthData[] {
  const byMonth = new Map<string, MonthData>();
  for (const day of days) {
    const [y, m] = day.fecha.split('-').map(Number);
    const key = `${y}-${m}`;
    if (!byMonth.has(key)) {
      byMonth.set(key, { year: y, month: m - 1, days: new Map() });
    }
    byMonth.get(key)!.days.set(day.fecha, day);
  }
  return [...byMonth.values()].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function MonthCalendar({ data, onDayClick }: { data: MonthData; onDayClick: (day: DaySummary) => void }) {
  const { year, month, days } = data;

  // day of week for 1st (0=Mon..6=Sun)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold mb-3" style={{ color: '#8890b0' }}>
        {MONTH_NAMES[month]} {year}
      </h2>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium" style={{ color: '#444' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;

          const mm = String(month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const fecha = `${year}-${mm}-${dd}`;
          const summary = days.get(fecha);

          if (!summary) {
            return (
              <div
                key={i}
                className="aspect-square rounded-lg flex items-center justify-center text-xs"
                style={{ color: '#333' }}
              >
                {day}
              </div>
            );
          }

          const style = getDayColor(summary.tipos[0], summary.categorias);
          const isCompleted = summary.hasCompleted;

          return (
            <button
              key={i}
              onClick={() => onDayClick(summary)}
              className="aspect-square rounded-lg flex items-center justify-center text-xs font-semibold relative transition-all hover:scale-105 active:scale-95"
              style={{
                background: style ? style.bg : '#1a1d24',
                color: style ? style.color : '#f0f0f0',
                border: `1px solid ${style ? style.color + '44' : '#2a2d36'}`,
                boxShadow: isCompleted && style ? `0 0 6px ${style.color}33` : undefined,
              }}
            >
              {day}
              {isCompleted && (
                <span
                  className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full"
                  style={{ background: style ? style.color : '#c4f135' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HistorialPage() {
  const router = useRouter();
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DaySummary | null>(null);

  useEffect(() => {
    fetch('/api/historial')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) setMonths(buildMonths(d.days));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-7 w-32 rounded-lg animate-pulse" style={{ background: '#1a1d24' }} />
        {[...Array(2)].map((_, i) => (
          <div key={i}>
            <div className="h-5 w-24 rounded mb-3 animate-pulse" style={{ background: '#1a1d24' }} />
            <div className="grid grid-cols-7 gap-1">
              {[...Array(35)].map((_, j) => (
                <div key={j} className="aspect-square rounded-lg animate-pulse" style={{ background: '#1a1d24' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-sm mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-2 pt-3" style={{ color: '#f0f2ff' }}>Historial</h1>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Running', color: '#fb923c' },
          { label: 'Fuerza', color: '#4ade80' },
          { label: 'Natación', color: '#60a5fa' },
          { label: 'Movilidad', color: '#c084fc' },
          { label: 'Híbrido', color: '#fbbf24' },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
            <span className="text-xs font-medium" style={{ color: '#3c4260' }}>{t.label}</span>
          </div>
        ))}
      </div>

      {months.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#555' }}>
          <p className="text-3xl mb-3">📅</p>
          <p className="font-medium" style={{ color: '#888' }}>Sin entrenos</p>
          <p className="text-sm mt-1">Importa un CSV para ver el historial</p>
        </div>
      ) : (
        months.map((m) => (
          <MonthCalendar
            key={`${m.year}-${m.month}`}
            data={m}
            onDayClick={setSelected}
          />
        ))
      )}

      {/* Day detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: '#13161d', border: '1px solid #2a2d36' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const [y, m, d] = selected.fecha.split('-').map(Number);
              const label = new Date(y, m - 1, d).toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              });
              const style = getDayColor(selected.tipos[0], selected.categorias);
              return (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold capitalize" style={{ color: '#f0f0f0' }}>{label}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {selected.tipos.map((t) => {
                          const s = getDayColor(t, []);
                          return (
                            <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: s?.bg ?? '#1a1d24', color: s?.color ?? '#888' }}>
                              {t}
                            </span>
                          );
                        })}
                        {selected.categorias.filter((c) => !selected.tipos.includes(c)).map((c) => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#1a1d24', color: '#888', border: '1px solid #2a2d36' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-xs p-1.5 rounded-lg" style={{ background: '#2a2d36', color: '#888' }}>
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-4 py-3 rounded-xl px-4"
                    style={{ background: style ? style.bg : '#1a1d24', border: `1px solid ${style ? style.color + '33' : '#2a2d36'}` }}>
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: style?.color ?? '#f0f0f0' }}>{selected.total}</p>
                      <p className="text-xs" style={{ color: '#666' }}>ejercicios</p>
                    </div>
                    {selected.hasCompleted && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: style?.color ?? '#c4f135' }} />
                        <span className="text-sm" style={{ color: '#888' }}>Completado</span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
