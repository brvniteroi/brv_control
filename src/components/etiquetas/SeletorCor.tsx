import { Pipette } from 'lucide-react';
import { CORES_ETIQUETA } from '../../services/etiquetas';

interface SeletorCorProps {
  cor: string;
  onMudar: (cor: string) => void;
  pequeno?: boolean;
}

/** Paleta de cores das etiquetas + "outra cor" livre (seletor do navegador). */
export default function SeletorCor({ cor, onMudar, pequeno }: SeletorCorProps) {
  const tamanho = pequeno ? 'h-6 w-6' : 'h-7 w-7';
  const personalizada = !CORES_ETIQUETA.includes(cor.toUpperCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CORES_ETIQUETA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onMudar(c)}
          className={`${tamanho} rounded-full ${cor.toUpperCase() === c ? 'ring-2 ring-slate-800 ring-offset-2' : ''}`}
          style={{ backgroundColor: c }}
          aria-label={`Cor ${c}`}
          title={c}
        />
      ))}
      <label
        className={`${tamanho} relative flex cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-slate-500 ${
          personalizada ? 'ring-2 ring-slate-800 ring-offset-2' : ''
        }`}
        style={personalizada ? { backgroundColor: cor, color: '#fff', borderStyle: 'solid' } : undefined}
        title="Outra cor"
      >
        <Pipette size={pequeno ? 12 : 14} />
        <input
          type="color"
          value={cor}
          onChange={(e) => onMudar(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Outra cor"
        />
      </label>
    </div>
  );
}
