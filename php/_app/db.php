<?php
// Camada de banco via PDO, com dois dialetos intercambiáveis:
//   - mysql  : produção (MySQL/MariaDB do cPanel)
//   - sqlite : desenvolvimento/teste local, sem instalar nada
// Interface igual à do projeto Node (placeholders "?"):
//   db_query($sql, $params) -> array de linhas
//   db_run($sql, $params)   -> ['insertId' => int, 'affectedRows' => int]

function db_dialeto()
{
    $c = strtolower((string) cfg('db.client', 'mysql'));
    return $c === 'sqlite' ? 'sqlite' : 'mysql';
}

function db()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $opcoes = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if (db_dialeto() === 'sqlite') {
        $arquivo = (string) cfg('db.sqlite_file', NUTRA_APP . '/tmp/nutra.sqlite');
        $dir = dirname($arquivo);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $pdo = new PDO('sqlite:' . $arquivo, null, null, $opcoes);
        $pdo->exec('PRAGMA foreign_keys = ON;');
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) cfg('db.host', 'localhost'),
        (int) cfg('db.port', 3306),
        (string) cfg('db.name', '')
    );
    $pdo = new PDO($dsn, (string) cfg('db.user', ''), (string) cfg('db.pass', ''), $opcoes);
    return $pdo;
}

function db_query($sql, $params = [])
{
    $st = db()->prepare($sql);
    $st->execute(array_values($params));
    $linhas = $st->fetchAll();
    return $linhas === false ? [] : $linhas;
}

function db_run($sql, $params = [])
{
    $pdo = db();
    $st = $pdo->prepare($sql);
    $st->execute(array_values($params));
    $insertId = 0;
    // lastInsertId() só faz sentido depois de um INSERT.
    if (preg_match('/^\s*insert/i', $sql)) {
        $insertId = (int) $pdo->lastInsertId();
    }
    return ['insertId' => $insertId, 'affectedRows' => (int) $st->rowCount()];
}

// Divide um script SQL em statements, ignorando comentários "--"
// (mesma lógica do db/index.js original).
function db_split_statements($texto)
{
    $linhas = preg_split('/\r?\n/', $texto);
    $limpas = [];
    foreach ($linhas as $l) {
        $i = strpos($l, '--');
        $limpas[] = $i === false ? $l : substr($l, 0, $i);
    }
    $partes = preg_split('/;\s*(?:\r?\n|$)/', implode("\n", $limpas));
    $saida = [];
    foreach ($partes as $p) {
        $p = trim($p);
        if ($p !== '') {
            $saida[] = $p;
        }
    }
    return $saida;
}

function db_exec_script($texto)
{
    foreach (db_split_statements($texto) as $st) {
        db()->exec($st);
    }
}

// LIMIT/OFFSET não podem ser parâmetros vinculados em todos os drivers, então
// são validados como inteiros e interpolados.
function db_limite_offset($limite, $offset)
{
    return ' LIMIT ' . max(1, (int) $limite) . ' OFFSET ' . max(0, (int) $offset);
}
