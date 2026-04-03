'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Sesion, Ejecucion } from '@/db/schema';
import CsvUpload from '@/components/CsvUpload';
import WorkoutBuilder from '@/components/WorkoutBuilder';

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
  'fácil': { bg: 'var(--accent-bg)', color: 'var(--accent-dim)' },
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
  ritmo: string; // min/km — converted to duracion_min on save
}

const emptyPlanEdit = (): PlanEditState => ({
  ejercicio: '', categoria: '', series: '', reps: '', peso_kg: '', distancia_km: '', ritmo: '',
});

import { TIPO_COLORS, TIPOS, getDayColor } from '@/lib/tipo-colors';
import CategoriaSelect from '@/components/CategoriaSelect';

function inputStyle(focused: boolean = false) {
  return {
    background: 'var(--bg)',
    border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
    color: 'var(--text)',
  };
}

// ISO week helpers
function getISOWeek(d: Date): { week: number; year: number } {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return {
    week: 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
    year: date.getFullYear(),
  };
}

function getWeekDays(refDate: Date) {
  const dow = refDate.getDay();
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, label: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i], key: d.toISOString().slice(0, 10) };
  });
}

function formatWeekRange(days: { date: Date; key: string }[]) {
  const start = days[0].date;
  const end = days[6].date;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${months[end.getMonth()]}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

export default function SemanaPage() {
  const router = useRouter();
  const [semanas, setSemanas] = useState<SemanaInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SemanaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  // Week calendar navigation
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  // "No data" week actions
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [creatingWeek, setCreatingWeek] = useState(false);

  // Top-level "add exercise" for empty weeks (needs date picker)
  const [addingTopLevel, setAddingTopLevel] = useState(false);
  const [topAddForm, setTopAddForm] = useState<PlanEditState & { fecha: string }>({ ...emptyPlanEdit(), fecha: '' });
  const [savingTopAdd, setSavingTopAdd] = useState(false);

  // Execution edit state
  const [editState, setEditState] = useState<Record<number, Partial<Ejecucion>>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());

  // Plan edit state (sesion ID → form)
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState<PlanEditState>(emptyPlanEdit());
  const [savingPlan, setSavingPlan] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<string | null>(null);
  const [deletingDay, setDeletingDay] = useState<string | null>(null);

  // Add exercise state (fecha of day being added to, or null)
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<PlanEditState>(emptyPlanEdit());
  const [savingAdd, setSavingAdd] = useState(false);

  // Move day state
  const [movingDay, setMovingDay] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [savingMove, setSavingMove] = useState(false);

  const [builderDay, setBuilderDay] = useState<string | null>(null);

  // Orden state
  const [savingOrden, setSavingOrden] = useState<Set<number>>(new Set());

  // Ritmo input state for running executions (raw string per ejecucion id)
  const [execRitmoInput, setExecRitmoInput] = useState<Record<number, string>>({});

  // Refs for scrolling to days
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function load() {
      try {
        const semanasRes = await fetch('/api/semanas');
        if (!semanasRes.ok) { router.push('/login'); return; }
        const semanasData = await semanasRes.json();
        setSemanas(semanasData.semanas || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // When viewDate or semanas change, find matching semana and set selectedId
  useEffect(() => {
    const { week, year } = getISOWeek(viewDate);
    const found = semanas.find((s) => s.semana_numero === week && s.anio === year);
    setSelectedId(found ? found.id : null);
    setShowCsvUpload(false);
    setAddingTopLevel(false);
  }, [viewDate, semanas]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setOpenDays(new Set());
    setEditingPlan(null);
    setAddingToDay(null);
    fetch(`/api/semanas/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d);
        // All days collapsed by default — user opens manually
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  // ── Week navigation ───────────────────────────────────────────────────────────
  const weekDays = getWeekDays(viewDate);
  const { week: currentWeekNum, year: currentWeekYear } = getISOWeek(viewDate);
  const todayKey = new Date().toISOString().slice(0, 10);

  // Dates with exercises (from plan)
  const planDates = new Set((detail?.plan ?? []).map((s) => s.fecha));

  // Dates where all exercises are done
  const doneDates = new Set(
    Object.entries(
      (detail?.plan ?? []).reduce<Record<string, { total: number; done: number }>>((acc, s) => {
        if (!acc[s.fecha]) acc[s.fecha] = { total: 0, done: 0 };
        acc[s.fecha].total++;
        const ejec = detail?.ejecuciones.find((e) => e.sesion_id === s.id);
        if (ejec?.completado) acc[s.fecha].done++;
        return acc;
      }, {})
    )
      .filter(([, v]) => v.total > 0 && v.done === v.total)
      .map(([k]) => k)
  );

  function navigateWeek(dir: -1 | 1) {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d;
    });
  }

  function handleDayClick(key: string) {
    if (planDates.has(key)) {
      // Open that day accordion and scroll to it
      setOpenDays((prev) => { const n = new Set(prev); n.add(key); return n; });
      setTimeout(() => {
        dayRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  // ── Create week manually ─────────────────────────────────────────────────────
  async function handleCreateWeek() {
    setCreatingWeek(true);
    try {
      const res = await fetch('/api/semanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: currentWeekYear, semana_numero: currentWeekNum }),
      });
      if (!res.ok) throw new Error('Error al crear semana');
      const { semana } = await res.json();
      // Reload semanas list
      const semanasRes = await fetch('/api/semanas');
      const semanasData = await semanasRes.json();
      setSemanas(semanasData.semanas || []);
      setSelectedId(semana.id);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingWeek(false);
    }
  }

  // ── Execution handlers ────────────────────────────────────────────────────────
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
      // Clear ritmo input so display reverts to computed value from saved duracion_min
      setExecRitmoInput((prev) => { const n = { ...prev }; delete n[ejecucionId]; return n; });
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(ejecucionId); return n; });
    }
  }
  async function handleToggleCompletado(ejecucionId: number, current: boolean) {
    setSaving((prev) => new Set(prev).add(ejecucionId));
    try { await handleUpdate(ejecucionId, { completado: !current }); }
    finally { setSaving((prev) => { const n = new Set(prev); n.delete(ejecucionId); return n; }); }
  }

  // ── Plan edit handlers ────────────────────────────────────────────────────────
  function startEditPlan(sesion: Sesion) {
    setEditingPlan(sesion.id);
    setPlanForm({
      ejercicio: sesion.ejercicio,
      categoria: sesion.categoria ?? '',
      series: sesion.series?.toString() ?? '',
      reps: sesion.reps?.toString() ?? '',
      peso_kg: sesion.peso_kg?.toString() ?? '',
      distancia_km: sesion.distancia_km?.toString() ?? '',
      ritmo: (sesion.distancia_km && sesion.duracion_min && sesion.distancia_km > 0)
        ? (sesion.duracion_min / sesion.distancia_km).toFixed(2)
        : '',
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
          duracion_min: (planForm.distancia_km && planForm.ritmo)
            ? parseFloat(planForm.distancia_km) * parseFloat(planForm.ritmo)
            : null,
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

  // ── Delete handler ────────────────────────────────────────────────────────────
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

  async function handleDeleteDay(fecha: string) {
    setDeletingDay(fecha);
    try {
      await fetch(`/api/sesiones?fecha=${fecha}`, { method: 'DELETE' });
      setDetail((prev) => prev ? {
        ...prev,
        plan: prev.plan.filter((s) => s.fecha !== fecha),
        ejecuciones: prev.ejecuciones.filter((e) => e.fecha !== fecha),
      } : prev);
      setOpenDays((prev) => { const n = new Set(prev); n.delete(fecha); return n; });
      setConfirmDeleteDay(null);
    } finally {
      setDeletingDay(null);
    }
  }

  // ── Add exercise to existing day ──────────────────────────────────────────────
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
          duracion_min: (addForm.distancia_km && addForm.ritmo)
            ? parseFloat(addForm.distancia_km) * parseFloat(addForm.ritmo)
            : null,
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

  // ── Top-level add (for empty semana, needs date) ──────────────────────────────
  async function handleTopLevelAdd() {
    if (!topAddForm.ejercicio.trim() || !topAddForm.fecha || !selectedId) return;
    setSavingTopAdd(true);
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_id: selectedId,
          fecha: topAddForm.fecha,
          ejercicio: topAddForm.ejercicio,
          categoria: topAddForm.categoria || null,
          series: topAddForm.series ? parseInt(topAddForm.series) : null,
          reps: topAddForm.reps ? parseInt(topAddForm.reps) : null,
          peso_kg: topAddForm.peso_kg ? parseFloat(topAddForm.peso_kg) : null,
          distancia_km: topAddForm.distancia_km ? parseFloat(topAddForm.distancia_km) : null,
          duracion_min: (topAddForm.distancia_km && topAddForm.ritmo)
            ? parseFloat(topAddForm.distancia_km) * parseFloat(topAddForm.ritmo)
            : null,
        }),
      });
      if (!res.ok) throw new Error('Error al añadir');
      const { sesion, ejecucion } = await res.json();
      setDetail((prev) => prev ? { ...prev, plan: [...prev.plan, sesion], ejecuciones: [...prev.ejecuciones, ejecucion] } : prev);
      setOpenDays((prev) => new Set(prev).add(topAddForm.fecha));
      setAddingTopLevel(false);
      setTopAddForm({ ...emptyPlanEdit(), fecha: '' });
    } finally {
      setSavingTopAdd(false);
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

  async function handleMoveExercise(fecha: string, sesionId: number, direction: 'up' | 'down') {
    const dayExercises = [...(detail?.plan.filter((s) => s.fecha === fecha) ?? [])]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id);
    const idx = dayExercises.findIndex((s) => s.id === sesionId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === dayExercises.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const thisEl = dayExercises[idx];
    const swapEl = dayExercises[swapIdx];

    // Use target index as new orden so ties (all-zero defaults) are resolved
    const thisNewOrden = swapIdx;
    const swapNewOrden = idx;

    setSavingOrden((prev) => { const n = new Set(prev); n.add(thisEl.id); n.add(swapEl.id); return n; });
    try {
      await Promise.all([
        fetch(`/api/sesiones/${thisEl.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orden: thisNewOrden }) }),
        fetch(`/api/sesiones/${swapEl.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orden: swapNewOrden }) }),
      ]);
      setDetail((prev) => prev ? {
        ...prev,
        plan: prev.plan.map((s) => {
          if (s.id === thisEl.id) return { ...s, orden: thisNewOrden };
          if (s.id === swapEl.id) return { ...s, orden: swapNewOrden };
          return s;
        }),
      } : prev);
    } finally {
      setSavingOrden((prev) => { const n = new Set(prev); n.delete(thisEl.id); n.delete(swapEl.id); return n; });
    }
  }

  async function handleSetDayTipo(fecha: string, tipo: string) {
    const daySessions = detail?.plan.filter((s) => s.fecha === fecha) ?? [];
    const currentTipo = daySessions[0]?.tipo ?? null;
    const newTipo = currentTipo === tipo ? null : tipo;

    await Promise.all(daySessions.map((s) =>
      fetch(`/api/sesiones/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: newTipo }) })
    ));
    setDetail((prev) => prev ? {
      ...prev,
      plan: prev.plan.map((s) => s.fecha === fecha ? { ...s, tipo: newTipo } : s),
    } : prev);
  }

  function toggleDay(fecha: string) {
    setOpenDays((prev) => { const n = new Set(prev); n.has(fecha) ? n.delete(fecha) : n.add(fecha); return n; });
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--bg-card2)', width: '180px' }} />
        <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-card2)' }} />
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-card2)' }} />)}
      </div>
    );
  }

  const currentSemana = semanas.find((s) => s.id === selectedId);

  const byDate = (detail?.plan ?? []).reduce<Record<string, Sesion[]>>((acc, s) => {
    if (!acc[s.fecha]) acc[s.fecha] = [];
    acc[s.fecha].push(s);
    return acc;
  }, {});
  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id);
  }
  const sortedDates = Object.keys(byDate).sort();
  const weekRangeLabel = formatWeekRange(weekDays);
  const isEmptySemana = selectedId !== null && detail !== null && sortedDates.length === 0;
  const noDataWeek = selectedId === null;

  return (
    <div className="p-4" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-4 pt-2" style={{ color: 'var(--text)' }}>Semana</h1>

      {/* ── Week calendar strip ─────────────────────────────────────────────── */}
      <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg-card2)', border: '1px solid #2a2d36' }}>
        {/* Navigation row */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--border)' }}
            aria-label="Semana anterior"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--text-dim)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <div className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              Semana {currentWeekNum} · {currentWeekYear}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{weekRangeLabel}</div>
          </div>
          <button
            onClick={() => navigateWeek(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--border)' }}
            aria-label="Semana siguiente"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--text-dim)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day buttons */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ date, label, key }) => {
            const isToday = key === todayKey;
            const hasPlan = planDates.has(key);
            const isDone = doneDates.has(key);
            const dayNum = date.getDate();

            let bg = 'transparent';
            let textColor = 'var(--text-mute)';
            if (isToday) { bg = 'var(--accent)'; textColor = 'var(--bg)'; }
            else if (isDone) { bg = 'var(--accent-bg)'; textColor = 'var(--accent-dim)'; }
            else if (hasPlan) { textColor = 'var(--text)'; }

            return (
              <button
                key={key}
                onClick={() => handleDayClick(key)}
                className="flex flex-col items-center py-2 rounded-lg transition-colors"
                style={{ background: bg, cursor: hasPlan ? 'pointer' : 'default' }}
              >
                <span className="text-xs font-medium mb-1" style={{ color: isToday ? 'var(--bg)' : 'var(--text-dim)' }}>{label}</span>
                <span className="text-sm font-bold" style={{ color: textColor }}>{dayNum}</span>
                {/* Dot indicator */}
                <div className="h-1.5 mt-1 flex items-center justify-center">
                  {hasPlan && !isDone && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isToday ? 'var(--bg)' : 'var(--accent)' }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── No data week ──────────────────────────────────────────────────────── */}
      {noDataWeek && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card2)', border: '1px solid #2a2d36' }}>
          <p className="text-center text-sm mb-4" style={{ color: 'var(--text-dim)' }}>No hay entrenos esta semana</p>
          {showCsvUpload ? (
            <div>
              <CsvUpload
                onSuccess={(result) => {
                  // Reload semanas
                  fetch('/api/semanas').then(r => r.json()).then(d => {
                    setSemanas(d.semanas || []);
                    setSelectedId(result.semana.id);
                    setShowCsvUpload(false);
                  });
                }}
              />
              <button
                onClick={() => setShowCsvUpload(false)}
                className="mt-3 w-full py-2 rounded-lg text-sm"
                style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowCsvUpload(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--border)', color: 'var(--text)', border: '1px solid #3a3d46' }}
              >
                Subir CSV
              </button>
              <button
                onClick={handleCreateWeek}
                disabled={creatingWeek}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: creatingWeek ? 0.7 : 1 }}
              >
                {creatingWeek ? 'Creando...' : 'Programar manualmente'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Progress bar ──────────────────────────────────────────────────────── */}
      {currentSemana && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: 'var(--bg-card2)', border: '1px solid #2a2d36' }}>
          {currentSemana.foco && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              {currentSemana.foco}
            </span>
          )}
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
              <span>Progreso</span>
              <span style={{ color: 'var(--text)' }}>{currentSemana.completadas}/{currentSemana.totalSesiones}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: currentSemana.totalSesiones > 0 ? `${(currentSemana.completadas / currentSemana.totalSesiones) * 100}%` : '0%',
                  background: 'var(--accent)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Empty semana (created but no exercises yet) ────────────────────── */}
      {isEmptySemana && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card2)', border: '1px dashed #2a2d36' }}>
          <p className="text-center text-sm mb-4" style={{ color: 'var(--text-dim)' }}>Semana vacía — añade tu primer ejercicio</p>

          {addingTopLevel ? (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid #2a2d36' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--accent)' }}>Nuevo ejercicio</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>Fecha *</label>
                  <input
                    type="date"
                    value={topAddForm.fecha}
                    onChange={(e) => setTopAddForm((p) => ({ ...p, fecha: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ ...inputStyle(), colorScheme: 'dark' }}
                  />
                </div>
                <input
                  type="text"
                  value={topAddForm.ejercicio}
                  onChange={(e) => setTopAddForm((p) => ({ ...p, ejercicio: e.target.value }))}
                  placeholder="Ejercicio *"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={inputStyle()}
                  autoFocus
                />
                <CategoriaSelect
                  value={topAddForm.categoria}
                  onChange={(v) => setTopAddForm((p) => ({ ...p, categoria: v }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'series', label: 'Series' },
                    { key: 'reps', label: 'Reps' },
                    { key: 'peso_kg', label: 'Peso kg' },
                    { key: 'distancia_km', label: 'Dist km' },
                    { key: 'ritmo', label: 'Ritmo min/km' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
                      <input
                        type="number" min="0" step="0.05"
                        value={topAddForm[key as keyof PlanEditState]}
                        onChange={(e) => setTopAddForm((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                        style={inputStyle()}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleTopLevelAdd}
                    disabled={savingTopAdd || !topAddForm.ejercicio.trim() || !topAddForm.fecha}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: savingTopAdd ? 0.7 : 1 }}
                  >
                    {savingTopAdd ? 'Añadiendo...' : 'Añadir'}
                  </button>
                  <button
                    onClick={() => { setAddingTopLevel(false); setTopAddForm({ ...emptyPlanEdit(), fecha: '' }); }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingTopLevel(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Añadir ejercicio
            </button>
          )}
        </div>
      )}

      {/* ── Accordion ─────────────────────────────────────────────────────────── */}
      {loadingDetail ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-card2)' }} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Add new day to existing week */}
          {selectedId !== null && !isEmptySemana && (
            <div>
              {addingTopLevel ? (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-card2)', border: '1px solid #c4f13544' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--accent)' }}>Nuevo día de entreno</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>Fecha *</label>
                      <input
                        type="date"
                        value={topAddForm.fecha}
                        onChange={(e) => setTopAddForm((p) => ({ ...p, fecha: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)', colorScheme: 'dark' }}
                      />
                    </div>
                    <input
                      type="text"
                      value={topAddForm.ejercicio}
                      onChange={(e) => setTopAddForm((p) => ({ ...p, ejercicio: e.target.value }))}
                      placeholder="Ejercicio *"
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)' }}
                      autoFocus
                    />
                    <CategoriaSelect value={topAddForm.categoria} onChange={(v) => setTopAddForm((p) => ({ ...p, categoria: v }))} />
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'series', label: 'Series' },
                        { key: 'reps', label: 'Reps' },
                        { key: 'peso_kg', label: 'Peso kg' },
                        { key: 'distancia_km', label: 'Dist km' },
                        { key: 'ritmo', label: 'Ritmo min/km' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
                          <input
                            type="number" min="0" step="0.1"
                            value={topAddForm[key as keyof PlanEditState]}
                            onChange={(e) => setTopAddForm((p) => ({ ...p, [key]: e.target.value }))}
                            className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                            style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleTopLevelAdd}
                        disabled={savingTopAdd || !topAddForm.ejercicio.trim() || !topAddForm.fecha}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: savingTopAdd ? 0.7 : 1 }}
                      >
                        {savingTopAdd ? 'Añadiendo...' : 'Añadir'}
                      </button>
                      <button
                        onClick={() => { setAddingTopLevel(false); setTopAddForm({ ...emptyPlanEdit(), fecha: '' }); }}
                        className="px-4 py-2 rounded-lg text-sm"
                        style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTopLevel(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                  style={{ border: '1px dashed #2a2d36', color: 'var(--text-mute)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Añadir nuevo día de entreno
                </button>
              )}
            </div>
          )}

          {sortedDates.map((fecha) => {
            const sessions = byDate[fecha];
            const dayExercises = [...sessions].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id);
            const isOpen = openDays.has(fecha);
            const allEjecs = sessions.map((s) => getEjecucion(s.id)).filter(Boolean) as Ejecucion[];
            const doneCount = allEjecs.filter((e) => e.completado).length;
            const isToday = fecha === todayKey;
            const allDone = doneCount === sessions.length && sessions.length > 0;
            const dateLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            const isAddingHere = addingToDay === fecha;

            return (
              <div
                key={fecha}
                ref={(el) => { dayRefs.current[fecha] = el; }}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isToday ? 'var(--accent)' : allDone ? (getDayColor(sessions[0]?.tipo, sessions.map(x => x.categoria))?.color ?? 'var(--accent-border)') + '88' : 'var(--border)'}` }}
              >
                {/* Day header */}
                <div style={{ background: allDone ? (getDayColor(sessions[0]?.tipo, sessions.map(x => x.categoria))?.bg ?? 'var(--accent-bg)') : 'var(--bg-card2)' }}>
                  <button
                    onClick={() => toggleDay(fecha)}
                    className="w-full flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {isToday && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                      <span className="font-medium text-sm capitalize" style={{ color: allDone ? 'var(--accent-dim)' : 'var(--text)' }}>{dateLabel}</span>
                      {isToday && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>hoy</span>}
                      {(() => {
                        const s = getDayColor(sessions[0]?.tipo, sessions.map((x) => x.categoria));
                        const label = sessions[0]?.tipo ?? sessions.find((x) => x.categoria)?.categoria;
                        return s && label ? <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: s.bg, color: s.color }}>{label}</span> : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Workout builder button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setBuilderDay(fecha); }}
                        className="w-6 h-6 rounded flex items-center justify-center tap-scale"
                        style={{ background: 'transparent' }}
                        title="Añadir bloque EMOM/AMRAP/Circuito"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      {/* Delete day button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteDay(fecha); }}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: 'transparent' }}
                        title="Borrar día entero"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#e05050" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {/* Move day button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMovingDay(movingDay === fecha ? null : fecha); setMoveTarget(fecha); }}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: movingDay === fecha ? 'var(--accent-bg)' : 'transparent' }}
                        title="Cambiar día"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={movingDay === fecha ? 'var(--accent)' : 'var(--text-mute)'} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{doneCount}/{sessions.length}</span>
                      <svg className="w-4 h-4" style={{ color: 'var(--text-mute)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)', colorScheme: 'dark' }}
                      />
                      <button
                        onClick={() => handleMoveDay(fecha)}
                        disabled={savingMove || !moveTarget || moveTarget === fecha}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                        style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: savingMove ? 0.7 : 1 }}
                      >
                        {savingMove ? '...' : 'Mover'}
                      </button>
                      <button
                        onClick={() => setMovingDay(null)}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Exercise cards */}
                {isOpen && (
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {/* Tipo selector for this day */}
                    <div className="px-4 py-2 flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-card)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-mute)' }}>Tipo:</span>
                      {TIPOS.map((tipo) => {
                        const dayTipo = sessions[0]?.tipo ?? null;
                        const isActive = dayTipo === tipo;
                        const ts = TIPO_COLORS[tipo];
                        return (
                          <button
                            key={tipo}
                            onClick={() => handleSetDayTipo(fecha, tipo)}
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all"
                            style={isActive
                              ? { background: ts.bg, color: ts.color, border: `1px solid ${ts.color}` }
                              : { background: 'transparent', color: 'var(--text-mute)', border: '1px solid #2a2d36' }}
                          >
                            {tipo}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      // Group by bloque
                      const bloqueGroups: Array<{ bloque: string | null; tipo_bloque: string | null; exercises: typeof dayExercises }> = [];
                      const seenBloques = new Map<string, number>();
                      for (const sesion of dayExercises) {
                        const key = sesion.bloque ?? '__none__';
                        if (!seenBloques.has(key)) {
                          seenBloques.set(key, bloqueGroups.length);
                          bloqueGroups.push({ bloque: sesion.bloque ?? null, tipo_bloque: sesion.tipo_bloque ?? null, exercises: [] });
                        }
                        bloqueGroups[seenBloques.get(key)!].exercises.push(sesion);
                      }
                      return bloqueGroups.map((group, gi) => (
                        <div key={gi}>
                          {group.bloque && (
                            <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'var(--bg)', borderBottom: '1px solid #2a2d36' }}>
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{group.bloque}</span>
                              {group.tipo_bloque && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-dim)' }}>{group.tipo_bloque}</span>
                              )}
                            </div>
                          )}
                          {group.exercises.map((sesion) => {
                      const ejec = getEjecucion(sesion.id);
                      if (!ejec) return null;

                      const isSaving = saving.has(ejec.id);
                      const isDirty = Boolean(editState[ejec.id] && Object.keys(editState[ejec.id]).length > 0);
                      const completado = getFieldValue(ejec, 'completado') ?? false;
                      const sensacion = getFieldValue(ejec, 'sensacion');
                      const sensacionLabel = sensacion ? SENSACION_MAP[sensacion as number] : null;
                      const isEditingThis = editingPlan === sesion.id;
                      const isDeleting = deletingId === sesion.id;

                      const CARDIO_CATS = ['cardio', 'running', 'carrera', 'correr', 'trail', 'ciclismo', 'bici', 'natación', 'swim'];
                      const isRunning = !!(sesion.distancia_km && sesion.distancia_km > 0)
                        || CARDIO_CATS.some((c) => sesion.categoria?.toLowerCase().includes(c) || sesion.ejercicio.toLowerCase().includes(c));

                      const planRitmo = (sesion.distancia_km && sesion.duracion_min && sesion.distancia_km > 0)
                        ? sesion.duracion_min / sesion.distancia_km : null;
                      const planSummary = isRunning
                        ? [
                            sesion.distancia_km ? `${sesion.distancia_km} km` : null,
                            planRitmo ? `${Math.floor(planRitmo)}:${String(Math.round((planRitmo % 1) * 60)).padStart(2, '0')}/km` : null,
                          ].filter(Boolean).join(' · ')
                        : [
                            sesion.series && sesion.reps ? `${sesion.series}×${sesion.reps}` : null,
                            sesion.peso_kg ? `@${sesion.peso_kg}kg` : null,
                          ].filter(Boolean).join(' ');

                      const execDist = getFieldValue(ejec, 'distancia_km') as number | null;
                      const execDur = getFieldValue(ejec, 'duracion_min') as number | null;
                      const pace = execDist && execDur && execDist > 0 ? execDur / execDist : null;

                      // Ritmo input: use raw input if user is editing, else derive from stored values
                      const ritmoInputVal = execRitmoInput[ejec.id] !== undefined
                        ? execRitmoInput[ejec.id]
                        : (execDist && execDur && execDist > 0 ? (execDur / execDist).toFixed(2) : '');
                      const kmh = ritmoInputVal && parseFloat(ritmoInputVal) > 0
                        ? (60 / parseFloat(ritmoInputVal)).toFixed(1)
                        : null;

                      return (
                        <div key={sesion.id} className="px-4 py-4" style={{ background: completado ? '#162012' : 'var(--bg-card)' }}>

                          {/* Exercise header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{sesion.ejercicio}</p>
                              {sesion.categoria && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{sesion.categoria}</p>}
                              {planSummary && <p className="text-xs mt-1" style={{ color: 'var(--text-mute)' }}>Plan: {planSummary}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                              {/* Order up/down (only if multiple exercises on same day) */}
                              {dayExercises.length > 1 && (
                                <>
                                  <button
                                    onClick={() => handleMoveExercise(fecha, sesion.id, 'up')}
                                    disabled={savingOrden.has(sesion.id) || dayExercises[0].id === sesion.id}
                                    className="w-6 h-6 rounded flex items-center justify-center"
                                    style={{ opacity: dayExercises[0].id === sesion.id ? 0.2 : 1 }}
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="var(--text-dim)" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleMoveExercise(fecha, sesion.id, 'down')}
                                    disabled={savingOrden.has(sesion.id) || dayExercises[dayExercises.length - 1].id === sesion.id}
                                    className="w-6 h-6 rounded flex items-center justify-center"
                                    style={{ opacity: dayExercises[dayExercises.length - 1].id === sesion.id ? 0.2 : 1 }}
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="var(--text-dim)" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {/* Edit plan button */}
                              <button
                                onClick={() => isEditingThis ? setEditingPlan(null) : startEditPlan(sesion)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: isEditingThis ? 'var(--accent-bg)' : 'var(--border)' }}
                                title="Editar plan"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={isEditingThis ? 'var(--accent)' : 'var(--text-dim)'} strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => handleDelete(sesion.id)}
                                disabled={isDeleting}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: 'var(--border)' }}
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
                                style={{ background: completado ? '#2a4a12' : 'var(--border)' }}
                              >
                                {isSaving && !isDirty ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)"><circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" /><path className="opacity-75" fill="var(--text-dim)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={completado ? 'var(--accent-dim)' : 'var(--text-mute)'} strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Plan edit form */}
                          {isEditingThis && (
                            <div className="mb-3 p-3 rounded-xl" style={{ background: 'var(--accent-bg)', border: '1px solid #3a4a1a' }}>
                              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--accent)' }}>Editar plan</p>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={planForm.ejercicio}
                                  onChange={(e) => setPlanForm((p) => ({ ...p, ejercicio: e.target.value }))}
                                  placeholder="Ejercicio *"
                                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                                  style={inputStyle()}
                                />
                                <CategoriaSelect
                                  value={planForm.categoria}
                                  onChange={(v) => setPlanForm((p) => ({ ...p, categoria: v }))}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { key: 'series', label: 'Series' },
                                    { key: 'reps', label: 'Reps' },
                                    { key: 'peso_kg', label: 'Peso kg' },
                                  ].map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
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
                                    { key: 'ritmo', label: 'Ritmo min/km' },
                                  ].map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.05"
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
                                    style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: savingPlan ? 0.7 : 1 }}
                                  >
                                    {savingPlan ? 'Guardando...' : 'Guardar plan'}
                                  </button>
                                  <button
                                    onClick={() => setEditingPlan(null)}
                                    className="px-4 py-2 rounded-lg text-sm"
                                    style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Execution inputs */}
                          {isRunning ? (
                            <div className="mb-3">
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                {/* Distancia */}
                                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)', border: '1px solid #2a2d36' }}>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>Distancia</label>
                                  <input
                                    type="number" min="0" step="0.1"
                                    value={(getFieldValue(ejec, 'distancia_km') as string | number) ?? ''}
                                    onChange={(e) => {
                                      const dist = e.target.value ? parseFloat(e.target.value) : null;
                                      handleChange(ejec.id, 'distancia_km', dist);
                                      const ritmo = ritmoInputVal ? parseFloat(ritmoInputVal) : null;
                                      if (dist && ritmo && !isNaN(ritmo)) {
                                        handleChange(ejec.id, 'duracion_min', parseFloat((dist * ritmo).toFixed(2)));
                                      }
                                    }}
                                    className="w-full bg-transparent text-center text-2xl font-bold focus:outline-none"
                                    style={{ color: 'var(--text)' }}
                                  />
                                  <span className="text-xs" style={{ color: 'var(--text-mute)' }}>km</span>
                                </div>
                                {/* Ritmo */}
                                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)', border: '1px solid #2a2d36' }}>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>Ritmo</label>
                                  <input
                                    type="number" min="0" step="0.05"
                                    value={ritmoInputVal}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      setExecRitmoInput((prev) => ({ ...prev, [ejec.id]: raw }));
                                      const ritmo = raw ? parseFloat(raw) : null;
                                      const dist = execDist ?? (editState[ejec.id]?.distancia_km as number | undefined) ?? null;
                                      if (ritmo && dist && !isNaN(ritmo)) {
                                        handleChange(ejec.id, 'duracion_min', parseFloat((dist * ritmo).toFixed(2)));
                                      }
                                    }}
                                    className="w-full bg-transparent text-center text-2xl font-bold focus:outline-none"
                                    style={{ color: 'var(--text)' }}
                                  />
                                  <span className="text-xs" style={{ color: 'var(--text-mute)' }}>min/km</span>
                                  {kmh && <span className="text-xs block mt-0.5" style={{ color: 'var(--text-mute)' }}>{kmh} km/h</span>}
                                </div>
                              </div>
                              {pace && (
                                <div className="rounded-xl px-4 py-2 flex items-center justify-between" style={{ background: 'var(--accent-bg)', border: '1px solid #3a4a1a' }}>
                                  <span className="text-xs" style={{ color: 'var(--accent-dim)' }}>Guardado</span>
                                  <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                                    {Math.floor(pace)}:{String(Math.round((pace % 1) * 60)).padStart(2, '0')} min/km · {(60 / pace).toFixed(1)} km/h
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {[
                                { field: 'series' as keyof Ejecucion, label: 'Series', step: '1' },
                                { field: 'reps' as keyof Ejecucion, label: 'Reps', step: '1' },
                                { field: 'peso_kg' as keyof Ejecucion, label: 'Peso (kg)', step: '0.5' },
                              ].map(({ field, label, step }) => (
                                <div key={field}>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
                                  <input
                                    type="number" min="0" step={step}
                                    value={(getFieldValue(ejec, field) as string | number) ?? ''}
                                    onChange={(e) => handleChange(ejec.id, field, e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full px-2 py-1.5 rounded-lg text-center text-sm focus:outline-none"
                                    style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)' }}
                                    onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Sensacion + dolor */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs" style={{ color: 'var(--text-mute)' }}>Sensación:</span>
                            {(['fácil', 'medio', 'intenso'] as SensacionLabel[]).map((label) => {
                              const isActive = sensacionLabel === label;
                              const val = label === 'fácil' ? 2 : label === 'medio' ? 3 : 5;
                              return (
                                <button
                                  key={label}
                                  onClick={() => handleChange(ejec.id, 'sensacion', isActive ? null : val)}
                                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all"
                                  style={isActive ? SENSACION_STYLE[label] : { background: 'var(--border)', color: 'var(--text-mute)' }}
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
                              style={{ background: 'var(--bg)', border: '1px solid #2a2d36', color: 'var(--text)' }}
                              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                            />
                          </div>

                          {isDirty && (
                            <button
                              onClick={() => handleSave(ejec.id)}
                              disabled={isSaving}
                              className="w-full py-2 rounded-lg text-sm font-semibold"
                              style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: isSaving ? 0.7 : 1 }}
                            >
                              {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      );
                          })}
                        </div>
                      ));
                    })()}

                    {/* Add exercise section */}
                    <div className="px-4 py-3" style={{ background: 'var(--bg)' }}>
                      {isAddingHere ? (
                        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-card2)', border: '1px solid #2a2d36' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-dim)' }}>Añadir ejercicio</p>
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
                            <CategoriaSelect
                              value={addForm.categoria}
                              onChange={(v) => setAddForm((p) => ({ ...p, categoria: v }))}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { key: 'series', label: 'Series' },
                                { key: 'reps', label: 'Reps' },
                                { key: 'peso_kg', label: 'Peso kg' },
                                { key: 'distancia_km', label: 'Dist km' },
                                { key: 'ritmo', label: 'Ritmo min/km' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--text-mute)' }}>{label}</label>
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
                                style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: savingAdd ? 0.7 : 1 }}
                              >
                                {savingAdd ? 'Añadiendo...' : 'Añadir'}
                              </button>
                              <button
                                onClick={() => { setAddingToDay(null); setAddForm(emptyPlanEdit()); }}
                                className="px-4 py-2 rounded-lg text-sm"
                                style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
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
                          style={{ border: '1px dashed #2a2d36', color: 'var(--text-mute)' }}
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
        </div>
      )}

      {/* Confirm delete day modal */}
      {confirmDeleteDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setConfirmDeleteDay(null)}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full"
            style={{ background: 'var(--bg-card2)', border: '1px solid #2a2d36' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Borrar día entero</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-dim)' }}>
              Se eliminarán todos los ejercicios del{' '}
              <span style={{ color: 'var(--text)' }}>
                {new Date(confirmDeleteDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteDay(null)}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--border)', color: 'var(--text-dim)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteDay(confirmDeleteDay)}
                disabled={deletingDay === confirmDeleteDay}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#e05050', color: '#fff', opacity: deletingDay === confirmDeleteDay ? 0.7 : 1 }}
              >
                {deletingDay === confirmDeleteDay ? 'Borrando...' : 'Borrar día'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Builder fullscreen modal */}
      {builderDay && detail && (
        <WorkoutBuilder
          semanaId={detail.semana.id}
          fecha={builderDay}
          onClose={() => setBuilderDay(null)}
          onSuccess={() => {
            setBuilderDay(null);
            fetch(`/api/semanas/${detail.semana.id}`)
              .then((r) => r.json())
              .then(setDetail);
          }}
        />
      )}
    </div>
  );
}
