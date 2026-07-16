import { describe, expect, it } from "vitest";
import {
  DAY,
  dateToX,
  formatDateUTC,
  parseDateUTC,
  snapToDay,
  ticks,
  xToDate,
  type TimeScale,
} from "./time";

const scale: TimeScale = { start: Date.UTC(2026, 0, 1), msPerPx: DAY / 36 };

describe("time scale", () => {
  it("dateToX and xToDate are inverses", () => {
    const t = Date.UTC(2026, 5, 15, 7, 30);
    expect(xToDate(scale, dateToX(scale, t))).toBeCloseTo(t, 5);
  });

  it("maps origin to x=0 and one day to 36px", () => {
    expect(dateToX(scale, scale.start)).toBe(0);
    expect(dateToX(scale, scale.start + DAY)).toBeCloseTo(36);
  });

  it("snaps to nearest UTC day", () => {
    const noon = Date.UTC(2026, 2, 10, 12, 0);
    const morning = Date.UTC(2026, 2, 10, 5, 0);
    expect(snapToDay(noon)).toBe(Date.UTC(2026, 2, 11)); // rounds up at noon
    expect(snapToDay(morning)).toBe(Date.UTC(2026, 2, 10));
  });

  it("generates day ticks covering the visible range", () => {
    const out = ticks(scale, 0, 36 * 10, "day");
    expect(out.length).toBe(11); // Jan 1 .. Jan 11 inclusive
    expect(out[0]!.t).toBe(Date.UTC(2026, 0, 1));
    expect(out[1]!.x - out[0]!.x).toBeCloseTo(36);
  });

  it("generates month ticks with correct labels", () => {
    const out = ticks(scale, 0, 36 * 70, "month");
    expect(out[0]!.label).toBe("Jan 2026");
    expect(out[1]!.label).toBe("Feb 2026");
  });

  it("week ticks start on Monday", () => {
    const out = ticks(scale, 0, 36 * 30, "week");
    for (const tk of out) expect(new Date(tk.t).getUTCDay()).toBe(1);
  });

  it("formats and parses UTC dates symmetrically", () => {
    const t = Date.UTC(2026, 6, 15);
    expect(formatDateUTC(t)).toBe("2026-07-15");
    expect(parseDateUTC("2026-07-15")).toBe(t);
    expect(parseDateUTC("garbage")).toBeNull();
  });
});
