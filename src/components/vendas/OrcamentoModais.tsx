import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  CatalogItemKind,
  Quote,
  QuoteResponseChannel,
  QuoteStandardText,
} from '../../types/vendas';
import { converterTextoParaCentavos } from '../../utils/dinheiro';
import { CORES_TIPO_ITEM, ROTULO_CANAL_ORCAMENTO, UNIDADES_CATALOGO } from './cores';
import {
  excluirTextoPadraoOrcamento,
  listarTextosPadraoOrcamento,
  registrarRespostaOrcamento,
  salvarTextoPadraoOrcamento,
} from './fonteDeDados';
import ModalDialogoVendas from './ModalDialogoVendas';

const CAMPO =
  'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

// ============================================================================
// 1. Modal: Gerenciar Textos Padrão de Observação (/orcamentos/textos)
// ============================================================================

interface ModalTextosPadraoOrcamentoProps {
  aberto: boolean;
  onFechar: () => void;
  onAlterado?: (lista: QuoteStandardText[]) => void;
}

export function ModalTextosPadraoOrcamento({
  aberto,
  onFechar,
  onAlterado,
}: ModalTextosPadraoOrcamentoProps) {
  const [textos, setTextos] = useState<QuoteStandardText[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    listarTextosPadraoOrcamento()
      .then((lista) => {
        if (ativo) setTextos(lista);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto]);

  const recarregar = async () => {
    const lista = await listarTextosPadraoOrcamento();
    setTextos(lista);
    onAlterado?.(lista);
  };

  const iniciarEdicao = (t: QuoteStandardText) => {
    setEditandoId(t.id);
    setTitulo(t.title);
    setConteudo(t.content);
    setErro(null);
  };

  const limparForm = () => {
    setEditandoId(null);
    setTitulo('');
    setConteudo('');
    setErro(null);
  };

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!titulo.trim() || !conteudo.trim()) {
      setErro('Informe o título do botão e o texto da observação.');
      return;
    }
    setSalvando(true);
    try {
      await salvarTextoPadraoOrcamento({
        id: editandoId ?? undefined,
        title: titulo,
        content: conteudo,
      });
      limparForm();
      await recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o texto padrão.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    setErro(null);
    try {
      await excluirTextoPadraoOrcamento(id);
      if (editandoId === id) limparForm();
      await recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o texto padrão.');
    }
  };

  return (
    <ModalDialogoVendas
      aberto={aberto}
      onFechar={onFechar}
      titulo="Observações padrão de orçamento"
      subtitulo="Textos prontos para inserir com um clique no campo de observações dos orçamentos."
      larguraMax="max-w-2xl"
    >
      <div className="space-y-4">
        <form
          onSubmit={(e) => void handleSalvar(e)}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
        >
          <div className="text-xs font-bold text-slate-800">
            {editandoId ? 'Editar texto padrão' : 'Novo texto padrão'}
          </div>
          <div>
            <label htmlFor="txt-pad-titulo" className="block text-xs font-medium text-slate-700">
              Título curto do chip *
            </label>
            <input
              id="txt-pad-titulo"
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Elétrica e dreno"
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="txt-pad-conteudo" className="block text-xs font-medium text-slate-700">
              Texto completo da observação *
            </label>
            <textarea
              id="txt-pad-conteudo"
              rows={2}
              required
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Ex.: Elétrica e dreno por conta do cliente."
              className={CAMPO}
            />
          </div>

          {erro && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {editandoId && (
              <button
                type="button"
                onClick={limparForm}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Cancelar edição
              </button>
            )}
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {editandoId ? 'Salvar alteração' : 'Adicionar texto padrão'}
            </button>
          </div>
        </form>

        {carregando ? (
          <p className="py-4 text-center text-xs text-slate-400">Carregando textos...</p>
        ) : textos.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            Nenhum texto padrão cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {textos.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-3 px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{t.title}</p>
                  <p className="mt-0.5 text-slate-600">{t.content}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(t)}
                    title="Editar texto"
                    aria-label={`Editar ${t.title}`}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExcluir(t.id)}
                    title="Excluir texto"
                    aria-label={`Excluir ${t.title}`}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalDialogoVendas>
  );
}

// ============================================================================
// 2. Modal: Registrar resposta manual do cliente ao orçamento
// ============================================================================

interface ModalRegistrarRespostaOrcamentoProps {
  aberto: boolean;
  orcamento: Quote;
  atorNome: string;
  onFechar: () => void;
  onSalvo: (atualizado: Quote) => void;
}

export function ModalRegistrarRespostaOrcamento({
  aberto,
  orcamento,
  atorNome,
  onFechar,
  onSalvo,
}: ModalRegistrarRespostaOrcamentoProps) {
  const [decisao, setDecisao] = useState<'aprovado' | 'recusado'>(
    orcamento.status === 'recusado' ? 'recusado' : 'aprovado',
  );
  const [canal, setCanal] = useState<Exclude<QuoteResponseChannel, 'link'>>('whatsapp');
  const [observacao, setObservacao] = useState(orcamento.response_note ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await registrarRespostaOrcamento(orcamento.id, {
        decisao,
        canal,
        observacao,
        atorNome,
      });
      onSalvo(atualizado);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar a resposta.');
    } finally {
      setSalvando(false);
    }
  };

  const canaisManuais: Exclude<QuoteResponseChannel, 'link'>[] = [
    'whatsapp',
    'telefone',
    'presencial',
    'email',
  ];

  return (
    <ModalDialogoVendas
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Registrar resposta · ${orcamento.number}`}
      subtitulo="Use quando o cliente aprovou ou recusou por mensagem, ligação ou no balcão."
      larguraMax="max-w-md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <fieldset>
          <legend className="block text-xs font-semibold text-slate-700">Resposta do cliente *</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
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
        </fieldset>

        <div>
          <label htmlFor="resp-orc-canal" className="block text-xs font-semibold text-slate-700">
            Canal da resposta *
          </label>
          <select
            id="resp-orc-canal"
            value={canal}
            onChange={(e) => setCanal(e.target.value as Exclude<QuoteResponseChannel, 'link'>)}
            className={CAMPO}
          >
            {canaisManuais.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CANAL_ORCAMENTO[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="resp-orc-obs" className="block text-xs font-medium text-slate-700">
            Observação (opcional)
          </label>
          <textarea
            id="resp-orc-obs"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Aprovou pelo WhatsApp com instalação agendada para quinta..."
            className={CAMPO}
          />
        </div>

        {erro && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
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
    </ModalDialogoVendas>
  );
}

// ============================================================================
// 3. Modal: Adicionar Item Avulso (sem cadastro no catálogo)
// ============================================================================

export interface ItemAvulsoResultado {
  name: string;
  kind: CatalogItemKind;
  unit: string;
  quantity: number;
  unit_price_cents: number;
}

interface ModalItemAvulsoProps {
  aberto: boolean;
  onFechar: () => void;
  onAdicionar: (item: ItemAvulsoResultado) => void;
}

export function ModalItemAvulso({
  aberto,
  onFechar,
  onAdicionar,
}: ModalItemAvulsoProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<CatalogItemKind>('produto');
  const [unidade, setUnidade] = useState('UN');
  const [quantidade, setQuantidade] = useState('1');
  const [valorTexto, setValorTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) {
      setErro('Informe a descrição do item avulso.');
      return;
    }
    const qtd = Number(quantidade.replace(',', '.'));
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErro('Informe uma quantidade maior que zero.');
      return;
    }
    const centavos = converterTextoParaCentavos(valorTexto);
    if (centavos === null || centavos <= 0) {
      setErro('Informe o valor unitário em reais (ex.: 120,00).');
      return;
    }
    onAdicionar({
      name: nome.trim(),
      kind: tipo,
      unit: unidade,
      quantity: qtd,
      unit_price_cents: centavos,
    });
    onFechar();
  };

  return (
    <ModalDialogoVendas
      aberto={aberto}
      onFechar={onFechar}
      titulo="Adicionar item avulso"
      subtitulo="Item pontual sem cadastro no catálogo (marcado como Avulso)."
      larguraMax="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <fieldset>
          <legend className="block text-xs font-semibold text-slate-700">Tipo *</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(['produto', 'servico'] as const).map((op) => (
              <label
                key={op}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                  tipo === op
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="tipo-avulso"
                  checked={tipo === op}
                  onChange={() => {
                    setTipo(op);
                    setUnidade(op === 'servico' ? 'SRV' : 'UN');
                  }}
                />
                <span>{CORES_TIPO_ITEM[op].rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="avulso-nome" className="block text-xs font-semibold text-slate-700">
            Descrição do item *
          </label>
          <input
            id="avulso-nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Suporte especial sob medida em cantoneira"
            className={CAMPO}
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label htmlFor="avulso-qtd" className="block text-xs font-semibold text-slate-700">
              Qtd. *
            </label>
            <input
              id="avulso-qtd"
              type="text"
              inputMode="decimal"
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="avulso-un" className="block text-xs font-semibold text-slate-700">
              Unid.
            </label>
            <select
              id="avulso-un"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className={CAMPO}
            >
              {UNIDADES_CATALOGO.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="avulso-valor" className="block text-xs font-semibold text-slate-700">
              Valor unit. (R$) *
            </label>
            <input
              id="avulso-valor"
              type="text"
              inputMode="decimal"
              required
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              placeholder="150,00"
              className={CAMPO}
            />
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            Incluir item avulso
          </button>
        </div>
      </form>
    </ModalDialogoVendas>
  );
}

