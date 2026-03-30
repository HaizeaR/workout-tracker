'use client';

import { useState } from 'react';
import type { Sesion, Ejecucion } from '@/db/schema';

interface SemanaTableProps {
  sesiones: Sesion[];
  ejecuciones: Ejecucion[];
  onUpdate: (ejecucionId: number, data: Partial<Ejecucion>) => Promise<void>;
}

interface EditState {
  [ejecucionId: number]: Partial<Ejecucion>;
}

export default function SemanaTable({ sesiones, ejecuciones, onUpdate }: SemanaTableProps) {
  const [editState, setEditState] = useState<EditState>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());

  // Group by fecha
  const byDate = sesiones.reduce<Record<string, Sesion[]>>((acc, s) => {
    if (!acc[s.fecha]) acc[s.fecha] = [];
    acc[s.fecha].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();

  function getEjecucion(sesionId: number): Ejecucion | undefined {
    return ejecuciones.find((e) => e.sesion_id === sesionId);
  }

  function getFieldValue<K extends keyof Ejecucion>(
    ejecucion: Ejecucion | undefined,
    field: K
  ): Ejecucion[K] | undefined {
    if (!ejecucion) return undefined;
    const editData = editState[ejecucion.id];
    if (editData && field in editData) {
      return editData[field] as Ejecucion[K];
    }
    return ejecucion[field];
  }

  function handleChange(ejecucionId: number, field: keyof Ejecucion, value: unknown) {
    setEditState((prev) => ({
      ...prev,
      [ejecucionId]: {
        ...prev[ejecucionId],
        [field]: value,
      },
    }));
  }

  async function handleSave(ejecucionId: number) {
    const updates = editState[ejecucionId];
    if (!updates) return;

    setSaving((prev) => new Set(prev).add(ejecucionId));
    try {
      await onUpdate(ejecucionId, updates);
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
      await onUpdate(ejecucionId, { completado: !current });
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(ejecucionId);
        return next;
      });
    }
  }

  const hasChanges = (ejecucionId: number) => Boolean(editState[ejecucionId] && Object.keys(editState[ejecucionId]).length > 0);

  return (
    <div className="space-y-6">
      {sortedDates.map((fecha) => (
        <div key={fecha} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <h3 className="font-semibold text-gray-200 text-sm">
              {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-2 font-medium">Ejercicio</th>
                  <th className="text-center px-2 py-2 font-medium">Plan</th>
                  <th className="text-center px-2 py-2 font-medium">Series</th>
                  <th className="text-center px-2 py-2 font-medium">Reps</th>
                  <th className="text-center px-2 py-2 font-medium">Peso (kg)</th>
                  <th className="text-center px-2 py-2 font-medium">Dist (km)</th>
                  <th className="text-center px-2 py-2 font-medium">Dur (min)</th>
                  <th className="text-center px-2 py-2 font-medium">Sens.</th>
                  <th className="text-center px-2 py-2 font-medium">Dolor</th>
                  <th className="text-left px-2 py-2 font-medium">Notas</th>
                  <th className="text-center px-2 py-2 font-medium">Hecho</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {byDate[fecha].map((sesion) => {
                  const ejec = getEjecucion(sesion.id);
                  if (!ejec) return null;

                  const isSaving = saving.has(ejec.id);
                  const isDirty = hasChanges(ejec.id);
                  const completado = getFieldValue(ejec, 'completado') ?? false;

                  return (
                    <tr
                      key={sesion.id}
                      className={`transition-colors ${
                        completado ? 'bg-green-950/20' : ''
                      }`}
                    >
                      {/* Ejercicio */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-200 text-sm">{sesion.ejercicio}</p>
                          {sesion.categoria && (
                            <p className="text-xs text-gray-500">{sesion.categoria}</p>
                          )}
                        </div>
                      </td>

                      {/* Plan summary */}
                      <td className="px-2 py-3 text-center">
                        <span className="text-xs text-gray-500">
                          {sesion.series && sesion.reps ? `${sesion.series}x${sesion.reps}` : ''}
                          {sesion.peso_kg ? ` @${sesion.peso_kg}kg` : ''}
                          {sesion.distancia_km ? `${sesion.distancia_km}km` : ''}
                          {sesion.duracion_min ? ` ${sesion.duracion_min}m` : ''}
                          {!sesion.series && !sesion.distancia_km ? '—' : ''}
                        </span>
                      </td>
                      {/* Series */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          value={getFieldValue(ejec, 'series') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'series', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      {/* Reps */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          value={getFieldValue(ejec, 'reps') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      {/* Peso */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={getFieldValue(ejec, 'peso_kg') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'peso_kg', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      {/* Distancia */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={getFieldValue(ejec, 'distancia_km') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'distancia_km', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      {/* Duracion */}
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={getFieldValue(ejec, 'duracion_min') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'duracion_min', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Sensacion 1-5 */}
                      <td className="px-2 py-3">
                        <select
                          value={getFieldValue(ejec, 'sensacion') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'sensacion', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-16 px-1 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">—</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                      </td>

                      {/* Dolor */}
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={getFieldValue(ejec, 'dolor') ?? false}
                          onChange={(e) => handleChange(ejec.id, 'dolor', e.target.checked)}
                          className="w-5 h-5 rounded border-gray-600 bg-gray-800 accent-red-500 cursor-pointer"
                        />
                      </td>

                      {/* Notas */}
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={getFieldValue(ejec, 'notas') ?? ''}
                          onChange={(e) => handleChange(ejec.id, 'notas', e.target.value || null)}
                          placeholder="—"
                          className="w-32 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Completado */}
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleToggleCompletado(ejec.id, completado as boolean)}
                          disabled={isSaving}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            completado
                              ? 'bg-green-600 hover:bg-green-500'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {isSaving && !isDirty ? (
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : completado ? (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>

                      {/* Save button */}
                      <td className="px-2 py-3">
                        {isDirty && (
                          <button
                            onClick={() => handleSave(ejec.id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                          >
                            {isSaving ? '...' : 'Guardar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {sortedDates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No hay sesiones en esta semana
        </div>
      )}
    </div>
  );
}
