import { describe, expect, it } from "vitest";
import { routeLink } from "./deps";

describe("routeLink", () => {
  it("uses a Z shape when target is right of source", () => {
    const pts = routeLink(100, 16, 200, 48, 32);
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ x: 100, y: 16 });
    expect(pts.at(-1)).toEqual({ x: 200, y: 48 });
    // orthogonal segments only
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i]!.x - pts[i - 1]!.x;
      const dy = pts[i]!.y - pts[i - 1]!.y;
      expect(dx === 0 || dy === 0).toBe(true);
    }
  });

  it("uses an S shape when target starts left of source end", () => {
    const pts = routeLink(300, 16, 250, 48, 32);
    expect(pts.length).toBe(6);
    expect(pts[0]).toEqual({ x: 300, y: 16 });
    expect(pts.at(-1)).toEqual({ x: 250, y: 48 });
  });
});
