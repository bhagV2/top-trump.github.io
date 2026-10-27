const API_URL = window.TOPTRUMP_API_URL;
const MATCH_ID = new URLSearchParams(window.location.search).get('match_id');

let myPlayerId = null;
let lastSeenRoundAt = null;
let hasLoadedInitialStatus = false;
let showingRoundResult = false;
let roundAnimationInProgress = false;
let roundAnimationTimeout = null;
let currentPlayerCard = null;
let isPlayer1 = false;
let player1Score = 0;
let player2Score = 0;
let pollingInterval = null;
let rewardCards = [];
let selectedRewardCardId = null;
let tutorialActive = false;
let tutorialFinishing = false;
let tutorialStepIndex = 0;
let tutorialTarget = null;

const TUTORIAL_STEPS = [
  {
    selector: '#scoreboard',
    title: 'Objectif du duel',
    description: 'Le premier à 3 points remporte la partie. Chaque manche gagnée rapporte un point.',
  },
  {
    selector: () => isPlayer1 ? '#player1-panel' : '#player2-panel',
    title: 'Ta carte',
    description: 'Observe ses caractéristiques et compare-les à celles de la carte adverse.',
  },
  {
    selector: '#attribute-choice',
    title: 'Choisis une caractéristique',
    description: 'À ton tour, sélectionne une caractéristique où ta carte peut battre celle de l’ordinateur.',
  },
  {
    selector: '#duel-help',
    title: 'Voler une carte',
    description: 'Si tu gagnes le duel, tu pourras voler une seule carte parmi les cinq cartes de l’ordinateur. Aucune carte ne change de propriétaire pendant les manches.',
  },
];

const ATTRIBUTE_LABELS = {
  force: 'Force',
  vitesse: 'Vitesse',
  taille: 'Taille',
  dangerosite: 'Dangerosité',
  intelligence: 'Intelligence',
};

document.querySelectorAll('.attr-btn').forEach(btn => {
  btn.addEventListener('click', () => playTurn(btn.dataset.attr));
});
document.getElementById('surrender-btn').addEventListener('click', surrenderMatch);
document.getElementById('claim-reward-btn').addEventListener('click', claimReward);
document.getElementById('tutorial-next').addEventListener('click', advanceTutorial);
document.getElementById('tutorial-previous').addEventListener('click', previousTutorialStep);
document.getElementById('tutorial-skip').addEventListener('click', finishTutorial);

async function refreshStatus() {
  const res = await window.apiFetch(`${API_URL}?route=match_status&match_id=${encodeURIComponent(MATCH_ID)}`);
  const data = await res.json();

  if (!res.ok) {
    document.getElementById('turn-info').textContent = data.error;
    return;
  }

  myPlayerId = data.your_player_id;
  isPlayer1 = String(myPlayerId) === String(data.player1_id);
  currentPlayerCard = data.your_card || null;
  document.getElementById('duel-arena').classList.toggle('duel-player2-left', !isPlayer1);

  document.getElementById('p1-pseudo').textContent = data.player1_pseudo;
  document.getElementById('p2-pseudo').textContent = data.player2_pseudo;
  player1Score = Number(data.player1_score ?? 0);
  player2Score = Number(data.player2_score ?? 0);
  updateScoreTrack('player1', player1Score);
  updateScoreTrack('player2', player2Score);

  if (data.your_card && !showingRoundResult) {
    showCurrentCard(isPlayer1 ? 'player1-card' : 'player2-card', data.your_card);
    showHiddenCard(isPlayer1 ? 'player2-card' : 'player1-card');
  }

  if (data.cards_remaining) {
    document.getElementById('p1-count').textContent = data.cards_remaining.player1 ?? 0;
    document.getElementById('p2-count').textContent = data.cards_remaining.player2 ?? 0;
  }

  if (data.status === 'finished' && data.last_round && data.last_round.at !== lastSeenRoundAt) {
    lastSeenRoundAt = data.last_round.at;
    showRoundResult(data.last_round);
  }

  if (!hasLoadedInitialStatus) {
    hasLoadedInitialStatus = true;
    lastSeenRoundAt = data.last_round ? data.last_round.at : null;
  } else if (data.last_round && data.last_round.at !== lastSeenRoundAt) {
    lastSeenRoundAt = data.last_round.at;
    showRoundResult(data.last_round);
  }

  if (data.status === 'finished') {
    rewardCards = data.reward_cards || [];
    selectedRewardCardId = null;
    clearInterval(pollingInterval);
    showGameOver(data.winner_id, data.reward_claimed);
    return;
  }

  const isMyTurn = String(data.attribute_chooser_id) === String(myPlayerId);
  document.getElementById('player1-score').classList.toggle(
    'is-choosing',
    String(data.attribute_chooser_id) === String(data.player1_id)
  );
  document.getElementById('player2-score').classList.toggle(
    'is-choosing',
    String(data.attribute_chooser_id) === String(data.player2_id)
  );
  document.getElementById('attribute-choice').hidden = !isMyTurn;
  document.getElementById('turn-info').textContent = isMyTurn
    ? `À toi de choisir ! ${scorePrompt(player1Score, player2Score, isPlayer1)}`
    : opponentTurnPrompt(player1Score, player2Score, isPlayer1);
  if (data.tutorial_pending) startTutorial();
}

function startTutorial() {
  if (tutorialActive) return;

  tutorialActive = true;
  document.querySelector('.site-main').inert = true;
  document.getElementById('tutorial-backdrop').hidden = false;
  document.getElementById('tutorial-arrow').hidden = false;
  document.getElementById('match-tutorial').hidden = false;
  setTutorialBackgroundInert(true);
  document.addEventListener('keydown', handleTutorialKeydown);
  window.addEventListener('resize', positionTutorial);
  window.addEventListener('scroll', positionTutorial, true);
  showTutorialStep(0);
  document.getElementById('tutorial-next').focus();
}

function setTutorialBackgroundInert(inert) {
  document.querySelectorAll('.site-header, .static-mode-notice, .site-main, .site-footer')
    .forEach(element => {
      element.inert = inert;
    });
}

function handleTutorialKeydown(event) {
  if (tutorialFinishing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    finishTutorial();
    return;
  }
  if (event.key !== 'Tab') return;

  const buttons = [...document.querySelectorAll('#match-tutorial button:not([hidden]):not(:disabled)')];
  const firstButton = buttons[0];
  const lastButton = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === firstButton) {
    event.preventDefault();
    lastButton.focus();
  } else if (!event.shiftKey && document.activeElement === lastButton) {
    event.preventDefault();
    firstButton.focus();
  }
}

function showTutorialStep(index) {
  tutorialStepIndex = index;
  const step = TUTORIAL_STEPS[index];
  const selector = typeof step.selector === 'function' ? step.selector() : step.selector;
  tutorialTarget?.classList.remove('tutorial-highlight');
  tutorialTarget = document.querySelector(selector);
  if (!tutorialTarget) {
    finishTutorial();
    return;
  }

  tutorialTarget.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
  tutorialTarget.classList.add('tutorial-highlight');
  document.getElementById('tutorial-step-label').textContent = `ÉTAPE ${index + 1} SUR ${TUTORIAL_STEPS.length}`;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-description').textContent = step.description;
  document.getElementById('tutorial-error').textContent = '';
  document.getElementById('tutorial-previous').hidden = index === 0;
  document.getElementById('tutorial-next').textContent = index === TUTORIAL_STEPS.length - 1
    ? 'Terminer'
    : 'Suivant';
  positionTutorial();
}

function positionTutorial() {
  if (!tutorialActive || !tutorialTarget) return;

  const target = tutorialTarget.getBoundingClientRect();
  const dialog = document.getElementById('match-tutorial');
  const arrow = document.getElementById('tutorial-arrow');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dialogWidth = dialog.offsetWidth;
  const dialogHeight = dialog.offsetHeight;
  const left = Math.max(16, Math.min(
    target.left + target.width / 2 - dialogWidth / 2,
    width - dialogWidth - 16
  ));
  const placeAbove = target.top > dialogHeight + 40;
  const top = placeAbove
    ? target.top - dialogHeight - 24
    : Math.min(target.bottom + 24, height - dialogHeight - 16);
  dialog.style.left = `${left}px`;
  dialog.style.top = `${Math.max(16, top)}px`;

  const dialogRect = dialog.getBoundingClientRect();
  const line = document.getElementById('tutorial-arrow-line');
  line.setAttribute('x1', String(dialogRect.left + dialogRect.width / 2));
  line.setAttribute('y1', String(placeAbove ? dialogRect.bottom : dialogRect.top));
  line.setAttribute('x2', String(target.left + target.width / 2));
  line.setAttribute('y2', String(placeAbove ? target.top : target.bottom));
  arrow.setAttribute('viewBox', `0 0 ${width} ${height}`);
  arrow.setAttribute('width', String(width));
  arrow.setAttribute('height', String(height));
}

function advanceTutorial() {
  if (tutorialStepIndex === TUTORIAL_STEPS.length - 1) {
    finishTutorial();
    return;
  }
  showTutorialStep(tutorialStepIndex + 1);
}

function previousTutorialStep() {
  if (tutorialStepIndex > 0) showTutorialStep(tutorialStepIndex - 1);
}

async function finishTutorial() {
  if (tutorialFinishing) return;
  tutorialFinishing = true;
  const nextButton = document.getElementById('tutorial-next');
  const skipButton = document.getElementById('tutorial-skip');
  const previousButton = document.getElementById('tutorial-previous');
  nextButton.disabled = true;
  skipButton.disabled = true;
  previousButton.disabled = true;
  try {
    const response = await window.apiFetch(`${API_URL}?action=tutorial_complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: MATCH_ID }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer le tutoriel.');

    tutorialActive = false;
    tutorialTarget?.classList.remove('tutorial-highlight');
    tutorialTarget = null;
    setTutorialBackgroundInert(false);
    document.getElementById('tutorial-backdrop').hidden = true;
    document.getElementById('tutorial-arrow').hidden = true;
    document.getElementById('match-tutorial').hidden = true;
    document.getElementById('attribute-choice').querySelector('.attr-btn').focus();
    window.removeEventListener('resize', positionTutorial);
    window.removeEventListener('scroll', positionTutorial, true);
    document.removeEventListener('keydown', handleTutorialKeydown);
  } catch (error) {
    document.getElementById('tutorial-error').textContent = error.message || 'Impossible d’enregistrer le tutoriel.';
  } finally {
    tutorialFinishing = false;
    nextButton.disabled = false;
    skipButton.disabled = false;
    previousButton.disabled = false;
  }
}

function updateScoreTrack(player, score) {
  const track = document.getElementById(`${player === 'player1' ? 'p1' : 'p2'}-score-track`);
  track.setAttribute('aria-label', `${score} point${score === 1 ? '' : 's'} sur 3`);
  track.querySelectorAll('.score-pip').forEach((pip, index) => {
    pip.classList.toggle('is-earned', index < score);
  });
}

function scorePrompt(player1Score, player2Score, iAmPlayer1) {
  const myScore = iAmPlayer1 ? player1Score : player2Score;
  const opponentScore = iAmPlayer1 ? player2Score : player1Score;
  if (myScore === 2) {
    return 'Balle de match : une victoire et le duel est à toi !';
  }
  if (opponentScore === 2) {
    return 'Attention : l’adversaire est à une victoire du duel.';
  }
  if (myScore > opponentScore) {
    return 'Tu mènes : continue comme ça !';
  }
  if (myScore < opponentScore) {
    return 'Tu peux encore revenir au score.';
  }
  return 'Le score est à égalité.';
}

function opponentTurnPrompt(player1Score, player2Score, iAmPlayer1) {
  const myScore = iAmPlayer1 ? player1Score : player2Score;
  const opponentScore = iAmPlayer1 ? player2Score : player1Score;
  if (opponentScore === 2) {
    return 'L’adversaire peut conclure le duel avec cette manche.';
  }
  if (myScore === 2) {
    return 'Tu es à une victoire du duel : prépare-toi !';
  }
  return 'C’est à l’adversaire de choisir une caractéristique.';
}

async function playTurn(attribute) {
  if (roundAnimationInProgress) {
    return;
  }

  const buttons = document.querySelectorAll('.attr-btn');
  buttons.forEach(b => b.disabled = true);
  showingRoundResult = false;
  document.getElementById('round-result').hidden = true;
  if (currentPlayerCard) {
    showCurrentCard(isPlayer1 ? 'player1-card' : 'player2-card', currentPlayerCard);
    showHiddenCard(isPlayer1 ? 'player2-card' : 'player1-card');
  }

  try {
    const res = await window.apiFetch(`${API_URL}?action=play_turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: MATCH_ID, attribute }),
    });
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('turn-info').textContent = data.error || 'Erreur lors du tour.';
      return;
    }

    await refreshStatus();

    if (data.game_over) {
      showGameOver(data.final_winner_id);
    }
  } catch (error) {
    document.getElementById('turn-info').textContent = 'Impossible de contacter le serveur.';
  } finally {
    buttons.forEach(b => b.disabled = roundAnimationInProgress);
  }
}

async function surrenderMatch() {
  if (!window.confirm('Veux-tu vraiment abandonner le duel ? La victoire sera accordée à ton adversaire.')) {
    return;
  }

  const button = document.getElementById('surrender-btn');
  button.disabled = true;

  try {
    const response = await window.apiFetch(`${API_URL}?action=surrender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: MATCH_ID }),
    });
    const data = await response.json();

    if (!response.ok) {
      document.getElementById('turn-info').textContent = data.error || 'Impossible d’abandonner le duel.';
      return;
    }

    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    showGameOver(data.winner_id, false);
  } catch (error) {
    document.getElementById('turn-info').textContent = 'Impossible de contacter le serveur pour abandonner.';
  } finally {
    button.disabled = false;
  }
}

function showRoundResult(round) {
  const box = document.getElementById('round-result');
  box.hidden = false;
  box.replaceChildren();
  showingRoundResult = true;
  roundAnimationInProgress = true;
  document.querySelectorAll('.attr-btn').forEach(button => button.disabled = true);
  window.clearTimeout(roundAnimationTimeout);
  roundAnimationTimeout = window.setTimeout(() => {
    roundAnimationInProgress = false;
    roundAnimationTimeout = null;
    document.querySelectorAll('.attr-btn').forEach(button => button.disabled = false);
    showingRoundResult = false;
    refreshStatus();
  }, 1150);

  showCurrentCard('player1-card', {
    name: round.player1_name,
    card_image_path: round.player1_image,
  });
  showCurrentCard('player2-card', {
    name: round.player2_name,
    card_image_path: round.player2_image,
  });

  const player1Card = document.getElementById('player1-card');
  const player2Card = document.getElementById('player2-card');

  const player1Value = Number(round.player1_value);
  const player2Value = Number(round.player2_value);
  let winnerText;
  if (player1Value === player2Value) {
    winnerText = 'Égalité, personne ne prend les cartes.';
  } else {
    const player1Won = player1Value > player2Value;
    const winnerCard = player1Won ? player1Card : player2Card;
    const loserCard = player1Won ? player2Card : player1Card;
    const winnerIsLeft = player1Won === isPlayer1;
    winnerCard.classList.add(winnerIsLeft ? 'card-wins-left' : 'card-wins-right');
    loserCard.classList.add(winnerIsLeft ? 'card-loses-right' : 'card-loses-left');

    const iWon = player1Won === isPlayer1;
    winnerText = iWon ? 'Tu remportes la manche !' : 'L’adversaire remporte la manche !';
  }

  const summary = document.createElement('p');
  summary.className = 'round-summary';
  summary.textContent = `Caractéristique comparée : ${ATTRIBUTE_LABELS[round.attribute] || round.attribute}`;

  const score = document.createElement('p');
  score.className = 'round-score';
  score.textContent = `Score ${player1Score} – ${player2Score}`;
  if (player1Score === 2 || player2Score === 2) {
    const nextPointPlayer = player1Score === 2
      ? document.getElementById('p1-pseudo').textContent
      : document.getElementById('p2-pseudo').textContent;
    score.textContent += ` · Balle de match pour ${nextPointPlayer}`;
  }

  const winner = document.createElement('p');
  winner.className = 'round-winner';
  winner.textContent = winnerText;
  box.append(summary, winner, score);
}

function showCurrentCard(slotId, card) {
  const slot = document.getElementById(slotId);
  slot.classList.remove('card-back');
  slot.classList.remove('card-wins-left', 'card-wins-right', 'card-loses-left', 'card-loses-right');
  slot.replaceChildren();

  const image = document.createElement('img');
  image.src = cardImageUrl(card.card_image_path);
  image.alt = card.name;
  image.onerror = () => {
    image.remove();
    showPlaceholder(slot, 'Impossible de charger cette carte.');
  };
  slot.appendChild(image);
}

function showHiddenCard(slotId) {
  const slot = document.getElementById(slotId);
  slot.classList.add('card-back');
  slot.replaceChildren();

  const message = document.createElement('span');
  message.className = 'visually-hidden';
  message.textContent = 'Carte adverse cachée jusqu’à la comparaison';
  slot.appendChild(message);
}

function showPlaceholder(slot, message) {
  const placeholder = document.createElement('p');
  placeholder.className = 'card-placeholder';
  placeholder.textContent = message;
  slot.replaceChildren(placeholder);
}

function cardImageUrl(path) {
  const safePath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `assets/${safePath}`;
}

function showGameOver(winnerId, rewardClaimed = false) {
  const gameOver = document.getElementById('game-over');
  if (!gameOver.hidden) {
    return;
  }

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  document.getElementById('attribute-choice').hidden = true;
  window.clearTimeout(roundAnimationTimeout);
  roundAnimationTimeout = null;
  roundAnimationInProgress = false;
  document.getElementById('turn-info').textContent = '';
  document.getElementById('surrender-btn').hidden = true;
  gameOver.hidden = false;

  const text = String(winnerId) === String(myPlayerId)
    ? 'Tu as gagné la partie !'
    : 'Tu as perdu la partie.';
  const heading = document.getElementById('game-over-text');
  heading.textContent = text;
  loadDuelProgress();
  const rewardSelection = document.getElementById('reward-selection');
  if (String(winnerId) === String(myPlayerId) && !rewardClaimed && rewardCards.length > 0) {
    renderRewardChoices();
    rewardSelection.hidden = false;
  } else if (rewardClaimed) {
    document.getElementById('reward-message').textContent = 'La carte choisie a été ajoutée à ta collection.';
    rewardSelection.hidden = false;
    document.getElementById('reward-cards').hidden = true;
    document.getElementById('claim-reward-btn').hidden = true;
  }
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
  gameOver.scrollIntoView({ behavior, block: 'center' });
  heading.focus({ preventScroll: true });
}

async function loadDuelProgress() {
  const message = document.getElementById('duel-progress-message');
  try {
    const response = await window.apiFetch(`${API_URL}?route=progress`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger tes missions.');

    message.textContent = data.missions.map(mission => {
      if (mission.claimed) return `${mission.title} : récompense réclamée`;
      if (mission.can_claim) return `${mission.title} : terminée, pack bonus à réclamer à l’accueil`;
      return `${mission.title} : ${mission.progress}/${mission.goal}`;
    }).join(' · ');
  } catch (error) {
    message.textContent = error.message || 'Impossible de charger tes missions.';
  }
}

function renderRewardChoices() {
  const choices = document.getElementById('reward-cards');
  choices.replaceChildren();
  choices.hidden = false;
  document.getElementById('claim-reward-btn').hidden = false;
  document.getElementById('claim-reward-btn').disabled = true;
  document.getElementById('reward-message').textContent = '';

  rewardCards.forEach(card => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reward-card';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Choisir ${card.name}`);

    const image = document.createElement('img');
    image.src = cardImageUrl(card.card_image_path);
    image.alt = '';
    image.loading = 'lazy';

    const name = document.createElement('span');
    name.textContent = card.name;
    button.append(image, name);
    button.addEventListener('click', () => {
      selectedRewardCardId = Number(card.id);
      choices.querySelectorAll('.reward-card').forEach(choice => {
        choice.setAttribute('aria-pressed', String(choice === button));
      });
      document.getElementById('claim-reward-btn').disabled = false;
    });
    choices.appendChild(button);
  });
}

async function claimReward() {
  const button = document.getElementById('claim-reward-btn');
  const message = document.getElementById('reward-message');
  if (selectedRewardCardId === null) return;

  button.disabled = true;
  message.textContent = 'Ajout de la carte...';
  try {
    const response = await window.apiFetch(`${API_URL}?action=claim_reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: MATCH_ID, card_id: selectedRewardCardId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de récupérer cette carte.');

    message.textContent = `${data.card.name} a été ajoutée à ta collection.`;
    document.getElementById('reward-cards').hidden = true;
    button.hidden = true;
  } catch (error) {
    message.textContent = error.message || 'Impossible de récupérer cette carte.';
    button.disabled = false;
  }
}

if (!MATCH_ID) {
  document.getElementById('turn-info').textContent = 'Partie invalide.';
} else {
  refreshStatus();
  pollingInterval = setInterval(refreshStatus, 2000);
}