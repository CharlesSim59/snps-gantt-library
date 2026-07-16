/** Perf harness: initial render time + scripted scroll FPS. */

export function measureInitialRender(label: string, startMark: number, report: (msg: string) => void): void {
  // double rAF ≈ first frame painted
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ms = performance.now() - startMark;
      const msg = `${label}: first paint in ${ms.toFixed(0)} ms`;
      console.log(`[perf] ${msg}`);
      report(msg);
    });
  });
}

/**
 * Scroll the given element vertically for `durationMs`, counting rAF
 * frames. Reports average FPS.
 */
export function measureScrollFps(
  el: HTMLElement,
  durationMs: number,
  report: (msg: string) => void,
): void {
  const start = performance.now();
  const startTop = el.scrollTop;
  let frames = 0;
  const speed = 12; // px per frame @60fps equivalent

  const step = (now: number) => {
    frames++;
    const t = now - start;
    el.scrollTop = startTop + (t / (1000 / 60)) * speed;
    if (t < durationMs) {
      requestAnimationFrame(step);
    } else {
      const fps = (frames / t) * 1000;
      const msg = `scroll: ${fps.toFixed(1)} fps over ${(t / 1000).toFixed(1)}s`;
      console.log(`[perf] ${msg}`);
      report(msg);
      el.scrollTop = startTop;
    }
  };
  requestAnimationFrame(step);
}
