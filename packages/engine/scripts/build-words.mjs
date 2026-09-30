// Builds src/data/words.json from SCOWL frequency tiers 10 + 20 (common English).
import { readFileSync, writeFileSync } from 'node:fs';

const tier = (n) =>
  JSON.parse(readFileSync(new URL(`../../../node_modules/wordlist-english/english-words-${n}.json`, import.meta.url)));

const BLOCK = new Set(
  'ass asses arse bastard bastards bitch bitches bloody crap damn damned dick dicks fuck fucked fucking hell hells piss pissed porn rape raped rapes raping rapist sex sexes sexual sexually sexy shit slut whore nazi nazis penis vagina anal cock cocks cum dildo fag suicide suicidal breast breasts nude naked erotic orgasm kill killed killer killing murder murdered murderer abortion drug drugs cocaine heroin'.split(' '),
);

const words = [...new Set([...tier(10), ...tier(20)])]
  .filter((w) => /^[a-z]{3,12}$/.test(w) && !BLOCK.has(w))
  .sort();

writeFileSync(new URL('../src/content/words.json', import.meta.url), JSON.stringify(words));
console.log(`wrote ${words.length} words`);
