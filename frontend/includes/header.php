<?php
$pageTitle = $pageTitle ?? 'Top Trump';
$extraStylesheets = $extraStylesheets ?? [];
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="stylesheet" href="css/style.css">
  <script src="js/api-config.js"></script>
  <?php foreach ($extraStylesheets as $stylesheet): ?>
    <link rel="stylesheet" href="<?= htmlspecialchars($stylesheet, ENT_QUOTES, 'UTF-8') ?>">
  <?php endforeach; ?>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="index.php" aria-label="Top Trump, accueil">
      <span class="brand-mark" aria-hidden="true">T</span>
      <span class="brand-name">Top <strong>Trump</strong></span>
    </a>
    <nav class="site-nav" id="main-nav" aria-label="Navigation principale" hidden>
      <a href="index.php"<?= basename($_SERVER['SCRIPT_NAME'] ?? '') === 'index.php' ? ' aria-current="page"' : '' ?>>Accueil</a>
      <a href="collection.php"<?= basename($_SERVER['SCRIPT_NAME'] ?? '') === 'collection.php' ? ' aria-current="page"' : '' ?>>Mes cartes</a>
      <a href="cards.php"<?= basename($_SERVER['SCRIPT_NAME'] ?? '') === 'cards.php' ? ' aria-current="page"' : '' ?>>Toutes les cartes</a>
      <a href="deck.php"<?= basename($_SERVER['SCRIPT_NAME'] ?? '') === 'deck.php' ? ' aria-current="page"' : '' ?>>Préparer un duel</a>
      <a href="activity.php"<?= basename($_SERVER['SCRIPT_NAME'] ?? '') === 'activity.php' ? ' aria-current="page"' : '' ?>>Journal</a>
    </nav>
  </header>
  <main class="site-main">
