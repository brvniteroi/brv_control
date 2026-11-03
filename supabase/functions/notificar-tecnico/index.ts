// Edge Function: envia a notificação push para os celulares do técnico quando o escritório mexe na
// agenda de hoje dele. Chamada só pelo banco (trigger tasks_notifica_tecnico -> pg_net), que manda o
// segredo de public.push_config no cabeçalho x-segredo. Ver migration 20261103110000_notificacoes_push.sql.
//
// Publicar: Supabase > Edge Functions > Deploy a new function > nome `notificar-tecnico` (colar este
// arquivo) e DESLIGAR "Verify JWT" (o banco não manda login; quem protege é o segredo).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das funções.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const EVENTOS = ['nova', 'horario', 'removida', 'cancelada'] as const;
type Evento = (typeof EVENTOS)[number];

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

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
  if (!aparelhos?.length) return responder(200, { enviados: 0 });

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
  await Promise.all(
    aparelhos.map(async (a) => {
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
