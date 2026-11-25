import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  GripVertical,
  History,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShoppingBag,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { listarEnderecosDoCliente } from '../../services/ordens';
import type { Customer, CustomerAddress, PersonType } from '../../types/fsm';
import type {
  CatalogItem,
  CatalogItemKind,
  Quote,
  QuoteEvent,
  QuoteStandardText,
  SellerOption,
} from '../../types/vendas';
import {
  calcularLinhaItemCentavos,
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
  type ModoDescontoLinha,
} from '../../utils/dinheiro';
import { formatarData, formatarDataHora, rotuloEndereco } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import SeletorCliente from '../ordens/SeletorCliente';
import { CORES_SITUACAO_ORCAMENTO, ROTULO_CANAL_ORCAMENTO } from './cores';
import { CLIENTES_DEMO_VENDAS } from './dadosDemo';
import { OrcamentoDocumentoModal } from './FolhaOrcamentoVenda';
import {
  anotarNoHistoricoOrcamento,
  buscarItensParaBusca,
  buscarOrcamento,
  duplicarOrcamento,
  excluirOrcamento,
  gerarNovoLinkOrcamento,
  gerarOsDoOrcamento,
  historicoDoOrcamento,
  listarTextosPadraoOrcamento,
  listarVendedores,
  reabrirOrcamento,
  registrarEnvioOrcamento,
  salvarOrcamento,
} from './fonteDeDados';
import {
  ModalItemAvulso,
  ModalRegistrarRespostaOrcamento,
  ModalTextosPadraoOrcamento,
  type ItemAvulsoResultado,
} from './OrcamentoModais';
import {
  abrirLinkNaJanelaWhatsApp,
  dataIsoHoje,
  diasOrcamentoVencido,
  linkPublicoOrcamento,
  prepararJanelaWhatsApp,
  recalcularTotaisOrcamentoOuVenda,
  situacaoOrcamento,
  somarDiasIso,
  textoWhatsAppOrcamento,
} from './regrasVendas';

const CAMPO =
  'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500';

interface LinhaEditor {
  uid: string;
  catalog_item_id: string | null;
  is_custom: boolean;
  kind: CatalogItemKind;
  code: string;
  name: string;
  unit: string;
  quantityTexto: string;
  unitPriceTexto: string;
  discountMode: ModoDescontoLinha;
  discountTexto: string;
  controlsStock?: boolean;
  stockQuantity?: number;
}

function parseQuantidade(texto: string): number {
  const n = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseDescontoEntrada(modo: ModoDescontoLinha, texto: string): number {
  if (!texto.trim()) return 0;
  if (modo === 'percentual') {
    const pct = Number(texto.trim().replace(',', '.'));
    return Number.isFinite(pct) && pct >= 0 ? Math.min(100, pct) : 0;
  }
  return converterTextoParaCentavos(texto) ?? 0;
}

interface OrcamentoEditorProps {
  /** ID do orçamento existente, ou `'novo'` para criar um do zero. */
  orcamentoId: string | 'novo';
  onFechar: () => void;
  onSalvo: () => void;
  onTrocarOrcamento: (novoId: string) => void;
}

export default function OrcamentoEditor({
  orcamentoId,
  onFechar,
  onSalvo,
  onTrocarOrcamento,
}: OrcamentoEditorProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Equipe BRV';
  const ehNovo = orcamentoId === 'novo';

  const [orcamento, setOrcamento] = useState<Quote | null>(null);
  const [carregando, setCarregando] = useState(!ehNovo);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  // Cliente e vendedor
  const [consumidorFinal, setConsumidorFinal] = useState(false);
  const [cliente, setCliente] = useState<{
    id: string;
    name: string;
    person_type?: PersonType;
    document?: string | null;
  } | null>(null);
  const [enderecos, setEnderecos] = useState<{ id: string; rotulo: string }[]>([]);
  const [enderecoId, setEnderecoId] = useState('');
  const [enderecoTextoLivre, setEnderecoTextoLivre] = useState('');
  const [contatoNome, setContatoNome] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [vendedores, setVendedores] = useState<SellerOption[]>([]);
  const [vendedorId, setVendedorId] = useState('');

  // Itens (Produtos e Serviços)
  const [linhas, setLinhas] = useState<LinhaEditor[]>([]);
  const [buscaItem, setBuscaItem] = useState('');
  const [sugestoesCatalogo, setSugestoesCatalogo] = useState<CatalogItem[]>([]);
  const [buscaAberta, setBuscaAberta] = useState(false);

  // Condições e observações
  const [validadeDias, setValidadeDias] = useState('10');
  const [descontoGeralTexto, setDescontoGeralTexto] = useState('');
  const [freteTexto, setFreteTexto] = useState('');
  const [condicaoPagamento, setCondicaoPagamento] = useState(
    'PIX à vista ou cartão de crédito em até 6x',
  );
  const [observacoes, setObservacoes] = useState('');
  const [observacaoInterna, setObservacaoInterna] = useState('');
  const [textosPadrao, setTextosPadrao] = useState<QuoteStandardText[]>([]);

  // Histórico
  const [eventos, setEventos] = useState<QuoteEvent[]>([]);
  const [notaHistorico, setNotaHistorico] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  // Estados de ação e modais
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoLink, setCopiadoLink] = useState(false);

  const [modalAvulsoAberto, setModalAvulsoAberto] = useState(false);
  const [modalTextosAberto, setModalTextosAberto] = useState(false);
  const [modalRespostaAberto, setModalRespostaAberto] = useState(false);
  const [modalDocAberto, setModalDocAberto] = useState(false);

  const preencherDoOrcamento = useCallback((orc: Quote) => {
    setOrcamento(orc);
    if (orc.customer_id) {
      setConsumidorFinal(false);
      setCliente({
        id: orc.customer_id,
        name: orc.customer_name,
        person_type: orc.customer_person_type,
        document: orc.customer_document,
      });
    } else {
      setConsumidorFinal(true);
      setCliente(null);
    }
    setEnderecoId(orc.address_id ?? '');
    setEnderecoTextoLivre(orc.address_text ?? '');
    setContatoNome(orc.contact_name ?? '');
    setContatoTelefone(orc.contact_phone ? formatarTelefone(orc.contact_phone) : '');
    setVendedorId(orc.seller_id ?? '');
    setValidadeDias(String(orc.validity_days || 10));
    setDescontoGeralTexto(
      orc.general_discount_cents > 0
        ? centavosParaTextoInput(orc.general_discount_cents)
        : '',
    );
    setFreteTexto(
      orc.freight_cents > 0 ? centavosParaTextoInput(orc.freight_cents) : '',
    );
    setCondicaoPagamento(orc.payment_terms_note ?? '');
    setObservacoes(orc.notes ?? '');
    setObservacaoInterna(orc.internal_notes ?? '');
    setLinhas(
      orc.items.map((item) => ({
        uid: item.id,
        catalog_item_id: item.catalog_item_id,
        is_custom: item.is_custom,
        kind: item.kind,
        code: item.code,
        name: item.name,
        unit: item.unit,
        quantityTexto: String(item.quantity).replace('.', ','),
        unitPriceTexto: centavosParaTextoInput(item.unit_price_cents),
        discountMode: item.discount_mode,
        discountTexto:
          item.discount_input > 0
            ? item.discount_mode === 'percentual'
              ? String(item.discount_input).replace('.', ',')
              : centavosParaTextoInput(item.discount_input)
            : '',
      })),
    );
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarVendedores(), listarTextosPadraoOrcamento()])
      .then(([listaVend, listaTxt]) => {
        if (!ativo) return;
        setVendedores(listaVend);
        setTextosPadrao(listaTxt);
        if (ehNovo) {
          setVendedorId(listaVend[0]?.id ?? '');
          setObservacoes(
            listaTxt
              .slice(0, 2)
              .map((t) => t.content)
              .join('\n'),
          );
        }
      })
      .catch(() => {});

    if (!ehNovo) {
      Promise.all([buscarOrcamento(orcamentoId), historicoDoOrcamento(orcamentoId)])
        .then(([achado, hist]) => {
          if (!ativo) return;
          if (!achado) {
            setErroCarga('Orçamento não encontrado.');
            return;
          }
          preencherDoOrcamento(achado);
          setEventos(hist);
        })
        .catch((e: unknown) => {
          if (ativo) {
            setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar orçamento.');
          }
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }
    return () => {
      ativo = false;
    };
  }, [orcamentoId, ehNovo, preencherDoOrcamento]);

  // Carrega endereços quando um cliente é selecionado
  const clienteId = cliente?.id ?? null;
  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    const demoCli = CLIENTES_DEMO_VENDAS.find((c) => c.id === clienteId);
    if (demoCli) {
      const opcoes = demoCli.addresses.map((a) => ({
        id: a.id,
        rotulo: `${a.label}: ${a.text}`,
      }));
      Promise.resolve().then(() => {
        if (!ativo) return;
        setEnderecos(opcoes);
        setEnderecoId((atual) => atual || (opcoes[0]?.id ?? ''));
        setEnderecoTextoLivre((atual) => atual || (demoCli.addresses[0]?.text ?? ''));
      });
      return () => {
        ativo = false;
      };
    }

    listarEnderecosDoCliente(clienteId)
      .then((lista: CustomerAddress[]) => {
        if (!ativo) return;
        const ativos = lista.filter((e) => e.active);
        const opcoes = ativos.map((e) => ({ id: e.id, rotulo: rotuloEndereco(e) }));
        setEnderecos(opcoes);
        const princ = ativos.find((e) => e.is_primary) ?? ativos[0];
        if (princ) {
          setEnderecoId((atual) => atual || princ.id);
          setEnderecoTextoLivre((atual) => atual || rotuloEndereco(princ));
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  // Busca rápida de itens no catálogo
  useEffect(() => {
    if (!buscaAberta) return;
    let ativo = true;
    const timer = setTimeout(() => {
      buscarItensParaBusca(buscaItem)
        .then((lista) => {
          if (ativo) setSugestoesCatalogo(lista);
        })
        .catch(() => {});
    }, 100);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [buscaItem, buscaAberta]);

  const situacaoExibida = useMemo(() => {
    if (!orcamento) return 'rascunho' as const;
    return situacaoOrcamento(orcamento);
  }, [orcamento]);

  // Enviado/aprovado/convertido não edita valores direto (para enviado, usa "Reabrir para editar")
  const somenteLeitura =
    !ehNovo &&
    orcamento !== null &&
    (orcamento.status === 'aprovado' ||
      orcamento.status === 'convertido' ||
      orcamento.status === 'enviado');

  const adicionarItemCatalogo = (item: CatalogItem) => {
    setLinhas((atuais) => {
      const existenteIdx = atuais.findIndex(
        (l) => !l.is_custom && l.catalog_item_id === item.id,
      );
      if (existenteIdx >= 0) {
        const copia = atuais.slice();
        const atual = copia[existenteIdx];
        const novaQtd = parseQuantidade(atual.quantityTexto) + 1;
        copia[existenteIdx] = {
          ...atual,
          quantityTexto: String(novaQtd).replace('.', ','),
        };
        return copia;
      }
      return [
        ...atuais,
        {
          uid: `lin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          catalog_item_id: item.id,
          is_custom: false,
          kind: item.kind,
          code: item.code,
          name: item.name,
          unit: item.unit,
          quantityTexto: '1',
          unitPriceTexto: centavosParaTextoInput(item.sale_price_cents),
          discountMode: 'valor',
          discountTexto: '',
          controlsStock: item.controls_stock,
          stockQuantity: item.stock_quantity,
        },
      ];
    });
    setBuscaItem('');
    setBuscaAberta(false);
  };

  const adicionarItemAvulso = (av: ItemAvulsoResultado) => {
    setLinhas((atuais) => [
      ...atuais,
      {
        uid: `avulso-${Date.now()}`,
        catalog_item_id: null,
        is_custom: true,
        kind: av.kind,
        code: 'AVULSO',
        name: av.name,
        unit: av.unit,
        quantityTexto: String(av.quantity).replace('.', ','),
        unitPriceTexto: centavosParaTextoInput(av.unit_price_cents),
        discountMode: 'valor',
        discountTexto: '',
      },
    ]);
  };

  const atualizarLinha = (uid: string, parcial: Partial<LinhaEditor>) => {
    setLinhas((atuais) => atuais.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)));
  };

  const removerLinha = (uid: string) => {
    setLinhas((atuais) => atuais.filter((l) => l.uid !== uid));
  };

  const reordenarPorTipo = (tipoTabela: CatalogItemKind, resultado: DropResult) => {
    if (!resultado.destination || somenteLeitura) return;
    const origIdx = resultado.source.index;
    const destIdx = resultado.destination.index;
    if (origIdx === destIdx) return;

    setLinhas((atuais) => {
      const doTipo = atuais.filter((l) => l.kind === tipoTabela);
      const outros = atuais.filter((l) => l.kind !== tipoTabela);
      const [movido] = doTipo.splice(origIdx, 1);
      doTipo.splice(destIdx, 0, movido);
      return tipoTabela === 'produto' ? [...doTipo, ...outros] : [...outros, ...doTipo];
    });
  };

  const itensCalculados = useMemo(
    () =>
      linhas.map((l) => {
        const quantity = parseQuantidade(l.quantityTexto);
        const unit_price_cents = converterTextoParaCentavos(l.unitPriceTexto) ?? 0;
        const discount_input = parseDescontoEntrada(l.discountMode, l.discountTexto);
        const calc = calcularLinhaItemCentavos(
          quantity,
          unit_price_cents,
          l.discountMode,
          discount_input,
        );
        return {
          ...l,
          quantity,
          unit_price_cents,
          discount_input,
          discount_cents: calc.descontoCentavos,
          total_cents: calc.totalCentavos,
        };
      }),
    [linhas],
  );

  const totais = useMemo(() => {
    const descGeral = converterTextoParaCentavos(descontoGeralTexto) ?? 0;
    const frete = converterTextoParaCentavos(freteTexto) ?? 0;
    return recalcularTotaisOrcamentoOuVenda(
      itensCalculados.map((i) => ({
        kind: i.kind,
        quantity: i.quantity,
        unit_price_cents: i.unit_price_cents,
        discount_mode: i.discountMode,
        discount_input: i.discount_input,
      })),
      descGeral,
      frete,
    );
  }, [itensCalculados, descontoGeralTexto, freteTexto]);

  const produtosLista = itensCalculados.filter((i) => i.kind === 'produto');
  const servicosLista = itensCalculados.filter((i) => i.kind === 'servico');

  const escolherCliente = (c: Customer | null) => {
    if (!c) {
      setCliente(null);
      setEnderecos([]);
      setEnderecoId('');
      setEnderecoTextoLivre('');
      return;
    }
    setConsumidorFinal(false);
    setCliente({
      id: c.id,
      name: c.name,
      person_type: c.person_type,
      document: c.document,
    });
    if (c.phone) setContatoTelefone(formatarTelefone(c.phone));
  };

  const handleSalvar = async (e?: FormEvent): Promise<Quote | null> => {
    e?.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!consumidorFinal && !cliente) {
      setErro('Escolha um cliente cadastrado ou marque "Consumidor final (sem cadastro)".');
      return null;
    }
    if (itensCalculados.length === 0) {
      setErro('Adicione ao menos um produto ou serviço ao orçamento.');
      return null;
    }
    if (itensCalculados.some((i) => i.quantity <= 0)) {
      setErro('Todas as linhas devem ter quantidade maior que zero.');
      return null;
    }

    setSalvando(true);
    try {
      const salvo = await salvarOrcamento(
        {
          id: ehNovo ? undefined : orcamento?.id,
          customer_id: consumidorFinal ? null : (cliente?.id ?? null),
          customer_name: consumidorFinal ? 'Consumidor final' : (cliente?.name ?? 'Consumidor final'),
          customer_person_type: consumidorFinal ? 'PF' : (cliente?.person_type ?? 'PF'),
          customer_document: consumidorFinal ? null : (cliente?.document ?? null),
          address_id: consumidorFinal ? null : (enderecoId || null),
          address_text: consumidorFinal ? null : (enderecoTextoLivre || null),
          contact_name: contatoNome.trim() || null,
          contact_phone: contatoTelefone.trim() || null,
          seller_id: vendedorId || null,
          validity_days: Math.max(1, Number(validadeDias) || 10),
          general_discount_cents: converterTextoParaCentavos(descontoGeralTexto) ?? 0,
          freight_cents: converterTextoParaCentavos(freteTexto) ?? 0,
          payment_terms_note: condicaoPagamento.trim() || null,
          notes: observacoes.trim() || null,
          internal_notes: observacaoInterna.trim() || null,
          items: itensCalculados.map((i) => ({
            id: i.uid.startsWith('lin-') || i.uid.startsWith('avulso-') ? undefined : i.uid,
            catalog_item_id: i.catalog_item_id,
            is_custom: i.is_custom,
            kind: i.kind,
            code: i.code,
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            discount_mode: i.discountMode,
            discount_input: i.discount_input,
          })),
        },
        atorNome,
      );
      preencherDoOrcamento(salvo);
      const hist = await historicoDoOrcamento(salvo.id);
      setEventos(hist);
      setSucesso('Orçamento salvo com sucesso.');
      setTimeout(() => setSucesso(null), 2500);
      onSalvo();
      if (ehNovo) onTrocarOrcamento(salvo.id);
      return salvo;
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o orçamento.');
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const handleEnviarWhatsApp = async () => {
    setErro(null);
    let fone = contatoTelefone.trim();
    if (!fone) {
      const digitado = window.prompt(
        'Informe o número de WhatsApp do cliente com DDD (ex.: 21999990000):',
        '',
      );
      if (!digitado?.trim()) return;
      fone = formatarTelefone(digitado.trim());
      setContatoTelefone(fone);
    }

    // Abre a janela já no clique síncrono para o navegador do celular não bloquear o pop-up
    const janela = prepararJanelaWhatsApp();
    try {
      let alvo = orcamento;
      if (ehNovo || !alvo || !somenteLeitura) {
        alvo = await handleSalvar();
      }
      if (!alvo) {
        janela?.close();
        return;
      }
      const enviado = await registrarEnvioOrcamento(alvo.id, atorNome);
      preencherDoOrcamento(enviado);
      setEventos(await historicoDoOrcamento(enviado.id));
      onSalvo();
      abrirLinkNaJanelaWhatsApp(janela, fone, textoWhatsAppOrcamento(enviado));
    } catch (err) {
      janela?.close();
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar pelo WhatsApp.');
    }
  };

  const handleDuplicar = async () => {
    if (!orcamento) return;
    setErro(null);
    try {
      const copia = await duplicarOrcamento(orcamento.id, atorNome);
      onSalvo();
      onTrocarOrcamento(copia.id);
      setSucesso(`Orçamento duplicado como ${copia.number}.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível duplicar o orçamento.');
    }
  };

  const handleReabrir = async () => {
    if (!orcamento) return;
    if (
      !window.confirm(
        'Reabrir este orçamento como Rascunho para editar valores? O link público enviado anteriormente será revogado.',
      )
    ) {
      return;
    }
    setErro(null);
    try {
      const reaberto = await reabrirOrcamento(orcamento.id, atorNome);
      preencherDoOrcamento(reaberto);
      setEventos(await historicoDoOrcamento(reaberto.id));
      onSalvo();
      setSucesso('Orçamento reaberto para edição.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível reabrir o orçamento.');
    }
  };

  const handleGerarNovoLink = async () => {
    if (!orcamento) return;
    if (
      !window.confirm(
        'Gerar um novo link público de aprovação? O link anterior deixará de funcionar imediatamente.',
      )
    ) {
      return;
    }
    try {
      const atualizado = await gerarNovoLinkOrcamento(orcamento.id, atorNome);
      preencherDoOrcamento(atualizado);
      setEventos(await historicoDoOrcamento(atualizado.id));
      setSucesso('Novo link público gerado.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar novo link.');
    }
  };

  const confirmarSeVencido = (orc: Quote): boolean => {
    const dias = diasOrcamentoVencido(orc.valid_until);
    if (dias <= 0) return true;
    return window.confirm(
      `Orçamento vencido há ${dias} ${dias === 1 ? 'dia' : 'dias'}, os preços podem ter mudado. Deseja prosseguir mesmo assim?`,
    );
  };

  const handleConverterEmVenda = async () => {
    let alvo = orcamento;
    if (ehNovo || !alvo) {
      alvo = await handleSalvar();
    }
    if (!alvo) return;
    if (!confirmarSeVencido(alvo)) return;
    navigate(`/vendas?orcamento=${alvo.id}`);
  };

  const handleGerarOs = async () => {
    let alvo = orcamento;
    if (ehNovo || !alvo) {
      alvo = await handleSalvar();
    }
    if (!alvo) return;
    if (!confirmarSeVencido(alvo)) return;
    setErro(null);
    try {
      const res = await gerarOsDoOrcamento(alvo.id, atorNome);
      preencherDoOrcamento(res.quote);
      setEventos(await historicoDoOrcamento(alvo.id));
      onSalvo();
      setSucesso(
        `OS nº ${res.service_order_number} gerada com os serviços na solicitação do cliente!`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar a OS.');
    }
  };

  const handleExcluir = async () => {
    if (!orcamento || orcamento.status !== 'rascunho') return;
    if (!window.confirm(`Excluir o rascunho ${orcamento.number}? Não é possível desfazer.`)) {
      return;
    }
    try {
      await excluirOrcamento(orcamento.id);
      onSalvo();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o rascunho.');
    }
  };

  const handleAnotarHistorico = async (e: FormEvent) => {
    e.preventDefault();
    if (!orcamento || !notaHistorico.trim()) return;
    setSalvandoNota(true);
    try {
      const ev = await anotarNoHistoricoOrcamento(orcamento.id, notaHistorico, atorNome);
      setEventos((atuais) => [ev, ...atuais]);
      setNotaHistorico('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a anotação.');
    } finally {
      setSalvandoNota(false);
    }
  };

  const renderizarTabelaItens = (tipoTabela: CatalogItemKind, lista: typeof itensCalculados) => {
    const subtotal =
      tipoTabela === 'produto'
        ? totais.produtosSubtotalCentavos
        : totais.servicosSubtotalCentavos;

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            {tipoTabela === 'produto' ? (
              <Package size={15} className="text-sky-600" />
            ) : (
              <Wrench size={15} className="text-indigo-600" />
            )}
            <span>
              {tipoTabela === 'produto' ? 'Produtos' : 'Serviços'} ({lista.length})
            </span>
          </div>
          <span className="text-xs font-extrabold text-brv-navy">
            Subtotal: {formatarReais(subtotal)}
          </span>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
            Nenhum {tipoTabela === 'produto' ? 'produto' : 'serviço'} incluído neste orçamento.
          </p>
        ) : (
          <DragDropContext onDragEnd={(r) => reordenarPorTipo(tipoTabela, r)}>
            <Droppable droppableId={`orc-tabela-${tipoTabela}`}>
              {(dropProvided) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className="space-y-2"
                >
                  {lista.map((item, idx) => {
                    const faltaEstoque =
                      item.kind === 'produto' &&
                      item.controlsStock &&
                      item.stockQuantity !== undefined &&
                      item.quantity > item.stockQuantity;

                    return (
                      <Draggable
                        key={item.uid}
                        draggableId={item.uid}
                        index={idx}
                        isDragDisabled={somenteLeitura}
                      >
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {!somenteLeitura && (
                                <span
                                  {...dragProvided.dragHandleProps}
                                  title="Arraste para reordenar"
                                  className="cursor-grab text-slate-400 hover:text-slate-700"
                                >
                                  <GripVertical size={15} />
                                </span>
                              )}

                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                                {item.code}
                              </span>

                              {item.is_custom && (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                  Avulso
                                </span>
                              )}

                              <span className="min-w-0 flex-1 text-xs font-bold text-slate-900">
                                {item.name}
                              </span>

                              {faltaEstoque && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                  <AlertTriangle size={10} /> Estoque insuficiente (saldo:{' '}
                                  {item.stockQuantity} {item.unit})
                                </span>
                              )}

                              {!somenteLeitura && (
                                <button
                                  type="button"
                                  onClick={() => removerLinha(item.uid)}
                                  aria-label={`Remover ${item.name}`}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500">
                                  Qtd. ({item.unit})
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={somenteLeitura}
                                  value={item.quantityTexto}
                                  onChange={(e) =>
                                    atualizarLinha(item.uid, { quantityTexto: e.target.value })
                                  }
                                  className="mt-0.5 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500">
                                  Valor unit. (R$)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={somenteLeitura}
                                  value={item.unitPriceTexto}
                                  onChange={(e) =>
                                    atualizarLinha(item.uid, { unitPriceTexto: e.target.value })
                                  }
                                  className="mt-0.5 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-semibold text-slate-500">
                                    Desconto
                                  </label>
                                  {!somenteLeitura && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        atualizarLinha(item.uid, {
                                          discountMode:
                                            item.discountMode === 'valor' ? 'percentual' : 'valor',
                                          discountTexto: '',
                                        })
                                      }
                                      className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >
                                      {item.discountMode === 'valor' ? 'Usar %' : 'Usar R$'}
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={somenteLeitura}
                                  value={item.discountTexto}
                                  onChange={(e) =>
                                    atualizarLinha(item.uid, { discountTexto: e.target.value })
                                  }
                                  placeholder={item.discountMode === 'valor' ? 'R$ 0,00' : '0%'}
                                  className="mt-0.5 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                                />
                              </div>

                              <div className="flex flex-col justify-end text-right">
                                <span className="text-[10px] font-semibold text-slate-400">
                                  Total da linha
                                </span>
                                <span className="text-sm font-extrabold tabular-nums text-brv-navy">
                                  {formatarReais(item.total_cents)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pb-16">
      {carregando ? (
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-medium">Carregando orçamento...</span>
          </div>
        </div>
      ) : erroCarga ? (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">{erroCarga}</p>
          <button
            type="button"
            onClick={onFechar}
            className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Voltar
          </button>
        </div>
      ) : (
        <>
          {/* ============================================================= */}
          {/* TOPO FIXO                                                     */}
          {/* ============================================================= */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3.5 shadow-2xs sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                      {ehNovo ? 'Novo orçamento' : orcamento?.number}
                    </h1>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${CORES_SITUACAO_ORCAMENTO[situacaoExibida].selo}`}
                    >
                      {CORES_SITUACAO_ORCAMENTO[situacaoExibida].rotulo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Total: <strong className="text-brv-navy">{formatarReais(totais.totalCentavos)}</strong>
                    {orcamento?.valid_until && (
                      <> · Válido até {formatarData(orcamento.valid_until)}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {sucesso && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                    <Check size={13} /> {sucesso}
                  </span>
                )}

                {!somenteLeitura && (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void handleSalvar()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvando && <Loader2 size={14} className="animate-spin" />}
                    Salvar
                  </button>
                )}

                {!ehNovo &&
                  orcamento &&
                  (orcamento.status === 'enviado' || orcamento.status === 'recusado') && (
                    <button
                      type="button"
                      onClick={() => void handleReabrir()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                    >
                      <RotateCcw size={14} />
                      Reabrir para editar
                    </button>
                  )}

                {!ehNovo && orcamento && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleDuplicar()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy size={14} />
                      Duplicar
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalDocAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer size={14} />
                      Imprimir / PDF
                    </button>
                  </>
                )}

                {(!orcamento || orcamento.status !== 'convertido') && (
                  <button
                    type="button"
                    onClick={() => void handleEnviarWhatsApp()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                  >
                    <MessageCircle size={14} />
                    Enviar pelo WhatsApp (link para aprovar)
                  </button>
                )}

                {!ehNovo && orcamento && orcamento.status !== 'convertido' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModalRespostaAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Registrar resposta
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleConverterEmVenda()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100"
                    >
                      <ShoppingBag size={14} />
                      Converter em venda
                    </button>

                    {servicosLista.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleGerarOs()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                      >
                        <ClipboardList size={14} />
                        Gerar OS
                      </button>
                    )}
                  </>
                )}

                {!ehNovo && orcamento?.status === 'rascunho' && (
                  <button
                    type="button"
                    onClick={() => void handleExcluir()}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                )}

                <button
                  type="button"
                  onClick={onFechar}
                  aria-label="Fechar"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-5xl space-y-6 px-4 sm:px-6">
            {erro && (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              >
                <span>{erro}</span>
                <button type="button" onClick={() => setErro(null)} aria-label="Fechar erro">
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Faixa de vínculos quando convertido */}
            {orcamento &&
              (orcamento.converted_sale_id || orcamento.converted_service_order_id) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-violet-200 bg-violet-50/80 p-4 text-xs text-violet-950">
                  <div>
                    <p className="text-sm font-bold">
                      Orçamento convertido (somente leitura — use "Duplicar" se precisar de outro)
                    </p>
                    <p className="mt-0.5 text-violet-800">
                      Este orçamento já gerou documentos operacionais vinculados:
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {orcamento.converted_sale_id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/vendas?venda=${orcamento.converted_sale_id}`)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-800"
                      >
                        Venda nº {orcamento.converted_sale_number}
                        <ExternalLink size={13} />
                      </button>
                    )}
                    {orcamento.converted_service_order_number && (
                      <button
                        type="button"
                        onClick={() => navigate('/ordens-de-servico')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3.5 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100"
                      >
                        OS nº {orcamento.converted_service_order_number}
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}

            {/* ============================================================= */}
            {/* SEÇÃO 1: CLIENTE                                              */}
            {/* ============================================================= */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-800">Cliente e atendimento</h2>
                {!somenteLeitura && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={consumidorFinal}
                      onChange={(e) => {
                        setConsumidorFinal(e.target.checked);
                        if (e.target.checked) {
                          setCliente(null);
                          setEnderecos([]);
                          setEnderecoId('');
                          setEnderecoTextoLivre('');
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    Consumidor final (sem cadastro)
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold text-slate-700">
                    Cliente {!consumidorFinal && '*'}
                  </span>
                  {consumidorFinal ? (
                    <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                      Consumidor final (sem cadastro)
                    </div>
                  ) : (
                    <SeletorCliente
                      valor={cliente}
                      onChange={escolherCliente}
                      desabilitado={somenteLeitura}
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="orc-endereco" className="block text-xs font-semibold text-slate-700">
                    Endereço
                  </label>
                  {enderecos.length > 1 ? (
                    <select
                      id="orc-endereco"
                      disabled={somenteLeitura || consumidorFinal}
                      value={enderecoId}
                      onChange={(e) => {
                        setEnderecoId(e.target.value);
                        const achado = enderecos.find((x) => x.id === e.target.value);
                        if (achado) setEnderecoTextoLivre(achado.rotulo);
                      }}
                      className={CAMPO}
                    >
                      {enderecos.map((end) => (
                        <option key={end.id} value={end.id}>
                          {end.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="orc-endereco"
                      type="text"
                      disabled={somenteLeitura || consumidorFinal}
                      value={enderecoTextoLivre}
                      onChange={(e) => setEnderecoTextoLivre(e.target.value)}
                      placeholder={
                        consumidorFinal
                          ? 'Sem endereço para consumidor final'
                          : 'Endereço do cliente'
                      }
                      className={CAMPO}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="orc-contato" className="block text-xs font-semibold text-slate-700">
                    Contato (nome livre)
                  </label>
                  <input
                    id="orc-contato"
                    type="text"
                    disabled={somenteLeitura}
                    value={contatoNome}
                    onChange={(e) => setContatoNome(e.target.value)}
                    placeholder="Ex.: Síndico Marcos, Recepção..."
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="orc-telefone" className="block text-xs font-semibold text-slate-700">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="orc-telefone"
                    type="tel"
                    disabled={somenteLeitura}
                    value={contatoTelefone}
                    onChange={(e) => setContatoTelefone(formatarTelefone(e.target.value))}
                    placeholder="(21) 99999-0000"
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="orc-vendedor" className="block text-xs font-semibold text-slate-700">
                    Vendedor(a)
                  </label>
                  <select
                    id="orc-vendedor"
                    disabled={somenteLeitura}
                    value={vendedorId}
                    onChange={(e) => setVendedorId(e.target.value)}
                    className={CAMPO}
                  >
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* SEÇÃO 2: ITENS (PRODUTOS E SERVIÇOS)                          */}
            {/* ============================================================= */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Itens do orçamento</h2>
                  <p className="text-xs text-slate-500">
                    Itens de serviço vão em NFS-e e produtos em NFC-e/NF-e.
                  </p>
                </div>

                {!somenteLeitura && (
                  <button
                    type="button"
                    onClick={() => setModalAvulsoAberto(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Plus size={14} />
                    Item avulso
                  </button>
                )}
              </div>

              {/* Busca rápida no catálogo */}
              {!somenteLeitura && (
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={buscaItem}
                    onChange={(e) => {
                      setBuscaItem(e.target.value);
                      setBuscaAberta(true);
                    }}
                    onFocus={() => setBuscaAberta(true)}
                    onBlur={() => setTimeout(() => setBuscaAberta(false), 180)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && sugestoesCatalogo.length > 0) {
                        e.preventDefault();
                        adicionarItemCatalogo(sugestoesCatalogo[0]);
                      }
                    }}
                    placeholder="Buscar produto ou serviço no catálogo por código ou nome (Enter adiciona)..."
                    className="block w-full rounded-xl border border-blue-200 bg-blue-50/30 py-2.5 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />

                  {buscaAberta && sugestoesCatalogo.length > 0 && (
                    <ul className="absolute z-30 mt-1 max-h-64 w-full divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                      {sugestoesCatalogo.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onMouseDown={() => adicionarItemCatalogo(item)}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-xs hover:bg-blue-50"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-400">
                                {item.code}
                              </span>{' '}
                              <strong className="text-slate-800">{item.name}</strong>
                              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {item.kind === 'produto' ? 'Produto' : 'Serviço'}
                              </span>
                            </div>
                            <span className="shrink-0 font-extrabold text-brv-navy">
                              {formatarReais(item.sale_price_cents)} / {item.unit}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Duas tabelas: Produtos e Serviços */}
              <div className="space-y-4">
                {renderizarTabelaItens('produto', produtosLista)}
                {renderizarTabelaItens('servico', servicosLista)}
              </div>

              {/* Totalizador do bloco de itens */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                  <span>
                    Produtos: <strong className="text-white">{formatarReais(totais.produtosSubtotalCentavos)}</strong>
                  </span>
                  <span>
                    Serviços: <strong className="text-white">{formatarReais(totais.servicosSubtotalCentavos)}</strong>
                  </span>
                </div>
                <div className="text-sm font-extrabold">
                  Total Geral: {formatarReais(totais.totalCentavos)}
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* SEÇÃO 3: CONDIÇÕES                                            */}
            {/* ============================================================= */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <h2 className="text-base font-bold text-slate-800">Condições comerciais</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="orc-validade" className="block text-xs font-semibold text-slate-700">
                    Validade (dias)
                  </label>
                  <input
                    id="orc-validade"
                    type="text"
                    inputMode="numeric"
                    disabled={somenteLeitura}
                    value={validadeDias}
                    onChange={(e) => setValidadeDias(e.target.value.replace(/\D/g, ''))}
                    className={CAMPO}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Até {formatarData(somarDiasIso(dataIsoHoje(), Number(validadeDias) || 10))}
                  </span>
                </div>

                <div>
                  <label htmlFor="orc-desc-geral" className="block text-xs font-semibold text-slate-700">
                    Desconto geral (R$)
                  </label>
                  <input
                    id="orc-desc-geral"
                    type="text"
                    inputMode="decimal"
                    disabled={somenteLeitura}
                    value={descontoGeralTexto}
                    onChange={(e) => setDescontoGeralTexto(e.target.value)}
                    placeholder="0,00"
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="orc-frete" className="block text-xs font-semibold text-slate-700">
                    Frete / outras despesas (R$)
                  </label>
                  <input
                    id="orc-frete"
                    type="text"
                    inputMode="decimal"
                    disabled={somenteLeitura}
                    value={freteTexto}
                    onChange={(e) => setFreteTexto(e.target.value)}
                    placeholder="0,00"
                    className={CAMPO}
                  />
                </div>

                <div>
                  <label htmlFor="orc-forma-prev" className="block text-xs font-semibold text-slate-700">
                    Forma de pagamento prevista
                  </label>
                  <input
                    id="orc-forma-prev"
                    type="text"
                    disabled={somenteLeitura}
                    value={condicaoPagamento}
                    onChange={(e) => setCondicaoPagamento(e.target.value)}
                    placeholder="Ex.: PIX ou cartão em até 6x"
                    className={CAMPO}
                  />
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* SEÇÃO 4: OBSERVAÇÕES                                          */}
            {/* ============================================================= */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-800">Observações</h2>
                {!somenteLeitura && (
                  <button
                    type="button"
                    onClick={() => setModalTextosAberto(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <Settings2 size={13} />
                    Gerenciar textos padrão
                  </button>
                )}
              </div>

              {!somenteLeitura && textosPadrao.length > 0 && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Inserir texto padrão:
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {textosPadrao.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setObservacoes((atual) =>
                            atual.includes(t.content)
                              ? atual
                              : atual.trim()
                                ? `${atual.trim()}\n${t.content}`
                                : t.content,
                          )
                        }
                        className="rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
                      >
                        + {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="orc-obs" className="block text-xs font-semibold text-slate-700">
                  Observações do documento (aparecem no PDF e no link do cliente)
                </label>
                <textarea
                  id="orc-obs"
                  rows={4}
                  disabled={somenteLeitura}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className={CAMPO}
                />
              </div>

              <div>
                <label htmlFor="orc-obs-int" className="block text-xs font-semibold text-slate-700">
                  Observação interna (só o escritório vê)
                </label>
                <textarea
                  id="orc-obs-int"
                  rows={2}
                  disabled={somenteLeitura}
                  value={observacaoInterna}
                  onChange={(e) => setObservacaoInterna(e.target.value)}
                  placeholder="Não aparece no PDF nem na página pública do cliente..."
                  className={CAMPO}
                />
              </div>
            </section>

            {/* ============================================================= */}
            {/* SEÇÃO 5: APROVAÇÃO DO CLIENTE (LINK PÚBLICO)                  */}
            {/* ============================================================= */}
            {!ehNovo && orcamento && (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <div className="flex items-center gap-2 text-slate-800">
                  <Link2 size={18} className="text-blue-600" />
                  <h2 className="text-base font-bold">Aprovação do cliente</h2>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                  <span className="truncate font-mono text-slate-700">
                    {linkPublicoOrcamento(orcamento.public_token)}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          linkPublicoOrcamento(orcamento.public_token),
                        );
                        setCopiadoLink(true);
                        setTimeout(() => setCopiadoLink(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copiadoLink ? <Check size={12} /> : <Copy size={12} />}
                      {copiadoLink ? 'Copiado!' : 'Copiar link'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleEnviarWhatsApp()}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle size={12} />
                      Enviar pelo WhatsApp
                    </button>

                    <a
                      href={`/orcamento/${orcamento.public_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Abrir link <ExternalLink size={12} />
                    </a>

                    {orcamento.status !== 'convertido' && (
                      <button
                        type="button"
                        onClick={() => void handleGerarNovoLink()}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        <RefreshCw size={12} />
                        Gerar novo link
                      </button>
                    )}
                  </div>
                </div>

                {orcamento.responded_at && (
                  <div
                    className={`rounded-xl border p-3.5 text-xs ${
                      orcamento.status === 'recusado'
                        ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                    }`}
                  >
                    <p className="font-bold">
                      {orcamento.status === 'recusado' ? 'Recusado' : 'Aprovado'} em{' '}
                      {formatarDataHora(orcamento.responded_at)}
                      {orcamento.responded_by_name ? ` por ${orcamento.responded_by_name}` : ''}
                      {orcamento.response_channel
                        ? ` (${ROTULO_CANAL_ORCAMENTO[orcamento.response_channel]})`
                        : ''}
                    </p>
                    {orcamento.response_note && (
                      <p className="mt-1">{orcamento.response_note}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* SEÇÃO 6: HISTÓRICO                                            */}
            {/* ============================================================= */}
            {!ehNovo && orcamento && (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                <div className="flex items-center gap-2 text-slate-800">
                  <History size={18} className="text-blue-600" />
                  <h2 className="text-base font-bold">Histórico ({eventos.length})</h2>
                </div>

                <form onSubmit={(e) => void handleAnotarHistorico(e)} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={notaHistorico}
                    onChange={(e) => setNotaHistorico(e.target.value)}
                    placeholder="Anotar no histórico deste orçamento..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={salvandoNota || !notaHistorico.trim()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {salvandoNota ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <MessageSquarePlus size={13} />
                    )}
                    Anotar no histórico
                  </button>
                </form>

                {eventos.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum evento registrado.</p>
                ) : (
                  <ol className="relative ml-2 space-y-3 border-l-2 border-slate-200 pl-4">
                    {eventos.map((ev) => (
                      <li key={ev.id} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brv-navy" />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">{ev.actor_name}</span>
                          <span className="text-[11px] text-slate-400">
                            {formatarDataHora(ev.created_at)}
                          </span>
                        </div>
                        {ev.note && <p className="mt-0.5 text-slate-600">{ev.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>

          {modalAvulsoAberto && (
            <ModalItemAvulso
              aberto={modalAvulsoAberto}
              onFechar={() => setModalAvulsoAberto(false)}
              onAdicionar={adicionarItemAvulso}
            />
          )}

          {modalTextosAberto && (
            <ModalTextosPadraoOrcamento
              aberto={modalTextosAberto}
              onFechar={() => setModalTextosAberto(false)}
              onAlterado={setTextosPadrao}
            />
          )}

          {modalRespostaAberto && orcamento && (
            <ModalRegistrarRespostaOrcamento
              aberto={modalRespostaAberto}
              orcamento={orcamento}
              atorNome={atorNome}
              onFechar={() => setModalRespostaAberto(false)}
              onSalvo={async (atualizado) => {
                preencherDoOrcamento(atualizado);
                setEventos(await historicoDoOrcamento(atualizado.id));
                onSalvo();
              }}
            />
          )}

          {modalDocAberto && orcamento && (
            <OrcamentoDocumentoModal
              orcamento={orcamento}
              onFechar={() => setModalDocAberto(false)}
              onEnviarWhatsApp={() => {
                setModalDocAberto(false);
                void handleEnviarWhatsApp();
              }}
            />
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

