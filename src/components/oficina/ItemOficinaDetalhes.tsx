import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { useTelaAjuda } from '../../ajuda/contextoAjuda';
import { useAuth } from '../../contexts/useAuth';
import { buscarClientePorId } from '../../services/clientes';
import {
  atualizarItem,
  buscarItem,
  fotosDoItem,
  historicoDoItem,
  itensDaOS,
  listarTecnicosOficina,
  marcarEntregue,
  mudarEtapa,
  reabrirItem,
  receberItem,
} from '../../services/oficina';
import type { Attachment } from '../../types/fsm';
import type {
  CamposEscritorio,
  EtapaOficina,
  EventoOficina,
  ItemOficinaTela,
  SituacaoPecas,
  UnidadeRecolhida,
} from '../../types/oficina';
import {
  COLUNAS_KANBAN,
  ROTULO_CANAL,
  ROTULO_ETAPA,
  ROTULO_PECAS,
  ROTULO_UNIDADE,
  TENSOES,
  TIPOS_EQUIPAMENTO,
  acoesEscritorio,
  diasNaOficina,
  ehFinal,
  motivoBloqueio,
  numeroItem,
  podeMover,
  textoOrcamentoWhatsApp,
  valorEmReais,
} from '../../utils/oficina';
import { formatarDataHora } from '../../utils/ordens';
import OrdemDetalhes from '../ordens/OrdemDetalhes';
import { CORES_ETAPA } from './cores';
import EtiquetaModal from './EtiquetaModal';
import FotosItem from './FotosItem';
import HistoricoItem from './HistoricoItem';
import {
  ModalAutorizarDescarte,
  ModalCancelarItem,
  ModalCriarOsDevolucao,
  ModalRegistrarOrcamento,
  ModalRespostaCliente,
} from './ModaisAcaoOficina';

type EtapaKanban = Exclude<EtapaOficina, 'entregue' | 'descarte' | 'cancelado'>;

// 16 px no celular (abaixo disso o navegador dá zoom ao tocar no campo); 14 px no computador
const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 sm:text-sm';

/**
 * Texto longo: cresce com o conteúdo (nada de caixinha com rolagem no celular). Somente leitura usa
 * `readOnly`, não `disabled`, para o texto continuar escuro e legível.
 */
const TEXTO = `${INPUT} resize-none [field-sizing:content] min-h-[4.5rem] read-only:bg-slate-50 read-only:focus:ring-0 read-only:focus:border-slate-200`;

/** Linhas para navegadores sem `field-sizing` (~45 caracteres por linha no celular). */
const linhas = (t: string, minimo = 2) =>
  Math.min(20, Math.max(minimo, t.split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 45)), 0)));

function normalizarWhatsapp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

interface FormEquipamento {
  equipment_type: string;
  units_collected: UnidadeRecolhida;
  brand: string;
  model: string;
  serial_number: string;
  capacity_btu: string;
  voltage: string;
  accessories: string;
  reported_defect: string;
  field_report: string;
  intake_notes: string;
  pickup_employee_id: string;
  is_warranty: boolean;
}

interface FormBancada {
  diagnosis: string;
  parts_needed: string;
  parts_status: SituacaoPecas;
  repair_notes: string;
  bench_employee_id: string;
}

function extrairFormEquipamento(i: ItemOficinaTela): FormEquipamento {
  return {
    equipment_type: i.equipment_type ?? '',
    units_collected: i.units_collected,
    brand: i.brand ?? '',
    model: i.model ?? '',
    serial_number: i.serial_number ?? '',
    capacity_btu: i.capacity_btu != null ? String(i.capacity_btu) : '',
    voltage: i.voltage ?? '',
    accessories: i.accessories ?? '',
    reported_defect: i.reported_defect ?? '',
    field_report: i.field_report ?? '',
    intake_notes: i.intake_notes ?? '',
    pickup_employee_id: i.pickup_employee_id ?? '',
    is_warranty: i.is_warranty,
  };
}

function extrairFormBancada(i: ItemOficinaTela): FormBancada {
  return {
    diagnosis: i.diagnosis ?? '',
    parts_needed: i.parts_needed ?? '',
    parts_status: i.parts_status,
    repair_notes: i.repair_notes ?? '',
    bench_employee_id: i.bench_employee_id ?? '',
  };
}

interface ItemOficinaDetalhesProps {
  itemId: string;
  /** Abre o modal de etiqueta automaticamente assim que o item terminar de carregar. */
  abrirEtiquetaInicial?: boolean;
  /** Quando aberto de dentro de uma OS, evita reabrir a mesma OS em nova camada. */
  ordemPaiId?: string;
  onFechar: () => void;
  onAlterado?: () => void | Promise<void>;
}

export default function ItemOficinaDetalhes({
  itemId,
  abrirEtiquetaInicial = false,
  ordemPaiId,
  onFechar,
  onAlterado,
}: ItemOficinaDetalhesProps) {
  useTelaAjuda('item-oficina');
  const { profile } = useAuth();
  const papel = profile?.role;
  const ehAdmin = papel === 'admin';
  const ehEscritorio = papel === 'admin' || papel === 'escritorio';

  const [item, setItem] = useState<ItemOficinaTela | null>(null);
  const [totalNaOs, setTotalNaOs] = useState<number>(1);
  const [eventos, setEventos] = useState<EventoOficina[]>([]);
  const [fotos, setFotos] = useState<Attachment[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; name: string; role: string }[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [formEq, setFormEq] = useState<FormEquipamento | null>(null);
  const [formBancada, setFormBancada] = useState<FormBancada | null>(null);

  const [salvandoEq, setSalvandoEq] = useState(false);
  const [sucessoEq, setSucessoEq] = useState(false);
  const [salvandoBancada, setSalvandoBancada] = useState(false);
  const [sucessoBancada, setSucessoBancada] = useState(false);
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Modais
  const [etiquetaAberta, setEtiquetaAberta] = useState(abrirEtiquetaInicial);
  const [modalAcao, setModalAcao] = useState<
    'orcamento' | 'resposta' | 'descarte' | 'devolucao' | 'cancelar' | null
  >(null);
  const [ordemSobrepostaId, setOrdemSobrepostaId] = useState<string | null>(null);

  const carregarItemCompleto = useCallback(
    async (sincronizarFormularios: boolean) => {
      const encontrado = await buscarItem(itemId);
      if (!encontrado) {
        setErroCarga('Item da oficina não encontrado.');
        setItem(null);
        return;
      }
      setItem(encontrado);
      if (sincronizarFormularios) {
        setFormEq(extrairFormEquipamento(encontrado));
        setFormBancada(extrairFormBancada(encontrado));
      }

      if (encontrado.service_order_id) {
        itensDaOS(encontrado.service_order_id)
          .then((lista) => {
            const destaOs = lista.filter((x) => x.service_order_id === encontrado.service_order_id);
            setTotalNaOs(Math.max(1, destaOs.length));
          })
          .catch(() => {
            // Não impede a tela caso falhe
          });
      }
    },
    [itemId],
  );

  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    try {
      const lista = await historicoDoItem(itemId);
      setEventos(lista);
    } catch {
      // Histórico complementar
    } finally {
      setCarregandoEventos(false);
    }
  }, [itemId]);

  const carregarFotos = useCallback(async () => {
    try {
      const lista = await fotosDoItem(itemId);
      setFotos(lista);
    } catch {
      // Fotos complementares
    }
  }, [itemId]);

  const [tentativaCarga, setTentativaCarga] = useState(0);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      buscarItem(itemId),
      historicoDoItem(itemId).catch(() => [] as EventoOficina[]),
      fotosDoItem(itemId).catch(() => [] as Attachment[]),
      listarTecnicosOficina().catch(() => [] as { id: string; name: string; role: string }[]),
    ])
      .then(([encontrado, listaEventos, listaFotos, listaFuncionarios]) => {
        if (!ativo) return;
        if (!encontrado) {
          setErroCarga('Item da oficina não encontrado.');
          setItem(null);
          return;
        }
        setErroCarga(null);
        setItem(encontrado);
        setFormEq(extrairFormEquipamento(encontrado));
        setFormBancada(extrairFormBancada(encontrado));
        setEventos(listaEventos);
        setFotos(listaFotos);
        setFuncionarios(listaFuncionarios);

        if (encontrado.service_order_id) {
          void itensDaOS(encontrado.service_order_id)
            .then((lista) => {
              if (!ativo) return;
              const destaOs = lista.filter((x) => x.service_order_id === encontrado.service_order_id);
              setTotalNaOs(Math.max(1, destaOs.length));
            })
            .catch(() => {});
        }
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setErroCarga(e instanceof Error ? e.message : 'Não foi possível carregar o item da oficina.');
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
          setCarregandoEventos(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [itemId, tentativaCarga]);

  const tentarCarregarNovamente = () => {
    setCarregando(true);
    setErroCarga(null);
    setTentativaCarga((v) => v + 1);
  };

  const atualizarAposAcao = useCallback(
    async (ressincronizarForms = true) => {
      await Promise.all([carregarItemCompleto(ressincronizarForms), carregarEventos()]);
      await onAlterado?.();
    },
    [carregarItemCompleto, carregarEventos, onAlterado],
  );

  const mapaNomesFuncionarios = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f.name])),
    [funcionarios],
  );

  // Nomes de quem registrou a decisão e o descarte (extraídos do histórico para não exigir leitura de profiles)
  const autorDecisao = useMemo(() => {
    for (let i = eventos.length - 1; i >= 0; i--) {
      if (eventos[i].event === 'decisao') return eventos[i].actor_name;
    }
    return null;
  }, [eventos]);

  const autorDescarte = useMemo(() => {
    for (let i = eventos.length - 1; i >= 0; i--) {
      if (eventos[i].event === 'descarte_autorizado') return eventos[i].actor_name;
    }
    return null;
  }, [eventos]);

  const handleMudarEtapa = async (destino: EtapaKanban) => {
    if (!item) return;
    setMovendoEtapa(true);
    setErroAcao(null);
    const eraEmTransito = item.status === 'em_transito' && destino === 'entrada';
    try {
      if (eraEmTransito) {
        await receberItem(item.id);
      } else {
        await mudarEtapa(item.id, destino);
      }
      await atualizarAposAcao(true);
      if (eraEmTransito) {
        setEtiquetaAberta(true);
      }
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível mudar a etapa.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleSalvarEquipamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!item || !formEq) return;
    setErroAcao(null);

    const tipoLimpo = formEq.equipment_type.trim();
    if (!tipoLimpo) {
      setErroAcao('Informe o tipo de equipamento.');
      return;
    }

    let btuNum: number | null = null;
    if (formEq.capacity_btu.trim()) {
      const n = Number(formEq.capacity_btu.trim());
      if (!Number.isInteger(n) || n <= 0) {
        setErroAcao('Informe os BTUs apenas com números inteiros positivos.');
        return;
      }
      btuNum = n;
    }

    // Envia apenas os campos realmente alterados
    const alteracoes: CamposEscritorio = {};
    if (tipoLimpo !== item.equipment_type) alteracoes.equipment_type = tipoLimpo;
    if (formEq.units_collected !== item.units_collected) alteracoes.units_collected = formEq.units_collected;
    if ((formEq.brand.trim() || null) !== (item.brand ?? null)) alteracoes.brand = formEq.brand.trim() || null;
    if ((formEq.model.trim() || null) !== (item.model ?? null)) alteracoes.model = formEq.model.trim() || null;
    if ((formEq.serial_number.trim() || null) !== (item.serial_number ?? null)) {
      alteracoes.serial_number = formEq.serial_number.trim() || null;
    }
    if (btuNum !== (item.capacity_btu ?? null)) alteracoes.capacity_btu = btuNum;
    if ((formEq.voltage.trim() || null) !== (item.voltage ?? null)) alteracoes.voltage = formEq.voltage.trim() || null;
    if ((formEq.accessories.trim() || null) !== (item.accessories ?? null)) {
      alteracoes.accessories = formEq.accessories.trim() || null;
    }
    if ((formEq.reported_defect.trim() || null) !== (item.reported_defect ?? null)) {
      alteracoes.reported_defect = formEq.reported_defect.trim() || null;
    }
    if ((formEq.intake_notes.trim() || null) !== (item.intake_notes ?? null)) {
      alteracoes.intake_notes = formEq.intake_notes.trim() || null;
    }

    if (ehEscritorio) {
      if ((formEq.field_report.trim() || null) !== (item.field_report ?? null)) {
        alteracoes.field_report = formEq.field_report.trim() || null;
      }
      if ((formEq.pickup_employee_id || null) !== (item.pickup_employee_id ?? null)) {
        alteracoes.pickup_employee_id = formEq.pickup_employee_id || null;
      }
      if (formEq.is_warranty !== item.is_warranty) {
        alteracoes.is_warranty = formEq.is_warranty;
      }
    }

    if (Object.keys(alteracoes).length === 0) {
      setSucessoEq(true);
      setTimeout(() => setSucessoEq(false), 2000);
      return;
    }

    setSalvandoEq(true);
    try {
      await atualizarItem(item.id, alteracoes);
      setSucessoEq(true);
      setTimeout(() => setSucessoEq(false), 2500);
      await atualizarAposAcao(true);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível salvar os dados do equipamento.');
    } finally {
      setSalvandoEq(false);
    }
  };

  const handleSalvarBancada = async (e: FormEvent) => {
    e.preventDefault();
    if (!item || !formBancada) return;
    setErroAcao(null);

    const alteracoes: CamposEscritorio = {};
    if ((formBancada.diagnosis.trim() || null) !== (item.diagnosis ?? null)) {
      alteracoes.diagnosis = formBancada.diagnosis.trim() || null;
    }
    if ((formBancada.parts_needed.trim() || null) !== (item.parts_needed ?? null)) {
      alteracoes.parts_needed = formBancada.parts_needed.trim() || null;
    }
    if (formBancada.parts_status !== item.parts_status) {
      alteracoes.parts_status = formBancada.parts_status;
    }
    if ((formBancada.repair_notes.trim() || null) !== (item.repair_notes ?? null)) {
      alteracoes.repair_notes = formBancada.repair_notes.trim() || null;
    }
    if ((formBancada.bench_employee_id || null) !== (item.bench_employee_id ?? null)) {
      alteracoes.bench_employee_id = formBancada.bench_employee_id || null;
    }

    if (Object.keys(alteracoes).length === 0) {
      setSucessoBancada(true);
      setTimeout(() => setSucessoBancada(false), 2000);
      return;
    }

    setSalvandoBancada(true);
    try {
      await atualizarItem(item.id, alteracoes);
      setSucessoBancada(true);
      setTimeout(() => setSucessoBancada(false), 2500);
      await atualizarAposAcao(true);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível salvar os dados da bancada.');
    } finally {
      setSalvandoBancada(false);
    }
  };

  const handleAvisarWhatsApp = async () => {
    if (!item || !ehEscritorio) return;
    // Abre a aba no clique síncrono para não ser bloqueada pelo navegador no celular
    const janela = window.open('', '_blank');
    try {
      const cadastro = await buscarClientePorId(item.customer_id);
      const contatos = cadastro?.contacts ?? [];
      const foneBruto =
        contatos.find((c) => c.is_primary && c.is_whatsapp && c.phone)?.phone ??
        contatos.find((c) => c.is_whatsapp && c.phone)?.phone ??
        contatos.find((c) => c.is_primary && c.phone)?.phone ??
        contatos.find((c) => c.phone)?.phone ??
        cadastro?.phone ??
        null;
      const fone = normalizarWhatsapp(foneBruto);
      const texto = textoOrcamentoWhatsApp(item);
      const url = `https://wa.me/${fone ?? ''}?text=${encodeURIComponent(texto)}`;
      if (janela) janela.location.replace(url);
      else window.location.assign(url);
      if (!fone) {
        setErroAcao(
          'O cliente não tem celular válido no cadastro: escolha o contato diretamente na janela do WhatsApp.',
        );
      }
    } catch (err) {
      janela?.close();
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível abrir o WhatsApp.');
    }
  };

  const handleClienteBuscouNaLoja = async () => {
    if (!item) return;
    if (!window.confirm('Confirmar que o cliente buscou o equipamento na loja e marcar como Entregue?')) {
      return;
    }
    setErroAcao(null);
    setMovendoEtapa(true);
    try {
      await marcarEntregue(item.id);
      await atualizarAposAcao(true);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível marcar como entregue.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const handleReabrir = async () => {
    if (!item) return;
    if (!window.confirm('Reabrir este item? Ele voltará para a etapa "Pronto".')) return;
    setErroAcao(null);
    setMovendoEtapa(true);
    try {
      await reabrirItem(item.id);
      await atualizarAposAcao(true);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : 'Não foi possível reabrir o item.');
    } finally {
      setMovendoEtapa(false);
    }
  };

  const camadaZ = ordemPaiId ? 'z-[55]' : 'z-50';

  const conteudo = carregando ? (
    <div className="flex h-96 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <span className="text-sm font-medium">Carregando item da oficina...</span>
      </div>
    </div>
  ) : erroCarga || !item || !formEq || !formBancada ? (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
      <AlertCircle size={32} className="mx-auto text-red-600" />
      <p className="mt-3 text-sm font-semibold text-slate-800">{erroCarga ?? 'Item não encontrado.'}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={onFechar}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={tentarCarregarNovamente}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <RefreshCw size={14} /> Tentar de novo
        </button>
      </div>
    </div>
  ) : (() => {
    const finalizado = ehFinal(item.status);
    const somenteLeitura = finalizado;
    const acoes = acoesEscritorio(item);
    const numFormatado = numeroItem(item, totalNaOs);
    const dias = diasNaOficina(item);

    const etapasPermitidas = COLUNAS_KANBAN.filter((c) => podeMover(item, c.etapa, papel));
    const avisosBloqueio = !finalizado
      ? COLUNAS_KANBAN.map((c) => motivoBloqueio(item, c.etapa)).filter((m): m is string => m !== null)
      : [];
    const avisoUnicoBloqueio = avisosBloqueio[0] ?? null;

    const tecnicosBancada = funcionarios.filter(
      (f) => f.role === 'oficina' || f.role === 'tecnico' || f.id === formBancada.bench_employee_id,
    );
    const tecnicosRetirada = funcionarios.filter(
      (f) => f.role === 'tecnico' || f.role === 'supervisor' || f.id === formEq.pickup_employee_id,
    );

    const mostrarSecaoDevolucao =
      item.status === 'pronto' ||
      Boolean(item.return_service_order_id) ||
      item.status === 'entregue';

    return (
      <>
        {/* =============================================================== */}
        {/* TOPO FIXO                                                       */}
        {/* =============================================================== */}
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3.5 shadow-2xs sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Wrench size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                    {numFormatado}
                  </h1>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${CORES_ETAPA[item.status].selo}`}
                  >
                    {ROTULO_ETAPA[item.status]}
                  </span>
                  {item.is_warranty && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      <ShieldCheck size={13} /> Garantia
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {item.customer_name || 'Cliente não informado'}
                  </span>
                  <span>·</span>
                  <span className={dias >= 15 && !finalizado ? 'font-semibold text-red-600' : ''}>
                    {dias === 0 ? 'Entrou hoje' : dias === 1 ? '1 dia na oficina' : `${dias} dias na oficina`}
                  </span>
                  {ehEscritorio && item.service_order_id && item.service_order_id !== ordemPaiId && (
                    <>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setOrdemSobrepostaId(item.service_order_id)}
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                      >
                        Abrir OS {item.os_number} <ExternalLink size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEtiquetaAberta(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50"
              >
                <Printer size={15} className="text-blue-600" />
                Etiqueta
              </button>

              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Botões de mudança de etapa permitidos */}
          {!finalizado && (etapasPermitidas.length > 0 || avisoUnicoBloqueio) && (
            <div className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Mover etapa:
              </span>
              {etapasPermitidas.map((col) => {
                const ehRecebimento = item.status === 'em_transito' && col.etapa === 'entrada';
                return (
                  <button
                    key={col.etapa}
                    type="button"
                    disabled={movendoEtapa}
                    onClick={() => void handleMudarEtapa(col.etapa as EtapaKanban)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    <span className={`h-2 w-2 rounded-full ${CORES_ETAPA[col.etapa].ponto}`} />
                    {ehRecebimento ? 'Receber na loja (Entrada)' : col.rotulo}
                    <ArrowRight size={12} className="text-slate-400" />
                  </button>
                );
              })}

              {avisoUnicoBloqueio && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <Lock size={12} /> {avisoUnicoBloqueio}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto mt-6 max-w-5xl space-y-6 px-4 sm:px-6">
          {/* =============================================================== */}
          {/* FAIXA DE ITEM FINALIZADO                                        */}
          {/* =============================================================== */}
          {finalizado && (
            <div
              role="status"
              className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-5 text-slate-800 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {item.status === 'entregue' ? (
                    <PackageCheck size={22} className="text-slate-700" />
                  ) : item.status === 'descarte' ? (
                    <AlertTriangle size={22} className="text-slate-700" />
                  ) : (
                    <Ban size={22} className="text-slate-600" />
                  )}
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      Item finalizado: {ROTULO_ETAPA[item.status]}
                    </p>
                    <p className="text-xs text-slate-600">
                      {item.finished_at
                        ? `Finalizado em ${formatarDataHora(item.finished_at)}`
                        : `Atualizado em ${formatarDataHora(item.updated_at)}`}
                      {' · '}Somente leitura
                    </p>
                  </div>
                </div>
              </div>

              {item.status === 'descarte' && (
                <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3.5 text-xs text-slate-700">
                  <p className="font-bold text-slate-900">
                    Autorização de descarte
                    {item.discard_channel ? ` (${ROTULO_CANAL[item.discard_channel]})` : ''}
                    {item.discard_authorized_at ? ` em ${formatarDataHora(item.discard_authorized_at)}` : ''}
                    {autorDescarte ? ` · registrado por ${autorDescarte}` : ''}
                  </p>
                  {item.discard_note && <p className="mt-1 whitespace-pre-line">{item.discard_note}</p>}
                </div>
              )}

              {item.status === 'cancelado' && item.cancel_reason && (
                <p className="mt-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-700">
                  <strong>Motivo do cancelamento:</strong> {item.cancel_reason}
                </p>
              )}
            </div>
          )}

          {/* Erro de ação */}
          {erroAcao && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
            >
              <span>{erroAcao}</span>
              <button
                type="button"
                onClick={() => setErroAcao(null)}
                aria-label="Fechar aviso"
                className="shrink-0 text-red-500 hover:text-red-800"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO 1: EQUIPAMENTO                                            */}
          {/* =============================================================== */}
          <form
            onSubmit={handleSalvarEquipamento}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-800">Equipamento</h2>
              <div className="flex items-center gap-2">
                {sucessoEq && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Check size={13} /> Salvo
                  </span>
                )}
                {!somenteLeitura && (
                  <button
                    type="submit"
                    disabled={salvandoEq}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvandoEq && <Loader2 size={14} className="animate-spin" />}
                    Salvar equipamento
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="det-eq-tipo" className="block text-xs font-medium text-slate-700">
                  Tipo de equipamento *
                </label>
                <input
                  id="det-eq-tipo"
                  type="text"
                  list="sugestoes-tipos-detalhe"
                  required
                  disabled={somenteLeitura}
                  value={formEq.equipment_type}
                  onChange={(e) => setFormEq({ ...formEq, equipment_type: e.target.value })}
                  className={INPUT}
                />
                <datalist id="sugestoes-tipos-detalhe">
                  {TIPOS_EQUIPAMENTO.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="det-eq-unidade" className="block text-xs font-medium text-slate-700">
                  O que veio *
                </label>
                <select
                  id="det-eq-unidade"
                  disabled={somenteLeitura}
                  value={formEq.units_collected}
                  onChange={(e) =>
                    setFormEq({ ...formEq, units_collected: e.target.value as UnidadeRecolhida })
                  }
                  className={INPUT}
                >
                  {(Object.entries(ROTULO_UNIDADE) as [UnidadeRecolhida, string][]).map(
                    ([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="det-eq-marca" className="block text-xs font-medium text-slate-700">
                  Marca
                </label>
                <input
                  id="det-eq-marca"
                  type="text"
                  disabled={somenteLeitura}
                  value={formEq.brand}
                  onChange={(e) => setFormEq({ ...formEq, brand: e.target.value })}
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="det-eq-modelo" className="block text-xs font-medium text-slate-700">
                  Modelo
                </label>
                <input
                  id="det-eq-modelo"
                  type="text"
                  disabled={somenteLeitura}
                  value={formEq.model}
                  onChange={(e) => setFormEq({ ...formEq, model: e.target.value })}
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="det-eq-serie" className="block text-xs font-medium text-slate-700">
                  Nº de série
                </label>
                <input
                  id="det-eq-serie"
                  type="text"
                  disabled={somenteLeitura}
                  value={formEq.serial_number}
                  onChange={(e) => setFormEq({ ...formEq, serial_number: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="det-eq-btus" className="block text-xs font-medium text-slate-700">
                  BTUs
                </label>
                <input
                  id="det-eq-btus"
                  type="text"
                  inputMode="numeric"
                  disabled={somenteLeitura}
                  value={formEq.capacity_btu}
                  onChange={(e) =>
                    setFormEq({ ...formEq, capacity_btu: e.target.value.replace(/[^\d]/g, '') })
                  }
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="det-eq-tensao" className="block text-xs font-medium text-slate-700">
                  Tensão
                </label>
                <select
                  id="det-eq-tensao"
                  disabled={somenteLeitura}
                  value={formEq.voltage}
                  onChange={(e) => setFormEq({ ...formEq, voltage: e.target.value })}
                  className={INPUT}
                >
                  <option value="">Não informada</option>
                  {TENSOES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  {formEq.voltage && !TENSOES.includes(formEq.voltage) && (
                    <option value={formEq.voltage}>{formEq.voltage}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="det-eq-acessorios" className="block text-xs font-medium text-slate-700">
                  Acessórios
                </label>
                <input
                  id="det-eq-acessorios"
                  type="text"
                  disabled={somenteLeitura}
                  value={formEq.accessories}
                  onChange={(e) => setFormEq({ ...formEq, accessories: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>

            <div>
              <label htmlFor="det-eq-defeito" className="block text-xs font-medium text-slate-700">
                Defeito relatado
              </label>
              <textarea
                id="det-eq-defeito"
                rows={linhas(formEq.reported_defect)}
                readOnly={somenteLeitura}
                value={formEq.reported_defect}
                onChange={(e) => setFormEq({ ...formEq, reported_defect: e.target.value })}
                className={TEXTO}
              />
            </div>

            <div>
              <label htmlFor="det-eq-campo" className="block text-xs font-medium text-slate-700">
                Relato do técnico de campo
              </label>
              <textarea
                id="det-eq-campo"
                rows={linhas(formEq.field_report)}
                readOnly={somenteLeitura || !ehEscritorio}
                value={formEq.field_report}
                onChange={(e) => setFormEq({ ...formEq, field_report: e.target.value })}
                placeholder={ehEscritorio ? '' : 'Sem relato do técnico de campo.'}
                className={TEXTO}
              />
            </div>

            <div>
              <label htmlFor="det-eq-chegada" className="block text-xs font-medium text-slate-700">
                Conferência na chegada
              </label>
              <textarea
                id="det-eq-chegada"
                rows={linhas(formEq.intake_notes)}
                readOnly={somenteLeitura}
                value={formEq.intake_notes}
                onChange={(e) => setFormEq({ ...formEq, intake_notes: e.target.value })}
                placeholder="Estado em que chegou: amassado, sem tampa, faltando peça..."
                className={TEXTO}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <div>
                <label htmlFor="det-eq-retirada" className="block text-xs font-medium text-slate-700">
                  Técnico que recolheu
                </label>
                {ehEscritorio && !somenteLeitura ? (
                  <select
                    id="det-eq-retirada"
                    value={formEq.pickup_employee_id}
                    onChange={(e) => setFormEq({ ...formEq, pickup_employee_id: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">Balcão / Não informado</option>
                    {tecnicosRetirada.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-700">
                    {item.pickup_employee_name || 'Balcão / Não informado'}
                  </p>
                )}
              </div>

              <div className="flex items-end pb-1.5">
                {ehEscritorio && !somenteLeitura ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formEq.is_warranty}
                      onChange={(e) => setFormEq({ ...formEq, is_warranty: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Retorno em garantia
                  </label>
                ) : (
                  <p className="text-xs font-medium text-slate-600">
                    Garantia: <strong>{item.is_warranty ? 'Sim (retorno em garantia)' : 'Não'}</strong>
                  </p>
                )}
              </div>
            </div>

            {!somenteLeitura && (
              <button
                type="submit"
                disabled={salvandoEq}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50 sm:hidden"
              >
                {salvandoEq ? <Loader2 size={16} className="animate-spin" /> : sucessoEq ? <Check size={16} /> : null}
                {sucessoEq ? 'Salvo' : 'Salvar equipamento'}
              </button>
            )}
          </form>

          {/* =============================================================== */}
          {/* SEÇÃO 2: OFICINA (diagnóstico e conserto)                       */}
          {/* =============================================================== */}
          <form
            onSubmit={handleSalvarBancada}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-800">
                <Wrench size={18} className="text-blue-600" />
                <h2 className="text-base font-bold">Oficina</h2>
              </div>

              <div className="flex items-center gap-2">
                {sucessoBancada && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Check size={13} /> Salvo
                  </span>
                )}
                {!somenteLeitura && (
                  <button
                    type="submit"
                    disabled={salvandoBancada}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvandoBancada && <Loader2 size={14} className="animate-spin" />}
                    Salvar oficina
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="det-banc-tec" className="block text-xs font-medium text-slate-700">
                  Técnico da oficina
                </label>
                <select
                  id="det-banc-tec"
                  disabled={somenteLeitura}
                  value={formBancada.bench_employee_id}
                  onChange={(e) => setFormBancada({ ...formBancada, bench_employee_id: e.target.value })}
                  className={INPUT}
                >
                  <option value="">Não atribuído</option>
                  {tecnicosBancada.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="det-banc-sit-peca" className="block text-xs font-medium text-slate-700">
                  Situação das peças
                </label>
                <select
                  id="det-banc-sit-peca"
                  disabled={somenteLeitura}
                  value={formBancada.parts_status}
                  onChange={(e) =>
                    setFormBancada({ ...formBancada, parts_status: e.target.value as SituacaoPecas })
                  }
                  className={INPUT}
                >
                  {(Object.entries(ROTULO_PECAS) as [SituacaoPecas, string][]).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="det-banc-diag" className="block text-xs font-medium text-slate-700">
                Diagnóstico
              </label>
              <textarea
                id="det-banc-diag"
                rows={linhas(formBancada.diagnosis, 3)}
                readOnly={somenteLeitura}
                value={formBancada.diagnosis}
                onChange={(e) => setFormBancada({ ...formBancada, diagnosis: e.target.value })}
                placeholder="Causa encontrada e o que precisa ser feito..."
                className={TEXTO}
              />
            </div>

            <div>
              <label htmlFor="det-banc-pecas" className="block text-xs font-medium text-slate-700">
                Peças necessárias
              </label>
              <textarea
                id="det-banc-pecas"
                rows={linhas(formBancada.parts_needed)}
                readOnly={somenteLeitura}
                value={formBancada.parts_needed}
                onChange={(e) => setFormBancada({ ...formBancada, parts_needed: e.target.value })}
                placeholder="Ex.: Motor ventilador evaporadora 220V, sensor de degelo..."
                className={TEXTO}
              />
            </div>

            <div>
              <label htmlFor="det-banc-reparo" className="block text-xs font-medium text-slate-700">
                Serviço executado
              </label>
              <textarea
                id="det-banc-reparo"
                rows={linhas(formBancada.repair_notes, 3)}
                readOnly={somenteLeitura}
                value={formBancada.repair_notes}
                onChange={(e) => setFormBancada({ ...formBancada, repair_notes: e.target.value })}
                placeholder="Descrição do reparo e testes realizados na oficina..."
                className={TEXTO}
              />
            </div>

            {/* No celular o botão do topo fica longe depois de digitar: repete embaixo, largura toda */}
            {!somenteLeitura && (
              <button
                type="submit"
                disabled={salvandoBancada}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50 sm:hidden"
              >
                {salvandoBancada ? <Loader2 size={16} className="animate-spin" /> : sucessoBancada ? <Check size={16} /> : null}
                {sucessoBancada ? 'Salvo' : 'Salvar oficina'}
              </button>
            )}
          </form>

          {/* =============================================================== */}
          {/* SEÇÃO 3: ORÇAMENTO E CLIENTE (escritório edita; oficina vê)     */}
          {/* =============================================================== */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-800">
                <DollarSign size={18} className="text-blue-600" />
                <h2 className="text-base font-bold">Orçamento e cliente</h2>
              </div>
              {!ehEscritorio && (
                <span className="text-[11px] font-medium text-slate-400">Gerenciado pelo escritório</span>
              )}
            </div>

            {item.is_warranty && !item.quote_reference && !item.quote_amount && (
              <p className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-xs font-medium text-indigo-900">
                Item marcado como <strong>Garantia</strong>: não precisa passar por orçamento para seguir ao reparo.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-[11px] font-semibold text-slate-400">Orçamento no SicWeb</span>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {item.quote_reference ? `Nº ${item.quote_reference}` : 'Não registrado'}
                </p>
                {item.quote_sent_at && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Enviado em {formatarDataHora(item.quote_sent_at)}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-[11px] font-semibold text-slate-400">Valor</span>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {valorEmReais(item.quote_amount) || '—'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="text-[11px] font-semibold text-slate-400">Resposta do cliente</span>
                {item.decision ? (
                  <>
                    <p
                      className={`mt-0.5 text-sm font-bold ${
                        item.decision === 'aprovado' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {item.decision === 'aprovado' ? 'Aprovado' : 'Recusado'}
                      {item.decision_channel ? ` (${ROTULO_CANAL[item.decision_channel]})` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {item.decision_at ? formatarDataHora(item.decision_at) : ''}
                      {autorDecisao ? ` · por ${autorDecisao}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-slate-500">Aguardando</p>
                )}
              </div>
            </div>

            {item.decision_note && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                <strong>Observação da resposta:</strong> {item.decision_note}
              </p>
            )}

            {item.discard_authorized_at && item.status !== 'descarte' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs text-rose-900">
                <p className="font-bold">
                  Descarte autorizado em {formatarDataHora(item.discard_authorized_at)}
                  {autorDescarte ? ` por ${autorDescarte}` : ''}
                </p>
                {item.discard_note && <p className="mt-1">{item.discard_note}</p>}
              </div>
            )}

            {ehEscritorio && !somenteLeitura && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {acoes.registrarOrcamento && (
                  <button
                    type="button"
                    onClick={() => setModalAcao('orcamento')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700"
                  >
                    <DollarSign size={14} />
                    Registrar orçamento
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleAvisarWhatsApp()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <MessageCircle size={14} />
                  Avisar pelo WhatsApp
                </button>

                {acoes.registrarResposta && (
                  <button
                    type="button"
                    onClick={() => setModalAcao('resposta')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Registrar resposta do cliente
                  </button>
                )}

                {acoes.autorizarDescarte && (
                  <button
                    type="button"
                    onClick={() => setModalAcao('descarte')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
                  >
                    <AlertTriangle size={14} />
                    Cliente autorizou o descarte
                  </button>
                )}
              </div>
            )}
          </section>

          {/* =============================================================== */}
          {/* SEÇÃO 4: DEVOLUÇÃO                                              */}
          {/* =============================================================== */}
          {mostrarSecaoDevolucao && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
              <div className="flex items-center gap-2 text-slate-800">
                <Truck size={18} className="text-emerald-600" />
                <h2 className="text-base font-bold">Devolução</h2>
              </div>

              {item.return_service_order_id ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {ehEscritorio && item.return_service_order_id !== ordemPaiId ? (
                        <button
                          type="button"
                          onClick={() => setOrdemSobrepostaId(item.return_service_order_id)}
                          className="inline-flex items-center gap-1.5 text-sm font-extrabold text-blue-700 hover:underline"
                        >
                          OS de devolução {item.return_os_number ?? ''}
                          <ExternalLink size={14} />
                        </button>
                      ) : (
                        <span className="text-sm font-extrabold text-emerald-900">
                          OS de devolução {item.return_os_number ?? ''}
                        </span>
                      )}
                      <p className="mt-1 text-xs font-medium text-emerald-900">
                        Agende a visita pela Linha do Tempo.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  O equipamento está pronto. Gere uma OS de devolução para a equipe levar e instalar, ou registre
                  que o cliente buscou no balcão da loja.
                </p>
              )}

              {ehEscritorio && !somenteLeitura && (acoes.criarOsDevolucao || acoes.marcarEntregue) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {acoes.criarOsDevolucao && (
                    <button
                      type="button"
                      onClick={() => setModalAcao('devolucao')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
                    >
                      <Truck size={15} />
                      Criar OS de devolução
                    </button>
                  )}

                  {acoes.marcarEntregue && (
                    <button
                      type="button"
                      disabled={movendoEtapa}
                      onClick={() => void handleClienteBuscouNaLoja()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Store size={15} className="text-slate-600" />
                      Cliente buscou na loja
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* =============================================================== */}
          {/* SEÇÃO 5: FOTOS                                                  */}
          {/* =============================================================== */}
          <FotosItem
            itemId={item.id}
            etapaAtual={item.status}
            fotos={fotos}
            somenteLeitura={somenteLeitura}
            onAlterado={carregarFotos}
          />

          {/* =============================================================== */}
          {/* SEÇÃO 6: HISTÓRICO                                              */}
          {/* =============================================================== */}
          <HistoricoItem
            itemId={item.id}
            eventos={eventos}
            carregando={carregandoEventos}
            somenteLeitura={somenteLeitura}
            nomesFuncionarios={mapaNomesFuncionarios}
            onAnotado={carregarEventos}
          />

          {/* =============================================================== */}
          {/* RODAPÉ: CANCELAR ENTRADA / REABRIR                              */}
          {/* =============================================================== */}
          {((ehEscritorio && acoes.cancelar) || (ehAdmin && finalizado)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
              <span className="text-xs text-slate-500">
                {finalizado
                  ? 'Apenas administradores podem reabrir um item finalizado.'
                  : 'Se esta entrada foi criada por engano, você pode cancelá-la informando o motivo.'}
              </span>

              <div className="flex items-center gap-2">
                {ehEscritorio && acoes.cancelar && (
                  <button
                    type="button"
                    onClick={() => setModalAcao('cancelar')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <Ban size={14} />
                    Cancelar entrada
                  </button>
                )}

                {ehAdmin && finalizado && (
                  <button
                    type="button"
                    disabled={movendoEtapa}
                    onClick={() => void handleReabrir()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modais de ação */}
        {etiquetaAberta && (
          <EtiquetaModal
            item={item}
            totalNaOs={totalNaOs}
            onFechar={() => setEtiquetaAberta(false)}
          />
        )}

        {modalAcao === 'orcamento' && (
          <ModalRegistrarOrcamento
            item={item}
            onFechar={() => setModalAcao(null)}
            onSalvo={() => atualizarAposAcao(true)}
          />
        )}

        {modalAcao === 'resposta' && (
          <ModalRespostaCliente
            item={item}
            onFechar={() => setModalAcao(null)}
            onSalvo={() => atualizarAposAcao(true)}
          />
        )}

        {modalAcao === 'descarte' && (
          <ModalAutorizarDescarte
            item={item}
            onFechar={() => setModalAcao(null)}
            onSalvo={async () => {
              await carregarFotos();
              await atualizarAposAcao(true);
            }}
          />
        )}

        {modalAcao === 'devolucao' && (
          <ModalCriarOsDevolucao
            item={item}
            onFechar={() => setModalAcao(null)}
            onCriada={async (novaOsId) => {
              await atualizarAposAcao(true);
              setOrdemSobrepostaId(novaOsId);
            }}
          />
        )}

        {modalAcao === 'cancelar' && (
          <ModalCancelarItem
            item={item}
            onFechar={() => setModalAcao(null)}
            onSalvo={() => atualizarAposAcao(true)}
          />
        )}

        {/* OS aberta por cima do detalhe do item */}
        {ordemSobrepostaId && ehEscritorio && (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50 pb-10">
            <OrdemDetalhes
              ordemId={ordemSobrepostaId}
              onFechar={() => {
                setOrdemSobrepostaId(null);
                void atualizarAposAcao(false);
              }}
              onSalvo={() => {
                void atualizarAposAcao(false);
              }}
            />
          </div>
        )}
      </>
    );
  })();

  return createPortal(
    <div className={`fixed inset-0 ${camadaZ} overflow-y-auto bg-slate-50 pb-16`}>
      {conteudo}
    </div>,
    document.body,
  );
}
