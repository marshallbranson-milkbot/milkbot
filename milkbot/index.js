require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { updatePrices, processDividends } = require('./stockdata');
const { initDisplays, refreshLeaderboard, refreshStockBoard } = require('./display');
const { scheduleNews } = require('./moosnews');
const { postUpdates } = require('./updates');

const STOCKS_COMMANDS = new Set(['b', 'buy', 's', 'sell', 'port']);
const BOTH_CHANNELS   = new Set(['h', 'bal']);

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
    if (command.name === 'milklord') {
      milkLordCommand = command;
    }
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
    }

    command.execute(message, args, client);
  });

  client.once('ready', async () => {
    console.log(`MilkBot is online as ${client.user.tag}`);

    // Run any command module init functions (e.g. suggestions ban restoration)
    for (const initFn of initCallbacks) {
      await initFn(client).catch(console.error);
    }

    // Post/update help and leaderboard display messages
    await initDisplays(client);

    // Schedule daily Moo News drops
    scheduleNews(client);
    postUpdates(client);

    // Check Milk Lord every day at midnight
    scheduleMilkLord();

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

  client.login(TOKEN);