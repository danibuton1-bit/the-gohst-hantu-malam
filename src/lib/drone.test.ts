import { describe, expect, it } from "vitest";
import { damp, DRONE } from "@/components/DroneView";

describe("drone smoothing", () => {
  it("moves part of the way per frame, never overshoots", () => {
    const v = damp(0, 10, DRONE.CAM_DAMP, 0.016);
    expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(10);
  });
  it("height limits allow going up and down", () => {
    expect(DRONE.MAX_H).toBeGreaterThan(DRONE.MIN_H);
  });
});
