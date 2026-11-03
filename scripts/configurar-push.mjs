// Gera as chaves VAPID das notificações push e grava em public.push_config (uma vez só).
// A chave privada vai direto do computador para o banco: não aparece na tela nem vai para o git.
// Rodar de novo não troca as chaves (trocar invalidaria os celulares já inscritos); --trocar força.
//
// Uso:  node --env-file=.env scripts/configurar-push.mjs [--trocar]
// Precisa: migration 20261103110000_notificacoes_push.sql aplicada; VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.
import { generateKeyPairSync } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: CHAVE } = process.env;
if (!URL || !CHAVE) {
  console.error('Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

const { data: cfg, error } = await sb.from('push_config').select('vapid_public, vapid_private').eq('id', 1).maybeSingle();
if (error || !cfg) {
  console.error('Não achei public.push_config. A migration 20261103110000_notificacoes_push.sql foi aplicada?', error?.message ?? '');
  process.exit(1);
}
if (cfg.vapid_private && !process.argv.includes('--trocar')) {
  console.log('As chaves já existem. Nada a fazer.');
  process.exit(0);
}

// VAPID = par de chaves P-256: pública = 0x04 || x || y, privada = d (base64url)
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const vapidPublic = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');

const { error: erro } = await sb.from('push_config').update({ vapid_public: vapidPublic, vapid_private: priv.d }).eq('id', 1);
if (erro) {
  console.error('Não foi possível gravar:', erro.message);
  process.exit(1);
}
console.log('Chaves VAPID gravadas em push_config.');
