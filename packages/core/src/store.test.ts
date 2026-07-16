import { describe, expect, it } from "vitest";
import { dateBounds, indexTasks, moveTask, rowIndexById, visibleRows } from "./store";
import type { Task } from "./types";

const D = 86_400_000;
const mk = (id: string, parentId: string | null = null, start = 0, end = D): Task => ({
  id,
  name: id,
  start,
  end,
  parentId,
});

const tasks: Task[] = [
  mk("a"),
  mk("a1", "a", D, 2 * D),
  mk("a2", "a", 2 * D, 3 * D),
  mk("b"),
  mk("b1", "b"),
];

describe("task index", () => {
  it("indexes roots and children in input order", () => {
    const idx = indexTasks(tasks);
    expect(idx.roots).toEqual(["a", "b"]);
    expect(idx.children.get("a")).toEqual(["a1", "a2"]);
  });

  it("treats tasks with unknown parents as roots", () => {
    const idx = indexTasks([mk("x", "missing")]);
    expect(idx.roots).toEqual(["x"]);
  });
});

describe("visibleRows", () => {
  it("flattens depth-first with depths", () => {
    const rows = visibleRows(indexTasks(tasks), new Set());
    expect(rows.map((r) => r.task.id)).toEqual(["a", "a1", "a2", "b", "b1"]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0, 1]);
    expect(rows[0]!.hasChildren).toBe(true);
    expect(rows[1]!.hasChildren).toBe(false);
  });

  it("hides descendants of collapsed tasks", () => {
    const rows = visibleRows(indexTasks(tasks), new Set(["a"]));
    expect(rows.map((r) => r.task.id)).toEqual(["a", "b", "b1"]);
  });

  it("row index lookup matches order", () => {
    const rows = visibleRows(indexTasks(tasks), new Set());
    const m = rowIndexById(rows);
    expect(m.get("a2")).toBe(2);
    expect(m.get("b")).toBe(3);
  });
});

describe("mutation helpers", () => {
  it("moveTask replaces dates immutably", () => {
    const next = moveTask(tasks, "a1", 5 * D, 6 * D);
    expect(next.find((t) => t.id === "a1")).toMatchObject({ start: 5 * D, end: 6 * D });
    expect(tasks.find((t) => t.id === "a1")!.start).toBe(D); // original untouched
  });

  it("dateBounds spans all tasks", () => {
    expect(dateBounds(tasks)).toEqual({ min: 0, max: 3 * D });
    expect(dateBounds([])).toBeNull();
  });
});
