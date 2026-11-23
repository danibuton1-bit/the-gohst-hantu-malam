import { describe, expect, it } from "vitest";
import { squadBots } from "@/components/Game";
import { DRONE } from "@/components/DroneView";

describe("solo squad bots", () => {
  it("a solo player gets 3 hunter bot teammates", () => {
    const b = squadBots([{ karakter: "raka" }]);
    expect(b).toHaveLength(3);
    expect(b.every((x) => x.role === "hunter" && x.karakter !== "raka")).toBe(true);
  });
  it("a full squad of 4 gets no bots", () => {
    expect(squadBots([{ karakter: "raka" }, { karakter: "aisyah" }, { karakter: "qila" }, { karakter: "raka" }])).toHaveLength(0);
  });
  it("drone can fly up to 40m", () => { expect(DRONE.MAX_H).toBe(40); });
});
