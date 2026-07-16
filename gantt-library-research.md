# React Gantt Chart Library Research (OSS, excluding Bryntum)

**Date:** 2026-07-15
**Requirements:** Open-source, React, interactive on-screen editing (drag & drop), able to handle tens of thousands of tasks (数万件).

## Summary

Two libraries meet all requirements: **SVAR React Gantt** (MIT) and **DHTMLX Gantt Community Edition** (MIT since v10). **VTable-Gantt** (MIT, canvas-based) is a strong third option. Popular lightweight libraries (`gantt-task-react`, `frappe-gantt`) fail the scale requirement — no virtualization, unusable beyond a few thousand tasks.

**Recommendation:** Prototype with **SVAR React Gantt** first; keep **DHTMLX Community** as fallback if scroll smoothness at 50k+ rows matters more than load/update speed.

## Candidate Comparison

| | SVAR React Gantt | DHTMLX Gantt (Community) | VTable-Gantt (VisActor) | gantt-task-react | frappe-gantt |
|---|---|---|---|---|---|
| License | MIT (core) | MIT (v10+; v9 and earlier were GPLv2) | MIT | MIT | MIT |
| GitHub stars | ~180 (new, 2024–) | ~1,800 | ~3,600 (VTable repo) | ~1,300 | ~5,000 |
| Maintained | Active | Active (pushed Jun 2026) | Active (ByteDance-backed) | **Stale since ~2021** | Active but limited |
| React-native | Yes (built for React) | No (vanilla JS + wrapper) | No (canvas + React wrapper) | Yes | No (vanilla SVG) |
| Rendering | DOM + virtualization | DOM + smart rendering | Canvas | SVG, no virtualization | SVG, no virtualization |
| Drag & drop edit | Yes (tasks + dependencies) | Yes (full) | Yes (drag, resize, zoom) | Yes (basic) | Yes (basic) |
| Handles 10k+ | Yes (demo: 10k, tested to 100k) | Yes (30k+ claimed) | Yes (canvas scales well) | No | No |
| TypeScript | Full | Yes | Full | Yes | Partial |

## Performance at Scale (10k–100k tasks)

From a March 2026 benchmark of React Gantt libraries (run by SVAR — **vendor bias applies**, but methodology and [benchmark code](https://github.com/svar-widgets/gantt-performance) are public):

| Metric | SVAR | DHTMLX |
|---|---|---|
| Initial load, 10k tasks | 220 ms | 450 ms |
| Initial load, 50k tasks | 900 ms | 7,100 ms |
| Initial load, 100k tasks | 1.7 s | 27 s |
| Scroll FPS at 10k / 50k / 100k | 30 / 10 / 5 | 60 / 60 / 60 |
| 100 CRUD ops at 10k tasks | 226 ms | 1,900 ms (batch API) |
| Memory at 100k tasks | 380 MB | 88 MB |

Trade-off at 数万件 scale: SVAR loads and updates far faster; DHTMLX scrolls smoother and uses less memory but loads very slowly past 50k. Neither is perfect at 100k — if you truly need 50k+ rows visible at once, consider server-side filtering/pagination, or the canvas-based VTable-Gantt (bypasses DOM entirely).

## Library Notes

### 1. SVAR React Gantt — primary candidate
- MIT core: interactive timeline, drag & drop for tasks and dependencies, task edit form, hierarchy, sorting/filtering, zoom, hotkeys, **virtualization for large datasets**, React 19, TypeScript.
- Built for React from scratch (state-driven updates → fast CRUD/live updates).
- Caveats: young project (small community, ~180 stars); advanced features are paid PRO (auto-scheduling, critical path, baselines, resource planning, undo/redo, MS Project export). Check that the MIT core covers your feature needs.
- npm: `@svar-ui/react-gantt`

### 2. DHTMLX Gantt Community Edition — mature fallback
- The most battle-tested OSS Gantt (since 2013). v10+ Community is MIT; verify you install v10+, not an old GPLv2 build.
- Smart rendering keeps scrolling at 60fps even at 100k rows; lowest memory use.
- Caveats: React integration is a wrapper around a vanilla JS core (imperative API, doesn't fit React state flow naturally); slow bulk loads/updates at 50k+; PRO-only features include auto-scheduling, critical path, resource load diagram.
- npm: `dhtmlx-gantt`

### 3. VTable-Gantt — canvas alternative
- MIT, part of ByteDance's VisActor ecosystem. Canvas rendering built on the high-performance VTable grid → strong at very large datasets.
- Drag/resize/edit tasks, dependencies, zoom, custom rendering; official React wrapper (`@visactor/react-vtable`).
- Caveats: newer, docs partially Chinese-first, canvas means custom DOM/CSS styling doesn't apply; large open-issue count (~640) reflects fast-moving development.
- npm: `@visactor/vtable-gantt`

### 4. Not recommended for this use case
- **gantt-task-react** (MIT): easiest React API, but SVG rendering with no virtualization and effectively unmaintained since ~2021. Fine for hundreds of tasks, not 数万件. (Maintained fork `@wamra/gantt-task-react` exists but inherits the architecture.)
- **frappe-gantt** (MIT): lightweight vanilla-JS SVG chart; no virtualization, no React binding; not built for large data.
- **gantt-schedule-timeline-calendar**: no longer free/OSS (commercial license) — excluded.

## Suggested Next Steps

1. Prototype with SVAR React Gantt using a realistic 30k–50k task dataset (real hierarchy + dependencies, not flat data — benchmark used flat data).
2. Measure scroll FPS and edit responsiveness on target hardware; benchmark numbers came from a fast desktop.
3. Confirm the MIT core feature set is sufficient (no auto-scheduling/undo-redo without PRO).
4. If scroll performance disappoints, run the same dataset through DHTMLX Community v10 and VTable-Gantt.

## Sources

- [SVAR React Gantt (GitHub, MIT)](https://github.com/svar-widgets/react-gantt)
- [SVAR Gantt benchmark of React Gantt libraries](https://svar.dev/blog/react-gantt-benchmark/) / [benchmark code](https://github.com/svar-widgets/gantt-performance)
- [Top 5 React Gantt Chart Libraries Compared (2026)](https://svar.dev/blog/top-react-gantt-charts/)
- [DHTMLX Gantt (GitHub, Community Edition)](https://github.com/DHTMLX/gantt)
- [DHTMLX Gantt licensing explained (GPL → MIT in v10)](https://dhtmlx.com/blog/dhtmlx-gantt-licensing-options-explained-gpl-mit-community-pro-editions/)
- [VTable-Gantt (npm)](https://www.npmjs.com/package/@visactor/vtable-gantt) / [VisActor VTable (GitHub)](https://github.com/VisActor/VTable)
- [Best JavaScript Gantt Chart Libraries 2025–2026 (AnyChart)](https://www.anychart.com/blog/2025/11/05/best-javascript-gantt-chart-libraries/)
