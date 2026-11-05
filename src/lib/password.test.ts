import { describe, expect, it } from "vitest";
import { COMMON_WORDS } from "./common-passwords";
import { passwordIssue, passwordStrength } from "./password";

const PHRASES = [
  "correto cavalo bateria grampo",
  "minha avó faz bolo de fubá",
  "Meu cachorro chama Thor!",
  "senha-forte-ok",
];

describe("password policy", () => {
  it("keeps the common-word list short, plain and unique", () => {
    expect(COMMON_WORDS.length).toBeGreaterThanOrEqual(280);
    expect(new Set(COMMON_WORDS).size).toBe(COMMON_WORDS.length);
    for (const word of COMMON_WORDS) expect(word).toMatch(/^[a-z]{4,}$/);
  });

  it("blocks repeats, keyboard walks, common words and short numeric pins", () => {
    expect(passwordIssue("12345678")).toMatch(/12/);
    expect(passwordIssue("123456789012")).toMatch(/sequência/);
    expect(passwordIssue("234567890123")).toMatch(/sequência/);
    expect(passwordIssue("senha1234567")).toMatch(/comum/);
    expect(passwordIssue("aaaaaaaaaaaa")).toMatch(/sequência/);
    expect(passwordIssue("qwertyuiopas")).toMatch(/sequência/);
    for (const weak of [
      "senhasenhasenha",
      "passwordpassword",
      "qwertyqwerty",
      "abcabcabcabc",
      "12121212121212",
      "aaaaaaaaaaab",
      "1q2w3e4r5t6y7u",
      "Corinthians123",
      "mudar@123456",
      "JoaoSilva12345",
      "brasilbrasil",
      "senha2024",
    ]) {
      expect(passwordIssue(weak), weak).not.toBeNull();
    }
    expect(passwordIssue("90817263540981")).toMatch(/números/);
    expect(passwordIssue("9081726354098172")).toBeNull();
  });

  it("accepts a passphrase that is not built from the common list", () => {
    for (const phrase of PHRASES) expect(passwordIssue(phrase), phrase).toBeNull();
    expect(passwordStrength("senha-forte-ok")).toBeGreaterThan(0);
    expect(passwordStrength("123456789012")).toBe(0);
    expect(passwordStrength("AaAa1!BbBb2@CcCc")).toBeLessThanOrEqual(2);
  });
});
