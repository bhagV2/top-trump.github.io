(() => {
  const API_URL = window.TOPTRUMP_API_URL;
  const PAGE_STEPS = {
    'index.html': {
      step: 'open_pack',
      selector: '#pack-btn',
      title: 'Ouvre ton premier pack',
      description: 'Clique sur ce bouton pour recevoir cinq cartes. Une fois le pack ouvert, nous regarderons ta collection.',
    },
    'collection.html': {
      step: 'collection',
      selector: '#player-cards-grid',
      title: 'Regarde tes cartes',
      description: 'Les cartes obtenues dans le pack apparaissent ici. Le nombre indique combien d’exemplaires tu possèdes.',
      nextStep: 'catalog',
      nextPage: 'cards.html',
      nextLabel: 'Voir toutes les cartes',
    },
    'cards.html': {
      step: 'catalog',
      selector: '#cards-grid',
      title: 'Découvre toutes les cartes',
      description: 'Le catalogue présente toutes les cartes du jeu et leurs caractéristiques.',
      nextStep: 'deck',
      nextPage: 'deck.html',
      nextLabel: 'Préparer un duel',
    },
    'deck.html': {
      step: 'deck',
      selector: '#deck-cards-grid .deck-count-button[aria-label^="Ajouter"]:not(:disabled)',
      title: 'Compose ta main',
      description: 'Clique sur ce bouton + pour ajouter cette carte à ta main. Continue avec quatre autres cartes différentes ; le compteur t’indique ta sélection.',
    },
  };

  let currentStep = null;
  let target = null;
  let finishing = false;
  let initialized = false;
  let initializing = false;
  let retryAfterInitialization = false;

  const pageName = window.location.pathname.split('/').pop() || 'index.html';

  function createGuide() {
    const backdrop = document.createElement('div');
    backdrop.className = 'onboarding-backdrop';
    backdrop.hidden = true;

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.classList.add('onboarding-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.hidden = true;
    arrow.innerHTML = '<defs><marker id="onboarding-arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z"></path></marker></defs><line id="onboarding-arrow-line" marker-end="url(#onboarding-arrowhead)"></line>';

    const dialog = document.createElement('section');
    dialog.className = 'onboarding-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-labelledby', 'onboarding-title');
    dialog.setAttribute('aria-describedby', 'onboarding-description');
    dialog.hidden = true;
    dialog.innerHTML = `
      <p class="eyebrow" id="onboarding-progress"></p>
      <h2 id="onboarding-title"></h2>
      <p id="onboarding-description"></p>
      <p id="onboarding-error" class="onboarding-error" role="status" aria-live="polite"></p>
      <div class="onboarding-actions">
        <button class="button-secondary" id="onboarding-skip" type="button">Passer le tutoriel</button>
        <button class="button-primary" id="onboarding-next" type="button">Suivant</button>
      </div>
    `;

    document.body.append(backdrop, arrow, dialog);
    document.getElementById('onboarding-next').addEventListener('click', continueGuide);
    document.getElementById('onboarding-skip').addEventListener('click', () => saveStep('done'));
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', positionGuide);
    window.addEventListener('scroll', positionGuide, true);
    window.addEventListener('toptrump:pack-opened', handlePackOpened);
    window.addEventListener('toptrump:deck-selection-changed', handleDeckSelectionChanged);
    return { backdrop, arrow, dialog };
  }

  async function readPlayer() {
    const response = await window.apiFetch(`${API_URL}?route=current_player`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger le tutoriel.');
    return data;
  }

  async function waitForTarget(selector) {
    const existing = document.querySelector(selector);
    if (existing) return existing;

    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10000);
    });
  }

  async function initialize() {
    if (initialized || initializing) return;
    const config = PAGE_STEPS[pageName];
    if (!config) {
      initialized = true;
      return;
    }

    initializing = true;
    try {
      const player = await readPlayer();
      if (!player.authenticated) return;
      if (player.onboarding_step !== config.step) {
        initialized = true;
        return;
      }

      const element = await waitForTarget(config.selector);
      if (!element) return;
      initialized = true;
      currentStep = config;
      target = element;
      const guide = createGuide();
      guide.backdrop.hidden = false;
      guide.arrow.hidden = false;
      guide.dialog.hidden = false;
      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      target.classList.add('onboarding-highlight');
      document.getElementById('onboarding-progress').textContent = config.step === 'open_pack'
        ? 'BIENVENUE · ÉTAPE 1 SUR 4'
        : `BIENVENUE · ÉTAPE ${['open_pack', 'collection', 'catalog', 'deck'].indexOf(config.step) + 1} SUR 4`;
      document.getElementById('onboarding-title').textContent = config.title;
      document.getElementById('onboarding-description').textContent = config.description;
      if (config.step === 'deck') {
        const selectedCount = Number.parseInt(
          document.getElementById('deck-selection-count').textContent,
          10
        ) || 0;
        updateDeckGuide(selectedCount);
      }

      const next = document.getElementById('onboarding-next');
      if (config.step === 'open_pack') {
        next.hidden = true;
      } else if (config.nextLabel) {
        next.textContent = config.nextLabel;
      } else {
        next.hidden = true;
      }

      positionGuide();
      (next.hidden ? document.getElementById('onboarding-skip') : next).focus();
    } catch (error) {
      console.error('Impossible de démarrer le tutoriel :', error);
    } finally {
      initializing = false;
      if (retryAfterInitialization) {
        retryAfterInitialization = false;
        initialize();
      }
    }
  }

  function handlePlayerAuthenticated() {
    if (initializing) {
      retryAfterInitialization = true;
      return;
    }
    initialize();
  }

  async function updateStep(step) {
    const response = await window.apiFetch(`${API_URL}?action=onboarding_step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer le tutoriel.');
  }

  async function continueGuide() {
    if (!currentStep?.nextStep || !currentStep.nextPage) return;
    const button = document.getElementById('onboarding-next');
    button.disabled = true;
    try {
      await updateStep(currentStep.nextStep);
      window.location.href = currentStep.nextPage;
    } catch (error) {
      document.getElementById('onboarding-error').textContent = error.message;
      button.disabled = false;
    }
  }

  function handlePackOpened() {
    if (currentStep?.step !== 'open_pack') return;
    window.location.href = 'collection.html';
  }

  function handleDeckSelectionChanged(event) {
    if (currentStep?.step !== 'deck') return;
    updateDeckGuide(Number(event.detail?.selectedCount));
  }

  function updateDeckGuide(selectedCount) {
    const progress = document.getElementById('onboarding-progress');
    const title = document.getElementById('onboarding-title');
    const description = document.getElementById('onboarding-description');
    if (!progress || !title || !description) return;

    const readyToStart = selectedCount === 5;
    const nextTarget = document.querySelector(readyToStart
      ? '#deck-selection-toolbar'
      : '#deck-cards-grid .deck-count-button[aria-label^="Ajouter"]:not(:disabled)');
    if (!nextTarget) return;

    target?.classList.remove('onboarding-highlight');
    target = nextTarget;
    target.classList.add('onboarding-highlight');
    progress.textContent = readyToStart
      ? 'BIENVENUE · ÉTAPE 4 SUR 4 · TA MAIN EST PRÊTE'
      : 'BIENVENUE · ÉTAPE 4 SUR 4 · COMPOSE TA MAIN';
    title.textContent = readyToStart
      ? 'Tes cinq cartes sont choisies !'
      : 'Compose ta main';
    description.textContent = readyToStart
      ? 'Ta main est prête. Vérifie le compteur, puis clique sur « Démarrer le duel contre l’ordinateur ».'
      : `Clique sur ce bouton + pour ajouter cette carte à ta main. Continue avec ${5 - selectedCount} autre${5 - selectedCount === 1 ? '' : 's'} carte${5 - selectedCount === 1 ? '' : 's'} différente${5 - selectedCount === 1 ? '' : 's'} ; le compteur t’indique ta sélection.`;
    positionGuide();
  }

  async function saveStep(step) {
    if (finishing) return;
    finishing = true;
    const buttons = document.querySelectorAll('#onboarding-next, #onboarding-skip');
    buttons.forEach(button => button.disabled = true);
    try {
      await updateStep(step);
      closeGuide();
    } catch (error) {
      document.getElementById('onboarding-error').textContent = error.message;
    } finally {
      finishing = false;
      buttons.forEach(button => button.disabled = false);
    }
  }

  function closeGuide() {
    target?.classList.remove('onboarding-highlight');
    target = null;
    document.querySelectorAll('.onboarding-backdrop, .onboarding-arrow, .onboarding-dialog')
      .forEach(element => element.remove());
    window.removeEventListener('resize', positionGuide);
    window.removeEventListener('scroll', positionGuide, true);
    window.removeEventListener('toptrump:pack-opened', handlePackOpened);
    window.removeEventListener('toptrump:deck-selection-changed', handleDeckSelectionChanged);
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      saveStep('done');
      return;
    }
    if (event.key !== 'Tab') return;

    const buttons = [...document.querySelectorAll('.onboarding-dialog button:not([hidden]):not(:disabled)')];
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

  function positionGuide() {
    if (!target) return;
    const dialog = document.querySelector('.onboarding-dialog');
    const arrow = document.querySelector('.onboarding-arrow');
    if (!dialog || !arrow) return;

    const rect = target.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dialogWidth = dialog.offsetWidth;
    const dialogHeight = dialog.offsetHeight;
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - dialogWidth / 2, width - dialogWidth - 16));
    const placeAbove = rect.top > dialogHeight + 40;
    const top = placeAbove
      ? rect.top - dialogHeight - 24
      : Math.min(rect.bottom + 24, height - dialogHeight - 16);
    dialog.style.left = `${left}px`;
    dialog.style.top = `${Math.max(16, top)}px`;

    const dialogRect = dialog.getBoundingClientRect();
    const line = document.getElementById('onboarding-arrow-line');
    line.setAttribute('x1', String(dialogRect.left + dialogRect.width / 2));
    line.setAttribute('y1', String(placeAbove ? dialogRect.bottom : dialogRect.top));
    line.setAttribute('x2', String(rect.left + rect.width / 2));
    line.setAttribute('y2', String(placeAbove ? rect.top : rect.bottom));
    arrow.setAttribute('viewBox', `0 0 ${width} ${height}`);
    arrow.setAttribute('width', String(width));
    arrow.setAttribute('height', String(height));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
  window.addEventListener('toptrump:player-authenticated', handlePlayerAuthenticated);
})();
