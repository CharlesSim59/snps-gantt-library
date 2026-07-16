/** Perf harness: initial render time + scripted scroll FPS. */
export declare function measureInitialRender(label: string, startMark: number, report: (msg: string) => void): void;
/**
 * Scroll the given element vertically for `durationMs`, counting rAF
 * frames. Reports average FPS.
 */
export declare function measureScrollFps(el: HTMLElement, durationMs: number, report: (msg: string) => void): void;
