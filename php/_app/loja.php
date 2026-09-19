<?php
// Config efetiva da loja: valores da tabela config_loja sobrepondo os defaults
// do config.php. Fonte única usada por GET /api/config, pela injeção no
// index.php e pelo painel. Porte de lib/lojaConfig.js.

function loja_chaves()
{
    return [
        'store_name', 'store_whatsapp', 'store_address', 'store_city',
        'store_cep', 'store_hours', 'instagram_url',
        'cart_min_grams', 'cart_step_grams', 'cart_max_grams',
    ];
}

function loja_carregar($recarregar = false)
{
    static $cache = null;
    if ($cache !== null && !$recarregar) {
        return $cache;
    }

    $base = nutra_store_defaults();
    $mapa = [];
    try {
        foreach (db_query('SELECT chave, valor FROM config_loja', []) as $r) {
            $mapa[$r['chave']] = $r['valor'];
        }
    } catch (Exception $e) {
        // A tabela pode ainda não existir (antes da instalação): usa os defaults.
    }

    $val = function ($k, $d) use ($mapa) {
        return (isset($mapa[$k]) && $mapa[$k] !== null && $mapa[$k] !== '') ? $mapa[$k] : $d;
    };
    $inteiro = function ($v, $d) {
        $n = filter_var($v, FILTER_VALIDATE_INT);
        return $n === false ? (int) $d : (int) $n;
    };

    $cache = [
        'name'      => (string) $val('store_name', $base['name']),
        'whatsapp'  => preg_replace('/\D/', '', (string) $val('store_whatsapp', $base['whatsapp'])),
        'address'   => (string) $val('store_address', $base['address']),
        'city'      => (string) $val('store_city', $base['city']),
        'cep'       => (string) $val('store_cep', $base['cep']),
        'hours'     => (string) $val('store_hours', $base['hours']),
        'instagram' => (string) $val('instagram_url', $base['instagram']),
        'cart'      => [
            'minGrams'  => $inteiro($val('cart_min_grams', $base['cart']['minGrams']), $base['cart']['minGrams']),
            'stepGrams' => $inteiro($val('cart_step_grams', $base['cart']['stepGrams']), $base['cart']['stepGrams']),
            'maxGrams'  => $inteiro($val('cart_max_grams', $base['cart']['maxGrams']), $base['cart']['maxGrams']),
        ],
    ];
    return $cache;
}

// Upsert independente de dialeto (existe? UPDATE : INSERT).
function loja_upsert($chave, $valor)
{
    $existe = db_query('SELECT 1 AS x FROM config_loja WHERE chave = ?', [$chave]);
    if ($existe) {
        db_run('UPDATE config_loja SET valor = ? WHERE chave = ?', [$valor, $chave]);
    } else {
        db_run('INSERT INTO config_loja (chave, valor) VALUES (?, ?)', [$chave, $valor]);
    }
}

function loja_salvar($campos)
{
    foreach (loja_chaves() as $chave) {
        if (array_key_exists($chave, $campos)) {
            loja_upsert($chave, (string) $campos[$chave]);
        }
    }
    return loja_carregar(true);
}
