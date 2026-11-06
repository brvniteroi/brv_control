import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { CartaoNumero, SeletorMes, SoEscritorio } from '../components/relatorios/ComponentesRelatorio';
import TabelaTiposServico from '../components/relatorios/TabelaTiposServico';
import { listarAvaliacoesComTipo, listarRealizadasComTipo, type ComTipoServico } from '../services/relatorios';
import { dataLocal } from '../utils/linhaDoTempo';
import { limitesDoMes, media, nomeDoMes, resumirPorTipo, umaCasa } from '../utils/relatorios';

interface Dados {
  atividades: ComTipoServico[];
  avaliacoes: (ComTipoServico & { stars: number })[];
}

export default function RelatorioTiposServico() {
  return (
    <SoEscritorio>
      <Relatorio />
    </SoEscritorio>
  );
}

function Relatorio() {
  const mesAtual = dataLocal().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const recarregar = useCallback(() => setRecarga((r) => r + 1), []);
  // Carregando = a última resposta recebida não é a do mês e da recarga atuais
  const pedido = `${mes}:${recarga}`;
  const [respondido, setRespondido] = useState<string | null>(null);
  const carregando = respondido !== pedido;

  useEffect(() => {
    let ativo = true;
    const { inicio, fim } = limitesDoMes(mes);
    Promise.all([listarRealizadasComTipo(inicio, fim), listarAvaliacoesComTipo(inicio, fim)])
      .then(([atividades, avaliacoes]) => {
        if (!ativo) return;
        setDados({ atividades, avaliacoes });
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
  }, [mes, pedido]);

  const linhas = useMemo(() => (dados ? resumirPorTipo(dados.atividades, dados.avaliacoes) : []), [dados]);

  const total = dados?.atividades.length ?? 0;
  const estrelas = dados?.avaliacoes.map((r) => r.stars) ?? [];
  const comAtividade = linhas.filter((l) => l.id !== null && l.realizadas > 0);
  const principal = comAtividade[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tipos de serviço</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Atividades concluídas e avaliações dos clientes em {nomeDoMes(mes)}
            {mes === mesAtual ? ' (mês em andamento)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeletorMes mes={mes} onMudar={setMes} />
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
            <CartaoNumero rotulo="Atividades realizadas" valor={total.toLocaleString('pt-BR')} detalhe="no mês" />
            <CartaoNumero rotulo="Tipos atendidos" valor={String(comAtividade.length)} detalhe="com atividade no mês" />
            <CartaoNumero
              rotulo="Mais realizado"
              valor={principal ? principal.realizadas.toLocaleString('pt-BR') : '—'}
              detalhe={principal?.nome}
            />
            <CartaoNumero
              rotulo="Avaliação média"
              valor={estrelas.length ? `${umaCasa(media(estrelas))} ★` : '—'}
              detalhe={`${estrelas.length} ${estrelas.length === 1 ? 'avaliação' : 'avaliações'} no mês`}
            />
          </div>

          <TabelaTiposServico linhas={linhas} total={total} />

          <p className="text-[11px] text-slate-500">
            O tipo é o da OS de cada atividade. A avaliação conta no mês em que o cliente avaliou.
          </p>
        </div>
      )}
    </div>
  );
}
