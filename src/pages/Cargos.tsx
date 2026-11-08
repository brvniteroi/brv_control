import { useEffect, useState } from 'react';
import { AlertCircle, BriefcaseBusiness, Loader2, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { CATEGORIAS_CARGO, contarFuncionariosPorCargo, excluirCargo, listarCargos, rotuloCategoria, salvarCargo } from '../services/cargos';
import type { Cargo, EmployeeRole } from '../types/fsm';

const CAMPO =
  'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

/** Cadastro de cargos dos funcionários (Mecânico de Refrigeração, Ajudante...). */
export default function Cargos() {
  const { profile } = useAuth();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';
  const ehAdmin = profile?.role === 'admin';

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [uso, setUso] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cargo | 'novo' | null>(null);

  const carregar = async () => {
    setErro(null);
    try {
      const [lista, contagem] = await Promise.all([listarCargos(), contarFuncionariosPorCargo()]);
      setCargos(lista);
      setUso(contagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os cargos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeGerenciar) return;
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [podeGerenciar]);

  const excluir = async (c: Cargo) => {
    if (!window.confirm(`Excluir o cargo "${c.nome}"?`)) return;
    try {
      await excluirCargo(c.id);
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
        <p className="mt-1 text-xs text-slate-500">Cargos são gerenciados pelo escritório.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cargos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Escolhidos no cadastro do funcionário. A categoria define quem aparece na linha do tempo e na agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando('novo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} /> Novo cargo
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
      ) : cargos.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <BriefcaseBusiness size={28} className="text-blue-600" />
          <h3 className="mt-3 text-base font-bold text-slate-800">Nenhum cargo cadastrado</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Funcionários</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargos.map((c) => {
                const n = uso.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className={c.ativo ? '' : 'text-slate-400'}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{c.nome}</div>
                      {c.descricao && <div className="text-xs text-slate-500">{c.descricao}</div>}
                    </td>
                    <td className="px-4 py-3">{rotuloCategoria(c.categoria)}</td>
                    <td className="px-4 py-3">{n}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          c.ativo ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditando(c)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Editar ${c.nome}`}
                      >
                        <Pencil size={15} />
                      </button>
                      {ehAdmin && n === 0 && (
                        <button
                          type="button"
                          onClick={() => excluir(c)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Excluir ${c.nome}`}
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
        <EditarCargoModal
          cargo={editando === 'novo' ? null : editando}
          funcionarios={editando === 'novo' ? 0 : (uso.get(editando.id) ?? 0)}
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

function EditarCargoModal({
  cargo, funcionarios, aoFechar, aoSalvar,
}: { cargo: Cargo | null; funcionarios: number; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(cargo?.nome ?? '');
  const [categoria, setCategoria] = useState<EmployeeRole>(cargo?.categoria ?? 'tecnico');
  const [descricao, setDescricao] = useState(cargo?.descricao ?? '');
  const [ativo, setAtivo] = useState(cargo?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudouCategoria = !!cargo && funcionarios > 0 && categoria !== cargo.categoria;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome.');
    setSalvando(true);
    setErro(null);
    try {
      await salvarCargo(cargo?.id ?? null, { nome, categoria, descricao, ativo });
      aoSalvar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={aoFechar}>
      <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-800">{cargo ? 'Editar cargo' : 'Novo cargo'}</h3>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="cg-nome" className="block text-xs font-semibold text-slate-700">Nome do cargo</label>
            <input id="cg-nome" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mecânico de Refrigeração" className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-700">Categoria</span>
            <div className="mt-1.5 space-y-1.5">
              {CATEGORIAS_CARGO.map((c) => (
                <label
                  key={c.valor}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                    categoria === c.valor ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input type="radio" name="categoria" checked={categoria === c.valor} onChange={() => setCategoria(c.valor)} className="mt-1" />
                  <span>
                    <span className="block font-semibold text-slate-800">{c.rotulo}</span>
                    <span className="block text-xs text-slate-500">{c.explicacao}</span>
                  </span>
                </label>
              ))}
            </div>
            {mudouCategoria && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Os {funcionarios} funcionário(s) deste cargo mudam de categoria junto. Se saírem de "Atende em campo", deixam de aparecer na linha do tempo.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="cg-desc" className="block text-xs font-semibold text-slate-700">Descrição (opcional)</label>
            <input id="cg-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Ativo (aparece na escolha do cargo do funcionário)
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
