// Notificações push no celular do técnico (agenda de hoje mudou). O envio é do banco + Edge Function
// `notificar-tecnico`; aqui só a inscrição do aparelho. Ver migration 20261103110000_notificacoes_push.sql.
// Só funciona no build (o service worker não é registrado no `npm run dev`).
import { supabase } from './supabase';
import { registerPlugin } from '@capacitor/core';
import type { PushNotificationsPlugin } from '@capacitor/push-notifications';
import { ehApp } from './nativo';

export type EstadoPush = 'sem_suporte' | 'negado' | 'desligado' | 'ligado';

// ---- APK (Capacitor): push nativo pelo Firebase (FCM); o Web Push não funciona no WebView ----

const CHAVE_TOKEN_FCM = 'brv_fcm_token';
let ouvintesNativos = false;

// TEMPORÁRIO (2026-11-08): diagnóstico do registro no Firebase, mostrado no app de campo dentro do APK.
// Remover depois que o registro funcionar no Samsung A20 do Alberto.
export const diagPush: string[] = [];
const passo = (s: string) => {
  diagPush.push(s);
};

// Import direto: um plugin do Capacitor NUNCA pode ser devolvido por função async nem passar por `await`. O proxy
// do plugin responde a qualquer propriedade, inclusive `then`, então o JS o trata como promessa e chama
// "PushNotifications.then" no Android, que nunca responde: o registro travava em silêncio (achado no A20, 2026-11-08).
const PushNotifications = registerPlugin<PushNotificationsPlugin>('PushNotifications');

async function salvarTokenFcm(token: string): Promise<void> {
  localStorage.setItem(CHAVE_TOKEN_FCM, token);
  const { error } = await supabase.rpc('registrar_push_fcm', { p_token: token, p_user_agent: navigator.userAgent });
  if (error) throw new Error(error.message);
}

/** Registra os ouvintes uma vez: token novo do Firebase e toque na notificação (abre a atividade). */
async function iniciarOuvintesNativos(): Promise<void> {
  if (ouvintesNativos) return;
  ouvintesNativos = true;
  const push = PushNotifications;
  await push.addListener('registration', (t) => {
    salvarTokenFcm(t.value).catch(() => {
      /* sem sinal: confirma na próxima abertura */
    });
  });
  await push.addListener('pushNotificationActionPerformed', (a) => {
    const url = (a.notification.data as { url?: string } | undefined)?.url;
    if (url && url.startsWith('/campo')) window.location.assign(url);
  });
}

/** Registra no Firebase e espera o token (máx. 15 s). */
async function registrarNativo(): Promise<string> {
  const push = PushNotifications;
  await iniciarOuvintesNativos();
  return new Promise<string>((resolve, reject) => {
    const limite = setTimeout(() => {
      passo('sem resposta do Firebase em 15 s');
      reject(new Error('O Firebase não respondeu. Tente de novo com internet.'));
    }, 15000);
    void push.addListener('registration', (t) => {
      clearTimeout(limite);
      passo(`token recebido (${t.value.length} car.)`);
      resolve(t.value);
    });
    void push.addListener('registrationError', (e) => {
      clearTimeout(limite);
      passo(`registrationError: ${e.error}`);
      reject(new Error(e.error || 'Não foi possível registrar as notificações.'));
    });
    passo('register()');
    // A chamada pode falhar direto (Firebase não iniciado), sem evento registrationError
    push.register().catch((e: unknown) => {
      clearTimeout(limite);
      const msg = e instanceof Error ? e.message : String(e);
      passo(`register falhou: ${msg}`);
      reject(new Error(msg));
    });
  });
}

async function estadoPushNativo(): Promise<EstadoPush> {
  passo('APK');
  const push = PushNotifications;
  const { receive } = await push.checkPermissions();
  passo(`permissão: ${receive}`);
  if (receive === 'denied') return 'negado';
  if (receive !== 'granted') return 'desligado';
  // Android < 13 já nasce com permissão: o registro acontece aqui, sem botão. Espera o token e o salvamento
  // para que um erro (Firebase, servidor) apareça na tela em vez de sumir em silêncio
  const token = await registrarNativo();
  try {
    await salvarTokenFcm(token);
    passo('salvo no servidor');
  } catch (e) {
    passo(`erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
  return 'ligado';
}

async function ativarPushNativo(): Promise<EstadoPush> {
  const push = PushNotifications;
  const { receive } = await push.requestPermissions();
  if (receive === 'denied') return 'negado';
  if (receive !== 'granted') return 'desligado';
  await salvarTokenFcm(await registrarNativo());
  return 'ligado';
}

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
  if (ehApp) return estadoPushNativo();
  if (/; wv\)/.test(navigator.userAgent)) passo('WebView sem Capacitor (ehApp = false)');
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
  if (ehApp) return ativarPushNativo();
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
    if (ehApp) {
      const token = localStorage.getItem(CHAVE_TOKEN_FCM);
      if (token) await supabase.rpc('remover_push_fcm', { p_token: token });
      return;
    }
    const sub = await (await registroSW())?.pushManager.getSubscription();
    if (sub) await supabase.rpc('remover_push', { p_endpoint: sub.endpoint });
  } catch {
    /* sem sinal: o próximo login no aparelho assume a inscrição */
  }
}
