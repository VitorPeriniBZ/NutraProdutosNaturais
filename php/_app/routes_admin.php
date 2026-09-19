<?php
// Rotas protegidas do painel — porte de routes/admin.js.
// Todas exigem sessão de admin (checada no dispatcher, em api.php).

function dados_produto()
{
    $nome = trim((string) body_get('nome', ''));
    $ordem = to_int_ou_null(body_get('ordem'));
    return [
        'nome'         => $nome,
        'categoria_id' => to_int_ou_null(body_get('categoria_id')),
        'emoji'        => texto_ou_null(body_get('emoji')),
        'imagem_url'   => texto_ou_null(body_get('imagem_url')),
        'descricao'    => texto_ou_null(body_get('descricao'), 500),
        'preco'        => to_num_ou_null(body_get('preco')),
        'ativo'        => to_bool01(body_get('ativo'), 1),
        'disponivel'   => to_bool01(body_get('disponivel'), 1),
        'destaque'     => to_bool01(body_get('destaque'), 0),
        'ordem'        => $ordem === null ? 0 : $ordem,
        'grama_min'    => to_int_ou_null(body_get('grama_min')),
        'grama_step'   => to_int_ou_null(body_get('grama_step')),
        'grama_max'    => to_int_ou_null(body_get('grama_max')),
    ];
}

function buscar_produto($id)
{
    $linhas = db_query(
        'SELECT p.*, c.nome AS categoria
           FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.id = ?',
        [(int) $id]
    );
    if (!isset($linhas[0])) {
        return null;
    }
    $linhas = anexar_badges(norm_produtos($linhas));
    return $linhas[0];
}

// ───────────────────────── Produtos ─────────────────────────

function admin_produtos_listar()
{
    $busca = mb_strtolower(trim((string) query_get('busca', '')));
    $categoriaId = to_int_ou_null(query_get('categoria_id', ''));
    $status = (string) query_get('status', 'todos'); // todos | ativo | inativo

    $where = [];
    $params = [];
    if ($busca !== '') {
        $where[] = 'LOWER(p.nome) LIKE ?';
        $params[] = '%' . $busca . '%';
    }
    if ($categoriaId) {
        $where[] = 'p.categoria_id = ?';
        $params[] = $categoriaId;
    }
    if ($status === 'ativo') {
        $where[] = 'p.ativo = 1';
    } elseif ($status === 'inativo') {
        $where[] = 'p.ativo = 0';
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $itens = db_query(
        "SELECT p.*, c.nome AS categoria
           FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
           $whereSql
           ORDER BY p.ordem ASC, p.id ASC",
        $params
    );
    $itens = anexar_badges(norm_produtos($itens));
    json_out(['total' => count($itens), 'itens' => $itens]);
}

function admin_produtos_criar()
{
    $d = dados_produto();
    if ($d['nome'] === '') {
        json_erro(400, 'O nome do produto é obrigatório');
    }
    $r = db_run(
        'INSERT INTO produtos (nome, categoria_id, emoji, imagem_url, descricao, preco, ativo, disponivel, destaque, ordem, grama_min, grama_step, grama_max)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $d['nome'], $d['categoria_id'], $d['emoji'], $d['imagem_url'], $d['descricao'], $d['preco'],
            $d['ativo'], $d['disponivel'], $d['destaque'], $d['ordem'],
            $d['grama_min'], $d['grama_step'], $d['grama_max'],
        ]
    );
    definir_badges($r['insertId'], body_get('badge_ids'));
    json_out(buscar_produto($r['insertId']), 201);
}

function admin_produtos_atualizar($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    if (!buscar_produto($id)) {
        json_erro(404, 'Produto não encontrado');
    }
    $d = dados_produto();
    if ($d['nome'] === '') {
        json_erro(400, 'O nome do produto é obrigatório');
    }
    db_run(
        'UPDATE produtos SET nome=?, categoria_id=?, emoji=?, imagem_url=?, descricao=?, preco=?, ativo=?, disponivel=?,
                destaque=?, ordem=?, grama_min=?, grama_step=?, grama_max=?, atualizado_em=CURRENT_TIMESTAMP
          WHERE id=?',
        [
            $d['nome'], $d['categoria_id'], $d['emoji'], $d['imagem_url'], $d['descricao'], $d['preco'],
            $d['ativo'], $d['disponivel'], $d['destaque'], $d['ordem'],
            $d['grama_min'], $d['grama_step'], $d['grama_max'], $id,
        ]
    );
    if (body_tem('badge_ids')) {
        definir_badges($id, body_get('badge_ids'));
    }
    json_out(buscar_produto($id));
}

function admin_produtos_excluir($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    $r = db_run('DELETE FROM produtos WHERE id = ?', [$id]);
    if (!$r['affectedRows']) {
        json_erro(404, 'Produto não encontrado');
    }
    json_out(['ok' => true]);
}

// ───────────────────────── Categorias ─────────────────────────

function admin_categorias_listar()
{
    $linhas = db_query(
        "SELECT c.id, c.nome, c.emoji, c.ordem,
                COUNT(p.id) AS total,
                COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total_ativos
           FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id
          GROUP BY c.id, c.nome, c.emoji, c.ordem
          ORDER BY c.ordem ASC, c.nome ASC",
        []
    );
    json_out(array_map('norm_categoria', $linhas));
}

function admin_categorias_criar()
{
    $nome = trim((string) body_get('nome', ''));
    if ($nome === '') {
        json_erro(400, 'O nome da categoria é obrigatório');
    }
    $emoji = texto_ou_null(body_get('emoji'));
    $ordem = to_int_ou_null(body_get('ordem'));
    $ordem = $ordem === null ? 0 : $ordem;

    if (db_query('SELECT id FROM categorias WHERE nome = ?', [$nome])) {
        json_erro(409, 'Já existe uma categoria com esse nome');
    }
    $r = db_run('INSERT INTO categorias (nome, emoji, ordem) VALUES (?, ?, ?)', [$nome, $emoji, $ordem]);
    $linhas = db_query('SELECT * FROM categorias WHERE id = ?', [$r['insertId']]);
    json_out(norm_categoria($linhas[0]), 201);
}

function admin_categorias_atualizar($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    $nome = trim((string) body_get('nome', ''));
    if ($nome === '') {
        json_erro(400, 'O nome da categoria é obrigatório');
    }
    $emoji = texto_ou_null(body_get('emoji'));
    $ordem = to_int_ou_null(body_get('ordem'));
    $ordem = $ordem === null ? 0 : $ordem;

    if (db_query('SELECT id FROM categorias WHERE nome = ? AND id <> ?', [$nome, $id])) {
        json_erro(409, 'Já existe outra categoria com esse nome');
    }
    $r = db_run('UPDATE categorias SET nome=?, emoji=?, ordem=? WHERE id=?', [$nome, $emoji, $ordem, $id]);
    if (!$r['affectedRows']) {
        // Sem linhas afetadas pode ser "nada mudou"; confirma se existe.
        if (!db_query('SELECT id FROM categorias WHERE id = ?', [$id])) {
            json_erro(404, 'Categoria não encontrada');
        }
    }
    $linhas = db_query('SELECT * FROM categorias WHERE id = ?', [$id]);
    json_out(norm_categoria($linhas[0]));
}

function admin_categorias_excluir($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    $usados = db_query('SELECT COUNT(*) AS n FROM produtos WHERE categoria_id = ?', [$id]);
    $n = (int) $usados[0]['n'];
    if ($n > 0) {
        json_erro(409, "Não é possível excluir: $n produto(s) usam essa categoria. Reatribua-os antes.");
    }
    $r = db_run('DELETE FROM categorias WHERE id = ?', [$id]);
    if (!$r['affectedRows']) {
        json_erro(404, 'Categoria não encontrada');
    }
    json_out(['ok' => true]);
}

// ───────────────────────── Badges ─────────────────────────

function admin_badges_listar()
{
    $linhas = db_query(
        "SELECT b.id, b.nome, b.ordem, COUNT(pb.produto_id) AS total
           FROM badges b
           LEFT JOIN produto_badges pb ON pb.badge_id = b.id
          GROUP BY b.id, b.nome, b.ordem
          ORDER BY b.ordem ASC, b.nome ASC",
        []
    );
    json_out(array_map('norm_badge', $linhas));
}

function admin_badges_criar()
{
    $nome = mb_substr(trim((string) body_get('nome', '')), 0, 80);
    if ($nome === '') {
        json_erro(400, 'O nome da badge é obrigatório');
    }
    $ordem = to_int_ou_null(body_get('ordem'));
    $ordem = $ordem === null ? 0 : $ordem;

    if (db_query('SELECT id FROM badges WHERE nome = ?', [$nome])) {
        json_erro(409, 'Já existe uma badge com esse nome');
    }
    $r = db_run('INSERT INTO badges (nome, ordem) VALUES (?, ?)', [$nome, $ordem]);
    $linhas = db_query('SELECT * FROM badges WHERE id = ?', [$r['insertId']]);
    json_out(norm_badge($linhas[0]), 201);
}

function admin_badges_atualizar($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    $nome = mb_substr(trim((string) body_get('nome', '')), 0, 80);
    if ($nome === '') {
        json_erro(400, 'O nome da badge é obrigatório');
    }
    $ordem = to_int_ou_null(body_get('ordem'));
    $ordem = $ordem === null ? 0 : $ordem;

    if (db_query('SELECT id FROM badges WHERE nome = ? AND id <> ?', [$nome, $id])) {
        json_erro(409, 'Já existe outra badge com esse nome');
    }
    $r = db_run('UPDATE badges SET nome=?, ordem=? WHERE id=?', [$nome, $ordem, $id]);
    if (!$r['affectedRows'] && !db_query('SELECT id FROM badges WHERE id = ?', [$id])) {
        json_erro(404, 'Badge não encontrada');
    }
    $linhas = db_query('SELECT * FROM badges WHERE id = ?', [$id]);
    json_out(norm_badge($linhas[0]));
}

function admin_badges_excluir($id)
{
    $id = to_int_ou_null($id);
    if (!$id) {
        json_erro(400, 'ID inválido');
    }
    $r = db_run('DELETE FROM badges WHERE id = ?', [$id]);
    if (!$r['affectedRows']) {
        json_erro(404, 'Badge não encontrada');
    }
    json_out(['ok' => true]);
}

// ───────────────────────── Configurações da loja ─────────────────────────

function admin_config_ler()
{
    json_out(loja_carregar());
}

function admin_config_salvar()
{
    $b = corpo_json();
    $cart = (isset($b['cart']) && is_array($b['cart'])) ? $b['cart'] : [];

    $str = function ($v, $max) {
        return mb_substr(trim((string) ($v === null ? '' : $v)), 0, $max);
    };
    $posInt = function ($v, $def) {
        $n = filter_var($v, FILTER_VALIDATE_INT);
        return ($n !== false && $n > 0) ? (int) $n : (int) $def;
    };

    $whatsapp = preg_replace('/\D/', '', (string) (isset($b['whatsapp']) ? $b['whatsapp'] : ''));
    if ($whatsapp === '') {
        json_erro(400, 'Informe o WhatsApp (somente números, com DDD).');
    }

    $minG = $posInt(isset($cart['minGrams']) ? $cart['minGrams'] : null, 100);
    $stepG = $posInt(isset($cart['stepGrams']) ? $cart['stepGrams'] : null, 50);
    $maxG = $posInt(isset($cart['maxGrams']) ? $cart['maxGrams'] : null, 5000);
    if ($maxG < $minG) {
        $maxG = $minG;
    }

    $nome = $str(isset($b['name']) ? $b['name'] : '', 120);
    $campos = [
        'store_name'      => $nome !== '' ? $nome : 'Nutra Produtos Naturais',
        'store_whatsapp'  => $whatsapp,
        'store_address'   => $str(isset($b['address']) ? $b['address'] : '', 200),
        'store_city'      => $str(isset($b['city']) ? $b['city'] : '', 120),
        'store_cep'       => $str(isset($b['cep']) ? $b['cep'] : '', 20),
        'store_hours'     => $str(isset($b['hours']) ? $b['hours'] : '', 120),
        'instagram_url'   => $str(isset($b['instagram']) ? $b['instagram'] : '', 300),
        'cart_min_grams'  => $minG,
        'cart_step_grams' => $stepG,
        'cart_max_grams'  => $maxG,
    ];
    json_out(loja_salvar($campos));
}

// ───────────────────────── Upload de imagem ─────────────────────────
// A extensão é SEMPRE derivada do tipo real do arquivo (magic bytes via finfo),
// nunca do nome enviado pelo cliente — impede salvar, por exemplo, um ".php"
// ou ".html" dentro de /uploads.

function admin_upload_imagem()
{
    $permitidos = [
        'image/jpeg' => '.jpg',
        'image/png'  => '.png',
        'image/webp' => '.webp',
        'image/gif'  => '.gif',
        'image/avif' => '.avif',
    ];

    if (!isset($_FILES['imagem'])) {
        json_erro(400, 'Nenhum arquivo enviado');
    }
    $f = $_FILES['imagem'];
    if (!empty($f['error'])) {
        if ((int) $f['error'] === UPLOAD_ERR_INI_SIZE || (int) $f['error'] === UPLOAD_ERR_FORM_SIZE) {
            json_erro(400, 'Imagem muito grande.');
        }
        json_erro(400, 'Falha no envio do arquivo');
    }
    if (!is_uploaded_file($f['tmp_name'])) {
        json_erro(400, 'Nenhum arquivo enviado');
    }

    $maxBytes = ((int) cfg('upload.max_mb', 4)) * 1024 * 1024;
    if ((int) $f['size'] > $maxBytes) {
        json_erro(400, 'Imagem muito grande (máximo ' . (int) cfg('upload.max_mb', 4) . ' MB).');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string) $finfo->file($f['tmp_name']);
    if (!isset($permitidos[$mime])) {
        json_erro(400, 'O arquivo enviado não é uma imagem válida.');
    }

    $dir = (string) cfg('upload.dir', NUTRA_ROOT . '/uploads');
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        json_erro(500, 'Não foi possível criar a pasta de uploads');
    }

    $nome = sprintf('%d-%s%s', (int) round(microtime(true) * 1000), bin2hex(random_bytes(6)), $permitidos[$mime]);
    $destino = rtrim($dir, '/') . '/' . $nome;
    if (!move_uploaded_file($f['tmp_name'], $destino)) {
        json_erro(500, 'Não foi possível salvar a imagem');
    }
    @chmod($destino, 0644);

    json_out(['url' => '/uploads/' . $nome], 201);
}
