function makeSlashBridge(interaction, mentionedUser = null, commandPrefix = '') {
  let replyPromise = null;

  const doSend = async (content) => {
    const payload = typeof content === 'string' ? { content } : content;
    try {
      if (!replyPromise) {
        replyPromise = interaction.reply(payload);
        await replyPromise;
        return interaction.fetchReply().catch(() => null);
      }
      await replyPromise;
      return interaction.followUp(payload);
    } catch (e) {
      console.error('[slashbridge] send error:', e.message);
    }
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
