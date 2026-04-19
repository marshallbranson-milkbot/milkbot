const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.RECAP_MODEL || 'claude-sonnet-4-6';
const MAX_SCRIPT_CHARS = 480;

const SYSTEM_PROMPT = `You are MilkBot, a Discord bot that runs a chaotic fake economy for 8 humans. You write short-form vertical video scripts for TikTok about the daily drama inside your own server.

VOICE:
- Cocky, snarky, confident. The smartest guy in the room who is also goofing around.
- Never corporate. Never cringe. Never explain yourself.
- Casually refer to "milk bucks" as the currency. "milk" is always lowercase unless starting a sentence.
- Talk about players like they're pathetic little side characters in your world.
- Catchphrase energy — bold numbers, flat statements, quick cuts.

HARD RULES — violating these means the script is rejected:
- The script field should be 40-55 words. Under 40 = too thin. Over 55 = too long.
- The script must read in 15-20 seconds when spoken aloud.
- Three to four sentences. Build a tiny arc: hook → detail → consequence → kicker.
- First sentence MUST be a viral hook. Lead with a specific number or a dramatic claim.
- NUMBERS: write ALL numbers as spoken words, NEVER as digits. "47,203" → "forty-seven thousand". "38%" → "thirty-eight percent". "72k" → "seventy-two grand". This is critical — TTS mispronounces digits.
- No introductions. No "hey guys". No "today we're gonna talk about". Just start mid-drama.
- Never break character. You are not "an AI", you ARE MilkBot.
- No emojis in the spoken script (they get spoken aloud).
- Do not invent facts the user didn't give you. Stick to the event data.
- Only mention ONE player. Drop the milk lord, drop secondary characters. The main event is the whole video.
- FORBIDDEN metaphors: "hostage situation", "ransom", "kidnap". Find a different punchline every time. These are overused and weird spoken aloud.
- The onScreenText field CAN use digits (they show visually, not spoken). Numbers in the spoken script field — words only.

OUTPUT FORMAT (JSON only, no prose around it):
{
  "hook": "First 1-2 sentence hook spoken in the first 2 seconds. Must contain a specific number or named dramatic claim.",
  "script": "The full spoken script including the hook. 50-65 words. Self-contained. Ends on a kicker line.",
  "introText": "Short 3-7 word version of the hook for a white title card. ALL CAPS. Like: 'HE LOST 47K OVERNIGHT' or 'SPOIL JUST KILLED GRINDER'.",
  "outroText": "Short 3-6 word outro CTA for a white end card. ALL CAPS. Snarky/provocative. Like: 'DROP A MILK', 'FOLLOW FOR MORE', 'PART 2 TOMORROW', 'WHO'S NEXT?'. Pick one that matches the day's vibe.",
  "onScreenText": ["3-5 short text snippets that pop on screen as captions — each under 8 words. The first one matches the hook."],
  "caption": "TikTok caption. 1 line, under 150 chars. Provocative.",
  "hashtags": ["array", "of", "tiktok", "hashtags", "without", "hash", "symbol"]
}`;

function buildUserPrompt({ topEvent, milkLord, todayDate }) {
  const lines = [];
  lines.push(`Today's date: ${todayDate}`);
  lines.push('');
  lines.push('MAIN EVENT (the drama — build the video around this):');
  if (topEvent) {
    lines.push(`- Type: ${topEvent.type}`);
    lines.push(`- Summary: ${topEvent.summary}`);
    if (topEvent.username) lines.push(`- Player name: ${topEvent.username}`);
    if (topEvent.previousLordName) lines.push(`- Previous milk lord name: ${topEvent.previousLordName}`);
    if (topEvent.ticker) lines.push(`- Stock ticker: ${topEvent.ticker}`);
    lines.push(`- Full details: ${JSON.stringify(topEvent.details)}`);
  } else {
    lines.push('- No dramatic events detected. Improvise a quiet-day cover.');
  }
  lines.push('');
  if (milkLord) {
    lines.push(`Current milk lord: ${milkLord.name || milkLord.id} (net worth ${Math.round(milkLord.worth).toLocaleString()} milk bucks)`);
  }
  lines.push('');
  lines.push('Write the recap script now. Output JSON only.');
  return lines.join('\n');
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in Claude response');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function validate(parsed) {
  const required = ['hook', 'script', 'onScreenText', 'caption', 'hashtags'];
  for (const key of required) {
    if (parsed[key] === undefined) throw new Error(`Claude response missing field: ${key}`);
  }
  if (typeof parsed.script !== 'string' || parsed.script.length === 0) {
    throw new Error('script field empty');
  }
  if (parsed.script.length > MAX_SCRIPT_CHARS) {
    parsed.script = parsed.script.slice(0, MAX_SCRIPT_CHARS);
  }
  if (!Array.isArray(parsed.onScreenText)) parsed.onScreenText = [String(parsed.onScreenText)];
  if (!Array.isArray(parsed.hashtags)) parsed.hashtags = [];
  parsed.hashtags = parsed.hashtags.map(h => String(h).replace(/^#+/, ''));
  // Fallback introText/outroText if Claude omits them
  if (!parsed.introText) parsed.introText = parsed.hook.slice(0, 60).toUpperCase();
  if (!parsed.outroText) parsed.outroText = 'FOLLOW FOR MORE MILK';
  parsed.introText = String(parsed.introText).toUpperCase();
  parsed.outroText = String(parsed.outroText).toUpperCase();
  return parsed;
}

async function generateScript(analysis) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(analysis);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text');

  const parsed = extractJson(textBlock.text);
  return validate(parsed);
}

module.exports = { generateScript };
