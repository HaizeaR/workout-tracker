interface RecordBadgeProps {
  ejercicio: string;
  tipo: 'peso' | 'distancia';
  valor: number;
  fecha?: string;
  size?: 'sm' | 'md';
}

export default function RecordBadge({ ejercicio, tipo, valor, fecha, size = 'md' }: RecordBadgeProps) {
  const isSmall = size === 'sm';

  return (
    <div className={`inline-flex items-center gap-2 bg-yellow-950/50 border border-yellow-700/50 rounded-xl ${isSmall ? 'px-2 py-1' : 'px-3 py-2'}`}>
      <span className={`${isSmall ? 'text-base' : 'text-xl'}`}>🏆</span>
      <div>
        <p className={`font-semibold text-yellow-300 ${isSmall ? 'text-xs' : 'text-sm'}`}>
          {ejercicio}
        </p>
        <p className={`text-yellow-500 ${isSmall ? 'text-xs' : 'text-xs'}`}>
          {tipo === 'peso' ? `${valor} kg` : `${valor} km`}
          {fecha && ` · ${fecha}`}
        </p>
      </div>
    </div>
  );
}
