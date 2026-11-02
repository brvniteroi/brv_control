import type { Tag } from '../../types/fsm';

interface EtiquetasNoBlocoProps {
  etiquetas: Tag[] | undefined;
  /** 'pilula' mostra o nome; 'ponto' só a cor (blocos estreitos). */
  modo?: 'pilula' | 'ponto';
}

/** Etiquetas da OS sobre os blocos coloridos (linha do tempo e calendário): fundo branco, texto na cor dela. */
export default function EtiquetasNoBloco({ etiquetas, modo = 'pilula' }: EtiquetasNoBlocoProps) {
  if (!etiquetas?.length) return null;
  if (modo === 'ponto') {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        {etiquetas.map((t) => (
          <span key={t.id} title={t.name} className="h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ backgroundColor: t.color }} />
        ))}
      </span>
    );
  }
  return (
    <>
      {etiquetas.map((t) => (
        <span
          key={t.id}
          className="shrink-0 rounded bg-white px-1 py-px text-[9px] font-bold uppercase leading-tight tracking-wide"
          style={{ color: t.color }}
        >
          {t.name}
        </span>
      ))}
    </>
  );
}
