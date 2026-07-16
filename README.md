# snps-gantt

A custom React + TypeScript Gantt chart library built for large datasets (50,000+ tasks). No external chart/Gantt dependencies.

## Architecture

- `packages/core` — framework-agnostic logic: task types, flat indexed store, pure time-scale math (`(date, zoom) → x` and inverse), day snapping, dependency-link routing. Fully unit-tested.
- `packages/react` — components: `Gantt` (orchestrator), virtualized DOM `Grid` (left pane), canvas timeline painter (`draw.ts`), hit-testing and drag logic (`interactions.ts`), `EditForm`.
- `apps/demo` — Vite demo with a 50k-task synthetic dataset and perf harness.

Rendering is hybrid: DOM for the left grid, a single `<canvas>` for the timeline (bars, links, grid, header), and DOM overlays for the edit form. Both axes are virtualized — only visible rows and the visible time range are painted. Rendering and hit-testing share the same pure coordinate functions, so what you see is exactly what you hit.

## Usage

```tsx
import { Gantt, type Task, type Link } from "@snps/gantt-react";

const tasks: Task[] = [
  { id: "1", name: "Summary", start: Date.UTC(2026, 0, 5), end: Date.UTC(2026, 0, 20), type: "summary" },
  { id: "2", name: "Build", start: Date.UTC(2026, 0, 5), end: Date.UTC(2026, 0, 12), progress: 0.4, parentId: "1" },
  { id: "3", name: "Ship", start: Date.UTC(2026, 0, 12), end: Date.UTC(2026, 0, 12), type: "milestone", parentId: "1" },
];
const links: Link[] = [{ id: "l1", sourceId: "2", targetId: "3", type: "FS" }];

<Gantt
  tasks={tasks}
  links={links}
  onTaskChange={(t) => /* persist move/resize/edit */ void 0}
  onLinkCreate={(l) => void 0}
  onLinkDelete={(id) => void 0}
  onSelect={(id) => void 0}
/>
```

The component is fully controlled: it never mutates your data. Every user action arrives as a callback; apply it to your state (helpers `updateTask`/`moveTask` in `@snps/gantt-core`).

### `Gantt` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tasks` | `Task[]` | — | Flat array; hierarchy via `parentId` |
| `links` | `Link[]` | — | Finish-to-start dependencies |
| `initialZoom` | `"day" \| "week" \| "month"` | `"day"` | Ctrl+wheel changes zoom, anchored at pointer |
| `rowHeight` | `number` | `32` | |
| `gridWidth` | `number` | `300` | Left grid width |
| `headerHeight` | `number` | `44` | |
| `onTaskChange` | `(task: Task) => void` | — | Move, resize, and form edits |
| `onLinkCreate` | `(link: Link) => void` | — | Drag from the circle at a bar's right edge onto another bar |
| `onLinkDelete` | `(id: string) => void` | — | Via the edit form's dependency list |
| `onSelect` | `(id: string \| null) => void` | — | Click selection |

### Interactions

Drag a bar to move (snaps to days), drag its edges to resize, drag the circle at the right edge to create a dependency, double-click to edit (grid or bar), click the arrow in the grid to collapse/expand, Ctrl+wheel to zoom, Escape to close/deselect. Dragging near pane edges autoscrolls.

## Task shape

Dates are `number` ms-since-epoch (UTC). `type`: `"task"` (default), `"summary"`, `"milestone"` (`end === start`). `progress`: 0–1.

## Development

```bash
npm install
npm test          # core unit tests (vitest)
npm run typecheck # strict TS across all packages
npm run dev       # demo at localhost:5173 with 50k tasks
npm run build     # production build of the demo
```

## Performance notes

Measured on Node 22 (core hot paths, 50k tasks / 45k links): index rebuild 19 ms, hierarchy flatten 18 ms, row lookup 12 ms — these run only when data or collapse state changes. Per-frame canvas painting touches only ~30 visible rows. The demo header has a "Run scroll FPS test" button and logs initial render time to the console.

Known v1 limits: link drawing iterates all links per frame with row culling (fine at 45k; bucket by row if you go far beyond), no auto-scheduling/undo/critical path (out of scope by design), day-level snapping only, no touch-specific gestures beyond pointer events.
