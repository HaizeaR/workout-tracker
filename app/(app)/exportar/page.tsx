'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExportarPage() {
  const router = useRouter();
  const [weeks, setWeeks] = useState(4);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalSemanas, setTotalSemanas] = useState(0);
  const [copied, setCopied] = useState(false);

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

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silently
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold pt-2 mb-6" style={{ color: '#f0f0f0' }}>Exportar</h1>

      {/* Config card */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
      >
        <label className="block text-sm font-medium mb-3" style={{ color: '#ccc' }}>
          Número de semanas a exportar
        </label>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="number"
            min="1"
            max={totalSemanas || 52}
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 px-4 py-3 rounded-xl text-base text-center focus:outline-none"
            style={{
              background: '#111',
              border: '1px solid #2a2d36',
              color: '#f0f0f0',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#c4f135')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2d36')}
          />
          <span className="text-sm" style={{ color: '#888' }}>
            de {totalSemanas} disponibles
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex-1 py-3 px-4 font-semibold rounded-xl transition-all text-sm"
            style={{
              background: loading ? '#8ab030' : '#c4f135',
              color: '#0f1117',
              opacity: loading ? 0.8 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
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
              className="flex-1 py-3 px-4 font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
              style={{
                background: '#1e2d0e',
                color: '#8ab030',
                border: '1px solid #3a5a1a',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {text && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #2a2d36', background: '#13161d' }}
          >
            <h2 className="font-medium text-sm" style={{ color: '#ccc' }}>Vista previa</h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: copied ? '#c4f135' : '#555' }}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar
                </>
              )}
            </button>
          </div>
          <pre
            className="p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed"
            style={{ color: '#ccc', maxHeight: '60vh', overflowY: 'auto' }}
          >
            {text}
          </pre>
        </div>
      )}

      {!text && !loading && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#1a1d24', border: '1px solid #2a2d36' }}
        >
          <svg className="w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="#555" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm" style={{ color: '#555' }}>Haz clic en Vista previa para generar el resumen</p>
        </div>
      )}
    </div>
  );
}
