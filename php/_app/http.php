<?php
// Helpers de resposta HTTP/JSON e de coerção de tipos.
// O front-end espera exatamente o formato da API Node: erros em { "erro": "..." }.

function json_out($dados, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_erro($status, $mensagem)
{
    json_out(['erro' => $mensagem], $status);
}

// Corpo JSON da requisição (o painel envia application/json).
function corpo_json()
{
    static $corpo = null;
    if ($corpo === null) {
        $bruto = file_get_contents('php://input');
        $decodificado = json_decode($bruto === false ? '' : $bruto, true);
        $corpo = is_array($decodificado) ? $decodificado : [];
    }
    return $corpo;
}

function body_get($chave, $default = null)
{
    $c = corpo_json();
    return array_key_exists($chave, $c) ? $c[$chave] : $default;
}

function body_tem($chave)
{
    return array_key_exists($chave, corpo_json());
}

function query_get($chave, $default = '')
{
    return isset($_GET[$chave]) ? $_GET[$chave] : $default;
}

// ───────── Coerções (espelham os helpers do admin.js/Node) ─────────

function to_int_ou_null($v)
{
    if ($v === null || $v === '' || is_array($v)) {
        return null;
    }
    if (is_bool($v)) {
        return $v ? 1 : 0;
    }
    if (!is_numeric(trim((string) $v)) && !preg_match('/^-?\d+/', trim((string) $v))) {
        return null;
    }
    return (int) trim((string) $v);
}

function to_num_ou_null($v)
{
    if ($v === null || $v === '' || is_array($v)) {
        return null;
    }
    $s = str_replace(',', '.', trim((string) $v));
    if (!is_numeric($s)) {
        return null;
    }
    return (float) $s;
}

function to_bool01($v, $default = 1)
{
    if ($v === null || $v === '' || is_array($v)) {
        return $default;
    }
    if (is_bool($v)) {
        return $v ? 1 : 0;
    }
    return preg_match('/^(1|true|yes|on)$/i', trim((string) $v)) ? 1 : 0;
}

function eh_verdadeiro($v)
{
    return (bool) preg_match('/^(1|true|yes|on)$/i', trim((string) $v));
}

function texto_ou_null($v, $max = null)
{
    if ($v === null || is_array($v)) {
        return null;
    }
    $s = trim((string) $v);
    if ($max !== null) {
        $s = mb_substr($s, 0, $max);
    }
    return $s === '' ? null : $s;
}

// ───────── Normalização de linhas do banco ─────────
// O PDO devolve números como string em várias configurações. O front-end faz
// checagens como `if (!p.ativo)`, e a string "0" é truthy em JavaScript — por
// isso os tipos são normalizados aqui, antes do json_encode.

function norm_produto($r)
{
    $inteiros = ['id', 'categoria_id', 'ordem', 'grama_min', 'grama_step', 'grama_max'];
    foreach ($inteiros as $k) {
        if (array_key_exists($k, $r)) {
            $r[$k] = $r[$k] === null ? null : (int) $r[$k];
        }
    }
    foreach (['ativo', 'disponivel', 'destaque'] as $k) {
        if (array_key_exists($k, $r)) {
            $r[$k] = (int) $r[$k];
        }
    }
    if (array_key_exists('preco', $r)) {
        $r['preco'] = $r['preco'] === null ? null : (float) $r['preco'];
    }
    return $r;
}

function norm_produtos($linhas)
{
    return array_map('norm_produto', $linhas);
}

function norm_categoria($r)
{
    foreach (['id', 'ordem', 'total', 'total_ativos'] as $k) {
        if (array_key_exists($k, $r)) {
            $r[$k] = $r[$k] === null ? null : (int) $r[$k];
        }
    }
    return $r;
}

function norm_badge($r)
{
    foreach (['id', 'ordem', 'total'] as $k) {
        if (array_key_exists($k, $r)) {
            $r[$k] = $r[$k] === null ? null : (int) $r[$k];
        }
    }
    return $r;
}
