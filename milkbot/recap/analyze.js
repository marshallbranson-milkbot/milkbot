const { loadLatestPair } = require('./snapshot');

function safeObj(v) { return (v && typeof v === 'object') ? v : {}; }

function userIds(today, yesterday) {
  const ids = new Set();
  for (const id of Object.keys(safeObj(today?.data?.balances))) ids.add(id);
  for (const id of Object.keys(safeObj(yesterday?.data?.balances))) ids.add(id);
  for (const id of Object.keys(safeObj(today?.data?.xp))) ids.add(id);
  return [...ids];
}

function balanceOf(snap, id) {
  return Number(safeObj(snap?.data?.balances)[id] ?? 0);
}

function xpOf(snap, id) {
  return Number(safeObj(snap?.data?.xp)[id] ?? 0);
}

function prestigeOf(snap, id) {
  return Number(safeObj(snap?.data?.prestige)[id] ?? 0);
}

function portfolioValue(snap, id) {
  const port = safeObj(snap?.data?.portfolios)[id];
  if (!port) return 0;
  const stocks = safeObj(snap?.data?.stocks);
  let total = 0;
  for (const [ticker, shares] of Object.entries(port)) {
    const stock = stocks[ticker];
    if (stock && typeof stock.price === 'number') {
      total += stock.price * Number(shares || 0);
    }
  }
  return total;
}

function netWorth(snap, id) {
  return balanceOf(snap, id) + portfolioValue(snap, id);
}

function findMilkLord(snap) {
  const ids = Object.keys(safeObj(snap?.data?.balances));
  let topId = null;
  let topWorth = -Infinity;
  for (const id of ids) {
    const worth = netWorth(snap, id);
    if (worth > topWorth) { topWorth = worth; topId = id; }
  }
  return topId ? { id: topId, worth: topWorth } : null;
}

function collectEvents(today, yesterday) {
  const events = [];
  const ids = userIds(today, yesterday);

  for (const id of ids) {
    const bYesterday = balanceOf(yesterday, id);
    const bToday = balanceOf(today, id);
    const bDelta = bToday - bYesterday;

    if (bYesterday >= 1000 && bToday === 0) {
      events.push({
        type: 'went_broke',
        dramaScore: 85,
        userId: id,
        summary: `user ${id} lost everything (${bYesterday.toLocaleString()} → 0 milk bucks)`,
        details: { from: bYesterday, to: 0 },
      });
    } else if (Math.abs(bDelta) >= 50000) {
      events.push({
        type: bDelta < 0 ? 'massive_loss' : 'massive_gain',
        dramaScore: 80,
        userId: id,
        summary: `user ${id} ${bDelta < 0 ? 'lost' : 'gained'} ${Math.abs(bDelta).toLocaleString()} milk bucks overnight`,
        details: { from: bYesterday, to: bToday, delta: bDelta },
      });
    } else if (Math.abs(bDelta) >= 10000) {
      events.push({
        type: bDelta < 0 ? 'big_loss' : 'big_gain',
        dramaScore: 55,
        userId: id,
        summary: `user ${id} ${bDelta < 0 ? 'lost' : 'gained'} ${Math.abs(bDelta).toLocaleString()} milk bucks`,
        details: { from: bYesterday, to: bToday, delta: bDelta },
      });
    }

    const pYesterday = prestigeOf(yesterday, id);
    const pToday = prestigeOf(today, id);
    if (pToday > pYesterday) {
      events.push({
        type: 'prestiged',
        dramaScore: 90,
        userId: id,
        summary: `user ${id} prestiged to P${pToday}`,
        details: { from: pYesterday, to: pToday },
      });
    }

    const xpYesterday = xpOf(yesterday, id);
    const xpToday = xpOf(today, id);
    const xpDelta = xpToday - xpYesterday;
    if (xpDelta >= 5000) {
      events.push({
        type: 'xp_grind',
        dramaScore: 35,
        userId: id,
        summary: `user ${id} grinded ${xpDelta.toLocaleString()} XP in one day`,
        details: { from: xpYesterday, to: xpToday, delta: xpDelta },
      });
    }
  }

  const stocksY = safeObj(yesterday?.data?.stocks);
  const stocksT = safeObj(today?.data?.stocks);
  for (const ticker of Object.keys(stocksT)) {
    const py = stocksY[ticker]?.price;
    const pt = stocksT[ticker]?.price;
    if (typeof py !== 'number' || typeof pt !== 'number' || py === 0) continue;
    const pct = ((pt - py) / py) * 100;
    if (Math.abs(pct) >= 20) {
      events.push({
        type: pct < 0 ? 'stock_crash' : 'stock_pump',
        dramaScore: 75,
        ticker,
        summary: `${ticker} ${pct < 0 ? 'crashed' : 'pumped'} ${Math.abs(pct).toFixed(1)}% (${py.toFixed(2)} → ${pt.toFixed(2)})`,
        details: { ticker, from: py, to: pt, pct },
      });
    } else if (Math.abs(pct) >= 10) {
      events.push({
        type: pct < 0 ? 'stock_drop' : 'stock_rise',
        dramaScore: 55,
        ticker,
        summary: `${ticker} ${pct < 0 ? 'dropped' : 'rose'} ${Math.abs(pct).toFixed(1)}%`,
        details: { ticker, from: py, to: pt, pct },
      });
    }
  }

  const lordY = findMilkLord(yesterday);
  const lordT = findMilkLord(today);
  if (lordT && lordY && lordT.id !== lordY.id) {
    events.push({
      type: 'new_milk_lord',
      dramaScore: 70,
      userId: lordT.id,
      previousLord: lordY.id,
      summary: `new milk lord: ${lordT.id} dethroned ${lordY.id} (${lordT.worth.toLocaleString()} net worth)`,
      details: { newLord: lordT, previousLord: lordY },
    });
  }

  const rbT = today?.data?.raidboss;
  const rbY = yesterday?.data?.raidboss;
  if (rbT && rbY) {
    const tDefeated = rbT.hp !== undefined && rbT.hp <= 0;
    const yDefeated = rbY.hp !== undefined && rbY.hp <= 0;
    if (tDefeated && !yDefeated) {
      events.push({
        type: 'raid_boss_defeated',
        dramaScore: 65,
        summary: `${rbT.name || 'the raid boss'} was defeated`,
        details: { boss: rbT.name, attackers: Object.keys(rbT.attacks || {}).length },
      });
    }
  }

  return events;
}

function pickTopEvent(events) {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => b.dramaScore - a.dramaScore)[0];
}

function sanitizeUsername(raw) {
  if (!raw) return null;
  // Strip control characters (newlines, tabs, zero-width) — prevents Claude-prompt injection.
  // Strip backticks/curly-braces — could confuse JSON parsing or ASS subtitle syntax downstream.
  // Cap length at 32 chars.
  return String(raw)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[`{}]/g, '')
    .slice(0, 32)
    .trim() || null;
}

function resolveUsername(client, userId) {
  if (!client || !userId) return null;
  try {
    const user = client.users?.cache?.get(userId);
    const raw = user ? (user.globalName || user.username) : null;
    return sanitizeUsername(raw);
  } catch {
    return null;
  }
}

async function analyzeRecap(client = null) {
  const { today, yesterday, todayDate, yesterdayDate } = loadLatestPair();
  if (!today) {
    return { ok: false, reason: 'no_today_snapshot', todayDate, yesterdayDate };
  }
  if (!yesterday) {
    return { ok: false, reason: 'no_yesterday_snapshot', todayDate, yesterdayDate };
  }

  const events = collectEvents(today, yesterday);
  const top = pickTopEvent(events);

  if (top && top.userId && client) {
    const name = resolveUsername(client, top.userId);
    if (name) top.username = name;
  }
  if (top && top.previousLord && client) {
    const name = resolveUsername(client, top.previousLord);
    if (name) top.previousLordName = name;
  }

  const milkLord = findMilkLord(today);
  if (milkLord && client) {
    milkLord.name = resolveUsername(client, milkLord.id);
  }

  return {
    ok: true,
    todayDate,
    yesterdayDate,
    eventCount: events.length,
    topEvent: top,
    allEvents: events,
    milkLord,
  };
}

module.exports = { analyzeRecap, collectEvents, pickTopEvent };
