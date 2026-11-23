import { describe, expect, it } from "vitest";
import { COUNTDOWN_MS, secondsLeft } from "./squad-store";

describe("lobby countdown", () => {
  it("lasts 10 seconds", () => { expect(COUNTDOWN_MS).toBe(10_000); });
  it("shows 10 right after start", () => { const t = 1_000_000; expect(secondsLeft(new Date(t + COUNTDOWN_MS).toISOString(), t)).toBe(10); });
  it("is gone when cancelled", () => { expect(secondsLeft(null, Date.now())).toBeNull(); });
});
