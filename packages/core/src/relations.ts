import type { TaskIndex } from "./store";

/**
 * The entire tree a task belongs to: walk up to its root ancestor, then
 * include the root's full subtree — siblings, cousins, everything in the
 * same project tree. Used to highlight the selection context.
 */
export function relatedTaskIds(index: TaskIndex, id: string): Set<string> {
  const out = new Set<string>();
  let cur = index.byId.get(id);
  if (!cur) return out;
  // climb to the root of this task's tree
  const seen = new Set<string>([cur.id]);
  while (cur.parentId != null) {
    const parent = index.byId.get(cur.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    cur = parent;
  }
  // include the root's entire subtree
  const walk = (tid: string) => {
    out.add(tid);
    for (const c of index.children.get(tid) ?? []) walk(c);
  };
  walk(cur.id);
  return out;
}
