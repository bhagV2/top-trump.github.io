const API_URL = window.TOPTRUMP_API_URL;
const selectedCards = new Map();
let availableCards = [];
let matchmakingTimer = null;

const cardsGrid = document.getElementById('deck-cards-grid');
const selectionCount = document.getElementById('deck-selection-count');
const message = document.getElementById('deck-selection-message');
const startButton = document.getElementById('start-duel-btn');
const recommendButton = document.getElementById('recommend-cards-btn');

startButton.addEventListener('click', startMatchmaking);
recommendButton.addEventListener('click', chooseRecommendedCards);

async function readApiResponse(response) {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Réponse vide du serveur (HTTP ${response.status}). Vérifie les logs PHP/Apache.`);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    const detail = body.trim().slice(0, 200);
    throw new Error(`Réponse invalide du serveur (HTTP ${response.status}) : ${detail}`);
  }
}

async function loadCollection() {
  try {
    const response = await window.apiFetch(`${API_URL}?route=collection`);
    if (response.status === 401) {
      window.location.replace('index.html');
      return;
    }

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger ta collection.');
    }

    availableCards = data.cards;
    cardsGrid.replaceChildren();
    recommendButton.disabled = availableCards.length < 5;

    if (availableCards.length === 0) {
      message.hidden = false;
      message.textContent = 'Ta collection est vide. Ouvre un pack avant de préparer un duel.';
      selectionCount.textContent = 'Aucune carte disponible';
      return;
    }

    availableCards.forEach(card => cardsGrid.appendChild(createSelectableCard(card)));
    updateSelectionDisplay();
  } catch (error) {
    message.hidden = false;
    message.textContent = error.message || 'Impossible de charger ta collection.';
    selectionCount.textContent = '';
  }
}

function chooseRecommendedCards() {
  const recommendedCards = availableCards
    .map(card => ({
      card,
      score: ['force', 'vitesse', 'taille', 'dangerosite', 'intelligence']
        .reduce((total, attribute) => total + Number(card[attribute] || 0), 0),
    }))
    .sort((left, right) => (
      right.score - left.score || left.card.name.localeCompare(right.card.name)
    ))
    .slice(0, 5);

  if (recommendedCards.length < 5) {
    message.hidden = false;
    message.textContent = 'Il faut au moins cinq cartes différentes dans ta collection pour préparer un duel.';
    return;
  }

  selectedCards.clear();
  recommendedCards.forEach(({ card }) => selectedCards.set(Number(card.id), 1));
  message.hidden = false;
  message.textContent = 'Les cinq cartes recommandées ont été sélectionnées. Tu peux modifier ta main avant le duel.';
  updateSelectionDisplay();
}

function createSelectableCard(card) {
  const article = document.createElement('article');
  article.className = 'catalog-card deck-selectable-card';
  article.dataset.cardId = String(card.id);

  const imageFrame = document.createElement('div');
  imageFrame.className = 'catalog-card-image';
  const image = document.createElement('img');
  image.src = assetUrl(card.card_image_path);
  image.alt = card.name;
  image.loading = 'lazy';
  imageFrame.appendChild(image);

  const content = document.createElement('div');
  content.className = 'catalog-card-content';

  const title = document.createElement('h2');
  title.textContent = card.name;

  const owned = document.createElement('p');
  owned.className = 'deck-owned-count';
  owned.textContent = `${card.quantity} exemplaire${Number(card.quantity) > 1 ? 's' : ''} possédé${Number(card.quantity) > 1 ? 's' : ''}`;

  const controls = document.createElement('div');
  controls.className = 'deck-card-controls';

  const decreaseButton = document.createElement('button');
  decreaseButton.type = 'button';
  decreaseButton.className = 'button-secondary deck-count-button';
  decreaseButton.textContent = '−';
  decreaseButton.setAttribute('aria-label', `Retirer un exemplaire de ${card.name}`);

  const count = document.createElement('span');
  count.className = 'deck-card-count';
  count.setAttribute('aria-label', 'Exemplaires sélectionnés');

  const increaseButton = document.createElement('button');
  increaseButton.type = 'button';
  increaseButton.className = 'button-secondary deck-count-button';
  increaseButton.textContent = '+';
  increaseButton.setAttribute('aria-label', `Ajouter ${card.name} à ma main`);

  decreaseButton.addEventListener('click', () => changeSelectedCount(card, -1));
  increaseButton.addEventListener('click', () => changeSelectedCount(card, 1));
  controls.append(decreaseButton, count, increaseButton);
  content.append(title, owned, controls);
  article.append(imageFrame, content);
  article.deckCount = count;
  article.deckDecreaseButton = decreaseButton;
  article.deckIncreaseButton = increaseButton;

  return article;
}

function changeSelectedCount(card, difference) {
  const currentCount = selectedCards.get(Number(card.id)) || 0;
  const nextCount = currentCount + difference;
  const totalSelected = getSelectedCardCount();

  if (nextCount < 0 || nextCount > 1 || (difference > 0 && totalSelected >= 5)) {
    return;
  }

  if (nextCount === 0) {
    selectedCards.delete(Number(card.id));
  } else {
    selectedCards.set(Number(card.id), nextCount);
  }

  updateSelectionDisplay();
}

function getSelectedCardCount() {
  let count = 0;
  selectedCards.forEach(quantity => {
    count += quantity;
  });
  return count;
}

function updateSelectionDisplay() {
  const totalSelected = getSelectedCardCount();
  selectionCount.textContent = `${totalSelected} / 5 cartes sélectionnées`;
  selectionCount.setAttribute('aria-label', `${totalSelected} cartes dans ta main sur 5`);
  startButton.disabled = totalSelected !== 5;
  startButton.textContent = totalSelected === 5
    ? 'Démarrer le duel contre l’ordinateur'
    : 'Choisir 5 cartes pour continuer';

  Array.from(cardsGrid.children).forEach(article => {
    const cardId = Number(article.dataset.cardId);
    const card = availableCards.find(item => Number(item.id) === cardId);
    if (!card) {
      return;
    }

    const selectedCount = selectedCards.get(cardId) || 0;
    article.deckCount.textContent = String(selectedCount);
    article.deckDecreaseButton.disabled = selectedCount === 0;
    article.deckIncreaseButton.disabled = selectedCount === 1 || totalSelected >= 5;
    article.classList.toggle('deck-card-selected', selectedCount > 0);
  });

  window.dispatchEvent(new CustomEvent('toptrump:deck-selection-changed', {
    detail: { selectedCount: totalSelected },
  }));
}

async function startMatchmaking() {
  startButton.disabled = true;
  message.hidden = false;
  message.textContent = 'Préparation du duel contre l’ordinateur...';

  const cardIds = [];
  selectedCards.forEach((quantity, cardId) => {
    for (let copy = 0; copy < quantity; copy++) {
      cardIds.push(cardId);
    }
  });

  try {
    const response = await window.apiFetch(`${API_URL}?action=find_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_ids: cardIds }),
      cache: 'no-store',
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || 'La recherche de partie a échoué.');
    }

    if (data.status === 'in_progress') {
      window.location.href = `game.html?match_id=${encodeURIComponent(data.match_id)}`;
      return;
    }

    startButton.textContent = 'En attente d’un adversaire...';
    matchmakingTimer = window.setInterval(() => checkMatchStatus(data.match_id), 2000);
  } catch (error) {
    message.textContent = error.message || 'Impossible de contacter le serveur.';
    startButton.disabled = false;
  }
}

async function checkMatchStatus(matchId) {
  try {
    const response = await window.apiFetch(
      `${API_URL}?route=match_status&match_id=${encodeURIComponent(matchId)}`,
      { cache: 'no-store' }
    );
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de vérifier la recherche.');
    }

    if (data.status === 'in_progress') {
      window.clearInterval(matchmakingTimer);
      window.location.href = `game.html?match_id=${encodeURIComponent(matchId)}`;
    }
  } catch (error) {
    window.clearInterval(matchmakingTimer);
    matchmakingTimer = null;
    message.textContent = error.message || 'La recherche a échoué. Réessaie.';
    startButton.disabled = false;
  }
}

function assetUrl(path) {
  return `assets/${path.split('/').map(encodeURIComponent).join('/')}`;
}

loadCollection();
