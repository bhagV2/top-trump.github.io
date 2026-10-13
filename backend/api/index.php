<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../functions/json_store.php';
require_once __DIR__ . '/requests.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$allowedOrigin = getenv('TOPTRUMP_ALLOWED_ORIGIN');
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (is_string($allowedOrigin) && $allowedOrigin !== '' && hash_equals($allowedOrigin, $requestOrigin)) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

set_exception_handler(static function (Throwable $error): void {
    error_log('Erreur API Top Trump : ' . $error);
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode(['error' => 'Erreur interne du serveur. Consulte les logs PHP/Apache.']);
});

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$route = isset($_GET['route']) && is_string($_GET['route']) ? trim($_GET['route']) : '';
$action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : '';

function traiterGet(string $route, string $action): void
{
    switch ($action) {
        case 'login':
        case 'register':
        case 'create_account':
        case 'logout':
        case 'open_pack':
        case 'find_match':
        case 'play_turn':
        case 'surrender':
            header('Allow: POST');
            apiRespond(405, ['error' => 'Cette action doit être envoyée en POST. Recharge la page puis réessaie.']);
    }

    switch ($route) {
        case 'current_player':
            handleCurrentPlayerRequest();
            break;

        case 'collection':
            handleCollectionRequest();
            break;

        case 'all_cards':
            handleAllCardsRequest();
            break;

        case 'activity_logs':
            handleActivityLogsRequest();
            break;

        case 'match_status':
            handleMatchStatusRequest();
            break;

        default:
            apiRespond(404, ['error' => 'Route GET introuvable.']);
    }
}

function traiterPost(string $action): void
{
    switch ($action) {
        case 'login':
            handleLoginRequest();
            break;

        case 'register':
        case 'create_account':
            handleRegisterRequest();
            break;

        case 'logout':
            handleLogoutRequest();
            break;

        case 'open_pack':
            handleOpenPackRequest();
            break;

        case 'find_match':
            handleFindMatchRequest();
            break;

        case 'play_turn':
            handlePlayTurnRequest();
            break;

        case 'surrender':
            handleSurrenderRequest();
            break;

        default:
            apiRespond(404, ['error' => 'Action POST inconnue.']);
    }
}

switch ($method) {
    case 'GET':
        traiterGet($route, $action);
        break;

    case 'POST':
        traiterPost($action);
        break;

    default:
        header('Allow: GET, POST');
        apiRespond(405, ['error' => 'La méthode n’est pas autorisée.']);
}
