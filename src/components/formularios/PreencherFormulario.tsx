import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Lock,
  Save,
  Send,
  X,
} from 'lucide-react';
import { anexarFoto } from '../../services/anexos';
import { buscarAnexosPorIds, salvarRespostas } from '../../services/formularios';
import type { FormularioRespondido, Resposta, Respostas } from '../../types/formularios';
import {
  limparRespostasOcultas,
  perguntasVisiveis,
  validarRespostas,
} from '../../utils/formularios';
import CampoAssinatura from './CampoAssinatura';
import CampoFoto from './CampoFoto';

interface PreencherFormularioProps {
  formulario: FormularioRespondido;
  onFechar: () => void;
  onSalvo?: (atualizado: FormularioRespondido) => void;
}

export default function PreencherFormulario({
  formulario,
  onFechar,
  onSalvo,
}: PreencherFormularioProps) {
  // Inicialização de respostas
  const [respostas, setRespostas] = useState<Respostas>(() => ({
    ...(formulario.answers || {}),
  }));

  // Blobs de novas assinaturas pendentes de upload (chave: id da pergunta)
  const [assinaturasNovas, setAssinaturasNovas] = useState<Record<string, Blob | null>>({});

  // URLs de assinaturas já salvas (chave: anexo_id)
  const [urlsAssinaturasSalvas, setUrlsAssinaturasSalvas] = useState<Record<string, string>>({});

  // Modo somente leitura caso o formulário já esteja preenchido
  const [modoLeitura, setModoLeitura] = useState(formulario.status === 'preenchido');

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Controle de alterações não salvas
  const [respostasOriginais, setRespostasOriginais] = useState(() =>
    JSON.stringify(formulario.answers || {}),
  );
  const temAlteracoes = useMemo(() => {
    const respostasAtuais = JSON.stringify(respostas);
    const temNovaAssinatura = Object.values(assinaturasNovas).some(Boolean);
    return respostasAtuais !== respostasOriginais || temNovaAssinatura;
  }, [respostas, assinaturasNovas, respostasOriginais]);

  // Alerta ao tentar fechar aba do navegador com alterações
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (temAlteracoes && !modoLeitura) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [temAlteracoes, modoLeitura]);

  // Carrega URLs de assinaturas já salvas
  useEffect(() => {
    const idsAssinaturas = formulario.questions
      .filter((q) => q.type === 'signature')
      .map((q) => formulario.answers?.[q.id])
      .filter((id): id is string => typeof id === 'string' && Boolean(id));

    if (idsAssinaturas.length === 0) return;

    buscarAnexosPorIds(idsAssinaturas)
      .then((anexos) => {
        const mapa: Record<string, string> = {};
        for (const a of anexos) {
          mapa[a.id] = a.public_url;
        }
        setUrlsAssinaturasSalvas(mapa);
      })
      .catch((err) => {
        console.error('Erro ao carregar assinaturas existentes:', err);
      });
  }, [formulario.questions, formulario.answers]);

  // Lista dinâmica de perguntas visíveis com base nas respostas atuais
  const listaPerguntasVisiveis = useMemo(() => {
    return perguntasVisiveis(formulario.questions, respostas);
  }, [formulario.questions, respostas]);

  const atualizarResposta = (perguntaId: string, valor: Resposta) => {
    setRespostas((prev) => ({
      ...prev,
      [perguntaId]: valor,
    }));

    // Limpa erro do campo alterado
    if (erros[perguntaId]) {
      setErros((prev) => {
        const copia = { ...prev };
        delete copia[perguntaId];
        return copia;
      });
    }
  };

  const alternarMultiplaEscolha = (perguntaId: string, opcao: string) => {
    const atual = (respostas[perguntaId] as string[]) || [];
    const novo = atual.includes(opcao)
      ? atual.filter((item) => item !== opcao)
      : [...atual, opcao];
    atualizarResposta(perguntaId, novo);
  };

  const handleTentativaFechar = () => {
    if (temAlteracoes && !modoLeitura) {
      const confirma = window.confirm(
        'Você tem alterações não salvas neste formulário. Deseja realmente sair sem salvar?',
      );
      if (!confirma) return;
    }
    onFechar();
  };

  const salvarFormulario = async (concluir: boolean) => {
    setErroGeral(null);

    // Se for concluir, valida as perguntas visíveis
    if (concluir) {
      // Considera assinaturas novas desenhadas no canvas mesmo que ainda não enviadas
      const respostasComAssinaturasTemp = { ...respostas };
      for (const [qId, blob] of Object.entries(assinaturasNovas)) {
        if (blob) {
          respostasComAssinaturasTemp[qId] = 'pendente-upload';
        }
      }

      const errosValidacao = validarRespostas(
        formulario.questions,
        respostasComAssinaturasTemp,
      );

      if (Object.keys(errosValidacao).length > 0) {
        setErros(errosValidacao);
        const primeiroIdComErro = Object.keys(errosValidacao)[0];
        const elemento = document.getElementById(`bloco-pergunta-${primeiroIdComErro}`);
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setErroGeral('Por favor, preencha todas as perguntas obrigatórias antes de concluir.');
        return;
      }
    }

    setSalvando(true);

    try {
      const respostasFinais: Respostas = { ...respostas };

      // Faz upload de novas assinaturas pendentes
      for (const [perguntaId, blob] of Object.entries(assinaturasNovas)) {
        if (blob) {
          const arquivoAssinatura = new File([blob], `assinatura_${perguntaId}.png`, {
            type: 'image/png',
          });

          const anexo = await anexarFoto(arquivoAssinatura, {
            taskId: formulario.task_id,
            serviceOrderId: formulario.service_order_id,
            category: 'assinatura',
          });

          respostasFinais[perguntaId] = anexo.id;
          setUrlsAssinaturasSalvas((prev) => ({ ...prev, [anexo.id]: anexo.public_url }));
        }
      }

      // Limpa respostas de perguntas que estejam ocultas
      const respostasLimpa = limparRespostasOcultas(
        formulario.questions,
        respostasFinais,
      );

      const novoStatus = concluir ? 'preenchido' : 'pendente';
      const atualizado = await salvarRespostas(formulario.id, respostasLimpa, novoStatus);

      setRespostasOriginais(JSON.stringify(respostasLimpa));
      setAssinaturasNovas({});
      setRespostas(respostasLimpa);
      setErros({});

      if (concluir) {
        setModoLeitura(true);
        setMensagemSucesso('Formulário concluído com sucesso!');
      } else {
        setMensagemSucesso('Rascunho salvo com sucesso!');
      }

      setTimeout(() => setMensagemSucesso(null), 3000);

      if (onSalvo) {
        onSalvo(atualizado);
      }
    } catch (err) {
      console.error('Erro ao salvar respostas do formulário:', err);
      setErroGeral(
        err instanceof Error ? err.message : 'Não foi possível salvar as respostas do formulário.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* Barra de Ações Superior */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTentativaFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {formulario.template_name}
              </h1>
              {modoLeitura ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 size={12} /> Preenchido
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  <Clock size={12} /> Editando
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {modoLeitura
                ? 'Respostas registradas. Clique em "Editar" para fazer alterações.'
                : 'Preencha as informações solicitadas no formulário de campo.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mensagemSucesso && (
            <span className="hidden items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <Check size={14} /> {mensagemSucesso}
            </span>
          )}

          {modoLeitura ? (
            <button
              type="button"
              onClick={() => setModoLeitura(false)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
            >
              <Edit3 size={14} />
              Editar respostas
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => salvarFormulario(false)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Save size={14} className="text-slate-500" />
                <span className="hidden sm:inline">Salvar rascunho</span>
                <span className="sm:hidden">Rascunho</span>
              </button>

              <button
                type="button"
                onClick={() => salvarFormulario(true)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} />
                <span>{salvando ? 'Salvando...' : 'Concluir'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleTentativaFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Alerta de Erro Geral */}
      {erroGeral && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:mx-auto sm:max-w-3xl">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{erroGeral}</span>
        </div>
      )}

      {/* Mensagem de sucesso mobile */}
      {mensagemSucesso && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 sm:hidden">
          <Check size={16} className="shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Bloco de Formulário */}
      <div className="mx-auto mt-6 max-w-3xl space-y-4 px-4 sm:px-6">
        {listaPerguntasVisiveis.map((p, index) => {
          const valor = respostas[p.id];
          const erroPergunta = erros[p.id];

          return (
            <div
              key={p.id}
              id={`bloco-pergunta-${p.id}`}
              className={`rounded-2xl border bg-white p-5 shadow-xs transition sm:p-6 ${
                erroPergunta
                  ? 'border-rose-300 ring-2 ring-rose-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Título da Pergunta */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <label
                    htmlFor={`campo-${p.id}`}
                    className="block text-sm font-bold text-slate-900 sm:text-base"
                  >
                    <span className="mr-1.5 text-xs text-slate-400">{index + 1}.</span>
                    {p.title}
                    {p.required && (
                      <span className="ml-1 text-rose-500 font-bold" title="Obrigatório">
                        *
                      </span>
                    )}
                  </label>
                  {modoLeitura && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      Bloqueado
                    </span>
                  )}
                </div>

                {p.help && <p className="text-xs text-slate-500">{p.help}</p>}
              </div>

              {/* Campo por Tipo */}
              <div className="mt-3.5">
                {/* 1. Texto Curto */}
                {p.type === 'text' && (
                  <input
                    id={`campo-${p.id}`}
                    type="text"
                    value={(valor as string) || ''}
                    disabled={modoLeitura}
                    onChange={(e) => atualizarResposta(p.id, e.target.value)}
                    placeholder="Digite a resposta..."
                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  />
                )}

                {/* 2. Texto Longo */}
                {p.type === 'textarea' && (
                  <textarea
                    id={`campo-${p.id}`}
                    rows={3}
                    value={(valor as string) || ''}
                    disabled={modoLeitura}
                    onChange={(e) => atualizarResposta(p.id, e.target.value)}
                    placeholder="Escreva os detalhes aqui..."
                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  />
                )}

                {/* 3. Número com Unidade */}
                {p.type === 'number' && (
                  <div className="relative flex items-center">
                    <input
                      id={`campo-${p.id}`}
                      type="number"
                      step="any"
                      value={valor !== null && valor !== undefined ? String(valor) : ''}
                      disabled={modoLeitura}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        atualizarResposta(p.id, val === '' ? null : Number(val));
                      }}
                      placeholder="0"
                      className="block w-full rounded-xl border border-slate-200 px-4 py-3 pr-16 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                    />
                    {p.unit && (
                      <span className="pointer-events-none absolute right-3 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {p.unit}
                      </span>
                    )}
                  </div>
                )}

                {/* 4. Escolha Única (Botões Grandes) */}
                {p.type === 'single' && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {p.options?.map((opcao) => {
                      const selecionado = valor === opcao;
                      return (
                        <button
                          key={opcao}
                          type="button"
                          disabled={modoLeitura}
                          onClick={() => atualizarResposta(p.id, opcao)}
                          className={`flex items-center justify-between rounded-xl border p-3.5 text-left text-sm font-semibold transition ${
                            selecionado
                              ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                          } disabled:cursor-not-allowed disabled:opacity-80`}
                        >
                          <span>{opcao}</span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selecionado
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {selecionado && <Check size={12} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 5. Lista Suspensa (Dropdown) */}
                {p.type === 'dropdown' && (
                  <select
                    id={`campo-${p.id}`}
                    value={(valor as string) || ''}
                    disabled={modoLeitura}
                    onChange={(e) => atualizarResposta(p.id, e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  >
                    <option value="">Selecione uma opção...</option>
                    {p.options?.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </select>
                )}

                {/* 6. Múltipla Escolha */}
                {p.type === 'multi' && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {p.options?.map((opcao) => {
                      const marcadas = (valor as string[]) || [];
                      const selecionado = marcadas.includes(opcao);

                      return (
                        <button
                          key={opcao}
                          type="button"
                          disabled={modoLeitura}
                          onClick={() => alternarMultiplaEscolha(p.id, opcao)}
                          className={`flex items-center justify-between rounded-xl border p-3.5 text-left text-sm font-semibold transition ${
                            selecionado
                              ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                          } disabled:cursor-not-allowed disabled:opacity-80`}
                        >
                          <span>{opcao}</span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selecionado
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {selecionado && <Check size={13} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 7. Data */}
                {p.type === 'date' && (
                  <input
                    id={`campo-${p.id}`}
                    type="date"
                    value={(valor as string) || ''}
                    disabled={modoLeitura}
                    onChange={(e) => atualizarResposta(p.id, e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-600"
                  />
                )}

                {/* 8. Fotos */}
                {p.type === 'photo' && (
                  <CampoFoto
                    valorIds={(valor as string[]) || []}
                    taskId={formulario.task_id}
                    serviceOrderId={formulario.service_order_id}
                    desabilitado={modoLeitura}
                    onChange={(novosIds) => atualizarResposta(p.id, novosIds)}
                  />
                )}

                {/* 9. Assinatura */}
                {p.type === 'signature' && (
                  <CampoAssinatura
                    valorId={typeof valor === 'string' ? valor : null}
                    urlExistente={
                      typeof valor === 'string' ? urlsAssinaturasSalvas[valor] : null
                    }
                    desabilitado={modoLeitura}
                    onAssinaturaAlterada={(blob) => {
                      setAssinaturasNovas((prev) => ({
                        ...prev,
                        [p.id]: blob,
                      }));
                      if (blob) {
                        atualizarResposta(p.id, 'assinatura-pendente');
                      } else {
                        atualizarResposta(p.id, null);
                      }
                    }}
                  />
                )}
              </div>

              {/* Mensagem de Erro da Pergunta */}
              {erroPergunta && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{erroPergunta}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de Ações Fixa no Rodapé (Ideal para celular) */}
      {!modoLeitura && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md sm:p-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTentativaFechar}
              disabled={salvando}
              className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => salvarFormulario(false)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Save size={14} />
                <span>Salvar rascunho</span>
              </button>

              <button
                type="button"
                onClick={() => salvarFormulario(true)}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} />
                <span>{salvando ? 'Concluindo...' : 'Concluir formulário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
