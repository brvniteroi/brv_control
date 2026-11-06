import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { CartaoNumero, SeletorMes, SoEscritorio } from '../components/relatorios/ComponentesRelatorio';
import TabelaGarantia from '../components/relatorios/TabelaGarantia';
import { listarRealizadasComTipo, type ComTipoServico } from '../services/relatorios';
import { dataLocal } from '../utils/linhaDoTempo';
import { listarColaboradoresCores } from '../services/linhaDoTempo';
import { ehGarantiaBrv, limitesDoMes, nomeDoMes, percentual, resumirGarantia, type Colaborador } from '../utils/relatorios';

interface Dados {
  atividades: (ComTipoServico & { employee_id: string | null })[];
  colaboradores: Colaborador[];
}

export default function RelatorioGarantia() {
  return (
    <SoEscritorio>
      <Relatorio />
    </SoEscritorio>
  );
}

function Relatorio() {
  const mesAtual = dataLocal().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [porAno, setPorAno] = useState(true);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const recarregar = useCallback(() => setRecarga((r) => r + 1), []);

  const ano = Number(mes.slice(0, 4));
  const inicio = limitesDoMes(porAno ? `${ano}-01` : mes).inicio;
  const fim = limitesDoMes(porAno ? `${ano}-12` : mes).fim;
  // Carregando = a última resposta recebida não é a do período e da recarga atuais
  const pedido = `${inicio}:${fim}:${recarga}`;
  const [respondido, setRespondido] = useState<string | null>(null);
  const carregando = respondido !== pedido;

  useEffect(() => {
    let ativo = true;
    Promise.all([listarRealizadasComTipo(inicio, fim), listarColaboradoresCores()])
      .then(([atividades, colaboradores]) => {
        if (!ativo) return;
        setDados({ atividades, colaboradores: colaboradores as Colaborador[] });
        setErro(null);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.');
      })
      .finally(() => {
        if (ativo) setRespondido(pedido);
      });
    return () => {
      ativo = false;
    };
  }, [inicio, fim, pedido]);

  const linhas = useMemo(() => (dados ? resumirGarantia(dados.atividades, dados.colaboradores) : []), [dados]);

  const garantias = dados?.atividades.filter(ehGarantiaBrv).length ?? 0;
  const todas = dados?.atividades.length ?? 0;
  const comTecnico = linhas.filter((l) => l.id !== null && l.garantias > 0);
  const maior = comTecnico[0]?.garantias ?? 0;
  const lideres = comTecnico.filter((l) => l.garantias === maior).map((l) => l.nome);
  const emAndamento = porAno ? String(ano) === mesAtual.slice(0, 4) : mes === mesAtual;
  const botaoPeriodo = (ativo: boolean) =>
    `px-3 py-2 text-xs font-semibold transition ${ativo ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Garantia BRV</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Atividades concluídas de OS do tipo Garantia BRV em {porAno ? ano : nomeDoMes(mes)}
            {emAndamento ? ' (período em andamento)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button type="button" onClick={() => setPorAno(false)} aria-pressed={!porAno} className={botaoPeriodo(!porAno)}>Mês</button>
            <button type="button" onClick={() => setPorAno(true)} aria-pressed={porAno} className={botaoPeriodo(porAno)}>Ano</button>
          </div>
          {porAno ? (
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <button type="button" onClick={() => setMes(`${ano - 1}${mes.slice(4)}`)} aria-label="Ano anterior" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
                <ChevronLeft size={16} />
              </button>
              <span className="border-x border-slate-200 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-800">{ano}</span>
              <button type="button" onClick={() => setMes(`${ano + 1}${mes.slice(4)}`)} aria-label="Próximo ano" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <SeletorMes mes={mes} onMudar={setMes} />
          )}
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
          >
            {carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
          </button>
        </div>
      </div>

      {erro ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          <p>{erro}</p>
          <button type="button" onClick={recarregar} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100">
            Tentar de novo
          </button>
        </div>
      ) : !dados ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CartaoNumero rotulo="Garantias atendidas" valor={garantias.toLocaleString('pt-BR')} detalhe="no período" />
            <CartaoNumero
              rotulo="Quem mais atendeu"
              valor={lideres.length ? maior.toLocaleString('pt-BR') : '—'}
              detalhe={lideres.length ? lideres.join(', ') : 'nenhuma garantia no período'}
            />
            <CartaoNumero rotulo="Técnicos que atenderam" valor={String(comTecnico.length)} detalhe="ao menos uma garantia" />
            <CartaoNumero rotulo="Garantia no total" valor={percentual(garantias, todas)} detalhe={`de ${todas.toLocaleString('pt-BR')} atividades`} />
          </div>

          <TabelaGarantia linhas={linhas} total={garantias} />

          <p className="text-[11px] text-slate-500">
            "Garantia no total dele" mostra quanto das atividades do técnico no período foi garantia. Quem atende a garantia não é necessariamente quem fez o serviço original.
          </p>
        </div>
      )}
    </div>
  );
}
