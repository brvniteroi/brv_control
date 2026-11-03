// Edge Function: envia a notificação push para os celulares do técnico quando o escritório mexe na
// agenda de hoje dele. Chamada só pelo banco (trigger tasks_notifica_tecnico -> pg_net), que manda o
// segredo de public.push_config no cabeçalho x-segredo. Ver migration 20261103110000_notificacoes_push.sql.
//
// Publicar: Supabase > Edge Functions > Deploy a new function > nome `notificar-tecnico` (colar este
// arquivo) e DESLIGAR "Verify JWT" (o banco não manda login; quem protege é o segredo).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das funções.
// APK Android: além do Web Push, envia pelo Firebase (FCM) para public.push_fcm_tokens. Precisa do segredo
// FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço do projeto Firebase) em Edge Functions > Secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const EVENTOS = ['nova', 'horario', 'removida', 'cancelada'] as const;
type Evento = (typeof EVENTOS)[number];

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// ---- Firebase Cloud Messaging (API HTTP v1) ----

interface ContaServico {
  project_id: string;
  client_email: string;
  private_key: string;
}

const b64url = (dados: ArrayBuffer | string) => {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Token de acesso do Google (OAuth2 com JWT assinado pela conta de serviço). */
async function tokenFirebase(conta: ContaServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const pem = conta.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const chave = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cabecalho}.${corpo}`));
  const jwt = `${cabecalho}.${corpo}.${b64url(assinatura)}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`token Firebase: ${r.status} ${JSON.stringify(j)}`);
  return j.access_token as string;
}

Deno.serve(async (req) => {
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: cfg, error: erroCfg } = await sb.from('push_config').select('*').eq('id', 1).maybeSingle();
  if (erroCfg || !cfg?.vapid_private) return responder(500, { erro: 'Push não configurado.' });
  if (req.headers.get('x-segredo') !== cfg.segredo) return responder(401, { erro: 'Não autorizado.' });

  const { employee_id, task_id, evento } = (await req.json()) as { employee_id: string; task_id: string; evento: Evento };
  if (!EVENTOS.includes(evento)) return responder(400, { erro: 'Evento inválido.' });

  const { data: t } = await sb
    .from('tasks')
    .select('id, title, scheduled_start, ordem:service_orders(number, tipo:service_types!service_type_id(name), cliente:customers!customer_id(name, trade_name))')
    .eq('id', task_id)
    .maybeSingle();
  if (!t) return responder(200, { enviados: 0, motivo: 'atividade não existe mais' });

  const { data: colab } = await sb.from('employees').select('profile_id').eq('id', employee_id).maybeSingle();
  if (!colab?.profile_id) return responder(200, { enviados: 0 });
  const { data: aparelhos } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('profile_id', colab.profile_id);
  const { data: tokensFcm } = await sb.from('push_fcm_tokens').select('id, token').eq('profile_id', colab.profile_id);
  if (!aparelhos?.length && !tokensFcm?.length) return responder(200, { enviados: 0 });

  // deno-lint-ignore no-explicit-any
  const o = t.ordem as any;
  const cliente = o?.cliente?.trade_name || o?.cliente?.name || 'Cliente';
  const as = t.scheduled_start ? hora.format(new Date(t.scheduled_start)) : '';
  const titulo = {
    nova: `Nova atividade hoje${as ? ` às ${as}` : ''}`,
    horario: `Horário alterado: agora às ${as}`,
    removida: 'Atividade retirada da sua agenda de hoje',
    cancelada: 'Atividade cancelada',
  }[evento];
  const corpo = [o?.number ? `OS ${o.number}` : null, cliente, o?.tipo?.name ?? t.title].filter(Boolean).join(' · ');
  const payload = JSON.stringify({
    titulo,
    corpo,
    url: evento === 'nova' || evento === 'horario' ? `/campo/atividade/${t.id}` : '/campo',
    // Mesma atividade: a notificação nova substitui a anterior
    tag: `atividade-${t.id}`,
  });

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  let enviados = 0;

  // APK Android (Firebase)
  const segredoFirebase = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (tokensFcm?.length && segredoFirebase) {
    try {
      const conta = JSON.parse(segredoFirebase) as ContaServico;
      const acesso = await tokenFirebase(conta);
      const dados = JSON.parse(payload) as { titulo: string; corpo: string; url: string; tag: string };
      await Promise.all(
        tokensFcm.map(async (t) => {
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: { title: dados.titulo, body: dados.corpo },
                data: { url: dados.url, tag: dados.tag },
                android: { priority: 'HIGH', ttl: `${4 * 3600}s`, notification: { tag: dados.tag } },
              },
            }),
          });
          if (r.ok) {
            enviados++;
            return;
          }
          const erro = await r.json().catch(() => null);
          const codigo = JSON.stringify(erro);
          // Token vencido ou app desinstalado: remove
          if (r.status === 404 || codigo.includes('UNREGISTERED')) await sb.from('push_fcm_tokens').delete().eq('id', t.id);
          else console.error('fcm', r.status, codigo);
        }),
      );
    } catch (e) {
      console.error('fcm', (e as Error).message);
    }
  } else if (tokensFcm?.length) {
    console.error('fcm: falta o segredo FIREBASE_SERVICE_ACCOUNT');
  }

  await Promise.all(
    (aparelhos ?? []).map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
          TTL: 4 * 3600,
          urgency: 'high',
        });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Inscrição vencida ou app desinstalado: remove
        if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('id', a.id);
        else console.error('push', status, (e as Error).message);
      }
    }),
  );
  return responder(200, { enviados });
});
