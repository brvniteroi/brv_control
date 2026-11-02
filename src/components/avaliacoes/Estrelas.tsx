import { Star } from 'lucide-react';

/** Estrelas só para mostrar (nota de 1 a 5, aceita fração na média). */
export default function Estrelas({ nota, tamanho = 14 }: { nota: number; tamanho?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${nota.toLocaleString('pt-BR')} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={tamanho}
          className={i <= Math.round(nota) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
        />
      ))}
    </span>
  );
}
