import { describe, expect, it } from "vitest";
import { daysIn } from "./DateWheel";
describe("daysIn", () => {
  it("Februari kabisat 29 hari", () => { expect(daysIn(2024, 2)).toBe(29); });
  it("Februari biasa 28 hari", () => { expect(daysIn(2023, 2)).toBe(28); });
  it("April 30 hari", () => { expect(daysIn(2023, 4)).toBe(30); });
});
