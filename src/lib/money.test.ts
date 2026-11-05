import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";

describe("parseMoney", () => {
  it("reads thousands separators used in Brazil", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("R$ 10,5")).toBe(10.5);
    expect(parseMoney("1.234")).toBe(1234);
    expect(parseMoney("1234.56")).toBe(1234.56);
    expect(parseMoney("1.234.567,89")).toBe(1234567.89);
  });

  it("rejects an incomplete number", () => {
    expect(parseMoney("")).toBeNaN();
    expect(parseMoney("12,34,56")).toBeNaN();
  });
});
