import { COMMON_WORDS } from "./common-passwords";

const WORDS = new Set<string>(COMMON_WORDS);

const KEYBOARD_WALKS = [
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "poiuytrewq",
  "lkjhgfdsa",
  "mnbvcxz",
  "1q2w3e4r5t6y7u",
  "u7y6t5r4e3w2q1",
  "1qaz2wsx",
  "xsw2zaq1",
  "zaq12wsx",
  "xsw21qaz",
  "1qaz2wsx3edc",
  "qazwsxedcrfv",
];

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSequence(value: string) {
  const codes = [...value].map((char) => char.charCodeAt(0));
  const ascending = codes.every((code, index) => index === 0 || code === codes[index - 1]! + 1);
  const descending = codes.every((code, index) => index === 0 || code === codes[index - 1]! - 1);
  if (ascending || descending) return true;
  if (!/^\d+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const up = digits.every((digit, index) => index === 0 || digit === (digits[index - 1]! + 1) % 10);
  const down = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1]! + 9) % 10,
  );
  return up || down;
}

function isKeyboardWalk(value: string) {
  return KEYBOARD_WALKS.some(
    (row) => value.includes(row) || row.includes(value) || (row + row).includes(value),
  );
}

function fits(text: string, index: number, word: string) {
  if (index + word.length > text.length) return false;
  for (let offset = 0; offset < word.length; offset++) {
    const char = text[index + offset];
    const expected = word[offset];
    if (char === expected) continue;
    if (char === "1" && (expected === "i" || expected === "l")) continue;
    return false;
  }
  return true;
}

/** True when every letter is one or more words from the common list. */
function canSegment(text: string) {
  if (!text) return false;
  const memo = new Array<boolean | undefined>(text.length + 1);
  const walk = (index: number): boolean => {
    if (index === text.length) return true;
    const cached = memo[index];
    if (cached !== undefined) return cached;
    for (const word of WORDS) {
      if (!fits(text, index, word)) continue;
      if (walk(index + word.length)) {
        memo[index] = true;
        return true;
      }
    }
    memo[index] = false;
    return false;
  };
  return walk(0);
}

function plainLetters(value: string) {
  return fold(value).replace(/[^a-z]/g, "");
}

function applyLeet(value: string) {
  return value
    .replaceAll("0", "o")
    .replaceAll("3", "e")
    .replaceAll("4", "a")
    .replaceAll("5", "s")
    .replaceAll("7", "t")
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replace(/[^a-z1]/g, "");
}

/**
 * Two readings: one drops a trailing year or symbols before lookalike letters
 * (so 2024!! cannot become letters and hide the word), and one keeps that
 * tail so a final digit can still be a letter, as in senh4.
 */
function leetReadings(value: string) {
  const folded = fold(value);
  return [applyLeet(folded.replace(/[^a-z]+$/, "")), applyLeet(folded)];
}

function usesCommonWords(password: string) {
  return canSegment(plainLetters(password)) || leetReadings(password).some(canSegment);
}

/** Returns a reason to refuse a new password, or null when it can be used. */
export function passwordIssue(password: string): string | null {
  if (password.length < 12) return "Use pelo menos 12 caracteres.";
  if (password.length > 128) return "Use no máximo 128 caracteres.";
  const lower = fold(password);
  if (/^(.{1,8})\1+$/i.test(password) || isSequence(lower) || isKeyboardWalk(lower)) {
    return "Não use uma sequência óbvia.";
  }
  if (new Set([...lower]).size < 6) return "Use pelo menos 6 caracteres diferentes.";
  if (usesCommonWords(password)) return "Essa senha é comum demais.";
  if (/^\d+$/.test(password) && password.length < 16) {
    return "Não use só números com menos de 16 dígitos.";
  }
  return null;
}

/** 0 is unusable. 4 is a long mixed passphrase. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  if (passwordIssue(password)) return 0;
  let score = 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (password.length >= 20 && /[^\da-zA-Z]/.test(password)) score += 1;
  if (new Set([...fold(password)]).size < 8) score = Math.min(score, 2);
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
