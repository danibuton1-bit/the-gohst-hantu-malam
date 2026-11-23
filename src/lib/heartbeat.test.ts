import { expect, it } from "vitest";
import { isOffline } from "./heartbeat";
it("removes a player after 10 seconds offline", () => { expect(isOffline(0, 9_999)).toBe(false); expect(isOffline(0, 10_000)).toBe(true); });
