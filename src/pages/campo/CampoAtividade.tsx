import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Play,
  Wrench,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  atividadeDoCache,
  atualizarNoCache,
  bloqueioDeInicio,
  carregarAtividade,
  carregarMinhaAgenda,
  enderecoDaAtividade,
  lerCacheAgenda,
  linkGoogleMaps,
  obterPosicao,
  salvarCacheAgenda,
  textoEnderecoCampo,
  type AtividadeCampo,
} from '../../services/campo';
import { comPendentes, enfileirarAtividade } from '../../services/filaCampo';
import { useContextoCampo } from '../../components/campo/contextoCampo';
import { useFilaCampo, useOnline } from '../../hooks/useCampo';
import FotosAtividade from '../../components/campo/FotosAtividade';
import ConcluirAtividadeModal, { type DadosConclusao } from '../../components/campo/ConcluirAtividadeModal';
import FormulariosAtividade from '../../components/formularios/FormulariosAtividade';
import { formatarDataHora, infoStatusAtividade } from '../../utils/ordens';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
/** Momento da ação do técnico (vale a hora do aparelho, mesmo se o envio for depois). */
const agoraISO = () => new Date().toISOString();

export default function CampoAtividade() {
  const { id = '' } = useParams();
  const { colaborador } = useContextoCampo();
  const fila = useFilaCampo();
  const online = useOnline();
  const [servidor, setServidor] = useState<AtividadeCampo | null>(() => atividadeDoCache(id));
  // Agenda de hoje: decide se a anterior já foi concluída
  const [doDia, setDoDia] = useState<AtividadeCampo[]>(() => lerCacheAgenda(colaborador.id)?.itens ?? []);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);

  const carregar = useCallback(async () => {
    carregarMinhaAgenda(colaborador.id).then(
      (dados) => {
        setDoDia(dados);
        salvarCacheAgenda(colaborador.id, dados);
      },
      () => { /* sem sinal: fica com o cache */ },
    );
    try {
      const a = await carregarAtividade(id);
      if (a) {
        setServidor(a);
        atualizarNoCache(a);
        setErro(null);
      } else {
        setErro('Atividade não encontrada ou não está mais com você.');
      }
    } catch (e) {
      // Sem sinal: fica com a versão do cache (se houver)
      if (!atividadeDoCache(id)) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a atividade.');
    } finally {
      setCarregando(false);
    }
  }, [id, colaborador.id]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inicial = setTimeout(carregar, 0);
    // Todas as atividades do técnico (RLS): a conclusão da anterior pelo escritório libera esta
    const canal = supabase
      .channel(`campo:atividade:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        clearTimeout(timer);
        timer = setTimeout(carregar, 600);
      })
      .subscribe();
    const aoVoltar = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', carregar);
    return () => {
      clearTimeout(inicial);
      clearTimeout(timer);
      supabase.removeChannel(canal);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', carregar);
    };
  }, [carregar, id]);

  if (!servidor) {
    return carregando ? (
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
    ) : (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        {erro ?? 'Atividade não encontrada.'}
        <Link to="/campo" className="mt-4 block font-semibold text-blue-600">Voltar para a agenda</Link>
      </div>
    );
  }

  // O que o técnico vê = servidor + ações ainda na fila do aparelho
  const a = comPendentes(servidor, fila);
  const ordem = a.ordem;
  const cliente = ordem?.cliente;
  const end = enderecoDaAtividade(a);
  const st = infoStatusAtividade(a.status);
  const pendentes = fila.filter((i) => i.taskId === a.id && i.tipo === 'atividade');
  const aberta = a.status !== 'concluida' && a.status !== 'cancelada';
  // Sair / iniciar só na primeira do dia ou logo depois de uma concluída (já a caminho segue liberado)
  const bloqueio =
    a.status === 'agendada'
      ? bloqueioDeInicio(a, [...doDia.filter((x) => x.id !== a.id).map((x) => comPendentes(x, fila)), a])
      : null;

  const executar = async (rotulo: string, fn: () => Promise<void>) => {
    setAcao(rotulo);
    try {
      await fn();
    } finally {
      setAcao(null);
    }
  };

  const aCaminho = () => executar('caminho', () => enfileirarAtividade(a.id, { status: 'em_deslocamento' }));

  const iniciar = () =>
    executar('iniciar', async () => {
      const pos = await obterPosicao();
      await enfileirarAtividade(a.id, {
        status: 'em_execucao',
        started_at: agoraISO(),
        checkin_lat: pos?.lat ?? null,
        checkin_lng: pos?.lng ?? null,
      });
    });

  const concluir = async ({ relato }: DadosConclusao) => {
    const pos = await obterPosicao();
    const agora = agoraISO();
    await enfileirarAtividade(a.id, {
      status: 'concluida',
      // Concluir sem ter iniciado: o banco exige início para ter fim
      started_at: a.started_at ?? agora,
      finished_at: agora,
      checkout_lat: pos?.lat ?? null,
      checkout_lng: pos?.lng ?? null,
      technician_notes: relato,
    });
    setConcluindo(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Link to="/campo" className="rounded-lg p-1.5 text-slate-600 hover:bg-white" aria-label="Voltar">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-slate-500">
            {ordem ? `OS ${ordem.number}` : 'Atividade'}{ordem?.tipo ? ` · ${ordem.tipo.name}` : ''}
          </div>
          <h1 className="truncate text-base font-bold text-slate-900">{cliente?.trade_name || cliente?.name || a.title}</h1>
        </div>
      </div>

      {/* Situação e ações */}
      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${st.classe}`}>{st.rotulo}</span>
          <span className="text-xs text-slate-500">
            {a.scheduled_start && formatarDataHora(a.scheduled_start)}
            {a.scheduled_end && ` - ${hora.format(new Date(a.scheduled_end))}`}
          </span>
        </div>
        {pendentes.length > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
            {online ? 'Enviando para o escritório...' : 'Registrado no celular. Será enviado quando houver internet.'}
            {pendentes.some((p) => p.erro) && <span className="block text-red-700">Erro: {pendentes.find((p) => p.erro)?.erro}</span>}
          </p>
        )}

        {aberta && bloqueio && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-600">
            <Lock size={16} className="shrink-0" /> {bloqueio}
          </p>
        )}
        {aberta && !bloqueio && (
          <div className="mt-3 grid gap-2">
            {a.status === 'agendada' && (
              <BotaoAcao onClick={aCaminho} carregando={acao === 'caminho'} cor="bg-indigo-600 active:bg-indigo-700" icone={<Car size={18} />}>
                Estou a caminho
              </BotaoAcao>
            )}
            {(a.status === 'agendada' || a.status === 'em_deslocamento') && (
              <BotaoAcao onClick={iniciar} carregando={acao === 'iniciar'} cor="bg-orange-600 active:bg-orange-700" icone={<Play size={18} />}>
                {acao === 'iniciar' ? 'Obtendo localização...' : 'Iniciar atendimento'}
              </BotaoAcao>
            )}
            {a.status === 'em_execucao' && (
              <BotaoAcao onClick={() => setConcluindo(true)} cor="bg-green-600 active:bg-green-700" icone={<CheckCircle2 size={18} />}>
                Concluir atividade
              </BotaoAcao>
            )}
          </div>
        )}

        {(a.started_at || a.finished_at) && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
            {a.started_at && <div>Início: <b className="text-slate-700">{formatarDataHora(a.started_at)}</b></div>}
            {a.finished_at && <div>Fim: <b className="text-slate-700">{formatarDataHora(a.finished_at)}</b></div>}
          </div>
        )}
        {a.technician_notes && a.status === 'concluida' && (
          <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">{a.technician_notes}</p>
        )}
      </Cartao>

      {/* O que fazer */}
      {(ordem?.description || a.description) && (
        <Cartao titulo="Serviço solicitado">
          {ordem?.priority && ordem.priority !== 'normal' && ordem.priority !== 'baixa' && (
            <span className="mb-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700">
              Prioridade {ordem.priority}
            </span>
          )}
          {ordem?.description && <p className="whitespace-pre-line text-sm text-slate-700">{ordem.description}</p>}
          {a.description && a.description !== ordem?.description && (
            <p className="mt-2 whitespace-pre-line border-t border-slate-100 pt-2 text-sm text-slate-700">{a.description}</p>
          )}
        </Cartao>
      )}

      {/* Cliente e endereço (sem telefone: o técnico não vê contatos) */}
      <Cartao titulo="Cliente">
        <div className="text-sm font-bold text-slate-900">{cliente?.name}</div>
        {cliente?.trade_name && cliente.trade_name !== cliente.name && <div className="text-xs text-slate-500">{cliente.trade_name}</div>}

        {end && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex gap-2 text-sm text-slate-700">
              <MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <div>
                {end.label && end.label !== 'Principal' && <div className="text-xs font-semibold text-slate-500">{end.label}</div>}
                {textoEnderecoCampo(end)}
                {end.reference && <div className="mt-0.5 text-xs text-slate-500">Ref.: {end.reference}</div>}
              </div>
            </div>
            <a href={linkGoogleMaps(end)} target="_blank" rel="noreferrer" className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700">
              <Navigation size={15} /> Abrir no Google Maps
            </a>
          </div>
        )}
      </Cartao>

      {ordem && ordem.equipamentos.length > 0 && (
        <Cartao titulo="Equipamentos">
          <div className="space-y-2">
            {ordem.equipamentos.map(({ equipamento: eq, service_performed }) =>
              eq ? (
                <div key={eq.id} className="flex gap-2.5 rounded-xl bg-slate-50 p-2.5">
                  <Wrench size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold text-slate-800">
                      {eq.category}{[eq.brand, eq.model].some(Boolean) ? ` · ${[eq.brand, eq.model].filter(Boolean).join(' ')}` : ''}
                    </div>
                    <div className="text-slate-500">
                      {[eq.capacity_btu && `${eq.capacity_btu.toLocaleString('pt-BR')} BTU`, eq.location, eq.qr_code && `Etiqueta ${eq.qr_code}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {service_performed && <div className="mt-1 text-slate-600">{service_performed}</div>}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </Cartao>
      )}

      {ordem && (
        <Cartao titulo="Fotos">
          <FotosAtividade taskId={a.id} serviceOrderId={ordem.id} />
        </Cartao>
      )}

      <Cartao titulo="Formulários">
        {online ? (
          <FormulariosAtividade taskId={a.id} clienteId={cliente?.id} />
        ) : (
          <p className="text-xs text-slate-500">Os formulários precisam de internet. Preencha quando tiver sinal.</p>
        )}
      </Cartao>

      {concluindo && (
        <ConcluirAtividadeModal relatoInicial={a.technician_notes ?? ''} onConfirmar={concluir} onFechar={() => setConcluindo(false)} />
      )}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      {titulo && <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>}
      {children}
    </section>
  );
}

function BotaoAcao({
  onClick,
  carregando,
  cor,
  icone,
  children,
}: {
  onClick: () => void;
  carregando?: boolean;
  cor: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-60 ${cor}`}
    >
      {carregando ? <Loader2 size={18} className="animate-spin" /> : icone}
      {children}
    </button>
  );
}
