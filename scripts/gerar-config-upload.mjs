// Gera o config.php da pasta api/ (upload de fotos e envio do e-mail de avaliação) no deploy (GitHub Actions),
// a partir dos secrets.
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... APP_URL=https://... [AVALIACAO_SEGREDO=...] node scripts/gerar-config-upload.mjs > dist/api/config.php
// A anon key é pública (já vai no JavaScript do app). AVALIACAO_SEGREDO é o mesmo valor de public.avaliacao_config.segredo;
// sem ele o enviar-avaliacao.php responde "não configurado" e nada é enviado.

const { SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL, AVALIACAO_SEGREDO = '' } = process.env;
for (const [nome, valor] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL })) {
  if (!valor) {
    console.error(`Falta a variável ${nome}`);
    process.exit(1);
  }
}

/** String PHP entre aspas simples (só \ e ' precisam de escape). */
const php = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const app = APP_URL.replace(/\/+$/, '');

process.stdout.write(`<?php
// Gerado no deploy por scripts/gerar-config-upload.mjs. Não editar no servidor.
return [
    'supabase_url' => ${php(SUPABASE_URL.replace(/\/+$/, ''))},
    'supabase_anon_key' => ${php(SUPABASE_ANON_KEY)},
    'public_base_url' => ${php(`${app}/api/uploads`)},
    'upload_dir' => __DIR__ . '/uploads',
    'allowed_origins' => [${php(app)}, 'http://localhost:5173'],
    'max_bytes' => 5 * 1024 * 1024,
    'app_url' => ${php(app)},
    'avaliacao_segredo' => ${php(AVALIACAO_SEGREDO.trim())},
    'email_remetente' => 'avaliacao@brvniteroi.com.br',
    'email_resposta' => 'brv@brvniteroi.com.br',
];
`);
