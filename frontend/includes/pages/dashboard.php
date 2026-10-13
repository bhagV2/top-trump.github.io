<div id="game-box">
  <div class="welcome-panel">
    <div>
      <span class="eyebrow">ESPACE JOUEUR</span>
      <h1>Bienvenue, <span id="pseudo-affiche"></span></h1>
      <p>Ouvre un pack pour obtenir des cartes, puis lance une partie contre un adversaire.</p>
    </div>
    <button class="button-secondary" id="logout-btn" type="button">Se déconnecter</button>
  </div>

  <div class="action-grid">
    <button class="action-card" id="pack-btn" type="button">
      <span class="action-icon" aria-hidden="true">✦</span>
      <span class="action-title">Ouvrir un pack</span>
      <span class="action-description">Ajoute 5 cartes aléatoires à ta collection. Un pack est disponible toutes les 20 minutes.</span>
    </button>
    <button class="action-card action-card-featured" id="find-match-btn" type="button">
      <span class="action-icon" aria-hidden="true">⚔</span>
      <span class="action-title">Préparer un duel</span>
      <span class="action-description">Choisis 5 cartes de ta collection avant de chercher un adversaire.</span>
    </button>
  </div>

  <p id="message" class="message" role="status" aria-live="polite"></p>
  <section id="opened-pack" class="opened-pack" aria-labelledby="opened-pack-title" hidden>
    <div class="section-heading">
      <span class="eyebrow">NOUVELLES CARTES</span>
      <h2 id="opened-pack-title">Cartes obtenues dans ce pack</h2>
    </div>
    <div id="opened-pack-cards" class="opened-pack-cards"></div>
  </section>
  <p class="dashboard-help">Retrouve tes cartes et le catalogue complet dans le menu en haut de la page.</p>
</div>
