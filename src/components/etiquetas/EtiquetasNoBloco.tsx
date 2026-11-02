import type { Tag } from '../../types/fsm';

interface EtiquetasNoBlocoProps {
  etiquetas: Tag[] | undefined;
  /** 'pilula' mostra o nome; 'ponto' só a cor (blocos estreitos). */
  modo?: 'pilula' | 'ponto';
}

const MAX_PILULAS = 2;

const Ponto = ({ cor, titulo }: { cor: string; titulo?: string }) => (
  <span title={titulo} className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white/90" style={{ backgroundColor: cor }} />
);

/**
 * Etiquetas da OS sobre os blocos coloridos (linha do tempo e calendário): pílula translúcida
 * como as do sistema, texto branco e um ponto na cor da etiqueta.
 */
export default function EtiquetasNoBloco({ etiquetas, modo = 'pilula' }: EtiquetasNoBlocoProps) {
  if (!etiquetas?.length) return null;
  if (modo === 'ponto') {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        {etiquetas.map((t) => <Ponto key={t.id} cor={t.color} titulo={t.name} />)}
      </span>
    );
  }
  const visiveis = etiquetas.slice(0, MAX_PILULAS);
  const resto = etiquetas.length - visiveis.length;
  return (
    <>
      {visiveis.map((t) => (
        <span
          key={t.id}
          className="inline-flex max-w-28 shrink-0 items-center gap-1 rounded-full bg-white/20 px-1.5 py-px text-[10px] font-semibold leading-tight text-white ring-1 ring-inset ring-white/25"
        >
          <Ponto cor={t.color} />
          <span className="truncate">{t.name}</span>
        </span>
      ))}
      {resto > 0 && (
        <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-px text-[10px] font-semibold leading-tight text-white">+{resto}</span>
      )}
    </>
  );
}
