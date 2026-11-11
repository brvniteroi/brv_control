import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  PlusCircle,
  Search,
  Store,
  User,
  X,
} from 'lucide-react';
import {
  buscarOsPorNumero,
  criarItemNaOS,
  entradaBalcao,
  listarTecnicosOficina,
} from '../../services/oficina';
import { buscarClientePorId } from '../../services/clientes';
import { listarEnderecosDoCliente } from '../../services/ordens';
import type { Customer, CustomerAddress } from '../../types/fsm';
import type { NovoItemOficina, OsParaOficina, UnidadeRecolhida } from '../../types/oficina';
import { ROTULO_UNIDADE, TENSOES, TIPOS_EQUIPAMENTO } from '../../utils/oficina';
import ClienteDetalhes from '../clientes/ClienteDetalhes';
import SeletorCliente from '../ordens/SeletorCliente';

type CaminhoEntrada = 'os' | 'balcao';

// 16 px no celular (o navegador não dá zoom ao tocar), 14 px no computador
const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm';
/** Texto longo que cresce com o conteúdo. */
const TEXTO = `${INPUT} resize-none [field-sizing:content] min-h-[4.5rem]`;

function rotuloEndereco(e: CustomerAddress): string {
  const rua = [e.street, e.number].filter(Boolean).join(', ');
  const complemento = [e.complement, e.district, `${e.city}/${e.state}`].filter(Boolean).join(' · ');
  const prefixo = e.label ? `${e.label}: ` : '';
  return `${prefixo}${[rua, complemento].filter(Boolean).join(' — ')}`;
}

interface NovaEntradaModalProps {
  ehEscritorio: boolean;
  onFechar: () => void;
  /** Chamado com o ID do item criado e se deve oferecer a etiqueta imediatamente. */
  onCriado: (itemId: string, oferecerEtiqueta: boolean) => void;
}

export default function NovaEntradaModal({
  ehEscritorio,
  onFechar,
  onCriado,
}: NovaEntradaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [caminho, setCaminho] = useState<CaminhoEntrada>('os');

  // Caminho 1: Da OS
  const [numeroOsTexto, setNumeroOsTexto] = useState('');
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [erroBuscaOs, setErroBuscaOs] = useState<string | null>(null);
  const [osEncontrada, setOsEncontrada] = useState<OsParaOficina | null>(null);
  const [jaChegou, setJaChegou] = useState(true);
  const [tecnicoRetiradaId, setTecnicoRetiradaId] = useState('');
  const [funcionarios, setFuncionarios] = useState<{ id: string; name: string; role: string }[]>([]);

  // Caminho 2: Balcão
  const [cliente, setCliente] = useState<{ id: string; name: string } | null>(null);
  const [enderecos, setEnderecos] = useState<CustomerAddress[]>([]);
  const [enderecoId, setEnderecoId] = useState('');
  const [nomeNovoCliente, setNomeNovoCliente] = useState<string | null>(null); // cadastro completo aberto por cima
  const [clienteCriadoId, setClienteCriadoId] = useState<string | null>(null);

  // Equipamento
  const [tipoEquipamento, setTipoEquipamento] = useState('');
  const [unidade, setUnidade] = useState<UnidadeRecolhida>('evaporadora');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [btus, setBtus] = useState('');
  const [tensao, setTensao] = useState('220V');
  const [acessorios, setAcessorios] = useState('');
  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [relatoCampo, setRelatoCampo] = useState('');
  const [conferenciaChegada, setConferenciaChegada] = useState('');
  const [garantia, setGarantia] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  useEffect(() => {
    let ativo = true;
    listarTecnicosOficina()
      .then((lista) => {
        if (ativo) setFuncionarios(lista);
      })
      .catch(() => {
        // Opcional para escolha manual do técnico de retirada
      });
    return () => {
      ativo = false;
    };
  }, []);

  const clienteId = cliente?.id ?? null;
  useEffect(() => {
    if (!clienteId || !ehEscritorio) return;
    let ativo = true;
    listarEnderecosDoCliente(clienteId)
      .then((lista) => {
        if (!ativo) return;
        const ativos = lista.filter((e) => e.active);
        setEnderecos(ativos);
        setEnderecoId(ativos.find((e) => e.is_primary)?.id ?? ativos[0]?.id ?? '');
      })
      .catch(() => {
        if (ativo) setEnderecos([]);
      });
    return () => {
      ativo = false;
    };
  }, [clienteId, ehEscritorio]);

  const consultarOs = async () => {
    const limpo = numeroOsTexto.trim().replace(/\D/g, '');
    if (!limpo) {
      setErroBuscaOs('Digite o número da OS.');
      setOsEncontrada(null);
      return;
    }
    setBuscandoOs(true);
    setErroBuscaOs(null);
    try {
      const os = await buscarOsPorNumero(Number(limpo));
      if (!os) {
        setOsEncontrada(null);
        setErroBuscaOs(`OS ${limpo} não encontrada.`);
        return;
      }
      setOsEncontrada(os);
      setRelatoCampo(os.technician_notes ?? '');
      setTecnicoRetiradaId(os.technician_id ?? '');
    } catch (e) {
      setOsEncontrada(null);
      setErroBuscaOs(e instanceof Error ? e.message : 'Não foi possível buscar a OS.');
    } finally {
      setBuscandoOs(false);
    }
  };

  const escolherClienteBalcao = (c: Customer | null) => {
    setCliente(c ? { id: c.id, name: c.name } : null);
    setEnderecos([]);
    setEnderecoId('');
  };

  const fecharCadastroCliente = async () => {
    setNomeNovoCliente(null);
    if (!clienteCriadoId) return;
    const c = await buscarClientePorId(clienteCriadoId);
    if (c) {
      setCliente({ id: c.id, name: c.name });
      setEnderecos([]);
      setEnderecoId('');
    }
    setClienteCriadoId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErroSalvar(null);

    if (caminho === 'os' && !osEncontrada) {
      setErroSalvar('Busque e confirme a OS antes de salvar a entrada.');
      return;
    }
    if (caminho === 'balcao' && !cliente) {
      setErroSalvar('Escolha o cliente para registrar a entrada de balcão.');
      return;
    }
    if (!tipoEquipamento.trim()) {
      setErroSalvar('Informe o tipo do equipamento (ex.: Split Hi-Wall, Janela).');
      return;
    }

    let capacidadeBtu: number | null = null;
    if (btus.trim()) {
      const n = Number(btus.trim().replace(/\./g, ''));
      if (!Number.isInteger(n) || n <= 0) {
        setErroSalvar('Informe os BTUs apenas com números inteiros positivos (ex.: 12000).');
        return;
      }
      capacidadeBtu = n;
    }

    const dadosBase: NovoItemOficina = {
      equipment_type: tipoEquipamento.trim(),
      units_collected: unidade,
      brand: marca.trim() || null,
      model: modelo.trim() || null,
      serial_number: numeroSerie.trim() || null,
      capacity_btu: capacidadeBtu,
      voltage: tensao.trim() || null,
      accessories: acessorios.trim() || null,
      reported_defect: defeitoRelatado.trim() || null,
      field_report: caminho === 'os' ? relatoCampo.trim() || null : null,
      intake_notes: conferenciaChegada.trim() || null,
      is_warranty: garantia,
    };

    setSalvando(true);
    try {
      if (caminho === 'os' && osEncontrada) {
        const criado = await criarItemNaOS(
          osEncontrada.service_order_id,
          {
            ...dadosBase,
            pickup_employee_id: tecnicoRetiradaId || null,
            task_id: osEncontrada.task_id,
          },
          jaChegou,
        );
        onCriado(criado.id, jaChegou);
      } else if (caminho === 'balcao' && cliente) {
        const criadoId = await entradaBalcao(cliente.id, enderecoId || null, dadosBase);
        onCriado(criadoId, true);
      }
    } catch (err) {
      setErroSalvar(err instanceof Error ? err.message : 'Não foi possível registrar a entrada.');
    } finally {
      setSalvando(false);
    }
  };

  const tecnicosCampo = funcionarios.filter(
    (f) => f.role === 'tecnico' || f.role === 'supervisor' || f.id === tecnicoRetiradaId,
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando && nomeNovoCliente === null) onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onFechar();
      }}
      aria-labelledby="titulo-nova-entrada"
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-xs"
    >
      {nomeNovoCliente !== null && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50 text-left">
          <ClienteDetalhes clienteId="novo" nomeInicial={nomeNovoCliente} onFechar={fecharCadastroCliente} onSalvo={setClienteCriadoId} />
        </div>
      )}
      {/* Cabeçalho */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <PlusCircle size={18} />
          </div>
          <div>
            <h2 id="titulo-nova-entrada" className="text-base font-bold text-slate-900">
              Nova entrada na oficina
            </h2>
            <p className="text-xs text-slate-500">
              Registre um equipamento recolhido em atendimento ou entregue no balcão
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        {/* Seletor de caminho (Balcão só aparece para admin/escritório) */}
        {ehEscritorio && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Origem da entrada">
            <button
              type="button"
              role="tab"
              aria-selected={caminho === 'os'}
              onClick={() => {
                setCaminho('os');
                setErroSalvar(null);
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                caminho === 'os'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList size={15} />
              Da OS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={caminho === 'balcao'}
              onClick={() => {
                setCaminho('balcao');
                setErroSalvar(null);
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                caminho === 'balcao'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store size={15} />
              Balcão (sem visita)
            </button>
          </div>
        )}

        {/* ======================================================= */}
        {/* CAMINHO 1: DA OS                                        */}
        {/* ======================================================= */}
        {caminho === 'os' ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <label htmlFor="entrada-num-os" className="block text-xs font-semibold text-slate-700">
                Número da OS *
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="entrada-num-os"
                  type="text"
                  inputMode="numeric"
                  value={numeroOsTexto}
                  onChange={(e) => setNumeroOsTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void consultarOs();
                    }
                  }}
                  placeholder="Ex.: 17300"
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void consultarOs()}
                  disabled={buscandoOs}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brv-navy px-4 py-2 text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                >
                  {buscandoOs ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  Buscar OS
                </button>
              </div>
            </div>

            {erroBuscaOs && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {erroBuscaOs}
              </p>
            )}

            {osEncontrada && (
              <div className="space-y-2.5 rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>OS {osEncontrada.os_number}</span>
                      <span className="text-slate-400">·</span>
                      <span>{osEncontrada.customer_name}</span>
                    </div>
                    {(osEncontrada.bairro || osEncontrada.cidade) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} />
                        {[osEncontrada.bairro, osEncontrada.cidade].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {osEncontrada.technician_name && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-600">
                    <User size={13} className="text-slate-400" />
                    <span>
                      Técnico da atividade: <strong>{osEncontrada.technician_name}</strong>
                    </span>
                  </p>
                )}

                {osEncontrada.technician_notes && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-600">Relato da atividade: </span>
                    {osEncontrada.technician_notes}
                  </div>
                )}

                {osEncontrada.itens_na_oficina > 0 && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
                  >
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      Esta OS já tem{' '}
                      <strong>
                        {osEncontrada.itens_na_oficina}{' '}
                        {osEncontrada.itens_na_oficina === 1 ? 'item registrado' : 'itens registrados'}
                      </strong>{' '}
                      na oficina. Esta entrada será registrada como{' '}
                      <strong>item {osEncontrada.itens_na_oficina + 1}</strong>.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label htmlFor="entrada-tec-retirada" className="block text-xs font-medium text-slate-700">
                      Técnico que recolheu
                    </label>
                    <select
                      id="entrada-tec-retirada"
                      value={tecnicoRetiradaId}
                      onChange={(e) => setTecnicoRetiradaId(e.target.value)}
                      className={INPUT}
                    >
                      <option value="">Não informado</option>
                      {tecnicosCampo.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={jaChegou}
                        onChange={(e) => setJaChegou(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Já chegou na loja
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ======================================================= */
          /* CAMINHO 2: BALCÃO                                       */
          /* ======================================================= */
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs text-slate-600">
              O cliente trouxe o equipamento direto ao balcão. O sistema criará a OS automaticamente junto com o item.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-semibold text-slate-700">Cliente *</span>
                <SeletorCliente valor={cliente} onChange={escolherClienteBalcao} onCadastrarNovo={setNomeNovoCliente} />
              </div>
              <div>
                <label htmlFor="entrada-balcao-end" className="block text-xs font-semibold text-slate-700">
                  Endereço do cliente
                </label>
                <select
                  id="entrada-balcao-end"
                  value={enderecoId}
                  onChange={(e) => setEnderecoId(e.target.value)}
                  disabled={!cliente}
                  className={INPUT}
                >
                  <option value="">
                    {cliente ? 'Sem endereço selecionado' : 'Escolha o cliente primeiro'}
                  </option>
                  {enderecos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {rotuloEndereco(e)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* DADOS DO EQUIPAMENTO                                    */}
        {/* ======================================================= */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Dados do equipamento</h3>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-800">
              <input
                type="checkbox"
                checked={garantia}
                onChange={(e) => setGarantia(e.target.checked)}
                className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              Retorno em garantia
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="entrada-tipo-eq" className="block text-xs font-medium text-slate-700">
                Tipo de equipamento *
              </label>
              <input
                id="entrada-tipo-eq"
                type="text"
                list="sugestoes-tipos-oficina"
                required
                value={tipoEquipamento}
                onChange={(e) => setTipoEquipamento(e.target.value)}
                placeholder="Ex.: Split Hi-Wall, Janela (ACJ)..."
                className={INPUT}
              />
              <datalist id="sugestoes-tipos-oficina">
                {TIPOS_EQUIPAMENTO.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="entrada-unidade" className="block text-xs font-medium text-slate-700">
                O que veio *
              </label>
              <select
                id="entrada-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as UnidadeRecolhida)}
                className={INPUT}
              >
                {(Object.entries(ROTULO_UNIDADE) as [UnidadeRecolhida, string][]).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label htmlFor="entrada-marca" className="block text-xs font-medium text-slate-700">
                Marca
              </label>
              <input
                id="entrada-marca"
                type="text"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex.: Midea, LG, Daikin"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="entrada-modelo" className="block text-xs font-medium text-slate-700">
                Modelo
              </label>
              <input
                id="entrada-modelo"
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Modelo"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="entrada-serie" className="block text-xs font-medium text-slate-700">
                Nº de série
              </label>
              <input
                id="entrada-serie"
                type="text"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                placeholder="Opcional"
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label htmlFor="entrada-btus" className="block text-xs font-medium text-slate-700">
                BTUs
              </label>
              <input
                id="entrada-btus"
                type="text"
                inputMode="numeric"
                value={btus}
                onChange={(e) => setBtus(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ex.: 12000"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="entrada-tensao" className="block text-xs font-medium text-slate-700">
                Tensão
              </label>
              <select
                id="entrada-tensao"
                value={tensao}
                onChange={(e) => setTensao(e.target.value)}
                className={INPUT}
              >
                <option value="">Não informada</option>
                {TENSOES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="entrada-acessorios" className="block text-xs font-medium text-slate-700">
                Acessórios
              </label>
              <input
                id="entrada-acessorios"
                type="text"
                value={acessorios}
                onChange={(e) => setAcessorios(e.target.value)}
                placeholder="Ex.: Controle, suporte, cabo"
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="entrada-defeito" className="block text-xs font-medium text-slate-700">
              Defeito relatado
            </label>
            <textarea
              id="entrada-defeito"
              rows={2}
              value={defeitoRelatado}
              onChange={(e) => setDefeitoRelatado(e.target.value)}
              placeholder="Ex.: Não gela, erro E1, barulho na turbina..."
              className={TEXTO}
            />
          </div>

          {caminho === 'os' && (
            <div>
              <label htmlFor="entrada-relato-campo" className="block text-xs font-medium text-slate-700">
                Relato do técnico de campo
              </label>
              <textarea
                id="entrada-relato-campo"
                rows={2}
                value={relatoCampo}
                onChange={(e) => setRelatoCampo(e.target.value)}
                placeholder="Observações deixadas pelo técnico na visita"
                className={TEXTO}
              />
            </div>
          )}

          <div>
            <label htmlFor="entrada-conferencia" className="block text-xs font-medium text-slate-700">
              Conferência na chegada
            </label>
            <textarea
              id="entrada-conferencia"
              rows={2}
              value={conferenciaChegada}
              onChange={(e) => setConferenciaChegada(e.target.value)}
              placeholder="Estado físico do gabinete, aletas, tampa, carenagem..."
              className={TEXTO}
            />
          </div>
        </div>

        {erroSalvar && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {erroSalvar}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={salvando}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={15} className="animate-spin" />}
            {salvando ? 'Salvando...' : 'Salvar entrada'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

