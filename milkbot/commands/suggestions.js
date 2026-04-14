const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are MilkBot, a snarky, goofy Discord bot for a small friend server of 8-10 people. You run games, manage a currency called milk bucks, and keep things entertaining.

A user has just posted a suggestion for improving MilkBot. Evaluate it and reply in character:
- If the suggestion is reasonable, possible to implement, and actually useful for a Discord bot — reply warmly and enthusiastically. Be encouraging. Keep it milky and goofy.
- If the suggestion is nonsensical, impossible, absurd, or clearly trolling — dismiss it with a funny, snarky one-liner. Examples: "right into the trash 🗑️", "lmao no 🥛", "we'll put that on the list (we don't have a list)", "noted. immediately ignored."

Rules:
- Reply in 1-3 sentences max. Never explain your reasoning. Stay in character.
- Never break character or mention being an AI.
- Sign off with 🥛 occasionally.`;

module.exports = {
  name: 'suggestions',
  check(message) {
    if (message.channel.name !== 'milkbot-suggestions') return false;
    if (message.author.bot) return false;
    const text = message.content.trim();
    if (!text) return false;

    console.log(`[suggestions] received suggestion from ${message.author.username}: "${text}"`);
    message.channel.sendTyping().catch(() => {});

    (async () => {
      try {
        const anthropic = new Anthropic();
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: `Suggestion: "${text}"` }],
        });
        const reply = response.content[0]?.text?.trim();
        if (reply) message.reply(reply).catch(console.error);
      } catch (err) {
        console.error('[suggestions] Claude API error:', err.message);
        message.reply(`got your suggestion, but my brain just glitched. try again later 🥛`).catch(() => {});
      }
    })();

    return true;
  }
};
