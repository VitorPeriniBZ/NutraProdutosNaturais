<?php
// Rotas de autenticação do painel — porte de routes/auth.js.
// POST /api/auth/login  { email, senha }
// POST /api/auth/logout
// GET  /api/auth/me

function rota_login()
{
    if (auth_rate_excedido()) {
        json_erro(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
    }

    $email = mb_strtolower(trim((string) body_get('email', '')));
    $senha = (string) body_get('senha', '');
    if ($email === '' || $senha === '') {
        json_erro(400, 'Informe email e senha');
    }

    $linhas = db_query('SELECT * FROM admins WHERE email = ?', [$email]);
    $admin = isset($linhas[0]) ? $linhas[0] : null;

    // Verifica o hash mesmo sem admin, para não vazar por tempo se o email existe.
    $hash = $admin ? (string) $admin['senha_hash'] : '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    $ok = password_verify($senha, $hash);

    if (!$admin || !$ok) {
        json_erro(401, 'Email ou senha incorretos');
    }

    db_run('UPDATE admins SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [(int) $admin['id']]);

    auth_sessao_iniciar();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $admin['id'];
    $_SESSION['admin_nome'] = (string) $admin['nome'];
    $_SESSION['admin_email'] = (string) $admin['email'];
    $_SESSION['admin_em'] = time();
    auth_rate_limpar();

    json_out(['ok' => true, 'admin' => ['nome' => $admin['nome'], 'email' => $admin['email']]]);
}

function rota_logout()
{
    auth_logout();
    json_out(['ok' => true]);
}

function rota_me()
{
    $admin = auth_exigir_admin();
    json_out(['admin' => ['nome' => $admin['nome'], 'email' => $admin['email']]]);
}
