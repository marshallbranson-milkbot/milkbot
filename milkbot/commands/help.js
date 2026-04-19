const { buildHelpEmbed, buildCategoryReply, refreshHelp } = require('../display');

module.exports = {
  name: 'h',
  description: 'Shows all available MilkBot commands.',
  slashOptions: [],

  // Slash version: reply ephemerally so only the requester sees the help menu
  async executeSlash(interaction) {
    const payload = buildHelpEmbed(interaction.user.id);
    await interaction.reply({ ...payload, flags: 64 });
    refreshHelp(interaction.client);
  },

  async execute(message, args, client) {
    const payload = buildHelpEmbed(message.author.id);
    message.delete().catch(() => {});
    await message.author.send(payload).catch(async () => {
      // DMs closed — send in channel and delete after 60s
      const reply = await message.channel.send(payload).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 60000);
    });
    refreshHelp(client);
  },

  async handleSelectMenu(interaction) {
    const parts = interaction.customId.split('_'); // ['help', 'cat', userId]
    const ownerId = parts[2];

    // Public menu (from milkbot-commands channel) is open to everyone
    if (ownerId !== 'public' && interaction.user.id !== ownerId) {
      return interaction.reply({ content: `that's not your menu chief 🥛`, flags: 64 });
    }

    const category = interaction.values[0];
    return interaction.reply(buildCategoryReply(category));
  },
};
