import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Lock, Pencil, Plus, Tag as IconeEtiqueta, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import {
  COR_PADRAO_ETIQUETA,
  atualizarEtiqueta,
  contarUsoEtiquetas,
  criarEtiqueta,
  excluirEtiqueta,
  listarEtiquetas,
  ordenarEtiquetas,
} from '../services/etiquetas';
import type { Tag } from '../types/fsm';
import EtiquetaChip from '../components/etiquetas/EtiquetaChip';
import SeletorCor from '../components/etiquetas/SeletorCor';

const CAMPO =
  'block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

/** Cadastro de etiquetas de OS (ex.: "Aguardando pagamento", "Pago"). */
export default function Etiquetas() {
  const { profile } = useAuth();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';
  const ehAdmin = profile?.role === 'admin';

  const [etiquetas, setEtiquetas] = useState<Tag[]>([]);
  const [uso, setUso] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Tag | 'nova' | null>(null);

  const carregar = async () => {
    setErro(null);
    try {
      const [lista, contagem] = await Promise.all([listarEtiquetas(), contarUsoEtiquetas()]);
      setEtiquetas(ordenarEtiquetas(lista));
      setUso(contagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as etiquetas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeGerenciar) return;
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [podeGerenciar]);

  const excluir = async (t: Tag) => {
    const n = uso.get(t.id) ?? 0;
    const aviso = n > 0 ? `\n\nEla está em ${n} OS e será retirada delas.` : '';
    if (!window.confirm(`Excluir a etiqueta "${t.name}"?${aviso}`)) return;
    try {
      await excluirEtiqueta(t.id);
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
        <p className="mt-1 text-xs text-slate-500">Etiquetas são gerenciadas pelo escritório.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Etiquetas</h1>
          <p className="mt-1 text-xs text-slate-500">
            Marcam a OS na lista, na linha do tempo e no calendário. Ex.: "Aguardando pagamento", "Pago".
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando('nova')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} /> Nova etiqueta
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <AlertCircle size={16} className="shrink-0" /> {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex h-48 items-center justify-center text-slate-500">
          <Loader2 size={22} className="animate-spin text-blue-600" />
        </div>
      ) : etiquetas.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <IconeEtiqueta size={28} className="text-blue-600" />
          <h3 className="mt-3 text-base font-bold text-slate-800">Nenhuma etiqueta cadastrada</h3>
          <p className="mt-1 text-xs text-slate-500">Crie aqui ou direto na OS, em "Adicionar etiqueta".</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <ul className="divide-y divide-slate-100">
            {etiquetas.map((t) => {
              const n = uso.get(t.id) ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1"><EtiquetaChip etiqueta={t} /></span>
                  <span className="text-xs text-slate-500">{n === 0 ? 'Sem OS' : `${n} OS`}</span>
                  <button
                    type="button"
                    onClick={() => setEditando(t)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Editar ${t.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  {ehAdmin && (
                    <button
                      type="button"
                      onClick={() => excluir(t)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Excluir ${t.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editando && (
        <EditarEtiquetaModal
          etiqueta={editando === 'nova' ? null : editando}
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

function EditarEtiquetaModal({
  etiqueta, aoFechar, aoSalvar,
}: { etiqueta: Tag | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(etiqueta?.name ?? '');
  const [cor, setCor] = useState(etiqueta?.color ?? COR_PADRAO_ETIQUETA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return setErro('Informe o nome.');
    setSalvando(true);
    setErro(null);
    try {
      if (etiqueta) await atualizarEtiqueta(etiqueta.id, nome, cor);
      else await criarEtiqueta(nome, cor);
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
          <h3 className="text-base font-bold text-slate-800">{etiqueta ? 'Editar etiqueta' : 'Nova etiqueta'}</h3>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="et-nome" className="block text-xs font-semibold text-slate-700">Nome</label>
            <input id="et-nome" value={nome} maxLength={40} autoFocus onChange={(e) => setNome(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-700">Cor</span>
            <div className="mt-1.5"><SeletorCor cor={cor} onMudar={setCor} /></div>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-700">Prévia</span>
            <div className="mt-1.5"><EtiquetaChip etiqueta={{ name: nome.trim() || 'Etiqueta', color: cor }} /></div>
          </div>
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
