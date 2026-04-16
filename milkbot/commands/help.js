const { buildHelpEmbed, buildCategoryReply, refreshHelp } = require('../display');

module.exports = {
  name: 'h',
  description: 'Shows all available commands.',
  execute(message, args, client) {
    const payload = buildHelpEmbed(message.author.id);
    message.reply(payload).then(reply => {
      setTimeout(() => { reply.delete().catch(() => {}); message.delete().catch(() => {}); }, 120000);
    });
    refreshHelp(client);
  },

  async handleSelectMenu(interaction) {
    const parts = interaction.customId.split('_'); // ['help', 'cat', userId]
    const ownerId = parts[2];

    // Public menu (from milkbot-commands channel) is open to everyone
    if (ownerId !== 'public' && interaction.user.id !== ownerId) {
      return interaction.reply({ content: `that's not your menu chief 🥛`, ephemeral: true });
    }

    const category = interaction.values[0];
    return interaction.reply(buildCategoryReply(category));
  },
};
