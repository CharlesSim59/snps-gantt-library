import {
  DAY,
  dateBounds,
  dateToX,
  filterTaskIds,
  floorToDay,
  formatDateUTC,
  indexTasks,
  rowIndexById,
  visibleRows,
  xToDate,
  ZOOM_PRESETS,
  type Link,
  type Task,
  type TimeScale,
  type ZoomLevel,
} from "@snps/gantt-core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { barBox, draw, visibleRowRange, type DragGhost, type LinkGhost, type View } from "./draw";
import { EditForm } from "./EditForm";
import { Grid, type ColumnId, type ColumnWidths, type SortState } from "./Grid";
import { applyDrag, cursorFor, hitTest, type DragMode, type Hit } from "./interactions";
import { hitTestLink } from "./linkHit";

export interface GanttProps {
  tasks: Task[];
  links: Link[];
  initialZoom?: ZoomLevel;
  rowHeight?: number;
  gridWidth?: number;
  headerHeight?: number;
  style?: CSSProperties;
  /** fired for move, resize, and form edits */
  onTaskChange?: (task: Task) => void;
  /** fired by the grid's + button; afterId hints at insert position */
  onTaskCreate?: (task: Task, afterId?: string) => void;
  /** fired by Delete key / the edit form's Delete button */
  onTaskDelete?: (id: string) => void;
  onLinkCreate?: (link: Link) => void;
  onLinkDelete?: (id: string) => void;
  onSelect?: (id: string | null) => void;
}

interface DragInfo {
  hit: Hit;
  mode: DragMode | "link";
  startClientX: number;
  startClientY: number;
  startScrollX: number;
  lastClientX: number;
  lastClientY: number;
  moved: boolean;
}

const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month"];
const EDGE_ZONE = 32;
const MAX_AUTOSCROLL = 14;

let linkSeq = 0;
const genLinkId = () => `link_${Date.now().toString(36)}_${linkSeq++}`;

export function Gantt(props: GanttProps): JSX.Element {
  const {
    tasks,
    links,
    initialZoom = "day",
    rowHeight = 32,
    gridWidth = 300,
    headerHeight = 44,
    style,
    onTaskChange,
    onTaskCreate,
    onTaskDelete,
    onLinkCreate,
    onLinkDelete,
    onSelect,
  } = props;

  // ---- derived data (pure, memoized) ----
  const index = useMemo(() => indexTasks(tasks), [tasks]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<SortState | null>(null);
  const [filterText, setFilterText] = useState("");

  const compare = useMemo(() => {
    if (!sort) return undefined;
    const dir = sort.dir;
    switch (sort.col) {
      case "name":
        return (a: Task, b: Task) => dir * a.name.localeCompare(b.name);
      case "start":
        return (a: Task, b: Task) => dir * (a.start - b.start);
      case "end":
        return (a: Task, b: Task) => dir * (a.end - b.end);
      default:
        return (a: Task, b: Task) => dir * (a.end - a.start - (b.end - b.start));
    }
  }, [sort]);

  const visibleSet = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return undefined;
    return filterTaskIds(index, (t) => t.name.toLowerCase().includes(q));
  }, [filterText, index]);

  // while filtering, ignore collapse state so matches inside collapsed
  // summaries stay visible
  const effectiveCollapsed = useMemo<ReadonlySet<string>>(
    () => (visibleSet ? new Set<string>() : collapsed),
    [visibleSet, collapsed],
  );

  const rows = useMemo(
    () => visibleRows(index, effectiveCollapsed, { compare, visible: visibleSet }),
    [index, effectiveCollapsed, compare, visibleSet],
  );
  const rowIdx = useMemo(() => rowIndexById(rows), [rows]);

  const [colWidths, setColWidths] = useState<ColumnWidths>(() => ({
    name: Math.max(120, gridWidth - 200),
    start: 78,
    end: 78,
    duration: 44,
  }));
  const onResizeCol = useCallback((col: ColumnId, w: number) => {
    setColWidths((prev) => (prev[col] === w ? prev : { ...prev, [col]: w }));
  }, []);
  const onSortToggle = useCallback((col: ColumnId) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: 1 };
      if (prev.dir === 1) return { col, dir: -1 };
      return null;
    });
  }, []);
  const bounds = useMemo(() => dateBounds(tasks), [tasks]);

  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom);
  const scale = useMemo<TimeScale>(() => {
    const start = bounds ? floorToDay(bounds.min) - 7 * DAY : floorToDay(Date.now()) - 7 * DAY;
    const preset = ZOOM_PRESETS[zoom];
    return { start, msPerPx: preset };
  }, [bounds, zoom]);

  const totalW = useMemo(
    () => Math.ceil(dateToX(scale, (bounds ? bounds.max : Date.now()) + 14 * DAY)),
    [scale, bounds],
  );
  const totalH = rows.length * rowHeight + headerHeight;

  // ---- view state ----
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string | null; cursor: string }>({ id: null, cursor: "default" });
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [linkGhost, setLinkGhost] = useState<LinkGhost | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const scrollRafRef = useRef(0);
  const autoRafRef = useRef(0);

  // ---- size observation ----
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- scroll handling (rAF-throttled into React state) ----
  const onScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = scrollRef.current;
      if (el) setScroll({ x: el.scrollLeft, y: el.scrollTop });
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(scrollRafRef.current), []);

  // ---- canvas drawing ----
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(size.w * dpr) || canvas.height !== Math.round(size.h * dpr)) {
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view: View = {
      rows,
      links,
      rowIdx,
      scale,
      zoom,
      scrollX: scroll.x,
      scrollY: scroll.y,
      viewW: size.w,
      viewH: size.h,
      rowHeight,
      headerH: headerHeight,
      selectedId,
      selectedLinkId,
      hoverId: hover.id,
      drag: ghost,
      linkGhost,
    };
    draw(ctx, view);
  });

  // ---- pointer interactions ----
  const hitAt = useCallback(
    (clientX: number, clientY: number): { hit: Hit; cx: number; cy: number } => {
      const el = scrollRef.current;
      const rect = el?.getBoundingClientRect();
      const cx = rect ? clientX - rect.left : 0;
      const cy = rect ? clientY - rect.top : 0;
      const hit = hitTest(cx, cy, {
        rows,
        scale,
        scrollX: el?.scrollLeft ?? 0,
        scrollY: el?.scrollTop ?? 0,
        rowHeight,
        headerH: headerHeight,
      });
      return { hit, cx, cy };
    },
    [rows, scale, rowHeight, headerHeight],
  );

  const updateDragVisuals = useCallback(
    (clientX: number, clientY: number) => {
      const d = dragRef.current;
      const el = scrollRef.current;
      if (!d || !el || !d.hit.task) return;
      d.lastClientX = clientX;
      d.lastClientY = clientY;
      if (Math.abs(clientX - d.startClientX) + Math.abs(clientY - d.startClientY) > 3) d.moved = true;

      if (d.mode === "link") {
        const rect = el.getBoundingClientRect();
        const box = barBox(d.hit.task, scale, rowHeight);
        setLinkGhost({
          fromX: box.x1 - el.scrollLeft,
          fromY: headerHeight + d.hit.rowIndex * rowHeight + rowHeight / 2 - el.scrollTop,
          toX: clientX - rect.left,
          toY: clientY - rect.top,
        });
        return;
      }
      const dPx = clientX - d.startClientX + (el.scrollLeft - d.startScrollX);
      const dMs = dPx * scale.msPerPx;
      const next = applyDrag(d.hit.task, d.mode, dMs);
      setGhost({ mode: d.mode, taskId: d.hit.task.id, row: d.hit.rowIndex, ...next });
    },
    [scale, rowHeight, headerHeight],
  );

  // autoscroll loop while dragging near pane edges
  const autoScrollLoop = useCallback(() => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d || !el) {
      autoRafRef.current = 0;
      return;
    }
    if (d.moved) {
      const rect = el.getBoundingClientRect();
      let vx = 0;
      let vy = 0;
      if (d.lastClientX - rect.left < EDGE_ZONE) vx = -MAX_AUTOSCROLL;
      else if (rect.right - d.lastClientX < EDGE_ZONE) vx = MAX_AUTOSCROLL;
      if (d.lastClientY - rect.top < EDGE_ZONE + headerHeight) vy = -MAX_AUTOSCROLL;
      else if (rect.bottom - d.lastClientY < EDGE_ZONE) vy = MAX_AUTOSCROLL;
      if (vx !== 0 || vy !== 0) {
        el.scrollLeft += vx;
        el.scrollTop += vy;
        updateDragVisuals(d.lastClientX, d.lastClientY);
      }
    }
    autoRafRef.current = requestAnimationFrame(autoScrollLoop);
  }, [headerHeight, updateDragVisuals]);
  useEffect(() => () => cancelAnimationFrame(autoRafRef.current), []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const { hit } = hitAt(e.clientX, e.clientY);
      const el = scrollRef.current;
      if (!el) return;
      if (hit.task && (hit.region === "bar" || hit.region === "resize-l" || hit.region === "resize-r" || hit.region === "link-handle")) {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        dragRef.current = {
          hit,
          mode: hit.region === "link-handle" ? "link" : hit.region === "bar" ? "move" : hit.region,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startScrollX: el.scrollLeft,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          moved: false,
        };
        if (!autoRafRef.current) autoRafRef.current = requestAnimationFrame(autoScrollLoop);
      } else {
        dragRef.current = {
          hit,
          mode: "move",
          startClientX: e.clientX,
          startClientY: e.clientY,
          startScrollX: el.scrollLeft,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          moved: false,
        };
      }
    },
    [hitAt, autoScrollLoop],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (d && d.hit.task && (d.moved || Math.abs(e.clientX - d.startClientX) + Math.abs(e.clientY - d.startClientY) > 3)) {
        if (d.hit.region === "bar" || d.hit.region === "resize-l" || d.hit.region === "resize-r" || d.hit.region === "link-handle") {
          updateDragVisuals(e.clientX, e.clientY);
          return;
        }
      }
      if (!d) {
        const { hit } = hitAt(e.clientX, e.clientY);
        setHover((prev) => {
          const id = hit.task && hit.region !== "row" && hit.region !== "header" ? hit.task.id : null;
          const cursor = cursorFor(hit.region);
          return prev.id === id && prev.cursor === cursor ? prev : { id, cursor };
        });
      }
    },
    [hitAt, updateDragVisuals],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setSelectedLinkId(null);
      onSelect?.(id);
    },
    [onSelect],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      cancelAnimationFrame(autoRafRef.current);
      autoRafRef.current = 0;
      setGhost(null);
      setLinkGhost(null);
      const el = scrollRef.current;
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!d) return;

      if (!d.moved) {
        // clicks on a bar/handle select the task; clicks on empty row space
        // first try to select a dependency link under the pointer
        if (d.hit.task && d.hit.region !== "row" && d.hit.region !== "header" && d.hit.region !== "empty") {
          select(d.hit.task.id);
        } else {
          const rect = el?.getBoundingClientRect();
          const linkId =
            el && rect
              ? hitTestLink(e.clientX - rect.left, e.clientY - rect.top, {
                  links,
                  rows,
                  rowIdx,
                  scale,
                  scrollX: el.scrollLeft,
                  scrollY: el.scrollTop,
                  rowHeight,
                  headerH: headerHeight,
                })
              : null;
          if (linkId) {
            setSelectedLinkId(linkId);
            setSelectedId(null);
          } else {
            select(d.hit.task && d.hit.region === "row" ? d.hit.task.id : null);
          }
        }
        return;
      }
      if (!d.hit.task) return;

      if (d.mode === "link") {
        const { hit } = hitAt(e.clientX, e.clientY);
        if (hit.task && hit.task.id !== d.hit.task.id && hit.region !== "header" && hit.region !== "empty") {
          onLinkCreate?.({ id: genLinkId(), sourceId: d.hit.task.id, targetId: hit.task.id, type: "FS" });
        }
        return;
      }
      // commit move / resize
      if (d.hit.region === "bar" || d.hit.region === "resize-l" || d.hit.region === "resize-r") {
        const dPx = e.clientX - d.startClientX + ((el?.scrollLeft ?? 0) - d.startScrollX);
        const next = applyDrag(d.hit.task, d.mode, dPx * scale.msPerPx);
        if (next.start !== d.hit.task.start || next.end !== d.hit.task.end) {
          onTaskChange?.({ ...d.hit.task, ...next });
        }
      }
    },
    [hitAt, onLinkCreate, onTaskChange, scale, select, links, rows, rowIdx, rowHeight, headerHeight],
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const { hit } = hitAt(e.clientX, e.clientY);
      if (hit.task && (hit.region === "bar" || hit.region === "row")) setEditorId(hit.task.id);
    },
    [hitAt],
  );

  // ---- ctrl+wheel zoom (native listener: React wheel handlers are passive) ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((cur) => {
        const i = ZOOM_ORDER.indexOf(cur);
        const ni = Math.min(ZOOM_ORDER.length - 1, Math.max(0, i + (e.deltaY > 0 ? 1 : -1)));
        const nz = ZOOM_ORDER[ni];
        if (!nz || nz === cur) return cur;
        // anchor the date under the pointer
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const anchorDate = xToDate({ start: scale.start, msPerPx: ZOOM_PRESETS[cur] }, cx + el.scrollLeft);
        requestAnimationFrame(() => {
          el.scrollLeft = dateToX({ start: scale.start, msPerPx: ZOOM_PRESETS[nz] }, anchorDate) - cx;
        });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale.start]);

  // ---- keyboard ----
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editorId) setEditorId(null);
        else {
          select(null);
          setSelectedLinkId(null);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (selectedLinkId) {
          onLinkDelete?.(selectedLinkId);
          setSelectedLinkId(null);
        } else if (selectedId) {
          onTaskDelete?.(selectedId);
          setEditorId(null);
          select(null);
        }
      }
    },
    [editorId, select, selectedLinkId, selectedId, onLinkDelete, onTaskDelete],
  );

  // ---- add task (grid + button) ----
  const handleAddTask = useCallback(() => {
    const sel = selectedId ? index.byId.get(selectedId) : undefined;
    const start = sel ? sel.end : floorToDay(Date.now());
    const task: Task = {
      id: `task_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
      name: "New task",
      start,
      end: start + 3 * DAY,
      progress: 0,
      type: "task",
      parentId: sel ? (sel.parentId ?? null) : null,
    };
    onTaskCreate?.(task, sel?.id);
    select(task.id);
    setEditorId(task.id);
  }, [selectedId, index, onTaskCreate, select]);

  // ---- editor ----
  const editorTask = editorId ? (index.byId.get(editorId) ?? null) : null;
  const editorLinks = useMemo(() => {
    if (!editorTask) return [];
    // include dates so tasks with identical names are distinguishable
    const label = (id: string) => {
      const t = index.byId.get(id);
      return t ? `${t.name} (${formatDateUTC(t.start)})` : id;
    };
    const out: { link: Link; otherName: string; direction: "in" | "out" }[] = [];
    for (const l of links) {
      if (l.sourceId === editorTask.id) {
        out.push({ link: l, otherName: label(l.targetId), direction: "out" });
      } else if (l.targetId === editorTask.id) {
        out.push({ link: l, otherName: label(l.sourceId), direction: "in" });
      }
    }
    return out;
  }, [editorTask, links, index]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [first, last] = visibleRowRange({
    rows,
    scrollY: scroll.y,
    viewH: size.h,
    rowHeight,
    headerH: headerHeight,
  });

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        outline: "none",
        border: "1px solid #d8d8e2",
        borderRadius: 6,
        overflow: "hidden",
        background: "#fff",
        font: "13px system-ui, sans-serif",
        ...style,
      }}
    >
      <Grid
        rows={rows}
        first={first}
        last={last}
        scrollY={scroll.y}
        rowHeight={rowHeight}
        headerH={headerHeight}
        widths={colWidths}
        sort={sort}
        filter={filterText}
        selectedId={selectedId}
        collapsed={effectiveCollapsed}
        onToggle={toggleCollapse}
        onSelect={select}
        onOpenEditor={setEditorId}
        onSortToggle={onSortToggle}
        onFilterChange={setFilterText}
        onResizeCol={onResizeCol}
        onAdd={onTaskCreate ? handleAddTask : undefined}
      />
      <div ref={wrapperRef} style={{ flex: 1, position: "relative", height: "100%", minWidth: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }}
        />
        <div
          ref={scrollRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "auto",
            zIndex: 1,
            cursor: ghost ? "grabbing" : hover.cursor,
            touchAction: "none",
          }}
        >
          <div style={{ width: totalW, height: totalH, pointerEvents: "none" }} />
        </div>
      </div>
      {editorTask && (
        <EditForm
          task={editorTask}
          links={editorLinks}
          onSave={(t) => {
            onTaskChange?.(t);
            setEditorId(null);
          }}
          onDeleteLink={(id) => onLinkDelete?.(id)}
          onDelete={
            onTaskDelete
              ? () => {
                  onTaskDelete(editorTask.id);
                  setEditorId(null);
                  select(null);
                }
              : undefined
          }
          onClose={() => setEditorId(null)}
        />
      )}
    </div>
  );
}
