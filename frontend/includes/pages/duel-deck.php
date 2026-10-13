<section class="duel-deck-page" aria-labelledby="duel-deck-title">
  <div class="cards-heading">
    <div>
      <span class="eyebrow">PRÉPARATION DU DUEL</span>
      <h1 id="duel-deck-title">Choisis tes 5 cartes</h1>
      <p>Choisis cinq cartes différentes de ta collection. Elles seront mélangées et jouées dans un ordre aléatoire.</p>
    </div>
    <a class="button-secondary cards-back-link" href="index.php">Retour à l’accueil</a>
  </div>

  <div class="deck-selection-toolbar">
    <p id="deck-selection-count" role="status" aria-live="polite">Chargement de ta collection...</p>
    <button id="start-duel-btn" class="button-primary" type="button" disabled>Choisir 5 cartes pour continuer</button>
  </div>

  <p id="deck-selection-message" class="collection-empty" role="status" aria-live="polite"></p>
  <div id="deck-cards-grid" class="cards-grid"></div>
</section>
