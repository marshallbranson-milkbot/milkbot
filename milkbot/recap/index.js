const fs = require('fs');
const path = require('path');
const { captureSnapshot, loadSnapshot, estDateString, pruneOldSnapshots } = require('./snapshot');
const { analyzeRecap } = require('./analyze');
const { generateScript } = require('./script');
const { generateVoice } = require('./voice');
const { renderVideo } = require('./render');
const { deliverRecap, deliverError } = require('./deliver');

const TMP_ROOT = path.join(__dirname, '..', 'data', 'recap-tmp');

function ensureTmpDir(dateString) {
  const dir = path.join(TMP_ROOT, dateString);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTmp(dir) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.warn('[recap] tmp cleanup failed:', e.message);
  }
}

async function captureMidnightSnapshot() {
  try {
    const dateString = estDateString();
    const snap = captureSnapshot(dateString);
    pruneOldSnapshots(30);
    return snap;
  } catch (e) {
    console.error('[recap] snapshot capture failed:', e);
    return null;
  }
}

function ensureTodaysSnapshot() {
  const today = estDateString();
  if (!loadSnapshot(today)) {
    console.log('[recap] no snapshot for today; capturing now');
    captureSnapshot(today);
  }
}

async function runDailyRecap(client) {
  const todayDate = estDateString();
  const tmpDir = ensureTmpDir(todayDate);
  let phase = 'init';

  try {
    ensureTodaysSnapshot();

    phase = 'analyze';
    const analysis = await analyzeRecap(client);
    console.log(`[recap] analyze: ${analysis.eventCount || 0} events, top=${analysis.topEvent?.type || 'none'}`);
    if (!analysis.ok) {
      console.log(`[recap] skipping — ${analysis.reason}`);
      return { ok: false, reason: analysis.reason };
    }

    phase = 'script';
    const scriptResult = await generateScript(analysis);
    console.log(`[recap] script (${scriptResult.script.length} chars): ${scriptResult.hook}`);

    phase = 'voice';
    const voice = await generateVoice(scriptResult.script, tmpDir);
    console.log(`[recap] voice: ${voice.totalDuration.toFixed(1)}s, ${voice.words.length} words`);

    phase = 'render';
    const render = await renderVideo({
      audioPath: voice.audioPath,
      words: voice.words,
      outputDir: tmpDir,
      introText: scriptResult.introText,
      outroText: scriptResult.outroText,
    });
    console.log(`[recap] render: ${render.outputPath}`);

    phase = 'deliver';
    await deliverRecap(client, {
      videoPath: render.outputPath,
      script: scriptResult.script,
      caption: scriptResult.caption,
      hashtags: scriptResult.hashtags,
      topEvent: analysis.topEvent,
      todayDate,
    });

    cleanupTmp(tmpDir);
    return { ok: true, todayDate, topEvent: analysis.topEvent };
  } catch (e) {
    console.error(`[recap] failed at ${phase}:`, e);
    try { await deliverError(client, { todayDate, error: e, phase }); } catch {}
    cleanupTmp(tmpDir);
    return { ok: false, reason: `error_at_${phase}`, error: e.message };
  }
}

function scheduleRecap(client) {
  function msUntilEstHour(targetHour) {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const target = new Date(estNow);
    target.setHours(targetHour, 0, 0, 0);
    if (target <= estNow) target.setDate(target.getDate() + 1);
    const offsetMs = now.getTime() - estNow.getTime();
    return target.getTime() + offsetMs - now.getTime();
  }

  const snapshotMs = msUntilEstHour(0);
  setTimeout(async () => {
    await captureMidnightSnapshot();
    setInterval(() => captureMidnightSnapshot(), 24 * 60 * 60 * 1000);
  }, snapshotMs);
  console.log(`[recap] midnight snapshot scheduled in ${Math.round(snapshotMs / 60000)} min`);

  const recapMs = msUntilEstHour(6);
  setTimeout(async () => {
    await runDailyRecap(client);
    setInterval(() => runDailyRecap(client), 24 * 60 * 60 * 1000);
  }, recapMs);
  console.log(`[recap] 6am recap scheduled in ${Math.round(recapMs / 60000)} min`);
}

module.exports = {
  runDailyRecap,
  captureMidnightSnapshot,
  scheduleRecap,
};
