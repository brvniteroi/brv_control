// Edge Function: criar usuário e redefinir senha (exigem a chave de administrador do
// Supabase, que NUNCA pode ir para o navegador). Só administradores ativos podem chamar.
//
// Publicar: Supabase > Edge Functions > Deploy a new function > nome `gerenciar-usuario`
// (colar este arquivo), ou `supabase functions deploy gerenciar-usuario`.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das funções.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGENS = ['https://control.brvniteroi.com.br', 'http://localhost:5173'];
const PAPEIS = ['admin', 'escritorio', 'tecnico'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const origem = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ORIGENS.includes(origem)) headers['Access-Control-Allow-Origin'] = origem;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // Quem está chamando precisa ser administrador ativo
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token);
    if (erroSessao || !sessao.user) return responder(401, { erro: 'Sessão inválida. Entre novamente.' });
    const { data: chamador } = await admin.from('profiles').select('role, active').eq('id', sessao.user.id).maybeSingle();
    if (!chamador?.active || chamador.role !== 'admin') {
      return responder(403, { erro: 'Só administradores podem gerenciar usuários.' });
    }

    const corpo = await req.json();

    if (corpo.acao === 'criar') {
      const email = String(corpo.email ?? '').trim().toLowerCase();
      const nome = String(corpo.nome ?? '').trim();
      const senha = String(corpo.senha ?? '');
      if (!EMAIL.test(email)) return responder(400, { erro: 'E-mail inválido.' });
      if (!nome) return responder(400, { erro: 'Informe o nome.' });
      if (!PAPEIS.includes(corpo.papel)) return responder(400, { erro: 'Papel inválido.' });
      if (senha.length < 8) return responder(400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });

      const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: nome },
      });
      if (erroCriar || !criado.user) {
        const jaExiste = /already|registered|exists/i.test(erroCriar?.message ?? '');
        return responder(jaExiste ? 409 : 400, {
          erro: jaExiste ? 'Já existe um usuário com este e-mail.' : (erroCriar?.message ?? 'Não foi possível criar o usuário.'),
        });
      }
      const id = criado.user.id;

      // O perfil nasce bloqueado por um gatilho do banco; aqui ele é liberado com o papel escolhido
      const { error: erroPerfil } = await admin
        .from('profiles')
        .update({ role: corpo.papel, active: true, full_name: nome })
        .eq('id', id);
      if (erroPerfil) return responder(500, { erro: `Usuário criado, mas o perfil falhou: ${erroPerfil.message}` });

      if (corpo.colaborador_id) {
        const { error: erroVinculo } = await admin
          .from('employees')
          .update({ profile_id: id })
          .eq('id', corpo.colaborador_id)
          .is('profile_id', null);
        if (erroVinculo) return responder(500, { erro: `Usuário criado, mas o vínculo com o colaborador falhou: ${erroVinculo.message}` });
      }
      return responder(200, { ok: true, id });
    }

    if (corpo.acao === 'redefinir_senha') {
      const senha = String(corpo.senha ?? '');
      if (!corpo.usuario_id) return responder(400, { erro: 'Usuário não informado.' });
      if (senha.length < 8) return responder(400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
      const { error } = await admin.auth.admin.updateUserById(corpo.usuario_id, { password: senha });
      if (error) return responder(400, { erro: error.message });
      return responder(200, { ok: true });
    }

    return responder(400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    console.error(e);
    return responder(500, { erro: 'Erro inesperado na função.' });
  }
});
