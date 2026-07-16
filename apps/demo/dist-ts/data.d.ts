import { type Link, type Task } from "@snps/gantt-core";
/**
 * Deterministic synthetic dataset: `groups` summary tasks, each with
 * `perGroup - 1` child tasks chained finish-to-start plus a closing
 * milestone. Spread over a ~2 year window.
 */
export declare function generateData(groups?: number, perGroup?: number): {
    tasks: Task[];
    links: Link[];
};
