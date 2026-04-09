const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');

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

  // Batch 2
  { q: 'What is the process that breaks up fat globules in milk so cream doesn\'t separate?', a: 'a', choices: ['A) Homogenization', 'B) Pasteurization', 'C) Sterilization'] },
  { q: 'Which milk alternative is made from ground nuts and water?', a: 'c', choices: ['A) Oat milk', 'B) Rice milk', 'C) Almond milk'] },
  { q: 'What is kefir?', a: 'b', choices: ['A) A type of cheese', 'B) A fermented milk drink', 'C) A milk powder'] },
  { q: 'How many pounds of milk does it take to make one pound of cheese?', a: 'a', choices: ['A) About 10 pounds', 'B) About 3 pounds', 'C) About 20 pounds'] },
  { q: 'Which country invented yogurt?', a: 'c', choices: ['A) Greece', 'B) France', 'C) Turkey'] },
  { q: 'What is the main protein found in milk?', a: 'b', choices: ['A) Albumin', 'B) Casein', 'C) Keratin'] },
  { q: 'Which milk has the highest protein content per cup?', a: 'a', choices: ['A) Cow\'s milk', 'B) Almond milk', 'C) Oat milk'] },
  { q: 'What is ghee made from?', a: 'c', choices: ['A) Goat milk', 'B) Skim milk', 'C) Clarified butter'] },
  { q: 'What is the fat content of whole milk approximately?', a: 'b', choices: ['A) 1%', 'B) 3.5%', 'C) 6%'] },
  { q: 'Which animal\'s milk is closest in composition to human breast milk?', a: 'a', choices: ['A) Donkey', 'B) Cow', 'C) Goat'] },
  { q: 'What is lactase?', a: 'c', choices: ['A) A type of milk sugar', 'B) A milk protein', 'C) An enzyme that digests lactose'] },
  { q: 'In what century was pasteurization invented?', a: 'b', choices: ['A) 18th century', 'B) 19th century', 'C) 20th century'] },
  { q: 'Which country consumes the most cheese per person?', a: 'a', choices: ['A) France', 'B) USA', 'C) Switzerland'] },
  { q: 'What is skimmed milk?', a: 'c', choices: ['A) Milk with added vitamins', 'B) Milk heated at high temperature', 'C) Milk with most fat removed'] },
  { q: 'How many different types of cheese exist in the world approximately?', a: 'b', choices: ['A) Over 100', 'B) Over 1,000', 'C) Over 10,000'] },
  { q: 'What is the color of butter made from grass-fed cows?', a: 'a', choices: ['A) Deeper yellow', 'B) Pure white', 'C) Light pink'] },
  { q: 'Which vitamin is added to milk during fortification in the US?', a: 'c', choices: ['A) Vitamin C', 'B) Vitamin B12', 'C) Vitamin D'] },
  { q: 'What is curdled milk used to make?', a: 'b', choices: ['A) Butter', 'B) Cheese', 'C) Cream'] },
  { q: 'How long does unpasteurized raw milk last in the fridge?', a: 'a', choices: ['A) 7-10 days', 'B) 3-4 weeks', 'C) 2 months'] },
  { q: 'Which mammal produces the richest milk by fat content?', a: 'c', choices: ['A) Cow', 'B) Goat', 'C) Sea lion'] },
  { q: 'What is the term for a cow that is currently producing milk?', a: 'b', choices: ['A) Heifer', 'B) Milch cow', 'C) Steer'] },
  { q: 'Which country invented condensed milk?', a: 'a', choices: ['A) USA', 'B) UK', 'C) France'] },
  { q: 'What gives blue cheese its distinctive color?', a: 'c', choices: ['A) Food dye', 'B) Aging process', 'C) Mold'] },
  { q: 'What is whey protein derived from?', a: 'b', choices: ['A) Soy', 'B) Milk', 'C) Eggs'] },
  { q: 'How many liters of milk does a Holstein cow produce per year on average?', a: 'a', choices: ['A) About 10,000 liters', 'B) About 2,000 liters', 'C) About 50,000 liters'] },
  { q: 'What is the liquid left after butter is churned?', a: 'c', choices: ['A) Whey', 'B) Cream', 'C) Buttermilk'] },
  { q: 'Which milk is naturally lactose-free?', a: 'b', choices: ['A) Goat milk', 'B) Oat milk', 'C) Sheep milk'] },
  { q: 'What causes milk to go sour?', a: 'a', choices: ['A) Bacteria producing lactic acid', 'B) Oxidation of fat', 'C) Breakdown of lactose by light'] },
  { q: 'What is the name of the protein that makes mozzarella stretchy?', a: 'c', choices: ['A) Whey', 'B) Lactose', 'C) Casein'] },
  { q: 'Which milk alternative is highest in carbohydrates?', a: 'b', choices: ['A) Almond milk', 'B) Oat milk', 'C) Coconut milk'] },
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
    const newStreak = ws.recordWin(message.author.id);
    const multiplier = newStreak >= 3 ? 1.5 : 1;
    const reward = Math.floor(REWARD * multiplier);

    const balances = getData(balancesPath);
    balances[message.author.id] = (balances[message.author.id] || 0) + reward;
    saveData(balancesPath, balances);

    const xp = getData(xpPath);
    xp[message.author.id] = (xp[message.author.id] || 0) + Math.floor(10 * (state.doubleXp ? 2 : 1) * multiplier);
    saveData(xpPath, xp);

    clearTimeout(activeTrivia.timeout);
    activeTrivia = null;

    if (newStreak === 3) message.channel.send(`🔥 **${message.author.username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);

    message.channel.send(
      `✅ **${message.author.username} got it!** +**${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
    );
    return true;
  }

  ws.resetStreak(message.author.id);
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
