<?php
declare(strict_types=1);

function requireAuthenticatedPlayer(): int
{
    if (empty($_SESSION['player_id']) || empty($_SESSION['authenticated'])) {
        apiRespond(401, ['error' => 'Non connecté.']);
    }

    return (int) $_SESSION['player_id'];
}

function handleCurrentPlayerRequest(): void
{
    if (empty($_SESSION['player_id']) || empty($_SESSION['pseudo']) || empty($_SESSION['authenticated'])) {
        apiRespond(200, ['authenticated' => false]);
    }

    apiRespond(200, ['authenticated' => true, 'pseudo' => (string) $_SESSION['pseudo']]);
}

function handleCollectionRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $cards = withJsonStore(false, static fn(array &$store, array $catalog): array =>
        getJsonCollection($store, $catalog, $playerId)
    );
    apiRespond(200, ['cards' => $cards]);
}

function handleAllCardsRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $cards = withJsonStore(false, static function (array &$store, array $cards) use ($playerId): array {
        foreach ($cards as &$card) {
            $card['quantity'] = (int) ($store['collections'][(string) $playerId][(string) $card['id']] ?? 0);
        }
        unset($card);
        return $cards;
    });
    apiRespond(200, ['cards' => $cards]);
}

function handleActivityLogsRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $logs = withJsonStore(false, static function (array &$store) use ($playerId): array {
        $logs = array_filter(
            $store['activity_logs'],
            static fn(array $log): bool => (int) $log['player_id'] === $playerId
        );
        usort($logs, static fn(array $a, array $b): int => $b['id'] <=> $a['id']);
        return array_slice(array_values($logs), 0, 100);
    });
    apiRespond(200, ['logs' => $logs]);
}

function handleMatchStatusRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $matchId = filter_var($_GET['match_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$matchId || $matchId < 1) {
        apiRespond(400, ['error' => 'Identifiant de partie invalide.']);
    }

    $status = withJsonStore(false, static fn(array &$store, array $cards): array =>
        getJsonMatchStatus($store, $cards, (int) $matchId, $playerId)
    );
    apiRespond(200, $status);
}

function handleLoginRequest(): void
{
    authenticateRequest('login');
}

function handleRegisterRequest(): void
{
    authenticateRequest('register');
}

function authenticateRequest(string $action): void
{
    $input = apiRequestBody();
    $pseudo = isset($input['pseudo']) && is_string($input['pseudo']) ? trim($input['pseudo']) : '';
    $password = $input['password'] ?? null;
    if ($pseudo === '' || strlen($pseudo) > 50) {
        apiRespond(400, ['error' => 'Pseudo invalide (1 à 50 caractères).']);
    }
    if (!is_string($password) || strlen($password) < 8 || strlen($password) > 72) {
        apiRespond(400, ['error' => 'Le mot de passe doit contenir entre 8 et 72 octets.']);
    }

    $player = withJsonStore(true, static function (array &$store) use ($action, $pseudo, $password): array {
        $playerIndex = findJsonPlayerIndex($store, $pseudo);
        if ($action === 'register') {
            if ($playerIndex !== null) {
                apiRespond(409, ['error' => 'Ce pseudo a déjà un compte. Connecte-toi avec ton mot de passe.']);
            }
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            if (!is_string($passwordHash)) {
                throw new RuntimeException('Impossible de sécuriser le mot de passe.');
            }
            $player = [
                'id' => $store['next_player_id']++,
                'pseudo' => $pseudo,
                'password_hash' => $passwordHash,
                'last_pack_opened_at' => null,
                'created_at' => date(DATE_ATOM),
            ];
            $store['players'][] = $player;
            $store['collections'][(string) $player['id']] = [];
        } else {
            if ($playerIndex === null
                || !password_verify($password, $store['players'][$playerIndex]['password_hash'])) {
                apiRespond(401, ['error' => 'Pseudo ou mot de passe incorrect.']);
            }
            $player = $store['players'][$playerIndex];
        }

        addJsonActivityLog($store, (int) $player['id'], $action === 'register' ? 'account_created' : 'login');
        return [
            'id' => (int) $player['id'],
            'pseudo' => $player['pseudo'],
            'last_pack_opened_at' => $player['last_pack_opened_at'],
        ];
    });

    session_regenerate_id(true);
    $_SESSION['player_id'] = $player['id'];
    $_SESSION['pseudo'] = $player['pseudo'];
    $_SESSION['authenticated'] = true;
    apiRespond(200, $player);
}

function handleLogoutRequest(): void
{
    if (!empty($_SESSION['player_id']) && !empty($_SESSION['authenticated'])) {
        $playerId = (int) $_SESSION['player_id'];
        withJsonStore(true, static function (array &$store) use ($playerId): void {
            addJsonActivityLog($store, $playerId, 'logout');
        });
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $cookie = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $cookie['path'],
            'domain' => $cookie['domain'],
            'secure' => $cookie['secure'],
            'httponly' => $cookie['httponly'],
            'samesite' => $cookie['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();
    apiRespond(200, ['success' => true]);
}

function handleOpenPackRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $result = withJsonStore(true, static function (array &$store, array $cards) use ($playerId): array {
        $playerIndex = findJsonPlayerIndexById($store, $playerId);
        if ($playerIndex === null) {
            apiRespond(401, ['error' => 'Compte introuvable. Reconnecte-toi.']);
        }

        $lastOpened = $store['players'][$playerIndex]['last_pack_opened_at'];
        $remaining = $lastOpened === null ? 0 : 20 * 60 - (time() - strtotime($lastOpened));
        if ($remaining > 0) {
            apiRespond(429, [
                'error' => 'Pack pas encore disponible.',
                'remaining_minutes' => (int) ceil($remaining / 60),
            ]);
        }

        shuffle($cards);
        $cards = array_slice($cards, 0, 5);
        if (count($cards) < 5) {
            throw new RuntimeException('Il faut au moins cinq cartes dans le catalogue.');
        }
        foreach ($cards as $card) {
            addJsonCollectionCard($store, $playerId, (int) $card['id']);
        }

        $openedAt = date(DATE_ATOM);
        $store['players'][$playerIndex]['last_pack_opened_at'] = $openedAt;
        addJsonActivityLog($store, $playerId, 'pack_opened', [
            'cards' => array_column($cards, 'name'),
            'count' => count($cards),
        ]);
        return ['success' => true, 'cards' => $cards, 'last_pack_opened_at' => $openedAt];
    });

    apiRespond(200, $result);
}

require_once __DIR__ . '/game_requests.php';
