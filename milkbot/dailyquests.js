// Daily + Weekly quest system.
// Hooks into achievements.check() to track progress on player events.
// Awards milk bucks + XP automatically when a quest completes.

const fs = require('fs');
const path = require('path');

const questsPath = path.join(__dirname, 'data/daily_quests.json');
const balancesPath = path.join(__dirname, 'data/balances.json');
const xpPath = path.join(__dirname, 'data/xp.json');

// ── Quest templates ──────────────────────────────────────────────────────────
// event: the achievements.check() event name that increments progress
// condition(data): optional predicate that must pass for this increment to count

const DAILY = [
  { id: 'win_blackjack_3', event: 'bj_win', target: 3, bucks: 500, xp: 100, label: 'Win 3 blackjack games' },
  { id: 'win_blackjack_5', event: 'bj_win', target: 5, bucks: 900, xp: 200, label: 'Win 5 blackjack games' },
  { id: 'rob_success_1', event: 'rob_success', target: 1, bucks: 800, xp: 200, label: 'Successfully rob someone' },
  { id: 'rob_success_3', event: 'rob_success', target: 3, bucks: 1800, xp: 400, label: 'Successfully rob 3 people' },
  { id: 'buy_shop_item', event: 'shop_buy', target: 1, bucks: 500, xp: 100, label: 'Buy 1 shop item' },
  { id: 'buy_shop_uncommon', event: 'shop_buy', target: 1, bucks: 900, xp: 200, label: 'Buy 1 Uncommon+ shop item',
    condition: (data) => data?.tier && ['UNCOMMON', 'RARE', 'LEGENDARY'].includes(data.tier) },
  { id: 'survive_floor_5', event: 'dungeon_run_end', target: 1, bucks: 1500, xp: 300, label: 'Reach dungeon floor 5',
    condition: (data) => (data?.deepestFloor || 0) >= 5 },
  { id: 'clear_dungeon', event: 'dungeon_run_end', target: 1, bucks: 2000, xp: 500, label: 'Complete a dungeon run',
    condition: (data) => !!data?.completed },
  { id: 'attack_boss_3', event: 'raidboss_attack', target: 3, bucks: 700, xp: 150, label: 'Attack raid boss 3 times' },
  { id: 'attack_boss_5', event: 'raidboss_attack', target: 5, bucks: 1000, xp: 200, label: 'Attack raid boss 5 times' },
  { id: 'scramble_win_3', event: 'scramble_win', target: 3, bucks: 700, xp: 150, label: 'Win 3 scrambles' },
  { id: 'trivia_win_3', event: 'trivia_win', target: 3, bucks: 700, xp: 150, label: 'Win 3 trivia' },
  { id: 'geo_win_3', event: 'game_win', target: 3, bucks: 700, xp: 150, label: 'Win 3 geo rounds',
    condition: (data) => data?.gameType === 'geo' },
  { id: 'trade_made', event: 'trade_made', target: 1, bucks: 500, xp: 100, label: 'Make a stock trade' },
  { id: 'profit_sell', event: 'sell_result', target: 1, bucks: 1000, xp: 200, label: 'Sell a stock at profit',
    condition: (data) => (data?.profit || 0) > 0 },
  { id: 'hold_3_stocks', event: 'portfolio', target: 1, bucks: 900, xp: 200, label: 'Own 3+ stocks at once',
    condition: (data) => (data?.portfolioSize || 0) >= 3 },
  { id: 'streak_3', event: 'streak_hit', target: 1, bucks: 1200, xp: 250, label: 'Get a 3-win streak',
    condition: (data) => (data?.streak || 0) >= 3 },
  { id: 'streak_5', event: 'streak_hit', target: 1, bucks: 1800, xp: 400, label: 'Get a 5-win streak',
    condition: (data) => (data?.streak || 0) >= 5 },
  { id: 'crate_claim', event: 'crate_claim', target: 1, bucks: 500, xp: 100, label: 'Claim a crate drop' },
  { id: 'daily_claim', event: 'daily_claim', target: 1, bucks: 300, xp: 50, label: 'Claim your daily bonus' },
  { id: 'win_slots_jackpot', event: 'slots_jackpot', target: 1, bucks: 2000, xp: 400, label: 'Hit a slots jackpot' },
  { id: 'plinko_5', event: 'plinko_play', target: 5, bucks: 600, xp: 120, label: 'Play plinko 5 times' },
  { id: 'give_once', event: 'give_sent', target: 1, bucks: 400, xp: 80, label: 'Give milk bucks to a friend' },
  { id: 'survive_event', event: 'dungeon_event_resolved', target: 1, bucks: 800, xp: 150, label: 'Survive a dungeon event' },
];

const WEEKLY = [
  { id: 'complete_dungeon_run', event: 'dungeon_run_end', target: 1, bucks: 6000, xp: 1500, label: 'Complete a full dungeon run',
    condition: (data) => !!data?.completed },
  { id: 'beat_curdfather', event: 'dungeon_curdfather_kill', target: 1, bucks: 10000, xp: 2500, label: 'Defeat the Curdfather' },
  { id: 'beat_udder_god', event: 'dungeon_uddergod_kill', target: 1, bucks: 12000, xp: 3000, label: 'Defeat the Udder God' },
  { id: 'hardcore_clear', event: 'dungeon_run_end', target: 1, bucks: 15000, xp: 3500, label: 'Complete a hardcore dungeon run',
    condition: (data) => !!data?.completed && data?.difficulty === 'hardcore' },
  { id: 'win_25_casino', event: 'casino_win', target: 25, bucks: 5000, xp: 1000, label: 'Win 25 casino games' },
  { id: 'streak_10', event: 'streak_hit', target: 1, bucks: 8000, xp: 1800, label: 'Hit a 10-win streak',
    condition: (data) => (data?.streak || 0) >= 10 },
  { id: 'earn_50k', event: 'earnings', target: 50000, bucks: 5000, xp: 1200, label: 'Earn 50,000 milk bucks this week' },
  { id: 'rob_5_success', event: 'rob_success', target: 5, bucks: 4000, xp: 800, label: 'Successfully rob 5 times' },
  { id: 'buy_rare', event: 'shop_buy', target: 1, bucks: 5000, xp: 1200, label: 'Buy a Rare or Legendary shop item',
    condition: (data) => data?.tier && ['RARE', 'LEGENDARY'].includes(data.tier) },
  { id: 'trade_100_shares', event: 'trade_shares', target: 100, bucks: 4000, xp: 800, label: 'Buy or sell 100 total shares' },
  { id: 'attack_boss_30', event: 'raidboss_attack', target: 30, bucks: 6000, xp: 1200, label: 'Attack raid boss 30 times' },
  { id: 'daily_streak_7', event: 'daily_streak', target: 1, bucks: 8000, xp: 2000, label: 'Claim daily 7 days in a row',
    condition: (data) => (data?.dailyStreak || 0) >= 7 },
];

// ── Date helpers (EST) ───────────────────────────────────────────────────────

function estDateString(d = new Date()) {
  const [m, day, y] = d.toLocaleString('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/');
  return `${y}-${m}-${day}`;
}

// Monday of the current week in EST, as YYYY-MM-DD
function estWeekStart(d = new Date()) {
  const estStr = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const est = new Date(estStr);
  const day = est.getDay(); // 0=Sun .. 6=Sat
  const diffToMon = (day + 6) % 7;
  est.setDate(est.getDate() - diffToMon);
  return estDateString(est);
}

// ── Data I/O ─────────────────────────────────────────────────────────────────

function readAll() {
  if (!fs.existsSync(questsPath)) return {};
  try { return JSON.parse(fs.readFileSync(questsPath, 'utf8')); } catch { return {}; }
}
function saveAll(data) {
  const tmp = questsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, questsPath);
}
function readBalances() {
  try { return JSON.parse(fs.readFileSync(balancesPath, 'utf8')); } catch { return {}; }
}
function saveBalances(d) {
  const tmp = balancesPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, balancesPath);
}
function readXp() {
  try { return JSON.parse(fs.readFileSync(xpPath, 'utf8')); } catch { return {}; }
}
function saveXp(d) {
  const tmp = xpPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, xpPath);
}

// ── Picker ───────────────────────────────────────────────────────────────────

function pickRandomN(pool, n) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateDaily() {
  return pickRandomN(DAILY, 3).map(t => ({
    id: t.id, label: t.label, target: t.target, bucks: t.bucks, xp: t.xp,
    progress: 0, claimed: false,
  }));
}
function generateWeekly() {
  return pickRandomN(WEEKLY, 2).map(t => ({
    id: t.id, label: t.label, target: t.target, bucks: t.bucks, xp: t.xp,
    progress: 0, claimed: false,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

// Lazy getter — if user's quests are stale (old date/week), regenerate.
function getUserQuests(userId) {
  const all = readAll();
  const today = estDateString();
  const weekStart = estWeekStart();
  if (!all[userId]) all[userId] = { date: null, quests: [], weekStart: null, weeklies: [] };
  const u = all[userId];
  let changed = false;
  if (u.date !== today) { u.date = today; u.quests = generateDaily(); changed = true; }
  if (u.weekStart !== weekStart) { u.weekStart = weekStart; u.weeklies = generateWeekly(); changed = true; }
  if (changed) { all[userId] = u; saveAll(all); }
  return { daily: u.quests, weekly: u.weeklies };
}

// Record an event — increments matching quest progress + auto-pays completions.
function recordEvent(userId, username, event, data = {}, channel = null) {
  const all = readAll();
  const today = estDateString();
  const weekStart = estWeekStart();
  if (!all[userId]) all[userId] = { date: today, quests: generateDaily(), weekStart, weeklies: generateWeekly() };
  const u = all[userId];
  if (u.date !== today) { u.date = today; u.quests = generateDaily(); }
  if (u.weekStart !== weekStart) { u.weekStart = weekStart; u.weeklies = generateWeekly(); }

  const completions = [];
  const process = (questList, templatePool) => {
    for (const q of questList) {
      if (q.claimed) continue;
      const template = templatePool.find(t => t.id === q.id);
      if (!template || template.event !== event) continue;
      if (template.condition && !template.condition(data)) continue;
      const inc = typeof data?.amount === 'number' ? data.amount : 1;
      q.progress = Math.min(q.target, q.progress + inc);
      if (q.progress >= q.target && !q.claimed) {
        q.claimed = true;
        completions.push({ template, quest: q });
      }
    }
  };
  process(u.quests, DAILY);
  process(u.weeklies, WEEKLY);

  all[userId] = u;
  saveAll(all);

  // Auto-pay completions
  if (completions.length > 0) {
    const bals = readBalances();
    const xps = readXp();
    let totalBucks = 0, totalXp = 0;
    const labels = [];
    for (const c of completions) {
      totalBucks += c.template.bucks;
      totalXp += c.template.xp;
      labels.push(`✅ **${c.template.label}** — +${c.template.bucks.toLocaleString()} 🥛 +${c.template.xp} XP`);
    }
    bals[userId] = Math.min(1_000_000_000, (bals[userId] || 0) + totalBucks);
    xps[userId] = (xps[userId] || 0) + totalXp;
    saveBalances(bals);
    saveXp(xps);

    if (channel && channel.send) {
      channel.send(`🎯 **Quest complete** — ${username}\n${labels.join('\n')}`).catch(() => {});
    }
  }

  return completions.length;
}

module.exports = { getUserQuests, recordEvent, DAILY, WEEKLY };
