import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Info,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { salvarModelo } from '../../services/formularios';
import type { ModeloFormulario, Pergunta, TipoPergunta } from '../../types/formularios';
import { novoIdPergunta, TIPOS_PERGUNTA } from '../../utils/formularios';

interface EditorModeloProps {
  modelo?: ModeloFormulario | null;
  onFechar: () => void;
  onSalvo: (id: string) => void;
}

export default function EditorModelo({
  modelo,
  onFechar,
  onSalvo,
}: EditorModeloProps) {
  const [nome, setNome] = useState(modelo?.name || '');
  const [descricao, setDescricao] = useState(modelo?.description || '');
  const [ativo, setAtivo] = useState(modelo?.active ?? true);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(() => {
    return (
      modelo?.questions?.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
        visible_if: q.visible_if ? { ...q.visible_if, in: [...q.visible_if.in] } : undefined,
      })) || []
    );
  });

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Adicionar pergunta nova
  const handleAdicionarPergunta = () => {
    const idsExistentes = perguntas.map((p) => p.id);
    const id = novoIdPergunta('Nova pergunta', idsExistentes);

    const nova: Pergunta = {
      id,
      type: 'text',
      title: '',
      required: false,
    };

    setPerguntas((prev) => [...prev, nova]);
  };

  // Duplicar pergunta
  const handleDuplicarPergunta = (index: number) => {
    const original = perguntas[index];
    const idsExistentes = perguntas.map((p) => p.id);
    const novoId = novoIdPergunta(original.title || 'Pergunta duplicada', idsExistentes);

    const clone: Pergunta = {
      ...original,
      id: novoId,
      title: original.title ? `${original.title} (cópia)` : '',
      options: original.options ? [...original.options] : undefined,
      visible_if: original.visible_if
        ? { ...original.visible_if, in: [...original.visible_if.in] }
        : undefined,
    };

    setPerguntas((prev) => {
      const copia = [...prev];
      copia.splice(index + 1, 0, clone);
      return copia;
    });
  };

  // Reordenar pergunta (subir)
  const handleSubirPergunta = (index: number) => {
    if (index <= 0) return;
    setPerguntas((prev) => {
      const copia = [...prev];
      const temp = copia[index - 1];
      copia[index - 1] = copia[index];
      copia[index] = temp;
      return copia;
    });
  };

  // Reordenar pergunta (descer)
  const handleDescerPergunta = (index: number) => {
    if (index >= perguntas.length - 1) return;
    setPerguntas((prev) => {
      const copia = [...prev];
      const temp = copia[index + 1];
      copia[index + 1] = copia[index];
      copia[index] = temp;
      return copia;
    });
  };

  // Remover pergunta
  const handleRemoverPergunta = (index: number) => {
    const p = perguntas[index];
    if (p.title && !window.confirm(`Remover a pergunta "${p.title}"?`)) {
      return;
    }

    setPerguntas((prev) => {
      const removidoId = prev[index].id;
      // Remove a pergunta e limpa dependências de visible_if que apontavam para ela
      return prev
        .filter((_, i) => i !== index)
        .map((item) => {
          if (item.visible_if?.question === removidoId) {
            const copia = { ...item };
            delete copia.visible_if;
            return copia;
          }
          return item;
        });
    });
  };

  // Atualizar campo de uma pergunta
  const atualizarPergunta = <K extends keyof Pergunta>(
    index: number,
    campo: K,
    valor: Pergunta[K],
  ) => {
    setPerguntas((prev) => {
      const copia = [...prev];
      const p = { ...copia[index], [campo]: valor };

      // Se mudou o tipo para algo que não suporta opções, limpa
      if (campo === 'type') {
        const tipo = valor as TipoPergunta;
        if (tipo !== 'single' && tipo !== 'dropdown' && tipo !== 'multi') {
          delete p.options;
        } else if (!p.options || p.options.length === 0) {
          p.options = ['Opção 1', 'Opção 2'];
        }

        if (tipo !== 'number') {
          delete p.unit;
        }
      }

      copia[index] = p;
      return copia;
    });
  };

  // Opções para perguntas de escolha
  const handleAdicionarOpcao = (pIndex: number) => {
    setPerguntas((prev) => {
      const copia = [...prev];
      const p = copia[pIndex];
      const novasOpcoes = [...(p.options || []), `Opção ${(p.options?.length || 0) + 1}`];
      copia[pIndex] = { ...p, options: novasOpcoes };
      return copia;
    });
  };

  const handleAtualizarOpcao = (pIndex: number, oIndex: number, valor: string) => {
    setPerguntas((prev) => {
      const copia = [...prev];
      const p = copia[pIndex];
      const novasOpcoes = [...(p.options || [])];
      novasOpcoes[oIndex] = valor;
      copia[pIndex] = { ...p, options: novasOpcoes };
      return copia;
    });
  };

  const handleRemoverOpcao = (pIndex: number, oIndex: number) => {
    setPerguntas((prev) => {
      const copia = [...prev];
      const p = copia[pIndex];
      const novasOpcoes = (p.options || []).filter((_, i) => i !== oIndex);
      copia[pIndex] = { ...p, options: novasOpcoes };
      return copia;
    });
  };

  // Validação e Salvamento
  const handleSalvar = async (e?: FormEvent) => {
    e?.preventDefault();
    setErro(null);

    // Validações
    if (!nome.trim()) {
      setErro('Informe o nome do modelo de formulário.');
      return;
    }

    if (perguntas.length === 0) {
      setErro('O formulário deve ter pelo menos uma pergunta.');
      return;
    }

    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      const num = i + 1;

      if (!p.title.trim()) {
        setErro(`A pergunta ${num} deve ter um título.`);
        return;
      }

      if (p.type === 'single' || p.type === 'dropdown' || p.type === 'multi') {
        const opcoes = p.options || [];
        if (opcoes.length < 2) {
          setErro(`A pergunta "${p.title}" deve ter pelo menos 2 opções.`);
          return;
        }

        const opcoesLimpas = opcoes.map((o) => o.trim());
        if (opcoesLimpas.some((o) => o === '')) {
          setErro(`Preencha o texto de todas as opções da pergunta "${p.title}".`);
          return;
        }

        const unicas = new Set(opcoesLimpas);
        if (unicas.size !== opcoesLimpas.length) {
          setErro(`A pergunta "${p.title}" possui opções com nomes repetidos.`);
          return;
        }
      }
    }

    setSalvando(true);

    try {
      const idSalvo = await salvarModelo({
        id: modelo?.id,
        name: nome.trim(),
        description: descricao.trim() || null,
        active: ativo,
        questions: perguntas,
      });

      setSucesso(true);
      setTimeout(() => setSucesso(false), 2000);
      onSalvo(idSalvo);
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o modelo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Barra de Ações Superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 shadow-xs sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {modelo ? 'Editar Modelo de Formulário' : 'Novo Modelo de Formulário'}
            </h1>
            <p className="text-xs text-slate-500">
              Configure as perguntas e regras de exibição do checklist de campo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sucesso && (
            <span className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Check size={14} /> Salvo com sucesso!
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSalvar()}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar modelo'}
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Aviso Fixo Exigido pela Especificação */}
      <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6">
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Info size={16} className="shrink-0 text-amber-600" />
          <span>
            <strong>Aviso importante:</strong> Alterar o modelo não muda formulários já preenchidos.
            Respostas existentes preservam a cópia original das perguntas.
          </span>
        </div>
      </div>

      {erro && (
        <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        </div>
      )}

      {/* Conteúdo do Construtor */}
      <div className="mx-auto mt-6 max-w-4xl space-y-6 px-4 sm:px-6">
        {/* Bloco 1: Dados Gerais do Modelo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Informações do Modelo</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="mod-nome" className="block text-xs font-semibold text-slate-700">
                Nome do formulário *
              </label>
              <input
                id="mod-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Orçamento de Instalação, Carga de Gás, Manutenção Preventiva PMOC"
                className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="mod-desc" className="block text-xs font-semibold text-slate-700">
                Descrição ou objetivo (opcional)
              </label>
              <textarea
                id="mod-desc"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Utilizado pelo técnico na visita de orçamento para coletar metragem e fotos."
                className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Modelo ativo (visível para os técnicos adicionarem nas atividades)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Bloco 2: Lista de Perguntas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Perguntas do Formulário ({perguntas.length})
              </h2>
              <p className="text-xs text-slate-500">
                Adicione, ordene e configure as perguntas e regras condicionais.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAdicionarPergunta}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <Plus size={14} />
              Adicionar pergunta
            </button>
          </div>

          {perguntas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-12 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Plus size={24} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                Nenhuma pergunta cadastrada
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Comece adicionando a primeira pergunta ao seu modelo de formulário.
              </p>
              <button
                type="button"
                onClick={handleAdicionarPergunta}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <Plus size={14} />
                Adicionar pergunta
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {perguntas.map((p, index) => {
                // Perguntas anteriores elegíveis para a condição "Mostrar só se" (apenas escolha single/dropdown)
                const anterioresCompativeis = perguntas
                  .slice(0, index)
                  .filter(
                    (ant) =>
                      (ant.type === 'single' || ant.type === 'dropdown') &&
                      (ant.options?.length || 0) > 0,
                  );

                const temCondicao = Boolean(p.visible_if);
                const perguntaPai = p.visible_if
                  ? anterioresCompativeis.find((ant) => ant.id === p.visible_if?.question)
                  : null;

                return (
                  <div
                    key={p.id}
                    className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 transition hover:border-slate-300"
                  >
                    {/* Barra de título da pergunta com ações */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 font-mono text-xs font-bold text-blue-700">
                          {index + 1}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ID: {p.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Subir */}
                        <button
                          type="button"
                          onClick={() => handleSubirPergunta(index)}
                          disabled={index === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                          title="Mover para cima"
                        >
                          <ArrowUp size={13} />
                        </button>

                        {/* Descer */}
                        <button
                          type="button"
                          onClick={() => handleDescerPergunta(index)}
                          disabled={index === perguntas.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                          title="Mover para baixo"
                        >
                          <ArrowDown size={13} />
                        </button>

                        {/* Duplicar */}
                        <button
                          type="button"
                          onClick={() => handleDuplicarPergunta(index)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Duplicar pergunta"
                        >
                          <Copy size={13} />
                        </button>

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoverPergunta(index)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50"
                          title="Remover pergunta"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Campos Principais da Pergunta */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`p-title-${p.id}`}
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Texto da pergunta *
                        </label>
                        <input
                          id={`p-title-${p.id}`}
                          type="text"
                          value={p.title}
                          onChange={(e) =>
                            atualizarPergunta(index, 'title', e.target.value)
                          }
                          placeholder="Ex.: Qual o pavimento da instalação?"
                          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`p-type-${p.id}`}
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Tipo de resposta
                        </label>
                        <select
                          id={`p-type-${p.id}`}
                          value={p.type}
                          onChange={(e) =>
                            atualizarPergunta(
                              index,
                              'type',
                              e.target.value as TipoPergunta,
                            )
                          }
                          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          {Object.entries(TIPOS_PERGUNTA).map(([valor, rotulo]) => (
                            <option key={valor} value={valor}>
                              {rotulo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`p-help-${p.id}`}
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Dica ou instrução de ajuda (opcional)
                        </label>
                        <input
                          id={`p-help-${p.id}`}
                          type="text"
                          value={p.help || ''}
                          onChange={(e) =>
                            atualizarPergunta(index, 'help', e.target.value || undefined)
                          }
                          placeholder="Ex.: Informe se há necessidade de andaime ou furação especial."
                          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(p.required)}
                            onChange={(e) =>
                              atualizarPergunta(index, 'required', e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold text-slate-700">
                            Resposta obrigatória
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Campo Adicional para Número: Unidade */}
                    {p.type === 'number' && (
                      <div className="max-w-xs">
                        <label
                          htmlFor={`p-unit-${p.id}`}
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Unidade de medida (opcional)
                        </label>
                        <input
                          id={`p-unit-${p.id}`}
                          type="text"
                          value={p.unit || ''}
                          onChange={(e) =>
                            atualizarPergunta(index, 'unit', e.target.value || undefined)
                          }
                          placeholder="Ex.: °C, psi, V, bar, m"
                          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Opções de Escolha (single, dropdown, multi) */}
                    {(p.type === 'single' ||
                      p.type === 'dropdown' ||
                      p.type === 'multi') && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            Opções disponíveis:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdicionarOpcao(index)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Plus size={13} />
                            Adicionar opção
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(p.options || []).map((opcao, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-400">
                                {oIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={opcao}
                                onChange={(e) =>
                                  handleAtualizarOpcao(index, oIdx, e.target.value)
                                }
                                placeholder={`Opção ${oIdx + 1}`}
                                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                              {(p.options?.length || 0) > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoverOpcao(index, oIdx)}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  aria-label="Remover opção"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Condicional "Mostrar só se" */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Regra de visibilidade condicional:
                        </span>
                      </div>

                      {anterioresCompativeis.length === 0 ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Para configurar uma condição, adicione antes uma pergunta de
                          escolha única (single ou dropdown).
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <select
                                value={p.visible_if?.question || ''}
                                onChange={(e) => {
                                  const qId = e.target.value;
                                  if (!qId) {
                                    atualizarPergunta(index, 'visible_if', undefined);
                                  } else {
                                    const pai = anterioresCompativeis.find(
                                      (ant) => ant.id === qId,
                                    );
                                    atualizarPergunta(index, 'visible_if', {
                                      question: qId,
                                      in: pai?.options?.[0] ? [pai.options[0]] : [],
                                    });
                                  }
                                }}
                                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="">Sempre visível (sem condição)</option>
                                {anterioresCompativeis.map((ant) => (
                                  <option key={ant.id} value={ant.id}>
                                    Mostrar só se: &quot;{ant.title || ant.id}&quot;
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Seletor de quais opções ativam esta pergunta */}
                            {temCondicao && perguntaPai && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-semibold text-slate-500">
                                  for igual a:
                                </span>
                                {(perguntaPai.options || []).map((opcao) => {
                                  const marcado = p.visible_if?.in.includes(opcao);
                                  return (
                                    <button
                                      key={opcao}
                                      type="button"
                                      onClick={() => {
                                        const atualIn = p.visible_if?.in || [];
                                        const novoIn = marcado
                                          ? atualIn.filter((item) => item !== opcao)
                                          : [...atualIn, opcao];

                                        if (novoIn.length === 0) {
                                          // Mantém ao menos a clicada para não ficar inválido
                                          return;
                                        }

                                        atualizarPergunta(index, 'visible_if', {
                                          question: perguntaPai.id,
                                          in: novoIn,
                                        });
                                      }}
                                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                        marcado
                                          ? 'bg-blue-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      {opcao}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
