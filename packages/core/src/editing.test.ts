import { describe, expect, it } from "vitest";
import { History } from "./history";
import { insertTaskAfter, removeLinksForTasks, removeTask } from "./store";
import type { Link, Task } from "./types";

const D = 86_400_000;
const mk = (id: string, parentId: string | null = null): Task => ({
  id,
  name: id,
  start: 0,
  end: D,
  parentId,
});

const tasks: Task[] = [mk("a"), mk("a1", "a"), mk("a1x", "a1"), mk("b")];
const links: Link[] = [
  { id: "l1", sourceId: "a1", targetId: "b" },
  { id: "l2", sourceId: "b", targetId: "a" },
];

describe("removeTask", () => {
  it("removes a task and all descendants", () => {
    const { tasks: next, removedIds } = removeTask(tasks, "a");
    expect(next.map((t) => t.id)).toEqual(["b"]);
    expect([...removedIds].sort()).toEqual(["a", "a1", "a1x"]);
  });

  it("removes a leaf without touching siblings", () => {
    const { tasks: next } = removeTask(tasks, "a1x");
    expect(next.map((t) => t.id)).toEqual(["a", "a1", "b"]);
  });

  it("removeLinksForTasks drops links touching removed ids", () => {
    const { removedIds } = removeTask(tasks, "a1");
    expect(removeLinksForTasks(links, removedIds).map((l) => l.id)).toEqual(["l2"]);
  });
});

describe("insertTaskAfter", () => {
  it("inserts after the given id", () => {
    const next = insertTaskAfter(tasks, mk("new"), "a1");
    expect(next.map((t) => t.id)).toEqual(["a", "a1", "new", "a1x", "b"]);
  });

  it("appends when afterId is missing or omitted", () => {
    expect(insertTaskAfter(tasks, mk("new"), "nope").at(-1)!.id).toBe("new");
    expect(insertTaskAfter(tasks, mk("new")).at(-1)!.id).toBe("new");
  });
});

describe("History", () => {
  it("undoes and redoes states", () => {
    const h = new History<number>();
    h.push(1); // state 1 replaced by 2
    h.push(2); // state 2 replaced by 3
    expect(h.canUndo).toBe(true);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeNull();
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.redo(3)).toBeNull();
  });

  it("push clears the redo stack", () => {
    const h = new History<number>();
    h.push(1);
    h.undo(2);
    expect(h.canRedo).toBe(true);
    h.push(9);
    expect(h.canRedo).toBe(false);
  });

  it("respects the size limit", () => {
    const h = new History<number>(2);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBeNull(); // 1 was evicted
  });
});
