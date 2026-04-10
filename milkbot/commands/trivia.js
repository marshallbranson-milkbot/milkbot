const fs = require('fs');
const path = require('path');

const balancesPath = path.join(__dirname, '../data/balances.json');
const xpPath = path.join(__dirname, '../data/xp.json');
const state = require('../state');
const ws = require('../winstreak');
const ach = require('../achievements');

function getData(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const REWARD = 20;
const GAME_TIME = 15000;

const CATEGORIES = [
  { key: 'science',       label: 'Science & Nature', emoji: '🔬' },
  { key: 'sports',        label: 'Sports',            emoji: '🏆' },
  { key: 'entertainment', label: 'Entertainment',     emoji: '🎬' },
  { key: 'geography',     label: 'Geography',         emoji: '🌍' },
  { key: 'history',       label: 'History',           emoji: '📜' },
  { key: 'art',           label: 'Art & Literature',  emoji: '🎨' },
];

// Each question: { q, a, b, c, d, ans } where ans is 'a'|'b'|'c'|'d'
const QUESTIONS = {
  science: [
    { q: "What is the chemical symbol for gold?", a: "Au", b: "Ag", c: "Fe", d: "Cu", ans: 'a' },
    { q: "How many bones are in the adult human body?", a: "196", b: "206", c: "216", d: "186", ans: 'b' },
    { q: "What planet is known as the Red Planet?", a: "Venus", b: "Jupiter", c: "Mars", d: "Saturn", ans: 'c' },
    { q: "What is the powerhouse of the cell?", a: "Nucleus", b: "Ribosome", c: "Mitochondria", d: "Golgi apparatus", ans: 'c' },
    { q: "What gas do plants absorb from the atmosphere for photosynthesis?", a: "Oxygen", b: "Carbon dioxide", c: "Nitrogen", d: "Hydrogen", ans: 'b' },
    { q: "How many chromosomes do humans have?", a: "23", b: "44", c: "46", d: "48", ans: 'c' },
    { q: "What is the approximate speed of light?", a: "200,000 km/s", b: "300,000 km/s", c: "400,000 km/s", d: "150,000 km/s", ans: 'b' },
    { q: "What element has atomic number 1?", a: "Helium", b: "Oxygen", c: "Carbon", d: "Hydrogen", ans: 'd' },
    { q: "What is the largest organ in the human body?", a: "Liver", b: "Brain", c: "Skin", d: "Lungs", ans: 'c' },
    { q: "What planet currently has the most known moons?", a: "Jupiter", b: "Saturn", c: "Uranus", d: "Neptune", ans: 'b' },
    { q: "What is the chemical formula for water?", a: "CO2", b: "H2O2", c: "NaCl", d: "H2O", ans: 'd' },
    { q: "What is the hardest natural substance on Earth?", a: "Ruby", b: "Quartz", c: "Diamond", d: "Sapphire", ans: 'c' },
    { q: "What force keeps planets in orbit around the sun?", a: "Magnetism", b: "Gravity", c: "Nuclear force", d: "Friction", ans: 'b' },
    { q: "What is the most abundant gas in Earth's atmosphere?", a: "Oxygen", b: "Carbon dioxide", c: "Nitrogen", d: "Argon", ans: 'c' },
    { q: "What process do plants use to make food from sunlight?", a: "Respiration", b: "Photosynthesis", c: "Osmosis", d: "Fermentation", ans: 'b' },
    { q: "What is the closest star to Earth besides the Sun?", a: "Sirius", b: "Proxima Centauri", c: "Betelgeuse", d: "Vega", ans: 'b' },
    { q: "What is the unit of electrical resistance?", a: "Volt", b: "Amp", c: "Ohm", d: "Watt", ans: 'c' },
    { q: "How many hearts does an octopus have?", a: "1", b: "2", c: "3", d: "4", ans: 'c' },
    { q: "What is the chemical formula for table salt?", a: "KCl", b: "NaCl", c: "CaCl2", d: "MgCl2", ans: 'b' },
    { q: "What is the tallest animal in the world?", a: "Elephant", b: "Giraffe", c: "Camel", d: "Horse", ans: 'b' },
    { q: "What is the smallest planet in the solar system?", a: "Mars", b: "Venus", c: "Mercury", d: "Pluto", ans: 'c' },
    { q: "What organ produces insulin?", a: "Liver", b: "Kidney", c: "Pancreas", d: "Spleen", ans: 'c' },
    { q: "What is the boiling point of water in Celsius?", a: "90°C", b: "95°C", c: "100°C", d: "105°C", ans: 'c' },
    { q: "What type of animal is a salamander?", a: "Reptile", b: "Mammal", c: "Amphibian", d: "Fish", ans: 'c' },
    { q: "What is the chemical symbol for iron?", a: "Ir", b: "In", c: "Fe", d: "Io", ans: 'c' },
    { q: "What is the most common blood type?", a: "A", b: "B", c: "AB", d: "O", ans: 'd' },
    { q: "What is the freezing point of water in Fahrenheit?", a: "0°F", b: "32°F", c: "40°F", d: "212°F", ans: 'b' },
    { q: "What is the study of stars and space called?", a: "Geology", b: "Biology", c: "Astronomy", d: "Ecology", ans: 'c' },
    { q: "What type of rock is formed from cooled lava?", a: "Sedimentary", b: "Metamorphic", c: "Igneous", d: "Limestone", ans: 'c' },
    { q: "What is the largest planet in our solar system?", a: "Saturn", b: "Neptune", c: "Jupiter", d: "Uranus", ans: 'c' },
    { q: "DNA stands for what?", a: "Deoxyribonucleic acid", b: "Dinitrogen acid", c: "Deoxyribose nitrogen acid", d: "Double nucleic acid", ans: 'a' },
    { q: "What animal has the longest gestation period?", a: "Elephant", b: "Blue whale", c: "Giraffe", d: "Rhinoceros", ans: 'a' },
    { q: "What is the chemical symbol for silver?", a: "Si", b: "Ag", c: "Sv", d: "Sr", ans: 'b' },
    { q: "How many chambers does the human heart have?", a: "2", b: "3", c: "4", d: "5", ans: 'c' },
    { q: "What is the largest ocean on Earth?", a: "Atlantic", b: "Indian", c: "Arctic", d: "Pacific", ans: 'd' },
    { q: "What gas makes up about 21% of Earth's atmosphere?", a: "Nitrogen", b: "Oxygen", c: "Carbon dioxide", d: "Argon", ans: 'b' },
    { q: "What is absolute zero in Celsius?", a: "-100°C", b: "-173°C", c: "-273°C", d: "-373°C", ans: 'c' },
    { q: "What is the name of the galaxy containing our solar system?", a: "Andromeda", b: "Milky Way", c: "Triangulum", d: "Whirlpool", ans: 'b' },
    { q: "How many legs does a spider have?", a: "6", b: "8", c: "10", d: "12", ans: 'b' },
    { q: "What vitamin does sunlight help your body produce?", a: "Vitamin A", b: "Vitamin B", c: "Vitamin C", d: "Vitamin D", ans: 'd' },
    { q: "What is the world's largest mammal?", a: "Elephant", b: "Blue whale", c: "Giraffe", d: "Hippopotamus", ans: 'b' },
    { q: "What is the most electronegative element?", a: "Oxygen", b: "Chlorine", c: "Fluorine", d: "Nitrogen", ans: 'c' },
    { q: "What is the human body's largest internal organ?", a: "Heart", b: "Lungs", c: "Liver", d: "Stomach", ans: 'c' },
    { q: "What is the approximate speed of sound in air?", a: "143 m/s", b: "243 m/s", c: "343 m/s", d: "443 m/s", ans: 'c' },
    { q: "What phobia is the fear of spiders?", a: "Arachnophobia", b: "Acrophobia", c: "Claustrophobia", d: "Xenophobia", ans: 'a' },
    { q: "What is the chemical symbol for potassium?", a: "P", b: "Pt", c: "K", d: "Po", ans: 'c' },
    { q: "What force resists the motion of objects sliding against each other?", a: "Gravity", b: "Friction", c: "Tension", d: "Inertia", ans: 'b' },
    { q: "What is the name of the force that opposes relative motion between surfaces?", a: "Gravity", b: "Drag", c: "Friction", d: "Normal force", ans: 'c' },
    { q: "What is the atomic number of carbon?", a: "4", b: "6", c: "8", d: "12", ans: 'b' },
    { q: "What layer of Earth do we live on?", a: "Mantle", b: "Core", c: "Crust", d: "Lithosphere", ans: 'c' },
  ],

  sports: [
    { q: "How many players are on a basketball team on the court at one time?", a: "4", b: "5", c: "6", d: "7", ans: 'b' },
    { q: "How many players are on a soccer team?", a: "9", b: "10", c: "11", d: "12", ans: 'c' },
    { q: "In tennis, what term means zero points?", a: "Nil", b: "Love", c: "Zero", d: "Void", ans: 'b' },
    { q: "How many innings are in a standard baseball game?", a: "7", b: "8", c: "9", d: "10", ans: 'c' },
    { q: "What sport uses a puck?", a: "Lacrosse", b: "Field hockey", c: "Ice hockey", d: "Polo", ans: 'c' },
    { q: "How many players are on a volleyball team on the court?", a: "5", b: "6", c: "7", d: "8", ans: 'b' },
    { q: "What is a perfect score in bowling?", a: "100", b: "200", c: "300", d: "400", ans: 'c' },
    { q: "In which sport is the Stanley Cup awarded?", a: "Basketball", b: "Baseball", c: "Football", d: "Ice Hockey", ans: 'd' },
    { q: "How many Grand Slam tournaments are there in tennis?", a: "2", b: "3", c: "4", d: "5", ans: 'c' },
    { q: "How many points is a touchdown worth in American football?", a: "3", b: "6", c: "7", d: "8", ans: 'b' },
    { q: "What country has won the most FIFA World Cups?", a: "Germany", b: "Argentina", c: "Italy", d: "Brazil", ans: 'd' },
    { q: "How long is an Olympic swimming pool?", a: "25m", b: "50m", c: "75m", d: "100m", ans: 'b' },
    { q: "What sport is played at Wimbledon?", a: "Cricket", b: "Golf", c: "Tennis", d: "Badminton", ans: 'c' },
    { q: "How many players are on an American football team on the field?", a: "9", b: "10", c: "11", d: "12", ans: 'c' },
    { q: "How many rounds are in a world title boxing match?", a: "10", b: "12", c: "15", d: "8", ans: 'b' },
    { q: "Which country hosted the 2016 Summer Olympics?", a: "China", b: "UK", c: "Brazil", d: "Japan", ans: 'c' },
    { q: "What is the national sport of Japan?", a: "Judo", b: "Sumo", c: "Karate", d: "Baseball", ans: 'b' },
    { q: "How many players are on a baseball team?", a: "7", b: "8", c: "9", d: "10", ans: 'c' },
    { q: "What swimming stroke is considered the fastest?", a: "Breaststroke", b: "Backstroke", c: "Butterfly", d: "Freestyle", ans: 'd' },
    { q: "What is the height of a basketball hoop from the ground?", a: "8 ft", b: "9 ft", c: "10 ft", d: "11 ft", ans: 'c' },
    { q: "What sport uses a foil, épée, or sabre?", a: "Archery", b: "Fencing", c: "Javelin", d: "Polo", ans: 'b' },
    { q: "What is the term for three consecutive strikes in bowling?", a: "Hat trick", b: "Triple", c: "Turkey", d: "Three-peat", ans: 'c' },
    { q: "How many events are in a decathlon?", a: "8", b: "9", c: "10", d: "12", ans: 'c' },
    { q: "What country did Taekwondo originate in?", a: "Japan", b: "China", c: "Korea", d: "Thailand", ans: 'c' },
    { q: "How many players are on a rugby union team?", a: "11", b: "13", c: "15", d: "17", ans: 'c' },
    { q: "What sport is associated with The Masters Tournament?", a: "Tennis", b: "Golf", c: "Swimming", d: "Boxing", ans: 'b' },
    { q: "How many rings are on the Olympic flag?", a: "3", b: "4", c: "5", d: "6", ans: 'c' },
    { q: "How many points is a field goal worth in American football?", a: "1", b: "2", c: "3", d: "4", ans: 'c' },
    { q: "How far is a marathon in miles?", a: "24.2", b: "26.2", c: "28.2", d: "22.2", ans: 'b' },
    { q: "What is the most watched sporting event in the world?", a: "Super Bowl", b: "Olympics", c: "FIFA World Cup", d: "Tour de France", ans: 'c' },
    { q: "In golf, what is the term for one under par?", a: "Eagle", b: "Birdie", c: "Bogey", d: "Albatross", ans: 'b' },
    { q: "How many points is a safety worth in American football?", a: "1", b: "2", c: "3", d: "4", ans: 'b' },
    { q: "What is the highest belt color in karate?", a: "Red", b: "Brown", c: "Black", d: "Blue", ans: 'c' },
    { q: "How long is an NBA game in regulation?", a: "40 min", b: "44 min", c: "48 min", d: "52 min", ans: 'c' },
    { q: "What sport uses a shuttlecock?", a: "Tennis", b: "Badminton", c: "Squash", d: "Racquetball", ans: 'b' },
    { q: "What sport is known as 'the sweet science'?", a: "Wrestling", b: "Judo", c: "Boxing", d: "Fencing", ans: 'c' },
    { q: "How many players are on an ice hockey team on the ice?", a: "5", b: "6", c: "7", d: "8", ans: 'b' },
    { q: "In which city were the first modern Olympic Games held?", a: "Paris", b: "London", c: "Athens", d: "Rome", ans: 'c' },
    { q: "Who holds the record for most Olympic gold medals?", a: "Carl Lewis", b: "Usain Bolt", c: "Michael Phelps", d: "Mark Spitz", ans: 'c' },
    { q: "What is the term for a score of zero in tennis?", a: "Nil", b: "Blank", c: "Love", d: "Zero", ans: 'c' },
    { q: "In golf, what is two under par called?", a: "Birdie", b: "Eagle", c: "Albatross", d: "Bogey", ans: 'b' },
    { q: "How many holes are on a standard golf course?", a: "9", b: "12", c: "18", d: "24", ans: 'c' },
    { q: "What country has appeared in every FIFA World Cup?", a: "Germany", b: "Italy", c: "Brazil", d: "Argentina", ans: 'c' },
    { q: "What sport features a penalty shootout?", a: "Rugby", b: "Soccer", c: "Hockey", d: "Basketball", ans: 'b' },
    { q: "How many points is a three-pointer worth in basketball?", a: "2", b: "3", c: "4", d: "1", ans: 'b' },
    { q: "What is the term for a perfect game in baseball?", a: "No-hitter", b: "Shutout", c: "Perfect game", d: "Grand slam", ans: 'c' },
    { q: "How many sets are in a men's Grand Slam tennis final?", a: "3", b: "4", c: "5", d: "6", ans: 'c' },
    { q: "What sport uses the term 'love-15'?", a: "Badminton", b: "Squash", c: "Table tennis", d: "Tennis", ans: 'd' },
    { q: "In which sport would you find a 'hat trick'?", a: "Baseball", b: "Basketball", c: "Soccer", d: "Golf", ans: 'c' },
    { q: "How many players are on a cricket team?", a: "9", b: "10", c: "11", d: "12", ans: 'c' },
  ],

  entertainment: [
    { q: "What movie features the line 'I'll be back'?", a: "Die Hard", b: "The Terminator", c: "Predator", d: "RoboCop", ans: 'b' },
    { q: "Who played Iron Man in the MCU?", a: "Chris Evans", b: "Chris Hemsworth", c: "Robert Downey Jr.", d: "Mark Ruffalo", ans: 'c' },
    { q: "What TV show features the Stark family?", a: "The Witcher", b: "Game of Thrones", c: "Vikings", d: "Peaky Blinders", ans: 'b' },
    { q: "Who sang 'Thriller'?", a: "Prince", b: "Michael Jackson", c: "James Brown", d: "Stevie Wonder", ans: 'b' },
    { q: "What is the name of Batman's butler?", a: "James", b: "Alfred", c: "Richard", d: "Thomas", ans: 'b' },
    { q: "What year was the first iPhone released?", a: "2005", b: "2006", c: "2007", d: "2008", ans: 'c' },
    { q: "Who voiced Shrek in the Shrek movies?", a: "Jim Carrey", b: "Mike Myers", c: "Eddie Murphy", d: "Will Smith", ans: 'b' },
    { q: "What band was Freddie Mercury the lead singer of?", a: "Led Zeppelin", b: "The Rolling Stones", c: "Queen", d: "Aerosmith", ans: 'c' },
    { q: "In which film did Leonardo DiCaprio win his first Oscar?", a: "Titanic", b: "The Revenant", c: "Inception", d: "The Wolf of Wall Street", ans: 'b' },
    { q: "What is the name of the fictional African country in Black Panther?", a: "Zamunda", b: "Narnia", c: "Wakanda", d: "Genovia", ans: 'c' },
    { q: "Who played Jack in Titanic?", a: "Brad Pitt", b: "Tom Hanks", c: "Leonardo DiCaprio", d: "Matt Damon", ans: 'c' },
    { q: "What streaming service created Stranger Things?", a: "HBO", b: "Hulu", c: "Netflix", d: "Amazon", ans: 'c' },
    { q: "What color pill does Neo take in The Matrix?", a: "Blue", b: "Red", c: "Green", d: "White", ans: 'b' },
    { q: "What is SpongeBob's best friend's name?", a: "Patrick", b: "Squidward", c: "Sandy", d: "Gary", ans: 'a' },
    { q: "Who sang 'Rolling in the Deep'?", a: "Beyoncé", b: "Rihanna", c: "Adele", d: "Taylor Swift", ans: 'c' },
    { q: "MCU stands for what?", a: "Marvel Comic Universe", b: "Marvel Cinematic Universe", c: "Marvel Character Universe", d: "Massive Comic Universe", ans: 'b' },
    { q: "What show features a chemistry teacher in Albuquerque, New Mexico?", a: "Better Call Saul", b: "Breaking Bad", c: "Ozark", d: "Weeds", ans: 'b' },
    { q: "Who plays Hermione Granger in Harry Potter?", a: "Emma Watson", b: "Emma Stone", c: "Keira Knightley", d: "Natalie Portman", ans: 'a' },
    { q: "What animated movie features the song 'Let It Go'?", a: "Moana", b: "Tangled", c: "Brave", d: "Frozen", ans: 'd' },
    { q: "Who is the lead singer of Coldplay?", a: "Bono", b: "Chris Martin", c: "Ed Sheeran", d: "Sam Smith", ans: 'b' },
    { q: "What movie franchise features Dom Toretto?", a: "Mission Impossible", b: "John Wick", c: "Fast & Furious", d: "The Expendables", ans: 'c' },
    { q: "Who sang 'Old Town Road'?", a: "Post Malone", b: "Travis Scott", c: "Lil Nas X", d: "DaBaby", ans: 'c' },
    { q: "Who plays the Joker in The Dark Knight?", a: "Jack Nicholson", b: "Jared Leto", c: "Heath Ledger", d: "Joaquin Phoenix", ans: 'c' },
    { q: "What movie features the quote 'You can't handle the truth'?", a: "The Firm", b: "A Few Good Men", c: "Philadelphia", d: "The Pelican Brief", ans: 'b' },
    { q: "Who created the Harry Potter series?", a: "Suzanne Collins", b: "J.K. Rowling", c: "Stephenie Meyer", d: "Philip Pullman", ans: 'b' },
    { q: "What band released the album 'Abbey Road'?", a: "The Rolling Stones", b: "Led Zeppelin", c: "The Beatles", d: "Pink Floyd", ans: 'c' },
    { q: "What animated Disney movie features a character named Simba?", a: "Bambi", b: "The Jungle Book", c: "The Lion King", d: "Tarzan", ans: 'c' },
    { q: "Who played Walter White in Breaking Bad?", a: "Aaron Paul", b: "Bryan Cranston", c: "Bob Odenkirk", d: "Dean Norris", ans: 'b' },
    { q: "What is the name of Thor's hammer?", a: "Gungnir", b: "Mjolnir", c: "Excalibur", d: "Durendal", ans: 'b' },
    { q: "Who sang 'Lose Yourself'?", a: "Jay-Z", b: "Kanye West", c: "Eminem", d: "Drake", ans: 'c' },
    { q: "What show features the fictional Dunder Mifflin Paper Company?", a: "Parks and Recreation", b: "Brooklyn Nine-Nine", c: "The Office", d: "Arrested Development", ans: 'c' },
    { q: "Who directed Jurassic Park?", a: "George Lucas", b: "James Cameron", c: "Steven Spielberg", d: "Ridley Scott", ans: 'c' },
    { q: "What is the name of the coffee shop in Friends?", a: "The Grind", b: "Perk City", c: "Central Perk", d: "Java Junction", ans: 'c' },
    { q: "Who played Captain Jack Sparrow?", a: "Orlando Bloom", b: "Geoffrey Rush", c: "Johnny Depp", d: "Keira Knightley", ans: 'c' },
    { q: "Who sang 'Bohemian Rhapsody'?", a: "David Bowie", b: "Queen", c: "Elton John", d: "The Who", ans: 'b' },
    { q: "What movie features 'There's no place like home'?", a: "Peter Pan", b: "The Wizard of Oz", c: "Alice in Wonderland", d: "Cinderella", ans: 'b' },
    { q: "What is the name of the dragon in How to Train Your Dragon?", a: "Smaug", b: "Falkor", c: "Toothless", d: "Draco", ans: 'c' },
    { q: "Who sang 'Uptown Funk'?", a: "Justin Timberlake", b: "Bruno Mars", c: "Pharrell Williams", d: "John Legend", ans: 'b' },
    { q: "What year did the first Harry Potter movie release?", a: "1999", b: "2000", c: "2001", d: "2002", ans: 'c' },
    { q: "Who played the Joker in Joker (2019)?", a: "Heath Ledger", b: "Jared Leto", c: "Joaquin Phoenix", d: "Jack Nicholson", ans: 'c' },
    { q: "What is the name of Bart Simpson's sister who plays saxophone?", a: "Maggie", b: "Lisa", c: "Patty", d: "Selma", ans: 'b' },
    { q: "What show features Eleven and the Upside Down?", a: "Dark", b: "The OA", c: "Stranger Things", d: "Lost", ans: 'c' },
    { q: "What color is The Hulk?", a: "Blue", b: "Red", c: "Green", d: "Purple", ans: 'c' },
    { q: "Who sang 'Bad Guy'?", a: "Olivia Rodrigo", b: "Dua Lipa", c: "Ariana Grande", d: "Billie Eilish", ans: 'd' },
    { q: "What show features a high school chemistry teacher turned drug lord?", a: "Ozark", b: "Breaking Bad", c: "Narcos", d: "The Wire", ans: 'b' },
    { q: "What is the best-selling music album of all time?", a: "Thriller", b: "Back in Black", c: "Dark Side of the Moon", d: "Hotel California", ans: 'a' },
    { q: "What Marvel movie came out first?", a: "Iron Man", b: "Thor", c: "Captain America", d: "The Incredible Hulk", ans: 'a' },
    { q: "Who voices Woody in Toy Story?", a: "Tom Hanks", b: "Tim Allen", c: "Billy Crystal", d: "John Goodman", ans: 'a' },
    { q: "What sitcom is set in Seattle and features a psychiatrist radio host?", a: "Cheers", b: "Frasier", c: "Seinfeld", d: "The Office", ans: 'b' },
    { q: "Who sang 'Shake It Off'?", a: "Katy Perry", b: "Selena Gomez", c: "Taylor Swift", d: "Ariana Grande", ans: 'c' },
  ],

  geography: [
    { q: "What is the capital of Australia?", a: "Sydney", b: "Melbourne", c: "Canberra", d: "Brisbane", ans: 'c' },
    { q: "What is the longest river in the world?", a: "Amazon", b: "Mississippi", c: "Yangtze", d: "Nile", ans: 'd' },
    { q: "What is the smallest country in the world?", a: "Monaco", b: "San Marino", c: "Vatican City", d: "Liechtenstein", ans: 'c' },
    { q: "What is the capital of Canada?", a: "Toronto", b: "Vancouver", c: "Ottawa", d: "Montreal", ans: 'c' },
    { q: "What is the largest country by area?", a: "China", b: "USA", c: "Canada", d: "Russia", ans: 'd' },
    { q: "What country has the most natural lakes?", a: "Russia", b: "Canada", c: "USA", d: "Finland", ans: 'b' },
    { q: "What is the capital of Japan?", a: "Kyoto", b: "Osaka", c: "Tokyo", d: "Hiroshima", ans: 'c' },
    { q: "What is the tallest mountain in the world?", a: "K2", b: "Kangchenjunga", c: "Mount Everest", d: "Lhotse", ans: 'c' },
    { q: "What is the capital of Brazil?", a: "Rio de Janeiro", b: "São Paulo", c: "Brasília", d: "Salvador", ans: 'c' },
    { q: "What continent is the Sahara Desert located on?", a: "Asia", b: "Africa", c: "Australia", d: "South America", ans: 'b' },
    { q: "What is the capital of France?", a: "Lyon", b: "Marseille", c: "Nice", d: "Paris", ans: 'd' },
    { q: "What is the largest continent by area?", a: "North America", b: "Africa", c: "Asia", d: "Europe", ans: 'c' },
    { q: "What country is the Amazon rainforest primarily in?", a: "Colombia", b: "Peru", c: "Venezuela", d: "Brazil", ans: 'd' },
    { q: "What is the longest mountain range in the world?", a: "Himalayas", b: "Rockies", c: "Andes", d: "Alps", ans: 'c' },
    { q: "What is the capital of Germany?", a: "Munich", b: "Hamburg", c: "Frankfurt", d: "Berlin", ans: 'd' },
    { q: "What is the deepest lake in the world?", a: "Lake Superior", b: "Caspian Sea", c: "Lake Baikal", d: "Lake Tanganyika", ans: 'c' },
    { q: "What country is the Great Barrier Reef in?", a: "Indonesia", b: "Philippines", c: "Australia", d: "New Zealand", ans: 'c' },
    { q: "What is the capital of Egypt?", a: "Alexandria", b: "Cairo", c: "Luxor", d: "Giza", ans: 'b' },
    { q: "How many continents are there?", a: "5", b: "6", c: "7", d: "8", ans: 'c' },
    { q: "What is the largest desert in the world?", a: "Gobi", b: "Sahara", c: "Arabian", d: "Antarctic", ans: 'd' },
    { q: "What is the capital of Spain?", a: "Barcelona", b: "Seville", c: "Valencia", d: "Madrid", ans: 'd' },
    { q: "What is the most populated country in the world?", a: "India", b: "China", c: "USA", d: "Indonesia", ans: 'a' },
    { q: "What is the capital of South Korea?", a: "Busan", b: "Seoul", c: "Incheon", d: "Daegu", ans: 'b' },
    { q: "What is the smallest ocean?", a: "Indian", b: "Southern", c: "Arctic", d: "Atlantic", ans: 'c' },
    { q: "What mountain range separates Europe from Asia?", a: "Alps", b: "Urals", c: "Caucasus", d: "Carpathians", ans: 'b' },
    { q: "What is the capital of Argentina?", a: "Santiago", b: "Lima", c: "Bogotá", d: "Buenos Aires", ans: 'd' },
    { q: "What is the capital of Mexico?", a: "Guadalajara", b: "Monterrey", c: "Cancún", d: "Mexico City", ans: 'd' },
    { q: "What river flows through Egypt?", a: "Congo", b: "Niger", c: "Nile", d: "Zambezi", ans: 'c' },
    { q: "What is the capital of Italy?", a: "Milan", b: "Venice", c: "Naples", d: "Rome", ans: 'd' },
    { q: "What is the capital of China?", a: "Shanghai", b: "Chengdu", c: "Beijing", d: "Guangzhou", ans: 'c' },
    { q: "What is the capital of Russia?", a: "St. Petersburg", b: "Moscow", c: "Vladivostok", d: "Novosibirsk", ans: 'b' },
    { q: "What is the capital of India?", a: "Mumbai", b: "Kolkata", c: "New Delhi", d: "Chennai", ans: 'c' },
    { q: "What is the highest waterfall in the world?", a: "Niagara Falls", b: "Victoria Falls", c: "Iguazu Falls", d: "Angel Falls", ans: 'd' },
    { q: "What is the capital of Turkey?", a: "Istanbul", b: "Ankara", c: "Izmir", d: "Bursa", ans: 'b' },
    { q: "What is the only country that is also considered a continent?", a: "Greenland", b: "Iceland", c: "Australia", d: "New Zealand", ans: 'c' },
    { q: "What is the currency of Japan?", a: "Won", b: "Yuan", c: "Yen", d: "Ringgit", ans: 'c' },
    { q: "What is the longest river in Europe?", a: "Rhine", b: "Danube", c: "Volga", d: "Thames", ans: 'c' },
    { q: "What is the capital of Greece?", a: "Thessaloniki", b: "Patras", c: "Athens", d: "Heraklion", ans: 'c' },
    { q: "What sea separates Europe from Africa?", a: "Red Sea", b: "Black Sea", c: "Caspian Sea", d: "Mediterranean Sea", ans: 'd' },
    { q: "What is the capital of the Netherlands?", a: "Rotterdam", b: "The Hague", c: "Amsterdam", d: "Utrecht", ans: 'c' },
    { q: "What is the largest country in Africa by area?", a: "DR Congo", b: "Sudan", c: "Libya", d: "Algeria", ans: 'd' },
    { q: "What is the capital of Saudi Arabia?", a: "Mecca", b: "Medina", c: "Jeddah", d: "Riyadh", ans: 'd' },
    { q: "What is the capital of Portugal?", a: "Porto", b: "Lisbon", c: "Faro", d: "Braga", ans: 'b' },
    { q: "What country has the longest coastline?", a: "Russia", b: "Norway", c: "Canada", d: "Australia", ans: 'c' },
    { q: "What is the capital of South Africa (executive)?", a: "Johannesburg", b: "Cape Town", c: "Durban", d: "Pretoria", ans: 'd' },
    { q: "What is the capital of Nigeria?", a: "Lagos", b: "Abuja", c: "Kano", d: "Ibadan", ans: 'b' },
    { q: "What is the capital of Indonesia?", a: "Surabaya", b: "Bandung", c: "Jakarta", d: "Medan", ans: 'c' },
    { q: "What continent is Morocco in?", a: "Middle East", b: "Europe", c: "Asia", d: "Africa", ans: 'd' },
    { q: "What is the capital of Sweden?", a: "Oslo", b: "Copenhagen", c: "Helsinki", d: "Stockholm", ans: 'd' },
    { q: "What is the capital of Poland?", a: "Krakow", b: "Warsaw", c: "Gdansk", d: "Wroclaw", ans: 'b' },
  ],

  history: [
    { q: "In what year did World War II end?", a: "1943", b: "1944", c: "1945", d: "1946", ans: 'c' },
    { q: "Who was the first President of the United States?", a: "John Adams", b: "Thomas Jefferson", c: "Benjamin Franklin", d: "George Washington", ans: 'd' },
    { q: "In what year did the Berlin Wall fall?", a: "1987", b: "1989", c: "1991", d: "1993", ans: 'b' },
    { q: "Who was the first person to walk on the moon?", a: "Buzz Aldrin", b: "Yuri Gagarin", c: "Neil Armstrong", d: "Alan Shepard", ans: 'c' },
    { q: "In what year did the Titanic sink?", a: "1910", b: "1912", c: "1914", d: "1916", ans: 'b' },
    { q: "Who invented the telephone?", a: "Thomas Edison", b: "Nikola Tesla", c: "Alexander Graham Bell", d: "Guglielmo Marconi", ans: 'c' },
    { q: "What empire was ruled by Julius Caesar?", a: "Greek", b: "Ottoman", c: "Byzantine", d: "Roman", ans: 'd' },
    { q: "In what year did World War I begin?", a: "1912", b: "1913", c: "1914", d: "1915", ans: 'c' },
    { q: "Who was the first woman to win a Nobel Prize?", a: "Rosalind Franklin", b: "Marie Curie", c: "Dorothy Hodgkin", d: "Ada Lovelace", ans: 'b' },
    { q: "What was the name of the first artificial satellite launched into space?", a: "Vostok", b: "Explorer", c: "Sputnik", d: "Luna", ans: 'c' },
    { q: "Who led the Cuban Revolution?", a: "Che Guevara", b: "Fidel Castro", c: "Raúl Castro", d: "Camilo Cienfuegos", ans: 'b' },
    { q: "In what year did the French Revolution begin?", a: "1776", b: "1789", c: "1799", d: "1804", ans: 'b' },
    { q: "What was the first country to give women the right to vote?", a: "USA", b: "UK", c: "New Zealand", d: "Australia", ans: 'c' },
    { q: "In what year did the USA gain independence?", a: "1774", b: "1776", c: "1778", d: "1780", ans: 'b' },
    { q: "What civilization built Machu Picchu?", a: "Aztec", b: "Maya", c: "Inca", d: "Olmec", ans: 'c' },
    { q: "What was the name of the ship Charles Darwin traveled on?", a: "Endeavour", b: "Resolution", c: "Beagle", d: "Discovery", ans: 'c' },
    { q: "In what year did the Soviet Union collapse?", a: "1989", b: "1990", c: "1991", d: "1992", ans: 'c' },
    { q: "Who led the first expedition to circumnavigate the globe?", a: "Christopher Columbus", b: "Vasco da Gama", c: "Ferdinand Magellan", d: "Francis Drake", ans: 'c' },
    { q: "What was the name of the first space shuttle?", a: "Discovery", b: "Challenger", c: "Columbia", d: "Atlantis", ans: 'c' },
    { q: "Who primarily wrote the Declaration of Independence?", a: "George Washington", b: "John Adams", c: "Benjamin Franklin", d: "Thomas Jefferson", ans: 'd' },
    { q: "What ancient civilization built the Colosseum?", a: "Greek", b: "Egyptian", c: "Roman", d: "Ottoman", ans: 'c' },
    { q: "Who was the first female Prime Minister of the United Kingdom?", a: "Angela Merkel", b: "Theresa May", c: "Margaret Thatcher", d: "Indira Gandhi", ans: 'c' },
    { q: "What year did humans first land on the moon?", a: "1967", b: "1968", c: "1969", d: "1970", ans: 'c' },
    { q: "What was the name of the 14th century plague that devastated Europe?", a: "Spanish Flu", b: "Black Death", c: "Bubonic Fever", d: "Great Plague", ans: 'b' },
    { q: "Who was the first person to fly solo across the Atlantic?", a: "Amelia Earhart", b: "Howard Hughes", c: "Charles Lindbergh", d: "Wiley Post", ans: 'c' },
    { q: "In what city was JFK assassinated?", a: "Washington D.C.", b: "Houston", c: "Dallas", d: "Miami", ans: 'c' },
    { q: "What was the name of the first nuclear bomb dropped on Japan?", a: "Fat Man", b: "Little Boy", c: "Big Boy", d: "Thin Man", ans: 'b' },
    { q: "Who was the first person to reach the South Pole?", a: "Robert Falcon Scott", b: "Ernest Shackleton", c: "Roald Amundsen", d: "Richard Byrd", ans: 'c' },
    { q: "In what year did Nelson Mandela become President of South Africa?", a: "1990", b: "1992", c: "1994", d: "1996", ans: 'c' },
    { q: "Who invented the printing press?", a: "Leonardo da Vinci", b: "Johannes Gutenberg", c: "Isaac Newton", d: "Galileo Galilei", ans: 'b' },
    { q: "What war was fought between the North and South of the United States?", a: "Revolutionary War", b: "War of 1812", c: "Civil War", d: "Spanish-American War", ans: 'c' },
    { q: "Who was the first woman to fly solo across the Atlantic?", a: "Harriet Quimby", b: "Jacqueline Cochran", c: "Amelia Earhart", d: "Bessie Coleman", ans: 'c' },
    { q: "Who wrote the Communist Manifesto?", a: "Lenin", b: "Stalin", c: "Engels and Marx", d: "Trotsky", ans: 'c' },
    { q: "In what year was the United Nations founded?", a: "1943", b: "1944", c: "1945", d: "1946", ans: 'c' },
    { q: "What was the name of the Apollo mission that first landed on the moon?", a: "Apollo 10", b: "Apollo 11", c: "Apollo 12", d: "Apollo 13", ans: 'b' },
    { q: "What year did World War I end?", a: "1917", b: "1918", c: "1919", d: "1920", ans: 'b' },
    { q: "Who was the longest-reigning British monarch?", a: "King George III", b: "Queen Victoria", c: "King Henry VIII", d: "Queen Elizabeth II", ans: 'd' },
    { q: "Who led India's independence movement against British rule?", a: "Nehru", b: "Gandhi", c: "Bose", d: "Ambedkar", ans: 'b' },
    { q: "What ancient Greek philosopher taught Alexander the Great?", a: "Socrates", b: "Plato", c: "Aristotle", d: "Pythagoras", ans: 'c' },
    { q: "In what year did Christopher Columbus first reach the Americas?", a: "1490", b: "1492", c: "1494", d: "1496", ans: 'b' },
    { q: "What ancient Egyptian queen is famous for her beauty and political power?", a: "Nefertiti", b: "Cleopatra", c: "Hatshepsut", d: "Nefertari", ans: 'b' },
    { q: "What empire was the largest in history by land area?", a: "Roman", b: "Mongol", c: "British", d: "Ottoman", ans: 'c' },
    { q: "What country built the Great Wall?", a: "Japan", b: "Korea", c: "Mongolia", d: "China", ans: 'd' },
    { q: "What first Emperor of China unified the warring states?", a: "Kublai Khan", b: "Liu Bang", c: "Qin Shi Huang", d: "Wu Zetian", ans: 'c' },
    { q: "What ancient wonder was located in Alexandria, Egypt?", a: "The Colossus", b: "The Great Pyramid", c: "The Lighthouse", d: "The Hanging Gardens", ans: 'c' },
    { q: "What year did the Cold War end?", a: "1985", b: "1989", c: "1991", d: "1993", ans: 'c' },
    { q: "Who was president of the USA during the Cuban Missile Crisis?", a: "Eisenhower", b: "Nixon", c: "Kennedy", d: "Johnson", ans: 'c' },
    { q: "What ship carried the Pilgrims to America in 1620?", a: "Santa María", b: "Endeavour", c: "Mayflower", d: "Pinta", ans: 'c' },
    { q: "What wall divided East and West Berlin?", a: "Iron Curtain", b: "Berlin Wall", c: "Wall of Berlin", d: "The Divide", ans: 'b' },
    { q: "In what year was the Magna Carta signed?", a: "1215", b: "1315", c: "1415", d: "1515", ans: 'a' },
  ],

  art: [
    { q: "Who wrote 'Romeo and Juliet'?", a: "Charles Dickens", b: "William Shakespeare", c: "Jane Austen", d: "Homer", ans: 'b' },
    { q: "Who painted the Sistine Chapel ceiling?", a: "Leonardo da Vinci", b: "Raphael", c: "Michelangelo", d: "Botticelli", ans: 'c' },
    { q: "Who wrote '1984'?", a: "Aldous Huxley", b: "Ray Bradbury", c: "George Orwell", d: "H.G. Wells", ans: 'c' },
    { q: "What art movement was Salvador Dalí associated with?", a: "Impressionism", b: "Cubism", c: "Surrealism", d: "Expressionism", ans: 'c' },
    { q: "Who wrote 'Pride and Prejudice'?", a: "Charlotte Brontë", b: "Emily Brontë", c: "George Eliot", d: "Jane Austen", ans: 'd' },
    { q: "What is the name of Edvard Munch's most famous painting?", a: "The Birth of Venus", b: "The Scream", c: "Starry Night", d: "Water Lilies", ans: 'b' },
    { q: "Who wrote 'Don Quixote'?", a: "Dante Alighieri", b: "Miguel de Cervantes", c: "Lope de Vega", d: "Francisco de Quevedo", ans: 'b' },
    { q: "What artist is famous for cutting off his own ear?", a: "Paul Gauguin", b: "Georges Seurat", c: "Vincent van Gogh", d: "Paul Cézanne", ans: 'c' },
    { q: "Who wrote 'The Great Gatsby'?", a: "Ernest Hemingway", b: "F. Scott Fitzgerald", c: "John Steinbeck", d: "William Faulkner", ans: 'b' },
    { q: "What famous painting shows a woman with a mysterious smile?", a: "The Birth of Venus", b: "Girl with a Pearl Earring", c: "Mona Lisa", d: "American Gothic", ans: 'c' },
    { q: "Who wrote 'To Kill a Mockingbird'?", a: "Toni Morrison", b: "Harper Lee", c: "Maya Angelou", d: "Flannery O'Connor", ans: 'b' },
    { q: "What art movement is Claude Monet associated with?", a: "Cubism", b: "Surrealism", c: "Baroque", d: "Impressionism", ans: 'd' },
    { q: "Who wrote 'The Odyssey'?", a: "Virgil", b: "Sophocles", c: "Homer", d: "Ovid", ans: 'c' },
    { q: "What art style is Pablo Picasso most known for?", a: "Impressionism", b: "Cubism", c: "Surrealism", d: "Realism", ans: 'b' },
    { q: "Who wrote 'Hamlet'?", a: "Ben Jonson", b: "Christopher Marlowe", c: "William Shakespeare", d: "John Webster", ans: 'c' },
    { q: "What Dutch artist painted 'Girl with a Pearl Earring'?", a: "Rembrandt", b: "Jan Vermeer", c: "Frans Hals", d: "Jacob van Ruisdael", ans: 'b' },
    { q: "Who wrote 'The Catcher in the Rye'?", a: "Jack Kerouac", b: "J.D. Salinger", c: "William S. Burroughs", d: "Allen Ginsberg", ans: 'b' },
    { q: "Who wrote 'Moby Dick'?", a: "Mark Twain", b: "Nathaniel Hawthorne", c: "Herman Melville", d: "Edgar Allan Poe", ans: 'c' },
    { q: "What is the name of the famous Greek statue missing its arms?", a: "Nike of Samothrace", b: "Discobolus", c: "Venus de Milo", d: "Laocoon", ans: 'c' },
    { q: "Who wrote 'Crime and Punishment'?", a: "Leo Tolstoy", b: "Fyodor Dostoevsky", c: "Anton Chekhov", d: "Ivan Turgenev", ans: 'b' },
    { q: "What French impressionist was known for painting ballerinas?", a: "Monet", b: "Renoir", c: "Degas", d: "Manet", ans: 'c' },
    { q: "Who wrote 'The Adventures of Huckleberry Finn'?", a: "Edgar Allan Poe", b: "Mark Twain", c: "Nathaniel Hawthorne", d: "John Steinbeck", ans: 'b' },
    { q: "What painting by Grant Wood depicts a farmer and woman in front of a house?", a: "Christina's World", b: "Nighthawks", c: "American Gothic", d: "The Gleaners", ans: 'c' },
    { q: "Who wrote 'Brave New World'?", a: "George Orwell", b: "Ray Bradbury", c: "Aldous Huxley", d: "Philip K. Dick", ans: 'c' },
    { q: "What nationality was the painter Frida Kahlo?", a: "Spanish", b: "Colombian", c: "Argentinian", d: "Mexican", ans: 'd' },
    { q: "Who wrote 'Wuthering Heights'?", a: "Jane Austen", b: "Charlotte Brontë", c: "Emily Brontë", d: "George Eliot", ans: 'c' },
    { q: "What is the name of Gaudí's famous unfinished cathedral in Barcelona?", a: "Cathedral of Santiago", b: "Sagrada Família", c: "La Pedrera", d: "Casa Batlló", ans: 'b' },
    { q: "Who wrote 'The Divine Comedy'?", a: "Petrarch", b: "Boccaccio", c: "Dante Alighieri", d: "Virgil", ans: 'c' },
    { q: "Who wrote 'Of Mice and Men'?", a: "Ernest Hemingway", b: "John Steinbeck", c: "William Faulkner", d: "F. Scott Fitzgerald", ans: 'b' },
    { q: "Who composed 'The Four Seasons'?", a: "Bach", b: "Mozart", c: "Vivaldi", d: "Handel", ans: 'c' },
    { q: "Who wrote 'Anna Karenina'?", a: "Fyodor Dostoevsky", b: "Leo Tolstoy", c: "Anton Chekhov", d: "Ivan Turgenev", ans: 'b' },
    { q: "What art movement features melting clocks?", a: "Impressionism", b: "Expressionism", c: "Cubism", d: "Surrealism", ans: 'd' },
    { q: "Who wrote 'The Count of Monte Cristo'?", a: "Victor Hugo", b: "Stendhal", c: "Alexandre Dumas", d: "Honoré de Balzac", ans: 'c' },
    { q: "Who wrote 'Frankenstein'?", a: "Bram Stoker", b: "Mary Shelley", c: "Edgar Allan Poe", d: "H.G. Wells", ans: 'b' },
    { q: "Who wrote 'The Old Man and the Sea'?", a: "F. Scott Fitzgerald", b: "John Steinbeck", c: "Ernest Hemingway", d: "William Faulkner", ans: 'c' },
    { q: "What art style uses small dots to create images?", a: "Impressionism", b: "Pointillism", c: "Fauvism", d: "Divisionism", ans: 'b' },
    { q: "Who wrote 'The Stranger'?", a: "Jean-Paul Sartre", b: "Albert Camus", c: "Simone de Beauvoir", d: "Samuel Beckett", ans: 'b' },
    { q: "Who composed Beethoven's Symphony No. 5 (da-da-da-DUM)?", a: "Mozart", b: "Bach", c: "Beethoven", d: "Brahms", ans: 'c' },
    { q: "Who sculpted 'The Thinker'?", a: "Michelangelo", b: "Bernini", c: "Rodin", d: "Brancusi", ans: 'c' },
    { q: "Who wrote 'Lord of the Flies'?", a: "J.R.R. Tolkien", b: "C.S. Lewis", c: "William Golding", d: "Aldous Huxley", ans: 'c' },
    { q: "What musical term means gradually getting louder?", a: "Diminuendo", b: "Crescendo", c: "Forte", d: "Allegro", ans: 'b' },
    { q: "Who wrote 'The Iliad'?", a: "Virgil", b: "Sophocles", c: "Euripides", d: "Homer", ans: 'd' },
    { q: "Who painted 'Starry Night'?", a: "Paul Gauguin", b: "Paul Cézanne", c: "Vincent van Gogh", d: "Henri Matisse", ans: 'c' },
    { q: "Who wrote 'One Flew Over the Cuckoo's Nest'?", a: "Ken Kesey", b: "Jack Kerouac", c: "Hunter S. Thompson", d: "Joseph Heller", ans: 'a' },
    { q: "What architect designed the Guggenheim Museum in New York?", a: "Mies van der Rohe", b: "Le Corbusier", c: "Frank Lloyd Wright", d: "Louis Sullivan", ans: 'c' },
    { q: "Who wrote 'War and Peace'?", a: "Fyodor Dostoevsky", b: "Leo Tolstoy", c: "Anton Chekhov", d: "Nikolai Gogol", ans: 'b' },
    { q: "What art period directly preceded the Renaissance?", a: "Baroque", b: "Medieval/Gothic", c: "Romantic", d: "Classical", ans: 'b' },
    { q: "Who wrote 'The Hobbit'?", a: "C.S. Lewis", b: "George R.R. Martin", c: "J.R.R. Tolkien", d: "Terry Pratchett", ans: 'c' },
    { q: "Who painted 'Water Lilies'?", a: "Edgar Degas", b: "Pierre-Auguste Renoir", c: "Claude Monet", d: "Édouard Manet", ans: 'c' },
    { q: "Who wrote 'The Picture of Dorian Gray'?", a: "George Bernard Shaw", b: "Oscar Wilde", c: "James Joyce", d: "Samuel Beckett", ans: 'b' },
  ],
};

let activeGame = null;

function buildSpinFrame(highlightIdx) {
  const lines = CATEGORIES.map((cat, i) =>
    i === highlightIdx ? `▶ ${cat.emoji} **${cat.label}**` : `　 ${cat.emoji} ${cat.label}`
  );
  return `🎰 **TRIVIA CRACK** 🎰\n\n${lines.join('\n')}`;
}

function buildQuestionMsg(game) {
  const { category, q } = game;
  return [
    `${category.emoji} **${category.label.toUpperCase()}**`,
    ``,
    `**${q.q}**`,
    ``,
    `**A)** ${q.a}`,
    `**B)** ${q.b}`,
    `**C)** ${q.c}`,
    `**D)** ${q.d}`,
    ``,
    `*Type A, B, C, or D — first right answer wins **${REWARD} milk bucks**! ⏱ 15s*`,
  ].join('\n');
}

function check(message) {
  if (!activeGame) return false;
  const ans = message.content.trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(ans)) return false;

  const { q, channel, timeout } = activeGame;
  const correct = q.ans.toUpperCase();

  if (ans !== correct) {
    message.reply(`❌ Nope. 🥛`);
    return true;
  }

  clearTimeout(timeout);
  activeGame = null;

  const userId = message.author.id;
  const username = message.author.username;
  const newStreak = ws.recordWin(userId);
  const multiplier = newStreak >= 3 ? 1.5 : 1;
  const reward = Math.floor(REWARD * multiplier);

  const balances = getData(balancesPath);
  balances[userId] = (balances[userId] || 0) + reward;
  saveData(balancesPath, balances);

  const xp = getData(xpPath);
  xp[userId] = (xp[userId] || 0) + Math.floor(15 * (state.doubleXp ? 2 : 1) * multiplier);
  saveData(xpPath, xp);

  channel.send(
    `✅ **${username}** got it! The answer was **${correct}**.\n` +
    `They win **${reward} milk bucks**!` + (multiplier > 1 ? ` *(🔥 1.5x hot streak)*` : '') + ` 🥛`
  );

  ach.check(userId, username, 'trivia_win', { balance: balances[userId], xp: xp[userId], streak: newStreak }, channel);

  if (newStreak === 3) {
    channel.send(`🔥 **${username} is on a HOT STREAK!** 3 wins in a row — 1.5x on everything! 🥛`);
  }

  return true;
}

module.exports = {
  name: 'tr',
  aliases: ['trivia'],
  description: 'Trivia Crack — spin for a category, first to answer wins 20 milk bucks.',
  check,
  execute(message) {
    if (activeGame) {
      return message.reply(`A trivia question is already going! Type A, B, C, or D. ⏳`);
    }

    const catIndex = Math.floor(Math.random() * CATEGORIES.length);
    const category = CATEGORIES[catIndex];
    const pool = QUESTIONS[category.key];
    const q = pool[Math.floor(Math.random() * pool.length)];

    // Spin through 5 frames then land on final category
    const spins = [
      (catIndex + 3) % CATEGORIES.length,
      (catIndex + 5) % CATEGORIES.length,
      (catIndex + 2) % CATEGORIES.length,
      (catIndex + 4) % CATEGORIES.length,
      (catIndex + 1) % CATEGORIES.length,
    ];

    message.channel.send(buildSpinFrame(spins[0])).then(spinMsg => {
      // Cycle through intermediate frames
      spins.slice(1).forEach((pos, i) => {
        setTimeout(() => spinMsg.edit(buildSpinFrame(pos)).catch(() => {}), 600 * (i + 1));
      });

      // Land on final category at 2400ms
      setTimeout(() => spinMsg.edit(buildSpinFrame(catIndex)).catch(() => {}), 2400);

      // Show question at 3400ms
      setTimeout(() => {
        const game = { category, q, channel: message.channel, timeout: null };

        const timeout = setTimeout(() => {
          if (!activeGame) return;
          activeGame = null;
          message.channel.send(
            `⏰ Time's up! Nobody got it. The answer was **${q.ans.toUpperCase()}** — ${q[q.ans]}. 🥛`
          );
        }, GAME_TIME);

        game.timeout = timeout;
        activeGame = game;

        spinMsg.edit(buildQuestionMsg(game)).catch(() => {});
      }, 3400);
    }).catch(console.error);
  }
};
