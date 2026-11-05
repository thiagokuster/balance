import { describe, expect, it, vi } from "vitest";
import { clearUnlockFailures, noteUnlockFailure, unlockDelaySeconds } from "./unlock-attempts";

describe("unlock attempts", () => {
  it("ignores a negative or invalid counter", () => {
    localStorage.setItem("saldo-tentativas", JSON.stringify({ count: -3, until: Number.NaN }));
    expect(unlockDelaySeconds()).toBe(0);
    expect(noteUnlockFailure()).toBe(1);
  });

  it("still reports a wrong password when storage rejects the write", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      expect(noteUnlockFailure()).toBe(0);
      expect(() => clearUnlockFailures()).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
