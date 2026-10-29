import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  User,
  X,
} from 'lucide-react';
import { buscarAnexosPorIds } from '../../services/formularios';
import type { FormularioRespondido } from '../../types/formularios';
import type { Attachment } from '../../types/fsm';
import { formatarData, formatarDataHora } from '../../utils/ordens';
import { perguntasVisiveis, respostaVazia } from '../../utils/formularios';

interface VisualizarFormularioProps {
  formulario: FormularioRespondido;
  clienteNome?: string;
  ordemNumero?: number;
  tecnicoNome?: string;
  onFechar: () => void;
  onEditar?: () => void;
}

export default function VisualizarFormulario({
  formulario,
  clienteNome,
  ordemNumero,
  tecnicoNome,
  onFechar,
  onEditar,
}: VisualizarFormularioProps) {
  const [anexosMap, setAnexosMap] = useState<Record<string, Attachment>>({});
  const [fotoAmpliadaUrl, setFotoAmpliadaUrl] = useState<string | null>(null);

  const [dataEmissao] = useState(() => new Date().toLocaleString('pt-BR'));

  // Extrai IDs de fotos e assinaturas
  const idsAnexos = useMemo(() => {
    const todosIds: string[] = [];
    for (const q of formulario.questions) {
      const resp = formulario.answers?.[q.id];
      if (q.type === 'photo' && Array.isArray(resp)) {
        for (const id of resp) {
          if (typeof id === 'string') todosIds.push(id);
        }
      } else if (q.type === 'signature' && typeof resp === 'string' && resp) {
        todosIds.push(resp);
      }
    }
    return todosIds;
  }, [formulario.questions, formulario.answers]);

  const [carregandoAnexos, setCarregandoAnexos] = useState(idsAnexos.length > 0);

  // Carrega todos os anexos citados nas respostas (fotos e assinaturas)
  useEffect(() => {
    if (idsAnexos.length === 0) return;

    let montado = true;

    buscarAnexosPorIds(idsAnexos)
      .then((lista) => {
        if (!montado) return;
        const mapa: Record<string, Attachment> = {};
        for (const a of lista) {
          mapa[a.id] = a;
        }
        setAnexosMap(mapa);
      })
      .catch((err) => {
        console.error('Erro ao carregar anexos do formulário:', err);
      })
      .finally(() => {
        if (montado) setCarregandoAnexos(false);
      });

    return () => {
      montado = false;
    };
  }, [idsAnexos]);

  const perguntasParaExibir = useMemo(() => {
    return perguntasVisiveis(formulario.questions, formulario.answers || {});
  }, [formulario.questions, formulario.answers]);

  const handleImprimir = () => {
    window.print();
  };

  const preenchido = formulario.status === 'preenchido';

  // Portal no <body>: ao imprimir, o index.css esconde o #root (menu, OS) e sobra só este bloco,
  // que no papel fica estático e quebra em várias páginas.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 print:static print:overflow-visible print:bg-white">
    <div className="min-h-screen pb-16 print:min-h-0 print:pb-0">
      {/* Barra de Ações Superior (Oculta na Impressão) */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs print:hidden sm:px-6 sm:py-4">
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
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {formulario.template_name}
              </h1>
              {preenchido ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 size={12} /> Preenchido
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  <Clock size={12} /> Rascunho pendente
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Visualização de respostas para consulta e impressão de relatório.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              Editar respostas
            </button>
          )}

          <button
            type="button"
            onClick={handleImprimir}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Printer size={15} />
            Imprimir / Salvar PDF
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

      {/* Documento Imprimível / Visualizável */}
      <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs print:border-none print:p-0 print:shadow-none sm:p-8">
          {/* Cabeçalho do Documento */}
          <div className="border-b border-slate-200 pb-5 print:border-slate-800 print:pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-blue-600 font-bold print:text-slate-800">
                  BRV Climatização e Serviços
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 print:text-2xl">
                  {formulario.template_name}
                </h2>
              </div>
              {ordemNumero && (
                <div className="text-right">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 print:border print:border-slate-400">
                    OS #{ordemNumero}
                  </span>
                </div>
              )}
            </div>

            {/* Metadados: Cliente, Técnico, Data */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs text-slate-600 print:grid-cols-3 print:gap-1">
              {clienteNome && (
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} className="shrink-0 text-slate-400 print:hidden" />
                  <span>
                    <strong>Cliente:</strong> {clienteNome}
                  </span>
                </div>
              )}

              {tecnicoNome && (
                <div className="flex items-center gap-1.5">
                  <User size={14} className="shrink-0 text-slate-400 print:hidden" />
                  <span>
                    <strong>Técnico:</strong> {tecnicoNome}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="shrink-0 text-slate-400 print:hidden" />
                <span>
                  <strong>Data:</strong>{' '}
                  {formatarDataHora(formulario.filled_at || formulario.updated_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Perguntas e Respostas */}
          <div className="mt-6 space-y-5 print:mt-4 print:space-y-4">
            {perguntasParaExibir.map((p, index) => {
              const valor = formulario.answers?.[p.id];
              const vazia = respostaVazia(valor);

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 print:border-b print:border-slate-200 print:border-t-0 print:border-l-0 print:border-r-0 print:bg-white print:p-2.5 print:break-inside-avoid"
                >
                  {/* Título da Pergunta */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 sm:text-sm">
                      <span className="mr-1.5 text-slate-400 font-semibold">{index + 1}.</span>
                      {p.title}
                    </span>
                    {p.unit && !vazia && (
                      <span className="text-[11px] font-medium text-slate-400 print:hidden">
                        ({p.unit})
                      </span>
                    )}
                  </div>

                  {/* Resposta da Pergunta */}
                  <div className="mt-2 text-sm text-slate-900">
                    {vazia ? (
                      <span className="italic text-slate-400 text-xs">Sem resposta</span>
                    ) : p.type === 'text' || p.type === 'textarea' ? (
                      <p className="whitespace-pre-line text-slate-800">{String(valor)}</p>
                    ) : p.type === 'number' ? (
                      <span className="font-semibold text-slate-900">
                        {String(valor)} {p.unit || ''}
                      </span>
                    ) : p.type === 'single' || p.type === 'dropdown' ? (
                      <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 print:bg-transparent print:p-0 print:text-slate-900">
                        {String(valor)}
                      </span>
                    ) : p.type === 'multi' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(valor as string[]).map((opcao) => (
                          <span
                            key={opcao}
                            className="rounded-lg bg-slate-200/70 px-2.5 py-1 text-xs font-medium text-slate-800 print:border print:border-slate-300 print:bg-transparent"
                          >
                            {opcao}
                          </span>
                        ))}
                      </div>
                    ) : p.type === 'date' ? (
                      <span className="font-semibold text-slate-800">
                        {formatarData(valor as string)}
                      </span>
                    ) : p.type === 'photo' ? (
                      <div className="mt-1">
                        {carregandoAnexos ? (
                          <span className="text-xs text-slate-400">Carregando fotos...</span>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3 print:gap-2">
                            {(valor as string[]).map((id) => {
                              const anexo = anexosMap[id];
                              if (!anexo) return null;
                              return (
                                <div
                                  key={id}
                                  className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 print:border-slate-300"
                                >
                                  <img
                                    src={anexo.public_url}
                                    alt={anexo.file_name || 'Foto do formulário'}
                                    onClick={() => setFotoAmpliadaUrl(anexo.public_url)}
                                    className="h-full w-full cursor-pointer object-cover print:cursor-default"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : p.type === 'signature' ? (
                      <div className="mt-1 max-w-sm">
                        {typeof valor === 'string' && anexosMap[valor] ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 print:border-slate-400">
                            <img
                              src={anexosMap[valor].public_url}
                              alt="Assinatura registrada"
                              className="h-24 w-full object-contain"
                            />
                            <div className="mt-2 border-t border-slate-200 pt-1 text-center text-[11px] text-slate-500 print:text-slate-700">
                              Assinatura do responsável
                            </div>
                          </div>
                        ) : (
                          <span className="italic text-slate-400 text-xs">
                            Assinatura não encontrada
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé do Documento Impresso */}
          <div className="mt-10 hidden border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500 print:block">
            Documento emitido eletronicamente pelo sistema BRV Control em {dataEmissao}.
          </div>
        </div>
      </div>

      {/* Modal Simples de Foto Ampliada */}
      {fotoAmpliadaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs print:hidden"
          onClick={() => setFotoAmpliadaUrl(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoAmpliadaUrl(null)}
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X size={20} />
            </button>
            <img
              src={fotoAmpliadaUrl}
              alt="Foto ampliada"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
    </div>,
    document.body,
  );
}
