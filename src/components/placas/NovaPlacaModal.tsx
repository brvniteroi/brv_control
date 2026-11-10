import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  BoardClient,
  BoardControlOsLookup,
  BoardCustomerKind,
  BoardOrder,
  BoardTechnicianOption,
} from '../../types/placas';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { CORES_TIPO_CLIENTE_PLACA } from './cores';
import {
  buscarOsControl,
  criarPlaca,
  listarClientesPlacas,
  listarTecnicos,
  placasDoCliente,
  salvarClientePlaca,
} from './fonteDeDados';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import {
  SUGESTOES_TIPO_EQUIPAMENTO_PLACA,
  calcularValidadeGarantia,
  garantiaVigente,
  semAcento,
  ehTecnicoBancadaPlacas,
} from './regrasPlacas';

interface NovaPlacaModalProps {
  aberto: boolean;
  atorNome: string;
  onFechar: () => void;
  onCriada: (nova: BoardOrder) => void;
}

interface PreviaFotoEntrada {
  idLocal: string;
  file: File;
  previewUrl: string;
}

export default function NovaPlacaModal({
  aberto,
  atorNome,
  onFechar,
  onCriada,
}: NovaPlacaModalProps) {
  const idBase = useId();

  // Modo de entrada
  const [origem, setOrigem] = useState<'balcao' | 'campo'>('balcao');

  // Clientes de placas (balcão) e técnicos
  const [clientes, setClientes] = useState<BoardClient[]>([]);
  const [tecnicos, setTecnicos] = useState<BoardTechnicianOption[]>([]);
  const [carregandoBase, setCarregandoBase] = useState(false);

  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');

  // Subformulário rápido "Novo cliente"
  const [criandoClienteRapido, setCriandoClienteRapido] = useState(false);
  const [novoCliNome, setNovoCliNome] = useState('');
  const [novoCliTelefone, setNovoCliTelefone] = useState('');
  const [novoCliTipo, setNovoCliTipo] = useState<BoardCustomerKind>('instalador');
  const [novoCliCidade, setNovoCliCidade] = useState('Niterói');
  const [salvandoNovoCli, setSalvandoNovoCli] = useState(false);
  const [erroNovoCli, setErroNovoCli] = useState<string | null>(null);

  // Busca de OS do BRV Control (retirada de campo)
  const [numeroOsTexto, setNumeroOsTexto] = useState('');
  const [buscandoOs, setBuscandoOs] = useState(false);
  const [osEncontrada, setOsEncontrada] = useState<BoardControlOsLookup | null>(null);
  const [erroBuscaOs, setErroBuscaOs] = useState<string | null>(null);

  // Campos comuns da placa
  const [tipoCliente, setTipoCliente] = useState<BoardCustomerKind>('instalador');
  const [cidadeCliente, setCidadeCliente] = useState('');
  const [tecnicoRetiradaId, setTecnicoRetiradaId] = useState('');
  const [tecnicoBancadaId, setTecnicoBancadaId] = useState('');
  const [tipoEquipamento, setTipoEquipamento] = useState('Split Inverter');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [codigoPlaca, setCodigoPlaca] = useState('');
  const [perifericos, setPerifericos] = useState('');
  const [defeitoReclamado, setDefeitoReclamado] = useState('');
  const [codigoErro, setCodigoErro] = useState('');
  const [semDefeitoAparente, setSemDefeitoAparente] = useState(false);

  // Garantia
  const [ehGarantia, setEhGarantia] = useState(false);
  const [placasEntreguesCliente, setPlacasEntreguesCliente] = useState<BoardOrder[]>([]);
  const [carregandoGarantias, setCarregandoGarantias] = useState(false);
  const [origemGarantiaId, setOrigemGarantiaId] = useState('');

  // Fotos de entrada
  const [fotosEntrada, setFotosEntrada] = useState<PreviaFotoEntrada[]>([]);

  // Envio final
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);

  // Carrega clientes de placas e técnicos ao abrir o modal
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (!cancelado) setCarregandoBase(true);
        return Promise.all([listarClientesPlacas(), listarTecnicos()]);
      })
      .then(([listaCli, listaTec]) => {
        if (cancelado) return;
        setClientes(listaCli);
        setTecnicos(listaTec);
        const bancadaPadrao = listaTec.find(ehTecnicoBancadaPlacas);
        if (bancadaPadrao) {
          setTecnicoBancadaId((atual) => atual || bancadaPadrao.id);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setErroFormulario('Não foi possível carregar clientes e técnicos.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoBase(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aberto]);

  // Carrega placas entregues do cliente selecionado quando "Retorno em garantia" está marcado
  useEffect(() => {
    if (!aberto || !ehGarantia || origem !== 'balcao' || !clienteSelecionadoId) return;
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (!cancelado) setCarregandoGarantias(true);
        return placasDoCliente(clienteSelecionadoId);
      })
      .then((lista) => {
        if (cancelado) return;
        const entregues = lista.filter((p) => p.status === 'entregue');
        setPlacasEntreguesCliente(entregues);
      })
      .catch(() => {
        if (!cancelado) setPlacasEntreguesCliente([]);
      })
      .finally(() => {
        if (!cancelado) setCarregandoGarantias(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aberto, ehGarantia, origem, clienteSelecionadoId]);

  // Libera URLs temporárias de miniatura ao desmontar
  useEffect(() => {
    return () => {
      for (const f of fotosEntrada) {
        URL.revokeObjectURL(f.previewUrl);
      }
    };
  }, [fotosEntrada]);

  const clientesFiltrados = useMemo(() => {
    const termo = semAcento(buscaCliente.trim());
    const digitos = buscaCliente.replace(/\D/g, '');
    if (!termo) return clientes;
    return clientes.filter((c) => {
      const alvo = semAcento(`${c.name} ${c.city ?? ''} ${c.phone}`);
      const telDig = c.phone.replace(/\D/g, '');
      return alvo.includes(termo) || (digitos.length >= 3 && telDig.includes(digitos));
    });
  }, [clientes, buscaCliente]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.id === clienteSelecionadoId) ?? null,
    [clientes, clienteSelecionadoId],
  );

  const selecionarClienteBalcao = (cli: BoardClient) => {
    setClienteSelecionadoId(cli.id);
    setTipoCliente(cli.kind);
    setCidadeCliente(cli.city ?? '');
    setOrigemGarantiaId('');
    setPlacasEntreguesCliente([]);
    setErroFormulario(null);
  };

  const handleSalvarClienteRapido = async () => {
    setErroNovoCli(null);
    if (!novoCliNome.trim()) {
      setErroNovoCli('Informe o nome do cliente ou parceiro.');
      return;
    }
    if (novoCliTelefone.replace(/\D/g, '').length < 10) {
      setErroNovoCli('Informe um telefone válido com DDD.');
      return;
    }

    setSalvandoNovoCli(true);
    try {
      const criado = await salvarClientePlaca({
        name: novoCliNome.trim(),
        phone: novoCliTelefone,
        kind: novoCliTipo,
        city: novoCliCidade.trim() || null,
      });
      setClientes((prev) => [criado, ...prev]);
      selecionarClienteBalcao(criado);
      setCriandoClienteRapido(false);
      setNovoCliNome('');
      setNovoCliTelefone('');
    } catch (err) {
      setErroNovoCli(err instanceof Error ? err.message : 'Erro ao salvar novo cliente.');
    } finally {
      setSalvandoNovoCli(false);
    }
  };

  const handleBuscarOsControl = async () => {
    setErroBuscaOs(null);
    setOsEncontrada(null);
    const limpo = numeroOsTexto.replace(/\D/g, '');
    if (!limpo) {
      setErroBuscaOs('Digite o número da OS do BRV Control (ex.: 17340 ou 17352).');
      return;
    }

    setBuscandoOs(true);
    try {
      const achada = await buscarOsControl(limpo);
      if (!achada) {
        setErroBuscaOs(
          `Nenhuma OS de número ${limpo} encontrada na demonstração (experimente 17340 ou 17352).`,
        );
        return;
      }
      setOsEncontrada(achada);
      setTipoCliente('final');
      setCidadeCliente(achada.city ?? '');
      if (achada.technician_id) {
        setTecnicoRetiradaId(achada.technician_id);
      }
      if (!defeitoReclamado.trim() && achada.field_report) {
        setDefeitoReclamado(achada.field_report);
      }
    } catch (err) {
      setErroBuscaOs(err instanceof Error ? err.message : 'Erro ao consultar OS do Control.');
    } finally {
      setBuscandoOs(false);
    }
  };

  const handleSelecionarFotos = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;

    const novas: PreviaFotoEntrada[] = [];
    for (const arq of arquivos) {
      if (!arq.type.startsWith('image/')) continue;
      novas.push({
        idLocal: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: arq,
        previewUrl: URL.createObjectURL(arq),
      });
    }
    setFotosEntrada((prev) => [...prev, ...novas]);
    e.target.value = '';
  };

  const handleRemoverFoto = (idLocal: string) => {
    setFotosEntrada((prev) => {
      const alvo = prev.find((f) => f.idLocal === idLocal);
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((f) => f.idLocal !== idLocal);
    });
  };

  const resetarCampos = () => {
    setOrigem('balcao');
    setBuscaCliente('');
    setClienteSelecionadoId('');
    setCriandoClienteRapido(false);
    setNumeroOsTexto('');
    setOsEncontrada(null);
    setErroBuscaOs(null);
    setTipoCliente('instalador');
    setCidadeCliente('');
    setTecnicoRetiradaId('');
    setTipoEquipamento('Split Inverter');
    setMarcaModelo('');
    setCodigoPlaca('');
    setPerifericos('');
    setDefeitoReclamado('');
    setCodigoErro('');
    setSemDefeitoAparente(false);
    setEhGarantia(false);
    setPlacasEntreguesCliente([]);
    setOrigemGarantiaId('');
    for (const f of fotosEntrada) URL.revokeObjectURL(f.previewUrl);
    setFotosEntrada([]);
    setErroFormulario(null);
  };

  const handleFechar = () => {
    if (salvando) return;
    resetarCampos();
    onFechar();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErroFormulario(null);

    if (origem === 'balcao' && !clienteSelecionadoId) {
      setErroFormulario('Selecione o cliente de placas na lista ou cadastre um novo cliente.');
      return;
    }
    if (origem === 'campo' && !osEncontrada) {
      setErroFormulario('Consulte o número da OS do BRV Control antes de registrar a placa.');
      return;
    }
    if (!marcaModelo.trim()) {
      setErroFormulario('Informe a marca e o modelo do equipamento.');
      return;
    }
    if (!codigoPlaca.trim()) {
      setErroFormulario('Informe o código (part number) gravado na placa eletrônica.');
      return;
    }
    if (!defeitoReclamado.trim() && !semDefeitoAparente) {
      setErroFormulario('Descreva o defeito reclamado ou marque "Sem defeito aparente".');
      return;
    }

    setSalvando(true);
    try {
      const criada = await criarPlaca(
        {
          origem,
          board_client_id: origem === 'balcao' ? clienteSelecionadoId : null,
          service_order_id: origem === 'campo' ? osEncontrada?.service_order_id : null,
          customer_kind: origem === 'campo' ? 'final' : tipoCliente,
          customer_city: cidadeCliente.trim() || null,
          pickup_technician_id: tecnicoRetiradaId || null,
          bench_technician_id: tecnicoBancadaId || null,
          equipment_type: tipoEquipamento.trim() || 'Split Inverter',
          brand_model: marcaModelo.trim(),
          board_code: codigoPlaca.trim(),
          peripherals: perifericos.trim() || null,
          reported_defect: defeitoReclamado.trim(),
          error_code: codigoErro.trim() || null,
          no_apparent_defect: semDefeitoAparente,
          is_warranty: ehGarantia,
          warranty_origin_id: ehGarantia && origemGarantiaId ? origemGarantiaId : null,
          entry_photos: fotosEntrada.map((f) => ({ file: f.file })),
        },
        atorNome,
      );
      resetarCampos();
      onCriada(criada);
    } catch (err) {
      setErroFormulario(
        err instanceof Error ? err.message : 'Não foi possível registrar a entrada da placa.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalDialogoPlacas
      aberto={aberto}
      onFechar={handleFechar}
      titulo="Nova entrada de placa"
      subtitulo="Gera número próprio OS-DDMMAA-NNN e comprovante com link de acompanhamento."
      larguraMax="max-w-3xl"
      fecharAoClicarFora={false}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* 1. Escolha do modo de entrada */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Origem da entrada
          </legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                origem === 'balcao'
                  ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`${idBase}-origem`}
                checked={origem === 'balcao'}
                onChange={() => {
                  setOrigem('balcao');
                  setErroFormulario(null);
                }}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900">
                  Balcão / portador
                </span>
                <span className="block text-xs text-slate-500">
                  Parceiro instalador ou cliente final no cadastro próprio de placas.
                </span>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                origem === 'campo'
                  ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`${idBase}-origem`}
                checked={origem === 'campo'}
                onChange={() => {
                  setOrigem('campo');
                  setEhGarantia(false);
                  setOrigemGarantiaId('');
                  setErroFormulario(null);
                }}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-900">
                  Retirada pela equipe de campo
                </span>
                <span className="block text-xs text-slate-500">
                  Vincula à OS já aberta no BRV Control sem duplicar cadastro.
                </span>
              </div>
            </label>
          </div>
        </fieldset>

        {/* 2A. Modo Balcão / Portador */}
        {origem === 'balcao' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={`${idBase}-busca-cli`}
                className="text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Cliente de placas *
              </label>
              <button
                type="button"
                onClick={() => {
                  setCriandoClienteRapido((v) => !v);
                  setErroNovoCli(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                <UserPlus size={14} aria-hidden="true" />
                <span>{criandoClienteRapido ? 'Cancelar novo cliente' : 'Novo cliente'}</span>
              </button>
            </div>

            {criandoClienteRapido && (
              <div className="rounded-xl border border-blue-200 bg-white p-3.5 space-y-3">
                <p className="text-xs font-semibold text-blue-900">
                  Cadastro rápido no banco de clientes de placas
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`${idBase}-ncli-nome`}
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      Nome / apelido comercial *
                    </label>
                    <input
                      id={`${idBase}-ncli-nome`}
                      type="text"
                      value={novoCliNome}
                      onChange={(e) => setNovoCliNome(e.target.value)}
                      placeholder="Ex.: ClimaFrio Instalações — Renato"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${idBase}-ncli-tel`}
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      Telefone / WhatsApp *
                    </label>
                    <input
                      id={`${idBase}-ncli-tel`}
                      type="tel"
                      value={novoCliTelefone}
                      onChange={(e) => setNovoCliTelefone(formatarTelefone(e.target.value))}
                      placeholder="(21) 99999-9999"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${idBase}-ncli-tipo`}
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      Perfil do cliente
                    </label>
                    <select
                      id={`${idBase}-ncli-tipo`}
                      value={novoCliTipo}
                      onChange={(e) => setNovoCliTipo(e.target.value as BoardCustomerKind)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    >
                      <option value="instalador">Parceiro instalador</option>
                      <option value="final">Cliente final</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`${idBase}-ncli-cidade`}
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      Cidade
                    </label>
                    <input
                      id={`${idBase}-ncli-cidade`}
                      type="text"
                      value={novoCliCidade}
                      onChange={(e) => setNovoCliCidade(e.target.value)}
                      placeholder="Ex.: Niterói"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                {erroNovoCli && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {erroNovoCli}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={salvandoNovoCli}
                    onClick={() => void handleSalvarClienteRapido()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {salvandoNovoCli ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus size={14} aria-hidden="true" />
                    )}
                    <span>Salvar e selecionar cliente</span>
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={`${idBase}-busca-cli`}
                type="search"
                autoCorrect="off"
                spellCheck={false}
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar parceiro ou cliente por nome, telefone ou cidade..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            {carregandoBase ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>Carregando clientes de placas...</span>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {clientesFiltrados.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">
                    Nenhum cliente encontrado. Clique em &ldquo;Novo cliente&rdquo; acima para cadastrar.
                  </p>
                ) : (
                  clientesFiltrados.map((cli) => {
                    const ativo = cli.id === clienteSelecionadoId;
                    const estiloTipo = CORES_TIPO_CLIENTE_PLACA[cli.kind];
                    return (
                      <button
                        key={cli.id}
                        type="button"
                        onClick={() => selecionarClienteBalcao(cli)}
                        className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs transition ${
                          ativo ? 'bg-blue-50 font-semibold text-blue-950' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-slate-900">
                              {cli.name}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estiloTipo.selo}`}
                            >
                              {estiloTipo.rotuloCurto}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            {formatarTelefone(cli.phone)}
                            {cli.city ? ` · ${cli.city}` : ''}
                          </p>
                        </div>
                        {ativo && (
                          <CheckCircle2
                            size={16}
                            className="shrink-0 text-blue-600"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {clienteSelecionado && (
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${idBase}-tipo-cli`}
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Tipo nesta entrada
                  </label>
                  <select
                    id={`${idBase}-tipo-cli`}
                    value={tipoCliente}
                    onChange={(e) => setTipoCliente(e.target.value as BoardCustomerKind)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="instalador">Parceiro instalador</option>
                    <option value="final">Cliente final</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${idBase}-cidade-cli`}
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Cidade
                  </label>
                  <input
                    id={`${idBase}-cidade-cli`}
                    type="text"
                    value={cidadeCliente}
                    onChange={(e) => setCidadeCliente(e.target.value)}
                    placeholder="Ex.: Niterói"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2B. Modo Retirada pela Equipe de Campo */}
        {origem === 'campo' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div>
              <label
                htmlFor={`${idBase}-num-os`}
                className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Número da OS no BRV Control *
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={`${idBase}-num-os`}
                  type="text"
                  inputMode="numeric"
                  autoCorrect="off"
                  spellCheck={false}
                  value={numeroOsTexto}
                  onChange={(e) => setNumeroOsTexto(e.target.value)}
                  placeholder="Ex.: 17340 (com placa) ou 17352 (nova)"
                  className="min-w-[200px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={buscandoOs}
                  onClick={() => void handleBuscarOsControl()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {buscandoOs ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Search size={14} aria-hidden="true" />
                  )}
                  <span>Buscar OS</span>
                </button>
              </div>
            </div>

            {erroBuscaOs && (
              <p role="alert" className="text-xs font-medium text-rose-700">
                {erroBuscaOs}
              </p>
            )}

            {osEncontrada && (
              <div className="space-y-3">
                {osEncontrada.existing_board_numbers.length > 0 && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
                  >
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-bold">
                        Atenção: já existe placa cadastrada para a OS {osEncontrada.os_number}
                      </p>
                      <p className="mt-0.5 text-amber-900">
                        Placa(s) existente(s):{' '}
                        <strong className="font-mono">
                          {osEncontrada.existing_board_numbers.join(', ')}
                        </strong>
                        . Prossiga apenas se esta OS tiver uma segunda placa diferente (ex.: evaporadora + condensadora).
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-200 bg-white p-3.5 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      OS {osEncontrada.os_number} · {osEncontrada.customer_name}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800">
                      Vinculada ao BRV Control
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <strong>Endereço:</strong> {osEncontrada.address_summary}
                  </p>
                  {osEncontrada.technician_name && (
                    <p className="text-slate-600">
                      <strong>Técnico em campo:</strong> {osEncontrada.technician_name}
                    </p>
                  )}
                  {osEncontrada.field_report && (
                    <p className="rounded-lg bg-slate-50 p-2 text-slate-700">
                      <strong>Relato da visita:</strong> {osEncontrada.field_report}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Dados do equipamento e da placa */}
        <datalist id={`${idBase}-tipos-equip`}>
          {SUGESTOES_TIPO_EQUIPAMENTO_PLACA.map((tipo) => (
            <option key={tipo} value={tipo} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idBase}-equip`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Tipo de equipamento
            </label>
            <input
              id={`${idBase}-equip`}
              type="text"
              list={`${idBase}-tipos-equip`}
              value={tipoEquipamento}
              onChange={(e) => setTipoEquipamento(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-marca-modelo`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Marca / modelo *
            </label>
            <input
              id={`${idBase}-marca-modelo`}
              type="text"
              value={marcaModelo}
              onChange={(e) => setMarcaModelo(e.target.value)}
              placeholder="Ex.: Daikin EcoSwing 12.000 R-32"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-cod-placa`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Código da placa (part number) *
            </label>
            <input
              id={`${idBase}-cod-placa`}
              type="text"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={codigoPlaca}
              onChange={(e) => setCodigoPlaca(e.target.value)}
              placeholder="Ex.: 2P481925-1 / EBR83695003"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm placeholder:font-sans focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-cod-erro`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Código de erro (opcional)
            </label>
            <input
              id={`${idBase}-cod-erro`}
              type="text"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={codigoErro}
              onChange={(e) => setCodigoErro(e.target.value)}
              placeholder="Ex.: E1, P4, CH05, U4"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm placeholder:font-sans focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`${idBase}-perifericos`}
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Periféricos / acessórios entregues junto
          </label>
          <input
            id={`${idBase}-perifericos`}
            type="text"
            value={perifericos}
            onChange={(e) => setPerifericos(e.target.value)}
            placeholder="Ex.: Sensores degelo/ambiente, receptor IR, motor BLDC, reator..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`${idBase}-defeito`}
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Defeito reclamado {semDefeitoAparente ? '(opcional)' : '*'}
          </label>
          <textarea
            id={`${idBase}-defeito`}
            rows={2}
            value={defeitoReclamado}
            onChange={(e) => setDefeitoReclamado(e.target.value)}
            placeholder="Relato do instalador ou cliente sobre o sintoma apresentado..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Responsáveis */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idBase}-tec-ret`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Quem recebeu / retirou a placa
            </label>
            <select
              id={`${idBase}-tec-ret`}
              value={tecnicoRetiradaId}
              onChange={(e) => setTecnicoRetiradaId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="">Balcão / portador direto</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.area === 'bancada' ? 'Bancada' : 'Campo'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${idBase}-tec-ban`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Técnico de bancada responsável
            </label>
            <select
              id={`${idBase}-tec-ban`}
              value={tecnicoBancadaId}
              onChange={(e) => setTecnicoBancadaId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="">Definir depois na triagem</option>
              {tecnicos.filter(ehTecnicoBancadaPlacas).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.area === 'bancada' ? 'Bancada' : 'Campo'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Marcações: Sem defeito aparente & Retorno em garantia */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={semDefeitoAparente}
                onChange={(e) => setSemDefeitoAparente(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span>Sem defeito aparente</span>
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={ehGarantia}
                onChange={(e) => {
                  setEhGarantia(e.target.checked);
                  if (!e.target.checked) setOrigemGarantiaId('');
                }}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-violet-600" aria-hidden="true" />
                Retorno em garantia
              </span>
            </label>
          </div>

          {ehGarantia && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 text-xs space-y-2">
              <p className="font-semibold text-violet-950">
                Vincular à placa entregue original (garantia legal de 90 dias, isenta de novo orçamento)
              </p>
              {origem === 'campo' ? (
                <p className="text-violet-800">
                  Entrada em garantia vinculada à OS de campo selecionada.
                </p>
              ) : !clienteSelecionadoId ? (
                <p className="text-violet-800">
                  Selecione primeiro o cliente de placas acima para listar as placas já entregues a ele.
                </p>
              ) : carregandoGarantias ? (
                <p className="inline-flex items-center gap-1.5 text-violet-800">
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Consultando placas entregues deste cliente...
                </p>
              ) : placasEntreguesCliente.length === 0 ? (
                <p className="text-violet-800">
                  Este cliente não possui placas entregues anteriores no cadastro (você ainda pode registrar como garantia avulsa).
                </p>
              ) : (
                <div>
                  <label
                    htmlFor={`${idBase}-orig-garantia`}
                    className="mb-1 block font-semibold text-violet-900"
                  >
                    Placa original entregue
                  </label>
                  <select
                    id={`${idBase}-orig-garantia`}
                    value={origemGarantiaId}
                    onChange={(e) => setOrigemGarantiaId(e.target.value)}
                    className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-600 focus:outline-none"
                  >
                    <option value="">Selecionar placa entregue de origem...</option>
                    {placasEntreguesCliente.map((pl) => {
                      const vigente = garantiaVigente(pl.finished_at);
                      const ate = calcularValidadeGarantia(pl.finished_at);
                      return (
                        <option key={pl.id} value={pl.id}>
                          {pl.board_number} · {pl.brand_model} ({pl.board_code}) · Saída{' '}
                          {formatarData(pl.finished_at)} ·{' '}
                          {vigente
                            ? `Garantia vigente até ${formatarData(ate)}`
                            : `Garantia vencida em ${formatarData(ate)}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Fotos da entrada (categoria Antes) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-xs font-semibold text-slate-700">
                Fotos da entrada (Antes)
              </span>
              <span className="block text-[11px] text-slate-500">
                Registre o estado físico da placa, trilhas, etiquetas e conectores recebidos.
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ImagePlus size={15} aria-hidden="true" />
              <span>Selecionar fotos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleSelecionarFotos}
                className="sr-only"
              />
            </label>
          </div>

          {fotosEntrada.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {fotosEntrada.map((item) => (
                <div
                  key={item.idLocal}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-20 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoverFoto(item.idLocal)}
                    aria-label={`Remover foto ${item.file.name}`}
                    className="absolute top-1 right-1 rounded-lg bg-slate-900/75 p-1 text-white hover:bg-rose-600"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {erroFormulario && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            {erroFormulario}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={salvando}
            onClick={handleFechar}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Registrando placa...</span>
              </>
            ) : (
              <>
                <Plus size={16} aria-hidden="true" />
                <span>Registrar entrada e gerar comprovante</span>
              </>
            )}
          </button>
        </div>
      </form>
    </ModalDialogoPlacas>
  );
}

