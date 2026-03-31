'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  totalCompletadas: number;
  totalDistanciaKm: number;
  mejorCarreraKm: number;
  totalPRs: number;
  semanasActivas: number;
  mejorRacha: number;
  rachaActual: number;
  mejorRachaSemanasConsecutivas: number;
  estaSemana: { total: number; completadas: number };
  estaSemanaKm: number;
  mejorSemanaKm: number;
}

interface MedalDef {
  id: string;
  title: string;
  desc: string;
  category: string;
  icon: React.ReactNode;
  condition: (s: Stats) => boolean;
  progress?: (s: Stats) => { value: number; max: number };
}

function RingChart({
  progress,
  color,
  trackColor,
  radius,
  strokeWidth,
  animate,
}: {
  progress: number; // 0–1
  color: string;
  trackColor: string;
  radius: number;
  strokeWidth: number;
  animate: boolean;
}) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));

  return (
    <g>
      <circle
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="110"
        cy="110"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={animate ? offset : circumference}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '110px 110px',
          transition: animate ? 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      />
    </g>
  );
}

function MedalBadge({ medal, unlocked }: { medal: MedalDef; unlocked: boolean; stats: Stats }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-2 transition-all"
      style={{
        background: unlocked ? '#1a2010' : '#1a1d24',
        border: `1px solid ${unlocked ? '#3a5a1a' : '#2a2d36'}`,
        opacity: unlocked ? 1 : 0.5,
      }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black"
        style={{
          background: unlocked ? '#2a4a10' : '#2a2d36',
          color: unlocked ? '#c4f135' : '#444',
          border: `2px solid ${unlocked ? '#c4f135' : '#333'}`,
          boxShadow: unlocked ? '0 0 20px rgba(196,241,53,0.25)' : 'none',
        }}
      >
        {medal.icon}
      </div>
      <p className="text-xs font-semibold text-center" style={{ color: unlocked ? '#f0f0f0' : '#555' }}>
        {medal.title}
      </p>
      <p className="text-xs text-center leading-tight" style={{ color: '#555' }}>
        {medal.desc}
      </p>
      {unlocked && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#1e2d0e', color: '#8ab030' }}>
          desbloqueado
        </span>
      )}
    </div>
  );
}

export default function LogrosPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    fetch('/api/logros')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setStats(d.stats);
        setTimeout(() => setAnimate(true), 100);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: 160 }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#1a1d24' }} />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: '#1a1d24' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const weekProg = stats.estaSemana.total > 0 ? stats.estaSemana.completadas / stats.estaSemana.total : 0;
  const streakProg = Math.min(stats.rachaActual / 7, 1);
  const kmProg = stats.mejorSemanaKm > 0 ? Math.min(stats.estaSemanaKm / stats.mejorSemanaKm, 1) : 0;

  const MEDALS: MedalDef[] = [
    {
      id: 'primera_sesion',
      title: 'Primera sesión',
      desc: 'Completa tu primer entreno',
      category: 'inicio',
      icon: '1',
      condition: (s) => s.totalCompletadas >= 1,
    },
    {
      id: 'diez_sesiones',
      title: '10 sesiones',
      desc: 'Completa 10 entrenos',
      category: 'inicio',
      icon: '10',
      condition: (s) => s.totalCompletadas >= 10,
    },
    {
      id: 'cincuenta_sesiones',
      title: '50 sesiones',
      desc: 'Completa 50 entrenos',
      category: 'inicio',
      icon: '50',
      condition: (s) => s.totalCompletadas >= 50,
    },
    {
      id: 'primera_carrera',
      title: 'Primera carrera',
      desc: 'Completa una sesión de running',
      category: 'running',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      condition: (s) => s.mejorCarreraKm >= 1,
    },
    {
      id: 'cinco_k',
      title: '5K completado',
      desc: 'Corre 5km o más',
      category: 'running',
      icon: '5K',
      condition: (s) => s.mejorCarreraKm >= 5,
    },
    {
      id: 'diez_k',
      title: '10K completado',
      desc: 'Corre 10km o más',
      category: 'running',
      icon: '10K',
      condition: (s) => s.mejorCarreraKm >= 10,
    },
    {
      id: 'medio',
      title: 'Medio maratón',
      desc: 'Corre 21km o más',
      category: 'running',
      icon: '21K',
      condition: (s) => s.mejorCarreraKm >= 21,
    },
    {
      id: 'cien_km',
      title: '100km club',
      desc: 'Suma 100km corriendo',
      category: 'running',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      condition: (s) => s.totalDistanciaKm >= 100,
    },
    {
      id: 'racha_3',
      title: 'Racha de 3',
      desc: '3 días seguidos entrenando',
      category: 'racha',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      condition: (s) => s.mejorRacha >= 3,
    },
    {
      id: 'racha_7',
      title: 'Semana perfecta',
      desc: '7 días seguidos entrenando',
      category: 'racha',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
        </svg>
      ),
      condition: (s) => s.mejorRacha >= 7,
    },
    {
      id: 'racha_30',
      title: 'Mes de fuego',
      desc: '30 días seguidos entrenando',
      category: 'racha',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm3.536-11.536a1 1 0 00-1.414 0L12 10.586l-2.121-2.121a1 1 0 10-1.414 1.415L10.586 12l-2.121 2.121a1 1 0 101.414 1.414L12 13.415l2.121 2.12a1 1 0 001.415-1.414L13.415 12l2.121-2.121a1 1 0 000-1.415z" />
        </svg>
      ),
      condition: (s) => s.mejorRacha >= 30,
    },
    {
      id: 'primer_pr',
      title: 'Primer PR',
      desc: 'Bate tu primer récord',
      category: 'record',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      condition: (s) => s.totalPRs >= 1,
    },
    {
      id: 'diez_prs',
      title: '10 récords',
      desc: 'Bate 10 marcas personales',
      category: 'record',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      condition: (s) => s.totalPRs >= 10,
    },
    {
      id: 'cuatro_semanas',
      title: 'Un mes activo',
      desc: '4 semanas consecutivas con entrenos',
      category: 'constancia',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      condition: (s) => s.mejorRachaSemanasConsecutivas >= 4,
    },
    {
      id: 'diez_semanas',
      title: '10 semanas activas',
      desc: '10 semanas diferentes con entrenos',
      category: 'constancia',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      condition: (s) => s.semanasActivas >= 10,
    },
  ];

  const unlockedCount = MEDALS.filter((m) => m.condition(stats)).length;

  const RING_CONFIGS = [
    {
      progress: weekProg,
      color: '#c4f135',
      trackColor: '#1e2d0e',
      radius: 85,
      strokeWidth: 16,
      label: 'Esta semana',
      value: `${stats.estaSemana.completadas}/${stats.estaSemana.total}`,
      sublabel: 'sesiones',
    },
    {
      progress: streakProg,
      color: '#38bdf8',
      trackColor: '#0c2535',
      radius: 62,
      strokeWidth: 16,
      label: 'Racha',
      value: String(stats.rachaActual),
      sublabel: 'días',
    },
    {
      progress: kmProg,
      color: '#fb923c',
      trackColor: '#2a1a0a',
      radius: 39,
      strokeWidth: 14,
      label: 'Km semana',
      value: `${stats.estaSemanaKm}`,
      sublabel: 'km',
    },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    inicio: 'Primeros pasos',
    running: 'Running',
    racha: 'Rachas',
    record: 'Récords',
    constancia: 'Constancia',
  };

  const medalsByCategory = MEDALS.reduce<Record<string, MedalDef[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6 pb-24">
      <h1 className="text-xl font-bold pt-2" style={{ color: '#f0f0f0' }}>Logros</h1>

      {/* Rings */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#888' }}>
          Actividad
        </p>
        <div className="flex items-center gap-6">
          {/* SVG Rings */}
          <div className="flex-shrink-0">
            <svg width="220" height="220" viewBox="0 0 220 220">
              {RING_CONFIGS.map((ring, i) => (
                <RingChart key={i} {...ring} animate={animate} />
              ))}
              {/* Center stats */}
              <text x="110" y="102" textAnchor="middle" fill="#f0f0f0" fontSize="22" fontWeight="bold">
                {Math.round(weekProg * 100)}%
              </text>
              <text x="110" y="120" textAnchor="middle" fill="#888" fontSize="11">
                completado
              </text>
            </svg>
          </div>
          {/* Legend */}
          <div className="space-y-3 flex-1">
            {RING_CONFIGS.map((ring, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ring.color }} />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs" style={{ color: '#888' }}>{ring.label}</span>
                    <span className="text-sm font-bold" style={{ color: ring.color }}>
                      {ring.value}
                      <span className="text-xs font-normal ml-1" style={{ color: '#555' }}>{ring.sublabel}</span>
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: ring.trackColor }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(ring.progress, 1) * 100}%`,
                        background: ring.color,
                        transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completadas', value: stats.totalCompletadas.toString(), sub: 'sesiones' },
          { label: 'Km totales', value: stats.totalDistanciaKm.toFixed(1), sub: 'km' },
          { label: 'Mejor racha', value: stats.mejorRacha.toString(), sub: 'días' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
          >
            <p className="text-xs mb-1" style={{ color: '#555' }}>{label}</p>
            <p className="text-2xl font-black" style={{ color: '#c4f135' }}>{value}</p>
            <p className="text-xs" style={{ color: '#888' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Medals header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#888' }}>
          Medallas
        </p>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#1e2d0e', color: '#c4f135' }}>
          {unlockedCount}/{MEDALS.length}
        </span>
      </div>

      {/* Medals by category */}
      {Object.entries(medalsByCategory).map(([category, medals]) => (
        <div key={category}>
          <p className="text-xs font-medium mb-3" style={{ color: '#555' }}>
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {medals.map((medal) => (
              <MedalBadge key={medal.id} medal={medal} unlocked={medal.condition(stats)} stats={stats} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
