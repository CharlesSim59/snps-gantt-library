import {
  History,
  insertTaskAfter,
  removeLinksForTasks,
  removeTask,
  updateTask,
  type Link,
  type Task,
} from "@snps/gantt-core";
import { Gantt } from "@snps/gantt-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateData } from "./data";
import { measureInitialRender, measureScrollFps } from "./perf";

const t0 = performance.now();

interface Data {
  tasks: Task[];
  links: Link[];
}

export function App(): JSX.Element {
  const initial = useMemo(() => generateData(2500, 20), []); // 50,000 tasks
  const [data, setData] = useState<Data>(initial);
  const [log, setLog] = useState<string[]>([]);
  const [, forceRender] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef(new History<Data>(100));

  const report = useCallback((msg: string) => setLog((l) => [...l, msg]), []);

  useEffect(() => {
    measureInitialRender(`initial render (${initial.tasks.length} tasks)`, t0, report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply a change, recording the previous state for undo. */
  const apply = useCallback((fn: (prev: Data) => Data) => {
    setData((prev) => {
      historyRef.current.push(prev);
      return fn(prev);
    });
  }, []);

  const undo = useCallback(() => {
    setData((cur) => historyRef.current.undo(cur) ?? cur);
    forceRender((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    setData((cur) => historyRef.current.redo(cur) ?? cur);
    forceRender((n) => n + 1);
  }, []);

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (k === "z") {
        e.preventDefault();
        undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const runScrollTest = useCallback(() => {
    // demo-only: grab the Gantt's internal scroll pane
    const el = rootRef.current?.querySelector<HTMLElement>("div[style*='overflow: auto']");
    if (el) measureScrollFps(el, 3000, report);
  }, [report]);

  const onTaskChange = useCallback(
    (t: Task) => apply((d) => ({ ...d, tasks: updateTask(d.tasks, t) })),
    [apply],
  );

  const onTaskCreate = useCallback(
    (t: Task, afterId?: string) =>
      apply((d) => ({ ...d, tasks: insertTaskAfter(d.tasks, t, afterId) })),
    [apply],
  );

  const onTaskDelete = useCallback(
    (id: string) =>
      apply((d) => {
        const { tasks, removedIds } = removeTask(d.tasks, id);
        return { tasks, links: removeLinksForTasks(d.links, removedIds) };
      }),
    [apply],
  );

  const onLinkCreate = useCallback(
    (l: Link) => apply((d) => ({ ...d, links: [...d.links, l] })),
    [apply],
  );

  const onLinkDelete = useCallback(
    (id: string) => apply((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) })),
    [apply],
  );

  const h = historyRef.current;
  const btn = { padding: "4px 10px", cursor: "pointer" } as const;

  return (
    <div
      ref={rootRef}
      style={{ display: "flex", flexDirection: "column", height: "100%", padding: 12, boxSizing: "border-box", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong>snps-gantt demo</strong>
        <span style={{ color: "#666" }}>
          {data.tasks.length.toLocaleString()} tasks / {data.links.length.toLocaleString()} links —
          drag to move/resize, circle to link, click a link line to select it (Del deletes),
          + button adds, double-click edits, Ctrl+wheel zooms, Ctrl+Z/Y undo/redo
        </span>
        <button onClick={undo} disabled={!h.canUndo} style={btn}>
          ↩ Undo
        </button>
        <button onClick={redo} disabled={!h.canRedo} style={btn}>
          ↪ Redo
        </button>
        <button onClick={runScrollTest} style={btn}>
          Run scroll FPS test
        </button>
        <span style={{ color: "#2f6bc4", fontSize: 12 }}>{log.join("  ·  ")}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Gantt
          tasks={data.tasks}
          links={data.links}
          onTaskChange={onTaskChange}
          onTaskCreate={onTaskCreate}
          onTaskDelete={onTaskDelete}
          onLinkCreate={onLinkCreate}
          onLinkDelete={onLinkDelete}
        />
      </div>
    </div>
  );
}
