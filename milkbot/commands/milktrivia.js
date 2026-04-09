const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const REWARD = 15;
const ANSWER_TIME = 30000;

const questions = [
  { q: 'What animal does most milk come from?', a: 'b', choices: ['A) Goat', 'B) Cow', 'C) Sheep'] },
  { q: 'What vitamin is milk most known for providing?', a: 'c', choices: ['A) Vitamin A', 'B) Vitamin K', 'C) Vitamin D'] },
  { q: 'What is the process of heating milk to kill bacteria called?', a: 'a', choices: ['A) Pasteurization', 'B) Homogenization', 'C) Fermentation'] },
  { q: 'Which country drinks the most milk per person?', a: 'b', choices: ['A) USA', 'B) Finland', 'C) India'] },
  { q: 'What sugar is naturally found in milk?', a: 'c', choices: ['A) Fructose', 'B) Glucose', 'C) Lactose'] },
  { q: 'How much milk does it take to make one pound of butter?', a: 'b', choices: ['A) 5 pounds', 'B) 21 pounds', 'C) 10 pounds'] },
  { q: 'What percentage of milk is water?', a: 'a', choices: ['A) 87%', 'B) 60%', 'C) 75%'] },
  { q: 'Which type of milk has the most fat?', a: 'c', choices: ['A) 2% milk', 'B) Skim milk', 'C) Whole milk'] },
  { q: 'What is the creamy layer that rises to the top of unhomogenized milk?', a: 'b', choices: ['A) Whey', 'B) Cream', 'C) Curd'] },
  { q: 'Which mineral is milk highest in?', a: 'a', choices: ['A) Calcium', 'B) Iron', 'C) Potassium'] },
  { q: 'What is milk that has been treated to last months without refrigeration called?', a: 'c', choices: ['A) Evaporated', 'B) Condensed', 'C) UHT milk'] },
  { q: 'How many gallons of milk does an average cow produce per day?', a: 'b', choices: ['A) 2 gallons', 'B) 7 gallons', 'C) 15 gallons'] },
  { q: 'What is the byproduct of cheese-making that separates from the curds?', a: 'a', choices: ['A) Whey', 'B) Cream', 'C) Buttermilk'] },
  { q: 'Which country produces the most milk in the world?', a: 'c', choices: ['A) USA', 'B) Germany', 'C) India'] },
  { q: 'What gives milk its white color?', a: 'b', choices: ['A) Lactose', 'B) Casein protein', 'C) Fat globules'] },
  { q: 'How long does pasteurized milk typically last in the fridge?', a: 'a', choices: ['A) 1-2 weeks', 'B) 3-4 weeks', 'C) 1 month'] },
  { q: 'What is the term for people who cannot digest lactose?', a: 'c', choices: ['A) Dairy-free', 'B) Milk allergic', 'C) Lactose intolerant'] },
  { q: 'Which ancient civilization was one of the first to domesticate cattle for milk?', a: 'b', choices: ['A) Romans', 'B) Sumerians', 'C) Egyptians'] },
  { q: 'What is colostrum?', a: 'a', choices: ['A) First milk produced after birth', 'B) Milk from goats', 'C) Fermented milk drink'] },
  { q: 'How many teats does a cow typically have?', a: 'b', choices: ['A) 2', 'B) 4', 'C) 6'] },
];

let activeTrivia = null;

function check(message) {
  if (!activeTrivia) return false;
  if (message.content.startsWith('!')) return false;

  const answer = message.content.trim().toLowerCase();
  if (!['a', 'b', 'c'].includes(answer)) return false;

  if (activeTrivia.answered.has(message.author.id)) {
    message.reply(`You already answered this one. 🥛`);
    return true;
  }

  activeTrivia.answered.add(message.author.id);

  if (answer === activeTrivia.answer) {
    const balances = getData(balancesPath);
    balances[message.author.id] = (balances[message.author.id] || 0) + REWARD;
    saveData(balancesPath, balances);

    const xp = getData(xpPath);
    xp[message.author.id] = (xp[message.author.id] || 0) + (10 * (state.doubleXp ? 2 : 1));
    saveData(xpPath, xp);

    clearTimeout(activeTrivia.timeout);
    activeTrivia = null;

    message.channel.send(
      `✅ **${message.author.username} got it!** +**${REWARD} milk bucks**! 🥛`
    );
    return true;
  }

  message.reply(`Wrong answer. One guess per person. 🥛`);
  return true;
}

module.exports = {
  name: 'mt',
  aliases: ['milktrivia'],
  description: 'Milk trivia — answer A, B, or C. First correct answer wins 15 milk bucks.',
  check,
  execute(message) {
    if (activeTrivia) {
      return message.reply(
        `A trivia question is already active!\n\n` +
        `**${activeTrivia.question}**\n${activeTrivia.choices.join('\n')}`
      );
    }

    const q = questions[Math.floor(Math.random() * questions.length)];
    const answered = new Set();

    const timeout = setTimeout(() => {
      if (activeTrivia) {
        message.channel.send(
          `⏰ Time's up! Nobody got it. The answer was **${activeTrivia.answer.toUpperCase()}**. 🥛`
        );
        activeTrivia = null;
      }
    }, ANSWER_TIME);

    activeTrivia = { question: q.q, answer: q.a, choices: q.choices, answered, timeout };

    message.channel.send(
      `🥛 **MILK TRIVIA** 🥛\n\n` +
      `**${q.q}**\n` +
      `${q.choices.join('\n')}\n\n` +
      `Type **A**, **B**, or **C**. First correct answer wins **${REWARD} milk bucks**! You have 30 seconds. ⏳`
    );
  }
};
