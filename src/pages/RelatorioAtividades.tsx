import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import { CartaoNumero, SeletorMes, SoEscritorio } from '../components/relatorios/ComponentesRelatorio';
import { listarColaboradoresCores } from '../services/linhaDoTempo';
import { listarAtividadesRealizadas, listarAvaliacoesRecebidas, type AtividadeRealizada, type AvaliacaoRecebida } from '../services/relatorios';
import { dataLocal } from '../utils/linhaDoTempo';
import { limitesDoMes, media, nomeDoMes, resumirPorTecnico, umaCasa, type Colaborador } from '../utils/relatorios';

interface Dados {
  atividades: AtividadeRealizada[];
  avaliacoes: AvaliacaoRecebida[];
  colaboradores: Colaborador[];
}

export default function RelatorioAtividades() {
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
    Promise.all([listarAtividadesRealizadas(inicio, fim), listarAvaliacoesRecebidas(inicio, fim), listarColaboradoresCores()])
      .then(([atividades, avaliacoes, colaboradores]) => {
        if (!ativo) return;
        setDados({ atividades, avaliacoes, colaboradores: colaboradores as Colaborador[] });
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

  const linhas = useMemo(
    () => (dados ? resumirPorTecnico(dados.atividades, dados.avaliacoes, dados.colaboradores) : []),
    [dados],
  );

  const nomeMes = nomeDoMes(mes);
  const comTecnico = linhas.filter((l) => l.id !== null && l.realizadas > 0);
  const totalComTecnico = comTecnico.reduce((s, l) => s + l.realizadas, 0);
  const totalDias = comTecnico.reduce((s, l) => s + l.diasTrabalhados, 0);
  const total = dados?.atividades.length ?? 0;
  const estrelas = dados?.avaliacoes.map((r) => r.stars) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatório de atividades</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Atividades concluídas e avaliações dos clientes em {nomeMes}
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
            <CartaoNumero rotulo="Atividades realizadas" valor={total.toLocaleString('pt-BR')} detalhe={`${comTecnico.length} ${comTecnico.length === 1 ? 'técnico' : 'técnicos'} com atividade`} />
            <CartaoNumero rotulo="Média por técnico" valor={umaCasa(comTecnico.length ? totalComTecnico / comTecnico.length : null)} detalhe="atividades no mês" />
            <CartaoNumero rotulo="Média por dia trabalhado" valor={umaCasa(totalDias ? totalComTecnico / totalDias : null)} detalhe="atividades por técnico" />
            <CartaoNumero
              rotulo="Avaliação média"
              valor={estrelas.length ? `${umaCasa(media(estrelas))} ★` : '—'}
              detalhe={`${estrelas.length} ${estrelas.length === 1 ? 'avaliação' : 'avaliações'} no mês`}
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5">Técnico</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Realizadas</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Dias trabalhados</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Média por dia</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Avaliação média</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Avaliações</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {linhas.map((l) => (
                  <tr key={l.id ?? 'sem-tecnico'} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor ?? '#94A3B8' }} />
                        {l.nome}
                      </span>
                    </th>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{l.realizadas}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{l.diasTrabalhados}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{umaCasa(l.mediaPorDia)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {l.mediaEstrelas === null ? (
                        '—'
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {umaCasa(l.mediaEstrelas)} <Star size={12} className="fill-amber-400 text-amber-400" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{l.avaliacoes}</td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum técnico cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500">
            Dia trabalhado é o dia em que o técnico concluiu ao menos uma atividade. A avaliação conta no mês em que o cliente avaliou.
          </p>
        </div>
      )}
    </div>
  );
}
