import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AlertTriangle, Bell, BellOff, CloudOff, CloudUpload, KeyRound, LogOut, MapPinOff, RefreshCw, Star } from 'lucide-react';
import { ativarPush, desligarPushDoLogin, estadoPush, type EstadoPush } from '../../services/push';
import { minhasAvaliacoes, type MinhasAvaliacoes } from '../../services/avaliacoes';
import MinhasAvaliacoesModal from './MinhasAvaliacoesModal';
import { useAuth } from '../../contexts/useAuth';
import { meuColaborador, type MeuColaborador } from '../../services/campo';
import { iniciarFila, processarFila } from '../../services/filaCampo';
import { useFilaCampo, useOnline, usePresencaCampo, useRastreioCampo } from '../../hooks/useCampo';
import AlterarSenhaModal from '../AlterarSenhaModal';
import { aparelhoLiberado, guardarMotivoSaida } from '../../services/aparelho';
import { supabase } from '../../services/supabase';
import type { ContextoCampo } from './contextoCampo';

const CHAVE_COLABORADOR = 'brv:campo:colaborador';
/** Período das avaliações mostradas na estrela do cabeçalho. */
const DIAS_AVALIACOES = 30;

/** Casca do app do técnico (/campo): cabeçalho com situação do envio e o colaborador do login. */
export default function CampoLayout() {
  const { user, profile, signOut } = useAuth();
  const online = useOnline();
  const fila = useFilaCampo();
  const [senhaAberta, setSenhaAberta] = useState(false);
  // Guardado no aparelho: abrir o app sem sinal ainda sabe quem é o técnico
  const [colaborador, setColaborador] = useState<MeuColaborador | null | undefined>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CHAVE_COLABORADOR) ?? 'null') as (MeuColaborador & { profileId: string }) | null;
      // Pelo id do login (sessão guardada), não pelo perfil: sem sinal o perfil não carrega
      return c && c.profileId === user?.id ? { id: c.id, name: c.name } : undefined;
    } catch {
      return undefined;
    }
  });
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    iniciarFila();
  }, []);

  useEffect(() => {
    if (!profile || profile.role !== 'tecnico') return;
    meuColaborador(profile.id)
      .then((c) => {
        setColaborador(c);
        if (c) localStorage.setItem(CHAVE_COLABORADOR, JSON.stringify({ ...c, profileId: profile.id }));
      })
      // Sem sinal: com o colaborador guardado segue normal; sem ele, o aviso abaixo aparece
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Sem conexão.'));
  }, [profile]);

  // Posição para a página Mapa do escritório (só técnico com colaborador ligado)
  const ehTecnico = profile?.role === 'tecnico' && !!colaborador;
  const gpsNegado = useRastreioCampo(ehTecnico);
  usePresencaCampo(ehTecnico);

  // Um aparelho por técnico: se o login foi aberto em outro celular, este sai sozinho (confere a cada minuto,
  // ao voltar para o app e quando a internet volta). Sai só DESTE aparelho (scope local), sem derrubar o outro.
  useEffect(() => {
    if (profile?.role !== 'tecnico') return;
    let saindo = false;
    const conferir = async () => {
      if (saindo || !navigator.onLine || document.visibilityState !== 'visible') return;
      if (await aparelhoLiberado()) return;
      saindo = true;
      guardarMotivoSaida(
        'Seu login foi aberto em outro aparelho e saiu deste. Cada técnico usa o sistema em um celular só. Se não foi você, avise o escritório para trocar sua senha.',
      );
      await desligarPushDoLogin();
      await supabase.auth.signOut({ scope: 'local' });
    };
    void conferir();
    const relogio = setInterval(conferir, 60_000);
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('online', conferir);
    return () => {
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('online', conferir);
    };
  }, [profile?.role]);

  // Avaliações dos clientes nos últimos 30 dias (estrela no cabeçalho); sem sinal, a estrela some
  const [avaliacoes, setAvaliacoes] = useState<MinhasAvaliacoes | null>(null);
  const [avaliacoesAbertas, setAvaliacoesAbertas] = useState(false);
  useEffect(() => {
    if (!ehTecnico || !online) return;
    let ativo = true;
    minhasAvaliacoes(DIAS_AVALIACOES)
      .then((d) => ativo && setAvaliacoes(d))
      .catch(() => {
        /* fica sem a estrela */
      });
    return () => {
      ativo = false;
    };
  }, [ehTecnico, online]);

  // Notificação push (agenda mudou com o app fechado): o técnico liga uma vez em cada celular
  const [push, setPush] = useState<EstadoPush>('sem_suporte');
  const [erroPush, setErroPush] = useState<string | null>(null);
  useEffect(() => {
    if (!ehTecnico) return;
    let ativo = true;
    estadoPush()
      .then((e) => ativo && setPush(e))
      .catch((e) => {
        // Mostra o motivo na faixa azul, com o botão "Ativar" para tentar de novo
        if (!ativo) return;
        setPush('desligado');
        setErroPush(`Notificações com erro: ${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      ativo = false;
    };
  }, [ehTecnico]);

  const ligarPush = async () => {
    setErroPush(null);
    try {
      setPush(await ativarPush());
    } catch (e) {
      setErroPush(e instanceof Error ? e.message : 'Não foi possível ativar as notificações.');
    }
  };

  const sair = async () => {
    await desligarPushDoLogin();
    await signOut();
  };

  const comErro = fila.filter((i) => i.erro).length;

  let corpo;
  if (profile && profile.role !== 'tecnico') {
    corpo = (
      <Aviso titulo="Área do técnico">
        Esta área mostra a agenda de quem entra com um login de <b>técnico</b>. Seu login é de{' '}
        {profile.role === 'admin' ? 'administrador' : 'escritório'}.
        <Link to="/" className="mt-4 block font-semibold text-blue-600">Voltar ao sistema</Link>
      </Aviso>
    );
  } else if (colaborador === null) {
    corpo = (
      <Aviso titulo="Login sem colaborador">
        Seu login não está ligado a um colaborador ativo. Peça ao escritório para ligar seu login em Equipe &gt; Colaboradores.
      </Aviso>
    );
  } else if (colaborador === undefined) {
    corpo = erro ? (
      <Aviso titulo="Sem conexão">Abra o app com internet ao menos uma vez para carregar seus dados.</Aviso>
    ) : (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  } else {
    corpo = <Outlet context={{ colaborador } satisfies ContextoCampo} />;
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="sticky top-0 z-30 bg-[#0B1E3F] text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/campo" className="flex min-w-0 flex-1 items-center gap-2.5">
            <img src="/logobrvcontrol.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">BRV Control</div>
              <div className="truncate text-[11px] text-blue-200">{colaborador?.name ?? profile?.full_name}</div>
            </div>
          </Link>
          {avaliacoes && (
            <button
              type="button"
              onClick={() => setAvaliacoesAbertas(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-amber-300 hover:bg-white/10"
              aria-label={`Minhas avaliações dos últimos ${DIAS_AVALIACOES} dias`}
            >
              <Star size={17} className="fill-amber-300" />
              {avaliacoes.media !== null
                ? avaliacoes.media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : '—'}
            </button>
          )}
          <button type="button" onClick={() => setSenhaAberta(true)} className="rounded-lg p-2 text-blue-100 hover:bg-white/10" aria-label="Trocar senha">
            <KeyRound size={18} />
          </button>
          <button type="button" onClick={sair} className="rounded-lg p-2 text-blue-100 hover:bg-white/10" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>

        {(!online || fila.length > 0) && (
          <div
            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold ${
              comErro ? 'bg-red-600' : !online ? 'bg-amber-500 text-amber-950' : 'bg-blue-600'
            }`}
          >
            {comErro ? <AlertTriangle size={14} /> : !online ? <CloudOff size={14} /> : <CloudUpload size={14} />}
            <span>
              {!online && 'Sem internet. '}
              {fila.length > 0 &&
                `${fila.length} ${fila.length === 1 ? 'envio pendente' : 'envios pendentes'}${comErro ? ` (${comErro} com erro)` : ''}`}
              {!online && fila.length === 0 && 'O que você registrar será enviado depois.'}
            </span>
            {online && fila.length > 0 && (
              <button type="button" onClick={() => processarFila(true)} className="ml-1 inline-flex items-center gap-1 underline">
                <RefreshCw size={12} /> Enviar agora
              </button>
            )}
          </div>
        )}

        {ehTecnico && push === 'desligado' && (
          <div className="flex items-center justify-center gap-2 bg-blue-600 px-4 py-1.5 text-xs font-semibold">
            <Bell size={14} className="shrink-0" />
            <span>{erroPush ?? 'Receba um aviso quando entrar serviço novo no seu dia.'}</span>
            <button type="button" onClick={ligarPush} className="ml-1 shrink-0 rounded-md bg-white px-2 py-0.5 font-bold text-blue-700">
              Ativar
            </button>
          </div>
        )}
        {ehTecnico && push === 'negado' && (
          <div className="flex items-center justify-center gap-2 bg-slate-700 px-4 py-1.5 text-xs font-semibold">
            <BellOff size={14} className="shrink-0" />
            <span>Notificações bloqueadas. Libere em Configurações do celular &gt; Apps &gt; Chrome &gt; Notificações.</span>
          </div>
        )}

        {gpsNegado && (
          <div className="flex items-center justify-center gap-2 bg-slate-700 px-4 py-1.5 text-xs font-semibold">
            <MapPinOff size={14} />
            <span>Localização bloqueada. Libere nas configurações do navegador para o escritório te ver no mapa.</span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">{corpo}</main>

      {senhaAberta && <AlterarSenhaModal onFechar={() => setSenhaAberta(false)} />}
      {avaliacoesAbertas && avaliacoes && (
        <MinhasAvaliacoesModal dados={avaliacoes} dias={DIAS_AVALIACOES} onFechar={() => setAvaliacoesAbertas(false)} />
      )}
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-xs">
      <h2 className="mb-2 text-base font-bold text-slate-900">{titulo}</h2>
      {children}
    </div>
  );
}
