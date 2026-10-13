<?php
declare(strict_types=1);

function handleFindMatchRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $cardIds = apiRequestBody()['card_ids'] ?? null;

    if (!is_array($cardIds) || count($cardIds) !== 5) {
        apiRespond(400, ['error' => 'Choisis exactement 5 cartes différentes que tu possèdes pour commencer le duel.']);
    }

    $cardIds = array_map(static fn($id): int => filter_var($id, FILTER_VALIDATE_INT) ?: 0, $cardIds);
    if (in_array(0, $cardIds, true) || count(array_unique($cardIds)) !== 5) {
        apiRespond(400, ['error' => 'Choisis exactement 5 cartes différentes que tu possèdes pour commencer le duel.']);
    }

    $result = withJsonStore(true, static function (array &$store) use ($playerId, $cardIds): array {
        foreach ($store['matches'] as $match) {
            if (in_array($match['status'], ['waiting', 'in_progress'], true)
                && ((int) $match['player1_id'] === $playerId || (int) ($match['player2_id'] ?? 0) === $playerId)) {
                return ['match_id' => (int) $match['id'], 'status' => $match['status']];
            }
        }

        foreach ($cardIds as $cardId) {
            if (($store['collections'][(string) $playerId][(string) $cardId] ?? 0) < 1) {
                apiRespond(400, ['error' => 'Choisis exactement 5 cartes différentes que tu possèdes pour commencer le duel.']);
            }
        }

        foreach ($store['matches'] as &$match) {
            if ($match['status'] !== 'waiting' || (int) $match['player1_id'] === $playerId) {
                continue;
            }

            $player1Id = (int) $match['player1_id'];
            $player1 = getJsonPlayerById($store, $player1Id);
            $player2 = getJsonPlayerById($store, $playerId);
            $match['player2_id'] = $playerId;
            $match['player2_hand'] = $cardIds;
            $match['status'] = 'in_progress';
            $match['attribute_chooser_id'] = $player1Id;
            $match['current_turn_player_id'] = $player1Id;

            addJsonActivityLog($store, $player1Id, 'duel_started', [
                'match_id' => (int) $match['id'],
                'opponent' => $player2['pseudo'],
            ]);
            addJsonActivityLog($store, $playerId, 'duel_started', [
                'match_id' => (int) $match['id'],
                'opponent' => $player1['pseudo'],
            ]);

            $result = ['match_id' => (int) $match['id'], 'status' => 'in_progress'];
            unset($match);
            return $result;
        }
        unset($match);

        $matchId = $store['next_match_id']++;
        $store['matches'][] = [
            'id' => $matchId,
            'player1_id' => $playerId,
            'player2_id' => null,
            'player1_hand' => $cardIds,
            'player2_hand' => [],
            'status' => 'waiting',
            'attribute_chooser_id' => null,
            'current_turn_player_id' => null,
            'winner_id' => null,
            'player1_score' => 0,
            'player2_score' => 0,
            'last_round' => null,
            'created_at' => date(DATE_ATOM),
        ];
        addJsonActivityLog($store, $playerId, 'matchmaking_started', ['match_id' => $matchId]);

        return ['match_id' => $matchId, 'status' => 'waiting'];
    });

    apiRespond(200, $result);
}

function handlePlayTurnRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $input = apiRequestBody();
    $matchId = filter_var($input['match_id'] ?? null, FILTER_VALIDATE_INT);
    $attribute = $input['attribute'] ?? null;
    $allowedAttributes = ['force', 'vitesse', 'taille', 'dangerosite', 'intelligence'];

    if (!$matchId || !is_string($attribute) || !in_array($attribute, $allowedAttributes, true)) {
        apiRespond(400, ['error' => 'Paramètres invalides.']);
    }

    $result = withJsonStore(true, static function (array &$store, array $cards) use ($matchId, $attribute, $playerId): array {
        $matchIndex = findJsonMatchIndex($store, (int) $matchId);
        if ($matchIndex === null) {
            apiRespond(404, ['error' => 'Partie introuvable.']);
        }

        $match = &$store['matches'][$matchIndex];
        if ($match['status'] !== 'in_progress') {
            apiRespond(400, ['error' => 'Cette partie n’est pas en cours.']);
        }
        if ((int) $match['attribute_chooser_id'] !== $playerId) {
            apiRespond(403, ['error' => 'Ce n’est pas à toi de choisir l’attribut.']);
        }

        $cardMap = indexJsonCards($cards);
        $card1 = $cardMap[(int) ($match['player1_hand'][0] ?? 0)] ?? null;
        $card2 = $cardMap[(int) ($match['player2_hand'][0] ?? 0)] ?? null;
        if ($card1 === null || $card2 === null) {
            apiRespond(500, ['error' => 'Un des joueurs n’a plus de carte.']);
        }

        $player1Id = (int) $match['player1_id'];
        $player2Id = (int) $match['player2_id'];
        $value1 = (int) $card1[$attribute];
        $value2 = (int) $card2[$attribute];
        $winnerId = $value1 === $value2 ? null : ($value1 > $value2 ? $player1Id : $player2Id);
        $transferredCount = 0;

        if ($winnerId !== null) {
            array_shift($match['player1_hand']);
            array_shift($match['player2_hand']);

            $loserId = $winnerId === $player1Id ? $player2Id : $player1Id;
            $losingCard = $winnerId === $player1Id ? $card2 : $card1;
            transferJsonCollectionCard($store, $loserId, $winnerId, (int) $losingCard['id']);
            $match[$winnerId === $player1Id ? 'player1_score' : 'player2_score']++;
            $transferredCount = 2;
        }

        $nextChooser = $winnerId ?? (int) $match['attribute_chooser_id'];
        $match['attribute_chooser_id'] = $nextChooser;
        $match['current_turn_player_id'] = $nextChooser;
        $match['last_round'] = [
            'attribute' => $attribute,
            'player1_value' => $value1,
            'player2_value' => $value2,
            'winner_id' => $winnerId,
            'at' => sprintf('%s.%06dZ', gmdate('Y-m-d\TH:i:s'), (int) ((microtime(true) * 1000000) % 1000000)),
            'player1_name' => $card1['name'],
            'player1_image' => $card1['card_image_path'],
            'player2_name' => $card2['name'],
            'player2_image' => $card2['card_image_path'],
        ];

        $gameOver = $match['player1_score'] >= 3 || $match['player2_score'] >= 3;
        $finalWinnerId = null;
        if ($gameOver) {
            $finalWinnerId = $match['player1_score'] >= 3 ? $player1Id : $player2Id;
            $match['status'] = 'finished';
            $match['winner_id'] = $finalWinnerId;
            $match['finished_at'] = date(DATE_ATOM);
        }

        $player1 = getJsonPlayerById($store, $player1Id);
        $player2 = getJsonPlayerById($store, $player2Id);
        foreach ([
            [$player1Id, $player2['pseudo'], $card1, $card2, $value1, $value2, $winnerId === null ? 'draw' : ($winnerId === $player1Id ? 'won' : 'lost')],
            [$player2Id, $player1['pseudo'], $card2, $card1, $value2, $value1, $winnerId === null ? 'draw' : ($winnerId === $player2Id ? 'won' : 'lost')],
        ] as [$id, $opponent, $ownCard, $opponentCard, $ownValue, $opponentValue, $outcome]) {
            addJsonActivityLog($store, $id, 'duel_round', [
                'match_id' => (int) $matchId,
                'opponent' => $opponent,
                'attribute' => $attribute,
                'your_card' => $ownCard['name'],
                'your_value' => $ownValue,
                'opponent_card' => $opponentCard['name'],
                'opponent_value' => $opponentValue,
                'result' => $outcome,
            ]);
        }

        if ($gameOver) {
            $loserId = $finalWinnerId === $player1Id ? $player2Id : $player1Id;
            addJsonActivityLog($store, $finalWinnerId, 'duel_won', [
                'match_id' => (int) $matchId,
                'opponent' => $loserId === $player1Id ? $player1['pseudo'] : $player2['pseudo'],
                'cards_received_this_round' => $transferredCount,
            ]);
            addJsonActivityLog($store, $loserId, 'duel_lost', [
                'match_id' => (int) $matchId,
                'opponent' => $finalWinnerId === $player1Id ? $player1['pseudo'] : $player2['pseudo'],
                'cards_lost_this_round' => $transferredCount,
            ]);
        }

        $response = [
            'attribute' => $attribute,
            'player1_value' => $value1,
            'player2_value' => $value2,
            'round_winner_id' => $winnerId,
            'game_over' => $gameOver,
            'final_winner_id' => $finalWinnerId,
            'player1_score' => (int) $match['player1_score'],
            'player2_score' => (int) $match['player2_score'],
            'transferred_card_count' => $transferredCount,
            'cards_remaining' => [
                'player1' => count($match['player1_hand']),
                'player2' => count($match['player2_hand']),
            ],
        ];
        unset($match);
        return $response;
    });

    apiRespond(200, $result);
}

function handleSurrenderRequest(): void
{
    $playerId = requireAuthenticatedPlayer();
    $matchId = filter_var(apiRequestBody()['match_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$matchId || $matchId < 1) {
        apiRespond(400, ['error' => 'Identifiant de partie invalide.']);
    }

    $result = withJsonStore(true, static function (array &$store) use ($matchId, $playerId): array {
        $matchIndex = findJsonMatchIndex($store, (int) $matchId);
        if ($matchIndex === null) {
            apiRespond(404, ['error' => 'Partie introuvable.']);
        }

        $match = &$store['matches'][$matchIndex];
        if ((int) $match['player1_id'] !== $playerId && (int) ($match['player2_id'] ?? 0) !== $playerId) {
            apiRespond(403, ['error' => 'Tu ne participes pas à cette partie.']);
        }
        if ($match['status'] !== 'in_progress') {
            apiRespond(400, ['error' => 'Cette partie ne peut plus être abandonnée.']);
        }

        $winnerId = (int) $match['player1_id'] === $playerId
            ? (int) $match['player2_id']
            : (int) $match['player1_id'];
        $handKey = (int) $match['player1_id'] === $playerId ? 'player1_hand' : 'player2_hand';
        $transferredCount = count($match[$handKey]);
        foreach ($match[$handKey] as $cardId) {
            transferJsonCollectionCard($store, $playerId, $winnerId, (int) $cardId);
        }

        $match[$handKey] = [];
        $match['status'] = 'finished';
        $match['winner_id'] = $winnerId;
        $match['finished_at'] = date(DATE_ATOM);
        $winner = getJsonPlayerById($store, $winnerId);

        addJsonActivityLog($store, $playerId, 'duel_surrendered', [
            'match_id' => (int) $matchId,
            'opponent' => $winner['pseudo'],
            'cards_lost' => $transferredCount,
        ]);
        addJsonActivityLog($store, $winnerId, 'duel_won', [
            'match_id' => (int) $matchId,
            'opponent' => (string) $_SESSION['pseudo'],
            'by_surrender' => true,
            'cards_received' => $transferredCount,
        ]);

        unset($match);
        return [
            'success' => true,
            'winner_id' => $winnerId,
            'forfeited_player_id' => $playerId,
            'transferred_card_count' => $transferredCount,
        ];
    });

    apiRespond(200, $result);
}
