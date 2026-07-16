export const DAY = 86_400_000;
export const HOUR = 3_600_000;

export type ZoomLevel = "day" | "week" | "month";

/** Linear time scale: maps timestamps to pixels. */
export interface TimeScale {
  /** timeline origin, ms since epoch */
  start: number;
  /** milliseconds represented by one pixel */
  msPerPx: number;
}

export const ZOOM_PRESETS: Record<ZoomLevel, number> = {
  day: DAY / 36, // 36 px per day
  week: DAY / 12, // 84 px per week
  month: DAY / 4, // ~120 px per month
};

export function dateToX(scale: TimeScale, t: number): number {
  return (t - scale.start) / scale.msPerPx;
}

export function xToDate(scale: TimeScale, x: number): number {
  return scale.start + x * scale.msPerPx;
}

/** Snap a timestamp to the nearest UTC day boundary. */
export function snapToDay(t: number): number {
  return Math.round(t / DAY) * DAY;
}

/** Floor a timestamp to its UTC day boundary. */
export function floorToDay(t: number): number {
  return Math.floor(t / DAY) * DAY;
}

export interface Tick {
  t: number;
  x: number;
  label: string;
}

/** Units usable for header/grid ticks: the zoom levels plus "year". */
export type TickUnit = ZoomLevel | "year";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function floorToUnit(t: number, unit: TickUnit): number {
  const d = new Date(t);
  if (unit === "day") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (unit === "week") {
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
    return day - dow * DAY;
  }
  if (unit === "year") return Date.UTC(d.getUTCFullYear(), 0, 1);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function nextUnit(t: number, unit: TickUnit): number {
  if (unit === "day") return t + DAY;
  if (unit === "week") return t + 7 * DAY;
  const d = new Date(t);
  if (unit === "year") return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

function labelFor(t: number, unit: TickUnit): string {
  const d = new Date(t);
  if (unit === "day") return String(d.getUTCDate());
  if (unit === "week") return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (unit === "year") return String(d.getUTCFullYear());
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Generate ticks of `unit` covering the pixel range [x0, x1] of the scale.
 * Pure: same inputs always produce the same ticks.
 */
export function ticks(scale: TimeScale, x0: number, x1: number, unit: TickUnit): Tick[] {
  const out: Tick[] = [];
  let t = floorToUnit(xToDate(scale, x0), unit);
  const tEnd = xToDate(scale, x1);
  while (t <= tEnd) {
    out.push({ t, x: dateToX(scale, t), label: labelFor(t, unit) });
    t = nextUnit(t, unit);
  }
  return out;
}

/** The major (header) unit shown above the given zoom unit. */
export function majorUnit(unit: ZoomLevel): TickUnit {
  return unit === "month" ? "year" : "month";
}

export function formatDateUTC(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function parseDateUTC(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
