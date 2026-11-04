import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import {
  atualizarTextosOrdem,
  listarEnderecosDoCliente,
  listarOrdens,
  listarTipos,
  salvarAtividade,
  salvarOrdem,
  type OrdemResumo,
} from '../../services/ordens';
import { buscarClientePorId, listarClientes } from '../../services/clientes';
import ClienteDetalhes from '../clientes/ClienteDetalhes';
import type { Customer, CustomerAddress, ServiceType } from '../../types/fsm';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { deCamposDataHora, rotuloEndereco } from '../../utils/ordens';

interface Props {
  dia: string;
  tecnicos: TecnicoLinha[];
  aoFechar: () => void;
  aoSalvo: () => void;
}

const CAMPO =
  'block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function NovaAtividadeModal({ dia, tecnicos, aoFechar, aoSalvo }: Props) {
  const [termo, setTermo] = useState('');
  const [encontradas, setResultados] = useState<OrdemResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [clientesAchados, setClientesAchados] = useState<Customer[]>([]);
  const [ordem, setOrdem] = useState<OrdemResumo | null>(null);
  /** Sem OS: cliente que ganha uma OS nova ao salvar a atividade. */
  const [semOs, setSemOs] = useState<{ id: string; nome: string } | null>(null);
  const [tipos, setTipos] = useState<ServiceType[]>([]);
  const [tipoId, setTipoId] = useState('');
  /** Endereços ativos do cliente da nova OS (a escolha só aparece com mais de um) */
  const [enderecos, setEnderecos] = useState<CustomerAddress[]>([]);
  const [enderecoId, setEnderecoId] = useState('');
  // Tela completa de cadastro de cliente aberta por cima do modal
  const [cadastrando, setCadastrando] = useState(false);
  const [clienteCriadoId, setClienteCriadoId] = useState<string | null>(null);
  const escolhido = !!ordem || !!semOs;
  const buscaValida = !escolhido && termo.trim().length >= 2;
  const resultados = buscaValida ? encontradas : [];
  const [duracoes, setDuracoes] = useState<Record<string, number>>({});

  const [titulo, setTitulo] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [data, setData] = useState(dia);
  const [hora, setHora] = useState('');
  // Obrigatória e livre; só vem preenchida se o tipo de serviço tiver duração padrão
  const [duracao, setDuracao] = useState('');
  // Campos da OS: na OS nova vão junto; numa OS existente vêm preenchidos e, se mudarem, atualizam a OS
  const [solicitacao, setSolicitacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarTipos()
      .then((lista) => {
        setTipos(lista);
        setDuracoes(Object.fromEntries(lista.filter((t) => t.default_duration_minutes).map((t) => [t.id, t.default_duration_minutes!])));
      })
      .catch(() => {}); // sem a duração padrão, o operador digita
  }, []);

  // Endereços do cliente que vai ganhar a OS nova; já sugere o principal
  const clienteSemOsId = semOs?.id ?? null;
  useEffect(() => {
    if (!clienteSemOsId) return;
    let ativo = true;
    listarEnderecosDoCliente(clienteSemOsId)
      .then((lista) => {
        if (!ativo) return;
        const ativos = lista.filter((e) => e.active);
        setEnderecos(ativos);
        setEnderecoId((ativos.find((e) => e.is_primary) ?? ativos[0])?.id ?? '');
      })
      .catch(() => {
        if (ativo) setEnderecos([]);
      });
    return () => {
      ativo = false;
    };
  }, [clienteSemOsId]);

  // Busca de OS (só as que ainda estão em andamento)
  useEffect(() => {
    if (escolhido || termo.trim().length < 2) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setBuscando(true);
      Promise.all([listarOrdens({ termo: termo.trim(), status: '', tipoId: '' }, 0), listarClientes(termo.trim(), 'ativos', 0)])
        .then(([r, c]) => {
          if (!ativo) return;
          setResultados(r.itens.filter((o) => o.status !== 'concluida' && o.status !== 'cancelada').slice(0, 8));
          setClientesAchados(c.itens.slice(0, 5));
        })
        .catch(() => {
          if (!ativo) return;
          setResultados([]);
          setClientesAchados([]);
        })
        .finally(() => {
          if (ativo) setBuscando(false);
        });
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo, escolhido]);

  const escolherOrdem = (o: OrdemResumo) => {
    setOrdem(o);
    setTitulo(o.service_type?.name ?? '');
    setSolicitacao(o.description ?? '');
    setObservacoes(o.internal_notes ?? '');
    const dur = o.service_type && duracoes[o.service_type.id];
    if (dur) setDuracao(String(dur));
  };

  const escolherSemOs = (id: string, nome: string) => {
    setSemOs({ id, nome });
    setOrdem(null);
    setSolicitacao('');
    setObservacoes('');
    setTipoId('');
    setEnderecos([]);
    setEnderecoId('');
  };

  const fecharCadastro = async () => {
    setCadastrando(false);
    if (!clienteCriadoId) return;
    const c = await buscarClientePorId(clienteCriadoId);
    if (c) escolherSemOs(c.id, c.name);
    setClienteCriadoId(null);
  };

  const escolherTipo = (id: string) => {
    setTipoId(id);
    setTitulo((t) => t || tipos.find((x) => x.id === id)?.name || '');
    const dur = duracoes[id];
    if (dur) setDuracao(String(dur));
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!ordem && !semOs) return setErro('Escolha a OS ou o cliente desta atividade.');
    if (semOs && !tipoId) return setErro('Escolha o tipo de serviço da nova OS.');
    if (semOs && enderecos.length > 1 && !enderecoId) return setErro('Escolha o endereço do serviço.');
    if (!titulo.trim()) return setErro('Informe o título da atividade.');
    const minutos = Number(duracao);
    if (!duracao.trim() || !Number.isInteger(minutos) || minutos < 1)
      return setErro('Informe a duração prevista em minutos (número inteiro maior que zero).');
    if (!tecnicoId || !data || !hora) return setErro('Escolha o técnico, a data e a hora de início.');

    const inicio = deCamposDataHora(data, hora);
    if (!inicio) return setErro('Data ou hora inválida.');
    const fim = new Date(new Date(inicio).getTime() + minutos * 60000).toISOString();

    setSalvando(true);
    try {
      let ordemId = ordem?.id;
      if (!ordemId && semOs) {
        ordemId = await salvarOrdem({
          customer_id: semOs.id,
          address_id: enderecoId || null,
          service_type_id: tipoId,
          status: 'agendada',
          priority: 'normal',
          description: solicitacao,
          internal_notes: observacoes,
          due_date: '',
          cancel_reason: '',
        });
      } else if (
        ordem &&
        (solicitacao.trim() !== (ordem.description ?? '').trim() || observacoes.trim() !== (ordem.internal_notes ?? '').trim())
      ) {
        await atualizarTextosOrdem(ordem.id, solicitacao, observacoes);
      }
      await salvarAtividade({
        service_order_id: ordemId!,
        employee_id: tecnicoId,
        title: titulo,
        description: '',
        status: 'agendada',
        scheduled_start: inicio,
        scheduled_end: fim,
        estimated_minutes: minutos,
        technician_notes: '',
      });
      aoSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a atividade.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {cadastrando && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50">
          <ClienteDetalhes clienteId="novo" nomeInicial={termo.trim()} onFechar={fecharCadastro} onSalvo={setClienteCriadoId} />
        </div>
      )}
      <form onSubmit={salvar} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Nova atividade</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-700">Ordem de serviço ou cliente *</label>
          {semOs ? (
            <div className="mt-1.5 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="min-w-0 truncate">
                  Cliente: <b>{semOs.nome}</b> · será criada uma nova OS
                </span>
                <button type="button" onClick={() => setSemOs(null)} className="ml-2 shrink-0 text-xs font-semibold text-blue-600 hover:underline">
                  Trocar
                </button>
              </div>
              <div>
                <label htmlFor="na-tipo" className="block text-xs font-semibold text-slate-700">Tipo de serviço *</label>
                <select id="na-tipo" value={tipoId} onChange={(e) => escolherTipo(e.target.value)} className={`${CAMPO} mt-1.5 bg-white`}>
                  <option value="">Selecione</option>
                  {tipos.filter((t) => t.active).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {enderecos.length > 1 && (
                <div>
                  <label htmlFor="na-endereco" className="block text-xs font-semibold text-slate-700">Endereço do serviço *</label>
                  <select id="na-endereco" value={enderecoId} onChange={(e) => setEnderecoId(e.target.value)} className={`${CAMPO} mt-1.5 bg-white`}>
                    <option value="">Selecione</option>
                    {enderecos.map((e) => (
                      <option key={e.id} value={e.id}>{rotuloEndereco(e)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : ordem ? (
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <b>OS {ordem.number}</b> · {ordem.customer?.name}
              </span>
              <button type="button" onClick={() => setOrdem(null)} className="ml-2 shrink-0 text-xs font-semibold text-blue-600 hover:underline">
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative mt-1.5">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Número da OS ou nome do cliente"
                className={`${CAMPO} pl-9`}
              />
              {buscaValida && (
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
                  {buscando && (
                    <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                      <Loader2 size={13} className="animate-spin" /> Buscando...
                    </li>
                  )}
                  {!buscando && resultados.length === 0 && clientesAchados.length === 0 && (
                    <li className="px-3 py-2 text-xs text-slate-500">Nenhuma OS em andamento nem cliente encontrado.</li>
                  )}
                  {resultados.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => escolherOrdem(o)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                        <b>OS {o.number}</b> · {o.customer?.name}
                        <span className="ml-1 text-xs text-slate-500">{o.service_type?.name}</span>
                      </button>
                    </li>
                  ))}
                  {!buscando &&
                    clientesAchados.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => escolherSemOs(c.id, c.name)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                          <span className="text-xs text-slate-500">Nova OS para</span> <b>{c.name}</b>
                        </button>
                      </li>
                    ))}
                  {!buscando && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setCadastrando(true)}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        <UserPlus size={14} /> Cadastrar "{termo.trim()}" como novo cliente (cadastro completo)
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="na-titulo" className="block text-xs font-semibold text-slate-700">Título *</label>
          <input id="na-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`${CAMPO} mt-1.5`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label htmlFor="na-tec" className="block text-xs font-semibold text-slate-700">Técnico *</label>
            <select id="na-tec" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className={`${CAMPO} mt-1.5`}>
              <option value="">Selecione</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="na-data" className="block text-xs font-semibold text-slate-700">Data *</label>
            <input id="na-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="na-hora" className="block text-xs font-semibold text-slate-700">Hora de início *</label>
            <input id="na-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="na-dur" className="block text-xs font-semibold text-slate-700">Duração prevista (min) *</label>
            <input
              id="na-dur"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Ex.: 90"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className={`${CAMPO} mt-1.5`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="na-solicitacao" className="block text-xs font-semibold text-slate-700">Solicitação do cliente / descrição</label>
          <textarea
            id="na-solicitacao"
            rows={2}
            value={solicitacao}
            onChange={(e) => setSolicitacao(e.target.value)}
            className={`${CAMPO} mt-1.5 resize-y`}
          />
        </div>
        <div>
          <label htmlFor="na-obs" className="block text-xs font-semibold text-slate-700">Observações internas (só o escritório)</label>
          <textarea
            id="na-obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className={`${CAMPO} mt-1.5 resize-y`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} disabled={salvando} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {salvando && <Loader2 size={13} className="animate-spin" />}
            Criar atividade
          </button>
        </div>
      </form>
    </div>
  );
}
