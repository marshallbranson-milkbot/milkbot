require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { generateScript } = require('./script');
const { generateVoice } = require('./voice');
const { renderVideo } = require('./render');
const { ensureBackgroundPool } = require('./pexels');

const FAKE_ANALYSIS = {
  ok: true,
  todayDate: new Date().toISOString().slice(0, 10),
  yesterdayDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  eventCount: 4,
  topEvent: {
    type: 'massive_loss',
    dramaScore: 80,
    userId: '879171470700445747',
    username: 'Grinder',
    summary: 'Grinder lost 47,203 milk bucks overnight in the stock market',
    details: { from: 72540, to: 25337, delta: -47203, cause: 'SPOIL crashed 38%' },
  },
  allEvents: [],
  milkLord: { id: '646398669364527114', name: 'Cass', worth: 182400 },
};

async function main() {
  const outDir = path.join(__dirname, '..', 'data', 'recap-tmp', 'local-test');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing. Put it in milkbot/.env');
    process.exit(1);
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY missing. Put it in milkbot/.env');
    process.exit(1);
  }

  console.log('\n[1/3] Generating script with Claude...');
  const script = await generateScript(FAKE_ANALYSIS);
  console.log('  hook:', script.hook);
  console.log('  script:', script.script);
  console.log('  caption:', script.caption);
  console.log('  hashtags:', script.hashtags.join(' '));

  console.log('\n[2/3] Generating voice with ElevenLabs...');
  const voice = await generateVoice(script.script, outDir);
  console.log(`  audio: ${voice.audioPath}`);
  console.log(`  duration: ${voice.totalDuration.toFixed(2)}s (${voice.words.length} words)`);

  console.log('\n[3/3] Ensuring background pool is populated...');
  const bgs = await ensureBackgroundPool(5);
  console.log(`  ${bgs.length} background(s) available`);

  console.log('\n[4/4] Rendering video with ffmpeg...');
  const render = await renderVideo({
    audioPath: voice.audioPath,
    words: voice.words,
    outputDir: outDir,
    introText: script.introText,
    outroText: script.outroText,
  });
  console.log(`  video: ${render.outputPath}`);
  console.log(`  duration: ${render.duration.toFixed(2)}s, ${render.phraseCount} phrases`);

  console.log('\n✅ done. Open the MP4 to review:');
  console.log(`   ${render.outputPath}`);
}

main().catch(err => {
  console.error('\n❌ test failed:', err);
  process.exit(1);
});
