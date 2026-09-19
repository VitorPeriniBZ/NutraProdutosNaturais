<?php
// Rotas públicas (sem autenticação) — porte de routes/produtos.js,
// categorias.js, badges.js e config.js.

function rota_health()
{
    json_out(['ok' => true, 'db' => db_dialeto()]);
}

// GET /api/produtos?categoria=&busca=&destaque=&badge=&pagina=&por_pagina=
// -> { total, pagina, por_pagina, itens: [...] }
// Só produtos ativos. O preço NÃO é exposto publicamente.
function rota_produtos()
{
    $categoria = trim((string) query_get('categoria', ''));
    $busca = mb_strtolower(trim((string) query_get('busca', '')));
    $soDestaque = eh_verdadeiro((string) query_get('destaque', ''));
    $badgeId = filter_var(query_get('badge', ''), FILTER_VALIDATE_INT);

    $pagina = filter_var(query_get('pagina', ''), FILTER_VALIDATE_INT);
    $pagina = ($pagina === false || $pagina < 1) ? 1 : $pagina;

    $porPagina = filter_var(query_get('por_pagina', ''), FILTER_VALIDATE_INT);
    if ($porPagina === false || $porPagina < 1) {
        $porPagina = 12;
    }
    $porPagina = min(max($porPagina, 1), 1000);

    $where = ['p.ativo = 1'];
    $params = [];

    if ($categoria !== '' && $categoria !== 'Todos') {
        $where[] = 'c.nome = ?';
        $params[] = $categoria;
    }
    if ($busca !== '') {
        $where[] = 'LOWER(p.nome) LIKE ?';
        $params[] = '%' . $busca . '%';
    }
    if ($soDestaque) {
        $where[] = 'p.destaque = 1';
    }
    if ($badgeId !== false && $badgeId > 0) {
        $where[] = 'EXISTS (SELECT 1 FROM produto_badges pb WHERE pb.produto_id = p.id AND pb.badge_id = ?)';
        $params[] = $badgeId;
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $totalLinhas = db_query(
        "SELECT COUNT(*) AS n FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id $whereSql",
        $params
    );
    $total = (int) $totalLinhas[0]['n'];

    $offset = ($pagina - 1) * $porPagina;
    $itens = db_query(
        "SELECT p.id, p.nome, p.emoji, p.imagem_url, p.descricao, p.disponivel, p.destaque,
                p.categoria_id, c.nome AS categoria
           FROM produtos p
           LEFT JOIN categorias c ON c.id = p.categoria_id
           $whereSql
           ORDER BY p.ordem ASC, p.id ASC" . db_limite_offset($porPagina, $offset),
        $params
    );
    $itens = anexar_badges(norm_produtos($itens));

    json_out([
        'total'      => $total,
        'pagina'     => $pagina,
        'por_pagina' => $porPagina,
        'itens'      => $itens,
    ]);
}

// GET /api/categorias -> [{ id, nome, emoji, ordem, total }]  (total = ativos)
function rota_categorias()
{
    $linhas = db_query(
        "SELECT c.id, c.nome, c.emoji, c.ordem,
                COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total
           FROM categorias c
           LEFT JOIN produtos p ON p.categoria_id = c.id
          GROUP BY c.id, c.nome, c.emoji, c.ordem
          ORDER BY c.ordem ASC, c.nome ASC",
        []
    );
    json_out(array_map('norm_categoria', $linhas));
}

// GET /api/badges -> [{ id, nome, ordem, total }]  (total = ativos com a badge)
function rota_badges()
{
    $linhas = db_query(
        "SELECT b.id, b.nome, b.ordem,
                COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total
           FROM badges b
           LEFT JOIN produto_badges pb ON pb.badge_id = b.id
           LEFT JOIN produtos p ON p.id = pb.produto_id
          GROUP BY b.id, b.nome, b.ordem
          ORDER BY b.ordem ASC, b.nome ASC",
        []
    );
    json_out(array_map('norm_badge', $linhas));
}

// GET /api/config -> config efetiva da loja
function rota_config()
{
    json_out(loja_carregar());
}
