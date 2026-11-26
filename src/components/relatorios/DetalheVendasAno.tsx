import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { detalheVendas, type DetalheVendas } from '../../services/relatorioVendas';
import { diaBr, reais } from '../../utils/relatorioVendas';
import { percentual } from '../../utils/relatorios';

const NOME_TIPO = { servico: 'Serviços', produto: 'Produtos', sem_classificacao: 'Sem classificação' } as const;

const campo = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800';

interface Linha {
  chave: string;
  nome: string;
  quantidade: string;
  total: number;
}

function Ranking({ titulo, coluna, linhas }: { titulo: string; coluna: string; linhas: Linha[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <h3 className="px-4 pt-3 text-sm font-bold text-slate-800">{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="p-4 text-xs text-slate-500">Nada neste período.</p>
      ) : (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2 text-left">Nome</th>
              <th scope="col" className="px-2 py-2 text-right">{coluna}</th>
              <th scope="col" className="px-4 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {linhas.map((l) => (
              <tr key={l.chave} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="px-4 py-1.5 text-left font-medium text-slate-700">{l.nome}</th>
                <td className="px-2 py-1.5 text-right text-slate-600">{l.quantidade}</td>
                <td className="whitespace-nowrap px-4 py-1.5 text-right font-semibold text-slate-800">{reais(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** O que mais faturou num ano (ou em todo o histórico com valor completo). */
export default function DetalheVendasAno({ anos, ultimoDia }: { anos: number[]; ultimoDia: string }) {
  const [ano, setAno] = useState<number | 'todos'>(anos[0] ?? 'todos');
  const [ateODia, setAteODia] = useState(false);
  const inicio = ano === 'todos' ? `${Math.min(...anos)}-01-01` : `${ano}-01-01`;
  const mesDia = ultimoDia.slice(5) === '02-29' ? '02-28' : ultimoDia.slice(5);
  const fim = ano === 'todos' ? ultimoDia : ateODia ? `${ano}-${mesDia}` : `${ano}-12-31`;
  const chave = `${inicio}/${fim}`;
  const [resposta, setResposta] = useState<{ chave: string; dados?: DetalheVendas; erro?: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    const k = `${inicio}/${fim}`;
    detalheVendas(inicio, fim)
      .then((dados) => ativo && setResposta({ chave: k, dados }))
      .catch((e) => ativo && setResposta({ chave: k, erro: e?.message ?? 'Não foi possível carregar o detalhe.' }));
    return () => {
      ativo = false;
    };
  }, [inicio, fim]);

  const carregando = resposta?.chave !== chave;
  const d = resposta?.dados;
  const somaItens = d?.tipos.reduce((s, t) => s + t.total, 0) ?? 0;
  const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold text-slate-900">De onde vem a receita</h2>
        <select aria-label="Ano do detalhe" className={campo} value={ano} onChange={(e) => setAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
          <option value="todos">Todos os anos com valor completo</option>
        </select>
        {ano !== 'todos' && (
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={ateODia} onChange={(e) => setAteODia(e.target.checked)} />
            Só até {diaBr(ultimoDia).slice(0, 5)}
          </label>
        )}
        {carregando && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>

      {resposta?.erro && !carregando && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{resposta.erro}</p>}

      {d && (
        <div className={`space-y-3 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800">Produtos e serviços</h3>
            <div className="mt-3 space-y-2">
              {d.tipos.map((t) => (
                <div key={t.tipo} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="w-32 shrink-0 font-medium text-slate-700">{NOME_TIPO[t.tipo]}</span>
                  <div className="h-3 min-w-24 flex-1">
                    <div className={`h-3 rounded-r ${t.tipo === 'sem_classificacao' ? 'bg-slate-300' : 'bg-blue-600'}`} style={{ width: `${somaItens ? (t.total / somaItens) * 100 : 0}%` }} />
                  </div>
                  <span className="w-44 shrink-0 text-right font-semibold tabular-nums text-slate-800">
                    {reais(t.total, false)} · {percentual(t.total, somaItens)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Soma dos itens (sem frete). “Sem classificação” são itens de produtos apagados do cadastro do SicWeb: não há como saber o nome nem o tipo.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Ranking titulo="Serviços que mais faturam" coluna="Qtd." linhas={d.servicos.map((i) => ({ chave: i.nome, nome: i.nome, quantidade: qtd(i.quantidade), total: i.total }))} />
            <Ranking titulo="Produtos que mais faturam" coluna="Qtd." linhas={d.produtos.map((i) => ({ chave: i.nome, nome: i.nome, quantidade: qtd(i.quantidade), total: i.total }))} />
            <Ranking titulo="Clientes que mais compram" coluna="Vendas" linhas={d.clientes.map((c) => ({ chave: c.id, nome: c.nome, quantidade: String(c.vendas), total: c.total }))} />
          </div>
          <p className="text-[11px] text-slate-500">
            Fora do ranking de clientes: vendas de balcão ({d.balcao.vendas.toLocaleString('pt-BR')} vendas, {reais(d.balcao.total)}).
          </p>
        </div>
      )}
    </div>
  );
}
