'use client';

import { CATEGORIAS, TIPO_COLORS, categoriaToTipo } from '@/lib/tipo-colors';

interface CategoriaSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function CategoriaSelect({ value, onChange, className = '' }: CategoriaSelectProps) {
  const tipo = categoriaToTipo(value);
  const tipoStyle = tipo ? TIPO_COLORS[tipo] : null;

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none appearance-none pr-8"
        style={{
          background: tipoStyle ? tipoStyle.bg : '#111',
          border: `1px solid ${tipoStyle ? tipoStyle.color + '66' : '#2a2d36'}`,
          color: tipoStyle ? tipoStyle.color : '#888',
        }}
      >
        <option value="">Categoría</option>
        {CATEGORIAS.map((c) => (
          <option key={c.label} value={c.label} style={{ background: '#1a1d24', color: '#f0f0f0' }}>
            {c.label}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={tipoStyle?.color ?? '#555'} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
