export interface Point {
  x: number;
  y: number;
}

/**
 * Route a finish-to-start link from the right edge of the source bar
 * (sx, sy) to the left edge of the target bar (tx, ty) as a stepped
 * polyline. rowH is used to dodge around bars when the target starts
 * left of the source end.
 */
export function routeLink(sx: number, sy: number, tx: number, ty: number, rowH: number): Point[] {
  const STUB = 10;
  if (tx >= sx + 2 * STUB) {
    // Simple Z shape: right, down/up, right.
    const midX = sx + STUB;
    return [
      { x: sx, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ty },
      { x: tx, y: ty },
    ];
  }
  // S shape: right, drop half a row, back left, down/up, right into target.
  const dropY = sy + (ty >= sy ? rowH / 2 : -rowH / 2);
  return [
    { x: sx, y: sy },
    { x: sx + STUB, y: sy },
    { x: sx + STUB, y: dropY },
    { x: tx - STUB, y: dropY },
    { x: tx - STUB, y: ty },
    { x: tx, y: ty },
  ];
}
