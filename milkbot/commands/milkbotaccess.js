const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const GUILD_ID   = '562076997979865118';
const ROLE_NAME  = 'Milkbot Crew';
const FLAG_PATH  = path.join(__dirname, '../data/milkbot_optin_posted.json');

async function postOptIn(client) {
  if (fs.existsSync(FLAG_PATH)) return;

  const guild   = client.guilds.cache.get(GUILD_ID);
  const channel = guild?.channels.cache.find(c => c.name === 'milkbot-games');
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🥛 MilkBot Access')
    .setDescription(
      `MilkBot channels are going role-gated.\n\n` +
      `Click below to keep access to **#milkbot-games**, **#milkbot-stocks**, leaderboard, and everything else.\n\n` +
      `New members get asked during onboarding.`
    )
    .setColor(0xffffff);

  await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('milkbot_optin')
          .setLabel('Get Access 🥛')
          .setStyle(ButtonStyle.Success)
      ),
    ],
  }).catch(console.error);

  fs.writeFileSync(FLAG_PATH, JSON.stringify({ posted: true }));
}

async function handleInteraction(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const role  = guild?.roles.cache.find(r => r.name === ROLE_NAME);
  if (!role) {
    return interaction.editReply({ content: `❌ MilkBot role not found — let the server admin know. 🥛` });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.editReply({ content: `You already have access. 🥛` });
  }

  const accountAge = Date.now() - interaction.user.createdTimestamp;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (accountAge < THIRTY_DAYS) {
    return interaction.editReply({ content: `Your account needs to be at least 30 days old to join. 🥛` });
  }

  await interaction.member.roles.add(role);
  return interaction.editReply({ content: `You're in. MilkBot channels are now unlocked. 🥛` });
}

module.exports = { postOptIn, handleInteraction };
