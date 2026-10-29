import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import {
  listarColaboradores,
  listarPerfis,
  salvarColaborador,
  type ColaboradorComLogin,
  type PerfilComColaborador,
} from '../../services/equipe';
import type { EmployeeRole } from '../../types/fsm';
import { formatarTelefone } from '../../utils/telefone';

const FUNCOES_COLABORADOR: { valor: EmployeeRole; rotulo: string }[] = [
  { valor: 'tecnico', rotulo: 'Técnico' },
  { valor: 'auxiliar', rotulo: 'Auxiliar' },
  { valor: 'supervisor', rotulo: 'Supervisor' },
  { valor: 'administrativo', rotulo: 'Administrativo' },
];

const INPUT =
  'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

interface Formulario {
  id?: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  email: string;
  timeline_color: string;
  active: boolean;
  profile_id: string;
}

const NOVO: Formulario = {
  name: '',
  role: 'tecnico',
  phone: '',
  email: '',
  timeline_color: '#2563EB',
  active: true,
  profile_id: '',
};

export default function ColaboradoresTab() {
  const [lista, setLista] = useState<ColaboradorComLogin[]>([]);
  const [perfis, setPerfis] = useState<PerfilComColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [form, setForm] = useState<Formulario | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([listarColaboradores(), listarPerfis().catch(() => [])]);
      setLista(c);
      setPerfis(p);
      setErro(null);
    } catch (e) {
      console.error('Erro ao listar colaboradores:', e);
      setErro('Não foi possível carregar os colaboradores.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial (adiada um instante: o efeito não deve atualizar estado de forma síncrona)
  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const campo = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [chave]: valor } : f));

  const abrirEdicao = (c: ColaboradorComLogin) => {
    setErroForm(null);
    setForm({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: formatarTelefone(c.phone),
      email: c.email ?? '',
      timeline_color: c.timeline_color,
      active: c.active,
      profile_id: c.profile_id ?? '',
    });
  };

  const handleSalvar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) return setErroForm('Informe o nome.');
    setSalvando(true);
    setErroForm(null);
    try {
      await salvarColaborador({ ...form, profile_id: form.profile_id || null });
      setForm(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao salvar colaborador:', err);
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar o colaborador.');
    } finally {
      setSalvando(false);
    }
  };

  const visiveis = lista.filter((c) => (filtro === 'todos' ? true : filtro === 'ativos' ? c.active : !c.active));
  // Logins ainda livres, mais o do próprio colaborador em edição
  const loginsDisponiveis = perfis.filter((p) => !p.colaborador || p.colaborador.id === form?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['ativos', 'inativos', 'todos'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filtro === f ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setErroForm(null);
            setForm(NOVO);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Novo colaborador
        </button>
      </div>

      {erro ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erro}</p>
      ) : carregando ? (
        <p className="py-10 text-center text-xs text-slate-400">Carregando colaboradores...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Colaborador</th>
                  <th className="px-5 py-3.5">Função</th>
                  <th className="px-5 py-3.5">Contato</th>
                  <th className="px-5 py-3.5">Login</th>
                  <th className="px-5 py-3.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhum colaborador neste filtro.</td>
                  </tr>
                )}
                {visiveis.map((c) => (
                  <tr key={c.id} onClick={() => abrirEdicao(c)} className="cursor-pointer transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.timeline_color }} />
                        <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{FUNCOES_COLABORADOR.find((f) => f.valor === c.role)?.rotulo ?? c.role}</td>
                    <td className="px-5 py-4">
                      <div>{c.phone ? formatarTelefone(c.phone) : <span className="text-slate-400">—</span>}</div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>
                    <td className="px-5 py-4">
                      {c.profile ? c.profile.email : <span className="text-slate-400">Sem login</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          c.active ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">{form.id ? 'Editar colaborador' : 'Novo colaborador'}</h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-3.5">
              {erroForm && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erroForm}</div>
              )}

              <div>
                <label htmlFor="co-nome" className="block text-xs font-medium text-slate-700">Nome *</label>
                <input id="co-nome" type="text" value={form.name} onChange={(e) => campo('name', e.target.value)} className={INPUT} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="co-funcao" className="block text-xs font-medium text-slate-700">Função</label>
                  <select id="co-funcao" value={form.role} onChange={(e) => campo('role', e.target.value as EmployeeRole)} className={INPUT}>
                    {FUNCOES_COLABORADOR.map((f) => (
                      <option key={f.valor} value={f.valor}>{f.rotulo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="co-cor" className="block text-xs font-medium text-slate-700">Cor na linha do tempo</label>
                  <input
                    id="co-cor"
                    type="color"
                    value={form.timeline_color}
                    onChange={(e) => campo('timeline_color', e.target.value.toUpperCase())}
                    className="mt-1 block h-[38px] w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="co-tel" className="block text-xs font-medium text-slate-700">Telefone</label>
                  <input id="co-tel" type="text" value={form.phone} onChange={(e) => campo('phone', formatarTelefone(e.target.value))} placeholder="(21) 99999-9999" className={INPUT} />
                </div>
                <div>
                  <label htmlFor="co-email" className="block text-xs font-medium text-slate-700">E-mail</label>
                  <input id="co-email" type="email" value={form.email} onChange={(e) => campo('email', e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label htmlFor="co-login" className="block text-xs font-medium text-slate-700">Login de acesso ao app</label>
                <select id="co-login" value={form.profile_id} onChange={(e) => campo('profile_id', e.target.value)} className={INPUT}>
                  <option value="">Sem login (só cadastro)</option>
                  {loginsDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Para criar um login novo, use a aba Usuários. Com o login ligado, o técnico vê só as próprias atividades.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="co-ativo"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => campo('active', e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="co-ativo" className="text-xs text-slate-700">
                  Ativo (aparece na linha do tempo e na escolha do técnico)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
