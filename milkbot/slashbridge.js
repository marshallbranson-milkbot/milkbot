/**
 * makeSlashBridge — builds a fake prefix-command-style message object from a
 * slash interaction so existing execute(message, args) handlers work unchanged.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').User|null} mentionedUser  — populated for commands that take a @user option
 */
function makeSlashBridge(interaction, mentionedUser = null, commandPrefix = '') {
  let replied = false;

  const doSend = async (content) => {
    const payload = typeof content === 'string' ? { content } : content;
    if (!replied) {
      replied = true;
      await interaction.reply(payload);
      return interaction.fetchReply();
    }
    return interaction.followUp(payload);
  };

  const channelProxy = new Proxy(interaction.channel, {
    get(target, prop) {
      if (prop === 'send') return doSend;
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  return {
    author: { id: interaction.user.id, username: interaction.user.username },
    channel: channelProxy,
    guild: interaction.guild,
    content: commandPrefix,
    reply: doSend,
    delete: () => Promise.resolve(),
    mentions: {
      users: {
        first: () => mentionedUser ? { id: mentionedUser.id, username: mentionedUser.username } : null,
        size: mentionedUser ? 1 : 0,
      },
    },
  };
}

module.exports = { makeSlashBridge };
