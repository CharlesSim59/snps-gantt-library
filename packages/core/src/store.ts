import type { Link, Row, Task } from "./types";

/** Flat indexes derived from a task array. Rebuild when tasks change. */
export interface TaskIndex {
  byId: Map<string, Task>;
  /** children ids in input order, keyed by parent id ("" = roots) */
  children: Map<string, string[]>;
  roots: string[];
}

const ROOT = "";

export function indexTasks(tasks: readonly Task[]): TaskIndex {
  const byId = new Map<string, Task>();
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const t of tasks) byId.set(t.id, t);
  for (const t of tasks) {
    const pid = t.parentId != null && byId.has(t.parentId) ? t.parentId : ROOT;
    if (pid === ROOT) roots.push(t.id);
    let arr = children.get(pid);
    if (!arr) children.set(pid, (arr = []));
    arr.push(t.id);
  }
  return { byId, children, roots };
}

export interface VisibleRowsOptions {
  /** sorts siblings within each parent; hierarchy is preserved */
  compare?: (a: Task, b: Task) => number;
  /** when set, only these ids are rendered (see filterTaskIds) */
  visible?: ReadonlySet<string>;
}

/**
 * Flatten hierarchy to visible rows (depth-first), skipping children of
 * collapsed tasks. Optionally sorts siblings and filters by an id set.
 * Pure function of its inputs.
 */
export function visibleRows(
  index: TaskIndex,
  collapsed: ReadonlySet<string>,
  opts?: VisibleRowsOptions,
): Row[] {
  const out: Row[] = [];
  const compare = opts?.compare;
  const visible = opts?.visible;
  const walk = (ids: string[] | undefined, depth: number) => {
    if (!ids) return;
    let list = visible ? ids.filter((id) => visible.has(id)) : ids;
    if (compare) {
      list = [...list].sort((x, y) => {
        const a = index.byId.get(x);
        const b = index.byId.get(y);
        return a && b ? compare(a, b) : 0;
      });
    }
    for (const id of list) {
      const task = index.byId.get(id);
      if (!task) continue;
      const kids = index.children.get(id);
      out.push({ task, depth, hasChildren: !!kids && kids.length > 0 });
      if (!collapsed.has(id)) walk(kids, depth + 1);
    }
  };
  walk(index.roots, 0);
  return out;
}

/**
 * Ids to keep when filtering: every task matching the predicate, plus its
 * ancestors (so the tree stays navigable) and its descendants (so matching
 * a summary shows its subtree). Single O(n) pass.
 */
export function filterTaskIds(index: TaskIndex, predicate: (t: Task) => boolean): Set<string> {
  const visible = new Set<string>();
  const dfs = (id: string, ancestorMatch: boolean): boolean => {
    const task = index.byId.get(id);
    if (!task) return false;
    const self = predicate(task);
    let subtree = false;
    for (const c of index.children.get(id) ?? []) {
      subtree = dfs(c, ancestorMatch || self) || subtree;
    }
    if (self || ancestorMatch || subtree) visible.add(id);
    return self || subtree;
  };
  for (const r of index.roots) dfs(r, false);
  return visible;
}

/** Map task id -> visible row number. */
export function rowIndexById(rows: readonly Row[]): Map<string, number> {
  const m = new Map<string, number>();
  rows.forEach((r, i) => m.set(r.task.id, i));
  return m;
}

/** Overall [min start, max end] of all tasks; null when empty. */
export function dateBounds(tasks: readonly Task[]): { min: number; max: number } | null {
  if (tasks.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const t of tasks) {
    if (t.start < min) min = t.start;
    if (t.end > max) max = t.end;
  }
  return { min, max };
}

/** Immutable helpers used by hosts to apply changes to their task arrays. */
export function updateTask(tasks: readonly Task[], next: Task): Task[] {
  return tasks.map((t) => (t.id === next.id ? next : t));
}

export function moveTask(tasks: readonly Task[], id: string, start: number, end: number): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, start, end } : t));
}

/** Remove a task and all of its descendants. */
export function removeTask(
  tasks: readonly Task[],
  id: string,
): { tasks: Task[]; removedIds: Set<string> } {
  const index = indexTasks(tasks);
  const removedIds = new Set<string>();
  const collect = (tid: string) => {
    removedIds.add(tid);
    for (const c of index.children.get(tid) ?? []) collect(c);
  };
  collect(id);
  return { tasks: tasks.filter((t) => !removedIds.has(t.id)), removedIds };
}

/** Remove links that reference any of the given task ids. */
export function removeLinksForTasks(links: readonly Link[], ids: ReadonlySet<string>): Link[] {
  return links.filter((l) => !ids.has(l.sourceId) && !ids.has(l.targetId));
}

/** Insert a task right after `afterId` in array order (append when absent). */
export function insertTaskAfter(tasks: readonly Task[], task: Task, afterId?: string): Task[] {
  if (afterId !== undefined) {
    const i = tasks.findIndex((t) => t.id === afterId);
    if (i >= 0) return [...tasks.slice(0, i + 1), task, ...tasks.slice(i + 1)];
  }
  return [...tasks, task];
}
