'use client';

import { useState, useRef, DragEvent } from 'react';
import Papa from 'papaparse';
import { TIPO_COLORS } from '@/lib/tipo-colors';

interface CsvUploadProps {
  onSuccess: (result: { semana: { id: number; semana_numero: number; anio: number }; sesionesCount: number; newRecords: unknown[] }) => void;
}

interface PreviewDay {
  fecha: string;
  ejercicios: string[];
  bloques: string[];
  tipo: string | null;
}

function parsePreview(content: string): PreviewDay[] | null {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (result.errors.length > 0 || result.data.length === 0) return null;

  const byDate = new Map<string, PreviewDay>();
  for (const row of result.data) {
    const fecha = row.fecha?.trim();
    if (!fecha) continue;
    if (!byDate.has(fecha)) {
      byDate.set(fecha, { fecha, ejercicios: [], bloques: [], tipo: row.tipo?.trim() || null });
    }
    const day = byDate.get(fecha)!;
    if (row.ejercicio?.trim()) day.ejercicios.push(row.ejercicio.trim());
    if (row.bloque?.trim() && !day.bloques.includes(row.bloque.trim())) {
      day.bloques.push(row.bloque.trim());
    }
    if (!day.tipo && row.tipo?.trim()) day.tipo = row.tipo.trim();
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export default function CsvUpload({ onSuccess }: CsvUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewDay[] | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Solo se aceptan archivos CSV');
      return;
    }
    setError('');
    const text = await file.text();
    const days = parsePreview(text);
    if (!days || days.length === 0) {
      setError('CSV vacío o formato no reconocido');
      return;
    }
    setPreview(days);
    setPendingFile(file);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const res = await fetch('/api/csv/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al subir el archivo'); return; }
      setPreview(null);
      setPendingFile(null);
      onSuccess(data);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setPendingFile(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // ── Preview screen ──────────────────────────────────────────────────────────
  if (preview) {
    const totalEjercicios = preview.reduce((s, d) => s + d.ejercicios.length, 0);
    return (
      <div className="w-full">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2d36' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#13161d', borderBottom: '1px solid #2a2d36' }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#f0f0f0' }}>Vista previa</p>
              <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                {preview.length} días · {totalEjercicios} ejercicios
              </p>
            </div>
            <button onClick={cancelPreview} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#2a2d36', color: '#888' }}>
              Cancelar
            </button>
          </div>

          {/* Days list */}
          <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: '#2a2d36' }}>
            {preview.map((day) => {
              const dateLabel = new Date(day.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
              const tipoStyle = day.tipo ? TIPO_COLORS[day.tipo] : null;
              return (
                <div key={day.fecha} className="px-4 py-3 flex items-start gap-3" style={{ background: '#1a1d24' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium capitalize" style={{ color: '#f0f0f0' }}>{dateLabel}</span>
                      {tipoStyle && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>{day.tipo}</span>
                      )}
                      {day.bloques.length > 0 && day.bloques.map((b) => (
                        <span key={b} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#0f1117', color: '#c4f135', border: '1px solid #2a3a0e' }}>{b}</span>
                      ))}
                    </div>
                    <p className="text-xs truncate" style={{ color: '#555' }}>
                      {day.ejercicios.slice(0, 4).join(' · ')}{day.ejercicios.length > 4 ? ` +${day.ejercicios.length - 4}` : ''}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: '#444' }}>{day.ejercicios.length} ejerc.</span>
                </div>
              );
            })}
          </div>

          {/* Confirm */}
          <div className="px-4 py-3" style={{ background: '#13161d', borderTop: '1px solid #2a2d36' }}>
            <p className="text-xs mb-3" style={{ color: '#666' }}>
              Los días ya existentes serán reemplazados con los datos del CSV.
            </p>
            <button
              onClick={confirmUpload}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: loading ? '#8ab030' : '#c4f135', color: '#0f1117', opacity: loading ? 0.8 : 1 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando...
                </span>
              ) : `Confirmar importación (${preview.length} días)`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#2d1010', color: '#e05050', border: '1px solid #4a1010' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Drop zone ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl p-8 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? '#c4f135' : '#2a2d36'}`,
          background: dragging ? '#1a2d0a' : '#13161d',
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#1a1d24' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#555" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#ccc' }}>Arrastra un CSV aquí</p>
            <p className="text-xs mt-1" style={{ color: '#555' }}>o toca para seleccionar</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#2d1010', color: '#e05050', border: '1px solid #4a1010' }}>
          {error}
        </div>
      )}
    </div>
  );
}
