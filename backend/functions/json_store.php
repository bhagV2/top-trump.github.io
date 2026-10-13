<?php
declare(strict_types=1);

const TOPTRUMP_STORE_PATH = __DIR__ . '/../data/store.json';
const TOPTRUMP_CARDS_PATH = __DIR__ . '/../generation/cards.json';

function apiRespond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function apiRequestBody(): array
{
    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function withJsonStore(bool $write, callable $callback): mixed
{
    $directory = dirname(TOPTRUMP_STORE_PATH);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Impossible de créer le répertoire de données.');
    }

    $handle = fopen(TOPTRUMP_STORE_PATH, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Impossible d’ouvrir le fichier de données.');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Impossible de verrouiller le fichier de données.');
        }
        rewind($handle);
        $contents = stream_get_contents($handle);
        if ($contents === false) {
            throw new RuntimeException('Impossible de lire le fichier de données.');
        }
        if (trim($contents) === '') {
            $store = initialJsonStore();
        } else {
            $store = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            validateJsonStore($store);
        }

        $cards = loadJsonCards();
        $result = $callback($store, $cards);

        if ($write || trim($contents) === '') {
            $encoded = json_encode(
                $store,
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
            rewind($handle);
            if (!ftruncate($handle, 0) || fwrite($handle, $encoded . PHP_EOL) === false || !fflush($handle)) {
                throw new RuntimeException('Impossible d’enregistrer les données.');
            }
        }

        flock($handle, LOCK_UN);
        return $result;
    } finally {
        fclose($handle);
    }
}

function initialJsonStore(): array
{
    return [
        'version' => 1,
        'next_player_id' => 1,
        'next_match_id' => 1,
        'next_activity_id' => 1,
        'players' => [],
        'collections' => [],
        'matches' => [],
        'activity_logs' => [],
    ];
}

function validateJsonStore(mixed $store): void
{
    $keys = ['players', 'collections', 'matches', 'activity_logs'];
    if (!is_array($store)
        || ($store['version'] ?? null) !== 1
        || array_filter($keys, static fn(string $key): bool => !isset($store[$key]) || !is_array($store[$key])) !== []) {
        throw new RuntimeException('Le fichier de données est invalide ou incompatible.');
    }
}

function loadJsonCards(): array
{
    $contents = file_get_contents(TOPTRUMP_CARDS_PATH);
    if ($contents === false) {
        throw new RuntimeException('Le catalogue de cartes est introuvable.');
    }
    $source = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($source) || count($source) < 5) {
        throw new RuntimeException('Le catalogue doit contenir au moins cinq cartes.');
    }

    $cards = [];
    foreach (array_values($source) as $index => $card) {
        if (!isset($card['slug'], $card['name'], $card['image'], $card['card'], $card['stats'])
            || !is_array($card['stats'])) {
            throw new RuntimeException('Une carte du catalogue est incomplète.');
        }
        $cards[] = [
            'id' => $index + 1,
            'slug' => (string) $card['slug'],
            'name' => (string) $card['name'],
            'image_path' => (string) $card['image'],
            'card_image_path' => (string) $card['card'],
            'force' => (int) ($card['stats']['force'] ?? 0),
            'vitesse' => (int) ($card['stats']['vitesse'] ?? 0),
            'taille' => (int) ($card['stats']['taille'] ?? 0),
            'dangerosite' => (int) ($card['stats']['dangerosite'] ?? 0),
            'intelligence' => (int) ($card['stats']['intelligence'] ?? 0),
        ];
    }
    return $cards;
}

function indexJsonCards(array $cards): array
{
    $indexed = [];
    foreach ($cards as $card) {
        $indexed[(int) $card['id']] = $card;
    }
    return $indexed;
}

function findJsonPlayerIndex(array $store, string $pseudo): ?int
{
    foreach ($store['players'] as $index => $player) {
        if (strcasecmp((string) $player['pseudo'], $pseudo) === 0) {
            return $index;
        }
    }
    return null;
}

function findJsonPlayerIndexById(array $store, int $playerId): ?int
{
    foreach ($store['players'] as $index => $player) {
        if ((int) $player['id'] === $playerId) {
            return $index;
        }
    }
    return null;
}

function getJsonPlayerById(array $store, int $playerId): array
{
    $index = findJsonPlayerIndexById($store, $playerId);
    if ($index === null) {
        throw new RuntimeException('Joueur introuvable.');
    }
    return $store['players'][$index];
}

function findJsonMatchIndex(array $store, int $matchId): ?int
{
    foreach ($store['matches'] as $index => $match) {
        if ((int) $match['id'] === $matchId) {
            return $index;
        }
    }
    return null;
}

function addJsonCollectionCard(array &$store, int $playerId, int $cardId): void
{
    $playerKey = (string) $playerId;
    $cardKey = (string) $cardId;
    if (!isset($store['collections'][$playerKey])) {
        $store['collections'][$playerKey] = [];
    }
    $store['collections'][$playerKey][$cardKey] = (int) ($store['collections'][$playerKey][$cardKey] ?? 0) + 1;
}

function transferJsonCollectionCard(array &$store, int $fromPlayerId, int $toPlayerId, int $cardId): void
{
    if ($fromPlayerId === $toPlayerId) {
        return;
    }

    $fromKey = (string) $fromPlayerId;
    $cardKey = (string) $cardId;
    $quantity = (int) ($store['collections'][$fromKey][$cardKey] ?? 0);
    if ($quantity < 1) {
        throw new RuntimeException('La carte à transférer est absente de la collection de son propriétaire.');
    }
    if ($quantity === 1) {
        unset($store['collections'][$fromKey][$cardKey]);
    } else {
        $store['collections'][$fromKey][$cardKey] = $quantity - 1;
    }
    addJsonCollectionCard($store, $toPlayerId, $cardId);
}

function getJsonCollection(array $store, array $cards, int $playerId): array
{
    $quantities = $store['collections'][(string) $playerId] ?? [];
    $catalog = indexJsonCards($cards);
    $collection = [];
    foreach ($quantities as $cardId => $quantity) {
        $card = $catalog[(int) $cardId] ?? null;
        if ($card !== null && (int) $quantity > 0) {
            $card['quantity'] = (int) $quantity;
            $collection[] = $card;
        }
    }
    usort($collection, static fn(array $left, array $right): int => strcasecmp($left['name'], $right['name']));
    return $collection;
}

function addJsonActivityLog(array &$store, int $playerId, string $eventType, array $details = []): void
{
    $store['activity_logs'][] = [
        'id' => $store['next_activity_id']++,
        'player_id' => $playerId,
        'event_type' => $eventType,
        'details' => $details,
        'created_at' => date('Y-m-d H:i:s'),
    ];
}

function getJsonMatchStatus(array $store, array $cards, int $matchId, int $playerId): array
{
    $index = findJsonMatchIndex($store, $matchId);
    if ($index === null) {
        apiRespond(404, ['error' => 'Partie introuvable.']);
    }
    $match = $store['matches'][$index];
    if ((int) $match['player1_id'] !== $playerId && (int) ($match['player2_id'] ?? 0) !== $playerId) {
        apiRespond(403, ['error' => 'Tu ne fais pas partie de cette partie.']);
    }

    $player1 = getJsonPlayerById($store, (int) $match['player1_id']);
    $player2 = $match['player2_id'] === null ? null : getJsonPlayerById($store, (int) $match['player2_id']);
    $response = [
        'match_id' => (int) $match['id'],
        'status' => $match['status'],
        'player1_pseudo' => $player1['pseudo'],
        'player2_pseudo' => $player2['pseudo'] ?? null,
        'player1_id' => (int) $match['player1_id'],
        'player2_id' => $match['player2_id'] === null ? null : (int) $match['player2_id'],
    ];
    if (in_array($match['status'], ['in_progress', 'finished'], true)) {
        $response['current_turn_player_id'] = $match['current_turn_player_id'];
        $response['attribute_chooser_id'] = $match['attribute_chooser_id'];
        $response['your_player_id'] = $playerId;
        $response['player1_score'] = (int) $match['player1_score'];
        $response['player2_score'] = (int) $match['player2_score'];
        $response['cards_remaining'] = [
            'player1' => count($match['player1_hand']),
            'player2' => count($match['player2_hand']),
        ];
        if ($match['status'] === 'in_progress') {
            $topCardId = (int) (($playerId === (int) $match['player1_id']
                ? $match['player1_hand'][0] ?? null
                : $match['player2_hand'][0] ?? null) ?? 0);
            $card = indexJsonCards($cards)[$topCardId] ?? null;
            if ($card !== null) {
                $response['your_card'] = [
                    'id' => $card['id'],
                    'name' => $card['name'],
                    'card_image_path' => $card['card_image_path'],
                ];
            }
        }
        if ($match['last_round'] !== null) {
            $response['last_round'] = $match['last_round'];
        }
    }
    if ($match['status'] === 'finished') {
        $response['winner_id'] = $match['winner_id'];
    }
    return $response;
}
