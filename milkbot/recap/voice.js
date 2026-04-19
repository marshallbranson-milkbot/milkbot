const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegStatic);

const DEFAULT_VOICE_ID = '248nvfaZe8BXhKntjmpp';
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';
const SPEED_FACTOR = Number(process.env.RECAP_VOICE_SPEED) || 1.22;

function charsToWords(alignment) {
  if (!alignment || !Array.isArray(alignment.characters)) return [];
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];

  const words = [];
  let current = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      if (current) { words.push(current); current = null; }
      continue;
    }
    if (!current) {
      current = { word: '', start: starts[i] ?? 0, end: ends[i] ?? 0 };
    }
    current.word += ch;
    current.end = ends[i] ?? current.end;
  }
  if (current) words.push(current);
  return words;
}

async function generateVoice(scriptText, outputDir) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const voiceId = process.env.MILKBOT_VOICE_ID || DEFAULT_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`;

  const body = {
    text: scriptText,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.35,
      similarity_boost: 0.85,
      style: 0.75,
      use_speaker_boost: true,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ElevenLabs ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.audio_base64) throw new Error('ElevenLabs returned no audio_base64');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const rawAudioPath = path.join(outputDir, 'voice-raw.mp3');
  fs.writeFileSync(rawAudioPath, Buffer.from(data.audio_base64, 'base64'));

  const rawWords = charsToWords(data.alignment);
  const audioPath = path.join(outputDir, 'voice.mp3');

  // Speed up audio by SPEED_FACTOR, scale word timestamps by 1/SPEED_FACTOR to keep captions in sync.
  await new Promise((resolve, reject) => {
    ffmpeg(rawAudioPath)
      .audioFilters(`atempo=${SPEED_FACTOR.toFixed(3)}`)
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '192k'])
      .on('end', resolve)
      .on('error', reject)
      .save(audioPath);
  });
  try { fs.unlinkSync(rawAudioPath); } catch {}

  const words = rawWords.map(w => ({
    word: w.word,
    start: w.start / SPEED_FACTOR,
    end: w.end / SPEED_FACTOR,
  }));
  const totalDuration = words.length > 0 ? words[words.length - 1].end : 0;

  return {
    audioPath,
    words,
    totalDuration,
    alignment: data.alignment,
  };
}

module.exports = { generateVoice };
