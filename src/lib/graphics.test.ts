import { describe, expect, it } from "vitest";
import { pixelRatioFor } from "./graphics";
import { kuyangHeight } from "./kuyang3d";
describe("graphics", () => {
  it("ultra FHD uses full device pixels up to 3", () => { expect(pixelRatioFor("ultra", 3.5, true, true)).toBe(3); expect(pixelRatioFor("ultra", 2.6, true, false)).toBe(2.6); });
  it("hemat renders at 0.75", () => expect(pixelRatioFor("hemat", 3, false, false)).toBe(0.75));
});
describe("kuyang", () => {
  it("hovers between 1.8 and 2.4 m", () => { for (let t = 0; t < 20; t += 0.13) { const h = kuyangHeight(t); expect(h).toBeGreaterThanOrEqual(1.8); expect(h).toBeLessThanOrEqual(2.4); } });
});
