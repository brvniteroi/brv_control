import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Clock,
  Cpu,
  Link2Off,
  Loader2,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  ZoomIn,
} from 'lucide-react';
import VisualizadorFotos from '../components/ordens/VisualizadorFotos';
import {
  CORES_ETAPA_PLACA,
  CORES_ORCAMENTO_PLACA,
  ROTULO_CATEGORIA_FOTO,
} from '../components/placas/cores';
import FaixaDadosDemoPlacas from '../components/placas/FaixaDadosDemoPlacas';
import { buscarAcompanhamentoPublico } from '../components/placas/fonteDeDados';
import {
  MOSTRAR_VALOR_ORCAMENTO,
  ROTULO_ETAPA_PLACA,
  converterFotosPlacaParaAttachment,
  montarLinkWhatsAppPlaca,
} from '../components/placas/regrasPlacas';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import type { BoardPublicTracking } from '../types/placas';
import { valorEmReais } from '../utils/oficina';
import { formatarData } from '../utils/ordens';

/**
 * Página pública (sem login, focada em celular) para o cliente ou parceiro instalador
 * acompanhar sua placa: `/placa/:token`.
 * Nunca exibe diagnóstico técnico interno, valores internos nem reembolsos.
 */
export default function AcompanhamentoPlaca() {
  const { token = '' } = useParams();

  const [dados, setDados] = useState<BoardPublicTracking | null | undefined>(undefined);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);
  const [fotoIndiceAberta, setFotoIndiceAberta] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setDados(undefined);
        setErroRede(null);
        return buscarAcompanhamentoPublico(token);
      })
      .then((res) => {
        if (!ativo) return;
        setDados(res ?? null);
      })
      .catch((err) => {
        if (!ativo) return;
        setErroRede(
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar o acompanhamento agora.',
        );
        setDados(null);
      });

    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  const anexosFotos = useMemo(
    () => (dados?.photos ? converterFotosPlacaParaAttachment(dados.photos) : []),
    [dados],
  );

  const linkWhatsBrv = dados
    ? montarLinkWhatsAppPlaca(
        EMPRESA_BRV.telefone,
        `Olá, BRV Niterói! Gostaria de informações sobre a placa ${dados.board_number} (${dados.brand_model}).`,
      )
    : montarLinkWhatsAppPlaca(
        EMPRESA_BRV.telefone,
        'Olá, BRV Niterói! Gostaria de informações sobre um reparo de placa.',
      );

  return (
    <div className="min-h-dvh bg-[#F4F6F8] px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <FaixaDadosDemoPlacas />

        {/* Cabeçalho institucional BRV */}
        <header className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <img
            src={EMPRESA_BRV.logoUrl}
            alt="BRV Niterói"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">
              BRV Niterói · Laboratório de Placas
            </h1>
            <p className="text-xs text-slate-500">
              Acompanhamento em tempo real do reparo eletrônico
            </p>
          </div>
        </header>

        {/* Estado: Carregando */}
        {dados === undefined && !erroRede && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-slate-500 shadow-2xs">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm font-medium">Buscando andamento da sua placa...</p>
          </div>
        )}

        {/* Estado: Erro de comunicação */}
        {erroRede && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-2xs"
          >
            <p className="text-sm font-semibold text-rose-900">{erroRede}</p>
            <button
              type="button"
              onClick={() => setChaveRecarga((c) => c + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Tentar de novo</span>
            </button>
          </div>
        )}

        {/* Estado: Link inválido ou expirado */}
        {dados === null && !erroRede && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xs space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Link2Off size={22} aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Link inválido ou expirado</h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Não localizamos uma placa ativa para este endereço. Confira se o link foi copiado por inteiro ou solicite o link atualizado à equipe da BRV.
            </p>
            <a
              href={linkWhatsBrv}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle size={17} aria-hidden="true" />
              <span>Falar com a BRV no WhatsApp</span>
            </a>
          </div>
        )}

        {/* Conteúdo seguro da placa */}
        {dados && (
          <>
            {/* Cartão principal: número, etapa atual em destaque e dados do equipamento */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-lg font-extrabold tracking-tight text-slate-900">
                  {dados.board_number}
                </span>
                {dados.is_warranty && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                    <ShieldCheck size={12} aria-hidden="true" />
                    Atendimento em garantia
                  </span>
                )}
              </div>

              {/* Etapa atual destacada */}
              <div
                className={`rounded-2xl border p-4 ${CORES_ETAPA_PLACA[dados.status].selo}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  Etapa atual
                </p>
                <p className="mt-0.5 text-base font-extrabold">
                  {ROTULO_ETAPA_PLACA[dados.status]}
                </p>
                <p className="mt-1 text-xs opacity-90">
                  Entrada registrada em {formatarData(dados.created_at)}
                  {dados.finished_at ? ` · Saída em ${formatarData(dados.finished_at)}` : ''}
                </p>
              </div>

              {/* Equipamento e código */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Cpu size={14} className="text-blue-600" aria-hidden="true" />
                  <span>
                    {dados.equipment_type} · {dados.brand_model}
                  </span>
                </div>
                <p className="text-slate-600">
                  Código da placa:{' '}
                  <strong className="font-mono text-slate-900">{dados.board_code}</strong>
                </p>
              </div>

              {/* Situação do orçamento (sem valor, salvo se MOSTRAR_VALOR_ORCAMENTO for true) */}
              {!dados.is_warranty && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs">
                  <span className="font-semibold text-slate-600">Situação do orçamento</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-semibold ${CORES_ORCAMENTO_PLACA[dados.quote_status].selo}`}
                  >
                    {CORES_ORCAMENTO_PLACA[dados.quote_status].rotuloPublico}
                    {MOSTRAR_VALOR_ORCAMENTO && dados.quote_amount != null
                      ? ` · ${valorEmReais(dados.quote_amount)}`
                      : ''}
                  </span>
                </div>
              )}
            </section>

            {/* Garantia de 90 dias quando entregue */}
            {dados.status === 'entregue' && dados.warranty_until && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-2xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-950">
                    <ShieldCheck size={17} className="text-emerald-700" aria-hidden="true" />
                    Garantia legal de 90 dias
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      dados.warranty_active
                        ? 'border-emerald-300 bg-white text-emerald-800'
                        : 'border-slate-300 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {dados.warranty_active ? 'Vigente' : 'Encerrada'}
                  </span>
                </div>
                <p className="text-xs text-emerald-900">
                  Válida até <strong>{formatarData(dados.warranty_until)}</strong> para o serviço e componentes reparados em bancada (mantenha o lacre intacto).
                </p>
              </section>
            )}

            {/* Linha de etapas com datas */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900">Linha do tempo das etapas</h2>
              <ol className="space-y-3">
                {dados.steps.map((passo, idx) => {
                  const concluida = passo.state === 'concluida';
                  const atual = passo.state === 'atual';
                  const ultimo = idx === dados.steps.length - 1;
                  return (
                    <li key={passo.stage} className="relative flex gap-3">
                      {!ultimo && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-6 left-[11px] -bottom-3 w-0.5 ${
                            concluida ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      <span className="relative z-10 mt-0.5 shrink-0">
                        {concluida ? (
                          <CheckCircle2
                            size={22}
                            className="fill-emerald-50 text-emerald-600"
                            aria-hidden="true"
                          />
                        ) : atual ? (
                          <Clock
                            size={22}
                            className="fill-blue-50 text-blue-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            size={22}
                            className="fill-white text-slate-300"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-sm ${
                              atual
                                ? 'font-extrabold text-blue-950'
                                : concluida
                                  ? 'font-semibold text-slate-800'
                                  : 'font-medium text-slate-400'
                            }`}
                          >
                            {passo.label}
                          </span>
                          {passo.reached_at && (
                            <span className="text-[11px] font-medium text-slate-500">
                              {formatarData(passo.reached_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* Grade de fotos públicas */}
            {dados.photos.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    Registros fotográficos ({dados.photos.length})
                  </h2>
                  <span className="text-[11px] text-slate-500">Toque para ampliar</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {dados.photos.map((foto, idx) => (
                    <button
                      key={foto.id}
                      type="button"
                      onClick={() => setFotoIndiceAberta(idx)}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <img
                        src={foto.public_url}
                        alt={foto.caption ?? ROTULO_CATEGORIA_FOTO[foto.category]}
                        className="h-28 w-full object-cover transition group-hover:scale-105"
                      />
                      <span className="absolute top-1.5 left-1.5 rounded-md bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {ROTULO_CATEGORIA_FOTO[foto.category]}
                      </span>
                      <span className="absolute right-1.5 bottom-1.5 rounded-md bg-white/90 p-1 text-slate-800 shadow-2xs">
                        <ZoomIn size={13} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Botão fixo/destacado de WhatsApp */}
            <a
              href={linkWhatsBrv}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <MessageCircle size={18} aria-hidden="true" />
              <span>Falar com a BRV no WhatsApp</span>
            </a>

            <footer className="pb-4 text-center text-[11px] text-slate-400">
              {EMPRESA_BRV.nomeCurto} · {EMPRESA_BRV.endereco}
            </footer>
          </>
        )}
      </div>

      {fotoIndiceAberta !== null && anexosFotos.length > 0 && (
        <VisualizadorFotos
          fotos={anexosFotos}
          indiceInicial={fotoIndiceAberta}
          onFechar={() => setFotoIndiceAberta(null)}
        />
      )}
    </div>
  );
}
