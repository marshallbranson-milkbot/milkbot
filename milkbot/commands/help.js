const { HELP_TEXT, refreshHelp } = require('../display');

module.exports = {
  name: 'h',
  description: 'Shows all available commands.',
  execute(message, args, client) {
    message.reply(HELP_TEXT);
    refreshHelp(client);
  }
};
