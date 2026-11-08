<?php
// enviar-avaliacao.php
// Envia o e-mail de pedido de avaliação da OS concluída. Quem chama é o banco do BRV Control (pg_net, função
// avaliacao_email_processar), com o segredo de public.avaliacao_config no cabeçalho x-segredo. O mesmo segredo vem
// do GitHub (AVALIACAO_SEGREDO) para o config.php no deploy.
//
// Envia pela conta de e-mail da hospedagem (mail() da HostGator, que assina com o DKIM do domínio) e devolve o
// resultado ao banco pela função avaliacao_email_resultado.
//
// Requisição: POST JSON { pedido_id, para, nome, numero, servico, tecnico, data, link }

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
if (!is_array($config) || empty($config['avaliacao_segredo']) || empty($config['supabase_url'])
    || empty($config['supabase_anon_key']) || empty($config['email_remetente'])) {
    responder(503, ['error' => 'Envio de avaliação não configurado']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['error' => 'Método não permitido']);
}

$segredo = $_SERVER['HTTP_X_SEGREDO'] ?? '';
if (!is_string($segredo) || !hash_equals((string)$config['avaliacao_segredo'], $segredo)) {
    responder(401, ['error' => 'Não autorizado']);
}

$dados = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($dados)) {
    responder(400, ['error' => 'Corpo inválido']);
}

$texto = static function ($v, int $max = 120): string {
    $s = trim((string)preg_replace('/[\r\n\t]+/', ' ', (string)($v ?? '')));
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
};

$pedido = (string)($dados['pedido_id'] ?? '');
$para = trim((string)($dados['para'] ?? ''));
$nome = $texto($dados['nome'] ?? '', 60);
$numero = preg_replace('/\D/', '', (string)($dados['numero'] ?? ''));
$servico = $texto($dados['servico'] ?? '');
$tecnico = $texto($dados['tecnico'] ?? '', 60);
$data = preg_match('/^\d{2}\/\d{2}\/\d{4}$/', (string)($dados['data'] ?? '')) ? (string)$dados['data'] : '';
$link = (string)($dados['link'] ?? '');
$app = rtrim((string)($config['app_url'] ?? ''), '/');

if (!preg_match('/^[0-9a-f-]{36}$/', $pedido) || !filter_var($para, FILTER_VALIDATE_EMAIL) || $numero === ''
    || $app === '' || strpos($link, $app . '/avaliar/') !== 0) {
    responder(400, ['error' => 'Dados inválidos']);
}

// ---- Resultado de volta ao banco ----
function informar(array $config, string $pedido, bool $ok, string $detalhe = ''): void {
    $ch = curl_init(rtrim($config['supabase_url'], '/') . '/rest/v1/rpc/avaliacao_email_resultado');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $config['supabase_anon_key'],
            'Authorization: Bearer ' . $config['supabase_anon_key'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'p_pedido' => $pedido,
            'p_segredo' => $config['avaliacao_segredo'],
            'p_ok' => $ok,
            'p_detalhe' => $detalhe === '' ? null : $detalhe,
        ]),
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// ---- Mensagem ----
$h = static function (string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
};
$saudacao = $nome !== '' ? "Olá, {$nome}!" : 'Olá!';
$detalhes = array_filter([
    "OS {$numero}",
    $servico,
    $data,
    $tecnico !== '' ? "técnico {$tecnico}" : '',
]);
$linhaDetalhes = implode(' · ', $detalhes);

$assunto = "Como foi o atendimento da BRV Niterói? (OS {$numero})";

$corpoTexto = "{$saudacao}\n\n"
    . "Obrigado por escolher a BRV Niterói. O seu atendimento foi concluído ({$linhaDetalhes}).\n\n"
    . "Pode nos contar como foi? Leva só alguns segundos:\n{$link}\n\n"
    . "Sua opinião ajuda a BRV a atender cada vez melhor.\n\n"
    . "BRV Niterói - Climatização e elétrica\n"
    . "Não quer mais receber estes e-mails? Basta responder a esta mensagem.\n";

$corpoHtml = '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1e293b">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px"><tr><td align="center">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">'
    . '<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:bold;color:#0f172a">BRV Niterói</td></tr>'
    . '<tr><td style="padding:8px 28px;font-size:15px;line-height:1.5">' . $h($saudacao) . '</td></tr>'
    . '<tr><td style="padding:0 28px;font-size:15px;line-height:1.5">Obrigado por escolher a BRV Niterói. O seu atendimento foi concluído.</td></tr>'
    . '<tr><td style="padding:8px 28px 0;font-size:13px;color:#64748b">' . $h($linhaDetalhes) . '</td></tr>'
    . '<tr><td style="padding:20px 28px 8px;font-size:15px;line-height:1.5">Pode nos contar como foi? Leva só alguns segundos.</td></tr>'
    . '<tr><td style="padding:8px 28px 24px"><a href="' . $h($link) . '" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:10px">Avaliar o atendimento</a></td></tr>'
    . '<tr><td style="padding:0 28px 24px;font-size:13px;color:#64748b;line-height:1.5">Sua opinião ajuda a BRV a atender cada vez melhor.</td></tr>'
    . '<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5">BRV Niterói · Climatização e elétrica<br>Não quer mais receber estes e-mails? Basta responder a esta mensagem.</td></tr>'
    . '</table></td></tr></table></body></html>';

$remetente = (string)$config['email_remetente'];
$resposta = (string)($config['email_resposta'] ?? $remetente);
$limite = 'brv-' . bin2hex(random_bytes(12));
$cabecalhos = implode("\r\n", [
    'From: =?UTF-8?B?' . base64_encode('BRV Niterói') . "?= <{$remetente}>",
    "Reply-To: {$resposta}",
    'MIME-Version: 1.0',
    "Content-Type: multipart/alternative; boundary=\"{$limite}\"",
    'X-Auto-Response-Suppress: All',
]);
$corpo = "--{$limite}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($corpoTexto)) . "\r\n"
    . "--{$limite}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($corpoHtml)) . "\r\n"
    . "--{$limite}--\r\n";

$ok = @mail($para, '=?UTF-8?B?' . base64_encode($assunto) . '?=', $corpo, $cabecalhos, '-f' . $remetente);

informar($config, $pedido, $ok, $ok ? '' : 'O servidor de e-mail recusou o envio');
responder($ok ? 200 : 502, ['enviado' => $ok]);
