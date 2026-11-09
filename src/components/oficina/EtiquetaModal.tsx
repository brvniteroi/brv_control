import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { useSituacaoImpressora } from '../../hooks/useOficina';
import {
  acompanharPedido,
  cancelarPedido,
  pedidosDoItem,
  pedirEtiqueta,
} from '../../services/oficina';
import type { ItemOficinaTela, PedidoImpressao, SituacaoImpressao } from '../../types/oficina';
import {
  dadosEtiqueta,
  htmlEtiqueta,
  imprimirPeloNavegador,
  type LarguraEtiqueta,
} from '../../utils/etiquetaOficina';
import { formatarDataHora } from '../../utils/ordens';
import { IndicadorElgin } from './SituacaoElgin';

const CHAVE_LARGURA = 'brv:oficina:largura-etiqueta';

function lerLarguraSalva(): LarguraEtiqueta {
  try {
    const salvo = localStorage.getItem(CHAVE_LARGURA);
    return salvo === '80' ? 80 : 100;
  } catch {
    return 100;
  }
}

function salvarLargura(largura: LarguraEtiqueta): void {
  try {
    localStorage.setItem(CHAVE_LARGURA, String(largura));
  } catch {
    // Navegador sem permissão de armazenamento local: segue com o valor em memória
  }
}

const ROTULO_FILA: Record<SituacaoImpressao, string> = {
  pendente: 'Na fila',
  imprimindo: 'Imprimindo',
  impressa: 'Impressa',
  falhou: 'Falhou',
  cancelada: 'Cancelada',
};

const CLASSE_FILA: Record<SituacaoImpressao, string> = {
  pendente: 'border-amber-200 bg-amber-50 text-amber-800',
  imprimindo: 'border-blue-200 bg-blue-50 text-blue-700',
  impressa: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  falhou: 'border-red-200 bg-red-50 text-red-700',
  cancelada: 'border-slate-200 bg-slate-100 text-slate-500',
};

interface EtiquetaModalProps {
  item: ItemOficinaTela;
  totalNaOs?: number;
  onFechar: () => void;
}

export default function EtiquetaModal({ item, totalNaOs, onFechar }: EtiquetaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { online, agente } = useSituacaoImpressora();

  const [largura, setLargura] = useState<LarguraEtiqueta>(() => lerLarguraSalva());
  const [copias, setCopias] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [pedidoAtual, setPedidoAtual] = useState<PedidoImpressao | null>(null);
  const [semRespostaAgente, setSemRespostaAgente] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [historico, setHistorico] = useState<PedidoImpressao[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  const carregarHistorico = useCallback(async () => {
    try {
      const lista = await pedidosDoItem(item.id);
      setHistorico(lista);
    } catch {
      // Histórico é complementar; não bloqueia a impressão
    }
  }, [item.id]);

  useEffect(() => {
    let ativo = true;
    pedidosDoItem(item.id)
      .then((lista) => {
        if (ativo) setHistorico(lista);
      })
      .catch(() => {
        // Histórico é complementar; não bloqueia a impressão
      })
      .finally(() => {
        if (ativo) setCarregandoHistorico(false);
      });
    return () => {
      ativo = false;
    };
  }, [item.id]);

  const escolherLargura = (nova: LarguraEtiqueta) => {
    setLargura(nova);
    salvarLargura(nova);
  };

  const dados = useMemo(() => dadosEtiqueta(item, totalNaOs), [item, totalNaOs]);
  const htmlPrevia = useMemo(() => htmlEtiqueta(dados, largura, true), [dados, largura]);

  const imprimirElgin = async () => {
    setEnviando(true);
    setErroAcao(null);
    setSemRespostaAgente(false);
    try {
      const novo = await pedirEtiqueta(item, { copias, largura, totalNaOs });
      setPedidoAtual(novo);
      void carregarHistorico();

      const final = await acompanharPedido(novo.id, (atualizado) => {
        setPedidoAtual(atualizado);
      });
      if (final) setPedidoAtual(final);
      if (final?.status === 'pendente') {
        setSemRespostaAgente(true);
      }
      await carregarHistorico();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível enviar a etiqueta para a fila.');
    } finally {
      setEnviando(false);
    }
  };

  const handleImprimirNavegador = () => {
    setErroAcao(null);
    try {
      // Direto no clique (sem await antes): evita bloqueio de janela no celular
      imprimirPeloNavegador(dados, largura);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível preparar a impressão no navegador.');
    }
  };

  const handleCancelarPedido = async (id: string) => {
    setCancelandoId(id);
    setErroAcao(null);
    try {
      await cancelarPedido(id);
      if (pedidoAtual?.id === id) {
        setPedidoAtual((atual) => (atual ? { ...atual, status: 'cancelada' } : null));
        setSemRespostaAgente(false);
      }
      await carregarHistorico();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setCancelandoId(null);
    }
  };

  // Em 96 dpi CSS: 100mm ≈ 378px, 80mm ≈ 302px, 50mm ≈ 189px
  const larguraPx = largura === 100 ? 378 : 302;
  const alturaPx = 189;
  const elginOffline = online === false;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      aria-labelledby="titulo-modal-etiqueta"
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Printer size={18} />
          </div>
          <div>
            <h2 id="titulo-modal-etiqueta" className="text-base font-bold text-slate-900">
              Etiqueta · {dados.numero}
            </h2>
            <p className="text-xs text-slate-500">Elgin L42PRO ({largura} × 50 mm)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {/* Situação da impressora */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <IndicadorElgin online={online} agente={agente} />
          {elginOffline && (
            <span className="text-[11px] font-medium text-amber-700">
              Você pode imprimir pelo navegador abaixo
            </span>
          )}
        </div>

        {/* Pré-visualização simulando o rolo */}
        <div className="flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/80 px-2 py-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pré-visualização do rolo ({largura} × 50 mm)
          </div>
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{ height: alturaPx }}
          >
            <div className="origin-center scale-[0.76] rounded-md border border-dashed border-slate-400 bg-white shadow-sm sm:scale-100">
              <iframe
                title={`Pré-visualização da etiqueta ${dados.numero}`}
                srcDoc={htmlPrevia}
                sandbox=""
                style={{ width: larguraPx, height: alturaPx }}
                className="pointer-events-none block border-0 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Opções: Largura e Cópias */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold text-slate-700">Largura da etiqueta</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Largura da etiqueta">
              {([100, 80] as const).map((op) => {
                const ativa = largura === op;
                return (
                  <button
                    key={op}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => escolherLargura(op)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      ativa
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {op} mm {op === 100 ? '(padrão)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700">Cópias (1 a 5)</span>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                aria-label="Diminuir cópias"
                disabled={copias <= 1}
                onClick={() => setCopias((c) => Math.max(1, c - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-12 text-center text-sm font-bold tabular-nums text-slate-900">
                {copias}
              </span>
              <button
                type="button"
                aria-label="Aumentar cópias"
                disabled={copias >= 5}
                onClick={() => setCopias((c) => Math.min(5, c + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Retorno ao vivo do pedido atual */}
        {pedidoAtual && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-medium ${
              pedidoAtual.status === 'impressa'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : pedidoAtual.status === 'falhou' || semRespostaAgente
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {pedidoAtual.status === 'impressa' ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                ) : pedidoAtual.status === 'falhou' ? (
                  <XCircle size={16} className="shrink-0 text-red-600" />
                ) : semRespostaAgente ? (
                  <AlertTriangle size={16} className="shrink-0 text-red-600" />
                ) : (
                  <Loader2 size={16} className="shrink-0 animate-spin text-blue-600" />
                )}

                <span className="font-semibold">
                  {semRespostaAgente
                    ? 'O servidor da loja não respondeu'
                    : pedidoAtual.status === 'pendente'
                      ? 'Na fila...'
                      : pedidoAtual.status === 'imprimindo'
                        ? 'Imprimindo...'
                        : pedidoAtual.status === 'impressa'
                          ? 'Impressa'
                          : pedidoAtual.status === 'falhou'
                            ? `Não imprimiu: ${pedidoAtual.error || 'falha na impressora'}`
                            : 'Pedido cancelado'}
                </span>
              </div>

              {(pedidoAtual.status === 'falhou' || semRespostaAgente) && !enviando && (
                <button
                  type="button"
                  onClick={() => void imprimirElgin()}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <RefreshCw size={12} /> Tentar de novo
                </button>
              )}
            </div>
          </div>
        )}

        {erroAcao && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {erroAcao}
          </div>
        )}

        {/* Botões de ação */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={enviando}
            onClick={() => void imprimirElgin()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />}
            Imprimir na Elgin
          </button>

          <button
            type="button"
            onClick={handleImprimirNavegador}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
              elginOffline
                ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-2xs hover:bg-amber-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Globe size={15} />
            Imprimir pelo navegador
          </button>

          <p className="text-center text-[11px] text-slate-500">
            No Chrome, em Margens escolha Nenhuma.
          </p>
        </div>

        {/* Histórico de impressões do item */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Histórico de impressões deste item
          </h3>

          {carregandoHistorico ? (
            <p className="mt-2 text-xs text-slate-400">Carregando histórico...</p>
          ) : historico.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Nenhuma etiqueta impressa ainda para este item.</p>
          ) : (
            <ul className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {historico.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-700">{formatarDataHora(p.created_at)}</span>
                    <span className="text-slate-400">
                      {' · '}
                      {p.requested_by_name || 'Usuário'}
                      {p.copies > 1 ? ` · ${p.copies} cópias` : ''}
                    </span>
                    {p.status === 'falhou' && p.error && (
                      <p className="truncate text-[11px] text-red-600">{p.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASSE_FILA[p.status]}`}
                    >
                      {ROTULO_FILA[p.status]}
                    </span>
                    {p.status === 'pendente' && (
                      <button
                        type="button"
                        disabled={cancelandoId === p.id}
                        onClick={() => void handleCancelarPedido(p.id)}
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
