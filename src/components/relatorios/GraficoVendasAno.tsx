interface Coluna {
  ano: number;
  valor: number;
  aviso: string | null;
  parcial: boolean;
}

/** Colunas por ano (uma série): rótulo no maior e no último; os demais na dica e na tabela abaixo. */
export default function GraficoVendasAno({ dados, formatar }: { dados: Coluna[]; formatar: (v: number) => string }) {
  const maior = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-150">
        <div className="flex h-64 items-end gap-0.5 border-b border-slate-300 pt-8">
          {dados.map((d, i) => {
            const texto = `${d.ano}: ${formatar(d.valor)}${d.aviso ? ` (${d.aviso})` : ''}${d.parcial ? ' (ano em andamento)' : ''}`;
            const rotulo = d.valor > 0 && (d.valor === maior || i === dados.length - 1);
            const alinhamento = i < 2 ? 'left-0' : i > dados.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const altura = `${(d.valor / maior) * 100}%`;
            return (
              <div key={d.ano} tabIndex={0} role="img" aria-label={texto} className="group relative flex h-full flex-1 items-end justify-center rounded-sm outline-none hover:bg-slate-100/70 focus-visible:bg-slate-100">
                {d.valor > 0 && <div className={`w-full max-w-8 rounded-t ${d.aviso ? 'bg-slate-300' : 'bg-blue-600'}`} style={{ height: altura }} />}
                {rotulo && (
                  <span className={`absolute mb-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-800 group-hover:invisible ${alinhamento}`} style={{ bottom: altura }}>
                    {formatar(d.valor)}
                  </span>
                )}
                <div className={`pointer-events-none absolute z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block group-focus-visible:block ${alinhamento}`} style={{ bottom: altura }}>
                  {texto}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-0.5 pt-1.5" aria-hidden>
          {dados.map((d) => (
            <p key={d.ano} className="flex-1 text-center text-[11px] leading-4 text-slate-500">
              {d.ano}
              {d.aviso ? '*' : ''}
              {d.parcial && <span className="block font-semibold text-slate-700">parcial</span>}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
