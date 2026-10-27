const API_URL = window.TOPTRUMP_API_URL;

function showPlayer(pseudo) {
  document.getElementById('pseudo-affiche').textContent = pseudo;
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('game-box').style.display = 'block';
  document.getElementById('main-nav').hidden = false;
  window.dispatchEvent(new Event('toptrump:player-authenticated'));
}

async function refreshProgress() {
  const panel = document.getElementById('progress-panel');
  try {
    const response = await window.apiFetch(`${API_URL}?route=progress`);
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || 'Impossible de charger ta progression.');

    const collectionLabel = document.getElementById('collection-progress-label');
    collectionLabel.textContent = `${data.unique_cards} carte${data.unique_cards === 1 ? '' : 's'} découverte${data.unique_cards === 1 ? '' : 's'} sur ${data.total_cards}.`;
    const collectionBar = document.getElementById('collection-progress-bar');
    const collectionPercent = data.total_cards ? data.unique_cards / data.total_cards * 100 : 0;
    collectionBar.style.width = `${collectionPercent}%`;
    const collectionTrack = collectionBar.parentElement;
    collectionTrack.setAttribute('aria-valuemin', '0');
    collectionTrack.setAttribute('aria-valuemax', String(data.total_cards));
    collectionTrack.setAttribute('aria-valuenow', String(data.unique_cards));

    const bonusPacks = Number(data.bonus_packs) || 0;
    document.getElementById('bonus-pack-count').textContent = bonusPacks
      ? `${bonusPacks} pack${bonusPacks === 1 ? '' : 's'} bonus disponible${bonusPacks === 1 ? '' : 's'}`
      : 'Termine des missions pour gagner des packs bonus.';
    document.getElementById('pack-btn-description').textContent = bonusPacks
      ? `${bonusPacks} pack${bonusPacks === 1 ? '' : 's'} bonus disponible${bonusPacks === 1 ? '' : 's'} : ouvre-en un sans attendre le délai habituel.`
      : 'Ajoute 5 cartes aléatoires à ta collection. Un pack est disponible toutes les 20 minutes.';

    const missionsGrid = document.getElementById('missions-grid');
    missionsGrid.replaceChildren();
    data.missions.forEach(mission => {
      const card = document.createElement('article');
      card.className = 'mission-card';

      const title = document.createElement('h3');
      title.textContent = mission.title;
      const progress = document.createElement('p');
      progress.className = 'mission-progress-label';
      progress.textContent = mission.claimed
        ? 'Récompense réclamée'
        : mission.completed
          ? 'Mission accomplie · pack bonus à réclamer'
          : `Progression : ${mission.progress}/${mission.goal}`;
      const track = document.createElement('div');
      track.className = 'progress-track mission-progress-track';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', `Progression : ${mission.title}`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', String(mission.goal));
      track.setAttribute('aria-valuenow', String(mission.progress));
      const fill = document.createElement('span');
      fill.style.width = `${mission.progress / mission.goal * 100}%`;
      track.appendChild(fill);
      card.append(title, progress, track);

      if (mission.can_claim) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button-secondary mission-claim-button';
        button.textContent = 'Réclamer un pack bonus';
        button.addEventListener('click', () => claimMission(mission.id, button));
        card.appendChild(button);
      }
      missionsGrid.appendChild(card);
    });

    const badges = document.getElementById('collection-badges');
    badges.replaceChildren();
    data.badges.forEach(badge => {
      const item = document.createElement('div');
      item.className = `collection-badge${badge.earned ? ' is-earned' : ''}`;
      item.setAttribute('aria-label', `${badge.title} : ${badge.earned ? 'obtenu' : `${data.unique_cards} sur ${badge.goal} cartes`}`);
      const icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = badge.earned ? '★' : '☆';
      const name = document.createElement('span');
      name.textContent = badge.title;
      item.append(icon, name);
      badges.appendChild(item);
    });

    panel.hidden = false;
  } catch (error) {
    console.error('Impossible de charger la progression :', error);
    document.getElementById('message').textContent = error.message || 'Impossible de charger ta progression.';
  }
}

async function claimMission(missionId, button) {
  button.disabled = true;
  try {
    const response = await window.apiFetch(`${API_URL}?action=claim_mission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error || 'Impossible de réclamer cette récompense.');
    document.getElementById('message').textContent = 'Pack bonus ajouté : ouvre-le dès maintenant !';
    await refreshProgress();
  } catch (error) {
    document.getElementById('message').textContent = error.message || 'Impossible de réclamer cette récompense.';
    button.disabled = false;
  }
}

function showAuthError(action, message) {
  document.getElementById(`${action}-message`).textContent = message;
}

async function readApiResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    if (response.status >= 500) {
      throw new Error(`Le serveur a rencontré une erreur (HTTP ${response.status}). Vérifie les logs Apache/PHP.`);
    }
    throw new Error(`Réponse invalide du serveur (HTTP ${response.status}).`);
  }
}

function showAuthMode(action) {
  document.getElementById('login-box').hidden = action !== 'login';
  document.getElementById('register-box').hidden = action !== 'register';
  document.getElementById('login-message').textContent = '';
  document.getElementById('register-message').textContent = '';
}

async function authenticate(action, event) {
  event.preventDefault();
  const pseudo = document.getElementById(`${action}-pseudo`).value.trim();
  const password = document.getElementById(`${action}-password`).value;
  if (!pseudo || !password) {
    showAuthError(action, 'Saisis ton pseudo et ton mot de passe.');
    return;
  }

  try {
    const res = await window.apiFetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, password }),
    });
    const data = await readApiResponse(res);

    if (!res.ok) {
      showAuthError(action, data.error || 'Erreur d’authentification.');
      return;
    }

    showPlayer(data.pseudo);
    document.getElementById(`${action}-password`).value = '';
  } catch (error) {
    showAuthError(action, error.message || 'Impossible de contacter le serveur.');
  }
}

async function restoreSession() {
  try {
    const res = await window.apiFetch(`${API_URL}?route=current_player`);
    if (!res.ok) return;

    const data = await readApiResponse(res);
    if (data.authenticated) {
      showPlayer(data.pseudo);
    }
  } catch (error) {
    showAuthError('login', 'Impossible de vérifier la session. Vérifie que le serveur est démarré.');
  }
}

async function logout() {
  const button = document.getElementById('logout-btn');
  button.disabled = true;
  try {
    const res = await window.apiFetch(`${API_URL}?action=logout`, { method: 'POST' });
    const data = await readApiResponse(res);
    if (!res.ok) {
      document.getElementById('message').textContent = data.error || 'La déconnexion a échoué.';
      return;
    }

    document.getElementById('game-box').style.display = 'none';
    document.getElementById('progress-panel').hidden = true;
    document.getElementById('auth-box').style.display = 'block';
    document.getElementById('main-nav').hidden = true;
    document.getElementById('message').textContent = '';
    document.getElementById('find-match-btn').disabled = false;
    document.getElementById('login-pseudo').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-pseudo').value = '';
    document.getElementById('register-password').value = '';
    showAuthMode('login');
  } catch (error) {
    document.getElementById('message').textContent = error.message || 'Impossible de contacter le serveur pour se déconnecter.';
  } finally {
    button.disabled = false;
  }
}

async function openPack() {
  const btn = document.getElementById('pack-btn');
  const message = document.getElementById('message');
  const openedPack = document.getElementById('opened-pack');
  const openedPackCards = document.getElementById('opened-pack-cards');

  btn.disabled = true;
  message.textContent = '';
  openedPack.hidden = true;
  openedPackCards.replaceChildren();

  try {
    const res = await window.apiFetch(`${API_URL}?action=open_pack`, {
      method: 'POST',
      cache: 'no-store',
    });
    const data = await readApiResponse(res);

    if (!res.ok) {
      if (data.remaining_minutes) {
        message.textContent = `Prochain pack dans ${data.remaining_minutes} min.`;
      } else {
        message.textContent = data.error || 'Erreur inconnue.';
      }
      return;
    }
    message.textContent = `${data.cards.length} nouvelles cartes ajoutées à ta collection.`;
    if (data.bonus_pack) {
      message.textContent = `${data.cards.length} nouvelles cartes ajoutées avec ton pack bonus.`;
    }
    data.cards.forEach(card => {
      const article = document.createElement('article');
      article.className = 'opened-pack-card';

      const image = document.createElement('img');
      image.src = `assets/${card.card_image_path.split('/').map(encodeURIComponent).join('/')}`;
      image.alt = card.name;
      image.loading = 'lazy';

      const name = document.createElement('h3');
      name.textContent = card.name;
      article.append(image, name);
      openedPackCards.appendChild(article);
    });
    openedPack.hidden = data.cards.length === 0;
    refreshProgress();
    window.dispatchEvent(new Event('toptrump:pack-opened'));
  } catch (error) {
    message.textContent = error.message || 'Impossible de contacter le serveur.';
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('login-form').addEventListener('submit', event => authenticate('login', event));
document.getElementById('register-form').addEventListener('submit', event => authenticate('register', event));
document.querySelectorAll('[data-auth-mode]').forEach(button => {
  button.addEventListener('click', () => showAuthMode(button.dataset.authMode));
});
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('pack-btn').addEventListener('click', openPack);
document.getElementById('find-match-btn').addEventListener('click', () => {
  window.location.href = 'deck.html';
});

window.addEventListener('toptrump:player-authenticated', refreshProgress);
restoreSession();