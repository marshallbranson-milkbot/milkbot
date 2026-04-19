const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const VIDEO_W = 1080;
const VIDEO_H = 1920;
const FPS = 30;

const BG_DIR = path.join(__dirname, 'assets', 'backgrounds');
const FONTS_DIR = path.join(__dirname, 'assets', 'fonts');

// One word per caption — no way for text to visually overlap since only one word is on screen at a time.
function prepareWordCaptions(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const nextStart = i < words.length - 1 ? words[i + 1].start : (w.end + 0.2);
    out.push({
      word: w.word,
      start: w.start,
      end: Math.max(w.start + 0.05, nextStart - 0.01),
    });
  }
  return out;
}

function secondsToAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = Math.floor(s);
  const cs = Math.floor((s - ss) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAssText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

// Each word starts small and white, pops green + 110% in first 80ms. Rises slightly on entry.
function buildWordOverrides() {
  // Quick pop-in: scale 85 → 110 and color white → neon green in first 80ms.
  const popIn = `\\t(0,80,\\fscx110\\fscy110\\c&H00FF66&\\3c&H002211&)`;
  return `{\\fscx85\\fscy85\\c&HFFFFFF&\\3c&H000000&${popIn}}`;
}

function buildAss(captions, { introText, outroText, videoDuration }) {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${VIDEO_W}`,
    `PlayResY: ${VIDEO_H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Caption: huge bold white Anton, thick black stroke + shadow. Centered mid-screen.
    'Style: Caption,Anton,150,&H00FFFFFF,&H000000FF,&H00000000,&HAA000000,1,0,0,0,100,100,3,0,1,12,6,5,120,120,0,1',
    // Banner: bold black text in Anton (condensed TikTok-style), sits on top of a white drawbox.
    'Style: Banner,Anton,82,&H00000000,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,3,0,1,0,0,8,80,80,200,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const override = buildWordOverrides();
  const lines = [];

  // Top banner: intro for first 2.5s, outro for last 2s. Fade in/out for polish.
  if (introText) {
    const introEnd = 2.5;
    lines.push(`Dialogue: 1,${secondsToAssTime(0)},${secondsToAssTime(introEnd)},Banner,,0,0,0,,{\\fad(120,200)}${escapeAssText(introText)}`);
  }
  if (outroText && videoDuration > 2) {
    const outroStart = Math.max(0, videoDuration - 2);
    lines.push(`Dialogue: 1,${secondsToAssTime(outroStart)},${secondsToAssTime(videoDuration)},Banner,,0,0,0,,{\\fad(200,120)}${escapeAssText(outroText)}`);
  }

  for (const c of captions) {
    const text = escapeAssText(c.word.toUpperCase());
    lines.push(`Dialogue: 0,${secondsToAssTime(c.start)},${secondsToAssTime(c.end)},Caption,,0,0,0,,${override}${text}`);
  }
  return header + '\n' + lines.join('\n') + '\n';
}

function ffmpegEscapePath(p) {
  return p
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function pickBackgroundFile() {
  if (!fs.existsSync(BG_DIR)) return null;
  let files = fs.readdirSync(BG_DIR).filter(f => /\.(mp4|mov|webm|mkv|MP4|MOV)$/i.test(f));
  // Prefer user-provided clips; only fall back to pexels if nothing else exists.
  const userFiles = files.filter(f => !f.startsWith('pexels-'));
  if (userFiles.length > 0) files = userFiles;
  if (files.length === 0) return null;
  return path.join(BG_DIR, files[Math.floor(Math.random() * files.length)]);
}

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata?.format?.duration;
      if (typeof duration !== 'number') return reject(new Error('could not read duration'));
      resolve(duration);
    });
  });
}

// Plan a small number of longer cuts across the source. Skip the first 10% (loading/menu) and
// last 20% (scrolling to stop recording) — those regions usually contain non-gameplay content.
function planCuts(sourceDuration, targetDuration, cutCount = 3) {
  const safeStart = sourceDuration * 0.10;
  const safeEnd = sourceDuration * 0.80;
  const usable = Math.max(0, safeEnd - safeStart);

  if (usable <= targetDuration + 2) {
    return [{ start: safeStart, length: Math.min(usable, targetDuration) }];
  }
  const perCut = targetDuration / cutCount;
  const zoneWidth = usable / cutCount;
  const cuts = [];
  for (let i = 0; i < cutCount; i++) {
    const zoneStart = safeStart + i * zoneWidth;
    const zoneEnd = Math.max(zoneStart, safeStart + zoneWidth * (i + 1) - perCut);
    const start = zoneStart + Math.random() * Math.max(0, zoneEnd - zoneStart);
    cuts.push({ start: Number(start.toFixed(2)), length: Number(perCut.toFixed(2)) });
  }
  return cuts;
}

function buildCardAss(text) {
  const safeText = escapeAssText(String(text).toUpperCase());
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${VIDEO_W}`,
    `PlayResY: ${VIDEO_H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Huge black bold text, centered, no outline (clean on white bg).
    'Style: Card,DejaVu Sans,160,&H00000000,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,4,0,1,0,0,5,100,100,0,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,0:00:00.00,0:00:10.00,Card,,0,0,0,,${safeText}`,
  ].join('\n') + '\n';
}

async function renderCard(text, duration, outputPath, assPath) {
  const assContent = buildCardAss(text);
  fs.writeFileSync(assPath, assContent, 'utf8');
  const escapedAss = ffmpegEscapePath(assPath);

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=white:s=${VIDEO_W}x${VIDEO_H}:r=${FPS}`)
      .inputOptions(['-f', 'lavfi', '-t', duration.toFixed(2)])
      .input('anullsrc=r=44100:cl=stereo')
      .inputOptions(['-f', 'lavfi', '-t', duration.toFixed(2)])
      .videoFilters([`subtitles='${escapedAss}':fontsdir='${ffmpegEscapePath(FONTS_DIR)}'`])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest',
      ])
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(outputPath);
  });
}

async function concatVideos(paths, outputPath) {
  // Use concat filter (not demuxer) — re-encodes so audio/video stream params are always compatible.
  await new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    paths.forEach(p => cmd.input(p));

    // concat filter expects inputs interleaved as [v0][a0][v1][a1]...[vN][aN]
    const segmentLabels = paths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join('');
    const filter = `${segmentLabels}concat=n=${paths.length}:v=1:a=1[vout][aout]`;

    cmd
      .complexFilter(filter)
      .outputOptions([
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ])
      .on('start', () => console.log('[render] ffmpeg start (concat)'))
      .on('stderr', line => { if (/error/i.test(line)) console.warn('[render]', line); })
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(outputPath);
  });
}

async function renderVideo({ audioPath, words, outputDir, introText, outroText }) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const captions = prepareWordCaptions(words);
  const finalPath = path.join(outputDir, 'recap.mp4');
  const duration = captions.length > 0 ? captions[captions.length - 1].end + 0.8 : 15;

  const assContent = buildAss(captions, { introText, outroText, videoDuration: duration });
  const assPath = path.join(outputDir, 'captions.ass');
  fs.writeFileSync(assPath, assContent, 'utf8');

  const escapedAss = ffmpegEscapePath(assPath);
  const bgFile = pickBackgroundFile();

  // Build a drawbox that shows a white "card" backing the banner text, visible only during intro/outro windows.
  // Box height scales with the number of wrapped lines in the text.
  const introEnd = 2.5;
  const outroStart = Math.max(0, duration - 2);
  const boxX = 140;
  const boxY = 180;
  const boxW = 800;

  function estimateLines(text, fontSize = 82, maxWidth = 740) {
    // Anton uppercase: avg glyph width ≈ 0.46 × fontSize
    const charsPerLine = Math.floor(maxWidth / (fontSize * 0.46));
    const words = String(text).trim().split(/\s+/);
    let lines = 1;
    let cur = 0;
    for (const w of words) {
      const addLen = cur === 0 ? w.length : w.length + 1;
      if (cur + addLen > charsPerLine && cur > 0) {
        lines++;
        cur = w.length;
      } else {
        cur += addLen;
      }
    }
    return lines;
  }
  function boxHeightFor(text) {
    const lines = estimateLines(text);
    // 82pt font ≈ 100px line-height, add 30px vertical padding.
    return Math.round(lines * 100 + 30);
  }

  const drawBoxFilters = [];
  if (introText) {
    const h = boxHeightFor(introText);
    drawBoxFilters.push(`drawbox=x=${boxX}:y=${boxY}:w=${boxW}:h=${h}:color=white:t=fill:enable='between(t,0,${introEnd})'`);
  }
  if (outroText) {
    const h = boxHeightFor(outroText);
    drawBoxFilters.push(`drawbox=x=${boxX}:y=${boxY}:w=${boxW}:h=${h}:color=white:t=fill:enable='between(t,${outroStart.toFixed(2)},${duration.toFixed(2)})'`);
  }
  const drawBoxFilter = drawBoxFilters.length > 0 ? drawBoxFilters.join(',') : null;

  // Plan cuts if we have a real background clip long enough to cut through.
  let cuts = null;
  if (bgFile) {
    try {
      const sourceDur = await probeDuration(bgFile);
      cuts = planCuts(sourceDur, duration, 3);
      console.log(`[render] background: ${path.basename(bgFile)} (${sourceDur.toFixed(1)}s) → ${cuts.length} cuts`);
    } catch (e) {
      console.warn('[render] probe failed, falling back to loop:', e.message);
      cuts = null;
    }
  }

  await new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    if (bgFile && cuts && cuts.length > 1) {
      // Add one input per cut, each seeking to start and limited to cut length.
      cuts.forEach(cut => {
        cmd.input(bgFile).inputOptions(['-ss', cut.start.toString(), '-t', cut.length.toString()]);
      });
      cmd.input(audioPath);

      const audioInputIdx = cuts.length; // audio is the last input
      const concatInputs = cuts.map((_, i) => `[${i}:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H},setsar=1[v${i}]`).join(';');
      const concatRefs = cuts.map((_, i) => `[v${i}]`).join('');
      const postBase = `eq=brightness=-0.18:saturation=1.15`;
      const postWithBox = drawBoxFilter ? `${postBase},${drawBoxFilter}` : postBase;
      const filterGraph = `${concatInputs};${concatRefs}concat=n=${cuts.length}:v=1:a=0[concat];[concat]${postWithBox},subtitles='${escapedAss}'[vout]`;

      cmd
        .complexFilter(filterGraph)
        .outputOptions([
          '-map', '[vout]',
          '-map', `${audioInputIdx}:a:0`,
        ]);
    } else if (bgFile) {
      // Short clip — just loop it.
      const loopFilters = [
        `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase`,
        `crop=${VIDEO_W}:${VIDEO_H}`,
        'eq=brightness=-0.18:saturation=1.15',
      ];
      if (drawBoxFilter) loopFilters.push(drawBoxFilter);
      loopFilters.push(`subtitles='${escapedAss}':fontsdir='${ffmpegEscapePath(FONTS_DIR)}'`);

      cmd
        .input(bgFile)
        .inputOptions(['-stream_loop', '-1', '-t', duration.toFixed(2)])
        .input(audioPath)
        .videoFilters(loopFilters)
        .outputOptions(['-map', '0:v:0', '-map', '1:a:0']);
    } else {
      console.log('[render] no backgrounds in assets/backgrounds/ — using animated gradient');
      const bgSource = `gradients=s=${VIDEO_W}x${VIDEO_H}:c0=0x1a0a2e:c1=0x0a1f3e:c2=0x1a0a1f:c3=0x0f1420:x0=0:y0=0:x1=${VIDEO_W}:y1=${VIDEO_H}:duration=8:speed=0.015:r=${FPS}`;
      cmd
        .input(bgSource)
        .inputOptions(['-f', 'lavfi', '-t', duration.toFixed(2)])
        .input(audioPath)
        .videoFilters([
          'noise=alls=8:allf=t',
          'vignette=angle=0.8',
          `subtitles='${escapedAss}':fontsdir='${ffmpegEscapePath(FONTS_DIR)}'`,
        ])
        .outputOptions(['-map', '0:v:0', '-map', '1:a:0']);
    }

    cmd
      .audioFilters([
        'dynaudnorm=f=150:g=15',
        'volume=1.5',
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest',
      ])
      .on('start', () => console.log('[render] ffmpeg start'))
      .on('stderr', line => {
        if (/error/i.test(line)) console.warn('[render]', line);
      })
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(finalPath);
  });

  return { outputPath: finalPath, duration, phraseCount: captions.length };
}

module.exports = { renderVideo, prepareWordCaptions };
