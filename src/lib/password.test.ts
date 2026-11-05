import { describe, expect, it } from "vitest";
import { passwordIssue, passwordStrength } from "./password";

describe("password policy", () => {
  it("blocks short, common and sequential passwords", () => {
    expect(passwordIssue("12345678")).toMatch(/12/);
    expect(passwordIssue("123456789012")).toMatch(/comum/);
    expect(passwordIssue("234567890123")).toMatch(/sequência/);
    expect(passwordIssue("senha1234567")).toMatch(/comum/);
    expect(passwordIssue("aaaaaaaaaaaa")).toMatch(/sequência/);
    expect(passwordIssue("qwertyuiopas")).toMatch(/sequência/);
  });

  it("accepts a passphrase that is not a sequence", () => {
    expect(passwordIssue("senha-forte-ok")).toBeNull();
    expect(passwordStrength("senha-forte-ok")).toBeGreaterThan(0);
    expect(passwordStrength("123456789012")).toBe(0);
  });
});
