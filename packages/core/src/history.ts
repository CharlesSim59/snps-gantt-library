/**
 * Generic bounded undo/redo stack for host applications.
 *
 * The Gantt component is fully controlled, so history is the host's
 * concern: push the *previous* state before applying a change, then call
 * undo/redo with the *current* state to swap it.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 100) {}

  /** Record the state that is about to be replaced. Clears the redo stack. */
  push(state: T): void {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** Returns the previous state (moving `current` to the redo stack), or null. */
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(current);
    return prev;
  }

  /** Returns the next state (moving `current` to the undo stack), or null. */
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
