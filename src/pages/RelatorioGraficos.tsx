import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { CartaoNumero, SoEscritorio } from '../components/relatorios/ComponentesRelatorio';
import GraficoAtividadesMes from '../components/relatorios/GraficoAtividadesMes';
import { somarMeses } from '../hooks/useCalendario';
import { listarAtividadesRealizadas, type AtividadeRealizada } from '../services/relatorios';
import { dataLocal } from '../utils/linhaDoTempo';
import { contarUltimos12Meses, limitesDoMes, nomeDoMes, umaCasa } from '../utils/relatorios';

export default function RelatorioGraficos() {
  return (
    <SoEscritorio>
      <Graficos />
    </SoEscritorio>
  );
}

function Graficos() {
  const mesAtual = dataLocal().slice(0, 7);
  const [atividades, setAtividades] = useState<AtividadeRealizada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const recarregar = useCallback(() => setRecarga((r) => r + 1), []);
  // Carregando = a última resposta recebida não é a da recarga atual
  const [respondido, setRespondido] = useState<number | null>(null);
  const carregando = respondido !== recarga;

  useEffect(() => {
    let ativo = true;
    listarAtividadesRealizadas(limitesDoMes(somarMeses(mesAtual, -11)).inicio, limitesDoMes(mesAtual).fim)
      .then((lista) => {
        if (!ativo) return;
        setAtividades(lista);
        setErro(null);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o gráfico.');
      })
      .finally(() => {
        if (ativo) setRespondido(recarga);
      });
    return () => {
      ativo = false;
    };
  }, [mesAtual, recarga]);

  const dados = useMemo(() => (atividades ? contarUltimos12Meses(atividades, mesAtual) : []), [atividades, mesAtual]);

  const ano = mesAtual.slice(0, 4);
  const doMes = dados[11]?.quantidade ?? 0;
  const anterior = dados[10];
  const noAno = dados.filter((d) => d.mes.startsWith(ano)).reduce((s, d) => s + d.quantidade, 0);
  const em12Meses = dados.reduce((s, d) => s + d.quantidade, 0);
  // Só meses fechados: o mês em andamento puxaria a média para baixo
  const mediaMensal = dados.length ? (em12Meses - doMes) / 11 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gráficos</h1>
          <p className="mt-0.5 text-xs text-slate-500">Atividades concluídas nos últimos 12 meses</p>
        </div>
        <button
          type="button"
          onClick={recarregar}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
        </button>
      </div>

      {erro ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          <p>{erro}</p>
          <button type="button" onClick={recarregar} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100">
            Tentar de novo
          </button>
        </div>
      ) : !atividades ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CartaoNumero
              rotulo="Neste mês"
              valor={doMes.toLocaleString('pt-BR')}
              detalhe={anterior ? `${anterior.quantidade.toLocaleString('pt-BR')} em ${nomeDoMes(anterior.mes)}` : undefined}
            />
            <CartaoNumero rotulo={`Em ${ano}`} valor={noAno.toLocaleString('pt-BR')} detalhe="de janeiro até hoje" />
            <CartaoNumero rotulo="Últimos 12 meses" valor={em12Meses.toLocaleString('pt-BR')} detalhe="inclui o mês em andamento" />
            <CartaoNumero rotulo="Média mensal" valor={umaCasa(mediaMensal)} detalhe="dos 11 meses fechados" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
            <h2 className="text-sm font-bold text-slate-800">Atividades por mês</h2>
            <GraficoAtividadesMes dados={dados} mesAtual={mesAtual} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-sm">
              <caption className="sr-only">Atividades concluídas por mês</caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5">Mês</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Atividades</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...dados].reverse().map((d) => (
                  <tr key={d.mes} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-medium text-slate-700 first-letter:uppercase">
                      {nomeDoMes(d.mes)}
                      {d.mes === mesAtual ? ' (parcial)' : ''}
                    </th>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{d.quantidade.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
