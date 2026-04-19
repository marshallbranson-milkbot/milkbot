const fs = require('fs');
const path = require('path');
const https = require('https');

const BG_DIR = path.join(__dirname, 'assets', 'backgrounds');

// Queries paired with required keywords — a search result's URL slug must contain
// at least one required keyword or it is rejected as off-topic.
const QUERY_POOL = [
  { query: 'subway surfers gameplay', requiredKeywords: ['subway-surfers', 'subway'] },
  { query: 'minecraft parkour', requiredKeywords: ['minecraft'] },
];

function ensureBgDir() {
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
}

function listExistingBackgrounds() {
  ensureBgDir();
  return fs.readdirSync(BG_DIR).filter(f => /\.(mp4|mov|webm|mkv)$/i.test(f));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function searchPexels(apiKey, query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    throw new Error(`Pexels search failed: ${res.status} ${await res.text().then(t => t.slice(0, 200)).catch(() => '')}`);
  }
  const data = await res.json();
  return Array.isArray(data.videos) ? data.videos : [];
}

function pickBestFile(video) {
  if (!video || !Array.isArray(video.video_files)) return null;
  // Prefer portrait, medium-sized files (hd or sd, not uhd to keep filesize sane)
  const portrait = video.video_files.filter(f =>
    typeof f.width === 'number' && typeof f.height === 'number' && f.height > f.width
  );
  const candidates = portrait.length > 0 ? portrait : video.video_files;
  // Sort: pick closest-to-1080 height
  candidates.sort((a, b) => Math.abs((a.height || 0) - 1280) - Math.abs((b.height || 0) - 1280));
  return candidates[0] || null;
}

const MAX_REDIRECTS = 3;

function downloadToFile(url, destPath, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    // Only allow HTTPS — reject downgrade attacks via redirect to HTTP or other schemes.
    if (!/^https:\/\//i.test(url)) {
      return reject(new Error(`Refusing non-HTTPS URL: ${url.slice(0, 60)}`));
    }
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        if (redirectsLeft <= 0) {
          return reject(new Error('Too many redirects'));
        }
        return resolve(downloadToFile(res.headers.location, destPath, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    });
    req.on('error', err => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function matchesRequiredKeywords(video, requiredKeywords) {
  const url = String(video.url || '').toLowerCase();
  const userName = String(video.user?.name || '').toLowerCase();
  const haystack = `${url} ${userName}`;
  return requiredKeywords.some(kw => haystack.includes(kw.toLowerCase()));
}

async function fetchOneBackground(apiKey, usedIds, forcedEntry = null) {
  const entry = forcedEntry || pickRandom(QUERY_POOL);
  const { query, requiredKeywords } = entry;
  const videos = await searchPexels(apiKey, query);
  const fresh = videos.filter(v => !usedIds.has(v.id) && matchesRequiredKeywords(v, requiredKeywords));
  if (fresh.length === 0) {
    console.log(`[pexels] "${query}" returned no on-topic results`);
    return null;
  }
  const video = pickRandom(fresh);
  const file = pickBestFile(video);
  if (!file || !file.link) return null;

  ensureBgDir();
  const safeQuery = query.replace(/[^a-z0-9]+/gi, '-').slice(0, 30);
  const destPath = path.join(BG_DIR, `pexels-${video.id}-${safeQuery}.mp4`);
  if (fs.existsSync(destPath)) return destPath;

  console.log(`[pexels] downloading "${query}" → id=${video.id} (url: ${video.url})`);
  await downloadToFile(file.link, destPath);
  const sizeMb = fs.statSync(destPath).size / (1024 * 1024);
  console.log(`[pexels] saved ${path.basename(destPath)} (${sizeMb.toFixed(1)} MB)`);
  return destPath;
}

function existingVideoIds() {
  const ids = new Set();
  for (const f of listExistingBackgrounds()) {
    const match = f.match(/pexels-(\d+)-/);
    if (match) ids.add(Number(match[1]));
  }
  return ids;
}

async function ensureBackgroundPool(targetCount = 5) {
  const existing = listExistingBackgrounds();

  // If the user has manually dropped in any backgrounds, use only those — never pollute with Pexels.
  const userClips = existing.filter(f => !f.startsWith('pexels-'));
  if (userClips.length > 0) {
    console.log(`[pexels] ${userClips.length} user-provided background(s) found — skipping Pexels fetch`);
    return userClips.map(f => path.join(BG_DIR, f));
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log('[pexels] PEXELS_API_KEY not set — skipping background fetch');
    return existing.map(f => path.join(BG_DIR, f));
  }

  if (existing.length >= targetCount) {
    return existing.map(f => path.join(BG_DIR, f));
  }

  const needed = targetCount - existing.length;
  const usedIds = existingVideoIds();
  console.log(`[pexels] background pool has ${existing.length}, fetching ${needed} more`);

  // Round-robin through the query pool so we always get a mix of background types.
  for (let i = 0; i < needed; i++) {
    const forcedEntry = QUERY_POOL[i % QUERY_POOL.length];
    try {
      const result = await fetchOneBackground(apiKey, usedIds, forcedEntry);
      if (result) {
        const m = path.basename(result).match(/pexels-(\d+)-/);
        if (m) usedIds.add(Number(m[1]));
      }
    } catch (e) {
      console.warn(`[pexels] fetch failed (${i + 1}/${needed}):`, e.message);
    }
  }

  return listExistingBackgrounds().map(f => path.join(BG_DIR, f));
}

module.exports = { ensureBackgroundPool, listExistingBackgrounds, BG_DIR };
