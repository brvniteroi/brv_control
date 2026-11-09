import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  FileImage,
  Loader2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  anexarFotoItem,
  autorizarDescarte,
  cancelarItem,
  criarOsDevolucao,
  itensDaOS,
  registrarOrcamento,
  registrarResposta,
} from '../../services/oficina';
import { listarTipos } from '../../services/ordens';
import type { ServiceType } from '../../types/fsm';
import type { CanalResposta, DecisaoCliente, ItemOficinaTela } from '../../types/oficina';
import {
  ROTULO_CANAL,
  descricaoItem,
  numeroItem,
} from '../../utils/oficina';

// 16 px no celular (o navegador não dá zoom ao tocar), 14 px no computador
const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm';

function converterMoedaParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/[R$\s]/g, '');
  if (!limpo) return null;
  // Se digitou vírgula como separador decimal (ex.: 1.250,50 ou 450,00)
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : Number.NaN;
}

function useAbrirDialogo(ref: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, [ref]);
}

// =====================================================================
// 1. Modal: Registrar orçamento (SicWeb)
// =====================================================================

interface ModalRegistrarOrcamentoProps {
  item: ItemOficinaTela;
  onFechar: () => void;
  onSalvo: () => Promise<void> | void;
}

export function ModalRegistrarOrcamento({
  item,
  onFechar,
  onSalvo,
}: ModalRegistrarOrcamentoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAbrirDialogo(dialogRef);

  const [referencia, setReferencia] = useState(item.quote_reference ?? '');
  const [valorTexto, setValorTexto] = useState(
    item.quote_amount != null && item.quote_amount !== ''
      ? Number(item.quote_amount).toFixed(2).replace('.', ',')
      : '',
  );
  const [enviado, setEnviado] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!referencia.trim() && !valorTexto.trim()) {
      setErro('Informe o número do orçamento no SicWeb ou o valor.');
      return;
    }

    const valor = converterMoedaParaNumero(valorTexto);
    if (Number.isNaN(valor)) {
      setErro('Informe um valor válido em reais (ex.: 450,00).');
      return;
    }

    setSalvando(true);
    try {
      await registrarOrcamento(item.id, {
        referencia,
        valor,
        enviado,
      });
      await onSalvo();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar o orçamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-modal-orcamento"
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-blue-600" />
          <h3 id="titulo-modal-orcamento" className="text-base font-bold text-slate-900">
            Registrar orçamento
          </h3>
        </div>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label htmlFor="orc-ref" className="block text-xs font-medium text-slate-700">
            Nº do orçamento no SicWeb
          </label>
          <input
            id="orc-ref"
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ex.: 8421"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="orc-valor" className="block text-xs font-medium text-slate-700">
            Valor do orçamento (R$)
          </label>
          <input
            id="orc-valor"
            type="text"
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            placeholder="Ex.: 450,00"
            className={INPUT}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={enviado}
            onChange={(e) => setEnviado(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Já enviado ao cliente (passar para "Aguardando cliente")</span>
        </label>

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Salvar orçamento
          </button>
        </div>
      </form>
    </dialog>
  );
}

// =====================================================================
// 2. Modal: Registrar resposta do cliente
// =====================================================================

interface ModalRespostaClienteProps {
  item: ItemOficinaTela;
  onFechar: () => void;
  onSalvo: () => Promise<void> | void;
}

export function ModalRespostaCliente({
  item,
  onFechar,
  onSalvo,
}: ModalRespostaClienteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAbrirDialogo(dialogRef);

  const [decisao, setDecisao] = useState<DecisaoCliente>(item.decision ?? 'aprovado');
  const [canal, setCanal] = useState<CanalResposta | ''>(item.decision_channel ?? 'whatsapp');
  const [observacao, setObservacao] = useState(item.decision_note ?? '');
  const [faltaPeca, setFaltaPeca] = useState(
    item.parts_status === 'a_comprar' || item.parts_status === 'comprada',
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!canal) {
      setErro('Escolha o canal por onde o cliente respondeu.');
      return;
    }

    setSalvando(true);
    try {
      await registrarResposta(item.id, {
        decisao,
        canal,
        observacao,
        faltaPeca: decisao === 'aprovado' ? faltaPeca : false,
      });
      await onSalvo();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar a resposta.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-modal-resposta"
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 id="titulo-modal-resposta" className="text-base font-bold text-slate-900">
          Registrar resposta do cliente
        </h3>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <span className="block text-xs font-semibold text-slate-700">Resposta *</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Resposta do cliente">
            <button
              type="button"
              aria-pressed={decisao === 'aprovado'}
              onClick={() => setDecisao('aprovado')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                decisao === 'aprovado'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 size={15} />
              Aprovado
            </button>
            <button
              type="button"
              aria-pressed={decisao === 'recusado'}
              onClick={() => setDecisao('recusado')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                decisao === 'recusado'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <XCircle size={15} />
              Recusado
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="resp-canal" className="block text-xs font-semibold text-slate-700">
            Canal da resposta *
          </label>
          <select
            id="resp-canal"
            required
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalResposta)}
            className={INPUT}
          >
            <option value="">Escolha...</option>
            {(Object.entries(ROTULO_CANAL) as [CanalResposta, string][]).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        {decisao === 'aprovado' ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={faltaPeca}
              onChange={(e) => setFaltaPeca(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Falta peça?{' '}
              <span className="text-slate-500">
                ({faltaPeca ? 'segue para Aguardando peça' : 'segue direto para Em reparo'})
              </span>
            </span>
          </label>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            O item seguirá para <strong>Pronto</strong> para ser devolvido sem conserto. Se o cliente autorizou o
            descarte do aparelho, use o botão <strong>"Cliente autorizou o descarte"</strong>.
          </p>
        )}

        <div>
          <label htmlFor="resp-obs" className="block text-xs font-medium text-slate-700">
            Observação (opcional)
          </label>
          <textarea
            id="resp-obs"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Aprovou pelo WhatsApp com pagamento na entrega..."
            className={INPUT}
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Salvar resposta
          </button>
        </div>
      </form>
    </dialog>
  );
}

// =====================================================================
// 3. Modal: Cliente autorizou o descarte
// =====================================================================

interface ModalAutorizarDescarteProps {
  item: ItemOficinaTela;
  onFechar: () => void;
  onSalvo: () => Promise<void> | void;
}

export function ModalAutorizarDescarte({
  item,
  onFechar,
  onSalvo,
}: ModalAutorizarDescarteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAbrirDialogo(dialogRef);

  const [canal, setCanal] = useState<CanalResposta | ''>('whatsapp');
  const [descricao, setDescricao] = useState('');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!canal) {
      setErro('Escolha o canal por onde o cliente autorizou o descarte.');
      return;
    }
    if (!descricao.trim()) {
      setErro('Descreva quem autorizou o descarte e como.');
      return;
    }

    setSalvando(true);
    try {
      // Envia o comprovante antes de finalizar o descarte para garantir que a foto fique salva
      if (comprovante) {
        await anexarFotoItem(
          comprovante,
          item.id,
          'documento',
          'Comprovante de autorização de descarte',
        );
      }
      await autorizarDescarte(item, {
        canal,
        descricao: descricao.trim(),
      });
      await onSalvo();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar o descarte.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-modal-descarte"
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle size={18} />
          <h3 id="titulo-modal-descarte" className="text-base font-bold">
            Cliente autorizou o descarte
          </h3>
        </div>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-950">
          Fica registrado na OS de origem e não pode ser desfeito.
        </div>

        <div>
          <label htmlFor="desc-canal" className="block text-xs font-semibold text-slate-700">
            Canal da autorização *
          </label>
          <select
            id="desc-canal"
            required
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalResposta)}
            className={INPUT}
          >
            <option value="">Escolha...</option>
            {(Object.entries(ROTULO_CANAL) as [CanalResposta, string][]).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="desc-detalhe" className="block text-xs font-semibold text-slate-700">
            Quem autorizou e como *
          </label>
          <textarea
            id="desc-detalhe"
            rows={3}
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Sr. Carlos (proprietário) autorizou o descarte por mensagem no WhatsApp às 14:20."
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="desc-print" className="block text-xs font-semibold text-slate-700">
            Anexar print da conversa (opcional)
          </label>
          <label
            htmlFor="desc-print"
            className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <FileImage size={16} className="shrink-0 text-blue-600" />
            <span className="truncate">
              {comprovante ? comprovante.name : 'Escolher imagem (salva como comprovante)'}
            </span>
          </label>
          <input
            id="desc-print"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Confirmar descarte
          </button>
        </div>
      </form>
    </dialog>
  );
}

// =====================================================================
// 4. Modal: Criar OS de devolução
// =====================================================================

interface ModalCriarOsDevolucaoProps {
  item: ItemOficinaTela;
  onFechar: () => void;
  onCriada: (novaOsId: string) => Promise<void> | void;
}

export function ModalCriarOsDevolucao({
  item,
  onFechar,
  onCriada,
}: ModalCriarOsDevolucaoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAbrirDialogo(dialogRef);

  const [tipos, setTipos] = useState<ServiceType[]>([]);
  const [outrosProntos, setOutrosProntos] = useState<ItemOficinaTela[]>([]);
  const [selecionadosExtras, setSelecionadosExtras] = useState<string[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const [listaTipos, irmãos] = await Promise.all([
          listarTipos(),
          item.service_order_id ? itensDaOS(item.service_order_id) : Promise.resolve([]),
        ]);
        if (!ativo) return;
        const ativos = listaTipos.filter((t) => t.active);
        setTipos(ativos);
        const sugerido = ativos.find((t) => /devolu|entrega|instala/i.test(t.name));
        if (sugerido) setTipoId(sugerido.id);

        const prontos = irmãos.filter(
          (i) =>
            i.id !== item.id &&
            i.service_order_id === item.service_order_id &&
            i.status === 'pronto' &&
            !i.return_service_order_id,
        );
        setOutrosProntos(prontos);
        setSelecionadosExtras(prontos.map((p) => p.id));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os tipos de serviço.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [item.id, item.service_order_id]);

  const alternarExtra = (id: string) => {
    setSelecionadosExtras((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!tipoId) {
      setErro('Escolha o tipo de serviço da OS de devolução.');
      return;
    }

    setSalvando(true);
    try {
      const novaOsId = await criarOsDevolucao(
        [item.id, ...selecionadosExtras],
        tipoId,
        descricao.trim() || undefined,
      );
      await onCriada(novaOsId);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a OS de devolução.');
    } finally {
      setSalvando(false);
    }
  };

  const totalIrmaos = outrosProntos.length + 1;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-modal-devolucao"
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-emerald-600" />
          <h3 id="titulo-modal-devolucao" className="text-base font-bold text-slate-900">
            Criar OS de devolução
          </h3>
        </div>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {carregando ? (
          <p className="py-4 text-center text-xs text-slate-400">Carregando tipos de serviço...</p>
        ) : (
          <>
            <div>
              <label htmlFor="dev-tipo" className="block text-xs font-semibold text-slate-700">
                Tipo de serviço *
              </label>
              <select
                id="dev-tipo"
                required
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
                className={INPUT}
              >
                <option value="">Escolha...</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {outrosProntos.length > 0 && (
              <div>
                <span className="block text-xs font-semibold text-slate-700">
                  Outros itens prontos desta OS (levar juntos)
                </span>
                <div className="mt-1.5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {outrosProntos.map((outro) => (
                    <label key={outro.id} className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selecionadosExtras.includes(outro.id)}
                        onChange={() => alternarExtra(outro.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <strong className="text-slate-800">{numeroItem(outro, totalIrmaos)}</strong>
                        <span className="block text-slate-500">{descricaoItem(outro)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="dev-desc" className="block text-xs font-medium text-slate-700">
                Descrição da OS (opcional)
              </label>
              <textarea
                id="dev-desc"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Observações para a equipe que fará a entrega/instalação..."
                className={INPUT}
              />
            </div>

            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              A OS será criada sem atividade agendada. Agende a visita depois pela Linha do Tempo.
            </p>
          </>
        )}

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || carregando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Criar OS de devolução
          </button>
        </div>
      </form>
    </dialog>
  );
}

// =====================================================================
// 5. Modal: Cancelar entrada
// =====================================================================

interface ModalCancelarItemProps {
  item: ItemOficinaTela;
  onFechar: () => void;
  onSalvo: () => Promise<void> | void;
}

export function ModalCancelarItem({
  item,
  onFechar,
  onSalvo,
}: ModalCancelarItemProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useAbrirDialogo(dialogRef);

  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!motivo.trim()) {
      setErro('Informe o motivo do cancelamento.');
      return;
    }

    setSalvando(true);
    try {
      await cancelarItem(item.id, motivo);
      await onSalvo();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cancelar a entrada.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-modal-cancelar"
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 id="titulo-modal-cancelar" className="text-base font-bold text-slate-900">
          Cancelar entrada
        </h3>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="text-slate-400 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <p className="text-xs text-slate-600">
          Informe o motivo do cancelamento deste item da oficina (ex.: lançamento duplicado).
        </p>

        <div>
          <label htmlFor="canc-motivo" className="block text-xs font-semibold text-slate-700">
            Motivo do cancelamento *
          </label>
          <textarea
            id="canc-motivo"
            rows={3}
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo..."
            className={INPUT}
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Confirmar cancelamento
          </button>
        </div>
      </form>
    </dialog>
  );
}

