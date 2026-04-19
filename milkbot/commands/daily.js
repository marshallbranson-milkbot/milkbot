const fs = require('fs');
  const path = require('path');

  const balancesPath = path.join(__dirname, '../data/balances.json');
  const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
  const ach = require('../achievements');

  function getData(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { console.error('[getData] corrupted:', filePath); return {}; }
  }

  function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
  const STREAK_EXPIRE = 48 * 60 * 60 * 1000; // 48 hours — miss this and streak resets

  function getPayoutAndMessage(streak) {
    if (streak >= 5) return { amount: 300, msg: `🔥 **Day ${streak} streak!** You're locked in. **300 milk bucks**. 🥛` };
    if (streak === 4) return { amount: 250, msg: `🔥 **Day 4 streak!** Keep it going. **250 milk bucks**. 🥛` };
    if (streak === 3) return { amount: 200, msg: `🔥 **Day 3 streak!** Nice consistency. **200 milk bucks**. 🥛` };
    if (streak === 2) return { amount: 150, msg: `🔥 **Day 2 streak!** Come back tomorrow for more. **150 milk bucks**. 🥛` };
    return { amount: 100, msg: `Here's your daily **100 milk bucks**. Don't spend it all in one place. 🥛` };
  }

  module.exports = {
    name: 'da',
    description: 'Claim your daily milk bucks. Streak bonuses for consecutive days.',
    execute(message) {
      const userId = message.author.id;
      const now = Date.now();

      const cooldowns = getData(cooldownsPath);
      const lastClaim = cooldowns[`daily_${userId}`] || 0;
      const timeLeft = COOLDOWN - (now - lastClaim);

      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        message.reply(`Slow down. You already got your milk today. Come back in **${hours}h ${minutes}m**. 🥛`).then(reply => {
          setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 8000);
        });
        return;
      }

      // Determine streak
      const streakBroken = lastClaim > 0 && (now - lastClaim) >= STREAK_EXPIRE;
      let streak = cooldowns[`streak_${userId}`] || 0;
      streak = streakBroken ? 1 : streak + 1;

      cooldowns[`daily_${userId}`] = now;
      cooldowns[`streak_${userId}`] = streak;
      saveData(cooldownsPath, cooldowns);

      const { amount: baseAmount, msg } = getPayoutAndMessage(streak);
      const shopMod = require('../shop');
      const dailyMul = shopMod.getDailyMul(userId);
      const amount = Math.floor(baseAmount * dailyMul);
      if (dailyMul > 1) shopMod.consumeDailyMul(userId);

      const balances = getData(balancesPath);
      balances[userId] = Math.min(1_000_000_000, (balances[userId] || 0) + amount);
      saveData(balancesPath, balances);

      const dailyMsg = dailyMul > 1 ? `${msg}\n🛒 *+${Math.round((dailyMul - 1) * 100)}% shop daily buff applied — you got ${amount.toLocaleString()} 🥛*` : msg;
      message.reply(dailyMsg).then(reply => {
        setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 8000);
      });
      const estHour = parseInt(new Date(now).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10) % 24;
      const isEarlyBird = estHour >= 6 && estHour < 9;
      const isNightOwl = estHour >= 0 && estHour < 3;
      ach.check(userId, message.author.username, 'daily_streak', { balance: balances[userId], dailyStreak: streak, isEarlyBird, isNightOwl }, message.channel);
    }
  };
