'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { TIPOS, CATEGORIAS } from '@/lib/tipo-colors';
import CategoriaSelect from './CategoriaSelect';

type TipoBloque = 'emom' | 'amrap' | 'circuito' | 'series' | 'libre';

const BLOQUE_INFO: Record<TipoBloque, { label: string; desc: string; roundsLabel: string; color: string }> = {
  emom:     { label: 'EMOM',     desc: 'Every Minute On the Minute',      roundsLabel: 'Minutos',  color: '#fb923c' },
  amrap:    { label: 'AMRAP',    desc: 'As Many Rounds As Possible',      roundsLabel: 'Duración', color: '#60a5fa' },
  circuito: { label: 'Circuito', desc: 'Rondas de ejercicios en secuencia', roundsLabel: 'Rondas', color: '#c4f135' },
  series:   { label: 'Series',   desc: 'Ejercicios con series × reps',    roundsLabel: 'Series',   color: '#4ade80' },
  libre:    { label: 'Libre',    desc: 'Formato personalizado',           roundsLabel: 'Rondas',   color: '#c084fc' },
};

interface EjBloque {
  ejercicio: string;
  reps: string;
  peso_kg: string;
  distancia_km: string;
  categoria: string;
  notas: string;
}

interface Props {
  semanaId: number;
  fecha: string;
  onSuccess: () => void;
  onClose: () => void;
}

const emptyEj = (): EjBloque => ({ ejercicio: '', reps: '', peso_kg: '', distancia_km: '', categoria: '', notas: '' });

export default function WorkoutBuilder({ semanaId, fecha, onSuccess, onClose }: Props) {
  const { c } = useTheme();
  const [tipo, setTipo] = useState<TipoBloque>('circuito');
  const [nombre, setNombre] = useState('');
  const [rounds, setRounds] = useState('3');
  const [duracion, setDuracion] = useState('');
  const [tipoEntreno, setTipoEntreno] = useState('');
  const [ejercicios, setEjercicios] = useState<EjBloque[]>([emptyEj(), emptyEj(), emptyEj()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dateLabel = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const info = BLOQUE_INFO[tipo];
  const validEjercicios = ejercicios.filter((e) => e.ejercicio.trim());

  function addEj() { setEjercicios((p) => [...p, emptyEj()]); }
  function removeEj(i: number) { setEjercicios((p) => p.filter((_, idx) => idx !== i)); }
  function updateEj(i: number, field: keyof EjBloque, val: string) {
    setEjercicios((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('Ponle un nombre al bloque'); return; }
    if (validEjercicios.length === 0) { setError('Añade al menos un ejercicio'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/bloques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana_id: semanaId,
          fecha,
          bloque: nombre.trim(),
          tipo_bloque: tipo,
          rounds: rounds ? parseInt(rounds) : null,
          duracion_min: duracion ? parseFloat(duracion) : null,
          tipo: tipoEntreno || null,
          ejercicios: validEjercicios.map((e) => ({
            ejercicio: e.ejercicio.trim(),
            reps: e.reps ? parseInt(e.reps) : null,
            peso_kg: e.peso_kg ? parseFloat(e.peso_kg) : null,
            distancia_km: e.distancia_km ? parseFloat(e.distancia_km) : null,
            categoria: e.categoria || null,
            notas: e.notas || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      onSuccess();
    } catch { setError('Error de conexión'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col animate-fade-in" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-mute)' }}>Nuevo bloque</p>
          <p className="text-lg font-bold capitalize mt-0.5" style={{ color: 'var(--text)' }}>{dateLabel}</p>
        </div>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center tap-scale"
          style={{ background: 'var(--bg-card2)', color: 'var(--text-dim)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-32">

        {/* ── Tipo de bloque ─────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-mute)' }}>
            Tipo de bloque
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.entries(BLOQUE_INFO) as [TipoBloque, typeof BLOQUE_INFO[TipoBloque]][]).map(([key, inf]) => (
              <button key={key} onClick={() => setTipo(key)}
                className="py-2.5 rounded-xl text-center tap-scale flex flex-col items-center gap-0.5"
                style={tipo === key
                  ? { background: inf.color + (key === 'circuito' ? '' : '22'), border: `2px solid ${inf.color}`, color: key === 'circuito' ? '#0c0e14' : inf.color }
                  : { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                <span className="text-[11px] font-bold">{inf.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-mute)' }}>{info.desc}</p>
        </div>

        {/* ── Nombre + configuración ─────────────────── */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-mute)' }}>
              Nombre del bloque
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === 'emom' ? 'EMOM 10min' : tipo === 'amrap' ? 'AMRAP 12min' : tipo === 'circuito' ? 'Circuito A' : 'Bloque 1'}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-mute)' }}>
                {info.roundsLabel}
              </label>
              <input type="number" value={rounds} onChange={(e) => setRounds(e.target.value)}
                placeholder="3" min="1"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-center"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
            </div>
            {(tipo === 'amrap' || tipo === 'emom') && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-mute)' }}>
                  Duración (min)
                </label>
                <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)}
                  placeholder="12"
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-center"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
              </div>
            )}
          </div>

          {/* Tipo entreno */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--text-mute)' }}>
              Tipo de entreno
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button key={t} onClick={() => setTipoEntreno(tipoEntreno === t ? '' : t)}
                  className="px-3 py-1 rounded-full text-xs font-bold tap-scale"
                  style={tipoEntreno === t
                    ? { background: 'var(--accent)', color: '#0c0e14' }
                    : { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Ejercicios ─────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-mute)' }}>
              Ejercicios del bloque
            </p>
            {rounds && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: info.color + '22', color: info.color }}>
                {rounds} × {validEjercicios.length} ejercicios
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {ejercicios.map((ej, i) => (
              <div key={i} className="rounded-2xl p-3 space-y-2.5 glow-card"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                {/* Exercise name row */}
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: ej.ejercicio.trim() ? info.color : 'var(--border)', color: ej.ejercicio.trim() ? '#0c0e14' : 'var(--text-mute)' }}>
                    {i + 1}
                  </span>
                  <input
                    value={ej.ejercicio}
                    onChange={(e) => updateEj(i, 'ejercicio', e.target.value)}
                    placeholder={`Ejercicio ${i + 1}`}
                    className="flex-1 text-sm font-semibold bg-transparent outline-none"
                    style={{ color: 'var(--text)' }}
                  />
                  {ejercicios.length > 1 && (
                    <button onClick={() => removeEj(i)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 tap-scale"
                      style={{ background: 'var(--bg-card2)', color: 'var(--text-mute)' }}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide mb-1 text-center" style={{ color: 'var(--text-mute)' }}>Reps</p>
                    <input type="number" value={ej.reps} onChange={(e) => updateEj(i, 'reps', e.target.value)}
                      placeholder="10"
                      className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-center"
                      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide mb-1 text-center" style={{ color: 'var(--text-mute)' }}>kg</p>
                    <input type="number" value={ej.peso_kg} onChange={(e) => updateEj(i, 'peso_kg', e.target.value)}
                      placeholder="—"
                      className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-center"
                      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide mb-1 text-center" style={{ color: 'var(--text-mute)' }}>km</p>
                    <input type="number" value={ej.distancia_km} onChange={(e) => updateEj(i, 'distancia_km', e.target.value)}
                      placeholder="—"
                      className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-center"
                      style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                  </div>
                </div>

                {/* Category */}
                <CategoriaSelect
                  value={ej.categoria}
                  onChange={(v) => updateEj(i, 'categoria', v)}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          <button onClick={addEj}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 tap-scale"
            style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', color: 'var(--text-dim)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Añadir ejercicio
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(224,80,80,0.1)', color: '#e05050', border: '1px solid rgba(224,80,80,0.2)' }}>
            {error}
          </div>
        )}
      </div>

      {/* Save button — fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-4 flex-shrink-0"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 rounded-2xl font-bold text-sm tap-scale flex items-center justify-center gap-2"
          style={{ background: saving ? 'var(--accent-dim)' : 'var(--accent)', color: '#0c0e14', opacity: saving ? 0.8 : 1,
            boxShadow: saving ? 'none' : '0 0 20px rgba(196,241,53,0.25)' }}>
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Guardar · {validEjercicios.length} ejerc. × {rounds || '?'} rondas
            </>
          )}
        </button>
      </div>
    </div>
  );
}
