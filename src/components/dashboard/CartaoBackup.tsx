import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Loader2, MonitorCheck, MonitorOff } from 'lucide-react';
import {
  MINUTOS_AGENTE_ONLINE,
  carregarBackups,
  pedirBackup,
  type EstadoBackup,
  type ExecucaoBackup,
} from '../../services/backup';
import { formatarDataHora } from '../../utils/ordens';

/** Sem backup concluído há mais de 4 dias (cobre o fim de semana) = atenção. */
const DIAS_ALERTA = 4;

const ROTULO_STATUS: Record<ExecucaoBackup['status'], string> = {
  pendente: 'Aguardando o PC',
  executando: 'Em andamento',
  ok: 'Concluído',
  falhou: 'Falhou',
};

const COR_STATUS: Record<ExecucaoBackup['status'], string> = {
  pendente: 'border-amber-200 bg-amber-50 text-amber-800',
  executando: 'border-blue-200 bg-blue-50 text-blue-800',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  falhou: 'border-rose-200 bg-rose-50 text-rose-800',
};

function haQuanto(iso: string, agoraMs: number): string {
  const min = Math.max(0, Math.round((agoraMs - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** Cartão do Dashboard (só administrador): situação do backup, PC da empresa online e o botão "Fazer backup agora". */
export default function CartaoBackup() {
  const [estado, setEstado] = useState<EstadoBackup | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [erroPedido, setErroPedido] = useState<string | null>(null);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [verDetalhe, setVerDetalhe] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      setEstado(await carregarBackups());
      setErroCarga(null);
    } catch (err) {
      console.error('Erro ao carregar o backup:', err);
      setErroCarga('Não foi possível carregar a situação do backup.');
    }
    setAgoraMs(Date.now());
  }, []);

  const execucoes = estado?.execucoes ?? [];
  const emCurso = execucoes.find((x) => x.origem === 'manual' && (x.status === 'pendente' || x.status === 'executando'));

  // Consulta a cada 5 s enquanto há um pedido em curso (o resultado aparece sozinho) e a cada 30 s no resto do tempo
  const haPedidoEmCurso = !!emCurso;
  useEffect(() => {
    let ativo = true;
    const carregar = () =>
      carregarBackups()
        .then((novo) => {
          if (!ativo) return;
          setEstado(novo);
          setErroCarga(null);
          setAgoraMs(Date.now());
        })
        .catch((err) => {
          if (!ativo) return;
          console.error('Erro ao carregar o backup:', err);
          setErroCarga('Não foi possível carregar a situação do backup.');
        });
    void carregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void carregar();
    }, haPedidoEmCurso ? 5_000 : 30_000);
    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [haPedidoEmCurso]);

  const ultimaFinalizada = execucoes.find((x) => x.status === 'ok' || x.status === 'falhou');
  const ultimaOk = execucoes.find((x) => x.status === 'ok');
  const dataUltimaOk = ultimaOk ? (ultimaOk.finished_at ?? ultimaOk.requested_at) : null;
  const idadeDias = dataUltimaOk ? (agoraMs - new Date(dataUltimaOk).getTime()) / 86_400_000 : null;
  const pcOnline =
    !!estado?.agenteVistoEm && agoraMs - new Date(estado.agenteVistoEm).getTime() < MINUTOS_AGENTE_ONLINE * 60_000;

  let situacao: 'ok' | 'atencao' | 'sem-registro' = 'sem-registro';
  let motivo: string | null = null;
  if (execucoes.length > 0) {
    if (ultimaFinalizada?.status === 'falhou') {
      situacao = 'atencao';
      motivo = 'O último backup falhou. Veja os detalhes e peça outro.';
    } else if (idadeDias === null || idadeDias > DIAS_ALERTA) {
      situacao = 'atencao';
      motivo = `Faz mais de ${DIAS_ALERTA} dias sem um backup concluído.`;
    } else {
      situacao = 'ok';
    }
  }

  const fazerBackup = async () => {
    setPedindo(true);
    setErroPedido(null);
    try {
      await pedirBackup();
      await atualizar();
    } catch (err) {
      setErroPedido(err instanceof Error ? err.message : 'Não foi possível pedir o backup.');
    } finally {
      setPedindo(false);
    }
  };

  const botaoDesligado = pedindo || !!emCurso || !pcOnline;
  const detalheFalha = ultimaFinalizada?.status === 'falhou' ? ultimaFinalizada.detalhe : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5" aria-label="Backup do sistema">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <DatabaseBackup size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Backup do sistema</h2>
            <p className="text-[11px] text-slate-500">Banco de dados e fotos, gravados no PC da empresa. Só o administrador vê este cartão.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              pcOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
            title={estado?.agenteVistoEm ? `Último sinal ${haQuanto(estado.agenteVistoEm, agoraMs)}` : 'O vigia do backup nunca respondeu'}
          >
            {pcOnline ? <MonitorCheck size={13} aria-hidden="true" /> : <MonitorOff size={13} aria-hidden="true" />}
            {pcOnline ? 'PC da empresa online' : 'PC da empresa offline'}
          </span>
          <button
            type="button"
            onClick={() => void fazerBackup()}
            disabled={botaoDesligado}
            title={!pcOnline ? 'O PC da empresa precisa estar ligado' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pedindo || emCurso ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <DatabaseBackup size={14} aria-hidden="true" />}
            {emCurso?.status === 'executando'
              ? 'Backup em andamento...'
              : emCurso
                ? 'Aguardando o PC...'
                : 'Fazer backup agora'}
          </button>
        </div>
      </div>

      {erroCarga && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          {erroCarga}
        </p>
      )}
      {erroPedido && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          {erroPedido}
        </p>
      )}

      {estado && (
        <div className="mt-3 space-y-2">
          <div
            className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
              situacao === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : situacao === 'atencao'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {situacao === 'ok' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertTriangle size={15} className={`shrink-0 ${situacao === 'atencao' ? 'text-rose-600' : 'text-slate-400'}`} aria-hidden="true" />
            )}
            <span className="font-semibold">
              {ultimaOk
                ? `Último backup concluído: ${formatarDataHora(dataUltimaOk)} (${ultimaOk.origem === 'manual' ? 'pedido pelo botão' : 'agendado'})`
                : 'Nenhum backup registrado ainda neste painel.'}
            </span>
            {motivo && <span>{motivo}</span>}
            {!ultimaOk && execucoes.length === 0 && (
              <span className="text-slate-500">O próximo backup agendado (seg a sex, 9h) aparece aqui, ou peça um agora.</span>
            )}
          </div>

          {detalheFalha && (
            <div>
              <button
                type="button"
                onClick={() => setVerDetalhe((v) => !v)}
                className="text-[11px] font-semibold text-rose-700 underline"
              >
                {verDetalhe ? 'Esconder detalhes da falha' : 'Ver detalhes da falha'}
              </button>
              {verDetalhe && (
                <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-700">
                  {detalheFalha}
                </pre>
              )}
            </div>
          )}

          {execucoes.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-xs" aria-label="Últimos backups">
              {execucoes.slice(0, 4).map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                  <span className="text-slate-700">
                    {formatarDataHora(x.finished_at ?? x.started_at ?? x.requested_at)}
                    <span className="ml-2 text-slate-400">{x.origem === 'manual' ? 'pedido pelo botão' : 'agendado'}</span>
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${COR_STATUS[x.status]}`}>
                    {ROTULO_STATUS[x.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
