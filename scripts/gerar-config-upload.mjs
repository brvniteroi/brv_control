// Gera o config.php do upload de fotos no deploy (GitHub Actions), a partir dos secrets.
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... APP_URL=https://... node scripts/gerar-config-upload.mjs > dist/api/config.php
// Só valores públicos (a anon key já vai dentro do JavaScript do app).

const { SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL } = process.env;
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
];
`);
