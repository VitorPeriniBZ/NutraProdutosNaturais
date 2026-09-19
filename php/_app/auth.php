<?php
// Autenticação do painel admin.
// No projeto Node isso era um JWT em cookie httpOnly; aqui usamos a sessão
// nativa do PHP, que dá a mesma garantia (cookie httpOnly, opaco, com
// expiração) sem depender de biblioteca externa. O front-end não muda: ele só
// envia o cookie com credentials:'include' e consulta /api/auth/me.

// A requisição atual está em HTTPS? (considera proxy/balanceador na frente)
function nutra_https()
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])
        && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    return (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);
}

function auth_sessao_iniciar()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $horas = (int) cfg('session.lifetime_hours', 12);
    // Marca o cookie como Secure só quando a requisição é HTTPS. Assim o painel
    // continua funcionando se alguém abrir por http:// (o cookie Secure não
    // seria enviado e o login falharia em silêncio).
    $seguro = ((bool) cfg('session.secure', true)) && nutra_https();

    session_name((string) cfg('session.name', 'nutra_admin'));
    session_set_cookie_params([
        'lifetime' => $horas * 3600,
        'path'     => '/',
        'secure'   => $seguro,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();

    // Expiração absoluta (a sessão não vive para sempre mesmo com uso contínuo).
    if (isset($_SESSION['admin_em']) && (time() - (int) $_SESSION['admin_em']) > $horas * 3600) {
        auth_logout();
    }
}

function auth_admin_atual()
{
    auth_sessao_iniciar();
    if (empty($_SESSION['admin_id'])) {
        return null;
    }
    return [
        'id'    => (int) $_SESSION['admin_id'],
        'nome'  => (string) $_SESSION['admin_nome'],
        'email' => (string) $_SESSION['admin_email'],
    ];
}

function auth_exigir_admin()
{
    $admin = auth_admin_atual();
    if (!$admin) {
        json_erro(401, 'Não autenticado');
    }
    return $admin;
}

function auth_logout()
{
    auth_sessao_iniciar();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => isset($p['path']) ? $p['path'] : '/',
            'secure'   => !empty($p['secure']),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
    session_destroy();
}

// ───────── Limite de tentativas de login (anti força-bruta) ─────────
// Equivalente ao express-rate-limit do original: 10 tentativas por IP a cada
// 15 minutos. Persistido em arquivo, já que a hospedagem compartilhada não
// tem Redis/APCu garantidos.

function auth_rate_arquivo()
{
    $dir = NUTRA_APP . '/tmp';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir . '/login-rate.json';
}

function auth_ip()
{
    return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'desconhecido';
}

function auth_rate_excedido()
{
    $janela = 15 * 60;
    $maximo = 10;
    $arquivo = auth_rate_arquivo();
    $agora = time();

    $dados = [];
    if (is_file($arquivo)) {
        $bruto = @file_get_contents($arquivo);
        $decodificado = json_decode($bruto === false ? '' : $bruto, true);
        if (is_array($decodificado)) {
            $dados = $decodificado;
        }
    }

    // Descarta registros fora da janela (e mantém o arquivo pequeno).
    foreach ($dados as $ip => $tentativas) {
        $validas = array_values(array_filter((array) $tentativas, function ($t) use ($agora, $janela) {
            return ($agora - (int) $t) < $janela;
        }));
        if ($validas) {
            $dados[$ip] = $validas;
        } else {
            unset($dados[$ip]);
        }
    }

    $ip = auth_ip();
    $minhas = isset($dados[$ip]) ? $dados[$ip] : [];
    if (count($minhas) >= $maximo) {
        @file_put_contents($arquivo, json_encode($dados));
        return true;
    }
    $minhas[] = $agora;
    $dados[$ip] = $minhas;
    @file_put_contents($arquivo, json_encode($dados));
    return false;
}

function auth_rate_limpar()
{
    $arquivo = auth_rate_arquivo();
    if (!is_file($arquivo)) {
        return;
    }
    $bruto = @file_get_contents($arquivo);
    $dados = json_decode($bruto === false ? '' : $bruto, true);
    if (!is_array($dados)) {
        return;
    }
    unset($dados[auth_ip()]);
    @file_put_contents($arquivo, json_encode($dados));
}
