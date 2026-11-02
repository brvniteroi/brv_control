import { X } from 'lucide-react';
import type { Tag } from '../../types/fsm';

interface EtiquetaChipProps {
  etiqueta: Pick<Tag, 'name' | 'color'>;
  pequena?: boolean;
  onRemover?: () => void;
}

/** Etiqueta com fundo claro e texto na cor dela. */
export default function EtiquetaChip({ etiqueta, pequena, onRemover }: EtiquetaChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${
        pequena ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
      style={{ color: etiqueta.color, backgroundColor: `${etiqueta.color}14`, borderColor: `${etiqueta.color}55` }}
    >
      {etiqueta.name}
      {onRemover && (
        <button type="button" onClick={onRemover} className="opacity-70 hover:opacity-100" aria-label={`Remover ${etiqueta.name}`}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}
