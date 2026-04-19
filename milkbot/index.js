require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { updatePrices } = require('./stockdata');
const { initDisplays, refreshLeaderboard, refreshStockBoard, initShopDisplay, refreshShopBoard } = require('./display');
const { scheduleNews, initMooNewsMessage } = require('./moosnews');
const { postUpdates } = require('./updates');

const GUILD_ID        = '562076997979865118';
const STOCKS_COMMANDS = new Set(['b', 'buy', 's', 'sell', 'ba', 'buyall']);
const BOTH_CHANNELS   = new Set(['h', 'bal', 'port', 'portfolio']);
// Commands allowed as text in milkbot-games (everything else → use !g)
const GAMES_MENU_PASSTHROUGH = new Set(['g', 'a', 'd', 'j']);

  // Ensure data directory exists (important for Railway volume on first run)
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  const TOKEN = process.env.TOKEN;
  const PREFIX = '!';

  // Load all commands
  const commands = {};
  const gameChecks = [];
  const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

  let milkLordCommand = null;
  let blackjackCommand = null;
  let portfolioCommand = null;
  let helpCommand = null;
  let gCommand = null;
  let shopCommand = null;
  let inventoryCommand = null;
  const initCallbacks = [];

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands[command.name] = command;
    if (command.aliases) {
      command.aliases.forEach(alias => commands[alias] = command);
    }
    if (command.check) {
      gameChecks.push(command.check);
    }
    if (command.init) {
      initCallbacks.push(command.init);
    }
    if (command.name === 'milklord') milkLordCommand = command;
    if (command.name === 'bl') blackjackCommand = command;
    if (command.name === 'port') portfolioCommand = command;
    if (command.name === 'h') helpCommand = command;
    if (command.name === 'g') gCommand = command;
    if (command.name === 'shop') shopCommand = command;
    if (command.name === 'inv') inventoryCommand = command;
  }

  // Listen for messages
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (!message.content.startsWith(PREFIX)) {
      for (const check of gameChecks) {
        if (check(message)) return;
      }
      return;
    }

    // All ! commands are retired — redirect to slash commands
    message.delete().catch(() => {});
    const channelName = message.channel.name;
    if (channelName === 'milkbot-games' || channelName === 'milkbot-stocks') {
      message.channel.send(`use \`/g\` for games or \`/\` for everything else 🥛`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(err => console.warn('[index] channel send failed:', err.message));
    }
  });

  // Handle button and select menu interactions
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('bj_') && blackjackCommand) {
        blackjackCommand.handleInteraction(interaction).catch(console.error);
      } else if (
        interaction.customId.startsWith('port_buyall_') ||
        interaction.customId.startsWith('port_sellall_') ||
        interaction.customId.startsWith('port_buyamt_') ||
        interaction.customId.startsWith('port_sellamt_')
      ) {
        if (portfolioCommand) portfolioCommand.handleButtonInteraction(interaction).catch(console.error);
      } else if (interaction.customId === 'milkbot_optin') {
        require('./commands/milkbotaccess').handleInteraction(interaction).catch(console.error);
      } else if (interaction.customId === 'rb_attack') {
        const rbCommand = commands['rb'];
        if (rbCommand) rbCommand.handleInteraction(interaction).catch(console.error);
      } else if (interaction.customId.startsWith('g_') && gCommand) {
        gCommand.handleButtonInteraction(interaction).catch(console.error);
      } else if ((interaction.customId.startsWith('shop_') || interaction.customId === 'shop_browse' || interaction.customId === 'shop_inv') && shopCommand) {
        shopCommand.handleButtonInteraction(interaction).catch(console.error);
      } else if (interaction.customId.startsWith('inv_') && inventoryCommand) {
        inventoryCommand.handleButtonInteraction(interaction).catch(console.error);
      }
    } else if (interaction.isChatInputCommand()) {
      const cmdName = interaction.commandName;

      // /g — ephemeral menu (special path)
      if (cmdName === 'g' && gCommand) {
        gCommand.executeSlash(interaction).catch(console.error);
        return;
      }

      // /h — ephemeral help (special path)
      if (cmdName === 'h' && helpCommand) {
        helpCommand.executeSlash(interaction).catch(console.error);
        return;
      }

      // /shop and /inv — ephemeral, no channel restriction
      if (cmdName === 'shop' && shopCommand) {
        shopCommand.executeSlash(interaction).catch(console.error);
        return;
      }
      if (cmdName === 'inv' && inventoryCommand) {
        inventoryCommand.executeSlash(interaction).catch(console.error);
        return;
      }

      // /port — ephemeral direct handler (bypass slash bridge to avoid timeout)
      if (cmdName === 'port' && portfolioCommand) {
        portfolioCommand.executeSlash(interaction).catch(console.error);
        return;
      }

      // Channel routing (mirrors prefix command rules)
      const channelName = interaction.channel?.name;
      if (STOCKS_COMMANDS.has(cmdName) && channelName !== 'milkbot-stocks') {
        interaction.reply({ content: '📈 stock commands go in **#milkbot-stocks** 🥛', ephemeral: true }).catch(err => console.warn('[index] reply failed:', err.message));
        return;
      }
      if (!STOCKS_COMMANDS.has(cmdName) && !BOTH_CHANNELS.has(cmdName) && channelName !== 'milkbot-games') {
        interaction.reply({ content: '🎮 game commands go in **#milkbot-games** 🥛', ephemeral: true }).catch(err => console.warn('[index] reply failed:', err.message));
        return;
      }

      // Find the command (check aliases too for /a /d /j)
      const cmd = commands[cmdName];
      if (!cmd) return;

      const { makeSlashBridge } = require('./slashbridge');
      // Pass !cmdName as content so commands that check message.content.startsWith('!a') etc. work
      const fakeMsg = makeSlashBridge(interaction, null, `!${cmdName}`);
      const args = buildSlashArgs(interaction, cmdName);
      cmd.execute(fakeMsg, args, client);

    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('port_select_') && portfolioCommand) {
        portfolioCommand.handleSelectMenu(interaction).catch(console.error);
      } else if (interaction.customId.startsWith('help_cat_') && helpCommand) {
        helpCommand.handleSelectMenu(interaction).catch(console.error);
      }
    }
  });

  client.once('ready', async () => {
    console.log(`MilkBot is online as ${client.user.tag}`);

    // ── Register slash commands (guild-scoped for instant updates) ────────────
    try {
      const rest = new REST().setToken(TOKEN);
      const seen = new Set();
      const slashDefs = [];

      for (const cmd of Object.values(commands)) {
        if (!cmd.slashOptions) continue;
        // Primary command
        if (!seen.has(cmd.name)) {
          seen.add(cmd.name);
          const b = new SlashCommandBuilder().setName(cmd.name).setDescription(cmd.description || cmd.name);
          for (const opt of cmd.slashOptions) {
            if (opt.type === 'INTEGER') b.addIntegerOption(o => o.setName(opt.name).setDescription(opt.description).setRequired(!!opt.required));
            else if (opt.type === 'STRING') b.addStringOption(o => o.setName(opt.name).setDescription(opt.description).setRequired(!!opt.required));
            else if (opt.type === 'USER')   b.addUserOption(o => o.setName(opt.name).setDescription(opt.description).setRequired(!!opt.required));
          }
          slashDefs.push(b.toJSON());
        }
        // Slash aliases (e.g. /a /d for coinflip, /j for raid)
        for (const alias of (cmd.slashAliases || [])) {
          if (!seen.has(alias)) {
            seen.add(alias);
            slashDefs.push(new SlashCommandBuilder().setName(alias).setDescription(cmd.description || alias).toJSON());
          }
        }
      }

      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: slashDefs });
      console.log(`[slash] registered ${slashDefs.length} slash commands`);
    } catch (err) {
      console.error('[slash] registration failed:', err.message);
    }

    // One-time player resets (v1)
    // 646425076748517386 → balance 0, portfolio cleared
    // 879171470700445747 → fresh prestige 2, balance 0, XP 0, portfolio cleared
    const playerResetFlagPath = path.join(__dirname, 'data/player_reset_v1_done.json');
    if (!fs.existsSync(playerResetFlagPath)) {
      const _balPath  = path.join(__dirname, 'data/balances.json');
      const _presPath = path.join(__dirname, 'data/prestige.json');
      const _xpPath   = path.join(__dirname, 'data/xp.json');
      const _portPath = path.join(__dirname, 'data/portfolios.json');
      const _achPath  = path.join(__dirname, 'data/achievements.json');

      let _bal = {}, _pres = {}, _xp = {};
      try { if (fs.existsSync(_balPath))  _bal  = JSON.parse(fs.readFileSync(_balPath,  'utf8')); } catch (e) { console.error('[reset] corrupted balances:', e.message); }
      try { if (fs.existsSync(_presPath)) _pres = JSON.parse(fs.readFileSync(_presPath, 'utf8')); } catch (e) { console.error('[reset] corrupted prestige:', e.message); }
      try { if (fs.existsSync(_xpPath))   _xp   = JSON.parse(fs.readFileSync(_xpPath,  'utf8')); } catch (e) { console.error('[reset] corrupted xp:', e.message); }

      // User A: wipe milk bucks + stocks
      _bal['646425076748517386'] = 0;

      // User B: fresh prestige 2
      _bal['879171470700445747']  = 0;
      _pres['879171470700445747'] = 2;
      _xp['879171470700445747']   = 0;

      fs.writeFileSync(_balPath,  JSON.stringify(_bal,  null, 2));
      fs.writeFileSync(_presPath, JSON.stringify(_pres, null, 2));
      fs.writeFileSync(_xpPath,   JSON.stringify(_xp,   null, 2));

      if (fs.existsSync(_portPath)) {
        let _port = {};
        try { _port = JSON.parse(fs.readFileSync(_portPath, 'utf8')); } catch (e) { console.error('[reset] corrupted portfolios:', e.message); }
        delete _port['646425076748517386'];
        delete _port['879171470700445747'];
        fs.writeFileSync(_portPath, JSON.stringify(_port, null, 2));
      }
      if (fs.existsSync(_achPath)) {
        let _ach = {};
        try { _ach = JSON.parse(fs.readFileSync(_achPath, 'utf8')); } catch (e) { console.error('[reset] corrupted ach:', e.message); }
        if (_ach['879171470700445747']) _ach['879171470700445747'].level = 1;
        fs.writeFileSync(_achPath, JSON.stringify(_ach, null, 2));
      }

      fs.writeFileSync(playerResetFlagPath, JSON.stringify({ done: true }));
      console.log('[reset] player_reset_v1 applied');
    }

    // One-time jackpot reset to 10,000
    const jackpotResetPath = path.join(__dirname, 'data/jackpot_reset_done.json');
    if (!fs.existsSync(jackpotResetPath)) {
      const jackpotFilePath = path.join(__dirname, 'data/jackpot.json');
      fs.writeFileSync(jackpotFilePath, JSON.stringify({ amount: 10000 }, null, 2));
      fs.writeFileSync(jackpotResetPath, JSON.stringify({ done: true }));
      console.log('[jackpot] reset to 10,000');
    }

    // Run any command module init functions (e.g. suggestions ban restoration)
    for (const initFn of initCallbacks) {
      await initFn(client).catch(console.error);
    }

    // Post/update help and leaderboard display messages
    await initDisplays(client);

    // Shop board — post/update in #milkbot-shop
    await initShopDisplay(client);
    scheduleShopReset(client);

    // One-time shop launch announcement
    const shopLaunchPath = path.join(__dirname, 'data/shop_launch_v1.json');
    if (!fs.existsSync(shopLaunchPath)) {
      fs.writeFileSync(shopLaunchPath, JSON.stringify({ done: true }));
      const _guild = client.guilds.cache.get(GUILD_ID);
      const _gCh = _guild?.channels.cache.find(c => c.name === 'updates');
      if (_gCh) {
        await _gCh.send(
          `🏪 **THE MILK MARKET IS NOW OPEN** 🏪\n\n` +
          `MilkBot just got a huge update. here's what dropped:\n\n` +
          `🛒 **#milkbot-shop** — 59 items across 4 tiers. common to legendary. use \`/shop\` or click the buttons in the shop channel to browse + buy.\n` +
          `⚡ **Shop buffs** — items boost your earnings, XP, jackpot odds, daily rewards, raid damage, and more. stack them. get disgusting.\n` +
          `🛡️ **Raid shields** — negate boss counter-attacks. never lose milk to the boss again (for a while).\n` +
          `☠️ **Boss nuke items** — deal instant server-wide HP damage. everyone benefits. the boss does not.\n` +
          `🎒 **\`/inv\`** — check your active buffs and use items from your stash.\n` +
          `⚔️ **Raid boss HP raised to 25,000** — the boss got bigger. good thing you have nukes.\n\n` +
          `*buffs stack additively. buy early, buy often. the dairy economy never sleeps. 🥛*`
        ).catch(console.error);
      }
    }

    // Initialize persistent Moo News message, then schedule daily drops
    await initMooNewsMessage(client);
    scheduleNews(client);
    postUpdates(client);
    require('./commands/milkbotaccess').postOptIn(client).catch(console.error);

    // Check Milk Lord every day at midnight
    scheduleMilkLord();

    // Raid boss — restore if bot restarted mid-day, then schedule nightly spawns
    const rbCommand = commands['rb'];
    if (rbCommand) {
      await rbCommand.restoreOnStartup(client).catch(console.error);
      scheduleRaidBoss(client);

      // One-time immediate spawn so the first boss doesn't wait until midnight
      const firstSpawnFlagPath = path.join(__dirname, 'data/raidboss_firstspawn_done.json');
      if (!fs.existsSync(firstSpawnFlagPath) && !state.activeRaidBoss) {
        fs.writeFileSync(firstSpawnFlagPath, JSON.stringify({ done: true }));
        await rbCommand.spawnBoss(client).catch(console.error);
      }

      // One-time force-respawn to load new Destiny boss roster
      const destinyRespawnPath = path.join(__dirname, 'data/raidboss_destiny_v1.json');
      if (!fs.existsSync(destinyRespawnPath)) {
        fs.writeFileSync(destinyRespawnPath, JSON.stringify({ done: true }));
        await rbCommand.spawnBoss(client).catch(console.error);
      }
    }

    // One-time grinder restoration to 50k after accidental repeat reset
    const grinderRestorePath = path.join(__dirname, 'data/grinder_restore_v1_done.json');
    if (!fs.existsSync(grinderRestorePath)) {
      const _balPath = path.join(__dirname, 'data/balances.json');
      let _bal = {};
      try { if (fs.existsSync(_balPath)) _bal = JSON.parse(fs.readFileSync(_balPath, 'utf8')); } catch (e) { console.error('[restore] corrupted balances:', e.message); }
      _bal['879171470700445747'] = 50000;
      fs.writeFileSync(_balPath, JSON.stringify(_bal, null, 2));
      fs.writeFileSync(grinderRestorePath, JSON.stringify({ done: true }));
      console.log('[restore] grinder_restore_v1 applied — 50k balance set');
    }

    // One-time: reset bigtrades leaderboard + set Grinder to level 40
    const lbResetV1Path = path.join(__dirname, 'data/lb_reset_v1_done.json');
    if (!fs.existsSync(lbResetV1Path)) {
      const _bigTradesPath = path.join(__dirname, 'data/bigtrades.json');
      fs.writeFileSync(_bigTradesPath, JSON.stringify({}, null, 2));
      const _xpPath = path.join(__dirname, 'data/xp.json');
      let _xp = {};
      try { if (fs.existsSync(_xpPath)) _xp = JSON.parse(fs.readFileSync(_xpPath, 'utf8')); } catch (e) { console.error('[reset] corrupted xp:', e.message); }
      _xp['879171470700445747'] = 78000;
      fs.writeFileSync(_xpPath, JSON.stringify(_xp, null, 2));
      fs.writeFileSync(lbResetV1Path, JSON.stringify({ done: true }));
      console.log('[reset] lb_reset_v1 applied — bigtrades cleared, Grinder set to level 40');
    }

    // One-time: correct Grinder XP to level 20
    const grinderXpV2Path = path.join(__dirname, 'data/grinder_xp_v2_done.json');
    if (!fs.existsSync(grinderXpV2Path)) {
      const _xpPath = path.join(__dirname, 'data/xp.json');
      let _xp = {};
      try { if (fs.existsSync(_xpPath)) _xp = JSON.parse(fs.readFileSync(_xpPath, 'utf8')); } catch (e) { console.error('[reset] corrupted xp:', e.message); }
      _xp['879171470700445747'] = 19000;
      fs.writeFileSync(_xpPath, JSON.stringify(_xp, null, 2));
      fs.writeFileSync(grinderXpV2Path, JSON.stringify({ done: true }));
      console.log('[reset] grinder_xp_v2 applied — Grinder set to level 20');
    }

    // Schedule random crate drops
    scheduleCrateDrops(client);

    // Update stock prices every 5 minutes then refresh the stock board
    setInterval(() => { updatePrices(); refreshStockBoard(client); }, 5 * 60 * 1000);

    // Refresh leaderboard every 5 minutes
    setInterval(() => refreshLeaderboard(client), 5 * 60 * 1000);

    // Check for double XP events every minute
    setInterval(() => {
      const estTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const hours = estTime.getHours();
      const minutes = estTime.getMinutes();

      if (minutes === 0 && (hours === 12 || hours === 20) && !state.doubleXp) {
        state.doubleXp = true;

        const guild = client.guilds.cache.get('562076997979865118');
        const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
        if (channel) {
          channel.send(`⚡ **DOUBLE XP HOUR HAS STARTED!** ⚡\nAll XP gains are doubled for the next hour. Get in there. 🥛`);
        }

        setTimeout(() => {
          state.doubleXp = false;
          if (channel) {
            channel.send(`⏰ Double XP hour is over. Back to normal. 🥛`);
          }
        }, 60 * 60 * 1000);
      }
    }, 60000);
  });

  function scheduleCrateDrops(client) {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msRemaining = midnight - now;

    const count = Math.floor(Math.random() * 3) + 3; // 3-5 drops
    for (let i = 0; i < count; i++) {
      const delay = Math.floor(Math.random() * msRemaining);
      setTimeout(() => dropCrate(client), delay);
    }

    // Reschedule for next day
    setTimeout(() => scheduleCrateDrops(client), msRemaining);
  }

  async function dropCrate(client) {
    if (state.activeCrate) return;

    const guild = client.guilds.cache.get('562076997979865118');
    const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
    if (!channel) return;

    const crateMsg = await channel.send(
      `📦 **A MILK CRATE JUST DROPPED!** 📦\n` +
      `Open \`/g\` → Wallet → **Claim Crate** to grab **500 milk bucks**! First one wins. You have 30 minutes. ⏳`
    ).catch(() => null);

    const expireTimeout = setTimeout(() => {
      if (state.activeCrate) {
        const msg = state.activeCrate.msg;
        state.activeCrate = null;
        if (msg) msg.delete().catch(() => {});
        channel.send(`📦 The milk crate expired unclaimed. Nobody wanted free milk bucks? 🥛`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 10000))
          .catch(() => {});
      }
    }, 30 * 60 * 1000);

    state.activeCrate = { expireTimeout, msg: crateMsg };
  }

  function scheduleMilkLord() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    setTimeout(() => {
      if (milkLordCommand) milkLordCommand.assignMilkLord(client);
      setInterval(() => {
        if (milkLordCommand) milkLordCommand.assignMilkLord(client);
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  function scheduleRaidBoss(client) {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const midnight = new Date(estNow);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - estNow;

    setTimeout(async () => {
      const rb = commands['rb'];
      if (rb) await rb.spawnBoss(client).catch(console.error);
      setInterval(async () => {
        if (rb) await rb.spawnBoss(client).catch(console.error);
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }


  function scheduleShopReset(client) {
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const midnight = new Date(estNow);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - estNow;

    setTimeout(async () => {
      const { regenerateSlots } = require('./shop');
      regenerateSlots();
      await refreshShopBoard(client).catch(console.error);
      setInterval(async () => {
        regenerateSlots();
        await refreshShopBoard(client).catch(console.error);
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    console.log(`[shop] reset scheduled in ${Math.ceil(msUntilMidnight / 60000)} min`);
  }

  // ── Slash command arg builder ──────────────────────────────────────────────
  // Maps slash interaction options to the string args[] array each execute() expects.
  function buildSlashArgs(interaction, cmdName) {
    const str  = (n) => interaction.options.getString(n)  ?? '';
    const int  = (n) => String(interaction.options.getInteger(n) ?? '');
    switch (cmdName) {
      case 'b':   return [str('ticker'), int('shares')];
      case 'ba':  return [str('ticker')];
      case 's':   return [str('ticker'), str('amount')];
      default:    return [];
    }
  }

  client.login(TOKEN);