import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, Link2Off, Loader2, MessageCircle, RotateCcw, ShieldCheck, Wrench } from 'lucide-react';
import { CORES_ETAPA } from '../components/oficina/cores';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import { montarLinkWhatsAppPlaca } from '../components/placas/regrasPlacas';
import { buscarAcompanhamentoOficina } from '../services/oficina';
import type { AcompanhamentoOficinaPublico } from '../types/oficina';
import {
  PASSOS_ACOMPANHAMENTO_OFICINA,
  ROTULO_ETAPA_PUBLICO,
  ROTULO_UNIDADE,
  WHATSAPP_OFICINA,
  numeroItem,
} from '../utils/oficina';
import { formatarData } from '../utils/ordens';

const GARANTIA_DIAS = 90;

/**
 * Página pública (sem login, focada em celular) para o cliente acompanhar o equipamento na oficina:
 * `/acompanhar-oficina/:token`. Mesmo modelo de `/placa/:token`. Nunca mostra diagnóstico, valores, observações
 * internas, fotos nem dados de contato (a função `oficina_acompanhamento` só devolve o que pode aparecer aqui).
 */
export default function AcompanhamentoOficina() {
  const { token = '' } = useParams();
  const [dados, setDados] = useState<AcompanhamentoOficinaPublico | null | undefined>(undefined);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);
  // Momento da abertura da página (para saber se a garantia ainda vale), lido uma vez
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setDados(undefined);
        setErroRede(null);
        return buscarAcompanhamentoOficina(token);
      })
      .then((res) => ativo && setDados(res ?? null))
      .catch((err) => {
        if (!ativo) return;
        setErroRede(err instanceof Error ? err.message : 'Não foi possível consultar o andamento agora.');
        setDados(null);
      });
    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  const numero = dados ? numeroItem(dados, dados.items_in_os) : '';

  // Passos mostrados ao cliente: "Retirado pelo técnico" só aparece se o item passou por lá
  const passos = useMemo(() => {
    if (!dados) return [];
    const lista = PASSOS_ACOMPANHAMENTO_OFICINA.filter(
      (p) => p.chave !== 'transito' || dados.status === 'em_transito' || Boolean(dados.reached.em_transito),
    );
    const atual = lista.findIndex((p) => p.etapas.includes(dados.status));
    return lista.map((p, idx) => {
      const datas = p.etapas.map((e) => dados.reached[e]).filter((d): d is string => Boolean(d));
      if (p.chave === 'entrada' && dados.received_at) datas.push(dados.received_at);
      const quando = datas.length ? datas.sort()[0] : null;
      // Descarte: nenhum passo é "atual"; os que o item alcançou ficam concluídos
      const estado =
        atual === -1 ? (quando ? 'concluida' : 'pendente') : idx < atual ? 'concluida' : idx === atual ? 'atual' : 'pendente';
      return { ...p, quando, estado };
    });
  }, [dados]);

  const garantia = useMemo(() => {
    if (!dados || dados.status !== 'entregue' || !dados.finished_at) return null;
    const ate = new Date(new Date(dados.finished_at).getTime() + GARANTIA_DIAS * 86_400_000);
    return { ate: ate.toISOString(), vigente: ate.getTime() >= agora };
  }, [dados, agora]);

  const linkWhatsBrv = montarLinkWhatsAppPlaca(
    WHATSAPP_OFICINA,
    dados
      ? `Olá, BRV Niterói! Gostaria de informações sobre o meu equipamento na oficina (${numero}).`
      : 'Olá, BRV Niterói! Gostaria de informações sobre um equipamento na oficina.',
  );

  return (
    <div className="min-h-dvh bg-[#F4F6F8] px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <header className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <img src={EMPRESA_BRV.logoUrl} alt="BRV Niterói" className="h-12 w-12 shrink-0 object-contain" />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">BRV Niterói · Oficina</h1>
            <p className="text-xs text-slate-500">Acompanhamento do seu equipamento</p>
          </div>
        </header>

        {dados === undefined && !erroRede && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-slate-500 shadow-2xs">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm font-medium">Buscando o andamento do seu equipamento...</p>
          </div>
        )}

        {erroRede && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-2xs">
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

        {dados === null && !erroRede && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Link2Off size={22} aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Link inválido</h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Não localizamos um equipamento para este endereço. Confira se o link foi copiado por inteiro ou fale com a BRV.
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

        {dados && (
          <>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-lg font-extrabold tracking-tight text-slate-900">{numero}</span>
                {dados.is_warranty && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
                    <ShieldCheck size={12} aria-hidden="true" />
                    Atendimento em garantia
                  </span>
                )}
              </div>

              <div className={`rounded-2xl border p-4 ${CORES_ETAPA[dados.status].selo}`}>
                <p className="text-[11px] font-bold tracking-wider uppercase opacity-80">Etapa atual</p>
                <p className="mt-0.5 text-base font-extrabold">{ROTULO_ETAPA_PUBLICO[dados.status]}</p>
                <p className="mt-1 text-xs opacity-90">
                  Entrada registrada em {formatarData(dados.received_at ?? dados.created_at)}
                  {dados.finished_at ? ` · Encerrado em ${formatarData(dados.finished_at)}` : ''}
                </p>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Wrench size={14} className="text-blue-600" aria-hidden="true" />
                  <span>
                    {dados.equipment_type} · {ROTULO_UNIDADE[dados.units_collected]}
                  </span>
                </div>
                {(dados.brand || dados.model) && (
                  <p className="text-slate-600">
                    Marca / modelo: <strong className="text-slate-900">{[dados.brand, dados.model].filter(Boolean).join(' ')}</strong>
                  </p>
                )}
              </div>
            </section>

            {garantia && (
              <section className="space-y-1.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-950">
                    <ShieldCheck size={17} className="text-emerald-700" aria-hidden="true" />
                    Garantia de 90 dias do serviço
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      garantia.vigente ? 'border-emerald-300 bg-white text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {garantia.vigente ? 'Vigente' : 'Encerrada'}
                  </span>
                </div>
                <p className="text-xs text-emerald-900">
                  Válida até <strong>{formatarData(garantia.ate)}</strong>, para as peças e os serviços realizados.
                </p>
              </section>
            )}

            {dados.status !== 'descarte' && (
              <section className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <h2 className="text-sm font-bold text-slate-900">Linha do tempo</h2>
                <ol className="space-y-3">
                  {passos.map((passo, idx) => {
                    const concluida = passo.estado === 'concluida';
                    const atual = passo.estado === 'atual';
                    const ultimo = idx === passos.length - 1;
                    return (
                      <li key={passo.chave} className="relative flex gap-3">
                        {!ultimo && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-6 -bottom-3 left-[11px] w-0.5 ${concluida ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          />
                        )}
                        <span className="relative z-10 mt-0.5 shrink-0">
                          {concluida ? (
                            <CheckCircle2 size={22} className="fill-emerald-50 text-emerald-600" aria-hidden="true" />
                          ) : atual ? (
                            <Clock size={22} className="fill-blue-50 text-blue-600" aria-hidden="true" />
                          ) : (
                            <Circle size={22} className="fill-white text-slate-300" aria-hidden="true" />
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 pb-1">
                          <span
                            className={`text-sm ${
                              atual ? 'font-extrabold text-blue-950' : concluida ? 'font-semibold text-slate-800' : 'font-medium text-slate-400'
                            }`}
                          >
                            {passo.rotulo}
                          </span>
                          {passo.quando && (concluida || atual) && (
                            <span className="text-[11px] font-medium text-slate-500">{formatarData(passo.quando)}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

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
    </div>
  );
}
