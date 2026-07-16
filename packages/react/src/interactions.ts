import { DAY, snapToDay, type Row, type Task, type TimeScale } from "@snps/gantt-core";
import { barBox } from "./draw";

export type HitRegion = "bar" | "resize-l" | "resize-r" | "link-handle" | "row" | "header" | "empty";

export interface Hit {
  region: HitRegion;
  rowIndex: number;
  task: Task | null;
}

export interface HitContext {
  rows: Row[];
  scale: TimeScale;
  scrollX: number;
  scrollY: number;
  rowHeight: number;
  headerH: number;
}

const EDGE = 5;

/**
 * Hit-test viewport coordinates (cx, cy relative to the timeline pane)
 * against rows/bars. Shares coordinate math with the canvas painter.
 */
export function hitTest(cx: number, cy: number, ctx: HitContext): Hit {
  if (cy < ctx.headerH) return { region: "header", rowIndex: -1, task: null };
  const contentY = cy - ctx.headerH + ctx.scrollY;
  const rowIndex = Math.floor(contentY / ctx.rowHeight);
  const row = ctx.rows[rowIndex];
  if (!row) return { region: "empty", rowIndex: -1, task: null };

  const task = row.task;
  const contentX = cx + ctx.scrollX;
  const { x0, x1, h } = barBox(task, ctx.scale, ctx.rowHeight);
  const type = task.type ?? "task";

  if (type === "milestone") {
    const r = h / 2 + 2;
    if (Math.abs(contentX - x0) <= r) return { region: "bar", rowIndex, task };
    return { region: "row", rowIndex, task };
  }

  if (contentX >= x1 + 3 && contentX <= x1 + 14) {
    return { region: "link-handle", rowIndex, task };
  }
  if (contentX >= x0 - EDGE && contentX <= x0 + EDGE) return { region: "resize-l", rowIndex, task };
  if (contentX >= x1 - EDGE && contentX <= x1 + EDGE) return { region: "resize-r", rowIndex, task };
  if (contentX > x0 && contentX < x1) return { region: "bar", rowIndex, task };
  return { region: "row", rowIndex, task };
}

export type DragMode = "move" | "resize-l" | "resize-r";

/**
 * Apply a drag delta (in ms) to a task and snap the result to day
 * boundaries. Enforces a minimum duration of one day (0 for milestones).
 */
export function applyDrag(task: Task, mode: DragMode, dMs: number): { start: number; end: number } {
  const duration = task.end - task.start;
  if ((task.type ?? "task") === "milestone" || mode === "move") {
    const start = snapToDay(task.start + dMs);
    return { start, end: start + duration };
  }
  if (mode === "resize-l") {
    const start = Math.min(snapToDay(task.start + dMs), task.end - DAY);
    return { start, end: task.end };
  }
  const end = Math.max(snapToDay(task.end + dMs), task.start + DAY);
  return { start: task.start, end };
}

export function cursorFor(region: HitRegion): string {
  switch (region) {
    case "resize-l":
    case "resize-r":
      return "ew-resize";
    case "bar":
      return "grab";
    case "link-handle":
      return "crosshair";
    default:
      return "default";
  }
}
