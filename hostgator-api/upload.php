<?php
// upload.php
// Recebe fotos de campo do app FSM (já compactadas no navegador), valida e
// grava em uploads/AAAA/MM/<aleatório>.<ext>. Devolve a URL pública; quem
// grava o registro em public.attachments é o app, com o próprio login (RLS).
//
// Autenticação: o mesmo token de sessão do Supabase que o app já usa
// (Authorization: Bearer <access_token>). Não existe chave fixa no front:
// qualquer valor embutido no bundle do React é visível para quem abrir o site.
//
// Requisição: POST multipart/form-data, campo "arquivo".
// Resposta 201: { storage_path, public_url, mime_type, size_bytes, width, height, file_name }

declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function responder(int $status, array $dados): void {
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$config = @include __DIR__ . '/config.php';
if (!is_array($config) || empty($config['supabase_url']) || empty($config['supabase_anon_key'])
    || empty($config['public_base_url'])) {
    responder(500, ['error' => 'Upload não configurado']);
}

// ---- CORS: o app roda em outro domínio ----
$origem = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origem !== '' && in_array($origem, $config['allowed_origins'] ?? [], true)) {
    header('Access-Control-Allow-Origin: ' . $origem);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization');
    header('Access-Control-Max-Age: 600');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['error' => 'Método não permitido']);
}

// ---- Autenticação: só operadores logados e ativos ----
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($authHeader === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $nome => $valor) {
        if (strcasecmp($nome, 'Authorization') === 0) { $authHeader = $valor; break; }
    }
}
if (!preg_match('/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/', $authHeader, $m) || strlen($m[1]) > 4096) {
    responder(401, ['error' => 'Não autenticado']);
}
$token = $m[1];

function supabase_get(string $url, array $config, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $config['supabase_anon_key'],
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, $body];
}

$sbUrl = rtrim($config['supabase_url'], '/');

// Valida o token no próprio Supabase (assinatura, expiração e sessão revogada)
[$code, $body] = supabase_get($sbUrl . '/auth/v1/user', $config, $token);
$user = $code === 200 ? json_decode($body, true) : null;
if (!is_array($user) || empty($user['id']) || !preg_match('/^[0-9a-f-]{36}$/', $user['id'])) {
    responder(401, ['error' => 'Sessão inválida']);
}

// Confere se o operador está ativo (RLS só deixa ler o próprio perfil)
[$code, $body] = supabase_get($sbUrl . '/rest/v1/profiles?select=active&id=eq.' . $user['id'], $config, $token);
$perfil = $code === 200 ? json_decode($body, true) : null;
if (!is_array($perfil) || empty($perfil[0]['active'])) {
    responder(403, ['error' => 'Acesso não autorizado']);
}

// ---- Validação do arquivo ----
$maxBytes = (int)($config['max_bytes'] ?? 5 * 1024 * 1024);

// Se o corpo passar do post_max_size o PHP descarta tudo e $_FILES chega vazio
if (empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    responder(413, ['error' => 'Arquivo grande demais']);
}

$arquivo = $_FILES['arquivo'] ?? null;
if (!is_array($arquivo) || is_array($arquivo['error'])) {
    responder(400, ['error' => 'Envie um único arquivo no campo "arquivo"']);
}
switch ($arquivo['error']) {
    case UPLOAD_ERR_OK:
        break;
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:
        responder(413, ['error' => 'Arquivo grande demais']);
    case UPLOAD_ERR_NO_FILE:
        responder(400, ['error' => 'Nenhum arquivo enviado']);
    default:
        responder(500, ['error' => 'Falha ao receber o arquivo']);
}
if ($arquivo['size'] <= 0 || $arquivo['size'] > $maxBytes) {
    responder(413, ['error' => 'Arquivo grande demais (máx. ' . round($maxBytes / 1048576, 1) . ' MB)']);
}
if (!is_uploaded_file($arquivo['tmp_name'])) {
    responder(400, ['error' => 'Upload inválido']);
}

// Extensão informada pelo aparelho: primeira barreira
$extensoesAceitas = ['jpg', 'jpeg', 'png', 'webp'];
$extCliente = strtolower(pathinfo((string)$arquivo['name'], PATHINFO_EXTENSION));
if (!in_array($extCliente, $extensoesAceitas, true)) {
    responder(415, ['error' => 'Formato não aceito. Envie JPG, PNG ou WEBP']);
}

// Tipo real pelo conteúdo (nome e Content-Type são escolhidos pelo cliente)
$tiposAceitos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$info = @getimagesize($arquivo['tmp_name']);
$mime = class_exists('finfo')
    ? (new finfo(FILEINFO_MIME_TYPE))->file($arquivo['tmp_name'])
    : ($info['mime'] ?? '');
if (!isset($tiposAceitos[$mime]) || $info === false || ($info['mime'] ?? '') !== $mime) {
    responder(415, ['error' => 'O conteúdo não é uma imagem JPG, PNG ou WEBP válida']);
}
[$largura, $altura] = $info;
if ($largura < 1 || $altura < 1 || $largura > 10000 || $altura > 10000) {
    responder(422, ['error' => 'Dimensões de imagem inválidas']);
}

// ---- Gravação ----
// Nome aleatório (128 bits): não dá para adivinhar URL de foto de outro cliente,
// e a extensão vem do tipo detectado, nunca do nome enviado.
$subpasta = date('Y/m');
$dirBase = rtrim($config['upload_dir'] ?? (__DIR__ . '/uploads'), '/');
$dirDestino = $dirBase . '/' . $subpasta;
if (!is_dir($dirDestino) && !mkdir($dirDestino, 0755, true) && !is_dir($dirDestino)) {
    responder(500, ['error' => 'Falha ao preparar a pasta de destino']);
}

$nomeArquivo = bin2hex(random_bytes(16)) . '.' . $tiposAceitos[$mime];
$destino = $dirDestino . '/' . $nomeArquivo;
if (!move_uploaded_file($arquivo['tmp_name'], $destino)) {
    responder(500, ['error' => 'Falha ao gravar o arquivo']);
}
@chmod($destino, 0644);

$caminhoRelativo = $subpasta . '/' . $nomeArquivo;
$nomeOriginal = mb_substr(preg_replace('/[^\pL\pN ._()-]/u', '', basename((string)$arquivo['name'])) ?? '', 0, 150);

responder(201, [
    'storage_path' => $caminhoRelativo,
    'public_url' => rtrim($config['public_base_url'], '/') . '/' . $caminhoRelativo,
    'mime_type' => $mime,
    'size_bytes' => (int)filesize($destino),
    'width' => $largura,
    'height' => $altura,
    'file_name' => $nomeOriginal !== '' ? $nomeOriginal : null,
]);
