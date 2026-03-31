'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  currentSemana: { id: number; semana_numero: number; anio: number; foco?: string | null } | null;
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

const DAYS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAYS_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const FOCOS = ['Gym', 'Running', 'Híbrido', 'Fuerza', 'Movilidad', 'Otro'];

function getWeekDays(refDate: Date): { date: Date; dayLabel: string; dayNum: number; dayKey: string }[] {
  // Get Mon-Sun of the week containing refDate
  const dow = refDate.getDay(); // 0=Sun
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
        setSelectedFoco(dashData.currentSemana?.foco ?? null);

        if (dashData.currentSemana) {
          const detailRes = await fetch(`/api/semanas/${dashData.currentSemana.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setSemanaDetail(detail);
          }
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
    Promise.all([
      fetch('/api/dashboard').then((r) => r.json()),
    ]).then(([dashData]) => {
      setData(dashData);
      setSelectedFoco(dashData.currentSemana?.foco ?? null);
      if (dashData.currentSemana) {
        fetch(`/api/semanas/${dashData.currentSemana.id}`)
          .then((r) => r.json())
          .then((d) => setSemanaDetail(d));
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
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
          ))}
        </div>
      </div>
    );
  }

  // Build a set of dates with completions for this week from plan
  const completedDates = new Set<string>();
  const pendingDates = new Set<string>();
  if (semanaDetail) {
    const execBySession = new Map(semanaDetail.ejecuciones.map((e) => [e.sesion_id, e]));
    for (const s of semanaDetail.plan) {
      const ejec = execBySession.get(s.id);
      if (ejec?.completado) {
        completedDates.add(s.fecha);
      } else {
        pendingDates.add(s.fecha);
      }
    }
  }

  // Today's exercises
  const todayPlan = semanaDetail?.plan.filter((s) => s.fecha === todayKey) ?? [];
  const execBySession = new Map(semanaDetail?.ejecuciones.map((e) => [e.sesion_id, e]) ?? []);

  // Max weights from recent records
  const gymRecords = data?.recentRecords.filter((r) => r.tipo === 'peso') ?? [];
  const runRecords = data?.recentRecords.filter((r) => r.tipo === 'distancia') ?? [];

  const weekdayName = WEEKDAY_NAMES[today.getDay()];
  const completionRate = data?.weeklyStats.totalEjercicios
    ? Math.round((data.weeklyStats.completados / data.weeklyStats.totalEjercicios) * 100)
    : 0;

  return (
    <div className="p-4 space-y-5" style={{ background: '#0f1117', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#888' }}>
            semana actual
          </p>
          <h1 className="text-xl font-bold mt-0.5" style={{ color: '#f0f0f0' }}>
            Listo para el {weekdayName}?
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg transition-colors"
          style={{ color: '#555' }}
          title="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Profile pill */}
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
        style={{ background: '#1a1d24', border: '1px solid #2a2d36', color: '#f0f0f0' }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#c4f135', color: '#0f1117' }}
        >
          {user?.username?.[0]?.toUpperCase()}
        </span>
        <span>{user?.username}</span>
        {selectedFoco && (
          <>
            <span style={{ color: '#555' }}>·</span>
            <span style={{ color: '#c4f135' }}>{selectedFoco}</span>
          </>
        )}
        {user?.isAdmin && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: '#2a3a0e', color: '#c4f135', fontSize: '10px' }}
          >
            admin
          </span>
        )}
      </div>

      {/* Week strip */}
      <div className="flex gap-1.5">
        {weekDays.map(({ dayLabel, dayNum, dayKey }) => {
          const isToday = dayKey === todayKey;
          const isDone = completedDates.has(dayKey) && !pendingDates.has(dayKey);
          const hasPlan = completedDates.has(dayKey) || pendingDates.has(dayKey);
          const isPast = new Date(dayKey) < today && dayKey !== todayKey;

          let bg = '#1a1d24';
          let color = '#555';
          let border = '1px solid #2a2d36';

          if (isToday) {
            bg = '#c4f135';
            color = '#0f1117';
            border = 'none';
          } else if (isDone) {
            bg = '#1e2d0e';
            color = '#8ab030';
            border = '1px solid #3a5a1a';
          } else if (hasPlan && isPast) {
            bg = '#2d2a0e';
            color = '#c4a030';
            border = '1px solid #4a3a0e';
          }

          return (
            <div
              key={dayKey}
              className="flex-1 flex flex-col items-center py-2 rounded-xl"
              style={{ background: bg, border }}
            >
              <span className="text-xs font-medium" style={{ color: isToday ? '#0f1117' : '#888' }}>
                {dayLabel}
              </span>
              <span className="text-sm font-bold mt-0.5" style={{ color }}>
                {dayNum}
              </span>
              {hasPlan && (
                <span
                  className="w-1 h-1 rounded-full mt-1"
                  style={{ background: isToday ? '#0f1117' : isDone ? '#8ab030' : '#c4a030' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Import CSV button */}
      <button
        onClick={() => setShowUpload(!showUpload)}
        className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
        style={{ background: '#1a1d24', border: '1px solid #2a2d36', color: '#c4f135' }}
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
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
              Hoy
            </h2>
            {selectedFoco && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#2a3a0e', color: '#c4f135' }}
              >
                {selectedFoco}
              </span>
            )}
          </div>

          {todayPlan.length === 0 ? (
            <div
              className="rounded-xl p-4 text-center text-sm"
              style={{ background: '#1a1d24', color: '#555' }}
            >
              Descanso — no hay ejercicios para hoy
            </div>
          ) : (
            <div className="space-y-2">
              {todayPlan.map((s) => {
                const ejec = execBySession.get(s.id);
                const isGym = s.categoria !== 'Running' && !s.distancia_km && !s.duracion_min;
                const done = ejec?.completado;
                const planSummary = [
                  s.series && s.reps ? `${s.series}×${s.reps}` : null,
                  s.peso_kg ? `@${s.peso_kg}kg` : null,
                  s.distancia_km ? `${s.distancia_km}km` : null,
                  s.duracion_min ? `${s.duracion_min}min` : null,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: done ? '#1e2d0e' : '#1a1d24',
                      border: done ? '1px solid #3a5a1a' : '1px solid #2a2d36',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: done ? '#2a4a12' : '#111' }}
                    >
                      {isGym ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#8ab030' : '#888'} strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3m15 0h-3M6 12V9m12 3V9M9 8V5m6 3V5M3 9h18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#8ab030' : '#888'} strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: done ? '#8ab030' : '#f0f0f0' }}>
                        {s.ejercicio}
                      </p>
                      {planSummary && (
                        <p className="text-xs mt-0.5" style={{ color: '#888' }}>{planSummary}</p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={
                        done
                          ? { background: '#1e2d0e', color: '#8ab030' }
                          : { background: '#2a2d36', color: '#888' }
                      }
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

      {/* Streak */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{ background: '#1e2d0e', border: '1px solid #3a5a1a' }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8ab030' }}>
            Racha actual
          </p>
          <p className="text-4xl font-bold mt-1" style={{ color: '#c4f135' }}>
            {data?.streak ?? 0}
            <span className="text-base font-normal ml-1.5" style={{ color: '#8ab030' }}>semanas</span>
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: '#2a4a12' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#c4f135" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-4"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: '#888' }}>Ejercicios</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#f0f0f0' }}>
            {data?.weeklyStats.completados ?? 0}
            <span className="text-sm font-normal ml-1" style={{ color: '#555' }}>
              /{data?.weeklyStats.totalEjercicios ?? 0}
            </span>
          </p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2d36' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${completionRate}%`, background: '#c4f135' }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: '#555' }}>{completionRate}% completado</p>
        </div>

        {(data?.weeklyStats.totalDistancia ?? 0) > 0 && (
          <div
            className="rounded-xl p-4 col-span-2"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: '#888' }}>Distancia</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#f0f0f0' }}>
              {data?.weeklyStats.totalDistancia?.toFixed(1)}
              <span className="text-sm font-normal ml-1" style={{ color: '#555' }}>km esta semana</span>
            </p>
          </div>
        )}
      </div>

      {/* Recent PRs */}
      {gymRecords.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>
            Récords recientes
          </h2>
          <div className="space-y-2">
            {gymRecords.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: '#2d2a0e', border: '1px solid #4a3a0e' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>{r.ejercicio}</p>
                  <p className="text-xs" style={{ color: '#888' }}>{r.fecha}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#c4a030' }}>
                    {r.valor} {r.tipo === 'peso' ? 'kg' : 'km'}
                  </p>
                  <p className="text-xs" style={{ color: '#888' }}>RP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foco selector */}
      {data?.currentSemana && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
              Foco semanal
            </h2>
            {savingFoco && (
              <span className="text-xs" style={{ color: '#555' }}>Guardando...</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCOS.map((foco) => {
              const isActive = selectedFoco === foco;
              return (
                <button
                  key={foco}
                  onClick={() => handleFoco(foco)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={
                    isActive
                      ? { background: '#c4f135', color: '#0f1117' }
                      : { background: '#1a1d24', border: '1px solid #2a2d36', color: '#888' }
                  }
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1a1d24' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#555" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-medium" style={{ color: '#ccc' }}>Sin datos aún</p>
          <p className="text-sm mt-1">Importa un CSV para empezar</p>
        </div>
      )}
    </div>
  );
}
