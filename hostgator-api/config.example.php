<?php
// Copie para config.php no servidor e preencha. config.php NÃO vai para o git
// e o .htaccess bloqueia acesso direto a ele.
return [
    // Mesmos valores de VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do frontend
    'supabase_url' => 'https://SEU-PROJETO.supabase.co',
    'supabase_anon_key' => 'COLE_AQUI_A_ANON_KEY',

    // URL pública da pasta uploads/ (sem barra no final)
    'public_base_url' => 'https://brvniteroi.com.br/brvcontrol-api/uploads',
    'upload_dir' => __DIR__ . '/uploads',

    // Domínios de onde o app chama o upload (produção e desenvolvimento)
    'allowed_origins' => [
        'https://DOMINIO-DO-APP.brvniteroi.com.br',
        'http://localhost:5173',
    ],

    // O app compacta para ~300 KB; 5 MB cobre PNG de documento escaneado
    'max_bytes' => 5 * 1024 * 1024,
];
