// Notificações push no celular do técnico (agenda de hoje mudou). O envio é do banco + Edge Function
// `notificar-tecnico`; aqui só a inscrição do aparelho. Ver migration 20261103110000_notificacoes_push.sql.
// Só funciona no build (o service worker não é registrado no `npm run dev`).
import { supabase } from './supabase';

export type EstadoPush = 'sem_suporte' | 'negado' | 'desligado' | 'ligado';

function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registroSW(): Promise<ServiceWorkerRegistration | undefined> {
  return suportaPush() ? navigator.serviceWorker.getRegistration() : undefined;
}

function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function salvarInscricao(sub: PushSubscription): Promise<void> {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('registrar_push', {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

/**
 * Situação do aparelho. Já ligado: confirma a inscrição no servidor (o mesmo celular com outro
 * login passa a avisar o novo técnico).
 */
export async function estadoPush(): Promise<EstadoPush> {
  const reg = await registroSW();
  if (!reg) return 'sem_suporte';
  if (Notification.permission === 'denied') return 'negado';
  const sub = await reg.pushManager.getSubscription();
  if (Notification.permission !== 'granted' || !sub) return 'desligado';
  await salvarInscricao(sub).catch(() => {
    /* sem sinal: confirma na próxima vez */
  });
  return 'ligado';
}

/** Pede a permissão e inscreve o aparelho. Precisa ser chamada no toque de um botão. */
export async function ativarPush(): Promise<EstadoPush> {
  const reg = await registroSW();
  if (!reg) return 'sem_suporte';
  const permissao = await Notification.requestPermission();
  if (permissao === 'denied') return 'negado';
  if (permissao !== 'granted') return 'desligado';

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data: chave, error } = await supabase.rpc('push_chave_publica');
    if (error) throw new Error(error.message);
    if (!chave) throw new Error('As notificações ainda não foram configuradas no servidor.');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave as string) });
  }
  await salvarInscricao(sub);
  return 'ligado';
}

/** Ao sair: este aparelho deixa de receber os avisos deste login. */
export async function desligarPushDoLogin(): Promise<void> {
  try {
    const sub = await (await registroSW())?.pushManager.getSubscription();
    if (sub) await supabase.rpc('remover_push', { p_endpoint: sub.endpoint });
  } catch {
    /* sem sinal: o próximo login no aparelho assume a inscrição */
  }
}
