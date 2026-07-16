import { DAY, formatDateUTC, type Row } from "@snps/gantt-core";
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export type ColumnId = "name" | "start" | "end" | "duration";
export type ColumnWidths = Record<ColumnId, number>;
export interface SortState {
  col: ColumnId;
  dir: 1 | -1;
}

export interface GridProps {
  rows: Row[];
  first: number;
  last: number;
  scrollY: number;
  rowHeight: number;
  headerH: number;
  widths: ColumnWidths;
  sort: SortState | null;
  filter: string;
  selectedId: string | null;
  /** the selected task's tree (whole project subtree), highlighted */
  relatedIds: ReadonlySet<string> | null;
  collapsed: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onSortToggle: (col: ColumnId) => void;
  onFilterChange: (q: string) => void;
  onResizeCol: (col: ColumnId, width: number) => void;
  /** when provided, renders an add-task button in the header */
  onAdd?: () => void;
}

const MIN_W: ColumnWidths = { name: 80, start: 56, end: 56, duration: 36 };
const COLS: { id: ColumnId; label: string }[] = [
  { id: "name", label: "Task" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "duration", label: "Dur" },
];

const cellBase: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  padding: "0 6px",
  fontSize: 12,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  boxSizing: "border-box",
};

function ResizeHandle({
  col,
  width,
  onResizeCol,
}: {
  col: ColumnId;
  width: number;
  onResizeCol: (col: ColumnId, width: number) => void;
}): JSX.Element {
  const startRef = useRef({ x: 0, w: 0 });
  return (
    <div
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        startRef.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e: ReactPointerEvent<HTMLDivElement>) => {
        if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
        const w = Math.max(MIN_W[col], startRef.current.w + e.clientX - startRef.current.x);
        onResizeCol(col, w);
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        right: -3,
        top: 0,
        bottom: 0,
        width: 7,
        cursor: "col-resize",
        zIndex: 3,
      }}
    />
  );
}

/** Virtualized left grid with sortable, resizable columns and a name filter. */
export function Grid(props: GridProps): JSX.Element {
  const {
    rows, first, last, scrollY, rowHeight, headerH, widths,
    sort, filter, selectedId, relatedIds, collapsed,
    onToggle, onSelect, onOpenEditor, onSortToggle, onFilterChange, onResizeCol, onAdd,
  } = props;
  const width = widths.name + widths.start + widths.end + widths.duration;
  const labelRowH = Math.floor(headerH / 2);

  const items: JSX.Element[] = [];
  for (let i = first; i <= last; i++) {
    const row = rows[i];
    if (!row) continue;
    const t = row.task;
    const selected = t.id === selectedId;
    const related = !selected && !!relatedIds?.has(t.id);
    items.push(
      <div
        key={t.id}
        onClick={() => onSelect(t.id)}
        onDoubleClick={() => onOpenEditor(t.id)}
        style={{
          position: "absolute",
          top: headerH + i * rowHeight - scrollY,
          left: 0,
          right: 0,
          height: rowHeight,
          display: "flex",
          alignItems: "stretch",
          background: selected
            ? "rgba(74,137,220,0.40)"
            : related
              ? "rgba(74,137,220,0.22)"
              : undefined,
          borderLeft: selected || related ? "3px solid #1c4e9e" : "3px solid transparent",
          opacity: relatedIds !== null && !selected && !related ? 0.45 : undefined,
          borderBottom: "1px solid #f0f0f5",
          cursor: "pointer",
          boxSizing: "border-box",
          fontWeight: (t.type ?? "task") === "summary" ? 600 : 400,
        }}
      >
        <div style={{ ...cellBase, width: widths.name, paddingLeft: 6 + row.depth * 14 }}>
          {row.hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggle(t.id);
              }}
              style={{
                display: "inline-block",
                width: 14,
                cursor: "pointer",
                userSelect: "none",
                color: "#777",
                transform: collapsed.has(t.id) ? "rotate(-90deg)" : undefined,
              }}
            >
              ▾
            </span>
          ) : (
            <span style={{ display: "inline-block", width: 14 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
        </div>
        <div style={{ ...cellBase, width: widths.start, color: "#666" }}>{formatDateUTC(t.start)}</div>
        <div style={{ ...cellBase, width: widths.end, color: "#666" }}>{formatDateUTC(t.end)}</div>
        <div style={{ ...cellBase, width: widths.duration, color: "#666", justifyContent: "flex-end" }}>
          {Math.round((t.end - t.start) / DAY)}d
        </div>
      </div>,
    );
  }

  const headCell: CSSProperties = {
    ...cellBase,
    fontWeight: 600,
    color: "#555566",
    fontSize: 11,
    height: "100%",
    position: "relative",
    cursor: "pointer",
    userSelect: "none",
  };
  const arrow = (col: ColumnId) => (sort?.col === col ? (sort.dir === 1 ? " ▲" : " ▼") : "");

  return (
    <div
      style={{
        position: "relative",
        width,
        flex: "none",
        overflow: "hidden",
        borderRight: "1px solid #d8d8e2",
        background: "#fff",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: headerH,
          background: "#fafafc",
          borderBottom: "1px solid #d8d8e2",
          zIndex: 1,
          boxSizing: "border-box",
        }}
      >
        {/* row 1: column labels (click = sort, edge-drag = resize) */}
        <div style={{ display: "flex", height: labelRowH }}>
          {COLS.map(({ id, label }) => (
            <div
              key={id}
              onClick={() => onSortToggle(id)}
              title="Click to sort, drag edge to resize"
              style={{
                ...headCell,
                width: widths[id],
                justifyContent: id === "duration" ? "flex-end" : id === "name" ? "space-between" : "flex-start",
              }}
            >
              <span>
                {label}
                {arrow(id)}
              </span>
              {id === "name" && onAdd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  title="Add task (after selection)"
                  style={{
                    border: "1px solid #ccd",
                    borderRadius: 4,
                    background: "#fff",
                    cursor: "pointer",
                    width: 18,
                    height: 18,
                    lineHeight: 1,
                    fontSize: 12,
                    color: "#4a89dc",
                    padding: 0,
                  }}
                >
                  +
                </button>
              )}
              <ResizeHandle col={id} width={widths[id]} onResizeCol={onResizeCol} />
            </div>
          ))}
        </div>
        {/* row 2: filter box */}
        <div style={{ display: "flex", alignItems: "center", height: headerH - labelRowH, padding: "0 4px", boxSizing: "border-box" }}>
          <input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter tasks…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              font: "11px system-ui, sans-serif",
              padding: "2px 6px",
              border: "1px solid #dde",
              borderRadius: 3,
              outline: "none",
            }}
          />
          {filter && (
            <button
              onClick={() => onFilterChange("")}
              title="Clear filter"
              style={{ border: "none", background: "none", cursor: "pointer", color: "#999", fontSize: 12, padding: "0 4px" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {items}
    </div>
  );
}
