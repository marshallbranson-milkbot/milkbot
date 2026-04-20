// MilkBot personality module — returns snarky variant strings keyed by situation.
// Each kind has 3-5 variants. Random pick per call so players don't see the same line twice in a row.

// Sanitize any user-supplied text that lands in a personality line so a
// weird display name can't inject markdown (`**`, `__`, ``` ` ```, links) or
// mass-mentions (@everyone / @here) into messages the bot sends.
function sanitize(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[*_~`|\\]/g, '')
    .replace(/@(everyone|here)/gi, '$1')
    .replace(/<@[!&]?\d+>/g, '')
    .slice(0, 32)
    .trim() || '';
}

const LINES = {
  daily_cooldown: [
    (ctx) => `slow down. the milk still has ${ctx.hours}h ${ctx.minutes}m to ferment. 🥛`,
    (ctx) => `you already drank today. come back in **${ctx.hours}h ${ctx.minutes}m**. nobody respects a double-dipper. 🥛`,
    (ctx) => `the udder needs ${ctx.hours}h ${ctx.minutes}m to refill. patience, dairy fiend. 🥛`,
  ],
  broke: [
    () => `you're broke. stare at your wallet harder — it won't help. 🥛`,
    () => `insufficient milk bucks. maybe try winning something first? 🥛`,
    () => `you have nothing. literally zero. this is a dairy emergency. 🥛`,
    () => `your balance called. it's crying. 🥛`,
  ],
  not_enough: [
    (ctx) => `you need **${ctx.need}** milk bucks. you have **${ctx.have}**. math ain't mathing. 🥛`,
    (ctx) => `${ctx.need} 🥛 required. you brought ${ctx.have}. embarrassing. 🥛`,
    (ctx) => `short by **${ctx.need - ctx.have}**. go earn it. 🥛`,
  ],
  rob_cooldown: [
    (ctx) => `you're laying low. **${ctx.hours}h ${ctx.minutes}m** until the heat dies down. 🥛`,
    (ctx) => `the cops are still looking for you. come back in **${ctx.hours}h ${ctx.minutes}m**. 🥛`,
    (ctx) => `you're on the lam. ${ctx.hours}h ${ctx.minutes}m until you can scheme again. 🥛`,
  ],
  dont_own_ticker: [
    (ctx) => `you don't own any **${ctx.ticker}**. can't sell what you don't have. 🥛`,
    (ctx) => `zero **${ctx.ticker}** in your portfolio. try \`/b ${ctx.ticker}\` first. 🥛`,
    (ctx) => `**${ctx.ticker}**? you've never bought a single share. 🥛`,
  ],
  already_in_run: [
    () => `you're already in a run, chief. finish what you started. 🥛`,
    () => `one run at a time. this isn't speedrun season. 🥛`,
    () => `already descending. come back when you're done or dead. 🥛`,
  ],
  invalid_input: [
    () => `that's not a number. try again with fewer words. 🥛`,
    () => `invalid. read the command again. 🥛`,
    () => `no. 🥛`,
  ],
  target_is_bot: [
    () => `bots don't have milk bucks. they have cold, hard silicon. 🥛`,
    () => `you can't milk a bot. we just don't produce. 🥛`,
    () => `i'm a bot. i don't carry cash. 🥛`,
  ],
  target_is_self: [
    () => `you can't do that to yourself. we all know. 🥛`,
    () => `self-targeting. bold strategy. also illegal. 🥛`,
    () => `no. you can't do that to yourself. 🥛`,
  ],
  broke_target: [
    (ctx) => `${ctx.username} is broke. leave them some dignity. 🥛`,
    (ctx) => `${ctx.username} has nothing to steal. move on. 🥛`,
    (ctx) => `${ctx.username}'s pockets are empty. have some shame. 🥛`,
  ],
  already_in_tournament: [
    () => `you're already in the tournament. patience. 🥛`,
    () => `one blackjack table at a time. 🥛`,
    () => `you already signed up. hold your horses. 🥛`,
  ],
  game_crashed: [
    () => `something broke. blame the intern. try again. 🥛`,
    () => `the milk soured on that one. try again. 🥛`,
    () => `error. the dairy gods are displeased. try again. 🥛`,
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function say(kind, ctx = {}) {
  const pool = LINES[kind];
  if (!pool) return '🥛';
  const fn = pick(pool);
  // Sanitize any string fields in ctx before interpolation.
  const safe = {};
  for (const k of Object.keys(ctx)) {
    safe[k] = typeof ctx[k] === 'string' ? sanitize(ctx[k]) : ctx[k];
  }
  return fn(safe);
}

module.exports = { say };
