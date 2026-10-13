const API_URL = window.TOPTRUMP_API_URL;

function showPlayer(pseudo) {
  document.getElementById('pseudo-affiche').textContent = pseudo;
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('game-box').style.display = 'block';
  document.getElementById('main-nav').hidden = false;
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

restoreSession();