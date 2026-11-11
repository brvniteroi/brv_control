import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import type { PersonType, Profile } from '../../types/fsm';
import type {
  BoardEvent,
  BoardOrder,
  BoardPhoto,
  BoardQuoteChannel,
  BoardStage,
  BoardTechnicianOption,
} from '../../types/placas';
import { useTelaAjuda } from '../../ajuda/contextoAjuda';
import { podeVerFinanceiroPlacas } from '../../utils/acessoPlacas';
import { documentoValido, formatarDocumento, limparDocumento } from '../../utils/documento';
import { valorEmReais } from '../../utils/oficina';
import { formatarData, formatarDataHora } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import ComprovanteEntradaDocumento from './ComprovanteEntradaDocumento';
import {
  CORES_ETAPA_PLACA,
  CORES_ORCAMENTO_PLACA,
  CORES_TIPO_CLIENTE_PLACA,
  ROTULO_CANAL_ORCAMENTO,
} from './cores';
import EtiquetaPlacaModal from './EtiquetaPlacaModal';
import {
  arquivarPlaca,
  atualizarPlaca,
  buscarPlaca,
  cancelarPlaca,
  enviarOrcamentoPorLink,
  fotosDaPlaca,
  gerarNovoLinkAcompanhamento,
  historicoDaPlaca,
  listarTecnicos,
  moverPlaca,
  reabrirPlaca,
  registrarOrcamento,
  registrarReembolso,
  registrarRespostaOrcamento,
} from './fonteDeDados';
import FotosPlaca from './FotosPlaca';
import HistoricoPlaca from './HistoricoPlaca';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import OrcamentoPlacaDocumento from './OrcamentoPlacaDocumento';
import {
  ETAPAS_KANBAN_PLACA,
  ROTULO_ETAPA_PLACA,
  SUGESTOES_TIPO_EQUIPAMENTO_PLACA,
  calcularValidadeGarantia,
  ehEscritorioOuAdminPlaca,
  ehEtapaFinalPlaca,
  garantiaVigente,
  linkPublicoPlaca,
  montarLinkWhatsAppPlaca,
  motivoBloqueioPlaca,
  podeMoverPlaca,
  prepararJanelaWhatsApp,
  textoWhatsAppEntradaPlaca,
  textoWhatsAppOrcamentoPlaca,
  ehTecnicoBancadaPlacas,
} from './regrasPlacas';
import TermoGarantiaDocumento from './TermoGarantiaDocumento';

interface PlacaDetalhesProps {
  placaId: string | null;
  perfil: Profile | null;
  onFechar: () => void;
  onTrocarPlaca: (novoId: string) => void;
  onListaAlterada: () => void;
}

function hojeIsoCurto(): string {
  const d = new Date();
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

export default function PlacaDetalhes({
  placaId,
  perfil,
  onFechar,
  onTrocarPlaca,
  onListaAlterada,
}: PlacaDetalhesProps) {
  useTelaAjuda('placa');
  const tituloDrawerId = useId();
  const idBase = useId();

  const papel = perfil?.role;
  const atorNome = perfil?.full_name || 'Usuário BRV';
  const ehEscritorioOuAdmin = ehEscritorioOuAdminPlaca(papel);
  const temFinanceiro = podeVerFinanceiroPlacas(perfil);

  const [placa, setPlaca] = useState<BoardOrder | null>(null);
  const [fotos, setFotos] = useState<BoardPhoto[]>([]);
  const [eventos, setEventos] = useState<BoardEvent[]>([]);
  const [tecnicos, setTecnicos] = useState<BoardTechnicianOption[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [recargaChave, setRecargaChave] = useState(0);

  // Avisos gerais no topo da gaveta
  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null);
  const [avisoErro, setAvisoErro] = useState<string | null>(null);

  // Estado editável — Seção 2: Equipamento e placa
  const [tipoEquipamento, setTipoEquipamento] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [codigoPlaca, setCodigoPlaca] = useState('');
  const [perifericos, setPerifericos] = useState('');
  const [defeitoReclamado, setDefeitoReclamado] = useState('');
  const [semDefeitoAparente, setSemDefeitoAparente] = useState(false);
  const [tecRetiradaId, setTecRetiradaId] = useState('');
  const [tecBancadaId, setTecBancadaId] = useState('');
  const [salvandoEquip, setSalvandoEquip] = useState(false);

  // Estado editável — Seção 3: Bancada
  const [codigoErro, setCodigoErro] = useState('');
  const [diagnosticoTecnico, setDiagnosticoTecnico] = useState('');
  const [componentesTrocados, setComponentesTrocados] = useState('');
  const [salvandoBancada, setSalvandoBancada] = useState(false);

  // Estado editável — Seção 4: Orçamento (apenas escritório/admin)
  const [valorOrcamentoTexto, setValorOrcamentoTexto] = useState('');
  const [validadeOrcamento, setValidadeOrcamento] = useState('10');
  const [tipoPessoaDoc, setTipoPessoaDoc] = useState<PersonType>('PF');
  const [documentoOrcamento, setDocumentoOrcamento] = useState('');
  const [enderecoOrcamento, setEnderecoOrcamento] = useState('');
  const [parecerOrcamento, setParecerOrcamento] = useState('');
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [enviandoPdfWhats, setEnviandoPdfWhats] = useState(false);

  // Modal Registrar Resposta do Orçamento
  const [modalRespostaAberto, setModalRespostaAberto] = useState(false);
  const [decisaoResposta, setDecisaoResposta] = useState<'aprovado' | 'recusado'>('aprovado');
  const [canalResposta, setCanalResposta] = useState<BoardQuoteChannel>('whatsapp');
  const [obsResposta, setObsResposta] = useState('');
  const [salvandoResposta, setSalvandoResposta] = useState(false);

  // Estado editável — Seção 6: Financeiro e Reembolso (apenas `podeVerFinanceiroPlacas`)
  const [valorCobradoTexto, setValorCobradoTexto] = useState('');
  const [salvandoCobrado, setSalvandoCobrado] = useState(false);
  const [reembolsada, setReembolsada] = useState(false);
  const [valorReembolsoTexto, setValorReembolsoTexto] = useState('');
  const [dataReembolso, setDataReembolso] = useState(hojeIsoCurto());
  const [motivoReembolso, setMotivoReembolso] = useState('');
  const [salvandoReembolso, setSalvandoReembolso] = useState(false);

  // Acompanhamento público
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [modalNovoLinkAberto, setModalNovoLinkAberto] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);

  // Documentos impressos / etiqueta
  const [verComprovante, setVerComprovante] = useState(false);
  const [verOrcamentoDoc, setVerOrcamentoDoc] = useState(false);
  const [verTermoGarantia, setVerTermoGarantia] = useState(false);
  const [verEtiqueta, setVerEtiqueta] = useState(false);

  // Modais de rodapé (finalização, sem conserto, arquivar, cancelar)
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [modalEntregarAberto, setModalEntregarAberto] = useState(false);
  const [dataSaidaEntrega, setDataSaidaEntrega] = useState(hojeIsoCurto());
  const [cobradoNaEntregaTexto, setCobradoNaEntregaTexto] = useState('');

  const [modalSemConsertoAberto, setModalSemConsertoAberto] = useState(false);
  const [motivoSemConserto, setMotivoSemConserto] = useState('');

  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const [modalArquivarAberto, setModalArquivarAberto] = useState(false);

  const sincronizarCamposLocais = (pl: BoardOrder) => {
    setTipoEquipamento(pl.equipment_type);
    setMarcaModelo(pl.brand_model);
    setCodigoPlaca(pl.board_code);
    setPerifericos(pl.peripherals ?? '');
    setDefeitoReclamado(pl.reported_defect);
    setSemDefeitoAparente(pl.no_apparent_defect);
    setTecRetiradaId(pl.pickup_technician_id ?? '');
    setTecBancadaId(pl.bench_technician_id ?? '');

    setCodigoErro(pl.error_code ?? '');
    setDiagnosticoTecnico(pl.technical_diagnosis ?? '');
    setComponentesTrocados(pl.replaced_components ?? '');

    setValorOrcamentoTexto(pl.quote_amount != null ? String(pl.quote_amount) : '');
    setValidadeOrcamento(String(pl.quote_validity_days || 10));
    const tp = pl.customer_person_type || 'PF';
    setTipoPessoaDoc(tp);
    setDocumentoOrcamento(
      pl.customer_document ? formatarDocumento(pl.customer_document, tp) : '',
    );
    setEnderecoOrcamento(pl.customer_address ?? '');
    setParecerOrcamento(pl.quote_technical_opinion ?? '');

    setValorCobradoTexto(pl.charged_amount != null ? String(pl.charged_amount) : '');
    setReembolsada(pl.refunded);
    setValorReembolsoTexto(pl.refund_amount != null ? String(pl.refund_amount) : '');
    setDataReembolso(pl.refunded_at ?? hojeIsoCurto());
    setMotivoReembolso(pl.refund_reason ?? '');
  };

  const recarregarHistorico = async (id: string) => {
    try {
      const lista = await historicoDaPlaca(id);
      setEventos(lista);
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    if (!placaId) return;
    let cancelado = false;

    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        setAvisoSucesso(null);
        setAvisoErro(null);
        return Promise.all([
          buscarPlaca(placaId),
          fotosDaPlaca(placaId),
          historicoDaPlaca(placaId),
          listarTecnicos(),
        ]);
      })
      .then((res) => {
        if (cancelado || !res) return;
        const [pl, fts, evs, tecs] = res;
        if (!pl) {
          setErroCarga('Placa não encontrada.');
          setPlaca(null);
          return;
        }
        setPlaca(pl);
        setFotos(fts);
        setEventos(evs);
        setTecnicos(tecs);
        sincronizarCamposLocais(pl);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(err instanceof Error ? err.message : 'Erro ao carregar os dados da placa.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [placaId, recargaChave]);

  // Fecha com Esc apenas quando não há submodal aberto por cima
  const temSubmodalAberto =
    verComprovante ||
    verOrcamentoDoc ||
    verTermoGarantia ||
    verEtiqueta ||
    modalRespostaAberto ||
    modalNovoLinkAberto ||
    modalEntregarAberto ||
    modalSemConsertoAberto ||
    modalCancelarAberto ||
    modalArquivarAberto;

  useEffect(() => {
    if (!placaId || temSubmodalAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFechar();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [placaId, temSubmodalAberto, onFechar]);

  if (!placaId) return null;

  const somenteLeitura = placa ? ehEtapaFinalPlaca(placa.status) || placa.archived : true;

  const notificarSucesso = (msg: string) => {
    setAvisoErro(null);
    setAvisoSucesso(msg);
  };

  const notificarErro = (msg: string) => {
    setAvisoSucesso(null);
    setAvisoErro(msg);
  };

  const aplicarPlacaAtualizada = async (nova: BoardOrder, mensagemSucesso?: string) => {
    setPlaca(nova);
    sincronizarCamposLocais(nova);
    await recarregarHistorico(nova.id);
    onListaAlterada();
    if (mensagemSucesso) notificarSucesso(mensagemSucesso);
  };

  const handleMoverEtapaKanban = async (destino: BoardStage) => {
    if (!placa) return;
    const bloqueio = motivoBloqueioPlaca(placa, destino, papel);
    if (bloqueio) {
      notificarErro(bloqueio);
      return;
    }
    setMovendoEtapa(true);
    try {
      const atualizada = await moverPlaca(placa.id, destino, undefined, { papel, atorNome });
      await aplicarPlacaAtualizada(
        atualizada,
        `Etapa alterada para ${ROTULO_ETAPA_PLACA[destino]}.`,
      );
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao mover placa.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleSalvarEquipamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa || somenteLeitura) return;
    if (!marcaModelo.trim()) {
      notificarErro('Informe a marca e o modelo do equipamento.');
      return;
    }
    if (!codigoPlaca.trim()) {
      notificarErro('Informe o código da placa eletrônica.');
      return;
    }
    if (!defeitoReclamado.trim() && !semDefeitoAparente) {
      notificarErro('Informe o defeito reclamado ou marque "Sem defeito aparente".');
      return;
    }

    setSalvandoEquip(true);
    try {
      const atualizada = await atualizarPlaca(
        placa.id,
        {
          equipment_type: tipoEquipamento,
          brand_model: marcaModelo,
          board_code: codigoPlaca,
          peripherals: perifericos,
          reported_defect: defeitoReclamado,
          no_apparent_defect: semDefeitoAparente,
          pickup_technician_id: tecRetiradaId || null,
          bench_technician_id: tecBancadaId || null,
        },
        { papel, atorNome },
      );
      await aplicarPlacaAtualizada(atualizada, 'Dados do equipamento e placa salvos.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao salvar equipamento.');
    } finally {
      setSalvandoEquip(false);
    }
  };

  const handleSalvarBancada = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa || somenteLeitura) return;
    setSalvandoBancada(true);
    try {
      const atualizada = await atualizarPlaca(
        placa.id,
        {
          error_code: codigoErro,
          technical_diagnosis: diagnosticoTecnico,
          replaced_components: componentesTrocados,
        },
        { papel, atorNome },
      );
      await aplicarPlacaAtualizada(atualizada, 'Dados técnicos de bancada salvos.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao salvar dados de bancada.');
    } finally {
      setSalvandoBancada(false);
    }
  };

  const handleSalvarOrcamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa || somenteLeitura || !ehEscritorioOuAdmin) return;

    const valorNum = Number.parseFloat(valorOrcamentoTexto.replace(',', '.'));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      notificarErro('Informe um valor de orçamento maior que zero.');
      return;
    }
    if (!parecerOrcamento.trim()) {
      notificarErro('Preencha o parecer técnico que sairá impresso na proposta de orçamento.');
      return;
    }
    const docLimpo = limparDocumento(documentoOrcamento, tipoPessoaDoc);
    if (docLimpo.length > 0 && !documentoValido(docLimpo, tipoPessoaDoc)) {
      notificarErro(
        tipoPessoaDoc === 'PF'
          ? 'O CPF informado para o orçamento não é válido.'
          : 'O CNPJ informado para o orçamento não é válido.',
      );
      return;
    }

    setSalvandoOrcamento(true);
    try {
      const atualizada = await registrarOrcamento(
        placa.id,
        {
          quote_amount: valorNum,
          quote_validity_days: Number.parseInt(validadeOrcamento, 10) || 10,
          customer_person_type: tipoPessoaDoc,
          customer_document: docLimpo || null,
          customer_address: enderecoOrcamento.trim() || null,
          quote_technical_opinion: parecerOrcamento.trim(),
        },
        atorNome,
      );
      await aplicarPlacaAtualizada(atualizada, 'Orçamento salvo com sucesso.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao salvar orçamento.');
    } finally {
      setSalvandoOrcamento(false);
    }
  };

  const handleEnviarPdfWhatsDireto = async () => {
    if (!placa) return;
    if (placa.quote_amount == null || placa.quote_amount <= 0) {
      notificarErro('Salve o orçamento antes de enviá-lo pelo WhatsApp.');
      return;
    }
    setEnviandoPdfWhats(true);
    // O wa.me só leva texto: a mensagem leva o link do orçamento, onde o cliente vê, salva em PDF e aprova
    const janela = prepararJanelaWhatsApp();
    try {
      const { placa: atualizada, link } = await enviarOrcamentoPorLink(placa.id, atorNome);
      janela.ir(montarLinkWhatsAppPlaca(atualizada.customer_phone, textoWhatsAppOrcamentoPlaca(atualizada, link)));
      await aplicarPlacaAtualizada(
        atualizada,
        'WhatsApp aberto com o link do orçamento. Quando o cliente aprovar pelo link, o orçamento passa para "Aprovado" (aparece ao reabrir a placa).',
      );
    } catch (err) {
      janela.cancelar();
      notificarErro(err instanceof Error ? err.message : 'Erro ao preparar envio do orçamento.');
    } finally {
      setEnviandoPdfWhats(false);
    }
  };

  const handleConfirmarRespostaOrcamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa) return;
    setSalvandoResposta(true);
    try {
      const atualizada = await registrarRespostaOrcamento(
        placa.id,
        {
          decision: decisaoResposta,
          channel: canalResposta,
          notes: obsResposta.trim() || null,
        },
        atorNome,
      );
      setModalRespostaAberto(false);
      setObsResposta('');
      await aplicarPlacaAtualizada(
        atualizada,
        decisaoResposta === 'aprovado'
          ? 'Aprovação do orçamento registrada! As etapas de reparo estão liberadas.'
          : 'Recusa do orçamento registrada.',
      );
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao registrar resposta.');
    } finally {
      setSalvandoResposta(false);
    }
  };

  const handleSalvarValorCobrado = async () => {
    if (!placa || !temFinanceiro || somenteLeitura) return;
    const limpo = valorCobradoTexto.trim();
    const num = limpo ? Number.parseFloat(limpo.replace(',', '.')) : null;
    if (limpo && (!Number.isFinite(num) || (num ?? 0) < 0)) {
      notificarErro('Informe um valor cobrado válido (zero ou maior).');
      return;
    }
    setSalvandoCobrado(true);
    try {
      const atualizada = await atualizarPlaca(
        placa.id,
        { charged_amount: num },
        { papel, atorNome },
      );
      await aplicarPlacaAtualizada(atualizada, 'Valor cobrado atualizado.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao salvar valor cobrado.');
    } finally {
      setSalvandoCobrado(false);
    }
  };

  const handleSalvarReembolso = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa || !temFinanceiro) return;
    const numReembolso = reembolsada
      ? Number.parseFloat(valorReembolsoTexto.replace(',', '.'))
      : null;

    if (reembolsada && (!Number.isFinite(numReembolso) || (numReembolso ?? 0) <= 0)) {
      notificarErro('Informe o valor reembolsado maior que zero.');
      return;
    }
    if (reembolsada && !dataReembolso) {
      notificarErro('Informe a data do reembolso.');
      return;
    }
    if (reembolsada && !motivoReembolso.trim()) {
      notificarErro('Informe o motivo do reembolso.');
      return;
    }

    setSalvandoReembolso(true);
    try {
      const atualizada = await registrarReembolso(
        placa.id,
        {
          refunded: reembolsada,
          refund_amount: reembolsada ? numReembolso : null,
          refunded_at: reembolsada ? dataReembolso : null,
          refund_reason: reembolsada ? motivoReembolso.trim() : null,
        },
        atorNome,
      );
      await aplicarPlacaAtualizada(
        atualizada,
        reembolsada ? 'Reembolso registrado no financeiro.' : 'Marcação de reembolso removida.',
      );
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao registrar reembolso.');
    } finally {
      setSalvandoReembolso(false);
    }
  };

  const handleCopiarLink = async () => {
    if (!placa) return;
    try {
      await navigator.clipboard.writeText(linkPublicoPlaca(placa.public_token));
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      notificarErro('Não foi possível copiar automaticamente. Copie o endereço exibido.');
    }
  };

  const handleConfirmarNovoLink = async () => {
    if (!placa) return;
    setGerandoLink(true);
    try {
      const atualizada = await gerarNovoLinkAcompanhamento(placa.id, atorNome);
      setModalNovoLinkAberto(false);
      await aplicarPlacaAtualizada(
        atualizada,
        'Novo link gerado. O link anterior deixou de funcionar.',
      );
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao gerar novo link.');
    } finally {
      setGerandoLink(false);
    }
  };

  const abrirModalEntregar = () => {
    if (!placa) return;
    const bloqueio = motivoBloqueioPlaca(placa, 'entregue', papel);
    if (bloqueio) {
      notificarErro(bloqueio);
      return;
    }
    setDataSaidaEntrega(hojeIsoCurto());
    setCobradoNaEntregaTexto(
      placa.charged_amount != null
        ? String(placa.charged_amount)
        : placa.quote_amount != null
          ? String(placa.quote_amount)
          : '',
    );
    setModalEntregarAberto(true);
  };

  const handleConfirmarEntrega = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa) return;
    const cobradoNum =
      temFinanceiro && cobradoNaEntregaTexto.trim()
        ? Number.parseFloat(cobradoNaEntregaTexto.replace(',', '.'))
        : undefined;

    setMovendoEtapa(true);
    try {
      const atualizada = await moverPlaca(
        placa.id,
        'entregue',
        {
          finished_at: dataSaidaEntrega,
          charged_amount: Number.isFinite(cobradoNum) ? cobradoNum : undefined,
        },
        { papel, atorNome },
      );
      setModalEntregarAberto(false);
      await aplicarPlacaAtualizada(
        atualizada,
        'Placa marcada como Entregue / Faturado! Garantia legal de 90 dias iniciada.',
      );
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao registrar entrega.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleConfirmarSemConserto = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa) return;
    if (!motivoSemConserto.trim()) {
      notificarErro('Informe o motivo de sem conserto ou devolução.');
      return;
    }
    setMovendoEtapa(true);
    try {
      const atualizada = await moverPlaca(
        placa.id,
        'sem_conserto',
        { unrepaired_reason: motivoSemConserto.trim() },
        { papel, atorNome },
      );
      setModalSemConsertoAberto(false);
      setMotivoSemConserto('');
      await aplicarPlacaAtualizada(atualizada, 'Placa finalizada como Sem Conserto / Devolvido.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao finalizar placa.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleConfirmarArquivar = async () => {
    if (!placa) return;
    setMovendoEtapa(true);
    try {
      const atualizada = await arquivarPlaca(placa.id, atorNome);
      setModalArquivarAberto(false);
      await aplicarPlacaAtualizada(atualizada, 'Placa arquivada e movida para Finalizadas.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao arquivar placa.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleConfirmarCancelar = async (e: FormEvent) => {
    e.preventDefault();
    if (!placa) return;
    if (!motivoCancelamento.trim()) {
      notificarErro('Informe o motivo do cancelamento da entrada.');
      return;
    }
    setMovendoEtapa(true);
    try {
      await cancelarPlaca(placa.id, motivoCancelamento.trim(), atorNome);
      setModalCancelarAberto(false);
      setMotivoCancelamento('');
      onListaAlterada();
      onFechar();
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao cancelar entrada.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleReabrirPlaca = async () => {
    if (!placa || papel !== 'admin') return;
    setMovendoEtapa(true);
    try {
      const atualizada = await reabrirPlaca(placa.id, { papel, atorNome });
      await aplicarPlacaAtualizada(atualizada, 'Placa reaberta e devolvida ao Kanban ativo.');
    } catch (err) {
      notificarErro(err instanceof Error ? err.message : 'Erro ao reabrir placa.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloDrawerId}
        className="fixed inset-0 z-40 flex justify-end bg-slate-900/50 backdrop-blur-[1px] print:hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onFechar();
        }}
      >
        <div className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl">
          {/* Cabeçalho fixo da gaveta */}
          <header className="border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id={tituloDrawerId}
                    className="font-mono text-lg font-extrabold tracking-tight text-slate-900"
                  >
                    {placa?.board_number ?? 'Carregando placa...'}
                  </h2>
                  {placa && (
                    <>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CORES_ETAPA_PLACA[placa.status].selo}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${CORES_ETAPA_PLACA[placa.status].ponto}`}
                          aria-hidden="true"
                        />
                        {ROTULO_ETAPA_PLACA[placa.status]}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].selo}`}
                      >
                        {CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].rotuloCurto}
                      </span>

                      {placa.is_warranty && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                          <ShieldCheck size={12} aria-hidden="true" />
                          Garantia
                        </span>
                      )}

                      {placa.stalled && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
                          Encalhada · {placa.days_since_entry}d desde a entrada
                        </span>
                      )}

                      {temFinanceiro && placa.refunded && (
                        <span className="rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-900">
                          Reembolsada
                        </span>
                      )}
                    </>
                  )}
                </div>

                {placa && (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong className="font-semibold text-slate-900">{placa.customer_name}</strong>
                    {placa.customer_phone ? ` · ${formatarTelefone(placa.customer_phone)}` : ''}
                    {placa.customer_city ? ` · ${placa.customer_city}` : ''}
                    {placa.os_number ? ` · OS do Control ${placa.os_number}` : ''}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {placa && (
                  <>
                    <button
                      type="button"
                      onClick={() => setVerEtiqueta(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Tag size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">Etiqueta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerComprovante(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <FileText size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">Comprovante</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onFechar}
                  aria-label="Fechar detalhes da placa"
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          {/* Corpo rolável */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
            {carregando && (
              <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-slate-500">
                <Loader2 size={20} className="animate-spin text-blue-600" aria-hidden="true" />
                <span>Carregando ficha da placa...</span>
              </div>
            )}

            {!carregando && erroCarga && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
              >
                <span>{erroCarga}</span>
                <button
                  type="button"
                  onClick={() => setRecargaChave((c) => c + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Tentar de novo
                </button>
              </div>
            )}

            {!carregando && placa && (
              <>
                {/* Faixa de placa finalizada / arquivada (somente leitura) */}
                {somenteLeitura && (
                  <div className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-xs text-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        Modo somente leitura ·{' '}
                        {placa.archived && !ehEtapaFinalPlaca(placa.status)
                          ? `Placa arquivada em ${formatarDataHora(placa.archived_at)}`
                          : `${ROTULO_ETAPA_PLACA[placa.status]} em ${formatarData(placa.finished_at ?? placa.stage_changed_at)}`}
                      </p>
                      {papel === 'admin' && (
                        <span className="text-[11px] text-slate-600">
                          Use &ldquo;Reabrir&rdquo; no rodapé se precisar devolvê-la ao Kanban.
                        </span>
                      )}
                    </div>
                    {placa.status === 'sem_conserto' && placa.unrepaired_reason && (
                      <p className="mt-1 text-rose-900">
                        <strong>Motivo registrado:</strong> {placa.unrepaired_reason}
                      </p>
                    )}
                  </div>
                )}

                {avisoSucesso && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                      {avisoSucesso}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAvisoSucesso(null)}
                      className="text-emerald-700 hover:underline"
                    >
                      Fechar
                    </button>
                  </div>
                )}

                {avisoErro && (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-900"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0 text-rose-600" aria-hidden="true" />
                      {avisoErro}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAvisoErro(null)}
                      className="text-rose-700 hover:underline"
                    >
                      Fechar
                    </button>
                  </div>
                )}

                {/* 1. Mudança rápida de etapa no Kanban */}
                {!somenteLeitura && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Mudar etapa na bancada
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Entrada em {formatarData(placa.created_at)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ETAPAS_KANBAN_PLACA.map((col) => {
                        const atual = placa.status === col.etapa;
                        const permitido = podeMoverPlaca(placa, col.etapa, papel);
                        const motivo = motivoBloqueioPlaca(placa, col.etapa, papel);
                        return (
                          <button
                            key={col.etapa}
                            type="button"
                            disabled={atual || movendoEtapa}
                            title={motivo ?? `Mover para ${col.rotulo}`}
                            onClick={() => void handleMoverEtapaKanban(col.etapa)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              atual
                                ? CORES_ETAPA_PLACA[col.etapa].chipAtivo
                                : permitido
                                  ? 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-blue-50'
                                  : 'border-slate-200 bg-slate-50/50 text-slate-400'
                            }`}
                          >
                            {!atual && !permitido && <Lock size={11} aria-hidden="true" />}
                            {!atual && permitido && <ArrowRight size={11} aria-hidden="true" />}
                            <span>{col.rotuloCurto}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Equipamento e placa */}
                <form
                  onSubmit={handleSalvarEquipamento}
                  noValidate
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Equipamento e placa</h3>
                    {!somenteLeitura && (
                      <button
                        type="submit"
                        disabled={salvandoEquip}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {salvandoEquip ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Save size={13} aria-hidden="true" />
                        )}
                        <span>Salvar equipamento</span>
                      </button>
                    )}
                  </div>

                  <datalist id={`${idBase}-tipos-eq`}>
                    {SUGESTOES_TIPO_EQUIPAMENTO_PLACA.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor={`${idBase}-eq-tipo`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Tipo de equipamento
                      </label>
                      <input
                        id={`${idBase}-eq-tipo`}
                        type="text"
                        list={`${idBase}-tipos-eq`}
                        disabled={somenteLeitura}
                        value={tipoEquipamento}
                        onChange={(e) => setTipoEquipamento(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`${idBase}-eq-marca`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Marca / modelo *
                      </label>
                      <input
                        id={`${idBase}-eq-marca`}
                        type="text"
                        disabled={somenteLeitura}
                        value={marcaModelo}
                        onChange={(e) => setMarcaModelo(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${idBase}-eq-cod`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Código da placa *
                      </label>
                      <input
                        id={`${idBase}-eq-cod`}
                        type="text"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        disabled={somenteLeitura}
                        value={codigoPlaca}
                        onChange={(e) => setCodigoPlaca(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${idBase}-eq-perif`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Periféricos / acessórios
                      </label>
                      <input
                        id={`${idBase}-eq-perif`}
                        type="text"
                        disabled={somenteLeitura}
                        value={perifericos}
                        onChange={(e) => setPerifericos(e.target.value)}
                        placeholder="Sensores, display, chicotes..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${idBase}-eq-def`}
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Defeito reclamado
                    </label>
                    <textarea
                      id={`${idBase}-eq-def`}
                      rows={2}
                      disabled={somenteLeitura}
                      value={defeitoReclamado}
                      onChange={(e) => setDefeitoReclamado(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${idBase}-eq-ret`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Técnico de retirada / recepção
                      </label>
                      <select
                        id={`${idBase}-eq-ret`}
                        disabled={somenteLeitura}
                        value={tecRetiradaId}
                        onChange={(e) => setTecRetiradaId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Balcão / portador direto</option>
                        {tecnicos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`${idBase}-eq-ban`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Técnico de bancada
                      </label>
                      <select
                        id={`${idBase}-eq-ban`}
                        disabled={somenteLeitura}
                        value={tecBancadaId}
                        onChange={(e) => setTecBancadaId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Não atribuído</option>
                        {tecnicos.filter((t) => ehTecnicoBancadaPlacas(t) || t.id === tecBancadaId).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      disabled={somenteLeitura}
                      checked={semDefeitoAparente}
                      onChange={(e) => setSemDefeitoAparente(e.target.checked)}
                      className="h-4 w-4 rounded accent-blue-600"
                    />
                    <span>Sem defeito aparente na entrada</span>
                  </label>
                </form>

                {/* 3. Bancada */}
                <form
                  onSubmit={handleSalvarBancada}
                  noValidate
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Bancada e diagnóstico</h3>
                      <p className="text-xs text-slate-500">
                        Diagnóstico técnico interno (não aparece no link público do cliente).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!somenteLeitura && (
                        <button
                          type="submit"
                          disabled={salvandoBancada}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {salvandoBancada ? (
                            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Save size={13} aria-hidden="true" />
                          )}
                          <span>Salvar bancada</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor={`${idBase}-ban-erro`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Código de erro
                      </label>
                      <input
                        id={`${idBase}-ban-erro`}
                        type="text"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        disabled={somenteLeitura}
                        value={codigoErro}
                        onChange={(e) => setCodigoErro(e.target.value)}
                        placeholder="Ex.: P4, CH05, E1"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm placeholder:font-sans disabled:bg-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`${idBase}-ban-comp`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Componentes trocados (sai no Termo de Garantia)
                      </label>
                      <input
                        id={`${idBase}-ban-comp`}
                        type="text"
                        disabled={somenteLeitura}
                        value={componentesTrocados}
                        onChange={(e) => setComponentesTrocados(e.target.value)}
                        placeholder="Ex.: IPM PS21964-4S, 2x PC817, capacitor 35V 470uF"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${idBase}-ban-diag`}
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Diagnóstico técnico de bancada
                    </label>
                    <textarea
                      id={`${idBase}-ban-diag`}
                      rows={3}
                      disabled={somenteLeitura}
                      value={diagnosticoTecnico}
                      onChange={(e) => setDiagnosticoTecnico(e.target.value)}
                      placeholder="Anote leituras de multímetro/osciloscópio, estágios em curto e resultado do teste em simulador..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </div>
                </form>

                {/* 4. Orçamento — OMITIDO COMPLETAMENTE PARA `oficina` */}
                {ehEscritorioOuAdmin && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">Orçamento</h3>
                        {!placa.is_warranty && (
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ORCAMENTO_PLACA[placa.quote_status].selo}`}
                          >
                            {CORES_ORCAMENTO_PLACA[placa.quote_status].rotulo}
                          </span>
                        )}
                      </div>
                      {placa.quote_sent_at && (
                        <span className="text-[11px] text-slate-500">
                          Enviado em {formatarDataHora(placa.quote_sent_at)}
                        </span>
                      )}
                    </div>

                    {placa.is_warranty ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5 text-xs text-violet-900">
                        Esta placa entrou como <strong>Retorno em garantia</strong> e segue para análise/reparo sem geração de novo orçamento.
                      </div>
                    ) : (
                      <>
                        {placa.quote_responded_at && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-0.5">
                            <p className="font-semibold text-slate-900">
                              Resposta registrada por {placa.quote_responded_by_name || 'Escritório'}{' '}
                              em {formatarDataHora(placa.quote_responded_at)}
                              {placa.quote_response_channel
                                ? ` · via ${ROTULO_CANAL_ORCAMENTO[placa.quote_response_channel]}`
                                : ''}
                            </p>
                            {placa.quote_response_notes && (
                              <p className="text-slate-600">
                                Observação: {placa.quote_response_notes}
                              </p>
                            )}
                          </div>
                        )}

                        <form onSubmit={handleSalvarOrcamento} noValidate className="space-y-3.5">
                          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                            <div>
                              <label
                                htmlFor={`${idBase}-orc-val`}
                                className="mb-1 block text-xs font-semibold text-slate-700"
                              >
                                Valor do orçamento (R$) *
                              </label>
                              <input
                                id={`${idBase}-orc-val`}
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={somenteLeitura}
                                value={valorOrcamentoTexto}
                                onChange={(e) => setValorOrcamentoTexto(e.target.value)}
                                placeholder="Ex.: 480.00"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`${idBase}-orc-prazo`}
                                className="mb-1 block text-xs font-semibold text-slate-700"
                              >
                                Validade (dias corridos)
                              </label>
                              <input
                                id={`${idBase}-orc-prazo`}
                                type="number"
                                min="1"
                                max="60"
                                disabled={somenteLeitura}
                                value={validadeOrcamento}
                                onChange={(e) => setValidadeOrcamento(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`${idBase}-orc-doc`}
                                className="mb-1 block text-xs font-semibold text-slate-700"
                              >
                                CPF / CNPJ no orçamento
                              </label>
                              <div className="flex gap-1.5">
                                <select
                                  aria-label="Tipo de documento"
                                  disabled={somenteLeitura}
                                  value={tipoPessoaDoc}
                                  onChange={(e) => {
                                    const novo = e.target.value as PersonType;
                                    setTipoPessoaDoc(novo);
                                    setDocumentoOrcamento((atual) =>
                                      formatarDocumento(atual, novo),
                                    );
                                  }}
                                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-semibold disabled:bg-slate-100"
                                >
                                  <option value="PF">CPF</option>
                                  <option value="PJ">CNPJ</option>
                                </select>
                                <input
                                  id={`${idBase}-orc-doc`}
                                  type="text"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  disabled={somenteLeitura}
                                  value={documentoOrcamento}
                                  onChange={(e) =>
                                    setDocumentoOrcamento(
                                      formatarDocumento(e.target.value, tipoPessoaDoc),
                                    )
                                  }
                                  placeholder={
                                    tipoPessoaDoc === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                                  }
                                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs disabled:bg-slate-100"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`${idBase}-orc-end`}
                              className="mb-1 block text-xs font-semibold text-slate-700"
                            >
                              Endereço do cliente (para o PDF)
                            </label>
                            <input
                              id={`${idBase}-orc-end`}
                              type="text"
                              disabled={somenteLeitura}
                              value={enderecoOrcamento}
                              onChange={(e) => setEnderecoOrcamento(e.target.value)}
                              placeholder="Rua, número, bairro e cidade"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`${idBase}-orc-par`}
                              className="mb-1 block text-xs font-semibold text-slate-700"
                            >
                              Parecer técnico para a proposta *
                            </label>
                            <textarea
                              id={`${idBase}-orc-par`}
                              rows={2}
                              disabled={somenteLeitura}
                              value={parecerOrcamento}
                              onChange={(e) => setParecerOrcamento(e.target.value)}
                              placeholder="Descrição clara do reparo proposto que constará no documento enviado ao cliente..."
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {!somenteLeitura && (
                              <button
                                type="submit"
                                disabled={salvandoOrcamento}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                {salvandoOrcamento ? (
                                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Save size={14} aria-hidden="true" />
                                )}
                                <span>Salvar orçamento</span>
                              </button>
                            )}

                            {placa.quote_amount != null && placa.quote_amount > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setVerOrcamentoDoc(true)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                >
                                  <FileText size={14} aria-hidden="true" />
                                  <span>Ver/Imprimir orçamento</span>
                                </button>

                                {!somenteLeitura && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={enviandoPdfWhats}
                                      onClick={() => void handleEnviarPdfWhatsDireto()}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {enviandoPdfWhats ? (
                                        <Loader2
                                          size={14}
                                          className="animate-spin"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <MessageCircle size={14} aria-hidden="true" />
                                      )}
                                      <span>Enviar pelo WhatsApp (link para aprovar)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDecisaoResposta(
                                          placa.quote_status === 'recusado'
                                            ? 'recusado'
                                            : 'aprovado',
                                        );
                                        setModalRespostaAberto(true);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                                    >
                                      <FileCheck2 size={14} aria-hidden="true" />
                                      <span>Registrar resposta</span>
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </form>
                      </>
                    )}
                  </section>
                )}

                {/* 5. Garantia (exibida quando é retorno em garantia ou quando foi entregue) */}
                {(placa.is_warranty || placa.status === 'entregue') && (
                  <section className="rounded-2xl border border-violet-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={17} className="text-violet-600" aria-hidden="true" />
                        <h3 className="text-sm font-bold text-slate-900">Garantia</h3>
                      </div>

                      {placa.status === 'entregue' && (
                        <button
                          type="button"
                          onClick={() => setVerTermoGarantia(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-800"
                        >
                          <FileText size={14} aria-hidden="true" />
                          <span>Termo de garantia</span>
                        </button>
                      )}
                    </div>

                    {placa.is_warranty && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-xs text-violet-950">
                        <span>
                          Entrada classificada como <strong>Retorno em garantia</strong>.
                        </span>
                        {placa.warranty_origin_id && placa.warranty_origin_number && (
                          <button
                            type="button"
                            onClick={() => onTrocarPlaca(placa.warranty_origin_id!)}
                            className="inline-flex items-center gap-1 font-mono font-bold text-violet-800 underline hover:text-violet-950"
                          >
                            <span>Abrir placa original {placa.warranty_origin_number}</span>
                            <ExternalLink size={12} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}

                    {placa.status === 'entregue' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Garantia legal de 90 dias · válida até{' '}
                            {formatarData(calcularValidadeGarantia(placa.finished_at))}
                          </p>
                          <p className="text-slate-600">
                            Saída registrada em {formatarData(placa.finished_at)}.
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            garantiaVigente(placa.finished_at)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-slate-200 text-slate-700'
                          }`}
                        >
                          {garantiaVigente(placa.finished_at)
                            ? 'Garantia vigente'
                            : 'Garantia expirada'}
                        </span>
                      </div>
                    )}
                  </section>
                )}

                {/* 6. Financeiro e Reembolso — OMITIDO SEM `podeVerFinanceiroPlacas(perfil)` */}
                {temFinanceiro && (
                  <section className="rounded-2xl border border-amber-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-amber-700" aria-hidden="true" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Financeiro e reembolso (acesso restrito)
                        </h3>
                      </div>
                      {placa.charged_amount != null && (
                        <span className="text-xs font-bold text-emerald-800">
                          Cobrado: {valorEmReais(placa.charged_amount)}
                        </span>
                      )}
                    </div>

                    {!somenteLeitura && (
                      <div className="flex flex-wrap items-end gap-2.5">
                        <div className="min-w-[180px] flex-1">
                          <label
                            htmlFor={`${idBase}-fin-cobrado`}
                            className="mb-1 block text-xs font-semibold text-slate-700"
                          >
                            Valor efetivamente cobrado (R$)
                          </label>
                          <input
                            id={`${idBase}-fin-cobrado`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={valorCobradoTexto}
                            onChange={(e) => setValorCobradoTexto(e.target.value)}
                            placeholder={
                              placa.quote_amount != null
                                ? `Padrão: ${placa.quote_amount}`
                                : 'Ex.: 480.00'
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={salvandoCobrado}
                          onClick={() => void handleSalvarValorCobrado()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {salvandoCobrado ? (
                            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Save size={13} aria-hidden="true" />
                          )}
                          <span>Salvar valor cobrado</span>
                        </button>
                      </div>
                    )}

                    <form
                      onSubmit={handleSalvarReembolso}
                      noValidate
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3"
                    >
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-900">
                        <input
                          type="checkbox"
                          checked={reembolsada}
                          onChange={(e) => {
                            const marcado = e.target.checked;
                            setReembolsada(marcado);
                            if (marcado && !valorReembolsoTexto) {
                              const sug = placa.charged_amount ?? placa.quote_amount;
                              if (sug != null) setValorReembolsoTexto(String(sug));
                            }
                          }}
                          className="h-4 w-4 rounded accent-rose-600"
                        />
                        <span>Reembolsada (desconta do faturamento líquido)</span>
                      </label>

                      {reembolsada && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label
                              htmlFor={`${idBase}-reemb-val`}
                              className="mb-1 block text-xs font-semibold text-slate-700"
                            >
                              Valor reembolsado (R$) *
                            </label>
                            <input
                              id={`${idBase}-reemb-val`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={valorReembolsoTexto}
                              onChange={(e) => setValorReembolsoTexto(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`${idBase}-reemb-data`}
                              className="mb-1 block text-xs font-semibold text-slate-700"
                            >
                              Data do reembolso *
                            </label>
                            <input
                              id={`${idBase}-reemb-data`}
                              type="date"
                              value={dataReembolso}
                              onChange={(e) => setDataReembolso(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`${idBase}-reemb-mot`}
                              className="mb-1 block text-xs font-semibold text-slate-700"
                            >
                              Motivo do reembolso *
                            </label>
                            <input
                              id={`${idBase}-reemb-mot`}
                              type="text"
                              value={motivoReembolso}
                              onChange={(e) => setMotivoReembolso(e.target.value)}
                              placeholder="Ex.: Retorno sem peça para reposição; estorno via PIX ao parceiro"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={salvandoReembolso}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
                        >
                          {salvandoReembolso ? (
                            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Save size={13} aria-hidden="true" />
                          )}
                          <span>Salvar reembolso</span>
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {/* 7. Acompanhamento do cliente (`/placa/:token`) */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-blue-600" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900">Acompanhamento do cliente</h3>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs break-all text-slate-700">
                    {linkPublicoPlaca(placa.public_token)}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopiarLink()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {linkCopiado ? (
                        <>
                          <Check size={13} className="text-emerald-600" aria-hidden="true" />
                          <span>Link copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} aria-hidden="true" />
                          <span>Copiar link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={montarLinkWhatsAppPlaca(
                        placa.customer_phone,
                        textoWhatsAppEntradaPlaca(placa),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle size={13} aria-hidden="true" />
                      <span>Enviar pelo WhatsApp</span>
                    </a>

                    <a
                      href={`/placa/${placa.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      <span>Abrir página pública</span>
                    </a>

                    {!somenteLeitura && ehEscritorioOuAdmin && (
                      <button
                        type="button"
                        onClick={() => setModalNovoLinkAberto(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        <RefreshCw size={13} aria-hidden="true" />
                        <span>Gerar novo link</span>
                      </button>
                    )}
                  </div>
                </section>

                {/* 8. Fotos */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
                  <FotosPlaca
                    placaId={placa.id}
                    fotos={fotos}
                    somenteLeitura={somenteLeitura}
                    atorNome={atorNome}
                    onFotosAlteradas={setFotos}
                  />
                </section>

                {/* 9. Histórico */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
                  <HistoricoPlaca
                    placaId={placa.id}
                    eventos={eventos}
                    papel={papel}
                    podeVerFinanceiro={temFinanceiro}
                    atorNome={atorNome}
                    onNovoEvento={(ev) => setEventos((prev) => [ev, ...prev])}
                  />
                </section>
              </>
            )}
          </div>

          {/* 10. Rodapé de ações — OMITIDO COMPLETAMENTE PARA `oficina` */}
          {placa && ehEscritorioOuAdmin && (
            <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              {!somenteLeitura ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={() => setModalArquivarAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Archive size={14} aria-hidden="true" />
                      <span>Arquivar</span>
                    </button>
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={() => setModalCancelarAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <Ban size={14} aria-hidden="true" />
                      <span>Cancelar entrada</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={() => setModalSemConsertoAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      <span>Sem Conserto / Devolvido</span>
                    </button>
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={abrirModalEntregar}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>Entregue / Faturado</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Placa finalizada ({ROTULO_ETAPA_PLACA[placa.status]}).
                  </span>
                  {papel === 'admin' && (
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={() => void handleReabrirPlaca()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>Reabrir</span>
                    </button>
                  )}
                </div>
              )}
            </footer>
          )}
        </div>
      </div>

      {/* Documentos A4 e Etiqueta */}
      {placa && verComprovante && (
        <ComprovanteEntradaDocumento
          placa={placa}
          onFechar={() => setVerComprovante(false)}
          onAbrirEtiqueta={() => {
            setVerComprovante(false);
            setVerEtiqueta(true);
          }}
        />
      )}

      {placa && verOrcamentoDoc && ehEscritorioOuAdmin && (
        <OrcamentoPlacaDocumento
          placa={placa}
          atorNome={atorNome}
          onFechar={() => setVerOrcamentoDoc(false)}
          onPlacaAtualizada={(atualizada) => {
            void aplicarPlacaAtualizada(atualizada);
          }}
        />
      )}

      {placa && verTermoGarantia && (
        <TermoGarantiaDocumento
          placa={placa}
          papelUsuario={papel}
          onFechar={() => setVerTermoGarantia(false)}
        />
      )}

      <EtiquetaPlacaModal
        placa={verEtiqueta ? placa : null}
        onFechar={() => setVerEtiqueta(false)}
      />

      {/* Modal: Registrar resposta do orçamento */}
      <ModalDialogoPlacas
        aberto={modalRespostaAberto}
        onFechar={() => setModalRespostaAberto(false)}
        titulo="Registrar resposta do orçamento"
        subtitulo="Registra decisão, canal, quem confirmou e libera ou bloqueia o reparo."
      >
        <form onSubmit={handleConfirmarRespostaOrcamento} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Decisão do cliente
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                  decisaoResposta === 'aprovado'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name={`${idBase}-decisao`}
                  checked={decisaoResposta === 'aprovado'}
                  onChange={() => setDecisaoResposta('aprovado')}
                  className="accent-emerald-600"
                />
                <span>Aprovado</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                  decisaoResposta === 'recusado'
                    ? 'border-rose-600 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name={`${idBase}-decisao`}
                  checked={decisaoResposta === 'recusado'}
                  onChange={() => setDecisaoResposta('recusado')}
                  className="accent-rose-600"
                />
                <span>Recusado</span>
              </label>
            </div>
          </fieldset>

          <div>
            <label
              htmlFor={`${idBase}-resp-canal`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Canal da resposta
            </label>
            <select
              id={`${idBase}-resp-canal`}
              value={canalResposta}
              onChange={(e) => setCanalResposta(e.target.value as BoardQuoteChannel)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="telefone">Telefone</option>
              <option value="presencial">Presencial no balcão</option>
              <option value="email">E-mail</option>
            </select>
          </div>

          <div>
            <label
              htmlFor={`${idBase}-resp-obs`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Observação (opcional)
            </label>
            <textarea
              id={`${idBase}-resp-obs`}
              rows={2}
              value={obsResposta}
              onChange={(e) => setObsResposta(e.target.value)}
              placeholder="Ex.: Sinal de 50% confirmado no PIX; parceiro pediu urgência."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalRespostaAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoResposta}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {salvandoResposta && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Salvar resposta</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Gerar novo link de acompanhamento */}
      <ModalDialogoPlacas
        aberto={modalNovoLinkAberto}
        onFechar={() => setModalNovoLinkAberto(false)}
        titulo="Gerar novo link de acompanhamento?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Ao gerar um novo código público, <strong>o link anterior deixará de funcionar imediatamente</strong>. Você precisará enviar o novo endereço ao cliente ou parceiro.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalNovoLinkAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Manter link atual
            </button>
            <button
              type="button"
              disabled={gerandoLink}
              onClick={() => void handleConfirmarNovoLink()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {gerandoLink && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Revogar anterior e gerar novo</span>
            </button>
          </div>
        </div>
      </ModalDialogoPlacas>

      {/* Modal: Finalizar como Entregue / Faturado */}
      <ModalDialogoPlacas
        aberto={modalEntregarAberto}
        onFechar={() => setModalEntregarAberto(false)}
        titulo="Registrar saída — Entregue / Faturado"
        subtitulo="Inicia a garantia legal de 90 dias a partir da data de saída."
      >
        <form onSubmit={handleConfirmarEntrega} className="space-y-4">
          <div>
            <label
              htmlFor={`${idBase}-ent-data`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Data de saída / entrega *
            </label>
            <input
              id={`${idBase}-ent-data`}
              type="date"
              required
              value={dataSaidaEntrega}
              onChange={(e) => setDataSaidaEntrega(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          {temFinanceiro && (
            <div>
              <label
                htmlFor={`${idBase}-ent-cob`}
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Valor efetivamente cobrado (R$)
              </label>
              <input
                id={`${idBase}-ent-cob`}
                type="number"
                step="0.01"
                min="0"
                value={cobradoNaEntregaTexto}
                onChange={(e) => setCobradoNaEntregaTexto(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalEntregarAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={movendoEtapa}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {movendoEtapa && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Confirmar entrega</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Finalizar como Sem Conserto / Devolvido */}
      <ModalDialogoPlacas
        aberto={modalSemConsertoAberto}
        onFechar={() => setModalSemConsertoAberto(false)}
        titulo="Finalizar como Sem Conserto / Devolvido"
      >
        <form onSubmit={handleConfirmarSemConserto} className="space-y-4">
          <div>
            <label
              htmlFor={`${idBase}-sc-mot`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Motivo de sem conserto ou devolução *
            </label>
            <textarea
              id={`${idBase}-sc-mot`}
              rows={3}
              value={motivoSemConserto}
              onChange={(e) => setMotivoSemConserto(e.target.value)}
              placeholder="Ex.: Microcontrolador principal em curto sem peça no mercado / Orçamento recusado pelo cliente."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalSemConsertoAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={movendoEtapa}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {movendoEtapa && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Confirmar devolução</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Arquivar */}
      <ModalDialogoPlacas
        aberto={modalArquivarAberto}
        onFechar={() => setModalArquivarAberto(false)}
        titulo="Arquivar esta placa?"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            A placa sairá do Kanban ativo e passará a aparecer na aba <strong>Finalizadas</strong>, preservando fotos e histórico.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalArquivarAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={movendoEtapa}
              onClick={() => void handleConfirmarArquivar()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {movendoEtapa && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Arquivar placa</span>
            </button>
          </div>
        </div>
      </ModalDialogoPlacas>

      {/* Modal: Cancelar entrada */}
      <ModalDialogoPlacas
        aberto={modalCancelarAberto}
        onFechar={() => setModalCancelarAberto(false)}
        titulo="Cancelar entrada da placa"
        subtitulo="Usado quando a placa foi cadastrada por engano ou desistência imediata no balcão."
      >
        <form onSubmit={handleConfirmarCancelar} className="space-y-4">
          <div>
            <label
              htmlFor={`${idBase}-canc-mot`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Motivo do cancelamento *
            </label>
            <textarea
              id={`${idBase}-canc-mot`}
              rows={2}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Ex.: Cadastro em duplicidade na recepção."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalCancelarAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={movendoEtapa}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {movendoEtapa && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Confirmar cancelamento</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>
    </>,
    document.body,
  );
}

