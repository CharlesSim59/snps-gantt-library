import { routeLink, type Link, type Row, type TimeScale } from "@snps/gantt-core";
import { barBox } from "./draw";

export interface LinkHitContext {
  links: Link[];
  rows: Row[];
  rowIdx: Map<string, number>;
  scale: TimeScale;
  scrollX: number;
  scrollY: number;
  rowHeight: number;
  headerH: number;
}

function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Hit-test viewport coordinates against dependency link polylines.
 * Uses the same routing function as the painter, so clickable geometry
 * exactly matches what is drawn. Row-culled: only links whose rows are
 * near the pointer are measured.
 */
export function hitTestLink(cx: number, cy: number, ctx: LinkHitContext): string | null {
  if (cy < ctx.headerH) return null;
  const TOL = 5;
  const pointerRow = Math.floor((cy - ctx.headerH + ctx.scrollY) / ctx.rowHeight);

  for (const link of ctx.links) {
    const sr = ctx.rowIdx.get(link.sourceId);
    const tr = ctx.rowIdx.get(link.targetId);
    if (sr === undefined || tr === undefined) continue;
    if (pointerRow < Math.min(sr, tr) - 1 || pointerRow > Math.max(sr, tr) + 1) continue;
    const srcRow = ctx.rows[sr];
    const tgtRow = ctx.rows[tr];
    if (!srcRow || !tgtRow) continue;

    const s = barBox(srcRow.task, ctx.scale, ctx.rowHeight);
    const t = barBox(tgtRow.task, ctx.scale, ctx.rowHeight);
    const sx = s.x1 - ctx.scrollX;
    const sy = ctx.headerH + sr * ctx.rowHeight + ctx.rowHeight / 2 - ctx.scrollY;
    const tx = t.x0 - ctx.scrollX;
    const ty = ctx.headerH + tr * ctx.rowHeight + ctx.rowHeight / 2 - ctx.scrollY;

    const pts = routeLink(sx, sy, tx - 4, ty, ctx.rowHeight);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a && b && distToSegment(cx, cy, a.x, a.y, b.x, b.y) <= TOL) return link.id;
    }
  }
  return null;
}
