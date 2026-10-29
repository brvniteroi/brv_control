import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, ClipboardList, X } from 'lucide-react';
import {
  buscarOrdem,
  listarEnderecosDoCliente,
  listarTecnicos,
  listarTipos,
  salvarOrdem,
  type OrdemDetalhe,
} from '../../services/ordens';
import type {
  Customer,
  CustomerAddress,
  Employee,
  ServiceOrderPriority,
  ServiceOrderStatus,
  ServiceType,
} from '../../types/fsm';
import { PRIORIDADES, STATUS_OS, formatarDataHora } from '../../utils/ordens';
import AnexosOS from './AnexosOS';
import AtividadesOS from './AtividadesOS';
import SeletorCliente from './SeletorCliente';

interface OrdemDetalhesProps {
  ordemId: string | 'nova';
  onFechar: () => void;
  onSalvo: (id: string) => void;
}

const INPUT =
  'mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

function rotuloEndereco(e: CustomerAddress): string {
  const apelido = e.label && e.label !== 'Principal' ? `${e.label} — ` : '';
  const via = [e.street, e.number].filter(Boolean).join(', ');
  return `${apelido}${via}${e.district ? ` · ${e.district}` : ''}${e.is_primary ? ' (principal)' : ''}${e.active ? '' : ' (inativo)'}`;
}

export default function OrdemDetalhes({ ordemId, onFechar, onSalvo }: OrdemDetalhesProps) {
  const nova = ordemId === 'nova';
  const [carregando, setCarregando] = useState(!nova);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [ordem, setOrdem] = useState<OrdemDetalhe | null>(null);
  const [tipos, setTipos] = useState<ServiceType[]>([]);
  const [tecnicos, setTecnicos] = useState<Pick<Employee, 'id' | 'name' | 'active'>[]>([]);
  const [enderecos, setEnderecos] = useState<CustomerAddress[]>([]);

  const [cliente, setCliente] = useState<{ id: string; name: string } | null>(null);
  const [enderecoId, setEnderecoId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [status, setStatus] = useState<ServiceOrderStatus>('aberta');
  const [prioridade, setPrioridade] = useState<ServiceOrderPriority>('normal');
  const [prazo, setPrazo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  const preencher = useCallback((o: OrdemDetalhe) => {
    setOrdem(o);
    setCliente(o.customer);
    setEnderecoId(o.address_id ?? '');
    setTipoId(o.service_type_id);
    setStatus(o.status);
    setPrioridade(o.priority);
    setPrazo(o.due_date ?? '');
    setDescricao(o.description ?? '');
    setNotasInternas(o.internal_notes ?? '');
    setMotivoCancelamento(o.cancel_reason ?? '');
  }, []);

  // Tipos e técnicos: uma vez
  useEffect(() => {
    Promise.all([listarTipos(), listarTecnicos()])
      .then(([t, e]) => {
        setTipos(t);
        setTecnicos(e);
      })
      .catch((e: unknown) => {
        console.error('Erro ao carregar tipos e técnicos:', e);
        setErro('Não foi possível carregar os tipos de OS e os técnicos.');
      });
  }, []);

  // OS existente
  useEffect(() => {
    if (nova) return;
    let ativo = true;
    buscarOrdem(ordemId)
      .then((o) => {
        if (!ativo) return;
        if (!o) {
          setErro('OS não encontrada (ou sem permissão para vê-la).');
          return;
        }
        preencher(o);
      })
      .catch((e: unknown) => {
        console.error('Erro ao buscar OS:', e);
        if (ativo) setErro('Não foi possível carregar a OS.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [ordemId, nova, preencher]);

  // Endereços do cliente escolhido
  const clienteId = cliente?.id ?? null;
  useEffect(() => {
    // Ao limpar o cliente, escolherCliente() já esvazia a lista de endereços
    if (!clienteId) return;
    let ativo = true;
    listarEnderecosDoCliente(clienteId)
      .then((lista) => {
        if (!ativo) return;
        setEnderecos(lista);
        // Cliente novo na OS: já sugere o endereço principal
        setEnderecoId((atual) => atual || (nova ? (lista.find((e) => e.is_primary)?.id ?? '') : ''));
      })
      .catch((e: unknown) => console.error('Erro ao buscar endereços:', e));
    return () => {
      ativo = false;
    };
  }, [clienteId, nova]);

  const recarregar = async () => {
    if (nova) return;
    const o = await buscarOrdem(ordemId);
    if (o) setOrdem(o);
  };

  const escolherCliente = (c: Customer | null) => {
    setCliente(c ? { id: c.id, name: c.name } : null);
    setEnderecoId('');
    setEnderecos([]);
  };

  const handleSalvar = async (e?: FormEvent) => {
    e?.preventDefault();
    setErro(null);
    if (!cliente) return setErro('Escolha o cliente.');
    if (!tipoId) return setErro('Escolha o tipo de OS.');
    if (status === 'cancelada' && !motivoCancelamento.trim()) return setErro('Informe o motivo do cancelamento.');

    setSalvando(true);
    try {
      const id = await salvarOrdem({
        id: nova ? undefined : ordemId,
        customer_id: cliente.id,
        address_id: enderecoId || null,
        service_type_id: tipoId,
        status,
        priority: prioridade,
        description: descricao,
        internal_notes: notasInternas,
        due_date: prazo,
        cancel_reason: motivoCancelamento,
        completed_at: ordem?.completed_at,
        cancelled_at: ordem?.cancelled_at,
      });
      setSucesso(true);
      setTimeout(() => setSucesso(false), 2500);
      if (!nova) await recarregar();
      onSalvo(id);
    } catch (err) {
      console.error('Erro ao salvar OS:', err);
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a OS.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando OS...</span>
        </div>
      </div>
    );
  }

  const tipoAtual = tipos.find((t) => t.id === tipoId);
  const tiposVisiveis = tipos.filter((t) => t.active || t.id === tipoId);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ClipboardList size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {nova ? 'Nova OS' : `OS ${ordem?.number ?? ''}`}
            </h1>
            {ordem && (
              <span className="text-xs italic text-slate-500">
                Aberta em {formatarDataHora(ordem.opened_at)}
                {ordem.field_control_id ? ' · importada do Field Control' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sucesso && (
            <span className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-600">
              <Check size={14} /> Salvo com sucesso!
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSalvar()}
            disabled={salvando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {erro && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {erro}
        </div>
      )}

      <div className="mx-auto mt-6 max-w-5xl space-y-6 px-6">
        <form onSubmit={handleSalvar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-slate-700">Cliente *</span>
              {/* Trocar o cliente de uma OS existente deixaria atividades e fotos com o cliente errado */}
              <SeletorCliente valor={cliente} onChange={escolherCliente} desabilitado={!nova} />
            </div>

            <div>
              <label htmlFor="os-end" className="block text-xs font-medium text-slate-700">Endereço do atendimento</label>
              <select
                id="os-end"
                value={enderecoId}
                onChange={(e) => setEnderecoId(e.target.value)}
                disabled={!cliente}
                className={INPUT}
              >
                <option value="">{cliente ? 'Sem endereço definido' : 'Escolha o cliente primeiro'}</option>
                {enderecos
                  .filter((e) => e.active || e.id === enderecoId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{rotuloEndereco(e)}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="os-tipo" className="block text-xs font-medium text-slate-700">Tipo de OS *</label>
              <select id="os-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={INPUT}>
                <option value="">Escolha...</option>
                {tiposVisiveis.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="os-status" className="block text-xs font-medium text-slate-700">Situação</label>
              <select id="os-status" value={status} onChange={(e) => setStatus(e.target.value as ServiceOrderStatus)} className={INPUT}>
                {STATUS_OS.map((s) => (
                  <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="os-prio" className="block text-xs font-medium text-slate-700">Prioridade</label>
              <select id="os-prio" value={prioridade} onChange={(e) => setPrioridade(e.target.value as ServiceOrderPriority)} className={INPUT}>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="os-prazo" className="block text-xs font-medium text-slate-700">Prazo</label>
              <input id="os-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={INPUT} />
            </div>
            {status === 'cancelada' && (
              <div className="sm:col-span-3">
                <label htmlFor="os-cancel" className="block text-xs font-medium text-slate-700">Motivo do cancelamento *</label>
                <input id="os-cancel" type="text" value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} className={INPUT} />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="os-desc" className="block text-xs font-medium text-slate-700">Solicitação do cliente / descrição</label>
            <textarea id="os-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={INPUT} />
          </div>

          <div>
            <label htmlFor="os-notas" className="block text-xs font-medium text-slate-700">Observações internas (só o escritório)</label>
            <textarea id="os-notas" rows={2} value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} className={INPUT} />
          </div>
        </form>

        {nova ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
            Salve a OS para poder criar atividades e agendar técnicos.
          </p>
        ) : (
          ordem && (
            <>
              <AtividadesOS
                ordemId={ordem.id}
                tituloPadrao={tipoAtual?.name ?? ordem.service_type?.name ?? 'Atividade'}
                duracaoPadrao={tipoAtual?.default_duration_minutes ?? 60}
                atividades={ordem.tasks}
                tecnicos={tecnicos}
                onAlterado={recarregar}
              />
              <AnexosOS anexos={ordem.attachments} />
            </>
          )
        )}
      </div>
    </div>
  );
}
