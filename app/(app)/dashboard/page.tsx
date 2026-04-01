'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CsvUpload from '@/components/CsvUpload';
import { TIPO_COLORS, getDayColor } from '@/lib/tipo-colors';

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

interface AuthUser { userId: number; username: string; isAdmin: boolean; }

interface SemanaDetail {
  semana: { id: number; semana_numero: number; anio: number; foco?: string | null };
  plan: {
    id: number; fecha: string; ejercicio: string; categoria: string | null;
    tipo: string | null; series: number | null; reps: number | null;
    peso_kg: number | null; distancia_km: number | null; duracion_min: number | null;
  }[];
  ejecuciones: { id: number; sesion_id: number; completado: boolean | null; peso_kg: number | null; distancia_km: number | null; }[];
}

const FOCOS = ['Running', 'Fuerza', 'Híbrido', 'Movilidad', 'Natación'];

function getWeekDays(refDate: Date) {
  const dow = refDate.getDay();
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, dayLabel: ['L','M','X','J','V','S','D'][i], dayNum: d.getDate(), dayKey: d.toISOString().slice(0, 10) };
  });
}

// Circular progress arc
function ArcProgress({ pct, size = 80, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#22263a" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#lime-grad)" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <defs>
        <linearGradient id="lime-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8ab030" />
          <stop offset="100%" stopColor="#c4f135" />
        </linearGradient>
      </defs>
    </svg>
  );
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
  const GREET = (() => {
    const h = today.getHours();
    if (h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  })();

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
      } catch { router.push('/login'); }
      finally { setLoading(false); }
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
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foco: newFoco }),
      });
    } finally { setSavingFoco(false); }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="skeleton h-8 w-48 mb-1" />
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-28 w-full rounded-2xl mt-4" />
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {[...Array(7)].map((_, i) => <div key={i} className="skeleton aspect-square rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const completedDates = new Set<string>();
  const pendingDates = new Set<string>();
  const dayTipos: Record<string, string> = {};
  const dayCategorias: Record<string, string[]> = {};

  if (semanaDetail) {
    const execBySession = new Map(semanaDetail.ejecuciones.map((e) => [e.sesion_id, e]));
    for (const s of semanaDetail.plan) {
      const ejec = execBySession.get(s.id);
      if (ejec?.completado) completedDates.add(s.fecha);
      else pendingDates.add(s.fecha);
      if (s.tipo) dayTipos[s.fecha] = s.tipo;
      if (s.categoria) {
        if (!dayCategorias[s.fecha]) dayCategorias[s.fecha] = [];
        dayCategorias[s.fecha].push(s.categoria);
      }
    }
  }

  const todayPlan = semanaDetail?.plan.filter((s) => s.fecha === todayKey) ?? [];
  const execBySession = new Map(semanaDetail?.ejecuciones.map((e) => [e.sesion_id, e]) ?? []);
  const completionRate = data?.weeklyStats.totalEjercicios
    ? Math.round((data.weeklyStats.completados / data.weeklyStats.totalEjercicios) * 100)
    : 0;

  const futureDates = weekDays.map((d) => d.dayKey).filter((k) => k > todayKey && pendingDates.has(k));
  const nextTrainingDay = futureDates[0] ?? null;
  const nextPlan = nextTrainingDay ? semanaDetail?.plan.filter((s) => s.fecha === nextTrainingDay) ?? [] : [];

  return (
    <div className="p-4 space-y-5 pb-28 animate-fade-in" style={{ minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pt-3 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#3c4260' }}>
            {GREET}
          </p>
          <h1 className="text-2xl font-bold mt-0.5 leading-tight" style={{ color: '#f0f2ff' }}>
            {user?.username ?? '—'}
            {todayPlan.length > 0 && (
              <span className="ml-2 text-sm font-medium align-middle" style={{ color: '#c4f135' }}>
                · entrena hoy
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user?.isAdmin && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider uppercase"
              style={{ background: 'rgba(196,241,53,0.12)', color: '#c4f135', border: '1px solid rgba(196,241,53,0.2)' }}>
              Admin
            </span>
          )}
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center tap-scale"
            style={{ background: '#13161e', border: '1px solid #22263a', color: '#3c4260' }}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Week strip ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-3 glow-card"
        style={{ background: '#13161e', border: '1px solid #22263a' }}
      >
        <div className="flex gap-1.5">
          {weekDays.map(({ dayLabel, dayNum, dayKey }) => {
            const isToday = dayKey === todayKey;
            const isDone = completedDates.has(dayKey) && !pendingDates.has(dayKey);
            const hasPlan = completedDates.has(dayKey) || pendingDates.has(dayKey);
            const isPast = dayKey < todayKey;
            const tipo = dayTipos[dayKey];
            const tipoStyle = getDayColor(tipo, dayCategorias[dayKey] ?? []);

            let bg = 'transparent';
            let numColor = '#3c4260';
            let border = 'none';
            let labelColor = '#3c4260';

            if (isToday) {
              bg = '#c4f135'; numColor = '#0c0e14'; labelColor = '#0c0e14';
            } else if (isDone && tipoStyle) {
              bg = tipoStyle.bg; numColor = tipoStyle.color; border = `1px solid ${tipoStyle.color}33`;
              labelColor = tipoStyle.color + '99';
            } else if (isDone) {
              bg = '#1e2d0a'; numColor = '#8ab030'; border = '1px solid #3a5a12'; labelColor = '#8ab030' + '99';
            } else if (hasPlan && isPast) {
              bg = 'rgba(196,160,48,0.08)'; numColor = '#c4a030'; border = '1px solid rgba(196,160,48,0.2)';
            } else if (hasPlan) {
              numColor = '#f0f2ff'; border = '1px solid #22263a';
            }

            return (
              <div
                key={dayKey}
                className="flex-1 flex flex-col items-center py-2 rounded-xl tap-scale"
                style={{ background: bg, border, boxShadow: isToday ? '0 0 16px rgba(196,241,53,0.3)' : undefined }}
              >
                <span className="text-[10px] font-semibold" style={{ color: labelColor }}>{dayLabel}</span>
                <span className="text-sm font-bold mt-0.5" style={{ color: numColor }}>{dayNum}</span>
                <div className="h-1.5 mt-1 flex items-center justify-center">
                  {hasPlan && !isDone && (
                    <span className="block w-1 h-1 rounded-full"
                      style={{ background: isToday ? '#0c0e14' : tipoStyle?.color ?? '#c4f135' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      {data?.currentSemana && (
        <div className="grid grid-cols-2 gap-3 stagger">
          {/* Progress arc card */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3 glow-card col-span-2"
            style={{ background: '#13161e', border: '1px solid #22263a' }}
          >
            <div className="relative flex-shrink-0">
              <ArcProgress pct={completionRate} size={72} stroke={6} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold" style={{ color: '#c4f135' }}>{completionRate}%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3c4260' }}>Esta semana</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: '#f0f2ff' }}>
                {data.weeklyStats.completados}
                <span className="text-sm font-normal ml-1" style={{ color: '#3c4260' }}>
                  / {data.weeklyStats.totalEjercicios} días
                </span>
              </p>
              {/* Tipo pills */}
              {Object.keys(data.weeklyStats.tipoBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(data.weeklyStats.tipoBreakdown).map(([tipo, count]) => {
                    const s = TIPO_COLORS[tipo] ?? { bg: '#22263a', color: '#8890b0' };
                    return (
                      <span key={tipo} className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: s.bg, color: s.color }}>
                        {count}× {tipo}
                      </span>
                    );
                  })}
                  {(data.weeklyStats.totalDistancia ?? 0) > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(196,241,53,0.08)', color: '#c4f135', border: '1px solid rgba(196,241,53,0.15)' }}>
                      {data.weeklyStats.totalDistancia.toFixed(1)} km
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Streak card */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between glow-lime glow-card"
            style={{ background: 'linear-gradient(135deg, #1a2d0a 0%, #0f1a06 100%)', border: '1px solid rgba(196,241,53,0.2)' }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#8ab030' }}>Racha</p>
            <div>
              <p className="text-4xl font-bold leading-none" style={{ color: '#c4f135' }}>{data.streak ?? 0}</p>
              <p className="text-xs font-medium mt-1" style={{ color: '#8ab030' }}>semanas</p>
            </div>
            <svg className="w-5 h-5 self-end" fill="none" viewBox="0 0 24 24" stroke="#c4f135" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Distance card */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between glow-card"
            style={{ background: '#13161e', border: '1px solid #22263a' }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#3c4260' }}>Distancia</p>
            <div>
              <p className="text-4xl font-bold leading-none" style={{ color: '#f0f2ff' }}>
                {(data.weeklyStats.totalDistancia ?? 0) > 0
                  ? data.weeklyStats.totalDistancia.toFixed(1)
                  : '—'}
              </p>
              <p className="text-xs font-medium mt-1" style={{ color: '#3c4260' }}>km esta semana</p>
            </div>
            <svg className="w-5 h-5 self-end" fill="none" viewBox="0 0 24 24" stroke="#3c4260" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      )}

      {/* ── Today's plan ───────────────────────────────────────────── */}
      {semanaDetail && (
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#3c4260' }}>Hoy</h2>
            {dayTipos[todayKey] && (() => {
              const s = TIPO_COLORS[dayTipos[todayKey]] ?? { bg: '#22263a', color: '#8890b0' };
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
                  {dayTipos[todayKey]}
                </span>
              );
            })()}
          </div>

          {todayPlan.length === 0 ? (
            <div
              className="rounded-2xl p-5 text-center glow-card"
              style={{ background: '#13161e', border: '1px solid #22263a' }}
            >
              <p className="text-sm font-medium" style={{ color: '#3c4260' }}>Descanso hoy</p>
              {nextTrainingDay && nextPlan.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #22263a' }}>
                  <p className="text-xs mb-2 font-semibold" style={{ color: '#8890b0' }}>
                    Próximo · {new Date(nextTrainingDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                  </p>
                  <div className="space-y-1 text-left">
                    {nextPlan.slice(0, 3).map((s) => (
                      <p key={s.id} className="text-xs" style={{ color: '#3c4260' }}>· {s.ejercicio}</p>
                    ))}
                    {nextPlan.length > 3 && <p className="text-xs" style={{ color: '#3c4260' }}>+{nextPlan.length - 3} más</p>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 stagger">
              {todayPlan.map((s) => {
                const ejec = execBySession.get(s.id);
                const done = ejec?.completado;
                const isRunning = !!(s.distancia_km && s.distancia_km > 0);
                const pace = (s.distancia_km && s.duracion_min && s.distancia_km > 0)
                  ? s.duracion_min / s.distancia_km : null;
                const planSummary = isRunning
                  ? [s.distancia_km ? `${s.distancia_km} km` : null,
                     pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}/km` : null].filter(Boolean).join(' · ')
                  : [s.series && s.reps ? `${s.series}×${s.reps}` : null, s.peso_kg ? `@${s.peso_kg}kg` : null].filter(Boolean).join(' ');

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl glow-card tap-scale"
                    style={{
                      background: done ? 'rgba(30,45,10,0.8)' : '#13161e',
                      border: done ? '1px solid rgba(138,176,48,0.3)' : '1px solid #22263a',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: done ? 'rgba(196,241,53,0.12)' : '#1a1d28' }}
                    >
                      {isRunning ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#c4f135' : '#3c4260'} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={done ? '#c4f135' : '#3c4260'} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3m15 0h-3M6 12V9m12 3V9M9 8V5m6 3V5M3 9h18" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: done ? '#c4f135' : '#f0f2ff' }}>{s.ejercicio}</p>
                      {planSummary && <p className="text-xs mt-0.5" style={{ color: '#3c4260' }}>{planSummary}</p>}
                    </div>
                    <span
                      className="text-[11px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
                      style={done
                        ? { background: 'rgba(196,241,53,0.12)', color: '#c4f135' }
                        : { background: '#1a1d28', color: '#3c4260', border: '1px solid #22263a' }}
                    >
                      {done ? 'hecho' : 'pdte.'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly breakdown ──────────────────────────────────────── */}
      {data?.monthlyBreakdown && data.monthlyBreakdown.some((w) => Object.keys(w.tipos).length > 0) && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#3c4260' }}>Últimas 4 semanas</p>
          <div
            className="rounded-2xl p-4 glow-card"
            style={{ background: '#13161e', border: '1px solid #22263a' }}
          >
            <div className="flex gap-3">
              {data.monthlyBreakdown.map(({ semana, tipos }) => {
                const tipoList = Object.entries(tipos);
                const total = tipoList.reduce((s, [, c]) => s + c, 0);
                return (
                  <div key={semana} className="flex-1 text-center">
                    <div className="space-y-1 mb-2">
                      {(['Running', 'Fuerza', 'Movilidad', 'Híbrido'] as const).map((tipo) => {
                        const count = tipos[tipo] ?? 0;
                        return (
                          <div key={tipo} className="h-1.5 rounded-full overflow-hidden" style={{ background: '#22263a' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: count > 0 ? `${Math.min(count / 7, 1) * 100}%` : '0%', background: TIPO_COLORS[tipo]?.color ?? '#3c4260', transition: 'width 0.6s ease' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] font-medium" style={{ color: '#3c4260' }}>{semana}</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: total > 0 ? '#8890b0' : '#3c4260' }}>
                      {total > 0 ? `${total}d` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #22263a' }}>
              {(['Running', 'Fuerza', 'Movilidad', 'Híbrido'] as const).map((tipo) => (
                <div key={tipo} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[tipo]?.color ?? '#3c4260' }} />
                  <span className="text-[11px] font-medium" style={{ color: '#3c4260' }}>{tipo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent PRs ─────────────────────────────────────────────── */}
      {(data?.recentRecords.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#3c4260' }}>Récords recientes</p>
          <div className="space-y-2 stagger">
            {data!.recentRecords.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 rounded-2xl glow-card tap-scale"
                style={{ background: 'rgba(196,160,48,0.06)', border: '1px solid rgba(196,160,48,0.15)' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f0f2ff' }}>{r.ejercicio}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: '#3c4260' }}>{r.fecha}</p>
                </div>
                <p className="text-base font-bold" style={{ color: '#fbbf24' }}>
                  {r.valor} {r.tipo === 'peso' ? 'kg' : 'km'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Foco semanal ───────────────────────────────────────────── */}
      {data?.currentSemana && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#3c4260' }}>Foco semanal</p>
            {savingFoco && <span className="text-[11px]" style={{ color: '#3c4260' }}>Guardando…</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCOS.map((foco) => {
              const isActive = selectedFoco === foco;
              const s = Object.values(TIPO_COLORS).find((_, i) => Object.keys(TIPO_COLORS)[i] === foco);
              return (
                <button
                  key={foco}
                  onClick={() => handleFoco(foco)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-semibold tap-scale"
                  style={isActive
                    ? { background: '#c4f135', color: '#0c0e14', boxShadow: '0 0 12px rgba(196,241,53,0.3)' }
                    : { background: s?.bg ?? '#13161e', color: s?.color ?? '#8890b0', border: `1px solid ${s ? s.color + '33' : '#22263a'}` }}
                >
                  {foco}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Import CSV ─────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="w-full py-3 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 tap-scale"
          style={{
            background: showUpload ? '#1a1d28' : '#13161e',
            border: '1px solid #22263a',
            color: showUpload ? '#c4f135' : '#3c4260',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {showUpload ? 'Cancelar' : 'Importar CSV'}
        </button>
        {showUpload && (
          <div className="mt-3 rounded-2xl overflow-hidden animate-fade-up" style={{ border: '1px solid #22263a' }}>
            <CsvUpload onSuccess={handleUploadSuccess} />
          </div>
        )}
      </div>

      {/* ── No data ────────────────────────────────────────────────── */}
      {!data?.currentSemana && !loading && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="font-semibold" style={{ color: '#8890b0' }}>Sin datos aún</p>
          <p className="text-sm mt-1" style={{ color: '#3c4260' }}>Importa un CSV para empezar</p>
        </div>
      )}
    </div>
  );
}
