import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Plus,
  Power,
  Search,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { listarModelos } from '../services/formularios';
import type { ModeloFormulario } from '../types/formularios';
import { formatarDataHora } from '../utils/ordens';
import EditorModelo from '../components/formularios/EditorModelo';

export default function Formularios() {
  const { profile } = useAuth();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';

  const [modelos, setModelos] = useState<ModeloFormulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // Modelo selecionado para edição ou 'novo'
  const [modeloSelecionado, setModeloSelecionado] = useState<
    ModeloFormulario | 'novo' | null
  >(null);

  const recarregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarModelos(false);
      setModelos(lista);
    } catch (err) {
      console.error('Erro ao recarregar modelos de formulário:', err);
      setErro('Não foi possível carregar a lista de modelos de formulário.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeGerenciar) return;

    let ativo = true;

    listarModelos(false)
      .then((lista) => {
        if (!ativo) return;
        setModelos(lista);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error('Erro ao carregar modelos de formulário:', err);
        setErro('Não foi possível carregar a lista de modelos de formulário.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [podeGerenciar]);

  // Bloqueio de acesso para técnicos
  if (!podeGerenciar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          O construtor e gerenciador de modelos de formulário é restrito aos perfis de escritório e administradores.
        </p>
      </div>
    );
  }

  // Se estiver editando ou criando um novo modelo
  if (modeloSelecionado) {
    return (
      <EditorModelo
        modelo={modeloSelecionado === 'novo' ? null : modeloSelecionado}
        onFechar={() => setModeloSelecionado(null)}
        onSalvo={() => {
          setModeloSelecionado(null);
          recarregar();
        }}
      />
    );
  }

  const modelosFiltrados = modelos.filter((m) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (
      m.name.toLowerCase().includes(termo) ||
      (m.description && m.description.toLowerCase().includes(termo))
    );
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Modelos de Formulários
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie os questionários de campo, relatórios e checklists de instalação e manutenção.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModeloSelecionado('novo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Novo modelo
        </button>
      </div>

      {/* Barra de Busca */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo por nome ou descrição..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Modelos */}
      {erro ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={recarregar}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-64 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="text-xs font-medium">Carregando modelos de formulário...</span>
          </div>
        </div>
      ) : modelosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <FileText size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {busca ? 'Nenhum modelo encontrado' : 'Nenhum modelo cadastrado'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca
              ? `Não encontramos nenhum modelo com o termo "${busca}".`
              : 'Crie seu primeiro modelo de formulário para padronizar vistorias e orçamentos em campo.'}
          </p>
          <button
            type="button"
            onClick={() => setModeloSelecionado('novo')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus size={16} />
            Cadastrar primeiro modelo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modelosFiltrados.map((m) => (
            <div
              key={m.id}
              onClick={() => setModeloSelecionado(m)}
              className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                    {m.name}
                  </h3>
                  {m.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 size={10} /> Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      <Power size={10} /> Inativo
                    </span>
                  )}
                </div>

                {m.description && (
                  <p className="line-clamp-2 text-xs text-slate-500">{m.description}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                <span>{m.questions?.length || 0} perguntas</span>
                <span>Atualizado em {formatarDataHora(m.updated_at || m.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
