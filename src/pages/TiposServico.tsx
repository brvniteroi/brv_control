import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Lock, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { listarTipos } from '../services/ordens';
import { contarUsoTipos, excluirTipoServico, salvarTipoServico } from '../services/tiposServico';
import type { ServiceType } from '../types/fsm';

const CAMPO =
  'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

const formatarDuracao = (min: number | null) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : null, m ? `${m}min` : null].filter(Boolean).join(' ');
};

/** Cadastro dos tipos de serviço da OS (instalação, manutenção...). */
export default function TiposServico() {
  const { profile } = useAuth();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';
  const ehAdmin = profile?.role === 'admin';

  const [tipos, setTipos] = useState<ServiceType[]>([]);
  const [uso, setUso] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<ServiceType | 'novo' | null>(null);

  const carregar = async () => {
    setErro(null);
    try {
      const [lista, contagem] = await Promise.all([listarTipos(), contarUsoTipos()]);
      setTipos(lista);
      setUso(contagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os tipos de serviço.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeGerenciar) return;
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [podeGerenciar]);

  const excluir = async (t: ServiceType) => {
    if (!window.confirm(`Excluir o tipo "${t.name}"?`)) return;
    try {
      await excluirTipoServico(t.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  if (!podeGerenciar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <Lock size={24} className="text-amber-600" />
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h2>
        <p className="mt-1 text-xs text-slate-500">Tipos de serviço são gerenciados pelo escritório.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tipos de Serviço</h1>
          <p className="mt-1 text-xs text-slate-500">
            Escolhidos ao criar a OS. A duração padrão já vem preenchida na nova atividade.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando('novo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} /> Novo tipo
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <AlertCircle size={16} className="shrink-0" /> {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={22} className="animate-spin text-blue-600" />
        </div>
      ) : tipos.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <Wrench size={28} className="text-blue-600" />
          <h3 className="mt-3 text-base font-bold text-slate-800">Nenhum tipo cadastrado</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Duração padrão</th>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipos.map((t) => {
                const n = uso.get(t.id) ?? 0;
                return (
                  <tr key={t.id} className={t.active ? '' : 'text-slate-400'}>
                    <td className="px-4 py-3 font-semibold">{t.name}</td>
                    <td className="px-4 py-3">{formatarDuracao(t.default_duration_minutes)}</td>
                    <td className="px-4 py-3">{n}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          t.active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditando(t)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Editar ${t.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      {ehAdmin && n === 0 && (
                        <button
                          type="button"
                          onClick={() => excluir(t)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Excluir ${t.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <EditarTipoModal
          tipo={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function EditarTipoModal({
  tipo, aoFechar, aoSalvar,
}: { tipo: ServiceType | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(tipo?.name ?? '');
  const [horas, setHoras] = useState(tipo?.default_duration_minutes ? String(Math.floor(tipo.default_duration_minutes / 60)) : '');
  const [minutos, setMinutos] = useState(tipo?.default_duration_minutes ? String(tipo.default_duration_minutes % 60) : '');
  const [ativo, setAtivo] = useState(tipo?.active ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome.');
    const total = (Number(horas) || 0) * 60 + (Number(minutos) || 0);
    setSalvando(true);
    setErro(null);
    try {
      await salvarTipoServico(tipo?.id ?? null, { name: nome, default_duration_minutes: total > 0 ? total : null, active: ativo });
      aoSalvar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={aoFechar}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{tipo ? 'Editar tipo de serviço' : 'Novo tipo de serviço'}</h3>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="ts-nome" className="block text-xs font-semibold text-slate-700">Nome</label>
            <input id="ts-nome" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-700">Duração padrão (opcional)</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="number" min={0} value={horas} onChange={(e) => setHoras(e.target.value)} className={`${CAMPO} w-20`} aria-label="Horas" />
              <span className="text-xs text-slate-500">h</span>
              <input type="number" min={0} max={59} value={minutos} onChange={(e) => setMinutos(e.target.value)} className={`${CAMPO} w-20`} aria-label="Minutos" />
              <span className="text-xs text-slate-500">min</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Ativo (aparece ao criar OS e no portal do cliente)
          </label>
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={aoFechar} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
