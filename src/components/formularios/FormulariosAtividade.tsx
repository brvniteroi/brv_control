import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import {
  abrirFormulario,
  listarFormulariosDaAtividade,
  listarModelos,
} from '../../services/formularios';
import { listarEquipamentos } from '../../services/equipamentos';
import type { FormularioRespondido, ModeloFormulario } from '../../types/formularios';
import type { EquipamentoComCliente } from '../../services/equipamentos';
import { formatarDataHora } from '../../utils/ordens';
import PreencherFormulario from './PreencherFormulario';

interface FormulariosAtividadeProps {
  taskId: string;
  clienteId?: string;
}

export default function FormulariosAtividade({
  taskId,
  clienteId,
}: FormulariosAtividadeProps) {
  const [formularios, setFormularios] = useState<FormularioRespondido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal para adicionar formulário
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [modelos, setModelos] = useState<ModeloFormulario[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoComCliente[]>([]);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('');
  const [equipamentoSelecionadoId, setEquipamentoSelecionadoId] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  // Formulário aberto para preenchimento
  const [formularioAberto, setFormularioAberto] = useState<FormularioRespondido | null>(null);

  const recarregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarFormulariosDaAtividade(taskId);
      setFormularios(lista);
    } catch (err) {
      console.error('Erro ao recarregar formulários da atividade:', err);
      setErro('Não foi possível carregar os formulários desta atividade.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;

    listarFormulariosDaAtividade(taskId)
      .then((lista) => {
        if (!ativo) return;
        setFormularios(lista);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error('Erro ao carregar formulários da atividade:', err);
        setErro('Não foi possível carregar os formulários desta atividade.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [taskId]);

  const abrirModalAdicionar = async () => {
    setErroNovo(null);
    setModeloSelecionadoId('');
    setEquipamentoSelecionadoId('');
    setModalAdicionarAberto(true);

    // Carrega modelos ativos e equipamentos do cliente em paralelo
    try {
      const promessas: [Promise<ModeloFormulario[]>, Promise<EquipamentoComCliente[]>] = [
        listarModelos(true),
        clienteId ? listarEquipamentos('', 'ativos', 0, clienteId).then((r) => r.itens) : Promise.resolve([]),
      ];

      const [modelosAtivos, equipamentosCliente] = await Promise.all(promessas);
      setModelos(modelosAtivos);
      setEquipamentos(equipamentosCliente);
      if (modelosAtivos.length > 0) {
        setModeloSelecionadoId(modelosAtivos[0].id);
      }
    } catch (err) {
      console.error('Erro ao preparar adição de formulário:', err);
      setErroNovo('Não foi possível carregar os modelos disponíveis.');
    }
  };

  const handleCriarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeloSelecionadoId) {
      setErroNovo('Selecione um modelo de formulário.');
      return;
    }

    setSalvandoNovo(true);
    setErroNovo(null);

    try {
      const novo = await abrirFormulario(
        taskId,
        modeloSelecionadoId,
        equipamentoSelecionadoId || null,
      );

      setModalAdicionarAberto(false);
      await recarregar();

      // Abre imediatamente para preenchimento
      setFormularioAberto(novo);
    } catch (err) {
      console.error('Erro ao abrir formulário:', err);
      setErroNovo(
        err instanceof Error ? err.message : 'Não foi possível adicionar o formulário.',
      );
    } finally {
      setSalvandoNovo(false);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {/* Cabeçalho da Seção de Formulários */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <FileText size={14} className="text-blue-600" />
          <span>Formulários de campo</span>
          {formularios.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
              {formularios.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={abrirModalAdicionar}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-2xs transition hover:bg-blue-50"
        >
          <Plus size={13} />
          Adicionar formulário
        </button>
      </div>

      {/* Estados da Lista */}
      {carregando ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin text-blue-600" />
          <span>Carregando formulários...</span>
        </div>
      ) : erro ? (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <span>{erro}</span>
          <button
            type="button"
            onClick={recarregar}
            className="font-semibold underline hover:no-underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : formularios.length === 0 ? (
        <p className="mt-2 text-xs italic text-slate-400">
          Nenhum formulário nesta atividade.
        </p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          {formularios.map((form) => {
            const preenchido = form.status === 'preenchido';

            return (
              <div
                key={form.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/60 px-3 py-2 text-xs transition hover:border-slate-300 hover:bg-white"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-800 truncate">
                      {form.template_name}
                    </span>
                    {preenchido ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 size={10} />
                        Preenchido em {formatarDataHora(form.filled_at || form.updated_at)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        <Clock size={10} />
                        Pendente
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormularioAberto(form)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-blue-600"
                >
                  Abrir
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Adicionar Formulário */}
      {modalAdicionarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Adicionar formulário à atividade
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAdicionarAberto(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriarFormulario} className="mt-4 space-y-4">
              {erroNovo && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{erroNovo}</span>
                </div>
              )}

              {/* Seletor do Modelo */}
              <div>
                <label
                  htmlFor="sel-modelo"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Modelo de formulário *
                </label>
                {modelos.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Nenhum modelo ativo cadastrado no sistema.
                  </p>
                ) : (
                  <select
                    id="sel-modelo"
                    value={modeloSelecionadoId}
                    onChange={(e) => setModeloSelecionadoId(e.target.value)}
                    required
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.description ? ` (${m.description})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Seletor Opcional de Equipamento */}
              {equipamentos.length > 0 && (
                <div>
                  <label
                    htmlFor="sel-equip"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Equipamento vinculado (opcional)
                  </label>
                  <select
                    id="sel-equip"
                    value={equipamentoSelecionadoId}
                    onChange={(e) => setEquipamentoSelecionadoId(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Nenhum equipamento específico</option>
                    {equipamentos.map((eq) => {
                      const det = [eq.brand, eq.model].filter(Boolean).join(' ');
                      const loc = eq.location ? ` — ${eq.location}` : '';
                      return (
                        <option key={eq.id} value={eq.id}>
                          {eq.category}
                          {det ? ` (${det})` : ''}
                          {loc}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAdicionarAberto(false)}
                  disabled={salvandoNovo}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovo || modelos.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvandoNovo ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Adicionando...</span>
                    </>
                  ) : (
                    <span>Adicionar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Tela de Preenchimento do Formulário */}
      {formularioAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50">
          <PreencherFormulario
            formulario={formularioAberto}
            onFechar={() => {
              setFormularioAberto(null);
              recarregar();
            }}
            onSalvo={(atualizado) => {
              setFormularioAberto(atualizado);
              recarregar();
            }}
          />
        </div>
      )}
    </div>
  );
}
