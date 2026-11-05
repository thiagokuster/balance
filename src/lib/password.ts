const COMMON = new Set([
  "123456",
  "123456789",
  "1234567890",
  "123456789012",
  "1234567890123",
  "password",
  "password1",
  "password123",
  "password1234",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "senha",
  "senha123",
  "senha1234",
  "senha12345",
  "senha123456",
  "admin",
  "admin123",
  "letmein",
  "welcome",
  "iloveyou",
  "brasil",
  "brasil123",
  "flamengo",
  "master",
  "login",
  "abc123",
  "111111",
  "000000",
]);

const WORDS = ["senha", "password", "qwerty", "admin", "brasil", "letmein", "welcome", "flamengo"];

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
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  return rows.some(
    (row) => value.includes(row) || row.includes(value) || (row + row).includes(value),
  );
}

/** Returns a reason to refuse a new password, or null when it can be used. */
export function passwordIssue(password: string): string | null {
  if (password.length < 12) return "Use pelo menos 12 caracteres.";
  if (password.length > 128) return "Use no máximo 128 caracteres.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[^a-z0-9]/g, ""))) {
    return "Essa senha é comum demais.";
  }
  if (WORDS.some((word) => lower.replace(/[^a-z]/g, "") === word)) {
    return "Essa senha é comum demais.";
  }
  if (/^(.)\1+$/.test(password) || isSequence(lower) || isKeyboardWalk(lower)) {
    return "Não use uma sequência óbvia.";
  }
  return null;
}

/** 0 is unusable. 4 is a long mixed passphrase. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (passwordIssue(password)) return 0;
  let score = 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (password.length >= 20 && /[^\da-zA-Z]/.test(password)) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
