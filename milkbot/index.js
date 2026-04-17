require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { updatePrices, processDividends } = require('./stockdata');
const { initDisplays, refreshLeaderboard, refreshStockBoard } = require('./display');
const { scheduleNews, initMooNewsMessage } = require('./moosnews');
const { postUpdates } = require('./updates');

const GUILD_ID        = '562076997979865118';
const STOCKS_COMMANDS = new Set(['b', 'buy', 's', 'sell', 'port', 'portfolio', 'ba', 'buyall']);
const BOTH_CHANNELS   = new Set(['h', 'bal']);
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
        .catch(() => {});
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

      // Channel routing (mirrors prefix command rules)
      const channelName = interaction.channel?.name;
      if (STOCKS_COMMANDS.has(cmdName) && channelName !== 'milkbot-stocks') {
        interaction.reply({ content: '📈 stock commands go in **#milkbot-stocks** 🥛', ephemeral: true }).catch(() => {});
        return;
      }
      if (!STOCKS_COMMANDS.has(cmdName) && !BOTH_CHANNELS.has(cmdName) && channelName !== 'milkbot-games') {
        interaction.reply({ content: '🎮 game commands go in **#milkbot-games** 🥛', ephemeral: true }).catch(() => {});
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

      const _bal  = fs.existsSync(_balPath)  ? JSON.parse(fs.readFileSync(_balPath,  'utf8')) : {};
      const _pres = fs.existsSync(_presPath) ? JSON.parse(fs.readFileSync(_presPath, 'utf8')) : {};
      const _xp   = fs.existsSync(_xpPath)   ? JSON.parse(fs.readFileSync(_xpPath,   'utf8')) : {};

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
        const _port = JSON.parse(fs.readFileSync(_portPath, 'utf8'));
        delete _port['646425076748517386'];
        delete _port['879171470700445747'];
        fs.writeFileSync(_portPath, JSON.stringify(_port, null, 2));
      }
      if (fs.existsSync(_achPath)) {
        const _ach = JSON.parse(fs.readFileSync(_achPath, 'utf8'));
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

    // One-time grinder reset at 6 AM EST
    scheduleGrinderReset(client);

    // Schedule random crate drops
    scheduleCrateDrops(client);

    // Update stock prices every 5 minutes, pay dividends, then refresh the stock board
    setInterval(() => { updatePrices(); processDividends(); refreshStockBoard(client); }, 5 * 60 * 1000);

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

  function scheduleGrinderReset(client) {
    const GRINDER_ID = '879171470700445747';
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const target = new Date(estNow);
    target.setHours(6, 0, 0, 0);
    if (target <= estNow) target.setDate(target.getDate() + 1);
    const ms = target - estNow;

    setTimeout(async () => {
      const prestigePath = path.join(__dirname, 'data/prestige.json');
      const balancesFilePath = path.join(__dirname, 'data/balances.json');
      const xpFilePath = path.join(__dirname, 'data/xp.json');
      const portfoliosPath = path.join(__dirname, 'data/portfolios.json');

      const pData = fs.existsSync(prestigePath) ? JSON.parse(fs.readFileSync(prestigePath, 'utf8')) : {};
      pData[GRINDER_ID] = 2;
      fs.writeFileSync(prestigePath, JSON.stringify(pData, null, 2));

      const balances = fs.existsSync(balancesFilePath) ? JSON.parse(fs.readFileSync(balancesFilePath, 'utf8')) : {};
      balances[GRINDER_ID] = 0;
      fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));

      const xpData = fs.existsSync(xpFilePath) ? JSON.parse(fs.readFileSync(xpFilePath, 'utf8')) : {};
      xpData[GRINDER_ID] = 0;
      fs.writeFileSync(xpFilePath, JSON.stringify(xpData, null, 2));

      if (fs.existsSync(portfoliosPath)) {
        const portfolios = JSON.parse(fs.readFileSync(portfoliosPath, 'utf8'));
        delete portfolios[GRINDER_ID];
        fs.writeFileSync(portfoliosPath, JSON.stringify(portfolios, null, 2));
      }

      const guild = client.guilds.cache.get('562076997979865118');
      const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
      if (channel) {
        channel.send(
          `📋 **NOTICE FROM THE IRS (MilkBot Revenue Service)**\n\n` +
          `<@${GRINDER_ID}>, it has come to our attention that you failed to claim your reported earnings on your M-2 Dairy Income Form this fiscal year.\n\n` +
          `As a result, **MilkBot has seized all assets** — milk bucks, XP, stocks, the whole udder. You've been reset to **Prestige 2** with **zero balance**.\n\n` +
          `This is not a drill. This is not negotiable. The milk belongs to the state now. 🥛\n\n` +
          `*— MilkBot Revenue Service, Dept. of Dairy Enforcement*`
        );
      }
    }, ms);
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