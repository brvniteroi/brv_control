<?php
// Em produção o config.php é gerado no deploy (scripts/gerar-config-upload.mjs) e a API
// fica em https://control.brvniteroi.com.br/api/. Este modelo serve só para rodar em outro
// servidor. config.php NÃO vai para o git e o .htaccess bloqueia acesso direto a ele.
return [
    // Mesmos valores de VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do frontend
    'supabase_url' => 'https://SEU-PROJETO.supabase.co',
    'supabase_anon_key' => 'COLE_AQUI_A_ANON_KEY',

    // URL pública da pasta uploads/ (sem barra no final)
    'public_base_url' => 'https://control.brvniteroi.com.br/api/uploads',
    'upload_dir' => __DIR__ . '/uploads',

    // Domínios de onde o app chama o upload (produção e desenvolvimento)
    'allowed_origins' => [
        'https://control.brvniteroi.com.br',
        'http://localhost:5173',
    ],

    // O app compacta para ~300 KB; 5 MB cobre PNG de documento escaneado
    'max_bytes' => 5 * 1024 * 1024,
];
