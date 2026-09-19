<?php
// Helpers de badges de produto (porte de lib/produtoBadges.js).

// Anexa `badges: [{id, nome}]` a cada produto em UMA query (evita N+1).
function anexar_badges($produtos)
{
    if (!is_array($produtos) || count($produtos) === 0) {
        return $produtos;
    }
    $ids = [];
    foreach ($produtos as $p) {
        $ids[] = (int) $p['id'];
    }
    $marcadores = implode(',', array_fill(0, count($ids), '?'));
    $linhas = db_query(
        "SELECT pb.produto_id, b.id, b.nome
           FROM produto_badges pb
           JOIN badges b ON b.id = pb.badge_id
          WHERE pb.produto_id IN ($marcadores)
          ORDER BY b.ordem ASC, b.nome ASC",
        $ids
    );

    $porProduto = [];
    foreach ($linhas as $r) {
        $pid = (int) $r['produto_id'];
        if (!isset($porProduto[$pid])) {
            $porProduto[$pid] = [];
        }
        $porProduto[$pid][] = ['id' => (int) $r['id'], 'nome' => (string) $r['nome']];
    }

    foreach ($produtos as $i => $p) {
        $pid = (int) $p['id'];
        $produtos[$i]['badges'] = isset($porProduto[$pid]) ? $porProduto[$pid] : [];
    }
    return $produtos;
}

// Substitui o conjunto de badges de um produto. Ignora ids inexistentes.
function definir_badges($produtoId, $badgeIds)
{
    db_run('DELETE FROM produto_badges WHERE produto_id = ?', [(int) $produtoId]);

    $ids = [];
    foreach ((is_array($badgeIds) ? $badgeIds : []) as $v) {
        $n = filter_var($v, FILTER_VALIDATE_INT);
        if ($n !== false && $n > 0) {
            $ids[(int) $n] = (int) $n;
        }
    }
    $ids = array_values($ids);
    if (!$ids) {
        return;
    }

    $marcadores = implode(',', array_fill(0, count($ids), '?'));
    $validos = db_query("SELECT id FROM badges WHERE id IN ($marcadores)", $ids);
    foreach ($validos as $b) {
        db_run('INSERT INTO produto_badges (produto_id, badge_id) VALUES (?, ?)', [(int) $produtoId, (int) $b['id']]);
    }
}
