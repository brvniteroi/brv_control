import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Gauge,
  Info,
  ListTodo,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import FaixaDadosDemo from '../components/pmoc/FaixaDadosDemo';
import {
  listarModelosDeTarefa,
  salvarModeloDeTarefa,
} from '../components/pmoc/fonteDeDados';
import {
  CAMPOS_MEDICAO_PMOC,
  PERIODICIDADES_PMOC,
  TIPOS_EQUIPAMENTO_SUGERIDOS,
} from '../components/pmoc/regrasPmoc';
import { useAuth } from '../contexts/useAuth';
import type {
  PmocMeasurementKey,
  PmocPeriodicity,
  PmocTaskTemplate,
  PmocTaskTemplateRow,
} from '../types/pmoc';

interface RascunhoModelo {
  id?: string;
  equipment_type: string;
  description: string;
  tasks: PmocTaskTemplateRow[];
}

function clonarParaRascunho(modelo: PmocTaskTemplate): RascunhoModelo {
  return {
    id: modelo.id,
    equipment_type: modelo.equipment_type,
    description: modelo.description ?? '',
    tasks: modelo.tasks
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t, idx) => ({
        ...t,
        measurement_fields: [...t.measurement_fields],
        sort_order: idx + 1,
      })),
  };
}

function criarTarefaEmBranco(ordem: number): PmocTaskTemplateRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    periodicity: 'mensal',
    relative_start_month: 1,
    requires_measurement: false,
    measurement_fields: [],
    sort_order: ordem,
  };
}

const INPUT =
  'block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function PmocModelo() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';

  const [modelos, setModelos] = useState<PmocTaskTemplate[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [rascunho, setRascunho] = useState<RascunhoModelo | null>(null);
  const [buscaTarefa, setBuscaTarefa] = useState('');
  const [temAlteracoes, setTemAlteracoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!podeGerenciar) return;
    let ativo = true;

    listarModelosDeTarefa()
      .then((lista) => {
        if (!ativo) return;
        setModelos(lista);
        if (lista.length > 0) {
          setRascunho(clonarParaRascunho(lista[0]));
        }
      })
      .catch((e) => {
        if (!ativo) return;
        setErroCarregar(
          e instanceof Error ? e.message : 'Não foi possível carregar os modelos de tarefas.',
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [podeGerenciar]);

  const tentarCarregarNovamente = () => {
    setCarregando(true);
    setErroCarregar(null);
    listarModelosDeTarefa()
      .then((lista) => {
        setModelos(lista);
        if (lista.length > 0) {
          setRascunho(clonarParaRascunho(lista[0]));
        }
      })
      .catch((e) =>
        setErroCarregar(
          e instanceof Error ? e.message : 'Não foi possível carregar os modelos de tarefas.',
        ),
      )
      .finally(() => setCarregando(false));
  };

  // Aviso ao fechar a aba do navegador com edições pendentes
  useEffect(() => {
    if (!temAlteracoes) return;
    const aoSair = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [temAlteracoes]);

  const confirmarDescarte = useCallback((): boolean => {
    if (!temAlteracoes) return true;
    return window.confirm(
      'Existem alterações não salvas neste modelo de tarefas. Deseja sair sem salvar?',
    );
  }, [temAlteracoes]);

  const selecionarModelo = (modelo: PmocTaskTemplate) => {
    if (rascunho?.id === modelo.id) return;
    if (!confirmarDescarte()) return;
    setRascunho(clonarParaRascunho(modelo));
    setBuscaTarefa('');
    setTemAlteracoes(false);
    setErroSalvar(null);
    setMensagemSucesso(null);
  };

  const iniciarNovoTipo = (copiarDoAtual: boolean) => {
    if (!confirmarDescarte()) return;
    const tiposExistentes = new Set(modelos.map((m) => m.equipment_type.toLowerCase()));
    const sugestaoLivre =
      TIPOS_EQUIPAMENTO_SUGERIDOS.find((t) => !tiposExistentes.has(t.toLowerCase())) ?? '';

    const tarefasIniciais =
      copiarDoAtual && rascunho && rascunho.tasks.length > 0
        ? rascunho.tasks.map((t, idx) => ({
            ...t,
            id: crypto.randomUUID(),
            measurement_fields: [...t.measurement_fields],
            sort_order: idx + 1,
          }))
        : [criarTarefaEmBranco(1)];

    setRascunho({
      id: undefined,
      equipment_type: sugestaoLivre,
      description: '',
      tasks: tarefasIniciais,
    });
    setBuscaTarefa('');
    setTemAlteracoes(true);
    setErroSalvar(null);
    setMensagemSucesso(null);
  };

  const atualizarRascunho = (parcial: Partial<RascunhoModelo>) => {
    setRascunho((atual) => (atual ? { ...atual, ...parcial } : atual));
    setTemAlteracoes(true);
    setMensagemSucesso(null);
  };

  const atualizarTarefa = (idTarefa: string, parcial: Partial<PmocTaskTemplateRow>) => {
    if (!rascunho) return;
    const novas = rascunho.tasks.map((t) => (t.id === idTarefa ? { ...t, ...parcial } : t));
    atualizarRascunho({ tasks: novas });
  };

  const alternarCampoMedicao = (idTarefa: string, chave: PmocMeasurementKey) => {
    if (!rascunho) return;
    const alvo = rascunho.tasks.find((t) => t.id === idTarefa);
    if (!alvo) return;
    const jaMarcado = alvo.measurement_fields.includes(chave);
    const novosCampos = jaMarcado
      ? alvo.measurement_fields.filter((c) => c !== chave)
      : [...alvo.measurement_fields, chave];
    atualizarTarefa(idTarefa, {
      requires_measurement: true,
      measurement_fields: novosCampos,
    });
  };

  const adicionarTarefa = () => {
    if (!rascunho) return;
    const nova = criarTarefaEmBranco(rascunho.tasks.length + 1);
    atualizarRascunho({ tasks: [...rascunho.tasks, nova] });
    setBuscaTarefa('');
  };

  const removerTarefa = (idTarefa: string) => {
    if (!rascunho) return;
    const restantes = rascunho.tasks
      .filter((t) => t.id !== idTarefa)
      .map((t, idx) => ({ ...t, sort_order: idx + 1 }));
    atualizarRascunho({ tasks: restantes });
  };

  const moverTarefa = (indice: number, direcao: -1 | 1) => {
    if (!rascunho) return;
    const destino = indice + direcao;
    if (destino < 0 || destino >= rascunho.tasks.length) return;
    const copia = [...rascunho.tasks];
    const [movida] = copia.splice(indice, 1);
    copia.splice(destino, 0, movida);
    atualizarRascunho({
      tasks: copia.map((t, idx) => ({ ...t, sort_order: idx + 1 })),
    });
  };

  const tarefasVisiveis = useMemo(() => {
    if (!rascunho) return [];
    const termo = buscaTarefa.trim().toLowerCase();
    if (!termo) return rascunho.tasks;
    return rascunho.tasks.filter((t) => t.description.toLowerCase().includes(termo));
  }, [buscaTarefa, rascunho]);

  const handleSalvar = async () => {
    if (!rascunho || salvando) return;
    setErroSalvar(null);
    setMensagemSucesso(null);

    const tipoLimpo = rascunho.equipment_type.trim();
    if (!tipoLimpo) {
      setErroSalvar('Informe o nome do tipo de equipamento deste modelo.');
      return;
    }

    if (rascunho.tasks.length === 0) {
      setErroSalvar('Adicione pelo menos uma tarefa preventiva ao modelo antes de salvar.');
      return;
    }

    for (let i = 0; i < rascunho.tasks.length; i++) {
      const t = rascunho.tasks[i];
      if (!t.description.trim()) {
        setErroSalvar(`Preencha a descrição da tarefa nº ${i + 1}.`);
        return;
      }
      if (t.requires_measurement && t.measurement_fields.length === 0) {
        setErroSalvar(
          `Selecione pelo menos uma grandeza de medição na tarefa nº ${i + 1} (ou desmarque "Exige medição").`,
        );
        return;
      }
    }

    setSalvando(true);
    try {
      const salvo = await salvarModeloDeTarefa({
        id: rascunho.id,
        equipment_type: tipoLimpo,
        description: rascunho.description.trim() || null,
        tasks: rascunho.tasks.map((t) => ({
          id: t.id,
          description: t.description,
          periodicity: t.periodicity,
          relative_start_month: t.relative_start_month,
          requires_measurement: t.requires_measurement,
          measurement_fields: t.requires_measurement ? t.measurement_fields : [],
        })),
      });

      const atualizados = await listarModelosDeTarefa();
      setModelos(atualizados);
      setRascunho(clonarParaRascunho(salvo));
      setTemAlteracoes(false);
      setMensagemSucesso(`Modelo "${salvo.equipment_type}" salvo com sucesso.`);
    } catch (e) {
      setErroSalvar(
        e instanceof Error ? e.message : 'Não foi possível salvar o modelo de tarefas.',
      );
    } finally {
      setSalvando(false);
    }
  };

  if (!podeGerenciar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          A configuração de modelos de tarefas do PMOC é restrita ao escritório e administração.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <FaixaDadosDemo />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => {
              if (!confirmarDescarte()) return;
              navigate('/pmoc');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar para Planos PMOC
          </button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Modelo de tarefas PMOC
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Configure o checklist preventivo padrão aplicado ao adicionar equipamentos em novos
            planos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => iniciarNovoTipo(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Plus size={15} aria-hidden="true" />
            Novo tipo
          </button>

          {rascunho && (
            <button
              type="button"
              onClick={() => iniciarNovoTipo(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Copy size={15} aria-hidden="true" />
              Duplicar modelo atual
            </button>
          )}

          <button
            type="button"
            disabled={salvando || !rascunho}
            onClick={() => void handleSalvar()}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brv-navy-light focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={15} aria-hidden="true" />
                Salvar modelo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Aviso fixo obrigatório */}
      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
        <Info size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
        <span>Alterar o modelo não muda planos já criados.</span>
      </div>

      {carregando ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
          <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Carregando modelos de tarefas...</p>
        </div>
      ) : erroCarregar ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle size={32} className="mx-auto text-rose-600" aria-hidden="true" />
          <h2 className="mt-2 text-base font-semibold text-rose-900">
            Erro ao carregar modelos de tarefas
          </h2>
          <p className="mt-1 text-sm text-rose-700">{erroCarregar}</p>
          <button
            type="button"
            onClick={tentarCarregarNovamente}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Coluna lateral: tipos de equipamento cadastrados */}
          <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs lg:self-start">
            <div className="px-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Tipos de equipamento ({modelos.length})
            </div>

            {modelos.length === 0 ? (
              <p className="px-1.5 py-4 text-xs text-slate-500">
                Nenhum modelo cadastrado ainda. Clique em &ldquo;Novo tipo&rdquo; para criar o
                primeiro.
              </p>
            ) : (
              <div className="space-y-1">
                {modelos.map((m) => {
                  const ativo = rascunho?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selecionarModelo(m)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                        ativo
                          ? 'bg-brv-navy font-semibold text-white'
                          : 'font-medium text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{m.equipment_type}</span>
                      <span
                        className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ativo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.tasks.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {rascunho && !rascunho.id && (
              <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-900">
                Novo modelo em edição:{' '}
                <span className="font-normal">
                  {rascunho.equipment_type.trim() || '(sem nome)'}
                </span>
              </div>
            )}
          </aside>

          {/* Painel principal: editor do modelo selecionado */}
          {!rascunho ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <ListTodo size={36} className="mx-auto text-slate-300" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-slate-800">
                Selecione ou crie um modelo de tarefas
              </h2>
              <button
                type="button"
                onClick={() => iniciarNovoTipo(false)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white hover:bg-brv-navy-light"
              >
                <Plus size={14} aria-hidden="true" />
                Criar modelo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {erroSalvar && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      size={16}
                      className="mt-0.5 shrink-0 text-rose-600"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{erroSalvar}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErroSalvar(null)}
                    aria-label="Fechar mensagem de erro"
                    className="rounded p-0.5 hover:bg-rose-100"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              {mensagemSucesso && (
                <div
                  role="status"
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={15}
                      className="shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{mensagemSucesso}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMensagemSucesso(null)}
                    aria-label="Fechar aviso"
                    className="rounded p-0.5 hover:bg-emerald-100"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Cabeçalho de dados do tipo de equipamento */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="pmoc-modelo-tipo"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Tipo de equipamento *
                    </label>
                    <input
                      id="pmoc-modelo-tipo"
                      type="text"
                      list="pmoc-tipos-modelo-sugeridos"
                      value={rascunho.equipment_type}
                      onChange={(e) => atualizarRascunho({ equipment_type: e.target.value })}
                      placeholder="Ex.: Split Hi-Wall, Cassete, Split Piso-Teto, VRF"
                      className={`${INPUT} mt-1.5`}
                    />
                    <datalist id="pmoc-tipos-modelo-sugeridos">
                      {TIPOS_EQUIPAMENTO_SUGERIDOS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label
                      htmlFor="pmoc-modelo-descricao"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Observação de uso (opcional)
                    </label>
                    <input
                      id="pmoc-modelo-descricao"
                      type="text"
                      value={rascunho.description}
                      onChange={(e) => atualizarRascunho({ description: e.target.value })}
                      placeholder="Ex.: Padrão para splits residenciais e comerciais até 60.000 BTUs"
                      className={`${INPUT} mt-1.5`}
                    />
                  </div>
                </div>

                {/* Busca de tarefas + botão adicionar */}
                <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search
                      size={14}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={buscaTarefa}
                      onChange={(e) => setBuscaTarefa(e.target.value)}
                      placeholder="Filtrar tarefas deste modelo..."
                      aria-label="Filtrar tarefas deste modelo"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-slate-500">
                      <strong>{rascunho.tasks.length}</strong> tarefa(s) no modelo
                    </span>
                    <button
                      type="button"
                      onClick={adicionarTarefa}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Adicionar tarefa
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista ordenada de tarefas do modelo */}
              {rascunho.tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Este modelo ainda não possui tarefas cadastradas.
                  </p>
                  <button
                    type="button"
                    onClick={adicionarTarefa}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Adicionar primeira tarefa
                  </button>
                </div>
              ) : tarefasVisiveis.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                  <p className="text-xs text-slate-500">
                    Nenhuma tarefa corresponde ao filtro &ldquo;{buscaTarefa}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBuscaTarefa('')}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Limpar busca
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tarefasVisiveis.map((tarefa) => {
                    const indiceReal = rascunho.tasks.findIndex((t) => t.id === tarefa.id);
                    const filtrando = Boolean(buscaTarefa.trim());

                    return (
                      <div
                        key={tarefa.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-colors hover:border-slate-300 sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          {/* Ordem + botões subir/descer */}
                          <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-center">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-900 px-1.5 font-mono text-xs font-bold text-white">
                              {indiceReal + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={filtrando || indiceReal === 0}
                                onClick={() => moverTarefa(indiceReal, -1)}
                                title={
                                  filtrando
                                    ? 'Limpe o filtro para reordenar'
                                    : 'Mover tarefa para cima'
                                }
                                aria-label={`Mover tarefa ${indiceReal + 1} para cima`}
                                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <ArrowUp size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={filtrando || indiceReal === rascunho.tasks.length - 1}
                                onClick={() => moverTarefa(indiceReal, 1)}
                                title={
                                  filtrando
                                    ? 'Limpe o filtro para reordenar'
                                    : 'Mover tarefa para baixo'
                                }
                                aria-label={`Mover tarefa ${indiceReal + 1} para baixo`}
                                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <ArrowDown size={13} aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          {/* Campos da tarefa */}
                          <div className="min-w-0 flex-1 space-y-3">
                            <div>
                              <label
                                htmlFor={`tarefa-desc-${tarefa.id}`}
                                className="sr-only"
                              >
                                Descrição da tarefa {indiceReal + 1}
                              </label>
                              <input
                                id={`tarefa-desc-${tarefa.id}`}
                                type="text"
                                value={tarefa.description}
                                onChange={(e) =>
                                  atualizarTarefa(tarefa.id, { description: e.target.value })
                                }
                                placeholder="Descreva a atividade preventiva..."
                                className={INPUT}
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <label
                                  htmlFor={`tarefa-per-${tarefa.id}`}
                                  className="block text-[11px] font-medium text-slate-600"
                                >
                                  Periodicidade
                                </label>
                                <select
                                  id={`tarefa-per-${tarefa.id}`}
                                  value={tarefa.periodicity}
                                  onChange={(e) =>
                                    atualizarTarefa(tarefa.id, {
                                      periodicity: e.target.value as PmocPeriodicity,
                                    })
                                  }
                                  className={`${INPUT} mt-1`}
                                >
                                  {PERIODICIDADES_PMOC.map((p) => (
                                    <option key={p.valor} value={p.valor}>
                                      {p.rotulo}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor={`tarefa-mes-${tarefa.id}`}
                                  className="block text-[11px] font-medium text-slate-600"
                                >
                                  Mês de início relativo
                                </label>
                                <select
                                  id={`tarefa-mes-${tarefa.id}`}
                                  value={tarefa.relative_start_month}
                                  onChange={(e) =>
                                    atualizarTarefa(tarefa.id, {
                                      relative_start_month: Number(e.target.value),
                                    })
                                  }
                                  className={`${INPUT} mt-1`}
                                >
                                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                                    <option key={m} value={m}>
                                      {m === 1 ? 'Mês 1 (início do plano)' : `Mês ${m}`}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-end pb-1.5">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 select-none">
                                  <input
                                    type="checkbox"
                                    checked={tarefa.requires_measurement}
                                    onChange={(e) => {
                                      const marcado = e.target.checked;
                                      atualizarTarefa(tarefa.id, {
                                        requires_measurement: marcado,
                                        measurement_fields:
                                          marcado && tarefa.measurement_fields.length === 0
                                            ? ['current_a']
                                            : marcado
                                              ? tarefa.measurement_fields
                                              : [],
                                      });
                                    }}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <Gauge size={14} className="text-blue-600" aria-hidden="true" />
                                  Exige medição numérica
                                </label>
                              </div>
                            </div>

                            {/* Seleção de quais medições exigir */}
                            {tarefa.requires_measurement && (
                              <fieldset className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                                <legend className="px-1 text-[11px] font-semibold text-blue-900">
                                  Grandezas exigidas nesta tarefa:
                                </legend>
                                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                  {CAMPOS_MEDICAO_PMOC.map((campo) => {
                                    const selecionado = tarefa.measurement_fields.includes(
                                      campo.chave,
                                    );
                                    return (
                                      <label
                                        key={campo.chave}
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-2xs select-none"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selecionado}
                                          onChange={() =>
                                            alternarCampoMedicao(tarefa.id, campo.chave)
                                          }
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>{campo.rotulo}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </fieldset>
                            )}
                          </div>

                          {/* Botão remover */}
                          <div className="flex justify-end sm:pt-0.5">
                            <button
                              type="button"
                              onClick={() => removerTarefa(tarefa.id)}
                              aria-label={`Remover tarefa ${indiceReal + 1}`}
                              title="Remover tarefa do modelo"
                              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span className="sm:hidden">Remover</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={adicionarTarefa}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white py-3 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700"
                  >
                    <Plus size={15} aria-hidden="true" />
                    Adicionar nova tarefa ao final do modelo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

