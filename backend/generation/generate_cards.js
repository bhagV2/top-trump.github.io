/**
 * Pour chaque carte :
 *  - génère l'illustration via Pollinations.ai
 *  - génère des stats aléatoires
 *  - compose une carte finale style "Pokémon" (bordure dorée, bandeau nom, stats en barres)
 *
 * Sorties :
 *  - ../../frontend/assets/images/<slug>.jpg -> illustration brute
 *  - ../../frontend/assets/cards/<slug>.jpg   -> carte finale prête à l'emploi
 *  - cards.json             -> données de toutes les cartes (nom, image, stats)
 *
 * Usage :
 *   1) npm install node-fetch@2 sharp
 *   2) node generate_cards.js
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const sharp = require("sharp");

const POLLINATIONS_TOKEN = process.env.POLLINATIONS_TOKEN || "TON_TOKEN_ICI";
const ASSETS_DIR = path.join(__dirname, "..", "..", "frontend", "assets");
const IMAGES_DIR = path.join(ASSETS_DIR, "images");
const CARDS_DIR = path.join(ASSETS_DIR, "cards");
const JSON_PATH = path.join(__dirname, "cards.json");
const DELAY_MS = 1500; // avec un token, la limite est plus large (~1 req/5s min)

// --- Dimensions de la carte finale ---
const CARD_WIDTH = 780;
const CARD_HEIGHT = 1200;
const BORDER = 22;           // épaisseur du cadre doré
const CORNER_RADIUS = 42;    // arrondi général de la carte

const NAME_BANNER_TOP = BORDER + 16;
const NAME_BANNER_HEIGHT = 92;

const IMAGE_MARGIN_X = BORDER + 24;
const IMAGE_TOP = NAME_BANNER_TOP + NAME_BANNER_HEIGHT + 18;
const IMAGE_WIDTH = CARD_WIDTH - IMAGE_MARGIN_X * 2;
const IMAGE_HEIGHT = 630;
const IMAGE_RADIUS = 24;

const STATS_TOP = IMAGE_TOP + IMAGE_HEIGHT + 30;
const STATS_BOTTOM_MARGIN = BORDER + 20;

// Résolution de téléchargement de l'illustration brute (avant recadrage)
const DOWNLOAD_WIDTH = 768;
const DOWNLOAD_HEIGHT = 960;

// --- Attributs du jeu (modifie si besoin) ---
const ATTRIBUTES = [
  { key: "force", label: "FORCE", color: "#e74c3c" },
  { key: "vitesse", label: "VITESSE", color: "#3498db" },
  { key: "taille", label: "TAILLE", color: "#9b59b6" },
  { key: "dangerosite", label: "DANGER", color: "#e67e22" },
  { key: "intelligence", label: "INTELLIGENCE", color: "#16a085" },
];
const STAT_MIN = 20;
const STAT_MAX = 100;

// --- Liste des cartes : à compléter jusqu'à 50-100 ---
const CARDS = [
  "Tyrannosaurus Rex",
  "Velociraptor",
  "Triceratops",
  "Brachiosaurus",
  "Stegosaurus",
  "Spinosaurus",
  "Ankylosaurus",
  "Pteranodon",
  "African Lion",
  "Siberian Tiger",
  "Grizzly Bear",
  "Great White Shark",
  "African Elephant",
  "Gray Wolf",
  "Peregrine Falcon",
  "King Cobra",
  "Saltwater Crocodile",
  "Komodo Dragon",
  "Orca",
  "Cheetah"
];

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function promptFor(name) {
  return `Realistic photographic illustration of a ${name}, dynamic action pose, ` +
    `cinematic lighting, dark background, high detail, centered composition, ` +
    `trading card style`;
}

function randomStat() {
  return Math.floor(Math.random() * (STAT_MAX - STAT_MIN + 1)) + STAT_MIN;
}

function generateStats() {
  const stats = {};
  for (const attr of ATTRIBUTES) {
    stats[attr.key] = randomStat();
  }
  return stats;
}

async function downloadImage(name, attempt = 1) {
  const prompt = encodeURIComponent(promptFor(name));
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=${DOWNLOAD_WIDTH}&height=${DOWNLOAD_HEIGHT}&seed=${seed}&nologo=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${POLLINATIONS_TOKEN}` },
  });
  if (!res.ok) {
    const bodyText = await res.text();
    const isRateLimit = res.status === 429 || bodyText.includes("rate_limit");
    if (isRateLimit && attempt < 5) {
      const waitMs = 10000 * attempt;
      console.log(`  ⏳ rate limit, nouvelle tentative dans ${waitMs / 1000}s (essai ${attempt}/5)...`);
      await sleep(waitMs);
      return downloadImage(name, attempt + 1);
    }
    throw new Error(`Pollinations error ${res.status}: ${bodyText}`);
  }
  return res.buffer();
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Masque arrondi utilisé pour découper l'illustration (coins ronds façon Pokémon)
function buildImageMask() {
  return Buffer.from(`
    <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" rx="${IMAGE_RADIUS}" ry="${IMAGE_RADIUS}" fill="#fff"/>
    </svg>`);
}

// Cadre + bandeau + panneau de stats dessinés par-dessus l'image détourée
function buildOverlaySvg(name, stats) {
  const rowCount = ATTRIBUTES.length;
  const statsAreaHeight = CARD_HEIGHT - STATS_TOP - STATS_BOTTOM_MARGIN;
  const rowHeight = statsAreaHeight / rowCount;
  const barMaxWidth = 300;
  const barX = 300;
  const dotX = IMAGE_MARGIN_X + 8;

  let rows = "";
  ATTRIBUTES.forEach((attr, i) => {
    const rowY = STATS_TOP + rowHeight * i;
    const textY = rowY + rowHeight * 0.60;
    const barY = rowY + rowHeight * 0.30;
    const barH = rowHeight * 0.36;
    const value = stats[attr.key];
    const barW = (value / 100) * barMaxWidth;

    rows += `
      <circle cx="${dotX}" cy="${textY - 8}" r="8" fill="${attr.color}"/>
      <text x="${dotX + 20}" y="${textY}" font-family="Verdana, Arial, sans-serif" font-size="23" fill="#33302a" font-weight="bold" letter-spacing="0.5">${attr.label}</text>
      <rect x="${barX}" y="${barY}" width="${barMaxWidth}" height="${barH}" rx="${barH / 2}" fill="#e4ddc9"/>
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}" fill="${attr.color}"/>
      <text x="${CARD_WIDTH - IMAGE_MARGIN_X}" y="${textY}" font-family="Verdana, Arial, sans-serif" font-size="25" fill="#33302a" font-weight="bold" text-anchor="end">${value}</text>
    `;
  });

  const nameTextY = NAME_BANNER_TOP + NAME_BANNER_HEIGHT * 0.65;

  return `
  <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff6cf"/>
        <stop offset="45%" stop-color="#e8bd4a"/>
        <stop offset="100%" stop-color="#a5822a"/>
      </linearGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fbf6e8"/>
        <stop offset="100%" stop-color="#f0e8d2"/>
      </linearGradient>
      <linearGradient id="nameplate" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#1f2a52"/>
        <stop offset="55%" stop-color="#3c4f95"/>
        <stop offset="100%" stop-color="#1f2a52"/>
      </linearGradient>
    </defs>

    <!-- fond -->
    <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CORNER_RADIUS}" fill="url(#bg)"/>

    <!-- ombre du bandeau -->
    <rect x="${BORDER + 12}" y="${NAME_BANNER_TOP + 5}" width="${CARD_WIDTH - (BORDER + 12) * 2}" height="${NAME_BANNER_HEIGHT}"
          rx="14" fill="#000000" opacity="0.18"/>
    <!-- bandeau du nom -->
    <rect x="${BORDER + 10}" y="${NAME_BANNER_TOP}" width="${CARD_WIDTH - (BORDER + 10) * 2}" height="${NAME_BANNER_HEIGHT}"
          rx="14" fill="url(#nameplate)" stroke="#f0d68a" stroke-width="2.5"/>
    <text x="${CARD_WIDTH / 2}" y="${nameTextY}" font-family="Verdana, Arial, sans-serif" font-size="36" fill="#ffffff"
          font-weight="bold" text-anchor="middle" letter-spacing="1.5">${escapeXml(name).toUpperCase()}</text>

    <!-- ombre de l'image -->
    <rect x="${IMAGE_MARGIN_X - 3}" y="${IMAGE_TOP + 4}" width="${IMAGE_WIDTH + 6}" height="${IMAGE_HEIGHT + 6}"
          rx="${IMAGE_RADIUS + 3}" fill="#000000" opacity="0.15"/>
    <!-- cadre de l'illustration -->
    <rect x="${IMAGE_MARGIN_X - 5}" y="${IMAGE_TOP - 5}" width="${IMAGE_WIDTH + 10}" height="${IMAGE_HEIGHT + 10}"
          rx="${IMAGE_RADIUS + 5}" fill="none" stroke="#1f2a52" stroke-width="3"/>
    <rect x="${IMAGE_MARGIN_X - 2}" y="${IMAGE_TOP - 2}" width="${IMAGE_WIDTH + 4}" height="${IMAGE_HEIGHT + 4}"
          rx="${IMAGE_RADIUS + 2}" fill="none" stroke="#e8bd4a" stroke-width="1.5"/>

    <!-- séparateur -->
    <line x1="${BORDER + 24}" y1="${STATS_TOP - 16}" x2="${CARD_WIDTH - BORDER - 24}" y2="${STATS_TOP - 16}" stroke="#c9b98a" stroke-width="1.5"/>

    ${rows}

    <!-- bordure dorée extérieure -->
    <rect x="${BORDER / 2}" y="${BORDER / 2}" width="${CARD_WIDTH - BORDER}" height="${CARD_HEIGHT - BORDER}"
          rx="${CORNER_RADIUS}" fill="none" stroke="url(#gold)" stroke-width="${BORDER}"/>
    <rect x="${BORDER - 3}" y="${BORDER - 3}" width="${CARD_WIDTH - (BORDER - 3) * 2}" height="${CARD_HEIGHT - (BORDER - 3) * 2}"
          rx="${CORNER_RADIUS - 8}" fill="none" stroke="#7a5f1e" stroke-width="1.5" opacity="0.6"/>
  </svg>`;
}

async function composeCard(rawImageBuffer, name, stats) {
  // Recadre l'illustration à la taille de la fenêtre image, puis applique le masque à coins arrondis
  const croppedImage = await sharp(rawImageBuffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .toBuffer();

  const roundedImage = await sharp(croppedImage)
    .composite([{ input: buildImageMask(), blend: "dest-in" }])
    .png()
    .toBuffer();

  const overlaySvg = Buffer.from(buildOverlaySvg(name, stats));

  const base = sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: { r: 247, g: 242, b: 226, alpha: 1 },
    },
  });

  return base
    .composite([
      { input: overlaySvg, top: 0, left: 0 }, // fond + cadre + bandeau + stats
      { input: roundedImage, top: IMAGE_TOP, left: IMAGE_MARGIN_X }, // image insérée par-dessus
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadExistingCards() {
  if (fs.existsSync(JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    } catch {
      return [];
    }
  }
  return [];
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });

  const cards = loadExistingCards();
  const doneSlugs = new Set(cards.map((c) => c.slug));

  for (const name of CARDS) {
    const slug = slugify(name);
    if (doneSlugs.has(slug)) {
      console.log(`✓ déjà présent : ${name}`);
      continue;
    }
    try {
      console.log(`→ génération : ${name}`);
      const rawBuffer = await downloadImage(name);
      fs.writeFileSync(path.join(IMAGES_DIR, `${slug}.jpg`), rawBuffer);

      const stats = generateStats();
      const cardBuffer = await composeCard(rawBuffer, name, stats);
      fs.writeFileSync(path.join(CARDS_DIR, `${slug}.jpg`), cardBuffer);

      cards.push({
        slug,
        name,
        image: `images/${slug}.jpg`,
        card: `cards/${slug}.jpg`,
        stats,
      });
      fs.writeFileSync(JSON_PATH, JSON.stringify(cards, null, 2));
      console.log(`✓ sauvegardé : ${name}`, stats);
    } catch (err) {
      console.error(`✗ échec pour "${name}" :`, err.message);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Terminé. ${cards.length} cartes dans cards.json`);
}

main();