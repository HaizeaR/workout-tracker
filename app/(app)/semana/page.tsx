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

const SENSACION_MAP: Record<number, SensacionLabel> = { 1: 'fácil', 2: 'fácil', 3: 'medio', 4: 'intenso', 5: 'intenso' };
const SENSACION_STYLE: Record<SensacionLabel, { bg: string; color: string }> = {
  'fácil': { bg: '#1e2d0e', color: '#8ab030' },
  'medio': { bg: '#2d2a0e', color: '#c4a030' },
  'intenso': { bg: '#2d1010', color: '#e05050' },
};

interface PlanEditState {
  ejercicio: string;
  categoria: string;
  series: string;
  reps: string;
  peso_kg: string;
  distancia_km: string;
  duracion_min: string;
}

const emptyPlanEdit = (): PlanEditState => ({
  ejercicio: '', categoria: '', series: '', reps: '', peso_kg: '', distancia_km: '', duracion_min: '',
});

function inputStyle(focused: boolean = false) {
  return {
    background: '#111',
    border: `1px solid ${focused ? '#c4f135' : '#2a2d36'}`,
    color: '#f0f0f0',
  };
}

export default function SemanaPage() {
  const router = useRouter();
  const [semanas, setSemanas] = useState<SemanaInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SemanaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  // Execution edit state
  const [editState, setEditState] = useState<Record<number, Partial<Ejecucion>>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());

  // Plan edit state (sesion ID → form)
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState<PlanEditState>(emptyPlanEdit());
  const [savingPlan, setSavingPlan] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Add exercise state (fecha of day being added to, or null)
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<PlanEditState>(emptyPlanEdit());
  const [savingAdd, setSavingAdd] = useState(false);

  // Move day state
  const [movingDay, setMovingDay] = useState<string | null>(null); // fecha being moved
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [savingMove, setSavingMove] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const semanasRes = await fetch('/api/semanas');
        if (!semanasRes.ok) { router.push('/login'); return; }
        const semanasData = await semanasRes.json();
        setSemanas(semanasData.semanas || []);
        if (semanasData.semanas?.length > 0) setSelectedId(semanasData.semanas[0].id);
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
    setEditingPlan(null);
    setAddingToDay(null);
    fetch(`/api/semanas/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d);
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

  // ── Execution handlers ──────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (ejecucionId: number, updates: Partial<Ejecucion>) => {
    const res = await fetch(`/api/ejecuciones/${ejecucionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');
    const { ejecucion: updated } = await res.json();
    setDetail((prev) => prev ? { ...prev, ejecuciones: prev.ejecuciones.map((e) => e.id === ejecucionId ? { ...e, ...updated } : e) } : prev);
  }, []);

  function getEjecucion(sesionId: number) { return detail?.ejecuciones.find((e) => e.sesion_id === sesionId); }
  function getFieldValue<K extends keyof Ejecucion>(ejec: Ejecucion, field: K) {
    const ed = editState[ejec.id];
    return ed && field in ed ? ed[field] as Ejecucion[K] : ejec[field];
  }
  function handleChange(ejecucionId: number, field: keyof Ejecucion, value: unknown) {
    setEditState((prev) => ({ ...prev, [ejecucionId]: { ...prev[ejecucionId], [field]: value } }));
  }
  async function handleSave(ejecucionId: number) {
    const updates = editState[ejecucionId];
    if (!updates) return;
    setSaving((prev) => new Set(prev).add(ejecucionId));
    try {
      await handleUpdate(ejecucionId, updates);
      setEditState((prev) => { const n = { ...prev }; delete n[ejecucionId]; return n; });
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(ejecucionId); return n; });
    }
  }
  async function handleToggleCompletado(ejecucionId: number, current: boolean) {
    setSaving((prev) => new Set(prev).add(ejecucionId));
    try { await handleUpdate(ejecucionId, { completado: !current }); }
    finally { setSaving((prev) => { const n = new Set(prev); n.delete(ejecucionId); return n; }); }
  }

  // ── Plan edit handlers ───────────────────────────────────────────────────────
  function startEditPlan(sesion: Sesion) {
    setEditingPlan(sesion.id);
    setPlanForm({
      ejercicio: sesion.ejercicio,
      categoria: sesion.categoria ?? '',
      series: sesion.series?.toString() ?? '',
      reps: sesion.reps?.toString() ?? '',
      peso_kg: sesion.peso_kg?.toString() ?? '',
      distancia_km: sesion.distancia_km?.toString() ?? '',
      duracion_min: sesion.duracion_min?.toString() ?? '',
    });
  }

  async function handleSavePlan(sesionId: number) {
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/sesiones/${sesionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ejercicio: planForm.ejercicio,
          categoria: planForm.categoria || null,
          series: planForm.series ? parseInt(planForm.series) : null,
          reps: planForm.reps ? parseInt(planForm.reps) : null,
          peso_kg: planForm.peso_kg ? parseFloat(planForm.peso_kg) : null,
          distancia_km: planForm.distancia_km ? parseFloat(planForm.distancia_km) : null,
          duracion_min: planForm.duracion_min ? parseFloat(planForm.duracion_min) : null,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const { sesion: updated } = await res.json();
      setDetail((prev) => prev ? { ...prev, plan: prev.plan.map((s) => s.id === sesionId ? { ...s, ...updated } : s) } : prev);
      setEditingPlan(null);
    } finally {
      setSavingPlan(false);
    }
  }

  // ── Delete handler ───────────────────────────────────────────────────────────
  async function handleDelete(sesionId: number) {
    setDeletingId(sesionId);
    try {
      await fetch(`/api/sesiones/${sesionId}`, { method: 'DELETE' });
      setDetail((prev) => prev ? {
        ...prev,
        plan: prev.plan.filter((s) => s.id !== sesionId),
        ejecuciones: prev.ejecuciones.filter((e) => e.sesion_id !== sesionId),
      } : prev);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Add exercise handler ─────────────────────────────────────────────────────
  async function handleAddExercise(fecha: string) {
    if (!addForm.ejercicio.trim() || !selectedId) return;
    setSavingAdd(true);
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_id: selectedId,
          fecha,
          ejercicio: addForm.ejercicio,
          categoria: addForm.categoria || null,
          series: addForm.series ? parseInt(addForm.series) : null,
          reps: addForm.reps ? parseInt(addForm.reps) : null,
          peso_kg: addForm.peso_kg ? parseFloat(addForm.peso_kg) : null,
          distancia_km: addForm.distancia_km ? parseFloat(addForm.distancia_km) : null,
          duracion_min: addForm.duracion_min ? parseFloat(addForm.duracion_min) : null,
        }),
      });
      if (!res.ok) throw new Error('Error al añadir');
      const { sesion, ejecucion } = await res.json();
      setDetail((prev) => prev ? { ...prev, plan: [...prev.plan, sesion], ejecuciones: [...prev.ejecuciones, ejecucion] } : prev);
      setAddingToDay(null);
      setAddForm(emptyPlanEdit());
    } finally {
      setSavingAdd(false);
    }
  }

  async function handleMoveDay(oldFecha: string) {
    if (!moveTarget || moveTarget === oldFecha) { setMovingDay(null); return; }
    const sessions = detail?.plan.filter((s) => s.fecha === oldFecha);
    if (!sessions?.length) { setMovingDay(null); return; }
    setSavingMove(true);
    try {
      await Promise.all(sessions.map((s) =>
        fetch(`/api/sesiones/${s.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha: moveTarget }),
        })
      ));
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: prev.plan.map((s) => s.fecha === oldFecha ? { ...s, fecha: moveTarget } : s),
          ejecuciones: prev.ejecuciones.map((e) => {
            const isInDay = sessions.some((s) => s.id === e.sesion_id);
            return isInDay ? { ...e, fecha: moveTarget } : e;
          }),
        };
      });
      setOpenDays((prev) => { const n = new Set(prev); n.delete(oldFecha); n.add(moveTarget); return n; });
      setMovingDay(null);
    } finally {
      setSavingMove(false);
    }
  }

  function toggleDay(fecha: string) {
    setOpenDays((prev) => { const n = new Set(prev); n.has(fecha) ? n.delete(fecha) : n.add(fecha); return n; });
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4" style={{ background: '#0f1117', minHeight: '100vh' }}>
        <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1d24', width: '180px' }} />
        <div className="h-12 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />)}
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
          style={{ background: '#1a1d24', border: '1px solid #2a2d36', color: '#f0f0f0' }}
        >
          {semanas.map((s) => (
            <option key={s.id} value={s.id} style={{ background: '#1a1d24' }}>
              Semana {s.semana_numero} — {s.anio}{s.foco ? ` · ${s.foco}` : ''} ({s.completadas}/{s.totalSesiones})
            </option>
          ))}
        </select>
      </div>

      {/* Progress bar */}
      {currentSemana && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
          {currentSemana.foco && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: '#2a3a0e', color: '#c4f135' }}>
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
                  width: currentSemana.totalSesiones > 0 ? `${(currentSemana.completadas / currentSemana.totalSesiones) * 100}%` : '0%',
                  background: '#c4f135',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Accordion */}
      {loadingDetail ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#1a1d24' }} />)}
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
            const dateLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            const isAddingHere = addingToDay === fecha;

            return (
              <div key={fecha} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${isToday ? '#c4f135' : allDone ? '#3a5a1a' : '#2a2d36'}` }}>
                {/* Day header */}
                <div style={{ background: allDone ? '#1e2d0e' : '#1a1d24' }}>
                  <button
                    onClick={() => toggleDay(fecha)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {isToday && <span className="w-2 h-2 rounded-full" style={{ background: '#c4f135' }} />}
                      <span className="font-medium text-sm capitalize" style={{ color: allDone ? '#8ab030' : '#f0f0f0' }}>{dateLabel}</span>
                      {isToday && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#c4f135', color: '#0f1117' }}>hoy</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Move day button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMovingDay(movingDay === fecha ? null : fecha); setMoveTarget(fecha); }}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: movingDay === fecha ? '#2a3a0e' : 'transparent' }}
                        title="Cambiar día"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={movingDay === fecha ? '#c4f135' : '#555'} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <span className="text-xs" style={{ color: '#888' }}>{doneCount}/{sessions.length}</span>
                      <svg className="w-4 h-4" style={{ color: '#555', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Move day picker */}
                  {movingDay === fecha && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <input
                        type="date"
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                        style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0', colorScheme: 'dark' }}
                      />
                      <button
                        onClick={() => handleMoveDay(fecha)}
                        disabled={savingMove || !moveTarget || moveTarget === fecha}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                        style={{ background: '#c4f135', color: '#0f1117', opacity: savingMove ? 0.7 : 1 }}
                      >
                        {savingMove ? '...' : 'Mover'}
                      </button>
                      <button
                        onClick={() => setMovingDay(null)}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: '#2a2d36', color: '#888' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

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
                      const sensacionLabel = sensacion ? SENSACION_MAP[sensacion as number] : null;
                      const isEditingThis = editingPlan === sesion.id;
                      const isDeleting = deletingId === sesion.id;

                      const planSummary = [
                        sesion.series && sesion.reps ? `${sesion.series}×${sesion.reps}` : null,
                        sesion.peso_kg ? `@${sesion.peso_kg}kg` : null,
                        sesion.distancia_km ? `${sesion.distancia_km}km` : null,
                        sesion.duracion_min ? `${sesion.duracion_min}min` : null,
                      ].filter(Boolean).join(' ');

                      return (
                        <div key={sesion.id} className="px-4 py-4" style={{ background: completado ? '#162012' : '#111720' }}>

                          {/* Exercise header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm" style={{ color: '#f0f0f0' }}>{sesion.ejercicio}</p>
                              {sesion.categoria && <p className="text-xs mt-0.5" style={{ color: '#888' }}>{sesion.categoria}</p>}
                              {planSummary && <p className="text-xs mt-1" style={{ color: '#555' }}>Plan: {planSummary}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                              {/* Edit plan button */}
                              <button
                                onClick={() => isEditingThis ? setEditingPlan(null) : startEditPlan(sesion)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: isEditingThis ? '#2a3a0e' : '#2a2d36' }}
                                title="Editar plan"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={isEditingThis ? '#c4f135' : '#888'} strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => handleDelete(sesion.id)}
                                disabled={isDeleting}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: '#2a2d36' }}
                                title="Eliminar ejercicio"
                              >
                                {isDeleting ? (
                                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#e05050"><circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" /><path className="opacity-75" fill="#e05050" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#e05050" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                              {/* Complete button */}
                              <button
                                onClick={() => handleToggleCompletado(ejec.id, completado as boolean)}
                                disabled={isSaving}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                style={{ background: completado ? '#2a4a12' : '#2a2d36' }}
                              >
                                {isSaving && !isDirty ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#888"><circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" /><path className="opacity-75" fill="#888" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={completado ? '#8ab030' : '#555'} strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Plan edit form */}
                          {isEditingThis && (
                            <div className="mb-3 p-3 rounded-xl" style={{ background: '#1a2010', border: '1px solid #3a4a1a' }}>
                              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#c4f135' }}>Editar plan</p>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={planForm.ejercicio}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, ejercicio: e.target.value }))}
                                  placeholder="Ejercicio *"
                                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                                  style={inputStyle()}
                                />
                                <input
                                  type="text"
                                  value={planForm.categoria}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, categoria: e.target.value }))}
                                  placeholder="Categoría"
                                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                                  style={inputStyle()}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { key: 'series', label: 'Series' },
                                    { key: 'reps', label: 'Reps' },
                                    { key: 'peso_kg', label: 'Peso kg' },
                                  ].map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="block text-xs mb-1" style={{ color: '#555' }}>{label}</label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={planForm[key as keyof PlanEditState]}
                                        onChange={(e) => setPlanForm((p) => ({ ...p, [key]: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                        style={inputStyle()}
                                      />
                                    </div>
                                  ))}
                                  {[
                                    { key: 'distancia_km', label: 'Dist km' },
                                    { key: 'duracion_min', label: 'Dur min' },
                                  ].map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="block text-xs mb-1" style={{ color: '#555' }}>{label}</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={planForm[key as keyof PlanEditState]}
                                        onChange={(e) => setPlanForm((p) => ({ ...p, [key]: e.target.value }))}
                                        className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                        style={inputStyle()}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => handleSavePlan(sesion.id)}
                                    disabled={savingPlan || !planForm.ejercicio.trim()}
                                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                                    style={{ background: '#c4f135', color: '#0f1117', opacity: savingPlan ? 0.7 : 1 }}
                                  >
                                    {savingPlan ? 'Guardando...' : 'Guardar plan'}
                                  </button>
                                  <button
                                    onClick={() => setEditingPlan(null)}
                                    className="px-4 py-2 rounded-lg text-sm"
                                    style={{ background: '#2a2d36', color: '#888' }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Execution inputs */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {(sesion.series !== null || sesion.reps !== null || sesion.peso_kg !== null) && (
                              <>
                                {[
                                  { field: 'series' as keyof Ejecucion, label: 'Series', step: '1' },
                                  { field: 'reps' as keyof Ejecucion, label: 'Reps', step: '1' },
                                  { field: 'peso_kg' as keyof Ejecucion, label: 'Peso (kg)', step: '0.5' },
                                ].map(({ field, label, step }) => (
                                  <div key={field}>
                                    <label className="block text-xs mb-1" style={{ color: '#555' }}>{label}</label>
                                    <input
                                      type="number" min="0" step={step}
                                      value={(getFieldValue(ejec, field) as string | number) ?? ''}
                                      onChange={(e) => handleChange(ejec.id, field, e.target.value ? parseFloat(e.target.value) : null)}
                                      className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                      style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                      onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                      onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                    />
                                  </div>
                                ))}
                              </>
                            )}
                            {(sesion.distancia_km !== null || sesion.duracion_min !== null) && (
                              <>
                                {[
                                  { field: 'distancia_km' as keyof Ejecucion, label: 'Dist (km)', step: '0.1' },
                                  { field: 'duracion_min' as keyof Ejecucion, label: 'Dur (min)', step: '1' },
                                ].map(({ field, label, step }) => (
                                  <div key={field}>
                                    <label className="block text-xs mb-1" style={{ color: '#555' }}>{label}</label>
                                    <input
                                      type="number" min="0" step={step}
                                      value={(getFieldValue(ejec, field) as string | number) ?? ''}
                                      onChange={(e) => handleChange(ejec.id, field, e.target.value ? parseFloat(e.target.value) : null)}
                                      className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                      style={{ background: '#111', border: '1px solid #2a2d36', color: '#f0f0f0' }}
                                      onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
                                      onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
                                    />
                                  </div>
                                ))}
                              </>
                            )}
                          </div>

                          {/* Sensacion + dolor */}
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
                                  style={isActive ? SENSACION_STYLE[label] : { background: '#2a2d36', color: '#555' }}
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
                              <label htmlFor={`dolor-${ejec.id}`} className="text-xs cursor-pointer" style={{ color: '#e05050' }}>dolor</label>
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

                          {isDirty && (
                            <button
                              onClick={() => handleSave(ejec.id)}
                              disabled={isSaving}
                              className="w-full py-2 rounded-lg text-sm font-semibold"
                              style={{ background: '#c4f135', color: '#0f1117', opacity: isSaving ? 0.7 : 1 }}
                            >
                              {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Add exercise section */}
                    <div className="px-4 py-3" style={{ background: '#0f1117' }}>
                      {isAddingHere ? (
                        <div className="p-3 rounded-xl" style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>Añadir ejercicio</p>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={addForm.ejercicio}
                              onChange={(e) => setAddForm((p) => ({ ...p, ejercicio: e.target.value }))}
                              placeholder="Ejercicio *"
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                              style={inputStyle()}
                              autoFocus
                            />
                            <input
                              type="text"
                              value={addForm.categoria}
                              onChange={(e) => setAddForm((p) => ({ ...p, categoria: e.target.value }))}
                              placeholder="Categoría"
                              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                              style={inputStyle()}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { key: 'series', label: 'Series' },
                                { key: 'reps', label: 'Reps' },
                                { key: 'peso_kg', label: 'Peso kg' },
                                { key: 'distancia_km', label: 'Dist km' },
                                { key: 'duracion_min', label: 'Dur min' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="block text-xs mb-1" style={{ color: '#555' }}>{label}</label>
                                  <input
                                    type="number" min="0" step="0.1"
                                    value={addForm[key as keyof PlanEditState]}
                                    onChange={(e) => setAddForm((p) => ({ ...p, [key]: e.target.value }))}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={inputStyle()}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleAddExercise(fecha)}
                                disabled={savingAdd || !addForm.ejercicio.trim()}
                                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                                style={{ background: '#c4f135', color: '#0f1117', opacity: savingAdd ? 0.7 : 1 }}
                              >
                                {savingAdd ? 'Añadiendo...' : 'Añadir'}
                              </button>
                              <button
                                onClick={() => { setAddingToDay(null); setAddForm(emptyPlanEdit()); }}
                                className="px-4 py-2 rounded-lg text-sm"
                                style={{ background: '#2a2d36', color: '#888' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingToDay(fecha); setAddForm(emptyPlanEdit()); }}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors"
                          style={{ border: '1px dashed #2a2d36', color: '#555' }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Añadir ejercicio
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sortedDates.length === 0 && (
            <div className="text-center py-10" style={{ color: '#555' }}>No hay sesiones en esta semana</div>
          )}
        </div>
      )}
    </div>
  );
}
