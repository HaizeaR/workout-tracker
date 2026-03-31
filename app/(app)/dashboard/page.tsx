'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CsvUpload from '@/components/CsvUpload';

interface DashboardData {
  weeklyStats: {
    totalEjercicios: number;
    completados: number;
    totalDistancia: number;
    tipoBreakdown: Record<string, number>;
  };
  streak: number;
  recentRecords: {
    id: number;
    ejercicio: string;
    tipo: 'peso' | 'distancia';
    valor: number;
    fecha: string;
  }[];
  currentSemana: { id: number; semana_numero: number; anio: number; foco?: string | null } | null;
  monthlyBreakdown: { semana: string; tipos: Record<string, number> }[];
}

interface AuthUser {
  userId: number;
  username: string;
  isAdmin: boolean;
}

interface SemanaDetail {
  semana: { id: number; semana_numero: number; anio: number; foco?: string | null };
  plan: {
    id: number;
    fecha: string;
    ejercicio: string;
    categoria: string | null;
    tipo: string | null;
    series: number | null;
    reps: number | null;
    peso_kg: number | null;
    distancia_km: number | null;
    duracion_min: number | null;
  }[];
  ejecuciones: {
    id: number;
    sesion_id: number;
    completado: boolean | null;
    peso_kg: number | null;
    distancia_km: number | null;
  }[];
}

const FOCOS = ['Gym', 'Running', 'Híbrido', 'Fuerza', 'Movilidad', 'Otro'];

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  Fuerza: { bg: '#1a2540', color: '#60a5fa' },
  Running: { bg: '#1e2d0e', color: '#c4f135' },
  Movilidad: { bg: '#2d1a3a', color: '#c084fc' },
  Híbrido: { bg: '#2a1a0a', color: '#fb923c' },
};

function getWeekDays(refDate: Date): { date: Date; dayLabel: string; dayNum: number; dayKey: string }[] {
  const dow = refDate.getDay();
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      dayLabel: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i],
      dayNum: d.getDate(),
      dayKey: d.toISOString().slice(0, 10),
    };
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [semanaDetail, setSemanaDetail] = useState<SemanaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [savingFoco, setSavingFoco] = useState(false);
  const [selectedFoco, setSelectedFoco] = useState<string | null>(null);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const weekDays = getWeekDays(today);
  const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const weekdayName = WEEKDAY_NAMES[today.getDay()];

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, userRes] = await Promise.all([fetch('/api/dashboard'), fetch('/api/auth/me')]);
        if (!dashRes.ok || !userRes.ok) { router.push('/login'); return; }
        const [dashData, userData] = await Promise.all([dashRes.json(), userRes.json()]);
        setData(dashData);
        setUser(userData.user);
        setSelectedFoco(dashData.currentSemana?.foco ?? null);
        if (dashData.currentSemana) {
          const detailRes = await fetch(`/api/semanas/${dashData.currentSemana.id}`);
          if (detailRes.ok) setSemanaDetail(await detailRes.json());
        }
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
    fetch('/api/dashboard').then((r) => r.json()).then((dashData) => {
      setData(dashData);
      setSelectedFoco(dashData.currentSemana?.foco ?? null);
      if (dashData.currentSemana) {
        fetch(`/api/semanas/${dashData.currentSemana.id}`).then((r) => r.json()).then(setSemanaDetail);
      }
    }).finally(() => setLoading(false));
  }

  async function handleFoco(foco: string) {
    if (!data?.currentSemana) return;
    const newFoco = selectedFoco === foco ? null : foco;
    setSelectedFoco(newFoco);
    setSavingFoco(true);
    try {
      await fetch(`/api/semanas/${data.currentSemana.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foco: newFoco }),
      });
    } finally {
      setSavingFoco(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: '180px' }} />
        <div className="h-16 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />)}
        </div>
      </div>
    );
  }

  // Build day state sets from semana detail
  const completedDates = new Set<string>();
  const pendingDates = new Set<string>();
  const dayTipos: Record<string, string> = {};

  if (semanaDetail) {
    const execBySession = new Map(semanaDetail.ejecuciones.map((e) => [e.sesion_id, e]));
    for (const s of semanaDetail.plan) {
      const ejec = execBySession.get(s.id);
      if (ejec?.completado) completedDates.add(s.fecha);
      else pendingDates.add(s.fecha);
      if (s.tipo) dayTipos[s.fecha] = s.tipo;
    }
  }

  const todayPlan = semanaDetail?.plan.filter((s) => s.fecha === todayKey) ?? [];
  const execBySession = new Map(semanaDetail?.ejecuciones.map((e) => [e.sesion_id, e]) ?? []);
  const completionRate = data?.weeklyStats.totalEjercicios
    ? Math.round((data.weeklyStats.completados / data.weeklyStats.totalEjercicios) * 100)
    : 0;

  // Next training day (if today has no plan)
  const futureDates = weekDays
    .map((d) => d.dayKey)
    .filter((k) => k > todayKey && pendingDates.has(k));
  const nextTrainingDay = futureDates[0] ?? null;
  const nextPlan = nextTrainingDay ? semanaDetail?.plan.filter((s) => s.fecha === nextTrainingDay) ?? [] : [];

  return (
    <div className="p-4 space-y-5 pb-24" style={{ background: '#0f1117', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#888' }}>semana actual</p>
          <h1 className="text-xl font-bold mt-0.5" style={{ color: '#f0f0f0' }}>
            {todayPlan.length > 0 ? `Toca entrenar hoy` : `Buen ${weekdayName}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36', color: '#f0f0f0' }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#c4f135', color: '#0f1117' }}
            >
              {user?.username?.[0]?.toUpperCase()}
            </span>
            <span className="text-sm">{user?.username}</span>
            {user?.isAdmin && <span className="text-xs px-1 rounded" style={{ background: '#2a3a0e', color: '#c4f135', fontSize: '9px' }}>admin</span>}
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: '#555' }} title="Salir">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week strip */}
      <div className="flex gap-1">
        {weekDays.map(({ dayLabel, dayNum, dayKey }) => {
          const isToday = dayKey === todayKey;
          const isDone = completedDates.has(dayKey) && !pendingDates.has(dayKey);
          const hasPlan = completedDates.has(dayKey) || pendingDates.has(dayKey);
          const isPast = dayKey < todayKey;
          const tipo = dayTipos[dayKey];
          const tipoStyle = tipo ? TIPO_COLORS[tipo] : null;

          let bg = 'transparent';
          let textColor = '#444';
          let border = '1px solid transparent';

          if (isToday) { bg = '#c4f135'; textColor = '#0f1117'; border = 'none'; }
          else if (isDone && tipoStyle) { bg = tipoStyle.bg; textColor = tipoStyle.color; border = `1px solid ${tipoStyle.color}44`; }
          else if (isDone) { bg = '#1e2d0e'; textColor = '#8ab030'; border = '1px solid #3a5a1a'; }
          else if (hasPlan && isPast) { bg = '#2d2a0e'; textColor = '#c4a030'; border = '1px solid #4a3a0e'; }
          else if (hasPlan) { textColor = '#f0f0f0'; border = '1px solid #2a2d36'; }

          return (
            <div key={dayKey} className="flex-1 flex flex-col items-center py-2 rounded-xl" style={{ background: bg, border }}>
              <span className="text-xs font-medium" style={{ color: isToday ? '#0f1117' : '#555' }}>{dayLabel}</span>
              <span className="text-sm font-bold mt-0.5" style={{ color: textColor }}>{dayNum}</span>
              <div className="h-1.5 mt-1">
                {hasPlan && !isDone && <span className="block w-1 h-1 rounded-full mx-auto" style={{ background: isToday ? '#0f1117' : '#c4f135' }} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Import CSV */}
      <button
        onClick={() => setShowUpload(!showUpload)}
        className="w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
        style={{ background: '#1a1d24', border: '1px solid #2a2d36', color: '#888' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Importar CSV
      </button>
      {showUpload && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2d36' }}>
          <CsvUpload onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Today's plan */}
      {semanaDetail && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Hoy</h2>
            {selectedFoco && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#2a3a0e', color: '#c4f135' }}>
                {selectedFoco}
              </span>
            )}
            {dayTipos[todayKey] && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={TIPO_COLORS[dayTipos[todayKey]] ?? { background: '#2a2d36', color: '#888' }}>
                {dayTipos[todayKey]}
              </span>
            )}
          </div>

          {todayPlan.length === 0 ? (
            <div className="rounded-xl p-4 text-center" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
              <p className="text-sm" style={{ color: '#555' }}>Descanso — no hay ejercicios para hoy</p>
              {nextTrainingDay && nextPlan.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2a2d36' }}>
                  <p className="text-xs mb-2" style={{ color: '#888' }}>
                    Próximo entreno: {new Date(nextTrainingDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                  </p>
                  <div className="space-y-1">
                    {nextPlan.slice(0, 3).map((s) => (
                      <p key={s.id} className="text-xs" style={{ color: '#555' }}>· {s.ejercicio}</p>
                    ))}
                    {nextPlan.length > 3 && <p className="text-xs" style={{ color: '#555' }}>+{nextPlan.length - 3} más</p>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {todayPlan.map((s) => {
                const ejec = execBySession.get(s.id);
                const done = ejec?.completado;
                const isRunning = !!(s.distancia_km && s.distancia_km > 0);
                const pace = (s.distancia_km && s.duracion_min && s.distancia_km > 0)
                  ? s.duracion_min / s.distancia_km : null;
                const planSummary = isRunning
                  ? [
                      s.distancia_km ? `${s.distancia_km} km` : null,
                      pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}/km` : null,
                    ].filter(Boolean).join(' · ')
                  : [
                      s.series && s.reps ? `${s.series}×${s.reps}` : null,
                      s.peso_kg ? `@${s.peso_kg}kg` : null,
                    ].filter(Boolean).join(' ');

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: done ? '#162012' : '#1a1d24', border: done ? '1px solid #3a5a1a' : '1px solid #2a2d36' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: done ? '#2a4a12' : '#111' }}>
                      {isRunning ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#8ab030' : '#888'} strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#8ab030' : '#888'} strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3m15 0h-3M6 12V9m12 3V9M9 8V5m6 3V5M3 9h18" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: done ? '#8ab030' : '#f0f0f0' }}>{s.ejercicio}</p>
                      {planSummary && <p className="text-xs mt-0.5" style={{ color: '#555' }}>{planSummary}</p>}
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={done ? { background: '#1e2d0e', color: '#8ab030' } : { background: '#2a2d36', color: '#555' }}
                    >
                      {done ? 'hecho' : 'pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Weekly progress */}
      {data?.currentSemana && (
        <div className="rounded-xl p-4" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Esta semana</p>
            <span className="text-xs font-semibold" style={{ color: '#c4f135' }}>
              {data.weeklyStats.completados}/{data.weeklyStats.totalEjercicios} sesiones
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: '#2a2d36' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${completionRate}%`, background: '#c4f135' }} />
          </div>
          {/* Tipo breakdown */}
          {Object.keys(data.weeklyStats.tipoBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.weeklyStats.tipoBreakdown).map(([tipo, count]) => {
                const style = TIPO_COLORS[tipo] ?? { bg: '#2a2d36', color: '#888' };
                return (
                  <span key={tipo} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: style.bg, color: style.color }}>
                    {count}× {tipo}
                  </span>
                );
              })}
              {(data.weeklyStats.totalDistancia ?? 0) > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#1e2d0e', color: '#c4f135' }}>
                  {data.weeklyStats.totalDistancia.toFixed(1)} km
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Monthly breakdown (last 4 weeks) */}
      {data?.monthlyBreakdown && data.monthlyBreakdown.some((w) => Object.keys(w.tipos).length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#888' }}>Últimas 4 semanas</p>
          <div className="rounded-xl p-4" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
            <div className="flex gap-2">
              {data.monthlyBreakdown.map(({ semana, tipos }) => {
                const tipoList = Object.entries(tipos);
                return (
                  <div key={semana} className="flex-1">
                    <div className="space-y-1 mb-2">
                      {['Running', 'Fuerza', 'Movilidad', 'Híbrido'].map((tipo) => {
                        const count = tipos[tipo] ?? 0;
                        return (
                          <div key={tipo} className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2d36' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: count > 0 ? `${Math.min(count / 7, 1) * 100}%` : '0%',
                                background: TIPO_COLORS[tipo]?.color ?? '#555',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-center" style={{ color: '#555' }}>{semana}</p>
                    {tipoList.length > 0 && (
                      <p className="text-xs text-center mt-0.5 font-medium" style={{ color: '#888' }}>
                        {tipoList.map(([t, c]) => `${c}${t[0]}`).join(' ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #2a2d36' }}>
              {['Running', 'Fuerza', 'Movilidad', 'Híbrido'].map((tipo) => (
                <div key={tipo} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[tipo]?.color ?? '#555' }} />
                  <span className="text-xs" style={{ color: '#555' }}>{tipo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Streak */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#1e2d0e', border: '1px solid #3a5a1a' }}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8ab030' }}>Racha actual</p>
          <p className="text-4xl font-bold mt-1" style={{ color: '#c4f135' }}>
            {data?.streak ?? 0}
            <span className="text-base font-normal ml-1.5" style={{ color: '#8ab030' }}>semanas</span>
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#2a4a12' }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#c4f135" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      {/* Recent PRs */}
      {(data?.recentRecords.length ?? 0) > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>Récords recientes</h2>
          <div className="space-y-2">
            {data!.recentRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#2d2a0e', border: '1px solid #4a3a0e' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{r.ejercicio}</p>
                  <p className="text-xs" style={{ color: '#888' }}>{r.fecha}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: '#c4a030' }}>
                  {r.valor} {r.tipo === 'peso' ? 'kg' : 'km'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foco semanal */}
      {data?.currentSemana && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Foco semanal</h2>
            {savingFoco && <span className="text-xs" style={{ color: '#555' }}>Guardando...</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCOS.map((foco) => {
              const isActive = selectedFoco === foco;
              return (
                <button
                  key={foco}
                  onClick={() => handleFoco(foco)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={isActive ? { background: '#c4f135', color: '#0f1117' } : { background: '#1a1d24', border: '1px solid #2a2d36', color: '#888' }}
                >
                  {foco}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No data */}
      {!data?.currentSemana && !loading && (
        <div className="text-center py-8" style={{ color: '#555' }}>
          <p className="font-medium" style={{ color: '#ccc' }}>Sin datos aún</p>
          <p className="text-sm mt-1">Importa un CSV para empezar</p>
        </div>
      )}
    </div>
  );
}
