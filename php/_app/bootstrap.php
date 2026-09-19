<?php
// Bootstrap da API PHP da Nutra.
// Porte fiel da API Node/Express original: mesmas rotas, mesmos nomes de campo
// e mesmo formato de JSON, para que o painel (/admin) e o catálogo do site
// funcionem sem nenhuma alteração no front-end.

define('NUTRA_APP', __DIR__);
define('NUTRA_ROOT', dirname(__DIR__));
define('NUTRA_CONFIG_FILE', NUTRA_APP . '/config.php');

require_once NUTRA_APP . '/http.php';
require_once NUTRA_APP . '/db.php';
require_once NUTRA_APP . '/loja.php';
require_once NUTRA_APP . '/badges.php';
require_once NUTRA_APP . '/auth.php';

function nutra_instalado()
{
    return is_file(NUTRA_CONFIG_FILE);
}

function nutra_config()
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = nutra_instalado() ? require NUTRA_CONFIG_FILE : [];
    }
    return $cfg;
}

// cfg('db.host', 'localhost') — acesso por caminho pontilhado, com default.
function cfg($caminho, $default = null)
{
    $no = nutra_config();
    foreach (explode('.', $caminho) as $parte) {
        if (!is_array($no) || !array_key_exists($parte, $no)) {
            return $default;
        }
        $no = $no[$parte];
    }
    return $no;
}

function nutra_log($mensagem)
{
    $dir = NUTRA_APP . '/tmp';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents(
        $dir . '/erro.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $mensagem . "\n",
        FILE_APPEND
    );
}

// Defaults da loja (equivalentes ao .env do projeto Node). O que estiver na
// tabela config_loja tem prioridade sobre estes valores.
function nutra_store_defaults()
{
    $d = cfg('store', []);
    $cart = isset($d['cart']) && is_array($d['cart']) ? $d['cart'] : [];
    return [
        'name'      => isset($d['name']) ? $d['name'] : 'Nutra Produtos Naturais',
        'whatsapp'  => preg_replace('/\D/', '', isset($d['whatsapp']) ? $d['whatsapp'] : '5527996600444'),
        'address'   => isset($d['address']) ? $d['address'] : 'Av. Saturnino Rangel Mauro, 1947',
        'city'      => isset($d['city']) ? $d['city'] : 'Vila Velha - ES',
        'cep'       => isset($d['cep']) ? $d['cep'] : '29102-036',
        'hours'     => isset($d['hours']) ? $d['hours'] : 'Seg a Sáb: 8h às 18h',
        'instagram' => isset($d['instagram']) ? $d['instagram'] : 'https://instagram.com/nutraprodutosnaturais',
        'cart'      => [
            'minGrams'  => isset($cart['minGrams'])  ? (int) $cart['minGrams']  : 100,
            'stepGrams' => isset($cart['stepGrams']) ? (int) $cart['stepGrams'] : 50,
            'maxGrams'  => isset($cart['maxGrams'])  ? (int) $cart['maxGrams']  : 5000,
        ],
    ];
}
