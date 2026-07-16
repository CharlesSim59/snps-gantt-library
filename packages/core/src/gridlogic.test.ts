import { describe, expect, it } from "vitest";
import { filterTaskIds, indexTasks, visibleRows } from "./store";
import type { Task } from "./types";

const D = 86_400_000;
const mk = (id: string, parentId: string | null, start: number, dur: number): Task => ({
  id,
  name: id,
  start: start * D,
  end: (start + dur) * D,
  parentId,
});

// p1(c-late, a-early)  p2(zeta)  standalone
const tasks: Task[] = [
  mk("p1", null, 0, 20),
  mk("c-late", "p1", 10, 5),
  mk("a-early", "p1", 0, 2),
  mk("p2", null, 5, 10),
  mk("zeta", "p2", 5, 1),
  mk("standalone", null, 30, 1),
];
const idx = indexTasks(tasks);
const none = new Set<string>();

describe("visibleRows sorting", () => {
  it("sorts siblings within each parent, preserving hierarchy", () => {
    const byStart = (a: Task, b: Task) => a.start - b.start;
    const rows = visibleRows(idx, none, { compare: byStart });
    expect(rows.map((r) => r.task.id)).toEqual([
      "p1", "a-early", "c-late", "p2", "zeta", "standalone",
    ]);
  });

  it("descending sort reverses sibling order only", () => {
    const byName = (a: Task, b: Task) => b.name.localeCompare(a.name);
    const rows = visibleRows(idx, none, { compare: byName });
    // roots sorted desc: standalone, p2, p1 — children stay under parents
    expect(rows.map((r) => r.task.id)).toEqual([
      "standalone", "p2", "zeta", "p1", "c-late", "a-early",
    ]);
  });

  it("without options behaves as before", () => {
    expect(visibleRows(idx, none).map((r) => r.task.id)).toEqual([
      "p1", "c-late", "a-early", "p2", "zeta", "standalone",
    ]);
  });
});

describe("filterTaskIds", () => {
  it("keeps matches plus ancestors", () => {
    const ids = filterTaskIds(idx, (t) => t.id === "zeta");
    expect([...ids].sort()).toEqual(["p2", "zeta"]);
  });

  it("keeps descendants of a matching summary", () => {
    const ids = filterTaskIds(idx, (t) => t.id === "p1");
    expect([...ids].sort()).toEqual(["a-early", "c-late", "p1"]);
  });

  it("returns empty set when nothing matches", () => {
    expect(filterTaskIds(idx, () => false).size).toBe(0);
  });

  it("composes with visibleRows", () => {
    const ids = filterTaskIds(idx, (t) => t.id.includes("early"));
    const rows = visibleRows(idx, none, { visible: ids });
    expect(rows.map((r) => r.task.id)).toEqual(["p1", "a-early"]);
  });
});
