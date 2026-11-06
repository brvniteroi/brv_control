import { nomeDoMes, type TotalMes } from '../../utils/relatorios';

/** Escala do eixo com números redondos (1, 2 ou 5 × 10ⁿ) e folga para o rótulo sobre a coluna mais alta. */
function escalaDoEixo(maior: number): { topo: number; marcas: number[] } {
  const alvo = Math.max(maior * 1.1, 4);
  const potencia = 10 ** Math.floor(Math.log10(alvo / 4));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p * 4 >= alvo)!;
  const topo = Math.ceil(alvo / passo) * passo;
  const marcas: number[] = [];
  for (let v = 0; v <= topo; v += passo) marcas.push(v);
  return { topo, marcas };
}

const mesCurto = (mes: string) => new Date(`${mes}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const atividades = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'atividade' : 'atividades'}`;

interface Props {
  dados: TotalMes[];
  /** Mês em andamento, marcado como "parcial". */
  mesAtual: string;
}

/** Colunas por mês: rótulo só no mês mais alto e no atual; os demais valores na dica e na tabela abaixo. */
export default function GraficoAtividadesMes({ dados, mesAtual }: Props) {
  const maior = Math.max(...dados.map((d) => d.quantidade));
  const { topo, marcas } = escalaDoEixo(maior);
  const percentual = (v: number) => `${(v / topo) * 100}%`;

  return (
    <div>
      <div className="flex pt-6">
        <div className="relative h-64 w-9 shrink-0" aria-hidden>
          {marcas.map((m) => (
            <span
              key={m}
              className="absolute right-2 translate-y-1/2 text-[11px] tabular-nums text-slate-500"
              style={{ bottom: percentual(m) }}
            >
              {m.toLocaleString('pt-BR')}
            </span>
          ))}
        </div>

        <div className="relative h-64 min-w-0 flex-1">
          {marcas.map((m) => (
            <div
              key={m}
              className={`absolute inset-x-0 border-t ${m === 0 ? 'border-slate-300' : 'border-slate-100'}`}
              style={{ bottom: percentual(m) }}
              aria-hidden
            />
          ))}

          <div className="absolute inset-0 grid grid-cols-12">
            {dados.map((d, i) => {
              const atual = d.mes === mesAtual;
              const comRotulo = d.quantidade > 0 && (d.quantidade === maior || atual);
              // Nas pontas, a dica encosta na borda para não sair do cartão
              const alinhamento = i < 2 ? 'left-0' : i > 9 ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div
                  key={d.mes}
                  tabIndex={0}
                  role="img"
                  aria-label={`${nomeDoMes(d.mes)}: ${atividades(d.quantidade)}${atual ? ' (mês em andamento)' : ''}`}
                  className="group relative flex items-end justify-center rounded-sm px-0.5 outline-none hover:bg-slate-100/70 focus-visible:bg-slate-100"
                >
                  {d.quantidade > 0 && (
                    <div className="w-full max-w-6 rounded-t bg-blue-600" style={{ height: percentual(d.quantidade) }} />
                  )}
                  {comRotulo && (
                    <span
                      className="absolute left-1/2 mb-1 -translate-x-1/2 text-xs font-semibold tabular-nums text-slate-800 group-hover:invisible group-focus-visible:invisible"
                      style={{ bottom: percentual(d.quantidade) }}
                    >
                      {d.quantidade.toLocaleString('pt-BR')}
                    </span>
                  )}
                  <div
                    className={`pointer-events-none absolute z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block group-focus-visible:block ${alinhamento}`}
                    style={{ bottom: percentual(d.quantidade) }}
                  >
                    <p className="font-semibold first-letter:uppercase">{nomeDoMes(d.mes)}</p>
                    <p>
                      {atividades(d.quantidade)}
                      {atual ? ' (parcial)' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ml-9 grid grid-cols-12 pt-1.5" aria-hidden>
        {dados.map((d, i) => {
          const atual = d.mes === mesAtual;
          // Ano em janeiro e no primeiro mês; se o seguinte for janeiro, só nele (no celular os dois se encostariam)
          const mostraAno = d.mes.endsWith('-01') || (i === 0 && !dados[1]?.mes.endsWith('-01'));
          return (
            <div key={d.mes} className="whitespace-nowrap text-center text-[11px] leading-4 text-slate-500">
              <p className={atual ? 'font-semibold text-slate-800' : ''}>{mesCurto(d.mes)}</p>
              {atual ? <p>parcial</p> : mostraAno ? <p>{d.mes.slice(0, 4)}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
