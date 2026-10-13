<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$frontendRoot = $projectRoot . DIRECTORY_SEPARATOR . 'frontend';
$docsRoot = $projectRoot . DIRECTORY_SEPARATOR . 'docs';
$pages = [
    'index' => 'index.php',
    'collection' => 'collection.php',
    'cards' => 'cards.php',
    'deck' => 'deck.php',
    'game' => 'game.php',
    'activity' => 'activity.php',
];

ensureDirectory($docsRoot);
foreach ($pages as $pageName => $sourceFile) {
    $_SERVER['SCRIPT_NAME'] = '/frontend/' . $sourceFile;
    ob_start();
    require $frontendRoot . DIRECTORY_SEPARATOR . $sourceFile;
    $html = ob_get_clean();
    if (!is_string($html)) {
        throw new RuntimeException('Impossible de générer la page ' . $sourceFile . '.');
    }

    $html = preg_replace(
        '~((?:href|action)=["\'][^"\']*)\.php(?=[?#"\'])~i',
        '$1.html',
        $html
    );
    if (!is_string($html)) {
        throw new RuntimeException('Impossible de convertir les liens de ' . $sourceFile . '.');
    }
    writeFile($docsRoot . DIRECTORY_SEPARATOR . $pageName . '.html', $html);
}

copyDirectory($frontendRoot . DIRECTORY_SEPARATOR . 'css', $docsRoot . DIRECTORY_SEPARATOR . 'css');
copyDirectory($frontendRoot . DIRECTORY_SEPARATOR . 'assets', $docsRoot . DIRECTORY_SEPARATOR . 'assets');
copyDirectory(
    $frontendRoot . DIRECTORY_SEPARATOR . 'js',
    $docsRoot . DIRECTORY_SEPARATOR . 'js',
    ['api-config.js']
);

$docsApiConfig = $docsRoot . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'api-config.js';
if (($apiUrl = getenv('TOPTRUMP_API_URL')) !== false && $apiUrl !== '') {
    $apiUrlParts = parse_url($apiUrl);
    if (
        filter_var($apiUrl, FILTER_VALIDATE_URL) === false
        || !is_array($apiUrlParts)
        || strtolower($apiUrlParts['scheme'] ?? '') !== 'https'
        || empty($apiUrlParts['host'])
        || isset($apiUrlParts['user'])
        || isset($apiUrlParts['pass'])
        || isset($apiUrlParts['query'])
        || isset($apiUrlParts['fragment'])
    ) {
        throw new RuntimeException('TOPTRUMP_API_URL doit être une URL HTTPS valide, sans paramètres ni fragment.');
    }

    $encodedApiUrl = json_encode($apiUrl, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    if (!is_string($encodedApiUrl)) {
        throw new RuntimeException('Impossible d’encoder TOPTRUMP_API_URL.');
    }
    writeFile(
        $docsApiConfig,
        'window.TOPTRUMP_API_URL = ' . $encodedApiUrl . ';' . PHP_EOL . PHP_EOL
        . "window.apiFetch = (url, options = {}) => fetch(url, {" . PHP_EOL
        . "  ...options," . PHP_EOL
        . "  credentials: 'include'," . PHP_EOL
        . '});' . PHP_EOL
    );
} elseif (!is_file($docsApiConfig)) {
    throw new RuntimeException('Ajoute docs/js/api-config.js avec l’URL de ton API PHP avant de publier.');
}
writeFile($docsRoot . DIRECTORY_SEPARATOR . '.nojekyll', '');

echo 'Pages statiques générées dans docs/.' . PHP_EOL;

function ensureDirectory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0755, true) && !is_dir($path)) {
        throw new RuntimeException('Impossible de créer le dossier ' . $path . '.');
    }
}

function writeFile(string $path, string $contents): void
{
    ensureDirectory(dirname($path));
    if (file_put_contents($path, $contents) === false) {
        throw new RuntimeException('Impossible d’écrire le fichier ' . $path . '.');
    }
}

function copyDirectory(string $source, string $destination, array $excludedFiles = []): void
{
    if (!is_dir($source)) {
        throw new RuntimeException('Dossier source introuvable : ' . $source . '.');
    }
    ensureDirectory($destination);

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $item) {
        $relativePath = substr($item->getPathname(), strlen($source) + 1);
        if ($item->isFile() && in_array(basename($relativePath), $excludedFiles, true)) {
            continue;
        }

        $targetPath = $destination . DIRECTORY_SEPARATOR . $relativePath;
        if ($item->isDir()) {
            ensureDirectory($targetPath);
            continue;
        }

        ensureDirectory(dirname($targetPath));
        if (!copy($item->getPathname(), $targetPath)) {
            throw new RuntimeException('Impossible de copier ' . $relativePath . '.');
        }

        if (pathinfo($targetPath, PATHINFO_EXTENSION) === 'js') {
            $contents = file_get_contents($targetPath);
            if (!is_string($contents)) {
                throw new RuntimeException('Impossible de lire ' . $targetPath . '.');
            }
            $contents = str_replace(
                ['index.php', 'collection.php', 'cards.php', 'deck.php', 'game.php', 'activity.php'],
                ['index.html', 'collection.html', 'cards.html', 'deck.html', 'game.html', 'activity.html'],
                $contents
            );
            if (!is_string($contents) || file_put_contents($targetPath, $contents) === false) {
                throw new RuntimeException('Impossible de préparer ' . $relativePath . ' pour Pages.');
            }
        }
    }
}
