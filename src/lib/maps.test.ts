import { afterEach, describe, expect, it } from "vitest";
import { applyMap, DOORS, liftAt, liftExit, MAPS, move, nearestDoor, ROOMS, setDoorOpen } from "./game";

afterEach(() => applyMap("rumah"));
describe("maps", () => {
  it("offers exactly 4 maps", () => { expect(MAPS.map((m) => m.id)).toEqual(["rumah", "rumahsakit", "kuburan", "hotel"]); });
  it("hotel floors are separated: walking through the old doorway is blocked", () => {
    applyMap("hotel");
    expect(move(750, 470, 0, 60).y).toBeLessThan(500);
    applyMap("rumahsakit");
    setDoorOpen(nearestDoor(750, 500), true);
    expect(move(750, 470, 0, 60).y).toBeGreaterThan(500);
  });
  it("hotel lift 2 sits exactly 500px (one floor) below lift 1, so the cabin rides one shaft", () => {
    applyMap("hotel"); expect(liftAt(750, 410)?.floor).toBe(1); expect(liftAt(750, 910)?.floor).toBe(2);
    expect(liftExit({ x: 750, y: 910 })).toEqual({ x: 750, y: 860 });
    expect(ROOMS[0]!.name).toContain("Lt.1");
    applyMap("rumah"); expect(liftAt(750, 410)).toBeNull();
  });
});
describe("doors", () => {
  it("start closed and block walking until clicked open", () => {
    applyMap("rumahsakit");
    const i = nearestDoor(500, 250); expect(i).toBeGreaterThanOrEqual(0); expect(DOORS[i]!.v).toBe(true);
    expect(move(470, 250, 60, 0).x).toBeLessThan(500);
    setDoorOpen(i, true);
    expect(move(470, 250, 60, 0).x).toBeGreaterThan(500);
  });
  it("close again after a map reset", () => {
    applyMap("rumahsakit"); const i = nearestDoor(500, 250); setDoorOpen(i, true);
    applyMap("rumahsakit"); expect(move(470, 250, 60, 0).x).toBeLessThan(500);
  });
});
