(async () => {
  const apiUrl = window.TOPTRUMP_API_URL;
  const status = document.getElementById('activity-status');
  const list = document.getElementById('activity-list');
  const attributeLabels = {
    force: 'Force',
    vitesse: 'Vitesse',
    taille: 'Taille',
    dangerosite: 'Dangerosité',
    intelligence: 'Intelligence',
  };

  try {
    const response = await window.apiFetch(`${apiUrl}?route=activity_logs`);
    if (response.status === 401) {
      window.location.replace('index.html');
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger le journal.');
    }

    if (data.logs.length === 0) {
      status.textContent = 'Aucune activité pour le moment. Connecte-toi, ouvre un pack ou lance un duel pour commencer ton historique.';
      return;
    }

    status.hidden = true;
    data.logs.forEach(log => list.appendChild(createLogEntry(log, attributeLabels)));
  } catch (error) {
    status.hidden = false;
    status.textContent = 'Impossible de charger ton journal. Réessaie dans un instant.';
  }
})();

function createLogEntry(log, attributeLabels) {
  const details = log.details || {};
  const entry = document.createElement('li');
  entry.className = 'activity-entry';

  const marker = document.createElement('span');
  marker.className = `activity-marker activity-${log.event_type}`;
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = activityIcon(log.event_type);

  const content = document.createElement('div');
  content.className = 'activity-content';

  const title = document.createElement('h2');
  title.textContent = activityTitle(log.event_type, details);
  content.appendChild(title);

  const description = activityDescription(log.event_type, details, attributeLabels);
  if (description) {
    const text = document.createElement('p');
    text.textContent = description;
    content.appendChild(text);
  }

  const time = document.createElement('time');
  time.dateTime = log.created_at.replace(' ', 'T');
  time.textContent = new Date(time.dateTime).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  entry.append(marker, content, time);
  return entry;
}

function activityIcon(eventType) {
  const icons = {
    account_created: '+',
    login: '↪',
    logout: '↩',
    pack_opened: '✦',
    matchmaking_started: '…',
    duel_started: '⚔',
    duel_round: '★',
    duel_won: '✓',
    duel_lost: '×',
    duel_surrendered: '!',
  };

  return icons[eventType] || '•';
}

function activityTitle(eventType, details) {
  const titles = {
    account_created: 'Compte créé',
    login: 'Connexion',
    logout: 'Déconnexion',
    pack_opened: `Pack ouvert · ${details.count || 0} cartes ajoutées`,
    matchmaking_started: 'Recherche d’un adversaire',
    duel_started: `Duel commencé${details.opponent ? ` contre ${details.opponent}` : ''}`,
    duel_won: `Duel gagné${details.opponent ? ` contre ${details.opponent}` : ''}`,
    duel_lost: `Duel perdu${details.opponent ? ` contre ${details.opponent}` : ''}`,
    duel_surrendered: `Duel abandonné${details.opponent ? ` contre ${details.opponent}` : ''}`,
  };

  if (eventType === 'duel_round') {
    const outcome = details.result === 'draw'
      ? 'Égalité au duel'
      : details.result === 'won'
        ? 'Manche remportée'
        : 'Manche perdue';
    return `${outcome}${details.opponent ? ` contre ${details.opponent}` : ''}`;
  }

  return titles[eventType] || 'Activité';
}

function activityDescription(eventType, details, attributeLabels) {
  if (eventType === 'pack_opened') {
    return Array.isArray(details.cards) ? details.cards.join(' · ') : '';
  }

  if (eventType === 'duel_round') {
    const attribute = attributeLabels[details.attribute] || details.attribute;
    return `${attribute} : ${details.your_card} (${details.your_value}) contre ${details.opponent_card} (${details.opponent_value}).`;
  }

  if (eventType === 'duel_surrendered') {
    return 'Ton adversaire remporte la partie.';
  }

  if (eventType === 'duel_won' && details.by_surrender) {
    return 'Victoire accordée après l’abandon de ton adversaire.';
  }

  if (eventType === 'matchmaking_started') {
    return `Partie en attente · #${details.match_id}`;
  }

  return '';
}
