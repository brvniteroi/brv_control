/** Data local no formato AAAA-MM-DD (não usar toISOString: depois das 21h ele já devolve o dia seguinte). */
function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deslocar(dias: number, meses = 0): Date {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate() + dias);
}

/** Intervalos prontos do filtro de período (pedido do Braulio, 2026-11-24). */
const PERIODOS: { id: string; rotulo: string; intervalo: () => [string, string] }[] = [
  { id: 'qualquer', rotulo: 'Qualquer data', intervalo: () => ['', ''] },
  { id: 'hoje', rotulo: 'Hoje', intervalo: () => [diaLocal(new Date()), diaLocal(new Date())] },
  { id: '7dias', rotulo: 'Últimos 7 dias', intervalo: () => [diaLocal(deslocar(-6)), diaLocal(new Date())] },
  {
    id: 'mes',
    rotulo: 'Este mês',
    intervalo: () => {
      const hoje = new Date();
      return [diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), diaLocal(hoje)];
    },
  },
  {
    id: 'mes_passado',
    rotulo: 'Mês passado',
    intervalo: () => {
      const hoje = new Date();
      return [
        diaLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
        diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      ];
    },
  },
  {
    id: 'ano',
    rotulo: 'Este ano',
    intervalo: () => {
      const hoje = new Date();
      return [diaLocal(new Date(hoje.getFullYear(), 0, 1)), diaLocal(hoje)];
    },
  },
];

interface FiltroPeriodoProps {
  /** Prefixo dos ids dos campos (rótulos "De"/"até" clicáveis). */
  idPrefixo: string;
  dataInicio: string;
  dataFim: string;
  onMudar: (dataInicio: string, dataFim: string) => void;
  /** Classe das caixas (a mesma dos outros filtros da barra). */
  classe: string;
}

/**
 * Filtro de período das listas (Vendas, Orçamentos): caixa "Período" com intervalos prontos + datas "De" e "até".
 * As datas são AAAA-MM-DD no dia local; quem filtra compara com o dia local do registro.
 */
export default function FiltroPeriodo({ idPrefixo, dataInicio, dataFim, onMudar, classe }: FiltroPeriodoProps) {
  // Mostra o intervalo pronto que bate com as datas; datas digitadas à mão = "Período escolhido"
  const atual =
    PERIODOS.find((p) => {
      const [ini, fim] = p.intervalo();
      return ini === dataInicio && fim === dataFim;
    })?.id ?? 'personalizado';

  return (
    <>
      <select
        value={atual}
        aria-label="Período"
        onChange={(e) => {
          const escolhido = PERIODOS.find((p) => p.id === e.target.value);
          if (escolhido) onMudar(...escolhido.intervalo());
        }}
        className={classe}
      >
        {PERIODOS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.rotulo}
          </option>
        ))}
        {atual === 'personalizado' && <option value="personalizado">Período escolhido</option>}
      </select>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <label htmlFor={`${idPrefixo}-de`}>De</label>
        <input
          id={`${idPrefixo}-de`}
          type="date"
          value={dataInicio}
          max={dataFim || undefined}
          onChange={(e) => onMudar(e.target.value, dataFim)}
          className={classe}
        />
        <label htmlFor={`${idPrefixo}-ate`}>até</label>
        <input
          id={`${idPrefixo}-ate`}
          type="date"
          value={dataFim}
          min={dataInicio || undefined}
          onChange={(e) => onMudar(dataInicio, e.target.value)}
          className={classe}
        />
      </div>
    </>
  );
}
