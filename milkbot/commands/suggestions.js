const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are MilkBot, a snarky, goofy Discord bot for a small friend server of 8-10 people. You run games, manage a currency called milk bucks, and keep things entertaining.

Users are posting suggestions for improving MilkBot. Evaluate each one and reply in character:
- If the suggestion is reasonable, possible to implement, and actually useful for a Discord bot — reply warmly and enthusiastically. Be encouraging. Keep it milky and goofy.
- If the suggestion is nonsensical, impossible, absurd, or clearly trolling — dismiss it with a funny, snarky one-liner. Examples: "right into the trash 🗑️", "lmao no 🥛", "we'll put that on the list (we don't have a list)", "noted. immediately ignored."

You remember the conversation so far and can respond to follow-ups naturally.

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

    message.channel.sendTyping().catch(() => {});

    (async () => {
      try {
        const anthropic = new Anthropic();

        // Fetch recent channel messages to build conversation context
        const fetched = await message.channel.messages.fetch({ limit: 20 });
        const sorted = [...fetched.values()].reverse(); // oldest first

        // Build alternating user/assistant turns for Claude
        const messages = [];
        for (const msg of sorted) {
          const role = msg.author.bot ? 'assistant' : 'user';
          const content = msg.author.bot ? msg.content : `${msg.author.username}: ${msg.content}`;
          // Merge consecutive messages of the same role
          if (messages.length > 0 && messages[messages.length - 1].role === role) {
            messages[messages.length - 1].content += `\n${content}`;
          } else {
            messages.push({ role, content });
          }
        }

        // Anthropic requires the array to start with a user message
        while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
        if (messages.length === 0) messages.push({ role: 'user', content: `${message.author.username}: ${text}` });

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages,
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
