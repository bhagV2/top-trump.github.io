<?php

$sessionLifetime = 60 * 60 * 24 * 30;
$configuredSameSite = getenv('TOPTRUMP_COOKIE_SAMESITE') ?: 'Lax';
$sameSite = in_array($configuredSameSite, ['Lax', 'Strict', 'None'], true)
    ? $configuredSameSite
    : 'Lax';
$scriptDirectory = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$projectPath = preg_replace('~/(?:frontend|backend/api)$~', '', $scriptDirectory);
$sessionPath = ($projectPath === '' ? '' : $projectPath) . '/backend/api/';

session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path' => $sessionPath,
    'secure' => $sameSite === 'None' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => $sameSite,
]);
ini_set('session.gc_maxlifetime', (string) $sessionLifetime);

session_start();
