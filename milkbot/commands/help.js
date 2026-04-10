const { HELP_TEXT } = require('../display');

module.exports = {
  name: 'h',
  description: 'Shows all available commands.',
  execute(message) {
    message.reply(HELP_TEXT);
  }
};
