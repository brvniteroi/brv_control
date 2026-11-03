// Edge Function: consulta uma OS pelo número e devolve os dados que o BRV Equipamentos precisa
// (cliente, telefone, endereço, relato do cliente, técnico e relato do técnico). Substitui a consulta
// que o BRV Equipamentos fazia na API do Field Control.
//
// Chamada só pelo servidor do BRV Equipamentos (control-proxy.php), que manda o segredo no cabeçalho
// x-segredo. Quem protege é o segredo; o navegador nunca chama esta função.
//
// Publicar: Supabase (projeto do BRV Control) > Edge Functions > Deploy a new function > nome `consultar-os`
// (colar este arquivo) e DESLIGAR "Verify JWT". Depois, em Edge Functions > Secrets, criar
// `EQUIPAMENTOS_SEGREDO` com um valor longo e aleatório (o mesmo vai no secret CONTROL_SEGREDO do
// GitHub do BRV Equipamentos). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente.
import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json' };
const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers });

/** Comparação em tempo constante (evita descobrir o segredo pelo tempo de resposta). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido.' });

  const segredo = Deno.env.get('EQUIPAMENTOS_SEGREDO') ?? '';
  const enviado = req.headers.get('x-segredo') ?? '';
  if (segredo.length < 16 || !iguais(segredo, enviado)) return responder(401, { erro: 'Não autorizado.' });

  try {
    const corpo = await req.json().catch(() => ({}));
    const numero = Number(String(corpo.numero ?? '').replace(/\D/g, ''));
    if (!Number.isSafeInteger(numero) || numero <= 0) return responder(400, { erro: 'Número de OS inválido.' });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const { data: os, error } = await admin
      .from('service_orders')
      .select('id, number, status, description, address_id, customer_id, opened_at')
      .eq('number', numero)
      .maybeSingle();
    if (error) throw error;
    if (!os) return responder(404, { erro: 'OS não encontrada.' });

    const [cliente, contatos, enderecoOS, enderecos, atividades] = await Promise.all([
      admin.from('customers').select('name, trade_name, phone').eq('id', os.customer_id).maybeSingle(),
      admin
        .from('customer_contacts')
        .select('phone, is_primary')
        .eq('customer_id', os.customer_id)
        .not('phone', 'is', null)
        .order('is_primary', { ascending: false })
        .limit(1),
      os.address_id
        ? admin.from('customer_addresses').select('*').eq('id', os.address_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', os.customer_id)
        .eq('active', true)
        .order('is_primary', { ascending: false })
        .limit(1),
      admin
        .from('tasks')
        .select('technician_notes, scheduled_start, status, employees(name)')
        .eq('service_order_id', os.id)
        .neq('status', 'cancelada')
        .order('scheduled_start', { ascending: true, nullsFirst: false }),
    ]);

    const end = enderecoOS.data ?? enderecos.data?.[0] ?? null;
    // Relato e técnico: primeira atividade (por data) que tem relato; sem relato, a primeira atividade.
    const lista = (atividades.data ?? []) as Array<{
      technician_notes: string | null;
      employees: { name: string } | { name: string }[] | null;
    }>;
    const escolhida = lista.find((t) => (t.technician_notes ?? '').trim()) ?? lista[0] ?? null;
    const emp = escolhida?.employees;
    const tecnico = (Array.isArray(emp) ? emp[0]?.name : emp?.name) ?? '';

    return responder(200, {
      numero: os.number,
      status: os.status,
      cliente: {
        nome: cliente.data?.name ?? '',
        telefone: contatos.data?.[0]?.phone ?? cliente.data?.phone ?? '',
      },
      endereco: end
        ? {
            cep: end.zip_code ?? '',
            logradouro: end.street ?? '',
            numero: end.number ?? '',
            complemento: end.complement ?? '',
            bairro: end.district ?? '',
            cidade: end.city ?? '',
            uf: end.state ?? '',
          }
        : null,
      relato_cliente: os.description ?? '',
      tecnico,
      relato_tecnico: (escolhida?.technician_notes ?? '').trim(),
    });
  } catch (e) {
    console.error('consultar-os', e);
    return responder(500, { erro: 'Erro ao consultar a OS.' });
  }
});
