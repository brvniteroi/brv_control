import { useEffect, useState, useSyncExternalStore } from 'react';
import { assinarFila, itensFila } from '../services/filaCampo';
import { distanciaMetros, enviarPosicao, enviarPresenca, type Posicao } from '../services/campo';
import { BackgroundGeolocation, ehApp } from '../services/nativo';

/** Itens ainda não enviados da fila do app de campo (atualiza sozinho). */
export function useFilaCampo() {
  return useSyncExternalStore(assinarFila, itensFila);
}

function assinarConexao(fn: () => void) {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

/** true quando o aparelho diz que tem rede. */
export function useOnline() {
  return useSyncExternalStore(assinarConexao, () => navigator.onLine);
}

/** Sinal de vida a cada minuto, com internet (no navegador só com o app visível; alimenta o "online" do escritório). */
export function usePresencaCampo(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const enviar = () => {
      if ((!ehApp && document.visibilityState !== 'visible') || !navigator.onLine) return;
      enviarPresenca().catch(() => {
        /* tenta de novo no próximo minuto */
      });
    };
    enviar();
    const relogio = setInterval(enviar, 60_000);
    document.addEventListener('visibilitychange', enviar);
    window.addEventListener('online', enviar);
    return () => {
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', enviar);
      window.removeEventListener('online', enviar);
    };
  }, [ativo]);
}

/** No máximo um envio por minuto. */
const INTERVALO_MS = 60_000;
/** Parado no mesmo lugar: reenvia a cada 5 min (o mapa mostra que o app segue aberto). */
const PARADO_MS = 5 * 60_000;
/** Menos que isso é só a imprecisão do GPS. */
const DISTANCIA_MINIMA_M = 30;

/**
 * Envia a posição do técnico para a página Mapa enquanto o app está aberto.
 * Sem sinal não guarda nada (só interessa a posição atual). O navegador não deixa um app
 * web seguir o GPS com a tela apagada ou o app fechado: aí o mapa mostra a última posição.
 * Devolve true se o técnico negou a localização.
 */
export function useRastreioCampo(ativo: boolean): boolean {
  const [negado, setNegado] = useState(false);

  useEffect(() => {
    if (!ativo || (!ehApp && !('geolocation' in navigator))) return;
    let ultimo: (Posicao & { em: number }) | null = null;
    let enviando = false;

    const receber = (lat: number, lng: number, precisao: number) => {
      setNegado(false);
      const agora = Date.now();
      const atual = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      if (ultimo) {
        const decorrido = agora - ultimo.em;
        if (decorrido < INTERVALO_MS) return;
        if (decorrido < PARADO_MS && distanciaMetros(ultimo, atual) < DISTANCIA_MINIMA_M) return;
      }
      if (enviando || !navigator.onLine) return;
      enviando = true;
      enviarPosicao(atual, precisao)
        .then(() => {
          ultimo = { ...atual, em: agora };
        })
        .catch(() => {
          /* tenta de novo na próxima leitura */
        })
        .finally(() => {
          enviando = false;
        });
    };
    const aoLer = (p: GeolocationPosition) => receber(p.coords.latitude, p.coords.longitude, p.coords.accuracy);

    // No APK: GPS em segundo plano (serviço em primeiro plano com notificação fixa), mesmo com a tela apagada
    if (ehApp) {
      let idVigia: string | undefined;
      let cancelado = false;
      BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'BRV Control',
          backgroundMessage: 'Compartilhando sua posição com o escritório durante o atendimento.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        },
        (local, erro) => {
          if (erro) {
            if (erro.code === 'NOT_AUTHORIZED') setNegado(true);
            return;
          }
          if (local) receber(local.latitude, local.longitude, local.accuracy);
        },
      ).then((id) => {
        if (cancelado) void BackgroundGeolocation.removeWatcher({ id });
        else idVigia = id;
      });
      return () => {
        cancelado = true;
        if (idVigia) void BackgroundGeolocation.removeWatcher({ id: idVigia });
      };
    }

    const aoErro = (e: GeolocationPositionError) => {
      if (e.code === e.PERMISSION_DENIED) setNegado(true);
    };
    const opcoes: PositionOptions = { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 };

    const vigia = navigator.geolocation.watchPosition(aoLer, aoErro, opcoes);
    // Parado, o watchPosition quase não dispara: lê de tempos em tempos para manter o mapa em dia
    const relogio = setInterval(() => navigator.geolocation.getCurrentPosition(aoLer, aoErro, opcoes), PARADO_MS);
    // Ao voltar para o app (tela acesa de novo), manda logo a posição
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') {
        ultimo = null;
        navigator.geolocation.getCurrentPosition(aoLer, aoErro, opcoes);
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      navigator.geolocation.clearWatch(vigia);
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [ativo]);

  return negado;
}
