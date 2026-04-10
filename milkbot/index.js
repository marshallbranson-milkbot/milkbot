require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { updatePrices } = require('./stockdata');
const { initDisplays, refreshLeaderboard } = require('./display');
const { scheduleNews } = require('./moosnews');

const STOCKS_COMMANDS = new Set(['st', 'b', 'buy', 's', 'sell', 'port']);

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

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands[command.name] = command;
    if (command.aliases) {
      command.aliases.forEach(alias => commands[alias] = command);
    }
    if (command.check) {
      gameChecks.push(command.check);
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
    if (!command) return;

    const channelName = message.channel.name;
    if (STOCKS_COMMANDS.has(commandName)) {
      if (channelName !== 'milkbot-stocks') {
        return message.reply('📈 Stock commands go in **#milkbot-stocks**!');
      }
    } else if (commandName !== 'h') {
      if (channelName !== 'milkbot-games') {
        return message.reply('🎮 Game and currency commands go in **#milkbot-games**!');
      }
    }

    command.execute(message, args, client);
  });

  client.once('ready', async () => {
    console.log(`MilkBot is online as ${client.user.tag}`);

    // Post/update help and leaderboard display messages
    await initDisplays(client);

    // Schedule daily Moo News drops
    scheduleNews(client);

    // Check Milk Lord every day at midnight
    scheduleMilkLord();

    // Schedule random crate drops
    scheduleCrateDrops(client);

    // Update stock prices every 5 minutes
    setInterval(() => updatePrices(), 5 * 60 * 1000);

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

  function dropCrate(client) {
    if (state.activeCrate) return;

    const guild = client.guilds.cache.get('562076997979865118');
    const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
    if (!channel) return;

    const expireTimeout = setTimeout(() => {
      if (state.activeCrate) {
        state.activeCrate = null;
        channel.send(`📦 The milk crate expired unclaimed. Nobody wanted free milk bucks? 🥛`);
      }
    }, 15 * 60 * 1000);

    state.activeCrate = { expireTimeout };

    channel.send(
      `📦 **A MILK CRATE JUST DROPPED!** 📦\n` +
      `First to type \`!cc\` claims **500 milk bucks**! You have 15 minutes. ⏳`
    );
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