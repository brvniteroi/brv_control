import type { Tag } from '../../types/fsm';

interface EtiquetasNoBlocoProps {
  etiquetas: Tag[] | undefined;
  /**
   * 'canto': marcas no canto inferior esquerdo do bloco (linha do tempo; o bloco precisa ser `relative`/`absolute`).
   * 'ponto': bolinhas em linha (calendário).
   */
  modo?: 'canto' | 'ponto';
}

/** Etiquetas da OS sobre os blocos coloridos: só a cor; o nome aparece ao passar o mouse. */
export default function EtiquetasNoBloco({ etiquetas, modo = 'canto' }: EtiquetasNoBlocoProps) {
  if (!etiquetas?.length) return null;
  if (modo === 'ponto') {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        {etiquetas.map((t) => (
          <span key={t.id} title={t.name} className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/90" style={{ backgroundColor: t.color }} />
        ))}
      </span>
    );
  }
  return (
    // z-10: fica acima da alça de redimensionar do lado esquerdo (senão a dica não aparece)
    <span className="absolute bottom-0 left-0 z-10 flex gap-px">
      {etiquetas.map((t) => (
        <span key={t.id} title={t.name} className="h-1.5 w-4 first:rounded-bl-sm" style={{ backgroundColor: t.color }} />
      ))}
    </span>
  );
}
