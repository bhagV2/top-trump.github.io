<?php
declare(strict_types=1);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestPath = is_string($requestPath) ? rawurldecode($requestPath) : '/';
$requestPath = str_replace('\\', '/', $requestPath);

if (preg_match('~(?:^|/)backend/data(?:/|$)~i', $requestPath) === 1) {
    http_response_code(404);
    exit;
}

$filePath = __DIR__ . DIRECTORY_SEPARATOR
    . str_replace('/', DIRECTORY_SEPARATOR, ltrim($requestPath, '/'));
if (is_file($filePath) || is_dir($filePath)) {
    return false;
}

http_response_code(404);
