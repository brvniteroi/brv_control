import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  User,
} from 'lucide-react';
import { listarFormulariosDaOrdem } from '../../services/formularios';
import type { FormularioRespondido } from '../../types/formularios';
import { formatarDataHora } from '../../utils/ordens';
import VisualizarFormulario from './VisualizarFormulario';
import PreencherFormulario from './PreencherFormulario';

interface FormulariosDaOrdemProps {
  ordemId: string;
  ordemNumero: number;
  clienteNome?: string;
  tecnicosNomesPorTask?: Record<string, string>;
}

export default function FormulariosDaOrdem({
  ordemId,
  ordemNumero,
  clienteNome,
  tecnicosNomesPorTask = {},
}: FormulariosDaOrdemProps) {
  const [formularios, setFormularios] = useState<FormularioRespondido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário selecionado para visualização/impressão ou edição
  const [formularioVisualizando, setFormularioVisualizando] =
    useState<FormularioRespondido | null>(null);
  const [formularioEditando, setFormularioEditando] =
    useState<FormularioRespondido | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarFormulariosDaOrdem(ordemId);
      setFormularios(lista);
    } catch (err) {
      console.error('Erro ao listar formulários da ordem:', err);
      setErro('Não foi possível carregar os formulários desta OS.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;

    listarFormulariosDaOrdem(ordemId)
      .then((lista) => {
        if (!ativo) return;
        setFormularios(lista);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error('Erro ao listar formulários da ordem:', err);
        setErro('Não foi possível carregar os formulários desta OS.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [ordemId]);

  if (carregando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span>Carregando formulários da OS...</span>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
        <div className="flex items-center justify-between">
          <span>{erro}</span>
          <button
            type="button"
            onClick={carregar}
            className="font-semibold underline hover:no-underline"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (formularios.length === 0) {
    return null; // Se não tiver formulários na OS, não polui a tela da OS
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileText size={17} />
          </div>
          <div>
            <h2 className="text-base font-bold">Formulários Preenchidos</h2>
            <p className="text-xs text-slate-500">
              Checklists, relatórios e laudos técnicos registrados nas atividades desta OS.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {formularios.length}
        </span>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {formularios.map((form) => {
          const preenchido = form.status === 'preenchido';
          const nomeTecnico = tecnicosNomesPorTask[form.task_id];

          return (
            <div
              key={form.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {form.template_name}
                  </span>
                  {preenchido ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 size={11} />
                      Preenchido em {formatarDataHora(form.filled_at || form.updated_at)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      <Clock size={11} />
                      Rascunho
                    </span>
                  )}
                </div>

                {nomeTecnico && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <User size={12} className="text-slate-400" />
                    <span>Técnico: {nomeTecnico}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormularioVisualizando(form)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-600"
                >
                  <Eye size={14} />
                  Visualizar / Imprimir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Visualização e Impressão */}
      {formularioVisualizando && (
        <VisualizarFormulario
          formulario={formularioVisualizando}
          clienteNome={clienteNome}
          ordemNumero={ordemNumero}
          tecnicoNome={tecnicosNomesPorTask[formularioVisualizando.task_id]}
          onFechar={() => setFormularioVisualizando(null)}
          onEditar={() => {
            const f = formularioVisualizando;
            setFormularioVisualizando(null);
            setFormularioEditando(f);
          }}
        />
      )}

      {/* Modal de Edição (se o operador clicar em editar) */}
      {formularioEditando && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
          <PreencherFormulario
            formulario={formularioEditando}
            onFechar={() => {
              setFormularioEditando(null);
              carregar();
            }}
            onSalvo={() => {
              setFormularioEditando(null);
              carregar();
            }}
          />
        </div>
      )}
    </div>
  );
}
