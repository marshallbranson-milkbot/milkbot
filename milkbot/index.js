require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { updatePrices, processDividends } = require('./stockdata');
const { initDisplays, refreshLeaderboard, refreshStockBoard } = require('./display');
const { scheduleNews, initMooNewsMessage } = require('./moosnews');
const { postUpdates } = require('./updates');

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

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = commands[commandName];
    if (!command) {
      message.delete().catch(() => {});
      return;
    }

    const autoDelete = (reply) => {
      setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 8000);
    };

    const channelName = message.channel.name;
    if (STOCKS_COMMANDS.has(commandName)) {
      if (channelName !== 'milkbot-stocks') {
        message.reply('📈 Stock commands go in **#milkbot-stocks**!').then(autoDelete);
        return;
      }
    } else if (!BOTH_CHANNELS.has(commandName)) {
      if (channelName !== 'milkbot-games') {
        message.reply('🎮 Game and currency commands go in **#milkbot-games**!').then(autoDelete);
        return;
      }
      // In milkbot-games, only !g and join/accept/decline commands work as text
      if (channelName === 'milkbot-games' && !GAMES_MENU_PASSTHROUGH.has(commandName)) {
        message.reply('use `!g` to play 🥛').then(autoDelete);
        return;
      }
    }

    command.execute(message, args, client);
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
      } else if (interaction.customId === 'rb_attack') {
        const rbCommand = commands['rb'];
        if (rbCommand) rbCommand.handleInteraction(interaction).catch(console.error);
      } else if (interaction.customId.startsWith('g_') && gCommand) {
        gCommand.handleButtonInteraction(interaction).catch(console.error);
      }
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

    // Check Milk Lord every day at midnight
    scheduleMilkLord();

    // Raid boss — restore if bot restarted mid-day, then schedule nightly spawns
    const rbCommand = commands['rb'];
    if (rbCommand) {
      await rbCommand.restoreOnStartup(client).catch(console.error);
      scheduleRaidBoss(client);
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
      `First to type \`!cc\` claims **500 milk bucks**! You have 30 minutes. ⏳`
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
      pData[GRINDER_ID] = 1;
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
          `As a result, **MilkBot has seized all assets** — milk bucks, XP, stocks, the whole udder. You've been reset to **Prestige 1** with **zero balance**.\n\n` +
          `This is not a drill. This is not negotiable. The milk belongs to the state now. 🥛\n\n` +
          `*— MilkBot Revenue Service, Dept. of Dairy Enforcement*`
        );
      }
    }, ms);
  }

  client.login(TOKEN);