import { useState, type FormEvent } from 'react';
import { CalendarClock, Pencil, Plus, Trash2, User, X } from 'lucide-react';
import {
  removerAtividade,
  salvarAtividade,
  type AtividadeDetalhe,
} from '../../services/ordens';
import type { Employee, TaskStatus } from '../../types/fsm';
import {
  STATUS_ATIVIDADE,
  deCamposDataHora,
  formatarDataHora,
  infoStatusAtividade,
  paraCamposDataHora,
} from '../../utils/ordens';
import FormulariosAtividade from '../formularios/FormulariosAtividade';

interface AtividadesOSProps {
  ordemId: string;
  clienteId?: string;
  /** Nome do tipo da OS, sugerido como título da atividade. */
  tituloPadrao: string;
  duracaoPadrao: number;
  atividades: AtividadeDetalhe[];
  tecnicos: Pick<Employee, 'id' | 'name' | 'active'>[];
  onAlterado: () => Promise<void>;
}

interface Formulario {
  titulo: string;
  tecnicoId: string;
  status: TaskStatus;
  data: string;
  hora: string;
  duracao: string;
  descricao: string;
  relato: string;
}

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function AtividadesOS({
  ordemId,
  clienteId,
  tituloPadrao,
  duracaoPadrao,
  atividades,
  tecnicos,
  onAlterado,
}: AtividadesOSProps) {
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const campo = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [chave]: valor } : f));

  const abrirNova = () => {
    setEditandoId(null);
    setErro(null);
    setForm({
      titulo: tituloPadrao,
      tecnicoId: '',
      status: 'pendente',
      data: '',
      hora: '',
      duracao: String(duracaoPadrao),
      descricao: '',
      relato: '',
    });
    setAberto(true);
  };

  const abrirEdicao = (a: AtividadeDetalhe) => {
    const { data, hora } = paraCamposDataHora(a.scheduled_start);
    const minutos =
      a.scheduled_start && a.scheduled_end
        ? Math.round((new Date(a.scheduled_end).getTime() - new Date(a.scheduled_start).getTime()) / 60000)
        : duracaoPadrao;
    setEditandoId(a.id);
    setErro(null);
    setForm({
      titulo: a.title,
      tecnicoId: a.employee_id ?? '',
      status: a.status,
      data,
      hora,
      duracao: String(minutos),
      descricao: a.description ?? '',
      relato: a.technician_notes ?? '',
    });
    setAberto(true);
  };

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.titulo.trim()) {
      setErro('Informe o título da atividade.');
      return;
    }

    const inicio = deCamposDataHora(form.data, form.hora);
    const minutos = Math.max(1, Number(form.duracao) || duracaoPadrao);
    const fim = inicio ? new Date(new Date(inicio).getTime() + minutos * 60000).toISOString() : null;

    // Técnico + data definidos: a atividade deixa de ser "pendente" e entra na agenda
    let status = form.status;
    if (status === 'pendente' && form.tecnicoId && inicio) status = 'agendada';
    if (status === 'agendada' && (!form.tecnicoId || !inicio)) {
      setErro('Para agendar, escolha o técnico e a data/hora de início.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await salvarAtividade({
        id: editandoId ?? undefined,
        service_order_id: ordemId,
        employee_id: form.tecnicoId || null,
        title: form.titulo,
        description: form.descricao,
        status,
        scheduled_start: inicio,
        scheduled_end: fim,
        technician_notes: form.relato,
      });
      setAberto(false);
      await onAlterado();
    } catch (err) {
      console.error('Erro ao salvar atividade:', err);
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a atividade.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (a: AtividadeDetalhe) => {
    if (!window.confirm(`Excluir a atividade "${a.title}"?`)) return;
    try {
      await removerAtividade(a.id);
      await onAlterado();
    } catch (err) {
      console.error('Erro ao excluir atividade:', err);
      window.alert(err instanceof Error ? err.message : 'Não foi possível excluir a atividade.');
    }
  };

  // Técnicos inativos só aparecem se já estiverem na atividade em edição
  const atual = atividades.find((a) => a.id === editandoId)?.employee_id;
  const opcoesTecnicos = tecnicos.filter((t) => t.active || t.id === atual);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <CalendarClock size={18} className="text-blue-600" />
          <h2 className="text-base font-bold">Atividades ({atividades.length})</h2>
        </div>
        <button
          type="button"
          onClick={abrirNova}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          <Plus size={14} />
          Nova atividade
        </button>
      </div>

      {atividades.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhuma atividade. Crie uma para agendar um técnico.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {atividades.map((a) => {
            const info = infoStatusAtividade(a.status);
            return (
              <li key={a.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{a.title}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${info.classe}`}>
                        {info.rotulo}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <User size={12} /> {a.employee?.name ?? 'Sem técnico'}
                      </span>
                      <span>{a.scheduled_start ? formatarDataHora(a.scheduled_start) : 'Sem data'}</span>
                      {a.finished_at && <span>Concluída em {formatarDataHora(a.finished_at)}</span>}
                    </div>
                    {a.technician_notes && (
                      <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">{a.technician_notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(a)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(a)}
                      className="inline-flex items-center rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="Excluir atividade"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <FormulariosAtividade taskId={a.id} clienteId={clienteId} />
              </li>
            );
          })}
        </ul>
      )}

      {aberto && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editandoId ? 'Editar atividade' : 'Nova atividade'}
              </h3>
              <button type="button" onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-3.5">
              {erro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>
              )}

              <div>
                <label htmlFor="at-titulo" className="block text-xs font-medium text-slate-700">Título *</label>
                <input id="at-titulo" type="text" value={form.titulo} onChange={(e) => campo('titulo', e.target.value)} className={INPUT} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="at-tec" className="block text-xs font-medium text-slate-700">Técnico</label>
                  <select id="at-tec" value={form.tecnicoId} onChange={(e) => campo('tecnicoId', e.target.value)} className={INPUT}>
                    <option value="">A distribuir</option>
                    {opcoesTecnicos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.active ? '' : ' (inativo)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="at-status" className="block text-xs font-medium text-slate-700">Situação</label>
                  <select id="at-status" value={form.status} onChange={(e) => campo('status', e.target.value as TaskStatus)} className={INPUT}>
                    {STATUS_ATIVIDADE.map((s) => (
                      <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="at-data" className="block text-xs font-medium text-slate-700">Data</label>
                  <input id="at-data" type="date" value={form.data} onChange={(e) => campo('data', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="at-hora" className="block text-xs font-medium text-slate-700">Hora</label>
                  <input id="at-hora" type="time" value={form.hora} onChange={(e) => campo('hora', e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="at-dur" className="block text-xs font-medium text-slate-700">Duração (min)</label>
                  <input id="at-dur" type="number" min={1} value={form.duracao} onChange={(e) => campo('duracao', e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label htmlFor="at-desc" className="block text-xs font-medium text-slate-700">Instruções para o técnico</label>
                <textarea id="at-desc" rows={2} value={form.descricao} onChange={(e) => campo('descricao', e.target.value)} className={INPUT} />
              </div>

              <div>
                <label htmlFor="at-relato" className="block text-xs font-medium text-slate-700">Relato do técnico</label>
                <textarea id="at-relato" rows={2} value={form.relato} onChange={(e) => campo('relato', e.target.value)} className={INPUT} />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
