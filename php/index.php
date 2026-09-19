<?php
// Página pública. Renderiza o template do site substituindo os placeholders
// {{TOKEN}} pelos dados da loja (banco > config.php), do mesmo jeito que o
// server.js fazia — assim os metadados e o JSON-LD chegam prontos no HTML,
// sem depender de JavaScript, preservando o SEO.
//
// SEGURANÇA DE ROLLBACK: enquanto a aplicação não estiver instalada, este
// arquivo entrega o index.html estático que já estava no ar. Ou seja, subir
// estes arquivos NÃO altera o site; a troca só acontece depois da instalação.
// Para voltar ao site estático a qualquer momento, basta apagar o index.php.

require_once __DIR__ . '/_app/bootstrap.php';

$estatico = __DIR__ . '/index.html';
$template = NUTRA_APP . '/templates/index.tpl.html';

function nutra_entregar_estatico($caminho)
{
    if (is_file($caminho)) {
        header('Content-Type: text/html; charset=utf-8');
        echo file_get_contents($caminho);
        exit;
    }
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Site em manutenção.';
    exit;
}

if (!nutra_instalado() || !is_file($template)) {
    nutra_entregar_estatico($estatico);
}

function esc_html($s)
{
    return htmlspecialchars((string) ($s === null ? '' : $s), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// JSON seguro para embutir dentro de <script> (não fecha a tag por engano).
function json_para_script($obj)
{
    $j = json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return str_replace('<', '\\u003c', (string) $j);
}

function montar_jsonld($s)
{
    $partes = preg_split('/\s*[-–]\s*/', (string) $s['city']);
    $localidade = isset($partes[0]) ? $partes[0] : (string) $s['city'];
    $regiao = isset($partes[1]) ? $partes[1] : '';

    return [
        '@context'    => 'https://schema.org',
        '@type'       => 'Store',
        'name'        => $s['name'],
        'description' => 'Loja de produtos naturais: orgânicos, chás e ervas, alimentos a granel e suplementação.',
        'image'       => 'https://www.nutraprodutosnaturais.com.br/og-image.jpg',
        'url'         => 'https://www.nutraprodutosnaturais.com.br/',
        'telephone'   => '+' . $s['whatsapp'],
        'priceRange'  => '$$',
        'address'     => [
            '@type'           => 'PostalAddress',
            'streetAddress'   => $s['address'],
            'addressLocality' => $localidade,
            'addressRegion'   => $regiao,
            'postalCode'      => $s['cep'],
            'addressCountry'  => 'BR',
        ],
        'openingHoursSpecification' => [
            [
                '@type'     => 'OpeningHoursSpecification',
                'dayOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                'opens'     => '09:00',
                'closes'    => '18:00',
            ],
            [
                '@type'     => 'OpeningHoursSpecification',
                'dayOfWeek' => ['Saturday'],
                'opens'     => '09:00',
                'closes'    => '12:00',
            ],
        ],
        'sameAs' => [$s['instagram']],
    ];
}

try {
    $pub = loja_carregar();
    $html = file_get_contents($template);
    if ($html === false) {
        nutra_entregar_estatico($estatico);
    }

    $tokens = [
        'STORE_NAME'     => esc_html($pub['name']),
        'STORE_WHATSAPP' => esc_html($pub['whatsapp']),
        'STORE_ADDRESS'  => esc_html($pub['address']),
        'STORE_CITY'     => esc_html($pub['city']),
        'STORE_CEP'      => esc_html($pub['cep']),
        'STORE_HOURS'    => esc_html($pub['hours']),
        'INSTAGRAM_URL'  => esc_html($pub['instagram']),
        'JSONLD'         => json_para_script(montar_jsonld($pub)),
        'CONFIG_JSON'    => json_para_script($pub),
    ];

    $html = preg_replace_callback('/\{\{(\w+)\}\}/', function ($m) use ($tokens) {
        return array_key_exists($m[1], $tokens) ? $tokens[$m[1]] : $m[0];
    }, $html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
} catch (Throwable $e) {
    // Qualquer falha (banco fora, por exemplo) cai no site estático em vez de
    // deixar a loja fora do ar.
    nutra_log('[index] ' . $e->getMessage());
    nutra_entregar_estatico($estatico);
}
