import {
  DAY,
  dateToX,
  majorUnit,
  routeLink,
  ticks,
  type Link,
  type Row,
  type Task,
  type TimeScale,
  type ZoomLevel,
} from "@snps/gantt-core";

export interface DragGhost {
  mode: "move" | "resize-l" | "resize-r";
  taskId: string;
  row: number;
  start: number;
  end: number;
}

export interface LinkGhost {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** viewport coords already (not content coords) */
}

export interface View {
  rows: Row[];
  links: Link[];
  rowIdx: Map<string, number>;
  scale: TimeScale;
  zoom: ZoomLevel;
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
  rowHeight: number;
  headerH: number;
  selectedId: string | null;
  selectedLinkId: string | null;
  hoverId: string | null;
  drag: DragGhost | null;
  linkGhost: LinkGhost | null;
}

export const COLORS = {
  gridLine: "#e8e8ef",
  rowLine: "#f0f0f5",
  headerBg: "#fafafc",
  headerText: "#555566",
  headerLine: "#d8d8e2",
  weekend: "#f6f6fa",
  bar: "#4a89dc",
  barProgress: "#2f6bc4",
  summary: "#5a5a72",
  summaryProgress: "#2e2e42",
  milestone: "#c2529b",
  selected: "#1c4e9e",
  selectedRow: "rgba(74,137,220,0.08)",
  link: "#9aa0b4",
  today: "#e8590c",
  text: "#33334a",
  barText: "#ffffff",
  ghost: "rgba(74,137,220,0.45)",
};

export function barBox(task: Task, scale: TimeScale, rowHeight: number) {
  const x0 = dateToX(scale, task.start);
  const x1 = dateToX(scale, task.end);
  const h = Math.max(10, rowHeight - 14);
  const pad = (rowHeight - h) / 2;
  return { x0, x1, h, pad };
}

export function visibleRowRange(v: Pick<View, "rows" | "scrollY" | "viewH" | "rowHeight" | "headerH">): [number, number] {
  const first = Math.max(0, Math.floor(v.scrollY / v.rowHeight));
  const last = Math.min(
    v.rows.length - 1,
    Math.floor((v.scrollY + v.viewH - v.headerH) / v.rowHeight),
  );
  return [first, last];
}

function rowTop(v: View, i: number): number {
  return v.headerH + i * v.rowHeight - v.scrollY;
}

function drawBar(ctx: CanvasRenderingContext2D, v: View, task: Task, y: number, ghost = false): void {
  const { x0, x1, h, pad } = barBox(task, v.scale, v.rowHeight);
  const bx = x0 - v.scrollX;
  const bw = Math.max(2, x1 - x0);
  const by = y + pad;
  const type = task.type ?? "task";
  const selected = task.id === v.selectedId;

  if (type === "milestone") {
    const c = y + v.rowHeight / 2;
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(bx, c - r);
    ctx.lineTo(bx + r, c);
    ctx.lineTo(bx, c + r);
    ctx.lineTo(bx - r, c);
    ctx.closePath();
    ctx.fillStyle = ghost ? COLORS.ghost : COLORS.milestone;
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = COLORS.selected;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (!ghost) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(task.name, bx + r + 6, c);
    }
    return;
  }

  if (type === "summary") {
    const sh = Math.max(6, h - 8);
    ctx.fillStyle = ghost ? COLORS.ghost : COLORS.summary;
    ctx.fillRect(bx, by, bw, sh);
    const sProgress = task.progress ?? 0;
    if (!ghost && sProgress > 0) {
      ctx.fillStyle = COLORS.summaryProgress;
      ctx.fillRect(bx, by, bw * Math.min(1, sProgress), sh);
    }
    ctx.fillStyle = ghost ? COLORS.ghost : COLORS.summary;
    // end caps
    ctx.beginPath();
    ctx.moveTo(bx, by + sh);
    ctx.lineTo(bx + 5, by + sh);
    ctx.lineTo(bx, by + sh + 5);
    ctx.closePath();
    ctx.moveTo(bx + bw, by + sh);
    ctx.lineTo(bx + bw - 5, by + sh);
    ctx.lineTo(bx + bw, by + sh + 5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, h, 3);
    ctx.fillStyle = ghost ? COLORS.ghost : COLORS.bar;
    ctx.fill();
    const progress = task.progress ?? 0;
    if (!ghost && progress > 0) {
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * Math.min(1, progress), h, 3);
      ctx.fillStyle = COLORS.barProgress;
      ctx.fill();
    }
  }

  if (selected && !ghost) {
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, h + 2);
  }

  // label: inside the bar when it fits, otherwise to the right of the bar.
  // Vertically centered on the actual bar (summary bars are thinner and
  // top-aligned, so row-center would clip the text outside the bar).
  if (!ghost) {
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const barH = type === "summary" ? Math.max(6, h - 8) : h;
    const textY = by + barH / 2 + 0.5;
    if (bw > 50) {
      ctx.fillStyle = COLORS.barText;
      const maxW = bw - 12;
      let name = task.name;
      if (ctx.measureText(name).width > maxW) {
        while (name.length > 1 && ctx.measureText(name + "…").width > maxW) {
          name = name.slice(0, -1);
        }
        name += "…";
      }
      ctx.fillText(name, bx + 6, textY);
    } else {
      // narrow bar: dark label after the bar (past the link-handle zone)
      ctx.fillStyle = COLORS.text;
      ctx.fillText(task.name, bx + bw + 16, textY);
    }
  }

  // link handle on hover/selection
  if (!ghost && (task.id === v.hoverId || selected)) {
    ctx.beginPath();
    ctx.arc(bx + bw + 8, y + v.rowHeight / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = COLORS.bar;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawLinks(ctx: CanvasRenderingContext2D, v: View, first: number, last: number): void {
  const pad = 30;
  for (const link of v.links) {
    const isSelected = link.id === v.selectedLinkId;
    ctx.strokeStyle = isSelected ? COLORS.selected : COLORS.link;
    ctx.fillStyle = isSelected ? COLORS.selected : COLORS.link;
    ctx.lineWidth = isSelected ? 2 : 1.2;
    const sr = v.rowIdx.get(link.sourceId);
    const tr = v.rowIdx.get(link.targetId);
    if (sr === undefined || tr === undefined) continue;
    if ((sr < first - pad || sr > last + pad) && (tr < first - pad || tr > last + pad)) continue;
    const srcRow = v.rows[sr];
    const tgtRow = v.rows[tr];
    if (!srcRow || !tgtRow) continue;
    const s = barBox(srcRow.task, v.scale, v.rowHeight);
    const t = barBox(tgtRow.task, v.scale, v.rowHeight);
    const sx = s.x1 - v.scrollX;
    const sy = rowTop(v, sr) + v.rowHeight / 2;
    const tx = t.x0 - v.scrollX;
    const ty = rowTop(v, tr) + v.rowHeight / 2;
    // horizontal cull
    const minX = Math.min(sx, tx);
    const maxX = Math.max(sx, tx);
    if (maxX < -50 || minX > v.viewW + 50) continue;

    const pts = routeLink(sx, sy, tx - 4, ty, v.rowHeight);
    ctx.beginPath();
    const p0 = pts[0];
    if (!p0) continue;
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // arrowhead
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - 5, ty - 4);
    ctx.lineTo(tx - 5, ty + 4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, v.viewW, v.headerH);
  ctx.font = "11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const mid = v.headerH / 2;

  const majors = ticks(v.scale, v.scrollX - 800, v.scrollX + v.viewW + 200, majorUnit(v.zoom));
  ctx.fillStyle = COLORS.headerText;
  for (let i = 0; i < majors.length; i++) {
    const tk = majors[i];
    if (!tk) continue;
    const x = tk.x - v.scrollX;
    // pin the label of the partially visible segment to the left edge, but
    // only draw it if there is room before the next tick (avoids overlap)
    const nextX = (majors[i + 1]?.x ?? v.scrollX + v.viewW + 400) - v.scrollX;
    const lx = Math.max(x, 0) + 6;
    if (nextX - lx > 44) ctx.fillText(tk.label, lx, mid / 2 + 2);
    if (x >= 0) {
      ctx.strokeStyle = COLORS.headerLine;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, v.headerH);
      ctx.stroke();
    }
  }
  const minors = ticks(v.scale, v.scrollX, v.scrollX + v.viewW, v.zoom);
  for (const tk of minors) {
    const x = tk.x - v.scrollX;
    ctx.fillStyle = COLORS.headerText;
    ctx.fillText(tk.label, x + 4, mid + mid / 2);
  }
  ctx.strokeStyle = COLORS.headerLine;
  ctx.beginPath();
  ctx.moveTo(0, v.headerH - 0.5);
  ctx.lineTo(v.viewW, v.headerH - 0.5);
  ctx.moveTo(0, mid + 0.5);
  ctx.lineTo(v.viewW, mid + 0.5);
  ctx.stroke();
}

export function draw(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.clearRect(0, 0, v.viewW, v.viewH);
  const [first, last] = visibleRowRange(v);

  // weekend shading (day zoom only) + vertical grid lines
  const minors = ticks(v.scale, v.scrollX, v.scrollX + v.viewW, v.zoom);
  if (v.zoom === "day") {
    ctx.fillStyle = COLORS.weekend;
    const dayW = DAY / v.scale.msPerPx;
    for (const tk of minors) {
      const dow = new Date(tk.t).getUTCDay();
      if (dow === 0 || dow === 6) {
        ctx.fillRect(tk.x - v.scrollX, v.headerH, dayW, v.viewH - v.headerH);
      }
    }
  }
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const tk of minors) {
    const x = Math.round(tk.x - v.scrollX) + 0.5;
    ctx.moveTo(x, v.headerH);
    ctx.lineTo(x, v.viewH);
  }
  ctx.stroke();

  // row stripes + lines
  ctx.strokeStyle = COLORS.rowLine;
  ctx.beginPath();
  for (let i = first; i <= last; i++) {
    const y = Math.round(rowTop(v, i) + v.rowHeight) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(v.viewW, y);
  }
  ctx.stroke();

  // selected row highlight
  if (v.selectedId !== null) {
    const si = v.rowIdx.get(v.selectedId);
    if (si !== undefined && si >= first && si <= last) {
      ctx.fillStyle = COLORS.selectedRow;
      ctx.fillRect(0, rowTop(v, si), v.viewW, v.rowHeight);
    }
  }

  drawLinks(ctx, v, first, last);

  // bars
  for (let i = first; i <= last; i++) {
    const row = v.rows[i];
    if (!row) continue;
    if (v.drag && v.drag.taskId === row.task.id) continue; // ghost drawn instead
    drawBar(ctx, v, row.task, rowTop(v, i));
  }

  // drag ghost
  if (v.drag) {
    const row = v.rows[v.drag.row];
    if (row) {
      const ghostTask: Task = { ...row.task, start: v.drag.start, end: v.drag.end };
      drawBar(ctx, v, ghostTask, rowTop(v, v.drag.row), true);
    }
  }

  // link ghost
  if (v.linkGhost) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = COLORS.bar;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(v.linkGhost.fromX, v.linkGhost.fromY);
    ctx.lineTo(v.linkGhost.toX, v.linkGhost.toY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(v.linkGhost.toX, v.linkGhost.toY, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // today marker
  const todayX = dateToX(v.scale, Date.now()) - v.scrollX;
  if (todayX >= 0 && todayX <= v.viewW) {
    ctx.strokeStyle = COLORS.today;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(todayX, v.headerH);
    ctx.lineTo(todayX, v.viewH);
    ctx.stroke();
  }

  drawHeader(ctx, v);
}
