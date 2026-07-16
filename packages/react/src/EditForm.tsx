import { formatDateUTC, parseDateUTC, type Link, type Task } from "@snps/gantt-core";
import { useState, type CSSProperties } from "react";

export interface EditFormProps {
  task: Task;
  /** links where this task participates, with the other task's name */
  links: { link: Link; otherName: string; direction: "in" | "out" }[];
  onSave: (task: Task) => void;
  onDeleteLink: (id: string) => void;
  /** when provided, renders a Delete-task button */
  onDelete?: () => void;
  onClose: () => void;
}

const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12 };
const input: CSSProperties = {
  font: "13px system-ui, sans-serif",
  padding: "5px 8px",
  border: "1px solid #ccd",
  borderRadius: 4,
  boxSizing: "border-box",
  minWidth: 0,
};
/** date inputs have a large intrinsic width; force them to fit their column */
const dateInput: CSSProperties = { ...input, width: "100%" };

export function EditForm({ task, links, onSave, onDeleteLink, onDelete, onClose }: EditFormProps): JSX.Element {
  const [name, setName] = useState(task.name);
  const [start, setStart] = useState(formatDateUTC(task.start));
  const [end, setEnd] = useState(formatDateUTC(task.end));
  const [progress, setProgress] = useState(Math.round((task.progress ?? 0) * 100));

  const save = () => {
    const s = parseDateUTC(start);
    const e = parseDateUTC(end);
    if (s === null || e === null || e < s) return;
    onSave({ ...task, name, start: s, end: e, progress: Math.min(100, Math.max(0, progress)) / 100 });
  };

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter") save();
      }}
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        width: 290,
        boxSizing: "border-box",
        background: "#fff",
        border: "1px solid #ccd",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 10,
        font: "13px system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Edit task</strong>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 15 }}>
          ✕
        </button>
      </div>
      <label style={field}>
        Name
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ ...field, flex: 1, minWidth: 0 }}>
          Start
          <input style={dateInput} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ ...field, flex: 1, minWidth: 0 }}>
          End
          <input style={dateInput} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label style={field}>
        <span>
          Progress: <strong>{progress}%</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#4a89dc", cursor: "pointer" }}
        />
      </label>
      {links.length > 0 && (
        <div style={{ ...field }}>
          Dependencies
          {links.map(({ link, otherName, direction }) => (
            <div
              key={link.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {direction === "in" ? `← ${otherName}` : `→ ${otherName}`}
              </span>
              <button
                onClick={() => onDeleteLink(link.id)}
                style={{ border: "none", background: "none", color: "#c0392b", cursor: "pointer" }}
                title="Delete link"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{ ...input, cursor: "pointer", color: "#c0392b", marginRight: "auto" }}
          >
            Delete
          </button>
        )}
        <button onClick={onClose} style={{ ...input, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={save}
          style={{ ...input, cursor: "pointer", background: "#4a89dc", color: "#fff", border: "none" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
