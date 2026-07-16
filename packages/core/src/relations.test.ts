import { describe, expect, it } from "vitest";
import { relatedTaskIds } from "./relations";
import { indexTasks } from "./store";
import type { Task } from "./types";

const D = 86_400_000;
const mk = (id: string, parentId: string | null = null): Task => ({
  id,
  name: id,
  start: 0,
  end: D,
  parentId,
});

// project > (phaseA > (leaf1, leaf2), phaseB > leaf3); other tree: p2 > x
const idx = indexTasks([
  mk("project"),
  mk("phaseA", "project"),
  mk("leaf1", "phaseA"),
  mk("leaf2", "phaseA"),
  mk("phaseB", "project"),
  mk("leaf3", "phaseB"),
  mk("p2"),
  mk("x", "p2"),
]);

const wholeTree = ["leaf1", "leaf2", "leaf3", "phaseA", "phaseB", "project"];

describe("relatedTaskIds", () => {
  it("leaf selection includes the ENTIRE tree: siblings, cousins, all phases", () => {
    expect([...relatedTaskIds(idx, "leaf1")].sort()).toEqual(wholeTree);
  });

  it("phase selection also yields the whole tree", () => {
    expect([...relatedTaskIds(idx, "phaseB")].sort()).toEqual(wholeTree);
  });

  it("root selection yields the whole tree", () => {
    expect([...relatedTaskIds(idx, "project")].sort()).toEqual(wholeTree);
  });

  it("never leaks into other trees", () => {
    const ids = relatedTaskIds(idx, "leaf1");
    expect(ids.has("p2")).toBe(false);
    expect(ids.has("x")).toBe(false);
  });

  it("standalone root highlights just itself and unknown id yields empty set", () => {
    expect([...relatedTaskIds(idx, "p2")].sort()).toEqual(["p2", "x"]);
    expect(relatedTaskIds(idx, "nope").size).toBe(0);
  });
});
