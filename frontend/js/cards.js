(async () => {
  const API_URL = window.TOPTRUMP_API_URL;
  const grid = document.getElementById('cards-grid');
  const message = document.getElementById('cards-message');
  const description = document.getElementById('cards-description');

  try {
    const response = await window.apiFetch(`${API_URL}?route=all_cards`);
    if (response.status === 401) {
      window.location.replace('index.php');
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Impossible de charger les cartes.');
    }

    const cards = data.cards;
    description.textContent = `${cards.length} cartes disponibles dans le jeu.`;
    message.hidden = cards.length > 0;
    message.textContent = cards.length === 0
      ? 'Aucune carte disponible. Vérifie que les cartes ont été importées dans la base.'
      : '';

    cards.forEach(card => {
      const article = document.createElement('article');
      article.className = 'catalog-card';

      const image = document.createElement('img');
      const imagePath = card.image_path
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      image.src = `assets/${imagePath}`;
      image.alt = card.name;
      image.loading = 'lazy';
      const imageFrame = document.createElement('div');
      imageFrame.className = 'catalog-card-image';
      imageFrame.appendChild(image);

      if (Number(card.quantity) > 0) {
        const acquiredBadge = document.createElement('span');
        acquiredBadge.className = 'card-acquired-badge';
        acquiredBadge.textContent = 'Acquis';
        imageFrame.appendChild(acquiredBadge);
      }

      const content = document.createElement('div');
      content.className = 'catalog-card-content';

      const title = document.createElement('h2');
      title.textContent = card.name;
      content.appendChild(title);

      const stats = document.createElement('dl');
      stats.className = 'card-stats';
      [
        ['Force', card.force],
        ['Vitesse', card.vitesse],
        ['Taille', card.taille],
        ['Dangerosité', card.dangerosite],
        ['Intelligence', card.intelligence],
      ].forEach(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        stats.appendChild(row);
      });

      content.appendChild(stats);
      article.append(imageFrame, content);
      grid.appendChild(article);
    });
  } catch (error) {
    message.hidden = false;
    message.textContent = 'Impossible de charger les cartes. Réessaie dans un instant.';
    description.textContent = '';
  }
})();
