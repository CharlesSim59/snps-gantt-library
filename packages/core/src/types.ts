export type TaskType = "task" | "summary" | "milestone";

export interface Task {
  id: string;
  name: string;
  /** ms since epoch (UTC) */
  start: number;
  /** ms since epoch (UTC); for milestones end === start */
  end: number;
  /** 0..1 */
  progress?: number;
  type?: TaskType;
  parentId?: string | null;
}

export type LinkType = "FS";

export interface Link {
  id: string;
  /** predecessor task id */
  sourceId: string;
  /** successor task id */
  targetId: string;
  type?: LinkType;
}

/** A visible row after hierarchy flattening. */
export interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
}
