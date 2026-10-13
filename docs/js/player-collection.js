(async () => {
  const API_URL = window.TOPTRUMP_API_URL;
  const grid = document.getElementById('player-cards-grid');
  const message = document.getElementById('collection-message');
  const description = document.getElementById('collection-description');

  try {
    const response = await window.apiFetch(`${API_URL}?route=collection`);
    if (response.status === 401) {
      window.location.replace('index.html');
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger ta collection.');
    }

    const cards = data.cards;
    const totalCards = cards.reduce((total, card) => total + Number(card.quantity), 0);
    description.textContent = `${cards.length} cartes différentes · ${totalCards} cartes au total`;
    message.hidden = cards.length > 0;
    message.textContent = cards.length === 0
      ? 'Ta collection est vide. Ouvre un pack depuis ton espace pour obtenir tes premières cartes.'
      : '';

    cards.forEach(card => {
      const figure = document.createElement('figure');
      figure.className = 'collection-card';

      const image = document.createElement('img');
      const imagePath = card.card_image_path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      image.src = `assets/${imagePath}`;
      image.alt = card.name;
      image.loading = 'lazy';

      const caption = document.createElement('figcaption');
      caption.textContent = card.name;

      const quantity = document.createElement('span');
      quantity.className = 'card-quantity';
      quantity.textContent = `×${card.quantity}`;
      quantity.setAttribute('aria-label', `Quantité : ${card.quantity}`);

      figure.append(image, caption, quantity);
      grid.appendChild(figure);
    });
  } catch (error) {
    message.hidden = false;
    message.textContent = 'Impossible de charger ta collection. Réessaie dans un instant.';
    description.textContent = '';
  }
})();
