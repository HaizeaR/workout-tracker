'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExportarPage() {
  const router = useRouter();
  const [weeks, setWeeks] = useState(4);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalSemanas, setTotalSemanas] = useState(0);

  useEffect(() => {
    fetch('/api/semanas')
      .then((r) => {
        if (!r.ok) { router.push('/login'); return null; }
        return r.json();
      })
      .then((d) => d && setTotalSemanas(d.semanas?.length || 0))
      .catch(console.error);
  }, [router]);

  async function handlePreview() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?weeks=${weeks}`);
      const data = await res.json();
      if (data.text) setText(data.text);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entrenamiento-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-6 pt-2">Exportar</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Número de semanas a exportar
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max={totalSemanas || 52}
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-400 text-sm">
            de {totalSemanas} disponibles
          </span>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando...
              </span>
            ) : (
              'Vista previa'
            )}
          </button>

          {text && (
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar .txt
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {text && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-medium text-gray-200 text-sm">Vista previa</h2>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(text);
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors text-xs flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </button>
          </div>
          <pre className="p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
            {text}
          </pre>
        </div>
      )}

      {!text && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-sm">Haz clic en Vista previa para generar el resumen</p>
        </div>
      )}
    </div>
  );
}
