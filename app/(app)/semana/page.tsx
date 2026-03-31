'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Sesion, Ejecucion } from '@/db/schema';

interface SemanaInfo {
  id: number;
  semana_numero: number;
  anio: number;
  foco?: string | null;
  totalSesiones: number;
  completadas: number;
}

interface SemanaDetail {
  semana: { id: number; semana_numero: number; anio: number; foco?: string | null };
  plan: Sesion[];
  ejecuciones: Ejecucion[];
}

type SensacionLabel = 'fácil' | 'medio' | 'intenso';

const SENSACION_MAP: Record<number, SensacionLabel> = {
  1: 'fácil',
  2: 'fácil',
  3: 'medio',
  4: 'intenso',
  5: 'intenso',
};

const SENSACION_STYLE: Record<SensacionLabel, { bg: string; color: string }> = {
  'fácil': { bg: '#1e2d0e', color: '#8ab030' },
  'medio': { bg: '#2d2a0e', color: '#c4a030' },
  'intenso': { bg: '#2d1010', color: '#e05050' },
};

export default function SemanaPage() {
  const router = useRouter();
  const [semanas, setSemanas] = useState<SemanaInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SemanaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const [editState, setEditState] = useState<Record<number, Partial<Ejecucion>>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [semanasRes] = await Promise.all([
          fetch('/api/semanas'),
          fetch('/api/auth/me'),
        ]);

        if (!semanasRes.ok) {
          router.push('/login');
          return;
        }

        const semanasData = await semanasRes.json();
        setSemanas(semanasData.semanas || []);

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
    setOpenDays(new Set());
    fetch(`/api/semanas/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d);
        // Auto-open today's date if present
        const today = new Date().toISOString().slice(0, 10);
        if (d.plan?.some((s: Sesion) => s.fecha === today)) {
          setOpenDays(new Set([today]));
        } else if (d.plan?.length > 0) {
          const firstDate = [...new Set(d.plan.map((s: Sesion) => s.fecha))].sort()[0] as string;
          setOpenDays(new Set([firstDate]));
        }
      })
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

  function getEjecucion(sesionId: number): Ejecucion | undefined {
    return detail?.ejecuciones.find((e) => e.sesion_id === sesionId);
  }

  function getFieldValue<K extends keyof Ejecucion>(ejec: Ejecucion, field: K): Ejecucion[K] | undefined {
    const editData = editState[ejec.id];
    if (editData && field in editData) return editData[field] as Ejecucion[K];
    return ejec[field];
  }

  function handleChange(ejecucionId: number, field: keyof Ejecucion, value: unknown) {
    setEditState((prev) => ({
      ...prev,
      [ejecucionId]: { ...prev[ejecucionId], [field]: value },
    }));
  }

  async function handleSave(ejecucionId: number) {
    const updates = editState[ejecucionId];
    if (!updates) return;
    setSaving((prev) => new Set(prev).add(ejecucionId));
    try {
      await handleUpdate(ejecucionId, updates);
      setEditState((prev) => {
        const next = { ...prev };
        delete next[ejecucionId];
        return next;
      });
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(ejecucionId);
        return next;
      });
    }
  }

  async function handleToggleCompletado(ejecucionId: number, current: boolean) {
    setSaving((prev) => new Set(prev).add(ejecucionId));
    try {
      await handleUpdate(ejecucionId, { completado: !current });
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(ejecucionId);
        return next;
      });
    }
  }

  function toggleDay(fecha: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha);
      else next.add(fecha);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: '180px' }} />
        <div className="h-12 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
          ))}
        </div>
      </div>
    );
  }

  if (semanas.length === 0) {
    return (
      <div className="p-4 max-w-2xl mx-auto" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <h1 className="text-xl font-bold mb-6 pt-2" style={{ color: '#f0f0f0' }}>Semana</h1>
        <div className="text-center py-12" style={{ color: '#555' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#1a1d24' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#555" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium" style={{ color: '#ccc' }}>Sin semanas importadas</p>
          <p className="text-sm mt-1">Ve al Dashboard e importa un CSV</p>
        </div>
      </div>
    );
  }

  const currentSemana = semanas.find((s) => s.id === selectedId);

  // Group plan by date
  const byDate = (detail?.plan ?? []).reduce<Record<string, Sesion[]>>((acc, s) => {
    if (!acc[s.fecha]) acc[s.fecha] = [];
    acc[s.fecha].push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="p-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-4 pt-2" style={{ color: '#f0f0f0' }}>Semana</h1>

      {/* Semana selector */}
      <div className="mb-4">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(parseInt(e.target.value))}
          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
          style={{
            background: '#1a1d24',
            border: '1px solid #2a2d36',
            color: '#f0f0f0',
          }}
        >
          {semanas.map((s) => (
            <option key={s.id} value={s.id} style={{ background: '#1a1d24' }}>
              Semana {s.semana_numero} — {s.anio}
              {s.foco ? ` · ${s.foco}` : ''}
              {' '}({s.completadas}/{s.totalSesiones})
            </option>
          ))}
        </select>
      </div>

      {/* Foco + progress */}
      {currentSemana && (
        <div
          className="rounded-xl p-3 mb-4 flex items-center gap-3"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          {currentSemana.foco && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
              style={{ background: '#2a3a0e', color: '#c4f135' }}
            >
              {currentSemana.foco}
            </span>
          )}
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#888' }}>
              <span>Progreso</span>
              <span style={{ color: '#f0f0f0' }}>{currentSemana.completadas}/{currentSemana.totalSesiones}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2d36' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: currentSemana.totalSesiones > 0
                    ? `${(currentSemana.completadas / currentSemana.totalSesiones) * 100}%`
                    : '0%',
                  background: '#c4f135',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Accordion by day */}
      {loadingDetail ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((fecha) => {
            const sessions = byDate[fecha];
            const isOpen = openDays.has(fecha);
            const allEjecs = sessions.map((s) => getEjecucion(s.id)).filter(Boolean) as Ejecucion[];
            const doneCount = allEjecs.filter((e) => e.completado).length;
            const isToday = fecha === new Date().toISOString().slice(0, 10);
            const allDone = doneCount === sessions.length && sessions.length > 0;

            const dateLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });

            return (
              <div
                key={fecha}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isToday ? '#c4f135' : allDone ? '#3a5a1a' : '#2a2d36'}` }}
              >
                {/* Day header */}
                <button
                  onClick={() => toggleDay(fecha)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ background: allDone ? '#1e2d0e' : '#1a1d24' }}
                >
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: '#c4f135' }}
                      />
                    )}
                    <span className="font-medium text-sm capitalize" style={{ color: allDone ? '#8ab030' : '#f0f0f0' }}>
                      {dateLabel}
                    </span>
                    {isToday && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: '#c4f135', color: '#0f1117' }}
                      >
                        hoy
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#888' }}>
                      {doneCount}/{sessions.length}
                    </span>
                    <svg
                      className="w-4 h-4 transition-transform"
                      style={{
                        color: '#555',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Exercise cards */}
                {isOpen && (
                  <div className="divide-y" style={{ borderColor: '#2a2d36' }}>
                    {sessions.map((sesion) => {
                      const ejec = getEjecucion(sesion.id);
                      if (!ejec) return null;

                      const isSaving = saving.has(ejec.id);
                      const isDirty = Boolean(editState[ejec.id] && Object.keys(editState[ejec.id]).length > 0);
                      const completado = getFieldValue(ejec, 'completado') ?? false;
                      const sensacion = getFieldValue(ejec, 'sensacion');
                      const sensacionLabel = sensacion ? SENSACION_MAP[sensacion] : null;

                      const planSummary = [
                        sesion.series && sesion.reps ? `${sesion.series}×${sesion.reps}` : null,
                        sesion.peso_kg ? `@${sesion.peso_kg}kg` : null,
                        sesion.distancia_km ? `${sesion.distancia_km}km` : null,
                        sesion.duracion_min ? `${sesion.duracion_min}min` : null,
                      ].filter(Boolean).join(' ');

                      return (
                        <div
                          key={sesion.id}
                          className="px-4 py-4"
                          style={{ background: completado ? '#162012' : '#111720' }}
                        >
                          {/* Exercise header row */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm" style={{ color: '#f0f0f0' }}>
                                {sesion.ejercicio}
                              </p>
                              {sesion.categoria && (
                                <p className="text-xs mt-0.5" style={{ color: '#888' }}>{sesion.categoria}</p>
                              )}
                              {planSummary && (
                                <p className="text-xs mt-1" style={{ color: '#555' }}>
                                  Plan: {planSummary}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleToggleCompletado(ejec.id, completado as boolean)}
                              disabled={isSaving}
                              className="flex-shrink-0 ml-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                              style={{
                                background: completado ? '#2a4a12' : '#2a2d36',
                              }}
                            >
                              {isSaving && !isDirty ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#888">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                                  <path className="opacity-75" fill="#888" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={completado ? '#8ab030' : '#555'} strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </div>

                          {/* Inputs grid */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {(sesion.series !== null || sesion.reps !== null) && (
                              <>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>Series</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={getFieldValue(ejec, 'series') ?? ''}
                                    onChange={(e) => handleChange(ejec.id, 'series', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                    onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>Reps</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={getFieldValue(ejec, 'reps') ?? ''}
                                    onChange={(e) => handleChange(ejec.id, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                    onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>Peso (kg)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={getFieldValue(ejec, 'peso_kg') ?? ''}
                                    onChange={(e) => handleChange(ejec.id, 'peso_kg', e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                    onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                  />
                                </div>
                              </>
                            )}

                            {(sesion.distancia_km !== null || sesion.duracion_min !== null) && (
                              <>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>Dist (km)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={getFieldValue(ejec, 'distancia_km') ?? ''}
                                    onChange={(e) => handleChange(ejec.id, 'distancia_km', e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                    onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>Dur (min)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={getFieldValue(ejec, 'duracion_min') ?? ''}
                                    onChange={(e) => handleChange(ejec.id, 'duracion_min', e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                    onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                    onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          {/* Sensacion pills + dolor + notas row */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs" style={{ color: '#555' }}>Sensación:</span>
                            {(['fácil', 'medio', 'intenso'] as SensacionLabel[]).map((label) => {
                              const isActive = sensacionLabel === label;
                              const val = label === 'fácil' ? 2 : label === 'medio' ? 3 : 5;
                              return (
                                <button
                                  key={label}
                                  onClick={() => handleChange(ejec.id, 'sensacion', isActive ? null : val)}
                                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all"
                                  style={
                                    isActive
                                      ? SENSACION_STYLE[label]
                                      : { background: '#2a2d36', color: '#555' }
                                  }
                                >
                                  {label}
                                </button>
                              );
                            })}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <input
                                type="checkbox"
                                id={`dolor-${ejec.id}`}
                                checked={(getFieldValue(ejec, 'dolor') ?? false) as boolean}
                                onChange={(e) => handleChange(ejec.id, 'dolor', e.target.checked)}
                                className="w-3.5 h-3.5 rounded cursor-pointer"
                                style={{ accentColor: '#e05050' }}
                              />
                              <label
                                htmlFor={`dolor-${ejec.id}`}
                                className="text-xs cursor-pointer"
                                style={{ color: '#e05050' }}
                              >
                                dolor
                              </label>
                            </div>
                          </div>

                          {/* Notas */}
                          <div className="mb-3">
                            <input
                              type="text"
                              value={(getFieldValue(ejec, 'notas') as string) ?? ''}
                              onChange={(e) => handleChange(ejec.id, 'notas', e.target.value || null)}
                              placeholder="Notas..."
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                              style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                              onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                              onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                            />
                          </div>

                          {/* Save button */}
                          {isDirty && (
                            <button
                              onClick={() => handleSave(ejec.id)}
                              disabled={isSaving}
                              className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
                              style={{
                                background: '#c4f135',
                                color: '#0f1117',
                                opacity: isSaving ? 0.7 : 1,
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {sortedDates.length === 0 && (
            <div className="text-center py-10" style={{ color: '#555' }}>
              No hay sesiones en esta semana
            </div>
          )}
        </div>
      )}
    </div>
  );
}
