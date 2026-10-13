<div id="auth-box">
  <section id="login-box" class="auth-panel">
    <div class="panel-heading">
      <span class="eyebrow">RAVI DE TE REVOIR</span>
      <h1>Connexion</h1>
      <p>Entre ton pseudo et ton mot de passe pour retrouver ta collection et reprendre le jeu.</p>
    </div>
    <form id="login-form">
      <label class="field-label" for="login-pseudo">Pseudo</label>
      <input type="text" id="login-pseudo" placeholder="Ton pseudo" maxlength="50" autocomplete="username" required>
      <label class="field-label" for="login-password">Mot de passe</label>
      <input type="password" id="login-password" placeholder="Ton mot de passe" minlength="8" maxlength="72" autocomplete="current-password" aria-describedby="login-password-help" required>
      <small class="field-help" id="login-password-help">Saisis le mot de passe associé à ton compte.</small>
      <div class="auth-actions">
        <button class="button-primary" type="submit">Se connecter <span aria-hidden="true">→</span></button>
      </div>
    </form>
    <div id="login-message" class="message" role="status" aria-live="polite"></div>
    <p class="auth-switch">Pas encore de compte ? <button class="text-button" type="button" data-auth-mode="register">Créer un compte</button></p>
  </section>

  <section id="register-box" class="auth-panel" hidden>
    <div class="panel-heading">
      <span class="eyebrow">REJOINS L’ARÈNE</span>
      <h1>Créer un compte</h1>
      <p>Crée ton profil avec un pseudo et un mot de passe. Tu pourras ensuite collectionner des cartes et jouer des duels.</p>
    </div>
    <form id="register-form">
      <label class="field-label" for="register-pseudo">Pseudo</label>
      <input type="text" id="register-pseudo" placeholder="Choisis ton pseudo" maxlength="50" autocomplete="username" required>
      <label class="field-label" for="register-password">Mot de passe</label>
      <input type="password" id="register-password" placeholder="Au moins 8 caractères" minlength="8" maxlength="72" autocomplete="new-password" aria-describedby="register-password-help" required>
      <small class="field-help" id="register-password-help">Choisis un mot de passe de 8 caractères minimum.</small>
      <div class="auth-actions">
        <button class="button-primary" type="submit">Créer mon compte <span aria-hidden="true">→</span></button>
      </div>
    </form>
    <div id="register-message" class="message" role="status" aria-live="polite"></div>
    <p class="auth-switch">Tu as déjà un compte ? <button class="text-button" type="button" data-auth-mode="login">Se connecter</button></p>
  </section>
</div>
