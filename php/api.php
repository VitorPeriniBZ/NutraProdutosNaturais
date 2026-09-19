<?php
// Front controller da API. O .htaccess encaminha /api/* para cá.
// Rotas idênticas às da API Node original, para o painel e o catálogo do site
// funcionarem sem nenhuma mudança no front-end.

require_once __DIR__ . '/_app/bootstrap.php';

if (!nutra_instalado()) {
    json_erro(503, 'A aplicação ainda não foi instalada. Abra o instalador para configurar o banco.');
}

require_once NUTRA_APP . '/routes_publico.php';
require_once NUTRA_APP . '/routes_auth.php';
require_once NUTRA_APP . '/routes_admin.php';

set_exception_handler(function ($e) {
    nutra_log('[api] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        json_erro(500, 'Erro interno');
    }
});

// ───────── Rota e método ─────────
$uri = (string) parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$base = rtrim(str_replace('\\', '/', dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/')), '/');
if ($base !== '' && $base !== '.' && strncmp($uri, $base, strlen($base)) === 0) {
    $uri = substr($uri, strlen($base));
}
$rota = preg_replace('#^/api#', '', $uri);
$rota = '/' . trim((string) $rota, '/');
$metodo = strtoupper(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET');

// ───────── Rotas públicas ─────────
$publicas = [
    'GET /health'     => 'rota_health',
    'GET /produtos'   => 'rota_produtos',
    'GET /categorias' => 'rota_categorias',
    'GET /badges'     => 'rota_badges',
    'GET /config'     => 'rota_config',
    'POST /auth/login'  => 'rota_login',
    'POST /auth/logout' => 'rota_logout',
    'GET /auth/me'      => 'rota_me',
];
$chave = $metodo . ' ' . $rota;
if (isset($publicas[$chave])) {
    $publicas[$chave]();
}

// ───────── Rotas do painel (exigem sessão) ─────────
if (strncmp($rota, '/admin', 6) === 0) {
    auth_exigir_admin();
    $sub = substr($rota, 6);
    $sub = '/' . trim((string) $sub, '/');

    $semId = [
        'GET /produtos'         => 'admin_produtos_listar',
        'POST /produtos'        => 'admin_produtos_criar',
        'GET /categorias'       => 'admin_categorias_listar',
        'POST /categorias'      => 'admin_categorias_criar',
        'GET /badges'           => 'admin_badges_listar',
        'POST /badges'          => 'admin_badges_criar',
        'GET /config'           => 'admin_config_ler',
        'PUT /config'           => 'admin_config_salvar',
        'POST /upload-imagem'   => 'admin_upload_imagem',
    ];
    $k = $metodo . ' ' . $sub;
    if (isset($semId[$k])) {
        $semId[$k]();
    }

    $comId = [
        'PUT /produtos'      => 'admin_produtos_atualizar',
        'DELETE /produtos'   => 'admin_produtos_excluir',
        'PUT /categorias'    => 'admin_categorias_atualizar',
        'DELETE /categorias' => 'admin_categorias_excluir',
        'PUT /badges'        => 'admin_badges_atualizar',
        'DELETE /badges'     => 'admin_badges_excluir',
    ];
    if (preg_match('#^/(produtos|categorias|badges)/([^/]+)$#', $sub, $m)) {
        $k = $metodo . ' /' . $m[1];
        if (isset($comId[$k])) {
            $comId[$k]($m[2]);
        }
    }
}

json_erro(404, 'Rota não encontrada');
