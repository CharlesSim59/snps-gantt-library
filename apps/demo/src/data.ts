import { DAY, type Link, type Task } from "@snps/gantt-core";

/**
 * Deterministic synthetic dataset: `groups` summary tasks, each with
 * `perGroup - 1` child tasks chained finish-to-start plus a closing
 * milestone. Spread over a ~2 year window.
 */
export function generateData(groups = 2500, perGroup = 20): { tasks: Task[]; links: Link[] } {
  const tasks: Task[] = [];
  const links: Link[] = [];
  const origin = Date.UTC(2026, 0, 5);
  const horizon = 730 * DAY;

  let seed = 42;
  const rand = () => {
    // xorshift — deterministic across runs
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 1000) / 1000;
  };

  for (let g = 0; g < groups; g++) {
    const groupStart = origin + Math.floor(rand() * (horizon / DAY - 60)) * DAY;
    const children = perGroup - 1;
    const summaryId = `g${g}`;
    let cursor = groupStart;
    let prevId: string | null = null;

    const childIds: string[] = [];
    for (let c = 0; c < children - 1; c++) {
      const id = `g${g}_t${c}`;
      const dur = (1 + Math.floor(rand() * 5)) * DAY;
      tasks.push({
        id,
        name: `Task ${g}.${c} — ${["design", "build", "test", "review", "deploy"][c % 5]}`,
        start: cursor,
        end: cursor + dur,
        progress: Math.round(rand() * 100) / 100,
        type: "task",
        parentId: summaryId,
      });
      if (prevId) links.push({ id: `l_${id}`, sourceId: prevId, targetId: id, type: "FS" });
      prevId = id;
      childIds.push(id);
      cursor += dur;
    }
    // closing milestone
    const msId = `g${g}_ms`;
    tasks.push({
      id: msId,
      name: `Milestone ${g}`,
      start: cursor,
      end: cursor,
      type: "milestone",
      parentId: summaryId,
    });
    if (prevId) links.push({ id: `l_${msId}`, sourceId: prevId, targetId: msId, type: "FS" });

    tasks.push({
      id: summaryId,
      name: `Project group ${g}`,
      start: groupStart,
      end: cursor,
      type: "summary",
      progress: 0,
    });
  }

  // summaries first-in-group ordering: indexTasks preserves input order per
  // parent; move summaries before their children for natural display order
  tasks.sort((a, b) => {
    const ga = a.id.startsWith("g") ? Number(a.id.slice(1).split("_")[0]) : 0;
    const gb = b.id.startsWith("g") ? Number(b.id.slice(1).split("_")[0]) : 0;
    if (ga !== gb) return ga - gb;
    const aIsSummary = a.type === "summary" ? 0 : 1;
    const bIsSummary = b.type === "summary" ? 0 : 1;
    return aIsSummary - bIsSummary;
  });

  return { tasks, links };
}
