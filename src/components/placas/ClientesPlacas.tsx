import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { PersonType } from '../../types/fsm';
import type { BoardClient, BoardCustomerKind, BoardOrder } from '../../types/placas';
import { podeVerFinanceiroPlacas } from '../../utils/acessoPlacas';
import { documentoValido, formatarDocumento, limparDocumento } from '../../utils/documento';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { CORES_ETAPA_PLACA, CORES_TIPO_CLIENTE_PLACA } from './cores';
import {
  excluirClientePlaca,
  listarClientesPlacas,
  placasDoCliente,
  salvarClientePlaca,
} from './fonteDeDados';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import {
  ROTULO_ETAPA_PLACA,
  ehEscritorioOuAdminPlaca,
  valorReceitaPlaca,
} from './regrasPlacas';

export default function ClientesPlacas() {
  const { profile } = useAuth();
  const idBase = useId();

  const papel = profile?.role;
  const podeEditar = ehEscritorioOuAdminPlaca(papel);
  const temFinanceiro = podeVerFinanceiroPlacas(profile);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | BoardCustomerKind>('todos');
  const [clientes, setClientes] = useState<BoardClient[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null);
  const [avisoErro, setAvisoErro] = useState<string | null>(null);

  // Detalhe do cliente + lista de placas dele
  const [clienteDetalhe, setClienteDetalhe] = useState<BoardClient | null>(null);
  const [placasCli, setPlacasCli] = useState<BoardOrder[]>([]);
  const [carregandoPlacasCli, setCarregandoPlacasCli] = useState(false);

  // Modal Criar / Editar cliente
  const [modalFormAberto, setModalFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState<BoardCustomerKind>('instalador');
  const [cidade, setCidade] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<PersonType>('PF');
  const [documento, setDocumento] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvandoForm, setSalvandoForm] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Modal confirmar exclusão
  const [clienteParaExcluir, setClienteParaExcluir] = useState<BoardClient | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        return listarClientesPlacas({ busca, tipo: filtroTipo });
      })
      .then((lista) => {
        if (cancelado || !lista) return;
        setClientes(lista);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(
            err instanceof Error ? err.message : 'Erro ao carregar clientes de placas.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [busca, filtroTipo, chaveRecarga]);

  const abrirDetalheCliente = async (cli: BoardClient) => {
    setClienteDetalhe(cli);
    setPlacasCli([]);
    setCarregandoPlacasCli(true);
    try {
      const lista = await placasDoCliente(cli.id);
      setPlacasCli(lista);
    } catch {
      setPlacasCli([]);
    } finally {
      setCarregandoPlacasCli(false);
    }
  };

  const abrirNovoCliente = () => {
    setEditandoId(undefined);
    setNome('');
    setTelefone('');
    setTipo('instalador');
    setCidade('Niterói');
    setTipoPessoa('PF');
    setDocumento('');
    setEndereco('');
    setObservacoes('');
    setErroForm(null);
    setModalFormAberto(true);
  };

  const abrirEditarCliente = (cli: BoardClient) => {
    setEditandoId(cli.id);
    setNome(cli.name);
    setTelefone(formatarTelefone(cli.phone));
    setTipo(cli.kind);
    setCidade(cli.city ?? '');
    const tp = cli.person_type || 'PF';
    setTipoPessoa(tp);
    setDocumento(cli.document ? formatarDocumento(cli.document, tp) : '');
    setEndereco(cli.address ?? '');
    setObservacoes(cli.notes ?? '');
    setErroForm(null);
    setModalFormAberto(true);
  };

  const handleSalvarCliente = async (e: FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (!nome.trim()) {
      setErroForm('Informe o nome completo ou razão social do cliente/parceiro.');
      return;
    }
    if (telefone.replace(/\D/g, '').length < 10) {
      setErroForm('Informe um telefone válido com DDD.');
      return;
    }
    const docLimpo = limparDocumento(documento, tipoPessoa);
    if (docLimpo.length > 0 && !documentoValido(docLimpo, tipoPessoa)) {
      setErroForm(
        tipoPessoa === 'PF' ? 'O CPF informado não é válido.' : 'O CNPJ informado não é válido.',
      );
      return;
    }

    setSalvandoForm(true);
    try {
      const salvo = await salvarClientePlaca({
        id: editandoId,
        name: nome.trim(),
        phone: telefone,
        kind: tipo,
        city: cidade.trim() || null,
        person_type: tipoPessoa,
        document: docLimpo || null,
        address: endereco.trim() || null,
        notes: observacoes.trim() || null,
      });
      setModalFormAberto(false);
      setAvisoErro(null);
      setAvisoSucesso(
        editandoId
          ? `Cadastro de "${salvo.name}" atualizado.`
          : `Cliente "${salvo.name}" cadastrado com sucesso.`,
      );
      setChaveRecarga((c) => c + 1);
      if (clienteDetalhe?.id === salvo.id) {
        setClienteDetalhe(salvo);
      }
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar cliente.');
    } finally {
      setSalvandoForm(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!clienteParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirClientePlaca(clienteParaExcluir.id);
      const nomeExcluido = clienteParaExcluir.name;
      setClienteParaExcluir(null);
      if (clienteDetalhe?.id === clienteParaExcluir.id) {
        setClienteDetalhe(null);
      }
      setAvisoErro(null);
      setAvisoSucesso(`Cliente "${nomeExcluido}" excluído.`);
      setChaveRecarga((c) => c + 1);
    } catch (err) {
      setClienteParaExcluir(null);
      setAvisoSucesso(null);
      setAvisoErro(err instanceof Error ? err.message : 'Não foi possível excluir o cliente.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
            <Users size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Clientes de placas
            </h1>
            <p className="text-xs text-slate-500">
              Cadastro paralelo de parceiros instaladores e clientes finais do laboratório.
            </p>
          </div>
        </div>

        {podeEditar && (
          <button
            type="button"
            onClick={abrirNovoCliente}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 sm:text-sm"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Novo cliente</span>
          </button>
        )}
      </div>

      {avisoSucesso && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
            {avisoSucesso}
          </span>
          <button
            type="button"
            onClick={() => setAvisoSucesso(null)}
            className="text-emerald-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {avisoErro && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-900"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600" aria-hidden="true" />
            {avisoErro}
          </span>
          <button
            type="button"
            onClick={() => setAvisoErro(null)}
            className="text-rose-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Barra de busca e filtro por tipo */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de cliente">
          {(
            [
              { chave: 'todos', rotulo: 'Todos' },
              { chave: 'instalador', rotulo: 'Parceiros' },
              { chave: 'final', rotulo: 'Cliente final' },
            ] as const
          ).map((item) => {
            const ativo = filtroTipo === item.chave;
            return (
              <button
                key={item.chave}
                type="button"
                onClick={() => setFiltroTipo(item.chave)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  ativo
                    ? 'border-brv-navy bg-brv-navy text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.rotulo}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:max-w-sm">
          <label htmlFor={`${idBase}-busca`} className="sr-only">
            Buscar por nome, telefone ou cidade
          </label>
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={`${idBase}-busca`}
            type="search"
            autoCorrect="off"
            spellCheck={false}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, telefone ou cidade..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2 pr-8 pl-9 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Estados da lista */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium">Carregando clientes de placas...</p>
        </div>
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-12 text-center"
        >
          <p className="text-sm font-semibold text-rose-900">{erroCarga}</p>
          <button
            type="button"
            onClick={() => setChaveRecarga((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Inbox size={28} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">
            Nenhum cliente de placas encontrado
          </p>
          <p className="max-w-md text-xs text-slate-500">
            Ajuste os filtros ou cadastre um novo parceiro instalador ou cliente final.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular */}
          <div className="space-y-2.5 md:hidden">
            {clientes.map((cli) => {
              const seloTipo = CORES_TIPO_CLIENTE_PLACA[cli.kind];
              return (
                <div
                  key={cli.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void abrirDetalheCliente(cli)}
                      className="text-left text-sm font-bold text-slate-900 hover:text-blue-700"
                    >
                      {cli.name}
                    </button>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${seloTipo.selo}`}
                    >
                      {seloTipo.rotuloCurto}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={13} aria-hidden="true" />
                      {formatarTelefone(cli.phone)}
                    </span>
                    {cli.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} aria-hidden="true" />
                        {cli.city}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="text-slate-500">
                      <strong className="text-slate-900">{cli.board_count}</strong> placa(s)
                      {cli.last_board_at ? ` · última em ${formatarData(cli.last_board_at)}` : ''}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void abrirDetalheCliente(cli)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver placas
                      </button>
                      {podeEditar && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirEditarCliente(cli)}
                            aria-label={`Editar ${cli.name}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setClienteParaExcluir(cli)}
                            aria-label={`Excluir ${cli.name}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela semântica no computador */}
          <div
            role="region"
            aria-label="Lista de clientes de placas"
            tabIndex={0}
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Cadastro de parceiros instaladores e clientes finais do módulo de Reparo de Placas
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Cliente / Parceiro
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Telefone
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Cidade
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">
                    Placas
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Última entrada
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map((cli) => {
                  const seloTipo = CORES_TIPO_CLIENTE_PLACA[cli.kind];
                  return (
                    <tr key={cli.id} className="hover:bg-slate-50/80">
                      <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => void abrirDetalheCliente(cli)}
                          className="text-left hover:text-blue-700 hover:underline"
                        >
                          {cli.name}
                        </button>
                        {cli.notes && (
                          <p className="mt-0.5 max-w-xs truncate font-normal text-slate-400">
                            {cli.notes}
                          </p>
                        )}
                      </th>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${seloTipo.selo}`}
                        >
                          {seloTipo.rotuloCurto}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {formatarTelefone(cli.phone)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{cli.city || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {cli.board_count}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {cli.last_board_at ? formatarData(cli.last_board_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void abrirDetalheCliente(cli)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Ver placas
                          </button>
                          {podeEditar && (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirEditarCliente(cli)}
                                aria-label={`Editar ${cli.name}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setClienteParaExcluir(cli)}
                                aria-label={`Excluir ${cli.name}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Detalhe do cliente e histórico de placas dele */}
      <ModalDialogoPlacas
        aberto={!!clienteDetalhe}
        onFechar={() => setClienteDetalhe(null)}
        titulo={clienteDetalhe?.name ?? 'Cliente de placas'}
        subtitulo={
          clienteDetalhe
            ? `${CORES_TIPO_CLIENTE_PLACA[clienteDetalhe.kind].rotulo} · ${formatarTelefone(clienteDetalhe.phone)}`
            : undefined
        }
        larguraMax="max-w-3xl"
      >
        {clienteDetalhe && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-600">Cidade:</span>{' '}
                <span className="text-slate-900">{clienteDetalhe.city || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">CPF/CNPJ:</span>{' '}
                <span className="font-mono text-slate-900">
                  {clienteDetalhe.document
                    ? formatarDocumento(clienteDetalhe.document, clienteDetalhe.person_type)
                    : '—'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold text-slate-600">Endereço:</span>{' '}
                <span className="text-slate-900">{clienteDetalhe.address || '—'}</span>
              </div>
              {clienteDetalhe.notes && (
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-600">Observações:</span>{' '}
                  <span className="text-slate-800">{clienteDetalhe.notes}</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Placas vinculadas ({placasCli.length})
              </h3>

              {carregandoPlacasCli ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Buscando placas deste cliente...</span>
                </div>
              ) : placasCli.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  Nenhuma placa registrada para este cliente até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {placasCli.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs hover:bg-slate-50"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {pl.board_number}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_ETAPA_PLACA[pl.status].selo}`}
                          >
                            {ROTULO_ETAPA_PLACA[pl.status]}
                          </span>
                          {temFinanceiro && pl.refunded && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              Reembolsada
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600">
                          {pl.brand_model} · Cód. <span className="font-mono">{pl.board_code}</span>{' '}
                          · Entrada {formatarData(pl.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {podeEditar && (
                          <span className="font-semibold text-slate-800">
                            {temFinanceiro
                              ? valorReceitaPlaca(pl) > 0
                                ? valorEmReais(valorReceitaPlaca(pl))
                                : '—'
                              : pl.quote_amount != null
                                ? valorEmReais(pl.quote_amount)
                                : '—'}
                          </span>
                        )}
                        <Link
                          to={`/placas?placa=${pl.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-800 hover:bg-blue-100"
                        >
                          <span>Abrir placa</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalDialogoPlacas>

      {/* Modal: Criar / Editar cliente */}
      <ModalDialogoPlacas
        aberto={modalFormAberto}
        onFechar={() => setModalFormAberto(false)}
        titulo={editandoId ? 'Editar cliente de placas' : 'Novo cliente de placas'}
        larguraMax="max-w-2xl"
        fecharAoClicarFora={false}
      >
        <form onSubmit={handleSalvarCliente} noValidate className="space-y-4">
          <div>
            <label
              htmlFor={`${idBase}-cli-nome`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Nome / razão social / apelido comercial *
            </label>
            <input
              id={`${idBase}-cli-nome`}
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Refrigeração Leste — Marcos"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${idBase}-cli-tel`}
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Telefone / WhatsApp *
              </label>
              <input
                id={`${idBase}-cli-tel`}
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(21) 99999-9999"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`${idBase}-cli-tipo`}
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Tipo de cliente
              </label>
              <select
                id={`${idBase}-cli-tipo`}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as BoardCustomerKind)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="instalador">Parceiro instalador</option>
                <option value="final">Cliente final</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${idBase}-cli-cid`}
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Cidade
              </label>
              <input
                id={`${idBase}-cli-cid`}
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: Niterói, São Gonçalo, Maricá"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={`${idBase}-cli-doc`}
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                CPF / CNPJ (opcional)
              </label>
              <div className="flex gap-1.5">
                <select
                  aria-label="Tipo de documento"
                  value={tipoPessoa}
                  onChange={(e) => {
                    const novo = e.target.value as PersonType;
                    setTipoPessoa(novo);
                    setDocumento((d) => formatarDocumento(d, novo));
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"
                >
                  <option value="PF">CPF</option>
                  <option value="PJ">CNPJ</option>
                </select>
                <input
                  id={`${idBase}-cli-doc`}
                  type="text"
                  autoCorrect="off"
                  spellCheck={false}
                  value={documento}
                  onChange={(e) => setDocumento(formatarDocumento(e.target.value, tipoPessoa))}
                  placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor={`${idBase}-cli-end`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Endereço (opcional)
            </label>
            <input
              id={`${idBase}-cli-end`}
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`${idBase}-cli-obs`}
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Observações internas (opcional)
            </label>
            <textarea
              id={`${idBase}-cli-obs`}
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: Portador habitual, preferência de PIX ou horário..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          {erroForm && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800"
            >
              {erroForm}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalFormAberto(false)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoForm}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {salvandoForm && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>{editandoId ? 'Salvar alterações' : 'Cadastrar cliente'}</span>
            </button>
          </div>
        </form>
      </ModalDialogoPlacas>

      {/* Modal: Excluir cliente (bloqueia quando tem placas) */}
      <ModalDialogoPlacas
        aberto={!!clienteParaExcluir}
        onFechar={() => setClienteParaExcluir(null)}
        titulo="Excluir cliente de placas"
      >
        {clienteParaExcluir && (
          <div className="space-y-4 text-sm text-slate-700">
            {clienteParaExcluir.board_count > 0 ? (
              <>
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                  Não é possível excluir <strong>{clienteParaExcluir.name}</strong> porque já existem{' '}
                  <strong>{clienteParaExcluir.board_count} placa(s)</strong> vinculada(s) a este cadastro no histórico do laboratório.
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setClienteParaExcluir(null)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Entendi
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Confirma a exclusão definitiva de <strong>{clienteParaExcluir.name}</strong>?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setClienteParaExcluir(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => void handleConfirmarExclusao()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {excluindo && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    <span>Excluir cadastro</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </ModalDialogoPlacas>
    </div>
  );
}
