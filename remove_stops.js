import { readFileSync } from 'fs';

const STOP_WORDS = [
  'is',
  'the',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'if',
  'in',
  'into',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'such',
  'that', 
  'their',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'will',
  'with',
  'queer'
];

// Process the file of words.
const mobyDickWords = readFileSync('moby_dick_just_words.txt', 'utf-8').split(' ');
let cleanedUpWords = '';

for (const word of mobyDickWords) {
  const lowerWord = word.toLowerCase();
  if (lowerWord.length > 4 && !STOP_WORDS.includes(lowerWord)) {
    cleanedUpWords = `${cleanedUpWords} ${lowerWord}`;
  }
}

console.log(cleanedUpWords.trim());