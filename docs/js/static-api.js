(() => {
  window.TOPTRUMP_API_URL = './__local_api__';
  const STORAGE_KEY = 'top-trump-pages-v1';
  const ATTRIBUTES = ['force', 'vitesse', 'taille', 'dangerosite', 'intelligence'];
  let catalogPromise;

  function emptyStore() {
    return {
      nextPlayerId: 1,
      nextMatchId: 1,
      nextActivityId: 1,
      currentPlayerId: null,
      players: [],
      collections: {},
      matches: [],
      activityLogs: [],
    };
  }

  function readStore() {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return emptyStore();

    const store = JSON.parse(serialized);
    if (
      !store
      || !Array.isArray(store.players)
      || !store.collections
      || !Array.isArray(store.matches)
      || !Array.isArray(store.activityLogs)
    ) {
      throw new Error('Les données locales sont invalides. Efface les données du site dans ton navigateur pour recommencer.');
    }
    return store;
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  async function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('data/cards.json', { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`Catalogue de cartes introuvable (HTTP ${response.status}).`);
          return response.json();
        })
        .then(cards => {
          if (!Array.isArray(cards) || cards.length < 5) {
            throw new Error('Le catalogue doit contenir au moins cinq cartes.');
          }
          return cards.map((card, index) => ({
            id: index + 1,
            slug: card.slug,
            name: card.name,
            image_path: card.image,
            card_image_path: card.card,
            ...card.stats,
          }));
        });
    }
    return catalogPromise;
  }

  function result(status, payload) {
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return payload;
      },
      async text() {
        return JSON.stringify(payload);
      },
    };
  }

  function failure(status, error, extra = {}) {
    return result(status, { error, ...extra });
  }

  function activity(store, playerId, eventType, details = {}) {
    store.activityLogs.push({
      id: store.nextActivityId++,
      player_id: playerId,
      event_type: eventType,
      details,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  function currentPlayer(store) {
    return store.players.find(player => player.id === store.currentPlayerId) || null;
  }

  function ownedCards(store, catalog, playerId) {
    const quantities = store.collections[String(playerId)] || {};
    return catalog
      .filter(card => Number(quantities[String(card.id)] || 0) > 0)
      .map(card => ({ ...card, quantity: Number(quantities[String(card.id)]) }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function addCard(store, playerId, cardId) {
    const collection = store.collections[String(playerId)] || (store.collections[String(playerId)] = {});
    const key = String(cardId);
    collection[key] = Number(collection[key] || 0) + 1;
  }

  function removeCard(store, playerId, cardId) {
    const collection = store.collections[String(playerId)] || {};
    const key = String(cardId);
    const quantity = Number(collection[key] || 0);
    if (quantity <= 1) delete collection[key];
    else collection[key] = quantity - 1;
  }

  async function passwordHash(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('La connexion nécessite HTTPS. Ouvre le site depuis son adresse GitHub Pages sécurisée.');
    }
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function randomCardIds(catalog, count = 5, excluded = []) {
    const ids = catalog.map(card => card.id).filter(id => !excluded.includes(id));
    for (let index = ids.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    return ids.slice(0, count);
  }

  function matchById(store, matchId) {
    return store.matches.find(match => match.id === Number(matchId));
  }

  function matchStatus(store, catalog, match) {
    if (!match || match.playerId !== store.currentPlayerId) {
      return failure(404, 'Partie introuvable.');
    }
    const player = currentPlayer(store);
    if (!player) return failure(401, 'Non connecté.');
    const response = {
      match_id: match.id,
      status: match.status,
      player1_pseudo: player.pseudo,
      player2_pseudo: 'Ordinateur',
      player1_id: player.id,
      player2_id: 0,
    };
    if (match.status === 'in_progress' || match.status === 'finished') {
      response.current_turn_player_id = match.chooserId;
      response.attribute_chooser_id = match.chooserId;
      response.your_player_id = player.id;
      response.player1_score = match.playerScore;
      response.player2_score = match.computerScore;
      response.cards_remaining = {
        player1: match.playerHand.length,
        player2: match.computerHand.length,
      };
      if (match.status === 'in_progress') {
        const card = catalog.find(item => item.id === match.playerHand[0]);
        if (card) {
          response.your_card = {
            id: card.id,
            name: card.name,
            card_image_path: card.card_image_path,
          };
        }
      }
      if (match.lastRound) response.last_round = match.lastRound;
    }
    if (match.status === 'finished') {
      response.winner_id = match.winnerId;
      response.reward_claimed = Boolean(match.rewardClaimed);
      if (match.winnerId === player.id && !match.rewardClaimed) {
        response.reward_cards = (Array.isArray(match.computerPool) ? match.computerPool : [])
          .map(id => catalog.find(card => card.id === id))
          .filter(Boolean)
          .map(card => ({
            id: card.id,
            name: card.name,
            card_image_path: card.card_image_path,
          }));
      }
      if (match.winnerId !== player.id) {
        response.stolen_cards = (Array.isArray(match.stolenCards) ? match.stolenCards : [])
          .map(id => catalog.find(card => card.id === id))
          .filter(Boolean)
          .map(card => ({
            id: card.id,
            name: card.name,
            card_image_path: card.card_image_path,
          }));
        if (response.stolen_cards.length === 0 && match.lastRound?.winner_id === 0) {
          response.stolen_cards = [{
            name: match.lastRound.player1_name,
            card_image_path: match.lastRound.player1_image,
          }];
        }
      }
    }
    return result(200, response);
  }

  function resolveRound(store, catalog, match, attribute) {
    const cards = new Map(catalog.map(card => [card.id, card]));
    const playerCard = cards.get(match.playerHand[0]);
    const computerCard = cards.get(match.computerHand[0]);
    if (!playerCard || !computerCard) throw new Error('Une carte du duel est introuvable.');

    const playerValue = Number(playerCard[attribute]);
    const computerValue = Number(computerCard[attribute]);
    const winnerId = playerValue === computerValue
      ? null
      : playerValue > computerValue ? match.playerId : 0;

    if (winnerId !== null) {
      match.playerHand.shift();
      match.computerHand.shift();
      if (winnerId === match.playerId) {
        addCard(store, match.playerId, computerCard.id);
        match.playerScore++;
      } else {
        removeCard(store, match.playerId, playerCard.id);
        match.stolenCards = [...(match.stolenCards || []), playerCard.id];
        match.computerScore++;
      }
    }

    match.chooserId = winnerId ?? match.chooserId;
    match.lastRound = {
      attribute,
      player1_value: playerValue,
      player2_value: computerValue,
      winner_id: winnerId,
      player1_card_id: playerCard.id,
      at: new Date().toISOString(),
      player1_name: playerCard.name,
      player1_image: playerCard.card_image_path,
      player2_name: computerCard.name,
      player2_image: computerCard.card_image_path,
    };

    activity(store, match.playerId, 'duel_round', {
      match_id: match.id,
      opponent: 'Ordinateur',
      attribute,
      your_card: playerCard.name,
      your_value: playerValue,
      opponent_card: computerCard.name,
      opponent_value: computerValue,
      result: winnerId === null ? 'draw' : winnerId === match.playerId ? 'won' : 'lost',
    });

    const gameOver = match.playerScore >= 3 || match.computerScore >= 3;
    if (gameOver) {
      match.status = 'finished';
      match.winnerId = match.playerScore >= 3 ? match.playerId : 0;
      activity(store, match.playerId, match.winnerId === match.playerId ? 'duel_won' : 'duel_lost', {
        match_id: match.id,
        opponent: 'Ordinateur',
      });
    }
    return gameOver;
  }

  function scheduleComputerTurn(matchId) {
    window.setTimeout(() => {
      try {
        const store = readStore();
        const match = matchById(store, matchId);
        if (!match || match.status !== 'in_progress' || match.chooserId !== 0) return;
        const catalogPromiseForTurn = loadCatalog();
        catalogPromiseForTurn.then(catalog => {
          const currentStore = readStore();
          const currentMatch = matchById(currentStore, matchId);
          if (!currentMatch || currentMatch.status !== 'in_progress' || currentMatch.chooserId !== 0) return;
          const card = catalog.find(item => item.id === currentMatch.computerHand[0]);
          if (!card) throw new Error('La carte de l’ordinateur est introuvable.');
          const attribute = ATTRIBUTES.reduce(
            (best, key) => Number(card[key]) > Number(card[best]) ? key : best,
            ATTRIBUTES[0]
          );
          resolveRound(currentStore, catalog, currentMatch, attribute);
          saveStore(currentStore);
          if (currentMatch.status === 'in_progress' && currentMatch.chooserId === 0) {
            scheduleComputerTurn(matchId);
          }
        }).catch(error => console.error('Tour de l’ordinateur impossible :', error));
      } catch (error) {
        console.error('Tour de l’ordinateur impossible :', error);
      }
    }, 2400);
  }

  async function dispatch(url, options = {}) {
    const requestUrl = new URL(url, window.location.href);
    const route = requestUrl.searchParams.get('route');
    const action = requestUrl.searchParams.get('action');
    const body = options.body ? JSON.parse(options.body) : {};
    const store = readStore();
    const player = currentPlayer(store);

    if (options.method !== 'POST' && ['login', 'register', 'create_account', 'logout', 'open_pack', 'find_match', 'play_turn', 'surrender', 'claim_reward'].includes(action)) {
      return failure(405, 'Cette action doit être envoyée en POST.');
    }

    if (route === 'current_player') {
      return result(200, player ? { authenticated: true, pseudo: player.pseudo } : { authenticated: false });
    }
    if (action === 'register' || action === 'login' || action === 'create_account') {
      const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!pseudo || pseudo.length > 50) return failure(400, 'Pseudo invalide (1 à 50 caractères).');
      if (new TextEncoder().encode(password).length < 8 || new TextEncoder().encode(password).length > 72) {
        return failure(400, 'Le mot de passe doit contenir entre 8 et 72 octets.');
      }
      const existing = store.players.find(item => item.pseudo.toLocaleLowerCase() === pseudo.toLocaleLowerCase());
      if (action === 'register') {
        if (existing) return failure(409, 'Ce pseudo a déjà un compte. Connecte-toi avec ton mot de passe.');
        const salt = crypto.randomUUID();
        const created = {
          id: store.nextPlayerId++,
          pseudo,
          salt,
          passwordHash: await passwordHash(password, salt),
          lastPackOpenedAt: null,
        };
        store.players.push(created);
        store.collections[String(created.id)] = {};
        store.currentPlayerId = created.id;
        activity(store, created.id, 'account_created');
        saveStore(store);
        return result(200, { id: created.id, pseudo: created.pseudo, last_pack_opened_at: null });
      }
      if (!existing || await passwordHash(password, existing.salt) !== existing.passwordHash) {
        return failure(401, 'Pseudo ou mot de passe incorrect.');
      }
      store.currentPlayerId = existing.id;
      activity(store, existing.id, 'login');
      saveStore(store);
      return result(200, { id: existing.id, pseudo: existing.pseudo });
    }
    if (action === 'logout') {
      if (player) activity(store, player.id, 'logout');
      store.currentPlayerId = null;
      saveStore(store);
      return result(200, { success: true });
    }
    if (!player) return failure(401, 'Non connecté.');

    const catalog = await loadCatalog();
    if (route === 'collection') return result(200, { cards: ownedCards(store, catalog, player.id) });
    if (route === 'all_cards') {
      const quantities = store.collections[String(player.id)] || {};
      return result(200, {
        cards: catalog.map(card => ({ ...card, quantity: Number(quantities[String(card.id)] || 0) })),
      });
    }
    if (route === 'activity_logs') {
      const logs = store.activityLogs.filter(log => log.player_id === player.id).slice(-100).reverse();
      return result(200, { logs });
    }
    if (action === 'open_pack') {
      const now = Date.now();
      const remaining = player.lastPackOpenedAt ? 20 * 60 * 1000 - (now - player.lastPackOpenedAt) : 0;
      if (remaining > 0) {
        return failure(429, 'Pack pas encore disponible.', { remaining_minutes: Math.ceil(remaining / 60000) });
      }
      const cards = randomCardIds(catalog).map(id => catalog.find(card => card.id === id));
      cards.forEach(card => addCard(store, player.id, card.id));
      player.lastPackOpenedAt = now;
      activity(store, player.id, 'pack_opened', {
        cards: cards.map(card => card.name),
        count: cards.length,
      });
      saveStore(store);
      return result(200, { success: true, cards, last_pack_opened_at: new Date(now).toISOString() });
    }
    if (action === 'find_match') {
      const ids = body.card_ids;
      if (
        !Array.isArray(ids)
        || ids.length !== 5
        || new Set(ids.map(Number)).size !== 5
        || ids.some(id => Number((store.collections[String(player.id)] || {})[String(id)] || 0) < 1)
      ) {
        return failure(400, 'Choisis exactement 5 cartes différentes que tu possèdes pour commencer le duel.');
      }
      const playerCardIds = ids.map(Number);
      const computerHand = randomCardIds(catalog, 5, playerCardIds);
      const match = {
        id: store.nextMatchId++,
        playerId: player.id,
        playerHand: playerCardIds,
        computerPool: computerHand.slice(),
        computerHand,
        status: 'in_progress',
        chooserId: player.id,
        playerScore: 0,
        computerScore: 0,
        winnerId: null,
        rewardClaimed: false,
        stolenCards: [],
        lastRound: null,
      };
      store.matches.push(match);
      activity(store, player.id, 'duel_started', { match_id: match.id, opponent: 'Ordinateur' });
      saveStore(store);
      return result(200, { match_id: match.id, status: match.status });
    }
    if (route === 'match_status') {
      return matchStatus(store, catalog, matchById(store, requestUrl.searchParams.get('match_id')));
    }
    if (action === 'claim_reward') {
      const match = matchById(store, body.match_id);
      const cardId = Number(body.card_id);
      if (!match || match.playerId !== player.id) return failure(404, 'Partie introuvable.');
      if (match.status !== 'finished' || match.winnerId !== player.id) {
        return failure(403, 'Seul le gagnant peut choisir une carte.');
      }
      if (match.rewardClaimed) return failure(409, 'La récompense de ce duel a déjà été choisie.');
      if (!Array.isArray(match.computerPool) || !match.computerPool.includes(cardId)) {
        return failure(400, 'Choisis une carte parmi celles de l’ordinateur.');
      }

      const card = catalog.find(item => item.id === cardId);
      if (!card) return failure(404, 'Carte introuvable.');
      addCard(store, player.id, card.id);
      match.rewardClaimed = true;
      activity(store, player.id, 'duel_reward', {
        match_id: match.id,
        card: card.name,
      });
      saveStore(store);
      return result(200, { success: true, card });
    }
    if (action === 'play_turn') {
      const match = matchById(store, body.match_id);
      if (!match || match.playerId !== player.id) return failure(404, 'Partie introuvable.');
      if (match.status !== 'in_progress') return failure(400, 'Cette partie n’est pas en cours.');
      if (match.chooserId !== player.id) return failure(403, 'Ce n’est pas à toi de choisir l’attribut.');
      if (!ATTRIBUTES.includes(body.attribute)) return failure(400, 'Attribut invalide.');

      const gameOver = resolveRound(store, catalog, match, body.attribute);
      saveStore(store);
      if (!gameOver && match.chooserId === 0) scheduleComputerTurn(match.id);
      return result(200, {
        attribute: body.attribute,
        game_over: gameOver,
        final_winner_id: gameOver ? match.winnerId : null,
        player1_score: match.playerScore,
        player2_score: match.computerScore,
      });
    }
    if (action === 'surrender') {
      const match = matchById(store, body.match_id);
      if (!match || match.playerId !== player.id) return failure(404, 'Partie introuvable.');
      if (match.status !== 'in_progress') return failure(400, 'Cette partie ne peut plus être abandonnée.');
      const cardsLost = match.playerHand.length;
      match.stolenCards = [...(match.stolenCards || []), ...match.playerHand];
      match.playerHand.forEach(cardId => removeCard(store, player.id, cardId));
      match.playerHand = [];
      match.status = 'finished';
      match.winnerId = 0;
      const stolenCards = match.stolenCards
        .map(id => catalog.find(card => card.id === id))
        .filter(Boolean)
        .map(card => ({
          id: card.id,
          name: card.name,
          card_image_path: card.card_image_path,
        }));
      activity(store, player.id, 'duel_surrendered', {
        match_id: match.id,
        opponent: 'Ordinateur',
        cards_lost: cardsLost,
      });
      activity(store, player.id, 'duel_lost', { match_id: match.id, opponent: 'Ordinateur', by_surrender: true });
      saveStore(store);
      return result(200, { success: true, winner_id: 0, forfeited_player_id: player.id, stolen_cards: stolenCards });
    }
    return failure(404, 'Route ou action introuvable.');
  }

  window.apiFetch = async (url, options = {}) => {
    try {
      return await dispatch(url, options);
    } catch (error) {
      return failure(500, error.message || 'Erreur dans le stockage local du navigateur.');
    }
  };
})();
